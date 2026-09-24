/**
 * NOVAADMIN — Support desk demo data
 * (tickets, agents, knowledge base, SLA, satisfaction)
 */
import { makeHelpers, firstNames, lastNames } from './rng.js';
import { users, customers } from './people.js';

const { int, float, pick, picks, bool, date } = makeHelpers(6006);

export const TICKET_STATUSES = [
  { id: 'open', label: 'باز', tone: 'info' },
  { id: 'pending', label: 'در انتظار مشتری', tone: 'warning' },
  { id: 'in-progress', label: 'در حال بررسی', tone: 'primary' },
  { id: 'resolved', label: 'حل شده', tone: 'success' },
  { id: 'closed', label: 'بسته شده', tone: 'neutral' },
];

export const TICKET_PRIORITIES = [
  { id: 'low', label: 'کم', tone: 'neutral' },
  { id: 'normal', label: 'عادی', tone: 'info' },
  { id: 'high', label: 'زیاد', tone: 'warning' },
  { id: 'critical', label: 'بحرانی', tone: 'danger' },
];

export const agents = users.slice(0, 9).map((u, i) => ({
  id: `ag-${i + 1}`,
  name: u.name,
  avatar: u.avatar,
  email: u.email,
  team: pick(['خط اول پشتیبانی', 'پشتیبانی فنی', 'موفقیت مشتری']),
  status: pick(['online', 'online', 'busy', 'away', 'offline']),
  openTickets: int(2, 24),
  resolved: int(40, 480),
  avgResponse: `${int(4, 58)} دقیقه`,
  satisfaction: float(3.6, 5, 1),
  csat: int(72, 99),
  languages: picks(['فارسی', 'انگلیسی', 'عربی'], 2),
}));

export const tickets = Array.from({ length: 46 }).map((_, i) => {
  const status = pick(TICKET_STATUSES);
  const priority = pick(TICKET_PRIORITIES);
  const agent = agents[i % agents.length];
  const customer = customers[(i * 3) % customers.length];
  const n = 4500 + i;
  return {
    id: `tk-${n}`,
    number: `TK-${n}`,
    subject: pick([
      'خطا در فرآیند پرداخت آنلاین', 'درخواست افزایش محدودیت کاربران', 'عدم دریافت ایمیل تأییدیه',
      'کندی بارگذاری گزارش‌ها', 'سؤال درباره صورت‌حساب', 'خطای ورود دو مرحله‌ای',
      'درخواست آموزش تیم', 'مشکل در همگام‌سازی تقویم', 'بازگردانی اطلاعات حذف‌شده',
      'درخواست افزودن دامنه اختصاصی', 'اعتراض به تمدید اشتراک', 'مشکل نمایش اعداد فارسی',
    ]),
    customer: customer.company,
    requester: customer.contact,
    avatar: customer.avatar,
    email: customer.email,
    status: status.id,
    statusLabel: status.label,
    tone: status.tone,
    priority: priority.id,
    priorityLabel: priority.label,
    category: pick(['فنی', 'مالی', 'حسابداری', 'آموزش', 'دسترسی', 'پیشنهاد ویژگی']),
    channel: pick(['وب', 'ایمیل', 'تلفن', 'چت آنلاین', 'شبکه اجتماعی']),
    agent: agent.name,
    agentAvatar: agent.avatar,
    createdAt: date(int(0, 60), int(8, 22), int(0, 59)),
    updatedAt: date(int(0, 12), int(8, 22), int(0, 59)),
    firstResponse: `${int(3, 240)} دقیقه`,
    slaBreach: bool(0.18),
    satisfaction: status.id === 'closed' ? pick([3, 4, 5, 5, 5]) : null,
    tags: picks(['پرداخت', 'دسترسی', 'گزارش', 'ایمیل', 'کارایی', 'آمدوزش'], 2),
    messages: Array.from({ length: int(2, 6) }).map((__, m) => ({
      id: `tm-${i}-${m}`,
      author: m % 2 === 0 ? customer.contact : agent.name,
      avatar: m % 2 === 0 ? customer.avatar : agent.avatar,
      side: m % 2 === 0 ? 'customer' : 'agent',
      text:
        m === 0
          ? 'سلام، از دیروز هنگام نهایی‌سازی پرداخت خطای «درخواست نامعتبر» دریافت می‌کنیم. لطفاً بررسی کنید.'
          : pick([
              'سلام، درخواست شما ثبت شد و در اولویت بررسی قرار گرفت. تیم فنی در حال بررسی لاگ‌های درگاه است.',
              'با بررسی لاگ‌ها، مشکل از تنظیمات کلید API سمت شما بوده است؛ راهنمای اصلاح را ارسال کردم.',
              'در صورت نیاز به تماس مستقیم، شماره تماس و بهترین زمان را اعلام بفرمایید.',
            ]),
      at: date(int(0, 20), int(8, 21), int(0, 59)),
      attachments: bool(0.2) ? [{ name: 'error-log.txt', size: '24 KB' }] : [],
    })),
  };
});

