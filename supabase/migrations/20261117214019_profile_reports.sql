-- Reports about other accounts (App Store guideline 1.2 for user-generated
-- names and profile photos). Reviewed by the operator in the Supabase dashboard:
--   select * from private.sk_profile_reports where status = 'open' order by created_at;
create table private.sk_profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('name','photo','harassment','other')),
  details text not null default '' check (char_length(details) <= 500),
  -- What the reporter saw, kept for review even if the profile changes later.
  display_name text not null,
  photo_path text,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default clock_timestamp()
);
create index sk_profile_reports_open on private.sk_profile_reports(status, created_at);
create index sk_profile_reports_reporter on private.sk_profile_reports(reporter_id, created_at);
alter table private.sk_profile_reports enable row level security;
revoke all on private.sk_profile_reports from public, anon, authenticated;

create function private.sk_report_profile(p_profile_id uuid, p_reason text, p_details text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target private.sk_profiles;
  note text := btrim(regexp_replace(coalesce(p_details, ''), '[[:cntrl:]]', ' ', 'g'));
begin
  if actor is null then raise exception 'Bitte anmelden.' using errcode = '42501'; end if;
  if p_reason is null or p_reason not in ('name','photo','harassment','other') then
    raise exception 'Bitte einen Grund auswählen.' using errcode = '22023';
  end if;
  if char_length(note) > 500 then
    raise exception 'Die Beschreibung darf höchstens 500 Zeichen haben.' using errcode = '22023';
  end if;
  select * into target from private.sk_profiles where user_id = p_profile_id;
  if not found or p_profile_id = actor then
    raise exception 'Dieses Konto kann nicht gemeldet werden.' using errcode = '22023';
  end if;
  -- A repeated report of the same account within a day changes nothing.
  if exists (select 1 from private.sk_profile_reports
              where reporter_id = actor and target_id = p_profile_id
                and created_at > clock_timestamp() - interval '1 day') then
    return;
  end if;
  if (select count(*) from private.sk_profile_reports
       where reporter_id = actor and created_at > clock_timestamp() - interval '1 day') >= 20 then
    raise exception 'Zu viele Meldungen. Bitte später erneut versuchen.' using errcode = '54000';
  end if;
  insert into private.sk_profile_reports(reporter_id, target_id, reason, details, display_name, photo_path)
  values (actor, p_profile_id, p_reason, note, target.display_name, target.photo_path);
end $$;
revoke all on function private.sk_report_profile(uuid, text, text) from public, anon;
grant execute on function private.sk_report_profile(uuid, text, text) to authenticated;
create function public.sk_report_profile(p_profile_id uuid, p_reason text, p_details text)
returns void language sql set search_path = '' as $$
  select private.sk_report_profile(p_profile_id, p_reason, p_details);
$$;
revoke all on function public.sk_report_profile(uuid, text, text) from public, anon;
grant execute on function public.sk_report_profile(uuid, text, text) to authenticated;
