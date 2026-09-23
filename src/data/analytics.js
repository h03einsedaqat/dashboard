/**
 * NOVAADMIN — Analytics demo data
 * ------------------------------------------------------------------
 * Powers the ten dashboards. Every series is generated from the design-token
 * aware helpers in `rng.js`, so numbers stay stable between reloads and charts
 * always have believable shapes (weekly seasonality + gentle growth).
 */
import { makeHelpers } from './rng.js';

const { int, float, pick, picks } = makeHelpers(9009);

export const jalaliMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export const TIME_RANGES = [
  { id: 'today', label: 'امروز', fa: 'امروز' },
  { id: 'yesterday', label: 'دیروز', fa: 'دیروز' },
  { id: '7d', label: '۷ روز گذشته', fa: '۷ روز گذشته' },
  { id: '30d', label: '۳۰ روز گذشته', fa: '۳۰ روز گذشته' },
  { id: '3m', label: '۳ ماه گذشته', fa: '۳ ماه گذشته' },
  { id: '6m', label: '۶ ماه گذشته', fa: '۶ ماه گذشته' },
  { id: '12m', label: 'امسال', fa: 'امسال' },
  { id: 'custom', label: 'بازه دلخواه', fa: 'بازه دلخواه' },
];

const RANGE_SPEC = {
  today: { points: 12, step: 'hour' },
  yesterday: { points: 12, step: 'hour' },
  '7d': { points: 7, step: 'day' },
  '30d': { points: 30, step: 'day' },
  '3m': { points: 12, step: 'week' },
  '6m': { points: 6, step: 'month' },
  '12m': { points: 12, step: 'month' },
  custom: { points: 30, step: 'day' },
};

function labelsFor(spec) {
  if (spec.step === 'hour') {
    return Array.from({ length: spec.points }, (_, i) => `${String((i * 2) % 24).padStart(2, '0')}:۰۰`);
  }
  if (spec.step === 'day') {
    const today = new Date();
    const out = [];
    for (let i = spec.points - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }
    return out;
  }
  if (spec.step === 'week') {
    return Array.from({ length: spec.points }, (_, i) => `هفته ${i + 1}`);
  }
  return jalaliMonths.slice(0, spec.points);
}

export function makeSeries(range = '30d', { min = 40, max = 220, growth = 0.22, noise = 0.16, seedOffset = 1 } = {}) {
  const spec = RANGE_SPEC[range] ?? RANGE_SPEC['30d'];
  const labels = labelsFor(spec);
  const weekendBoost = spec.step === 'day' ? 0.72 : 1;
  const base = (min + max) / 2;
  const data = labels.map((_, i) => {
    const progress = i / Math.max(1, labels.length - 1);
    const trend = base * (1 + growth * progress);
    const seasonal = spec.step === 'day' ? (i % 7 >= 5 ? weekendBoost : 1.06) : 1;
    const wobble = 1 + (Math.sin((i + seedOffset) * 1.7) * noise) / 2;
    return Math.round(trend * seasonal * wobble);
  });
  return { labels, data, total: data.reduce((a, b) => a + b, 0) };
}

export function makeMultiSeries(range, keys, opts = {}) {
  const spec = RANGE_SPEC[range] ?? RANGE_SPEC['30d'];
  const labels = labelsFor(spec);
  const base = Object.fromEntries(
    keys.map((k, i) => [k, makeSeries(range, { ...opts, seedOffset: i + 2, min: (opts.min ?? 40) * (1 + i * 0.3), max: (opts.max ?? 220) * (1 + i * 0.3) })]),
  );
  return { labels, series: base, points: spec.points };
}

export const sparkline = (seedOffset = 3, length = 14, min = 12, max = 60) => {
  const r = makeSeries('30d', { min, max, growth: 0.18, seedOffset });
  return r.data.slice(-length);
};

