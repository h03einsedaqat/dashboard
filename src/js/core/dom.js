/**
 * NOVAADMIN — DOM helpers
 * Tiny, dependency-free utilities used by every module. Nothing here mutates
 * global scope: modules import what they need.
 */

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/** Runs `fn` once the document is parsed (or immediately if already parsed). */
export function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

/**
 * Idempotence guard for initialisers.
 *
 * `initUi()` and `initForms()` run twice by design: every core module boots
 * itself on DOMContentLoaded (so it also works when a page imports only that
 * module) and `main.js` calls them again to pin the boot order. Without this
 * guard the *delegated* listeners they install are registered twice — harmless
 * for setters (tabs, tooltips) and fatal for toggles: the password eye flipped
 * to `text` and straight back to `password`, an accordion opened and closed in
 * the same click, and a stepper jumped by two.
 *
 * Returns `true` only the first time it sees a (key, root) pair.
 */
const onceSeen = new WeakMap();
export function once(key, root = document) {
  const seen = onceSeen.get(root) ?? new Set();
  onceSeen.set(root, seen);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

export function on(target, type, handler, options) {
  if (!target) return () => {};
  const types = type.split(' ');
  types.forEach((t) => target.addEventListener(t, handler, options));
  return () => types.forEach((t) => target.removeEventListener(t, handler, options));
}

/** Event delegation: `delegate(root, 'click', '[data-close]', handler)`. */
export function delegate(root, type, selector, handler) {
  return on(root, type, (event) => {
    const match = event.target.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  });
}

export function create(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  });
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child instanceof Node ? child : document.createTextNode(String(child))));
  return node;
}

export const el = create;

export function html(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup).trim();
  return template.content.firstElementChild;
}

export function fragment(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup).trim();
  return template.content;
}

export const addClass = (node, ...names) => names.filter(Boolean).forEach((name) => node?.classList.add(name));
export const removeClass = (node, ...names) => names.filter(Boolean).forEach((name) => node?.classList.remove(name));
export const toggleClass = (node, name, force) => node?.classList.toggle(name, force);
export const show = (node) => node?.removeAttribute('hidden');
export const hide = (node) => node?.setAttribute('hidden', '');
export const setAttr = (node, name, value) => (value === null || value === undefined || value === false ? node?.removeAttribute(name) : node?.setAttribute(name, value));

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

/** Replaces the children of `node` with rendered markup (XSS-safe by construction). */
export function render(node, markup) {
  if (!node) return node;
  node.replaceChildren(typeof markup === 'string' ? fragment(markup) : markup);
  return node;
}

/**
 * `mount()` converts a plain string into a detached element and re-inserts the
 * original node when the incoming markup is empty. Used by page controllers
 * that swap panel content.
 */
export function mount(container, markup) {
  if (!container) return null;
  container.replaceChildren(fragment(markup));
  return container.firstElementChild;
}

export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait = 150) {
  let last = 0;
  let queued;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(queued);
      queued = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, wait - (now - last));
    }
  };
}

/** Traps Tab focus inside `container` while it is open (modals, drawers, palette). */
export function focusTrap(container) {
  const selector = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const nodes = $$(selector, container).filter((node) => node.offsetParent !== null || node === document.activeElement);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

/** Locks body scroll (used by drawer/modal/command palette) and restores it. */
let lockCount = 0;
export function lockScroll(lock = true) {
  lockCount = Math.max(0, lockCount + (lock ? 1 : -1));
  const locked = lockCount > 0;
  document.documentElement.classList.toggle('is-scroll-locked', locked);
  document.body.style.overflow = locked ? 'hidden' : '';
  document.documentElement.style.setProperty('--nv-scrollbar-gap', `${window.innerWidth - document.documentElement.clientWidth}px`);
}

export function closestScrollable(node) {
  let current = node?.parentElement;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (/(auto|scroll)/.test(overflowY) && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return window;
}
