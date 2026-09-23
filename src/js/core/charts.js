/**
 * NOVAADMIN — chart factory
 * ------------------------------------------------------------------
 * Every chart in the template is created here so they share one theme:
 * ApexCharts options are derived from the live CSS design tokens, so a primary
 * colour change, dark-mode switch, RTL flip or density change restyles every
 * chart without re-rendering the page.
 *
 * Declarative usage:
 *   <div class="chart" data-chart="area" data-chart-height="320"
 *        data-chart-series='[{"name":"درآمد","data":[12,18,9]}]'
 *        data-chart-labels='["فروردین","اردیبهشت"]'></div>
 *
 * Programmatic usage:
 *   import { createChart } from '../core/charts.js';
 *   createChart(node, { type: 'donut', series: [44, 55, 13] });
 */
import { $$, on } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { t } from './i18n.js';
import { phrase } from './translate.js';
import { toDigits, formatNumber, formatCompact } from './numbers.js';

const PALETTE_TOKENS = ['--nv-chart-1', '--nv-chart-2', '--nv-chart-3', '--nv-chart-4', '--nv-chart-5', '--nv-chart-6'];
const instances = new Map();
/** node → last raw payload, so re-theming keeps the resolved chart kind. */
const lastPayload = new WeakMap();
let apexPromise = null;

const tokens = () => getComputedStyle(document.documentElement);
const token = (name, fallback = '') => tokens().getPropertyValue(name).trim() || fallback;

export function chartColors(count = 6) {
  return Array.from({ length: count }, (_, index) => token(PALETTE_TOKENS[index % PALETTE_TOKENS.length], '#6366f1'));
}

function baseOptions() {
  const styles = tokens();
  return {
    chart: {
      fontFamily: styles.getPropertyValue('--nv-font-sans').trim() || 'inherit',
      foreColor: token('--nv-text-2', '#55617a'),
      background: 'transparent',
      /* Charts mirror the document direction so axes, legends and tooltips
         follow the RTL/LTR switch without per-page configuration. */
      rtl: document.documentElement.getAttribute('dir') === 'rtl',
      toolbar: { show: false },
      animations: {
        enabled: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        easing: 'easeinout',
        speed: 420,
      },
      parentHeightOffset: 0,
    },
    theme: { mode: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light' },
    grid: {
      borderColor: token('--nv-divider', '#eef1f6'),
      strokeDashArray: 4,
      padding: { left: 4, right: 4, top: 0, bottom: 0 },
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    dataLabels: { enabled: false },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      markers: { width: 9, height: 9, radius: 3 },
      itemMargin: { horizontal: 8, vertical: 2 },
      fontSize: '12px',
      labels: { colors: token('--nv-text-2', '#55617a') },
    },
    tooltip: {
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
      style: { fontFamily: 'inherit' },
      y: { formatter: (value) => (typeof value === 'number' ? formatNumber(value) : String(value ?? '')) },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: '11px' }, formatter: (value) => toDigits(phrase(String(value ?? ''))) },
    },
    yaxis: {
      labels: {
        style: { fontSize: '11px' },
        /**
         * One formatter only. ApexCharts appends the value it was given when a
         * formatter returns a string, so returning `formatCompact(value)` (which
         * already carries the «هزار/میلیون» suffix) produced duplicated ticks
         * such as «۴.۵ هزار ریال۴.۵ هزار ریال» on multi-axis charts.
         */
        formatter: (value) => (typeof value === 'number' ? formatCompact(value) : String(value ?? '')),
      },
    },
  };
}

const deepMerge = (target, source) => {
  const output = { ...target };
  Object.entries(source ?? {}).forEach(([key, value]) => {
    output[key] = value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(target[key] ?? {}, value) : value;
  });
  return output;
};

/** Chart families that read a flat list of numbers instead of `{name, data}` rows. */
const FLAT_TYPES = new Set(['donut', 'pie', 'radialBar', 'polarArea']);

