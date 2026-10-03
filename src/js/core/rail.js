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
/**
 * The rail's own overflow track (the permission-matrix affordance, guaranteed
 * to be on screen). A real scrollbar is an *overlay* on every phone browser —
 * Chromium's fling scrollbars only appear mid-gesture and cannot be styled, and
 * Safari's are just as shy — so a strip that hides its scrollbar looks like it
 * simply ends. This 4px track is painted by us, follows the scroll position and
 * never lies about how much more there is.
 */
const TRACK = `<span class="rail__track" aria-hidden="true"><i></i></span>`;
const tracks = new WeakMap();

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
 * Every engine numbers `scrollLeft` differently in an RTL scroller:
 *
 *   • Chromium / Gecko — the spec's negative range: 0 at the inline start,
 *     −max at the end.
 *   • WebKit (every iPhone, every iPad) — the same positions as 0 → +max.
 *   • Legacy reverse engines — 0 at the *end*, max at the start.
 *
 * The old `left: -N` write assumed the Chromium model, so on iOS every arrow
 * wrote an out-of-range value, the browser clamped it back to 0 and the
 * button looked dead — the «فلش کار نمی‌کند» report — while it kept working in
 * the desktop browser. One throwaway probe identifies the engine once per
 * session; everything after it is written in the rail's own units.
 */
let rtlScrollModel = null;
function rtlModel() {
  if (rtlScrollModel) return rtlScrollModel;
  const probe = document.createElement('div');
  probe.setAttribute('dir', 'rtl');
  probe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;inline-size:40px;block-size:10px;overflow:scroll';
  probe.innerHTML = '<div style="inline-size:160px;block-size:1px"></div>';
  document.body.append(probe);
  /* A fresh scroller starts at the inline start: 0 for the two modern models,
     `max` only in the legacy reverse one. */
  const start = probe.scrollLeft;
  probe.scrollLeft = -1;
  const negative = probe.scrollLeft < 0;
  probe.remove();
  rtlScrollModel = negative ? 'negative' : start > 0 ? 'reverse' : 'positive';
  return rtlScrollModel;
}

const clampDistance = (value, max) => Math.min(max, Math.max(0, value));

/**
 * How far the content has travelled from the inline start, normalised to
 * `0 … max` for every writing direction and scroll model.
 */
function travelled(node, max = Math.max(0, node.scrollWidth - node.clientWidth)) {
  const raw = node.scrollLeft;
  if (getComputedStyle(node).direction !== 'rtl') return clampDistance(raw, max);
  const model = rtlModel();
  return clampDistance(model === 'reverse' ? max - raw : Math.abs(raw), max);
}

/** The native `scrollLeft` that parks `distance` px of content before the scrollport. */
function nativeLeft(node, distance, max) {
  if (getComputedStyle(node).direction !== 'rtl') return distance;
  const model = rtlModel();
  if (model === 'negative') return -distance;
  return model === 'positive' ? distance : max - distance;
}

/** Scrolls the rail by a logical distance — clamped, RTL-safe, never a dead write. */
function scrollToDistance(node, distance, smooth = true) {
  const max = Math.max(0, node.scrollWidth - node.clientWidth);
  const target = clampDistance(distance, max);
  const left = nativeLeft(node, target, max);
  try {
    node.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  } catch {
    node.scrollLeft = left;
  }
  return target;
}

/**
 * Distance of a child from the inline start of the rail's content, in px.
 * Measured from the live rects — `offsetLeft` is relative to the nearest
 * *positioned* ancestor, not to the scroller, and it silently returned page
 * coordinates for every rail that is not `position: relative`.
 */
function distanceOf(node, child) {
  const rail = node.getBoundingClientRect();
  const rect = child.getBoundingClientRect();
  const scrolled = travelled(node);
  return getComputedStyle(node).direction === 'rtl'
    ? scrolled + (rail.right - rect.right)
    : scrolled + (rect.left - rail.left);
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
   * by the physical scroll offset (see `_rail.scss`). The browser shifts the
   * content by `+distance` in RTL and `−distance` in LTR, so the arrow cancels
   * exactly that. `scrollLeft` is never used raw: WebKit counts RTL offsets the
   * other way round, and the pin would then be off by twice the offset.
   */
  const shift = getComputedStyle(node).direction === 'rtl' ? -pos : pos;
  node.style.setProperty('--rail-pin', `${Math.round(shift)}px`);
  /* The track lives in the same translated content space as the arrows, so it
     carries the same pin and only has to place its thumb. */
  const track = tracks.get(node);
  if (track) {
    const span = Math.max(1, node.scrollWidth);
    const ratio = Math.min(1, node.clientWidth / span);
    track.style.setProperty('--rail-thumb-w', `${(ratio * 100).toFixed(1)}%`);
    track.style.setProperty('--rail-thumb-x', `${((pos / span) * 100).toFixed(1)}%`);
  }
  // Content appended after mount (a new chat message, a re-rendered list) must
  // not push the end arrow — or the track — out of the last slot.
  if (track && node.lastElementChild !== track) node.append(track);
  if (end && node.lastElementChild !== end) node.append(end);
  if (track && node.lastElementChild !== track) node.append(track);
}

/**
 * Pages the rail one screen towards `start` or `end` — reading order, not
 * physical direction, so the same handler works for fa / en / ar.
 */
function page(node, direction) {
  const amount = Math.max(160, Math.round(node.clientWidth * 0.82));
  const current = travelled(node);
  /* Reading order, not physical direction: `start` always means «the part I
     have already scrolled past», on an LTR page and on an RTL one alike. */
  scrollToDistance(node, direction === 'start' ? current - amount : current + amount);
}

/**
 * Every rail that holds the visitor's current position — the active mail
 * folder, the open conversation — parks it at the inline start the first time
 * it overflows, so the chosen item is never the one hidden past the edge (the
 * «بقیهٔ پوشه‌ها اسکرول نمی‌شن» half of the report).
 */
const revealed = new WeakSet();
function revealActive(node) {
  if (revealed.has(node)) return;
  const active = node.querySelector('.is-active, [aria-current], [data-active="true"]');
  if (!active) return;
  /* Nothing to reveal while the strip still fits — a later pass (the list
     finished filling, the fonts landed) gets another chance. */
  if (node.scrollWidth - node.clientWidth <= 8) return;
  revealed.add(node);
  const current = travelled(node);
  const start = distanceOf(node, active);
  const visible = start >= current - 6 && start + active.offsetWidth <= current + node.clientWidth + 6;
  if (visible) return;
  scrollToDistance(node, Math.max(0, start - 10), false);
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
    node.insertAdjacentHTML('beforeend', TRACK);
    tracks.set(node, node.lastElementChild);
    tracking.add(node);
    paint(node);
    return;
  }

  node.classList.add('rail--arrows');
  node.insertAdjacentHTML('afterbegin', START_BTN);
  node.insertAdjacentHTML('beforeend', END_BTN);
  node.insertAdjacentHTML('beforeend', TRACK);
  tracks.set(node, node.lastElementChild);

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
  schedule(() => revealActive(node));
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
      revealActive(node);
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
        /* Late content (a folder list, a conversation strip) may carry the
           current item; it still deserves to be on screen. */
        added.forEach((node) => {
          node.matches?.(SELECTOR) && revealActive(node);
          node.querySelectorAll?.(SELECTOR).forEach((child) => revealActive(child));
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
