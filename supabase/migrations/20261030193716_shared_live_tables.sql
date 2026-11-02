-- Atomic account snapshots: includes both current tables/rounds/settlements and
-- the games, player directory and match-day history used by the newer screens.
-- No public access and no service-role key required in the app.
create table public.game_states (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'schemaVersion' = '1'),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table public.game_states enable row level security;
grant select, insert, update on public.game_states to authenticated;
revoke all on public.game_states from anon;
create policy "Read own game state" on public.game_states for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Insert own game state" on public.game_states for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Update own game state" on public.game_states for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create function public.save_game_state(p_payload jsonb, p_expected_version integer)
returns table(version integer, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
    insert into public.game_states as target(owner_id, payload, version)
    values (auth.uid(), p_payload, 1)
    on conflict (owner_id) do update
      set payload = excluded.payload, version = target.version + 1, updated_at = now()
      where target.version = p_expected_version
    returning target.version, target.updated_at;
  if not found then
    raise exception 'Synchronisierungskonflikt: Cloud-Daten wurden inzwischen geaendert.' using errcode = '40001';
  end if;
end;
$$;
revoke execute on function public.save_game_state(jsonb, integer) from public, anon;
grant execute on function public.save_game_state(jsonb, integer) to authenticated;

create schema if not exists private;
create table public.sk_live_tables (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  payload jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table public.sk_live_members (
  table_id uuid not null references public.sk_live_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (table_id, user_id)
);
create index sk_live_members_by_user on public.sk_live_members(user_id, table_id);
create table private.sk_live_invites (
  table_id uuid primary key references public.sk_live_tables(id) on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text, '-', '')
);
alter table public.sk_live_tables enable row level security;
alter table public.sk_live_members enable row level security;
alter table private.sk_live_invites enable row level security;
revoke all on public.sk_live_tables, public.sk_live_members from anon, authenticated;
revoke all on private.sk_live_invites from public, anon, authenticated;
grant select on public.sk_live_tables, public.sk_live_members to authenticated;
create policy own_live_membership on public.sk_live_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy member_live_table on public.sk_live_tables for select to authenticated
  using (id in (select table_id from public.sk_live_members where user_id = (select auth.uid())));

create function private.sk_live_command(p_action text, p_table_id uuid, p_payload jsonb, p_version bigint, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.sk_live_tables;
  target_id uuid := p_table_id;
  invite text;
begin
  if actor is null then raise exception 'Bitte anmelden.' using errcode = '42501'; end if;
  if p_action = 'join' then
    select i.table_id into target_id from private.sk_live_invites i where i.code = lower(regexp_replace(p_code, '[^a-zA-Z0-9]', '', 'g'));
    if target_id is null then raise exception 'Tischcode nicht gefunden.' using errcode = 'P0001'; end if;
    insert into public.sk_live_members values (target_id, actor) on conflict do nothing;
  elsif p_action in ('create', 'save') then
    if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 5000000
      or (p_payload->'currentTable'->>'id') is distinct from target_id::text
      or jsonb_typeof(p_payload->'players') is distinct from 'array'
      or jsonb_typeof(p_payload->'rounds') is distinct from 'array'
      or jsonb_typeof(p_payload->'balances') is distinct from 'array'
      or jsonb_typeof(p_payload->'settlements') is distinct from 'array'
      or jsonb_typeof(p_payload->'activeGame') is distinct from 'boolean'
      or exists (select 1 from jsonb_array_elements(p_payload->'rounds') r where r->>'tableId' is distinct from target_id::text)
    then raise exception 'Ungültiger Tischstand.'; end if;
    if p_action = 'create' then
      if p_version <> 0 then raise exception 'Ungültige Version.'; end if;
      insert into public.sk_live_tables(id, owner_id, payload) values (target_id, actor, p_payload);
      insert into public.sk_live_members values (target_id, actor);
      insert into private.sk_live_invites(table_id) values (target_id);
    else
      if not exists(select 1 from public.sk_live_members m where m.table_id = target_id and m.user_id = actor) then
        raise exception 'Kein Zugriff auf diesen Tisch.' using errcode = '42501';
      end if;
      update public.sk_live_tables t set payload = p_payload, version = t.version + 1, updated_at = clock_timestamp()
        where t.id = target_id and t.version = p_version;
      if not found then raise exception 'Der Tisch wurde inzwischen geändert. Bitte aktuellen Stand laden.' using errcode = '40001'; end if;
    end if;
  elsif p_action <> 'read' then
    raise exception 'Unbekannte Aktion.';
  end if;
  if not exists(select 1 from public.sk_live_members m where m.table_id = target_id and m.user_id = actor) then
    raise exception 'Kein Zugriff auf diesen Tisch.' using errcode = '42501';
  end if;
  select * into strict target from public.sk_live_tables where id = target_id;
  select code into invite from private.sk_live_invites where table_id = target_id;
  return jsonb_build_object('id', target.id, 'payload', target.payload, 'version', target.version, 'code', invite, 'updatedAt', target.updated_at);
end;
$$;
revoke all on function private.sk_live_command(text, uuid, jsonb, bigint, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.sk_live_command(text, uuid, jsonb, bigint, text) to authenticated;
create function public.sk_live_command(p_action text, p_table_id uuid default null, p_payload jsonb default null, p_version bigint default 0, p_code text default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sk_live_command(p_action, p_table_id, p_payload, p_version, p_code);
$$;
revoke all on function public.sk_live_command(text, uuid, jsonb, bigint, text) from public, anon;
grant execute on function public.sk_live_command(text, uuid, jsonb, bigint, text) to authenticated;
alter publication supabase_realtime add table public.sk_live_tables;
