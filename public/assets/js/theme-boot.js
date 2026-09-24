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

  /* Login-first demo: panel pages stay hidden until main.js confirms a session
     (or redirects to auth/login.html). A safety timer never leaves it hidden. */
  try {
    var path = window.location.pathname;
    var isPublic = /\/(auth|system|docs)\//.test(path) || /(index|preview|START-HERE)\.html$/.test(path) || /\/$/.test(path);
    var hasSession = window.localStorage.getItem(PREFIX + 'session') || window.sessionStorage.getItem(PREFIX + 'session');
    if (!isPublic && !hasSession) {
      root.classList.add('is-guarded');
      var guardStyle = document.createElement('style');
      guardStyle.textContent = 'html.is-guarded body{visibility:hidden}';
      (document.head || root).appendChild(guardStyle);
      setTimeout(function () { root.classList.remove('is-guarded'); }, 3000);
    }
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
  root.setAttribute('data-layout', read('layout'));
  root.setAttribute('data-direction', read('direction'));
  root.setAttribute('data-density', read('density'));
  root.setAttribute('data-font-size', read('fontSize'));
  root.setAttribute('data-sidebar-style', read('sidebarStyle'));
  root.setAttribute('data-calendar', read('calendar'));

  var lang = read('language');
  if (LANGUAGES.indexOf(lang) === -1) lang = DEFAULTS.language;
  /** The direction follows the language unless the user pinned one. */
  var direction = read('direction');
  if (lang !== 'fa' && lang !== 'ar' && direction === DEFAULTS.direction && !window.localStorage.getItem(PREFIX + 'direction')) {
    direction = 'ltr';
  }
  root.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.setAttribute('data-lang', lang);

  // Collapsed / mini state (affects layout before CSS paints)
  try {
    if (window.localStorage.getItem(PREFIX + 'sidebar:collapsed') === '1') root.classList.add('sidebar-collapsed');
    if (window.localStorage.getItem(PREFIX + 'sidebar:hidden') === '1') root.classList.add('sidebar-hidden');
  } catch (e) { /* storage disabled — ignore */ }

  window.NOVA_BOOT = { theme: theme, resolved: resolved, language: lang, defaults: DEFAULTS, prefix: PREFIX };
})();
