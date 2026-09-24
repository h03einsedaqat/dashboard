/**
 * NOVAADMIN — quality gate
 * ------------------------------------------------------------------
 * Runs over the *built* output (`dist/`) and fails on anything that would
 * embarrass a customer: broken links, missing assets, unstyled classes,
 * leftover build tokens, inaccessible markup or duplicated ids.
 *
 *   npm run qa:links
 *   npm run qa:links -- --verbose
 *
 * Exit code 0 = shippable, 1 = at least one hard failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const VERBOSE = process.argv.includes('--verbose');
const show = (...args) => VERBOSE && console.log(...args);

if (!fs.existsSync(DIST)) {
  console.error('✖ dist/ not found — run `npm run build` first.');
  process.exit(1);
}

/* ------------------------------------------------------------------ helpers */

function walk(dir, filter, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, acc);
    else if (filter(entry.name, full)) acc.push(full);
  }
  return acc;
}

const rel = (file) => path.relative(DIST, file).split(path.sep).join('/');

/**
 * Documentation pages ship fenced code samples. Their contents are ordinary
 * text (already HTML-escaped by the docs renderer), so they must never be
 * scanned as markup — otherwise a `<a href="…">` inside a code sample shows up
 * as a broken link and an `id="main-content"` inside a Blade snippet counts as
 * a duplicated id.
 */
const stripCodeSamples = (html) =>
  html.replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ').replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ');

const htmlFiles = walk(DIST, (name) => name.endsWith('.html'));
const cssFiles = walk(DIST, (name) => name.endsWith('.css'));
const jsFiles = walk(DIST, (name) => name.endsWith('.js'));
const assetFiles = walk(DIST, (name) => /\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|ttf|eot|mp4|webm|json|txt|xml|webmanifest)$/i.test(name));

const assetSet = new Set(assetFiles.map(rel));
const pageSet = new Set(htmlFiles.map(rel));

const failures = [];
const warnings = [];
const fail = (check, message) => failures.push({ check, message });
const warn = (check, message) => warnings.push({ check, message });

/* --------------------------------------------------------------- 1. links -- */

/** Classes used in markup that have no rule in the stylesheet. */
const usedClasses = new Map();
const tokenPattern = /\{\{[A-Z0-9_]+\}\}/g;
let linkCount = 0;
const brokenLinks = new Map();
const missingAssets = new Map();
const tokenHits = [];

