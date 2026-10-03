/**
 * NOVAADMIN — horizontal rails
 * ------------------------------------------------------------------
 * Chip rows, tab strips, conversation lists and folder bars are horizontal
 * scrollers. On a phone a hidden scrollbar makes them look *cut off* — the
 * «بقیه‌اش را نمی‌بینم» report — so every rail now grows:
 *
 *   • two round arrow buttons that page through the content (RTL aware),
 *   • a soft edge fade behind each arrow while there is more to see,
 *   • touch momentum + contained over-scroll, so the gesture never drags the
 *     page instead of the rail,
 *   • arrows that only appear while the rail really overflows — and never on
 *     top of content that fits.
 *
 * The buttons are *sticky flex items* of the scroller itself. A wrapper would
 * change the layout of every grid/flex parent, while an absolutely positioned
 * overlay inside a scroll container just scrolls away with the content; with
 * `position: sticky` + a negative inline margin the arrows pin themselves to
 * the scrollport edges without adding a single pixel of scroll width.
 *
 * Declarative: add `data-rail` to your scroller, or rely on the built-in
 * selector list (chat quick actions, conversation strip, folders, palettes…).
 * Everything is measured lazily, batched in a rAF and shared between rails, so
 * a page with twenty rails still costs one observer and one resize listener.
 */
import { on, debounce } from './dom.js';

const SELECTOR = [
  '[data-rail]',
  '[data-rail-auto]',
  '.aic-quick',
  '.aic-list',
  '.chat-presence-row',
  '.demo-strip',
  '.timeline-h',
  '.cms-builder__palette',
  '.mail-layout .mail-nav__list[data-mail-folders]',
].join(', ');

const START_BTN = `<button type="button" class="rail__btn rail__btn--start" data-rail-start aria-label="نمایش موارد قبلی"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>`;
const END_BTN = `<button type="button" class="rail__btn rail__btn--end" data-rail-end aria-label="نمایش موارد بعدی"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>`;

const mounted = new WeakSet();
const tracking = new Set();
const listeners = new WeakSet();

/**
 * One animation frame, *many* tasks: every measurement is batched, but a task
 * is never dropped because another one was already queued for that frame
 * (a scroll on one rail must not swallow the mount of a rail added a moment
 * later — that was a real "arrow appears only after you scroll again" bug).
 */
const pending = new Set();
let frame = null;
const flush = () => {
  frame = null;
  const tasks = [...pending];
  pending.clear();
  tasks.forEach((task) => task());
};
const schedule = (task) => {
  if (task) {
    if (pending.has(task)) pending.delete(task);
    pending.add(task);
  }
  if (frame === null) frame = requestAnimationFrame(flush);
};

/** Scrollable in the inline direction *and* actually painted. */
function isHorizontal(node) {
  if (node.hidden || node.offsetParent === null) return false;
  const style = getComputedStyle(node);
  if (!/(auto|scroll|overlay)/.test(style.overflowX)) return false;
  // Vertical lists (the desktop conversation sidebar) are left untouched.
  return node.scrollWidth - node.clientWidth > 8;
}

/**
 * How far the content has travelled from the inline start, normalised to
 * `0 … max` for both writing directions. RTL scrollers report negative
 * `scrollLeft` offsets, so the raw value is never usable on its own.
 */
function travelled(node, max = node.scrollWidth - node.clientWidth) {
  return Math.min(max, Math.max(0, Math.abs(node.scrollLeft)));
}

function paint(node) {
  const max = node.scrollWidth - node.clientWidth;
  const overflowing = max > 8;
  const pos = travelled(node, max);
  node.classList.toggle('rail--overflow', overflowing);
  node.classList.toggle('rail--at-start', !overflowing || pos < 6);
  node.classList.toggle('rail--at-end', !overflowing || pos > max - 6);
  const start = node.querySelector('[data-rail-start]');
  const end = node.querySelector('[data-rail-end]');
  if (start) start.disabled = !overflowing || pos < 6;
  if (end) end.disabled = !overflowing || pos > max - 6;
  /**
   * The arrows are absolutely positioned *inside* the scroller and translated
   * by the scroll offset (see `_rail.scss`). A sticky flex item was pinned to
   * the wrong edge by the browser as soon as the rail was RTL — the left arrow
   * then hung half outside the card and off the screen.
   */
  node.style.setProperty('--rail-pin', `${Math.round(node.scrollLeft)}px`);
  // Content appended after mount (a new chat message, a re-rendered list) must
  // not push the end arrow out of the last slot.
  if (end && node.lastElementChild !== end) node.append(end);
}

