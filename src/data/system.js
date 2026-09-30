/**
 * NOVAADMIN — System & marketing content data
 * (search index, changelog, FAQ, status page, pricing, help centre, settings)
 */
import { config } from '../config/config.js';
import { pageMeta, pageTitles } from '../locales/generated.js';

const SECTION_LABELS = {
  main: 'اصلی',
  applications: 'اپلیکیشن‌ها',
  'users-access': 'کاربران و دسترسی‌ها',
  'reports-content': 'گزارش‌ها و محتوا',
  'account-settings': 'حساب و تنظیمات',
  developers: 'توسعه‌دهندگان',
  app: 'سیستم',
  '': 'سایر',
};

/**
 * Flat page index used by the command palette, global search and 404 pages.
 * Built from the auto-generated page metadata (`src/locales/generated.js`) so
 * it can never drift from the pages that actually ship.
 */
export function buildSearchIndex(lang = 'fa') {
  const titles = pageTitles[lang] ?? pageTitles.fa ?? {};
  return Object.entries(pageMeta).map(([url, meta]) => {
    const title = titles[url] ?? pageTitles.fa?.[url] ?? url;
    const parentTitles = (meta.parents ?? [])
      .map((p) => titles[p.url] ?? pageTitles.fa?.[p.url] ?? p.id)
      .join(' / ');
    const sectionLabel = SECTION_LABELS[meta.section] ?? meta.section ?? 'سایر';
    return {
      id: url,
      title,
      url,
      section: sectionLabel,
      kind: meta.kind,
      description: parentTitles ? `${parentTitles} — ${title}` : `${sectionLabel} — ${title}`,
    };
  });
}

export const commands = [
  { id: 'cmd-dashboards', group: 'داشبوردها', items: config.demos.map((d) => ({ label: `${d.label.fa}`, hint: 'داشبورد', url: `dashboards/${d.id}.html`, icon: d.icon })) },
  { id: 'cmd-apps', group: 'اپلیکیشن‌ها', items: [
    { label: 'کارگاه هوش مصنوعی', hint: 'AI', url: 'ai/dashboard.html', icon: 'stars' },
    { label: 'محصولات', hint: 'فروشگاه', url: 'ecommerce/products.html', icon: 'box-seam' },
    { label: 'سفارش‌ها', hint: 'فروشگاه', url: 'ecommerce/orders.html', icon: 'receipt' },
    { label: 'قیف فروش', hint: 'CRM', url: 'crm/pipeline.html', icon: 'kanban-fill' },
    { label: 'کانبان پروژه', hint: 'پروژه‌ها', url: 'projects/kanban.html', icon: 'kanban' },
    { label: 'تقویم', hint: 'ابزار', url: 'apps/calendar.html', icon: 'calendar3' },
    { label: 'ایمیل', hint: 'ارتباطات', url: 'apps/email.html', icon: 'envelope' },
    { label: 'مدیریت فایل', hint: 'ابزار', url: 'apps/file-manager.html', icon: 'folder2-open' },
  ] },
  { id: 'cmd-system', group: 'سیستم', items: [
    { label: 'مدیریت کاربران', hint: 'کاربران', url: 'users/list.html', icon: 'people' },
    { label: 'نقش‌ها و دسترسی‌ها', hint: 'امنیت', url: 'users/roles.html', icon: 'shield-check' },
    { label: 'تنظیمات عمومی', hint: 'تنظیمات', url: 'settings/general.html', icon: 'gear' },
    { label: 'کیت رابط کاربری', hint: 'توسعه', url: 'ui/buttons.html', icon: 'palette2' },
    { label: 'مستندات', hint: 'راهنما', url: 'docs/introduction.html', icon: 'book-half' },
  ] },
  { id: 'cmd-actions', group: 'کنش‌ها', items: [
    { id: 'toggle-theme', label: 'تغییر حالت روشن/تاریک', hint: 'میانبر', action: 'theme', icon: 'moon-stars' },
    { id: 'toggle-language', label: 'تغییر زبان', hint: 'میانبر', action: 'language', icon: 'translate' },
    { id: 'open-customizer', label: 'شخصی‌سازی تم', hint: 'میانبر', action: 'customizer', icon: 'palette' },
    { id: 'open-shortcuts', label: 'کلیدهای میانبر', hint: 'میانبر', action: 'shortcuts', icon: 'keyboard' },
    { id: 'toggle-sidebar', label: 'جمع/باز کردن منو', hint: 'میانبر', action: 'sidebar', icon: 'layout-sidebar-inset' },
    { id: 'logout', label: 'خروج از حساب', hint: 'حساب', action: 'logout', icon: 'box-arrow-right' },
  ] },
];

