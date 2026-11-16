// Startet die Web-Version der App mit einer Schein-Supabase-Adresse, erzeugt die
// Screenshots und beendet den Server wieder. Die echte `.env.local` wird nicht
// gelesen (EXPO_NO_DOTENV), es geht also nichts an den echten Server.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
const port = process.env.PROMO_PORT ?? '8090';
const base = `http://localhost:${port}`;
const bundle = `${base}/promo/capture/entry.bundle?platform=web&dev=false&minify=false`;

const expo = spawn('npx', ['expo', 'start', '--web', '--localhost', '--port', port], {
  cwd: appRoot,
  detached: true,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {
    ...process.env,
    CI: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_OFFLINE: '1',
    EXPO_PUBLIC_SUPABASE_URL: 'https://promo-mock.invalid',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'promo-mock-key',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
  },
});
const stop = () => {
  try {
    process.kill(-expo.pid);
  } catch {
    /* schon beendet */
  }
};
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

async function waitForBundle() {
  const deadline = Date.now() + 5 * 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(bundle);
      if (response.ok) {
        const code = await response.text();
        if (!code.includes('promo-mock.invalid'))
          throw new Error('Das Bundle enthält nicht die Schein-Adresse. Abbruch, damit nichts an den echten Server geht.');
        return;
      }
    } catch (error) {
      if (String(error.message).includes('Abbruch')) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Expo-Webserver nicht erreichbar.');
}

console.log('Starte Expo-Webserver (Schein-Backend) …');
await waitForBundle();
process.env.PROMO_BASE = base;
await import('./capture.mjs');
stop();
