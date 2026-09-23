/**
 * NOVAADMIN — theme engine
 * ------------------------------------------------------------------
 * Single owner of every appearance preference. It reads the attributes that
 * `public/assets/js/theme-boot.js` applied before first paint, keeps them in
 * sync with user actions, persists each change under the `nova:` namespace and
 * announces it on the event bus so live components (charts, tables, calendars)
 * can restyle without a reload.
 *
 *   theme.set('theme', 'dark')          // light | dark | system
 *   theme.set('primary', 'emerald')     // 6 palettes
 *   theme.toggleTheme()                 // header button
 *   theme.set('layout', 'mini')         // default|mini|collapse|horizontal|twocol|boxed
 *   theme.set('direction', 'ltr')
 *   theme.set('density', 'compact')
 *   theme.set('fontSize', 'lg')
 *   theme.set('sidebarStyle', 'brand')  // default|dark|brand|fixed|floating|compact
 *   theme.set('radius', 1.25)           // corner-radius scale
 */
import { $, $$, on } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { storage, KEYS } from './storage.js';
import { config } from '../../config/config.js';
import { setLanguage } from './i18n.js';

export const PALETTES = ['indigo', 'blue', 'emerald', 'violet', 'orange', 'rose'];
export const LAYOUTS = ['default', 'mini', 'collapse', 'horizontal', 'twocol', 'boxed'];
export const DENSITIES = ['comfortable', 'compact'];
export const FONT_SIZES = ['sm', 'md', 'lg'];
export const SIDEBAR_STYLES = ['default', 'dark', 'brand', 'fixed', 'floating', 'compact'];
/** Keys that `set()` accepts together with radius. */
export const CONTROL_KEYS = ['theme', 'primary', 'layout', 'direction', 'density', 'fontSize', 'sidebarStyle', 'calendar'];
export const THEMES = ['light', 'dark', 'system'];

/** `sidebar` (config/boot default) and `default` mean the same layout. */
const normaliseLayout = (value) => (value === 'sidebar' || !value ? 'default' : value);

const RADIUS_BASE = { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.875, xl: 1.25 };

const media = window.matchMedia?.('(prefers-color-scheme: dark)');

const state = {
  theme: storage.pref('theme'),
  primary: storage.pref('primary'),
  layout: normaliseLayout(storage.get(KEYS.layout, config.defaultLayout)),
  direction: storage.get(KEYS.direction, config.defaultDirection),
  density: storage.get(KEYS.density, config.defaultDensity ?? 'comfortable'),
  fontSize: storage.get(KEYS.fontSize, config.defaultFontSize ?? 'md'),
  sidebarStyle: storage.get(KEYS.sidebarStyle, config.defaultSidebarStyle ?? 'fixed'),
  calendar: storage.pref('calendar'),
  radius: Number(storage.get('radius', 1)),
  resolved: 'light',
};

const root = document.documentElement;
const listeners = new Map();

/** Resolves `system` against the OS preference. */
function resolveTheme(value = state.theme) {
  if (value === 'system') return media?.matches ? 'dark' : 'light';
  return value === 'dark' ? 'dark' : 'light';
}

function apply(persist = false) {
  state.resolved = resolveTheme();
  root.setAttribute('data-theme', state.resolved);
  root.setAttribute('data-theme-mode', state.theme);
  root.setAttribute('data-primary', state.primary);
  root.setAttribute('data-layout', state.layout === 'default' ? 'sidebar' : state.layout);
  root.setAttribute('data-direction', state.direction);
  root.setAttribute('data-density', state.density);
  root.setAttribute('data-font-size', state.fontSize);
  root.setAttribute('data-sidebar-style', state.sidebarStyle);
  root.setAttribute('data-calendar', state.calendar);
  root.style.setProperty('--nv-radius-scale', String(state.radius));
  applyRadius();

  if (persist) {
    storage.set(KEYS.theme, state.theme);
    storage.set(KEYS.primary, state.primary);
    storage.set(KEYS.layout, state.layout);
    storage.set(KEYS.direction, state.direction);
    storage.set(KEYS.density, state.density);
    storage.set(KEYS.fontSize, state.fontSize);
    storage.set(KEYS.sidebarStyle, state.sidebarStyle);
    storage.set(KEYS.calendar, state.calendar);
    storage.set('radius', state.radius);
  }
}

