/**
 * NOVAADMIN — Application demo data
 * (email, chat conversations, calendar events, file manager, media, notes)
 */
import { makeHelpers, firstNames, lastNames } from './rng.js';
import { users, customers } from './people.js';

const { int, pick, picks, bool, date, float } = makeHelpers(10010);

/* ------------------------------------------------------------------- email */
export const MAIL_FOLDERS = [
  { id: 'inbox', label: 'صندوق ورودی', icon: 'inbox', count: 12 },
  { id: 'starred', label: 'ستاره‌دار', icon: 'star', count: 4 },
  { id: 'sent', label: 'ارسال‌شده', icon: 'send', count: 0 },
  { id: 'drafts', label: 'پیش‌نویس‌ها', icon: 'file-earmark', count: 3 },
  { id: 'spam', label: 'هرزنامه', icon: 'shield-exclamation', count: 7 },
  { id: 'trash', label: 'حذف‌شده', icon: 'trash', count: 0 },
];

export const MAIL_LABELS = [
  { id: 'work', label: 'کار', color: 'var(--nv-primary)' },
  { id: 'finance', label: 'مالی', color: 'var(--nv-success)' },
  { id: 'urgent', label: 'فوری', color: 'var(--nv-danger)' },
  { id: 'personal', label: 'شخصی', color: 'var(--nv-info)' },
];

export const emails = Array.from({ length: 26 }).map((_, i) => {
  const sender = `${firstNames[(i * 3) % firstNames.length]} ${lastNames[(i * 5) % lastNames.length]}`;
  const folder = pick(['inbox', 'inbox', 'inbox', 'inbox', 'sent', 'drafts', 'spam', 'trash', 'starred']);
  return {
    id: `em-${i + 1}`,
    from: sender,
    fromEmail: `sender${i + 1}@${pick(['novaadmin.dev', 'company.ir', 'partner.com', 'newsletter.io'])}`,
    avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
    to: 'sara@novaadmin.dev',
    subject: pick([
      'پیش‌فاکتور خرید سالانه پلتفرم', 'گزارش عملکرد هفتگی تیم فروش', 'درخواست جلسه بررسی قرارداد',
      'اعلان تغییر درگاه پرداخت', 'خلاصه جلسه بازبینی محصول', 'دعوت به وبینار هوش مصنوعی',
      'صورت‌حساب ماهانه سرویس ابری', 'پیشنهاد همکاری تجاری', 'خطای گزارش‌شده در محیط عملیاتی',
      'به‌روزرسانی سیاست حریم خصوصی',
    ]),
    preview: 'سلام، امیدوارم حالتان خوب باشد. در پی بررسی‌های انجام‌شده، خلاصه نتایج و اقدامات لازم را ارسال می‌کنم…',
    body: [
      'سلام، وقت بخیر.',
      'در پی بررسی‌های انجام‌شده در جلسه گذشته، خلاصه نتایج و اقدامات پیشنهادی را خدمتتان ارسال می‌کنم. لطفاً در صورت نیاز به تغییرات، تا پایان هفته جاری اعلام بفرمایید تا در برنامه‌ریزی Sprint بعدی لحاظ شود.',
      'نکات کلیدی: تعیین اولویت ماژول گزارش‌ها، بازبینی ساختار دسترسی‌ها و آماده‌سازی مستندات آموزشی برای تیم مشتری.',
      'با احترام',
    ],
    folder,
    labels: picks(MAIL_LABELS, int(0, 2)).map((l) => l.id),
    starred: folder === 'starred' || bool(0.2),
    unread: bool(0.45),
    important: bool(0.3),
    hasAttachment: bool(0.4),
    attachments: bool(0.4) ? picks([
      { name: 'proposal.pdf', size: '2.4 MB' },
      { name: 'financial-report.xlsx', size: '860 KB' },
      { name: 'contract-v2.docx', size: '320 KB' },
      { name: 'dashboard-mockup.png', size: '1.8 MB' },
    ], int(1, 2)) : [],
    at: date(int(0, 30), int(8, 22), int(0, 59)),
    size: `${int(20, 900)} KB`,
  };
});

