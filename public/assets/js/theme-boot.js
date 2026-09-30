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

  /* Enables the scroll-reveal styles: set before paint so the animated
     elements start hidden and no flash of un-styled content is visible. */
  root.classList.add('has-reveal');

  /* Login-first demo disabled for preview: authGuard logic in main.js handles redirect,
     hiding body caused blank flash. Now just ensure is-guarded is removed. */
  try {
    root.classList.remove('is-guarded');
  } catch (e) {}

  /**
   * Reads a stored preference. The runtime writes plain strings, but any value
   * that arrived wrapped in quotes (`"en"`) or as a JSON string is unwrapped
   * here so `<html lang>` never ends up as `\"en\"`.
   */
  function read(key) {
    try {
      var value = window.localStorage.getItem(PREFIX + key);
      if (value === null || value === '') return DEFAULTS[key];
      if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.slice(1, -1);
      }
      return value;
    } catch (e) {
      return DEFAULTS[key];
    }
  }

  var LANGUAGES = ['fa', 'en', 'ar'];

  var theme = read('theme');
  var resolved = theme === 'system'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', theme);
  root.setAttribute('data-primary', read('primary'));
  /* v1.1 — layout, direction, density and sidebar style are no longer user
     preferences (they were removed from the customizer because non-default
     combinations broke the shell). Stale values saved by older builds are
     dropped here so every visitor gets the tested, stable layout. */
  try {
    ['layout', 'direction', 'density', 'sidebarStyle'].forEach(function (key) {
      window.localStorage.removeItem(PREFIX + key);
    });
  } catch (e) { /* storage disabled — ignore */ }
  root.setAttribute('data-layout', DEFAULTS.layout);
  root.setAttribute('data-density', DEFAULTS.density);
  root.setAttribute('data-font-size', read('fontSize'));
  root.setAttribute('data-sidebar-style', DEFAULTS.sidebarStyle);
  root.setAttribute('data-calendar', read('calendar'));

  var lang = read('language');
  try {
    var urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang) lang = urlLang;
  } catch (e) {}
  if (LANGUAGES.indexOf(lang) === -1) lang = DEFAULTS.language;
  /** The direction always follows the language. */
  var direction = lang === 'en' ? 'ltr' : 'rtl';
  root.setAttribute('data-direction', direction);
  root.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.setAttribute('data-lang', lang);

  // Collapsed / mini state (affects layout before CSS paints)
  try {
    if (/^(1|true)$/.test(window.localStorage.getItem(PREFIX + 'sidebar:collapsed') || '')) root.classList.add('sidebar-collapsed');
    if (/^(1|true)$/.test(window.localStorage.getItem(PREFIX + 'sidebar:hidden') || '')) root.classList.add('sidebar-hidden');
  } catch (e) { /* storage disabled — ignore */ }

  window.NOVA_BOOT = { theme: theme, resolved: resolved, language: lang, defaults: DEFAULTS, prefix: PREFIX };
})();
