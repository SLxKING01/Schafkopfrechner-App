-- Isolated SQL verification; all fixture state is rolled back.
begin;
create temp table qa_friends(key text primary key,value jsonb);
grant select,insert,update on qa_friends to authenticated;
insert into qa_friends values('table_state',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.sk_live_tables t)),('member_state',(select coalesce(jsonb_agg(to_jsonb(m) order by table_id,user_id),'[]') from public.sk_live_members m));
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.sk_friends_state('00000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.sk_friends_state('00000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.sk_friends_state('00000000-0000-4000-8000-000000000003');
reset role;
update private.sk_friend_codes set code=case user_id when '00000000-0000-4000-8000-000000000001' then 'AAAA2222BBBB' when '00000000-0000-4000-8000-000000000002' then 'CCCC3333DDDD' else 'EEEE4444FFFF' end where user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; s jsonb; r jsonb;
begin
 s:=public.sk_friends_state(a); assert s->>'code'='AAAA2222BBBB','Code not stable'; assert jsonb_array_length(s->'friends')=0,'Unexpected friendship';
 begin perform public.sk_friends_state(b); raise exception 'Foreign list exposed'; exception when insufficient_privilege then null; end;
 assert public.sk_friends_find('short',a)->>'status'='invalid','Invalid code not rejected';
 assert public.sk_friends_find('AAAA-2222-BBBB',a)->>'status'='self','Self lookup not detected';
 assert public.sk_friends_find('ZZZZZZZZZZZZ',a)->>'status'='not_found','Unknown code found';
 r:=public.sk_friends_find(' cccc-3333 dddd ',a); assert r->>'status'='found','Exact normalized search failed';
 assert r->'entry'->'profile'->>'id'=b::text,'Wrong account'; assert not ((r->'entry'->'profile')?'birthDate'),'Private search leak';
 r:=public.sk_friends_command('send',b,0,null,'CCCC3333DDDD','40000000-0000-4000-8000-000000000001',a);
 assert (r->>'ok')::boolean and jsonb_array_length(r->'state'->'outgoing')=1,'Send failed';
 insert into qa_friends values('request',r->'state'->'outgoing'->0->'requestId'),('firstRevision',r->'state'->'version');
 r:=public.sk_friends_command('send',b,0,null,'CCCC3333DDDD','40000000-0000-4000-8000-000000000001',a);
 assert r->'state'->'version'=(select value from qa_friends where key='firstRevision'),'Retry changed revision';
 r:=public.sk_friends_command('accept',b,1,(select value#>>'{}' from qa_friends where key='request')::uuid,null,gen_random_uuid(),a);
 assert r->>'code'='STALE','Sender accepted own request';
 begin perform public.sk_friends_command('send',b,1,null,'CCCC3333DDDD','40000000-0000-4000-8000-000000000001',a); raise exception 'Reused operation changed payload'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001'; c uuid:='00000000-0000-4000-8000-000000000003'; r jsonb; begin
 r:=public.sk_friends_command('accept',a,0,(select value#>>'{}' from qa_friends where key='request')::uuid,null,gen_random_uuid(),c); assert r->>'code'='STALE','Outsider accepted request';
 begin perform * from private.sk_friend_blocks; raise exception 'Private blocks exposed'; exception when insufficient_privilege then null; end;
 begin perform * from private.sk_friend_pairs; raise exception 'Private list exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; r jsonb; request uuid:=(select value#>>'{}' from qa_friends where key='request')::uuid;
begin
 r:=public.sk_friends_command('send',a,0,null,'AAAA2222BBBB',gen_random_uuid(),b); assert r->>'code'='STALE','Parallel stale send not checked';
 r:=public.sk_friends_command('send',a,1,null,'AAAA2222BBBB',gen_random_uuid(),b); assert jsonb_array_length(r->'state'->'incoming')=1 and jsonb_array_length(r->'state'->'friends')=0,'Counter-request auto-accepted';
 r:=public.sk_friends_command('accept',a,1,request,null,gen_random_uuid(),b); assert jsonb_array_length(r->'state'->'friends')=1,'Acceptance failed';
 assert not ((r->'state'->'friends'->0->'profile')?'firstName'),'Private friend card leak';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; r jsonb; begin
 r:=public.sk_friends_command('remove',b,2,null,null,gen_random_uuid(),a); assert jsonb_array_length(r->'state'->'friends')=0,'Remove failed';
 r:=public.sk_friends_command('send',b,3,null,'CCCC3333DDDD',gen_random_uuid(),a); assert (r->>'ok')::boolean,'New request after removal failed';
 update qa_friends set value=r->'state'->'outgoing'->0->'requestId' where key='request';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; r jsonb; begin
 r:=public.sk_friends_command('decline',a,4,(select value#>>'{}' from qa_friends where key='request')::uuid,null,gen_random_uuid(),b); assert jsonb_array_length(r->'state'->'incoming')=0,'Decline failed';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; r jsonb; begin
 r:=public.sk_friends_command('send',b,5,null,'CCCC3333DDDD',gen_random_uuid(),a);
 r:=public.sk_friends_command('cancel',b,6,(r->'state'->'outgoing'->0->>'requestId')::uuid,null,gen_random_uuid(),a); assert jsonb_array_length(r->'state'->'outgoing')=0,'Withdraw failed';
 r:=public.sk_friends_command('send',b,0,null,'CCCC3333DDDD','40000000-0000-4000-8000-000000000001',a); assert jsonb_array_length(r->'state'->'outgoing')=0,'Old retry resent removed request';
 r:=public.sk_friends_command('send',b,7,null,'CCCC3333DDDD',gen_random_uuid(),a);
 update qa_friends set value=r->'state'->'outgoing'->0->'requestId' where key='request';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; r jsonb; begin
 r:=public.sk_friends_command('block',a,8,null,null,'40000000-0000-4000-8000-000000000002',b);
 assert jsonb_array_length(r->'state'->'blocked')=1 and jsonb_array_length(r->'state'->'incoming')=0,'Block not atomic';
 insert into qa_friends values('blockB',r->'state'->'blocked'->0->'blockId');
 r:=public.sk_friends_command('accept',a,8,(select value#>>'{}' from qa_friends where key='request')::uuid,null,gen_random_uuid(),b); assert r->>'code'='CONTACT_UNAVAILABLE','Blocked stale acceptance succeeded';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; r jsonb; s jsonb; begin
 s:=public.sk_friends_state(a); assert jsonb_array_length(s->'outgoing')=0 and jsonb_array_length(s->'blocked')=0,'Foreign block list exposed';
 assert public.sk_friends_find('CCCC3333DDDD',a)->>'status'='not_found','Block bypass via code';
 assert jsonb_array_length(public.sk_profile_cards(array[b]))=0,'Photo grant survived block';
 r:=public.sk_friends_command('send',b,9,null,'CCCC3333DDDD',gen_random_uuid(),a); assert r->>'code'='CONTACT_UNAVAILABLE','Block bypass via API';
 r:=public.sk_friends_command('block',b,9,null,null,'40000000-0000-4000-8000-000000000003',a); assert jsonb_array_length(r->'state'->'blocked')=1,'Mutual block failed';
 insert into qa_friends values('blockA',r->'state'->'blocked'->0->'blockId');
 r:=public.sk_friends_command('unblock',b,10,(r->'state'->'blocked'->0->>'blockId')::uuid,null,gen_random_uuid(),a); assert jsonb_array_length(r->'state'->'blocked')=0,'Own unblock failed';
 assert public.sk_friends_find('CCCC3333DDDD',a)->>'status'='not_found','One-sided unblock removed other block';
 begin perform public.sk_friends_command('unblock',a,11,(select value#>>'{}' from qa_friends where key='blockB')::uuid,null,gen_random_uuid(),b); raise exception 'Unblocked using another account'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; r jsonb; begin
 r:=public.sk_friends_command('unblock',a,11,(select value#>>'{}' from qa_friends where key='blockB')::uuid,null,gen_random_uuid(),b);
 assert jsonb_array_length(r->'state'->'blocked')=0 and jsonb_array_length(r->'state'->'friends')=0,'Unblock restored friendship';
 r:=public.sk_friends_command('block',a,8,null,null,'40000000-0000-4000-8000-000000000002',b); assert jsonb_array_length(r->'state'->'blocked')=0,'Old retry reblocked contact';
end $$;
reset role;
do $$ begin
 assert (select value from qa_friends where key='table_state')=(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.sk_live_tables t),'Table data changed';
 assert (select value from qa_friends where key='member_state')=(select coalesce(jsonb_agg(to_jsonb(m) order by table_id,user_id),'[]') from public.sk_live_members m),'Table rights changed';
end $$;
insert into private.sk_friend_limits(user_id,category,window_at,used) values('00000000-0000-4000-8000-000000000001','find',date_trunc('minute',clock_timestamp()),20) on conflict(user_id,category) do update set used=20,window_at=excluded.window_at;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin assert public.sk_friends_find('CCCC3333DDDD','00000000-0000-4000-8000-000000000001')->>'code'='RATE_LIMIT','Lookup rate limit missing'; end $$;
set local role anon;
do $$ begin begin perform public.sk_friends_state('00000000-0000-4000-8000-000000000001'); raise exception 'Anonymous friend list allowed'; exception when insufficient_privilege then null; end; end $$;
reset role;
rollback;
