/**
 * NOVAADMIN — deliverable packager
 * ------------------------------------------------------------------
 * Turns the repository into the ZIP a customer receives:
 *
 *   NOVAADMIN-1.0.0.zip
 *   └── novaadmin-1.0.0/
 *       ├── START-HERE.html      ← open this first (offline, no server needed)
 *       ├── README.md
 *       ├── CHANGELOG.md
 *       ├── LICENSE.txt
 *       ├── package.json
 *       ├── vite.config.js
 *       ├── html/                ← the deployable site (copy of dist/)
 *       ├── source/              ← src/, tools/, docs/, public/, config files
 *       ├── documentation/       ← markdown handbook + changelog copy
 *       ├── assets/              ← reusable fonts, images and vectors
 *       └── screenshots/         ← vector previews of the template
 *
 * Development-only material (node_modules, git, tests, tmp) is never included.
 *
 *   npm run package            # builds first, then packs
 *   node tools/package.mjs --skip-build
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIR = path.join(ROOT, 'release');
const SKIP_BUILD = process.argv.includes('--skip-build');
const STAGE = path.join(RELEASE_DIR, `novaadmin-${config.version}`);
const ZIP_PATH = path.join(RELEASE_DIR, `NOVAADMIN-${config.version}.zip`);

/* --------------------------------------------------------------- helpers --- */

const log = (message) => console.log(message);
const bytes = (dir) => {
  let total = 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  };
  walk(dir);
  return total;
};
const sizeOf = (target) => {
  const kb = (fs.statSync(target).isDirectory() ? bytes(target) : fs.statSync(target).size) / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} kB`;
};

/**
 * Copies a tree, skipping anything the customer should not receive.
 * `skip(relativePath, isDirectory)` lets us prune generated folders that the
 * build regenerates (keeping the source package small and always consistent).
 */
function copy(source, target, { exclude = [], skip } = {}) {
  if (!fs.existsSync(source)) return 0;
  let count = 0;
  fs.mkdirSync(target, { recursive: true });
  const walk = (from, to, prefix) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (exclude.includes(entry.name)) continue;
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (skip?.(relPath, entry.isDirectory())) continue;
      const sourcePath = path.join(from, entry.name);
      const targetPath = path.join(to, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        walk(sourcePath, targetPath, relPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
        count += 1;
      }
    }
  };
  walk(source, target, '');
  return count;
}

/** Copies individual files into a target directory. */
function copyFiles(files, target) {
  fs.mkdirSync(target, { recursive: true });
  let count = 0;
  for (const file of files) {
    const from = path.join(ROOT, file);
    if (!fs.existsSync(from)) continue;
    fs.copyFileSync(from, path.join(target, path.basename(file)));
    count += 1;
  }
  return count;
}

/* ------------------------------------------------------ screenshots (SVG) -- */

/** Draws a small vector preview of a screen — no screenshots needed. */
function previewSvg({ title, subtitle, accent = '#4f46e5', dark = false, chart = 'area' }) {
  const bg = dark ? '#0f172a' : '#f6f7fb';
  const surface = dark ? '#1e293b' : '#ffffff';
  const border = dark ? '#334155' : '#e2e6ef';
  const text = dark ? '#e2e8f0' : '#0f172a';
  const muted = dark ? '#94a3b8' : '#7b8399';
  const bar = (x, height, y = 300 - height) => `<rect x="${x}" y="${y}" width="26" height="${height}" rx="6" fill="${accent}" opacity="0.85"/>`;
  const bars = [64, 96, 78, 130, 104, 152, 118, 96].map((h, index) => bar(268 + index * 38, h)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500" role="img" aria-label="${title}">
  <rect width="800" height="500" fill="${bg}"/>
  <rect x="0" y="0" width="190" height="500" fill="${surface}" stroke="${border}"/>
  <rect x="24" y="28" width="34" height="34" rx="10" fill="${accent}"/>
  <rect x="68" y="34" width="88" height="10" rx="5" fill="${muted}" opacity="0.6"/>
  <rect x="68" y="50" width="58" height="8" rx="4" fill="${muted}" opacity="0.35"/>
  ${Array.from({ length: 8 }, (_, index) => `<rect x="24" y="${104 + index * 40}" width="8" height="20" rx="4" fill="${accent}" opacity="0.8"/><rect x="44" y="${110 + index * 40}" width="${110 - index * 6}" height="9" rx="4" fill="${muted}" opacity="0.45"/>`).join('')}
  <rect x="220" y="28" width="240" height="20" rx="10" fill="${text}" opacity="0.85"/>
  <rect x="220" y="60" width="330" height="10" rx="5" fill="${muted}" opacity="0.5"/>
  <text x="220" y="46" font-family="sans-serif" font-size="17" font-weight="700" fill="${text}">${title}</text>
  <text x="220" y="76" font-family="sans-serif" font-size="11" fill="${muted}">${subtitle}</text>
  ${Array.from({ length: 4 }, (_, index) => `<g transform="translate(${220 + index * 148},112)"><rect width="136" height="86" rx="14" fill="${surface}" stroke="${border}"/><rect x="16" y="18" width="52" height="9" rx="4" fill="${muted}" opacity="0.55"/><rect x="16" y="38" width="72" height="18" rx="6" fill="${text}" opacity="0.85"/><rect x="16" y="64" width="40" height="9" rx="4" fill="${accent}" opacity="0.85"/></g>`).join('')}
  <rect x="220" y="216" width="556" height="252" rx="16" fill="${surface}" stroke="${border}"/>
  <rect x="244" y="240" width="150" height="12" rx="6" fill="${muted}" opacity="0.55"/>
  ${chart === 'area'
    ? `<path d="M244 400 L300 356 L360 372 L420 322 L480 340 L540 300 L600 318 L660 282 L720 296 L752 268 L752 436 L244 436 Z" fill="${accent}" opacity="0.16"/><path d="M244 400 L300 356 L360 372 L420 322 L480 340 L540 300 L600 318 L660 282 L720 296 L752 268" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`
    : bars}
  <rect x="220" y="28" width="0" height="0"/>
</svg>
`;
}

