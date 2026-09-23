/**
 * NOVAADMIN — dashboard controllers
 * ------------------------------------------------------------------
 * One controller drives all ten specialised dashboards. Markup stays
 * declarative so a dashboard is pure HTML plus a few hooks:
 *
 *   <div data-dashboard="ecommerce" data-range="30d">
 *     <div data-kpi-strip></div>            ← filled from analyticsService
 *     <div class="widget-grid" data-widget-grid>
 *       <div data-widget="revenue" data-chart="area" data-chart-key="revenue"></div>
 *     </div>
 *   </div>
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { formatCurrency, formatNumber, formatPercent, toDigits } from '../core/numbers.js';
import { createChart, chartColors, refreshCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import { analyticsService } from '../../services/index.js';

const dashboards = new WeakMap();

export async function initDashboard(root = document) {
  const node = $('[data-dashboard]', root);
  if (!node || dashboards.has(node)) return dashboards.get(node);

  const slug = node.dataset.dashboard ?? 'analytics';
  const instance = { node, slug, range: node.dataset.range ?? '30d', charts: [] };
  dashboards.set(node, instance);

  await Promise.all([paintKpis(instance), paintCharts(instance)]);
  bindRange(instance);
  bindRefresh(instance);
  return instance;
}

async function paintKpis(instance) {
  const strip = $('[data-kpi-strip]', instance.node);
  if (!strip) return;
  const kpis = await analyticsService.kpis(instance.slug);
  render(
    strip,
    kpis
      .map(
        (kpi) => `<article class="stat-card stat-card--${kpi.tone}${kpi.tone === 'primary' ? '' : ''}" data-widget="${kpi.id}" data-widget-title="${escapeHtml(kpi.label)}" data-reveal>
          <div class="stat-card__head">
            <span class="stat-card__label">${escapeHtml(kpi.label)}</span>
            <span class="stat-card__icon stat-card__icon--${kpi.tone}"><i class="bi bi-${escapeHtml(kpi.icon ?? 'graph-up')}" aria-hidden="true"></i></span>
          </div>
          <p class="stat-card__value">${formatKpi(kpi)}</p>
          <div class="stat-card__meta">
            <span class="trend trend--${kpi.delta > 0 ? 'up' : kpi.delta < 0 ? 'down' : 'flat'}">
              <i class="bi bi-arrow-${kpi.delta > 0 ? 'up' : kpi.delta < 0 ? 'down' : 'right'}-short" aria-hidden="true"></i>
              ${escapeHtml(formatPercent(Math.abs(kpi.delta), { decimals: 1 }))}
            </span>
            <span>نسبت به دوره قبل</span>
          </div>
          ${kpi.spark ? `<div class="stat-card__spark" data-chart="sparkline" data-chart-height="46" data-chart-series='${JSON.stringify([{ name: kpi.label, data: kpi.spark }])}'></div>` : ''}
        </article>`,
      )
      .join(''),
  );
  await import('../core/charts.js').then(({ initCharts }) => initCharts(strip));
}

function formatKpi(kpi) {
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

async function paintCharts(instance) {
  const nodes = $$('[data-chart-key], [data-dashboard-chart]', instance.node);
  if (!nodes.length) return;
  const data = await collectSeries(instance);

  for (const node of nodes) {
    const key = node.dataset.chartKey ?? node.dataset.dashboardChart;
    const payload = data[key];
    if (!payload) continue;
    const chart = await createChart(node, {
      type: node.dataset.chart ?? payload.type ?? 'area',
      series: payload.series,
      labels: payload.labels,
      height: Number(node.dataset.chartHeight ?? 320),
      colors: payload.colors,
      extra: payload.extra ?? {},
    });
    instance.charts.push(chart);
    node.dataset.chartReady = '1';
  }
}

async function collectSeries(instance) {
  const { slug, range } = instance;
  const revenue = await analyticsService.revenue({ range });
  const traffic = await analyticsService.traffic({ range });
  const base = {
    revenue: {
      type: 'area',
      series: revenue.series.filter((s) => s.id !== 'target').map((s) => ({ name: s.label, data: s.data, type: s.type === 'column' ? 'column' : 'area' })),
      labels: revenue.labels,
      colors: chartColors(2),
    },
    orders: {
      type: 'column',
      series: [{ name: 'سفارش‌ها', data: revenue.series.find((s) => s.id === 'orders')?.data ?? [] }],
      labels: revenue.labels,
    },
    target: {
      type: 'area',
      series: [{ name: 'هدف', data: revenue.series.find((s) => s.id === 'target')?.data ?? [] }, { name: 'واقعی', data: revenue.series.find((s) => s.id === 'revenue')?.data ?? [] }],
      labels: revenue.labels,
    },
    traffic: {
      type: 'area',
      series: [
        { name: 'بازدید', data: traffic.visits },
        { name: 'کاربر یکتا', data: traffic.visitors },
      ],
      labels: traffic.labels,
    },
    sources: {
      type: 'donut',
      series: traffic.sources.map((source) => source.value),
      labels: traffic.sources.map((source) => source.label),
    },
    devices: {
      type: 'donut',
      series: traffic.devices.map((device) => device.value),
      labels: traffic.devices.map((device) => device.label),
    },
  };

  const extra = await extraSeries(slug, range);
  return { ...base, ...extra };
}

/** Per-dashboard extras so each of the ten dashboards feels distinct. */
async function extraSeries(slug, range) {
  switch (slug) {
    case 'saas': {
      const saas = await analyticsService.saas({ range });
      return {
        mrr: { type: 'area', series: [{ name: 'MRR', data: saas.mrr.data }], labels: saas.mrr.labels },
        churn: { type: 'column', series: [{ name: 'ریزش', data: saas.churn.data }], labels: saas.churn.labels },
        plans: { type: 'donut', series: saas.plans.map((p) => p.value), labels: saas.plans.map((p) => p.label) },
        reasons: { type: 'bar', series: [{ name: 'دلایل ریزش', data: saas.reasons.map((r) => r.value) }], labels: saas.reasons.map((r) => r.label) },
      };
    }
    case 'ai': {
      const ai = await analyticsService.ai();
      return {
        tokens: { type: 'area', series: [{ name: 'توکن مصرفی', data: ai.tokens.data }], labels: ai.tokens.labels },
        models: { type: 'donut', series: ai.byModel.map((m) => m.requests), labels: ai.byModel.map((m) => m.label) },
        cost: { type: 'column', series: [{ name: 'هزینه', data: ai.cost.data }], labels: ai.cost.labels },
      };
    }
    case 'analytics':
    case 'ecommerce':
    case 'crm':
    case 'finance':
    case 'projects':
    case 'hr':
    case 'support':
    case 'logistics': {
      const report = await analyticsService.report(slug, { range });
      const seriesData = report.series?.data ?? report.velocity?.data ?? [];
      return {
        secondary: { type: 'column', series: [{ name: 'مقدار', data: seriesData.slice(0, 12) }], labels: (report.labels ?? []).slice(0, 12) },
        funnel: report.funnel
          ? { type: 'bar', series: [{ name: 'نسبت', data: report.funnel.map((step) => step.percent) }], labels: report.funnel.map((step) => step.label) }
          : null,
      };
    }
    default:
      return {};
  }
}

