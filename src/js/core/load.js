/**
 * NOVAADMIN — async UX layer
 * ------------------------------------------------------------------
 * One place that decides what the user sees while a panel waits for its data,
 * what they see when that wait fails, and how the app behaves when the network
 * itself disappears. Every screen renders through the same three primitives:
 *
 *   beginProgress() / endProgress()   a hairline bar at the very top of the app
 *   withState(host, loader)            skeleton → content → error + retry
 *   initConnectivity()                 a calm offline pill instead of a broken page
 *
 * The rules the whole template follows:
 *   • nothing ever renders as an empty box — a pending panel shows a skeleton of
 *     the same shape, so the layout does not jump when the data lands;
 *   • a failed panel shows *why* and a working "try again" button, and it keeps
 *     the rest of the page alive (an error is scoped to its own host node);
 *   • a dropped connection is a status, not an error: the page stays usable
 *     (the demo runs on local data) and re-syncs by itself when the link returns.
 */
import { $, $$, on, render, escapeHtml } from './dom.js';
import { bus } from './bus.js';

const PROGRESS_ID = 'nova-progress';
const PILL_ID = 'nova-connection-pill';

/* ------------------------------------------------------------- top progress */

let pending = 0;
let hideTimer = null;

function progressHost() {
  let bar = document.getElementById(PROGRESS_ID);
  if (bar) return bar;
  bar = document.createElement('div');
  bar.id = PROGRESS_ID;
  bar.className = 'route-progress';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'بارگذاری');
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<span class="route-progress__bar"></span>';
  document.body.append(bar);
  return bar;
}

/** Marks the start of a data/route phase. Nesting safe: the bar hides on the last end. */
export function beginProgress() {
  pending += 1;
  clearTimeout(hideTimer);
  const bar = progressHost();
  bar.classList.add('is-running');
  bar.setAttribute('aria-hidden', 'false');
  return () => endProgress();
}

export function endProgress() {
  pending = Math.max(0, pending - 1);
  if (pending > 0) return;
  const bar = document.getElementById(PROGRESS_ID);
  if (!bar) return;
  bar.classList.add('is-finishing');
  hideTimer = setTimeout(() => {
    bar.classList.remove('is-running', 'is-finishing');
    bar.setAttribute('aria-hidden', 'true');
  }, 260);
}

/** Wraps a promise with the top progress bar. */
export async function tracked(promise) {
  const done = beginProgress();
  try {
    return await promise;
  } finally {
    done();
  }
}

/* ------------------------------------------------------------------ skeleton */

const line = (width = '100%', height = '0.85rem') => `<span class="skeleton skeleton--text" style="inline-size:${width};block-size:${height}"></span>`;

/** Shape-matched loading placeholders, so nothing shifts when data arrives. */
export function skeletonMarkup(kind = 'rows', count = 4) {
  const amount = Math.max(1, Number(count) || 4);
  switch (kind) {
    case 'kpi':
      return `<div class="kpi-row__loading">${Array.from({ length: amount }, () => '<div class="skeleton skeleton--card"></div>').join('')}</div>`;
    case 'chart':
      return `<div class="skeleton-stack"><div class="d-flex justify-content-between">${line('35%', '1rem')}${line('18%', '0.7rem')}</div><div class="skeleton skeleton--chart"></div></div>`;
    case 'table':
      return `<div class="skeleton-stack">${Array.from({ length: amount }, () => `<div class="skeleton-row skeleton-row--line"><span class="skeleton skeleton--circle"></span><div class="skeleton-stack skeleton-stack--grow">${line('42%', '0.8rem')}${line('72%', '0.65rem')}</div>${line('12%', '1.4rem')}</div>`).join('')}</div>`;
    case 'card':
      return `<div class="skeleton-stack">${Array.from({ length: amount }, () => '<div class="skeleton skeleton--card"></div>').join('')}</div>`;
    case 'list':
      return `<div class="skeleton-stack">${Array.from({ length: amount }, () => `<div class="skeleton-row">${line('30%', '0.8rem')}${line('55%', '0.65rem')}</div>`).join('')}</div>`;
    case 'text':
      return `<div class="skeleton-stack">${Array.from({ length: amount }, (_, index) => line(index === 0 ? '62%' : '100%', '0.8rem')).join('')}</div>`;
    default:
      return `<div class="skeleton-stack">${Array.from({ length: amount }, () => `<div class="skeleton-row"><span class="skeleton skeleton--circle"></span><div class="skeleton-stack skeleton-stack--grow">${line('40%', '0.8rem')}${line('68%', '0.65rem')}</div></div>`).join('')}</div>`;
  }
}

