/**
 * NOVAADMIN — mobile / responsive audit
 * ------------------------------------------------------------------
 * The template is promised to work from 320px up to 1920px. A real browser is
 * the only way to *see* that, so this tool checks everything that can be
 * verified statically — and the reminder at the end tells you what still needs
 * a human eye (or the preview server).
 *
 *   npm run qa:responsive
 *   npm run qa:responsive -- --verbose
 *
 * Exit code 0 = no responsive red flags, 1 = at least one hard failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const VERBOSE = process.argv.includes('--verbose');
const show = (...args) => VERBOSE && console.log(...args);

if (!fs.existsSync(DIST)) {
  console.error('✖ dist/ not found — run `npm run build` first.');
  process.exit(1);
}

/* --------------------------------------------------------------- helpers -- */

function walk(dir, filter, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, acc);
    else if (filter(entry.name, full)) acc.push(full);
  }
  return acc;
}

const rel = (file) => path.relative(DIST, file).split(path.sep).join('/');
const stripCodeSamples = (html) =>
  html.replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ').replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ');

const failures = [];
const warnings = [];
const notes = [];
const fail = (check, message) => failures.push({ check, message });
const warn = (check, message) => warnings.push({ check, message });

const htmlFiles = walk(DIST, (name) => name.endsWith('.html'));
const cssFiles = walk(DIST, (name) => name.endsWith('.css'));

/* ------------------------------------------------- 1. viewport & shell ---- */

const missingViewport = [];
const missingToggle = [];
const missingOverflowGuard = [];
const unwrappedTables = [];

for (const file of htmlFiles) {
  const page = rel(file);
  const html = stripCodeSamples(fs.readFileSync(file, 'utf8'));

  if (!/<meta\s+name="viewport"[^>]*width=device-width/i.test(html)) missingViewport.push(page);

  // Shell pages need the mobile drawer trigger (the sidebar is off-canvas < 992px);
  // auth and error pages intentionally have no sidebar at all.
  const hasShell = /\bapp-sidebar\b/.test(html);
  if (hasShell && !/data-(?:sidebar-toggle|drawer-toggle|nav-toggle)/.test(html)) missingToggle.push(page);

  // tables must live inside a scroll container, otherwise they push the layout
  for (const match of html.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
    const before = html.slice(Math.max(0, match.index - 400), match.index);
    const after = html.slice(match.index, match.index + 400);
    const wrapped = /table-responsive|datatable-wrap|table-wrap/.test(before) || /table-responsive/.test(after);
    if (!wrapped) unwrappedTables.push(page);
  }

  if (/overflow-x\s*:\s*(?:scroll|auto)/.test(html) === false) missingOverflowGuard.push(page);
}

if (missingViewport.length) fail('viewport', `${missingViewport.length} pages without a device-width viewport: ${missingViewport.slice(0, 5).join(', ')}`);
if (missingToggle.length) warn('drawer', `${missingToggle.length} pages without a sidebar/drawer toggle (first: ${missingToggle.slice(0, 5).join(', ')})`);
if (unwrappedTables.length) {
  fail('tables', `${unwrappedTables.length} tables are not inside a scroll container: ${[...new Set(unwrappedTables)].slice(0, 8).join(', ')}`);
}

/* ------------------------------------------------ 2. fixed px widths ------ */

const css = cssFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

/** Collects declarations that appear outside any @media block. */
function topLevelRules(source) {
  const out = [];
  let depth = 0;
  let mediaDepth = -1;
  let buffer = '';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
      if (/@media/.test(buffer)) mediaDepth = depth;
      buffer = '';
      continue;
    }
    if (char === '}') {
      if (mediaDepth === depth) mediaDepth = -1;
      depth -= 1;
      buffer = '';
      continue;
    }
    buffer += char;
    if (char === ';' || char === '{') {
      if (mediaDepth === -1 && buffer.trim()) out.push(buffer.trim());
    }
  }
  return out;
}

const declarations = topLevelRules(css);
const wideFixed = declarations.filter((rule) => {
  const match = rule.match(/^([\w-]+):\s*(\d{3,4})px\s*$/);
  if (!match) return false;
  const [, property, value] = match;
  const px = Number(value);
  if (!/^(?:min-)?(?:width|height)$/.test(property)) return false;
  if (property.startsWith('min') && /^(?:min-height)$/.test(property)) return false; // vertical only
  return px >= 360;
});

if (wideFixed.length) {
  notes.push(
    `${wideFixed.length} fixed widths ≥ 360px outside media queries — check they are content-sized (e.g. \`.card { width: ${wideFixed
      .map((rule) => rule.match(/(\d+)px/)[1])
      .slice(0, 3)
      .join('px, ')}px })\`) and not layout containers`,
  );
  show(wideFixed.slice(0, 20).join('\n'));
}

/* ------------------------------------------------ 3. breakpoint coverage -- */