export const shortcuts = [
  { keys: ['Ctrl', 'K'], label: 'پالت فرمان / جستجوی سراسری', group: 'عمومی' },
  { keys: ['Ctrl', '/'], label: 'نمایش کلیدهای میانبر', group: 'عمومی' },
  { keys: ['Esc'], label: 'بستن پنجره‌ها و پنل‌ها', group: 'عمومی' },
  { keys: ['↑', '↓'], label: 'پیمایش بین نتایج', group: 'عمومی' },
  { keys: ['Enter'], label: 'انتخاب گزینه فعال', group: 'عمومی' },
  { keys: ['Ctrl', 'B'], label: 'جمع/باز کردن سایدبار', group: 'چیدمان' },
  { keys: ['Ctrl', 'Shift', 'D'], label: 'تغییر تم روشن/تاریک', group: 'چیدمان' },
  { keys: ['Ctrl', 'Shift', 'L'], label: 'تغییر زبان', group: 'چیدمان' },
  { keys: ['Alt', 'N'], label: 'افزودن مورد جدید', group: 'کنش‌ها' },
  { keys: ['Alt', 'E'], label: 'خروجی گرفتن از جدول', group: 'کنش‌ها' },
  { keys: ['Shift', '?'], label: 'راهنمای میانبرها', group: 'کنش‌ها' },
];

/**
 * Release history shown on `system/changelog.html` (newest first). Keep it in sync
 * with CHANGELOG.md. `status: 'planned'` marks roadmap entries that are not shipped.
 * Item types: added | improved | changed | fixed | removed.
 */
