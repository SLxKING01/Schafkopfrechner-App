-- Run with three auth accounts. All fixtures are rolled back.
begin;
select set_config('sk_test.actor_a',(select id::text from auth.users order by created_at,id limit 1),true);
select set_config('sk_test.actor_b',(select id::text from auth.users order by created_at,id offset 1 limit 1),true);
select set_config('sk_test.actor_c',(select id::text from auth.users order by created_at,id offset 2 limit 1),true);
select set_config('sk_test.table_id',gen_random_uuid()::text,true);
set local role authenticated;
do $$
declare a text:=current_setting('sk_test.actor_a'); b text:=current_setting('sk_test.actor_b');
  c text:=current_setting('sk_test.actor_c'); tid uuid:=current_setting('sk_test.table_id')::uuid;
  snapshot jsonb; result jsonb; played jsonb;
begin
  if a is null or b is null or c is null then raise exception 'Three test accounts required'; end if;
  perform set_config('request.jwt.claim.sub',a,true);
  snapshot:=jsonb_build_object('currentTable',jsonb_build_object('id',tid,'name','Role verification'),
    'players',jsonb_build_array(jsonb_build_object('id','a','userId',a),jsonb_build_object('id','b','userId',b)),
    'rounds','[]'::jsonb,'balances','[]'::jsonb,'settlements','[]'::jsonb,'activeGame',true);
  result:=public.sk_live_command('create',tid,snapshot,0);
  perform set_config('request.jwt.claim.sub',b,true);
  result:=public.sk_live_command('read',tid);
  if result->>'role'<>'read' then raise exception 'New account is not read-only'; end if;
  if not exists(select 1 from public.sk_live_tables where id=tid) then raise exception 'Reader cannot discover table'; end if;
  begin
    perform public.sk_live_command('save',tid,snapshot,1);
    raise exception 'Reader saved';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sk_live_command('set_role',tid,jsonb_build_object('userId',b,'role','write'),1);
    raise exception 'Reader escalated own role';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',a,true);
  result:=public.sk_live_command('set_role',tid,jsonb_build_object('userId',b,'role','write'),1);
  if result->>'version'<>'2' then raise exception 'Role change did not invalidate stale writes'; end if;
  perform set_config('request.jwt.claim.sub',b,true);
  played:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'tableId',tid,'createdAt','2026-11-02T12:00:00Z'));
  snapshot:=jsonb_set(snapshot,'{rounds}',played);
  result:=public.sk_live_command('save',tid,snapshot,2);
  if result->>'role'<>'write' then raise exception 'Writer role missing'; end if;
  begin
    perform public.sk_live_command('save',tid,jsonb_set(snapshot,'{currentTable,name}','"Forbidden"'),3);
    raise exception 'Writer changed table configuration';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sk_live_command('save',tid,jsonb_set(snapshot,'{players}','[]'),3);
    raise exception 'Writer changed roster';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sk_live_command('save',tid,jsonb_set(snapshot,'{activeGame}','false'),3);
    raise exception 'Writer closed table';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sk_live_command('save',tid,snapshot,2);
    raise exception 'Stale save accepted';
  exception when sqlstate 'PT409' or serialization_failure then null; end;
  -- Writers may delete and restore the same identity, as agreed.
  result:=public.sk_live_command('save',tid,jsonb_set(snapshot,'{rounds}','[]'),3);
  result:=public.sk_live_command('save',tid,snapshot,4);
  perform set_config('request.jwt.claim.sub',a,true);
  result:=public.sk_live_command('set_role',tid,jsonb_build_object('userId',b,'role','read'),5);
  perform set_config('request.jwt.claim.sub',b,true);
  begin
    perform public.sk_live_command('save',tid,snapshot,5);
    raise exception 'Draft saved after role downgrade';
  exception when insufficient_privilege then null; end;
  result:=public.sk_live_command('read',tid);
  if result->>'role'<>'read' then raise exception 'Downgrade not visible'; end if;
  perform set_config('request.jwt.claim.sub',c,true);
  if exists(select 1 from public.sk_live_tables where id=tid) then raise exception 'Unrelated account discovered table'; end if;
  begin
    perform public.sk_live_command('read',tid);
    raise exception 'Unrelated account read table';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',a,true);
  result:=public.sk_live_command('save',tid,jsonb_set(snapshot,'{players}',jsonb_build_array(jsonb_build_object('id','a','userId',a))),6);
  perform set_config('request.jwt.claim.sub',b,true);
  begin
    perform public.sk_live_command('read',tid);
    raise exception 'Removed member read table';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: reader/writer/owner, role changes, stale drafts, restore and revocation' as result;