for (const file of htmlFiles) {
  const html = stripCodeSamples(fs.readFileSync(file, 'utf8'));
  const pageRel = rel(file);
  const dir = path.posix.dirname(pageRel);

  for (const match of html.matchAll(tokenPattern)) tokenHits.push(`${pageRel}: ${match[0]}`);

  const urls = [
    ...[...html.matchAll(/\shref="([^"]+)"/g)].map((m) => ({ url: m[1], kind: 'link' })),
    ...[...html.matchAll(/\ssrc="([^"]+)"/g)].map((m) => ({ url: m[1], kind: 'asset' })),
    ...[...html.matchAll(/\sdata-src="([^"]+)"/g)].map((m) => ({ url: m[1], kind: 'asset' })),
    ...[...html.matchAll(/\sposter="([^"]+)"/g)].map((m) => ({ url: m[1], kind: 'asset' })),
  ];

  for (const { url, kind } of urls) {
    linkCount += 1;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) continue;
    const [rawPath] = url.split(/[?#]/);
    if (!rawPath) continue;
    const resolved = path.posix.normalize(path.posix.join(dir, rawPath));
    const target = resolved.startsWith('..') ? null : resolved;
    const exists = target && (pageSet.has(target) || assetSet.has(target) || fs.existsSync(path.join(DIST, target)));
    if (exists) continue;
    const bucket = kind === 'link' ? brokenLinks : missingAssets;
    const key = `${resolved}  ←  ${pageRel}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  // class inventory (for the CSS-coverage check)
  for (const match of html.matchAll(/\sclass="([^"]+)"/g)) {
    for (const className of match[1].split(/\s+/).filter(Boolean)) {
      usedClasses.set(className, (usedClasses.get(className) ?? 0) + 1);
    }
  }
}

if (tokenHits.length) fail('tokens', `${tokenHits.length} template tokens left in the output:\n    ${tokenHits.slice(0, 12).join('\n    ')}`);
if (brokenLinks.size) {
  const rows = [...brokenLinks.entries()].slice(0, 25);
  fail('links', `${brokenLinks.size} broken internal links:\n    ${rows.map(([row]) => row).join('\n    ')}`);
}
if (missingAssets.size) {
  const rows = [...missingAssets.entries()].slice(0, 20);
  fail('assets', `${missingAssets.size} missing assets:\n    ${rows.map(([row]) => row).join('\n    ')}`);
}

/* ------------------------------------------------------- 2. html structure -- */

const pagesWithoutH1 = [];
const pagesWithManyH1 = [];
const pagesWithoutMain = [];
const imagesWithoutAlt = [];
const duplicateIds = [];
const inlineHandlers = [];
const legacy = [];

for (const file of htmlFiles) {
  const html = stripCodeSamples(fs.readFileSync(file, 'utf8'));
  const pageRel = rel(file);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 === 0) pagesWithoutH1.push(pageRel);
  if (h1 > 1) pagesWithManyH1.push(`${pageRel} (${h1})`);
  if (!/<main[\s>]/.test(html)) pagesWithoutMain.push(pageRel);

  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt=/.test(match[0])) imagesWithoutAlt.push(`${pageRel}: ${match[0].slice(0, 90)}`);
  }

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicateIds.push(`${pageRel}: #${id}`);
    seen.add(id);
  }

  for (const match of html.matchAll(/\son(?:click|change|submit|input|load|mouseover)="[^"]*"/g)) {
    inlineHandlers.push(`${pageRel}: ${match[0].slice(0, 60)}`);
  }
  if (/data-bs-/.test(html)) legacy.push(`${pageRel}: data-bs-*`);
  // Only real usage counts — the documentation mentions the word jQuery.
  if (/jquery[\w.-]*\.js|\bjQuery\s*\(|\$\(\s*document\s*\)/.test(html)) legacy.push(`${pageRel}: jQuery`);
  if (/\bvar\s+[a-zA-Z_$]/.test(html.match(/<script>[\s\S]*?<\/script>/g)?.join('\n') ?? '')) legacy.push(`${pageRel}: var`);
}

if (pagesWithoutH1.length) warn('a11y.h1', `${pagesWithoutH1.length} pages without an <h1> (first: ${pagesWithoutH1.slice(0, 5).join(', ')})`);
if (pagesWithManyH1.length) warn('a11y.h1', `${pagesWithManyH1.length} pages with more than one <h1>: ${pagesWithManyH1.slice(0, 5).join(', ')}`);
if (pagesWithoutMain.length) fail('a11y.main', `${pagesWithoutMain.length} pages without <main>: ${pagesWithoutMain.slice(0, 5).join(', ')}`);
if (imagesWithoutAlt.length) warn('a11y.alt', `${imagesWithoutAlt.length} <img> without alt text`);
if (duplicateIds.length) fail('ids', `${duplicateIds.length} duplicated ids: ${duplicateIds.slice(0, 8).join(', ')}`);
if (inlineHandlers.length) fail('inline-js', `${inlineHandlers.length} inline event handlers`);
if (legacy.length) fail('legacy', `${legacy.length} legacy markers (jQuery / data-bs-* / var)`);

/* ---------------------------------------------------------- 3. css coverage */

/**
 * Class inventory. The compiled bundle is the primary source (it also carries
 * Bootstrap's utilities), but the SCSS sources are merged in so the check never
 * depends on how fresh `dist/` is: a class defined in a partial that has not
 * been rebuilt yet still counts as styled.
 */
const scssFiles = walk(path.join(ROOT, 'src/scss'), (name) => name.endsWith('.scss'));
const stripScssComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const css = [...cssFiles, ...scssFiles].map((file) => stripScssComments(fs.readFileSync(file, 'utf8'))).join('\n');
// Class selectors as written by the compiler: .foo, .foo\\,bar, .foo:hover
const cssClasses = new Set([...css.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)].map((m) => m[1].replace(/\\/g, '')));

/** Classes that are intentionally behaviour-only (toggled by JS, styled elsewhere). */
const ALLOWED_UNSTYLED = new Set([
  'app-ready', 'is-active', 'is-open', 'is-loading', 'is-selected', 'is-dragging', 'is-collapsed',
  'is-hidden', 'is-flipped', 'show', 'fade', 'collapse', 'collapsing', 'modal-open', 'modal-backdrop',
  'sortable-ghost', 'sortable-chosen', 'sortable-drag', 'swal2-shown', 'leaflet-container',
  'apexcharts-canvas', 'apexcharts-svg', 'no-transition', 'has-error', 'is-error', 'is-success',
  'is-disabled', 'is-expanded', 'active', 'disabled', 'js-ignore', 'reveal', 'reveal--visible',
]);

const unstyled = [...usedClasses.entries()]
  .filter(([className]) => !cssClasses.has(className) && !ALLOWED_UNSTYLED.has(className))
  // Icon fonts ship their own glyph rules (`@font-face` + `::before` content).
  .filter(([className]) => !/^bi(?:-|$)/.test(className))
  .sort((a, b) => b[1] - a[1]);

if (unstyled.length) {
  const rows = unstyled.slice(0, 30).map(([name, count]) => `${name} (${count}×)`);
  fail('css', `${unstyled.length} classes are used in markup but have no rule in the stylesheet:\n    ${rows.join(', ')}`);
  show(`${unstyled.length} unstyled classes total`);
}
console.log(`  css classes used ${usedClasses.size} / defined ${cssClasses.size} / unstyled ${unstyled.length}`);

/* --------------------------------------- 3b. css coverage in js templates -- */

/**
 * Controllers build their markup in template literals, so classes that only
 * appear there are invisible to the static HTML scan. This second pass parses
 * every controller and reports classes used in `class="…"` strings that the
 * stylesheet never defines.
 */
const jsClasses = new Map();
const controllerFiles = walk(path.join(ROOT, 'src/js'), (name) => name.endsWith('.js'));
for (const file of controllerFiles) {
  const code = fs.readFileSync(file, 'utf8');
  for (const match of code.matchAll(/class=\\?["'`]([^"'`$]*)/g)) {
    for (const className of match[1].split(/\s+/).filter(Boolean)) {
      if (/[^A-Za-z0-9_-]/.test(className)) continue;
      jsClasses.set(className, (jsClasses.get(className) ?? 0) + 1);
    }
  }
  // classes toggled through classList.add('…') / classList.toggle('…')
  for (const match of code.matchAll(/classList\.(?:add|toggle|remove)\('([A-Za-z0-9_-]+)'/g)) {
    jsClasses.set(match[1], (jsClasses.get(match[1]) ?? 0) + 1);
  }
}

const unstyledJs = [...jsClasses.entries()]
  .filter(([className]) => !cssClasses.has(className) && !ALLOWED_UNSTYLED.has(className))
  .filter(([className]) => !/^bi(?:-|$)/.test(className))
  .filter(([className]) => !/^is-|^has-/.test(className))
  // Template literals build classes dynamically (`status-dot--${tone}`); when a
  // truncated name is a prefix of a real rule it is not a coverage gap.
  .filter(([className]) => !(className.endsWith('-') && [...cssClasses].some((rule) => rule.startsWith(className))))
  .sort((a, b) => b[1] - a[1]);

if (unstyledJs.length) {
  fail('css.js', `${unstyledJs.length} classes used by controllers have no CSS rule:\n    ${unstyledJs.map(([n, c]) => `${n} (${c}×)`).join(', ')}`);
}

/* -------------------------------------------------------- 3c. icon names -- */

/**
 * Bootstrap Icons renders a glyph through the `.bi-<name>::before` rule. A name
 * that does not exist in the font shows up as an empty box in the browser, so
 * every `bi bi-…` class in the built pages is checked against the shipped
 * stylesheet. Dynamic class names (`bi-arrow-${dir}-short`) end with `-` and are
 * skipped here; their concrete values are covered by the source scan in 3b.
 */
const iconSheetPath = path.join(ROOT, 'node_modules/bootstrap-icons/font/bootstrap-icons.css');
if (fs.existsSync(iconSheetPath)) {
  const iconSheet = fs.readFileSync(iconSheetPath, 'utf8');
  const iconNames = new Set([...iconSheet.matchAll(/\.bi-([a-z0-9-]+)::before/g)].map((m) => m[1]));
  const badIcons = new Set();
  const checkIcons = (source) => {
    for (const match of source.matchAll(/class=\\?["'`]([^"'`]*)/g)) {
      for (const className of match[1].split(/\s+/)) {
        if (!className.startsWith('bi-') || className.endsWith('-')) continue;
        // `${…}` inside a template literal is data, not a literal icon name.
        if (/[$`{}]/.test(className)) continue;
        const name = className.slice(3);
        if (!iconNames.has(name)) badIcons.add(name);
      }
    }
  };
  for (const file of htmlFiles) checkIcons(stripCodeSamples(fs.readFileSync(file, 'utf8')));
  for (const file of walk(path.join(ROOT, 'src/js'), (name) => name.endsWith('.js'))) checkIcons(fs.readFileSync(file, 'utf8'));
  if (badIcons.size) fail('icons', `${badIcons.size} bootstrap-icon names do not exist in the shipped font: ${[...badIcons].slice(0, 20).join(', ')}`);
  else console.log(`  icons   ${iconNames.size} glyphs available / every referenced name resolves`);
} else {
  warn('icons', 'bootstrap-icons stylesheet not found — icon names were not verified');
}

/* -------------------------------------------------------- 4. js & console -- */

const consoleLeftovers = [];
for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  if (/console\.(?:log|debug)\(/.test(code)) consoleLeftovers.push(rel(file));
  if (/\bdebugger\b/.test(code)) consoleLeftovers.push(`${rel(file)} (debugger)`);
}
if (consoleLeftovers.length) warn('js.console', `debug output shipped in: ${consoleLeftovers.join(', ')}`);

/* ------------------------------------------------------- 5. fonts & images -- */

const missingFontRefs = [];
for (const file of cssFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const dir = path.posix.dirname(rel(file));
  for (const match of text.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
    // Font files carry a cache-busting query string (`…woff2?e3485313`).
    const url = match[2].split(/[?#]/)[0];
    if (!url || /^(?:data:|https?:|\/\/|#)/.test(url)) continue;
    const resolved = path.posix.normalize(path.posix.join(dir, url));
    if (!fs.existsSync(path.join(DIST, resolved))) missingFontRefs.push(`${url} (from ${rel(file)})`);
  }
}
if (missingFontRefs.length) fail('css-assets', `CSS points at missing files: ${[...new Set(missingFontRefs)].slice(0, 10).join(', ')}`);

/* ------------------------------------------------------- 6. seo & coverage -- */

const sitemapPath = path.join(DIST, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const listed = new Set([...sitemap.matchAll(/<loc>[^<]*\/([^/<]+(?:\.html)?)<\/loc>/g)].map((m) => m[1]));
  const bare = /<loc>[^<]*\/\/[^/]+\/<\/loc>/.test(sitemap); // the landing is advertised as the bare domain
  /* `noindex` and the sitemap have to agree: a page that asks not to be indexed
     must not be advertised (crawlers then distrust the whole file), and a page
     that is indexable should be in there. `tools/gen-nav.mjs` documents the switch. */
  const noindex = new Set(
    htmlFiles
      .filter((file) => /name="robots"[^>]*content="[^"]*noindex/i.test(fs.readFileSync(file, 'utf8')))
      .map((file) => rel(file)),
  );
  const advertised = [...noindex].filter((page) => sitemap.includes(`/${page}<`));
  if (advertised.length) fail('seo.sitemap', `${advertised.length} noindex pages are listed in sitemap.xml (first: ${advertised.slice(0, 5).join(', ')})`);
  const missingFromSitemap = [...pageSet].filter(
    (page) => !noindex.has(page) && !sitemap.includes(`/${page}<`) && !(page === 'index.html' && bare),
  );
  if (missingFromSitemap.length) warn('seo.sitemap', `${missingFromSitemap.length} indexable pages are not in sitemap.xml (first: ${missingFromSitemap.slice(0, 5).join(', ')})`);
  console.log(`  sitemap: ${listed.size} URLs · robots: ${noindex.size} pages kept out`);
} else {
  warn('seo.sitemap', 'dist/sitemap.xml missing');
}

if (htmlFiles.length < 120) fail('coverage', `only ${htmlFiles.length} pages built — the template promises 120+`);
if (pageSet.has('index.html') === false) fail('coverage', 'dist/index.html is missing');

/* ------------------------------------------------------------------ report -- */

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`;
console.log('');
console.log(`  pages   ${htmlFiles.length}   assets ${assetFiles.length}   css ${cssFiles.length}   js ${jsFiles.length}`);
console.log(`  dist    ${kb(walk(DIST, () => true).reduce((sum, file) => sum + fs.statSync(file).size, 0))} total`);
console.log(`  links   ${linkCount} checked, ${brokenLinks.size} broken`);
console.log(`  app     ${config.appName} v${config.version}`);

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warnings:`);
  for (const item of warnings) console.log(`  • [${item.check}] ${item.message}`);
}

if (failures.length) {
  console.log(`\n✖ ${failures.length} checks failed:`);
  for (const item of failures) console.log(`  • [${item.check}] ${item.message}`);
  process.exit(1);
}
console.log('\n✔ QA passed — links, assets, structure, CSS coverage and SEO are clean.');
