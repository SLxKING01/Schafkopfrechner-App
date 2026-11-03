-- Isolated fixtures only; all changes roll back.
begin;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002';
 c uuid:='00000000-0000-4000-8000-000000000003';
begin
 insert into private.sk_friend_pairs(low_id,high_id,state,version) values(a,b,'friends',1),(a,c,'friends',1)
 on conflict(low_id,high_id) do update set state='friends',version=1,sender_id=null,request_id=null;
end $$;
set local role authenticated;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; c uuid:='00000000-0000-4000-8000-000000000003';
 tid uuid:=gen_random_uuid(); iid uuid:=gen_random_uuid(); id2 uuid:=gen_random_uuid(); id3 uuid:=gen_random_uuid();
 snap jsonb; r jsonb; original jsonb; v bigint;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);
 snap:=jsonb_build_object('currentTable',jsonb_build_object('id',tid,'name','Invitation QA','isActive',true),
 'players',jsonb_build_array(jsonb_build_object('id','owner','name','Owner','userId',a),jsonb_build_object('id','guest','name','Same name','isLocal',true),jsonb_build_object('id','guest2','name','Same name','isLocal',true)),
 'rounds',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'tableId',tid,'createdAt','2026-11-03T00:00:00Z')),'balances',jsonb_build_array(jsonb_build_object('playerId','guest','balance',5)), 'settlements','[]'::jsonb,'activeGame',true);
 begin
  perform public.sk_live_command('create',tid,jsonb_set(snap,'{players,1,userId}',to_jsonb(b)),0);
  raise exception 'Direct foreign create bypassed consent';
 exception when insufficient_privilege then null; end;
 r:=public.sk_live_command('create',tid,snap,0);
 begin
  perform public.sk_live_command('save',tid,jsonb_set(snap,'{players,1,userId}',to_jsonb(b)),1);
  raise exception 'Direct save bypassed consent';
 exception when insufficient_privilege then null; end;
 begin
  perform public.sk_table_invitations_list(b); raise exception 'Foreign actor list allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform private.sk_live_command_before_invitations('read',tid,null,null,null); raise exception 'Legacy bypass exposed';
 exception when insufficient_privilege then null; end;
 r:=public.sk_table_invitation_command(a,'send',iid,tid,b,'guest','write',1);
 if not (r->>'ok')::boolean or jsonb_array_length(r->'state'->'invitations')<>1 then raise exception 'Send failed: %',r; end if;
 r:=public.sk_table_invitation_command(a,'send',iid,tid,b,'guest','write',1);
 if jsonb_array_length(r->'state'->'invitations')<>1 then raise exception 'Retry duplicated invite'; end if;
 begin
  perform public.sk_table_invitation_command(a,'send',iid,tid,c,'guest','write',1); raise exception 'Changed retry payload allowed';
 exception when invalid_parameter_value then null; end;
 r:=public.sk_table_invitation_command(a,'send',id2,tid,c,'guest','read',1);
 if r->>'code'<>'PENDING' then raise exception 'Seat not reserved'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 if jsonb_array_length(public.sk_table_invitations_list(c)->'invitations')<>0 then raise exception 'Unrelated invitation leaked'; end if;
 begin
  perform public.sk_table_invitation_command(c,'accept',iid); raise exception 'Third party accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.sk_live_tables where id=tid) then raise exception 'Pending invitation grants table access'; end if;
 begin
  perform public.sk_live_command('read',tid); raise exception 'Pending account read table';
 exception when insufficient_privilege then null; end;
 r:=public.sk_table_invitations_list(b);
 if (r->'invitations'->0->>'playerId')<>'guest' or r::text like '%rounds%' or r::text like '%birthDate%' then raise exception 'Wrong invitation preview'; end if;
 r:=public.sk_table_invitation_command(b,'accept',iid);
 if not (r->>'ok')::boolean then raise exception 'Accept failed: %',r; end if;
 r:=public.sk_live_command('read',tid); original:=r;
 if r->>'role'<>'write' or r->'payload'->'players'->1->>'id'<>'guest' or r->'payload'->'players'->1->>'userId'<>b::text or r->'payload'->'players'->2->>'userId' is not null then raise exception 'Wrong linked seat/role'; end if;
 if r->'payload'->'rounds' is distinct from snap->'rounds' or r->'payload'->'balances' is distinct from snap->'balances' then raise exception 'History/balance changed'; end if;
 if (public.sk_table_invitation_command(b,'accept',iid)->>'ok')::boolean is not true or public.sk_live_command('read',tid)->>'version'<>r->>'version' then raise exception 'Accept retry changed table'; end if;
 -- Writer cannot manage invitations or reassign accounts.
 begin
  perform public.sk_table_invitation_command(b,'send',gen_random_uuid(),tid,c,'guest2','read',2);
  raise exception 'Nonowner invited';
 exception when insufficient_privilege then null; end;
 -- Continue as owner: remove account, old acceptance must not restore it.
 perform set_config('request.jwt.claim.sub',a::text,true);
 snap:=original->'payload';
 r:=public.sk_live_command('save',tid,snap#-'{players,1,userId}',(original->>'version')::bigint);
 v:=(r->>'version')::bigint;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.sk_table_invitation_command(b,'accept',iid);
 if exists(select 1 from public.sk_live_tables where id=tid) then raise exception 'Old acceptance restored revoked membership'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.sk_table_invitation_command(a,'send',id2,tid,b,'guest','read',v);
 if not (r->>'ok')::boolean then raise exception 'New invitation failed'; end if;
 r:=public.sk_table_invitation_command(a,'cancel',id2);
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.sk_table_invitation_command(b,'accept',id2);
 if (r->>'ok')::boolean then raise exception 'Cancelled invitation accepted'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.sk_table_invitation_command(a,'send',id3,tid,b,'guest','read',v);
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.sk_table_invitation_command(b,'decline',id3);
 if not (r->>'ok')::boolean then raise exception 'Decline failed'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.sk_table_invitation_command(a,'send',id3,tid,b,'guest','read',v);
 if jsonb_array_length(public.sk_table_invitations_list(a)->'invitations')<>0 then raise exception 'Old send recreated declined invitation'; end if;
end $$;
-- Block, changed friendship generation, occupied/removed seats, closed/expired tables.
reset role;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; tid uuid; iid uuid; r jsonb; scenario text;
begin
 foreach scenario in array array['block','refriend','occupied','removed','closed','expired'] loop
  tid:=gen_random_uuid();iid:=gen_random_uuid();
  insert into public.sk_live_tables(id,owner_id,payload) values(tid,a,jsonb_build_object('currentTable',jsonb_build_object('id',tid,'name','Invalid QA','isActive',true),'players',jsonb_build_array(jsonb_build_object('id','seat','name','Guest')),'rounds','[]'::jsonb,'balances','[]'::jsonb,'settlements','[]'::jsonb,'activeGame',true));
  insert into private.sk_table_invitations(id,table_id,sender_id,recipient_id,player_id,role,friend_version) values(iid,tid,a,b,'seat','read',1);
  if scenario='block' then insert into private.sk_friend_blocks(blocker_id,blocked_id,label) values(a,b,'QA');
  elsif scenario='refriend' then update private.sk_friend_pairs set version=version+1 where low_id=a and high_id=b;
  elsif scenario='occupied' then update public.sk_live_tables set payload=jsonb_set(payload,'{players,0,userId}',to_jsonb(a)) where id=tid;
  elsif scenario='removed' then update public.sk_live_tables set payload=jsonb_set(payload,'{players}','[]') where id=tid;
  elsif scenario='closed' then update public.sk_live_tables set payload=jsonb_set(payload,'{activeGame}','false') where id=tid;
  else update private.sk_table_invitations set expires_at=now()-interval '1 second' where id=iid;
  end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  r:=public.sk_table_invitation_command(b,'accept',iid);
  if (r->>'ok')::boolean or exists(select 1 from public.sk_live_members where table_id=tid and user_id=b) then raise exception 'Invalid invitation accepted: %',scenario; end if;
  delete from private.sk_friend_blocks where blocker_id=a and blocked_id=b;
  update private.sk_friend_pairs set version=1 where low_id=a and high_id=b;
 end loop;
end $$;
set local role anon;
do $$ begin
 begin perform public.sk_table_invitations_list('00000000-0000-4000-8000-000000000001'); raise exception 'Anonymous access'; exception when insufficient_privilege then null; end;
end $$;
rollback;
