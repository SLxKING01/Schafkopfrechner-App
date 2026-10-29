// Run from the repository root: node scripts/audit-design-system.cjs
// These searches identify review candidates, not automatically visual defects.
const fs = require('node:fs');
const path = require('node:path');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const files = walk('src').filter(
  (file) =>
    /\.tsx?$/.test(file) &&
    !file.includes('__tests__') &&
    !file.startsWith(path.join('src', 'theme')) &&
    file !== path.join('src', 'constants', 'theme.ts'),
);
const checks = {
  colors: /#[0-9a-fA-F]{3,8}\b/,
  typography: /fontSize:\s*\d/,
  radius: /borderRadius:\s*\d/,
  legacyShadows: /shadow(Color|Offset|Opacity|Radius):|elevation:/,
  spacing: /(?:padding|margin|gap)[A-Za-z]*:\s*(\d+)/g,
};
const spacingSteps = [0, 4, 8, 12, 16, 20, 24, 32, 44];
const rows = files.map((file) => {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const counts = Object.fromEntries(
    Object.entries(checks).map(([category, pattern]) => [
      category,
      lines.filter((line) =>
        category === 'spacing'
          ? [...line.matchAll(pattern)].some(
              (match) => !spacingSteps.includes(Number(match[1])),
            )
          : pattern.test(line),
      ).length,
    ]),
  );
  return { file, sloc: lines.length, ...counts };
});
const sloc = rows.reduce((total, row) => total + row.sloc, 0);
const totals = Object.fromEntries(
  Object.keys(checks).map((category) => {
    const hits = rows.reduce((total, row) => total + row[category], 0);
    return [
      category,
      {
        hits,
        per100Lines: Number(((100 * hits) / sloc).toFixed(2)),
        worst: rows
          .filter((row) => row[category])
          .sort((a, b) => b[category] - a[category])
          .slice(0, 4)
          .map((row) => ({ file: row.file, hits: row[category] })),
      },
    ];
  }),
);
console.log(JSON.stringify({ files: files.length, sloc, totals }, null, 2));
