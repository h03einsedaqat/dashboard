/**
 * NOVAADMIN — content translation layer (phrase book)
 * ------------------------------------------------------------------
 * The template is Persian-first: authored markup, page controllers and demo
 * services all carry Persian copy, and only the shell used to be translated
 * through `data-i18n` keys. This module closes that gap without forcing every
 * author to wrap their strings in keys:
 *
 *   • `locales/phrases.en.js` / `phrases.ar.js` map the Persian source text to
 *     the target language (`{ 'وضعیت': 'Status' }`).
 *   • `translate.apply(root)` walks the rendered DOM and swaps any text node or
 *     `placeholder` / `title` / `aria-label` / `value` attribute that has a
 *     translation, remembering the original so the language can switch back.
 *   • a debounced `MutationObserver` keeps dynamically rendered content
 *     (tables, modals, toasts, charts) in the active language.
 *
 * Why a phrase book instead of rewriting 20 controllers with keys?
 *   – The source stays readable Persian for the Persian-speaking buyer.
 *   – Missing entries degrade gracefully (the Persian text simply stays).
 *   – One file per language is handed to a translator; no code knowledge needed.
 *
 * Opt out per node with `data-no-i18n`, or per attribute with
 * `data-no-i18n-attrs`. Persian demo *records* (names, product titles) stay as
 * authored — they are content, not interface.
 */
import { $$ } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { language } from './i18n.js';

/** Attributes that carry user-visible copy. */
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'value'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
/** Demo records that must survive translation untouched. */
const PROTECTED = '[data-no-i18n], .apexcharts-canvas, .code-block, .docs-code';

const books = new Map();
/** Pattern rules for strings that embed numbers (`نمایش ۱ تا ۱۰ از ۶۴ مورد`). */
const patterns = new Map();
let current = null;
let patternSet = null;
/** textNode/attribute owner → the Persian source text it was rendered from. */
const originals = new WeakMap();
const attrOriginals = new WeakMap();
let observer = null;
let scheduled = false;
let enabled = true;

/* --------------------------------------------------------------- dictionaries */

/** Registers one language's phrase book (`{ fa: { … } }`). */
export function registerPhrases(lang, entries, { merge = true } = {}) {
  if (!entries) return;
  const target = merge ? { ...(books.get(lang) ?? {}), ...entries } : { ...entries };
  books.set(lang, target);
  if (lang === language()) current = target;
}

export function setPhraseLanguage(lang) {
  current = books.get(lang) ?? null;
  patternSet = patterns.get(lang) ?? null;
}

/**
 * Registers pattern rules: `registerPatterns('en', [[/^نمایش (.+) تا (.+) از (.+) مورد$/, 'Showing $1–$2 of $3']])`.
 * Dynamic copy (row counters, ranges, "page 2 of 8") stays translatable
 * without inventing keys for every number combination.
 */
export function registerPatterns(lang, rules = []) {
  const list = rules.map((rule) => (Array.isArray(rule) ? rule : [rule.match, rule.replace]));
  patterns.set(lang, [...list, ...(patterns.get(lang) ?? [])]);
  if (lang === language()) patternSet = patterns.get(lang);
}

function translatePattern(text) {
  if (!patternSet) return undefined;
  for (const [match, replace] of patternSet) {
    if (match.test(text)) return text.replace(match, replace);
  }
  return undefined;
}

/** Phrase lookup for callers that build markup in JavaScript. */
export function phrase(text, fallback = '') {
  if (!text) return fallback || text;
  if (!enabled || !current) return text;
  return current[text] ?? text;
}

export function hasPhrase(text) {
  return Boolean(current && current[text]);
}

export function phraseCount(lang) {
  return Object.keys(books.get(lang) ?? {}).length;
}

/* ------------------------------------------------------------------ translation */

const isSkipped = (node) => {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!el || SKIP_TAGS.has(el.tagName)) return true;
  return Boolean(el.closest(PROTECTED));
};

function translateText(node) {
  if (isSkipped(node)) return;
  const raw = node.nodeValue;
  if (!raw) return;
  const trimmed = raw.trim();
  if (!trimmed) return;

  const remembered = originals.get(node);
  /** The stored original is the source of truth for every language. */
  const source = remembered ?? trimmed;
  if (!remembered) originals.set(node, trimmed);

  let translated = current ? current[source] : undefined;
  /** No exact phrase? Try the pattern rules before giving up. */
  if (translated === undefined) translated = current ? translatePattern(source) : undefined;
  if (translated === undefined) {
    if (node.nodeValue !== raw.replace(trimmed, source)) {
      /** Switching back to Persian restores exactly what the author wrote. */
      node.nodeValue = raw.replace(trimmed, source);
    }
    return;
  }
  if (translated === trimmed) return;
  const leading = raw.slice(0, raw.indexOf(trimmed));
  const trailing = raw.slice(raw.indexOf(trimmed) + trimmed.length);
  node.nodeValue = `${leading}${translated}${trailing}`;
}