function bindRange(instance) {
  on(instance.node, 'click', (event) => {
    const preset = event.target.closest('[data-range-preset]');
    if (!preset) return;
    instance.range = preset.dataset.rangePreset;
    $$('[data-range-preset]', instance.node).forEach((node) => node.classList.toggle('is-active', node === preset));
    const label = $('[data-range-label]', instance.node);
    if (label) label.textContent = preset.dataset.rangeLabel ?? preset.textContent.trim();
    instance.charts.forEach((chart) => chart.destroy());
    instance.charts = [];
    paintCharts(instance);
    toast.info('بازه زمانی تغییر کرد', 'نمودارها با بازه جدید بازسازی شدند.');
  });
}

function bindRefresh(instance) {
  on(instance.node, 'click', async (event) => {
    if (!event.target.closest('[data-dashboard-refresh]')) return;
    const button = event.target.closest('[data-dashboard-refresh]');
    button.classList.add('is-loading');
    try {
      await paintKpis(instance);
      refreshCharts();
      toast.success('داشبورد به‌روزرسانی شد', 'آخرین داده‌ها بارگذاری شد.');
    } finally {
      button.classList.remove('is-loading');
    }
  });
}

/** Fills `[data-datatable]` widgets embedded in a dashboard body. */
export function initDashboardTables(root = document) {
  return $$('[data-dashboard] [data-datatable]', root).map((node) => createDataTable(node));
}

bus.on(EVENTS.range, ({ range }) => {
  document.querySelectorAll('[data-dashboard]').forEach((node) => {
    const instance = dashboards.get(node);
    if (instance) instance.range = range;
  });
});

export const dashboard = { init: initDashboard, tables: initDashboardTables };
export default dashboard;
