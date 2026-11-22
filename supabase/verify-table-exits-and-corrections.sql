begin;
insert into auth.users(id) values
  ('24000000-0000-4000-8000-000000000001'),
  ('24000000-0000-4000-8000-000000000002'),
  ('24000000-0000-4000-8000-000000000003');
insert into public.sk_live_tables(id,owner_id,payload) values (
  '24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000001',
  '{"currentTable":{"id":"24000000-0000-4000-8000-000000000010","name":"Testtisch","isActive":true},
    "players":[{"id":"owner","userId":"24000000-0000-4000-8000-000000000001","name":"Owner"},
               {"id":"seat","userId":"24000000-0000-4000-8000-000000000002","name":"Seat"},
               {"id":"third","userId":"24000000-0000-4000-8000-000000000003","name":"Third"}],
    "rounds":[],"balances":[],"settlements":[],"activeGame":true}');
insert into private.sk_friend_pairs(low_id,high_id,state)
values ('24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000002','friends');
set local role authenticated;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000002',true);
do $$
declare
  t constant uuid := '24000000-0000-4000-8000-000000000010';
  me constant uuid := '24000000-0000-4000-8000-000000000002';
  op constant uuid := '24000000-0000-4000-8000-000000000020';
begin
  begin
    perform public.sk_exit_table(op,t,'24000000-0000-4000-8000-000000000003');
    raise exception 'An ordinary participant revoked somebody else.';
  exception when insufficient_privilege then null;
  end;
  perform public.sk_exit_table(op,t,me);
  perform public.sk_exit_table(op,t,me);
  if exists(select 1 from public.sk_live_tables where id=t)
     or public.sk_personal_settlements()#>>'{0,active}' is distinct from 'true'
     or public.sk_personal_settlements()#>'{0,payments}' is distinct from '[]'::jsonb
  then raise exception 'Leaving did not correctly restrict access.'; end if;
end $$;

select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000001',true);
select public.sk_table_invitation_command(
  '24000000-0000-4000-8000-000000000001','send','24000000-0000-4000-8000-000000000022',
  '24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000002','seat','read',2);
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000002',true);
select public.sk_table_invitation_command(
  '24000000-0000-4000-8000-000000000002','accept','24000000-0000-4000-8000-000000000022');
do $$ begin
  if public.sk_personal_settlements() <> '[]'::jsonb
    or not exists(select 1 from public.sk_live_tables where id='24000000-0000-4000-8000-000000000010')
  then raise exception 'Rejoining did not restore the existing seat.'; end if;
end $$;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000001',true);
select public.sk_exit_table('24000000-0000-4000-8000-000000000023',
  '24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000002');
reset role;
update public.sk_live_tables
set payload=jsonb_set(payload,'{currentTable,isActive}','false') || '{"activeGame":false,
  "rounds":[{"id":"correction-test-round","tableId":"24000000-0000-4000-8000-000000000010",
    "createdAt":"2026-11-07T10:00:00Z","winnerId":"third","loserIds":["seat"],"amount":5}],
  "balances":[{"playerId":"seat","amount":-5},{"playerId":"owner","amount":0},{"playerId":"third","amount":5}],
  "settlements":[{"id":"paid","fromPlayerId":"seat","toPlayerId":"third","amount":5,"isPaid":false},
                 {"id":"foreign","fromPlayerId":"third","toPlayerId":"owner","amount":2,"isPaid":false}]}'::jsonb,
  version=version+1
where id='24000000-0000-4000-8000-000000000010';
set local role authenticated;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000002',true);
do $$
declare
  t constant uuid := '24000000-0000-4000-8000-000000000010';
  op constant uuid := '24000000-0000-4000-8000-000000000021';
begin
  if exists(select 1 from public.sk_live_tables where id=t)
     or public.sk_personal_settlements()#>>'{0,balance}' is distinct from '-5'
     or jsonb_array_length(public.sk_personal_settlements()#>'{0,payments}') <> 1
     or public.sk_personal_settlements()#>>'{0,payments,0,id}' is distinct from 'paid'
  then raise exception 'Personal settlement is missing or contains another payment.'; end if;
  begin
    perform public.sk_read_settlement_events(t);
    raise exception 'Full payment journal was visible after leaving.';
  exception when insufficient_privilege then null;
  end;
  perform public.sk_record_settlement_event(t,'paid','report',op,null);
  if public.sk_personal_settlements()#>>'{0,events,0,action}' is distinct from 'report'
    then raise exception 'Former payer could not report their own payment.'; end if;
end $$;

do $$
declare
  t constant uuid := '24000000-0000-4000-8000-000000000010';
  owner_id constant uuid := '24000000-0000-4000-8000-000000000001';
  report_id constant uuid := '24000000-0000-4000-8000-000000000021';
  confirm_id constant uuid := '24000000-0000-4000-8000-000000000024';
  correction constant text := '24000000-0000-4000-8000-000000000025';
  prior public.sk_live_tables;
  candidate jsonb;
  saved jsonb;
begin
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select * into strict prior from public.sk_live_tables where id=t;
  candidate := jsonb_set(prior.payload,'{currentTable,settlementRevisions}',jsonb_build_array(jsonb_build_object(
    'id',correction,'occurredAt',now(),'actor',jsonb_build_object('kind','account','id',owner_id,'name','Owner'),
    'balances',prior.payload->'balances','settlements',prior.payload->'settlements','carriedPaymentIds','["paid"]'::jsonb
  ))) || '{"balances":[{"playerId":"seat","amount":-3},{"playerId":"owner","amount":0},{"playerId":"third","amount":3}]}'::jsonb;
  candidate := jsonb_set(candidate,'{settlements}',jsonb_build_array(prior.payload#>'{settlements,0}',jsonb_build_object(
    'id',correction||':refund','fromPlayerId','third','toPlayerId','seat','amount',2,'isPaid',false)));
  candidate := jsonb_set(candidate,'{rounds,0,amount}','3');
  candidate := jsonb_set(candidate,'{currentTable,roundHistory}',jsonb_build_array(jsonb_build_object(
    'id','correction-history-test','roundId','correction-test-round','action','updated',
    'actor',jsonb_build_object('kind','account','id',owner_id,'name','Owner'),
    'before',prior.payload#>'{rounds,0}','after',candidate#>'{rounds,0}'
  )));
  begin
    perform public.sk_correct_closed_table(t,prior.version,report_id,candidate);
    raise exception 'A pending report did not block correction.';
  exception when sqlstate 'PT409' then null;
  end;
  perform set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000003',true);
  perform public.sk_record_settlement_event(t,'paid','confirm',confirm_id,report_id);
  begin
    perform public.sk_correct_closed_table(t,prior.version,confirm_id,candidate);
    raise exception 'A non-owner could correct the table.';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin
    perform public.sk_correct_closed_table(t,prior.version,report_id,candidate);
    raise exception 'Stale payment journal accepted.';
  exception when sqlstate 'PT409' then null;
  end;
  saved := public.sk_correct_closed_table(t,prior.version,confirm_id,candidate);
  if saved->'payload' is distinct from candidate
    or public.sk_correct_closed_table(t,prior.version,confirm_id,candidate) is distinct from saved
  then raise exception 'Correction failed or repeated the revision.'; end if;
end $$;
rollback;
