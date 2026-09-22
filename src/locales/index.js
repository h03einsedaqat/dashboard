/**
 * NOVAADMIN — locale registry
 * ------------------------------------------------------------------
 * Merges the hand-written UI dictionaries (`fa`, `en`, `ar`) with the
 * auto-generated navigation / page-title labels produced by
 * `tools/build-pages.mjs` (see `generated.js`). Pages never import a locale
 * file directly — they go through `js/core/i18n.js`.
 */
import fa from './fa.js';
import en from './en.js';
import ar from './ar.js';
import { navLabels, pageTitles, pageMeta, docsOrder } from './generated.js';
import { chromeStrings } from './chrome.js';

export const LOCALES = { fa, en, ar };

/** Right-to-left languages — used by the direction controller. */
export const RTL_LANGUAGES = ['fa', 'ar', 'he', 'ur'];

export const languageList = Object.entries(LOCALES).map(([code, dict]) => ({
  code,
  name: dict.meta.name,
  native: dict.meta.native,
  dir: dict.meta.dir,
  flag: `assets/img/flags/${code}.svg`,
}));

const merged = Object.fromEntries(
  Object.entries(LOCALES).map(([code, dict]) => [
    code,
    {
      ...dict,
      nav: navLabels[code] ?? {},
      pages: pageTitles[code] ?? {},
      ui: { ...(chromeStrings[code]?.ui ?? {}), ...(dict.ui ?? {}) },
      section: { ...(chromeStrings[code]?.section ?? {}), ...(dict.section ?? {}) },
      role: { ...(chromeStrings[code]?.role ?? {}), ...(dict.role ?? {}) },
    },
  ]),
);

export function getLocale(lang = 'fa') {
  return merged[lang] ?? merged.fa;
}

export function availableLanguages() {
  return Object.keys(merged);
}

export function isRtl(lang) {
  return RTL_LANGUAGES.includes(lang);
}

export function directionFor(lang) {
  return RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
}

export { navLabels, pageTitles, pageMeta, docsOrder };
export default merged;
