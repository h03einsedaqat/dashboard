/**
 * NOVAADMIN — link resolver
 * ------------------------------------------------------------------
 * Every page of the template is a real, standalone file that lives one
 * folder deep (`/dashboards/analytics.html`, `/crm/contacts.html`, …) while
 * the landing page sits in the root. That means a link written once as
 *
 *     href="users/details.html?id=42"
 *
 * has to become `../users/details.html?id=42` when it is rendered inside
 * `/crm/contacts.html`. Rather than sprinkling `../` through two hundred
 * pages and every controller, generated links are normalised here, in one
 * place, at render time:
 *
 *   • `fixLinks(root)`  — rewrites relative `href`/`src` inside a subtree.
 *   • `observeLinks()`  — keeps watching the page so links injected later
 *                         (data tables, kanban, chat, toasts…) are fixed too.
 *
 * Absolute URLs, protocol-relative URLs, hash links, `mailto:`, `tel:`,
 * `data:` and already-relative (`./`, `../`) targets are left untouched.
 */

import { $$ } from './dom.js';

/** Attributes that may hold a document-relative URL. */
const URL_ATTRIBUTES = {
  A: ['href'],
  AREA: ['href'],
  IMG: ['src'],
  SOURCE: ['src'],
  IFRAME: ['src'],
  VIDEO: ['src', 'poster'],
  AUDIO: ['src'],
  SCRIPT: ['src'],
  LINK: ['href'],
  FORM: ['action'],
  OBJECT: ['data'],
  EMBED: ['src'],
};

/** Anything that is not a plain relative path. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|\?)/i;

/** Depth of the current page inside the deployable output. */
export function pageDepth() {
  const page = document.body?.dataset?.page ?? '';
  if (!page || !page.includes('/')) return 0;
  return page.split('/').filter(Boolean).length - 1;
}

/** `../` × depth — the prefix every in-template link needs. */
export function basePrefix() {
  return '../'.repeat(pageDepth());
}

/**
 * Turns a template-relative path into a URL that works from the current page.
 * Idempotent: running it twice never yields `../../`.
 */
export function resolveUrl(value, { prefix = basePrefix() } = {}) {
  if (typeof value !== 'string') return value;
  const url = value.trim();
  if (!url) return value;
  if (ABSOLUTE.test(url) || url.startsWith('./') || url.startsWith('../')) return value;
  return prefix + url;
}

function rewriteNode(node, prefix) {
  const attributes = URL_ATTRIBUTES[node.tagName];
  if (attributes) {
    for (const attribute of attributes) {
      const current = node.getAttribute(attribute);
      if (current) {
        const next = resolveUrl(current, { prefix });
        if (next !== current) node.setAttribute(attribute, next);
      }
    }
  }
  const lazy = node.getAttribute?.('data-src');
  if (lazy) {
    const next = resolveUrl(lazy, { prefix });
    if (next !== lazy) node.setAttribute('data-src', next);
  }
  const srcset = node.getAttribute?.('srcset');
  if (srcset) {
    const next = srcset
      .split(',')
      .map((chunk) => {
        const [url, ...rest] = chunk.trim().split(/\s+/);
        return [resolveUrl(url, { prefix }), ...rest].join(' ');
      })
      .join(', ');
    if (next !== srcset) node.setAttribute('srcset', next);
  }
}

/**
 * Rewrites every relative URL inside `root` (and `root` itself).
 * @param {ParentNode|Element} [root]
 * @param {{prefix?: string}} [options]
 * @returns {number} how many URLs were rewritten
 */
export function fixLinks(root = document, options = {}) {
  if (!root) return 0;
  const prefix = options.prefix ?? basePrefix();
  if (!prefix) return 0;
  let changed = 0;

  const nodes = [];
  if (root instanceof Element) nodes.push(root);
  nodes.push(...$$('*', root));

  for (const node of nodes) {
    if (!(node instanceof Element)) continue;
    const before = node.getAttribute('href') ?? node.getAttribute('src') ?? '';
    rewriteNode(node, prefix);
    const after = node.getAttribute('href') ?? node.getAttribute('src') ?? '';
    if (before !== after) changed += 1;
  }
  return changed;
}

let observer = null;

/**
 * Watches the document for injected markup and fixes its URLs as it appears.
 * Safe to call more than once — a single observer is kept alive.
 */
export function observeLinks(root = document.body) {
  if (observer || typeof MutationObserver === 'undefined' || !root) return observer;
  observer = new MutationObserver((records) => {
    const prefix = basePrefix();
    if (!prefix) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) fixLinks(node, { prefix });
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

/** Convenience for controllers: `href="crm/contacts.html"` → correct URL. */
export const url = (path) => resolveUrl(path);

export default { fixLinks, observeLinks, resolveUrl, basePrefix, pageDepth, url };
