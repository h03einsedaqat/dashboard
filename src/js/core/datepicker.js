/**
 * NOVAADMIN — locale-aware date picker
 * ------------------------------------------------------------------
 * Every `<input type="date">` (and anything marked `[data-datepicker]`) gets a
 * real calendar popup:
 *
 *   • Persian UI  → Jalali (Solar Hijri) calendar, Persian digits, «امروز»
 *   • English UI  → Gregorian calendar, `Intl` formatting for the active locale
 *   • the customizer's تقویم preference is respected in fa, while an
 *     English/Arabic interface always shows Gregorian months
 *
 * The *native input stays in the DOM and keeps the value*, so existing form
 * code (`collectValues`, `validateForm`, `data-kind="date"` in the record
 * dialogs) keeps working unchanged; the picker only paints a friendly field in
 * front of it and writes `YYYY-MM-DD` back, firing `input` + `change`.
 *
 *   <input type="date" name="dueDate">              → enhanced automatically
 *   <input data-datepicker data-dp-min="1403/01/01"> → declarative extras
 *
 * Switching the language (or the calendar toggle in the customizer) reparses
 * every mounted field through a single debounced pass, so a Persian field never
 * keeps showing a Jalali string after the UI switched to English.
 */
import { $, on, create, debounce, escapeHtml } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { toDigits, toLatinDigits, activeLang } from './numbers.js';
import { calendar, monthNames, jalaliMonthLength, toGregorian, toJalali, weekDayIndex } from './jalali.js';

const MOUNTED = 'dpReady';
const OPEN_CLASS = 'dp--open';

/* --------------------------------------------------------------- utilities */

/** The calendar system this document should display right now. */
export function activeSystem() {
  const lang = document.documentElement.lang || activeLang();
  // Non-Persian interfaces read Gregorian months (and Latin digits).
  if (lang === 'en') return 'gregorian';
  return calendar.isJalali() ? 'jalali' : 'gregorian';
}

const pad = (value) => String(value).padStart(2, '0');
const isoFromParts = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Gregorian `YYYY-MM-DD` — the only format a native `<input type="date">` accepts. */
const isoOf = (date) => {
  const d = new Date(date);
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

const parseIso = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return { y: Number(y), m: Number(m), d: Number(d), date };
};

const todayIso = () => isoOf(new Date());

