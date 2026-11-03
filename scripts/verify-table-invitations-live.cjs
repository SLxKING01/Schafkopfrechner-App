// Uses disposable confirmed QA accounts; never invokes signup or sends email.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const fixturePath = 'output/qa/invitations-live-credentials.json';
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
if (process.argv.includes('--prepare')) {
  if (fs.existsSync(fixturePath))
    throw Error('Existing QA fixture; finish cleanup first.');
  const users = ['A', 'B', 'C'].map((name) => ({
    id: randomUUID(),
    email: `qa-invitations-${randomUUID()}@example.invalid`,
    password: randomBytes(24).toString('hex'),
    name: `Einladungen QA ${name}`,
  }));
  const fixture = {
    users,
    tableId: randomUUID(),
    seatId: randomUUID(),
    secondSeatId: randomUUID(),
  };
  fs.mkdirSync('output/qa', { recursive: true });
  fs.writeFileSync(fixturePath, JSON.stringify(fixture));
  const sql = users
    .map(
      (
        u,
      ) => `insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values('00000000-0000-0000-0000-000000000000',${quote(u.id)},'authenticated','authenticated',${quote(u.email)},extensions.crypt(${quote(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',${quote(JSON.stringify({ username: u.name }))}::jsonb,now(),now(),'','','','');
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at) values(gen_random_uuid(),${quote(u.id)},${quote(u.id)},${quote(JSON.stringify({ sub: u.id, email: u.email, email_verified: true }))}::jsonb,'email',now(),now());`,
    )
    .join('\n');
  const [a, b, c] = users.map((u) => quote(u.id));
  fs.writeFileSync(
    'output/qa/invitations-live-seed.sql',
    `begin;\n${sql}\nupdate private.sk_profiles set setup_completed=true where user_id in (${a},${b},${c});\ninsert into private.sk_friend_pairs(low_id,high_id,state,version) values(least(${a}::uuid,${b}::uuid),greatest(${a}::uuid,${b}::uuid),'friends',1),(least(${a}::uuid,${c}::uuid),greatest(${a}::uuid,${c}::uuid),'friends',1);\ncommit;`,
  );
  fs.writeFileSync(
    'output/qa/invitations-live-cleanup.sql',
    `begin; delete from public.sk_live_tables where owner_id in (${a},${b},${c}); delete from auth.users where id in (${a},${b},${c}); commit;`,
  );
  console.log('Prepared isolated QA fixture and seed SQL.');
} else {
  (async () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
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
    const clients = fixture.users.map(() =>
      createClient(
        env.EXPO_PUBLIC_SUPABASE_URL,
        env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      ),
    );
    const revoke = process.argv.includes('--revoke-sessions');
    for (let n = 0; n < clients.length; n++) {
      const { data, error } = await clients[n].auth.signInWithPassword(
        fixture.users[n],
      );
      assert.ifError(error);
      if (revoke) {
        const result = await clients[n].auth.signOut({ scope: 'global' });
        assert.ifError(result.error);
        continue;
      }
      if (n < 2)
        fs.writeFileSync(
          `output/qa/invitations-${n === 0 ? 'a' : 'b'}-browser-state.json`,
          JSON.stringify({
            cookies: [],
            origins: [
              {
                origin: 'http://localhost:8081',
                localStorage: [
                  {
                    name: 'sb-jujvkphobubxmylekkvd-auth-token',
                    value: JSON.stringify(data.session),
                  },
                ],
              },
            ],
          }),
        );
    }
    if (revoke) {
      console.log('Revoked the disposable QA sessions.');
      return;
    }
    const [a, b, c] = clients;
    const [aid, bid, cid] = fixture.users.map((u) => u.id);
    const rpc = async (client, name, args) => {
      const { data, error } = await client
        .rpc(name, args)
        .abortSignal(AbortSignal.timeout(15000));
      if (error)
        throw Object.assign(Error(error.message), { code: error.code });
      return data;
    };
    const command = (client, actor, action, id, extra = {}) =>
      rpc(client, 'sk_table_invitation_command', {
        p_user_id: actor,
        p_action: action,
        p_id: id,
        ...extra,
      });
    const list = (client, actor) =>
      rpc(client, 'sk_table_invitations_list', { p_user_id: actor });
    // Load pure project constants for a snapshot accepted by the application.
    const ts = require('typescript');
    require.extensions['.ts'] = (module, filename) =>
      module._compile(
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
        filename,
      );
    const {
      createDefaultTableSettings,
    } = require('../src/constants/tableSettings.ts');
    const players = [
      {
        id: randomUUID(),
        name: 'Einladungen QA A',
        userId: aid,
        isLocal: false,
      },
      { id: fixture.seatId, name: 'Lokaler Mitspieler B', isLocal: true },
      { id: fixture.secondSeatId, name: 'Lokaler Mitspieler C', isLocal: true },
    ];
    const snapshot = {
      currentTable: {
        id: fixture.tableId,
        hashCode: 'QA',
        name: 'Einladungen Live QA',
        createdAt: new Date().toISOString(),
        isActive: true,
        settings: createDefaultTableSettings(),
        dealerId: players[0].id,
      },
      players,
      rounds: [],
      balances: players.map((p) => ({ playerId: p.id, amount: 0 })),
      settlements: [],
      activeGame: true,
    };
    let remote = await rpc(a, 'sk_live_command', {
      p_action: 'create',
      p_table_id: fixture.tableId,
      p_payload: snapshot,
      p_version: 0,
    });
    const args = {
      p_table_id: fixture.tableId,
      p_recipient: bid,
      p_player_id: fixture.seatId,
      p_role: 'write',
      p_version: remote.version,
    };
    const iid = randomUUID();
    assert.equal((await command(a, aid, 'send', iid, args)).ok, true);
    assert.equal(
      (await command(a, aid, 'send', iid, args)).state.invitations.length,
      1,
    );
    await assert.rejects(
      rpc(b, 'sk_live_command', {
        p_action: 'read',
        p_table_id: fixture.tableId,
      }),
      (e) => e.code === '42501',
    );
    await assert.rejects(
      command(c, cid, 'accept', iid),
      (e) => e.code === '42501',
    );
    await assert.rejects(list(a, bid), (e) => e.code === '42501');
    assert.equal((await list(c, cid)).invitations.length, 0);
    const race = await Promise.all([
      command(b, bid, 'accept', iid),
      command(b, bid, 'accept', iid),
    ]);
    assert.ok(race.every((r) => r.ok));
    remote = await rpc(b, 'sk_live_command', {
      p_action: 'read',
      p_table_id: fixture.tableId,
    });
    assert.equal(remote.role, 'write');
    assert.equal(remote.version, 2);
    assert.equal(remote.payload.players[1].userId, bid);
    assert.deepEqual(remote.payload.balances, snapshot.balances);
    const discovery = await b
      .from('sk_live_tables')
      .select('id')
      .eq('id', fixture.tableId);
    assert.ifError(discovery.error);
    assert.equal(discovery.data.length, 1);
    // Revoke through the existing owner path, then retry the old acceptance.
    const unlinked = JSON.parse(JSON.stringify(remote.payload));
    delete unlinked.players[1].userId;
    unlinked.players[1].isLocal = true;
    remote = await rpc(a, 'sk_live_command', {
      p_action: 'save',
      p_table_id: fixture.tableId,
      p_payload: unlinked,
      p_version: remote.version,
    });
    await command(b, bid, 'accept', iid);
    await assert.rejects(
      rpc(b, 'sk_live_command', {
        p_action: 'read',
        p_table_id: fixture.tableId,
      }),
      (e) => e.code === '42501',
    );
    await assert.rejects(
      rpc(a, 'sk_live_command', {
        p_action: 'save',
        p_table_id: fixture.tableId,
        p_payload: {
          ...unlinked,
          players: unlinked.players.map((p, n) =>
            n === 1 ? { ...p, userId: bid } : p,
          ),
        },
        p_version: remote.version,
      }),
      (e) => e.code === '42501',
    );
    // Two concurrent sends for the same seat: exactly one invitation.
    const sends = await Promise.all([
      command(a, aid, 'send', randomUUID(), {
        ...args,
        p_version: remote.version,
      }),
      command(a, aid, 'send', randomUUID(), {
        ...args,
        p_version: remote.version,
        p_recipient: cid,
      }),
    ]);
    assert.equal(sends.filter((r) => r.ok).length, 1);
    assert.equal(sends.filter((r) => r.code === 'PENDING').length, 1);
    const winner = (await list(a, aid)).invitations[0];
    const index = winner.recipient.id === bid ? 1 : 2;
    const cancelRace = await Promise.all([
      command(a, aid, 'cancel', winner.id),
      command(clients[index], fixture.users[index].id, 'accept', winner.id),
    ]);
    const latest = await rpc(a, 'sk_live_command', {
      p_action: 'read',
      p_table_id: fixture.tableId,
    });
    const linked = latest.payload.players.some(
      (p) => p.userId === winner.recipient.id,
    );
    assert.equal(linked, cancelRace[1].ok);
    // Reset only this QA table for the subsequent UI flow.
    const reset = JSON.parse(JSON.stringify(latest.payload));
    for (const p of reset.players)
      if (p.userId !== aid) {
        delete p.userId;
        p.isLocal = true;
      }
    if (linked)
      await rpc(a, 'sk_live_command', {
        p_action: 'save',
        p_table_id: fixture.tableId,
        p_payload: reset,
        p_version: latest.version,
      });
    for (const i of (await list(a, aid)).invitations)
      await command(a, aid, 'cancel', i.id);
    console.log(
      'PASS: live actor isolation, no premature access, duplicate acceptance, preserved seat/balances, discovery, old retry after revocation, legacy bypass denied, concurrent sends and cancellation vs acceptance. UI fixture ready.',
    );
  })().catch((e) => {
    console.error(e.message, e.code);
    process.exitCode = 1;
  });
}
