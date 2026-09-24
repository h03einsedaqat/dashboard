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
export const COLUMNS = {
  orders: [
    { key: 'number', label: 'شماره سفارش', type: 'primary', sub: 'customer', sortable: true },
    { key: 'placedAt', label: 'تاریخ ثبت', type: 'relative', sortable: true },
    { key: 'itemsCount', label: 'اقلام', type: 'number', align: 'end' },
    { key: 'total', label: 'مبلغ کل', type: 'currency', align: 'end', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge', sortable: true },
    { key: 'payment', label: 'روش پرداخت' },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'ecommerce/order-details.html?id={id}' },
  ],
  products: [
    { key: 'name', label: 'محصول', type: 'primary', sub: 'sku', avatar: 'image', sortable: true },
    { key: 'category', label: 'دسته‌بندی' },
    { key: 'brand', label: 'برند' },
    { key: 'finalPrice', label: 'قیمت', type: 'currency', align: 'end', sortable: true },
    { key: 'stock', label: 'موجودی', type: 'number', align: 'end', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'ecommerce/product-details.html?id={id}' },
  ],
  users: [
    { key: 'name', label: 'کاربر', type: 'primary', sub: 'email', avatar: 'avatar', sortable: true },
    { key: 'roleLabel', label: 'نقش' },
    { key: 'team', label: 'تیم' },
    { key: 'lastActive', label: 'آخرین فعالیت', type: 'relative', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'users/details.html?id={id}' },
  ],
  customers: [
    { key: 'company', label: 'مشتری', type: 'primary', sub: 'contact', avatar: 'avatar', sortable: true },
    { key: 'plan', label: 'پلن' },
    { key: 'orders', label: 'سفارش‌ها', type: 'number', align: 'end', sortable: true },
    { key: 'totalSpend', label: 'مجموع خرید', type: 'currency', align: 'end', sortable: true },
    { key: 'satisfaction', label: 'رضایت', type: 'rating' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'customers/details.html?id={id}' },
  ],
  invoices: [
    { key: 'number', label: 'شماره فاکتور', type: 'primary', sub: 'customer', sortable: true },
    { key: 'issuedAt', label: 'تاریخ صدور', type: 'date', sortable: true },
    { key: 'dueAt', label: 'سررسید', type: 'date' },
    { key: 'total', label: 'مبلغ', type: 'currency', align: 'end', sortable: true },
    { key: 'paid', label: 'پرداخت‌شده', type: 'currency', align: 'end' },
    { key: 'status', label: 'وضعیت', type: 'badge', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'finance/invoice-details.html?id={id}' },
  ],
  transactions: [
    { key: 'reference', label: 'کد پیگیری', type: 'primary', sub: 'counterparty', sortable: true },
    { key: 'account', label: 'حساب' },
    { key: 'typeLabel', label: 'نوع' },
    { key: 'amount', label: 'مبلغ', type: 'currency', align: 'end', sortable: true },
    { key: 'method', label: 'روش' },
    { key: 'at', label: 'تاریخ', type: 'relative', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  tickets: [
    { key: 'number', label: 'شماره', type: 'primary', sub: 'subject', sortable: true },
    { key: 'customer', label: 'مشتری' },
    { key: 'category', label: 'دسته' },
    { key: 'priority', label: 'اولویت', type: 'badge', sortable: true },
    { key: 'agent', label: 'پشتیبان' },
    { key: 'createdAt', label: 'ایجاد', type: 'relative', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'support/ticket-details.html?id={id}' },
  ],
  employees: [
    { key: 'name', label: 'کارمند', type: 'primary', sub: 'position', avatar: 'avatar', sortable: true },
    { key: 'department', label: 'دپارتمان' },
    { key: 'type', label: 'نوع همکاری' },
    { key: 'hiredAt', label: 'تاریخ استخدام', type: 'date', sortable: true },
    { key: 'performance', label: 'عملکرد', type: 'rating' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'hr/employee-profile.html?id={id}' },
  ],
  shipments: [
    { key: 'tracking', label: 'کد رهگیری', type: 'primary', sub: 'order', sortable: true },
    { key: 'destination', label: 'مقصد' },
    { key: 'carrier', label: 'شرکت حمل' },
    { key: 'driver', label: 'راننده', avatar: 'driverAvatar', type: 'primary' },
    { key: 'eta', label: 'زمان تخمینی', type: 'date' },
    { key: 'progress', label: 'پیشرفت', type: 'progress' },
    { key: 'status', label: 'وضعیت', type: 'badge', sortable: true },
  ],
  projects: [
    { key: 'name', label: 'پروژه', type: 'primary', sub: 'client', sortable: true },
    { key: 'team', label: 'تیم' },
    { key: 'owner', label: 'مدیر پروژه' },
    { key: 'progress', label: 'پیشرفت', type: 'progress', sortable: true },
    { key: 'budget', label: 'بودجه', type: 'currency', align: 'end', sortable: true },
    { key: 'dueDate', label: 'موعد', type: 'date', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'projects/details.html?id={id}' },
  ],
  tasks: [
    { key: 'title', label: 'تسک', type: 'primary', sub: 'project', sortable: true },
    { key: 'assignee', label: 'مسئول', avatar: 'assigneeAvatar', type: 'primary' },
    { key: 'priorityLabel', label: 'اولویت', type: 'badge', sortable: true },
    { key: 'dueDate', label: 'موعد', type: 'date', sortable: true },
    { key: 'progress', label: 'پیشرفت', type: 'progress' },
    { key: 'statusLabel', label: 'وضعیت', type: 'badge', sortable: true },
  ],
  deals: [
    { key: 'title', label: 'معامله', type: 'primary', sub: 'company', sortable: true },
    { key: 'owner', label: 'کارشناس', avatar: 'ownerAvatar', type: 'primary' },
    { key: 'value', label: 'ارزش', type: 'currency', align: 'end', sortable: true },
    { key: 'probability', label: 'احتمال', type: 'progress', sortable: true },
    { key: 'expectedClose', label: 'بستن مورد انتظار', type: 'date', sortable: true },
    { key: 'stageLabel', label: 'مرحله', type: 'badge', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'crm/deal-details.html?id={id}' },
  ],
  companies: [
    { key: 'name', label: 'شرکت', type: 'primary', sub: 'industry', avatar: 'logo', sortable: true },
    { key: 'city', label: 'شهر' },
    { key: 'employees', label: 'کارکنان', type: 'number', align: 'end', sortable: true },
    { key: 'openValue', label: 'فرصت باز', type: 'currency', align: 'end', sortable: true },
    { key: 'owner', label: 'کارشناس' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'crm/company-details.html?id={id}' },
  ],
  contacts: [
    { key: 'name', label: 'مخاطب', type: 'primary', sub: 'title', avatar: 'avatar', sortable: true },
    { key: 'company', label: 'شرکت' },
    { key: 'phone', label: 'تلفن' },
    { key: 'lastContact', label: 'آخرین تماس', type: 'relative', sortable: true },
    { key: 'value', label: 'ارزش', type: 'currency', align: 'end', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge' },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'crm/contact-details.html?id={id}' },
  ],
  leads: [
    { key: 'name', label: 'سرنخ', type: 'primary', sub: 'company', sortable: true },
    { key: 'source', label: 'منبع' },
    { key: 'score', label: 'امتیاز', type: 'progress', sortable: true },
    { key: 'estimatedValue', label: 'ارزش تخمینی', type: 'currency', align: 'end', sortable: true },
    { key: 'owner', label: 'کارشناس' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  'hr/leave': [
    { key: 'employee', label: 'کارمند', type: 'primary', sub: 'department', avatar: 'avatar', sortable: true },
    { key: 'type', label: 'نوع مرخصی' },
    { key: 'from', label: 'از', type: 'date' },
    { key: 'to', label: 'تا', type: 'date' },
    { key: 'days', label: 'روزها', type: 'number', align: 'end', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  campaigns: [
    { key: 'name', label: 'کمپین', type: 'primary', sub: 'channel', sortable: true },
    { key: 'budget', label: 'بودجه', type: 'currency', align: 'end', sortable: true },
    { key: 'spent', label: 'هزینه‌شده', type: 'currency', align: 'end' },
    { key: 'leads', label: 'سرنخ', type: 'number', align: 'end', sortable: true },
    { key: 'revenue', label: 'درآمد', type: 'currency', align: 'end', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  expenses: [
    { key: 'title', label: 'شرح', type: 'primary', sub: 'vendor', sortable: true },
    { key: 'category', label: 'دسته' },
    { key: 'amount', label: 'مبلغ', type: 'currency', align: 'end', sortable: true },
    { key: 'at', label: 'تاریخ', type: 'date', sortable: true },
    { key: 'owner', label: 'ثبت‌کننده' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  subscriptions: [
    { key: 'customer', label: 'مشتری', type: 'primary', sub: 'plan', avatar: 'avatar', sortable: true },
    { key: 'seats', label: 'کاربر', type: 'number', align: 'end' },
    { key: 'mrr', label: 'درآمد ماهانه', type: 'currency', align: 'end', sortable: true },
    { key: 'renewsAt', label: 'تمدید', type: 'date', sortable: true },
    { key: 'churnRisk', label: 'ریسک ریزش', type: 'progress' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  reviews: [
    { key: 'product', label: 'محصول', type: 'primary', sub: 'author', avatar: 'avatar', sortable: true },
    { key: 'rating', label: 'امتیاز', type: 'rating', sortable: true },
    { key: 'title', label: 'عنوان' },
    { key: 'at', label: 'تاریخ', type: 'relative', sortable: true },
    { key: 'helpful', label: 'مفید', type: 'number', align: 'end' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  coupons: [
    { key: 'code', label: 'کد تخفیف', type: 'primary', sub: 'description', sortable: true },
    { key: 'value', label: 'مقدار' },
    { key: 'minOrder', label: 'حداقل سفارش', type: 'currency', align: 'end' },
    { key: 'used', label: 'استفاده', type: 'number', align: 'end', sortable: true },
    { key: 'to', label: 'انقضا', type: 'date', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  inventory: [
    { key: 'product', label: 'محصول', type: 'primary', sub: 'sku', avatar: 'image', sortable: true },
    { key: 'warehouse', label: 'انبار' },
    { key: 'stock', label: 'موجودی', type: 'number', align: 'end', sortable: true },
    { key: 'reserved', label: 'رزرو', type: 'number', align: 'end' },
    { key: 'incoming', label: 'ورودی', type: 'number', align: 'end' },
    { key: 'updatedAt', label: 'به‌روزرسانی', type: 'relative', sortable: true },
  ],
  drivers: [
    { key: 'name', label: 'راننده', type: 'primary', sub: 'vehicle', avatar: 'avatar', sortable: true },
    { key: 'plate', label: 'پلاک' },
    { key: 'zone', label: 'منطقه' },
    { key: 'deliveries', label: 'تحویل‌ها', type: 'number', align: 'end', sortable: true },
    { key: 'onTimeRate', label: 'تحویل به‌موقع', type: 'progress', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  warehouses: [
    { key: 'name', label: 'انبار', type: 'primary', sub: 'city', sortable: true },
    { key: 'capacity', label: 'ظرفیت', type: 'number', align: 'end' },
    { key: 'used', label: 'اشغال‌شده', type: 'number', align: 'end', sortable: true },
    { key: 'shipments', label: 'محموله', type: 'number', align: 'end', sortable: true },
    { key: 'staff', label: 'کارکنان', type: 'number', align: 'end' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  files: [
    { key: 'name', label: 'نام', type: 'primary', sub: 'owner', sortable: true },
    { key: 'type', label: 'نوع' },
    { key: 'size', label: 'حجم' },
    { key: 'at', label: 'تاریخ', type: 'relative', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions' },
  ],
  media: [
    { key: 'name', label: 'فایل', type: 'primary', sub: 'dimensions', avatar: 'url', sortable: true },
    { key: 'size', label: 'حجم' },
    { key: 'uploadedBy', label: 'بارگذار' },
    { key: 'at', label: 'تاریخ', type: 'relative', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions' },
  ],
  roles: [
    { key: 'label', label: 'نقش', type: 'primary', sub: 'id', sortable: true },
    { key: 'users', label: 'کاربران', type: 'number', align: 'end', sortable: true },
    { key: 'level', label: 'سطح دسترسی', type: 'progress', sortable: true },
  ],
  teams: [
    { key: 'name', label: 'تیم', type: 'primary', sub: 'lead', sortable: true },
    { key: 'members', label: 'اعضا', type: 'number', align: 'end', sortable: true },
    { key: 'progress', label: 'ظرفیت', type: 'progress', sortable: true },
  ],
  departments: [
    { key: 'name', label: 'دپارتمان', type: 'primary', sub: 'head', sortable: true },
    { key: 'headcount', label: 'نفرات', type: 'number', align: 'end', sortable: true },
    { key: 'location', label: 'موقعیت' },
    { key: 'budget', label: 'بودجه', type: 'currency', align: 'end', sortable: true },
  ],
  invitations: [
    { key: 'email', label: 'ایمیل', type: 'primary', sub: 'role', sortable: true },
    { key: 'team', label: 'تیم' },
    { key: 'sentAt', label: 'ارسال', type: 'relative', sortable: true },
    { key: 'expiresIn', label: 'انقضا (روز)', type: 'number', align: 'end' },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
  sessions: [
    { key: 'device', label: 'دستگاه', type: 'primary', sub: 'ip', sortable: true },
    { key: 'browser', label: 'مرورگر' },
    { key: 'location', label: 'موقعیت' },
    { key: 'lastSeen', label: 'آخرین فعالیت', type: 'relative', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions' },
  ],
  notes: [
    { key: 'title', label: 'عنوان', type: 'primary', sub: 'body', sortable: true },
    { key: 'at', label: 'تاریخ', type: 'relative', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions' },
  ],
  'ai/prompts': [
    { key: 'title', label: 'پرامپت', type: 'primary', sub: 'categoryLabel', sortable: true },
    { key: 'usage', label: 'استفاده', type: 'number', align: 'end', sortable: true },
    { key: 'author', label: 'سازنده' },
    { key: 'updatedAt', label: 'به‌روزرسانی', type: 'relative', sortable: true },
    { key: 'actions', label: 'عملیات', type: 'actions' },
  ],
  'ai/scheduler': [
    { key: 'name', label: 'کار', type: 'primary', sub: 'cron', sortable: true },
    { key: 'model', label: 'مدل' },
    { key: 'runs', label: 'اجراها', type: 'number', align: 'end', sortable: true },
    { key: 'lastRun', label: 'آخرین اجرا', type: 'relative', sortable: true },
    { key: 'status', label: 'وضعیت', type: 'badge' },
  ],
};

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
