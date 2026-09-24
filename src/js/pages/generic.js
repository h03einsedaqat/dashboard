/**
 * NOVAADMIN — generic page renderer
 * ------------------------------------------------------------------
 * `tools/build-pages.mjs` gives every generated page a body placeholder such as
 *   <div data-app="table" data-resource="orders" data-title="سفارش‌ها"></div>
 * so all 200 pages ship with meaningful content even before a bespoke partial
 * exists. This module turns those placeholders into a real page: KPI strip,
 * chart, filter bar, data table and activity feed — all wired to the services.
 *
 * Authored bodies (`src/partials/pages/**`) replace the placeholder entirely;
 * in that case `data-app` is absent and this renderer does nothing.
 */
import { $, $$, create, render, escapeHtml } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { formatCurrency, formatNumber, toDigits } from '../core/numbers.js';
import { formatDate, relativeTime } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { withState } from '../core/load.js';
import { createDataTable, initDataTables } from '../core/datatable.js';
import * as services from '../../services/index.js';
import { emptyState } from './kit.js';

/** Column presets per resource — reused by generic pages and the API service. */
import { COLUMNS } from '../core/columns.js';
export { COLUMNS };

const FILTER_PRESETS = {
  orders: 'status:pending|processing|completed|cancelled|refunded',
  products: 'status:published|draft|archived|out-of-stock',
  users: 'status:active|invited|suspended',
  tickets: 'status:open|pending|in-progress|resolved|closed',
  invoices: 'status:paid|unpaid|overdue|draft|void',
  employees: 'status:active|on-leave|terminated',
  shipments: 'status:preparing|in-transit|out-for-delivery|delivered|delayed|returned',
  deals: 'stage:new|qualified|proposal|negotiation|won|lost',
  leads: 'status:new|contacted|qualified|unqualified',
  'hr/leave': 'status:pending|approved|rejected',
  tasks: 'status:backlog|todo|in-progress|review|done',
  subscriptions: 'status:active|trialing|past_due|canceled',
  reviews: 'status:published|pending|rejected',
  campaigns: 'status:active|scheduled|completed|paused|draft',
};

const SUMMARY_LABELS = {
  orders: [['total', 'کل سفارش‌ها'], ['revenue', 'درآمد', 'currency'], ['pending', 'در انتظار پرداخت'], ['averageOrder', 'میانگین سبد', 'currency']],
  products: [['total', 'کل محصولات'], ['published', 'منتشر شده'], ['outOfStock', 'ناموجود'], ['inventoryValue', 'ارزش انبار', 'currency']],
  users: [['total', 'کل کاربران'], ['active', 'کاربران فعال'], ['invited', 'دعوت‌شده'], ['twoFactor', 'ورود دو مرحله‌ای']],
  customers: [['total', 'کل مشتریان'], ['enterprise', 'سازمانی'], ['vip', 'مشتریان ویژه'], ['lifetime', 'ارزش کل', 'currency']],
  invoices: [['total', 'کل فاکتورها'], ['paid', 'پرداخت‌شده'], ['overdue', 'معوق'], ['outstanding', 'مانده دریافت', 'currency']],
  tickets: [['total', 'کل تیکت‌ها'], ['open', 'باز'], ['breached', 'نقض SLA'], ['csat', 'رضایت', 'percent']],
  employees: [['headcount', 'کل کارکنان'], ['openPositions', 'موقعیت باز'], ['attendanceRate', 'نرخ حضور', 'percent'], ['avgSalary', 'میانگین حقوق', 'currency']],
  shipments: [['activeShipments', 'محموله فعال'], ['deliveredToday', 'تحویل امروز'], ['delayed', 'تأخیری'], ['onTimeRate', 'تحویل به‌موقع', 'percent']],
  transactions: [['total', 'تراکنش‌ها'], ['inflow', 'واریز', 'currency'], ['outflow', 'برداشت', 'currency'], ['failed', 'ناموفق']],
  projects: [['total', 'پروژه‌ها'], ['active', 'فعال'], ['atRisk', 'در معرض خطر'], ['avgProgress', 'میانگین پیشرفت', 'percent']],
  subscriptions: [['total', 'اشتراک‌ها'], ['mrr', 'درآمد ماهانه', 'currency'], ['trialing', 'آزمایشی'], ['pastDue', 'معوق']],
};

