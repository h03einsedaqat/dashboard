/**
 * NOVAADMIN — page generator
 * ------------------------------------------------------------------
 * `npm run gen:pages` (also runs automatically before every build)
 *
 * Every page in NOVAADMIN is a *real, standalone HTML file* — that is the
 * product promise. To keep 170+ of them maintainable we generate the shell
 * (head, sidebar, header, breadcrumb, footer, overlays, customizer) from the
 * manifest and let each page own its own content:
 *
 *   src/partials/pages/<path>.html   → authored body (preferred)
 *   otherwise                        → generic, data-driven app body
 *
 * Generated files are committed on purpose so the template also works for
 * buyers who only want to drop the `dist/` output on a server.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sidebar, extraPages } from './manifest.mjs';
import { renderNav, flatten, trailFor, slug, href } from './nav.mjs';
import { renderPageHtml } from './nova-plugin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = path.join(ROOT, 'src/pages');
const BODY_DIR = path.join(ROOT, 'src/partials/pages');
const LOCALES_DIR = path.join(ROOT, 'src/locales');

const argv = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = argv.indexOf(name);
  return index > -1 ? argv[index + 1] : fallback;
};
const MODE = argValue('--mode', 'dev');

/* ------------------------------------------------------------------ pages */
const flat = flatten(sidebar);

/** url → page descriptor (last one wins, parents are usually duplicated). */
const pageMap = new Map();
for (const item of flat) {
  const previous = pageMap.get(item.url);
  const entry = {
    url: item.url,
    id: item.id,
    label: item.label,
    icon: item.icon,
    resource: item.resource,
    kind: item.kind || previous?.kind || 'system',
    section: null,
    parents: [],
  };
  // resolve section + ancestor trail
  for (const section of sidebar) {
    if (section.items.some((i) => i.id === entry.id || i.children?.some((c) => c.id === entry.id))) {
      entry.section = section.label ? { id: slug(section.label.en), label: section.label } : null;
    }
  }
  const { parents } = trailFor(sidebar, item.url);
  const uniqueParents = parents.filter((p, i, all) => p.url !== item.url && all.findIndex((x) => x.id === p.id) === i);
  entry.parents = uniqueParents.map((p) => ({ id: p.id, label: p.label, url: p.url }));
  pageMap.set(item.url, entry);
}
for (const extra of extraPages) {
  pageMap.set(extra.url, {
    url: extra.url,
    id: slug(extra.url),
    label: extra.label,
    icon: extra.icon || 'file-earmark',
    resource: extra.resource,
    kind: extra.kind || 'system',
    section: null,
    parents: [],
    noLayout: extra.noLayout,
  });
}

const pages = [...pageMap.values()];

/* --------------------------------------------------------------- helpers */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function readBody(page) {
  const file = path.join(BODY_DIR, page.url);
  if (fs.existsSync(file)) return { html: fs.readFileSync(file, 'utf8').trim(), authored: true };
  return { html: defaultBody(page), authored: false };
}

function defaultBody(page) {
  const title = esc(page.label.fa);
  if (page.kind === 'dashboard') {
    /**
     * Dashboard pages are rendered by the dashboard harness
     * (`js/pages/generic.js` → `dashboardHarness`) which paints KPI cards,
     * charts, the widget editor, range presets and the activity feed for the
     * matching slug.
     */
    const slug = page.url.split('/').pop()?.replace('.html', '') ?? 'analytics';
    return `<div data-app="dashboard" data-resource="${page.resource || slug}" data-slug="${slug}" data-title="${title}"></div>`;
  }
  if (page.kind === 'list') {
    return `<div data-app="table" data-resource="${page.resource || 'generic'}" data-title="${title}"></div>`;
  }
  if (page.kind === 'doc') {
    const docFile = path.join(ROOT, 'src/partials/docs', page.url.split('/')[1]);
    if (fs.existsSync(docFile)) return fs.readFileSync(docFile, 'utf8').trim();
    return docsFallback(page);
  }
  if (page.kind === 'system') {
    return `<div data-app="system" data-resource="${page.id}" data-title="${title}"></div>`;
  }
  if (page.kind === 'auth') {
    return `<div data-app="auth" data-resource="${page.id}"></div>`;
  }
  if (page.kind === 'ui') {
    return `<div data-app="ui" data-resource="${page.id}"></div>`;
  }
  return `<div data-app="overview" data-resource="${page.resource || page.id}" data-title="${title}"></div>`;
}

