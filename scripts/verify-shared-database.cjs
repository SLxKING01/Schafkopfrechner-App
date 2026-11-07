const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
let db;
(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');`);
  const files = fs
    .readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    // Legacy memberships are explicitly preserved by the invitation migration.
    // Verify the earlier assignment model before installing its consent gate.
    if (file.endsWith('_table_invitations.sql')) {
      await db.exec(fs.readFileSync('supabase/verify-table-roles.sql', 'utf8'));
      await db.exec(fs.readFileSync('supabase/verify-friends.sql', 'utf8'));
    }
    if (file.includes('round_identity_guard')) {
      await db.exec(`insert into public.sk_live_tables(id,owner_id,payload) values
    ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
    '{"currentTable":{"id":"10000000-0000-4000-8000-000000000001"},"players":[],"rounds":[{"tableId":"10000000-0000-4000-8000-000000000001","createdAt":"legacy-time"},{"id":"keep-existing-id","tableId":"10000000-0000-4000-8000-000000000001","createdAt":"legacy-time"}],"balances":[],"settlements":[],"activeGame":true}');`);
    }
    if (file.includes('shared_table_roles'))
      await db.exec(
        fs.readFileSync('supabase/verify-shared-tables.sql', 'utf8'),
      );
    if (file.includes('personal_profiles'))
      await db.exec(`
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now());
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon;
      grant select,insert,delete,update on storage.objects to authenticated;
    `);
    const sql = fs
      .readFileSync(path.join('supabase/migrations', file), 'utf8')
      .replace(/^alter publication .*;\r?$/gm, '');
    await db.exec(sql);
  }
  const migrated = (
    await db.query(
      `select payload,version from public.sk_live_tables where id='10000000-0000-4000-8000-000000000001'`,
    )
  ).rows[0];
  if (
    !migrated.payload.rounds[0].id.startsWith('legacy-') ||
    migrated.payload.rounds[1].id !== 'keep-existing-id' ||
    migrated.version !== 2
  )
    throw Error('Legacy migration failed');
  if (
    (
      await db.query(
        'select count(*)::int as count from private.sk_round_identity_backups',
      )
    ).rows[0].count !== 1
  )
    throw Error('Legacy backup missing');
  const reread = (
    await db.query(
      `select payload from public.sk_live_tables where id='10000000-0000-4000-8000-000000000001'`,
    )
  ).rows[0];
  if (reread.payload.rounds[0].id !== migrated.payload.rounds[0].id)
    throw Error('Legacy identity changed across reads');
  await db.exec(
    fs.readFileSync('supabase/verify-round-identities.sql', 'utf8'),
  );
  await db.exec(fs.readFileSync('supabase/verify-sync.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/verify-profiles.sql', 'utf8'));
  await db.exec(
    fs.readFileSync('supabase/verify-table-invitations.sql', 'utf8'),
  );
  await db.exec(
    fs.readFileSync('supabase/verify-settlement-events.sql', 'utf8'),
  );
  console.log(
    'PASS: migrations, shared permissions, CAS, round identities, profiles, friendships, invitations and settlement events on isolated PostgreSQL.',
  );
})()
  .catch((e) => {
    console.error(e.message, e.where);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db?.close();
  });
