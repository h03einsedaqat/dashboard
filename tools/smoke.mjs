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

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' };
    this.classList = new ClassList(this);
    this.listeners = new Map();
    this.parentElement = null;
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.isConnected = true;
    this.files = [];
  }
  set className(value) {
    this.classList.set = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  get className() {
    return this.classList.value;
  }
  set innerHTML(html) {
    this._html = String(html);
    this.children = parse(this._html, this);
  }
  get innerHTML() {
    return this._html ?? '';
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
      const child = typeof node === 'string' ? new Text(node) : node;
      child.parentElement = this;
      this.children.push(child);
    });
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
    this.textContent = String(value);
    this.value = this.textContent;
  }
}

/* -------------------------------------------------------- tiny CSS matcher -- */

function matches(node, selector) {
  if (!(node instanceof Element)) return false;
  return selector
    .split(',')
    .map((part) => part.trim())
    .some((part) => {
      if (!part) return false;
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
  if (html) body.innerHTML = html;
  return { document, documentElement, body };
}

async function bootScenario(pageHtml, label) {
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

  globalThis.window = win;
  globalThis.document = document;
  Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true });
  globalThis.localStorage = localStorage;
  globalThis.console = consoleProxy;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.IntersectionObserver = win.IntersectionObserver;
  globalThis.ResizeObserver = win.ResizeObserver;

  const loaded = [];
  const result = { label, warnings, errors, loaded };

  try {
    // `?t=` busts the module cache so each scenario boots cleanly.
    const tag = `?smoke=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { renderGenericApps } = await import(`../src/js/pages/generic.js${tag}`);
    await import(`../src/js/core/i18n.js${tag}`).then((m) => m.initI18n());
    loaded.push('i18n');
    await import(`../src/js/core/theme.js${tag}`).then((m) => m.initThemeControls());
    loaded.push('theme');
    await import(`../src/js/core/layout.js${tag}`).then((m) => m.layout.init());
    loaded.push('layout');
    await import(`../src/js/core/dropdown.js${tag}`).then((m) => m.initDropdowns());
    loaded.push('dropdowns');
    await import(`../src/js/core/chrome.js${tag}`).then((m) => m.initChrome());
    loaded.push('chrome');
    await import(`../src/js/core/ui.js${tag}`).then((m) => m.initUi());
    loaded.push('ui');
    await renderGenericApps(document);
    loaded.push('generic');
    await import(`../src/js/core/datatable.js${tag}`).then((m) => m.initDataTables());
    loaded.push('datatables');
    await import(`../src/js/core/charts.js${tag}`).then((m) => m.initCharts());
    loaded.push('charts');

    // small settle window for async services
    await new Promise((resolve) => setTimeout(resolve, 260));
  } catch (error) {
    result.error = error;
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    if (previous.navigator) Object.defineProperty(globalThis, 'navigator', { value: previous.navigator, configurable: true, writable: true });
    globalThis.localStorage = previous.localStorage;
    globalThis.console = previous.console;
  }
  return result;
}

/* ------------------------------------------------------------------- runner */

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

const selected = process.argv[2] ? SCENARIOS.filter((url) => url.includes(process.argv[2])) : SCENARIOS;
let failures = 0;

for (const url of selected) {
  const html = pageHtml(url);
  if (!html) {
    console.log(`• ${url}: SKIPPED (page not generated yet)`);
    continue;
  }
  const result = await bootScenario(html, url);
  const status = result.error ? '✖' : '✔';
  if (result.error) failures += 1;
  console.log(`${status} ${url}`);
  if (result.error) console.log(`    error: ${result.error.message}\n${String(result.error.stack).split('\n').slice(1, 4).join('\n')}`);
  result.errors.slice(0, 3).forEach((line) => console.log(`    console.error: ${line.slice(0, 160)}`));
  result.warnings.slice(0, 3).forEach((line) => console.log(`    warn: ${line.slice(0, 160)}`));
}

console.log(`\n${selected.length - failures}/${selected.length} scenarios booted cleanly`);
process.exit(failures ? 1 : 0);