function docsFallback(page) {
  return `<article class="docs-article">
  <header class="docs-article__head">
    <span class="badge badge--soft-primary">${esc(page.label.fa)}</span>
    <h1>${esc(page.label.fa)}</h1>
    <p class="docs-lead">مستندات کامل ${esc(page.label.fa)} در نسخه بعدی این بخش تکمیل می‌شود. ساختار صفحات، کامپوننت‌ها و API در ادامه توضیح داده شده است.</p>
  </header>
  <section>
    <h2>نگاه کلی</h2>
    <p>این مستند بخشی از سیستم مستندسازی NOVAADMIN است و با همان Design System صفحات، تایپوگرافی و کامپوننت‌های محصول نوشته شده است.</p>
    <div class="callout callout--info"><i class="bi bi-info-circle"></i><div><strong>نکته</strong><p class="mb-0">برای مشاهده نمونه کد و راهنمای گام‌به‌گام، به بخش‌های بعدی همین مستند مراجعه کنید.</p></div></div>
  </section>
</article>`;
}

/* ------------------------------------------------------- page head parts */
function headActions(page) {
  const buttons = [];
  if (page.kind === 'dashboard') {
    buttons.push(`<button class="btn btn-light" type="button" data-widget-editor><i class="bi bi-sliders2"></i><span data-i18n="ui.personalize">شخصی‌سازی ابزارک‌ها</span></button>`);
    buttons.push(`<button class="btn btn-light" type="button" data-export-menu><i class="bi bi-download"></i><span data-i18n="ui.export">خروجی</span></button>`);
    buttons.push(`<button class="btn btn-primary" type="button" data-demo-switch data-demo-next><i class="bi bi-shuffle"></i><span data-i18n="ui.nextDemo">دموی بعدی</span></button>`);
  } else if (page.kind === 'list') {
    buttons.push(`<button class="btn btn-light" type="button" data-table-columns><i class="bi bi-layout-three-columns"></i><span data-i18n="ui.columns">ستون‌ها</span></button>`);
    buttons.push(`<button class="btn btn-light" type="button" data-table-export><i class="bi bi-filetype-csv"></i><span data-i18n="ui.export">خروجی</span></button>`);
    buttons.push(`<button class="btn btn-primary" type="button" data-create-${page.resource || 'item'}><i class="bi bi-plus-lg"></i><span data-i18n="ui.create">افزودن</span></button>`);
  } else if (['app', 'doc'].includes(page.kind)) {
    buttons.push(`<button class="btn btn-light" type="button" data-help-doc><i class="bi bi-question-circle"></i><span data-i18n="ui.help">راهنما</span></button>`);
  }
  if (!buttons.length) return '';
  return `<div class="page-head__actions">${buttons.join('')}</div>`;
}

function pageHead(page) {
  const home = `<li class="breadcrumb__item"><a href="${href('index.html')}"><i class="bi bi-house-door" aria-hidden="true"></i><span data-i18n="ui.home">خانه</span></a></li>`;
  const parents = page.parents
    .map((p) => {
      if (p.url && p.url !== page.url) {
        return `<li class="breadcrumb__item"><a href="${href(p.url)}"><span data-i18n="nav.${p.id}">${esc(p.label.fa)}</span></a></li>`;
      }
      return `<li class="breadcrumb__item"><span data-i18n="nav.${p.id}">${esc(p.label.fa)}</span></li>`;
    })
    .join('');
  const current = `<li class="breadcrumb__item" aria-current="page"><span data-i18n="nav.${page.id}">${esc(page.label.fa)}</span></li>`;
  const demos = page.kind === 'dashboard' ? ` data-demo-page="${page.url}"` : '';
  return `<div class="page-head"${demos}>
        <div class="page-head__text">
          <nav class="breadcrumb-nav" aria-label="مسیر صفحه"><ol class="breadcrumb">${home}${parents}${current}</ol></nav>
          <h1 class="page-head__title" data-page-title><span data-i18n="nav.${page.id}">${esc(page.label.fa)}</span></h1>
          <p class="page-head__sub" data-page-subtitle></p>
        </div>
        ${headActions(page)}
      </div>`;
}

