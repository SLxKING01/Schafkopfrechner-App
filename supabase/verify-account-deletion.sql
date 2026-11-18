-- Isolated PGlite fixture only (scripts/verify-shared-database.cjs).
-- Account 9 owns one shared table (account 2 is a reader) and one solo table.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000009');
insert into public.sk_live_tables(id,owner_id,payload) values
 ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000009','{"currentTable":{"id":"40000000-0000-4000-8000-000000000001"},"players":[],"rounds":[]}'),
 ('40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000009','{"currentTable":{"id":"40000000-0000-4000-8000-000000000002"},"players":[],"rounds":[]}');
insert into public.sk_live_members(table_id,user_id,role) values
 ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000009','write'),
 ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','read'),
 ('40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000009','write');
insert into private.sk_round_identities(round_id,table_id,original_created_at,registered_by) values
 ('delete-shared-round','40000000-0000-4000-8000-000000000001','t','00000000-0000-4000-8000-000000000009'),
 ('delete-solo-round','40000000-0000-4000-8000-000000000002','t','00000000-0000-4000-8000-000000000009');
insert into public.game_states(owner_id,payload) values('00000000-0000-4000-8000-000000000009','{"schemaVersion":"1"}');
insert into storage.objects(bucket_id,name,metadata) values('profile-photos','00000000-0000-4000-8000-000000000009/50000000-0000-4000-8000-000000000001.jpg','{"size":300,"mimetype":"image/jpeg"}');
update private.sk_profiles set avatar_kind='photo',photo_path='00000000-0000-4000-8000-000000000009/50000000-0000-4000-8000-000000000001.jpg' where user_id='00000000-0000-4000-8000-000000000009';
commit;

begin;
set local role anon;
do $$ begin
 begin perform public.sk_account_delete(); raise exception 'Anonymous deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
do $$ declare n int; begin
 begin perform public.sk_account_delete(); raise exception 'Deletion with remaining photos allowed'; exception when sqlstate '55000' then null; end;
 delete from storage.objects where bucket_id='profile-photos'; get diagnostics n=row_count; assert n=0,'Referenced photo deletable before release';
 perform public.sk_account_release_photo();
 delete from storage.objects where bucket_id='profile-photos' and name like '00000000-0000-4000-8000-000000000009/%'; get diagnostics n=row_count; assert n=1,'Released photo not deletable';
end $$;
select public.sk_account_delete();
commit;

do $$ begin
 assert not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000009'),'Auth user kept';
 assert not exists(select 1 from private.sk_profiles where user_id='00000000-0000-4000-8000-000000000009'),'Profile kept';
 assert not exists(select 1 from public.game_states where owner_id='00000000-0000-4000-8000-000000000009'),'Game state kept';
 assert (select owner_id from public.sk_live_tables where id='40000000-0000-4000-8000-000000000001')='00000000-0000-4000-8000-000000000002','Shared table not transferred';
 assert (select role from public.sk_live_members where table_id='40000000-0000-4000-8000-000000000001' and user_id='00000000-0000-4000-8000-000000000002')='write','Heir cannot write';
 assert (select count(*) from public.sk_live_members where table_id='40000000-0000-4000-8000-000000000001')=1,'Deleted member kept';
 assert (select registered_by from private.sk_round_identities where round_id='delete-shared-round') is null,'Round author kept';
 assert not exists(select 1 from public.sk_live_tables where id='40000000-0000-4000-8000-000000000002'),'Solo table kept';
 assert not exists(select 1 from private.sk_round_identities where round_id='delete-solo-round'),'Solo round identity kept';
end $$;