/** Locale-aware text for the field (and the popup title). */
function displayValue(iso, system = activeSystem()) {
  const parsed = parseIso(iso);
  if (!parsed) return '';
  const lang = document.documentElement.lang || activeLang();
  const { date } = parsed;
  if (system === 'jalali') {
    const { year, month, day } = toJalali(date);
    return toDigits(`${year}/${pad(month)}/${pad(day)}`, lang === 'en' ? 'en' : lang);
  }
  if (lang === 'en') {
    return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
  const text = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  return toDigits(text, lang);
}

/** Lower/upper bound of the field, expressed in the active system. */
function boundIso(input, bound, system) {
  const raw = input.dataset[`dp${bound}`];
  if (!raw) return '';
  const value = toLatinDigits(raw).replace(/[^\d/.-]/g, '');
  const parts = value.split(/[/.-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return '';
  if (system === 'jalali') {
    const [jy, jm, jd] = parts;
    return isoOf(toGregorian(jy < 100 ? 1400 + jy : jy, jm, jd));
  }
  const [y, m, d] = parts;
  return isoFromParts(y, m, d);
}

/** Groups used by the grid header. */
function gridParts(cursor, system) {
  const lang = document.documentElement.lang || activeLang();
  if (system === 'jalali') {
    const { year, month, day } = toJalali(cursor);
    return {
      year,
      month,
      day,
      length: jalaliMonthLength(year, month),
      // 0 = Saturday … 6 = Friday (the Iranian week).
      startIndex: weekDayIndex(toGregorian(year, month, 1)),
      label: `${monthNames(lang).jalali[(month - 1 + 12) % 12]} ${year}`,
      isoFor: (value) => isoOf(toGregorian(year, month, value)),
    };
  }
  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;
  return {
    year,
    month,
    day: cursor.getDate(),
    length: new Date(year, month, 0).getDate(),
    startIndex: weekDayIndex(new Date(year, month - 1, 1)),
    label: `${monthNames(lang).gregorian[month - 1]} ${year}`,
    isoFor: (value) => isoFromParts(year, month, value),
  };
}

/** Persian/Arabic/Latin weekday initials for a Saturday-first grid. */
function dayLabels() {
  const lang = document.documentElement.lang || 'fa';
  if (lang === 'en') return ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (lang === 'ar') return ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];
  return ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
}

/** ISO value out of whatever the user typed in the visible field. */
function parseTyped(text, system) {
  const clean = toLatinDigits(text).replace(/[^\d/\-.]/g, '');
  if (!clean) return '';
  const parts = clean.split(/[/\-.]/).map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return '';
  const [a, b, c] = parts;
  if (system === 'jalali') {
    if (!a || !b || !c) return '';
    const year = a < 100 ? 1400 + a : a;
    if (b < 1 || b > 12 || c < 1 || c > 31) return '';
    return isoOf(toGregorian(year, b, c));
  }
  // Gregorian: accept both `2026-10-02` and `02/10/2026`.
  const [y, m, d] = a > 31 ? [a, b, c] : [c, b, a];
  if (!y || !m || !d || m > 12 || d > 31) return '';
  return isoFromParts(y, m, d);
}

/* --------------------------------------------------------------- popup ---- */

let openPopup = null;
/**
 * `closePopup({ restoreFocus })` puts the caret back on the text field, which
 * fires `focus` — and the focus handler opens the calendar. For a moment after
 * a programmatic close the open handlers stay deaf, so picking a day never
 * re-opens the very popup it just closed.
 */
let suppressUntil = 0;
const suppressed = () => performance.now() < suppressUntil;

function closePopup({ restoreFocus = false } = {}) {
  if (!openPopup) return;
  if (restoreFocus) suppressUntil = performance.now() + 250;
  const { popup, host } = openPopup;
  openPopup.cleanup?.();
  popup.classList.remove(OPEN_CLASS);
  popup.hidden = true;
  popup.remove();
  host?.classList.remove('dp-field--open');
  openPopup = null;
  if (restoreFocus) host?.querySelector('.dp-text')?.focus({ preventScroll: true });
}

function positionPopup(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  const width = popup.offsetWidth || 272;
  const height = popup.offsetHeight || 320;
  const gutter = 8;
  /**
   * The soft keyboard shrinks the *visual* viewport without moving the layout
   * one, so a calendar clamped to `innerHeight` opened behind the keyboard on a
   * phone and read as "the calendar never opened". Where the browser exposes
   * `visualViewport` those numbers win — and the popup is re-placed whenever
   * that viewport changes (keyboard up/down, rotation, iOS toolbar).
   */
  const view = window.visualViewport;
  const viewHeight = view ? Math.min(view.height + view.offsetTop, window.innerHeight) : window.innerHeight;
  const rtl = getComputedStyle(anchor).direction === 'rtl';
  let left = rtl ? rect.right - width : rect.left;
  left = Math.min(Math.max(gutter, left), window.innerWidth - width - gutter);
  let top = rect.bottom + 6;
  if (top + height > viewHeight - gutter) {
    const above = rect.top - height - 6;
    top = above > gutter ? above : Math.max(gutter, viewHeight - height - gutter);
  }
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
  popup.style.width = `${Math.round(Math.max(width, rect.width))}px`;
}

function buildPopup(field) {
  const system = activeSystem();
  const lang = document.documentElement.lang || activeLang();
  const input = field.querySelector('.dp-native');
  const minIso = boundIso(input, 'Min', system);
  const maxIso = boundIso(input, 'Max', system);
  const popup = create('div', { class: `dp dp--${system}`, role: 'dialog', 'aria-modal': 'false' });
  let cursor = parseIso(input.value)?.date ?? new Date();
  let selected = parseIso(input.value) ? input.value : '';
  const inRange = (iso) => (!minIso || iso >= minIso) && (!maxIso || iso <= maxIso);

  const commit = (iso, { close = true } = {}) => {
    selected = iso;
    input.value = iso;
    const text = field.querySelector('.dp-text');
    if (text) text.value = displayValue(iso, system);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (close) closePopup({ restoreFocus: true });
  };

  const grid = () => {
    const parts = gridParts(cursor, system);
    const labels = dayLabels();
    const today = todayIso();
    const cells = [];
    for (let i = 0; i < parts.startIndex; i += 1) {
      const day = parts.length + i - parts.startIndex + 1;
      cells.push(`<button type="button" class="dp__day is-outside" disabled tabindex="-1">${toDigits(day, lang)}</button>`);
    }
    for (let day = 1; day <= parts.length; day += 1) {
      const iso = parts.isoFor(day);
      const isToday = iso === today;
      const isSelected = iso === selected;
      const allowed = inRange(iso);
      cells.push(
        `<button type="button" class="dp__day${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}" data-dp-day="${iso}" role="gridcell" aria-selected="${isSelected}" ${isSelected ? 'aria-current="date"' : ''} ${allowed ? '' : 'disabled'}>${toDigits(day, lang)}</button>`,
      );
    }
    const trailing = (7 - ((parts.startIndex + parts.length) % 7)) % 7;
    for (let i = 1; i <= trailing; i += 1) {
      cells.push(`<button type="button" class="dp__day is-outside" disabled tabindex="-1">${toDigits(i, lang)}</button>`);
    }
    return `
      <div class="dp__head">
        <button type="button" class="dp__nav" data-dp-move="-1" aria-label="ماه قبل"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
        <span class="dp__title" aria-live="polite">${escapeHtml(toDigits(parts.label, lang))}</span>
        <button type="button" class="dp__nav" data-dp-move="1" aria-label="ماه بعد"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
      </div>
      <div class="dp__grid" role="grid">${labels.map((label) => `<span class="dp__dow">${escapeHtml(toDigits(label, lang))}</span>`).join('')}${cells.join('')}</div>
      <div class="dp__foot">
        <button type="button" class="dp__preset" data-dp-today ${inRange(today) ? '' : 'disabled'}>امروز</button>
        <button type="button" class="dp__preset" data-dp-clear>پاک کردن</button>
      </div>`;
  };

  const paint = () => {
    popup.innerHTML = grid();
    positionPopup(popup, field);
  };

  on(popup, 'click', (event) => {
    const move = event.target.closest('[data-dp-move]');
    if (move) {
      const step = Number(move.dataset.dpMove);
      if (system === 'jalali') {
        const { year, month } = toJalali(cursor);
        cursor = toGregorian(year, month + step, 1);
      } else {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, 1);
      }
      paint();
      return;
    }
    if (event.target.closest('[data-dp-today]')) {
      if (inRange(todayIso())) commit(todayIso());
      return;
    }
    if (event.target.closest('[data-dp-clear]')) {
      commit('');
      return;
    }
    const day = event.target.closest('[data-dp-day]');
    if (day && day.dataset.dpDay && !day.disabled) commit(day.dataset.dpDay);
  });

  popup.hidden = true;
  document.body.append(popup);
  paint();
  return { popup, paint };
}

function openFor(field) {
  closePopup();
  const { popup, paint } = buildPopup(field);
  popup.hidden = false;
  popup.classList.add(OPEN_CLASS);
  field.classList.add('dp-field--open');
  paint();
  requestAnimationFrame(() => positionPopup(popup, field));
  const onDocumentClick = (event) => {
    if (field.contains(event.target) || popup.contains(event.target)) return;
    closePopup();
  };
  const onKey = (event) => {
    if (event.key !== 'Escape') return;
    closePopup({ restoreFocus: true });
  };
  const onViewport = () => positionPopup(popup, field);
  document.addEventListener('pointerdown', onDocumentClick, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onViewport, { passive: true });
  window.addEventListener('scroll', onViewport, { passive: true, capture: true });
  /* Keyboard up/down and the iOS toolbar move the visual viewport without a
     window resize: without these the popup stays where the keyboard is. */
  const view = window.visualViewport;
  view?.addEventListener('resize', onViewport, { passive: true });
  view?.addEventListener('scroll', onViewport, { passive: true });
  openPopup = {
    popup,
    host: field,
    cleanup: () => {
      document.removeEventListener('pointerdown', onDocumentClick, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
      view?.removeEventListener('resize', onViewport);
      view?.removeEventListener('scroll', onViewport);
    },
  };
}

/* ------------------------------------------------------------- enhancement */

/**
 * Every enhanced input, so a language switch (or the customizer's
 * Jalali ↔ Gregorian toggle) can re-render the visible text of fields that are
 * already on the page — the observers only ever *add* pickers.
 */
const fields = new Set();

function refreshAllFields() {
  const system = activeSystem();
  fields.forEach((input) => {
    if (!input.isConnected) {
      fields.delete(input);
      return;
    }
    const text = input.parentElement?.querySelector('.dp-text');
    if (!text) return;
    /* The field *displays* the value, so a language change re-renders it even
       while it holds focus — otherwise a switcher left the caret inside a
       Jalali string on an English page. The committed ISO value stays intact. */
    text.value = displayValue(input.value, system);
    text.placeholder = system === 'jalali' ? '۱۴۰۳/۰۱/۰۱' : 'YYYY-MM-DD';
  });
  if (openPopup) closePopup();
}

const scheduleRefresh = debounce(refreshAllFields, 60);

function enhance(input) {
  if (!input || input.dataset[MOUNTED] === '1') return;
  input.dataset[MOUNTED] = '1';

  const field = create('div', { class: 'dp-field' });
  /* The wrapper takes over the layout role of the input (a `.form-field` slot
     inside a form stack, the flex child inside an input group). */
  if (input.classList.contains('form-field')) {
    input.classList.remove('form-field');
    field.classList.add('form-field');
  }
  input.parentElement?.insertBefore(field, input);
  field.append(input);
  input.classList.add('dp-native');
  input.setAttribute('tabindex', '-1');
  input.setAttribute('aria-hidden', 'true');
  /* The hidden native input must never be the thing that blocks a submit. */
  input.setAttribute('data-no-validate', '');

  const text = create('input', {
    type: 'text',
    class: 'form-control dp-text',
    placeholder: activeSystem() === 'jalali' ? '۱۴۰۳/۰۱/۰۱' : 'YYYY-MM-DD',
    inputmode: 'numeric',
    autocomplete: 'off',
  });
  /* Keep the visual language of the native control (`form-control--sm`, …). */
  input.classList.forEach((name) => {
    if (/^form-(control|select)/.test(name)) text.classList.add(name);
  });
  if (input.id) {
    text.id = input.id;
    input.removeAttribute('id');
  }
  /**
   * A `required` attribute on the *hidden* native input would block submit with
   * a bubble the browser cannot anchor to anything visible (and `form.js` would
   * decorate a field nobody can see), so the requirement moves to the input the
   * visitor can actually read and fix.
   */
  if (input.required) {
    text.required = true;
    input.required = false;
    input.dataset.dpRequired = '1';
  }
  for (const bound of ['min', 'max']) {
    const value = input.getAttribute(bound);
    if (value) {
      text.dataset[`dp${bound[0].toUpperCase()}${bound.slice(1)}`] = value;
      input.removeAttribute(bound);
    }
  }
  if (input.disabled) text.disabled = true;
  const label = input.getAttribute('aria-label') || input.closest('.form-field')?.querySelector('label')?.textContent?.replace('*', '').trim();
  if (label) text.setAttribute('aria-label', label);
  text.value = displayValue(input.value);
  if (input.placeholder) text.placeholder = input.placeholder;

  const toggle = create('button', {
    type: 'button',
    class: 'dp-toggle',
    'aria-label': 'انتخاب تاریخ از تقویم',
    html: '<i class="bi bi-calendar3" aria-hidden="true"></i>',
  });

  field.append(text, toggle);

  const openIfClosed = () => {
    if (suppressed()) return;
    if (!openPopup || openPopup.host !== field) openFor(field);
  };
  const openFromGesture = (event) => {
    event.preventDefault();
    if (openPopup?.host === field) closePopup();
    else openIfClosed();
  };
  on(toggle, 'click', openFromGesture);
  /* Tabbing in with a keyboard pops the calendar; a mouse click is handled by
     the `click` listener below, so dragging to select the text never opens it. */
  on(text, 'focus', () => {
    if (text.matches(':focus-visible')) openIfClosed();
  });
  on(text, 'click', openIfClosed);
  /**
   * Belt and braces for touch: on iOS a tap on a text input inside a scrolling
   * sheet can be claimed as a scroll gesture and swallow the `click`, which
   * left the calendar looking like it never opened on a phone. `pointerup`
   * arrives either way, and `openIfClosed` makes the following `click` a no-op.
   */
  on(text, 'pointerup', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    openIfClosed();
  });
  on(text, 'input', () => {
    const iso = parseTyped(text.value, activeSystem());
    input.value = iso;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  on(text, 'change', () => {
    const iso = parseTyped(text.value, activeSystem());
    input.value = iso;
    text.value = displayValue(iso);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (openPopup?.host === field) closePopup();
  });
  on(text, 'keydown', (event) => {
    if (event.key === 'Escape') {
      closePopup();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const iso = parseTyped(text.value, activeSystem());
      input.value = iso;
      text.value = displayValue(iso);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      closePopup();
    }
  });
  /* A controller may write the value directly (`input.value = …`). */
  input.addEventListener('dp:sync', () => {
    text.value = displayValue(input.value);
  });
  /* `<form>.reset()` restores the native value without firing anything. */
  const form = input.form ?? input.closest('form');
  if (form) {
    on(form, 'reset', () => {
      window.setTimeout(() => {
        text.value = displayValue(input.value);
      }, 0);
    });
  }
  fields.add(input);
}

export function enhanceDatePickers(root = document) {
  const scope = root === document ? document : root;
  if (scope.matches?.('input[type="date"], [data-datepicker]')) enhance(scope);
  scope.querySelectorAll?.('input[type="date"]:not([data-dp-skip]), [data-datepicker]').forEach(enhance);
  return scope;
}

/** Language / calendar switches reparse every mounted field. */
export function watchLocale() {
  bus.on(EVENTS.language, scheduleRefresh);
  if (watchLocale._observer || typeof MutationObserver === 'undefined') return watchLocale._observer;
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir', 'data-calendar'] });
  watchLocale._observer = observer;
  return observer;
}

/**
 * Late content (record dialogs, the calendar event modal, generated forms) is
 * picked up by one observer; the picker itself stays cheap (no timers, no
 * window listeners per field) until it is opened.
 */
export function initDatePickers(root = document.body) {
  enhanceDatePickers(document);
  watchLocale();
  if (initDatePickers._observer || typeof MutationObserver === 'undefined') return initDatePickers._observer;
  const observer = new MutationObserver((mutations) => {
    const targets = [];
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('input[type="date"], [data-datepicker]') || node.querySelector?.('input[type="date"], [data-datepicker]')) targets.push(node);
      });
    });
    if (!targets.length) return;
    requestAnimationFrame(() => targets.forEach((node) => enhanceDatePickers(node)));
  });
  observer.observe(root, { childList: true, subtree: true });
  initDatePickers._observer = observer;
  return observer;
}

export const datepicker = { init: initDatePickers, enhance: enhanceDatePickers, activeSystem, displayValue, close: closePopup, refresh: scheduleRefresh };
export default datepicker;