/* -------------------------------------------------------------- error states */

/**
 * Inline failure card with a working retry. Rendered inside the panel that
 * failed — never as a full-page replacement — so the rest of the screen keeps
 * its data.
 */
export function errorMarkup({ title = 'بارگذاری داده‌ها کامل نشد', text = '', reason = '', icon = 'cloud-exclamation' } = {}) {
  return `<div class="state-panel state-panel--error" role="alert">
    <span class="state-panel__icon"><i class="bi bi-${escapeHtml(icon)}" aria-hidden="true"></i></span>
    <p class="state-panel__title">${escapeHtml(title)}</p>
    <p class="state-panel__text">${escapeHtml(text || 'سرویس داده پاسخ نداد. اتصال شبکه را بررسی کنید و دوباره تلاش کنید.')}</p>
    ${reason ? `<p class="state-panel__reason" dir="ltr">${escapeHtml(reason)}</p>` : ''}
    <div class="state-panel__actions">
      <button class="btn btn-primary btn-sm" type="button" data-state-retry><i class="bi bi-arrow-repeat" aria-hidden="true"></i> تلاش دوباره</button>
      <button class="btn btn-light btn-sm" type="button" data-state-dismiss><i class="bi bi-box-arrow-in-down" aria-hidden="true"></i> نمایش آخرین داده</button>
    </div>
  </div>`;
}

/* ------------------------------------------------------------- panel loader */

/**
 * Renders `loader()` into `target` with a loading and an error state around it.
 *
 * @param {Element|string} target      host node (or a selector)
 * @param {() => Promise<string|void>} loader  returns markup; void = it painted itself
 * @param {{skeleton?: string, rows?: number, title?: string, text?: string, onData?: Function, keepLast?: boolean}} [options]
 */
export async function withState(target, loader, options = {}) {
  const node = typeof target === 'string' ? $(target) : target;
  if (!node) return null;
  const { skeleton = 'rows', rows = 4, title, text, onData, keepLast = true } = options;
  const previous = keepLast ? node.innerHTML : '';
  const attempt = async (isRetry = false) => {
    const stop = beginProgress();
    node.setAttribute('aria-busy', 'true');
    node.classList.add('is-busy');
    if (!isRetry || !previous) render(node, skeletonMarkup(skeleton, rows));
    try {
      const markup = await loader();
      if (typeof markup === 'string') render(node, markup);
      node.removeAttribute('aria-busy');
      onData?.(node);
      return { ok: true };
    } catch (error) {
      /* A request that was cancelled by navigation is not an error the user
         should ever be told about. */
      if (error?.name === 'AbortError') return { ok: false, aborted: true };
      console.warn('[NOVAADMIN] panel failed', error);
      render(
        node,
        errorMarkup({
          title: title ?? 'بارگذاری داده‌ها کامل نشد',
          text: text ?? (navigator.onLine === false ? 'اتصال اینترنت در دسترس نیست؛ با بازگشت اتصال دوباره تلاش می‌کنیم.' : 'درخواست از سرویس داده با خطا برگشت.'),
          reason: error?.message ?? '',
          icon: navigator.onLine === false ? 'wifi-off' : 'cloud-exclamation',
        }),
      );
      on(node, 'click', (event) => {
        if (event.target.closest('[data-state-retry]')) {
          attempt(true);
          return;
        }
        if (event.target.closest('[data-state-dismiss]') && previous) {
          render(node, previous);
        }
      });
      return { ok: false, error };
    } finally {
      node.classList.remove('is-busy');
      stop();
    }
  };
  return attempt();
}

