/**
 * NOVAADMIN — Analytics & reporting service
 * ------------------------------------------------------------------
 * Feeds the ten dashboards and every page under `/reports/*`.
 * All series honour the `range` query (`today|yesterday|7d|30d|3m|6m|12m|custom`)
 * so the header range-picker works identically on every chart.
 */
import { call } from './client.js';
import { kpis, makeSeries, makeMultiSeries, trafficSources, devices, browsingBrowsers, topPages, funnel, geo, cohorts, goals, planDistribution, churnReasons, aiUsageByModel, TIME_RANGES, jalaliMonths, weekDays } from '../data/analytics.js';
import { orders, products, categories } from '../data/commerce.js';
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
      resolver: () => buildReport(name, range),
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

/* ------------------------------------------------------------------- reports */

/**
 * Every page under `/reports/*` consumes one flat contract instead of eight
 * different shapes: `title`, `series`, `breakdown`, `summary`, `rows` and
 * `totals`. Keeping the contract in the service (not in the page) means a real
 * backend only has to answer this one shape.
 */
const REPORT_META = {
  sales: { title: 'گزارش فروش', icon: 'bag-check', chart: 'area', text: 'سفارش‌ها، درآمد و وضعیت پرداخت به تفکیک بازه زمانی' },
  revenue: { title: 'گزارش درآمد', icon: 'currency-dollar', chart: 'area', text: 'درآمد در برابر هدف، با تفکیک منبع ترافیک' },
  customers: { title: 'گزارش مشتریان', icon: 'people', chart: 'column', text: 'ارزش طول عمر، بخش‌بندی و ترتیب ورود مشتریان' },
  products: { title: 'گزارش محصولات', icon: 'box-seam', chart: 'bar', text: 'پرفروش‌ترین محصول‌ها و سهم دسته‌بندی‌ها' },
  finance: { title: 'گزارش مالی', icon: 'cash-stack', chart: 'area', text: 'ورودی، خروجی و مانده نقدی به تفکیک حساب' },
  performance: { title: 'گزارش عملکرد', icon: 'speedometer2', chart: 'line', text: 'سلامت پروژه‌ها، سرعت تیم و توزیع وضعیت تسک‌ها' },
  traffic: { title: 'گزارش ترافیک', icon: 'graph-up-arrow', chart: 'area', text: 'نشست‌ها، منابع ورودی و پربازدیدترین صفحه‌ها' },
  support: { title: 'گزارش پشتیبانی', icon: 'life-preserver', chart: 'column', text: 'حجم تیکت‌ها، رعایت SLA و رضایت مشتریان' },
  logistics: { title: 'گزارش لجستیک', icon: 'truck', chart: 'bar', text: 'محموله‌ها، تحویل به‌موقع و وضعیت مسیرها' },
};

/** Month index (1..12) of an ISO date in the Persian calendar. */
function jalaliMonthIndex(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const number = new Intl.DateTimeFormat('en-US-u-ca-persian', { month: 'numeric' }).format(date);
    const index = Number(String(number).replace(/[^0-9]/g, ''));
    return index >= 1 && index <= 12 ? index : null;
  } catch {
    return null;
  }
}

/** Sums `items` into the 12 Jalali months — real buckets, no invented curve. */
function byJalaliMonth(items, dateKey, valueKey) {
  const buckets = jalaliMonths.map((label) => ({ label, value: 0 }));
  items.forEach((item) => {
    const index = jalaliMonthIndex(item?.[dateKey]);
    if (!index) return;
    buckets[index - 1].value += Number(item?.[valueKey] ?? 1) || 0;
  });
  return buckets;
}