/**
 * ApexCharts only accepts a flat number array for pie/donut/radial kinds. Data
 * services hand over the same shape everywhere (`[{ name, data }]`), so the
 * conversion lives here once instead of in every page controller: a `data-chart`
 * marked `donut` therefore renders a donut even when the caller passed series
 * rows — which is what the ten dashboards do.
 */
/** Legend/tooltip copy lives inside the chart canvas — translation happens here. */
function localiseSeries(series) {
  if (!Array.isArray(series)) return series;
  return series.map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? { ...row, name: phrase(row.name) } : row));
}

function localiseLabels(labels) {
  return Array.isArray(labels) ? labels.map((label) => phrase(label)) : labels;
}

function normalizeSeries(series, type) {
  if (!Array.isArray(series)) return [];
  if (!FLAT_TYPES.has(type)) return series;
  if (series.every((row) => typeof row === 'number')) return series;
  const value = (row) => {
    if (typeof row === 'number') return row;
    if (!row || typeof row !== 'object') return 0;
    if (typeof row.value === 'number') return row.value;
    if (Array.isArray(row.data)) return row.data.reduce((total, point) => total + (Number(point) || 0), 0);
    return 0;
  };
  const flat = series.map(value);
  /** A single radar-style row is common in hand-written markup: use its data. */
  if (flat.every((number) => number === 0) && series[0]?.data) return series[0].data.map((point) => Number(point) || 0);
  return flat;
}

/** Pads/trims label lists so ApexCharts never meets a mismatched pair. */
function normalizeLabels(labels, series, type) {
  if (!FLAT_TYPES.has(type)) return labels;
  const count = series.length;
  const next = (Array.isArray(labels) ? labels : []).slice(0, count).map((label) => String(label ?? ''));
  while (next.length < count) next.push(t('common.series') + ' ' + toDigits(next.length + 1));
  return next;
}

