-- In-app account deletion (App Store guideline 5.1.1(v), Google Play account deletion).
--
-- Hosted Storage refuses direct deletes from storage.objects, so deletion runs in
-- three client steps:
--   1. sk_account_release_photo(): drop the profile's photo reference, so the
--      existing storage delete policy permits removing the files.
--   2. The client removes every object under "<uid>/" in profile-photos.
--   3. sk_account_delete(): refuses while photos remain, hands shared tables to
--      another member (or deletes them when nobody else is left) and deletes
--      auth.users. Everything else follows through ON DELETE CASCADE.

create function private.sk_account_release_photo() returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Bitte anmelden.' using errcode = '42501'; end if;
  update private.sk_profiles
     set avatar_kind = 'none', animal_id = null, photo_path = null,
         version = version + 1, updated_at = clock_timestamp()
   where user_id = actor and photo_path is not null;
end $$;
revoke all on function private.sk_account_release_photo() from public, anon;
grant execute on function private.sk_account_release_photo() to authenticated;
create function public.sk_account_release_photo() returns void
language sql set search_path = '' as $$ select private.sk_account_release_photo(); $$;
revoke all on function public.sk_account_release_photo() from public, anon;
grant execute on function public.sk_account_release_photo() to authenticated;

create function private.sk_account_delete() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  owned record;
  heir uuid;
  transferred int := 0;
  removed int := 0;
begin
  if actor is null then raise exception 'Bitte anmelden.' using errcode = '42501'; end if;
  if exists (select 1 from storage.objects
              where bucket_id = 'profile-photos' and name like actor::text || '/%') then
    raise exception 'Profilfotos konnten nicht entfernt werden. Bitte erneut versuchen.'
      using errcode = '55000';
  end if;

  for owned in
    select id from public.sk_live_tables where owner_id = actor order by id for update
  loop
    -- Prefer a member who can already write; otherwise the longest-standing id order.
    select m.user_id into heir from public.sk_live_members m
     where m.table_id = owned.id and m.user_id <> actor
     order by (m.role = 'write') desc, m.user_id
     limit 1;
    if heir is null then
      delete from private.sk_round_identities where table_id = owned.id;
      delete from private.sk_round_identity_backups where table_id = owned.id;
      delete from public.sk_live_tables where id = owned.id;
      removed := removed + 1;
    else
      update public.sk_live_members set role = 'write'
       where table_id = owned.id and user_id = heir;
      update public.sk_live_tables
         set owner_id = heir, version = version + 1, updated_at = clock_timestamp()
       where id = owned.id;
      transferred := transferred + 1;
    end if;
    heir := null;
  end loop;

  update private.sk_round_identities set registered_by = null where registered_by = actor;
  delete from auth.users where id = actor;
  return jsonb_build_object('transferredTables', transferred, 'deletedTables', removed);
end $$;
revoke all on function private.sk_account_delete() from public, anon;
grant execute on function private.sk_account_delete() to authenticated;
create function public.sk_account_delete() returns jsonb
language sql set search_path = '' as $$ select private.sk_account_delete(); $$;
revoke all on function public.sk_account_delete() from public, anon;
grant execute on function public.sk_account_delete() to authenticated;