/** Counts of a grouping key, largest first — used for every donut breakdown. */
function tally(items, key, labelKey) {
  const map = new Map();
  items.forEach((item) => {
    const label = (labelKey ? item?.[labelKey] : item?.[key]) ?? item?.[key] ?? '—';
    const text = String(label);
    map.set(text, (map.get(text) ?? 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function buildReport(name, range) {
  const meta = REPORT_META[name] ?? REPORT_META.logistics;
  const base = {
    name,
    title: meta.title,
    text: meta.text,
    icon: meta.icon,
    chartType: meta.chart,
    range,
    generatedAt: new Date().toISOString(),
  };
  const seriesFor = (opts, offset = 0) => {
    const trend = makeSeries(range, opts);
    const target = makeSeries(range, { ...opts, min: (opts.min ?? 40) * 1.08, seedOffset: (opts.seedOffset ?? 1) + offset + 3 });
    return { labels: trend.labels, series: [{ name: 'واقعی', data: trend.data }, { name: 'هدف', data: target.data, dashed: true }] };
  };
  const tableFrom = (rows, columns) => ({ rows: rows.slice(0, 30), columns });

  switch (name) {
    case 'sales': {
      const months = byJalaliMonth(orders, 'placedAt', 'total');
      const revenue = orders.reduce((sum, order) => sum + order.total, 0);
      return {
        ...base,
        labels: months.map((row) => row.label),
        series: [{ name: 'درآمد', data: months.map((row) => row.value) }],
        breakdown: tally(orders, 'statusLabel'),
        totals: {
          revenue,
          orders: orders.length,
          average: orders.length ? Math.round(revenue / orders.length) : 0,
          returns: orders.filter((order) => order.status === 'refunded').length,
        },
        ...tableFrom(
          orders.map((order) => ({ id: order.id, date: order.placedAt, customer: order.customer, items: order.itemsCount, total: order.total, status: order.statusLabel, payment: order.payment })),
          [
            { key: 'id', label: 'شماره سفارش' },
            { key: 'date', label: 'تاریخ', type: 'date' },
            { key: 'customer', label: 'مشتری' },
            { key: 'items', label: 'اقلام', type: 'number' },
            { key: 'total', label: 'مبلغ', type: 'currency' },
            { key: 'status', label: 'وضعیت', type: 'badge' },
            { key: 'payment', label: 'پرداخت' },
          ],
        ),
      };
    }
    case 'revenue': {
      const trend = seriesFor({ min: 1_600, max: 4_400, growth: 0.26 }, 1);
      return {
        ...base,
        ...trend,
        breakdown: trafficSources.map((row) => ({ label: row.label, value: row.value ?? row.percent ?? 0 })),
        totals: { revenue: trend.series[0].data.reduce((a, b) => a + b, 0), target: trend.series[1].data.reduce((a, b) => a + b, 0), best: Math.max(...trend.series[0].data) },
        ...tableFrom(
          trend.labels.map((label, index) => ({
            period: label,
            actual: trend.series[0].data[index],
            target: trend.series[1].data[index],
            gap: trend.series[0].data[index] - trend.series[1].data[index],
            rate: Math.round((trend.series[0].data[index] / Math.max(1, trend.series[1].data[index])) * 100),
          })),
          [
            { key: 'period', label: 'دوره' },
            { key: 'actual', label: 'درآمد واقعی', type: 'currency' },
            { key: 'target', label: 'هدف', type: 'currency' },
            { key: 'gap', label: 'اختلاف', type: 'delta' },
            { key: 'rate', label: 'درصد تحقق', type: 'percent' },
          ],
        ),
      };
    }
    case 'customers': {
      const months = byJalaliMonth(customers, 'since', 'orders');
      return {
        ...base,
        labels: months.map((row) => row.label),
        series: [{ name: 'سفارش‌های ثبت‌شده', data: months.map((row) => row.value) }],
        breakdown: tally(customers, 'segment'),
        totals: {
          customers: customers.length,
          new: months.reduce((sum, row, index) => (index >= 9 ? sum + row.value : sum), 0),
          ltv: customers.length ? Math.round(customers.reduce((sum, row) => sum + row.totalSpend, 0) / customers.length) : 0,
          churn: 2.4,
        },
        ...tableFrom(
          customers.map((customer) => ({ id: customer.id, company: customer.company, segment: customer.segment, orders: customer.orders, spend: customer.totalSpend, satisfaction: customer.satisfaction, since: customer.since })),
          [
            { key: 'company', label: 'شرکت' },
            { key: 'segment', label: 'بخش', type: 'badge' },
            { key: 'orders', label: 'سفارش', type: 'number' },
            { key: 'spend', label: 'ارزش کل', type: 'currency' },
            { key: 'satisfaction', label: 'رضایت', type: 'percent' },
            { key: 'since', label: 'عضویت', type: 'date' },
          ],
        ),
      };
    }
    case 'products': {
      const sold = products.reduce((sum, product) => sum + (product.sold ?? 0), 0);
      return {
        ...base,
        ...seriesFor({ min: 220, max: 880, growth: 0.18 }, 2),
        breakdown: (categories ?? []).slice(0, 6).map((category, index) => ({ label: category.name ?? category.label ?? `دسته ${index + 1}`, value: products.filter((product) => product.categoryId === category.id || product.category === category.name || product.category === category.slug).length || 1 })),
        totals: { products: products.length, sold, stock: products.reduce((sum, product) => sum + (product.stock ?? 0), 0), outOfStock: products.filter((product) => (product.stock ?? 0) <= 0).length },
        ...tableFrom(
          [...products]
            .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
            .map((product) => ({ name: product.name, sku: product.sku ?? product.id, price: product.price, sold: product.sold ?? 0, stock: product.stock ?? 0, status: product.statusLabel ?? product.status })),
          [
            { key: 'name', label: 'محصول' },
            { key: 'sku', label: 'کد کالا' },
            { key: 'price', label: 'قیمت', type: 'currency' },
            { key: 'sold', label: 'فروش', type: 'number' },
            { key: 'stock', label: 'موجودی', type: 'number' },
            { key: 'status', label: 'وضعیت', type: 'badge' },
          ],
        ),
      };
    }
    case 'finance': {
      const months = byJalaliMonth(transactions, 'at', 'amount');
      const inflow = transactions.filter((row) => row.direction === 'in').reduce((sum, row) => sum + row.amount, 0);
      const outflow = Math.abs(transactions.filter((row) => row.direction === 'out').reduce((sum, row) => sum + row.amount, 0));
      return {
        ...base,
        labels: months.map((row) => row.label),
        series: [{ name: 'حرکت نقدینگی', data: months.map((row) => row.value) }],
        breakdown: tally(transactions, 'categoryLabel') .length ? tally(transactions, 'categoryLabel') : tally(transactions, 'status'),
        totals: { inflow, outflow, net: inflow - outflow, fee: 486_000_000 },
        ...tableFrom(
          transactions.map((row) => ({ id: row.id, reference: row.reference, counterparty: row.counterparty, amount: row.amount, direction: row.direction === 'in' ? 'واریز' : 'برداشت', status: row.statusLabel ?? row.status, at: row.at })),
          [
            { key: 'reference', label: 'رسید' },
            { key: 'counterparty', label: 'طرف حساب' },
            { key: 'amount', label: 'مبلغ', type: 'currency' },
            { key: 'direction', label: 'نوع', type: 'badge' },
            { key: 'status', label: 'وضعیت', type: 'badge' },
            { key: 'at', label: 'تاریخ', type: 'date' },
          ],
        ),
      };
    }
    case 'performance': {
      const velocity = makeSeries(range, { min: 24, max: 62, growth: 0.12 });
      return {
        ...base,
        labels: velocity.labels,
        series: [{ name: 'سرعت تیم (امتیاز)', data: velocity.data }],
        breakdown: tally(tasks, 'statusLabel'),
        totals: {
          projects: projects.length,
          onTrack: projects.filter((project) => project.health === 'on-track' || project.health === 'green').length,
          atRisk: projects.filter((project) => project.health === 'at-risk' || project.health === 'amber').length,
          avgProgress: projects.length ? Math.round(projects.reduce((sum, project) => sum + (project.progress ?? 0), 0) / projects.length) : 0,
        },
        ...tableFrom(
          projects.map((project) => ({ name: project.name, team: project.team ?? '—', progress: project.progress ?? 0, tasks: tasks.filter((task) => task.projectId === project.id).length, health: project.healthLabel ?? project.health, due: project.dueDate ?? project.endDate })),
          [
            { key: 'name', label: 'پروژه' },
            { key: 'team', label: 'تیم' },
            { key: 'tasks', label: 'تسک‌ها', type: 'number' },
            { key: 'progress', label: 'پیشرفت', type: 'percent' },
            { key: 'health', label: 'سلامت', type: 'badge' },
            { key: 'due', label: 'مهلت', type: 'date' },
          ],
        ),
      };
    }
    case 'traffic': {
      const sessions = makeSeries(range, { min: 640, max: 2_400 });
      return {
        ...base,
        labels: sessions.labels,
        series: [{ name: 'نشست‌ها', data: sessions.data }],
        breakdown: devices.map((row) => ({ label: row.label, value: row.value ?? row.percent ?? 0 })),
        totals: { sessions: sessions.total, peak: Math.max(...sessions.data), pages: topPages.length, bounce: 38.4 },
        ...tableFrom(
          topPages.map((page) => ({ path: page.path ?? page.title, views: page.views ?? page.value, visitors: Math.round((page.views ?? page.value ?? 0) * 0.72), time: page.avgTime ?? page.time ?? '۰۱:۴۸', share: page.percent ?? 0 })),
          [
            { key: 'path', label: 'صفحه' },
            { key: 'views', label: 'بازدید', type: 'number' },
            { key: 'visitors', label: 'بازدید یکتا', type: 'number' },
            { key: 'time', label: 'میانگین زمان' },
            { key: 'share', label: 'سهم', type: 'percent' },
          ],
        ),
      };
    }
    case 'support': {
      const months = byJalaliMonth(tickets, 'createdAt');
      return {
        ...base,
        labels: months.map((row) => row.label),
        series: [{ name: 'تیکت‌ها', data: months.map((row) => row.value) }],
        breakdown: tally(tickets, 'priorityLabel'),
        totals: {
          volume: tickets.length,
          open: tickets.filter((ticket) => ticket.status === 'open').length,
          breach: tickets.filter((ticket) => ticket.slaBreach).length,
          csat: 94.6,
        },
        ...tableFrom(
          tickets.map((ticket) => ({ number: ticket.number, subject: ticket.subject, customer: ticket.customer, priority: ticket.priorityLabel, status: ticket.statusLabel, agent: ticket.agent, at: ticket.createdAt })),
          [
            { key: 'number', label: 'شماره' },
            { key: 'subject', label: 'موضوع' },
            { key: 'customer', label: 'مشتری' },
            { key: 'priority', label: 'اولویت', type: 'badge' },
            { key: 'status', label: 'وضعیت', type: 'badge' },
            { key: 'agent', label: 'کارشناس' },
            { key: 'at', label: 'ثبت', type: 'date' },
          ],
        ),
      };
    }
    default: {
      const months = byJalaliMonth(shipments, 'shippedAt');
      return {
        ...base,
        labels: months.map((row) => row.label),
        series: [{ name: 'محموله', data: months.map((row) => row.value) }],
        breakdown: tally(shipments, 'statusLabel'),
        totals: {
          shipments: shipments.length,
          delivered: shipments.filter((shipment) => shipment.status === 'delivered').length,
          delayed: shipments.filter((shipment) => shipment.status === 'delayed').length,
          onTime: shipments.length ? Math.round((shipments.filter((shipment) => shipment.status === 'delivered').length / shipments.length) * 100) : 0,
        },
        ...tableFrom(
          shipments.map((shipment) => ({ id: shipment.id, tracking: shipment.tracking, destination: shipment.destination, carrier: shipment.carrier, status: shipment.statusLabel, at: shipment.shippedAt })),
          [
            { key: 'tracking', label: 'کد رهگیری' },
            { key: 'destination', label: 'مقصد' },
            { key: 'carrier', label: 'شرکت باربری' },
            { key: 'status', label: 'وضعیت', type: 'badge' },
            { key: 'at', label: 'تاریخ ارسال', type: 'date' },
          ],
        ),
      };
    }
  }
}

export default analyticsService;
