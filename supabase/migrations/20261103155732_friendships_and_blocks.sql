-- All social data is private. Public RPC wrappers authenticate and delegate.
create table private.sk_friend_codes (
 user_id uuid primary key references private.sk_profiles(user_id) on delete cascade,
 code text not null unique check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$'),
 revision bigint not null default 1
);
create table private.sk_friend_pairs (
 low_id uuid not null references private.sk_profiles(user_id) on delete cascade,
 high_id uuid not null references private.sk_profiles(user_id) on delete cascade,
 state text not null default 'none' check(state in ('none','pending','friends')),
 sender_id uuid,
 request_id uuid,
 version bigint not null default 0,
 updated_at timestamptz not null default now(),
 primary key(low_id,high_id), check(low_id<high_id),
 check((state='pending' and sender_id is not null and sender_id in (low_id,high_id) and request_id is not null) or (state<>'pending' and sender_id is null and request_id is null))
);
create index sk_friend_pairs_high on private.sk_friend_pairs(high_id);
create table private.sk_friend_blocks (
 blocker_id uuid not null references private.sk_profiles(user_id) on delete cascade,
 blocked_id uuid not null references private.sk_profiles(user_id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 label text not null,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index sk_friend_blocks_target on private.sk_friend_blocks(blocked_id);
create table private.sk_friend_limits (
 user_id uuid not null references private.sk_profiles(user_id) on delete cascade,
 category text not null,
 window_at timestamptz not null,
 used int not null,
 primary key(user_id,category)
);
create table private.sk_friend_operations (
 user_id uuid not null references private.sk_profiles(user_id) on delete cascade,
 operation_id uuid not null,
 request_hash text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
create index sk_friend_operations_age on private.sk_friend_operations(user_id,created_at);
alter table private.sk_friend_codes enable row level security;
alter table private.sk_friend_pairs enable row level security;
alter table private.sk_friend_blocks enable row level security;
alter table private.sk_friend_limits enable row level security;
alter table private.sk_friend_operations enable row level security;
revoke all on private.sk_friend_codes,private.sk_friend_pairs,private.sk_friend_blocks,private.sk_friend_limits,private.sk_friend_operations from public,anon,authenticated;

create function private.sk_friend_ensure_code(p_actor uuid) returns void language plpgsql set search_path='' as $$
declare candidate text; i int; tries int;
begin
 if exists(select 1 from private.sk_friend_codes where user_id=p_actor) then return; end if;
 for tries in 1..8 loop
  candidate:='';
  for i in 1..12 loop candidate:=candidate||substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',1+(get_byte(uuid_send(gen_random_uuid()),0)%32),1); end loop;
  begin
   insert into private.sk_friend_codes(user_id,code) values(p_actor,candidate) on conflict(user_id) do nothing;
   return;
  exception when unique_violation then null; end;
 end loop;
 raise exception 'Freundescode konnte nicht erzeugt werden. Bitte erneut versuchen.';
end $$;
revoke all on function private.sk_friend_ensure_code(uuid) from public,anon,authenticated;

create function private.sk_friend_limit(p_actor uuid,p_category text,p_max int) returns boolean language plpgsql set search_path='' as $$
declare amount int; bucket timestamptz:=date_trunc('minute',clock_timestamp());
begin
 insert into private.sk_friend_limits(user_id,category,window_at,used) values(p_actor,p_category,bucket,1)
 on conflict(user_id,category) do update set window_at=excluded.window_at,
 used=case when private.sk_friend_limits.window_at=excluded.window_at then least(private.sk_friend_limits.used+1,p_max+1) else 1 end returning used into amount;
 return amount<=p_max;
end $$;
revoke all on function private.sk_friend_limit(uuid,text,int) from public,anon,authenticated;

create function private.sk_friend_pair_blocked(p_a uuid,p_b uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from private.sk_friend_blocks where (blocker_id=p_a and blocked_id=p_b) or (blocker_id=p_b and blocked_id=p_a));
$$;
revoke all on function private.sk_friend_pair_blocked(uuid,uuid) from public,anon,authenticated;

-- One SQL statement gives lists and revision from the same MVCC snapshot.
create function private.sk_friend_snapshot(p_actor uuid) returns jsonb language sql set search_path='' as $$
 with contacts as (
  select p.*, case when p.low_id=p_actor then p.high_id else p.low_id end as other_id
  from private.sk_friend_pairs p where p_actor in (p.low_id,p.high_id) and p.state<>'none'
 ), entries as (
  select c.*, private.sk_profile_card(p) as card from contacts c join private.sk_profiles p on p.user_id=c.other_id
  where not private.sk_friend_pair_blocked(p_actor,c.other_id)
 )
 select jsonb_build_object('userId',p_actor,'version',s.revision,'code',s.code,
 'friends',coalesce((select jsonb_agg(jsonb_build_object('profile',card,'pairVersion',version,'requestId',request_id,'blockId',null) order by card->>'displayName',other_id) from entries where state='friends'),'[]'::jsonb),
 'incoming',coalesce((select jsonb_agg(jsonb_build_object('profile',card,'pairVersion',version,'requestId',request_id,'blockId',null) order by updated_at desc,other_id) from entries where state='pending' and sender_id<>p_actor),'[]'::jsonb),
 'outgoing',coalesce((select jsonb_agg(jsonb_build_object('profile',card,'pairVersion',version,'requestId',request_id,'blockId',null) order by updated_at desc,other_id) from entries where state='pending' and sender_id=p_actor),'[]'::jsonb),
 'blocked',coalesce((select jsonb_agg(jsonb_build_object('profile',jsonb_build_object('id',b.blocked_id,'displayName',b.label,'avatarKind','none','animalId',null,'accentId','forestGreen','photoPath',null,'version',1),'pairVersion',p.version,'requestId',null,'blockId',b.id) order by b.created_at desc,b.blocked_id)
 from private.sk_friend_blocks b join private.sk_friend_pairs p on p.low_id=least(b.blocker_id,b.blocked_id) and p.high_id=greatest(b.blocker_id,b.blocked_id) where b.blocker_id=p_actor),'[]'::jsonb))
 from private.sk_friend_codes s where s.user_id=p_actor;
$$;
revoke all on function private.sk_friend_snapshot(uuid) from public,anon,authenticated;

create function private.sk_friends_state(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or actor is distinct from p_user_id then raise exception 'Bitte das aktive Konto prüfen.' using errcode='42501'; end if;
 perform private.sk_friend_ensure_code(actor);
 if not private.sk_friend_limit(actor,'read',120) then raise exception 'Bitte kurz warten und erneut laden.' using errcode='PT429'; end if;
 return private.sk_friend_snapshot(actor);
end $$;
revoke all on function private.sk_friends_state(uuid) from public,anon;
grant execute on function private.sk_friends_state(uuid) to authenticated;
create function public.sk_friends_state(p_user_id uuid) returns jsonb language sql set search_path='' as $$ select private.sk_friends_state(p_user_id); $$;
revoke all on function public.sk_friends_state(uuid) from public,anon;
grant execute on function public.sk_friends_state(uuid) to authenticated;

create function private.sk_friends_find(p_code text,p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); normalized text:=upper(regexp_replace(coalesce(p_code,''),'[[:space:]-]','','g')); target uuid; pair private.sk_friend_pairs; relation text; card jsonb;
begin
 if actor is null or actor is distinct from p_user_id then raise exception 'Bitte das aktive Konto prüfen.' using errcode='42501'; end if;
 if not private.sk_friend_limit(actor,'find',20) then return jsonb_build_object('ok',false,'code','RATE_LIMIT','message','Zu viele Suchversuche. Bitte in einer Minute erneut versuchen.'); end if;
 if normalized !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$' then return jsonb_build_object('ok',true,'userId',actor,'status','invalid','entry',null,'relation',null); end if;
 select user_id into target from private.sk_friend_codes where code=normalized;
 if target is null or private.sk_friend_pair_blocked(actor,target) then return jsonb_build_object('ok',true,'userId',actor,'status','not_found','entry',null,'relation',null); end if;
 if target=actor then return jsonb_build_object('ok',true,'userId',actor,'status','self','entry',null,'relation',null); end if;
 select * into pair from private.sk_friend_pairs where low_id=least(actor,target) and high_id=greatest(actor,target);
 relation:=case when pair.state='friends' then 'friend' when pair.state='pending' then case when pair.sender_id=actor then 'outgoing' else 'incoming' end else 'none' end;
 insert into private.sk_profile_image_access(viewer_id,profile_id,expires_at) values(actor,target,now()+interval '15 minutes') on conflict(viewer_id,profile_id) do update set expires_at=excluded.expires_at;
 select private.sk_profile_card(p) into card from private.sk_profiles p where user_id=target;
 return jsonb_build_object('ok',true,'userId',actor,'status','found','relation',relation,'entry',jsonb_build_object('profile',card,'pairVersion',coalesce(pair.version,0),'requestId',pair.request_id,'blockId',null));
end $$;
revoke all on function private.sk_friends_find(text,uuid) from public,anon;
grant execute on function private.sk_friends_find(text,uuid) to authenticated;
create function public.sk_friends_find(p_code text,p_user_id uuid) returns jsonb language sql set search_path='' as $$ select private.sk_friends_find(p_code,p_user_id); $$;
revoke all on function public.sk_friends_find(text,uuid) from public,anon;
grant execute on function public.sk_friends_find(text,uuid) to authenticated;

create function private.sk_friends_command(p_action text,p_target uuid,p_expected_version bigint,p_reference uuid,p_code text,p_operation_id uuid,p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); lo uuid; hi uuid; pair private.sk_friend_pairs; existing text; req_hash text; own_block uuid; changed boolean:=false; person uuid; denial text;
begin
 if actor is null or actor is distinct from p_user_id then raise exception 'Bitte das aktive Konto prüfen.' using errcode='42501'; end if;
 if p_operation_id is null or p_target is null or p_target=actor or p_action is null or p_action not in ('send','accept','decline','cancel','remove','block','unblock') then raise exception 'Ungültiger Kontaktauftrag.' using errcode='22023'; end if;
 req_hash:=md5(jsonb_build_array(p_action,p_target,p_expected_version,p_reference,p_code)::text);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_operation_id::text,0));
 select request_hash into existing from private.sk_friend_operations where user_id=actor and operation_id=p_operation_id;
 if found then
  if existing<>req_hash then raise exception 'Operations-ID bereits anders verwendet.' using errcode='22023'; end if;
  return jsonb_build_object('ok',true,'state',private.sk_friend_snapshot(actor));
 end if;
 perform private.sk_friend_ensure_code(actor);
 if not private.sk_friend_limit(actor,case when p_action='send' then 'send' else 'change' end,case when p_action='send' then 10 else 30 end) then
  return jsonb_build_object('ok',false,'code','RATE_LIMIT','message','Zu viele Kontaktänderungen. Bitte in einer Minute erneut versuchen.','state',private.sk_friend_snapshot(actor));
 end if;
 if not exists(select 1 from private.sk_profiles where user_id=p_target) then
  return jsonb_build_object('ok',false,'code','CONTACT_UNAVAILABLE','message','Dieser Kontakt ist derzeit nicht verfügbar.','state',private.sk_friend_snapshot(actor));
 end if;
 lo:=least(actor,p_target); hi:=greatest(actor,p_target);
 -- Ensure and lock both revision rows in canonical order. All pair mutations
 -- then use the same canonical pair row, including blocking and acceptance.
 for person in select v from unnest(array[lo,hi]) v order by v loop perform private.sk_friend_ensure_code(person); end loop;
 insert into private.sk_friend_pairs(low_id,high_id) values(lo,hi) on conflict do nothing;
 select * into pair from private.sk_friend_pairs where low_id=lo and high_id=hi for update;
 if p_action not in ('block','unblock') then
  if private.sk_friend_pair_blocked(actor,p_target) then denial:='CONTACT_UNAVAILABLE';
  elsif p_expected_version is null or pair.version<>p_expected_version then denial:='STALE'; end if;
 end if;
 if denial is null then
  if p_action='send' then
   if not exists(select 1 from private.sk_friend_codes where user_id=p_target and code=upper(regexp_replace(coalesce(p_code,''),'[[:space:]-]','','g'))) then denial:='CONTACT_UNAVAILABLE';
   elsif pair.state='none' then
    update private.sk_friend_pairs set state='pending',sender_id=actor,request_id=gen_random_uuid(),version=version+1,updated_at=now() where low_id=lo and high_id=hi; changed:=true;
   end if;
  elsif p_action='accept' then
   if pair.state<>'pending' or pair.sender_id=actor or pair.request_id is distinct from p_reference then denial:='STALE';
   else update private.sk_friend_pairs set state='friends',sender_id=null,request_id=null,version=version+1,updated_at=now() where low_id=lo and high_id=hi; changed:=true; end if;
  elsif p_action in ('decline','cancel') then
   if pair.state<>'pending' or (p_action='cancel') is distinct from (pair.sender_id=actor) or pair.request_id is distinct from p_reference then denial:='STALE';
   else update private.sk_friend_pairs set state='none',sender_id=null,request_id=null,version=version+1,updated_at=now() where low_id=lo and high_id=hi; changed:=true; end if;
  elsif p_action='remove' then
   if pair.state<>'friends' then denial:='STALE';
   else update private.sk_friend_pairs set state='none',sender_id=null,request_id=null,version=version+1,updated_at=now() where low_id=lo and high_id=hi; changed:=true; end if;
  elsif p_action='block' then
   if pair.version=0 and not exists(select 1 from private.sk_profile_image_access where viewer_id=actor and profile_id=p_target and expires_at>now()) and not exists(select 1 from public.sk_live_members a join public.sk_live_members b on a.table_id=b.table_id where a.user_id=actor and b.user_id=p_target) then
    return jsonb_build_object('ok',false,'code','CONTACT_UNAVAILABLE','message','Dieser Kontakt ist derzeit nicht verfügbar.','state',private.sk_friend_snapshot(actor));
   end if;
   insert into private.sk_friend_blocks(blocker_id,blocked_id,label) select actor,p_target,display_name from private.sk_profiles where user_id=p_target on conflict do nothing;
   changed:=found;
   if changed then update private.sk_friend_pairs set state='none',sender_id=null,request_id=null,version=version+1,updated_at=now() where low_id=lo and high_id=hi; end if;
  elsif p_action='unblock' then
   select id into own_block from private.sk_friend_blocks where blocker_id=actor and blocked_id=p_target;
   if own_block is not null and own_block is distinct from p_reference then denial:='STALE';
   elsif own_block is not null then
    delete from private.sk_friend_blocks where blocker_id=actor and blocked_id=p_target;
    update private.sk_friend_pairs set version=version+1,updated_at=now() where low_id=lo and high_id=hi; changed:=true;
   end if;
  end if;
 end if;
 if denial is not null then return jsonb_build_object('ok',false,'code',denial,'message',case when denial='STALE' then 'Der Kontakt wurde inzwischen geändert. Bitte den aktuellen Stand prüfen.' else 'Dieser Kontakt ist derzeit nicht verfügbar.' end,'state',private.sk_friend_snapshot(actor)); end if;
 if changed then
  perform user_id from private.sk_friend_codes where user_id in (lo,hi) order by user_id for update;
  update private.sk_friend_codes set revision=revision+1 where user_id in (lo,hi);
  if p_action='block' then delete from private.sk_profile_image_access where (viewer_id=actor and profile_id=p_target) or (viewer_id=p_target and profile_id=actor); end if;
 end if;
 insert into private.sk_friend_operations(user_id,operation_id,request_hash) values(actor,p_operation_id,req_hash);
 delete from private.sk_friend_operations where user_id=actor and created_at<now()-interval '30 days';
 return jsonb_build_object('ok',true,'state',private.sk_friend_snapshot(actor));
end $$;
revoke all on function private.sk_friends_command(text,uuid,bigint,uuid,text,uuid,uuid) from public,anon;
grant execute on function private.sk_friends_command(text,uuid,bigint,uuid,text,uuid,uuid) to authenticated;
create function public.sk_friends_command(p_action text,p_target uuid,p_expected_version bigint,p_reference uuid,p_code text,p_operation_id uuid,p_user_id uuid) returns jsonb language sql set search_path='' as $$ select private.sk_friends_command(p_action,p_target,p_expected_version,p_reference,p_code,p_operation_id,p_user_id); $$;
revoke all on function public.sk_friends_command(text,uuid,bigint,uuid,text,uuid,uuid) from public,anon;
grant execute on function public.sk_friends_command(text,uuid,bigint,uuid,text,uuid,uuid) to authenticated;

-- Friend/pending cards are visible without a shared table. A block removes this
-- grant and search-photo grants; existing shared table visibility is preserved.
create or replace function private.sk_profile_can_read(p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.uid()=p_user_id or
 exists(select 1 from public.sk_live_members a join public.sk_live_members b on a.table_id=b.table_id where a.user_id=auth.uid() and b.user_id=p_user_id) or
 (not private.sk_friend_pair_blocked(auth.uid(),p_user_id) and (
 exists(select 1 from private.sk_profile_image_access where viewer_id=auth.uid() and profile_id=p_user_id and expires_at>now()) or
 exists(select 1 from private.sk_friend_pairs where low_id=least(auth.uid(),p_user_id) and high_id=greatest(auth.uid(),p_user_id) and state in ('pending','friends')))));
$$;
