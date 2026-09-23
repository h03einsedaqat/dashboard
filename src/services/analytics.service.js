/**
 * NOVAADMIN — Analytics & reporting service
 * ------------------------------------------------------------------
 * Feeds the ten dashboards and every page under `/reports/*`.
 * All series honour the `range` query (`today|yesterday|7d|30d|3m|6m|12m|custom`)
 * so the header range-picker works identically on every chart.
 */
import { call } from './client.js';
import { kpis, makeSeries, makeMultiSeries, trafficSources, devices, browsingBrowsers, topPages, funnel, geo, cohorts, goals, planDistribution, churnReasons, aiUsageByModel, TIME_RANGES, jalaliMonths, weekDays } from '../data/analytics.js';
import { orders } from '../data/commerce.js';
import { customers } from '../data/people.js';
import { tickets } from '../data/support.js';
import { projects, tasks } from '../data/projects.js';
import { shipments } from '../data/logistics.js';
import { transactions } from '../data/finance.js';

const rangeOf = (query = {}) => query.range ?? '30d';

export const analyticsService = {
  timeRanges: () => TIME_RANGES,

  /** KPI strip for one dashboard: `dashboardService.kpis('ecommerce', { range })`. */
  kpis(dashboard = 'analytics') {
    const set = kpis[dashboard] ?? kpis.analytics;
    return call('list', `analytics/${dashboard}/kpis`, {
      resolver: () => set.map((kpi) => ({ ...kpi, deltaLabel: `${kpi.delta > 0 ? '+' : ''}${kpi.delta}%` })),
    });
  },

  /** Revenue / volume chart used by most dashboards. */
  revenue(query = {}) {
    const range = rangeOf(query);
    return call('list', `analytics/revenue?range=${range}`, {
      resolver: () => {
        const revenue = makeSeries(range, { min: 1_200, max: 4_800, growth: 0.24, seedOffset: 1 });
        const orders = makeSeries(range, { min: 120, max: 520, growth: 0.18, seedOffset: 2 });
        const target = makeSeries(range, { min: 1_400, max: 5_200, growth: 0.14, seedOffset: 3 });
        return {
          range,
          labels: revenue.labels,
          series: [
            { id: 'revenue', label: 'درآمد', data: revenue.data, type: 'area' },
            { id: 'orders', label: 'سفارش‌ها', data: orders.data, type: 'column' },
            { id: 'target', label: 'هدف', data: target.data, type: 'line', dashed: true },
          ],
          total: revenue.total,
          orders: orders.total,
          target: target.total,
          growth: Number((((revenue.data.at(-1) - revenue.data[0]) / revenue.data[0]) * 100).toFixed(1)),
        };
      },
    });
  },

  traffic(query = {}) {
    return call('list', `analytics/traffic?range=${rangeOf(query)}`, {
      resolver: () => {
        const {
          labels, series: { visits, visitors, pageviews },
        } = makeMultiSeries(rangeOf(query), ['visits', 'visitors', 'pageviews'], { min: 800, max: 3_200 });
        return {
          labels,
          visits: visits.data,
          visitors: visitors.data,
          pageviews: pageviews.data,
          sources: trafficSources,
          devices,
          browsers: browsingBrowsers,
        };
      },
    });
  },

  audience(query = {}) {
    return call('list', `analytics/audience?range=${rangeOf(query)}`, {
      resolver: () => ({
        newUsers: makeSeries(rangeOf(query), { min: 180, max: 940, seedOffset: 4 }),
        returning: makeSeries(rangeOf(query), { min: 320, max: 1_400, seedOffset: 5 }),
        countries: geo,
        cohorts,
        topPages,
        devices,
      }),
    });
  },

  funnel() {
    return call('list', 'analytics/funnel', { resolver: () => funnel });
  },

  goals() {
    return call('list', 'analytics/goals', {
      resolver: () => goals.map((goal) => ({ ...goal, percent: Math.min(100, Number(((goal.current / goal.target) * 100).toFixed(1))) })),
    });
  },

  products(query = {}) {
    return call('list', `analytics/products?range=${rangeOf(query)}`, {
      resolver: () => ({
        top: [...orders]
          .flatMap((order) => order.items.map((item) => ({ ...item, orderTotal: item.price * item.qty })))
          .reduce((acc, item) => {
            const row = acc.get(item.id) ?? { id: item.id, name: item.name, image: item.image, sold: 0, revenue: 0 };
            row.sold += item.qty;
            row.revenue += item.orderTotal;
            acc.set(item.id, row);
            return acc;
          }, new Map())
          .values(),
        lowest: [],
      }),
    });
  },

  /** Generic report endpoint used by the eight `/reports/*` pages. */
  report(name, query = {}) {
    const range = rangeOf(query);
    return call('list', `analytics/reports/${name}?range=${range}`, {
      resolver: () => {
        const base = {
          range,
          generatedAt: new Date().toISOString(),
          labels: makeSeries(range, { min: 60, max: 240 }).labels,
        };
        switch (name) {
          case 'sales':
            return {
              ...base,
              rows: orders.slice(0, 30).map((o) => ({ id: o.id, date: o.placedAt, customer: o.customer, items: o.itemsCount, total: o.total, status: o.statusLabel, payment: o.payment })),
              totals: { revenue: orders.reduce((s, o) => s + o.total, 0), orders: orders.length, average: Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length), returns: orders.filter((o) => o.status === 'refunded').length },
            };
          case 'revenue':
            return { ...base, series: makeSeries(range, { min: 1_600, max: 4_400 }), bySource: trafficSources };
          case 'customers':
            return {
              ...base,
              rows: customers.slice(0, 30).map((c) => ({ id: c.id, company: c.company, segment: c.segment, orders: c.orders, spend: c.totalSpend, satisfaction: c.satisfaction, since: c.since })),
              totals: { customers: customers.length, new: 214, churn: 2.4, ltv: Math.round(customers.reduce((s, c) => s + c.totalSpend, 0) / customers.length) },
            };
          case 'products':
            return { ...base, byCategory: kpis.ecommerce ? makeSeries(range, { min: 220, max: 880 }) : null, usage: makeSeries(range, { min: 180, max: 720 }) };
          case 'finance':
            return {
              ...base,
              rows: transactions.slice(0, 30).map((t) => ({ id: t.id, reference: t.reference, counterparty: t.counterparty, amount: t.amount, status: t.status, at: t.at })),
              totals: { inflow: transactions.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0), outflow: Math.abs(transactions.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0)), fee: 486_000_000 },
            };
          case 'performance':
            return {
              ...base,
              projectHealth: projects.map((p) => ({ name: p.name, progress: p.progress, health: p.health, team: p.team })),
              tasksByStatus: tasks.reduce((acc, t) => {
                acc[t.statusLabel] = (acc[t.statusLabel] ?? 0) + 1;
                return acc;
              }, {}),
              velocity: makeSeries(range, { min: 24, max: 62 }),
            };
          case 'traffic':
            return { ...base, sources: trafficSources, devices, paths: topPages, sessions: makeSeries(range, { min: 640, max: 2_400 }) };
          case 'support':
            return {
              ...base,
              rows: tickets.slice(0, 25).map((t) => ({ id: t.id, number: t.number, subject: t.subject, customer: t.customer, status: t.statusLabel, priority: t.priorityLabel, agent: t.agent, at: t.createdAt })),
              totals: { open: tickets.filter((t) => t.status === 'open').length, csat: 94.6, breach: tickets.filter((t) => t.slaBreach).length, volume: tickets.length },
            };
          default:
            return {
              ...base,
              series: makeSeries(range, { min: 80, max: 320 }),
              rows: shipments.slice(0, 20).map((s) => ({ id: s.id, tracking: s.tracking, destination: s.destination, status: s.statusLabel, carrier: s.carrier, at: s.shippedAt })),
              totals: { shipments: shipments.length, delivered: shipments.filter((s) => s.status === 'delivered').length, delayed: shipments.filter((s) => s.status === 'delayed').length },
            };
        }
      },
    });
  },

  saas(query = {}) {
    return call('list', `analytics/saas?range=${rangeOf(query)}`, {
      resolver: () => ({
        mrr: makeSeries(rangeOf(query), { min: 800, max: 1_900, growth: 0.3, seedOffset: 6 }),
        churn: makeSeries(rangeOf(query), { min: 12, max: 68, growth: -0.2, seedOffset: 7 }),
        plans: planDistribution,
        reasons: churnReasons,
        cohorts,
      }),
    });
  },

  ai() {
    return call('list', 'analytics/ai', {
      resolver: () => ({
        byModel: aiUsageByModel,
        tokens: makeSeries('30d', { min: 420_000, max: 3_600_000, growth: 0.4, seedOffset: 8 }),
        cost: makeSeries('30d', { min: 18, max: 140, growth: 0.28, seedOffset: 9 }),
      }),
    });
  },

  /** Shared calendar helpers so charts never hard-code Persian month names. */
  meta: () => ({ months: jalaliMonths, weekDays, ranges: TIME_RANGES }),
};

export default analyticsService;
