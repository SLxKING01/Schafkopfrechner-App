begin;
insert into public.sk_live_tables(id,owner_id,payload) values(
 '10000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001',
 '{"activeGame":false,"currentTable":{"id":"10000000-0000-4000-8000-000000000013","isActive":false},"rounds":[],"balances":[],"players":[
  {"id":"payer","name":"Zahler","userId":"00000000-0000-4000-8000-000000000002"},
  {"id":"receiver","name":"Empfänger","userId":"00000000-0000-4000-8000-000000000003"},
  {"id":"local","name":"Lokaler Spieler"}],"settlements":[
  {"id":"payment","fromPlayerId":"payer","toPlayerId":"receiver","amount":2,"isPaid":false},
  {"id":"cash","fromPlayerId":"payer","toPlayerId":"local","amount":1,"isPaid":false}]}'
);
insert into public.sk_live_members(table_id,user_id,role)
select '10000000-0000-4000-8000-000000000013',id,'read' from auth.users
where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003')
on conflict (table_id,user_id) do update set role='read';

set local role authenticated;
do $$
declare
  t uuid := '10000000-0000-4000-8000-000000000013';
  owner uuid := '00000000-0000-4000-8000-000000000001';
  payer uuid := '00000000-0000-4000-8000-000000000002';
  recipient uuid := '00000000-0000-4000-8000-000000000003';
  report uuid := gen_random_uuid();
  confirmation uuid := gen_random_uuid();
  reversal uuid := gen_random_uuid();
  cash uuid := gen_random_uuid();
  events jsonb;
begin
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  perform public.sk_set_paypal_me('BeispielEmpfang');
  if public.sk_get_paypal_me() <> 'BeispielEmpfang' then
    raise exception 'PayPal handle not saved';
  end if;
  begin
    perform public.sk_set_paypal_me('https://example.com');
    raise exception 'Invalid PayPal handle accepted';
  exception when invalid_parameter_value then null; end;

  perform set_config('request.jwt.claim.sub',owner::text,true);
  if jsonb_array_length(public.sk_read_settlement_checkout(t)->'links') <> 0 then
    raise exception 'Unrelated member can see a checkout link';
  end if;
  begin
    perform public.sk_record_settlement_event(t,'payment','report',gen_random_uuid(),null);
    raise exception 'Owner represented a linked payer';
  exception when insufficient_privilege then null; end;
  perform public.sk_record_settlement_event(t,'cash','confirm',cash,null);

  perform set_config('request.jwt.claim.sub',payer::text,true);
  if public.sk_read_settlement_checkout(t)->'links'->0->>'handle' is distinct from 'BeispielEmpfang'
    or public.sk_read_settlement_checkout(t)->'links'->0->>'paymentId' is distinct from 'payment'
    or public.sk_read_settlement_checkout(t)->'links'->0->>'amount' is distinct from '2' then
    raise exception 'Wrong checkout target for payer';
  end if;
  perform public.sk_record_settlement_event(t,'payment','report',report,null);
  perform public.sk_record_settlement_event(t,'payment','report',report,null);
  if jsonb_array_length(public.sk_read_settlement_checkout(t)->'links') <> 0 then
    raise exception 'Reported payment still has a checkout link';
  end if;

  perform set_config('request.jwt.claim.sub',recipient::text,true);
  begin
    perform public.sk_record_settlement_event(t,'payment','confirm',confirmation,null);
    raise exception 'Stale payment revision was accepted';
  exception when sqlstate 'PT409' then null; end;
  perform public.sk_record_settlement_event(t,'payment','confirm',confirmation,report);
  perform public.sk_record_settlement_event(t,'payment','undo_confirm',reversal,confirmation);

  perform set_config('request.jwt.claim.sub',payer::text,true);
  perform public.sk_record_settlement_event(t,'payment','undo_report',gen_random_uuid(),reversal);
  events := public.sk_read_settlement_events(t);
  if jsonb_array_length(events) <> 5 or events->0->>'delegated' <> 'true'
    or events->0->>'actor_id' <> owner::text or events->0->>'player_id' <> 'local'
    or events->4->>'action' <> 'undo_report' then
    raise exception 'Unexpected payment history %', events;
  end if;
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  perform public.sk_set_paypal_me(null);
  perform set_config('request.jwt.claim.sub',payer::text,true);
  if jsonb_array_length(public.sk_read_settlement_checkout(t)->'links') <> 0 then
    raise exception 'Removed PayPal handle was still returned';
  end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
  begin
    perform public.sk_read_settlement_events(t);
    raise exception 'Nonmember could read payment events';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
