/**
 * NOVAADMIN — application chrome
 * ------------------------------------------------------------------
 * Everything the header and overlays need, shared by every page:
 *
 *   • command palette (Ctrl/⌘ K) …… #command-palette  (src/partials/overlays.html)
 *   • keyboard shortcut help  ……… #shortcuts-modal
 *   • notifications panel    ……… [data-notification-list]
 *   • theme customizer       ……… #theme-customizer   (src/partials/customizer.html)
 *   • dashboard widget editor ……… [data-widget-editor]
 *   • demo switcher          ……… [data-demo-list]
 *
 * The markup lives in the HTML partials (server-rendered on every page), this
 * module only wires behaviour — one source of truth per feature.
 */
import { $, $$, on, create, render, escapeHtml, debounce, lockScroll, focusTrap } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { toast } from './toast.js';
import { modal } from './modal.js';
import { storage, KEYS } from './storage.js';
import { theme } from './theme.js';
import { t, setLanguage, applyTranslations, dict } from './i18n.js';
import { toDigits, toLatinDigits } from './numbers.js';
import { searchService, commandService, settingsService, notificationService, demoService } from '../../services/index.js';
import { config } from '../../config/config.js';
import { createSortable } from './dragdrop.js';

const state = {
  paletteOpen: false,
  results: [],
  index: 0,
  recent: storage.get(KEYS.recentSearches, []) ?? [],
  release: null,
};

/* ============================================================ command palette */

const paletteEl = () => $('#command-palette');

export function openPalette(initial = '') {
  const host = paletteEl();
  if (!host) return;
  state.paletteOpen = true;
  host.hidden = false;
  lockScroll(true);
  const input = $('[data-command-input]', host);
  if (input) {
    input.value = initial;
    setTimeout(() => input.focus(), 40);
  }
  renderPalette(initial);
  state.release = focusTrap(host);
}

export function closePalette() {
  const host = paletteEl();
  if (!host) return;
  const input = $('[data-command-input]', host);
  if (input) input.value = '';
  host.hidden = true;
  state.paletteOpen = false;
  state.results = [];
  lockScroll(false);
  state.release?.();
  state.release = null;
}

export function togglePalette() {
  if (state.paletteOpen) closePalette();
  else openPalette();
}

function itemMarkup(item, index) {
  const hint = item.hint ?? '';
  return `<button type="button" class="command-item" role="option" data-command-index="${index}" ${
    item.url ? `data-command-url="${escapeHtml(item.url)}"` : `data-command-action="${escapeHtml(item.action ?? '')}"`
  }>
    <span class="command-item__icon"><i class="bi bi-${escapeHtml(item.icon ?? 'dot')}" aria-hidden="true"></i></span>
    <span class="command-item__text">${escapeHtml(item.label ?? item.title ?? '')}${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span>
    <span class="command-item__meta">${escapeHtml(hint)}</span>
  </button>`;
}

function groupMarkup(label, items, offset) {
  if (!items.length) return '';
  return `<div class="command-group"><p class="command-group__label">${escapeHtml(label)}</p>${items.map((item, i) => itemMarkup(item, offset + i)).join('')}</div>`;
}

async function renderPalette(term = '') {
  const host = paletteEl();
  const body = $('[data-command-results]', host);
  if (!body) return;
  const needle = term.trim();
  const blocks = [];

  if (!needle && state.recent.length) {
    blocks.push(
      groupMarkup(
        t('palette.recent', 'جستجوهای اخیر'),
        state.recent.slice(0, 4).map((entry) => ({ label: entry.title, url: entry.url, icon: 'clock-history' })),
        0,
      ),
    );
  }

  if (needle) {
    const found = await searchService.search(needle, { limit: 6 });
    const pages = found.items.map((item) => ({ label: item.title, description: item.description, url: item.url, icon: 'file-earmark-text' }));
    let offset = 0;
    blocks.push(groupMarkup(t('palette.pages', 'صفحات'), pages, offset));
    offset += pages.length;
    const groups = await commandService.filter(needle);
    groups.forEach((group) => {
      blocks.push(groupMarkup(group.group, group.items, offset));
      offset += group.items.length;
    });
  } else {
    const groups = await commandService.list();
    let offset = 0;
    groups.forEach((group) => {
      blocks.push(groupMarkup(group.group, group.items, offset));
      offset += group.items.length;
    });
  }

  render(
    body,
    blocks.filter(Boolean).join('') ||
      `<div class="command-empty"><i class="bi bi-search" aria-hidden="true"></i><p>نتیجه‌ای یافت نشد</p><small>املا را بررسی کنید یا عبارت دیگری بنویسید.</small></div>`,
  );

  state.results = $$('.command-item', body);
  state.index = 0;
  highlightResult();
  bus.emit('palette:rendered', { count: state.results.length, term: needle });
}