const KPI_FALLBACKS = {
  total: ['کل رکوردها', 'number'],
  active: ['فعال', 'number'],
  open: ['باز', 'number'],
  pending: ['در انتظار', 'number'],
  paid: ['پرداخت‌شده', 'number'],
  overdue: ['معوق', 'number'],
  revenue: ['درآمد', 'currency'],
  mrr: ['درآمد ماهانه', 'currency'],
};

/**
 * The four tiles on top of every generated overview.
 *
 * When the service returns a `summary` the numbers come straight from it; when
 * it does not, they are counted from the rows that are actually on screen, so a
 * KPI is never a made-up constant.
 */
function kpiStrip(resource, summary, title, items = []) {
  const spec = SUMMARY_LABELS[resource] ?? [];
  const rows = Array.isArray(items) ? items : [];
  const derived = (key) => {
    const lower = String(key).toLowerCase();
    if (lower === 'total') return rows.length;
    if (lower === 'revenue' || lower === 'mrr') return rows.reduce((sum, row) => sum + (Number(row.total ?? row.amount ?? row.value ?? 0) || 0), 0);
    return rows.filter((row) => String(row.status ?? row.stage ?? '') === lower).length;
  };
  const cells = [];
  spec.forEach(([key, label, format]) => {
    const value = summary?.[key] ?? derived(key);
    if (value === undefined || value === null || value === '') return;
    const formatted =
      format === 'currency' ? formatCurrency(value, 'IRR', { compact: true }) : format === 'percent' ? `${formatNumber(value, { decimals: 1 })}٪` : formatNumber(value);
    cells.push({ label, value: formatted });
  });
  if (!cells.length) {
    /* No summary contract for this resource — count what is on screen instead. */
    const statuses = new Map();
    rows.forEach((row) => {
      const label = row.statusLabel ?? row.status ?? row.stageLabel ?? row.stage;
      if (label) statuses.set(String(label), (statuses.get(String(label)) ?? 0) + 1);
    });
    const money = rows.reduce((sum, row) => sum + (Number(row.total ?? row.amount ?? 0) || 0), 0);
    cells.push({ label: `کل ${title}`, value: formatNumber(rows.length) });
    if (money) cells.push({ label: 'ارزش کل', value: formatCurrency(money, 'IRR', { compact: true }) });
    [...statuses.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4 - cells.length)
      .forEach(([label, count]) => cells.push({ label, value: formatNumber(count) }));
  }
  if (!cells.length) return '';
  return `<div class="kpi-row" data-reveal>${cells
    .slice(0, 4)
    .map(
      (cell, index) => `<article class="stat-card">
        <div class="stat-card__head">
          <span class="stat-card__label">${escapeHtml(cell.label)}</span>
          <span class="stat-card__icon stat-card__icon--${['primary', 'success', 'info', 'warning'][index % 4]}"><i class="bi bi-${['clipboard-data', 'check2-circle', 'graph-up', 'hourglass-split'][index % 4]}" aria-hidden="true"></i></span>
        </div>
        <p class="stat-card__value">${escapeHtml(cell.value)}</p>
        <p class="stat-card__meta">بر پایه داده‌های همین صفحه</p>
      </article>`,
    )
    .join('')}</div>`;
}

/* ------------------------------------------------- overview chart helpers */

/** Month number (1-12) of a date in the Persian calendar, without extra deps. */
function persianMonthIndex(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const digits = String(new Intl.DateTimeFormat('en-US-u-ca-persian', { month: 'numeric' }).format(date)).replace(/[^0-9]/g, '');
    const index = Number(digits);
    return index >= 1 && index <= 12 ? index : null;
  } catch {
    return null;
  }
}

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** Real monthly buckets built from the records' own dates. */
function monthlyBuckets(items, valueKeys) {
  const buckets = PERSIAN_MONTHS.map((label) => ({ label, value: 0, count: 0 }));
  items.forEach((item) => {
    const when = valueKeys.dates.map((key) => item?.[key]).find(Boolean);
    const index = persianMonthIndex(when);
    if (!index) return;
    const amount = valueKeys.amounts.map((key) => Number(item?.[key])).find((value) => Number.isFinite(value) && value !== 0) ?? 1;
    buckets[index - 1].value += Math.abs(amount);
    buckets[index - 1].count += 1;
  });
  return buckets;
}

