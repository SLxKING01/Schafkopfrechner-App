-- Membership and cross-account visibility verification; every write rolls back.
begin;
select set_config('sk_test.actor_a', (select id::text from auth.users order by created_at limit 1), true);
select set_config('sk_test.actor_b', (select id::text from auth.users order by created_at offset 1 limit 1), true);
select set_config('sk_test.actor_c', (select id::text from auth.users order by created_at offset 2 limit 1), true);
select set_config('sk_test.table_id', gen_random_uuid()::text, true);
select set_config('request.jwt.claim.sub', current_setting('sk_test.actor_a'), true);
set local role authenticated;
do $$
declare result jsonb; snapshot jsonb;
begin
  snapshot := jsonb_build_object('currentTable',jsonb_build_object('id',current_setting('sk_test.table_id'),'name','Roster test'),
    'players',jsonb_build_array(jsonb_build_object('id','seat-a','userId',auth.uid()),jsonb_build_object('id','seat-b','userId',current_setting('sk_test.actor_b'))),
    'rounds','[]'::jsonb,'balances','[]'::jsonb,'settlements','[]'::jsonb,'activeGame',true);
  result:=public.sk_live_command('create',current_setting('sk_test.table_id')::uuid,snapshot,0);
  if result->>'ownerId'<>auth.uid()::text then raise exception 'Owner missing'; end if;
  perform set_config('sk_test.code', result->>'code',true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('sk_test.actor_b'),true);
do $$
declare result jsonb;
begin
  if not exists(select 1 from public.sk_live_tables where id=current_setting('sk_test.table_id')::uuid) then raise exception 'Assigned player cannot discover table'; end if;
  result:=public.sk_live_command('read',current_setting('sk_test.table_id')::uuid);
  result:=public.sk_live_command('save',current_setting('sk_test.table_id')::uuid,jsonb_set(result->'payload','{currentTable,name}','"Changed by player B"'),1);
  begin
    perform public.sk_live_command('save',current_setting('sk_test.table_id')::uuid,jsonb_set(result->'payload','{players,1,userId}',to_jsonb(current_setting('sk_test.actor_c'))),2);
    raise exception 'Member granted another account access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sk_live_command('save',current_setting('sk_test.table_id')::uuid,result->'payload',1);
    raise exception 'Stale write accepted';
  exception when sqlstate 'PT409' or serialization_failure then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('sk_test.actor_c'),true);
do $$
begin
  if exists(select 1 from public.sk_live_tables where id=current_setting('sk_test.table_id')::uuid) then raise exception 'Unrelated user can discover table'; end if;
  begin
    perform public.sk_live_command('join',p_code=>current_setting('sk_test.code'));
    raise exception 'Code still grants access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sk_live_command('read',current_setting('sk_test.table_id')::uuid);
    raise exception 'Unrelated user can read table';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('sk_test.actor_a'),true);
do $$
declare result jsonb;
begin
  result:=public.sk_live_command('read',current_setting('sk_test.table_id')::uuid);
  if result->'payload'->'currentTable'->>'name'<>'Changed by player B' then raise exception 'Owner cannot see live entry'; end if;
  perform public.sk_live_command('save',current_setting('sk_test.table_id')::uuid,(result->'payload')#-'{players,1,userId}',2);
end $$;
select set_config('request.jwt.claim.sub',current_setting('sk_test.actor_b'),true);
do $$
begin
  if exists(select 1 from public.sk_live_tables where id=current_setting('sk_test.table_id')::uuid) then raise exception 'Removed player retains access'; end if;
  begin
    perform public.sk_live_command('read',current_setting('sk_test.table_id')::uuid);
    raise exception 'Removed player can read';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.sk_player_accounts(text)','execute') then raise exception 'Anonymous account directory access'; end if;
end $$;
rollback;
select 'Automatic player discovery, shared entries, owner-only account assignment, revocation, stale-write rejection and unrelated-user protection passed' as result;
