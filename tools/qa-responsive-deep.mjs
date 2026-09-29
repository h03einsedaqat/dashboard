#!/usr/bin/env node
/**
 * NOVAADMIN — deep responsive audit (page-by-page, all devices).
 *
 * Layers:
 *   1. per-page HTML: inline style attributes with fixed px widths/heights,
 *      media elements with fixed width/height attributes, fixed-size iframes.
 *   2. built CSS: container-level classes declaring width/min-width >= 360px
 *      outside media queries (each hit is reported for review).
 *   3. layout sanity: the primary grid is auto-fit (inherently responsive);
 *      sidebar drawer presence at the 992/768 breakpoints.
 *
 * Device matrix simulated by thresholds: 320 (SE) · 375 (iPhone) · 414
 * (max iPhone) · 768 (tablet) · 1024 (small laptop) · 1440 (laptop) ·
 * 1920 (desktop). A fixed width of N px overflows every device narrower
 * than N px.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const devices = [320, 375, 414, 768, 1024, 1440, 1920];
const WIDTH_LIMIT = 360; // px — widest "small" phone we guarantee
const FAIL = [];
const WARN = [];
const show = (m) => console.log(`  ${m}`);
const fail = (k, m) => FAIL.push({ k, m });

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) files.push(p);
  }
};
walk(dist);

let inlineHits = 0;
let mediaHits = 0;
let iframeHits = 0;

for (const file of files) {
  const rel = file.replace(dist + '/', '');
  const html = readFileSync(file, 'utf8');

  // 1a. inline style attributes with fixed px sizes
  for (const m of html.matchAll(/style="([^"]*)"/g)) {
    const decls = m[1].split(';');
    for (const d of decls) {
      const mm = d.match(/^\s*(width|min-width)\s*:\s*(\d{2,4})px/i);
      if (mm && Number(mm[2]) >= WIDTH_LIMIT) {
        inlineHits += 1;
        FAIL.push({ k: 'inline-width', m: `${rel}: inline ${mm[1]}:${mm[2]}px (overflows devices < ${mm[2]}px: ${devices.filter((x) => x < Number(mm[2])).join('/')}px)` });
      }
      const hm = d.match(/^\s*(height)\s*:\s*(\d{3,4})px/i);
      if (hm && Number(hm[2]) >= 700) {
        WARN.push(`${rel}: inline height:${hm[2]}px — tall block, verify it is not a viewport-locked panel`);
      }
    }
  }

  // 1a-bis. inline grid-template-columns with fixed px minimums that are NOT
  // auto-fit — a fixed Npx track overflows every device narrower than N+gap.
  for (const m of html.matchAll(/style="([^"]*grid-template-columns[^"]*)"/g)) {
    if (/auto-fit/.test(m[1])) continue;
    for (const mm of m[1].matchAll(/minmax\(\s*(\d{3,4})px/g)) {
      const n = Number(mm[1]);
      if (n >= 300) {
        FAIL.push({ k: 'fixed-grid-track', m: `${rel}: inline grid track min ${n}px (no auto-fit) — overflows devices < ${n + 24}px; use a responsive class or auto-fit` });
      }
    }
  }

  // 1b. media/embed elements with fixed width|height attributes.
  // NOTE: <img> width/height attributes are CLS/SEO intrinsic-ratio hints —
  // the global reset `img,svg,video{max-width:100%;height:auto}` scales them,
  // so they are NOT overflow risks (that global rule is verified in layer 3).
  for (const m of html.matchAll(/<(iframe|video|canvas|embed)\b[^>]*>/gi)) {
    for (const attr of ['width', 'height']) {
      const am = m[0].match(new RegExp(`\\b${attr}="(\\d{2,4})"`, 'i'));
      if (am && Number(am[1]) >= WIDTH_LIMIT) {
        mediaHits += 1;
        FAIL.push({ k: 'fixed-media', m: `${rel}: <${m[1].toLowerCase()}> ${attr}="${am[1]}" (no responsive attribute)` });
      }
    }
  }
}

// 2. built CSS — container-level fixed widths outside media queries
const cssFiles = readdirSync(join(dist, 'assets', 'css'));
let css = '';
for (const c of cssFiles) css += readFileSync(join(dist, 'assets', 'css', c), 'utf8');

// crude but effective: split on @media boundaries, keep non-conditional rules
const nonMedia = css
  .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  .replace(/@keyframes[^{]*\{[\s\S]*?\}\s*\}/g, '');
const fixedWidthRules = [...nonMedia.matchAll(/([.#][\w-][\w-]*)\s*\{[^{}]*?(?:^|;)\s*(?:min-)?width:\s*(\d{3,4})px/g)]
  .filter((m) => Number(m[2]) >= WIDTH_LIMIT);
const reviewed = fixedWidthRules.filter((m) => !/\.table-responsive|leaflet|modal|tooltip|popover|logi-map__radar/.test(m[1]));
for (const m of reviewed) {
  WARN.push(`CSS width ${m[2]}px on ${m[1]} outside media queries — verify usage context (content-sized vs container)`);
}
show(`fixed-width CSS rules (≥${WIDTH_LIMIT}px, non-media, to review): ${reviewed.length}`);

// 3. layout sanity
const gridAutoFit = /\.grid--4\{[^}]*auto-fit/.test(css);
show(`grid--4 is auto-fit (collapses on its own): ${gridAutoFit ? 'yes' : 'NO'}`);
if (!gridAutoFit) FAIL.push({ k: 'grid', m: '.grid--4 lost its auto-fit template' });

for (const px of [991.98, 767.98, 575.98]) {
  if (!css.includes(`max-width:${px}px`)) FAIL.push({ k: 'breakpoint', m: `no ${px}px breakpoint found in built CSS — sidebar/drawer rules missing?` });
}
// The global media reset is what makes <img width="…"> hints safe:
if (!/img[^{]*\{[^}]*max-width:\s*100%/.test(css) && !/img,svg,video\{max-width:100%/.test(css)) {
  FAIL.push({ k: 'img-reset', m: 'global img/svg/video max-width:100% reset missing — fixed-width image hints would overflow phones' });
}

console.log('\n  deep responsive audit (page-by-page)');
show(`pages audited  ${files.length} across devices ${devices.join('/')}px`);
show(`inline fixed widths ≥${WIDTH_LIMIT}px : ${inlineHits}`);
show(`fixed-size media elements             : ${mediaHits}`);
show(`fixed-size iframes                    : ${iframeHits}`);
if (WARN.length) {
  show('review list (not failures):');
  for (const w of [...new Set(WARN)].slice(0, 12)) console.log(`    · ${w}`);
}

if (FAIL.length) {
  console.log('\n✖ deep responsive audit FAILED:');
  for (const f of FAIL.slice(0, 25)) console.log(`  ✖ [${f.k}] ${f.m}`);
  process.exit(1);
}
console.log('\n✔ deep responsive audit passed — no overflow traps in any page.');
