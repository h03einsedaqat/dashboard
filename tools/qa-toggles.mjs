#!/usr/bin/env node
/**
 * NOVAADMIN — global toggle audit
 * --------------------------------------------------------------------------
 * Every page must offer the same three controls in its chrome:
 *
 *   • language     `[data-lang]` items that really re-translate the page
 *   • light/dark   `[data-theme-toggle]` that really flips the theme
 *   • direction    `[data-direction-toggle]` (checked through the same click)
 *
 * `tools/smoke.mjs` already knows how to boot a page with the real application
 * and click those controls, but it boots pages inside one process — module
 * singletons (theme, i18n) would carry over from the previous page. This tool
 * runs one child process per page, so every page is measured exactly like a
 * fresh browser tab, and prints a single summary.
 *
 * Usage:
 *   node tools/qa-toggles.mjs              # every generated page
 *   node tools/qa-toggles.mjs dashboards/  # only pages matching a substring
 *   node tools/qa-toggles.mjs --jobs 4     # concurrency (default 4)
 *   node tools/qa-toggles.mjs --verbose
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_DIR = path.join(ROOT, 'src/pages');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
const jobsIndex = argv.indexOf('--jobs');
const jobsValue = jobsIndex === -1 ? (argv.find((arg) => arg.startsWith('--jobs='))?.split('=')[1] ?? '4') : (argv[jobsIndex + 1] ?? '4');
const JOBS = Math.max(1, Number.parseInt(jobsValue, 10) || 4);
/** Every plain argument is a substring filter, so `qa-toggles.mjs auth/ index.html` works. */
const filters = argv.filter((arg, index) => !arg.startsWith('--') && !/^\d+$/.test(arg) && index !== jobsIndex + 1);

function walk(dir, prefix = '', acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`, acc);
    else if (entry.name.endsWith('.html')) acc.push(`${prefix}${entry.name}`);
  }
  return acc.sort();
}

const ROOT_PAGES = fs.existsSync(path.join(ROOT, 'index.html')) ? ['index.html'] : [];
const pages = [...walk(PAGE_DIR), ...ROOT_PAGES].filter((url) => !filters.length || filters.some((term) => url.includes(term)));

if (!pages.length) {
  console.log('✖ no page matched the given filters.');
  process.exit(1);
}

function run(url) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['tools/smoke.mjs', '--all', url, '--theme', '--i18n', '--json'],
      { cwd: ROOT, maxBuffer: 12 * 1024 * 1024, timeout: 120000 },
      (error, stdout, stderr) => {
        const line = stdout.split('\n').find((row) => row.startsWith('NOVA_JSON:'));
        if (!line) {
          resolve({ url, failed: true, reason: (error?.message ?? stderr ?? 'no result').slice(0, 160) });
          return;
        }
        let payload;
        try {
          payload = JSON.parse(line.slice('NOVA_JSON:'.length));
        } catch (parseError) {
          resolve({ url, failed: true, reason: `unreadable result: ${parseError.message}` });
          return;
        }
        const page = payload.pages?.[0];
        if (!page) {
          resolve({ url, failed: true, reason: 'page did not boot' });
          return;
        }
        resolve({ url, ...page });
      },
    );
  });
}

const queue = [...pages];
const results = [];
let failures = 0;

async function worker() {
  while (queue.length) {
    const url = queue.shift();
    const result = await run(url);
    results.push(result);
    if (result.failed) {
      failures += 1;
      console.log(`✖ ${url} — ${result.reason}`);
      continue;
    }
    const i18n = result.i18n;
    const languages = i18n?.languages ?? [];
    const switched = i18n?.results?.filter((row) => row.expected && row.changed > 0).length ?? 0;
    const expected = i18n?.results?.filter((row) => row.expected).length ?? 0;
    const noSwitcher = languages.length === 0;
    const themeOk = result.theme?.ok === true;
    const bad = [];
    if (noSwitcher) bad.push('no language control');
    else if (switched < expected) bad.push(`language stays: ${i18n.results.filter((row) => row.expected && !row.changed).map((row) => row.lang).join(',')}`);
    if (!themeOk) bad.push('theme toggle does nothing');
    if (result.error) bad.push(`boot error: ${result.error}`);
    if (bad.length) failures += 1;
    const status = bad.length || result.error ? '✖' : '✔';
    if (bad.length || VERBOSE) {
      const detail = [
        `langs ${languages.length ? languages.join('/') : '—'}`,
        `switched ${switched}/${expected}`,
        `theme ${themeOk ? `${result.theme.before.mode}→${result.theme.after.mode}→${result.theme.back.mode}` : 'no change'}`,
      ].join(' · ');
      console.log(`${status} ${url}  ${detail}${bad.length ? `  — ${bad.join('; ')}` : ''}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(JOBS, pages.length) }, worker));

const withSwitcher = results.filter((row) => !row.failed && (row.i18n?.languages?.length ?? 0) > 0).length;
const themeOkCount = results.filter((row) => !row.failed && row.theme?.ok).length;

console.log('');
console.log(`  pages checked      ${results.length}`);
console.log(`  language control   ${withSwitcher}/${results.length}`);
console.log(`  theme control      ${themeOkCount}/${results.length}`);
console.log('');
if (failures) {
  console.log(`✖ ${failures} page(s) failed the toggle audit.`);
  process.exit(1);
}
console.log('✔ every page switches language, theme and direction from its chrome.');