/** Builds the full options object for a chart type from raw series data. */
export function buildOptions({ type = 'area', series = [], labels = [], height = 300, colors = null, mixed = false, extra = {} } = {}) {
  const base = baseOptions();
  /**
   * `extra.type` is the strongest signal: page controllers pass the chart kind
   * they need for a given data key, while `type` often comes from the
   * declarative `data-chart` attribute (a static placeholder). Reading `extra`
   * here — and stripping it before the merge — is what keeps a donut a donut.
   */
  const extraType = extra?.type;
  const requestedType = extraType ?? type;
  /**
   * A mixed (combo) chart keeps area + column + line in one frame. ApexCharts
   * wants the container type `line` for that and the real type on each series,
   * plus a `yaxis` array so both scales stay readable.
   */
  const combo = Boolean(mixed) && Array.isArray(series) && series.some((row) => row && typeof row === 'object' && row.type);
  const chartType = combo ? 'line' : normalizeType(requestedType);
  const series2 = normalizeSeries(series, chartType);
  const labels2 = normalizeLabels(labels, series2, chartType);
  const { type: _ignored, ...safeExtra } = extra ?? {};
  const dense = chartType === 'area' || chartType === 'line' || chartType === 'bar';
  const palette = colors ?? chartColors(series2.length || 3);
  const localised = localiseSeries(series2);
  const localisedLabels = localiseLabels(labels2);
  const common = {
    series: localised,
    labels: localisedLabels,
    colors: palette,
    noData: { text: t('common.noData'), align: 'center', verticalAlign: 'middle', style: { fontSize: '13px', color: token('--nv-text-muted', '#7b8798') } },
    chart: { ...base.chart, type: chartType, height },
    stroke: { curve: 'smooth', width: chartType === 'line' || chartType === 'area' ? 2.5 : 0 },
    fill: { type: chartType === 'area' ? 'gradient' : 'solid', gradient: { shadeIntensity: 0.6, opacityFrom: 0.32, opacityTo: 0.04, stops: [0, 92] } },
    ...(dense && labels2.length > 11
      ? {
          xaxis: {
            labels: {
              rotate: 0,
              rotateAlways: false,
              hideOverlappingLabels: true,
              /* `trim: false` keeps ApexCharts from rendering «۱...۱۰/۹» on a
                 dense Persian axis: it hides the label instead (see the
                 wrapper in `xaxis.labels.formatter` below). */
              trim: false,
              /** Every nth label keeps a 30-point series readable in both directions. */
              showDuplicates: false,
              style: { fontSize: '11px' },
            },
          },
        }
      : {}),
  };

  const variants = {
    /* Vertical columns: `bar` + horizontal:false — see normalizeType(). */
    bar: {
      plotOptions: {
        bar: {
          horizontal: isHorizontalBar(requestedType),
          ...(isHorizontalBar(requestedType) ? { barHeight: '52%' } : { columnWidth: '46%' }),
          borderRadius: 6,
        },
      },
      stroke: { width: 0 },
      fill: { type: 'solid', opacity: 1 },
    },
    donut: { legend: { position: 'bottom' }, stroke: { width: 0 }, plotOptions: { pie: { donut: { size: '72%', labels: { show: true, name: { fontSize: '12px' }, value: { fontSize: '20px', fontWeight: 700, formatter: (value) => formatCompact(value) }, total: { show: true, label: t('charts.total'), formatter: (w) => formatCompact(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) } } } } } },
    pie: { legend: { position: 'bottom' } },
    radar: { stroke: { width: 2 }, fill: { opacity: 0.22 }, markers: { size: 3 } },
    radialBar: { plotOptions: { radialBar: { hollow: { size: '42%' }, dataLabels: { name: { fontSize: '13px' }, value: { fontSize: '20px', formatter: (value) => formatNumber(value) } }, track: { background: token('--nv-surface-3', '#f1f5f9'), strokeWidth: '100%' } } }, legend: { show: true, position: 'bottom' } },
    heatmap: { plotOptions: { heatmap: { radius: 6, enableShades: true, colorScale: { ranges: [{ from: 0, to: 40, color: token('--nv-chart-1', '#6366f1'), name: t('charts.low') }, { from: 41, to: 75, color: token('--nv-chart-3', '#10b981'), name: t('charts.medium') }, { from: 76, to: 100, color: token('--nv-warning', '#d97706'), name: t('charts.high') }] } } }, legend: { show: false } },
    sparkline: {
      chart: { sparkline: { enabled: true } },
      stroke: { width: 2.5, curve: 'smooth' },
      tooltip: { enabled: false },
      yaxis: { show: false },
      xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
      grid: { show: false, padding: { left: 0, right: 0, top: 2, bottom: 0 } },
      legend: { show: false },
      markers: { size: 0 },
    },
  };

  /** Variant lookup keeps the *requested* type, so `sparkline` and `column`
      still reach their option sets (both resolve to a different Apex type). */
  const variantKey = requestedType === 'column' ? 'bar' : requestedType;
  const comboVariant = {
    chart: { type: 'line' },
    /** One stroke width / dash pattern per series, in series order. */
    stroke: {
      curve: 'smooth',
      width: localised.map((row) => (row?.type === 'column' || row?.type === 'bar' ? 0 : 2.5)),
      dashArray: localised.map((row) => (row?.dashed ? 6 : 0)),
    },
    fill: {
      type: localised.map((row) => (row?.type === 'area' ? 'gradient' : 'solid')),
      opacity: localised.map((row) => (row?.type === 'column' || row?.type === 'bar' ? 0.85 : row?.type === 'area' ? 0.95 : 1)),
      gradient: { shadeIntensity: 0.6, opacityFrom: 0.32, opacityTo: 0.04, stops: [0, 92] },
    },
    plotOptions: { bar: { columnWidth: '44%', borderRadius: 4 } },
    markers: { size: 0, hover: { size: 5 } },
  };
  const variant = combo ? comboVariant : variants[variantKey] ?? variants[chartType] ?? {};
  const merged = deepMerge(deepMerge(base, common), variant);
  /** `extra` never carries the chart kind any more (it was read above). */
  return deepMerge(merged, { ...safeExtra, series: localised, labels: localisedLabels, colors: palette });
}

