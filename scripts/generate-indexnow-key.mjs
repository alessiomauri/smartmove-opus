/**
 * Build-time IndexNow key-file generator.
 *
 * IndexNow proves URL ownership by fetching https://host/{key}.txt and
 * expecting the key as its body. The key lives in the INDEXNOW_KEY env
 * var (Vercel build env), so the file can't be committed — this script
 * writes it into public/ before `next build` (see package.json).
 *
 * No key set → no file, and src/lib/indexnow.ts no-ops at runtime.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const key = process.env.INDEXNOW_KEY;
if (!key) {
  console.log('[indexnow] INDEXNOW_KEY not set — skipping key file');
  process.exit(0);
}
if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
  console.error('[indexnow] INDEXNOW_KEY must be 8-128 chars of [a-zA-Z0-9-]');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, `../public/${key}.txt`);
await writeFile(target, key, 'utf8');
console.log(`[indexnow] wrote public/${key}.txt`);
