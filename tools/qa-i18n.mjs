/**
 * NOVAADMIN — copy / translation audit
 * ------------------------------------------------------------------
 * "Some texts are missing" is the kind of bug that is invisible in a build
 * log: the markup ships a `data-i18n` hook, the dictionary has no value, and
 * the element silently keeps whatever was written in the HTML (or stays empty
 * when the hook is filled at runtime). This tool reads every hook in the
 * template and every `t('…')` call in the controllers, resolves each key
 * against all three dictionaries and reports the gaps.
 *
 *   npm run qa:i18n
 *   npm run qa:i18n -- --verbose
 *
 * Exit code 0 = every used key resolves, 1 = at least one gap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');
const show = (...args) => VERBOSE && console.log(...args);

const { LOCALES, getLocale } = await import(path.join(ROOT, 'src/locales/index.js'));

const LANGS = Object.keys(LOCALES);

/* ------------------------------------------------------------- key inventory */

const used = new Map(); // key → { count, sources:Set }

const add = (key, file, line = '') => {
  // Dynamic keys built at runtime (`data-i18n="language.${code}"`) and hooks
  // written inside documentation code samples are not real lookups.
  if (!key || key.includes('${') || key.endsWith('.') || /[^A-Za-z0-9._-]/.test(key)) return;
  const entry = used.get(key) ?? { count: 0, sources: new Set(), sample: '' };
  entry.count += 1;
  entry.sources.add(path.relative(ROOT, file));
  if (!entry.sample) entry.sample = line.trim().slice(0, 90);
  used.set(key, entry);
};

function scan(file) {
  // Documentation pages embed code samples that legitimately contain hooks;
  // they are escaped text, not markup, so they must not be audited.
  const text = fs
    .readFileSync(file, 'utf8')
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ');
  const lines = text.split('\n');

  lines.forEach((line) => {
    // data-i18n / data-i18n-title / data-i18n-placeholder / data-i18n-aria …
    for (const match of line.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
      // `data-i18n-ready` is a boot flag on <html>, not a lookup key.
      if (/data-i18n-ready=/.test(match[0])) continue;
      add(match[1], file, line);
    }
    // t('key') and t("key")
    for (const match of line.matchAll(/\bt\(\s*['"]([A-Za-z][\w.]*)['"]/g)) add(match[1], file, line);
    // dictionary lookups used by components (`dict().table.x` is not a hook; only string keys count)
    for (const match of line.matchAll(/\bi18n\(\s*['"]([A-Za-z][\w.]*)['"]/g)) add(match[1], file, line);
  });
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['data', 'locales'].includes(entry.name) && dir.endsWith('src')) continue;
      walk(full);
      continue;
    }
    if (/\.(?:html|js)$/.test(entry.name)) scan(full);
  }
}

walk(path.join(ROOT, 'src'));
if (fs.existsSync(path.join(ROOT, 'index.html'))) scan(path.join(ROOT, 'index.html'));

/* ----------------------------------------------------------------- coverage */

const report = Object.fromEntries(LANGS.map((lang) => [lang, []]));

for (const [key] of used) {
  for (const lang of LANGS) {
    const value = getLocale(lang);
    const resolved =
      typeof value[key] === 'string'
        ? value[key]
        : String(key)
            .split('.')
            .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), value);
    if (typeof resolved !== 'string' || !resolved.trim()) report[lang].push(key);
  }
}

/* ------------------------------------------------------------------- report */

console.log('');
console.log(`  keys used      ${used.size}`);
for (const lang of LANGS) {
  console.log(`  ${lang} missing     ${report[lang].length}`);
}

let failed = false;
for (const lang of LANGS) {
  if (!report[lang].length) continue;
  failed = true;
  console.log('');
  console.log(`  ✖ ${report[lang].length} keys have no "${lang}" copy:`);
  for (const key of report[lang].slice(0, VERBOSE ? 400 : 25)) {
    const entry = used.get(key);
    console.log(`    · ${key}  (${entry.count}× · ${[...entry.sources].slice(0, 2).join(', ')})`);
  }
  if (!VERBOSE && report[lang].length > 25) {
    console.log(`    … ${report[lang].length - 25} more (run with --verbose to list all)`);
  }
}

if (failed) {
  console.log('');
  console.log('  Fix: add the missing keys to src/locales/<lang>.js (or to');
  console.log('  src/locales/chrome.js for shell strings used by the page generator).');
  process.exit(1);
}

show(`checked ${used.size} keys across ${LANGS.length} locales`);
console.log('');
console.log('✔ copy audit passed — every translation hook resolves in all three languages.');