function writeScreenshots(target) {
  fs.mkdirSync(target, { recursive: true });
  const shots = [
    { file: '01-dashboard-analytics.svg', title: 'Analytics dashboard', subtitle: 'KPI, revenue, traffic sources', chart: 'area' },
    { file: '02-dashboard-ecommerce.svg', title: 'eCommerce dashboard', subtitle: 'Orders, inventory, returns', accent: '#059669', chart: 'bars' },
    { file: '03-dashboard-crm.svg', title: 'CRM dashboard', subtitle: 'Pipeline value, deals, calls', accent: '#2563eb' },
    { file: '04-dark-theme.svg', title: 'Dark theme', subtitle: 'Every component, both themes', dark: true, accent: '#7c3aed' },
    { file: '05-rtl-layout.svg', title: 'RTL layout', subtitle: 'Persian-first, logical properties', accent: '#0d9488' },
    { file: '06-ai-workspace.svg', title: 'AI workspace', subtitle: 'Chat, writer, prompts, usage', accent: '#db2777', dark: true },
  ];
  shots.forEach(({ file, ...options }) => fs.writeFileSync(path.join(target, file), previewSvg(options), 'utf8'));

  fs.writeFileSync(
    path.join(target, 'README.md'),
    `# Screenshots

The SVGs in this folder are **vector previews** shipped with the template — they
scale to any size and follow the brand colours.

To publish your own captures:

1. Open the page in a browser at 1440 × 900.
2. Capture at 2× device pixel ratio for crisp results.
3. Save as \`NN-page-name.png\` (same order as the files here).
4. Replace the SVG files, then re-run \`npm run package\`.

Recommended set: all ten dashboards, the dark theme, the RTL layout, the AI
workspace, the kanban board and the invoice designer.
`,
    'utf8',
  );
  return shots.length;
}

function docsIndex() {
  const files = fs.readdirSync(path.join(ROOT, 'docs')).filter((name) => name.endsWith('.md')).sort();
  return files
    .map((name) => {
      const source = fs.readFileSync(path.join(ROOT, 'docs', name), 'utf8');
      const title = source.match(/^#\s+(.*)$/m)?.[1] ?? name;
      return `- **${title}** — \`docs/${name}\` · page: \`html/docs/${name.replace(/\.md$/, '.html')}\``;
    })
    .join('\n');
}

/* ------------------------------------------------------------------- build */

function build() {
  if (SKIP_BUILD) {
    log('· skipping build (--skip-build)');
    return;
  }
  log('· running npm run build …');
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
}

/* -------------------------------------------------------------------- main */

log(`NOVAADMIN packager — v${config.version}`);

if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) {
  log('· dist/ is missing, building first');
  build();
} else {
  build();
}

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

