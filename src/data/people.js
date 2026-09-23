/**
 * NOVAADMIN — people & organisation demo data
 * (users, customers, teams, departments, invitations, sessions, activity)
 */
import { makeHelpers, firstNames, lastNames, companyNames, cities, countries } from './rng.js';

const { int, float, pick, picks, bool, date } = makeHelpers(1001);

export const ROLES = [
  { id: 'super-admin', label: 'مدیر ارشد', labelEn: 'Super Admin', tone: 'primary', level: 100 },
  { id: 'admin', label: 'مدیر', labelEn: 'Admin', tone: 'primary', level: 90 },
  { id: 'manager', label: 'سرپرست', labelEn: 'Manager', tone: 'info', level: 70 },
  { id: 'editor', label: 'نویسنده محتوا', labelEn: 'Editor', tone: 'violet', level: 55 },
  { id: 'support', label: 'پشتیبان', labelEn: 'Support', tone: 'warning', level: 45 },
  { id: 'finance', label: 'کارشناس مالی', labelEn: 'Finance', tone: 'success', level: 50 },
  { id: 'user', label: 'کاربر', labelEn: 'User', tone: 'neutral', level: 20 },
];

export const PERMISSIONS = ['view', 'create', 'edit', 'delete', 'export'];
export const MODULES = ['users', 'products', 'orders', 'invoices', 'projects', 'tickets', 'reports', 'settings'];

export const teams = [
  { id: 't-1', name: 'تیم پلتفرم', color: 'primary', members: 12, lead: 'سارا محمدی', progress: 78 },
  { id: 't-2', name: 'تیم طراحی محصول', color: 'violet', members: 8, lead: 'نگار کریمی', progress: 64 },
  { id: 't-3', name: 'تیم فروش', color: 'emerald', members: 15, lead: 'رضا نوری', progress: 91 },
  { id: 't-4', name: 'تیم پشتیبانی', color: 'orange', members: 11, lead: 'مریم صادقی', progress: 72 },
  { id: 't-5', name: 'تیم داده و تحلیل', color: 'blue', members: 6, lead: 'امیر طاهری', progress: 58 },
  { id: 't-6', name: 'تیم مالی', color: 'rose', members: 7, lead: 'الهام رستمی', progress: 83 },
];

export const departments = [
  { id: 'd-1', name: 'مهندسی نرم‌افزار', head: 'سارا محمدی', headcount: 34, budget: 4_800_000_000, location: 'تهران' },
  { id: 'd-2', name: 'فروش و بازاریابی', head: 'رضا نوری', headcount: 28, budget: 3_100_000_000, location: 'تهران' },
  { id: 'd-3', name: 'پشتیبانی مشتریان', head: 'مریم صادقی', headcount: 19, budget: 1_650_000_000, location: 'مشهد' },
  { id: 'd-4', name: 'مالی و حسابداری', head: 'الهام رستمی', headcount: 11, budget: 1_200_000_000, location: 'تهران' },
  { id: 'd-5', name: 'منابع انسانی', head: 'شیما امینی', headcount: 8, budget: 780_000_000, location: 'تهران' },
  { id: 'd-6', name: 'داده و هوش تجاری', head: 'امیر طاهری', headcount: 9, budget: 1_450_000_000, location: 'اصفهان' },
];

const statuses = ['active', 'active', 'active', 'invited', 'suspended'];

export const users = Array.from({ length: 42 }).map((_, i) => {
  const first = firstNames[i % firstNames.length];
  const last = lastNames[(i * 3) % lastNames.length];
  const role = pick(ROLES);
  const status = pick(statuses);
  const n = i + 1;
  return {
    id: `u-${String(n).padStart(3, '0')}`,
    name: `${first} ${last}`,
    firstName: first,
    lastName: last,
    email: `${['sara', 'ali', 'maryam', 'reza', 'negar', 'amir', 'elham', 'hossein', 'parisa', 'mohammad'][i % 10]}.${n}@novaadmin.dev`,
    phone: `+98 9${int(10, 39)} ${int(100, 999)} ${int(1000, 9999)}`,
    role: role.id,
    roleLabel: role.label,
    team: pick(teams).name,
    department: pick(departments).name,
    city: pick(cities),
    status,
    avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
    joinedAt: date(int(30, 1100), int(8, 18)),
    lastActive: date(int(0, 30), int(8, 22), int(0, 59)),
    projects: int(0, 14),
    tasksDone: int(12, 460),
    twoFactor: bool(0.6),
    progress: int(18, 100),
    salary: int(180, 950) * 100000,
  };
});

