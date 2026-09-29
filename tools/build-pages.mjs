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

/**
 * Reads the authored body for a page.
 *
 * Authored partials are *fragments*: the shell (`shell()`, `authShell()`,
 * `noLayout`) supplies `<html>`, `<head>` and `<body>`. A partial that still
 * carries its own document wrapper would be nested inside the generated one and
 * break both the parser and the page structure, so it is unwrapped here and the
 * author is warned.
 */
function readBody(page) {
  const file = path.join(BODY_DIR, page.url);
  if (fs.existsSync(file)) {
    let html = fs.readFileSync(file, 'utf8').trim();
    if (/<!doctype|<html[\s>]/i.test(html)) {
      console.warn(`  ⚠ ${page.url}: authored partial contains a full document — unwrapped to a body fragment.`);
      const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      html = (match ? match[1] : html).trim();
    }
    return { html, authored: true };
  }
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
const AUTH_CENTERED = new Set(['auth-login-minimal', 'auth-verify', 'auth-2fa', 'auth-lock', 'auth-logout', 'auth-error', 'auth-verify-email', 'auth-two-factor', 'auth-lock-screen']);
const AUTH_MINIMAL = new Set(['auth-login-minimal']);

/**
 * Login / register / 2FA … get their own frameless layout: no sidebar, no
 * header, just the split marketing panel + the card the controller renders
 * into `[data-auth]`.
 */
function authAside(page) {
  const shot = (mode) => `${href('assets/img/previews/')}analytics-${mode}.svg`;
  return `<aside class="auth-page__aside">
      <div class="auth-bg" aria-hidden="true">
        <span class="auth-bg__glow auth-bg__glow--a"></span>
        <span class="auth-bg__glow auth-bg__glow--b"></span>
        <span class="auth-bg__glow auth-bg__glow--c"></span>
        <span class="auth-bg__grid"></span>
        <span class="auth-bg__ring"></span>
      </div>

      <a class="brand auth-brand" href="${href('index.html')}" aria-label="{{APP_NAME}}">
        <img class="brand__mark" src="${href('assets/logo-mark.svg')}" alt="" width="34" height="34">
        <span class="brand__text"><span class="brand__name">{{APP_NAME}}</span><span class="brand__tag">{{TAGLINE}}</span></span>
      </a>

      <div class="auth-headline">
        <span class="auth-badge"><span class="auth-badge__dot"></span> نسخه {{VERSION}} · با تقویم شمسی و RTL کامل</span>
        <h2>پنل مدیریتى که <em>واقعاً</em> تحویل داده می‌شود</h2>
        <p class="auth-lead">۱۰ داشبورد تخصصی، کارگاه هوش مصنوعی، لایه داده‌ای مستقل و سه زبان — همه در یک بستر HTML که بدون بک‌اند هم بالا می‌آید.</p>
        <ul class="auth-features">
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> <span>۲۰۶ صفحه مستقل با ساختار واقعی و بدون وابستگی</span></li>
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> <span>لایه داده قابل تعویض؛ یک قرارداد برای همه سرویس‌ها</span></li>
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> <span>تم روشن/تاریک، شش پالت رنگ و شش چیدمان زنده</span></li>
          <li><i class="bi bi-check2-circle" aria-hidden="true"></i> <span>مستندات ۲۳ موضوعی و الگوهای قابل کپی</span></li>
        </ul>
      </div>

      <figure class="auth-device">
        <div class="auth-device__frame">
          <span class="auth-device__bar"><i></i><i></i><i></i><b>{{APP_NAME}}</b></span>
          <img class="auth-device__shot" data-auth-shot="light" src="${shot('light')}" alt="پیش‌نمایش داشبورد تحلیل در تم روشن" width="1200" height="750" loading="lazy" decoding="async">
          <img class="auth-device__shot" data-auth-shot="dark" src="${shot('dark')}" alt="پیش‌نمایش داشبورد تحلیل در تم تاریک" width="1200" height="750" loading="lazy" decoding="async" hidden>
        </div>
        <figcaption class="auth-device__caption">همین داشبورد، دو تم — با کلید بالای همین پنل جابه‌جا شوید</figcaption>
      </figure>

      <div class="auth-stats">
        <span class="auth-stats__item"><strong class="numeric">۲۰۶</strong><small>صفحه آماده</small></span>
        <span class="auth-stats__item"><strong class="numeric">۱۰</strong><small>داشبورد تخصصی</small></span>
        <span class="auth-stats__item"><strong class="numeric">۳</strong><small>زبان کامل</small></span>
        <span class="auth-stats__item"><strong class="numeric">۶</strong><small>حالت چیدمان</small></span>
      </div>

      <blockquote class="auth-page__quote">
        <p>«ساخت پنل داخلی که قبلاً دو هفته طول می‌کشید، با {{APP_NAME}} در دو روز تحویل شد.»</p>
        <footer class="auth-page__quote-author"><img class="avatar avatar--sm" src="${href('assets/img/avatars/avatar-11.svg')}" alt="" width="32" height="32"><span>مهدی رضایی — مدیر فنی</span></footer>
      </blockquote>
    </aside>`;
}

function loginProShell(page) {
  return `<!doctype html>
<html lang="{{DEFAULT_LANG}}" dir="{{DEFAULT_DIR}}" data-theme="{{DEFAULT_THEME}}" data-theme-mode="{{DEFAULT_THEME}}" data-primary="{{DEFAULT_PRIMARY}}" data-direction="{{DEFAULT_DIR}}" data-density="comfortable" data-font-size="md" data-calendar="{{DEFAULT_CALENDAR}}">
<head>
  <!-- @include head.html -->
  <title>ورود | {{APP_NAME}}</title>
</head>
<body class="app-body app-body--auth lx-body" data-page="auth/login.html" data-section="auth" data-kind="auth">
  <a class="skip-link" href="#main-content" data-i18n="ui.skipToContent">پرش به محتوای اصلی</a>
  <main id="main-content" class="lx-page">
    <h1 class="visually-hidden">ورود به {{APP_NAME}}</h1>
    <div class="lx">
    <section class="lx-side" aria-label="فرم ورود">
      <div class="lx-top">
        <a class="lx-back" href="${href('index.html')}"><i class="bi bi-arrow-right" aria-hidden="true"></i> صفحه اصلی</a>
        <div class="lx-top__tools">
          <div class="dropdown">
            <button class="lx-icon-btn" type="button" data-dropdown-toggle="true" aria-expanded="false" aria-label="تغییر زبان"><i class="bi bi-translate" aria-hidden="true"></i></button>
            <ul class="dropdown-menu" data-dropdown-menu data-language-switch data-language-list></ul>
          </div>
          <button class="lx-icon-btn" type="button" data-theme-toggle aria-label="تغییر تم"><i class="bi bi-moon-stars" aria-hidden="true"></i></button>
        </div>
      </div>

      <div class="lx-card" data-lx-card>
        <a class="lx-logo" href="${href('index.html')}" aria-label="{{APP_NAME}}">
          <span class="lx-logo__mark"><img src="${href('assets/logo-mark.svg')}" alt="" width="30" height="30"></span>
          <span class="lx-logo__text"><b>NOVA<em>ADMIN</em></b><small>پنل مدیریت هوشمند</small></span>
        </a>
        <header class="lx-head">
          <h2>خوش برگشتید <span class="lx-wave" aria-hidden="true">👋</span></h2>
          <p>برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.</p>
        </header>

        <button class="lx-demo" type="button" data-lx-demo>
          <span class="lx-demo__icon"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i></span>
          <span class="lx-demo__text"><strong>ورود سریع با حساب دمو</strong><small dir="ltr">demo@novaadmin.dev</small></span>
          <i class="bi bi-arrow-left lx-demo__arrow" aria-hidden="true"></i>
        </button>

        <div class="lx-divider"><span>یا ورود با ایمیل</span></div>

        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="email">
            <i class="bi bi-envelope lx-field__icon" aria-hidden="true"></i>
            <input id="lx-email" class="lx-field__input" type="email" name="email" placeholder=" " autocomplete="email" dir="ltr" required>
            <label for="lx-email" class="lx-field__label">آدرس ایمیل</label>
            <span class="lx-field__ok"><i class="bi bi-check-circle-fill" aria-hidden="true"></i></span>
          </div>
          <p class="lx-error" data-error="email" hidden></p>

          <div class="lx-field" data-field="password">
            <i class="bi bi-shield-lock lx-field__icon" aria-hidden="true"></i>
            <input id="lx-password" class="lx-field__input" type="password" name="password" placeholder=" " autocomplete="current-password" dir="ltr" required minlength="6">
            <label for="lx-password" class="lx-field__label">رمز عبور</label>
            <button class="lx-eye" type="button" data-lx-eye aria-label="نمایش رمز عبور"><i class="bi bi-eye" aria-hidden="true"></i></button>
          </div>
          <p class="lx-error" data-error="password" hidden></p>
          <p class="lx-caps" data-lx-caps hidden><i class="bi bi-capslock-fill" aria-hidden="true"></i> Caps Lock روشن است</p>

          <div class="lx-row">
            <label class="lx-switch"><input type="checkbox" name="remember" checked><span class="lx-switch__track"><span></span></span> مرا به خاطر بسپار</label>
            <a class="lx-link" href="${href('auth/forgot-password.html')}">فراموشی رمز؟</a>
          </div>

          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">ورود به پنل</span>
            <i class="bi bi-arrow-left lx-submit__icon" aria-hidden="true"></i>
            <span class="lx-submit__spinner" aria-hidden="true"></span>
          </button>
        </form>

        <div class="lx-divider"><span>یا ادامه با</span></div>
        <div class="lx-social">
          <button type="button" class="lx-social__btn" data-lx-social="Google"><svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>گوگل</span></button>
          <button type="button" class="lx-social__btn" data-lx-social="GitHub"><i class="bi bi-github" aria-hidden="true"></i><span>گیت‌هاب</span></button>
          <button type="button" class="lx-social__btn" data-lx-social="Microsoft"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg><span>مایکروسافت</span></button>
        </div>

        <p class="lx-foot">حساب کاربری ندارید؟ <a href="${href('auth/register.html')}">ایجاد حساب رایگان</a></p>
      </div>

      <ul class="lx-trust">
        <li><i class="bi bi-shield-check" aria-hidden="true"></i> اتصال رمزنگاری‌شده SSL</li>
        <li><i class="bi bi-fingerprint" aria-hidden="true"></i> ورود دومرحله‌ای</li>
        <li><i class="bi bi-lock" aria-hidden="true"></i> حریم خصوصی داده‌ها</li>
      </ul>

      <div class="lx-success" data-lx-success hidden>
        <div class="lx-success__inner">
          <svg class="lx-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-16"/></svg>
          <h2>خوش آمدید، سارا!</h2>
          <p>در حال آماده‌سازی داشبورد شما…</p>
          <div class="lx-progress"><span></span></div>
        </div>
      </div>
    </section>

    <section class="lx-visual" aria-hidden="true">
      <div class="lx-aurora"><span></span><span></span><span></span></div>
      <div class="lx-grid"></div>
      <div class="lx-particles"></div>

      <div class="lx-copy">
        <span class="lx-pill"><span class="lx-pill__dot"></span> نسخه ۱٫۰٫۲ · همه سرویس‌ها فعال</span>
        <h2>کسب‌وکارتان را <span class="lx-grad">هوشمندتر</span> مدیریت کنید</h2>
        <p>۱۰ داشبورد تخصصی، کارگاه هوش مصنوعی، گزارش‌های لحظه‌ای و ده‌ها ماژول آماده — همه در یک پنل فارسی.</p>
      </div>

      <div class="lx-stage">
        <figure class="lx-shot lx-shot--back"><img src="${href('assets/img/shots/ai-studio-dark.jpg')}" alt="" width="1440" height="900"></figure>
        <figure class="lx-shot lx-shot--front">
          <span class="lx-shot__bar"><i></i><i></i><i></i><b>novaadmin.app/dashboards/analytics</b></span>
          <img src="${href('assets/img/shots/analytics-dark.jpg')}" alt="" width="1440" height="900">
        </figure>
        <div class="lx-chip lx-chip--rev">
          <span class="lx-chip__icon lx-chip__icon--green"><i class="bi bi-graph-up-arrow"></i></span>
          <div><small>درآمد این ماه</small><strong>۱۸٫۶ میلیارد</strong></div>
          <b class="lx-chip__delta">+۱۲٫۴٪</b>
        </div>
        <div class="lx-chip lx-chip--ai">
          <span class="lx-chip__icon lx-chip__icon--ai"><i class="bi bi-stars"></i></span>
          <div><small>دستیار هوشمند</small><strong>۳ بینش جدید برای امروز</strong></div>
        </div>
        <div class="lx-chip lx-chip--sec">
          <span class="lx-chip__icon lx-chip__icon--blue"><i class="bi bi-shield-lock-fill"></i></span>
          <div><small>امنیت حساب</small><strong>محافظت‌شده</strong></div>
        </div>
      </div>

      <figure class="lx-quote" data-lx-quote>
        <div class="lx-quote__stars">★★★★★</div>
        <blockquote data-lx-quote-text>«ساخت پنل داخلی که قبلاً دو هفته طول می‌کشید، با نوا ادمین در دو روز تحویل شد.»</blockquote>
        <figcaption><img data-lx-quote-avatar src="${href('assets/img/avatars/avatar-11.svg')}" alt="" width="40" height="40"><span><b data-lx-quote-name>مهدی رضایی</b><small data-lx-quote-role>مدیر فنی، داده‌پردازان پارس</small></span>
          <span class="lx-quote__dots"><i class="is-active"></i><i></i><i></i></span></figcaption>
      </figure>
    </section>
  </div>
  </main>
  <!-- @include overlays.html -->
  <!-- @include customizer.html -->
  <!-- @include scripts.html -->
</body>
</html>`;
}

function authShell(page, body) {
  if (page.url === 'auth/login.html') {
    return loginProShell(page);
  }
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
<html lang="{{DEFAULT_LANG}}" dir="{{DEFAULT_DIR}}" data-theme="{{DEFAULT_THEME}}" data-theme-mode="{{DEFAULT_THEME}}" data-primary="{{DEFAULT_PRIMARY}}" data-layout="{{DEFAULT_LAYOUT}}" data-direction="{{DEFAULT_DIR}}" data-density="comfortable" data-font-size="md" data-sidebar-style="fixed" data-calendar="{{DEFAULT_CALENDAR}}">
<head>
  <!-- @include head.html -->
  <title>${esc(page.label.fa)} | {{APP_NAME}}</title>
</head>
<body class="landing landing-body" data-page="${page.url}" data-section="${page.section ?? 'landing'}" data-kind="${page.kind}">
  <a class="skip-link" href="#main-content" data-i18n="ui.skipToContent">پرش به محتوای اصلی</a>
${body}
  <!-- @include overlays.html -->
  <!-- @include customizer.html -->
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
