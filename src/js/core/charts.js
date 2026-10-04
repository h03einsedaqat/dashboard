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
import { STATUS_LABELS } from './record-dialogs.js';

const PALETTE_TOKENS = ['--nv-chart-1', '--nv-chart-2', '--nv-chart-3', '--nv-chart-4', '--nv-chart-5', '--nv-chart-6'];
const instances = new Map();
/** node → last raw payload, so re-theming keeps the resolved chart kind. */
const lastPayload = new WeakMap();
let apexPromise = null;

let _tokenCache = null;
function getStyleTokens() {
  if (!_tokenCache) {
    const styles = getComputedStyle(document.documentElement);
    _tokenCache = {
      fontSans: styles.getPropertyValue('--nv-font-sans').trim() || 'inherit',
      text2: styles.getPropertyValue('--nv-text-2').trim() || '#55617a',
      divider: styles.getPropertyValue('--nv-divider').trim() || '#eef1f6',
      textMuted: styles.getPropertyValue('--nv-text-muted').trim() || '#7b8798',
      surface3: styles.getPropertyValue('--nv-surface-3').trim() || '#f1f5f9',
      palettes: PALETTE_TOKENS.map((key) => styles.getPropertyValue(key).trim() || '#6366f1'),
    };
  }
  return _tokenCache;
}

function invalidateTokenCache() {
  _tokenCache = null;
}

export function chartColors(count = 6) {
  const cached = getStyleTokens();
  return Array.from({ length: count }, (_, index) => cached.palettes[index % cached.palettes.length]);
}

/**
 * Phone-sized charts used to be drawn with their desktop gutters: on a 288px
 * card a y-axis full of «۱۰.۰ میلیارد» ticks eats a third of the plot, the
 * columns land on top of the labels and the net line runs through the month
 * names. ApexCharts' own `responsive` block re-lays the chart out whenever the
 * container crosses the breakpoint, so the same page stays correct after a
 * rotation — no JavaScript media query to keep in sync.
 */
const numberOr = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function phoneOptions({ chartType, dense, height }) {
  /**
   * `formatCompact` writes Persian units after a space («۱۰.۰ میلیارد»); the
   * number is what the phone gutter has room for, and the unit is still in the
   * tooltip, the legend and the card copy right above the chart. Latin builds
   * suffix the unit without a space (`1.2M`) and already fit, so they are kept.
   */
  const tick = (value) => {
    if (typeof value !== 'number') return String(value ?? '');
    const parts = formatCompact(value, { decimals: 0 }).split(' ');
    return parts.length > 1 ? parts[0] : parts.join(' ');
  };
  return {
    breakpoint: 640,
    options: {
      chart: { height: Math.max(210, Math.round(numberOr(height, 300) * 0.82)) },
      grid: { padding: { left: 0, right: 0, top: 0, bottom: 0 }, strokeDashArray: 3 },
      legend: { position: 'bottom', fontSize: '11px', markers: { width: 7, height: 7, radius: 2 }, itemMargin: { horizontal: 6, vertical: 1 } },
      xaxis: { labels: { style: { fontSize: '10px' }, rotate: 0, hideOverlappingLabels: true, trim: false } },
      yaxis: { labels: { style: { fontSize: '10px' }, minWidth: 22, maxWidth: 52, formatter: tick } },
      ...(dense
        ? {
            stroke: { width: chartType === 'bar' ? 0 : 2, curve: 'smooth' },
            plotOptions: { bar: { columnWidth: '62%', borderRadius: 3 } },
          }
        : {}),
    },
  };
}