export const invitations = Array.from({ length: 9 }).map((_, i) => ({
  id: `inv-${i + 1}`,
  email: `user${i + 1}@${pick(['gmail.com', 'yahoo.com', 'novaadmin.dev', 'outlook.com'])}`,
  role: pick(ROLES.filter((r) => r.id !== 'super-admin')).label,
  team: pick(teams).name,
  sentAt: date(int(1, 40), int(9, 17)),
  expiresIn: int(1, 14),
  status: pick(['pending', 'pending', 'accepted', 'expired']),
}));

export const sessions = Array.from({ length: 8 }).map((_, i) => ({
  id: `s-${i + 1}`,
  device: pick(['MacBook Pro', 'Windows 11 · Chrome', 'iPhone 15', 'iPad Air', 'Ubuntu 24.04', 'Xiaomi 13']),
  browser: pick(['Chrome 128', 'Safari 18', 'Firefox 130', 'Edge 128']),
  ip: `5.${int(20, 250)}.${int(1, 250)}.${int(2, 250)}`,
  location: pick(cities),
  current: i === 0,
  lastSeen: date(i === 0 ? 0 : int(1, 20), int(8, 22), int(0, 59)),
}));

export const apiKeys = [
  { id: 'k-1', name: 'Production API', scopes: ['read', 'write'], createdAt: date(280), lastUsed: date(0, 12, 5), token: 'nv_live_8f2c91ad4b7e' },
  { id: 'k-2', name: 'Staging API', scopes: ['read'], createdAt: date(150), lastUsed: date(3, 9, 40), token: 'nv_test_3ab77c1e9d02' },
  { id: 'k-3', name: 'Mobile app', scopes: ['read', 'write'], createdAt: date(90), lastUsed: date(0, 8, 15), token: 'nv_live_cc41de77aa19' },
  { id: 'k-4', name: 'Analytics worker', scopes: ['read'], createdAt: date(45), lastUsed: date(6, 17, 22), token: 'nv_live_51bb0f9ec7aa' },
];

/* ------------------------------------------------------------------ customers */
export const customers = Array.from({ length: 36 }).map((_, i) => {
  const company = companyNames[i % companyNames.length];
  const contact = `${firstNames[(i * 2) % firstNames.length]} ${lastNames[(i * 5) % lastNames.length]}`;
  const n = i + 1;
  return {
    id: `c-${String(n).padStart(3, '0')}`,
    company,
    contact,
    email: `info@company${n}.ir`,
    phone: `+98 21 ${int(8800, 8899)} ${int(1000, 9999)}`,
    country: pick(countries),
    city: pick(cities),
    segment: pick(['enterprise', 'enterprise', 'smb', 'smb', 'startup', 'startup']),
    status: pick(['active', 'active', 'active', 'vip', 'inactive', 'churned']),
    since: date(int(60, 1600), int(9, 18)),
    orders: int(1, 84),
    totalSpend: int(180, 9800) * 1000000,
    lastOrder: date(int(0, 90), int(9, 20)),
    satisfaction: float(3.4, 5, 1),
    owner: pick(users).name,
    plan: pick(['حرفه‌ای', 'سازمانی', 'پایه', 'کسب‌وکار']),
    avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
    notes: pick([
      'پرداخت همیشه به‌موقع انجام می‌شود و برای تمدید قرارداد سالانه مذاکره در جریان است.',
      'درخواست آموزش تیمی برای ماژول گزارش‌ها دارد.',
      'حساس به زمان پاسخ‌گویی؛ SLA طلایی فعال است.',
      'در حال ارزیابی نسخه سازمانی برای ۲۰۰ کاربر.',
    ]),
  };
});

