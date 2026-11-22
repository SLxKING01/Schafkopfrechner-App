begin;
insert into auth.users(id) values
  ('35000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000002'),
  ('35000000-0000-4000-8000-000000000003');

do $$
declare
  actor constant uuid := '35000000-0000-4000-8000-000000000001';
  reader constant uuid := '35000000-0000-4000-8000-000000000002';
  writer constant uuid := '35000000-0000-4000-8000-000000000003';
  shared constant uuid := '35000000-0000-4000-8000-000000000010';
  solo constant uuid := '35000000-0000-4000-8000-000000000011';
  joined constant uuid := '35000000-0000-4000-8000-000000000012';
  photo constant text := actor::text || '/35000000-0000-4000-8000-000000000020.jpg';
  rounds jsonb := jsonb_build_array(jsonb_build_object('id','deletion-round','tableId',shared,'createdAt','original-time'));
  settlements constant jsonb := '[{"id":"payment","fromPlayerId":"seat","toPlayerId":"writer","amount":3}]';
  target public.sk_live_tables;
begin
  insert into public.game_states(owner_id, payload) values (actor, '{"schemaVersion":1}');
  insert into private.sk_friend_pairs(low_id,high_id,state) values (actor,reader,'friends');
  insert into storage.objects(bucket_id,name) values ('profile-photos',photo);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.sk_live_tables(id,owner_id,payload) values (shared,actor,jsonb_build_object(
    'currentTable',jsonb_build_object('id',shared,'isActive',false,'roundHistory',jsonb_build_array(jsonb_build_object(
      'id','history-event','actor',jsonb_build_object('kind','account','id',actor,'name','Private name'),
      'players','[{"id":"seat","name":"Private name"}]'::jsonb,'after',rounds->0
    ))),
    'players',jsonb_build_array(
      jsonb_build_object('id','seat','userId',actor,'name','Private name','isLocal',false),
      jsonb_build_object('id','reader','userId',reader),
      jsonb_build_object('id','writer','userId',writer)
    ),
    'rounds',rounds,'balances','[{"playerId":"seat","amount":-3}]'::jsonb,
    'settlements',settlements,'activeGame',false
  ));
  insert into public.sk_live_members(table_id,user_id,role) values (shared,writer,'write')
    on conflict (table_id,user_id) do update set role=excluded.role;
  insert into public.sk_live_tables(id,owner_id,payload) values
    (solo,actor,jsonb_build_object('players','[]'::jsonb,'rounds',jsonb_build_array(
      jsonb_build_object('id','deletion-solo-round','tableId',solo,'createdAt','original-time')
    ))),
    (joined,reader,jsonb_build_object('players',jsonb_build_array(
      jsonb_build_object('id','another-seat','userId',actor)
    ),'rounds','[]'::jsonb));
  insert into private.sk_round_identity_backups(table_id,payload,version)
    select id,payload,version from public.sk_live_tables where id in (solo,shared);
  insert into private.sk_settlement_events(id,table_id,payment_id,action,actor_id,actor_name,player_id,player_name,delegated)
    values ('35000000-0000-4000-8000-000000000021',shared,'payment','report',actor,'Private name','seat','Private name',false);

  perform set_config('request.jwt.claim.sub','',true);
  begin
    delete from auth.users where id=actor;
    raise exception 'Deletion must wait for Storage cleanup.';
  exception when raise_exception then
    if sqlerrm <> 'Remove profile photos through the Storage API before deleting the account.' then raise; end if;
  end;
  -- PGlite represents the Storage API's completed cleanup with a fixture delete.
  delete from storage.objects where name=photo;
  delete from auth.users where id=actor;

  if exists(select 1 from auth.users where id=actor)
     or exists(select 1 from private.sk_profiles where user_id=actor)
     or exists(select 1 from private.sk_friend_pairs where low_id=actor)
     or exists(select 1 from public.game_states where owner_id=actor)
     or exists(select 1 from public.sk_live_members where user_id=actor)
     or exists(select 1 from public.sk_live_tables where id=solo)
     or exists(select 1 from private.sk_round_identity_backups where table_id=solo)
     or exists(select 1 from private.sk_round_identities where round_id='deletion-solo-round')
  then raise exception 'Account data was retained.'; end if;

  select * into strict target from public.sk_live_tables where id=shared;
  if target.owner_id<>writer or target.version<>2
     or target.payload->'rounds' is distinct from rounds
     or target.payload->'settlements' is distinct from settlements
     or target.payload->'balances' is distinct from '[{"playerId":"seat","amount":-3}]'::jsonb
     or target.payload#>>'{players,0,id}' is distinct from 'seat'
     or target.payload::text like '%'||actor::text||'%'
     or target.payload::text like '%Private name%'
     or not exists(select 1 from public.sk_live_members where table_id=shared and user_id=reader and role='read')
     or not exists(select 1 from private.sk_round_identities where round_id='deletion-round' and registered_by is null)
     or not exists(select 1 from private.sk_settlement_events where table_id=shared and action='report'
         and actor_id is null and actor_name='Gelöschtes Konto' and player_name='Gelöschtes Konto')
     or not exists(select 1 from public.sk_live_tables where id=joined and owner_id=reader and not (payload->'players'->0 ? 'userId'))
     or exists(select 1 from private.sk_round_identity_backups where table_id=shared and payload::text like '%'||actor::text||'%')
  then raise exception 'Shared data or account redaction is incorrect.'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000001',true);
do $$
begin
  if exists(select 1 from public.sk_live_tables where id='35000000-0000-4000-8000-000000000010')
  then raise exception 'Deleted account retained table access.'; end if;
  begin
    insert into storage.objects(bucket_id,name) values (
      'profile-photos','35000000-0000-4000-8000-000000000001/35000000-0000-4000-8000-000000000020.jpg'
    );
    raise exception 'Deleted account uploaded using a stale token.';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000003',true);
do $$
begin
  if not exists(select 1 from public.sk_live_tables where id='35000000-0000-4000-8000-000000000010')
  then raise exception 'The successor lost access.'; end if;
end $$;
rollback;