/* ------------------------------------------------------------------ KPI sets */
export const kpis = {
  analytics: [
    { id: 'revenue', label: 'درآمد کل', value: 18_640_000_000, unit: 'currency', delta: 12.4, tone: 'primary', icon: 'currency-dollar', spark: sparkline(1) },
    { id: 'orders', label: 'سفارش‌ها', value: 3_482, unit: 'number', delta: 8.1, tone: 'success', icon: 'bag-check', spark: sparkline(2) },
    { id: 'users', label: 'کاربران فعال', value: 92_410, unit: 'number', delta: 5.6, tone: 'info', icon: 'people', spark: sparkline(3) },
    { id: 'sessions', label: 'نشست‌ها', value: 248_930, unit: 'number', delta: -2.3, tone: 'warning', icon: 'activity', spark: sparkline(4) },
    { id: 'conversion', label: 'نرخ تبدیل', value: 3.84, unit: 'percent', delta: 1.2, tone: 'success', icon: 'funnel', spark: sparkline(5) },
    { id: 'profit', label: 'سود خالص', value: 6_920_000_000, unit: 'currency', delta: 9.4, tone: 'primary', icon: 'graph-up-arrow', spark: sparkline(6) },
    { id: 'expenses', label: 'هزینه‌ها', value: 4_280_000_000, unit: 'currency', delta: -4.1, tone: 'danger', icon: 'cash-coin', spark: sparkline(7) },
    { id: 'growth', label: 'رشد ماهانه', value: 14.7, unit: 'percent', delta: 2.8, tone: 'violet', icon: 'rocket', spark: sparkline(8) },
  ],
  ecommerce: [
    { id: 'revenue', label: 'فروش امروز', value: 1_284_000_000, unit: 'currency', delta: 11.2, tone: 'primary', icon: 'cash-stack', spark: sparkline(1) },
    { id: 'orders', label: 'تعداد سفارش', value: 486, unit: 'number', delta: 6.4, tone: 'success', icon: 'receipt', spark: sparkline(2) },
    { id: 'aov', label: 'میانگین سبد', value: 2_640_000, unit: 'currency', delta: 3.1, tone: 'info', icon: 'graph-up', spark: sparkline(3) },
    { id: 'conversion', label: 'نرخ تبدیل', value: 4.12, unit: 'percent', delta: 0.6, tone: 'violet', icon: 'funnel', spark: sparkline(4) },
    { id: 'customers', label: 'مشتریان جدید', value: 214, unit: 'number', delta: 9.8, tone: 'success', icon: 'person-plus', spark: sparkline(5) },
    { id: 'products', label: 'محصولات فعال', value: 1_246, unit: 'number', delta: 1.4, tone: 'primary', icon: 'box-seam', spark: sparkline(6) },
    { id: 'stock', label: 'هشدار موجودی', value: 17, unit: 'number', delta: -12.5, tone: 'warning', icon: 'exclamation-triangle', spark: sparkline(7) },
    { id: 'returns', label: 'مرجوعی', value: 26, unit: 'number', delta: -3.2, tone: 'danger', icon: 'arrow-return-left', spark: sparkline(8) },
  ],
  crm: [
    { id: 'leads', label: 'سرنخ‌های جدید', value: 1_284, unit: 'number', delta: 15.2, tone: 'primary', icon: 'funnel', spark: sparkline(1) },
    { id: 'deals', label: 'معاملات فعال', value: 214, unit: 'number', delta: 6.7, tone: 'info', icon: 'briefcase', spark: sparkline(2) },
    { id: 'customers', label: 'مشتریان جدید', value: 96, unit: 'number', delta: 8.9, tone: 'success', icon: 'people', spark: sparkline(3) },
    { id: 'conversion', label: 'نرخ تبدیل', value: 22.4, unit: 'percent', delta: 2.1, tone: 'violet', icon: 'check2-circle', spark: sparkline(4) },
    { id: 'pipeline', label: 'ارزش قیف فروش', value: 84_600_000_000, unit: 'currency', delta: 12.8, tone: 'success', icon: 'diagram-3', spark: sparkline(5) },
    { id: 'won', label: 'معاملات برنده', value: 68, unit: 'number', delta: 4.2, tone: 'success', icon: 'trophy', spark: sparkline(6) },
    { id: 'cycle', label: 'طول چرخه فروش', value: 24, unit: 'day', delta: -6.4, tone: 'warning', icon: 'clock-history', spark: sparkline(7) },
    { id: 'calls', label: 'تماس‌های امروز', value: 148, unit: 'number', delta: 3.6, tone: 'info', icon: 'telephone', spark: sparkline(8) },
  ],
  saas: [
    { id: 'mrr', label: 'درآمد ماهانه (MRR)', value: 12_840_000_000, unit: 'currency', delta: 9.2, tone: 'primary', icon: 'arrow-repeat', spark: sparkline(1) },
    { id: 'arr', label: 'درآمد سالانه (ARR)', value: 154_080_000_000, unit: 'currency', delta: 21.4, tone: 'success', icon: 'graph-up-arrow', spark: sparkline(2) },
    { id: 'subscriptions', label: 'اشتراک‌های فعال', value: 3_842, unit: 'number', delta: 5.8, tone: 'info', icon: 'credit-card-2-front', spark: sparkline(3) },
    { id: 'churn', label: 'نرخ ریزش', value: 2.4, unit: 'percent', delta: -0.6, tone: 'danger', icon: 'person-dash', spark: sparkline(4) },
    { id: 'users', label: 'کاربران فعال', value: 48_260, unit: 'number', delta: 7.4, tone: 'success', icon: 'people', spark: sparkline(5) },
    { id: 'trials', label: 'آزمایش‌های فعال', value: 862, unit: 'number', delta: 12.1, tone: 'violet', icon: 'hourglass-split', spark: sparkline(6) },
    { id: 'upgrades', label: 'ارتقاها', value: 184, unit: 'number', delta: 6.2, tone: 'success', icon: 'arrow-up-circle', spark: sparkline(7) },
    { id: 'downgrades', label: 'تنزل‌ها', value: 42, unit: 'number', delta: -8.4, tone: 'warning', icon: 'arrow-down-circle', spark: sparkline(8) },
  ],
  finance: [
    { id: 'balance', label: 'موجودی کل', value: 30_690_000_000, unit: 'currency', delta: 3.4, tone: 'primary', icon: 'wallet2', spark: sparkline(1) },
    { id: 'revenue', label: 'درآمد دوره', value: 22_480_000_000, unit: 'currency', delta: 10.8, tone: 'success', icon: 'graph-up-arrow', spark: sparkline(2) },
    { id: 'expenses', label: 'هزینه دوره', value: 12_260_000_000, unit: 'currency', delta: 4.6, tone: 'warning', icon: 'cash-coin', spark: sparkline(3) },
    { id: 'profit', label: 'سود عملیاتی', value: 10_220_000_000, unit: 'currency', delta: 14.2, tone: 'success', icon: 'piggy-bank', spark: sparkline(4) },
    { id: 'pending', label: 'مطالبات معوق', value: 3_840_000_000, unit: 'currency', delta: -2.8, tone: 'danger', icon: 'clock-history', spark: sparkline(5) },
    { id: 'cash', label: 'جریان نقدی', value: 6_140_000_000, unit: 'currency', delta: 8.1, tone: 'info', icon: 'arrow-left-right', spark: sparkline(6) },
    { id: 'invoices', label: 'فاکتورهای صادرشده', value: 386, unit: 'number', delta: 5.2, tone: 'primary', icon: 'file-earmark-spreadsheet', spark: sparkline(7) },
    { id: 'overdue', label: 'فاکتورهای معوق', value: 24, unit: 'number', delta: -11.2, tone: 'danger', icon: 'exclamation-octagon', spark: sparkline(8) },
  ],
  projects: [
    { id: 'projects', label: 'پروژه‌های فعال', value: 14, unit: 'number', delta: 7.7, tone: 'primary', icon: 'kanban', spark: sparkline(1) },
    { id: 'tasks', label: 'تسک‌های باز', value: 268, unit: 'number', delta: -4.2, tone: 'info', icon: 'check2-square', spark: sparkline(2) },
    { id: 'done', label: 'تکمیل‌شده این هفته', value: 96, unit: 'number', delta: 12.6, tone: 'success', icon: 'check2-circle', spark: sparkline(3) },
    { id: 'deadlines', label: 'نزدیک به موعد', value: 12, unit: 'number', delta: 3.4, tone: 'warning', icon: 'alarm', spark: sparkline(4) },
    { id: 'performance', label: 'عملکرد تیم', value: 86.4, unit: 'percent', delta: 2.2, tone: 'success', icon: 'speedometer2', spark: sparkline(5) },
    { id: 'hours', label: 'ساعت کارکرد', value: 1_284, unit: 'number', delta: 5.1, tone: 'violet', icon: 'clock', spark: sparkline(6) },
    { id: 'overdue', label: 'تسک‌های عقب‌افتاده', value: 18, unit: 'number', delta: -6.8, tone: 'danger', icon: 'exclamation-triangle', spark: sparkline(7) },
    { id: 'velocity', label: 'سرعت تیم', value: 42, unit: 'number', delta: 8.4, tone: 'primary', icon: 'lightning-charge', spark: sparkline(8) },
  ],
  hr: [
    { id: 'employees', label: 'کارکنان', value: 38, unit: 'number', delta: 4.4, tone: 'primary', icon: 'people', spark: sparkline(1) },
    { id: 'attendance', label: 'حضور امروز', value: 94.2, unit: 'percent', delta: 1.2, tone: 'success', icon: 'clipboard-check', spark: sparkline(2) },
    { id: 'leave', label: 'مرخصی‌های فعال', value: 12, unit: 'number', delta: 2.8, tone: 'warning', icon: 'calendar-x', spark: sparkline(3) },
    { id: 'payroll', label: 'حقوق ماهانه', value: 8_640_000_000, unit: 'currency', delta: 3.6, tone: 'info', icon: 'cash-stack', spark: sparkline(4) },
    { id: 'openings', label: 'موقعیت‌های باز', value: 7, unit: 'number', delta: 16.7, tone: 'violet', icon: 'person-plus', spark: sparkline(5) },
    { id: 'candidates', label: 'کاندید فعال', value: 84, unit: 'number', delta: 9.2, tone: 'primary', icon: 'person-badge', spark: sparkline(6) },
    { id: 'turnover', label: 'نرخ خروج', value: 7.8, unit: 'percent', delta: -1.4, tone: 'danger', icon: 'person-dash', spark: sparkline(7) },
    { id: 'satisfaction', label: 'رضایت کارکنان', value: 4.3, unit: 'percent', delta: 2.6, tone: 'success', icon: 'emoji-smile', spark: sparkline(8) },
  ],
  support: [
    { id: 'total', label: 'کل تیکت‌ها', value: 1_284, unit: 'number', delta: 6.2, tone: 'primary', icon: 'ticket-detailed', spark: sparkline(1) },
    { id: 'open', label: 'تیکت‌های باز', value: 86, unit: 'number', delta: -4.4, tone: 'info', icon: 'envelope-open', spark: sparkline(2) },
    { id: 'pending', label: 'در انتظار', value: 32, unit: 'number', delta: 2.1, tone: 'warning', icon: 'hourglass-split', spark: sparkline(3) },
    { id: 'resolved', label: 'حل شده', value: 1_142, unit: 'number', delta: 8.8, tone: 'success', icon: 'check2-circle', spark: sparkline(4) },
    { id: 'response', label: 'میانگین پاسخ', value: 18, unit: 'minute', delta: -12.4, tone: 'success', icon: 'stopwatch', spark: sparkline(5) },
    { id: 'satisfaction', label: 'رضایت مشتری', value: 94.6, unit: 'percent', delta: 1.8, tone: 'violet', icon: 'emoji-smile', spark: sparkline(6) },
    { id: 'breach', label: 'نقض SLA', value: 8, unit: 'number', delta: -20.4, tone: 'danger', icon: 'shield-exclamation', spark: sparkline(7) },
    { id: 'agents', label: 'پشتیبانان فعال', value: 9, unit: 'number', delta: 0, tone: 'primary', icon: 'headset', spark: sparkline(8) },
  ],
  ai: [
    { id: 'requests', label: 'درخواست‌های AI', value: 128_460, unit: 'number', delta: 24.6, tone: 'primary', icon: 'stars', spark: sparkline(1) },
    { id: 'tokens', label: 'توکن مصرفی', value: 48_240_000, unit: 'number', delta: 18.2, tone: 'violet', icon: 'cpu', spark: sparkline(2) },
    { id: 'cost', label: 'هزینه AI', value: 1_284_000_000, unit: 'currency', delta: 12.4, tone: 'success', icon: 'currency-dollar', spark: sparkline(3) },
    { id: 'models', label: 'مدل‌های فعال', value: 8, unit: 'number', delta: 14.3, tone: 'info', icon: 'boxes', spark: sparkline(4) },
    { id: 'users', label: 'کاربران AI', value: 1_842, unit: 'number', delta: 16.8, tone: 'primary', icon: 'people', spark: sparkline(5) },
    { id: 'prompts', label: 'پرامپت‌های ذخیره‌شده', value: 486, unit: 'number', delta: 9.6, tone: 'violet', icon: 'collection', spark: sparkline(6) },
    { id: 'latency', label: 'میانگین تأخیر', value: 840, unit: 'number', delta: -8.2, tone: 'success', icon: 'lightning-charge', spark: sparkline(7) },
    { id: 'errors', label: 'خطاهای API', value: 42, unit: 'number', delta: -18.4, tone: 'danger', icon: 'bug', spark: sparkline(8) },
  ],
  logistics: [
    { id: 'orders', label: 'سفارش‌های آماده ارسال', value: 486, unit: 'number', delta: 5.4, tone: 'primary', icon: 'boxes', spark: sparkline(1) },
    { id: 'shipments', label: 'محموله‌های فعال', value: 128, unit: 'number', delta: 8.2, tone: 'info', icon: 'truck', spark: sparkline(2) },
    { id: 'delivered', label: 'تحویل امروز', value: 84, unit: 'number', delta: 11.6, tone: 'success', icon: 'check2-circle', spark: sparkline(3) },
    { id: 'drivers', label: 'رانندگان فعال', value: 16, unit: 'number', delta: 2.4, tone: 'primary', icon: 'person-badge', spark: sparkline(4) },
    { id: 'warehouses', label: 'انبارها', value: 5, unit: 'number', delta: 0, tone: 'violet', icon: 'building-gear', spark: sparkline(5) },
    { id: 'delayed', label: 'محموله‌های تأخیری', value: 9, unit: 'number', delta: -14.2, tone: 'danger', icon: 'exclamation-triangle', spark: sparkline(6) },
    { id: 'ontime', label: 'تحویل به‌موقع', value: 94.6, unit: 'percent', delta: 2.2, tone: 'success', icon: 'stopwatch', spark: sparkline(7) },
    { id: 'cost', label: 'هزینه حمل', value: 1_840_000_000, unit: 'currency', delta: 3.8, tone: 'warning', icon: 'cash-coin', spark: sparkline(8) },
  ],
};