export const changelog = [
  {
    version: '1.1.0',
    date: '۱۴۰۵/۰۷/۰۸',
    type: 'minor',
    badge: 'نسخه فعلی',
    highlights: 'نسخه کیفیت و پایداری: ورود و نشست بازنویسی شد، همه صفحه‌ها از ۳۲۰ پیکسل به بالا بازبینی شدند و ابزارهای کشیدن‌ورها کردن، استودیو تصاویر محصول و دسته‌بندی‌ها از نو ساخته شدند.',
    items: [
      { type: 'added', text: 'حالت انگلیسی اکنون داده‌های نمونه داخل داشبوردها را هم ترجمه می‌کند: جدول‌ها، کارت‌ها، نمودارها، نام‌ها، شرکت‌ها، شهرها، وضعیت‌ها، پنجره‌ها و پاسخ‌های نمونه دستیار هوش مصنوعی — با واژه‌نامه محتوایی که فقط در حالت انگلیسی بارگذاری می‌شود.' },
      { type: 'fixed', text: 'در حالت انگلیسی ارقام به‌صورت لاتین نمایش داده می‌شوند و متن‌های ترکیبی (عدد + واحد، تاریخ، عنوان — فاز) بدون اختلاط فارسی و انگلیسی ترجمه می‌شوند.' },
      { type: 'added', text: 'ویرایشگر ویجت داشبوردها: پنهان‌سازی و مرتب‌سازی ویجت‌ها برای هر داشبورد ذخیره می‌شود و دکمه بازگردانی پیش‌فرض دارد' },
      { type: 'fixed', text: 'مقادیر خام انگلیسی (paid، on-hold، industry و…) در نشان‌ها، جزئیات رکورد، گزینه‌ها و راهنمای نمودارها به برچسب فارسی تبدیل شدند' },
      { type: 'fixed', text: 'حضور و غیاب: نام کارمند، کارکرد و نمودار ۳۰ روزه درست نمایش داده می‌شود' },
      { type: 'fixed', text: 'دکمه‌های تکراری ایجاد/خروجی در سربرگ صفحه‌های فهرست و داشبوردها حذف شدند' },
      { type: 'fixed', text: 'رنگ برچسب‌های فروشگاه با نقطه رنگی و نام فارسی نمایش داده می‌شود' },
      { type: 'fixed', text: 'خروج ناگهانی و دوره‌ای از داشبورد برطرف شد؛ نشست با انقضای لغزان ۱۴ روزه، همگام‌سازی بین تب‌ها و نگهبان مسیر یکپارچه مدیریت می‌شود' },
      { type: 'fixed', text: 'دکمه «ورود» در صفحه اصلی دیگر بدون نمایش فرم ورود مستقیم به داشبورد نمی‌رود؛ فقط نشست معتبر کاربر را عبور می‌دهد' },
      { type: 'fixed', text: 'همه مودال‌های ایجاد و ویرایش (سفارش، معامله، پروژه، تیکت، کارمند، کاربر و…) در موبایل کامل دیده می‌شوند: بدنه قابل‌اسکرول، سربرگ با دکمه بستن و دکمه‌های ذخیره همیشه در دسترس' },
      { type: 'fixed', text: 'دکمه‌های خروجی در سربرگ کارت‌ها و صفحه‌ها (مدیریت پروژه، پشتیبانی، هوش مصنوعی، محصولات، سفارش‌ها، سرنخ‌ها، کاربران) دیگر از کادر بیرون نمی‌زنند' },
      { type: 'fixed', text: 'جدول‌های موجودی انبار، حقوق و دستمزد، استخدام، محموله‌ها، دعوت‌نامه‌ها و سایر جدول‌ها در موبایل به کارت‌های خوانا با همه ستون‌ها تبدیل می‌شوند' },
      { type: 'fixed', text: 'قفل‌شدن تقویم حرفه‌ای با لمس رویداد در موبایل برطرف شد؛ نمای روز به فهرست برنامه روزانه تبدیل می‌شود' },
      { type: 'fixed', text: 'سرریز متن و مبلغ در جزئیات سفارش، آمار فاکتورها (وصول‌شده، سررسید، معوق) و کارت‌های شاخص در گوشی‌ها' },
      { type: 'fixed', text: 'همپوشانی تصویر با دکمه «باز کردن گفتگو» در بخش فضای کار هوش مصنوعی صفحه اصلی' },
      { type: 'fixed', text: 'دکمه منوی همبرگری صفحه اصلی فقط در موبایل نمایش داده می‌شود' },
      { type: 'fixed', text: 'تغییر زبان در صفحه ورود اکنون همه متن‌های فرم، پنل معرفی و پیام‌ها را ترجمه می‌کند' },
      { type: 'fixed', text: 'جدول فعالیت‌های CRM با ۵۶ فعالیت نمونه (تماس، جلسه، ایمیل، وظیفه) پر شد' },
      { type: 'fixed', text: 'سرریز برچسب‌ها و نوع تصاویر در گالری استودیو تصویر هوش مصنوعی' },
      { type: 'improved', text: 'قیف فروش CRM و کانبان پروژه: جابجایی روان با لمس و ماوس، منوی «انتقال به»، امکان بازگردانی و ذخیره چیدمان کارت‌ها' },
      { type: 'improved', text: 'استودیو تصاویر محصول در صفحه ایجاد محصول: تصویر شاخص، ترتیب با کشیدن، پیش‌نمایش بزرگ و آپلود چندگانه' },
      { type: 'improved', text: 'دسته‌بندی محصولات کاملاً بازطراحی شد: نمای درختی، کلید وضعیت خوانا، جستجو و ویرایش سریع' },
      { type: 'improved', text: 'سربرگ پروفایل کارمند: نام و اطلاعات دیگر زیر کاور پنهان نمی‌شوند و در همه عرض‌ها مرتب چیده می‌شوند' },
      { type: 'improved', text: 'چت تیمی، چت هوش مصنوعی و ایمیل در موبایل: نمای فهرست/گفتگو جدا، ریل پوشه‌های افقی و بدون همپوشانی متن' },
      { type: 'improved', text: 'صفحه‌ساز CMS در موبایل: دکمه‌های بالا، پایین و حذف بلوک در نوار ابزار خود بلوک و قابل لمس' },
      { type: 'improved', text: 'فرم‌های ویرایش همه جدول‌ها با برچسب و گزینه‌های کاملاً فارسی (نقش، نوع، وضعیت) و ورودی چپ‌چین برای تلفن، ایمیل و شبا' },
      { type: 'improved', text: 'نمودار گانت خط زمان پروژه‌ها در موبایل: ستون پروژه ثابت، اسکرول افقی روان و باز شدن روی «امروز»' },
      { type: 'added', text: 'نمای شبکه‌ای کاربران با ویرایش و حذف مستقیم از کارت' },
      { type: 'changed', text: 'نوار شاخص‌ها و صفحه‌بندی جدول‌ها در گوشی‌های باریک (۳۲۰ پیکسل) فشرده و بدون اسکرول افقی' },
      { type: 'removed', text: 'گزینه‌های چیدمان، جهت، تراکم و سبک سایدبار از پنجره شخصی‌سازی حذف شدند تا ساختار پنل هرگز شکسته نشود؛ جهت صفحه خودکار از زبان پیروی می‌کند' },
    ],
  },
  {
    version: '1.0.6',
    date: '۱۴۰۵/۰۷/۰۷',
    type: 'patch',
    highlights: 'نقشه‌ها و مرکز اعلان‌ها',
    items: [
      { type: 'improved', text: 'زنجیره جایگزین ارائه‌دهنده کاشی نقشه تا نقشه‌ها هیچ‌وقت خالی نمانند' },
      { type: 'improved', text: 'مرکز اعلان‌ها با دسته‌بندی، اولویت و کنش مستقیم' },
    ],
  },
  {
    version: '1.0.5',
    date: '۱۴۰۵/۰۷/۰۷',
    type: 'patch',
    highlights: 'ریسپانسیو ۲۰۷ صفحه',
    items: [
      { type: 'added', text: 'تنظیم کلید API نقشه از فایل پیکربندی' },
      { type: 'fixed', text: 'بازبینی ریسپانسیو همه صفحه‌ها' },
    ],
  },
  {
    version: '1.0.4',
    date: '۱۴۰۵/۰۷/۰۷',
    type: 'patch',
    highlights: 'تغییر زبان و نوار بالا',
    items: [
      { type: 'fixed', text: 'تغییر زبان در صفحه‌های محصول و احراز هویت' },
      { type: 'improved', text: 'نوار بالای داشبورد در عرض‌های بزرگ' },
    ],
  },
  {
    version: '1.0.3',
    date: '۱۴۰۵/۰۷/۰۶',
    type: 'patch',
    highlights: 'استایل‌ها و دسترس‌پذیری',
    items: [
      { type: 'fixed', text: 'افزودن ۳۳ کلاس CSS جاافتاده' },
      { type: 'fixed', text: 'کلیدهای نمایش رمز و گزینه‌های فرم‌های احراز هویت' },
      { type: 'improved', text: 'برچسب‌های دسترس‌پذیری و ترتیب فوکوس' },
    ],
  },
  {
    version: '1.0.2',
    date: '۱۴۰۵/۰۷/۰۲',
    type: 'patch',
    highlights: 'قیمت‌گذاری، اعداد و SEO',
    items: [
      { type: 'fixed', text: 'نمایش قیمت‌ها و ویژگی‌های پلن‌ها' },
      { type: 'fixed', text: 'یکدست‌سازی اعداد فارسی' },
      { type: 'improved', text: 'متادیتای SEO صفحه‌ها' },
    ],
  },
  {
    version: '1.0.1',
    date: '۱۴۰۵/۰۷/۰۱',
    type: 'patch',
    highlights: 'اصلاحات پس از انتشار',
    items: [
      { type: 'fixed', text: 'تغییر زبان، پیش‌نمایش محصول و فرم‌های احراز هویت' },
      { type: 'fixed', text: 'جدول‌ها و نمودارها' },
    ],
  },
  {
    version: '1.0.0',
    date: '۱۴۰۵/۰۶/۳۱',
    type: 'major',
    highlights: 'انتشار نسخه اولیه محصول',
    items: [
      { type: 'added', text: '۱۰ داشبورد تخصصی (آنالیتیکس، فروشگاهی، CRM، SaaS، مالی، پروژه، منابع انسانی، پشتیبانی، هوش مصنوعی، لجستیک)' },
      { type: 'added', text: 'کارگاه هوش مصنوعی با ۱۲ صفحه شامل چت، نویسنده، خلاصه‌ساز و کتابخانه پرامپت' },
      { type: 'added', text: 'پشتیبانی کامل RTL/LTR با CSS Logical Properties' },
      { type: 'added', text: 'تقویم شمسی و میلادی، سه زبان فارسی، انگلیسی و عربی' },
      { type: 'added', text: 'شش رنگ اصلی، حالت روشن/تاریک/سیستم' },
      { type: 'added', text: 'کیت رابط کاربری با بیش از ۴۰ کامپوننت' },
      { type: 'added', text: 'پالت فرمان، جستجوی سراسری و شخصی‌سازی زنده تم' },
    ],
  },
];

