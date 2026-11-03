// Uses explicitly provisioned, disposable confirmed QA accounts. Never signs up or sends email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
(async () => {
  const { users } = JSON.parse(
    fs.readFileSync('output/qa/profile-live-credentials.json', 'utf8'),
  );
  const env = Object.fromEntries(
    fs
      .readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf('=');
        return [
          l.slice(0, i),
          l
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
  assert.equal(
    new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname,
    'jujvkphobubxmylekkvd.supabase.co',
  );
  const clients = [0, 0, 1].map(() =>
    createClient(
      env.EXPO_PUBLIC_SUPABASE_URL,
      env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
  for (let i = 0; i < 3; i++) {
    const r = await clients[i].auth.signInWithPassword(users[i === 2 ? 1 : 0]);
    assert.ifError(r.error);
  }
  const [owner, secondDevice, outsider] = clients;
  const call = async (c, name, args = {}) => {
    const r = await c.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
    if (r.error)
      throw Object.assign(Error(r.error.message), { code: r.error.code });
    return r.data;
  };
  const fields = (p) => {
    const { id, version, updatedAt, ...f } = p;
    return { ...f, setupCompleted: true };
  };
  let own = await call(owner, 'sk_profile_own');
  assert.equal(own.setupCompleted, false);
  const operation = randomUUID();
  const payload = {
    ...fields(own),
    displayName: 'QA Profil sicher',
    firstName: 'Privater Vorname',
    lastName: 'Nur Eigentümer',
    birthDate: '2000-02-29',
    avatarKind: 'animal',
    animalId: 'owl',
    accentId: 'amber',
  };
  const args = {
    p_payload: payload,
    p_version: own.version,
    p_operation_id: operation,
    p_user_id: users[0].id,
  };
  const saved = await call(owner, 'sk_profile_save', args);
  assert.equal(saved.version, own.version + 1);
  assert.equal(saved.firstName, payload.firstName);
  assert.equal(
    (await call(secondDevice, 'sk_profile_own')).birthDate,
    '2000-02-29',
  );
  assert.equal(
    (await call(owner, 'sk_profile_save', args)).version,
    saved.version,
  );
  await assert.rejects(
    call(secondDevice, 'sk_profile_save', {
      ...args,
      p_operation_id: randomUUID(),
    }),
    (e) => e.code === 'PT409',
  );
  await assert.rejects(
    call(outsider, 'sk_profile_save', args),
    (e) => e.code === '42501',
  );
  const inaccessible = await outsider
    .schema('private')
    .from('sk_profile_private')
    .select('*');
  assert.ok(inaccessible.error);
  const bucket = owner.storage.from('profile-photos'),
    foreign = outsider.storage.from('profile-photos');
  const path = `${users[0].id}/${randomUUID()}.jpg`;
  const image = fs.readFileSync('output/qa/profile-test.jpg');
  assert.ifError(
    (
      await bucket.upload(path, image, {
        contentType: 'image/jpeg',
        upsert: false,
      })
    ).error,
  );
  assert.ok((await foreign.createSignedUrl(path, 60)).error);
  let current = await call(owner, 'sk_profile_own');
  current = await call(owner, 'sk_profile_save', {
    p_payload: { ...fields(current), avatarKind: 'photo', photoPath: path },
    p_version: current.version,
    p_operation_id: randomUUID(),
    p_user_id: users[0].id,
  });
  const search = await call(outsider, 'sk_player_accounts', {
    p_query: 'QA Profil sicher',
  });
  assert.equal(search.length, 1);
  assert.ok(!('birthDate' in search[0]));
  assert.ok(!('firstName' in search[0]));
  const signed = await foreign.createSignedUrl(path, 60);
  assert.ifError(signed.error);
  assert.equal((await fetch(signed.data.signedUrl)).status, 200);
  assert.ok(
    (
      await foreign.upload(path, image, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    ).error,
  );
  await bucket.remove([path]);
  assert.ifError((await bucket.createSignedUrl(path, 60)).error);
  const otherPath = `${users[1].id}/${randomUUID()}.jpg`;
  assert.ok(
    (await bucket.upload(otherPath, image, { contentType: 'image/jpeg' }))
      .error,
  );
  current = await call(owner, 'sk_profile_save', {
    p_payload: {
      ...fields(current),
      avatarKind: 'none',
      photoPath: null,
      birthDate: null,
    },
    p_version: current.version,
    p_operation_id: randomUUID(),
    p_user_id: users[0].id,
  });
  assert.equal(current.birthDate, null);
  assert.ifError((await bucket.remove([path])).error);
  assert.ok((await bucket.createSignedUrl(path, 60)).error);
  assert.ok((await foreign.createSignedUrl(path, 60)).error);
  for (const c of clients) await c.auth.signOut();
  console.log(
    'PASS: real authenticated profile RPCs, two devices, private data, CAS, retries, signed photo access, immutable photos, foreign uploads, referenced-photo protection and Storage API deletion.',
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
