alter table private.sk_table_invitations add column cancelled_at timestamptz;

create table private.sk_table_access_exits (
  id uuid primary key,
  table_id uuid not null references public.sk_live_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  player_id text not null,
  exited_at timestamptz not null default clock_timestamp(),
  rejoined_at timestamptz
);
create unique index sk_table_access_active_exit on private.sk_table_access_exits(table_id,user_id)
  where rejoined_at is null;
create index sk_table_access_exits_by_user on private.sk_table_access_exits(user_id);
alter table private.sk_table_access_exits enable row level security;
revoke all on private.sk_table_access_exits from public,anon,authenticated;

create function private.sk_exit_table(p_id uuid,p_table_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  target public.sk_live_tables;
  prior private.sk_table_access_exits;
  seat text;
begin
  select * into target from public.sk_live_tables where id=p_table_id for update;
  if actor is null or target.id is null or p_user_id is null
     or p_user_id=target.owner_id or (actor<>target.owner_id and actor<>p_user_id) then
    raise exception 'Kein Zugriff auf diese Aktion.' using errcode='42501';
  end if;
  select * into prior from private.sk_table_access_exits where id=p_id;
  if found then
    if prior.table_id=p_table_id and prior.user_id=p_user_id and prior.actor_id=actor then return; end if;
    raise exception 'Ungültige Vorgangs-ID.' using errcode='22023';
  end if;
  if exists(select 1 from private.sk_table_access_exits e
     where e.table_id=p_table_id and e.user_id=p_user_id and e.rejoined_at is null) then return; end if;
  select p->>'id' into seat from jsonb_array_elements(target.payload->'players') p
    where p->>'userId'=p_user_id::text;
  if seat is null or not exists(select 1 from public.sk_live_members m
      where m.table_id=p_table_id and m.user_id=p_user_id) then
    raise exception 'Kein aktiver Tischzugriff.' using errcode='42501';
  end if;
  insert into private.sk_table_access_exits(id,table_id,user_id,actor_id,player_id)
    values(p_id,p_table_id,p_user_id,actor,seat);
  delete from public.sk_live_members where table_id=p_table_id and user_id=p_user_id;
  update public.sk_live_tables set version=version+1,updated_at=clock_timestamp() where id=p_table_id;
end;
$$;
revoke all on function private.sk_exit_table(uuid,uuid,uuid) from public,anon;
grant execute on function private.sk_exit_table(uuid,uuid,uuid) to authenticated;
create function public.sk_exit_table(p_id uuid,p_table_id uuid,p_user_id uuid) returns void
language sql security invoker set search_path='' as $$
  select private.sk_exit_table(p_id,p_table_id,p_user_id);
$$;
revoke all on function public.sk_exit_table(uuid,uuid,uuid) from public,anon;
grant execute on function public.sk_exit_table(uuid,uuid,uuid) to authenticated;

create or replace function private.sk_live_roster_members() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from jsonb_array_elements(new.payload->'players') p where p->>'userId' is not null) <>
     (select count(distinct p->>'userId') from jsonb_array_elements(new.payload->'players') p where p->>'userId' is not null)
  then raise exception 'Ein Benutzerkonto kann nur einmal am Tisch sitzen.'; end if;
  if not (pg_trigger_depth()>1 and current_setting('sk.account_erasure',true) is not distinct from new.id::text)
    and exists(select 1 from private.sk_table_access_exits e
      where e.table_id=new.id and e.rejoined_at is null and not exists(
        select 1 from jsonb_array_elements(new.payload->'players') p
        where p->>'userId'=e.user_id::text and p->>'id'=e.player_id)) then
    raise exception 'Ein ehemaliger Teilnehmer muss seinem Spielerplatz zugeordnet bleiben.' using errcode='42501';
  end if;
  insert into public.sk_live_members(table_id,user_id)
    select new.id,(p->>'userId')::uuid from jsonb_array_elements(new.payload->'players') p
    where p->>'userId' is not null and not exists(select 1 from private.sk_table_access_exits e
      where e.table_id=new.id and e.user_id::text=p->>'userId' and e.rejoined_at is null)
    on conflict do nothing;
  delete from public.sk_live_members m where m.table_id=new.id and m.user_id<>new.owner_id and not exists(
    select 1 from jsonb_array_elements(new.payload->'players') p where p->>'userId'=m.user_id::text);
  return new;
end $$;