/**
 * Charts inside a hidden tab, a collapsed card or an accordion panel are laid
 * out with a width of zero: ApexCharts then draws a squashed chart that only
 * `updateOptions()` can repair. Watching the container means the chart is
 * redrawn the moment it actually gets space — no page reload, no resize by the
 * visitor.
 */
function watchSize(node, chart) {
  if (typeof ResizeObserver === 'undefined' || node.dataset.chartWatch === '1') return;
  node.dataset.chartWatch = '1';
  let last = node.clientWidth || 0;
  const observer = new ResizeObserver(() => {
    const width = node.clientWidth || 0;
    if (width === last) return;
    const wasHidden = last === 0;
    last = width;
    if (!wasHidden) return;
    try {
      chart.updateOptions(buildOptions(lastPayload.get(node) ?? payloadFromNode(node)), false, true);
    } catch (error) {
      console.warn('[nova:charts] resize redraw failed', error);
    }
  });
  observer.observe(node);
}

/**
 * Maps the template's chart vocabulary onto ApexCharts types.
 *
 * ApexCharts 3.54 removed `column` from its own list of axis chart types
 * (`Core.js → axisChartsArrTypes`), and a chart whose type is unknown is drawn
 * as a *line* chart with `xyRatios === null` — which throws
 * `Cannot read properties of null (reading 'yRatio')` and left every vertical
 * bar chart in the template blank. The supported spelling is `bar` plus
 * `plotOptions.bar.horizontal = false`, which is what this factory emits now.
 */
const APEX_TYPE = {
  area: 'area',
  line: 'line',
  column: 'bar',
  bar: 'bar',
  radar: 'radar',
  heatmap: 'heatmap',
  treemap: 'treemap',
  donut: 'donut',
  pie: 'pie',
  polarArea: 'polarArea',
  radialBar: 'radialBar',
  sparkline: 'area',
  spark: 'area',
};

function normalizeType(type) {
  return APEX_TYPE[type] ?? 'area';
}

/** The template's `bar` means a horizontal bar; `column` is the vertical one. */
const isHorizontalBar = (type) => type === 'bar';

async function getApex() {
  if (!apexPromise) apexPromise = import('apexcharts');
  const mod = await apexPromise;
  return mod.default ?? mod;
}

/**
 * Creates (or replaces) a chart on `node`.
 * @returns {Promise<Object|null>} the ApexCharts instance
 */
export async function createChart(node, options = {}) {
  if (!node) return null;
  const existing = instances.get(node);
  if (existing) {
    existing.destroy();
    instances.delete(node);
  }
  const raw = payloadFromNode(node, options);
  lastPayload.set(node, raw);
  const payload = buildOptions(raw);
  /**
   * A chart without series is not an error — it is an empty state. Drawing it
   * anyway produced the squashed, unlabelled boxes buyers saw in the tab and
   * accordion panels, so the container now announces the state instead and
   * waits for the controller (`createChart` again) to bring data.
   */
  if (!hasData(payload.series)) {
    showState(node, 'chart--empty', t('common.noData'));
    return null;
  }
  try {
    const ApexCharts = await getApex();
    const chart = new ApexCharts(node, payload);
    await chart.render();
    instances.set(node, chart);
    node.dataset.chartReady = '1';
    node.classList.remove('chart--failed', 'chart--empty');
    delete node.dataset.chartFallback;
    watchSize(node, chart);
    return chart;
  } catch (error) {
    /**
     * A chart failure must never take the page down: the container keeps its
     * height and shows the series as a readable fallback so the data is still
     * on screen (this also keeps automated runs honest — they can see the
     * difference between "chart drawn" and "chart failed").
     */
    console.warn('[nova:charts] render failed', error);
    showState(node, 'chart--failed', t('charts.renderFailed'));
    node.dataset.chartReady = '1';
    return null;
  }
}

/** True when a series list carries at least one drawable point. */
function hasData(series) {
  if (!Array.isArray(series) || series.length === 0) return false;
  if (series.every((row) => typeof row === 'number')) return true;
  return series.some((row) => (Array.isArray(row?.data) ? row.data.length > 0 : row && typeof row === 'object'));
}

