/**
 * NOVAADMIN — page kit
 * ------------------------------------------------------------------
 * Small, reusable builders shared by every page controller. Keeping the markup
 * in one place is what allows ~200 pages to stay consistent and DRY:
 *
 *   kit.card({…})            → standard panel with head/body/foot
 *   kit.statCard({…})        → KPI tile
 *   kit.infoRows([…])        → definition list (details pages)
 *   kit.timeline([…])        → activity feed
 *   kit.formMarkup(fields)   → form fields from a descriptor array
 *   kit.crudList({…})        → DataTable + create/edit modal + validation
 *   kit.chart(node, {…})     → ApexCharts mount
 *   kit.exportable(target)   → CSV / Excel / print buttons
 */
import { $, $$, on, create, render, escapeHtml } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { bus, EVENTS } from '../core/bus.js';
import { formatCurrency, formatNumber, formatPercent, toDigits } from '../core/numbers.js';
import { formatDate, relativeTime } from '../core/jalali.js';
import { createDataTable } from '../core/datatable.js';
import { createChart } from '../core/charts.js';
import { validateForm, validateField } from '../core/form.js';
import * as serviceModule from '../../services/index.js';

/**
 * Normalises a service payload to an array. Collections come back in three
 * shapes across the mock layer (`{items}`, `{rows}` or a bare array); pages
 * should not care which one a given service uses.
 */
export const asRows = (payload) =>
  Array.isArray(payload) ? payload : (payload?.items ?? payload?.rows ?? payload?.data ?? []);

/**
 * Loads a record for a details page.
 *
 * `?id=…` (how the app links between screens) is resolved exactly; when the
 * caller did not pass an id — the visitor opened the page from the sidebar —
 * the first record of the collection is shown instead, so a details screen is
 * never an empty error page in the demo. `isSample` tells the caller which of
 * the two happened, and an id that does not exist still reports a real error.
 *
 * @returns {Promise<{ record: Object|null, isSample: boolean, notFound: boolean }>}
 */
export async function sampleRecord(resource, id = '') {
  const service = services.default[resource];
  if (!service) return { record: null, isSample: false, notFound: false };
  if (id) {
    try {
      const record = service.get ? await service.get(id) : null;
      if (record) return { record, isSample: false, notFound: false };
      return { record: null, isSample: false, notFound: true };
    } catch {
      return { record: null, isSample: false, notFound: true };
    }
  }
  try {
    const payload = service.list ? await service.list({ perPage: 1 }) : null;
    const record = asRows(payload)[0] ?? null;
    return { record, isSample: Boolean(record), notFound: !record };
  } catch {
    return { record: null, isSample: false, notFound: true };
  }
}

export const params = () => new URLSearchParams(window.location.search);
export const queryParam = (name, fallback = '') => params().get(name) ?? fallback;
export const pageId = () => document.body.dataset.page ?? '';
/**
 * Unified service surface for page code. The registry keys (`services.projects`,
 * `services.apiKeys`) and the named instances (`services.projectService`) are
 * both available, so pages may use whichever reads better. `services.default`
 * stays for backwards compatibility.
 */
export const services = { ...serviceModule, ...serviceModule.default };

export const resourceFor = (name) => services.default[name] ?? null;

/* --------------------------------------------------------------- primitives */

export function card({ title = '', subtitle = '', body = '', actions = '', foot = '', flush = false, icon = '', className = '', bodyClass = '', span = null } = {}) {
  /**
   * `span` writes the design system's own column hint (`data-span`), so cards
   * composed in JavaScript take part in the 12-column `.widget-grid` exactly
   * like hand-written markup does.
   */
  return `<section class="card ${className}"${span ? ` data-span="${Number(span)}"` : ''}>
    ${title || subtitle || actions ? `<header class="card__head">${icon ? `<span class="card__icon"><i class="bi bi-${icon}"></i></span>` : ''}
      <div>${title ? `<h2 class="card__title">${title}</h2>` : ''}${subtitle ? `<p class="card__subtitle">${subtitle}</p>` : ''}</div>
      ${actions ? `<div class="card__actions">${actions}</div>` : ''}</header>` : ''}
    <div class="card__body ${flush ? 'card__body--flush' : ''} ${bodyClass}">${body}</div>
    ${foot ? `<footer class="card__foot">${foot}</footer>` : ''}
  </section>`;
}

