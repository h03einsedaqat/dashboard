/**
 * NOVAADMIN — application bootstrap
 * ------------------------------------------------------------------
 * Single ES2022 entry for every page. Responsibilities:
 *   1. start the design-system layer (i18n → theme → layout → chrome → forms → ui)
 *   2. render the generic body of pages that have no authored partial yet
 *   3. load the page controller for the current page (lazy, code-split)
 *   4. wire global shortcuts, error handling and the public console API
 *
 * Nothing here reaches for `window` globals beyond the documented `window.NOVA`
 * debugging surface; every module keeps its own scope.
 */
import { $, $$, ready, on } from './js/core/dom.js';
import { bus, EVENTS } from './js/core/bus.js';
import { toast } from './js/core/toast.js';
import { modal } from './js/core/modal.js';
import { i18n, initI18n, setLanguage } from './js/core/i18n.js';
import { theme, initThemeControls } from './js/core/theme.js';
import { layout } from './js/core/layout.js';
import { chrome, initChrome, openPalette, openShortcuts, openCustomizer, closeCustomizer } from './js/core/chrome.js';
import { initForms } from './js/core/form.js';
import { initUi } from './js/core/ui.js';
import { initDropdowns } from './js/core/dropdown.js';
import { initCharts, markControllerOwned, settlePendingCharts } from './js/core/charts.js';
import { apply as applyPhrases, observe as observePhrases, registerPhrases, registerPatterns, setPhraseLanguage } from './js/core/translate.js';
import { en as phrasesEn, ar as phrasesAr, PATTERNS } from './locales/phrases.js';
import { initDataTables } from './js/core/datatable.js';
import { initKanban } from './js/core/kanban.js';
import { exportable } from './js/pages/kit.js';
import { initCalendar } from './js/core/calendar.js';
import { storage } from './js/core/storage.js';
import { beginProgress, endProgress, initConnectivity, initKeepAlive } from './js/core/load.js';
import { fixLinks, observeLinks, resolveUrl, goTo } from './js/core/links.js';
import { reconcilePageHeads, observePageHeads } from './js/core/heads.js';
import { renderGenericApps } from './js/pages/generic.js';
import { initDashboard, initDashboardTables } from './js/pages/dashboards.js';
import { config } from './config/config.js';
import * as services from './services/index.js';

/* ------------------------------------------------------------- global errors */

function reportError(error) {
  console.error('[NOVAADMIN]', error);
}

window.addEventListener('error', (event) => reportError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => reportError(event.reason));

/* --------------------------------------------------------------- shortcuts */

function initShortcuts() {
  on(document, 'keydown', (event) => {
    const meta = event.ctrlKey || event.metaKey;
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    // Ctrl/Cmd + K — command palette (works while typing as well)
    if (meta && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
      return;
    }
    if (typing) return;

    if (meta && event.key === '/') {
      event.preventDefault();
      openShortcuts();
      return;
    }
    if (event.key === '?' && event.shiftKey) {
      event.preventDefault();
      openShortcuts();
      return;
    }
    if (meta && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      layout.toggleCollapse();
      return;
    }
    if (meta && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      toast.info('حالت نمایش تغییر کرد', theme.toggleTheme() === 'dark' ? 'تم تاریک فعال شد.' : 'تم روشن فعال شد.');
      return;
    }
    if (meta && event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      theme.toggleDirection();
      return;
    }
    if (meta && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      const order = ['fa', 'en', 'ar'];
      const next = order[(order.indexOf(i18n.lang) + 1) % order.length];
      setLanguage(next);
      toast.info('زبان تغییر کرد', `زبان فعلی: ${i18n.languageName(next)}`);
      return;
    }
    if (event.key === 'Escape') {
      closeCustomizer();
      return;
    }
    if (event.altKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      document.querySelector('[data-export]')?.click();
    }
  });
}

/* ------------------------------------------------------- miscellaneous wiring */