function showState(node, className, message) {
  node.classList.remove('chart--failed', 'chart--empty');
  node.classList.add(className);
  node.dataset.chartFallback = message;
  node.dataset.chartReady = '1';
}

/**
 * Marks a `[data-chart-key]` placeholder as waiting on its page controller.
 * `initCharts()` skips those nodes so a controller-driven chart is never drawn
 * twice — once with the placeholder type and again with the real one.
 */
export function markControllerOwned(root = document) {
  $$('[data-chart-key]', root)
    /** A placeholder that already carries its own series is declarative. */
    .filter((node) => !node.dataset.chartSeries)
    .forEach((node) => {
      node.dataset.chartOwner = 'controller';
    });
}

/** Reads `data-chart-*` attributes so markup can stay declarative. */
function payloadFromNode(node, override = {}) {
  const parse = (value, fallback) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const type = override.type ?? node.dataset.chart ?? 'area';
  const series = override.series ?? parse(node.dataset.chartSeries, []);
  return {
    type,
    series,
    mixed: override.mixed ?? node.hasAttribute('data-chart-mixed'),
    labels: override.labels ?? parse(node.dataset.chartLabels, []),
    height: Number(override.height ?? node.dataset.chartHeight ?? 300),
    colors: override.colors ?? null,
    extra: override.extra ?? {},
  };
}

/**
 * Renders every declarative `[data-chart]` placeholder inside `root`
 * (idempotent). Placeholders that belong to a page controller are left alone
 * until the controller hands over their series, so nothing is drawn twice.
 */
export async function initCharts(root = document) {
  const nodes = $$('[data-chart]', root).filter(
    (node) => node.dataset.chartReady !== '1' && node.dataset.chartOwner !== 'controller',
  );
  await Promise.all(nodes.map((node) => createChart(node)));
  return nodes.length;
}

/**
 * Renders a "no data yet" state on every controller-owned placeholder that no
 * controller filled (an unhandled chart key, a failed request). Called after
 * the page controllers have run so nothing is drawn twice.
 */
export function settlePendingCharts(root = document) {
  $$('[data-chart-key]', root)
    .filter((node) => node.dataset.chartReady !== '1' && !instances.has(node))
    .forEach((node) => showState(node, 'chart--empty', t('common.noData')));
}

/** Re-themes existing charts after theme/colour/direction changes. */
export function refreshCharts() {
  instances.forEach(async (chart, node) => {
    try {
      await chart.updateOptions(buildOptions(lastPayload.get(node) ?? payloadFromNode(node)), false, true);
    } catch (error) {
      console.warn('[nova:charts] refresh failed', error);
    }
  });
}

/** Convenience wrappers used by dashboard controllers. */
export const charts = {
  init: initCharts,
  create: createChart,
  settle: settlePendingCharts,
  refresh: refreshCharts,
  colors: chartColors,
  async area(node, series, labels, height = 320, extra = {}) {
    return createChart(node, { type: 'area', series, labels, height, extra });
  },
  async column(node, series, labels, height = 320, extra = {}) {
    return createChart(node, { type: 'column', series, labels, height, extra });
  },
  async donut(node, series, labels, height = 300, extra = {}) {
    return createChart(node, { type: 'donut', series, labels, height, extra });
  },
  async radar(node, series, labels, height = 320, extra = {}) {
    return createChart(node, { type: 'radar', series, labels, height, extra });
  },
  async radial(node, series, height = 300, extra = {}) {
    return createChart(node, { type: 'radialBar', series, labels: ['پیشرفت'], height, extra });
  },
  destroy(node) {
    instances.get(node)?.destroy();
    instances.delete(node);
    lastPayload.delete(node);
  },
  instances,
};

bus.on(EVENTS.theme, refreshCharts);
bus.on(EVENTS.primary, refreshCharts);
bus.on(EVENTS.direction, refreshCharts);
bus.on(EVENTS.language, refreshCharts);
on(window, 'nova:appearance', refreshCharts);

export default charts;
