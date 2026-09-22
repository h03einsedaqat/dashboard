/**
 * NOVAADMIN — runtime smoke test
 * ------------------------------------------------------------------
 * A build can pass and the page can still explode in the browser. This script
 * boots the *real* application modules inside a minimal DOM (jsdom is not a
 * dependency, so the shim below implements only what the template touches) and
 * exercises the ten dashboards plus every area controller.
 *
 *   node tools/smoke.mjs
 *
 * It reports, per scenario: modules loaded, render errors and console.warn
 * output. Exits non-zero when a scenario throws.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_DIR = path.join(ROOT, 'src/pages');

/* ------------------------------------------------------------- DOM shim ---- */

/** Diagnostics collected while a scenario runs (missing shim APIs, null nodes). */
const shimIssues = [];

/**
 * Minimal DocumentFragment. `<template>` elements expose one on `.content`,
 * which is how `core/dom.js` builds markup (`fragment()`), so the shim needs it
 * for any `render()` call to actually land in the DOM.
 */
class Fragment {
  constructor() {
    this.children = [];
    this.isFragment = true;
  }
  append(...nodes) {
    nodes.forEach((node) => {
      const child = typeof node === 'string' ? new Text(node) : node;
      if (!child) return;
      child.parentElement = this;
      this.children.push(child);
    });
  }
  get firstElementChild() {
    return this.children.find((child) => child instanceof Element) ?? null;
  }
  get innerHTML() {
    return '';
  }
}

class ClassList {
  constructor(node) {
    this.node = node;
    this.set = new Set();
  }
  add(...names) {
    names.forEach((name) => name && this.set.add(name));
  }
  remove(...names) {
    names.forEach((name) => this.set.delete(name));
  }
  contains(name) {
    return this.set.has(name);
  }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : Boolean(force);
    if (on) this.set.add(name);
    else this.set.delete(name);
    return on;
  }
  get value() {
    return [...this.set].join(' ');
  }
}

/**
 * Rebuilds markup from a live shim node (used by the `innerHTML` getter).
 * Reuses the parser's `VOID_TAGS` list, declared further down.
 */
