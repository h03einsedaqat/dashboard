/**
 * NOVAADMIN — small UI behaviours
 * ------------------------------------------------------------------
 * Tabs, accordions, filter bars, copy buttons, tooltips, view switches,
 * sortable lists, date ranges, reveal-on-scroll and print helpers — the
 * interactions that are too small for a module of their own but must behave
 * identically on every page.
 */
import { $, $$, on, debounce, ready } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { toast } from './toast.js';
import { storage } from './storage.js';
import { initCharts } from './charts.js';
import * as jdate from './jalali.js';
import { formatNumber, toDigits } from './numbers.js';
import { createSortable } from './dragdrop.js';

/* ---------------------------------------------------------------------- tabs */
function initTabs(root = document) {
  on(root, 'click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (!tab) return;
    event.preventDefault();
    const group = tab.closest('[data-tabs]') ?? tab.closest('.nav-tabs, .nav-pills')?.parentElement ?? document;
    const name = tab.dataset.tab;
    $$('[data-tab]', group).forEach((node) => {
      const isActive = node === tab;
      node.classList.toggle('is-active', isActive);
      node.classList.toggle('active', isActive);
      node.setAttribute('aria-selected', String(isActive));
    });
    $$('[data-tab-panel]', group).forEach((panel) => {
      const isActive = panel.dataset.tabPanel === name;
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    });
    if (window.location.hash !== `#${name}` && tab.dataset.tabUpdateHash === 'true') history.replaceState(null, '', `#${name}`);
    bus.emit('tabs:change', { name, group });
    initCharts(group);
  });
}

/* ----------------------------------------------------------------- accordion */
function initAccordion(root = document) {
  on(root, 'click', (event) => {
    const head = event.target.closest('[data-accordion-toggle]');
    if (!head) return;
    const item = head.closest('.accordion-item') ?? head.parentElement;
    const body = item.querySelector('[data-accordion-body]');
    const open = item.classList.toggle('is-open');
    head.setAttribute('aria-expanded', String(open));
    if (body) body.hidden = !open;
    if (open && (item.closest('.accordion')?.dataset.accordionAccordion !== 'false' || item.closest('[data-accordion]')?.dataset.accordion !== 'multi')) {
      const group = item.closest('.accordion') ?? item.parentElement;
      [...group.children].forEach((sibling) => {
        if (sibling !== item) {
          sibling.classList.remove('is-open');
          sibling.querySelector('[data-accordion-toggle]')?.setAttribute('aria-expanded', 'false');
          const siblingBody = sibling.querySelector('[data-accordion-body]');
          if (siblingBody) siblingBody.hidden = true;
        }
      });
    }
  });
}

/* ----------------------------------------------------------- filter bar sync */
function initFilterBars(root = document) {
  $$('[data-filter-bar]', root).forEach((bar) => {
    const target = document.querySelector(bar.dataset.filterBar);
    if (!target) return;
    on(bar, 'input', debounce(() => {
      const term = bar.querySelector('input, select')?.value ?? '';
      const instance = target.__novatable;
      if (instance) {
        instance.state.search = term;
        instance.state.page = 1;
        instance.load();
      } else {
        $$('[data-row]', target).forEach((row) => {
          row.hidden = Boolean(term) && !row.textContent.toLowerCase().includes(String(term).toLowerCase());
        });
      }
    }, 220));
  });
}

/* -------------------------------------------------------- dismissible alerts */
/**
 * `<div class="alert" data-alert>` with a `[data-alert-close]` button fades out
 * and is removed from the flow. Used by the alert component page and by any
 * notification-style message a page injects.
 */
function initAlerts(root = document) {
  on(root, 'click', (event) => {
    const close = event.target.closest('[data-alert-close]');
    if (!close) return;
    const alertNode = close.closest('.alert');
    if (!alertNode) return;
    alertNode.classList.add('is-hiding');
    const remove = () => alertNode.remove();
    alertNode.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 320); // fallback for reduced-motion users
    bus.emit('alert:dismissed', { text: alertNode.textContent.trim().slice(0, 80) });
  });
}

