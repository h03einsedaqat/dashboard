/**
 * NOVAADMIN — post-build layout fixer
 * ------------------------------------------------------------------
 * Vite derives the output path of an HTML entry from its location inside the
 * project (`src/pages/dashboards/analytics.html`). A template, however, must
 * ship as `dist/dashboards/analytics.html` so the URLs match the source tree
 * on any static host.
 *
 * This script moves every built page up two levels (the `src/pages` prefix)
 * and rewrites the *relative* asset URLs inside it accordingly — relative
 * links, not absolute ones, which is what keeps the package portable
 * (`base: './'`, deployable in a sub-folder).
 *
 *   node tools/flatten-dist.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SOURCE = path.join(DIST, 'src', 'pages');

if (!fs.existsSync(SOURCE)) {
  console.log('• dist/src/pages not found — nothing to flatten (already flat?)');
  process.exit(0);
}

/** Files whose URLs need two `../` segments removed after the move. */
const REWRITE = /((?:src|href|data-src|poster)=")(?:\.\.\/){2}/g;

let moved = 0;
let rewritten = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs);
      continue;
    }
    if (!entry.name.endsWith('.html')) continue;

    const relative = path.relative(SOURCE, abs);
    const target = path.join(DIST, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    const html = fs.readFileSync(abs, 'utf8');
    const fixed = html.replace(REWRITE, '$1');
    if (fixed !== html) rewritten += 1;
    fs.writeFileSync(target, fixed);
    fs.rmSync(abs);
    moved += 1;
  }
}

walk(SOURCE);

/** Removes directories that are now empty (`dist/src/pages`, `dist/src`, …). */
function prune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) prune(path.join(dir, entry.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

prune(path.join(DIST, 'src'));

console.log(`✔ flattened ${moved} pages to the dist root (${rewritten} had relative URLs rewritten)`);