/** Corner-radius control: scales the whole token family from one number. */
function applyRadius() {
  if (state.radius === 1) {
    Object.keys(RADIUS_BASE).forEach((key) => root.style.removeProperty(`--nv-radius-${key}`));
    return;
  }
  Object.entries(RADIUS_BASE).forEach(([key, base]) => {
    root.style.setProperty(`--nv-radius-${key}`, `${(base * state.radius).toFixed(3)}rem`);
  });
}

function syncControls() {
  $$('[data-theme-option]').forEach((node) => node.classList.toggle('is-active', node.dataset.themeOption === state.theme));
  $$('[data-primary-option]').forEach((node) => {
    node.classList.toggle('is-active', node.dataset.primaryOption === state.primary);
    node.setAttribute('aria-pressed', String(node.dataset.primaryOption === state.primary));
  });
  $$('[data-layout-option]').forEach((node) => node.classList.toggle('is-active', node.dataset.layoutOption === state.layout));
  $$('[data-direction-option]').forEach((node) => node.classList.toggle('is-active', node.dataset.directionOption === state.direction));
  $$('[data-density-option]').forEach((node) => node.classList.toggle('is-active', node.dataset.densityOption === state.density));
  $$('[data-fontsize-option]').forEach((node) => node.classList.toggle('is-active', node.dataset.fontsizeOption === state.fontSize));
  $$('[data-sidebar-style-option]').forEach((node) => node.classList.toggle('is-active', node.dataset.sidebarStyleOption === state.sidebarStyle));
  $$('[data-calendar-option]').forEach((node) => node.classList.toggle('is-active', node.dataset.calendarOption === state.calendar));
  const toggle = $('[data-theme-toggle]');
  if (toggle) {
    const isDark = state.resolved === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    const icon = toggle.querySelector('i');
    if (icon) icon.className = `bi bi-${isDark ? 'sun' : 'moon-stars'}`;
  }
  $$('[data-theme-label]').forEach((node) => {
    node.textContent = state.theme === 'system' ? 'system' : state.theme;
  });
}

/**
 * Applies one preference.
 * @param {'theme'|'primary'|'layout'|'direction'|'density'|'fontSize'|'sidebarStyle'|'calendar'|'radius'} key
 * @param {string|number} value
 * @param {Object} [options] { persist, silent }
 */
export function set(key, value, { persist = true, silent = false } = {}) {
  if (!(key in state)) return null;
  switch (key) {
    case 'theme':
      state.theme = THEMES.includes(value) ? value : 'light';
      break;
    case 'primary':
      state.primary = PALETTES.includes(value) ? value : 'indigo';
      break;
    case 'layout':
      state.layout = LAYOUTS.includes(normaliseLayout(value)) ? normaliseLayout(value) : 'default';
      break;
    case 'direction':
      state.direction = value === 'ltr' ? 'ltr' : 'rtl';
      break;
    case 'density':
      state.density = DENSITIES.includes(value) ? value : 'comfortable';
      break;
    case 'fontSize':
      state.fontSize = FONT_SIZES.includes(value) ? value : 'md';
      break;
    case 'sidebarStyle':
      state.sidebarStyle = SIDEBAR_STYLES.includes(value) ? value : 'fixed';
      break;
    case 'calendar':
      state.calendar = value === 'gregorian' ? 'gregorian' : 'jalali';
      break;
    case 'radius':
      state.radius = Math.min(1.6, Math.max(0.4, Number(value) || 1));
      break;
    default:
      break;
  }

  apply(persist);
  syncControls();

  if (!silent) {
    const eventName = {
      theme: EVENTS.theme,
      primary: EVENTS.primary,
      layout: EVENTS.layout,
      direction: EVENTS.direction,
      density: EVENTS.density,
      fontSize: EVENTS.density,
      sidebarStyle: EVENTS.layout,
      calendar: EVENTS.calendarDate,
      radius: EVENTS.theme,
    }[key];
    const payload = { key, value: state[key], resolved: state.resolved, state: { ...state } };
    if (eventName) bus.emit(eventName, payload);
    window.dispatchEvent(new CustomEvent('nova:appearance', { detail: payload }));
  }

  listeners.get(key)?.forEach((handler) => handler(state[key]));
  return state[key];
}

export function get(key) {
  return state[key];
}

export function toggleTheme() {
  return set('theme', state.resolved === 'dark' ? 'light' : 'dark');
}