-- The former participant only receives their own balance and their payments.
create function private.sk_personal_settlements() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'tableId',t.id,'name',t.payload#>>'{currentTable,name}',
    'active',coalesce((t.payload->>'activeGame')::boolean,true),
    'playerId',e.player_id,'exitedAt',e.exited_at,
    'balance',balance.amount,'payments',payments.items,'events',events.items
  ) order by e.exited_at desc),'[]'::jsonb)
  from private.sk_table_access_exits e
  join public.sk_live_tables t on t.id=e.table_id
  left join lateral (
    select (b->'amount') as amount
    from jsonb_array_elements(coalesce(t.payload->'balances','[]'::jsonb)) b
    where t.payload->>'activeGame'='false' and b->>'playerId'=e.player_id limit 1
  ) balance on true
  cross join lateral (
    select coalesce(jsonb_agg(s || jsonb_build_object(
      'fromName',(select p->>'name' from jsonb_array_elements(t.payload->'players') p where p->>'id'=s->>'fromPlayerId'),
      'toName',(select p->>'name' from jsonb_array_elements(t.payload->'players') p where p->>'id'=s->>'toPlayerId'),
      'locked',exists(select 1 from jsonb_array_elements(coalesce(t.payload#>'{currentTable,settlementRevisions}','[]'::jsonb)) r
        where r->'carriedPaymentIds' ? (s->>'id'))
    )), '[]'::jsonb) as items
    from jsonb_array_elements(coalesce(t.payload->'settlements','[]'::jsonb)) s
    where t.payload->>'activeGame'='false' and e.player_id in (s->>'fromPlayerId',s->>'toPlayerId')
  ) payments
  cross join lateral (
    select coalesce(jsonb_agg(to_jsonb(se)-'table_id'-'sequence'-'actor_id'
      || jsonb_build_object('actor_id',case when se.actor_id=e.user_id then se.actor_id else null end)
      order by se.sequence),'[]'::jsonb) as items
    from private.sk_settlement_events se where se.table_id=t.id and exists(
      select 1 from jsonb_array_elements(payments.items) p where p->>'id'=se.payment_id)
  ) events
  where e.user_id=auth.uid() and e.rejoined_at is null;
$$;
revoke all on function private.sk_personal_settlements() from public,anon;
grant execute on function private.sk_personal_settlements() to authenticated;
create function public.sk_personal_settlements() returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.sk_personal_settlements();
$$;
revoke all on function public.sk_personal_settlements() from public,anon;
grant execute on function public.sk_personal_settlements() to authenticated;

-- Keep payment rights tied to the participant even after general access ends.
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

-- A new accepted invitation can restore only the very same account and seat.
create or replace function private.sk_table_invitation_available(i private.sk_table_invitations,t public.sk_live_tables) returns boolean language sql set search_path='' as $$
 select i.state='pending' and i.expires_at>now() and t.owner_id=i.sender_id
 and coalesce((t.payload->>'activeGame')::boolean,false) and coalesce((t.payload->'currentTable'->>'isActive')::boolean,false)
 and exists(select 1 from jsonb_array_elements(t.payload->'players') p where p->>'id'=i.player_id and (p->>'userId' is null or (p->>'userId'=i.recipient_id::text and exists(select 1 from private.sk_table_access_exits e where e.table_id=i.table_id and e.user_id=i.recipient_id and e.player_id=i.player_id and e.rejoined_at is null))))
 and not exists(select 1 from public.sk_live_members where table_id=i.table_id and user_id=i.recipient_id)
 and exists(select 1 from private.sk_friend_pairs where low_id=least(i.sender_id,i.recipient_id) and high_id=greatest(i.sender_id,i.recipient_id) and state='friends' and version=i.friend_version)
 and not private.sk_friend_pair_blocked(i.sender_id,i.recipient_id);
$$;

create or replace function private.sk_table_invitation_command(p_user_id uuid,p_action text,p_id uuid,p_table_id uuid,p_recipient uuid,p_player_id text,p_role text,p_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); i private.sk_table_invitations; t public.sk_live_tables; f private.sk_friend_pairs;
 other_id uuid; tid uuid; updated_players jsonb; denial text;
begin
 if actor is null or actor is distinct from p_user_id then raise exception 'Bitte das aktive Konto prüfen.' using errcode='42501'; end if;
 if p_id is null or p_action is null or p_action not in('send','accept','decline','cancel') then raise exception 'Ungültige Einladung.' using errcode='22023'; end if;
 -- Same invitation ID never creates a second invitation or restores a terminal one.
 perform pg_advisory_xact_lock(hashtextextended('table-invitation:'||p_id::text,0));
 select * into i from private.sk_table_invitations where id=p_id;
 if p_action='send' then
  if i.id is not null then
   if i.sender_id<>actor or i.table_id is distinct from p_table_id or i.recipient_id is distinct from p_recipient or i.player_id is distinct from p_player_id or i.role is distinct from p_role then raise exception 'Diese Einladungskennung gehört zu einem anderen Auftrag.' using errcode='22023'; end if;
   return jsonb_build_object('ok',true,'state',private.sk_table_invitations_snapshot(actor));
  end if;
  if p_recipient is null or p_recipient=actor or p_role is null or p_role not in('read','write') or p_player_id is null then raise exception 'Ungültige Einladung.' using errcode='22023'; end if;
  other_id:=p_recipient; tid:=p_table_id;
 else
  if i.id is null or (p_action='cancel' and i.sender_id<>actor) or (p_action in('accept','decline') and i.recipient_id<>actor) then raise exception 'Kein Zugriff auf diese Einladung.' using errcode='42501'; end if;
  if i.state<>'pending' then
   return jsonb_build_object('ok',i.state=case p_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'cancelled' end,'code','STALE','message','Diese Einladung ist bereits erledigt.','state',private.sk_table_invitations_snapshot(actor));
  end if;
  other_id:=case when actor=i.sender_id then i.recipient_id else i.sender_id end; tid:=i.table_id;
 end if;
 if not private.sk_friend_limit(actor,'invitation_write',30) then return jsonb_build_object('ok',false,'code','RATE_LIMIT','message','Bitte kurz warten und erneut versuchen.','state',private.sk_table_invitations_snapshot(actor)); end if;
 -- Friend actions lock the same pair; table saves, role changes and all invitation
 -- mutations lock the table. Global order: pair, table, invitation.
 if p_action in('send','accept') then
  select * into f from private.sk_friend_pairs where low_id=least(actor,other_id) and high_id=greatest(actor,other_id) for update;
 end if;
 select * into t from public.sk_live_tables where id=tid for update;
 if t.id is null then raise exception 'Der Tisch ist nicht mehr verfügbar.' using errcode='42501'; end if;
 if p_action='send' then
  if t.owner_id<>actor then raise exception 'Nur der Ersteller darf Freunde einladen.' using errcode='42501'; end if;
  if t.version is distinct from p_version then denial:='STALE';
  elsif f.state is distinct from 'friends' or private.sk_friend_pair_blocked(actor,other_id) then denial:='UNAVAILABLE';
  elsif not coalesce((t.payload->>'activeGame')::boolean,false) or not coalesce((t.payload->'currentTable'->>'isActive')::boolean,false) then denial:='CLOSED';
  elsif exists(select 1 from public.sk_live_members where table_id=tid and user_id=other_id) or not exists(select 1 from jsonb_array_elements(t.payload->'players') p where p->>'id'=p_player_id and (p->>'userId' is null or (p->>'userId'=other_id::text and exists(select 1 from private.sk_table_access_exits e where e.table_id=tid and e.user_id=other_id and e.player_id=p_player_id and e.rejoined_at is null)))) then denial:='OCCUPIED';
  elsif exists(select 1 from private.sk_table_invitations where table_id=tid and state='pending' and expires_at>now() and (recipient_id=other_id or player_id=p_player_id)) then denial:='PENDING';
  else
   insert into private.sk_table_invitations(id,table_id,sender_id,recipient_id,player_id,role,friend_version) values(p_id,tid,actor,other_id,p_player_id,p_role,f.version);
  end if;
 else
  select * into i from private.sk_table_invitations where id=p_id for update;
  if p_action='accept' then
   if not private.sk_table_invitation_available(i,t) then
    update private.sk_table_invitations set state='invalid' where id=p_id; denial:='UNAVAILABLE';
   else
    select jsonb_agg(case when p->>'id'=i.player_id then p||jsonb_build_object('userId',actor,'isLocal',false) else p end order by ord) into updated_players
    from jsonb_array_elements(t.payload->'players') with ordinality a(p,ord);
    update private.sk_table_access_exits set rejoined_at=clock_timestamp() where table_id=tid and user_id=actor and player_id=i.player_id and rejoined_at is null;
    update public.sk_live_tables set payload=jsonb_set(payload,'{players}',updated_players),version=version+1,updated_at=clock_timestamp() where id=tid;
    update public.sk_live_members set role=i.role where table_id=tid and user_id=actor;
    update private.sk_table_invitations set state='accepted' where id=p_id;
    -- Other invitations to this seat/account cannot be accepted later.
    update private.sk_table_invitations set state='invalid' where table_id=tid and state='pending' and (player_id=i.player_id or recipient_id=actor);
   end if;
  else update private.sk_table_invitations set state=case p_action when 'decline' then 'declined' else 'cancelled' end,
    cancelled_at=case when p_action='cancel' then clock_timestamp() else null end where id=p_id;
  end if;
 end if;
 return jsonb_build_object('ok',denial is null,'code',denial,'message',case denial when 'STALE' then 'Der Tisch wurde inzwischen geändert. Bitte erneut laden.' when 'PENDING' then 'Für diesen Platz oder Kontakt ist bereits eine Einladung offen.' else 'Diese Einladung ist nicht mehr möglich. Bitte den aktuellen Stand prüfen.' end,'state',private.sk_table_invitations_snapshot(actor));
end $$;