function serializeNode(node) {
  if (!node) return '';
  if (node.isFragment) return (node.children ?? []).map((child) => serializeNode(child)).join('');
  if (node.nodeType === 3) return String(node.textContent ?? '');
  const attrs = Object.entries(node.attributes ?? {})
    .map(([key, value]) => ` ${key}="${String(value).replace(/"/g, '&quot;')}"`)
    .join('');
  const tag = String(node.tagName ?? 'div').toLowerCase();
  if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${(node.children ?? []).map((child) => serializeNode(child)).join('')}</${tag}>`;
}

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.namespaceURI = 'http://www.w3.org/1999/xhtml';
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' };
    this.classList = new ClassList(this);
    this.listeners = new Map();
    this.parentElement = null;
    this.value = '';
    this.hidden = false;
    this.isConnected = true;
    this.files = [];
    /** `<template>` keeps its markup in a fragment, like the real DOM. */
    this.content = this.tagName === 'TEMPLATE' ? new Fragment() : null;
  }
  set className(value) {
    this.classList.set = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  get className() {
    return this.classList.value;
  }
  set innerHTML(html) {
    this._html = String(html);
    if (this.content) {
      this.content.children = [];
      this.content.append(...parse(this._html));
      return;
    }
    /**
     * Careful: the parser appends nested nodes to the *parent* it is given, so
     * passing `this` and then assigning the returned array would throw the
     * parsed tree away. Parsing standalone and appending keeps both cases
     * correct (root nodes and nested children).
     */
    this.children = [];
    this.append(...parse(this._html));
  }
  /**
   * Serialises the live tree. `render()` paints with `replaceChildren()`, which
   * never touches the original markup string, so the getter has to walk the
   * children to stay truthful — this is what `--all` dumps and any page code
   * that reads `innerHTML` back gets.
   */
  get innerHTML() {
    if (this.children?.length) return this.children.map((child) => serializeNode(child)).join('');
    return this.content ? this.content.children.map((child) => serializeNode(child)).join('') : this._html ?? '';
  }
  /**
   * Text content behaves like the DOM: setting it replaces every child with a
   * single text node, reading it concatenates the subtree. Several core modules
   * read labels and search text through it (`datatable` column titles, `ui`
   * list filters, `kanban` search), so a stub value would silently disable
   * those features inside the harness instead of testing them.
   */
  set textContent(value) {
    this.children = [];
    if (value !== '' && value !== null && value !== undefined) this.append(new Text(String(value)));
  }
  get textContent() {
    return (this.children ?? []).map((child) => child?.textContent ?? '').join('');
  }
  get outerHTML() {
    return this._html ?? `<${this.tagName.toLowerCase()}>`;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[key] = String(value);
    }
    if (name === 'class') this.className = value;
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name.startsWith('data-')) {
      delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    }
  }
  hasAttribute(name) {
    return name in this.attributes;
  }
  append(...nodes) {
    nodes.forEach((node) => {
      // The browser stringifies null/undefined here; flag it instead of
      // silently rendering "undefined" so the smoke run can report the source.
      if (node === null || node === undefined) {
        shimIssues.push(`append(${String(node)}) at ${new Error().stack?.split('\n')[2]?.trim() ?? 'unknown'}`);
        return;
      }
      const child = typeof node === 'string' ? new Text(node) : node;
      // Appending a fragment moves its children (DOM spec) — this is how every
      // `render()` call hands its markup over.
      if (child?.isFragment) {
        child.children.forEach((grandChild) => {
          grandChild.parentElement = this;
          this.children.push(grandChild);
        });
        child.children = [];
        return;
      }
      child.parentElement = this;
      this.children.push(child);
    });
  }
  /** Replaces every child — the primary paint path in `core/dom.js`. */
  replaceChildren(...nodes) {
    this.children.forEach((child) => {
      child.parentElement = null;
    });
    this.children = [];
    this.append(...nodes);
  }
  prepend(...nodes) {
    nodes.reverse().forEach((node) => {
      const child = typeof node === 'string' ? new Text(node) : node;
      if (!child) return;
      child.parentElement = this;
      this.children.unshift(child);
    });
  }
  before(node) {
    const siblings = this.parentElement?.children;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    const child = typeof node === 'string' ? new Text(node) : node;
    child.parentElement = this.parentElement;
    siblings.splice(index === -1 ? siblings.length : index, 0, child);
  }
  after(node) {
    const siblings = this.parentElement?.children;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    const child = typeof node === 'string' ? new Text(node) : node;
    child.parentElement = this.parentElement;
    siblings.splice(index === -1 ? siblings.length : index + 1, 0, child);
  }
  replaceWith(node) {
    const siblings = this.parentElement?.children;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    const child = typeof node === 'string' ? new Text(node) : node;
    child.parentElement = this.parentElement;
    if (index !== -1) siblings.splice(index, 1, child);
  }
  setSelectionRange() {}
  scrollTo() {}
  insertBefore(node, reference) {
    const index = reference ? this.children.indexOf(reference) : -1;
    const child = typeof node === 'string' ? new Text(node) : node;
    if (child?.isFragment) {
      const moved = [...child.children];
      moved.forEach((grandChild) => {
        grandChild.parentElement = this;
      });
      child.children = [];
      if (index === -1) this.children.push(...moved);
      else this.children.splice(index, 0, ...moved);
      return moved[0] ?? null;
    }
    child.parentElement = this;
    if (index === -1) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  contains(node) {
    return descendants(this).includes(node);
  }
  matches(selector) {
    return matches(this, selector);
  }
  cloneNode() {
    const copy = new Element(this.tagName.toLowerCase());
    Object.entries(this.attributes).forEach(([name, value]) => copy.setAttribute(name, value));
    copy.innerHTML = this.innerHTML;
    return copy;
  }
  appendChild(node) {
    this.append(node);
    return node;
  }
  insertAdjacentHTML(position, html) {
    const nodes = parse(String(html), this);
    if (position === 'afterbegin') this.children.unshift(...nodes);
    else this.children.push(...nodes);
  }
  insertAdjacentElement(position, node) {
    node.parentElement = this;
    if (position === 'afterend') this.parentElement?.append(node);
    else this.append(node);
    return node;
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  dispatchEvent(event) {
    (this.listeners.get(event.type) ?? []).forEach((handler) => handler.call(this, event));
    return true;
  }
  /** Click delegation used by the test harness. */
  click() {
    return this.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {}, target: this });
  }
  focus() {}
  blur() {}
  scrollIntoView() {}
  requestSubmit() {
    this.dispatchEvent({ type: 'submit', preventDefault() {}, target: this });
  }
  getBoundingClientRect() {
    return { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 };
  }
  querySelectorAll(selector) {
    return descendants(this).filter((node) => matches(node, selector));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  get firstElementChild() {
    return this.children.find((child) => child instanceof Element) ?? null;
  }
  get lastElementChild() {
    return [...this.children].reverse().find((child) => child instanceof Element) ?? null;
  }
  get nextElementSibling() {
    const siblings = this.parentElement?.children ?? [];
    const index = siblings.indexOf(this);
    return siblings.slice(index + 1).find((child) => child instanceof Element) ?? null;
  }
  get previousElementSibling() {
    const siblings = this.parentElement?.children ?? [];
    const index = siblings.indexOf(this);
    return siblings.slice(0, index).reverse().find((child) => child instanceof Element) ?? null;
  }
  remove() {
    const siblings = this.parentElement?.children ?? [];
    const index = siblings.indexOf(this);
    if (index > -1) siblings.splice(index, 1);
  }
  get elements() {
    return this.querySelectorAll('*');
  }
  get options() {
    return this.querySelectorAll('option');
  }
  get selectedOptions() {
    return this.options.filter((option) => option.hasAttribute('selected'));
  }
  get form() {
    return this.closest('form');
  }
}

class Text {
  constructor(value) {
    this.nodeType = 3;
    this.textContent = String(value);
    this.value = this.textContent;
  }
}

/* -------------------------------------------------------- tiny CSS matcher -- */

/** Matches one *simple* selector part (`div.a[data-x="1"]`, `#id`…). */
function matchesSimple(node, part) {
  if (!(node instanceof Element)) return false;
  if (part === '*') return true;
  const tag = part.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  let rest = part;
  if (tag) {
    if (node.tagName !== tag[0].toUpperCase()) return false;
    rest = part.slice(tag[0].length);
  }
  const classes = [...rest.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  if (classes.some((name) => !node.classList.contains(name))) return false;
  const attrs = [...rest.matchAll(/\[([a-zA-Z0-9_-]+)(?:[~*^$]?=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/g)];
  for (const [, name, dq, sq, bare] of attrs) {
    if (!node.hasAttribute(name)) return false;
    const expected = dq ?? sq ?? bare;
    if (expected !== undefined && node.getAttribute(name) !== expected) return false;
  }
  const id = rest.match(/#([A-Za-z0-9_-]+)/);
  if (id && node.getAttribute('id') !== id[1]) return false;
  return true;
}

/**
 * Matches a (comma separated) selector, including descendant combinators
 * (`tbody tr`, `.card .stat-card`). The shim only needs this small subset — the
 * template never uses child/sibling combinators in `querySelector*`.
 */
function matches(node, selector) {
  if (!(node instanceof Element)) return false;
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const chain = part.split(/\s+/).filter(Boolean);
      if (!chain.length) return false;
      if (!matchesSimple(node, chain[chain.length - 1])) return false;
      let ancestor = node.parentElement;
      for (let index = chain.length - 2; index >= 0; index -= 1) {
        let found = false;
        while (ancestor) {
          if (matchesSimple(ancestor, chain[index])) {
            found = true;
            ancestor = ancestor.parentElement;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        if (!found) return false;
      }
      return true;
    });
}

function descendants(node, acc = []) {
  node.children.forEach((child) => {
    if (child instanceof Element) {
      acc.push(child);
      descendants(child, acc);
    }
  });
  return acc;
}

/* ------------------------------------------------------------- HTML parser -- */

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Extremely small HTML parser — enough for the markup this template emits. */
function parse(html, parent = null) {
  const roots = [];
  const stack = [];
  const tokenRe = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>|([^<]+)/gi;
  let match;

  const push = (node) => {
    const parentNode = stack.at(-1) ?? parent;
    if (parentNode) {
      node.parentElement = parentNode;
      parentNode.children.push(node);
    } else roots.push(node);
  };

  while ((match = tokenRe.exec(html))) {
    const [raw, closeTag, openTag, attrString, selfClose, text] = match;
    if (raw.startsWith('<!--') || raw.startsWith('<![') || /^<!doctype/i.test(raw)) continue;
    if (closeTag) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tagName === closeTag.toUpperCase()) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (openTag) {
      const node = new Element(openTag);
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let attr;
      while ((attr = attrRe.exec(attrString))) {
        const [, name, dq, sq, bare] = attr;
        if (!name || name === '/') continue;
        node.setAttribute(name, dq ?? sq ?? bare ?? '');
      }
      push(node);
      if (!VOID_TAGS.has(openTag.toLowerCase()) && !selfClose) stack.push(node);
      continue;
    }
    if (text && text.trim()) push(new Text(text));
  }
  return roots;
}

/* --------------------------------------------------------------- environment */

/**
 * Splits a full page document into its `<body>` attributes and inner markup, so
 * the shim mirrors what the browser puts on `document.body` (including
 * `data-page` / `data-section`, which drive the page controllers).
 */
function splitBody(html) {
  const match = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  if (match) return { attrString: match[1] ?? '', inner: match[2] ?? '' };
  const withoutHead = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<!doctype[^>]*>/i, '');
  return { attrString: '', inner: withoutHead };
}

function buildDocument(html) {
  const documentElement = new Element('html');
  const body = new Element('body');
  const document = {
    documentElement,
    body,
    title: '',
    hidden: false,
    fullscreenElement: null,
    readyState: 'complete',
    createElement: (tag) => new Element(tag),
    /**
     * Charting and icon libraries build their SVG with `createElementNS`. The
     * harness has no SVG engine, so this returns the same element shape and
     * only records the namespace — enough for the mount path to run.
     */
    createElementNS: (namespaceURI, tag) => {
      const node = new Element(tag);
      node.namespaceURI = namespaceURI;
      return node;
    },
    createDocumentFragment: () => new Fragment(),
    createTextNode: (text) => new Text(text),
    getElementById: (id) => descendants(documentElement).find((node) => node.getAttribute('id') === id) ?? null,
    querySelector: (selector) => documentElement.querySelector(selector),
    querySelectorAll: (selector) => documentElement.querySelectorAll(selector),
    addEventListener: (type, handler) => documentElement.addEventListener(type, handler),
    removeEventListener: () => {},
    dispatchEvent: (event) => documentElement.dispatchEvent(event),
    execCommand: () => true,
    exitFullscreen: async () => {},
    documentElement2: null,
  };
  documentElement.append(body);
  if (html) {
    const { attrString, inner } = splitBody(html);
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let attr;
    while ((attr = attrRe.exec(attrString))) {
      const [, name, dq, sq, bare] = attr;
      if (!name || name === '/') continue;
      body.setAttribute(name, dq ?? sq ?? bare ?? '');
    }
    body.innerHTML = inner;
    const title = html.match(/<title>([^<]*)<\/title>/i);
    if (title) document.title = title[1].trim();
  }
  return { document, documentElement, body };
}

async function bootScenario(pageHtml, label, inspect = null, settle = 260) {
  shimIssues.length = 0;
  const { document, documentElement, body } = buildDocument(pageHtml);
  const warnings = [];
  const errors = [];
  const store = new Map();

  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };

  const win = {
    document,
    localStorage,
    location: { origin: 'http://localhost', href: 'http://localhost/index.html', search: '', hash: '', pathname: '/index.html', assign() {}, replace() {} },
    navigator: { userAgent: 'node', platform: 'Linux', language: 'fa-IR', languages: ['fa-IR'], clipboard: { writeText: async () => {} }, onLine: true },
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    addEventListener: (type, handler) => documentElement.addEventListener(type, handler),
    removeEventListener: () => {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args),
    getComputedStyle: () => ({ getPropertyValue: () => '', setProperty() {}, removeProperty() {} }),
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    URLSearchParams,
    Event: class {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
      preventDefault() {}
      stopPropagation() {}
    },
    MouseEvent: class {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
      preventDefault() {}
      stopPropagation() {}
    },
    FormData: class {},
    Blob: class {},
  };
  win.Element = Element;
  win.HTMLElement = Element;
  win.Node = Element;
  win.Text = Text;
  win.window = win;
  win.self = win;
  win.globalThis = win;
  win.top = win;

  const consoleProxy = {
    log: () => {},
    info: () => {},
    debug: () => {},
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    error: (...args) => errors.push(args.map(String).join(' ')),
  };

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator')?.value,
    localStorage: globalThis.localStorage,
    console: globalThis.console,
  };

  // DOM constructors the template touches (`instanceof Element`, `new CustomEvent`…)
  globalThis.Element = Element;
  globalThis.HTMLElement = Element;
  globalThis.HTMLInputElement = Element;
  globalThis.HTMLFormElement = Element;
  globalThis.Node = Element;
  globalThis.Text = Text;
  globalThis.CustomEvent = win.CustomEvent;
  globalThis.Event = win.Event;
  globalThis.window = win;
  globalThis.document = document;
  Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true });
  globalThis.localStorage = localStorage;
  globalThis.console = consoleProxy;
  globalThis.getComputedStyle = win.getComputedStyle;
  globalThis.matchMedia = win.matchMedia;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.IntersectionObserver = win.IntersectionObserver;
  globalThis.ResizeObserver = win.ResizeObserver;

  const loaded = [];
  const result = { label, warnings, errors, loaded };

  /**
   * The shim never dispatches `unhandledrejection`, so a background failure
   * (a chart, a drag library, a late render) would otherwise abort the whole
   * audit. Collect them per scenario instead.
   */
  const onUnhandled = (reason) => {
    const message = reason instanceof Error ? `${reason.message}` : String(reason);
    if (!errors.includes(message)) errors.push(message);
  };
  process.on('unhandledRejection', onUnhandled);

  try {
    /**
     * Boot the *real* application entry point. `src/main.js` owns the full
     * start-up order (i18n → theme → layout → chrome → forms → ui → page
     * controller → generic renderer → tables → charts → kanban → calendar), so
     * exercising it here is the closest thing to opening the page in a browser.
     * The cache-busting query re-imports the entry per scenario; `ready(boot)`
     * runs immediately because the shim reports `readyState === 'complete'`.
     */
    const tag = `?smoke=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await import(`../src/main.js${tag}`);
    loaded.push('main');

    // settle window for the mock services (latency is 180–420 ms)
    await new Promise((resolve) => setTimeout(resolve, settle));

    if (inspect) result.metrics = inspect(document);
    result.shimIssues = [...shimIssues];
  } catch (error) {
    result.error = error;
  } finally {
    process.off('unhandledRejection', onUnhandled);
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    delete globalThis.Element;
    delete globalThis.HTMLElement;
    delete globalThis.HTMLInputElement;
    delete globalThis.HTMLFormElement;
    delete globalThis.Node;
    delete globalThis.Text;
    if (previous.navigator) Object.defineProperty(globalThis, 'navigator', { value: previous.navigator, configurable: true, writable: true });
    globalThis.localStorage = previous.localStorage;
    globalThis.console = previous.console;
  }
  return result;
}

/* ------------------------------------------------------------------- runner */

const VERBOSE = process.argv.includes('--verbose');

/** Every generated page, relative to `src/pages`. */
function walkPages(dir, prefix = '', acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walkPages(path.join(dir, entry.name), `${prefix}${entry.name}/`, acc);
    else if (entry.name.endsWith('.html')) acc.push(`${prefix}${entry.name}`);
  }
  return acc.sort();
}

function pageHtml(url) {
  const file = path.join(PAGE_DIR, url);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

/** A representative page for every kind of controller the app can boot. */
const SCENARIOS = [
  'dashboards/analytics.html',
  'dashboards/ecommerce.html',
  'dashboards/crm.html',
  'dashboards/saas.html',
  'dashboards/finance.html',
  'dashboards/projects.html',
  'dashboards/hr.html',
  'dashboards/support.html',
  'dashboards/ai.html',
  'dashboards/logistics.html',
  'ecommerce/products.html',
  'ecommerce/orders.html',
  'ecommerce/product-grid.html',
  'ecommerce/product-details.html',
  'ecommerce/order-details.html',
  'ecommerce/inventory.html',
  'crm/pipeline.html',
  'crm/contacts.html',
  'crm/contact-details.html',
  'customers/details.html',
  'customers/segments.html',
  'crm/deal-details.html',
  'finance/invoices.html',
  'finance/invoice-details.html',
  'finance/invoice-create.html',
  'customers/details.html',
  'customers/segments.html',
  'finance/overview.html',
  'projects/kanban.html',
  'projects/details.html',
  'projects/tasks.html',
  'projects/timeline.html',
  'support/tickets.html',
  'support/ticket-details.html',
  'support/agents.html',
  'support/knowledge-base.html',
  'hr/attendance.html',
  'hr/leave.html',
  'hr/payroll.html',
  'hr/recruitment.html',
  'hr/employee-profile.html',
  'hr/departments.html',
  'logistics/shipments.html',
  'logistics/tracking.html',
  'reports/sales.html',
  'reports/finance.html',
  'users/list.html',
  'users/create.html',
  'users/details.html',
  'users/roles.html',
  'ai/chat.html',
  'ai/writer.html',
  'ai/summarizer.html',
  'ai/repurposer.html',
  'ai/images.html',
  'ai/usage.html',
  'ai/scheduler.html',
  'ai/models.html',
  'ai/api-keys.html',
  'preview.html',
  'widgets.html',
  'ai/history.html',
  'ai/dashboard.html',
  'ai/prompts.html',
  'apps/email.html',
  'apps/chat.html',
  'apps/calendar.html',
  'apps/file-manager.html',
  'apps/media-library.html',
  'apps/notifications.html',
  'cms/posts.html',
  'cms/page-builder.html',
  'cms/post-create.html',
  'settings/general.html',
  'settings/appearance.html',
  'profile/overview.html',
  'profile/security.html',
  'docs/introduction.html',
  'ui/buttons.html',
  'ui/forms.html',
  'ui/tables.html',
  'ui/charts.html',
  'ui/colors.html',
  'ui/icons.html',
  'ui/states.html',
  'auth/login.html',
  'auth/register.html',
  'auth/verify-email.html',
  'auth/lock-screen.html',
  'auth/forgot-password.html',
  'auth/reset-password.html',
  'auth/two-factor.html',
  'auth/login-split.html',
  'auth/login-minimal.html',
  'auth/logout.html',
  'auth/error.html',
  'system/pricing.html',
  'system/faq.html',
  'system/status.html',
  'system/help-center.html',
  'system/contact.html',
  'system/terms.html',
  'system/changelog.html',
  'system/403.html',
  'system/404.html',
  'system/500.html',
  'system/offline.html',
  'system/coming-soon.html',
  'system/blank.html',
  'system/privacy.html',
  'system/search-results.html',
  'system/maintenance.html',
  'crm/contact-details.html',
  'customers/details.html',
  'customers/segments.html',
  'crm/company-details.html',
  'crm/deal-details.html',
  'crm/companies.html',
  'crm/leads.html',
  'crm/deals.html',
  'customers/list.html',
  'customers/segments.html',
  'hr/employees.html',
  'projects/list.html',
  'projects/details.html',
  'ecommerce/categories.html',
  'ecommerce/coupons.html',
  'ecommerce/product-create.html',
  'ecommerce/reviews.html',
  'ecommerce/brands.html',
  'finance/invoice-details.html',
  'logistics/drivers.html',
  'logistics/warehouses.html',
  'reports/revenue.html',
  'reports/customers.html',
  'reports/products.html',
  'reports/traffic.html',
  'reports/support.html',
  'reports/performance.html',
  'support/knowledge-base.html',
  'users/teams.html',
  'users/invitations.html',
  'users/sessions.html',
  'users/permissions.html',
  'cms/categories.html',
  'cms/tags.html',
  'cms/media.html',
  'cms/comments.html',
  'widgets.html',
  'preview.html',
];

/* --------------------------------------------------------- content metrics -- */

/**
 * Counts the "data blocks" a visitor expects to see once a page has booted:
 * KPI cards, chart containers, table rows, timeline entries and list items.
 * Used by `--all` to catch pages that render empty without throwing.
 */
function measure(document) {
  const count = (selector) => document.querySelectorAll(selector).length;
  if (process.env.NOVA_DEBUG_DOM) {
    const kids = descendants(document.body);
    const apps = document.querySelectorAll('[data-app]');
    const win = globalThis.window;
    process.stdout.write(`    [debug] apps=${apps.length} appKids=${apps[0]?.children?.length ?? -1} nova=${typeof win?.NOVA} ready=${document.documentElement.classList.contains('app-ready')} page=${document.body?.dataset?.page}\n`);
    if (process.env.NOVA_DEBUG_HTML) {
      const selector = process.env.NOVA_DEBUG_SELECTOR;
      const target = selector ? document.querySelector(selector) : process.env.NOVA_DEBUG_BODY ? document.body : apps[0] ?? document.body;
      process.stdout.write(`    [html] ${String(target.innerHTML).replace(/\s+/g, ' ').slice(0, Number(process.env.NOVA_DEBUG_HTML) || 900)}\n`);
    }
  }
  /**
   * Content length is measured inside `#main-content`, so the sidebar and
   * header chrome (present on every page) cannot make an empty page look full.
   */
  const main = document.querySelector('#main-content') ?? document.body;
  const text = main?.textContent ?? '';
  /**
   * One "record" is one repeated unit of real content: a table row, a chat
   * message, a mail thread, a card in a grid, a demo specimen. Counting them
   * lets the runner tell a full application screen from an empty shell without
   * caring which module rendered it.
   */
  const items = count(
    '.msg, .chat-contact, .mail-item, .file-card, .file-row, .media-item, .kanban-card, .calendar-event, .list-item, .timeline__item, ' +
      '.changelog-item, .accordion-item, .demo-item, .demo-icon, .demo-swatch, .demo-type-row, .form-field, .stat-card, ' +
      '.builder-block, .builder-section, .gantt__row, .status-service, .price-card, .help-article, .doc-nav__link, tbody tr',
  );
  return {
    items,
    textLength: text.replace(/\s+/g, ' ').trim().length,
    kpi: count('.stat-card'),
    charts: count('[data-chart]'),
    rows: count('tbody tr'),
    cards: count('.card'),
    timeline: count('.timeline__item'),
    listItems: count('.list-item'),
    fields: count('input, select, textarea'),
    kanban: count('.kanban-card'),
    errorState: /خطا در آماده‌سازی|Something went wrong|state-error__title/.test(text),
  };
}

