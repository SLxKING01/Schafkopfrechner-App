// Authenticated transport test. Requires temporary QA accounts provisioned by an
// administrator; never calls signup or sends email. Credentials stay in ignored output/.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const fixture = JSON.parse(
    fs.readFileSync('output/qa/shared-live-credentials.json', 'utf8'),
  );
  const env = Object.fromEntries(
    fs
      .readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const i = line.indexOf('=');
        return [
          line.slice(0, i),
          line
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  assert.equal(new URL(url).hostname, 'jujvkphobubxmylekkvd.supabase.co');
  const key =
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const clients = fixture.users.map(() =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  const call = async (client, action, payload, version = 0) => {
    console.log(`Checking RPC ${action}, version ${version}`);
    const result = await client
      .rpc('sk_live_command', {
        p_action: action,
        p_table_id: fixture.tableId,
        p_payload: payload,
        p_version: version,
      })
      .abortSignal(AbortSignal.timeout(15000));
    if (result.error)
      throw Object.assign(new Error(result.error.message), {
        code: result.error.code,
      });
    return result.data;
  };
  let channel;
  try {
    for (let i = 0; i < clients.length; i++) {
      const result = await clients[i].auth.signInWithPassword(fixture.users[i]);
      if (result.error)
        throw new Error(`QA sign-in failed: ${result.error.message}`);
      assert.equal(result.data.user.id, fixture.users[i].id);
      await clients[i].realtime.setAuth(result.data.session.access_token);
    }
    const [owner, writer, outsider] = clients;
    const payload = {
      currentTable: {
        id: fixture.tableId,
        name: 'Temporary live verification',
        isActive: true,
      },
      players: fixture.users.slice(0, 2).map((u, i) => ({
        id: `qa-seat-${i}`,
        userId: u.id,
        name: `QA ${i}`,
        isLocal: false,
      })),
      rounds: [],
      balances: [],
      settlements: [],
      activeGame: true,
    };
    let remote = await call(owner, 'create', payload);
    assert.equal(remote.ownerId, fixture.users[0].id);
    assert.equal((await call(writer, 'read')).role, 'read');
    await assert.rejects(call(writer, 'save', payload, remote.version), {
      code: '42501',
    });
    await assert.rejects(call(outsider, 'read'), { code: '42501' });
    const discovery = await outsider
      .from('sk_live_tables')
      .select('id')
      .eq('id', fixture.tableId);
    assert.ifError(discovery.error);
    assert.equal(discovery.data.length, 0);
    const directory = await owner.rpc('sk_player_accounts', { p_query: '' });
    assert.ifError(directory.error);
    assert.equal(directory.data[0].id, fixture.users[0].id);
    console.log(
      'PASS: separate sign-ins, reader restrictions, outsider RLS and account lookup.',
    );

    let observed = false;
    let resolveChange;
    const change = new Promise((resolve) => {
      resolveChange = resolve;
    });
    channel = writer.channel(`qa-role-live:${fixture.tableId}`).on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sk_live_tables',
        filter: `id=eq.${fixture.tableId}`,
      },
      () => {
        observed = true;
        resolveChange();
      },
    );
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Realtime subscription timed out')),
        20000,
      );
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        }
        if (status === 'CHANNEL_ERROR') {
          clearTimeout(timer);
          reject(new Error('Realtime subscription failed'));
        }
      });
    });
    remote = await call(
      owner,
      'set_role',
      { userId: fixture.users[1].id, role: 'write' },
      remote.version,
    );
    let timer;
    await Promise.race([
      change,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Authorized realtime change did not arrive')),
          20000,
        );
      }),
    ]).finally(() => clearTimeout(timer));
    assert.equal(observed, true);
    const base = await call(writer, 'read');
    assert.equal(base.role, 'write');
    const roundA = {
      id: randomUUID(),
      tableId: fixture.tableId,
      createdAt: '2026-11-02T10:00:00Z',
      amount: 0.4,
    };
    const roundB = {
      id: randomUUID(),
      tableId: fixture.tableId,
      createdAt: '2026-11-01T10:00:00Z',
      amount: 0.4,
    };
    const withA = { ...payload, rounds: [roundA] };
    remote = await call(owner, 'save', withA, base.version);
    await assert.rejects(
      call(writer, 'save', { ...payload, rounds: [roundB] }, base.version),
      { code: 'PT409' },
    );
    const reread = await call(writer, 'read');
    const both = {
      ...reread.payload,
      rounds: [...reread.payload.rounds, roundB],
    };
    remote = await call(writer, 'save', both, reread.version);
    remote = await call(writer, 'save', both, remote.version);
    assert.deepEqual(
      remote.payload.rounds.map((r) => r.id),
      [roundA.id, roundB.id],
    );
    await assert.rejects(
      call(
        writer,
        'save',
        {
          ...both,
          currentTable: { ...both.currentTable, name: 'Forbidden rule change' },
        },
        remote.version,
      ),
      { code: '42501' },
    );
    // Deletion and restoration keep the original identity and list position.
    remote = await call(
      writer,
      'save',
      { ...both, rounds: [roundB] },
      remote.version,
    );
    remote = await call(writer, 'save', both, remote.version);
    const beforeDowngrade = remote.version;
    remote = await call(
      owner,
      'set_role',
      { userId: fixture.users[1].id, role: 'read' },
      remote.version,
    );
    await assert.rejects(call(writer, 'save', both, beforeDowngrade), {
      code: '42501',
    });
    assert.equal((await call(writer, 'read')).role, 'read');
    console.log(
      'PASS: three separate sign-ins, reader/writer/owner RPC and RLS, authorized Realtime, conflicting appends, idempotent retry, delete/restore and write revocation.',
    );
  } finally {
    if (channel) await clients[1].removeChannel(channel);
    for (const client of clients) {
      client.realtime.disconnect();
      await client.auth.signOut({ scope: 'local' });
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
