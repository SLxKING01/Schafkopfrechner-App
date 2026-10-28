-- Integration verification; every write (including the temporary auth user) rolls back.
begin;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
insert into auth.users(id) values (auth.uid());
set local role authenticated;
do $$
declare saved record;
begin
  select * into saved from public.save_game_state('{"schemaVersion":1,"games":[]}'::jsonb, 0);
  if saved.version <> 1 then raise exception 'Initial save failed'; end if;
  select * into saved from public.save_game_state('{"schemaVersion":1,"games":[{"id":"round-test"}]}'::jsonb, 1);
  if saved.version <> 2 then raise exception 'Update failed'; end if;
  begin
    perform public.save_game_state('{"schemaVersion":1}'::jsonb, 1);
    raise exception 'Stale write was accepted';
  exception when serialization_failure then null;
  end;
  if (select payload->'games'->0->>'id' from public.game_states where owner_id = auth.uid()) <> 'round-test'
    then raise exception 'Round-trip failed'; end if;
end $$;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$
begin
  if exists(select 1 from public.game_states) then raise exception 'Cross-account read permitted'; end if;
  if has_function_privilege('anon', 'public.save_game_state(jsonb,integer)', 'execute')
    then raise exception 'Anonymous writes permitted'; end if;
end $$;
rollback;
select 'save, update, stale-write rejection, round-trip, account isolation and anonymous protection passed' as result;