export const faq = [
  { q: 'آیا برای استفاده از قالب به بک‌اند نیاز دارم؟', a: 'خیر. تمام صفحات با داده‌های نمونه کار می‌کنند و می‌توانید آن‌ها را مستقیم روی هر هاست استاتیک منتشر کنید. برای اتصال به سرویس واقعی، لایه سرویس‌ها آماده است.' },
  { q: 'پشتیبانی از RTL و LTR چگونه پیاده‌سازی شده است؟', a: 'همه استایل‌ها با CSS Logical Properties نوشته شده‌اند و جهت صفحه از طریق صفت dir روی تگ html کنترل می‌شود؛ بنابراین هیچ استایل تکراری برای RTL وجود ندارد.' },
  { q: 'آیا تقویم شمسی واقعی است؟', a: 'بله. تبدیل تاریخ با کتابخانه jalaali-js انجام می‌شود و تقویم کامل با نمایش ماه، هفته، روز و برنامه زمانی، شمسی و میلادی را پوشش می‌دهد.' },
  { q: 'چگونه رنگ اصلی را تغییر دهم؟', a: 'از پنجره «شخصی‌سازی تم» یکی از شش رنگ آماده را انتخاب کنید یا مقدار data-primary روی تگ html را تغییر دهید. توکن‌های رنگ به‌صورت خودکار در همه کامپوننت‌ها اعمال می‌شود.' },
  { q: 'آیا می‌توانم فونت را تغییر دهم؟', a: 'بله. فونت وزیرمتن به‌صورت متغیر همراه قالب ارائه می‌شود. برای تغییر، توکن --nv-font-sans را در فایل base/_fonts.scss به فونت دلخواه تغییر دهید.' },
  { q: 'ساختار پروژه چگونه است؟', a: 'پوشه src شامل pages، partials، scss، js، data و locales است. هر صفحه HTML مستقل است و از طریق ابزارهای tools قابل بازتولید می‌باشد.' },
  { q: 'آیا صفحات قابل ویرایش مستقیم هستند؟', a: 'بله. هر صفحه یک فایل HTML واقعی با ساختار مشخص است؛ می‌توانید آن را در هر ویرایشگری باز کرده و تغییر دهید.' },
  { q: 'چگونه داده‌ها را به API واقعی متصل کنم؟', a: 'در فایل config مقدار api.useMocks را false کنید و baseUrl را تنظیم نمایید. لایه سرویس‌ها همان قرارداد متدها را حفظ می‌کند.' },
  { q: 'آیا نسخه رایگان هم دارد؟', a: 'بله؛ نسخه رایگان شامل چند داشبورد، بخشی از کامپوننت‌ها و پشتیبانی کامل RTL و حالت تاریک است. نسخه کامل شامل همه ماژول‌ها، کارگاه هوش مصنوعی و مستندات است.' },
  { q: 'پشتیبانی و به‌روزرسانی چگونه است؟', a: 'خریداران نسخه کامل به به‌روزرسانی‌های نسخه ۱.x دسترسی دارند و می‌توانند پرسش‌های فنی خود را از طریق ایمیل پشتیبانی مطرح کنند.' },
];