/* ------------------------------------------------------------- breakdowns */
export const trafficSources = [
  { label: 'جستجوی ارگانیک', value: 42.4, color: 'var(--nv-chart-1)' },
  { label: 'ورود مستقیم', value: 24.1, color: 'var(--nv-chart-2)' },
  { label: 'شبکه‌های اجتماعی', value: 16.8, color: 'var(--nv-chart-3)' },
  { label: 'کمپین ایمیلی', value: 9.4, color: 'var(--nv-chart-4)' },
  { label: 'تبلیغات پرداختی', value: 5.2, color: 'var(--nv-chart-5)' },
  { label: 'ارجاع از سایت‌ها', value: 2.1, color: 'var(--nv-chart-6)' },
];

export const devices = [
  { label: 'موبایل', value: 62.4, icon: 'phone' },
  { label: 'دسکتاپ', value: 28.8, icon: 'display' },
  { label: 'تبلت', value: 8.8, icon: 'tablet' },
];

export const browsingBrowsers = [
  { label: 'Chrome', value: 48.2 },
  { label: 'Safari', value: 22.6 },
  { label: 'Firefox', value: 12.4 },
  { label: 'Edge', value: 9.8 },
  { label: 'سایر', value: 7 },
];

export const topPages = [
  { path: '/dashboards/analytics.html', views: 48_240, avgTime: '۴:۱۲', bounce: 32.4 },
  { path: '/ecommerce/products.html', views: 36_180, avgTime: '۳:۳۸', bounce: 28.1 },
  { path: '/ai/chat.html', views: 28_460, avgTime: '۶:۲۴', bounce: 18.6 },
  { path: '/finance/invoices.html', views: 21_840, avgTime: '۴:۴۸', bounce: 24.2 },
  { path: '/users/list.html', views: 18_920, avgTime: '۵:۰۶', bounce: 21.8 },
  { path: '/projects/kanban.html', views: 16_480, avgTime: '۷:۳۲', bounce: 15.4 },
  { path: '/reports/sales.html', views: 12_860, avgTime: '۴:۰۲', bounce: 29.6 },
];