const breakpoints = [320, 375, 414, 576, 768, 992, 1200, 1440, 1920];
const declared = [...css.matchAll(/(?:min|max)-width:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
const coverage = breakpoints.map((bp) => {
  const nearest = declared.reduce((best, value) => (Math.abs(value - bp) < Math.abs(best - bp) ? value : best), declared[0] ?? 0);
  return { bp, nearest, distance: Math.abs(nearest - bp) };
});
const uncovered = coverage.filter(({ distance }) => distance > 45).map(({ bp }) => bp);
if (uncovered.length) {
  warn('breakpoints', `no media query near: ${uncovered.join(', ')}px (fine if handled by fluid sizing)`);
}
show(coverage.map(({ bp, nearest }) => `${bp}px → ${nearest}px`).join('  ·  '));

const scssBreakpoints = fs.existsSync(path.join(ROOT, 'src/scss/base/_breakpoints.scss'))
  ? fs.readFileSync(path.join(ROOT, 'src/scss/base/_breakpoints.scss'), 'utf8')
  : '';
if (scssBreakpoints) {
  const defined = [...scssBreakpoints.matchAll(/(\d{3,4})px/g)].map((m) => m[1]);
  notes.push(`SCSS breakpoint tokens: ${[...new Set(defined)].join(', ')}px`);
}

/* ------------------------------------------------ 4. overflow killers ----- */

const overflowRisks = [];
/**
 * `width: 100vw` is a genuine overflow trap for layout containers — but
 * Bootstrap uses it on purpose for fixed backdrops and the `vw-100` utilities,
 * where it is correct. Only unexpected selectors are reported.
 */
const BOOTSTRAP_VIEWPORT_SELECTORS = /^\.(?:modal|offcanvas|vw-|min-vw-)/;
const bareViewportWidths = [...css.matchAll(/([^{};]*)\{[^{}]*?(?:^|;)\s*(?:width|min-width):\s*100vw/g)]
  .map((match) => match[1].trim().split(',')[0])
  .filter((selector) => !BOOTSTRAP_VIEWPORT_SELECTORS.test(selector));
if (bareViewportWidths.length) {
  overflowRisks.push(`\`width: 100vw\` on ${[...new Set(bareViewportWidths)].slice(0, 4).join(', ')} — prefer 100% or calc(100vw - gutter)`);
}
show(`safe viewport calculations: ${(css.match(/calc\(100vw - [^)]+\)/g) ?? []).length} · bootstrap backdrops (expected): ${[...css.matchAll(/100vw/g)].length}`);
if (/position:\s*fixed[\s\S]{0,120}(?:width:\s*\d{3,4}px)/.test(css)) overflowRisks.push('fixed-position element with a hard pixel width can overflow small screens');
if (/white-space:\s*nowrap/.test(css)) {
  const nowrapCount = (css.match(/white-space:\s*nowrap/g) ?? []).length;
  notes.push(`${nowrapCount} \`white-space: nowrap\` declarations — intended for chips/table cells, verify long Persian strings wrap elsewhere`);
}
if (overflowRisks.length) warn('overflow', overflowRisks.join(' · '));

/* ------------------------------------------------- 5. touch targets ------- */

const touchNotes = [];
for (const file of htmlFiles.slice(0, 40)) {
  const html = fs.readFileSync(file, 'utf8');
  const smallButtons = (html.match(/class="[^"]*\bbtn-xs\b[^"]*"/g) ?? []).length;
  if (smallButtons) touchNotes.push(`${rel(file)}: ${smallButtons}`);
}
if (touchNotes.length) {
  notes.push(`\`btn-xs\` used on ${touchNotes.length} of the sampled pages — inside desktop-only toolbars this is fine, keep it out of primary mobile actions`);
}

/* ----------------------------------------------------------------- report -- */

console.log('');
console.log('  responsive audit');
console.log(`  pages        ${htmlFiles.length}`);
console.log(`  viewport     ${missingViewport.length} pages missing a device-width viewport`);
console.log(`  drawer       ${missingToggle.length} pages without a sidebar/drawer toggle`);
console.log(`  tables       ${unwrappedTables.length} tables outside a scroll container`);
console.log(`  breakpoints  ${coverage.map(({ bp, nearest }) => (bp === nearest ? `${bp}px` : `${bp}→${nearest}px`)).join(' / ')}`);

for (const note of notes) console.log(`  · ${note}`);

if (warnings.length) {
  console.log('');
  console.log(`  ⚠ ${warnings.length} warnings:`);
  for (const item of warnings) console.log(`    • [${item.check}] ${item.message}`);
}

if (failures.length) {
  console.log('');
  console.log(`  ✖ ${failures.length} checks failed:`);
  for (const item of failures) console.log(`    • [${item.check}] ${item.message}`);
  process.exit(1);
}

console.log('');
console.log('  What a browser still has to confirm (open `npm run dev` and use the');
console.log('  device toolbar at 320 / 375 / 414 / 768 px):');
console.log('    1. no horizontal scrollbar on any page');
console.log('    2. the sidebar opens as a drawer and closes on overlay tap');
console.log('    3. tables scroll inside their container, not the page');
console.log('    4. tap targets stay ≥ 40px and nothing overlaps the sticky header');
console.log('');
console.log('✔ responsive audit passed — no structural blockers found.');