export const pricingPlans = [
  {
    id: 'free', name: 'رایگان', price: 0, period: 'همیشه', featured: false, badge: '',
    description: 'برای آشنایی با ساختار و شروع پروژه‌های کوچک',
    features: [
      { text: '۳ داشبورد آماده', included: true },
      { text: 'RTL و LTR کامل', included: true },
      { text: 'حالت روشن و تاریک', included: true },
      { text: 'کیت رابط محدود', included: true },
      { text: 'کارگاه هوش مصنوعی', included: false },
      { text: 'مستندات کامل', included: false },
    ],
    cta: 'شروع رایگان',
  },
  {
    id: 'personal', name: 'شخصی', price: 2_450_000, period: 'یک‌بار برای همیشه', featured: false, badge: '',
    description: 'مناسب فریلنسرها و پروژه‌های شخصی',
    features: [
      { text: 'همه ۲۰۶ صفحه قالب', included: true },
      { text: '۱۰ داشبورد تخصصی', included: true },
      { text: 'کارگاه هوش مصنوعی', included: true },
      { text: 'شش رنگ اصلی و حالت تاریک', included: true },
      { text: 'یک سال به‌روزرسانی', included: true },
      { text: 'پشتیبانی فنی', included: false },
    ],
    cta: 'خرید نسخه شخصی',
  },
  {
    id: 'extended', name: 'تجاری', price: 6_800_000, period: 'یک‌بار برای همیشه', featured: true, badge: 'پیشنهاد ما',
    description: 'برای استودیوها و محصولات تجاری',
    features: [
      { text: 'همه امکانات نسخه شخصی', included: true },
      { text: 'مستندات کامل و راهنمای استقرار', included: true },
      { text: 'پکیج آماده انتشار در مارکت‌ها', included: true },
      { text: 'دسترسی به فایل‌های طراحی', included: true },
      { text: 'دو سال به‌روزرسانی', included: true },
      { text: 'پشتیبانی فنی اختصاصی', included: true },
    ],
    cta: 'خرید نسخه تجاری',
  },
  {
    id: 'enterprise', name: 'سازمانی', price: null, period: 'تماس بگیرید', featured: false, badge: '',
    description: 'برای تیم‌های بزرگ و سفارشی‌سازی اختصاصی',
    features: [
      { text: 'همه امکانات نسخه تجاری', included: true },
      { text: 'سفارشی‌سازی اختصاصی رابط', included: true },
      { text: 'آموزش تیم توسعه', included: true },
      { text: 'قرارداد SLA', included: true },
      { text: 'پشتیبانی اولویت‌دار', included: true },
      { text: 'دسترسی به نسخه‌های پیش‌انتشار', included: true },
    ],
    cta: 'تماس با فروش',
  },
];