export function statCard({ label = '', value = '', meta = '', trend = null, icon = 'graph-up', tone = 'primary', spark = null, id = '' } = {}) {
  return `<article class="stat-card" ${id ? `data-widget="${escapeHtml(id)}" data-widget-title="${escapeHtml(label)}"` : ''} data-reveal>
    <div class="stat-card__head">
      <span class="stat-card__label">${escapeHtml(label)}</span>
      <span class="stat-card__icon stat-card__icon--${escapeHtml(tone)}"><i class="bi bi-${escapeHtml(icon)}" aria-hidden="true"></i></span>
    </div>
    <p class="stat-card__value">${value}</p>
    ${meta || trend !== null ? `<div class="stat-card__meta">${trend !== null ? `<span class="trend trend--${trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat'}"><i class="bi bi-arrow-${trend > 0 ? 'up' : trend < 0 ? 'down' : 'right'}-short"></i>${formatPercent(Math.abs(trend), { decimals: 1 })}</span>` : ''}<span>${meta}</span></div>` : ''}
    ${spark ? `<div class="stat-card__spark" data-chart="sparkline" data-chart-height="46" data-chart-series='${JSON.stringify([{ name: label, data: spark }])}'></div>` : ''}
  </article>`;
}

/**
 * KPI strip built straight from `analyticsService.kpis()` so the widget
 * catalogue shows exactly the same cards the dashboards render.
 */
export function kpiCards(kpis = []) {
  return `<div class="kpi-row">${kpis
    .map((kpi) =>
      statCard({
        label: kpi.label,
        value: kpiValue(kpi),
        meta: kpi.meta ?? kpi.hint ?? '',
        trend: Number.isFinite(kpi.delta) ? kpi.delta : null,
        icon: kpi.icon ?? 'graph-up',
        tone: kpi.tone ?? 'primary',
        spark: kpi.spark ?? null,
        id: kpi.id ?? '',
      }),
    )
    .join('')}</div>`;
}

export function infoRows(rows) {
  return rows
    .filter(Boolean)
    .map(([label, value, tone]) => `<div class="info-row"><span class="info-row__label">${escapeHtml(label)}</span><span class="info-row__value">${tone ? `<span class="badge badge--soft-${escapeHtml(tone)}">${escapeHtml(value)}</span>` : value}</span></div>`)
    .join('');
}

export function timeline(items, { compact = false } = {}) {
  return `<ul class="timeline ${compact ? 'timeline--compact' : ''}">${items
    .map(
      (item) => `<li class="timeline__item">
        <span class="timeline__marker timeline__marker--${escapeHtml(item.tone ?? 'primary')}"><i class="bi bi-${escapeHtml(item.icon ?? 'dot')}" aria-hidden="true"></i></span>
        <div class="timeline__content">
          <p class="timeline__title">${escapeHtml(item.title)}</p>
          ${item.text ? `<p class="timeline__text">${escapeHtml(item.text)}</p>` : ''}
          <span class="timeline__time">${item.time ? escapeHtml(item.time) : ''}</span>
        </div>
      </li>`,
    )
    .join('')}</ul>`;
}

export function emptyState({ title = 'داده‌ای برای نمایش نیست', text = '', icon = 'inbox', action = '' } = {}) {
  return `<div class="empty-state">
    <span class="empty-state__icon"><i class="bi bi-${escapeHtml(icon)}" aria-hidden="true"></i></span>
    <p class="empty-state__title">${escapeHtml(title)}</p>
    ${text ? `<p class="empty-state__text">${escapeHtml(text)}</p>` : ''}
    ${action ? `<div class="empty-state__actions">${action}</div>` : ''}
  </div>`;
}