/* ------------------------------------------------------------- skeleton  */
function shell(page, body) {
  const nav = renderNav(sidebar, page.url);
  const isDocs = page.kind === 'doc';
  const title = `${page.label.fa} | {{APP_NAME}}`;

  return `<!doctype html>
<html lang="{{DEFAULT_LANG}}" dir="{{DEFAULT_DIR}}" data-theme="{{DEFAULT_THEME}}" data-theme-mode="{{DEFAULT_THEME}}" data-primary="{{DEFAULT_PRIMARY}}" data-layout="{{DEFAULT_LAYOUT}}" data-direction="{{DEFAULT_DIR}}" data-density="comfortable" data-font-size="md" data-sidebar-style="fixed" data-calendar="jalali">
<head>
  <!-- @include head.html -->
  <title>${title}</title>
</head>
<body class="app-body${isDocs ? ' app-body--docs' : ''}" data-page="${page.url}" data-section="${page.section?.id ?? 'app'}" data-kind="${page.kind}">
  <a class="skip-link" href="#main-content" data-i18n="ui.skipToContent">پرش به محتوای اصلی</a>

  <div class="app-shell" data-app-shell>
    <aside class="app-sidebar" id="app-sidebar" data-app-sidebar aria-label="منوی اصلی">
      <div class="app-sidebar__head">
        <a class="brand" href="${href('index.html')}" aria-label="{{APP_NAME}}">
          <img class="brand__mark" src="${href('assets/logo-mark.svg')}" alt="" width="34" height="34">
          <span class="brand__text">
            <span class="brand__name">{{APP_NAME}}</span>
            <span class="brand__tag">{{TAGLINE}}</span>
          </span>
        </a>
        <button class="icon-btn app-sidebar__close" type="button" data-sidebar-close aria-label="بستن منو" data-i18n-title="ui.close">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>

      <div class="app-sidebar__body">
        <div class="app-sidebar__search">
          <button class="search-trigger search-trigger--block" type="button" data-command-open>
            <i class="bi bi-search" aria-hidden="true"></i>
            <span data-i18n="ui.searchPlaceholder">جستجو در همه‌جا…</span>
          </button>
        </div>
        <nav class="app-nav" data-app-nav aria-label="ناوبری اصلی">
          ${nav}
        </nav>
        <div class="app-sidebar__promo" data-sidebar-promo>
          <div class="promo-card">
            <span class="promo-card__icon"><i class="bi bi-stars" aria-hidden="true"></i></span>
            <div class="promo-card__body">
              <strong data-i18n="ui.aiPromoTitle">کارگاه هوش مصنوعی</strong>
              <p class="mb-0" data-i18n="ui.aiPromoText">۱۵ ابزار آماده برای تولید محتوا، تحلیل و اتوماسیون.</p>
            </div>
            <a class="btn btn-sm btn-primary w-100" href="${href('ai/dashboard.html')}" data-i18n="ui.openAi">ورود به کارگاه</a>
          </div>
        </div>
      </div>

      <div class="app-sidebar__foot">
        <div class="sidebar-user">
          <img class="avatar avatar--sm" src="${href('assets/img/avatars/avatar-08.svg')}" alt="" width="36" height="36">
          <div class="sidebar-user__meta">
            <span class="sidebar-user__name">سارا محمدی</span>
            <span class="sidebar-user__mail">sara@novaadmin.dev</span>
          </div>
          <button class="icon-btn icon-btn--sm" type="button" data-sidebar-collapse aria-label="جمع کردن" data-i18n-title="ui.collapseSidebar">
            <i class="bi bi-chevron-double-left" data-collapse-icon aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </aside>

    <div class="app-main">
      <!-- @include header.html -->

      <div class="app-content">
        <div class="container-fluid${isDocs ? ' container-docs' : ''}">
          ${isDocs ? docsLayout(page, body) : `<main id="main-content" class="page-body">\n          ${pageHead(page)}\n          ${body}\n          </main>`}
        </div>
      </div>

      <!-- @include footer.html -->
    </div>
  </div>

  <!-- @include overlays.html -->
  <!-- @include customizer.html -->
  <!-- @include scripts.html -->
</body>
</html>
`;
}