export const statusServices = [
  { id: 'api', name: 'API عمومی', uptime: 99.98, state: 'operational', response: 184 },
  { id: 'dashboard', name: 'داشبورد مدیریت', uptime: 99.99, state: 'operational', response: 96 },
  { id: 'ai', name: 'سرویس هوش مصنوعی', uptime: 99.72, state: 'degraded', response: 1_240 },
  { id: 'storage', name: 'ذخیره‌سازی فایل', uptime: 99.95, state: 'operational', response: 210 },
  { id: 'email', name: 'ارسال ایمیل تراکنشی', uptime: 99.89, state: 'operational', response: 640 },
  { id: 'payments', name: 'درگاه پرداخت', uptime: 99.94, state: 'operational', response: 320 },
];

export const statusIncidents = [
  { id: 'inc-1', title: 'افزایش زمان پاسخ در سرویس هوش مصنوعی', state: 'investigating', at: '۲ ساعت پیش', updates: ['بررسی لاگ‌های صف پردازش در جریان است.', 'ترافیک ورودی ۴۰٪ بیشتر از حد معمول بوده است.'] },
  { id: 'inc-2', title: 'کندی موقت در گزارش‌های سنگین', state: 'resolved', at: '۳ روز پیش', updates: ['افزایش منابع کوئری‌های سنگین', 'مانیتورینگ برای ۴۸ ساعت فعال شد.'] },
  { id: 'inc-3', title: 'خطای ورود با احراز هویت دو مرحله‌ای', state: 'resolved', at: '۹ روز پیش', updates: ['همگام‌سازی زمان سرور اصلاح شد.'] },
];

export const statusUptimeBars = Array.from({ length: 60 }).map((_, i) => ({
  day: i,
  state: i === 41 ? 'degraded' : i === 57 ? 'down' : 'operational',
}));

export const helpTopics = [
  { id: 'ht-1', title: 'شروع سریع', description: 'نصب، اجرا و ساخت اولین نسخه از قالب', icon: 'rocket', articles: 12, color: 'primary' },
  { id: 'ht-2', title: 'سفارشی‌سازی تم', description: 'رنگ‌ها، فونت‌ها، چیدمان و حالت تاریک', icon: 'palette2', articles: 9, color: 'violet' },
  { id: 'ht-3', title: 'RTL و چندزبانه', description: 'کنترل جهت صفحه، ترجمه‌ها و تقویم شمسی', icon: 'translate', articles: 7, color: 'info' },
  { id: 'ht-4', title: 'کامپوننت‌ها', description: 'جدول داده، فرم، نمودار، تقویم و کانبان', icon: 'puzzle', articles: 18, color: 'success' },
  { id: 'ht-5', title: 'اتصال به API', description: 'لایه سرویس‌ها، احراز هویت و مدیریت خطا', icon: 'code-slash', articles: 11, color: 'warning' },
  { id: 'ht-6', title: 'استقرار', description: 'هاست استاتیک، cPanel، Vercel و Netlify', icon: 'cloud-upload', articles: 6, color: 'primary' },
];