export function skeleton(rows = 4, variant = 'row') {
  if (variant === 'card') {
    return `<div class="skeleton-stack">${Array.from({ length: rows }, () => '<div class="skeleton skeleton--card"></div>').join('')}</div>`;
  }
  return `<div class="skeleton-stack">${Array.from({ length: rows }, () => `<div class="skeleton-row"><span class="skeleton skeleton--circle"></span><div class="skeleton-stack"><span class="skeleton skeleton--title"></span><span class="skeleton skeleton--text"></span></div></div>`).join('')}</div>`;
}

export function errorState(message = 'بارگذاری داده‌ها با خطا مواجه شد') {
  return `<div class="state-error"><span class="state-error__icon"><i class="bi bi-exclamation-triangle"></i></span>
    <h3 class="state-error__title">${escapeHtml(message)}</h3>
    <p class="state-error__text">اتصال را بررسی کنید و دوباره تلاش کنید.</p>
    <button type="button" class="btn btn-primary btn-sm" data-retry>تلاش دوباره</button></div>`;
}

/* ------------------------------------------------------------------- forms */

const FIELD_ATTRS = `class="form-control"`;
const ruleAttrs = (field) =>
  [
    field.required ? 'required' : '',
    field.rule ? `data-rule="${escapeHtml(field.rule)}"` : '',
    field.min ? `data-min="${field.min}"` : '',
    field.max ? `data-max="${field.max}"` : '',
    field.match ? `data-match="${escapeHtml(field.match)}"` : '',
    field.noValidate ? 'data-no-validate' : '',
  ]
    .filter(Boolean)
    .join(' ');

/** Reads a form into a plain object, coercing numbers, switches and tags. */
export function collectValues(form) {
  const output = {};
  $$('input, select, textarea', form).forEach((field) => {
    if (!field.name) return;
    if (field.type === 'checkbox') output[field.name] = field.checked;
    else if (field.type === 'radio') {
      if (field.checked) output[field.name] = field.value;
    } else if (field.dataset.tagInput !== undefined || field.multiple) {
      output[field.name] = String(field.value)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    } else if (field.type === 'number' || field.inputMode === 'numeric') {
      const numeric = Number(String(field.value).replace(/[^\d.-]/g, ''));
      output[field.name] = Number.isFinite(numeric) ? numeric : field.value;
    } else output[field.name] = field.value.trim();
  });
  return output;
}

