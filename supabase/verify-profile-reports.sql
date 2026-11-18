-- Isolated PGlite fixture only (scripts/verify-shared-database.cjs).
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare n int; begin
 perform public.sk_report_profile('00000000-0000-4000-8000-000000000002','photo',E'  Bild\nunpassend ');
 perform public.sk_report_profile('00000000-0000-4000-8000-000000000002','name','');
 begin perform public.sk_report_profile('00000000-0000-4000-8000-000000000001','name',''); raise exception 'Self report accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.sk_report_profile('00000000-0000-4000-8000-000000000003','spam',''); raise exception 'Unknown reason accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.sk_report_profile('00000000-0000-4000-8000-000000000003','other',repeat('x',501)); raise exception 'Long details accepted'; exception when invalid_parameter_value then null; end;
 begin perform count(*) from private.sk_profile_reports; raise exception 'Direct report access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 assert (select count(*) from private.sk_profile_reports where target_id='00000000-0000-4000-8000-000000000002')=1,'Duplicate report stored';
 assert (select details from private.sk_profile_reports where target_id='00000000-0000-4000-8000-000000000002')='Bild unpassend','Details not cleaned';
 assert (select display_name is not null from private.sk_profile_reports limit 1),'Snapshot missing';
end $$;
rollback;
begin;
set local role anon;
do $$ begin
 begin perform public.sk_report_profile('00000000-0000-4000-8000-000000000002','name',''); raise exception 'Anonymous report accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