function baseOptions() {
  const styles = getStyleTokens();
  return {
    chart: {
      fontFamily: styles.fontSans,
      foreColor: styles.text2,
      background: 'transparent',
      /* Charts mirror the document direction so axes, legends and tooltips
         follow the RTL/LTR switch without per-page configuration. */
      rtl: document.documentElement.getAttribute('dir') === 'rtl',
      toolbar: { show: false },
      animations: {
        enabled: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        easing: 'easeinout',
        speed: 260,
      },
      parentHeightOffset: 0,
    },
    theme: { mode: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light' },
    grid: {
      borderColor: styles.divider,
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
      labels: { colors: styles.text2 },
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
/** Raw enum keys coming from the data layer (`on-hold`, `smb`) get their Persian label. */
const RAW_KEY = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/;
function humanLabel(value) {
  if (typeof value !== 'string' || !RAW_KEY.test(value)) return value;
  if ((document.documentElement.lang || 'fa') !== 'fa') return value;
  return STATUS_LABELS[value] ?? STATUS_LABELS[value.replace(/_/g, '-')] ?? value;
}

function localiseSeries(series) {
  if (!Array.isArray(series)) return series;
  return series.map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? { ...row, name: phrase(humanLabel(row.name)) } : row));
}

function localiseLabels(labels) {
  return Array.isArray(labels) ? labels.map((label) => phrase(humanLabel(label))) : labels;
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
  const phone = phoneOptions({ chartType, dense, height });
  const palette = colors ?? chartColors(series2.length || 3);
  const localised = localiseSeries(series2);
  const localisedLabels = localiseLabels(labels2);
  const styles = getStyleTokens();
  const common = {
    series: localised,
    labels: localisedLabels,
    colors: palette,
    ...(phone ? { responsive: [phone] } : {}),
    noData: { text: t('common.noData'), align: 'center', verticalAlign: 'middle', style: { fontSize: '13px', color: styles.textMuted } },
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
    radialBar: { plotOptions: { radialBar: { hollow: { size: '42%' }, dataLabels: { name: { fontSize: '13px' }, value: { fontSize: '20px', formatter: (value) => formatNumber(value) } }, track: { background: styles.surface3, strokeWidth: '100%' } } }, legend: { show: true, position: 'bottom' } },
    heatmap: { plotOptions: { heatmap: { radius: 6, enableShades: true, colorScale: { ranges: [{ from: 0, to: 40, color: styles.palettes[0], name: t('charts.low') }, { from: 41, to: 75, color: styles.palettes[2] ?? '#10b981', name: t('charts.medium') }, { from: 76, to: 100, color: '#d97706', name: t('charts.high') }] } } }, legend: { show: false } },
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
  /**
   * `extra.responsive` *adds* a breakpoint instead of replacing the shared
   * phone one: a page that wants fewer months (or a lighter legend) on a phone
   * would otherwise silently lose the compact ticks, the smaller gutter and
   * the height clamp every other chart keeps.
   */
  const extraReady = { ...safeExtra };
  if (Array.isArray(safeExtra.responsive) && Array.isArray(merged.responsive)) {
    extraReady.responsive = [...safeExtra.responsive, ...merged.responsive];
  }
  /** `extra` never carries the chart kind any more (it was read above). */
  return deepMerge(merged, { ...extraReady, series: localised, labels: localisedLabels, colors: palette });
}

/**
 * Charts inside a hidden tab, a collapsed card or an accordion panel are laid
 * out with a width of zero: ApexCharts then draws a squashed chart that only
 * `updateOptions()` can repair. Watching the container means the chart is
 * redrawn the moment it actually gets space — no page reload, no resize by the
 * visitor.
 */
function watchSize(node, chart) {
  if (typeof ResizeObserver === 'undefined') return;
  /* One observer per node; it always talks to the node's *current* chart. */
  if (node.__novaResize) return;
  let last = Math.round(node.clientWidth || 0);
  let timer = 0;
  const redraw = () => {
    const current = instances.get(node);
    if (!current || !node.isConnected) return;
    const width = Math.round(node.clientWidth || 0);
    if (!width) return;
    const drawn = Math.round(current.w?.globals?.svgWidth ?? 0);
    /* Redraw when the container changed, or when the SVG was laid out at a
       stale width (the «chart stays small until I click it» bug). */
    if (width === last && Math.abs(drawn - width) <= 2) return;
    last = width;
    try {
      current.updateOptions({ chart: { width: '100%' } }, true, false, false);
    } catch (error) {
      console.warn('[nova:charts] resize redraw failed', error);
    }
  };
  const observer = new ResizeObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(redraw, 60);
  });
  observer.observe(node);
  node.__novaResize = { observer, redraw };
}

/**
 * Charts drawn while the page is still settling (web fonts, sidebar width,
 * reveal animations, late stylesheets) can keep the width they measured at
 * that moment. A few passes after load re-measure every chart so they fill
 * their cards without the visitor having to click or resize anything.
 */
export function resyncCharts() {
  resyncSparklines();
  instances.forEach((chart, node) => {
    if (!node.isConnected) {
      instances.delete(node);
      return;
    }
    const width = Math.round(node.clientWidth || 0);
    const drawn = Math.round(chart.w?.globals?.svgWidth ?? 0);
    if (width && Math.abs(drawn - width) > 2) {
      try {
        chart.updateOptions({ chart: { width: '100%' } }, true, false, false);
      } catch {
        /* chart was destroyed mid-way */
      }
    }
  });
}

if (typeof window !== 'undefined') {
  // Eager pre-load ApexCharts on idle so chart rendering is instant
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => getApex(), { timeout: 1200 });
  } else {
    setTimeout(getApex, 150);
  }

  const passes = () => [100, 450].forEach((delay) => window.setTimeout(resyncCharts, delay));
  window.addEventListener('load', passes, { once: true });
  document.fonts?.ready?.then(() => window.setTimeout(resyncCharts, 50));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(resyncCharts, 80);
  });
  window.addEventListener('nova:layout', () => [60, 240].forEach((delay) => window.setTimeout(resyncCharts, delay)));
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

