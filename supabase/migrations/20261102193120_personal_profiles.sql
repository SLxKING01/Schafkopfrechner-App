-- Display data never contains private names or birth dates. No direct client writes.
create table private.sk_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_kind text not null default 'none' check (avatar_kind in ('none','animal','photo')),
  animal_id text check (animal_id in ('fox','bear','owl','wolf','deer','raccoon','rabbit','boar')),
  accent_id text not null default 'forestGreen' check (accent_id in ('darkGreen','amber','warmRed','mutedBlue','bronze','forestGreen')),
  photo_path text,
  version bigint not null default 1,
  setup_completed boolean not null default true,
  updated_at timestamptz not null default now(),
  check ((avatar_kind = 'photo') = (photo_path is not null)),
  check (avatar_kind <> 'animal' or animal_id is not null)
);
create table private.sk_profile_private (
  user_id uuid primary key references private.sk_profiles(user_id) on delete cascade,
  first_name text not null default '' check (char_length(first_name)<=80),
  last_name text not null default '' check (char_length(last_name)<=80),
  birth_date date check (birth_date <= current_date)
);
create table private.sk_profile_requests (
  user_id uuid not null references private.sk_profiles(user_id) on delete cascade,
  operation_id uuid not null,
  request_hash text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
-- Search results grant temporary photo access, without exposing the profile tables.
create table private.sk_profile_image_access (
  viewer_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references private.sk_profiles(user_id) on delete cascade,
  expires_at timestamptz not null,
  primary key (viewer_id, profile_id)
);
alter table private.sk_profiles enable row level security;
alter table private.sk_profile_private enable row level security;
alter table private.sk_profile_requests enable row level security;
alter table private.sk_profile_image_access enable row level security;
revoke all on private.sk_profiles,private.sk_profile_private,private.sk_profile_requests,private.sk_profile_image_access from public,anon,authenticated;

insert into private.sk_profiles(user_id,display_name)
select id, left(coalesce(nullif(btrim(regexp_replace(raw_user_meta_data->>'display_name','[[:cntrl:]]','','g')),''),nullif(btrim(regexp_replace(raw_user_meta_data->>'username','[[:cntrl:]]','','g')),''),'Spieler'),40) from auth.users;
insert into private.sk_profile_private(user_id) select user_id from private.sk_profiles;

create function private.sk_profile_on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into private.sk_profiles(user_id,display_name,setup_completed)
  values(new.id,left(coalesce(nullif(btrim(regexp_replace(new.raw_user_meta_data->>'username','[[:cntrl:]]','','g')),''),'Spieler'),40),false);
  insert into private.sk_profile_private(user_id) values(new.id);
  return new;
end $$;
revoke all on function private.sk_profile_on_signup() from public,anon,authenticated;
create trigger sk_profile_on_signup after insert on auth.users for each row execute function private.sk_profile_on_signup();

create function private.sk_profile_card(p private.sk_profiles) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p.user_id,'displayName',p.display_name,'avatarKind',p.avatar_kind,'animalId',p.animal_id,'accentId',p.accent_id,'photoPath',p.photo_path,'version',p.version);
$$;
revoke all on function private.sk_profile_card(private.sk_profiles) from public,anon,authenticated;

create function private.sk_profile_own() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 select private.sk_profile_card(p)||jsonb_build_object('firstName',s.first_name,'lastName',s.last_name,'birthDate',s.birth_date,'setupCompleted',p.setup_completed,'updatedAt',p.updated_at)
 into result from private.sk_profiles p join private.sk_profile_private s using(user_id) where p.user_id=auth.uid();
 if result is null then raise exception 'Profil nicht vorhanden.' using errcode='P0002'; end if;
 return result;
end $$;
revoke all on function private.sk_profile_own() from public,anon;
grant execute on function private.sk_profile_own() to authenticated;
create function public.sk_profile_own() returns jsonb language sql set search_path='' as $$ select private.sk_profile_own(); $$;
revoke all on function public.sk_profile_own() from public,anon;
grant execute on function public.sk_profile_own() to authenticated;

create function private.sk_profile_save(p_payload jsonb,p_version bigint,p_operation_id uuid,p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); previous private.sk_profiles; req_hash text; existing text;
 dn text; fn text; ln text; birthday date; kind text; animal text; accent text; photo text;
