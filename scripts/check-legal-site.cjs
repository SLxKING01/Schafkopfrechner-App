// Fails while placeholders are left in the legal pages, so none get published.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(process.cwd(), 'legal-site');
let open = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const match of html.matchAll(/<mark class="todo">(.*?)<\/mark>/g)) {
    open += 1;
    console.log(`${file}: ${match[1]}`);
  }
}
if (open) {
  console.error(`${open} Platzhalter offen.`);
  process.exitCode = 1;
} else console.log('Keine Platzhalter offen.');
