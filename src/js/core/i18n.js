/**
 * NOVAADMIN — internationalisation
 * ------------------------------------------------------------------
 * • Loads one of the three bundled dictionaries (`fa` primary, `en`, `ar`)
 * • Applies copy to `[data-i18n]`, `[data-i18n-placeholder]`, `[data-i18n-title]`,
 *   `[data-i18n-aria]` and `[data-i18n-html]` hooks at runtime
 * • Keeps `<html lang>` / `<html dir>` in sync and tells the number formatter
 *   which digit set to use
 * • Emits `language:change` so charts, tables and calendars re-render with the
 *   new labels instead of being reloaded
 */
import { $, $$, on } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { storage, KEYS } from './storage.js';
import { config } from '../../config/config.js';
import { getLocale, languageList, directionFor, isRtl, availableLanguages } from '../../locales/index.js';
import { setNumberLanguage, toDigits } from './numbers.js';

const state = {
  lang: config.defaultLanguage,
  dict: getLocale(config.defaultLanguage),
  fallback: getLocale('fa'),
};

/**
 * Resolves a dotted key (`table.noResults`) inside the active dictionary.
 * Generated nav labels are stored as flat entries with their full dotted key
 * (`dict['nav.dash-analytics']`), so those win before the nested walk.
 */
function lookup(dict, path) {
  if (dict && typeof dict[path] === 'string') return dict[path];
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict);
}

export function t(key, fallback = '', vars = {}) {
  const value = lookup(state.dict, key) ?? lookup(state.fallback, key) ?? fallback ?? key;
  if (typeof value !== 'string') return value;
  return Object.entries(vars).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), value);
}

/** Raw dictionary access for modules that iterate lists (layouts, palettes…). */
export const dict = () => state.dict;
export const language = () => state.lang;
export const fallbackDict = () => state.fallback;

/** Applies translations to every `data-i18n*` hook inside `root`. */
export function applyTranslations(root = document) {
  $$('[data-i18n]', root).forEach((node) => {
    const text = lookup(state.dict, node.dataset.i18n);
    if (typeof text === 'string') node.textContent = text;
  });
  $$('[data-i18n-html]', root).forEach((node) => {
    const text = lookup(state.dict, node.dataset.i18nHtml);
    if (typeof text === 'string') node.innerHTML = text;
  });
  $$('[data-i18n-placeholder]', root).forEach((node) => {
    const text = lookup(state.dict, node.dataset.i18nPlaceholder);
    if (typeof text === 'string') node.setAttribute('placeholder', text);
  });
  $$('[data-i18n-title]', root).forEach((node) => {
    const text = lookup(state.dict, node.dataset.i18nTitle);
    if (typeof text === 'string') node.setAttribute('title', text);
  });
  $$('[data-i18n-aria]', root).forEach((node) => {
    const text = lookup(state.dict, node.dataset.i18nAria);
    if (typeof text === 'string') node.setAttribute('aria-label', text);
  });
  $$('[data-i18n-value]', root).forEach((node) => {
    const text = lookup(state.dict, node.dataset.i18nValue);
    if (typeof text === 'string') node.setAttribute('value', text);
  });
}

/** Localised label for a language code — used by the header switcher. */
export function languageName(code) {
  return languageList.find((item) => item.code === code)?.native ?? code;
}

export function currentMeta() {
  return state.dict.meta ?? getLocale(state.lang).meta;
}

/**
 * Switches the UI language.
 * @param {'fa'|'en'|'ar'} lang
 * @param {Object} [options] { direction, silent, persist }
 */