export const ticketStats = [
  { id: 'total', label: 'کل تیکت‌ها', value: tickets.length, tone: 'primary', icon: 'ticket-detailed' },
  { id: 'open', label: 'باز', value: tickets.filter((t) => t.status === 'open').length, tone: 'info', icon: 'envelope-open' },
  { id: 'pending', label: 'در انتظار', value: tickets.filter((t) => t.status === 'pending').length, tone: 'warning', icon: 'hourglass-split' },
  { id: 'resolved', label: 'حل شده', value: tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length, tone: 'success', icon: 'check2-circle' },
];

export const knowledgeBase = [
  { id: 'kb-1', title: 'راه‌اندازی سریع پلتفرم', category: 'شروع کار', views: 18420, articles: 12, updatedAt: date(4, 10, 0), icon: 'rocket' },
  { id: 'kb-2', title: 'مدیریت کاربران و نقش‌ها', category: 'مدیریت', views: 12680, articles: 18, updatedAt: date(9, 11, 0), icon: 'people' },
  { id: 'kb-3', title: 'تنظیمات پرداخت و فاکتور', category: 'مالی', views: 9860, articles: 14, updatedAt: date(2, 15, 0), icon: 'credit-card' },
  { id: 'kb-4', title: 'اتصال به API و وب‌هوک', category: 'توسعه‌دهندگان', views: 15420, articles: 22, updatedAt: date(1, 9, 0), icon: 'code-slash' },
  { id: 'kb-5', title: 'گزارش‌ها و داشبورد', category: 'تحلیل', views: 7420, articles: 9, updatedAt: date(6, 13, 0), icon: 'bar-chart-line' },
  { id: 'kb-6', title: 'کارگاه هوش مصنوعی', category: 'هوش مصنوعی', views: 6120, articles: 11, updatedAt: date(3, 16, 0), icon: 'stars' },
];


export const kbArticles = [
  ['kb-1', 'نصب و راه‌اندازی در کمتر از ۵ دقیقه', 'از دریافت بسته تا اجرای اولین داشبورد با npm و Vite.', 4, 9820, 412],
  ['kb-1', 'آشنایی با ساختار پوشه‌ها', 'هر فایل کجاست و برای افزودن صفحه جدید کجا را ویرایش کنیم.', 6, 6240, 288],
  ['kb-1', 'انتخاب تم، رنگ و چیدمان', 'شخصی‌سازی ظاهر پنل با سفارشی‌ساز زنده و متغیرهای CSS.', 5, 5410, 236],
  ['kb-2', 'تعریف نقش‌ها و مجوزها', 'ساخت نقش سفارشی و محدودکردن دسترسی به ماژول‌ها.', 7, 7120, 301],
  ['kb-2', 'دعوت اعضای تیم', 'ارسال دعوت‌نامه، تعیین تیم و پیگیری وضعیت پذیرش.', 3, 4380, 190],
  ['kb-2', 'ورود دومرحله‌ای و امنیت حساب', 'فعال‌سازی 2FA و مدیریت نشست‌های فعال کاربران.', 4, 3960, 204],
  ['kb-3', 'اتصال درگاه پرداخت', 'پیکربندی درگاه‌های داخلی و آزمایش تراکنش.', 8, 6870, 322],
  ['kb-3', 'صدور و ارسال فاکتور رسمی', 'قالب فاکتور، مالیات بر ارزش افزوده و ارسال ایمیلی.', 5, 4520, 211],
  ['kb-3', 'مدیریت اشتراک‌ها و تمدید خودکار', 'تعریف پلن‌ها، دوره آزمایشی و یادآوری تمدید.', 6, 3180, 142],
  ['kb-4', 'احراز هویت API با توکن', 'ساخت کلید، ارسال هدر Authorization و چرخش کلیدها.', 6, 8210, 377],
  ['kb-4', 'دریافت رویدادها با وب‌هوک', 'ثبت آدرس، تأیید امضا و تلاش مجدد خودکار.', 9, 5930, 268],
  ['kb-4', 'محدودیت نرخ و کدهای خطا', 'جدول کامل کدهای پاسخ و روش مدیریت خطای ۴۲۹.', 4, 4470, 175],
  ['kb-5', 'ساخت داشبورد اختصاصی', 'افزودن ویجت، مرتب‌سازی و ذخیره چیدمان.', 5, 3890, 166],
  ['kb-5', 'زمان‌بندی گزارش ایمیلی', 'ارسال خودکار گزارش هفتگی به مدیران.', 3, 2760, 120],
  ['kb-6', 'شروع کار با گفتگوی هوشمند', 'انتخاب مدل، تنظیم خلاقیت و استفاده از پرامپت‌ها.', 4, 3420, 181],
  ['kb-6', 'مدیریت هزینه و سهمیه توکن', 'پایش مصرف، تعیین سقف و هشدار بودجه.', 5, 2690, 133],
].map(([topic, title, excerpt, minutes, views, helpful], i) => ({ id: `art-${i + 1}`, topic, title, excerpt, minutes, views, helpful, updatedAt: date(i % 12, 10, 0) }));

export const satisfactionSeries = Array.from({ length: 12 }).map((_, i) => ({
  month: i,
  csat: float(82, 97, 1),
  response: int(6, 42),
  resolution: int(4, 26),
  reopened: int(1, 9),
  volume: int(180, 620),
}));

export default { tickets, agents, knowledgeBase, kbArticles, ticketStats, satisfactionSeries, TICKET_STATUSES, TICKET_PRIORITIES };