/** Builds form markup from descriptors: {name,label,type,options,col,required,hint,placeholder,value}. */
export function formMarkup(fields, values = {}, { wide = false } = {}) {
  return `<div class="form-grid ${wide ? 'form-grid--wide' : ''}">${fields
    .map((field) => {
      const value = values[field.name] ?? field.value ?? '';
      const id = `f-${field.name}-${Math.random().toString(36).slice(2, 7)}`;
      const col = field.col ? ` style="grid-column: span ${field.col}"` : '';
      const label = `<label class="form-label" for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="text-danger">*</span>' : ''}</label>`;
      let control;
      if (field.type === 'textarea') {
        control = `<textarea id="${id}" name="${field.name}" rows="${field.rows ?? 4}" ${FIELD_ATTRS} ${ruleAttrs(field)} placeholder="${escapeHtml(field.placeholder ?? '')}">${escapeHtml(value)}</textarea>`;
      } else if (field.type === 'select') {
        control = `<select id="${id}" name="${field.name}" class="form-select" ${ruleAttrs(field)}>${(field.options ?? [])
          .map((option) => {
            const optValue = typeof option === 'string' ? option : option.value;
            const optLabel = typeof option === 'string' ? option : option.label;
            return `<option value="${escapeHtml(optValue)}" ${String(optValue) === String(value) ? 'selected' : ''}>${escapeHtml(optLabel)}</option>`;
          })
          .join('')}</select>`;
      } else if (field.type === 'switch') {
        return `<div class="form-field"${col}><label class="form-switch"><input id="${id}" name="${field.name}" type="checkbox" class="form-check-input" ${value ? 'checked' : ''}><span class="form-check-label">${escapeHtml(field.label)}</span></label>${field.hint ? `<p class="form-hint">${escapeHtml(field.hint)}</p>` : ''}</div>`;
      } else if (field.type === 'tags') {
        control = `<input id="${id}" name="${field.name}" ${FIELD_ATTRS} value="${escapeHtml(Array.isArray(value) ? value.join(', ') : value)}" data-tag-input data-tag-name="${escapeHtml(field.name)}" ${ruleAttrs(field)} />`;
      } else {
        control = `<input id="${id}" name="${field.name}" type="${field.type ?? 'text'}" ${FIELD_ATTRS} value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder ?? '')}" ${field.step ? `step="${field.step}"` : ''} ${field.inputMode ? `inputmode="${field.inputMode}"` : ''} ${ruleAttrs(field)} />`;
      }
      return `<div class="form-field"${col}>${label}${control}${field.hint ? `<p class="form-hint">${escapeHtml(field.hint)}</p>` : ''}</div>`;
    })
    .join('')}</div>`;
}

/**
 * Opens a create/edit dialog for `resource`.
 * @param {{resource:string,id?:string,title:string,fields:Array,service?:object,onSaved?:Function}} options
 */
export function openRecordForm({ resource, id = null, title, subtitle = '', fields, service = null, onSaved = null, size = 'lg' }) {
  const api = service ?? services.default[resource];
  const isEdit = Boolean(id);
  const load = isEdit && api.get ? api.get(id) : Promise.resolve({});
  return load.then((record) => {
    const values = isEdit ? record : {};
    return modal.open({
      title: title ?? (isEdit ? `ویرایش ${resource}` : `افزودن ${resource}`),
      subtitle,
      size,
      content: `<form class="form-stack" data-record-form novalidate>${formMarkup(fields, values)}</form>`,
      footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="submit" form="record-form" class="btn btn-primary" data-record-submit>ذخیره</button>',
      onMount: (panel) => {
        const form = $('[data-record-form]', panel);
        const submit = $('[data-record-submit]', panel);
        submit.setAttribute('form', form.id || (form.id = 'record-form'));
        on(form, 'submit', async (event) => {
          event.preventDefault();
          if (!validateForm(form).valid) {
            toast.warning('فرم کامل نیست', 'لطفاً خطاهای مشخص‌شده را برطرف کنید.');
            return;
          }
          submit.classList.add('is-loading');
          submit.disabled = true;
          try {
            const payload = collectValues(form);
            const saved = isEdit ? await api.update(id, payload) : await api.create(payload);
            toast.success(isEdit ? 'تغییرات ذخیره شد' : 'مورد جدید ثبت شد', 'فهرست به‌روزرسانی شد.');
            modal.closeTop();
            onSaved?.(saved);
            bus.emit(EVENTS.dataChanged, { resource, action: isEdit ? 'update' : 'create', id: saved?.id ?? id });
          } catch (error) {
            toast.danger('ذخیره نشد', error.message ?? 'خطای غیرمنتظره');
          } finally {
            submit.classList.remove('is-loading');
            submit.disabled = false;
          }
        });
      },
    });
  });
}

/* --------------------------------------------------------------- data table */

/**
 * Wires the `[data-datatable]` node on the page to the resource service and a
 * create/edit dialog — the standard CRUD list used across the template.
 */
export function crudList({ root = document, resource, title, fields, subtitle = '' }) {
  const node = $('[data-datatable]', root);
  if (!node) return null;
  const table = createDataTable(node, { resource });
  const createButton = $('[data-create]', root);
  if (createButton) {
    on(createButton, 'click', () => openRecordForm({ resource, title: `افزودن ${title ?? resource}`, fields, onSaved: () => table.reload?.() }));
  }
  bus.on('datatable:edit', ({ id, resource: changed }) => {
    if (changed !== resource) return;
    openRecordForm({ resource, id, title: `ویرایش ${title ?? resource}`, fields, onSaved: () => table.reload?.() });
  });
  bus.on('datatable:open', ({ id, resource: changed }) => {
    if (changed !== resource) return;
    toast.info('جزئیات', `رکورد ${id} انتخاب شد — صفحه جزئیات آن در همین قالب آماده است.`);
  });
  return table;
}

/* ------------------------------------------------------------------ charts */

/**
 * Chart placeholder markup for template strings. Page code composes markup as
 * strings, so this is the string-shaped sibling of `chart(node, options)`:
 * it emits the `data-chart-*` contract that `core/charts.js` mounts later.
 */
export function chartBox({ key = '', type = 'area', height = 320, series = [], labels = [], className = '' } = {}) {
  return `<div class="chart${className ? ` ${className}` : ''}"${key ? ` data-chart-key="${escapeHtml(key)}"` : ''} data-chart="${escapeHtml(type)}" data-chart-height="${escapeHtml(String(height))}" data-chart-series='${JSON.stringify(series)}' data-chart-labels='${JSON.stringify(labels)}'></div>`;
}

export async function chart(node, options = {}) {
  if (!node) return null;
  const series = options.series ?? [];
  const labels = options.labels ?? [];
  const instance = await createChart(node, { height: options.height ?? 320, ...options, series, labels });
  node.dataset.chartReady = '1';
  return instance;
}

/** Human readable KPI value used by dashboards and overview pages. */
export function kpiValue(kpi) {
  switch (kpi.unit) {
    case 'currency':
      return formatCurrency(kpi.value, 'IRR', { compact: true });
    case 'percent':
      return `${formatNumber(kpi.value, { decimals: 1 })}٪`;
    case 'day':
      return `${toDigits(kpi.value)} روز`;
    case 'minute':
      return `${toDigits(kpi.value)} دقیقه`;
    default:
      return formatNumber(kpi.value);
  }
}

/* ------------------------------------------------------------------ exports */

/**
 * Wires `[data-export="csv|excel|print"]` buttons to the DataTable export API
 * and `[data-print]` buttons to the browser print dialog.
 */
/**
 * Wires the header's export menu for a page.
 *
 * It prefers the real data table (so the file matches the current search,
 * filters, sorting and page), and falls back to the largest plain table on the
 * page — which is what report, finance and matrix pages show. Guarded per
 * scope, because a page that repaints (a new report range, a saved record)
 * must not end up with two listeners and two downloads per click.
 */
export function exportable(scope = document, resource = null) {
  if (scope?.dataset?.exportBound === '1') return;
  if (scope?.dataset) scope.dataset.exportBound = '1';
  on(scope, 'click', async (event) => {
    const button = event.target.closest('[data-export]');
    if (!button) return;
    event.preventDefault();
    const kind = button.dataset.export || 'csv';
    const node = (resource && $(`[data-datatable][data-resource="${resource}"]`, scope)) || $('[data-datatable]', scope);
    if (node) {
      createDataTable(node).export?.(kind);
      return;
    }
    if (kind === 'print') {
      window.print();
      return;
    }
    const tables = $$('table', scope);
    const table = $('[data-export-table] table', scope) ?? (tables.length ? tables.sort((a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length)[0] : null);
    if (!table) {
      toast.warning('خروجی در دسترس نیست', 'در این صفحه جدولی برای خروجی گرفتن پیدا نشد.');
      return;
    }
    downloadTable(table, kind, scope.querySelector?.('[data-export-resource]')?.dataset.exportResource ?? resource ?? 'export');
  });

  on(scope, 'click', (event) => {
    if (!event.target.closest('[data-print]')) return;
    document.body.classList.add('is-printing');
    window.print();
    setTimeout(() => document.body.classList.remove('is-printing'), 400);
  });
}

/** Turns any rendered table into a CSV/XLS download — the fallback when a page has no data table. */
function downloadTable(table, format, name) {
  const rows = [...table.querySelectorAll('tr')].map((row) =>
    [...row.children]
      .map((cell) => cell.textContent.replace(/\s+/g, ' ').replace(/^\s*[▲▼]\s*/, '').trim())
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(','),
  );
  if (rows.length < 2) {
    toast.warning('خروجی گرفته نشد', 'جدول این صفحه ردیفی برای ذخیره ندارد.');
    return;
  }
  const csv = (format === 'excel' ? '\ufeff' : '') + rows.join('\n');
  const blob = new Blob([csv], { type: format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = create('a', { href: url, download: `${name}-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xls' : 'csv'}` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success('فایل خروجی آماده شد', `${toDigits(rows.length - 1)} ردیف از جدول همین صفحه ذخیره شد.`);
}




