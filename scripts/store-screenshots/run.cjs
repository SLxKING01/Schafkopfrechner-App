// Regenerates the store screenshots from the web build with a sample evening.
// 1) Start the web app:  CI=1 npx expo start --web --port 8099
// 2) Then run:            node scripts/store-screenshots/run.cjs
// Needs Playwright with Chromium. Output: store-screenshots/apple-6.9 and google-phone.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
for (const step of ['final.cjs', 'rules.cjs', 'frame.cjs'])
  execFileSync(
    process.execPath,
    [path.join('scripts/store-screenshots', step)],
    {
      stdio: 'inherit',
    },
  );
