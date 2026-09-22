/**
 * NOVAADMIN — class inventory pre-flight
 * ------------------------------------------------------------------
 * Collects every class name used inside `class="…"` template strings in a set
 * of source files and checks it against the classes the stylesheets define
 * (SCSS sources + Bootstrap). Fast feedback while writing a page, so the full
 * `qa:links` run is the confirmation rather than the discovery.
 *
 *   node tools/qa-classes.mjs src/js/pages/ui-kit.js [more files…]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const cssSources = [
  ...walk(path.join(ROOT, 'src/scss'), (name) => name.endsWith('.scss')),
  path.join(ROOT, 'node_modules/bootstrap/dist/css/bootstrap.css'),
  path.join(ROOT, 'node_modules/bootstrap-icons/font/bootstrap-icons.css'),
];
const defined = new Set();
for (const file of cssSources) {
  if (!fs.existsSync(file)) continue;
  const css = stripComments(fs.readFileSync(file, 'utf8'));
  for (const match of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(match[1]);
}
// utility patterns Bootstrap builds dynamically in the class attribute are all
// covered above; anything ending in `-` is a dynamic template prefix.
const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node tools/qa-classes.mjs <file.js> [more…]');
  process.exit(2);
}
const missing = new Map();
for (const file of files) {
  const source = fs.readFileSync(path.resolve(ROOT, file), 'utf8');
  for (const match of source.matchAll(/class=\\?["'`]([^"'`$]*)/g)) {
    for (const name of match[1].split(/\s+/).filter(Boolean)) {
      if (/[^\w-]/.test(name) || name.endsWith('-')) continue;
      if (defined.has(name)) continue;
      missing.set(name, (missing.get(name) ?? 0) + 1);
    }
  }
}
const names = [...missing.keys()].sort();
if (names.length) {
  console.log(`✖ ${names.length} classes have no rule in the stylesheets:`);
  for (const name of names) console.log(`    · ${name} (${missing.get(name)}×)`);
  process.exit(1);
}
console.log(`✔ every class used in ${files.length} file(s) is defined (${defined.size} known classes)`);