function docsLayout(page, body) {
  return `<main id="main-content" class="page-body page-body--docs">
          <div class="docs-shell">
            <aside class="docs-nav" aria-label="مستندات">
              <div class="docs-nav__search">
                <div class="input-group input-group--icon">
                  <i class="bi bi-search" aria-hidden="true"></i>
                  <input type="search" class="form-control" placeholder="جستجو در مستندات…" aria-label="جستجو در مستندات" data-docs-search>
                </div>
              </div>
              <nav class="app-nav app-nav--docs" data-docs-nav aria-label="فهرست مستندات">
                ${renderNav(sidebar, page.url, { docsOnly: true })}
              </nav>
            </aside>
            <div class="docs-content">
              <nav class="breadcrumb-nav" aria-label="مسیر صفحه"><ol class="breadcrumb">
                <li class="breadcrumb__item"><a href="${href('index.html')}"><i class="bi bi-house-door" aria-hidden="true"></i><span data-i18n="ui.home">خانه</span></a></li>
                <li class="breadcrumb__item"><a href="${href('docs/introduction.html')}"><span data-i18n="nav.docs">مستندات</span></a></li>
                <li class="breadcrumb__item" aria-current="page"><span data-i18n="nav.${page.id}">${esc(page.label.fa)}</span></li>
              </ol></nav>
              ${body}
              <nav class="docs-pager" aria-label="صفحه بعدی و قبلی" data-docs-pager></nav>
            </div>
            <aside class="docs-toc" aria-label="در این صفحه">
              <div class="docs-toc__inner">
                <h2 class="docs-toc__title" data-i18n="ui.onThisPage">در این صفحه</h2>
                <ul class="docs-toc__list" data-docs-toc></ul>
                <div class="docs-toc__help">
                  <i class="bi bi-life-preserver" aria-hidden="true"></i>
                  <div>
                    <strong data-i18n="ui.needHelp">نیاز به کمک دارید؟</strong>
                    <a href="${href('system/contact.html')}" data-i18n="ui.contactSupport">تماس با پشتیبانی</a>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>`;
}

/* --------------------------------------------------------------- locales */
function buildLocaleData() {
  const navFaLabels = {};
  const nav = { fa: {}, en: {}, ar: {} };
  const titles = { fa: {}, en: {}, ar: {} };
  for (const page of pages) {
    nav.fa[`nav.${page.id}`] = page.label.fa;
    nav.en[`nav.${page.id}`] = page.label.en;
    nav.ar[`nav.${page.id}`] = page.label.ar;
    titles.fa[page.url] = page.label.fa;
    titles.en[page.url] = page.label.en;
    titles.ar[page.url] = page.label.ar;
  }
  for (const section of sidebar) {
    if (!section.label) continue;
    const key = `section.${slug(section.label.en)}`;
    nav.fa[key] = section.label.fa;
    nav.en[key] = section.label.en;
    nav.ar[key] = section.label.ar;
  }
  /**
   * Groups, superseded ids and nested detail pages are not part of the
   * flattened page list, yet the sidebar and breadcrumbs still hook them with
   * `data-i18n="nav.<id>"`. Emitting a label for *every* node in the tree keeps
   * the language switch complete.
   */
  const walkNav = (items) => {
    for (const item of items) {
      if (item.id && item.label) {
        nav.fa[`nav.${item.id}`] = item.label.fa;
        nav.en[`nav.${item.id}`] = item.label.en;
        nav.ar[`nav.${item.id}`] = item.label.ar;
      }
      if (item.children) walkNav(item.children);
    }
  };
  for (const section of sidebar) walkNav(section.items);
  for (const page of pages) {
    navFaLabels[page.url] = page.label.fa;
  }
  const meta = {};
  for (const page of pages) {
    meta[page.url] = {
      section: page.section?.id ?? 'app',
      kind: page.kind,
      parents: page.parents.map((p) => ({ id: p.id, url: p.url })),
      titleKey: `nav.${page.id}`,
    };
  }
  const order = pages.filter((p) => p.kind === 'doc').map((p) => p.url);
  return { nav, titles, meta, order };
}