export const helpArticles = [
  { id: 'ha-1', title: 'نصب قالب با npm و اجرای محیط توسعه', topic: 'شروع سریع', views: 18_420, updatedAt: '۳ روز پیش', readTime: '۴ دقیقه' },
  { id: 'ha-2', title: 'تغییر رنگ اصلی بدون دست‌زدن به کد کامپوننت‌ها', topic: 'سفارشی‌سازی تم', views: 12_860, updatedAt: '۱ هفته پیش', readTime: '۶ دقیقه' },
  { id: 'ha-3', title: 'افزودن زبان جدید به قالب', topic: 'RTL و چندزبانه', views: 9_240, updatedAt: '۲ هفته پیش', readTime: '۸ دقیقه' },
  { id: 'ha-4', title: 'استفاده از جدول داده با فیلتر و خروجی CSV', topic: 'کامپوننت‌ها', views: 14_180, updatedAt: '۵ روز پیش', readTime: '۷ دقیقه' },
  { id: 'ha-5', title: 'اتصال فرم ورود به سرویس واقعی', topic: 'اتصال به API', views: 7_640, updatedAt: '۲ روز پیش', readTime: '۱۰ دقیقه' },
  { id: 'ha-6', title: 'انتشار نسخه نهایی روی هاست اشتراکی', topic: 'استقرار', views: 6_120, updatedAt: '۴ روز پیش', readTime: '۵ دقیقه' },
];

export const contactChannels = [
  { id: 'cc-1', title: 'ایمیل پشتیبانی', value: config.supportEmail, icon: 'envelope-at', description: 'پاسخ‌گویی در کمتر از یک روز کاری' },
  { id: 'cc-2', title: 'مستندات آنلاین', value: 'docs/introduction.html', icon: 'book-half', description: 'بیش از ۲۰ مستند فنی و گام‌به‌گام' },
  { id: 'cc-3', title: 'تلفن فروش', value: '۰۲۱-۹۱۰۰۲۲۳۳', icon: 'telephone', description: 'شنبه تا چهارشنبه، ۹ تا ۱۷' },
];

export const legalSections = {
  terms: [
    { heading: '۱. پذیرش شرایط', body: 'با خرید و استفاده از قالب، شرایط این سند را می‌پذیرید. مجوز استفاده بر اساس نوع خریدی است که انتخاب کرده‌اید.' },
    { heading: '۲. مجوز استفاده', body: 'نسخه شخصی برای یک پروژه و نسخه تجاری برای پروژه‌های نامحدود قابل استفاده است. بازفروش یا توزیع مجدد فایل‌های قالب مجاز نیست.' },
    { heading: '۳. تحویل و بازگشت', body: 'فایل‌ها بلافاصله پس از خرید در دسترس قرار می‌گیرند. در صورت نارضایتی، طبق سیاست فروشگاه امکان بازگشت وجه وجود دارد.' },
    { heading: '۴. محدودیت مسئولیت', body: 'قالب به‌صورت «همان‌گونه که هست» ارائه می‌شود. توسعه‌دهنده مسئول خسارات ناشی از استفاده نادرست از کد نیست.' },
  ],
  privacy: [
    { heading: '۱. داده‌هایی که جمع‌آوری می‌کنیم', body: 'در نسخه قالب، هیچ داده‌ای به سرورهای ما ارسال نمی‌شود. همه اطلاعات نمونه در مرورگر شما تولید می‌شود.' },
    { heading: '۲. ذخیره‌سازی محلی', body: 'تنظیمات ظاهری مانند تم، رنگ و زبان در localStorage مرورگر ذخیره می‌شود و قابل حذف از پنل تنظیمات است.' },
    { heading: '۳. کوکی‌ها', body: 'قالب از کوکی تبلیغاتی استفاده نمی‌کند. تنها کوکی‌های ضروری سرویس‌های اشتراکی مانند فونت‌ها بارگذاری می‌شود.' },
    { heading: '۴. حقوق کاربران', body: 'کاربر می‌تواند هر زمان داده‌های محلی خود را پاک کند. برای پرسش‌های حریم خصوصی با ایمیل پشتیبانی در تماس باشید.' },
  ],
};