function highlightResult() {
  state.results.forEach((node, index) => {
    const active = index === state.index;
    node.classList.toggle('is-active', active);
    node.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  state.results[state.index]?.scrollIntoView({ block: 'nearest' });
}

function rememberSearch(entry) {
  if (!entry?.url) return;
  state.recent = [entry, ...state.recent.filter((item) => item.url !== entry.url)].slice(0, 6);
  storage.set(KEYS.recentSearches, state.recent);
}

async function runCommandAction(action) {
  switch (action) {
    case 'theme':
      toast.info('حالت نمایش تغییر کرد', theme.toggleTheme() === 'dark' ? 'تم تاریک فعال شد.' : 'تم روشن فعال شد.');
      break;
    case 'direction':
      theme.toggleDirection();
      toast.info('جهت تغییر کرد', document.documentElement.dir === 'rtl' ? 'چیدمان راست‌به‌چپ' : 'چیدمان چپ‌به‌راست');
      break;
    case 'language': {
      const order = ['fa', 'en', 'ar'];
      const next = order[(order.indexOf(dict().meta.code) + 1) % order.length];
      setLanguage(next);
      toast.info('زبان تغییر کرد', `زبان فعلی: ${next.toUpperCase()}`);
      break;
    }
    case 'customizer':
      openCustomizer();
      break;
    case 'shortcuts':
      openShortcuts();
      break;
    case 'sidebar':
      document.querySelector('[data-sidebar-collapse]')?.click();
      break;
    case 'logout': {
      const ok = await modal.confirm({ title: 'خروج از حساب', text: 'از حساب کاربری خود خارج می‌شوید؟', tone: 'danger', confirmText: 'خروج' });
      if (ok) window.location.assign('auth/login.html');
      break;
    }
    default:
      toast.info('کنش اجرا شد', 'این گزینه در نسخه نمایشی اطلاعات بیشتری ندارد.');
  }
}

function initPalette() {
  on(document, 'click', (event) => {
    if (event.target.closest('[data-command-open], [data-palette-open], [data-search-open]')) {
      event.preventDefault();
      openPalette();
      return;
    }
    if (event.target.closest('[data-command-close]')) {
      closePalette();
      return;
    }
    const item = event.target.closest('.command-item');
    if (item && !state.paletteOpen) return;
    if (item) {
      const label = item.querySelector('.command-item__text')?.firstChild?.textContent?.trim() ?? '';
      if (item.dataset.commandUrl) {
        rememberSearch({ url: item.dataset.commandUrl, title: label });
        window.location.href = item.dataset.commandUrl;
      } else if (item.dataset.commandAction) {
        runCommandAction(item.dataset.commandAction);
        closePalette();
      }
    }
  });

  on(document, 'input', debounce((event) => {
    if (!event.target.matches('[data-command-input]')) return;
    renderPalette(event.target.value);
  }, 160));

  on(document, 'keydown', (event) => {
    const meta = event.ctrlKey || event.metaKey;
    if (meta && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      togglePalette();
      return;
    }
    if (!state.paletteOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!state.results.length) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      state.index = (state.index + step + state.results.length) % state.results.length;
      highlightResult();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      state.index = event.key === 'Home' ? 0 : state.results.length - 1;
      highlightResult();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      state.results[state.index]?.click();
    }
  });

  // Deep-link from the sidebar trigger + global search form
  on(document, 'click', (event) => {
    const form = event.target.closest('[data-search-form]');
    if (!form) return;
    event.preventDefault();
    const value = $('input', form)?.value.trim();
    if (value) window.location.href = `search.html?q=${encodeURIComponent(value)}`;
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('q') && document.body.dataset.page?.endsWith('search.html') !== true) {
    // Palette stays closed on navigation; the search page renders its own results.
  }
}

/* ============================================================ shortcuts help */

export function openShortcuts() {
  const groups = commandService.shortcuts.reduce((acc, item) => {
    const key = item.group ?? 'عمومی';
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(item);
    return acc;
  }, new Map());
  const content = `<div class="shortcuts-grid">${[...groups.entries()]
    .map(
      ([group, items]) => `<div class="shortcuts-group"><h4 class="shortcuts-group__title">${escapeHtml(group)}</h4>${items
        .map(
          (item) => `<div class="shortcut-row"><span class="shortcut-row__label">${escapeHtml(item.label)}</span><span class="shortcut-row__keys">${item.keys
            .map((key) => `<kbd>${escapeHtml(key)}</kbd>`)
            .join('<span class="shortcut-row__plus">+</span>')}</span></div>`,
        )
        .join('')}</div>`,
    )
    .join('')}</div>`;
  return modal.open({ title: t('shortcuts.title', 'کلیدهای میانبر'), subtitle: t('shortcuts.subtitle', 'همه میانبرها با صفحه‌کلید قابل استفاده‌اند.'), size: 'lg', content });
}

/* ============================================================ notifications */

async function renderNotifications() {
  const host = $('[data-notification-list]');
  if (!host) return;
  const items = await notificationService.list();
  const read = storage.get(KEYS.notificationsRead, []) ?? [];
  render(
    host,
    items
      .map(
        (item) => `<button type="button" class="dropdown-item notification-item ${item.read || read.includes(item.id) ? '' : 'is-unread'}" role="listitem" data-notification="${item.id}">
          <span class="notification-item__icon notification-item__icon--${escapeHtml(item.type)}"><i class="bi bi-${item.type === 'success' ? 'check2-circle' : item.type === 'warning' ? 'exclamation-triangle' : item.type === 'danger' ? 'x-octagon' : 'info-circle'}" aria-hidden="true"></i></span>
          <span class="notification-item__body">
            <span class="notification-item__title">${escapeHtml(item.title)}</span>
            <span class="notification-item__text">${escapeHtml(item.text)}</span>
          </span>
        </button>`,
      )
      .join(''),
  );
  const badge = $('[data-notif-count]');
  const unread = items.filter((item) => !item.read && !read.includes(item.id)).length;
  if (badge) {
    badge.textContent = toDigits(unread);
    badge.hidden = unread === 0;
  }
}

function initNotifications() {
  on(document, 'click', async (event) => {
    if (event.target.closest('[data-notif-read-all]')) {
      event.preventDefault();
      const items = await notificationService.list();
      storage.set(KEYS.notificationsRead, items.map((item) => item.id));
      await renderNotifications();
      toast.success('همه اعلان‌ها خوانده شد', 'فهرست اعلان‌ها به‌روزرسانی شد.');
      bus.emit(EVENTS.notifications, { readAll: true });
      return;
    }
    const item = event.target.closest('[data-notification]');
    if (!item) return;
    const read = storage.get(KEYS.notificationsRead, []) ?? [];
    if (!read.includes(item.dataset.notification)) {
      storage.set(KEYS.notificationsRead, [...new Set([...read, item.dataset.notification])]);
    }
    item.closest('.notification-item')?.classList.remove('is-unread');
    const badge = $('[data-notif-count]');
    if (badge) {
      const next = Math.max(0, Number(toLatinDigits(badge.textContent)) - 1);
      badge.textContent = toDigits(next);
      badge.hidden = next === 0;
    }
    bus.emit(EVENTS.notifications, { id: item.dataset.notification });
  });
  renderNotifications();
  bus.on(EVENTS.dataChanged, renderNotifications);
}

/* ========================================================= theme customizer */

export function openCustomizer() {
  const panel = $('#theme-customizer');
  if (!panel) return;
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  lockScroll(true);
  state.release = focusTrap(panel);
}

export function closeCustomizer() {
  const panel = $('#theme-customizer');
  if (!panel) return;
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  lockScroll(false);
  state.release?.();
  state.release = null;
}

function initCustomizer() {
  on(document, 'click', (event) => {
    if (event.target.closest('[data-customizer-open]')) {
      event.preventDefault();
      openCustomizer();
      return;
    }
    const close = event.target.closest('[data-customizer-close]');
    if (close) {
      event.preventDefault();
      closeCustomizer();
      return;
    }
    if (event.target.closest('[data-customizer-reset]')) {
      modal
        .confirm({ title: 'بازنشانی تنظیمات ظاهری', text: t('customizer.resetConfirm', 'همه تنظیمات ظاهری به حالت پیش‌فرض بازمی‌گردد.'), tone: 'warning', confirmText: 'بازنشانی کن' })
        .then((ok) => {
          if (!ok) return;
          theme.reset();
          storage.resetPreferences();
          toast.success('بازنشانی شد', 'همه تنظیمات ظاهری به حالت پیش‌فرض بازگشت.');
          setTimeout(() => window.location.reload(), 700);
        });
    }
  });

  ['theme', 'primary', 'layout', 'direction', 'density', 'fontSize', 'sidebarStyle', 'calendar', 'radius'].forEach((key) =>
    bus.on(EVENTS[key] ?? EVENTS.theme, syncCustomizer),
  );
  syncCustomizer();
}

/** Mirrors the active option state onto every customizer / configurator control. */
function syncCustomizer() {
  const snapshot = theme.snapshot();
  const groups = {
    theme: snapshot.theme,
    primary: snapshot.primary,
    layout: snapshot.layout,
    direction: snapshot.direction,
    density: snapshot.density,
    fontSize: snapshot.fontSize,
    sidebarStyle: snapshot.sidebarStyle,
    calendar: snapshot.calendar,
  };
  Object.entries(groups).forEach(([group, value]) => {
    $$(`[data-customizer="${group}"] [data-value], [data-${group}-option]`).forEach((node) => {
      const own = node.dataset.value ?? node.dataset[`${group}Option`];
      const active = own === value;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  });
}

/* ============================================================ widget editor */

function widgetState() {
  const stored = storage.get(KEYS.widgets, null);
  const order = $$('[data-widget]').map((node) => node.dataset.widget);
  return stored && Array.isArray(stored.order) ? stored : { order, hidden: [] };
}

function applyWidgetState(grid, next) {
  const nodes = new Map($$('[data-widget]', grid).map((node) => [node.dataset.widget, node]));
  nodes.forEach((node, id) => {
    node.hidden = next.hidden.includes(id);
  });
  next.order.concat([...nodes.keys()].filter((id) => !next.order.includes(id))).forEach((id) => {
    const node = nodes.get(id);
    if (node) grid.append(node);
  });
  storage.set(KEYS.widgets, next);
  bus.emit(EVENTS.widgets, next);
}

function initWidgetEditor() {
  const editor = $('[data-widget-editor]');
  const grid = $('[data-widget-grid]') ?? $('.widget-grid');
  if (!editor || !grid) return;
  applyWidgetState(grid, widgetState());

  on(editor, 'click', async (event) => {
    if (event.target.closest('[data-widget-reset]')) {
      storage.remove(KEYS.widgets);
      window.location.reload();
      return;
    }
    if (!event.target.closest('[data-widget-edit]')) return;
    event.preventDefault();
    const current = widgetState();
    const rows = $$('[data-widget]', grid)
      .map((node) => ({ id: node.dataset.widget, title: node.querySelector('[data-widget-title]')?.textContent.trim() ?? node.dataset.widget }))
      .filter((row) => row.id);

    modal.open({
      title: 'شخصی‌سازی ابزارک‌ها',
      subtitle: 'ابزارک‌ها را نمایش/پنهان یا جابجا کنید — انتخاب شما در مرورگر ذخیره می‌شود.',
      size: 'md',
      content: `<ul class="list-group" data-widget-list>${rows
        .map(
          (row) => `<li class="list-item" data-id="${escapeHtml(row.id)}">
            <i class="bi bi-grip-vertical drag-handle" data-drag-handle aria-hidden="true"></i>
            <span class="list-item__title">${escapeHtml(row.title)}</span>
            <label class="form-switch ms-auto">
              <input type="checkbox" class="form-check-input" data-widget-visible ${current.hidden.includes(row.id) ? '' : 'checked'} />
              <span class="form-check-label visually-hidden">نمایش ${escapeHtml(row.title)}</span>
            </label>
          </li>`,
        )
        .join('')}</ul>`,
      footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button><button type="button" class="btn btn-primary" data-widget-save>ذخیره چیدمان</button>',
      onMount: async (panel) => {
        const list = $('[data-widget-list]', panel);
        await createSortable(list, { handle: '[data-drag-handle]', animation: 160, ghostClass: 'is-ghost' });
        on($('[data-widget-save]', panel), 'click', () => {
          const order = $$('[data-id]', list).map((node) => node.dataset.id);
          const hidden = $$('[data-widget-visible]', list)
            .filter((input) => !input.checked)
            .map((input) => input.closest('[data-id]').dataset.id);
          applyWidgetState(grid, { order, hidden });
          toast.success('چیدمان ذخیره شد', 'ابزارک‌های داشبورد به‌روزرسانی شدند.');
          modal.closeTop();
        });
      },
    });
  });
}

/* ============================================================ demo switcher */

async function initDemoSwitcher() {
  const host = $('[data-demo-list]');
  const current = document.body.dataset.page?.split('/').pop()?.replace('.html', '');
  if (host) {
    const demos = await demoService.switcher();
    render(
      host,
      demos
        .map(
          (demo) =>
            `<a class="demo-link${demo.id === current ? ' is-active' : ''}" href="${escapeHtml(demo.url)}" data-demo-page="${escapeHtml(demo.id)}"><span class="demo-dot" style="--nv-demo-color: var(--nv-${escapeHtml(demo.color ?? 'primary')})"></span><span>${escapeHtml(demo.label.fa)}</span></a>`,
        )
        .join(''),
    );
  }
  on(document, 'click', (event) => {
    if (!event.target.closest('[data-demo-next]')) return;
    event.preventDefault();
    const index = config.demos.findIndex((demo) => demo.id === current);
    const target = config.demos[(index + 1 + config.demos.length) % config.demos.length];
    window.location.href = `dashboards/${target.id}.html`;
  });
}

/* ================================================================== settings */

async function initSettingsDefaults() {
  const form = $('[data-settings-form]');
  if (!form) return;
  const values = await settingsService.get();
  $$('[data-setting]', form).forEach((field) => {
    const value = field.dataset.setting.split('.').reduce((acc, key) => acc?.[key], values);
    if (value === undefined) return;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else if (field.tagName === 'SELECT' && Array.isArray(value)) field.value = value[0] ?? '';
    else field.value = Array.isArray(value) ? value.join(', ') : value;
  });
  on(form, 'submit', (event) => {
    event.preventDefault();
    const group = form.dataset.settingsForm;
    const payload = Object.fromEntries(
      $$('[data-setting]', form).map((field) => [field.dataset.setting.split('.').pop(), field.type === 'checkbox' ? field.checked : field.value]),
    );
    settingsService.update(group, payload).then(() => toast.success('تنظیمات ذخیره شد', 'تغییرات شما اعمال گردید.'));
  });
}

/* ================================================================ bootstrap */

export function initChrome() {
  initPalette();
  on(document, 'click', (event) => {
    if (!event.target.closest('[data-shortcuts-open]')) return;
    event.preventDefault();
    openShortcuts();
  });
  initNotifications();
  initCustomizer();
  initWidgetEditor();
  initDemoSwitcher();
  initSettingsDefaults();
  applyTranslations();
  return true;
}

export const chrome = {
  init: initChrome,
  openPalette,
  closePalette,
  togglePalette,
  openShortcuts,
  openCustomizer,
  closeCustomizer,
  renderPalette,
};

export default chrome;