/* --------------------------------------------------------- shared fragments */

/** Tone-aware status pill used by every detail and list page. */
export const statusBadge = (label, tone = 'neutral') => `<span class="badge badge--soft-${escapeHtml(tone)}">${escapeHtml(String(label ?? ''))}</span>`;

/** Primary action toolbar: create button + export dropdown. */
export function toolButtons({ create = null, exportResource = null, extra = '' } = {}) {
  return `${extra}${create ? `<button type="button" class="btn btn-primary" data-create><i class="bi bi-plus-lg"></i> ${escapeHtml(create)}</button>` : ''}
    <div class="dropdown"${exportResource ? ` data-export-resource="${escapeHtml(String(exportResource))}"` : ''}><button class="btn btn-light" type="button" data-dropdown-toggle="true" aria-expanded="false"><i class="bi bi-download"></i> خروجی</button>
      <ul class="dropdown-menu dropdown-menu-end" data-dropdown-menu>
        <li><button class="dropdown-item" type="button" data-export="csv"><i class="bi bi-filetype-csv"></i> CSV</button></li>
        <li><button class="dropdown-item" type="button" data-export="excel"><i class="bi bi-file-earmark-spreadsheet"></i> Excel</button></li>
        <li><button class="dropdown-item" type="button" data-export="print"><i class="bi bi-printer"></i> چاپ</button></li>
      </ul>
    </div>`;
}

