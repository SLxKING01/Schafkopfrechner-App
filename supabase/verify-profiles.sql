-- Isolated PGlite fixture only (scripts/verify-shared-database.cjs).
-- Hosted Storage protects direct object deletion; use the authenticated
-- Storage API checks in scripts/verify-profiles-live.cjs on the real service.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare own jsonb; saved jsonb; payload jsonb;
begin
 own:=public.sk_profile_own();
 assert own->>'id'='00000000-0000-4000-8000-000000000001','Wrong own profile';
 payload:='{"displayName":"Gleicher Name","firstName":"Privat","lastName":"Geheim","birthDate":"2000-02-29","avatarKind":"none","animalId":null,"accentId":"forestGreen","photoPath":null,"setupCompleted":true}';
 saved:=public.sk_profile_save(payload,1,'20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
 assert saved->>'firstName'='Privat' and saved->>'version'='2','Private save failed';
 saved:=public.sk_profile_save(payload,1,'20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
 assert saved->>'version'='2','Retry changed version';
 begin perform public.sk_profile_save(payload,1,'20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001'); raise exception 'Stale save accepted'; exception when sqlstate 'PT409' then null; end;
 begin perform public.sk_profile_save(payload,2,'20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002'); raise exception 'Account switch accepted'; exception when insufficient_privilege then null; end;
 begin perform public.sk_profile_save(payload||'{"birthDate":"2001-02-29"}',2,'20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001'); raise exception 'Invalid date accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.sk_profile_save(payload||'{"birthDate":"2999-01-01"}',2,'20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001'); raise exception 'Future date accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.sk_profile_save(payload||'{"displayName":"X"}',2,'20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001'); raise exception 'Invalid name accepted'; exception when invalid_parameter_value then null; end;
 begin perform first_name from private.sk_profile_private; raise exception 'Direct private access allowed'; exception when insufficient_privilege then null; end;
end $$;
insert into storage.objects(bucket_id,name,metadata) values('profile-photos','00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.jpg','{"size":300,"mimetype":"image/jpeg"}');
do $$
declare payload jsonb; n int;
begin
 payload:=(public.sk_profile_own() - array['id','version','updatedAt'])||'{"avatarKind":"photo","photoPath":"00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.jpg"}';
 perform public.sk_profile_save(payload,2,'20000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001');
 delete from storage.objects where bucket_id='profile-photos'; get diagnostics n=row_count; assert n=0,'Referenced photo deleted';
 update storage.objects set metadata='{}' where bucket_id='profile-photos'; get diagnostics n=row_count; assert n=0,'Immutable photo overwritten';
 begin insert into storage.objects(bucket_id,name,metadata) values('profile-photos','00000000-0000-4000-8000-000000000002/30000000-0000-4000-8000-000000000001.jpg','{}'); raise exception 'Foreign upload accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$
declare cards jsonb; n int;
begin
 select count(*) into n from storage.objects; assert n=0,'Unrelated photo visible before search';
 cards:=public.sk_player_accounts('Gleicher');
 assert jsonb_array_length(cards)=1,'Profile search failed';
 assert not ((cards->0)?'firstName') and not ((cards->0)?'birthDate'),'Private fields leaked through search';
 select count(*) into n from storage.objects; assert n=1,'Matched photo unavailable';
 cards:=public.sk_profile_cards(array['00000000-0000-4000-8000-000000000001'::uuid]);
 assert jsonb_array_length(cards)=1 and not ((cards->0)?'lastName'),'Profile cards leak private fields';
 delete from storage.objects; get diagnostics n=row_count; assert n=0,'Foreign photo deleted';
 begin perform public.sk_profile_save((public.sk_profile_own()-array['id','version','updatedAt'])||'{"avatarKind":"photo","photoPath":"00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.jpg"}',1,'20000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003'); raise exception 'Foreign photo reference accepted'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
declare result jsonb;
begin
 result:=public.sk_profile_save('{"displayName":"Gleicher Name","firstName":"","lastName":"","birthDate":null,"avatarKind":"animal","animalId":"owl","accentId":"amber","photoPath":null,"setupCompleted":true}',1,'20000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000002');
 assert result->>'displayName'='Gleicher Name','Duplicate display name rejected';
 assert result->>'firstName'='' and result->>'birthDate' is null,'Foreign private profile returned';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare n int;
begin
 perform public.sk_profile_save((public.sk_profile_own()-array['id','version','updatedAt'])||'{"avatarKind":"none","photoPath":null,"birthDate":null}',3,'20000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001');
 delete from storage.objects where bucket_id='profile-photos'; get diagnostics n=row_count; assert n=1,'Unreferenced photo cleanup failed';
end $$;
set local role anon;
do $$ begin
 begin perform public.sk_profile_own(); raise exception 'Anonymous profile read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
