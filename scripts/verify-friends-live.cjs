// Disposable confirmed QA accounts only. No signup or notification email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
(async () => {
  const fixture = JSON.parse(
    fs.readFileSync('output/qa/friends-live-credentials.json', 'utf8'),
  );
  const users = fixture.users;
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
  const clients = [0, 0, 1, 2].map(() =>
    createClient(
      env.EXPO_PUBLIC_SUPABASE_URL,
      env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
  const sessions = [];
  for (let i = 0; i < clients.length; i++) {
    const { data, error } = await clients[i].auth.signInWithPassword(
      users[[0, 0, 1, 2][i]],
    );
    assert.ifError(error);
    sessions.push(data.session);
  }
  const [a, a2, b, c] = clients;
  const [aid, bid, cid] = users.map((u) => u.id);
  const rpc = async (client, name, args = {}) => {
    const { data, error } = await client
      .rpc(name, args)
      .abortSignal(AbortSignal.timeout(15000));
    if (error) throw Object.assign(Error(error.message), { code: error.code });
    return data;
  };
  const state = (client, id) =>
    rpc(client, 'sk_friends_state', { p_user_id: id });
  const find = (client, id, code) =>
    rpc(client, 'sk_friends_find', { p_user_id: id, p_code: code });
  const args = (action, target, version, reference = null, code = null) => ({
    p_action: action,
    p_target: target,
    p_expected_version: version,
    p_reference: reference,
    p_code: code,
    p_operation_id: randomUUID(),
  });
  const command = (client, id, params) =>
    rpc(client, 'sk_friends_command', { ...params, p_user_id: id });
  const ok = async (client, id, params) => {
    const result = await command(client, id, params);
    assert.equal(result.ok, true, result.message);
    return result.state;
  };
  let sa = await state(a, aid),
    sb = await state(b, bid);
  const sc = await state(c, cid);
  const acode = sa.code,
    bcode = sb.code;
  assert.match(acode, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/);
  assert.notEqual(acode, bcode);
  await assert.rejects(state(a, bid), (e) => e.code === '42501');
  assert.ok(
    (await a.schema('private').from('sk_friend_blocks').select('*')).error,
  );
  assert.equal((await find(a, aid, acode)).status, 'self');
  assert.equal((await find(a, aid, bcode.slice(0, 4))).status, 'invalid');
  const hit = await find(a, aid, `${bcode.slice(0, 4)}-${bcode.slice(4)}`);
  assert.equal(hit.entry.profile.id, bid);
  assert.ok(!('birthDate' in hit.entry.profile));
  assert.ok(!('firstName' in hit.entry.profile));
  const initial = args('send', bid, 0, null, bcode);
  sa = await ok(a, aid, initial);
  assert.equal(sa.outgoing.length, 1);
  assert.equal((await ok(a2, aid, initial)).version, sa.version);
  let row = sa.outgoing[0];
  assert.equal(
    (await command(c, cid, args('accept', aid, 0, row.requestId))).code,
    'STALE',
  );
  sb = await ok(b, bid, args('send', aid, 1, null, acode));
  assert.equal(sb.friends.length, 0);
  assert.equal(sb.incoming.length, 1);
  sb = await ok(b, bid, args('accept', aid, 1, row.requestId));
  assert.equal(sb.friends.length, 1);
  assert.equal((await state(a, aid)).friends.length, 1);
  assert.deepEqual(await rpc(c, 'sk_profile_cards', { p_ids: [aid, bid] }), []);
  sa = await ok(a, aid, args('remove', bid, 2));
  assert.equal(sa.friends.length, 0);
  sa = await ok(a, aid, args('send', bid, 3, null, bcode));
  row = sa.outgoing[0];
  sa = await ok(a, aid, args('cancel', bid, row.pairVersion, row.requestId));
  assert.equal(sa.outgoing.length, 0);
  assert.equal((await ok(a, aid, initial)).outgoing.length, 0);
  const [fa, fb] = await Promise.all([
    find(a, aid, bcode),
    find(b, bid, acode),
  ]);
  const races = await Promise.all([
    command(a, aid, args('send', bid, fa.entry.pairVersion, null, bcode)),
    command(b, bid, args('send', aid, fb.entry.pairVersion, null, acode)),
  ]);
  assert.equal(races.filter((r) => r.ok).length, 1);
  assert.equal(races.filter((r) => r.code === 'STALE').length, 1);
  sa = await state(a, aid);
  sb = await state(b, bid);
  assert.equal(sa.friends.length + sb.friends.length, 0);
  assert.equal(sa.outgoing.length + sb.outgoing.length, 1);
  if (sa.incoming.length) {
    row = sa.incoming[0];
    await ok(a, aid, args('decline', bid, row.pairVersion, row.requestId));
  } else {
    row = sb.incoming[0];
    await ok(b, bid, args('decline', aid, row.pairVersion, row.requestId));
  }
  let fresh = await find(a, aid, bcode);
  sa = await ok(
    a,
    aid,
    args('send', bid, fresh.entry.pairVersion, null, bcode),
  );
  row = sa.outgoing[0];
  const blockArgs = args('block', bid, row.pairVersion);
  await Promise.all([
    command(b, bid, args('accept', aid, row.pairVersion, row.requestId)),
    command(a, aid, blockArgs),
  ]);
  sa = await state(a, aid);
  sb = await state(b, bid);
  assert.equal(sa.blocked.length, 1);
  assert.equal(
    sa.friends.length +
      sb.friends.length +
      sa.outgoing.length +
      sb.incoming.length,
    0,
  );
  assert.equal((await find(b, bid, acode)).status, 'not_found');
  assert.equal(
    (await command(b, bid, args('send', aid, 0, null, acode))).code,
    'CONTACT_UNAVAILABLE',
  );
  assert.equal(sb.blocked.length, 0);
  assert.deepEqual(await rpc(b, 'sk_profile_cards', { p_ids: [aid] }), []);
  sb = await ok(b, bid, args('block', aid, 0));
  assert.equal(sb.blocked.length, 1);
  const aBlock = sa.blocked[0];
  sa = await ok(
    a,
    aid,
    args('unblock', bid, aBlock.pairVersion, aBlock.blockId),
  );
  assert.equal(sa.blocked.length, 0);
  assert.equal((await find(a, aid, bcode)).status, 'not_found');
  const bBlock = sb.blocked[0];
  sb = await ok(
    b,
    bid,
    args('unblock', aid, bBlock.pairVersion, bBlock.blockId),
  );
  assert.equal(sb.friends.length, 0);
  assert.equal((await ok(a, aid, blockArgs)).blocked.length, 0);
  // A shared table remains accessible after blocking, including its allowed profiles.
  const tableId = randomUUID();
  const payload = {
    currentTable: {
      id: tableId,
      name: 'Disposable friendship verification',
      isActive: true,
    },
    players: [
      { id: 'seat-a', userId: aid, name: 'QA A', isLocal: false },
      { id: 'seat-b', userId: bid, name: 'QA B', isLocal: false },
    ],
    rounds: [],
    balances: [],
    settlements: [],
    activeGame: true,
  };
  const table = await rpc(a, 'sk_live_command', {
    p_action: 'create',
    p_table_id: tableId,
    p_payload: payload,
    p_version: 0,
  });
  const before = await rpc(b, 'sk_live_command', {
    p_action: 'read',
    p_table_id: tableId,
  });
  fresh = await find(a, aid, bcode);
  sa = await ok(a, aid, args('block', bid, fresh.entry.pairVersion));
  const after = await rpc(b, 'sk_live_command', {
    p_action: 'read',
    p_table_id: tableId,
  });
  assert.equal(after.version, table.version);
  assert.equal(after.role, before.role);
  assert.deepEqual(after.payload, before.payload);
  assert.equal((await rpc(b, 'sk_profile_cards', { p_ids: [aid] })).length, 1);
  assert.equal((await find(b, bid, acode)).status, 'not_found');
  const lastBlock = sa.blocked[0];
  await ok(
    a,
    aid,
    args('unblock', bid, lastBlock.pairVersion, lastBlock.blockId),
  );
  // The limit is atomic even when lookups arrive concurrently.
  const lookups = await Promise.all(
    Array.from({ length: 21 }, () => find(c, cid, 'ZZZZZZZZZZZZ')),
  );
  assert.equal(
    lookups.filter((r) => r.ok === false && r.code === 'RATE_LIMIT').length,
    1,
  );
  fixture.codes = { a: acode, b: bcode, c: sc.code };
  fixture.tableId = tableId;
  fs.writeFileSync(
    'output/qa/friends-live-credentials.json',
    JSON.stringify(fixture, null, 2),
  );
  for (const [letter, session] of [
    ['a', sessions[0]],
    ['b', sessions[2]],
  ])
    fs.writeFileSync(
      `output/qa/friends-${letter}-browser-state.json`,
      JSON.stringify({
        cookies: [],
        origins: [
          {
            origin: 'http://localhost:8081',
            localStorage: [
              {
                name: 'sb-jujvkphobubxmylekkvd-auth-token',
                value: JSON.stringify(session),
              },
            ],
          },
        ],
      }),
    );
  console.log(
    'PASS: real friend RPCs, separate accounts/devices, exact codes, reciprocal requests, retries, simultaneous sends, block-vs-accept race, mutual blocks, private lists, unchanged table rights and atomic rate limits.',
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