/* -------------------------------------------------------------- copy buttons */
function initCopyButtons(root = document) {
  on(root, 'click', async (event) => {
    const trigger = event.target.closest('[data-copy]');
    if (!trigger) return;
    const selector = trigger.dataset.copy;
    const target = selector && selector !== 'self' ? document.querySelector(selector) : trigger.closest('[data-copy-scope]');
    const text = trigger.dataset.copyText ?? target?.textContent?.trim() ?? '';
    try {
      await navigator.clipboard.writeText(text);
      toast.success('کپی شد', 'متن در کلیپ‌بورد قرار گرفت.');
      const icon = trigger.querySelector('i');
      if (icon) {
        const previous = icon.className;
        icon.className = 'bi bi-check2';
        setTimeout(() => {
          icon.className = previous;
        }, 1400);
      }
    } catch {
      toast.warning('کپی نشد', 'دسترسی کلیپ‌بورد در این مرورگر فعال نیست.');
    }
  });
}

/* ------------------------------------------------------------------ tooltips */
function initTooltips(root = document) {
  $$('[data-tooltip]', root).forEach((node) => {
    if (node.dataset.tooltipReady === '1') return;
    node.dataset.tooltipReady = '1';
    node.setAttribute('data-tooltip-host', '');
    if (!node.getAttribute('aria-label')) node.setAttribute('aria-label', node.dataset.tooltip);
  });
}

/* -------------------------------------------------------------- view switch */
function initViewSwitches(root = document) {
  $$('[data-view-switch]', root).forEach((switcher) => {
    const selector = switcher.dataset.viewSwitch;
    const host = document.querySelector(selector);
    if (!host) return;
    const stored = storage.get(`view:${selector}`, switcher.querySelector('.is-active')?.dataset.view ?? 'grid');
    applyView(host, switcher, stored);
    on(switcher, 'click', (event) => {
      const button = event.target.closest('[data-view]');
      if (!button) return;
      storage.set(`view:${selector}`, button.dataset.view);
      applyView(host, switcher, button.dataset.view);
    });
  });
  function applyView(host, switcher, view) {
    host.dataset.view = view;
    $$('[data-view]', switcher).forEach((node) => node.classList.toggle('is-active', node.dataset.view === view));
    $$('[data-view-grid]', host).forEach((node) => (node.hidden = view !== 'grid'));
    $$('[data-view-list]', host).forEach((node) => (node.hidden = view !== 'list'));
  }
}

/* ------------------------------------------------------------ sortable lists */
async function initSortables(root = document) {
  const lists = $$('[data-sortable]', root);
  if (!lists.length) return;
  lists.forEach(async (list) => {
    if (list.dataset.sortableReady === '1') return;
    list.dataset.sortableReady = '1';
    const sortable = await createSortable(list, {
      animation: 160,
      handle: '[data-drag-handle]',
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      onEnd: () => {
        const order = $$('[data-sortable-item]', list).map((node) => node.dataset.id ?? node.dataset.sortableItem);
        storage.set(`order:${list.dataset.sortable}`, order);
        bus.emit('sortable:change', { list: list.dataset.sortable, order });
      },
    });
    if (!sortable) list.dataset.sortableReady = '0';
  });
}

/* --------------------------------------------------------------- date ranges */
function initDateRanges(root = document) {
  on(root, 'click', (event) => {
    const preset = event.target.closest('[data-range-preset]');
    if (!preset) return;
    const name = preset.dataset.rangePreset;
    $$('[data-range-preset]', preset.closest('[data-range]') ?? document).forEach((node) => node.classList.toggle('is-active', node === preset));
    $$('[data-range-label]').forEach((label) => {
      label.textContent = preset.dataset.rangeLabel ?? preset.textContent.trim();
    });
    bus.emit('range:change', { range: name });
    if (preset.closest('[data-range]')?.dataset.rangeCharts === 'refresh') initCharts();
  });
}

/* ------------------------------------------------------------ reveal on view */
function initReveal(root = document) {
  const nodes = $$('[data-reveal]', root);
  if (!nodes.length) return;
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-revealed'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0.1 },
  );
  nodes.forEach((node) => observer.observe(node));
}

