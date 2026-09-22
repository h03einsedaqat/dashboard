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
import { toDigits, formatNumber, formatCompact } from './numbers.js';

const PALETTE_TOKENS = ['--nv-chart-1', '--nv-chart-2', '--nv-chart-3', '--nv-chart-4', '--nv-chart-5', '--nv-chart-6'];
const instances = new Map();
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
      labels: { style: { fontSize: '11px' }, formatter: (value) => toDigits(value) },
    },
    yaxis: { labels: { style: { fontSize: '11px' }, formatter: (value) => (typeof value === 'number' ? formatCompact(value) : value) } },
  };
}

const deepMerge = (target, source) => {
  const output = { ...target };
  Object.entries(source ?? {}).forEach(([key, value]) => {
    output[key] = value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(target[key] ?? {}, value) : value;
  });
  return output;
};

/** Builds the full options object for a chart type from raw series data. */
export function buildOptions({ type = 'area', series = [], labels = [], height = 300, colors = null, extra = {} } = {}) {
  const base = baseOptions();
  const palette = colors ?? chartColors(series.length || 3);
  const common = {
    series,
    labels,
    colors: palette,
    chart: { ...base.chart, type: normalizeType(type), height },
    stroke: { curve: 'smooth', width: type === 'line' || type === 'area' ? 2.5 : 0 },
    fill: { type: type === 'area' ? 'gradient' : 'solid', gradient: { shadeIntensity: 0.6, opacityFrom: 0.32, opacityTo: 0.04, stops: [0, 92] } },
  };

  const variants = {
    column: { plotOptions: { bar: { columnWidth: '46%', borderRadius: 6 } }, stroke: { width: 0 }, fill: { type: 'solid', opacity: 1 } },
    bar: { plotOptions: { bar: { horizontal: true, barHeight: '52%', borderRadius: 6 } }, stroke: { width: 0 }, fill: { type: 'solid', opacity: 1 } },
    donut: { legend: { position: 'bottom' }, stroke: { width: 0 }, plotOptions: { pie: { donut: { size: '72%', labels: { show: true, name: { fontSize: '12px' }, value: { fontSize: '20px', fontWeight: 700, formatter: (value) => formatCompact(value) }, total: { show: true, label: 'مجموع', formatter: (w) => formatCompact(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) } } } } } },
    pie: { legend: { position: 'bottom' } },
    radar: { stroke: { width: 2 }, fill: { opacity: 0.22 }, markers: { size: 3 } },
    radialBar: { plotOptions: { radialBar: { hollow: { size: '42%' }, dataLabels: { name: { fontSize: '13px' }, value: { fontSize: '20px', formatter: (value) => formatNumber(value) } }, track: { background: token('--nv-surface-3', '#f1f5f9'), strokeWidth: '100%' } } }, legend: { show: true, position: 'bottom' } },
    heatmap: { plotOptions: { heatmap: { radius: 6, enableShades: true, colorScale: { ranges: [{ from: 0, to: 40, color: token('--nv-chart-1', '#6366f1'), name: 'کم' }, { from: 41, to: 75, color: token('--nv-chart-3', '#10b981'), name: 'متوسط' }, { from: 76, to: 100, color: token('--nv-warning', '#d97706'), name: 'زیاد' }] } } }, legend: { show: false } },
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

  const merged = deepMerge(deepMerge(base, common), variants[type] ?? {});
  return deepMerge(merged, { ...extra, series, labels, colors: palette });
}

function normalizeType(type) {
  if (type === 'sparkline' || type === 'spark') return 'area';
  if (type === 'area' || type === 'line' || type === 'column' || type === 'bar' || type === 'radar' || type === 'heatmap') return type;
  if (type === 'donut' || type === 'pie' || type === 'radialBar') return type;
  if (type === 'treemap') return 'treemap';
  return 'area';
}

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
  const ApexCharts = await getApex();
  const payload = buildOptions(payloadFromNode(node, options));
  const chart = new ApexCharts(node, payload);
  await chart.render();
  instances.set(node, chart);
  node.dataset.chartReady = '1';
  return chart;
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
  const rawSeries = override.series ?? parse(node.dataset.chartSeries, []);
  const series = Array.isArray(rawSeries) && rawSeries.length && typeof rawSeries[0] === 'number' && type === 'donut' ? rawSeries : rawSeries;
  return {
    type,
    series,
    labels: override.labels ?? parse(node.dataset.chartLabels, []),
    height: Number(override.height ?? node.dataset.chartHeight ?? 300),
    colors: override.colors ?? null,
    extra: override.extra ?? {},
  };
}

/** Renders every `[data-chart]` placeholder inside `root` (idempotent). */
export async function initCharts(root = document) {
  const nodes = $$('[data-chart]', root).filter((node) => node.dataset.chartReady !== '1');
  await Promise.all(nodes.map((node) => createChart(node)));
  return nodes.length;
}

/** Re-themes existing charts after theme/colour/direction changes. */
export function refreshCharts() {
  instances.forEach(async (chart, node) => {
    try {
      await chart.updateOptions(buildOptions(payloadFromNode(node)), false, true);
    } catch (error) {
      console.warn('[nova:charts] refresh failed', error);
    }
  });
}

/** Convenience wrappers used by dashboard controllers. */
export const charts = {
  init: initCharts,
  create: createChart,
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
  },
  instances,
};

bus.on(EVENTS.theme, refreshCharts);
bus.on(EVENTS.primary, refreshCharts);
bus.on(EVENTS.direction, refreshCharts);
bus.on(EVENTS.language, refreshCharts);
on(window, 'nova:appearance', refreshCharts);

export default charts;
