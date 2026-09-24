/**
 * NOVAADMIN — Finance demo data
 * (invoices, transactions, accounts, expenses, income, payments,
 *  subscriptions, payouts, balance sheet)
 */
import { makeHelpers, companyNames } from './rng.js';
import { customers } from './people.js';
import { orders } from './commerce.js';

const { int, float, pick, picks, bool, date } = makeHelpers(3003);

export const INVOICE_STATUSES = [
  { id: 'paid', label: 'پرداخت شده', tone: 'success' },
  { id: 'unpaid', label: 'پرداخت نشده', tone: 'warning' },
  { id: 'overdue', label: 'معوق', tone: 'danger' },
  { id: 'draft', label: 'پیش‌نویس', tone: 'neutral' },
  { id: 'void', label: 'باطل شده', tone: 'neutral' },
];

export const accounts = [
  { id: 'acc-1', name: 'حساب اصلی ریالی', bank: 'بانک ملت', number: '۴۵۶۷۸۹۰۱۲۳', balance: 18_420_000_000, currency: 'IRR', type: 'جاری', status: 'active', change: 4.2 },
  { id: 'acc-2', name: 'حساب عملیاتی', bank: 'بانک سامان', number: '۱۲۳۴۵۶۷۸۹', balance: 6_180_000_000, currency: 'IRR', type: 'جاری', status: 'active', change: -1.4 },
  { id: 'acc-3', name: 'حساب حقوق و دستمزد', bank: 'بانک پاسارگاد', number: '۹۸۷۶۵۴۳۲۱', balance: 3_350_000_000, currency: 'IRR', type: 'سپرده', status: 'active', change: 0.8 },
  { id: 'acc-4', name: 'حساب ارزی دلار', bank: 'بانک تجارت', number: '۴۴۵۵۶۶۷۷۸', balance: 84_500, currency: 'USD', type: 'ارزی', status: 'active', change: 2.1 },
  { id: 'acc-5', name: 'حساب تسویه پذیرندگان', bank: 'بانک آینده', number: '۷۷۸۸۹۹۰۰۱', balance: 2_740_000_000, currency: 'IRR', type: 'تسویه', status: 'blocked', change: 0 },
];

export const invoices = Array.from({ length: 34 }).map((_, i) => {
  const customer = customers[(i * 7) % customers.length];
  const status = pick(INVOICE_STATUSES);
  const subtotal = int(12, 480) * 1_000_000;
  const tax = Math.round(subtotal * 0.09);
  const discount = pick([0, 0, Math.round(subtotal * 0.05), Math.round(subtotal * 0.1)]);
  const n = 2400 + i;
  return {
    id: `in-${n}`,
    number: `INV-${n}`,
    customerId: customer.id,
    customer: customer.company,
    contact: customer.contact,
    avatar: customer.avatar,
    email: customer.email,
    address: `${customer.city}، خیابان ${pick(['آزادی', 'ولیعصر', 'میرداماد', 'سهروردی']) }، پلاک ${int(1, 200)}`,
    issuedAt: date(int(1, 240), int(9, 18)),
    dueAt: date(-int(0, 30), int(9, 18)),
    subtotal,
    tax,
    discount,
    total: subtotal + tax - discount,
    paid: status.id === 'paid' ? subtotal + tax - discount : pick([0, Math.round((subtotal + tax) * 0.4)]),
    status: status.id,
    statusLabel: status.label,
    currency: 'IRR',
    items: picks(
      [
        { title: 'اشتراک سالانه پلتفرم', price: 180_000_000 },
        { title: 'پشتیبانی طلایی', price: 45_000_000 },
        { title: 'آموزش تیمی (۲ روز)', price: 32_000_000 },
        { title: 'توسعه ماژول اختصاصی', price: 120_000_000 },
        { title: 'استقرار روی سرور مشتری', price: 28_000_000 },
      ],
      3,
    ).map((item) => { const qty = int(1, 3); return { ...item, qty, quantity: qty }; }),
    project: pick(['مهاجرت ابری', 'پیاده‌سازی CRM', 'فروشگاه سازمانی', 'پورتال مشتریان', 'داشبورد مدیریتی']),
    notes: 'مبلغ فاکتور بر اساس قرارداد شماره ۱۴۰۲/۸۸ محاسبه شده است. تسویه تا ۳۰ روز.',
    paymentMethod: pick(['انتقال بانکی', 'کارت اعتباری', 'چک', 'کیف پول سازمانی']),
  };
});

const txTypes = ['deposit', 'withdrawal', 'transfer', 'fee', 'refund'];
export const transactions = Array.from({ length: 56 }).map((_, i) => {
  const type = pick(txTypes);
  const amount = int(2, 900) * 1_000_000;
  const direction = ['deposit', 'refund'].includes(type) ? 'in' : 'out';
  return {
    id: `tx-${9000 + i}`,
    reference: `TRX-${int(100000, 999999)}`,
    type,
    typeLabel: { deposit: 'واریز', withdrawal: 'برداشت', transfer: 'انتقال', fee: 'کارمزد', refund: 'بازگشت وجه' }[type],
    direction,
    amount: direction === 'in' ? amount : -amount,
    account: pick(accounts).name,
    method: pick(['کارت به کارت', 'پایا', 'ساتنا', 'درگاه اینترنتی', 'چک']),
    counterparty: pick([...companyNames, ...customers.map((c) => c.company)]),
    status: pick(['completed', 'completed', 'completed', 'pending', 'failed']),
    at: date(int(0, 180), int(8, 22), int(0, 59)),
    balanceAfter: int(120, 1900) * 10_000_000,
    orderRef: bool(0.35) ? pick(orders).number : '',
  };
});