function initMisc() {
  // Fullscreen toggle in the header
  $$('[data-fullscreen]').forEach((button) =>
    on(button, 'click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        toast.warning('تمام‌صفحه فعال نشد', 'مرورگر شما از این قابلیت پشتیبانی نمی‌کند.');
      }
    }),
  );

  // Shortcut hints injected into the UI (`Ctrl K` vs `⌘ K`)
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
  $$('[data-kbd]').forEach((node) => {
    const map = { 'cmd-k': isMac ? '⌘ K' : 'Ctrl K', esc: 'Esc', 'cmd-b': isMac ? '⌘ B' : 'Ctrl B' };
    if (map[node.dataset.kbd]) node.textContent = map[node.dataset.kbd];
  });

  // Logout + account menu
  $$('[data-logout]').forEach((button) =>
    on(button, 'click', async () => {
      const ok = await modal.confirm({ title: 'خروج از حساب', text: 'از حساب کاربری خود خارج می‌شوید؟', tone: 'danger', confirmText: 'خروج' });
      if (!ok) return;
      toast.info('خروج انجام شد', 'در حال انتقال به صفحه ورود…');
      setTimeout(() => goTo('auth/login.html'), 700);
    }),
  );

  /**
   * Network status → a quiet pill, not an alert banner.
   *
   * The banner used to be injected at the top of the content area, so a three
   * second proxy hiccup pushed the whole page down and looked like a connection
   * failure of the application itself. `initConnectivity()` waits out short
   * blips, never moves the layout, and re-syncs charts and tables on its own
   * when the link comes back.
   */
  initConnectivity();
  initKeepAlive();

  // Header search trigger already opens the palette through data-command-open
  $$('[data-sidebar-close]').forEach((button) => on(button, 'click', () => layout.closeDrawer()));

  // Prevent dead `#` links from jumping to top
  on(document, 'click', (event) => {
    const link = event.target.closest('a[href="#"]');
    if (link && !link.hasAttribute('data-dropdown-toggle')) {
      event.preventDefault();
      toast.info('نمایشی', 'این پیوند در نسخه نمایشی مقصدی ندارد.');
    }
  });
}

/* ------------------------------------------------------- routing resilience */

