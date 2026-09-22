/**
 * NOVAADMIN — asset generator
 * ------------------------------------------------------------------
 * Every image that ships with the template is generated here as an original,
 * hand-tuned SVG: brand marks, 24 avatars, 24 product shots, 12 brand logos and
 * the PWA manifest. No third-party artwork is bundled, so the licence of the
 * package stays clean.
 *
 *   npm run gen:assets       (writes into public/assets/**)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

const PALETTES = [
  ['#4f46e5', '#6366f1', '#a5b4fc'],
  ['#2563eb', '#3b82f6', '#93c5fd'],
  ['#059669', '#10b981', '#6ee7b7'],
  ['#7c3aed', '#8b5cf6', '#c4b5fd'],
  ['#e11d48', '#f43f5e', '#fda4af'],
  ['#ea580c', '#f97316', '#fdba74'],
  ['#0891b2', '#06b6d4', '#67e8f9'],
  ['#ca8a04', '#eab308', '#fde047'],
];

const write = (relative, content) => {
  const target = path.join(PUBLIC, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.trim() + '\n');
};

/* ------------------------------------------------------------------- brand */

const sparkMark = (from, to, size = 40) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" role="img" aria-label="${config.appName}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="40" height="40" rx="11" fill="url(#g)"/>
  <path d="M20 8.5l2.9 6.4 6.9.8-5.1 4.7 1.4 6.9-6.1-3.4-6.1 3.4 1.4-6.9-5.1-4.7 6.9-.8z" fill="#fff" fill-opacity=".95"/>
  <path d="M11 30.5h18" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
</svg>`;

function writeBrand() {
  write('assets/logo-mark.svg', sparkMark(PALETTES[0][0], PALETTES[0][1]));

  write(
    'assets/logo.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 40" width="190" height="40" role="img" aria-label="${config.appName}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PALETTES[0][0]}"/><stop offset="1" stop-color="${PALETTES[0][1]}"/></linearGradient></defs>
  <rect width="40" height="40" rx="11" fill="url(#g)"/>
  <path d="M20 8.5l2.9 6.4 6.9.8-5.1 4.7 1.4 6.9-6.1-3.4-6.1 3.4 1.4-6.9-5.1-4.7 6.9-.8z" fill="#fff" fill-opacity=".95"/>
  <text x="52" y="26" font-family="Vazirmatn, Inter, system-ui, sans-serif" font-size="17" font-weight="700" fill="currentColor">${config.appName}</text>
</svg>`,
  );

  write(
    'assets/logo-dark.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 40" width="190" height="40" role="img" aria-label="${config.appName}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PALETTES[0][1]}"/><stop offset="1" stop-color="${PALETTES[3][1]}"/></linearGradient></defs>
  <rect width="40" height="40" rx="11" fill="url(#g)"/>
  <path d="M20 8.5l2.9 6.4 6.9.8-5.1 4.7 1.4 6.9-6.1-3.4-6.1 3.4 1.4-6.9-5.1-4.7 6.9-.8z" fill="#fff" fill-opacity=".95"/>
  <text x="52" y="26" font-family="Vazirmatn, Inter, system-ui, sans-serif" font-size="17" font-weight="700" fill="#f8fafc">${config.appName}</text>
</svg>`,
  );

  write(
    'assets/favicon.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PALETTES[0][0]}"/><stop offset="1" stop-color="${PALETTES[0][1]}"/></linearGradient></defs>
  <rect width="32" height="32" rx="9" fill="url(#g)"/>
  <path d="M16 6.5l2.4 5.3 5.8.7-4.3 3.9 1.2 5.8-5.1-2.9-5.1 2.9 1.2-5.8-4.3-3.9 5.8-.7z" fill="#fff"/>
</svg>`,
  );
}

/* ----------------------------------------------------------------- avatars */

