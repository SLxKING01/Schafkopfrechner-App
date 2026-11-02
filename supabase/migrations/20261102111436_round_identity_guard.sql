-- All writes continue through sk_live_command: membership is checked again
-- after its row lock and the table version is a compare-and-swap token.
-- This private registry retains identities even after a round is deleted.
create table private.sk_round_identities (
  round_id text primary key check (length(btrim(round_id)) between 1 and 200),
  table_id uuid not null references public.sk_live_tables(id),
  first_seen_order bigint generated always as identity unique,
  original_created_at text not null,
  registered_by uuid references auth.users(id),
  registered_at timestamptz not null default clock_timestamp()
);
alter table private.sk_round_identities enable row level security;
revoke all on private.sk_round_identities from public, anon, authenticated;

-- Legacy IDs are assigned once on the authoritative server, never randomly
-- by each phone. Keep the original snapshot for recovery. Existing IDs survive.
create table private.sk_round_identity_backups (
  table_id uuid primary key references public.sk_live_tables(id),
  payload jsonb not null,
  version bigint not null
);
alter table private.sk_round_identity_backups enable row level security;
revoke all on private.sk_round_identity_backups from public, anon, authenticated;
insert into private.sk_round_identity_backups
select id, payload, version from public.sk_live_tables t
where exists (select 1 from jsonb_array_elements(t.payload->'rounds') r
  where nullif(btrim(r->>'id'), '') is null);

-- An id-less history cannot be safely matched to rounds by value or time.
-- Abort the whole migration rather than silently inventing a relationship.
do $$ begin
  if exists(select 1 from private.sk_round_identity_backups b
    where jsonb_array_length(coalesce(b.payload->'currentTable'->'roundHistory','[]'::jsonb)) > 0)
  then raise exception 'Altdaten ohne Spiel-ID mit Änderungsverlauf: vor Migration zentral zuordnen.'; end if;
end $$;
update public.sk_live_tables t set
  payload = jsonb_set(t.payload, '{rounds}', (
    select coalesce(jsonb_agg(case when nullif(btrim(r->>'id'),'') is null
      then jsonb_set(r, '{id}', to_jsonb('legacy-' || md5(t.id::text || ':' || position::text)))
      else r end order by position), '[]'::jsonb)
    from jsonb_array_elements(t.payload->'rounds') with ordinality as rounds(r,position)
  )), version = version + 1, updated_at = clock_timestamp()
where t.id in (select table_id from private.sk_round_identity_backups);

create function private.sk_guard_round_identities() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  registered private.sk_round_identities;
begin
  if tg_op = 'UPDATE' and exists (
    select 1 from jsonb_array_elements(coalesce(old.payload->'currentTable'->'roundHistory','[]'::jsonb))
      with ordinality as history(event,position)
    where new.payload->'currentTable'->'roundHistory'->(position::int - 1) is distinct from event
  ) then
    raise exception 'Gespeicherter Änderungsverlauf darf nicht überschrieben werden.' using errcode='23514';
  end if;
  if jsonb_typeof(new.payload->'rounds') is distinct from 'array' then
    raise exception 'Ungültige Spielliste.' using errcode='23514';
  end if;
  if exists(select 1 from jsonb_array_elements(new.payload->'rounds') x
    group by x->>'id' having count(*) > 1) then
    raise exception 'Eine Spiel-ID darf nur einmal vorkommen.' using errcode='23505';
  end if;
  -- Include tombstones so deletion never frees an ID for another table.
  for r in
    select value from jsonb_array_elements(new.payload->'rounds')
    union all
    select e->'before' from jsonb_array_elements(coalesce(new.payload->'currentTable'->'roundHistory','[]'::jsonb)) e where e ? 'before'
    union all
    select e->'after' from jsonb_array_elements(coalesce(new.payload->'currentTable'->'roundHistory','[]'::jsonb)) e where e ? 'after'
  loop
    if jsonb_typeof(r->'id') is distinct from 'string'
      or nullif(btrim(r->>'id'),'') is null or length(r->>'id') > 200
      or r->>'tableId' is distinct from new.id::text
      or jsonb_typeof(r->'createdAt') is distinct from 'string'
      or nullif(btrim(r->>'createdAt'),'') is null then
      raise exception 'Spiel-ID, Tisch oder Erfassungszeit fehlt.' using errcode='23514';
    end if;
    insert into private.sk_round_identities(round_id,table_id,original_created_at,registered_by)
      values(r->>'id',new.id,r->>'createdAt',auth.uid()) on conflict do nothing;
    select * into strict registered from private.sk_round_identities where round_id=r->>'id';
    if registered.table_id <> new.id or registered.original_created_at <> r->>'createdAt' then
      raise exception 'Die Spiel-ID gehört bereits zu einem anderen Eintrag.' using errcode='23505';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.sk_guard_round_identities() from public, anon, authenticated;
create trigger sk_guard_round_identities after insert or update of payload on public.sk_live_tables
  for each row execute function private.sk_guard_round_identities();
-- Validate and register existing identities atomically without changing IDs.
update public.sk_live_tables set payload=payload;
