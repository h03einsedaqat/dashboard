/**
 * NOVAADMIN — preference storage
 * ------------------------------------------------------------------
 * One namespaced, quota-safe localStorage wrapper shared by the theme engine,
 * language switcher, layout controller, table preferences and widget editor.
 * The `nova:` prefix is the same one `public/assets/js/theme-boot.js` reads
 * before first paint, so changes here are visible on the next page load with
 * no flash of unstyled content.
 */
import { config } from '../../config/config.js';

export const PREFIX = 'nova:';

const memory = new Map();
let available = true;

try {
  const probe = `${PREFIX}__probe`;
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
} catch {
  available = false;
}

/** Keys the theme engine owns — exported so pages can document/reset them. */
export const KEYS = {
  theme: 'theme',
  primary: 'primary',
  direction: 'direction',
  language: 'language',
  layout: 'layout',
  density: 'density',
  fontSize: 'fontSize',
  sidebarStyle: 'sidebarStyle',
  calendar: 'calendar',
  currency: 'currency',
  sidebarCollapsed: 'sidebar:collapsed',
  sidebarHidden: 'sidebar:hidden',
  tablePrefs: 'table:prefs',
  widgets: 'dashboard:widgets',
  recentSearches: 'search:recent',
  notificationsRead: 'notifications:read',
  cookieNotice: 'cookie:accepted',
};

export const storage = {
  available,

  get(key, fallback = null) {
    const namespaced = key.startsWith(PREFIX) ? key : PREFIX + key;
    if (!available) return memory.has(namespaced) ? memory.get(namespaced) : fallback;
    const raw = window.localStorage.getItem(namespaced);
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  set(key, value) {
    const namespaced = key.startsWith(PREFIX) ? key : PREFIX + key;
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    memory.set(namespaced, value);
    if (!available) return value;
    try {
      window.localStorage.setItem(namespaced, raw);
    } catch {
      available = false;
    }
    return value;
  },

  remove(key) {
    const namespaced = key.startsWith(PREFIX) ? key : PREFIX + key;
    memory.delete(namespaced);
    if (available) window.localStorage.removeItem(namespaced);
  },

  /** Everything Nova owns — used by “reset to defaults” actions. */
  keys() {
    if (!available) return [...memory.keys()].map((k) => k.slice(PREFIX.length));
    return Object.keys(window.localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => key.slice(PREFIX.length));
  },

  clearAll() {
    storage.keys().forEach((key) => storage.remove(key));
  },

  resetPreferences() {
    Object.entries(KEYS).forEach(([, key]) => storage.remove(key));
  },

  /** Preference value with the config default applied. */
  pref(name) {
    const key = KEYS[name] ?? name;
    const fallback = {
      theme: config.defaultTheme,
      primary: config.defaultPrimary,
      direction: config.defaultDirection,
      language: config.defaultLanguage,
      layout: config.defaultLayout,
      density: config.density,
      fontSize: config.fontSize,
      sidebarStyle: config.sidebarStyle,
      calendar: config.features.calendar === 'jalali' ? 'jalali' : 'gregorian',
      currency: config.currency,
    }[name];
    return storage.get(key, fallback) ?? fallback;
  },
};

export default storage;
