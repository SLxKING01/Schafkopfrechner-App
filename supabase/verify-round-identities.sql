-- Run against a test database with the migrations and at least three auth users.
-- All fixture writes roll back. No production data changes are required.
begin;
select set_config('sk_test.actor_a',(select id::text from auth.users order by created_at,id limit 1),true);
select set_config('sk_test.table_a',gen_random_uuid()::text,true);
select set_config('sk_test.table_b',gen_random_uuid()::text,true);
select set_config('sk_test.round',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('sk_test.actor_a'),true);
set local role authenticated;
do $$
declare snapshot jsonb; r jsonb; result jsonb;
begin
  r := jsonb_build_object('id',current_setting('sk_test.round'),'tableId',current_setting('sk_test.table_a'),'createdAt','2026-11-02T10:00:00Z');
  snapshot := jsonb_build_object('currentTable',jsonb_build_object('id',current_setting('sk_test.table_a')),
    'players','[]'::jsonb,'rounds',jsonb_build_array(r),'balances','[]'::jsonb,'settlements','[]'::jsonb,'activeGame',true);
  result := public.sk_live_command('create',current_setting('sk_test.table_a')::uuid,snapshot,0);
  result := public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,snapshot,1);
  if jsonb_array_length(result->'payload'->'rounds') <> 1 then raise exception 'Retry duplicated round'; end if;
  begin
    perform public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,jsonb_set(snapshot,'{rounds}',jsonb_build_array(r,r)),2);
    raise exception 'Duplicate IDs accepted';
  exception when unique_violation then null; end;
  begin
    perform public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,jsonb_set(snapshot,'{rounds,0,createdAt}','"changed"'),2);
    raise exception 'Creation identity changed';
  exception when unique_violation then null; end;
  begin
    perform public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,snapshot#-'{rounds,0,id}',2);
    raise exception 'Missing ID accepted';
  exception when check_violation then null; end;
  -- Deletion does not release a globally registered identity.
  perform public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,jsonb_set(snapshot,'{rounds}','[]'),2);
  begin
    perform public.sk_live_command('create',current_setting('sk_test.table_b')::uuid,
      jsonb_set(jsonb_set(snapshot,'{currentTable,id}',to_jsonb(current_setting('sk_test.table_b'))),'{rounds,0,tableId}',to_jsonb(current_setting('sk_test.table_b'))),0);
    raise exception 'Cross-table identity reuse accepted';
  exception when unique_violation then null; end;
  -- Same table may restore the original identity after deletion.
  result := public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,snapshot,3);
  if result->'payload'->'rounds'->0->>'id' <> current_setting('sk_test.round') then raise exception 'Restored identity changed'; end if;
  snapshot := jsonb_set(snapshot,'{currentTable,roundHistory}',jsonb_build_array(jsonb_build_object('id','audit-event','after',r)));
  perform public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,snapshot,4);
  begin
    perform public.sk_live_command('save',current_setting('sk_test.table_a')::uuid,snapshot#-'{currentTable,roundHistory}',5);
    raise exception 'Confirmed audit history was erased';
  exception when check_violation then null; end;
  if has_table_privilege('authenticated','private.sk_round_identities','insert')
     or has_function_privilege('anon','private.sk_guard_round_identities()','execute') then
    raise exception 'Private identity registry exposed';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from private.sk_round_identities where round_id=current_setting('sk_test.round')) <> 1 then
    raise exception 'Registry is not idempotent';
  end if;
  if (select registered_by from private.sk_round_identities where round_id=current_setting('sk_test.round')) <> current_setting('sk_test.actor_a')::uuid then
    raise exception 'Actor not recorded';
  end if;
end $$;
rollback;