begin
 if actor is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 if actor is distinct from p_user_id then raise exception 'Konto hat sich geändert.' using errcode='42501'; end if;
 if p_operation_id is null or p_version is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'UngÃ¼ltiger Profilauftrag.' using errcode='22023'; end if;
 select * into previous from private.sk_profiles where user_id=actor for update;
 if not found then raise exception 'Profil nicht vorhanden.' using errcode='P0002'; end if;
 req_hash:=md5(jsonb_build_array(p_payload,p_version)::text);
 select request_hash into existing from private.sk_profile_requests where user_id=actor and operation_id=p_operation_id;
 if found then
   if existing<>req_hash then raise exception 'Operations-ID bereits anders verwendet.' using errcode='22023'; end if;
   return private.sk_profile_own();
 end if;
 if previous.version<>p_version then raise exception 'Das Profil wurde auf einem anderen GerÃ¤t geÃ¤ndert. Bitte den aktuellen Stand prÃ¼fen.' using errcode='PT409'; end if;
 if (p_payload - array['displayName','firstName','lastName','birthDate','avatarKind','animalId','accentId','photoPath','setupCompleted'])<>'{}'::jsonb then raise exception 'Unbekannte Profilfelder.' using errcode='22023'; end if;
 if jsonb_typeof(p_payload->'displayName') is distinct from 'string' or jsonb_typeof(p_payload->'firstName') is distinct from 'string' or jsonb_typeof(p_payload->'lastName') is distinct from 'string' or (p_payload->'setupCompleted') is distinct from 'true'::jsonb then raise exception 'UngÃ¼ltige Profilfelder.' using errcode='22023'; end if;
 dn:=btrim(p_payload->>'displayName'); fn:=btrim(p_payload->>'firstName'); ln:=btrim(p_payload->>'lastName');
 if char_length(dn) not between 2 and 40 or char_length(fn)>80 or char_length(ln)>80 or (dn||fn||ln) ~ '[[:cntrl:]]' then raise exception 'Bitte Namen und FeldlÃ¤ngen prÃ¼fen.' using errcode='22023'; end if;
 if coalesce(p_payload->>'birthDate','')<>'' then
   if jsonb_typeof(p_payload->'birthDate')<>'string' or (p_payload->>'birthDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'UngÃ¼ltiges Geburtsdatum.' using errcode='22023'; end if;
   begin birthday:=(p_payload->>'birthDate')::date; exception when others then raise exception 'UngÃ¼ltiges Geburtsdatum.' using errcode='22023'; end;
   if birthday>current_date or birthday<'0001-01-01'::date then raise exception 'Geburtsdatum darf nicht in der Zukunft liegen.' using errcode='22023'; end if;
 end if;
 kind:=p_payload->>'avatarKind'; animal:=p_payload->>'animalId'; accent:=p_payload->>'accentId'; photo:=p_payload->>'photoPath';
 if kind is null or kind not in ('none','animal','photo') or accent is null or accent not in ('darkGreen','amber','warmRed','mutedBlue','bronze','forestGreen') or (animal is not null and animal not in ('fox','bear','owl','wolf','deer','raccoon','rabbit','boar')) or (kind='animal' and animal is null) then raise exception 'UngÃ¼ltiger Profil-Look.' using errcode='22023'; end if;
 if kind='photo' then
   if photo is null or photo !~ ('^'||actor::text||'/[0-9a-f-]{36}\.jpg$') or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=photo and (metadata->>'size')::bigint<=512000 and metadata->>'mimetype'='image/jpeg') then raise exception 'Profilfoto fehlt oder ist ungÃ¼ltig. Bitte erneut auswÃ¤hlen.' using errcode='22023'; end if;
 elsif photo is not null then raise exception 'Unpassender Bildverweis.' using errcode='22023'; end if;
 update private.sk_profiles set display_name=dn,avatar_kind=kind,animal_id=animal,accent_id=accent,photo_path=photo,version=version+1,setup_completed=true,updated_at=now() where user_id=actor;
 update private.sk_profile_private set first_name=fn,last_name=ln,birth_date=birthday where user_id=actor;
 insert into private.sk_profile_requests(user_id,operation_id,request_hash) values(actor,p_operation_id,req_hash);
 delete from private.sk_profile_requests where user_id=actor and created_at<now()-interval '30 days';
 return private.sk_profile_own();