export const expenses = Array.from({ length: 28 }).map((_, i) => ({
  id: `ex-${i + 1}`,
  title: pick(['اجاره دفتر مرکزی', 'حقوق و دستمزد', 'تبلیغات آنلاین', 'اشتراک نرم‌افزار', 'سفرهای کاری', 'خرید تجهیزات', 'خدمات ابری', 'بازاریابی محتوا', 'آموزش کارکنان', 'حمل و نقل']),
  category: pick(['عملیاتی', 'فروش و بازاریابی', 'اداری', 'فناوری', 'منابع انسانی']),
  vendor: pick(companyNames),
  amount: int(15, 850) * 1_000_000,
  status: pick(['paid', 'paid', 'pending', 'scheduled']),
  method: pick(['انتقال بانکی', 'کارت شرکت', 'نقدی']),
  at: date(int(0, 120), int(9, 18)),
  owner: pick(['الهام رستمی', 'شیما امینی', 'بابک یزدانی']),
  receipt: bool(0.7),
}));

export const income = Array.from({ length: 22 }).map((_, i) => ({
  id: `inc-${i + 1}`,
  source: pick(['فروش محصولات', 'اشتراک SaaS', 'خدمات مشاوره', 'پشتیبانی سالانه', 'فروش دوره آموزشی', 'استقرار اختصاصی']),
  customer: pick([...customers.map((c) => c.company), ...companyNames]),
  amount: int(40, 1200) * 1_000_000,
  status: pick(['received', 'received', 'pending', 'partial']),
  method: pick(['انتقال بانکی', 'درگاه پرداخت', 'چک']),
  at: date(int(0, 90), int(9, 20)),
  recurring: bool(0.4),
}));

export const payments = Array.from({ length: 26 }).map((_, i) => ({
  id: `pay-${i + 1}`,
  invoice: `INV-${2400 + i}`,
  customer: pick(customers).company,
  amount: int(12, 420) * 1_000_000,
  gateway: pick(['زرین‌پال', 'آیدی‌پی', 'سامان الکترونیک', 'پارسیان']),
  status: pick(['success', 'success', 'success', 'failed', 'refunded']),
  at: date(int(0, 60), int(9, 22)),
  reference: `PG-${int(1000000, 9999999)}`,
}));

export const subscriptions = Array.from({ length: 20 }).map((_, i) => {
  const customer = customers[(i * 3) % customers.length];
  return {
    id: `sub-${i + 1}`,
    customer: customer.company,
    avatar: customer.avatar,
    plan: pick(['پایه', 'حرفه‌ای', 'کسب‌وکار', 'سازمانی']),
    seats: int(5, 240),
    mrr: int(18, 480) * 1_000_000,
    interval: pick(['monthly', 'monthly', 'yearly']),
    status: pick(['active', 'active', 'active', 'trialing', 'past_due', 'canceled']),
    startedAt: date(int(60, 900), int(9, 18)),
    renewsAt: date(-int(2, 40), int(9, 18)),
    churnRisk: float(0.5, 42, 1),
  };
});

export const payouts = Array.from({ length: 16 }).map((_, i) => ({
  id: `po-${i + 1}`,
  reference: `PO-${int(10000, 99999)}`,
  vendor: pick(companyNames),
  amount: int(24, 640) * 1_000_000,
  fee: int(1, 12) * 1_000_000,
  method: pick(['پایا', 'ساتنا', 'چک']),
  status: pick(['paid', 'paid', 'pending', 'processing', 'failed']),
  at: date(int(0, 90), int(10, 18)),
  iban: `IR${int(10, 99)}${int(1000, 9999)}${int(1000, 9999)}${int(1000, 9999)}`,
}));

export const cashFlow = Array.from({ length: 12 }).map((_, i) => ({
  month: i,
  inflow: int(4200, 9800) * 1_000_000,
  outflow: int(2800, 7200) * 1_000_000,
}));

export const balanceSheet = [
  { label: 'موجودی نقدی', value: 30_690_000_000, tone: 'primary' },
  { label: 'حساب‌های دریافتنی', value: 12_450_000_000, tone: 'info' },
  { label: 'موجودی انبار', value: 8_920_000_000, tone: 'success' },
  { label: 'حساب‌های پرداختنی', value: -5_340_000_000, tone: 'warning' },
  { label: 'بدهی بلندمدت', value: -9_800_000_000, tone: 'danger' },
];

export default {
  accounts,
  invoices,
  transactions,
  expenses,
  income,
  payments,
  subscriptions,
  payouts,
  cashFlow,
  balanceSheet,
  INVOICE_STATUSES,
};