/* -------------------------------------------------------------------- chat */
export const conversations = Array.from({ length: 9 }).map((_, i) => {
  const user = users[(i * 5) % users.length];
  const count = int(4, 9);
  return {
    id: `cv-${i + 1}`,
    name: user.name,
    avatar: user.avatar,
    role: user.roleLabel,
    online: i < 4,
    status: i < 4 ? 'online' : pick(['away', 'offline']),
    pinned: i < 2,
    unread: i === 0 ? 2 : 0,
    lastSeen: date(0, int(8, 22), int(0, 59)),
    messages: Array.from({ length: count }).map((__, m) => ({
      id: `cm-${i}-${m}`,
      side: m % 2 === 0 ? 'in' : 'out',
      author: m % 2 === 0 ? user.name : 'سارا محمدی',
      avatar: m % 2 === 0 ? user.avatar : 'assets/img/avatars/avatar-08.svg',
      text: pick([
        'سلام سارا، گزارش این هفته را بررسی کردم؛ فقط بخش دسترسی‌ها نیاز به اصلاح دارد.',
        'ممنون از پیگیری. تا امروز عصر نسخه اصلاح‌شده را ارسال می‌کنم.',
        'جلسه فردا ساعت ۱۰ صبح برگزار می‌شود، لینک را همین‌جا می‌فرستم.',
        'فایل طراحی نهایی را در فضای اشتراکی بارگذاری کردم.',
        'اگر امکان دارد، فهرست تسک‌های باقی‌مانده را با اولویت ارسال کنید.',
        'عالی است؛ با این برنامه پیش می‌رویم.',
      ]),
      time: `${String(int(8, 22)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}`,
      reactions: bool(0.2) ? ['👍', '🎉'] : [],
      attachments: bool(0.15) ? [{ name: 'design-final.fig', size: '4.2 MB' }] : [],
    })),
  };
});

/* ---------------------------------------------------------------- calendar */
export const CALENDAR_CATEGORIES = [
  { id: 'meeting', label: 'جلسه', tone: 'primary' },
  { id: 'task', label: 'تسک', tone: 'info' },
  { id: 'event', label: 'رویداد', tone: 'success' },
  { id: 'holiday', label: 'تعطیل', tone: 'danger' },
  { id: 'personal', label: 'شخصی', tone: 'violet' },
];

export const calendarEvents = Array.from({ length: 34 }).map((_, i) => {
  const dayOffset = int(-16, 24);
  const startHour = int(8, 18);
  const duration = pick([30, 45, 60, 90, 120]);
  return {
    id: `ev-${i + 1}`,
    title: pick([
      'جلسه بازبینی اسپرینت', 'دمو محصول برای مشتری', 'مصاحبه استخدامی', 'جلسه مالی ماهانه',
      'کارگاه طراحی رابط کاربری', 'تماس با تیم فنی', 'بازبینی قرارداد', 'آموزش تیم پشتیبانی',
      'بررسی گزارش عملکرد', 'جلسه هم‌راستایی محصول', 'رویداد معرفی نسخه جدید',
    ]),
    category: pick(CALENDAR_CATEGORIES).id,
    dayOffset,
    start: `${String(startHour).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`,
    duration,
    location: pick(['اتاق جلسات ۱', 'آنلاین — Google Meet', 'دفتر مشتری', 'اتاق جلسات ۳', 'وبینار']),
    attendees: picks(users, int(2, 5)).map((u) => ({ name: u.name, avatar: u.avatar })),
    description: 'بررسی وضعیت پیشرفت، رفع موانع و تعیین اقدامات هفته آینده.',
    reminder: pick(['۱۵ دقیقه قبل', '۳۰ دقیقه قبل', '۱ ساعت قبل', 'بدون یادآور']),
    allDay: bool(0.12),
  };
}).map((e) => {
  const d = new Date();
  d.setDate(d.getDate() + e.dayOffset);
  d.setHours(Number(e.start.split(':')[0]), Number(e.start.split(':')[1]), 0, 0);
  return { ...e, startAt: d.toISOString(), endAt: new Date(d.getTime() + e.duration * 60000).toISOString() };
});

/* ------------------------------------------------------------ file manager */
export const FILE_TYPES = {
  folder: { icon: 'folder-fill', tone: 'folder' },
  image: { icon: 'file-earmark-image', tone: 'image' },
  pdf: { icon: 'file-earmark-pdf', tone: 'pdf' },
  sheet: { icon: 'file-earmark-spreadsheet', tone: 'sheet' },
  doc: { icon: 'file-earmark-text', tone: 'doc' },
  video: { icon: 'file-earmark-play', tone: 'video' },
  archive: { icon: 'file-earmark-zip', tone: 'archive' },
  code: { icon: 'file-earmark-code', tone: 'code' },
};