/* ------------------------------------------------------------------- printing */
function initPrint(root = document) {
  on(root, 'click', (event) => {
    const trigger = event.target.closest('[data-print]');
    if (!trigger) return;
    event.preventDefault();
    const scope = trigger.dataset.print;
    document.body.classList.add('is-printing');
    if (scope && scope !== 'page') {
      $$('body > *').forEach((node) => node.classList.add('print-hidden'));
      const target = document.querySelector(scope);
      target?.classList.add('print-target');
    }
    window.print();
    setTimeout(() => {
      document.body.classList.remove('is-printing');
      $$('.print-hidden').forEach((node) => node.classList.remove('print-hidden'));
      $$('.print-target').forEach((node) => node.classList.remove('print-target'));
    }, 400);
  });
}

/* --------------------------------------------------------------- misc helpers */
function initCounters(root = document) {
  const nodes = $$('[data-counter]', root);
  if (!nodes.length) return;
  const animate = (node) => {
    const target = Number(node.dataset.counter);
    const duration = 900;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const value = target * (1 - (1 - progress) ** 3);
      node.textContent = node.dataset.counterFormat === 'compact' ? formatNumber(Math.round(value)) : formatNumber(Math.round(value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) {
    nodes.forEach(animate);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animate(entry.target);
      observer.unobserve(entry.target);
    });
  });
  nodes.forEach((node) => observer.observe(node));
}

function initCharCounters(root = document) {
  $$('[data-char-counter]', root).forEach((input) => {
    const output = document.querySelector(input.dataset.charCounter);
    if (!output) return;
    const update = () => {
      output.textContent = toDigits(`${input.value.length}/${input.maxLength > 0 ? input.maxLength : 500}`);
    };
    on(input, 'input', update);
    update();
  });
}

function initTimestamps(root = document) {
  $$('[data-relative]', root).forEach((node) => {
    const value = node.dataset.relative || node.textContent.trim();
    node.textContent = jdate.relativeTime(value);
    node.title = jdate.formatDate(value, { format: 'long' });
  });
}

function initSwatches(root = document) {
  on(root, 'click', (event) => {
    const swatch = event.target.closest('[data-swatch]');
    if (!swatch) return;
    const target = document.querySelector(swatch.dataset.swatchTarget ?? '[data-swatch-preview]');
    if (target) target.style.background = swatch.dataset.swatch;
    $$('[data-swatch]', swatch.parentElement).forEach((node) => node.classList.toggle('is-active', node === swatch));
  });
}

function initTimelineFilters(root = document) {
  on(root, 'click', (event) => {
    const chip = event.target.closest('[data-timeline-filter]');
    if (!chip) return;
    const value = chip.dataset.timelineFilter;
    chip.classList.toggle('is-active');
    const scope = document.querySelector(chip.closest('[data-timeline-scope]')?.dataset.timelineScope ?? '#activity-feed');
    if (!scope) return;
    const active = $$('[data-timeline-filter].is-active', chip.parentElement).map((node) => node.dataset.timelineFilter);
    $$('[data-timeline-item]', scope).forEach((node) => {
      node.hidden = active.length > 0 && !active.includes(node.dataset.timelineItem);
    });
  });
}

/** Boots every behaviour above. Safe to call again after injecting markup. */
export function initUi(root = document) {
  initTabs(root);
  initAccordion(root);
  initFilterBars(root);
  initAlerts(root);
  initCopyButtons(root);
  initTooltips(root);
  initViewSwitches(root);
  initSortables(root);
  initDateRanges(root);
  initReveal(root);
  initPrint(root);
  initCounters(root);
  initCharCounters(root);
  initTimestamps(root);
  initSwatches(root);
  initTimelineFilters(root);
  return true;
}

ready(() => {
  initUi();
  // Re-run the light-weight parts after dynamic content lands.
  bus.on(EVENTS.language, () => {
    initTimestamps();
  });
  bus.on(EVENTS.dataChanged, () => {
    initReveal();
    initTooltips();
  });
});

export const ui = { init: initUi };
export default ui;