/* ============================================================== sparklines
   A 46px trend strip inside a KPI card used to cost a full ApexCharts
   instance: a canvas, an axis model, a tooltip engine, its own ResizeObserver
   and a slice of a 630 KB library to parse. The widget library alone carries
   eight of them, and every dashboard KPI row repeats that. They are drawn here
   as one inline SVG path instead — a fraction of the work, no canvas, and it
   re-themes with the same CSS tokens as the big charts.
   ======================================================================== */
/* A plain Map (not a WeakMap): these entries are walked on re-theme and on
   resize, and a WeakMap has no iterator. Disconnected nodes are dropped on the
   next pass, so nothing outlives its page. */
const sparks = new Map();

function sparkPoints(data, width, height, pad) {
  let min = Infinity;
  let max = -Infinity;
  data.forEach((value) => {
    if (value < min) min = value;
    if (value > max) max = value;
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const span = max - min || 1;
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  return data.map((value, index) => [pad + index * step, pad + (height - pad * 2) * (1 - (value - min) / span)]);
}

/** Quadratic smoothing — the same soft look as the area charts, no library. */
function smoothPath(points) {
  if (!points.length) return '';
  if (points.length < 3) return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    path += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${((cx + nx) / 2).toFixed(1)},${((cy + ny) / 2).toFixed(1)}`;
  }
  const last = points.at(-1);
  return `${path} L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
}

function drawSparkline(node, payload) {
  const data = (payload.series?.[0]?.data ?? []).map(Number).filter((value) => Number.isFinite(value));
  if (!data.length) {
    showState(node, 'chart--empty', '');
    return null;
  }
  const width = Math.max(80, Math.round(node.clientWidth || 220));
  const height = Math.max(24, Math.min(64, Number(payload.chart?.height) || 46));
  const points = sparkPoints(data, width, height, 4);
  const line = smoothPath(points);
  const area = `${line} L${(width - 4).toFixed(1)},${height} L4,${height} Z`;
  const colour = payload.colors?.[0] ?? '#6366f1';
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  const rtl = document.documentElement.getAttribute('dir') === 'rtl';
  node.innerHTML = `<svg class="spark-svg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"${rtl ? ' style="transform:scaleX(-1)"' : ''}>
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${colour}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${colour}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${id})" stroke="none"/>
      <path d="${line}" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
  sparks.set(node, { payload, width });
  node.dataset.chartReady = '1';
  return node.querySelector('svg');
}

/** Sparklines are width-bound: redraw only when the card actually changed. */
function resyncSparklines() {
  sparks.forEach((entry, node) => {
    if (!node.isConnected) {
      sparks.delete(node);
      return;
    }
    const width = Math.round(node.clientWidth || 0);
    if (!width || Math.abs(width - entry.width) < 2) return;
    drawSparkline(node, entry.payload);
  });
}

/**
 * Creates (or replaces) a chart on `node`.
 * @returns {Promise<Object|null>} the ApexCharts instance
 */
export async function createChart(node, options = {}) {
  if (!node) return null;
  /* Render token: two overlapping calls on one node (boot pass + controller)
     used to both finish and stack two charts in the same card. */
  const token = (node.__novaChartToken ?? 0) + 1;
  node.__novaChartToken = token;
  const existing = instances.get(node);
  if (existing) {
    try { existing.destroy(); } catch { /* already gone */ }
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
  /* Trend strips never touch the canvas library — see drawSparkline(). */
  if (payload.chart?.sparkline?.enabled) return drawSparkline(node, payload);
  try {
    const ApexCharts = await getApex();
    if (node.__novaChartToken !== token) return instances.get(node) ?? null;
    const previous = instances.get(node);
    if (previous) {
      try { previous.destroy(); } catch { /* ignore */ }
      instances.delete(node);
    }
    node.querySelectorAll(':scope > .apexcharts-canvas, :scope > div[id^="apexcharts"]').forEach((stale) => stale.remove());
    const chart = new ApexCharts(node, payload);
    instances.set(node, chart);
    await chart.render();
    if (node.__novaChartToken !== token) {
      try { chart.destroy(); } catch { /* ignore */ }
      if (instances.get(node) === chart) instances.delete(node);
      return instances.get(node) ?? null;
    }
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
    if (node.__novaChartToken !== token) return instances.get(node) ?? null;
    instances.delete(node);
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
/**
 * Hands the main thread back to the browser between charts. A dashboard with
 * fourteen charts used to draw all of them inside one task — a 1.2 s block on
 * a throttled phone, during which taps and scrolling were frozen. One chart per
 * idle slot keeps the page interactive while the same charts fill in.
 */
const breathe = () =>
  new Promise((resolve) => {
    /* A frame *plus* an idle slot: the idle callback alone can fire back to
       back while the browser is busy (that is what its `timeout` means), which
       stacked four canvases into a single 800 ms task on a throttled phone.
       Waiting for a frame first bounds the work to one chart per task. */
    const idle = () => {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: 200 });
      else window.setTimeout(resolve, 0);
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(idle);
    else idle();
  });

/**
 * Charts are drawn nearest-first and off-screen ones wait for the scroll that
 * brings them in. A phone used to pay for every chart on the page before the
 * visitor saw the second card — the dashboard blocked for over a second while
 * twelve canvases were laid out below the fold. One shared observer (not one
 * per chart) hands a node over as soon as it is within a screen and a half.
 */
const queued = new Set();
/** Nodes handed to the lazy path but not drawn yet — `settlePendingCharts`
 *  must not declare them empty while they are still waiting for the scroll. */
const scheduled = new Set();
let draining = false;
let chartObserver = null;

function chartQueue() {
  if (chartObserver || typeof IntersectionObserver === 'undefined') return chartObserver;
  chartObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        chartObserver.unobserve(entry.target);
        queued.add(entry.target);
      });
      drainQueue();
    },
    /* A screen and a half of slack: the chart is ready before it is centred. */
    { rootMargin: '600px 0px' },
  );
  return chartObserver;
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  while (queued.size) {
    const node = queued.values().next().value;
    queued.delete(node);
    if (!node.isConnected) {
      scheduled.delete(node);
      continue;
    }
    if (node.dataset.chartReady === '1' || node.__novaChartToken) {
      scheduled.delete(node);
      continue;
    }
    await createChart(node);
    scheduled.delete(node);
    if (queued.size) await breathe();
  }
  draining = false;
}

export async function initCharts(root = document) {
  const candidates = $$('[data-chart]', root).filter(
    (node) => node.dataset.chartReady !== '1' && node.dataset.chartOwner !== 'controller' && !node.__novaChartToken,
  );
  const viewportH = window.innerHeight || 800;
  const near = (node) => {
    const rect = node.getBoundingClientRect();
    return rect.bottom > -viewportH * 1.5 && rect.top < viewportH * 2;
  };
  const first = candidates.filter(near);
  const rest = candidates.filter((node) => !first.includes(node));
  for (let index = 0; index < first.length; index += 1) {
    if (index) await breathe();
    await createChart(first[index]);
  }
  if (rest.length) {
    rest.forEach((node) => scheduled.add(node));
    const observer = chartQueue();
    if (observer) {
      rest.forEach((node) => observer.observe(node));
      /* Nothing may stay blank forever: if the visitor never scrolls, the
         remaining charts still arrive one idle slot at a time. */
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
          rest.forEach((node) => observer.unobserve(node));
          rest.forEach((node) => queued.add(node));
          drainQueue();
        }, { timeout: 4000 });
      } else {
        rest.forEach((node) => queued.add(node));
        drainQueue();
      }
    } else {
      rest.forEach((node) => queued.add(node));
      drainQueue();
    }
  }
  return candidates.length;
}

/**
 * Renders a "no data yet" state on every controller-owned placeholder that no
 * controller filled (an unhandled chart key, a failed request). Called after
 * the page controllers have run so nothing is drawn twice.
 */
export function settlePendingCharts(root = document) {
  $$('[data-chart-key]', root)
    .filter((node) => node.dataset.chartReady !== '1' && !instances.has(node) && !scheduled.has(node))
    .forEach((node) => showState(node, 'chart--empty', t('common.noData')));
}

/** Re-themes existing charts after theme/colour/direction changes. */
export function refreshCharts() {
  invalidateTokenCache();
  instances.forEach(async (chart, node) => {
    try {
      await chart.updateOptions(buildOptions(lastPayload.get(node) ?? payloadFromNode(node)), false, true);
    } catch (error) {
      console.warn('[nova:charts] refresh failed', error);
    }
  });
  /* Sparklines read the palette from `payload.colors`, so a theme change (or a
     dir flip) has to repaint them too. */
  sparks.forEach((entry, node) => {
    if (!node.isConnected) {
      sparks.delete(node);
      return;
    }
    const next = buildOptions(lastPayload.get(node) ?? entry.payload);
    drawSparkline(node, next);
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
    sparks.delete(node);
  },
  instances,
};

bus.on(EVENTS.theme, refreshCharts);
bus.on(EVENTS.primary, refreshCharts);
bus.on(EVENTS.direction, refreshCharts);
bus.on(EVENTS.language, refreshCharts);
on(window, 'nova:appearance', refreshCharts);

export default charts;