/**
 * Not every page is a data page: documentation is prose, auth screens are
 * forms, error pages carry a single message. This table states what a *filled*
 * page looks like per area, so `--all` gates on the right signal instead of
 * counting table rows on a login screen.
 */
const PAGE_EXPECTATIONS = [
  { match: /^(docs\/|preview\.html|system\/(privacy|terms))/, kind: 'prose', floor: 600 },
  { match: /^ui\//, kind: 'specimen', floor: 200 },
  { match: /^auth\//, kind: 'form', floor: 1 },
  { match: /^system\/(403|404|500|blank|error|maintenance|coming-soon|offline|no-access)/, kind: 'message', floor: 110 },
];

/**
 * Decides whether a page has real content on screen.
 * @returns {{ok: boolean, label: string, value: number}}
 */
function judgePage(url, m) {
  const blocks = (m.kpi ?? 0) + (m.charts ?? 0) + (m.rows ?? 0) + (m.cards ?? 0) + (m.timeline ?? 0) + (m.kanban ?? 0) + (m.listItems ?? 0) + (m.items ?? 0);
  const expectation = PAGE_EXPECTATIONS.find((entry) => entry.match.test(url));
  if (expectation?.kind === 'prose') {
    return { ok: blocks >= 4 || m.textLength >= expectation.floor, label: 'prose blocks', value: blocks };
  }
  if (expectation?.kind === 'specimen') {
    // A specimen sheet is mostly markup, so it needs a rendered stage plus
    // readable copy — not the six data blocks a dashboard must show.
    return { ok: blocks >= 3 && m.textLength >= expectation.floor, label: 'specimen blocks', value: blocks };
  }
  if (expectation?.kind === 'form') {
    return { ok: blocks >= 4 || m.fields >= expectation.floor, label: 'form controls', value: m.fields ?? 0 };
  }
  if (expectation?.kind === 'message') {
    return { ok: blocks >= 4 || m.textLength >= expectation.floor, label: 'message length', value: m.textLength ?? 0 };
  }
  /**
   * Tool screens (`ai/writer`, `ai/repurposer`, `cms/post-create`…) are mostly
   * an editor: several cards plus the form controls of the actual tool. A
   * screen like that is complete without six data blocks, but it must still
   * carry a real form.
   */
  if (blocks >= 6) return { ok: true, label: 'data blocks', value: blocks };
  const toolSurface = (m.fields ?? 0) >= 5 && (m.cards ?? 0) + (m.items ?? 0) >= 3;
  return toolSurface
    ? { ok: true, label: 'tool surface', value: m.fields ?? 0 }
    : { ok: false, label: 'data blocks', value: blocks };
}

const ALL_PAGES = walkPages(PAGE_DIR);
const allMode = process.argv.includes('--all');
const filterTerm = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const selected = allMode
  ? ALL_PAGES.filter((url) => !filterTerm || url.includes(filterTerm))
  : filterTerm
    ? SCENARIOS.filter((url) => url.includes(filterTerm))
    : SCENARIOS;
let failures = 0;
const thin = [];
const errored = [];
const totals = { kpi: 0, charts: 0, rows: 0 };

for (const url of selected) {
  const html = pageHtml(url);
  if (!html) {
    console.log(`• ${url}: SKIPPED (page not generated yet)`);
    continue;
  }
  const result = await bootScenario(html, url, allMode ? measure : null, allMode ? 1500 : 1200);
  const status = result.error ? '✖' : '✔';
  if (result.error) failures += 1;

  if (allMode) {
    const m = result.metrics ?? {};
    totals.kpi += m.kpi ?? 0;
    totals.charts += m.charts ?? 0;
    totals.rows += m.rows ?? 0;
    const verdict = judgePage(url, m);
    if (result.error) errored.push({ url, message: String(result.error.message).slice(0, 120) });
    else if (m.errorState) errored.push({ url, message: 'rendered the page error state' });
    else if (result.errors.length) errored.push({ url, message: result.errors[0].slice(0, 120) });
    else if (!verdict.ok) thin.push({ url, blocks: verdict.value, label: verdict.label, m });
    if (VERBOSE) {
      console.log(`${status} ${url}  kpi:${m.kpi} charts:${m.charts} rows:${m.rows} cards:${m.cards} list:${m.listItems} timeline:${m.timeline} items:${m.items} text:${m.textLength}`);
    }
    continue;
  }

  console.log(`${status} ${url}`);
  if (result.error) console.log(`    error: ${result.error.message}\n${String(result.error.stack).split('\n').slice(1, 4).join('\n')}`);
  (result.shimIssues ?? []).slice(0, 2).forEach((line) => console.log(`    dom: ${line.slice(0, 170)}`));
  result.errors.slice(0, 3).forEach((line) => console.log(`    console.error: ${line.slice(0, 160)}`));
  result.warnings.slice(0, 3).forEach((line) => console.log(`    warn: ${line.slice(0, 160)}`));
}

if (allMode) {
  console.log('');
  console.log(`  pages booted   ${selected.length - failures}/${selected.length}`);
  console.log(`  data rendered  ${totals.kpi} KPI cards · ${totals.charts} charts · ${totals.rows} table rows`);
  if (errored.length) {
    console.log('');
    console.log(`  ✖ ${errored.length} pages reported a problem:`);
    for (const item of errored) console.log(`    · ${item.url} — ${item.message}`);
  }
  if (thin.length) {
    console.log('');
    console.log(`  ⚠ ${thin.length} pages look empty for their area:`);
    for (const item of thin.slice(0, 60)) {
      console.log(`    · ${item.url} (${item.label}: ${item.blocks}) — kpi:${item.m.kpi} charts:${item.m.charts} rows:${item.m.rows} items:${item.m.items} fields:${item.m.fields} text:${item.m.textLength}`);
    }
    if (thin.length > 60) console.log(`    … ${thin.length - 60} more`);
  }
  if (!errored.length && !thin.length) console.log('\n✔ every page booted with data on screen.');
  process.exit(failures || errored.length ? 1 : 0);
}

console.log(`\n${selected.length - failures}/${selected.length} scenarios booted cleanly`);
process.exit(failures ? 1 : 0);