/** KPI strip from a service `summary` object: [key, label, format, tone, icon][]. */
export function statsFrom(summary, labels) {
  if (!summary) return '';
  return `<div class="kpi-row">${labels
    .map(([key, label, format, tone, icon]) => {
      const value = summary[key];
      if (value === undefined || value === null) return '';
      const formatted =
        format === 'currency' ? formatCurrency(value, 'IRR', { compact: true }) : format === 'percent' ? `${formatNumber(value, { decimals: 1 })}٪` : formatNumber(value);
      return statCard({ label, value: formatted, icon: icon ?? 'graph-up', tone: tone ?? 'primary', meta: 'به‌روزرسانی لحظه‌ای' });
    })
    .join('')}</div>`;
}

/* ------------------------------------------------------------------ layout */

/** Claims the generated `[data-app]` placeholder so the generic renderer skips it. */
export function host() {
  const node = $('[data-app]');
  if (!node) return null;
  node.dataset.appClaimed = '1';
  if (!node.classList.contains('page-body')) node.classList.add('page-body');
  return node;
}

/** Claims the placeholder and paints authored markup into it. */
/**
 * Renders markup into a host node.
 *
 * Two call styles are supported on purpose:
 *
 *   paint(markup)            → the page host (`[data-app]`)
 *   paint(target, markup)    → an explicit node
 *
 * The preview and search pages pass a target (a gallery grid, a result list);
 * dropping the second argument silently painted into the host instead, which is
 * why those sections came out empty.
 */
export function paint(target, markup) {
  if (target == null || typeof target === 'string') {
    const node = host();
    if (node) render(node, target ?? '');
    return node;
  }
  if (markup !== undefined) render(target, markup);
  return target;
}

/** Tab strip + panels wired by core/ui.js (`[data-tabs]`, `[data-tab]`). */
export function tabs(items, { id = 'page-tabs', pills = false } = {}) {
  const links = items
    .map(
      (item, index) => `<button type="button" class="nav-link ${index === 0 ? 'active' : ''}" data-tab="${escapeHtml(item.id)}" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="panel-${escapeHtml(item.id)}">${item.icon ? `<i class="bi bi-${escapeHtml(item.icon)}"></i>` : ''}<span>${escapeHtml(item.label)}</span>${item.badge ? `<span class="badge badge--soft-primary">${escapeHtml(String(item.badge))}</span>` : ''}</button>`,
    )
    .join('');
  const panels = items
    .map((item, index) => `<div class="tab-pane ${index === 0 ? 'active' : ''}" id="panel-${escapeHtml(item.id)}" data-tab-panel="${escapeHtml(item.id)}" role="tabpanel" ${index === 0 ? '' : 'hidden'}>${item.body ?? ''}</div>`)
    .join('');
  return `<div class="tabs" data-tabs id="${escapeHtml(id)}">
    <nav class="nav ${pills ? 'nav-pills' : 'nav-tabs'}" role="tablist" aria-label="بخش‌های صفحه">${links}</nav>
    <div class="tab-content">${panels}</div>
  </div>`;
}