/** `Failed to fetch dynamically imported module` — the bundler restarted. */
function isChunkLoadFailure(error) {
  const message = String(error?.message ?? error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(message);
}

/**
 * Last-resort body state. The page keeps its header, sidebar and every other
 * panel; only the content slot explains what happened and offers a retry.
 */
function renderRouteFailure(error) {
  const target = $('[data-app]') ?? $('.page-body') ?? $('.app-content');
  if (!target) {
    toast.danger('خطا در بارگذاری صفحه', 'کنترل‌کننده این صفحه با خطا مواجه شد.');
    return;
  }
  target.innerHTML = `<div class="state-panel state-panel--error" role="alert">
      <span class="state-panel__icon"><i class="bi bi-plugin" aria-hidden="true"></i></span>
      <p class="state-panel__title">این بخش بارگذاری نشد</p>
      <p class="state-panel__text">ماژول این صفحه با خطا مواجه شد. با «تلاش دوباره» دوباره امتحان کنید؛ بقیه صفحات بدون مشکل کار می‌کنند.</p>
      <div class="state-panel__actions">
        <button class="btn btn-primary btn-sm" type="button" data-route-retry><i class="bi bi-arrow-repeat" aria-hidden="true"></i> تلاش دوباره</button>
        <a class="btn btn-light btn-sm" href="./"><i class="bi bi-house-door" aria-hidden="true"></i> خانه</a>
      </div>
    </div>`;
  on($('[data-route-retry]', target), 'click', () => window.location.reload());
  toast.warning('بارگذاری کامل نشد', 'بخش میانی صفحه با خطا مواجه شد.');
}

/* ------------------------------------------------------------- page router */

const AREA_CONTROLLERS = {
  'dashboards/': async () => {
    await initDashboard();
    initDashboardTables();
  },
  'ecommerce/': async () => (await import('./js/pages/modules.js')).initEcommerce(),
  'crm/': async () => (await import('./js/pages/modules.js')).initCrm(),
  'finance/': async () => (await import('./js/pages/modules.js')).initFinance(),
  'projects/': async () => (await import('./js/pages/modules.js')).initProjects(),
  'support/': async () => (await import('./js/pages/modules.js')).initSupport(),
  'hr/': async () => (await import('./js/pages/modules.js')).initHr(),
  'logistics/': async () => (await import('./js/pages/modules.js')).initLogistics(),
  'reports/': async () => (await import('./js/pages/modules.js')).initReports(),
  'users/': async () => (await import('./js/pages/modules.js')).initUsers(),
  'ai/': async () => (await import('./js/pages/ai.js')).initAiWorkspace(),
  'apps/': async () => (await import('./js/pages/apps.js')).initApp(),
  'cms/': async () => (await import('./js/pages/apps.js')).initCms(),
  'settings/': async () => (await import('./js/pages/content.js')).initSettings(),
  'profile/': async () => (await import('./js/pages/content.js')).initProfile(),
  'docs/': async () => (await import('./js/pages/content.js')).initDocs(),
  'auth/': async () => (await import('./js/pages/content.js')).initAuth(),
  'ui/': async () => (await import('./js/pages/ui-kit.js')).initUiKit(),
  'system/': async () => (await import('./js/pages/content.js')).initSystemPages(),
  'customers/': async () => (await import('./js/pages/modules.js')).initCustomers(),
  'widgets': async () => (await import('./js/pages/content.js')).initWidgetsPage(),
};

const SECTION_CONTROLLERS = {
  system: async () => (await import('./js/pages/content.js')).initSystemPages(),
  landing: async () => (await import('./js/pages/content.js')).initLanding(),
};

async function route() {
  const body = document.body;
  if (!body) return;
  const page = body.dataset.page ?? '';
  const section = body.dataset.section ?? '';

  // Order matters: the search page lives in `system/` but has its own view.
  if (page.endsWith('search-results.html')) {
    await (await import('./js/pages/content.js')).initSearchResults();
    return;
  }
  if (page === 'index.html') {
    await (await import('./js/pages/content.js')).initLanding();
    return;
  }
  if (page === 'preview.html') {
    await (await import('./js/pages/content.js')).initPreview();
    return;
  }
  for (const [prefix, loader] of Object.entries(AREA_CONTROLLERS)) {
    if (page.startsWith(prefix)) {
      await loader();
      return;
    }
  }
  if (SECTION_CONTROLLERS[section]) await SECTION_CONTROLLERS[section]();
}

/* -------------------------------------------------------------- public API */

function exposeApi() {
  window.NOVA = {
    version: config.version,
    config,
    services,
    bus,
    toast,
    modal,
    theme,
    layout,
    i18n,
    charts: { refresh: () => import('./js/core/charts.js').then((m) => m.refreshCharts()) },
    openPalette,
    openShortcuts,
    openCustomizer,
    setLanguage,
    /** Console helper: `NOVA.url('users/list.html')` → depth-correct link. */
    url: resolveUrl,
    /** Console helper: `NOVA.data('orders', { perPage: 5 })` */
    data: (resource, query) => services.default[resource]?.list(query ?? {}),
    resetPreferences: () => {
      storage.resetPreferences();
      window.location.reload();
    },
  };
}

/* ---------------------------------------------------------------- start up */

/** Login-first demo flow: panel pages require a (mock) session. */
function authGuard() {
  const body = document.body;
  const page = body?.dataset.page ?? '';
  const kind = body?.dataset.kind ?? '';
  const isPublic =
    !page || page === 'index.html' || page === 'preview.html' || kind === 'auth' || kind === 'landing' || /^(auth|system|docs)\//.test(page) || body?.dataset.section === 'landing';
  if (isPublic || config.authGuard === false) {
    document.documentElement.classList.remove('is-guarded');
    return true;
  }
  let session = null;
  try {
    session = window.localStorage.getItem('nova:session') || window.sessionStorage.getItem('nova:session');
  } catch {
    session = '1';
  }
  if (session) {
    document.documentElement.classList.remove('is-guarded');
    return true;
  }
  goTo(`auth/login.html?next=${encodeURIComponent(page)}`, { replace: true });
  return false;
}

async function boot() {
  if (!authGuard()) return;
  /**
   * The phrase book is registered *before* i18n boots so a stored language is
   * reflected on the very first paint (see `core/translate.js`).
   */
  registerPhrases('en', phrasesEn);
  registerPhrases('ar', phrasesAr);
  registerPatterns('en', PATTERNS.en);
  registerPatterns('ar', PATTERNS.ar);
  initI18n();
  /** The language this document was rendered in; a switch away from it reloads. */
  const bootLanguage = i18n.lang;
  setPhraseLanguage(i18n.lang);
  applyPhrases(document.body);
  observePhrases(document.body);
  initThemeControls();
  layout.init();
  initDropdowns();
  initChrome();
  initForms();
  initUi();
  initShortcuts();
  initMisc();
  exposeApi();

  /**
   * Page controllers run first: when they render an authored body they mark the
   * placeholder as claimed, and the generic renderer only fills what is left.
   *
   * The whole routing phase is wrapped in the top progress bar plus a guarded
   * boundary: a controller that throws (or a lazy chunk that fails to load
   * after a dev-server restart) leaves the chrome intact, shows a readable
   * inline state and offers a retry instead of a blank screen.
   */
  const stopProgress = beginProgress();
  try {
    await route();
  } catch (error) {
    if (isChunkLoadFailure(error)) {
      /**
       * A stale dynamic import after the bundler restarted is not an
       * application error: reload once and it resolves itself.
       */
      /* The flag used to live for the whole session, so after the first
         dev-server hiccup every later one ended on the error panel until the
         browser was restarted. It is now a short time window instead. */
      const last = Number(sessionStorage.getItem('nova:chunk-reloaded') ?? 0);
      if (Date.now() - last > 15000) {
        sessionStorage.setItem('nova:chunk-reloaded', String(Date.now()));
        window.location.reload();
        return;
      }
    }
    reportError(error);
    renderRouteFailure(error);
  } finally {
    endProgress();
    stopProgress();
  }

  const stopPaint = beginProgress();
  try {
    await renderGenericApps();
    initDataTables();
    exportable(document);
    reconcilePageHeads();
  } catch (error) {
    reportError(error);
  } finally {
    endProgress();
    stopPaint();
  }

  // Pages live one folder deep, so links written as `users/list.html` must be
  // normalised for the current depth. The observer keeps later injections
  // (table reloads, kanban, chat, toasts) working as well.
  fixLinks(document);
  observeLinks(document.body);
  /**
   * Controller-owned chart placeholders (`data-chart-key` without series) are
   * drawn by their page controller; everything declarative is drawn here. Any
   * placeholder left over gets a readable empty state instead of a blank box.
   */
  markControllerOwned(document);
  await initCharts();
  settlePendingCharts(document);
  /** Late content (tables, footers, badges) gets the active language too. */
  applyPhrases(document.body);
  /** Header dedup: the controller's own header card is folded into the page
      head so a screen opens with one toolbar instead of two. */
  observePageHeads(document.body);
  $$('[data-kanban]').forEach((node) => initKanban(node));
  $$('[data-calendar]').forEach((node) => initCalendar(node));

  // Late panels (opened from the header) also need the small UI behaviours.
  /*
   * `initUi()` binds at document level and is idempotent per root, so a second
   * call here would only ever double-register the same delegated listeners.
   * Widgets that genuinely need per-node setup are initialised by the controller
   * that paints them.
   */

  /**
   * Language change → re-render the page.
   *
   * The phrase book repaints every authored string instantly, but three layers
   * cannot be patched in place: numbers/currency (rendered once by
   * `core/numbers.js`), dates (`core/jalali.js`) and everything the page
   * controllers and ApexCharts build from data. Re-running the controllers
   * would stack duplicate delegated listeners, so the page re-renders the way
   * every other admin template does it — one clean reload that still lands
   * instantly because `theme-boot.js` applies the stored language before the
   * first paint (no flash of Persian).
   */
  bus.on(EVENTS.language, ({ lang } = {}) => {
    if (!lang || lang === bootLanguage) return;
    if (window.__novaLanguageReload) return;
    window.__novaLanguageReload = true;
    document.documentElement.classList.add('is-switching-language');
    window.setTimeout(() => {
      /* Some embedded webviews expose a `location` without `reload`; a plain
         navigation to the same URL is an equivalent, safe fallback. */
      if (typeof window.location.reload === 'function') window.location.reload();
      else window.location.assign(window.location.href);
    }, 80);
  });
  document.documentElement.classList.add('app-ready');
  bus.emit('app:ready', { page: document.body.dataset.page });
}

ready(boot);

export { boot };
export default { boot };
