#!/usr/bin/env node
/**
 * Focused mobile regression checks for the header notification sheet and the
 * calendar's create/day-agenda modals. The smoke harness boots the real page
 * controllers in a small DOM shim; source CSS assertions cover the viewport
 * sizing contract that requires an actual browser to render visually.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const modalScss = read('src/scss/components/_modals.scss');
const dropdownScss = read('src/scss/components/_dropdowns.scss');
const header = read('src/partials/header.html');

const stage = modalScss.match(/\.modal-backdrop\[data-modal-id\]\s*\{([^}]*)\}/s)?.[1] ?? '';
assert.match(stage, /position:\s*fixed/,
  'modal stage must be viewport-fixed');
assert.match(stage, /inset:\s*0/,
  'modal stage must cover the full viewport');
assert.match(stage, /height:\s*100vh;\s*height:\s*100dvh/,
  'modal stage must use dynamic viewport height with a legacy fallback');

const mobileModalRules = modalScss.slice(modalScss.indexOf('@media (max-width: 575.98px)'));
assert.match(mobileModalRules, /max-height:\s*calc\(100dvh - var\(--nv-modal-top-inset\) - var\(--nv-modal-bottom-inset\)\)/,
  'mobile modal sheet must reserve both safe-area insets');
assert.match(modalScss, /\.modal-backdrop\[data-modal-id\] > \.modal > \.modal__body\s*\{[^}]*overflow-y:\s*auto/s,
  'modal content must remain scrollable');

assert.match(header, /class="dropdown-menu notif-panel"\s+data-dropdown-menu\s+data-dropdown-keep-open/,
  'notification interactions must not dismiss their own dropdown');
assert.match(dropdownScss, /max-height:\s*min\(86vh,\s*46rem\);\s*max-height:\s*min\(86dvh,\s*46rem\)/,
  'notification sheet must retain a viewport-height fallback');

console.log('✔ modal viewport and safe-area rules');
console.log('✔ notification sheet keep-open and viewport rules');

// Generated page shells include the header partial; refresh them before the
// runtime check so this test always exercises the current markup.
const generated = spawnSync(process.execPath, ['tools/build-pages.mjs', '--mode', 'build'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (generated.stdout) process.stdout.write(generated.stdout);
if (generated.stderr) process.stderr.write(generated.stderr);
if (generated.status !== 0) process.exit(generated.status ?? 1);

const runtime = spawnSync(process.execPath, ['tools/smoke.mjs', '--overlays'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (runtime.stdout) process.stdout.write(runtime.stdout);
if (runtime.stderr) process.stderr.write(runtime.stderr);
if (runtime.status !== 0) process.exit(runtime.status ?? 1);