/* ------------------------------------------------------------------- activity */
export const activities = [
  { id: 'a-1', type: 'user', text: 'کاربر جدید «مینا فروغی» به تیم پلتفرم اضافه شد', actor: 'سارا محمدی', at: date(0, 9, 12) },
  { id: 'a-2', type: 'order', text: 'سفارش #۱۲۰۴۸ با موفقیت تکمیل و تحویل داده شد', actor: 'سیستم پرداخت', at: date(0, 8, 45) },
  { id: 'a-3', type: 'product', text: 'قیمت ۱۲ محصول در دسته لوازم جانبی به‌روزرسانی شد', actor: 'رضا نوری', at: date(0, 8, 10) },
  { id: 'a-4', type: 'invoice', text: 'فاکتور INV-۲۳۸۱ برای مشتری «داده‌پردازان پارس» صادر شد', actor: 'الهام رستمی', at: date(1, 17, 30) },
  { id: 'a-5', type: 'security', text: 'رمز عبور حساب مدیر ارشد تغییر کرد', actor: 'سارا محمدی', at: date(1, 11, 5) },
  { id: 'a-6', type: 'ticket', text: 'تیکت پشتیبانی TK-۴۵۲۱ حل شد', actor: 'مریم صادقی', at: date(1, 10, 20) },
  { id: 'a-7', type: 'project', text: 'فاز دوم پروژه «مهاجرت ابری» آغاز شد', actor: 'امیر طاهری', at: date(2, 14, 55) },
  { id: 'a-8', type: 'payment', text: 'پرداخت ۴۵۰ میلیون ریالی دریافت شد', actor: 'سیستم مالی', at: date(2, 12, 15) },
  { id: 'a-9', type: 'ai', text: '۳۴ هزار توکن در کارگاه هوش مصنوعی مصرف شد', actor: 'سیستم AI', at: date(3, 16, 40) },
  { id: 'a-10', type: 'user', text: 'دسترسی ۲ کاربر مهمان لغو شد', actor: 'کیان احمدی', at: date(4, 9, 30) },
];

export const activityLogs = Array.from({ length: 40 }).map((_, i) => {
  const base = activities[i % activities.length];
  return { ...base, id: `log-${i + 1}`, at: date(Math.floor(i / 2), int(8, 22), int(0, 59)), ip: `5.${int(20, 250)}.${int(1, 250)}.${int(2, 250)}` };
});

export const notificationSeed = [
  { id: 'n-1', type: 'success', title: 'پرداخت ثبت شد', text: 'فاکتور INV-۲۳۸۱ تسویه شد.', at: date(0, 11, 2), read: false },
  { id: 'n-2', type: 'warning', title: 'موجودی کم', text: '۳ محصول به زیر حد بحرانی رسیدند.', at: date(0, 9, 40), read: false },
  { id: 'n-3', type: 'info', title: 'گزارش ماهانه آماده است', text: 'گزارش عملکرد مهرماه تولید شد.', at: date(0, 8, 25), read: false },
  { id: 'n-4', type: 'danger', title: 'خطای درگاه', text: '۲ تراکنش ناموفق در سامانه ثبت شد.', at: date(1, 19, 10), read: false },
  { id: 'n-5', type: 'success', title: 'کاربر جدید', text: '۱۲ کاربر در هفته گذشته ثبت‌نام کردند.', at: date(1, 15, 0), read: true },
  { id: 'n-6', type: 'info', title: 'به‌روزرسانی نسخه', text: 'NOVAADMIN 1.0.0 منتشر شد.', at: date(2, 10, 30), read: true },
  { id: 'n-7', type: 'warning', title: 'پشتیبان‌گیری', text: 'پشتیبان‌گیری هفتگی با تأخیر انجام شد.', at: date(3, 23, 45), read: true },
  { id: 'n-8', type: 'success', title: 'هدف فروش', text: '۸۴٪ هدف ماهانه محقق شد.', at: date(4, 12, 20), read: true },
];

export default {
  users,
  customers,
  teams,
  departments,
  invitations,
  sessions,
  apiKeys,
  activities,
  activityLogs,
  notificationSeed,
  ROLES,
  PERMISSIONS,
  MODULES,
};
