-- PostgREST 14 retries 40001 internally. Expected compare-and-swap conflicts
-- must return HTTP 409 so the app can reread and perform its bounded rebase.
-- Preserve signatures, owners, security settings and grants of both RPCs.
do $$
declare definition text;
begin
  for definition in
    select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname='sk_live_command')
       or (n.nspname='public' and p.proname='save_game_state')
  loop
    execute replace(definition, '''40001''', '''PT409''');
  end loop;
end $$;
