-- Payment events stay private. Members only receive a content-free revision
-- bump over Realtime and then re-read the checkout through the existing RPC.
create table public.sk_settlement_signals (
  table_id uuid primary key references public.sk_live_tables(id) on delete cascade,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.sk_settlement_signals enable row level security;
revoke all on public.sk_settlement_signals from public,anon,authenticated;
grant select on public.sk_settlement_signals to authenticated;
create policy sk_settlement_signals_read on public.sk_settlement_signals for select to authenticated
  using (exists(select 1 from public.sk_live_members m where m.table_id=sk_settlement_signals.table_id and m.user_id=(select auth.uid())));

create function private.sk_settlement_signal() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.sk_settlement_signals(table_id) values(new.table_id)
  on conflict(table_id) do update set revision=public.sk_settlement_signals.revision+1, updated_at=now();
  return null;
end $$;
revoke all on function private.sk_settlement_signal() from public,anon,authenticated;
create trigger sk_settlement_signal after insert on private.sk_settlement_events
  for each row execute function private.sk_settlement_signal();

alter publication supabase_realtime add table public.sk_settlement_signals;