function avatar(index) {
  const [dark, mid, light] = PALETTES[index % PALETTES.length];
  const skin = ['#f3d3bd', '#e7b48f', '#c98b62', '#8d5b3c', '#5c3a22'][index % 5];
  const hair = ['#1f2937', '#4b2e1f', '#0f172a', '#374151', '#7c3f1d'][(index + 2) % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="آواتار ${index + 1}">
  <defs>
    <linearGradient id="bg${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
    <clipPath id="clip${index}"><circle cx="48" cy="48" r="48"/></clipPath>
  </defs>
  <g clip-path="url(#clip${index})">
    <rect width="96" height="96" fill="url(#bg${index})"/>
    <circle cx="48" cy="40" r="17" fill="${skin}"/>
    <path d="M31 38c0-13 8-19 17-19s17 6 17 19c0-6-7-8-17-8s-17 2-17 8z" fill="${hair}"/>
    <path d="M18 96c0-17 14-27 30-27s30 10 30 27z" fill="${dark}" fill-opacity=".92"/>
    <circle cx="42" cy="41" r="2" fill="#1f2937"/>
    <circle cx="54" cy="41" r="2" fill="#1f2937"/>
    <path d="M43 49c2.5 2.4 7.5 2.4 10 0" stroke="#7c3f1d" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}

/* ---------------------------------------------------------------- products */

function product(index) {
  const [dark, mid, light] = PALETTES[index % PALETTES.length];
  const kind = index % 6;
  const shapes = [
    `<rect x="26" y="30" width="68" height="48" rx="6" fill="#fff" fill-opacity=".92"/><rect x="32" y="38" width="56" height="32" rx="3" fill="${dark}" fill-opacity=".25"/>`,
    `<rect x="40" y="20" width="40" height="68" rx="9" fill="#fff" fill-opacity=".92"/><rect x="46" y="30" width="28" height="44" rx="4" fill="${mid}" fill-opacity=".3"/>`,
    `<circle cx="60" cy="54" r="26" fill="#fff" fill-opacity=".92"/><circle cx="60" cy="54" r="12" fill="${mid}" fill-opacity=".35"/>`,
    `<path d="M24 62h72v18a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="#fff" fill-opacity=".92"/><path d="M56 26h8v36h-8z" fill="#fff" fill-opacity=".92"/><circle cx="60" cy="24" r="10" fill="${mid}" fill-opacity=".4"/>`,
    `<rect x="30" y="24" width="60" height="60" rx="14" fill="#fff" fill-opacity=".92"/><path d="M44 54h32M44 64h20" stroke="${dark}" stroke-opacity=".3" stroke-width="5" stroke-linecap="round"/>`,
    `<path d="M30 34h60l-8 46H38z" fill="#fff" fill-opacity=".92"/><path d="M46 34c0-9 6-14 14-14s14 5 14 14" stroke="${mid}" stroke-width="5" fill="none"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 108" width="120" height="108" role="img" aria-label="محصول ${index + 1}">
  <defs><linearGradient id="p${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
  <rect width="120" height="108" rx="14" fill="url(#p${index})"/>
  ${shapes[kind]}
  <circle cx="100" cy="18" r="10" fill="#fff" fill-opacity=".5"/>
</svg>`;
}

/* ------------------------------------------------------------------ brands */

function brand(index) {
  const [dark, mid, light] = PALETTES[(index + 3) % PALETTES.length];
  const glyphs = [
    `<path d="M24 24h24v24H24z" fill="${dark}"/><path d="M52 24h24v24H52z" fill="${mid}" fill-opacity=".7"/><path d="M24 52h52v24H24z" fill="${light}"/>`,
    `<circle cx="50" cy="50" r="26" fill="none" stroke="${dark}" stroke-width="10"/><circle cx="50" cy="50" r="9" fill="${mid}"/>`,
    `<path d="M18 82L50 18l32 64z" fill="${mid}"/><path d="M34 82L50 50l16 32z" fill="${dark}"/>`,
    `<rect x="20" y="20" width="60" height="60" rx="16" fill="${dark}"/><path d="M35 65V35l30 30V35" stroke="#fff" stroke-width="7" fill="none" stroke-linejoin="round"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="برند ${index + 1}">
  <rect width="100" height="100" rx="22" fill="#fff"/>
  <rect x="1" y="1" width="98" height="98" rx="21" fill="none" stroke="${mid}" stroke-opacity=".25"/>
  ${glyphs[index % glyphs.length]}
</svg>`;
}

/* ------------------------------------------------------------------ runner */

writeBrand();
for (let i = 0; i < 24; i += 1) write(`assets/img/avatars/avatar-${String(i + 1).padStart(2, '0')}.svg`, avatar(i));
for (let i = 0; i < 24; i += 1) write(`assets/img/products/product-${String(i + 1).padStart(2, '0')}.svg`, product(i));
for (let i = 0; i < 12; i += 1) write(`assets/img/brands/brand-${String(i + 1).padStart(2, '0')}.svg`, brand(i));

write(
  'site.webmanifest',
  JSON.stringify(
    {
      name: `${config.appName} — ${config.tagline}`,
      short_name: config.appShortName,
      description: 'Premium Persian-first multi-purpose admin dashboard template with RTL/LTR, Jalali calendar and dark mode.',
      start_url: './index.html',
      scope: './',
      display: 'standalone',
      background_color: '#f6f7fb',
      theme_color: '#4f46e5',
      dir: 'rtl',
      lang: config.defaultLanguage,
      icons: [
        { src: './assets/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: './assets/logo-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ),
);

console.log('✔ assets written: brand marks, 24 avatars, 24 products, 12 brand logos, site.webmanifest');