/** Cycles light → dark → system (used by the header long-press demo). */
export function cycleTheme() {
  const order = ['light', 'dark', 'system'];
  return set('theme', order[(order.indexOf(state.theme) + 1) % order.length]);
}

export function toggleDirection() {
  return set('direction', state.direction === 'rtl' ? 'ltr' : 'rtl');
}

export function reset({ silent = false } = {}) {
  state.theme = config.defaultTheme;
  state.primary = config.defaultPrimary;
  state.layout = normaliseLayout(config.defaultLayout);
  state.direction = config.defaultDirection;
  state.density = config.defaultDensity ?? 'comfortable';
  state.fontSize = config.defaultFontSize ?? 'md';
  state.sidebarStyle = config.defaultSidebarStyle ?? 'fixed';
  state.calendar = 'jalali';
  state.radius = 1;
  apply(true);
  syncControls();
  if (!silent) bus.emit(EVENTS.theme, { key: 'reset', state: { ...state } });
}

/** Wires every declarative appearance control on the page. */
export function initThemeControls(rootNode = document) {
  on(rootNode, 'click', (event) => {
    // Two declarative contracts are supported:
    //   • [data-<key>-option="value"]                       (landing configurator)
    //   • [data-customizer="<key>"] [data-value="value"]     (theme customizer)
    const group = event.target.closest('[data-customizer]');
    const press = event.target.closest('[data-value]');
    if (group && press) {
      const key = group.dataset.customizer;
      const value = press.dataset.value;
      if (key === 'language') return; // handled by i18n.js
      if (key === 'radius') set('radius', value);
      else if (CONTROL_KEYS.includes(key)) set(key, value);
      return;
    }
    const target = event.target.closest('[data-theme-option],[data-primary-option],[data-layout-option],[data-direction-option],[data-density-option],[data-fontsize-option],[data-sidebar-style-option],[data-calendar-option],[data-radius-option]');
    if (!target) return;
    if (target.dataset.themeOption) set('theme', target.dataset.themeOption);
    else if (target.dataset.primaryOption) set('primary', target.dataset.primaryOption);
    else if (target.dataset.layoutOption) set('layout', target.dataset.layoutOption);
    else if (target.dataset.directionOption) set('direction', target.dataset.directionOption);
    else if (target.dataset.densityOption) set('density', target.dataset.densityOption);
    else if (target.dataset.fontsizeOption) set('fontSize', target.dataset.fontsizeOption);
    else if (target.dataset.sidebarStyleOption) set('sidebarStyle', target.dataset.sidebarStyleOption);
    else if (target.dataset.calendarOption) set('calendar', target.dataset.calendarOption);
    else if (target.dataset.radiusOption) set('radius', target.dataset.radiusOption);
  });

  $$('[data-theme-toggle]', rootNode).forEach((button) => on(button, 'click', () => toggleTheme()));
  $$('[data-direction-toggle]', rootNode).forEach((button) => on(button, 'click', () => toggleDirection()));

  const radius = $('[data-radius-range]', rootNode);
  if (radius) {
    radius.value = String(state.radius);
    on(radius, 'input', () => set('radius', radius.value, { persist: true }));
    on(radius, 'change', () => set('radius', radius.value, { persist: true }));
  }
  syncControls();
  return state;
}

/** Re-applies the theme when the OS palette changes and `system` is active. */
if (media) {
  const onChange = () => {
    if (state.theme !== 'system') return;
    apply(false);
    syncControls();
    bus.emit(EVENTS.theme, { key: 'system', resolved: state.resolved, state: { ...state } });
  };
  media.addEventListener?.('change', onChange);
  media.addListener?.(onChange);
}

/** Keeps the language switcher and the direction control in step. */
bus.on(EVENTS.language, ({ lang }) => {
  const dir = lang === 'fa' || lang === 'ar' ? 'rtl' : 'ltr';
  if (state.direction !== dir) set('direction', dir, { persist: true, silent: true });
});

export const theme = {
  state,
  PALETTES,
  LAYOUTS,
  DENSITIES,
  FONT_SIZES,
  SIDEBAR_STYLES,
  THEMES,
  set,
  get,
  reset,
  toggleTheme,
  cycleTheme,
  toggleDirection,
  initThemeControls,
  onChange(key, handler) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(handler);
    return () => listeners.get(key).delete(handler);
  },
  snapshot: () => ({ ...state }),
  /** Convenience used by the customizer drawer. */
  applyLanguage(code) {
    setLanguage(code);
  },
};

export default theme;