/** Page header block (title, breadcrumb-free subtitle, badges and actions). */
export function pageHeader({ title, subtitle = '', badges = [], actions = '', icon = '' }) {
  return `<header class="card"><div class="card__body page-head-row">
    <div class="page-head-row__text">
      <h1 class="page-head-row__title">${icon ? `<span class="page-head-row__icon"><i class="bi bi-${escapeHtml(icon)}"></i></span>` : ''}${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="page-head-row__sub">${escapeHtml(subtitle)}</p>` : ''}
      ${badges.length ? `<div class="badge-dot-list">${badges.join('')}</div>` : ''}
    </div>
    ${actions ? `<div class="page-head-row__actions">${actions}</div>` : ''}
  </div></header>`;
}

/**
 * Renders a drag & drop kanban from a `{stages|columns, items}` service payload.
 * @param {{columns:Array<{id:string,label:string,tone?:string,items:Array}>, onMove:Function, countLabel?:string}} config
 */
export function kanbanMarkup({ columns, countLabel = 'مورد' }) {
  return `<div class="kanban" data-kanban data-kanban-resource="kanban">
    ${columns
      .map(
        (column) => `<div class="kanban__column" data-kanban-column="${escapeHtml(column.id)}">
          <header class="kanban__head">
            <h3 class="kanban__title"><span class="status-dot status-dot--${escapeHtml(column.tone ?? 'primary')}" aria-hidden="true"></span>${escapeHtml(column.label)}</h3>
            <span class="kanban__count" data-kanban-count>${toDigits(column.items.length)}</span>
          </header>
          <div class="kanban__body" data-kanban-body>
            ${column.items
              .map(
                (item) => `<article class="kanban-card" data-kanban-card data-id="${escapeHtml(item.id)}" data-value="${Number(item.value ?? 0)}">
                  <div class="kanban-card__head">
                    <span class="badge badge--soft-${escapeHtml(item.tone ?? 'primary')}">${escapeHtml(item.tag ?? column.label)}</span>
                    <button type="button" class="icon-btn icon-btn--sm" data-kanban-handle aria-label="جابجایی ${escapeHtml(item.title)}"><i class="bi bi-grip-vertical"></i></button>
                  </div>
                  <p class="kanban-card__title">${escapeHtml(item.title)}</p>
                  ${item.text ? `<p class="kanban-card__text">${escapeHtml(item.text)}</p>` : ''}
                  ${item.progress !== undefined ? `<div class="kanban-card__progress"><div class="progress progress--sm"><div class="progress-bar" style="width:${Math.min(100, Number(item.progress))}%"></div></div><span class="numeric">${formatPercent(Number(item.progress), { decimals: 0 })}</span></div>` : ''}
                  <footer class="kanban-card__foot">
                    <span class="kanban-card__meta">${item.avatar ? `<img class="avatar avatar--xs" src="${escapeHtml(item.avatar)}" alt="" loading="lazy" />` : ''}${escapeHtml(item.meta ?? '')}</span>
                    ${item.value ? `<span class="kanban-card__value numeric">${formatCurrency(item.value, 'IRR', { compact: true })}</span>` : ''}
                  </footer>
                </article>`,
              )
              .join('')}
          </div>
          <footer class="kanban__foot"><span class="kanban__sum numeric" data-kanban-sum></span><button type="button" class="btn btn-ghost btn-sm" data-kanban-add><i class="bi bi-plus-lg"></i> افزودن ${escapeHtml(countLabel)}</button></footer>
        </div>`,
      )
      .join('')}
  </div>`;
}

/* ------------------------------------------------------------------- hydrate */

/** Prints a friendly date range label for filter chips. */
export const dateLabel = (value) => formatDate(value, { format: 'medium' });
export const relTime = (value) => relativeTime(value);
export const money = (value, currency = 'IRR') => formatCurrency(value, currency);
export const num = (value, decimals = 0) => formatNumber(value, { decimals });