/* 1. deployable site ------------------------------------------------------- */
const htmlCount = copy(path.join(ROOT, 'dist'), path.join(STAGE, 'html'));

/* 2. source ---------------------------------------------------------------- */
const sourceTarget = path.join(STAGE, 'source');
/**
 * `src/pages/**` and `src/partials/docs/**` are generated by the build
 * (`npm run gen:all`), so they are left out of the package — the customer
 * receives the authored sources and the tools that produce those files.
 */
const GENERATED = new Set(['pages', 'partials/docs', 'data/navigation.js']);
const sourceSkip = (relPath) => GENERATED.has(relPath);

const sourceCount =
  copy(path.join(ROOT, 'src'), path.join(sourceTarget, 'src'), { skip: sourceSkip }) +
  copy(path.join(ROOT, 'tools'), path.join(sourceTarget, 'tools')) +
  copy(path.join(ROOT, 'public'), path.join(sourceTarget, 'public')) +
  copy(path.join(ROOT, 'docs'), path.join(sourceTarget, 'docs')) +
  copyFiles(
    ['index.html', 'vite.config.js', 'package.json', 'README.md', 'CHANGELOG.md', 'LICENSE.txt', 'START-HERE.html'],
    sourceTarget,
  );

/* 3. documentation --------------------------------------------------------- */
const docsCopy = copy(path.join(ROOT, 'docs'), path.join(STAGE, 'documentation/docs'));
const topicList = docsIndex();
fs.mkdirSync(path.join(STAGE, 'documentation'), { recursive: true });
for (const file of ['README.md', 'CHANGELOG.md', 'LICENSE.txt', 'START-HERE.html']) {
  fs.copyFileSync(path.join(ROOT, file), path.join(STAGE, 'documentation', file));
}
fs.writeFileSync(
  path.join(STAGE, 'documentation/INDEX.md'),
  `# NOVAADMIN — documentation

The template ships with 23 documentation topics in two formats:

| Format | Location | Best for |
| --- | --- | --- |
| Browsable pages | \`../html/docs/*.html\` | Reading inside the template (design system, search, table of contents) |
| Markdown sources | \`./docs/*.md\` | Editing, version control, printing |

## Topics

${topicList}

## Quick start

\`\`\`bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production output in dist/
npm run qa:all     # build + static audit + runtime smoke tests
\`\`\`
`,
  'utf8',
);

/* 4. assets ---------------------------------------------------------------- */
// Only reusable assets ship in `assets/`; the compiled bundles already live in
// `html/` (deployable) and in `source/` (rebuildable).
const assetCount =
  copy(path.join(ROOT, 'dist/assets/fonts'), path.join(STAGE, 'assets/fonts')) +
  copy(path.join(ROOT, 'dist/assets/img'), path.join(STAGE, 'assets/img')) +
  copyFiles(['logo.svg', 'logo-mark.svg', 'logo-dark.svg', 'favicon.svg'], path.join(STAGE, 'assets'));

/* 5. screenshots ----------------------------------------------------------- */
const shotCount = writeScreenshots(path.join(STAGE, 'screenshots'));

/* 6. root files ------------------------------------------------------------ */
for (const file of ['package.json', 'vite.config.js']) {
  fs.copyFileSync(path.join(ROOT, file), path.join(STAGE, file));
}

/* 7. zip ------------------------------------------------------------------- */
fs.rmSync(ZIP_PATH, { force: true });
try {
  execFileSync('zip', ['-rq', ZIP_PATH, path.basename(STAGE)], { cwd: RELEASE_DIR });
} catch (error) {
  console.error('✖ could not create the ZIP (is the `zip` command available?)', error.message);
  process.exit(1);
}

/* ------------------------------------------------------------------ report */

log('');
log(`  html/          ${htmlCount} files`);
log(`  source/        ${sourceCount} files`);
log(`  documentation/ ${docsCopy} markdown topics`);
log(`  assets/        ${assetCount} files`);
log(`  screenshots/   ${shotCount} vector previews`);
log(`  size           ${sizeOf(STAGE)} unpacked`);
log(`  zip            ${path.relative(ROOT, ZIP_PATH)} (${sizeOf(ZIP_PATH)})`);
log('');
log('✔ package ready — hand the ZIP to the customer, or open START-HERE.html inside it.');