export const funnel = [
  { label: 'بازدید سایت', value: 248_930, percent: 100 },
  { label: 'مشاهده محصول', value: 148_260, percent: 59.6 },
  { label: 'افزودن به سبد', value: 62_480, percent: 25.1 },
  { label: 'شروع پرداخت', value: 24_860, percent: 10 },
  { label: 'پرداخت موفق', value: 9_562, percent: 3.8 },
];

export const geo = [
  { label: 'تهران', value: 38.4, flag: 'IR' },
  { label: 'اصفهان', value: 14.2, flag: 'IR' },
  { label: 'مشهد', value: 12.6, flag: 'IR' },
  { label: 'شیراز', value: 8.4, flag: 'IR' },
  { label: 'تبریز', value: 6.8, flag: 'IR' },
  { label: 'سایر استان‌ها', value: 19.6, flag: 'IR' },
];

export const cohorts = Array.from({ length: 6 }).map((_, row) => ({
  label: `گروه ${jalaliMonths[row]}`,
  size: int(180, 640),
  retention: Array.from({ length: 6 - row }).map((__, i) => (i === 0 ? 100 : int(28, 92))),
}));

export const goals = [
  { label: 'دستیابی به درآمد ماهانه ۲۰ میلیارد ریال', current: 18.64, target: 20, unit: 'میلیارد ریال', tone: 'primary' },
  { label: 'افزایش نرخ تبدیل به ۴.۵٪', current: 3.84, target: 4.5, unit: 'درصد', tone: 'success' },
  { label: 'کاهش نرخ ریزش به ۲٪', current: 2.4, target: 2, unit: 'درصد', tone: 'warning' },
  { label: 'رضایت مشتری ۹۶٪', current: 94.6, target: 96, unit: 'درصد', tone: 'info' },
];