/* ------------------------------------------------------------ auth layout  */

/** Auth variations that keep the marketing aside vs. go centred. */
const AUTH_CENTERED = new Set(['auth-login-minimal', 'auth-verify-email', 'auth-two-factor', 'auth-lock-screen', 'auth-logout', 'auth-error']);
const AUTH_MINIMAL = new Set(['auth-login-minimal']);

/**
 * Login / register / 2FA … get their own frameless layout: no sidebar, no
 * header, just the split marketing panel + the card the controller renders
 * into `[data-auth]`.
 */
function authAside(page) {
  return `<aside class="auth-page__aside">
      <a class="brand" href="${href('index.html')}" aria-label="{{APP_NAME}}">
        <img class="brand__mark" src="${href('assets/logo-mark.svg')}" alt="" width="34" height="34">
        <span class="brand__text"><span class="brand__name">{{APP_NAME}}</span><span class="brand__tag">{{TAGLINE}}</span></span>
      </a>

      <div class="auth-headline">
        <h2>{{APP_NAME}} — قالب مدیریت فارسی‌محور</h2>
        <p class="auth-lead">۱۰ داشبورد تخصصی، کارگاه هوش مصنوعی، تقویم شمسی و پشتیبانی کامل RTL؛ آماده برای پروژه بعدی شما.</p>
        <ul class="auth-features">
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> ۲۰۶ صفحه مستقل HTML با ساختار واقعی</li>
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> سه زبان کامل: فارسی، انگلیسی، عربی</li>
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> تم روشن، تاریک و شش پالت رنگی</li>
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> مستندات ۲۳ موضوعی درون قالب</li>
        </ul>
      </div>

      <blockquote class="auth-page__quote">
        <p>«ساخت پنل داخلی که قبلاً دو هفته طول می‌کشید، با NOVAADMIN در دو روز تحویل شد.»</p>
        <footer class="auth-page__quote-author"><img class="avatar avatar--sm" src="${href('assets/img/avatars/avatar-11.svg')}" alt="" width="32" height="32"><span>مهدی رضایی — مدیر فنی</span></footer>
      </blockquote>
    </aside>`;
}

