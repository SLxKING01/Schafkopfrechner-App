-- Keep payment acknowledgements outside client-writable table snapshots.
create table private.sk_settlement_events (
  sequence bigint generated always as identity primary key,
  id uuid not null unique,
  table_id uuid not null references public.sk_live_tables(id) on delete cascade,
  payment_id text not null,
  action text not null check (action in ('report','confirm','undo_report','undo_confirm')),
  actor_id uuid not null,
  actor_name text not null,
  player_id text not null,
  player_name text not null,
  delegated boolean not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index sk_settlement_events_payment on private.sk_settlement_events(table_id,payment_id,sequence);
revoke all on private.sk_settlement_events from public,anon,authenticated;

create function private.sk_keep_closed_payment_plan() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.payload->>'activeGame' = 'false' and
    (new.payload->>'activeGame' is distinct from 'false'
      or new.payload->'settlements' is distinct from old.payload->'settlements'
      or (select count(*) <> count(distinct p->>'id') from jsonb_array_elements(new.payload->'players') p)
      or exists (
        select 1 from jsonb_array_elements(old.payload->'players') p
        where not exists (
          select 1 from jsonb_array_elements(new.payload->'players') q
          where q->>'id'=p->>'id'
            and (p->>'userId' is null or q->>'userId'=p->>'userId')
        )
      )) then
    raise exception 'Der abgeschlossene Zahlungsplan kann nicht überschrieben werden.' using errcode='42501';
  end if;
  if old.payload->>'activeGame' = 'true' and new.payload->>'activeGame' = 'false'
    and exists(select 1 from jsonb_array_elements(new.payload->'settlements') s where s->>'isPaid'='true')
  then raise exception 'Zahlungen werden erst nach Tischabschluss bestätigt.' using errcode='42501'; end if;
  return new;
end $$;
create trigger sk_keep_closed_payment_plan before update of payload on public.sk_live_tables
for each row execute function private.sk_keep_closed_payment_plan();

create function public.sk_read_settlement_events(p_table_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.sk_live_members where table_id=p_table_id and user_id=auth.uid()) then
    raise exception 'Kein Zugriff auf diesen Tisch.' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(e)-'table_id'-'sequence' order by e.sequence),'[]'::jsonb)
    from private.sk_settlement_events e where table_id=p_table_id);
end $$;

create function public.sk_record_settlement_event(
  p_table_id uuid,p_payment_id text,p_action text,p_request_id uuid,p_expected_event uuid
) returns void language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  target public.sk_live_tables;
  payment jsonb;
  participant jsonb;
  participant_id text;
  linked_account text;
  last_event uuid;
  report_event private.sk_settlement_events;
  confirm_event private.sk_settlement_events;
  prior private.sk_settlement_events;
begin
  select * into target from public.sk_live_tables where id=p_table_id for update;
  if not found or actor is null or not exists(
    select 1 from public.sk_live_members where table_id=p_table_id and user_id=actor
  ) then raise exception 'Kein Zugriff auf diesen Tisch.' using errcode='42501'; end if;

  if target.payload->>'activeGame' is distinct from 'false'
    or target.payload->'currentTable'->>'isActive' is distinct from 'false'
    or p_action is null or p_action not in ('report','confirm','undo_report','undo_confirm') then
    raise exception 'Ungültige Zahlungsaktion.' using errcode='22023';
  end if;

  select s into payment from jsonb_array_elements(target.payload->'settlements') s where s->>'id'=p_payment_id;
  if payment is null or payment->>'isPaid'='true' then
    raise exception 'Diese Zahlung ist nicht verfügbar.' using errcode='22023';
  end if;
  participant_id := payment->>case when p_action in ('report','undo_report') then 'fromPlayerId' else 'toPlayerId' end;
  select p into participant from jsonb_array_elements(target.payload->'players') p where p->>'id'=participant_id;
  linked_account := participant->>'userId';
  if participant is null or not coalesce(
    linked_account=actor::text or (linked_account is null and target.owner_id=actor),false
  ) then raise exception 'Diese Aktion ist diesem Spielerkonto vorbehalten.' using errcode='42501'; end if;

  select * into prior from private.sk_settlement_events where id=p_request_id;
  if found then
    if prior.table_id=p_table_id and prior.payment_id=p_payment_id and prior.action=p_action and prior.actor_id=actor then return; end if;
    raise exception 'Ungültige Vorgangs-ID.' using errcode='22023';
  end if;

  select id into last_event from private.sk_settlement_events where table_id=p_table_id and payment_id=p_payment_id order by sequence desc limit 1;
  if last_event is distinct from p_expected_event then
    raise exception 'Die Zahlung wurde inzwischen geändert.' using errcode='PT409';
  end if;
  select * into report_event from private.sk_settlement_events where table_id=p_table_id and payment_id=p_payment_id
    and action in ('report','undo_report') order by sequence desc limit 1;
  select * into confirm_event from private.sk_settlement_events where table_id=p_table_id and payment_id=p_payment_id
    and action in ('confirm','undo_confirm') order by sequence desc limit 1;

  if not (case p_action
    when 'report' then confirm_event.action is distinct from 'confirm' and report_event.action is distinct from 'report'
    when 'confirm' then confirm_event.action is distinct from 'confirm'
    when 'undo_report' then confirm_event.action is distinct from 'confirm' and report_event.action='report' and report_event.actor_id=actor
    when 'undo_confirm' then confirm_event.action='confirm' and confirm_event.actor_id=actor
  end) is true then raise exception 'Dieser Statuswechsel ist nicht möglich.' using errcode='22023'; end if;

  insert into private.sk_settlement_events(id,table_id,payment_id,action,actor_id,actor_name,player_id,player_name,delegated)
  values(p_request_id,p_table_id,p_payment_id,p_action,actor,
    coalesce((select display_name from private.sk_profiles where user_id=actor),'Spieler'),
    participant_id,coalesce(participant->>'name','Spieler'),linked_account is null);
end $$;

revoke all on function public.sk_read_settlement_events(uuid) from public,anon;
revoke all on function public.sk_record_settlement_event(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.sk_read_settlement_events(uuid) to authenticated;
grant execute on function public.sk_record_settlement_event(uuid,text,text,uuid,uuid) to authenticated;
