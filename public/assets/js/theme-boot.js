/**
 * NOVAADMIN — theme boot (runs before first paint, outside the bundle)
 * ------------------------------------------------------------------
 * Applies stored user preferences to <html> so a page never flashes the
 * wrong theme, direction or language. Kept tiny and dependency free on
 * purpose — it is loaded synchronously from <head>.
 */
(function () {
  'use strict';
  var PREFIX = 'nova:';
  var DEFAULTS = {
    theme: 'light',
    primary: 'indigo',
    layout: 'sidebar',
    direction: 'rtl',
    language: 'fa',
    density: 'comfortable',
    fontSize: 'md',
    sidebarStyle: 'fixed',
    calendar: 'jalali',
  };
  var root = document.documentElement;

  function read(key) {
    try {
      var value = window.localStorage.getItem(PREFIX + key);
      return value === null || value === '' ? DEFAULTS[key] : value;
    } catch (e) {
      return DEFAULTS[key];
    }
  }

  var theme = read('theme');
  var resolved = theme === 'system'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', theme);
  root.setAttribute('data-primary', read('primary'));
  root.setAttribute('data-layout', read('layout'));
  root.setAttribute('data-direction', read('direction'));
  root.setAttribute('data-density', read('density'));
  root.setAttribute('data-font-size', read('fontSize'));
  root.setAttribute('data-sidebar-style', read('sidebarStyle'));
  root.setAttribute('data-calendar', read('calendar'));

  var lang = read('language');
  root.setAttribute('lang', lang);
  root.setAttribute('dir', read('direction'));

  // Collapsed / mini state (affects layout before CSS paints)
  try {
    if (window.localStorage.getItem(PREFIX + 'sidebar:collapsed') === '1') root.classList.add('sidebar-collapsed');
    if (window.localStorage.getItem(PREFIX + 'sidebar:hidden') === '1') root.classList.add('sidebar-hidden');
  } catch (e) { /* storage disabled — ignore */ }

  window.NOVA_BOOT = { theme: theme, resolved: resolved, language: lang, defaults: DEFAULTS, prefix: PREFIX };
})();