export const testimonials = [
  { id: 't-1', name: 'مهدی رضایی', role: 'مدیر فنی، شرکت داده‌پردازان پارس', text: 'برای پروژه پنل مدیریت مشتریان، ساختار قالب نیمی از زمان توسعه را آزاد کرد. پشتیبانی کامل RTL واقعاً از ابتدا طراحی شده است، نه وصله‌کاری.', avatar: 'assets/img/avatars/avatar-04.svg', rating: 5 },
  { id: 't-2', name: 'نگین شریفی', role: 'طراح محصول، استودیو آرکا', text: 'کیفیت توکن‌های طراحی و انسجام صفحات عالی است. تغییر رنگ برند در چند ثانیه انجام شد و همه صفحات هماهنگ باقی ماندند.', avatar: 'assets/img/avatars/avatar-11.svg', rating: 5 },
  { id: 't-3', name: 'سعید امینی', role: 'بنیان‌گذار سرویس ابری ویرا', text: 'کارگاه هوش مصنوعی نقطه قوت اصلی برای ما بود؛ توانستیم رابط چت داخلی محصول را در چند روز آماده کنیم.', avatar: 'assets/img/avatars/avatar-17.svg', rating: 4 },
];

export const productHighlights = [
  { icon: 'grid-1x2-fill', title: '۱۰ داشبورد تخصصی', text: 'هر داشبورد ساختار اطلاعاتی، شاخص‌ها و نمودارهای خاص حوزه خود را دارد.', tone: 'primary' },
  { icon: 'arrow-left-right', title: 'RTL و LTR واقعی', text: 'بدون شیت تکراری؛ همه چیز با CSS Logical Properties ساخته شده است.', tone: 'info' },
  { icon: 'calendar3', title: 'تقویم شمسی', text: 'نمایش ماه، هفته، روز و برنامه زمانی با تبدیل دقیق تاریخ.', tone: 'success' },
  { icon: 'translate', title: 'سه زبان', text: 'فارسی، انگلیسی و عربی با تغییر آنی در زمان اجرا.', tone: 'violet' },
  { icon: 'stars', title: 'کارگاه هوش مصنوعی', text: 'چت، نویسنده، خلاصه‌ساز، کتابخانه پرامپت و مصرف توکن.', tone: 'warning' },
  { icon: 'sliders', title: 'شخصی‌سازی زنده', text: 'تصمیم‌های طراحی به‌صورت توکن؛ تغییر بی‌درنگ و بدون رفرش.', tone: 'primary' },
  { icon: 'code-slash', title: 'معماری آماده API', text: 'لایه سرویس مستقل از داده‌های نمونه با قرارداد متدهای REST.', tone: 'info' },
  { icon: 'palette2', title: 'کیت رابط کامل', text: 'بیش از ۴۰ کامپوننت با تمام حالت‌ها و نمونه‌های واقعی.', tone: 'success' },
];

export const techStack = [
  { name: 'HTML5', icon: 'filetype-html', note: 'صفحات مستقل' },
  { name: 'Bootstrap 5.3', icon: 'bootstrap', note: 'گرید و کامپوننت پایه' },
  { name: 'SCSS', icon: 'filetype-scss', note: 'نظام طراحی و توکن‌ها' },
  { name: 'JavaScript ES2022', icon: 'filetype-js', note: 'ماژول‌های مستقل' },
  { name: 'Vite', icon: 'lightning-charge', note: 'بیلد و توسعه' },
  { name: 'ApexCharts', icon: 'bar-chart-fill', note: 'نمودارهای تعاملی' },
  { name: 'Day.js + جلالی', icon: 'calendar2-week', note: 'تاریخ شمسی' },
  { name: 'SortableJS', icon: 'arrows-move', note: 'کشیدن و رها کردن' },
];

export const counters = [
  { label: 'صفحه آماده', value: 206, suffix: '+' },
  { label: 'داشبورد تخصصی', value: 10 },
  { label: 'کامپوننت رابط', value: 40, suffix: '+' },
  { label: 'لایوت و رنگ', value: 36 },
];

export default {
  buildSearchIndex,
  commands,
  shortcuts,
  changelog,
  faq,
  pricingPlans,
  statusServices,
  statusIncidents,
  statusUptimeBars,
  helpTopics,
  helpArticles,
  contactChannels,
  legalSections,
  testimonials,
  productHighlights,
  techStack,
  counters,
};