/** Convenience for grid/row hosts: marks every card in a host busy at once. */
export function markBusy(root = document, busy = true) {
  $$('[data-widget], .card', root).forEach((node) => {
    node.classList.toggle('is-busy', busy);
    if (busy) node.setAttribute('aria-busy', 'true');
    else node.removeAttribute('aria-busy');
  });
}

/* ------------------------------------------------------------- connectivity */

/**
 * The dashboard used to raise a blocking "connection lost" alert the moment the
 * browser reported a blip — which the proxy in front of the dev server does on
 * any idle minute. Two changes fix that for good:
 *
 *   1. a short grace period (three seconds) so a momentary hiccup never shows;
 *   2. a passive pill instead of an alert banner, plus an automatic re-sync of
 *      every chart and table on the page when the link is back.
 */
export function initConnectivity() {
  let offlineSince = 0;
  let timer = null;
  let pill = null;

  const host = () => {
    if (pill && document.body.contains(pill)) return pill;
    pill = document.createElement('div');
    pill.id = PILL_ID;
    pill.className = 'connection-pill';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-live', 'polite');
    pill.hidden = true;
    document.body.append(pill);
    return pill;
  };

  const paint = () => {
    const node = host();
    const offline = navigator.onLine === false;
    if (!offline) {
      node.hidden = true;
      document.documentElement.classList.remove('is-offline');
      return;
    }
    node.hidden = false;
    document.documentElement.classList.add('is-offline');
    node.innerHTML = `<i class="bi bi-wifi-off" aria-hidden="true"></i>
      <span>اتصال اینترنت موقتاً قطع است — داده‌های نمایشی همچنان کار می‌کنند.</span>`;
  };

  const show = () => {
    clearTimeout(timer);
    offlineSince = Date.now();
    /* Grace period: a dropped socket that returns in under a second must not
       bother the user at all. */
    timer = setTimeout(paint, 3000);
  };

  const clear = () => {
    clearTimeout(timer);
    const wasDown = offlineSince > 0;
    offlineSince = 0;
    if (pill) pill.hidden = true;
    document.documentElement.classList.remove('is-offline');
    if (wasDown) {
      /* Back online: re-run every stateful panel so stale data refreshes by
         itself instead of asking for a manual reload. */
      bus.emit('network:online', { at: Date.now() });
      window.setTimeout(() => {
        import('./charts.js')
          .then(({ refreshCharts }) => refreshCharts())
          .catch(() => {});
      }, 120);
    }
  };

  window.addEventListener('offline', show);
  window.addEventListener('online', clear);
  if (navigator.onLine === false) show();
  else paint();
  return { refresh: paint };
}

/* ------------------------------------------------- dev server keep-alive ---- */

/**
 * During development the page is served through a proxy that drops idle
 * connections; the editor then reports "connection lost" while the application
 * itself is perfectly healthy. A tiny heartbeat to the dev server keeps that
 * channel warm. It is compiled out of production builds (`import.meta.env.DEV`
 * is `false` there), so shipped templates never carry it.
 */
export function initKeepAlive() {
  if (!import.meta.env?.DEV) return () => {};
  const beat = () => {
    fetch('/__nova-heartbeat', { method: 'GET', cache: 'no-store' }).catch(() => {});
  };
  beat();
  const timer = window.setInterval(beat, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') beat();
  });
  return () => window.clearInterval(timer);
}

export default { beginProgress, endProgress, tracked, withState, errorMarkup, skeletonMarkup, markBusy, initConnectivity, initKeepAlive };
