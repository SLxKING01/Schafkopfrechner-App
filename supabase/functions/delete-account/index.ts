import { createClient } from '@supabase/supabase-js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function respond(status: number) {
  return new Response(null, { status, headers: cors });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return respond(204);
  if (request.method !== 'POST') return respond(405);

  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return respond(401);
  const body = await request.json().catch(() => null);
  if (body?.confirm !== true) return respond(400);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError?.status === 429) return respond(429);
    if (authError && (!authError.status || authError.status >= 500)) {
      return respond(503);
    }
    if (!user || user.is_anonymous) return respond(401);

    const photos = admin.storage.from('profile-photos');
    const limit = 100;
    // Each batch starts at the beginning because the previous files are gone.
    for (let batch = 0; batch < 20; batch++) {
      const { data: files, error: listError } = await photos.list(user.id, {
        limit,
      });
      if (listError) throw listError;
      if (!files.length) {
        const { error } = await admin.auth.admin.deleteUser(user.id);
        if (error && error.code !== 'user_not_found') throw error;
        return respond(204);
      }
      const { error } = await photos.remove(
        files.map(({ name }) => `${user.id}/${name}`),
      );
      if (error) throw error;
    }
    return respond(503);
  } catch (error) {
    // Keep tokens, email addresses and file paths out of function logs.
    console.error(
      'Account deletion failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return respond(503);
  }
});