function authShell(page, body) {
  const centered = AUTH_CENTERED.has(page.id);
  const minimal = AUTH_MINIMAL.has(page.id);
  const classes = ['auth-page', centered ? 'auth-page--centered' : '', minimal ? 'auth-page--minimal' : ''].filter(Boolean).join(' ');
  const demoBar = `<div class="auth-tools">
      <button class="btn btn-light btn-sm" type="button" data-theme-toggle><i class="bi bi-circle-half" aria-hidden="true"></i> <span data-i18n="ui.theme">تم</span></button>
      <button class="btn btn-light btn-sm" type="button" data-direction-toggle><i class="bi bi-arrow-left-right" aria-hidden="true"></i> <span data-i18n="ui.direction">جهت</span></button>
      <div class="dropdown">
        <button class="btn btn-light btn-sm" type="button" data-dropdown-toggle="true" aria-expanded="false"><i class="bi bi-translate" aria-hidden="true"></i> <span data-i18n="ui.language">زبان</span></button>
        <ul class="dropdown-menu" data-dropdown-menu data-language-switch data-language-list></ul>
      </div>
      <a class="btn btn-primary btn-sm" href="${href('dashboards/analytics.html')}"><i class="bi bi-play-fill" aria-hidden="true"></i> ورود به دمو بدون ثبت‌نام</a>
    </div>`;

  return `<!doctype html>
<html lang="{{DEFAULT_LANG}}" dir="{{DEFAULT_DIR}}" data-theme="{{DEFAULT_THEME}}" data-theme-mode="{{DEFAULT_THEME}}" data-primary="{{DEFAULT_PRIMARY}}" data-direction="{{DEFAULT_DIR}}" data-density="comfortable" data-font-size="md" data-calendar="{{DEFAULT_CALENDAR}}">
<head>
  <!-- @include head.html -->
  <title>${esc(page.label.fa)} | {{APP_NAME}}</title>
</head>
<body class="app-body app-body--auth" data-page="${page.url}" data-section="auth" data-kind="auth">
  <a class="skip-link" href="#main-content" data-i18n="ui.skipToContent">پرش به محتوای اصلی</a>
  <main id="main-content" class="${classes}">
    ${centered ? '' : authAside(page)}
    <section class="auth-page__main">
      <div class="auth-page__stack">
        <h1 class="visually-hidden">${esc(page.label.fa)} — {{APP_NAME}}</h1>
        <div data-auth>
${body}
        </div>
        ${demoBar}
      </div>
    </section>
  </main>
  <!-- @include overlays.html -->
  <!-- @include customizer.html -->
  <!-- @include scripts.html -->
</body>
</html>
`;
}

/* ----------------------------------------------------------------- write */
/**
 * Writes a page with `@include` directives and `{{TOKEN}}` placeholders already
 * resolved, so the files on disk are complete standalone documents: the dev
 * server, the production build, the smoke harness and the QA pass all read the
 * same markup (`{{ROOT}}` is still resolved later by the Vite plugin, because it
 * depends on the depth of the built page).
 */
function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const resolved = renderPageHtml(contents, { warn: (msg) => console.warn(`  ⚠ ${msg}`) });
  fs.writeFileSync(file, resolved, 'utf8');
}

function main() {
  let generated = 0;
  let authored = 0;
  const report = [];

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });

  for (const page of pages) {
    const { html: body, authored: isAuthored } = readBody(page);
    if (isAuthored) authored += 1;
    generated += 1;
    const file = path.join(PAGES_DIR, page.url);
    if (page.noLayout) {
      write(file, `<!doctype html>
<html lang="{{DEFAULT_LANG}}" dir="{{DEFAULT_DIR}}">
<head>
  <!-- @include head.html -->
  <title>${esc(page.label.fa)} | {{APP_NAME}}</title>
</head>
<body class="landing-body" data-page="${page.url}">
${body}
  <!-- @include overlays.html -->
  <!-- @include scripts.html -->
</body>
</html>
`);
    } else if (page.kind === 'auth') {
      write(file, authShell(page, body));
    } else {
      write(file, shell(page, body));
    }
    report.push({ url: page.url, kind: page.kind, authored: isAuthored });
  }

  const localeData = buildLocaleData();
  write(
    path.join(LOCALES_DIR, 'generated.js'),
    `/* AUTO-GENERATED by tools/build-pages.mjs — do not edit by hand. */\nexport const navLabels = ${JSON.stringify(localeData.nav, null, 2)};\n\nexport const pageTitles = ${JSON.stringify(
      localeData.titles,
      null,
      2,
    )};\n\nexport const pageMeta = ${JSON.stringify(localeData.meta, null, 2)};\n\nexport const docsOrder = ${JSON.stringify(localeData.order, null, 2)};\n\nexport default { navLabels, pageTitles, pageMeta, docsOrder };\n`,
  );

  const byKind = report.reduce((acc, r) => ((acc[r.kind] = (acc[r.kind] || 0) + 1), acc), {});
  console.log(`\n  NOVAADMIN — page generator (${MODE})`);
  console.log('  ─────────────────────────────────────────');
  console.log(`  pages generated : ${generated}   (authored bodies: ${authored})`);
  console.log(`  by kind         : ${Object.entries(byKind).map(([k, v]) => `${k}:${v}`).join('  ')}`);
  console.log('  ─────────────────────────────────────────\n');
}

main();
