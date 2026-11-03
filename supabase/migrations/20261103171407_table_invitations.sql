-- Invitations grant no membership until explicitly accepted by the recipient.
create table private.sk_table_invitations (
 id uuid primary key,
 table_id uuid not null references public.sk_live_tables(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 player_id text not null check(length(player_id) between 1 and 100),
 role text not null check(role in ('read','write')),
 friend_version bigint not null,
 state text not null default 'pending' check(state in ('pending','accepted','declined','cancelled','invalid')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 check(sender_id<>recipient_id)
);
create index sk_table_invitations_recipient on private.sk_table_invitations(recipient_id,created_at desc) where state='pending';
create index sk_table_invitations_table on private.sk_table_invitations(table_id) where state='pending';
create index sk_table_invitations_sender on private.sk_table_invitations(sender_id,created_at desc) where state='pending';
alter table private.sk_table_invitations enable row level security;
revoke all on private.sk_table_invitations from public,anon,authenticated;

create function private.sk_table_invitation_available(i private.sk_table_invitations,t public.sk_live_tables) returns boolean language sql set search_path='' as $$
 select i.state='pending' and i.expires_at>now() and t.owner_id=i.sender_id
 and coalesce((t.payload->>'activeGame')::boolean,false) and coalesce((t.payload->'currentTable'->>'isActive')::boolean,false)
 and exists(select 1 from jsonb_array_elements(t.payload->'players') p where p->>'id'=i.player_id and p->>'userId' is null)
 and not exists(select 1 from public.sk_live_members where table_id=i.table_id and user_id=i.recipient_id)
 and exists(select 1 from private.sk_friend_pairs where low_id=least(i.sender_id,i.recipient_id) and high_id=greatest(i.sender_id,i.recipient_id) and state='friends' and version=i.friend_version)
 and not private.sk_friend_pair_blocked(i.sender_id,i.recipient_id);
$$;
revoke all on function private.sk_table_invitation_available(private.sk_table_invitations,public.sk_live_tables) from public,anon,authenticated;

create function private.sk_table_invitations_snapshot(p_actor uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('userId',p_actor,'invitations',coalesce(jsonb_agg(jsonb_build_object(
 'id',i.id,'tableId',i.table_id,'tableName',t.payload->'currentTable'->>'name','playerId',i.player_id,
 'playerName',coalesce((select p->>'name' from jsonb_array_elements(t.payload->'players') p where p->>'id'=i.player_id),'Entfernter Spielerplatz'),
 'sender',private.sk_profile_card(s),'recipient',private.sk_profile_card(r),'role',i.role,
 'createdAt',i.created_at,'expiresAt',i.expires_at,'available',private.sk_table_invitation_available(i,t)) order by i.created_at desc,i.id),'[]'::jsonb))
 from private.sk_table_invitations i join public.sk_live_tables t on t.id=i.table_id
 join private.sk_profiles s on s.user_id=i.sender_id join private.sk_profiles r on r.user_id=i.recipient_id
 where p_actor in(i.sender_id,i.recipient_id) and i.state='pending';
$$;
revoke all on function private.sk_table_invitations_snapshot(uuid) from public,anon,authenticated;

create function private.sk_table_invitations_list(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or actor is distinct from p_user_id then raise exception 'Bitte das aktive Konto prüfen.' using errcode='42501'; end if;
 if not private.sk_friend_limit(actor,'invitation_read',120) then raise exception 'Bitte kurz warten und erneut laden.' using errcode='PT429'; end if;
 return private.sk_table_invitations_snapshot(actor);
end $$;
revoke all on function private.sk_table_invitations_list(uuid) from public,anon;
grant execute on function private.sk_table_invitations_list(uuid) to authenticated;
create function public.sk_table_invitations_list(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.sk_table_invitations_list(p_user_id); $$;
revoke all on function public.sk_table_invitations_list(uuid) from public,anon;
grant execute on function public.sk_table_invitations_list(uuid) to authenticated;

create function private.sk_table_invitation_command(p_user_id uuid,p_action text,p_id uuid,p_table_id uuid,p_recipient uuid,p_player_id text,p_role text,p_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
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
  elsif exists(select 1 from public.sk_live_members where table_id=tid and user_id=other_id) or not exists(select 1 from jsonb_array_elements(t.payload->'players') p where p->>'id'=p_player_id and p->>'userId' is null) then denial:='OCCUPIED';
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
    update public.sk_live_tables set payload=jsonb_set(payload,'{players}',updated_players),version=version+1,updated_at=clock_timestamp() where id=tid;
    update public.sk_live_members set role=i.role where table_id=tid and user_id=actor;
    update private.sk_table_invitations set state='accepted' where id=p_id;
    -- Other invitations to this seat/account cannot be accepted later.
    update private.sk_table_invitations set state='invalid' where table_id=tid and state='pending' and (player_id=i.player_id or recipient_id=actor);
   end if;
  else update private.sk_table_invitations set state=case p_action when 'decline' then 'declined' else 'cancelled' end where id=p_id;
  end if;
 end if;
 return jsonb_build_object('ok',denial is null,'code',denial,'message',case denial when 'STALE' then 'Der Tisch wurde inzwischen geändert. Bitte erneut laden.' when 'PENDING' then 'Für diesen Platz oder Kontakt ist bereits eine Einladung offen.' else 'Diese Einladung ist nicht mehr möglich. Bitte den aktuellen Stand prüfen.' end,'state',private.sk_table_invitations_snapshot(actor));
end $$;
revoke all on function private.sk_table_invitation_command(uuid,text,uuid,uuid,uuid,text,text,bigint) from public,anon;
grant execute on function private.sk_table_invitation_command(uuid,text,uuid,uuid,uuid,text,text,bigint) to authenticated;
create function public.sk_table_invitation_command(p_user_id uuid,p_action text,p_id uuid,p_table_id uuid default null,p_recipient uuid default null,p_player_id text default null,p_role text default null,p_version bigint default null) returns jsonb language sql security invoker set search_path='' as $$ select private.sk_table_invitation_command(p_user_id,p_action,p_id,p_table_id,p_recipient,p_player_id,p_role,p_version); $$;
revoke all on function public.sk_table_invitation_command(uuid,text,uuid,uuid,uuid,text,text,bigint) from public,anon;
grant execute on function public.sk_table_invitation_command(uuid,text,uuid,uuid,uuid,text,text,bigint) to authenticated;

-- Retain existing memberships. Old clients can no longer assign new foreign
-- accounts through create/save, bypassing the recipient's consent.
alter function private.sk_live_command(text,uuid,jsonb,bigint,text) rename to sk_live_command_before_invitations;
revoke all on function private.sk_live_command_before_invitations(text,uuid,jsonb,bigint,text) from public,anon,authenticated;
create function private.sk_live_command(p_action text,p_table_id uuid,p_payload jsonb,p_version bigint,p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_payload jsonb; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 if p_action in('save','create') then
  if p_action='save' then select payload into old_payload from public.sk_live_tables where id=p_table_id for update; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'players') p where p->>'userId' is not null and p->>'userId'<>actor::text and not exists(select 1 from jsonb_array_elements(coalesce(old_payload->'players','[]'::jsonb)) q where q->>'id'=p->>'id' and q->>'userId'=p->>'userId')) then
   raise exception 'Neue Konten können nur über eine angenommene Einladung verknüpft werden.' using errcode='42501';
  end if;
 end if;
 return private.sk_live_command_before_invitations(p_action,p_table_id,p_payload,p_version,p_code);
end $$;
revoke all on function private.sk_live_command(text,uuid,jsonb,bigint,text) from public,anon;
grant execute on function private.sk_live_command(text,uuid,jsonb,bigint,text) to authenticated;
