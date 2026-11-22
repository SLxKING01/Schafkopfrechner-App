create function private.sk_correct_closed_table(
  p_table_id uuid,p_version bigint,p_event_id uuid,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  t public.sk_live_tables;
  revisions jsonb;
  revision jsonb;
  last_event uuid;
  carried jsonb;
  previous_marker text := coalesce(current_setting('sk.closed_correction',true),'');
begin
  select * into t from public.sk_live_tables where id=p_table_id for update;
  if actor is null or t.owner_id is distinct from actor
     or t.payload->>'activeGame' is distinct from 'false'
     or t.payload#>>'{currentTable,isActive}' is distinct from 'false' then
    raise exception 'Nur der Ersteller kann einen abgeschlossenen Tisch korrigieren.' using errcode='42501';
  end if;
  revisions := coalesce(t.payload#>'{currentTable,settlementRevisions}','[]'::jsonb);
  revision := p_payload#>'{currentTable,settlementRevisions,-1}';
  if exists(select 1 from jsonb_array_elements(revisions) r where r->>'id'=revision->>'id') then
    return private.sk_live_command('read',p_table_id,null,null,null);
  end if;
  select id into last_event from private.sk_settlement_events where table_id=p_table_id order by sequence desc limit 1;
  if t.version is distinct from p_version or last_event is distinct from p_event_id then
    raise exception 'Tisch oder Zahlungen wurden geändert. Bitte eine neue Vorschau erstellen.' using errcode='PT409';
  end if;
  if octet_length(p_payload::text)>5000000
     or jsonb_typeof(p_payload->'rounds') is distinct from 'array'
     or jsonb_typeof(p_payload->'balances') is distinct from 'array'
     or jsonb_typeof(p_payload->'settlements') is distinct from 'array'
     or (p_payload-'currentTable'-'rounds'-'balances'-'settlements')
       is distinct from (t.payload-'currentTable'-'rounds'-'balances'-'settlements')
     or ((p_payload->'currentTable')-'roundHistory'-'settlementRevisions')
       is distinct from ((t.payload->'currentTable')-'roundHistory'-'settlementRevisions')
     or revision->>'id' is null or revision->>'id' !~ '^[0-9a-f-]{36}$'
     or revision->>'occurredAt' is null
     or revision#>>'{actor,kind}' is distinct from 'account'
     or revision#>>'{actor,id}' is distinct from actor::text
     or revision->'balances' is distinct from t.payload->'balances'
     or revision->'settlements' is distinct from t.payload->'settlements'
     or p_payload#>'{currentTable,settlementRevisions}'
       is distinct from revisions||jsonb_build_array(revision) then
    raise exception 'Ungültige Abschlusskorrektur.' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(t.payload->'settlements') s
    where s->>'isPaid' is distinct from 'true'
      and (select action from private.sk_settlement_events where table_id=p_table_id
        and payment_id=s->>'id' and action in ('report','undo_report') order by sequence desc limit 1)='report'
      and (select action from private.sk_settlement_events where table_id=p_table_id
        and payment_id=s->>'id' and action in ('confirm','undo_confirm') order by sequence desc limit 1) is distinct from 'confirm'
  ) then raise exception 'Gemeldete Zahlungen müssen zuerst geklärt werden.' using errcode='PT409'; end if;

  if jsonb_typeof(p_payload#>'{currentTable,roundHistory}') is distinct from 'array'
    or jsonb_array_length(p_payload#>'{currentTable,roundHistory}') <=
      jsonb_array_length(coalesce(t.payload#>'{currentTable,roundHistory}','[]'::jsonb))
    or exists(select 1 from jsonb_array_elements(p_payload#>'{currentTable,roundHistory}') with ordinality h(event,pos)
      where pos>jsonb_array_length(coalesce(t.payload#>'{currentTable,roundHistory}','[]'::jsonb))
        and (event#>>'{actor,kind}' is distinct from 'account' or event#>>'{actor,id}' is distinct from actor::text))
  then raise exception 'Die Korrektur braucht einen nachvollziehbaren Änderungsverlauf.' using errcode='22023'; end if;

  if exists(select 1 from jsonb_array_elements(t.payload->'rounds') old_round
      where old_round->>'stockAction' is distinct from 'refund' and not exists(
        select 1 from jsonb_array_elements(p_payload->'rounds') new_round
        where new_round->>'id'=old_round->>'id'
          and new_round->'participantIds' is not distinct from old_round->'participantIds'
          and new_round->'seatOrderIds' is not distinct from old_round->'seatOrderIds'
          and new_round#>'{roundContext,dealerIdBefore}' is not distinct from old_round#>'{roundContext,dealerIdBefore}'))
    or exists(select 1 from jsonb_array_elements(p_payload->'rounds') new_round where not exists(
      select 1 from jsonb_array_elements(t.payload->'rounds') old_round where old_round->>'id'=new_round->>'id'))
    or exists(select 1 from jsonb_array_elements(p_payload->'rounds') new_round
      join lateral (select r from jsonb_array_elements(t.payload->'rounds') r where r->>'id'=new_round->>'id') old_round on true
      where old_round.r->>'stockAction'='refund' and new_round->'loserIds' is distinct from old_round.r->'loserIds')
  then raise exception 'Historische Spielerplätze und Spiel-IDs müssen erhalten bleiben.' using errcode='22023'; end if;

  select coalesce(jsonb_agg(s order by pos),'[]'::jsonb) into carried
  from jsonb_array_elements(t.payload->'settlements') with ordinality as payments(s,pos)
  where s->>'isPaid'='true' or (select action from private.sk_settlement_events
    where table_id=p_table_id and payment_id=s->>'id' and action in ('confirm','undo_confirm')
    order by sequence desc limit 1)='confirm';
  if revision->'carriedPaymentIds' is distinct from (
       select coalesce(jsonb_agg(s->>'id' order by pos),'[]'::jsonb)
       from jsonb_array_elements(carried) with ordinality as payments(s,pos)
     )
     or exists(select 1 from jsonb_array_elements(carried) s
       where not (p_payload->'settlements' @> jsonb_build_array(s)))
     or (select count(*)<>count(distinct p->>'id') from jsonb_array_elements(p_payload->'settlements') p)
     or exists(select 1 from jsonb_array_elements(p_payload->'settlements') p
       where not (carried @> jsonb_build_array(p)) and (
         p->>'id' not like (revision->>'id')||':%'
         or p->>'isPaid' is distinct from 'false'
         or (p->>'amount')::numeric is null or (p->>'amount')::numeric<=0
         or round((p->>'amount')::numeric,2)<>(p->>'amount')::numeric
         or p->>'fromPlayerId'=p->>'toPlayerId'
         or not exists(select 1 from jsonb_array_elements(t.payload->'players') s where s->>'id'=p->>'fromPlayerId')
         or not exists(select 1 from jsonb_array_elements(t.payload->'players') s where s->>'id'=p->>'toPlayerId')
       )) then raise exception 'Der bisherige Zahlungsstand muss erhalten bleiben.' using errcode='22023'; end if;

  if jsonb_array_length(p_payload->'balances')<>jsonb_array_length(t.payload->'players')
     or exists(
       select 1 from jsonb_array_elements(t.payload->'players') s
       where (select count(*) from jsonb_array_elements(p_payload->'balances') b where b->>'playerId'=s->>'id')<>1
          or (select (b->>'amount')::numeric from jsonb_array_elements(p_payload->'balances') b where b->>'playerId'=s->>'id')
          is distinct from (
            select coalesce(sum(case when p->>'toPlayerId'=s->>'id' then (p->>'amount')::numeric
              when p->>'fromPlayerId'=s->>'id' then -(p->>'amount')::numeric else 0 end),0)
            from (
              select p from jsonb_array_elements(p_payload->'settlements') p
              union all
              select p from jsonb_array_elements(coalesce(t.payload#>'{currentTable,interimPayments}','[]'::jsonb)) p
              where p->>'voidedAt' is null
            ) movements
          )
     ) then raise exception 'Die Differenzzahlungen müssen die neuen Salden exakt ausgleichen.' using errcode='22023'; end if;

  perform set_config('sk.closed_correction',p_table_id::text,true);
  update public.sk_live_tables set payload=p_payload,version=version+1,updated_at=clock_timestamp() where id=p_table_id;
  perform set_config('sk.closed_correction',previous_marker,true);
  return private.sk_live_command('read',p_table_id,null,null,null);
end;
$$;
revoke all on function private.sk_correct_closed_table(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function private.sk_correct_closed_table(uuid,bigint,uuid,jsonb) to authenticated;
create function public.sk_correct_closed_table(p_table_id uuid,p_version bigint,p_event_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.sk_correct_closed_table(p_table_id,p_version,p_event_id,p_payload);
$$;
revoke all on function public.sk_correct_closed_table(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.sk_correct_closed_table(uuid,bigint,uuid,jsonb) to authenticated;

create or replace function private.sk_keep_closed_payment_plan() returns trigger
language plpgsql set search_path='' as $$
begin
  if current_setting('sk.closed_correction',true) is not distinct from new.id::text and auth.uid()=old.owner_id then return new; end if;
  if not (pg_trigger_depth()>1 and current_setting('sk.account_erasure',true) is not distinct from new.id::text)
    and (new.payload#>'{currentTable,settlementRevisions}' is distinct from old.payload#>'{currentTable,settlementRevisions}'
      or (old.payload->>'activeGame'='false' and (
        new.payload->'rounds' is distinct from old.payload->'rounds'
        or new.payload->'balances' is distinct from old.payload->'balances'
        or new.payload#>'{currentTable,roundHistory}' is distinct from old.payload#>'{currentTable,roundHistory}'))) then
    raise exception 'Abrechnungsversionen sind geschützt.' using errcode='42501';
  end if;
  if old.payload->>'activeGame' = 'false' and not (pg_trigger_depth()>1 and current_setting('sk.account_erasure',true) is not distinct from new.id::text) and
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

create or replace function private.sk_record_settlement_event(
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
  if not found or actor is null or not (exists(
    select 1 from public.sk_live_members where table_id=p_table_id and user_id=actor
  ) or exists(select 1 from private.sk_table_access_exits where table_id=p_table_id and user_id=actor and rejoined_at is null)) then raise exception 'Kein Zugriff auf diesen Tisch.' using errcode='42501'; end if;

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

  if exists(select 1 from jsonb_array_elements(coalesce(target.payload#>'{currentTable,settlementRevisions}','[]'::jsonb)) r
    where r->'carriedPaymentIds' ? p_payment_id) then
    raise exception 'Diese Zahlung wurde in eine spätere Abrechnung übernommen.' using errcode='22023';
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