/* -------------------------------------------------- SaaS specific breakdowns */
export const planDistribution = [
  { label: 'پایه', value: 1_842, mrr: 2_140_000_000 },
  { label: 'حرفه‌ای', value: 1_284, mrr: 4_860_000_000 },
  { label: 'کسب‌وکار', value: 486, mrr: 3_240_000_000 },
  { label: 'سازمانی', value: 230, mrr: 2_600_000_000 },
];

export const churnReasons = [
  { label: 'قیمت', value: 32 },
  { label: 'کمبود امکانات', value: 24 },
  { label: 'تغییر نیاز کسب‌وکار', value: 18 },
  { label: 'تجربه کاربری', value: 14 },
  { label: 'انتقال به رقیب', value: 12 },
];

export const aiUsageByModel = [
  { label: 'GPT-4o mini', requests: 48_240, tokens: 18_460_000, cost: 482_000_000, tone: 'primary' },
  { label: 'GPT-4o', requests: 26_180, tokens: 14_280_000, cost: 386_000_000, tone: 'violet' },
  { label: 'Claude 3.5 Sonnet', requests: 18_640, tokens: 8_920_000, cost: 214_000_000, tone: 'info' },
  { label: 'Gemini 1.5 Pro', requests: 14_280, tokens: 4_860_000, cost: 128_000_000, tone: 'success' },
  { label: 'Llama 3.1 70B', requests: 12_460, tokens: 1_480_000, cost: 48_000_000, tone: 'warning' },
  { label: 'مدل فارسی داخلی', requests: 8_660, tokens: 240_000, cost: 26_000_000, tone: 'neutral' },
];

export default {
  kpis,
  makeSeries,
  makeMultiSeries,
  sparkline,
  trafficSources,
  devices,
  browsingBrowsers,
  topPages,
  funnel,
  geo,
  cohorts,
  goals,
  planDistribution,
  churnReasons,
  aiUsageByModel,
  TIME_RANGES,
  jalaliMonths,
  weekDays,
};