export const fileSystem = [
  { id: 'f-1', name: 'مستندات پروژه', type: 'folder', items: 42, size: '—', owner: 'سارا محمدی', at: date(2, 10, 0), shared: true },
  { id: 'f-2', name: 'طرح‌های رابط کاربری', type: 'folder', items: 128, size: '—', owner: 'نگار کریمی', at: date(1, 15, 20), shared: true },
  { id: 'f-3', name: 'گزارش‌های مالی', type: 'folder', items: 18, size: '—', owner: 'الهام رستمی', at: date(5, 9, 45), shared: false },
  { id: 'f-4', name: 'قراردادها', type: 'folder', items: 9, size: '—', owner: 'شیما امینی', at: date(9, 11, 30), shared: false },
  { id: 'f-5', name: 'گزارش-فروش-مهر.pdf', type: 'pdf', size: '2.8 MB', owner: 'رضا نوری', at: date(1, 16, 10), shared: true },
  { id: 'f-6', name: 'صورت‌های-مالی-فصلی.xlsx', type: 'sheet', size: '1.2 MB', owner: 'الهام رستمی', at: date(3, 12, 0), shared: false },
  { id: 'f-7', name: 'داشبورد-مدیریت.png', type: 'image', size: '3.4 MB', owner: 'نگار کریمی', at: date(0, 14, 25), shared: true },
  { id: 'f-8', name: 'دمو-محصول.mp4', type: 'video', size: '148 MB', owner: 'امیر طاهری', at: date(6, 18, 40), shared: true },
  { id: 'f-9', name: 'مستندات-API.md', type: 'code', size: '86 KB', owner: 'کیان احمدی', at: date(0, 9, 15), shared: false },
  { id: 'f-10', name: 'آرشیو-پروژه-۱۴۰۳.zip', type: 'archive', size: '684 MB', owner: 'سارا محمدی', at: date(22, 10, 5), shared: false },
  { id: 'f-11', name: 'بروشور-شرکت.pdf', type: 'pdf', size: '4.6 MB', owner: 'پریسا کاظمی', at: date(12, 13, 35), shared: true },
  { id: 'f-12', name: 'نقشه-راه-محصول.docx', type: 'doc', size: '340 KB', owner: 'محمد نوری', at: date(4, 11, 10), shared: false },
  { id: 'f-13', name: 'لوگو-نسخه-نهایی.svg', type: 'image', size: '48 KB', owner: 'نگار کریمی', at: date(8, 16, 0), shared: true },
  { id: 'f-14', name: 'تحلیل-رقبا.xlsx', type: 'sheet', size: '760 KB', owner: 'شیما امینی', at: date(7, 15, 45), shared: false },
  { id: 'f-15', name: 'اسکریپت-مهاجرت.js', type: 'code', size: '24 KB', owner: 'امیر طاهری', at: date(2, 17, 20), shared: false },
  { id: 'f-16', name: 'گزارش-پشتیبانی.pdf', type: 'pdf', size: '1.9 MB', owner: 'مریم صادقی', at: date(3, 10, 30), shared: true },
];

export const mediaLibrary = Array.from({ length: 24 }).map((_, i) => ({
  id: `md-${i + 1}`,
  name: `media-${String(i + 1).padStart(2, '0')}.svg`,
  url: `assets/img/products/product-${String((i % 24) + 1).padStart(2, '0')}.svg`,
  type: 'image',
  size: `${int(80, 2400)} KB`,
  dimensions: pick(['1200×800', '800×800', '1920×1080', '640×480']),
  uploadedBy: pick(users).name,
  at: date(int(0, 90), int(9, 20)),
  tags: picks(['محصول', 'بنر', 'سوشال', 'کاتالوگ', 'پروفایل'], 2),
}));

export const storage = { used: 68.4, total: 200, files: 14_286, folders: 486 };

/* ------------------------------------------------------------------- notes */
export const notes = Array.from({ length: 8 }).map((_, i) => ({
  id: `nt-${i + 1}`,
  title: pick(['چک‌لیست راه‌اندازی مشتری', 'ایده‌های کمپین پاییز', 'نکات جلسه با تیم فنی', 'برنامه سفر کاری', 'یادداشت بازبینی قرارداد']),
  body: 'موارد مهم این یادداشت برای پیگیری در جلسه بعدی جمع‌آوری شده است.',
  color: pick(['primary', 'success', 'warning', 'info', 'danger']),
  pinned: bool(0.35),
  at: date(int(0, 20), int(8, 21), int(0, 59)),
}));

export const emojiSet = ['😀', '😄', '😉', '😍', '🤝', '👍', '🙏', '🔥', '✨', '🎉', '📌', '💡', '✅', '📈', '🚀', '❤️'];

export const chatFiles = [
  { name: 'brand-guide.pdf', size: '2.1 MB' },
  { name: 'موکاپ-داشبورد.fig', size: '6.8 MB' },
  { name: 'sprint-plan.xlsx', size: '420 KB' },
];

export const presence = customers.slice(0, 6).map((c, i) => ({
  id: `pr-${i + 1}`,
  name: c.contact,
  avatar: c.avatar,
  company: c.company,
  status: i % 3 === 0 ? 'online' : i % 3 === 1 ? 'away' : 'offline',
  satisfaction: float(3.6, 5, 1),
}));

export default {
  emails,
  MAIL_FOLDERS,
  MAIL_LABELS,
  conversations,
  calendarEvents,
  CALENDAR_CATEGORIES,
  fileSystem,
  FILE_TYPES,
  mediaLibrary,
  storage,
  notes,
  emojiSet,
  chatFiles,
  presence,
};
