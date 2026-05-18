-- Schafkopfrechner MVP schema proposal.
-- Review before applying. Do not execute blindly in production.

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  is_local boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id) on delete cascade,
  winner_id uuid not null references public.players(id) on delete restrict,
  loser_ids uuid[] not null,
  amount_cents integer not null check (amount_cents > 0),
  game_type text not null check (
    game_type in ('sauspiel', 'solo', 'wenz', 'ramsch', 'custom')
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id) on delete cascade,
  from_player_id uuid not null references public.players(id) on delete cascade,
  to_player_id uuid not null references public.players(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists tables_owner_id_idx on public.tables(owner_id);
create index if not exists players_table_id_idx on public.players(table_id);
create index if not exists rounds_table_id_created_at_idx
  on public.rounds(table_id, created_at desc);
create index if not exists settlements_table_id_idx
  on public.settlements(table_id);

alter table public.tables enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.settlements enable row level security;

-- RLS policy sketch:
-- create table_members table for invited users, then allow access if:
-- - auth.uid() = tables.owner_id
-- - or auth.uid() is a member of table_members.table_id
-- Local/offline players remain rows without user_id.