/**
 * Pages the rail one screen towards `start` or `end` — reading order, not
 * physical direction, so the same handler works for fa / en / ar.
 */
function page(node, direction) {
  const rtl = getComputedStyle(node).direction === 'rtl';
  const amount = Math.max(160, Math.round(node.clientWidth * 0.82));
  const max = node.scrollWidth - node.clientWidth;
  const current = travelled(node, max);
  // Clamping inside `0 … max` is what makes the two ends idempotent: the old
  // arithmetic added to `|scrollLeft|` and then wrote the sum with a *positive*
  // sign in RTL, which the browser clamps straight back to 0 — a dead arrow.
  const target = Math.max(0, Math.min(max, direction === 'start' ? current - amount : current + amount));
  const left = rtl ? -target : target;
  try {
    node.scrollTo({ left, behavior: 'smooth' });
  } catch {
    node.scrollLeft = left;
  }
}

function mount(node) {
  if (mounted.has(node)) return;
  mounted.add(node);
  node.classList.add('rail');

  /**
   * The arrows are absolutely positioned children of the scroller (pinned by
   * `--rail-pin`, see `paint()`), so they need the rail to be their containing
   * block. Block- and grid-level scrollers would not be able to host them at
   * all, so those keep the momentum/over-scroll polish and a visible (thin)
   * scrollbar instead.
   */
  const display = getComputedStyle(node).display;
  if (!/flex/.test(display)) {
    node.classList.add('rail--flow');
    tracking.add(node);
    paint(node);
    return;
  }

  node.classList.add('rail--arrows');
  node.insertAdjacentHTML('afterbegin', START_BTN);
  node.insertAdjacentHTML('beforeend', END_BTN);

  on(node, 'click', (event) => {
    if (event.target.closest('[data-rail-start]')) {
      event.preventDefault();
      page(node, 'start');
      return;
    }
    if (event.target.closest('[data-rail-end]')) {
      event.preventDefault();
      page(node, 'end');
    }
  });

  if (!listeners.has(node)) {
    listeners.add(node);
    on(node, 'scroll', () => schedule(() => paint(node)), { passive: true });
  }

  tracking.add(node);
  paint(node);
}

/** Reveals (or hides) the arrows as the rail grows, shrinks or scrolls. */
function recheck() {
  tracking.forEach((node) => {
    if (!node.isConnected) {
      tracking.delete(node);
      mounted.delete(node);
      return;
    }
    if (isHorizontal(node)) {
      mount(node);
      paint(node);
    } else {
      const start = node.querySelector('[data-rail-start]');
      const end = node.querySelector('[data-rail-end]');
      if (start) start.disabled = true;
      if (end) end.disabled = true;
      node.classList.remove('rail--overflow', 'rail--at-start', 'rail--at-end');
    }
  });
}

const refresh = debounce(() => schedule(recheck), 120);

export function initRails(root = document) {
  const scan = (scope) => {
    if (!scope || scope.nodeType !== 1) return;
    if (scope.matches?.(SELECTOR)) mount(scope);
    scope.querySelectorAll?.(SELECTOR).forEach((node) => {
      if (isHorizontal(node)) mount(node);
      else tracking.add(node);
    });
  };

  scan(root === document ? document.body : root);
  schedule(recheck);

  on(window, 'resize', refresh, { passive: true });
  on(window, 'orientationchange', refresh, { passive: true });
  if (typeof ResizeObserver !== 'undefined' && !initRails._observer) {
    const observer = new ResizeObserver(refresh);
    initRails._observer = observer;
    observer.observe(document.documentElement);
  }
  return tracking;
}

/** Watches late content (page controllers, table reloads, chat streams). */
export function observeRails(root = document.body) {
  if (observeRails._observer || !root || typeof MutationObserver === 'undefined') return observeRails._observer;
  const observer = new MutationObserver((mutations) => {
    const added = [];
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.(SELECTOR) || node.querySelector?.(SELECTOR)) added.push(node);
      });
    });
    if (!added.length) return;
    schedule(() => {
      added.forEach((node) => {
        if (node.matches?.(SELECTOR)) {
          if (isHorizontal(node)) mount(node);
          else tracking.add(node);
        }
        node.querySelectorAll?.(SELECTOR).forEach((child) => {
          if (isHorizontal(child)) mount(child);
          else tracking.add(child);
        });
      });
      recheck();
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  observeRails._observer = observer;
  return observer;
}

export const rails = { init: initRails, observe: observeRails, refresh: recheck };
export default rails;