/** Counts grouped by status/stage, largest first. */
function statusBreakdown(items) {
  const map = new Map();
  items.forEach((item) => {
    const label = item?.statusLabel ?? item?.status ?? item?.stageLabel ?? item?.stage ?? item?.priorityLabel;
    if (label === undefined || label === null || label === '') return;
    const text = String(label);
    map.set(text, (map.get(text) ?? 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Trend + breakdown for an overview, both derived from the loaded rows. */
function overviewCharts(resource, title, items) {
  const buckets = monthlyBuckets(items, {
    dates: ['placedAt', 'createdAt', 'paidAt', 'shippedAt', 'at', 'date', 'since', 'dueDate'],
    amounts: ['total', 'amount', 'value', 'price', 'quantity', 'sold'],
  });
  const hasData = buckets.some((bucket) => bucket.count > 0);
  const labels = hasData ? buckets.map((bucket) => bucket.label) : PERSIAN_MONTHS.slice(0, 7);
  const data = hasData ? buckets.map((bucket) => bucket.value) : [0, 0, 0, 0, 0, 0, 0];
  const breakdown = statusBreakdown(items);
  const chartSeries = JSON.stringify([{ name: title, data }]);
  return `<div class="widget-grid">
    <section class="card" data-span="8" data-reveal>
      <header class="card__head">
        <div><h2 class="card__title">روند ${escapeHtml(title)}</h2><p class="card__subtitle">${hasData ? 'تجمیع رکوردها به تفکیک ماه شمسی' : 'بدون رکورد تاریخ‌دار در این بازه — نمودار پس از افزودن داده پر می‌شود'}</p></div>
        <div class="card__actions"><span class="badge badge--soft-primary rounded-pill">${toDigits(buckets.reduce((sum, bucket) => sum + bucket.count, 0))} رکورد تاریخ‌دار</span></div>
      </header>
      <div class="card__body"><div class="chart" data-chart="area" data-chart-height="300" data-chart-series='${chartSeries}' data-chart-labels='${JSON.stringify(labels)}'></div></div>
    </section>
    <section class="card" data-span="4" data-reveal>
      <header class="card__head">
        <div><h2 class="card__title">توزیع وضعیت‌ها</h2><p class="card__subtitle">سهم هر وضعیت از فهرست روبه‌رو</p></div>
      </header>
      <div class="card__body">${
        breakdown.length
          ? `<div class="chart" data-chart="donut" data-chart-height="300" data-chart-series='${JSON.stringify(breakdown.map((row) => row.value))}' data-chart-labels='${JSON.stringify(breakdown.map((row) => row.label))}'></div>`
          : emptyState({ title: 'وضعیتی برای شمارش نیست', text: 'رکوردها فیلد وضعیت ندارند.', icon: 'pie-chart' })
      }</div>
      ${
        breakdown.length
          ? `<footer class="card__foot">${breakdown
              .slice(0, 3)
              .map((row) => `<span>${escapeHtml(row.label)} <strong class="numeric">${toDigits(row.value)}</strong></span>`)
              .join('')}</footer>`
          : ''
      }
    </section>
  </div>`;
}

function tableMarkup(resource, columns, title) {
  return `<div class="card" data-reveal>
    <div class="card__head">
      <div><h2 class="card__title">${escapeHtml(title)}</h2><p class="card__subtitle">فهرست کامل با جستجو، فیلتر، مرتب‌سازی و خروجی</p></div>
      <div class="card__actions">
        <div class="datatable__selection" data-datatable-selection hidden>
          <span data-selection-count></span>
          <button type="button" class="btn btn-soft-danger btn-sm" data-bulk-delete>حذف انتخاب‌شده‌ها</button>
          <button type="button" class="btn btn-ghost btn-sm" data-clear-selection>لغو انتخاب</button>
        </div>
      </div>
    </div>
    <div class="card__body" data-datatable data-resource="${escapeHtml(resource)}" ${FILTER_PRESETS[resource] ? `data-filters="${escapeHtml(FILTER_PRESETS[resource])}"` : ''}>
      <div class="table-wrap">
        <table class="table table--hover"><thead><tr>${columns
          .map((column) => `<th data-column="${column.key}" data-type="${column.type}" ${column.sub ? `data-sub="${column.sub}"` : ''} ${column.avatar ? `data-avatar="${column.avatar}"` : ''} ${column.labels ? `data-labels='${JSON.stringify(column.labels)}'` : ''} ${column.href ? `data-href="${column.href}"` : ''} ${column.sortable ? 'data-sortable' : ''} class="${column.sortable ? 'is-sortable' : ''}${column.align === 'end' ? ' text-end' : ''}">${escapeHtml(column.label)}</th>`)
          .join('')}</tr></thead><tbody data-datatable-body></tbody></table>
      </div>
      <div class="datatable__foot" data-datatable-foot></div>
    </div>
  </div>`;
}



/* ------------------------------------------------------- dashboard harness */

/** Chart set per dashboard slug — keeps all ten dashboards distinct. */
const DASHBOARD_CHARTS = {
  analytics: ['revenue', 'traffic', 'sources', 'devices', 'target', 'orders'],
  ecommerce: ['revenue', 'orders', 'sources', 'devices', 'traffic'],
  crm: ['revenue', 'traffic', 'sources', 'devices'],
  saas: ['mrr', 'churn', 'plans', 'reasons', 'revenue'],
  finance: ['revenue', 'orders', 'sources', 'devices'],
  projects: ['revenue', 'orders', 'traffic', 'devices'],
  hr: ['traffic', 'sources', 'devices', 'orders'],
  support: ['traffic', 'sources', 'devices', 'revenue'],
  ai: ['tokens', 'models', 'cost', 'revenue'],
  logistics: ['orders', 'revenue', 'traffic', 'devices'],
};

const RANGES = [
  ['7d', '۷ روز'],
  ['30d', '۳۰ روز'],
  ['90d', '۹۰ روز'],
  ['12m', '۱۲ ماه'],
];

const DASHBOARD_TABLES = {
  analytics: ['orders', 'سفارش‌های اخیر'],
  ecommerce: ['orders', 'آخرین سفارش‌ها'],
  crm: ['deals', 'معاملات در جریان'],
  saas: ['subscriptions', 'اشتراک‌های فعال'],
  finance: ['transactions', 'تراکنش‌های اخیر'],
  projects: ['tasks', 'تسک‌های جاری'],
  hr: ['employees', 'کارکنان'],
  support: ['tickets', 'تیکت‌های اخیر'],
  ai: ['orders', 'رویدادهای اخیر'],
  logistics: ['shipments', 'محموله‌های فعال'],
};

/**
 * Builds the full dashboard experience: range switcher, KPI strip, chart grid,
 * table and activity feed. The controller (`pages/dashboards.js`) fills it with
 * real mock data from `analyticsService`.
 */
function dashboardHarness(slug) {
  const charts = DASHBOARD_CHARTS[slug] ?? DASHBOARD_CHARTS.analytics;
  const [resource, tableTitle] = DASHBOARD_TABLES[slug] ?? DASHBOARD_TABLES.analytics;
  const columns = COLUMNS[resource] ?? COLUMNS.orders;
  return `<div class="dashboard-shell" data-dashboard="${escapeHtml(slug)}" data-range="30d">
    <header class="dash-head">
      <div class="dash-head__text">
        <span class="badge badge--soft-primary">به‌روزرسانی لحظه‌ای</span>
        <span class="dash-head__hint">همه نمودارها و جدول‌های این صفحه با داده نمونه واقعی پر شده‌اند.</span>
      </div>
      <div class="dash-head__actions">
        <div class="segmented" data-range-presets>
          ${RANGES.map(([value, label]) => `<button type="button" class="segmented__item ${value === '30d' ? 'is-active' : ''}" data-range-preset="${value}" data-range-label="${label}">${label}</button>`).join('')}
        </div>
        <button class="btn btn-light" type="button" data-dashboard-refresh><i class="bi bi-arrow-repeat"></i> به‌روزرسانی</button>
        <button class="btn btn-light" type="button" data-widget-edit><i class="bi bi-sliders"></i> ابزارک‌ها</button>
        <div class="dropdown"><button class="btn btn-primary" type="button" data-dropdown-toggle="true" aria-expanded="false"><i class="bi bi-download"></i> خروجی</button>
          <ul class="dropdown-menu dropdown-menu-end" data-dropdown-menu>
            <li><button class="dropdown-item" type="button" data-export="csv"><i class="bi bi-filetype-csv"></i> CSV</button></li>
            <li><button class="dropdown-item" type="button" data-export="excel"><i class="bi bi-file-earmark-spreadsheet"></i> Excel</button></li>
            <li><button class="dropdown-item" type="button" data-export="print"><i class="bi bi-printer"></i> چاپ</button></li>
          </ul>
        </div>
      </div>
    </header>
    <div data-widget-editor hidden></div>
    <div class="kpi-row" data-kpi-strip><div class="kpi-row__loading">${Array.from({ length: 4 }, () => '<div class="skeleton skeleton--card"></div>').join('')}</div></div>
    <div class="widget-grid" id="widget-grid" data-widget-grid>
      ${charts
        .map(
          (key) => `<section class="card" data-widget="chart-${key}" data-widget-title="نمودار ${key}">
            <header class="card__head"><div><h2 class="card__title">${escapeHtml(chartTitle(key))}</h2><p class="card__subtitle">بازه فعال: <span data-range-label>۳۰ روز</span></p></div>
              <div class="card__actions"><div class="dropdown"><button class="icon-btn icon-btn--sm" type="button" data-dropdown-toggle="true" aria-expanded="false" aria-label="گزینه‌های نمودار"><i class="bi bi-three-dots-vertical"></i></button>
                <ul class="dropdown-menu dropdown-menu-end" data-dropdown-menu><li><button class="dropdown-item" type="button" data-chart-toggle="area">نمودار ناحیه‌ای</button></li><li><button class="dropdown-item" type="button" data-chart-toggle="column">نمودار ستونی</button></li><li><button class="dropdown-item" type="button" data-chart-toggle="line">نمودار خطی</button></li></ul></div></div></header>
            <div class="card__body"><div class="chart" data-chart-key="${escapeHtml(key)}" data-chart-height="300"></div></div>
          </section>`,
        )
        .join('')}
    </div>
    <div class="dash-bottom">
      ${tableMarkup(resource, columns, tableTitle)}
      <section class="card" data-widget="activity" data-widget-title="فعالیت‌ها">
        <header class="card__head"><div><h2 class="card__title">فعالیت‌های اخیر</h2><p class="card__subtitle">رویدادهای زنده سیستم</p></div></header>
        <div class="card__body" data-dashboard-activity>${skeletonRowsMarkup(4)}</div>
      </section>
    </div>
  </div>`;
}

const chartTitle = (key) =>
  ({
    revenue: 'درآمد و هدف',
    orders: 'تعداد سفارش‌ها',
    traffic: 'ترافیک ورودی',
    sources: 'منابع ترافیک',
    devices: 'دستگاه‌ها',
    target: 'هدف در برابر واقعی',
    mrr: 'درآمد ماهانه تکرارشونده',
    churn: 'نرخ ریزش',
    plans: 'توزیع پلن‌ها',
    reasons: 'دلایل ریزش',
    tokens: 'مصرف توکن',
    models: 'سهم مدل‌ها',
    cost: 'هزینه ماهانه',
  })[key] ?? key;

const skeletonRowsMarkup = (count) => Array.from({ length: count }, () => '<div class="skeleton skeleton--text"></div>').join('');

/** Fills the activity panel of a dashboard with real records. */
async function paintDashboardActivity(node) {
  const host = $('[data-dashboard-activity]', node);
  if (!host) return;
  const { items } = await services.activityService.list({ perPage: 6 });
  render(
    host,
    `<ul class="timeline timeline--compact">${items
      .map(
        (item) => `<li class="timeline__item"><span class="timeline__marker timeline__marker--${item.tone ?? 'primary'}"><i class="bi bi-${item.icon ?? 'activity'}"></i></span>
          <div class="timeline__content"><p class="timeline__title">${escapeHtml(item.title)}</p><p class="timeline__text">${escapeHtml(item.text ?? '')}</p><span class="timeline__time">${relativeTime(item.at)}</span></div></li>`,
      )
      .join('')}</ul>`,
  );
}

/**
 * The generic overview experience: KPI tiles, a trend and a breakdown chart
 * derived from the same rows the table shows, then the data table itself.
 *
 * It is the fallback for every `kind: 'app'` page, so it deliberately reads the
 * resource through the service layer — swapping the mock for a real endpoint
 * changes the page without touching this file.
 */
async function renderOverview(node, { resource, title }) {
  /*
   * `withState` gives this generated page the same three-phase behaviour as the
   * hand-written ones: a skeleton while the resource answers, a real panel with
   * a retry button when it does not, and content painted before the reveal
   * observer runs.
   */
  await withState(
    node,
    async () => {
      const service = services.default[resource] ?? services.default.orders;
      const result = (await service.list({ perPage: 240 })) ?? { items: [] };
      const items = result.items ?? [];
      const columns = COLUMNS[resource] ?? deriveColumns(result);
      return `<div class="dashboard-shell">
        ${kpiStrip(resource, result.summary ?? null, title, items)}
        ${overviewCharts(resource, title, items)}
        ${tableMarkup(resource, columns, title)}
      </div>`;
    },
    {
      skeleton: 'rows',
      title,
      /*
       * Generic pages paint after the boot pass that binds the data tables, so
       * both the charts and the table have to be started from here. Both calls
       * are idempotent per node, which keeps a re-paint cheap.
       */
      onData: (target) => {
        initCharts(target);
        initDataTables(target);
      },
    },
  );
}

function deriveColumns(result) {
  const sample = result?.items?.[0] ?? {};
  const keys = Object.keys(sample).filter((key) => !['id', 'description', 'body', 'items', 'timeline', 'messages'].includes(key)).slice(0, 6);
  return keys.map((key) => ({
    key,
    label: key,
    type: typeof sample[key] === 'number' ? 'number' : typeof sample[key] === 'boolean' ? 'badge' : 'text',
    sortable: true,
  }));
}

function renderUi(node, { resource, title }) {
  render(
    node,
    `<div class="stack">
      <div class="alert alert--info"><span class="alert__icon"><i class="bi bi-info-circle"></i></span><div class="alert__body"><p class="alert__title">صفحه کیت رابط کاربری</p><p>نمونه کامل کامپوننت‌ها در بخش <a href="ui/buttons.html">دکمه‌ها</a>، <a href="ui/forms.html">فرم‌ها</a> و <a href="ui/tables.html">جدول‌ها</a> آماده است.</p></div></div>
      <div class="kpi-row">
        <article class="stat-card"><div class="stat-card__head"><span class="stat-card__label">${escapeHtml(title)}</span><span class="stat-card__icon stat-card__icon--primary"><i class="bi bi-palette2"></i></span></div><p class="stat-card__value">۴۰+</p><p class="stat-card__meta">کامپوننت آماده</p></article>
        <article class="stat-card"><div class="stat-card__head"><span class="stat-card__label">حالت‌ها</span><span class="stat-card__icon stat-card__icon--success"><i class="bi bi-check2-circle"></i></span></div><p class="stat-card__value">۸</p><p class="stat-card__meta">حالت فرم و بازخورد</p></article>
        <article class="stat-card"><div class="stat-card__head"><span class="stat-card__label">توکن‌های رنگ</span><span class="stat-card__icon stat-card__icon--violet"><i class="bi bi-droplet-half"></i></span></div><p class="stat-card__value">۶</p><p class="stat-card__meta">پالت اصلی قابل تغییر</p></article>
        <article class="stat-card"><div class="stat-card__head"><span class="stat-card__label">جهت‌ها</span><span class="stat-card__icon stat-card__icon--info"><i class="bi bi-arrow-left-right"></i></span></div><p class="stat-card__value">RTL/LTR</p><p class="stat-card__meta">بر پایه Logical Properties</p></article>
      </div>
      ${tableMarkup(resource === 'generic' ? 'files' : resource, COLUMNS[resource] ?? COLUMNS.files, title)}
    </div>`,
  );
}

function renderTable(node, { resource, title }) {
  const columns = COLUMNS[resource] ?? COLUMNS.orders;
  render(
    node,
    `<div class="dashboard-shell">${tableMarkup(resource, columns, title)}</div>`,
  );
}

function renderSystem(node, { title }) {
  render(
    node,
    `<div class="stack">
      <div class="card"><div class="card__body">
        <div class="status-hero"><span class="status-hero__icon"><i class="bi bi-tools"></i></span>
          <div><h2 class="status-hero__title">${escapeHtml(title)}</h2><p class="status-hero__text">این صفحه بخشی از سیستم قالب است و با محتوای نمایشی نمایش داده می‌شود.</p></div>
        </div>
      </div></div>
      <div class="kpi-row">
        ${['نسخه ۱.۰.۰', 'آخرین بررسی', 'وضعیت سرویس', 'پشتیبانی']
          .map(
            (label, index) => `<article class="stat-card"><div class="stat-card__head"><span class="stat-card__label">${label}</span><span class="stat-card__icon stat-card__icon--${['primary', 'success', 'info', 'violet'][index]}"><i class="bi bi-${['tag', 'clock', 'activity', 'headset'][index]}"></i></span></div><p class="stat-card__value">${['۱.۰.۰', formatDate(new Date()), 'پایدار', '۲۴/۷'][index]}</p></article>`,
          )
          .join('')}
      </div>
    </div>`,
  );
}

function renderAuth(node, { title }) {
  render(
    node,
    `<div class="auth-page auth-page--centered"><div class="auth-page__main"><div class="auth-card">
      <div class="auth-card__head"><img src="assets/logo-mark.svg" alt="" width="40" height="40" /><h2 class="auth-card__title">${escapeHtml(title)}</h2><p class="auth-card__text">این صفحه توسط قالب تولید شده و آماده سفارشی‌سازی است.</p></div>
      <div class="auth-card__foot"><a class="btn btn-light w-100" href="auth/login.html">بازگشت به ورود</a></div>
    </div></div></div>`,
  );
}

/** Entry point — called by `main.js` after the chrome is ready. */
export async function renderGenericApps(root = document) {
  const nodes = $$('[data-app]', root).filter((node) => node.dataset.appClaimed !== '1');
  for (const node of nodes) {
    const kind = node.dataset.app;
    const resource = node.dataset.resource ?? 'orders';
    const title = node.dataset.title ?? 'داشبورد';
    try {
      if (kind === 'dashboard') {
        const slug =
          node.dataset.slug ??
          (node.dataset.page ?? '').split('/').pop()?.replace('.html', '') ??
          'analytics';
        render(node, dashboardHarness(slug));
        /**
         * The dashboard controller ran before this harness existed (the page
         * controller order is: `route()` → generic renderer), so it is started
         * here — it is idempotent per node, which keeps a manual re-render safe.
         */
        const { initDashboard, initDashboardTables } = await import('./dashboards.js');
        await initDashboard(node);
        initDashboardTables(node);
        initCharts(node);
        paintDashboardActivity(node);
      } else if (kind === 'overview') await renderOverview(node, { resource, title });
      else if (kind === 'table') renderTable(node, { resource, title });
      else if (kind === 'ui') renderUi(node, { resource, title });
      else if (kind === 'system') renderSystem(node, { title });
      else if (kind === 'auth') renderAuth(node, { title });
      else await renderOverview(node, { resource, title });
    } catch (error) {
      console.error('[nova:generic] failed to render', kind, error);
      render(node, `<div class="state-error"><span class="state-error__icon"><i class="bi bi-exclamation-triangle"></i></span><h3 class="state-error__title">خطا در آماده‌سازی صفحه</h3><p class="state-error__text">${escapeHtml(error.message)}</p><button type="button" class="btn btn-primary btn-sm" onclick="location.reload()">تلاش دوباره</button></div>`);
    }
  }
  return nodes.length;
}

export default { renderGenericApps, COLUMNS };
