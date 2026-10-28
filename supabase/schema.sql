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
