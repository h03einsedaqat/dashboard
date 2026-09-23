/**
 * NOVAADMIN build plugin
 * ------------------------------------------------------------------
 * Three small pieces that keep a 130+ page HTML template DRY and portable:
 *
 * 1. `@include` — `<!-- @include head.html -->` is replaced by the content of
 *    `src/partials/head.html` (recursive, cycle safe). Runs as a *pre* HTML
 *    transform so Vite still sees and optimises the final markup.
 * 2. `{{TOKEN}}` substitution — light templating (`{{ROOT}}`, `{{APP_NAME}}`,
 *    `{{VERSION}}`, …). `{{ROOT}}` is resolved in a *post* transform so the
 *    `root` prefix is applied after Vite rewrote asset urls: `/` on the dev
 *    server, a relative prefix (`../`) in the production build — meaning the
 *    shipped HTML runs from any folder, on any static host.
 * 3. Dev-server routing — serves `src/pages/**` at exactly the same URLs the
 *    production build produces (`/dashboards/analytics.html`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config/config.js';

const INCLUDE_RE = /<!--\s*@include\s+([^\s>]+?)\s*-->/g;

/** Recursively inline `@include` directives. */
function inlineIncludes(html, partialDir, warn, depth = 0, stack = []) {
  if (depth > 8) return html;
  return html.replace(INCLUDE_RE, (_m, file) => {
    const clean = String(file).replace(/^partials\//, '');
    if (stack.includes(clean)) return `<!-- @include cycle detected: ${clean} -->`;
    const abs = path.join(partialDir, clean);
    if (!fs.existsSync(abs)) {
      warn(`@include target not found: partials/${clean}`);
      return `<!-- @include missing: ${clean} -->`;
    }
    const content = fs.readFileSync(abs, 'utf8');
    return inlineIncludes(content, partialDir, warn, depth + 1, [...stack, clean]);
  });
}

/**
 * Resolves `@include` + `{{TOKEN}}` for a page document.
 * Shared by the Vite plugin and the offline tooling (`build-pages`, `smoke`) so
 * that the generated files, the dev server and the test harness all work on the
 * exact same markup.
 */
export function renderPageHtml(html, { partialDir = 'src/partials', warn = console.warn } = {}) {
  const partialAbs = path.resolve(process.cwd(), partialDir);
  return applyTokens(inlineIncludes(html, partialAbs, warn));
}

/** Replace `{{TOKEN}}` placeholders using the product config. */
export function applyTokens(html) {
  const tokens = {
    APP_NAME: config.appName,
    APP_SHORT_NAME: config.appShortName,
    TAGLINE: config.tagline,
    VERSION: config.version,
    YEAR: new Date().getFullYear(),
    DEFAULT_LANG: config.defaultLanguage,
    DEFAULT_DIR: config.defaultDirection,
    DEFAULT_THEME: config.defaultTheme,
    DEFAULT_PRIMARY: config.defaultPrimary,
    DEFAULT_LAYOUT: config.defaultLayout,
    DEFAULT_DENSITY: config.defaultDensity,
    DEFAULT_FONT_SIZE: config.defaultFontSize,
    DEFAULT_SIDEBAR_STYLE: config.defaultSidebarStyle,
    DEFAULT_CALENDAR: config.defaultCalendar,
    CURRENCY: config.currency,
    STORAGE_PREFIX: config.storagePrefix,
    SUPPORT_EMAIL: config.supportEmail,
    WEBSITE: config.website,
  };
  return html.replace(/\{\{([A-Z][A-Z_]*)\}\}/g, (m, key) => (key in tokens ? String(tokens[key]) : m));
}

export function novaIncludes({ pagesDir = 'src/pages', partialDir = 'src/partials' } = {}) {
  const partialAbs = path.resolve(process.cwd(), partialDir);
  const pagesAbs = path.resolve(process.cwd(), pagesDir);

  return {
    name: 'novaadmin:includes',
    enforce: 'pre',

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        let out = inlineIncludes(html, partialAbs, (msg) => ctx.server?.config.logger.warn(msg) ?? console.warn(msg));
        out = applyTokens(out);
        return out;
      },
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const [pathname, query] = req.url.split('?');
        if (pathname === '/' || pathname.startsWith('/@') || pathname.startsWith('/node_modules') || pathname.startsWith('/src/')) {
          return next();
        }

        const candidates = [];
        if (pathname.endsWith('/')) {
          candidates.push(path.join(pagesAbs, pathname, 'index.html'));
        } else if (path.extname(pathname)) {
          candidates.push(path.join(pagesAbs, pathname));
        } else {
          candidates.push(path.join(pagesAbs, `${pathname}.html`));
          candidates.push(path.join(pagesAbs, pathname, 'index.html'));
          candidates.push(path.join(pagesAbs, pathname));
        }

        for (const candidate of candidates) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            req.url = `/${path.relative(process.cwd(), candidate).split(path.sep).join('/')}${query ? '?' + query : ''}`;
            return next();
          }
        }
        next();
      });
    },
  };
}

/**
 * Resolves the `{{ROOT}}` token once Vite is done with the document.
 *  - dev   → `/`
 *  - build → `''` for the root page, `../` for one level deep, `../../` for two…
 */
export function novaRoot() {
  return {
    name: 'novaadmin:root-token',
    apply: () => true,
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const isDev = Boolean(ctx.server);
        if (isDev) return html.replace(/\{\{ROOT\}\}/g, '/');
        const clean = ctx.path.split('?')[0];
        const depth = clean.split('/').filter(Boolean).length - 1;
        const root = depth > 0 ? '../'.repeat(depth) : '';
        return html.replace(/\{\{ROOT\}\}/g, root);
      },
    },
  };
}

/** Every HTML page of `src/pages` as a Rollup input (clean URL structure). */
export function collectPages(pagesDir = 'src/pages') {
  const inputs = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['partials', 'node_modules', 'assets'].includes(entry.name)) continue;
        walk(abs);
      } else if (entry.name.endsWith('.html')) {
        // The input *key* is the public URL of the page (`dashboards/analytics.html`),
        // which is what makes Vite emit `dist/dashboards/analytics.html` instead of
        // mirroring the `src/pages` folder structure.
        const rel = path.relative(pagesDir, abs).split(path.sep).join('/');
        inputs[rel] = abs;
      }
    }
  };
  if (fs.existsSync(pagesDir)) walk(pagesDir);
  return inputs;
}