export function setLanguage(lang, { direction = null, persist = true, silent = false } = {}) {
  const next = availableLanguages().includes(lang) ? lang : config.defaultLanguage;
  state.lang = next;
  state.dict = getLocale(next);
  setNumberLanguage(next);
  if (persist) storage.set(KEYS.language, next);

  const html = document.documentElement;
  html.setAttribute('lang', next);
  const dir = direction || directionFor(next);
  html.setAttribute('dir', dir);
  html.setAttribute('data-lang', next);
  if (persist) storage.set(KEYS.direction, dir);

  applyTranslations();
  if (!silent) {
    const pageKey = document.body?.dataset.page;
    const title = pageKey ? lookup(state.dict.pages ?? {}, pageKey) : null;
    if (typeof title === 'string') {
      document.title = `${title} — ${t('common.appName')}`;
      const heading = $('[data-page-title]');
      if (heading) heading.textContent = title;
    }
    bus.emit(EVENTS.language, { lang: next, dir });
  }
  return next;
}

export function setDirection(dir, { persist = true } = {}) {
  const value = dir === 'ltr' ? 'ltr' : 'rtl';
  document.documentElement.setAttribute('dir', value);
  if (persist) storage.set(KEYS.direction, value);
  bus.emit(EVENTS.direction, { dir: value });
  return value;
}

export function initSelectors(root = document) {
  // Theme customizer language picker: [data-customizer="language"] [data-value]
  on(root, 'click', (event) => {
    const group = event.target.closest('[data-customizer="language"]');
    const press = event.target.closest('[data-value]');
    if (group && press) setLanguage(press.dataset.value);
  });

  $$('[data-language-switch]', root).forEach((node) => {
    const handler = (event) => {
      const code = event.target.closest('[data-lang]')?.dataset.lang ?? node.value;
      if (!code) return;
      setLanguage(code);
    };
    if (node.tagName === 'SELECT') on(node, 'change', handler);
    else on(node, 'click', handler);
  });
}

export function initI18n() {
  const stored = storage.get(KEYS.language, config.defaultLanguage);
  const storedDirection = storage.get(KEYS.direction, null);
  const htmlLang = document.documentElement.getAttribute('lang');
  const initial = stored || htmlLang || config.defaultLanguage;
  state.lang = availableLanguages().includes(initial) ? initial : config.defaultLanguage;
  state.dict = getLocale(state.lang);
  setNumberLanguage(state.lang);
  applyTranslations();
  // Keep the pre-paint direction when the user chose one explicitly.
  if (storedDirection && storedDirection !== directionFor(state.lang)) {
    document.documentElement.setAttribute('dir', storedDirection);
  }
  initSelectors();
  renderLanguageLabels();
  return state;
}

/** Fills the header language switcher with every available locale. */
export function renderLanguageLabels(root = document) {
  $$('[data-language-list]', root).forEach((list) => {
    if (list.dataset.ready === '1') return;
    list.dataset.ready = '1';
    list.innerHTML = languageList
      .map(
        (item) => `<button type="button" class="dropdown-item lang-option${item.code === state.lang ? ' is-active' : ''}" data-lang="${item.code}">
          <span class="lang-option__flag" aria-hidden="true">${item.code.toUpperCase().slice(0, 2)}</span>
          <span class="lang-option__name">${item.native}</span>
          ${item.code === state.lang ? '<i class="bi bi-check2 ms-auto" aria-hidden="true"></i>' : ''}
        </button>`,
      )
      .join('');
  });
  // Keep the native labels on the trigger.
  $$('[data-language-trigger]', root).forEach((trigger) => {
    const label = trigger.querySelector('[data-language-current]');
    if (label) label.textContent = t('language.' + state.lang, languageName(state.lang));
  });
}

bus.on(EVENTS.language, () => {
  initSelectors();
  renderLanguageLabels();
});

/** Convenience namespace so callers can `import { i18n } from '../core/i18n.js'`. */
export const i18n = {
  t,
  setLanguage,
  setDirection,
  applyTranslations,
  languageName,
  currentMeta,
  get dict() {
    return state.dict;
  },
  get lang() {
    return state.lang;
  },
  isRtl: () => isRtl(state.lang),
  toDigits,
  languages: languageList,
};

export default i18n;
