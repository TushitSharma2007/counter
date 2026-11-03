// Fails the build if the card page's first-route JS exceeds the budget (CLAUDE.md §8).
// Counts the entry chunk, everything it imports statically, and the card route's split chunks.
// Lazy-loaded chunks (QR scanner, redeem screen, merchant console) are not counted.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 120 * 1024;
const FIRST_ROUTE_SOURCES = ['src/routes/c.$merchantSlug.tsx'];
const dist = new URL('../dist/', import.meta.url);

/** @type {Record<string, { file: string; src?: string; isEntry?: boolean; imports?: string[] }>} */
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'));

const roots = Object.entries(manifest)
  .filter(([key, chunk]) => chunk.isEntry || FIRST_ROUTE_SOURCES.some((src) => key.startsWith(src)))
  .map(([key]) => key);

const seen = new Set();
const visit = (key) => {
  if (seen.has(key)) return;
  seen.add(key);
  for (const dep of manifest[key]?.imports ?? []) visit(dep);
};
roots.forEach(visit);

let total = 0;
for (const key of seen) {
  const { file } = manifest[key];
  if (!file.endsWith('.js')) continue;
  const size = gzipSync(readFileSync(new URL(file, dist))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}

const kb = (total / 1024).toFixed(1);
if (total > BUDGET_BYTES) {
  console.error(`First-route JS is ${kb} KB gzipped, over the ${BUDGET_BYTES / 1024} KB budget.`);
  process.exit(1);
}
console.log(`First-route JS: ${kb} KB gzipped (budget ${BUDGET_BYTES / 1024} KB).`);
