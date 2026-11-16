// Attrappe für das Supabase-Backend. Läuft ausschließlich im Aufnahme-Prozess:
// Playwright fängt jede Anfrage ab, beantwortet Supabase-Aufrufe aus dem
// Arbeitsspeicher und blockiert alles, was nicht localhost ist.
export const MOCK_HOST = 'promo-mock.invalid';

const b64 = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export function createBackend({ users, now }) {
  const tables = new Map();
  const gameStates = new Map();
  const blocked = [];
  const unhandled = [];
  const card = (user) => ({
    id: user.id,
    displayName: user.name,
    avatarKind: 'animal',
    animalId: user.animalId,
    accentId: user.accentId,
    photoPath: null,
    version: 1,
  });
  const remoteFor = (row, actor) => ({
    id: row.id,
    payload: row.payload,
    version: row.version,
    updatedAt: row.updatedAt,
    ownerId: row.ownerId,
    code: row.code,
    members: row.members,
    role:
      row.ownerId === actor
        ? 'write'
        : (row.members.find((m) => m.userId === actor)?.role ?? 'read'),
  });
  const membersOf = (payload, ownerId) =>
    payload.players
      .filter((p) => p.userId && p.userId !== ownerId)
      .map((p) => ({ userId: p.userId, role: 'write' }));

  function rpc(name, body, actor) {
    const user = users.find((u) => u.id === actor);
    switch (name) {
      case 'sk_live_command': {
        const id = body.p_table_id;
        const row = tables.get(id);
        if (body.p_action === 'create') {
          if (row) return { status: 409, error: { code: 'PT409', message: 'exists' } };
          const created = {
            id,
            payload: body.p_payload,
            version: 1,
            updatedAt: now().toISOString(),
            ownerId: actor,
            code: 'PROMO1',
            members: membersOf(body.p_payload, actor),
          };
          tables.set(id, created);
          return { data: remoteFor(created, actor) };
        }
        if (!row) return { status: 404, error: { code: 'PT404', message: 'Tisch nicht gefunden.' } };
        if (body.p_action === 'read') return { data: remoteFor(row, actor) };
        if (body.p_action === 'save') {
          if (body.p_version !== row.version)
            return { status: 409, error: { code: 'PT409', message: 'Version' } };
          row.payload = body.p_payload;
          row.version += 1;
          row.updatedAt = now().toISOString();
          row.members = membersOf(row.payload, row.ownerId);
          return { data: remoteFor(row, actor) };
        }
        return { status: 400, error: { code: 'PT400', message: 'Aktion' } };
      }
      case 'save_game_state': {
        const saved = {
          payload: body.p_payload,
          version: (body.p_expected_version ?? 0) + 1,
          updated_at: now().toISOString(),
        };
        gameStates.set(actor, saved);
        return { data: [{ version: saved.version, updated_at: saved.updated_at }] };
      }
      case 'sk_profile_own':
        return {
          data: {
            ...card(user),
            firstName: user.name,
            lastName: user.lastName,
            birthDate: null,
            setupCompleted: true,
            updatedAt: '2026-09-01T10:00:00.000Z',
          },
        };
      case 'sk_profile_cards':
        return { data: users.filter((u) => (body.p_ids ?? []).includes(u.id)).map(card) };
      case 'sk_friends_state':
        return {
          data: {
            userId: actor,
            version: 1,
            code: user.friendCode,
            friends: users
              .filter((u) => u.id !== actor)
              .map((u) => ({ profile: card(u), pairVersion: 1, requestId: null, blockId: null })),
            incoming: [],
            outgoing: [],
            blocked: [],
          },
        };
      case 'sk_table_invitations_list':
        return { data: { userId: actor, invitations: [] } };
      default:
        return null;
    }
  }

  async function handle(route, actor) {
    const request = route.request();
    const url = new URL(request.url());
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue();
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (url.hostname !== MOCK_HOST) {
      blocked.push(request.url());
      return route.abort();
    }
    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
        body: JSON.stringify(data),
      });
    if (request.method() === 'OPTIONS') return json({});
    const path = url.pathname;
    const body = request.postDataJSON?.() ?? {};
    if (path.startsWith('/rest/v1/rpc/')) {
      const result = rpc(path.split('/').pop(), body, actor);
      if (result?.error) return json(result.error, result.status);
      if (result) return json(result.data);
    }
    if (path === '/rest/v1/sk_live_tables')
      return json(
        [...tables.values()]
          .filter((row) => row.ownerId === actor || row.members.some((m) => m.userId === actor))
          .map((row) => ({
            id: row.id,
            payload: row.payload,
            version: row.version,
            updated_at: row.updatedAt,
            owner_id: row.ownerId,
            sk_live_members: [{ role: 'write' }],
          })),
      );
    if (path === '/rest/v1/game_states')
      return json(gameStates.has(actor) ? [gameStates.get(actor)] : []);
    if (path.startsWith('/storage/v1/object/list/')) return json([]);
    if (path === '/auth/v1/user') return json(sessionFor(users.find((u) => u.id === actor)).user);
    unhandled.push(`${request.method()} ${path} ${JSON.stringify(body).slice(0, 200)}`);
    return json({ message: 'promo mock: not implemented', code: 'PROMO' }, 404);
  }

  function sessionFor(user) {
    const expiresAt = Math.floor(now().getTime() / 1000) + 10 * 365 * 24 * 3600;
    const userObject = {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${user.name.toLowerCase()}@example.com`,
      email_confirmed_at: '2026-09-01T10:00:00.000Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { username: user.name },
      created_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-01T10:00:00.000Z',
    };
    return {
      access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp: expiresAt })}.promo`,
      refresh_token: 'promo-refresh',
      token_type: 'bearer',
      expires_in: 10 * 365 * 24 * 3600,
      expires_at: expiresAt,
      user: userObject,
    };
  }

  /** Bindet die Attrappe an einen Browser-Kontext, der als `user` angemeldet ist. */
  async function attach(context, user) {
    await context.route('**/*', (route) => handle(route, user.id));
    await context.routeWebSocket(/.*/, (ws) => {
      if (!new URL(ws.url()).hostname.includes(MOCK_HOST)) {
        // Metro/HMR und alles andere: nicht verbinden.
        ws.close();
        return;
      }
      ws.onMessage((raw) => {
        let message;
        try {
          message = JSON.parse(raw);
        } catch {
          return;
        }
        const array = Array.isArray(message);
        const [joinRef, ref, topic, event, payload] = array
          ? message
          : [message.join_ref, message.ref, message.topic, message.event, message.payload];
        if (event !== 'phx_join' && event !== 'heartbeat' && event !== 'phx_leave' && event !== 'access_token') return;
        if (event === 'access_token') return;
        const response =
          event === 'phx_join'
            ? { postgres_changes: (payload?.config?.postgres_changes ?? []).map((c, i) => ({ ...c, id: i + 1 })) }
            : {};
        const reply = { status: 'ok', response };
        ws.send(
          JSON.stringify(
            array
              ? [joinRef, ref, topic, 'phx_reply', reply]
              : { topic, event: 'phx_reply', payload: reply, ref, join_ref: joinRef },
          ),
        );
      });
    });
    await context.addInitScript(
      ({ key, session }) => {
        if (!window.localStorage.getItem(key))
          window.localStorage.setItem(key, JSON.stringify(session));
      },
      { key: 'sb-promo-mock-auth-token', session: sessionFor(user) },
    );
  }

  const dump = () => ({ tables: [...tables.values()], gameStates: [...gameStates] });
  const restore = (data) => {
    data.tables.forEach((row) => tables.set(row.id, row));
    data.gameStates.forEach(([owner, row]) => gameStates.set(owner, row));
  };
  return { attach, tables, blocked, unhandled, dump, restore };
}