function translateAttributes(el) {
  if (isSkipped(el)) return;
  const skip = (el.dataset.noI18nAttrs ?? '').split(/\s+/).filter(Boolean);
  let remembered = attrOriginals.get(el);
  if (!remembered) {
    remembered = {};
    attrOriginals.set(el, remembered);
  }
  ATTRS.forEach((attr) => {
    if (skip.includes(attr) || !el.hasAttribute(attr)) return;
    const raw = el.getAttribute(attr);
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const source = remembered[attr] ?? trimmed;
    if (!remembered[attr]) remembered[attr] = trimmed;
    let translated = current ? current[source] : undefined;
    if (translated === undefined && current) translated = translatePattern(source);
    if (translated === undefined) {
      if (raw !== source) el.setAttribute(attr, source);
      return;
    }
    if (translated !== raw) el.setAttribute(attr, translated);
  });
}

/** Translates a subtree (idempotent, safe to call from every renderer). */
let titleOriginal = null;

/**
 * Localises `document.title`. Titles are composed as `«صفحه | برند»`, so each
 * segment is translated on its own and the separator is preserved; the brand
 * segment has no entry and therefore stays as authored.
 */
function translateTitle() {
  if (!current) {
    // back to Persian: restore exactly what the document shipped with
    if (titleOriginal) document.title = titleOriginal;
    return;
  }
  if (!titleOriginal) titleOriginal = document.title;
  document.title = String(titleOriginal)
    .split('|')
    .map((segment) => phrase(segment.trim()))
    .join(' | ');
}

export function apply(root = document.body) {
  if (!root || !enabled) return 0;
  translateTitle();
  /** `current === null` means "Persian": remembered originals are restored. */
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let touched = 0;
  while (walker.nextNode()) {
    const before = walker.currentNode.nodeValue;
    translateText(walker.currentNode);
    if (walker.currentNode.nodeValue !== before) touched += 1;
  }
  const scope = root.nodeType === Node.ELEMENT_NODE ? root : document.body;
  translateAttributes(scope);
  $$(`[placeholder],[title],[aria-label],[alt],input[value]`, scope).forEach(translateAttributes);
  return touched;
}

function schedule(root = document.body) {
  if (scheduled || !enabled || !current) return;
  scheduled = true;
  const run = () => {
    scheduled = false;
    apply(root);
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 400 });
  else setTimeout(run, 60);
}

/** Watches for late content (tables, modals, AI replies, chart labels). */
export function observe(root = document.body) {
  if (observer || typeof MutationObserver === 'undefined') return observer;
  observer = new MutationObserver((records) => {
    const interesting = records.some((record) => {
      if (record.type === 'attributes') return ATTRS.includes(record.attributeName);
      return [...record.addedNodes].some((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          return (node.nodeValue ?? '').trim().length > 1 && !parent?.closest(PROTECTED);
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        /** Chart internals redraw on every hover: they never need a re-walk. */
        if (node.tagName === 'svg' || node.closest?.(PROTECTED)) return false;
        return true;
      });
    });
    if (interesting) schedule(root);
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  return observer;
}

export function setEnabled(value) {
  enabled = Boolean(value);
  if (enabled) apply();
}

/** Coverage helper for QA: how much of the visible Persian copy is translated. */
export function audit(scope = document.body) {
  const stats = { nodes: 0, translated: 0, missing: [] };
  if (!current) return stats;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (isSkipped(node)) continue;
    const text = (node.nodeValue ?? '').trim();
    if (text.length < 2 || !/[\u0600-\u06FF]/.test(text)) continue;
    stats.nodes += 1;
    if (current[text] !== undefined) stats.translated += 1;
    else if (stats.missing.length < 60) stats.missing.push(text);
  }
  return stats;
}

bus.on(EVENTS.language, () => {
  setPhraseLanguage(language());
  apply();
});

export const translate = { apply, observe, phrase, hasPhrase, registerPhrases, registerPatterns, setPhraseLanguage, setEnabled, audit, phraseCount };

export default translate;
