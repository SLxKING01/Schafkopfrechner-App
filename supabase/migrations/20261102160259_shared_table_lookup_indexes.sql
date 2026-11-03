create index sk_live_tables_by_owner on public.sk_live_tables(owner_id);
create index sk_round_identities_by_table on private.sk_round_identities(table_id);
create index sk_round_identities_by_actor on private.sk_round_identities(registered_by);