end $$;
revoke all on function private.sk_profile_save(jsonb,bigint,uuid,uuid) from public,anon;
grant execute on function private.sk_profile_save(jsonb,bigint,uuid,uuid) to authenticated;
create function public.sk_profile_save(p_payload jsonb,p_version bigint,p_operation_id uuid,p_user_id uuid) returns jsonb language sql set search_path='' as $$ select private.sk_profile_save(p_payload,p_version,p_operation_id,p_user_id); $$;
revoke all on function public.sk_profile_save(jsonb,bigint,uuid,uuid) from public,anon;
grant execute on function public.sk_profile_save(jsonb,bigint,uuid,uuid) to authenticated;

create function private.sk_profile_can_read(p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.uid()=p_user_id or exists(select 1 from public.sk_live_members a join public.sk_live_members b on a.table_id=b.table_id where a.user_id=auth.uid() and b.user_id=p_user_id) or exists(select 1 from private.sk_profile_image_access where viewer_id=auth.uid() and profile_id=p_user_id and expires_at>now()));
$$;
revoke all on function private.sk_profile_can_read(uuid) from public,anon;
grant execute on function private.sk_profile_can_read(uuid) to authenticated;

create function private.sk_profile_cards(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 if coalesce(cardinality(p_ids),0)>60 then raise exception 'Zu viele Profile.' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(private.sk_profile_card(p)),'[]'::jsonb) from private.sk_profiles p where user_id=any(p_ids) and private.sk_profile_can_read(user_id));
end $$;
revoke all on function private.sk_profile_cards(uuid[]) from public,anon;
grant execute on function private.sk_profile_cards(uuid[]) to authenticated;
create function public.sk_profile_cards(p_ids uuid[]) returns jsonb language sql set search_path='' as $$ select private.sk_profile_cards(p_ids); $$;
revoke all on function public.sk_profile_cards(uuid[]) from public,anon;
grant execute on function public.sk_profile_cards(uuid[]) to authenticated;

create or replace function private.sk_player_accounts(p_query text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; ids uuid[];
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 select array_agg(user_id) into ids from (
 select user_id from private.sk_profiles where (char_length(btrim(coalesce(p_query,'')))>=2 and strpos(lower(display_name),lower(left(btrim(p_query),80)))>0) or (btrim(coalesce(p_query,''))='' and user_id=auth.uid()) order by display_name,user_id limit 20
 ) matches;
 delete from private.sk_profile_image_access where viewer_id=auth.uid() and expires_at<now();
 insert into private.sk_profile_image_access(viewer_id,profile_id,expires_at) select auth.uid(),unnest(ids),now()+interval '15 minutes' on conflict(viewer_id,profile_id) do update set expires_at=excluded.expires_at;
 select coalesce(jsonb_agg(private.sk_profile_card(p)||jsonb_build_object('name',p.display_name) order by p.display_name,p.user_id),'[]'::jsonb) into result from private.sk_profiles p where user_id=any(ids);
 return result;
end $$;
-- The search now grants expiring read access for precisely its returned cards.
create or replace function public.sk_player_accounts(p_query text default '') returns jsonb language sql volatile set search_path='' as $$ select private.sk_player_accounts(p_query); $$;
revoke all on function private.sk_player_accounts(text),public.sk_player_accounts(text) from public,anon;
grant execute on function private.sk_player_accounts(text),public.sk_player_accounts(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',false,512000,array['image/jpeg']);
create function private.sk_profile_photo_read(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.sk_profiles where photo_path=p_name and avatar_kind='photo' and private.sk_profile_can_read(user_id));
$$;
create function private.sk_profile_photo_unreferenced(p_name text) returns boolean language sql stable security definer set search_path='' as $$ select not exists(select 1 from private.sk_profiles where photo_path=p_name); $$;
revoke all on function private.sk_profile_photo_read(text),private.sk_profile_photo_unreferenced(text) from public,anon;
grant execute on function private.sk_profile_photo_read(text),private.sk_profile_photo_unreferenced(text) to authenticated;
create policy sk_profile_photo_read on storage.objects for select to authenticated using(bucket_id='profile-photos' and ((name like (select auth.uid())::text||'/%') or private.sk_profile_photo_read(name)));
create policy sk_profile_photo_insert on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.jpg$'));
create policy sk_profile_photo_delete on storage.objects for delete to authenticated using(bucket_id='profile-photos' and name like (select auth.uid())::text||'/%' and private.sk_profile_photo_unreferenced(name));
-- No UPDATE policy: every replacement gets an immutable new object path.

create index sk_profile_image_access_profile on private.sk_profile_image_access(profile_id);
