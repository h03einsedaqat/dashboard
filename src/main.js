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
import { initCharts } from './js/core/charts.js';
import { initDataTables } from './js/core/datatable.js';
import { initKanban } from './js/core/kanban.js';
import { exportable } from './js/pages/kit.js';
import { initCalendar } from './js/core/calendar.js';
import { storage } from './js/core/storage.js';
import { fixLinks, observeLinks, resolveUrl } from './js/core/links.js';
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
      setTimeout(() => window.location.assign('auth/login.html'), 900);
    }),
  );

  // Network status → offline banner
  const offlineMarkup = `<div class="alert alert--warning alert--outline" data-offline-banner hidden>
      <span class="alert__icon"><i class="bi bi-wifi-off"></i></span>
      <div class="alert__body"><p class="alert__title">اتصال اینترنت قطع است</p><p>تا برقراری اتصال، ممکن است برخی داده‌ها به‌روزرسانی نشوند.</p></div>
    </div>`;
  const host = $('[data-page-head]') ?? $('.app-content .container-fluid') ?? $('.app-content');
  if (host) {
    host.insertAdjacentHTML('afterbegin', offlineMarkup);
    const banner = $('[data-offline-banner]', host);
    const sync = () => {
      if (banner) banner.hidden = navigator.onLine;
    };
    window.addEventListener('online', () => {
      sync();
      toast.success('اتصال برقرار شد', 'همگام‌سازی داده‌ها ادامه یافت.');
    });
    window.addEventListener('offline', sync);
    sync();
  }

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
  'ui/': async () => (await import('./js/pages/content.js')).initUiKit(),
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

async function boot() {
  initI18n();
  initThemeControls();
  layout.init();
  initDropdowns();
  initChrome();
  initForms();
  initUi();
  initShortcuts();
  initMisc();
  exposeApi();

  // Page controllers run first: when they render an authored body they mark the
  // placeholder as claimed, and the generic renderer only fills what is left.
  try {
    await route();
  } catch (error) {
    reportError(error);
    toast.danger('خطا در بارگذاری صفحه', 'کنترل‌کننده این صفحه با خطا مواجه شد.');
  }

  await renderGenericApps();
  initDataTables();
  exportable(document);

  // Pages live one folder deep, so links written as `users/list.html` must be
  // normalised for the current depth. The observer keeps later injections
  // (table reloads, kanban, chat, toasts) working as well.
  fixLinks(document);
  observeLinks(document.body);
  initCharts();
  $$('[data-kanban]').forEach((node) => initKanban(node));
  $$('[data-calendar]').forEach((node) => initCalendar(node));

  // Late panels (opened from the header) also need the small UI behaviours.
  bus.on(EVENTS.dataChanged, () => initUi());
  document.documentElement.classList.add('app-ready');
  bus.emit('app:ready', { page: document.body.dataset.page });
}

ready(boot);

export { boot };
export default { boot };
