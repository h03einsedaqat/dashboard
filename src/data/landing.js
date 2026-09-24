/**
 * NOVAADMIN — landing page content
 * ------------------------------------------------------------------
 * Everything the marketing page shows that is *editorial* rather than
 * functional lives here: the hero promises, the proof numbers, the twelve
 * frequently asked questions (full answers, not teasers), the workflow steps
 * and the changelog feed. Keeping it in one file means a release only needs to
 * touch data — no HTML editing.
 *
 * Persian is the authored language; English and Arabic are produced at runtime
 * by `src/locales/phrases.js` (dictionary of triples), so new copy has to be
 * registered there as well.
 */
import { config } from '../config/config.js';

/** Hero band — the three chips under the H1 and the two CTAs. */
export const HERO_BADGES = [
  { icon: 'layout-sidebar', label: '۱۰ داشبورد تخصصی' },
  { icon: 'translate', label: 'RTL / LTR بومی' },
  { icon: 'calendar3', label: 'تقویم جلالی' },
  { icon: 'moon-stars', label: 'حالت روشن و تاریک' },
];

/** Big numbers for the stats band, all measured from the build itself. */
export const HERO_STATS = [
  { value: '۲۰۶', label: 'صفحه واقعی', note: 'بدون صفحه‌ی تشریفاتی' },
  { value: '۱۰', label: 'داشبورد تخصصی', note: 'از فروشگاه تا هوش مصنوعی' },
  { value: '۶۳+', label: 'کامپوننت', note: 'کیت رابط یکپارچه' },
  { value: '۱۰۰٪', label: 'RTL', note: 'فارسی، انگلیسی، عربی' },
];

/**
 * The preview strip on the hero. `preview` points at the generated SVG mock of
 * that dashboard (tools/gen-previews.mjs) — light and dark variants, so the
 * landing page always shows the theme the visitor is using.
 */
export const SHOWCASE = [
  {
    id: 'analytics',
    title: 'داشبورد تحلیلی',
    text: '۴ شاخص کلیدی، نمودار جریان درآمد، قیف تبدیل و نقشه جغرافیایی بازدیدها.',
    metrics: [
      { label: 'درآمد ۳۰ روز', value: '۸٫۴ میلیارد' },
      { label: 'رشد', value: '٪۲۴' },
    ],
  },
  {
    id: 'ecommerce',
    title: 'داشبورد فروشگاه',
    text: 'روند فروش، سبد خرید، موجودی انبار و فهرست سفارش‌ها با فیلتر و خروجی.',
    metrics: [
      { label: 'سفارش امروز', value: '۱۴۲' },
      { label: 'میانگین سبد', value: '۲٫۱ م' },
    ],
  },
  {
    id: 'crm',
    title: 'داشبورد CRM',
    text: 'قیف فروش، ارزش هر مرحله، پیگیری معامله‌ها و عملکرد کارشناسان.',
    metrics: [
      { label: 'Pipeline', value: '۳۱ م' },
      { label: 'نرخ تبدیل', value: '٪۱۸' },
    ],
  },
  {
    id: 'finance',
    title: 'داشبورد مالی',
    text: 'جریان نقدینگی، هزینه و درآمد به تفکیک دپارتمان، فاکتور و مغایرت بانک.',
    metrics: [
      { label: 'ورودی', value: '۵٫۲ م' },
      { label: 'خروجی', value: '۳٫۸ م' },
    ],
  },
  {
    id: 'projects',
    title: 'داشبورد پروژه‌ها',
    text: 'گانت، کانبان، سرعت تیم و بار کاری اعضا — هم‌زمان در دو نما.',
    metrics: [
      { label: 'پروژه فعال', value: '۱۲' },
      { label: 'تسک باز', value: '۸۷' },
    ],
  },
  {
    id: 'hr',
    title: 'منابع انسانی',
    text: 'حقوق و دستمزد، مرخصی، ورود و خروج و چارت سازمانی.',
    metrics: [
      { label: 'کارمند', value: '۲۴۸' },
      { label: 'حاضر امروز', value: '٪۹۴' },
    ],
  },
  {
    id: 'support',
    title: 'پشتیبانی',
    text: 'صف تیکت، زمان پاسخ، SLA و رضایت مشتری به تفکیک کارشناس.',
    metrics: [
      { label: 'تیکت باز', value: '۲۳' },
      { label: 'میانگین پاسخ', value: '۱۴ دقیقه' },
    ],
  },
  {
    id: 'ai',
    title: 'کارگاه هوش مصنوعی',
    text: 'محاوره، ساخت پرامپت، کتابخانه و تحلیل مصرف مدل‌ها.',
    metrics: [
      { label: 'توکن امروز', value: '۱٫۹ م' },
      { label: 'هزینه', value: '۴۲۰ ه' },
    ],
  },
  {
    id: 'logistics',
    title: 'لجستیک',
    text: 'نقشه ناوگان، وضعیت مرسوله‌ها، انبارها و عملکرد رانندگان.',
    metrics: [
      { label: 'در مسیر', value: '۶۴' },
      { label: 'به‌موقع', value: '٪۹۷' },
    ],
  },
  {
    id: 'saas',
    title: 'داشبورد SaaS',
    text: 'MRR، نرخ ریزش، اشتراک‌ها و گزارش مصرف قابلیت‌ها.',
    metrics: [
      { label: 'MRR', value: '۹۶۰ م' },
      { label: 'ریزش', value: '٪۲٫۴' },
    ],
  },
];

/** Feature grid — the "why" of the product, each with a proof line. */
export const FEATURES = [
  {
    id: 'rtl',
    icon: 'arrow-left-right',
    tone: 'primary',
    title: 'RTL واقعی، نه چرخیده',
    text: 'سراسر رابط با property‌های منطقی (inline / block) نوشته شده؛ با تغییر جهت، آیکن‌ها، سوییچ‌ها، جدول و نمودارها همه آینه می‌شوند.',
    proof: '۰ سطر CSS مخصوص LTR',
  },
  {
    id: 'jalali',
    icon: 'calendar3',
    tone: 'success',
    title: 'تقویم جلالی در همه‌جا',
    text: 'تاریخ‌های نسبتی، تبدیل سه‌گانه جلالی/میلادی/قمری، مناسبت‌ها و ورودی تاریخ — همه از یک موتور.',
    proof: 'JalaliDate + تقویم کاربردی',
  },
  {
    id: 'themes',
    icon: 'palette',
    tone: 'warning',
    title: 'شش تم، هشت رنگ اصلی',
    text: 'تم روشن و تاریک با شش حال‌وهوا و هشت پالت رنگی؛ انتخاب هر کاربر در localStorage می‌ماند و در تمام ۲۰۶ صفحه اعمال می‌شود.',
    proof: 'بدون reload، بدون flash',
  },
  {
    id: 'layers',
    icon: 'layout-text-window-reverse',
    tone: 'info',
    title: 'شش چیدمان قابل انتخاب',
    text: 'ستون کنار باز و باریک، دو ستونه، افقی، باکس‌دار و فشرده — همه با همان کامپوننت‌ها و همه ریسپانسیو.',
    proof: 'کنترل‌شده با data-layout',
  },
  {
    id: 'tables',
    icon: 'table',
    tone: 'danger',
    title: 'جدول داده کامل',
    text: 'جستجو،_sort_ چندستونه، فیلتر ستونی، صفحه‌بندی، انتخاب گروهی، ستون‌های چسبان و خروجی CSV/JSON/Excel.',
    proof: '۱۵٬۰۰۰ رکورد بدون افت',
  },
  {
    id: 'charts',
    icon: 'graph-up-arrow',
    tone: 'primary',
    title: 'نمودارهایی که با تم هماهنگ می‌شوند',
    text: 'ApexCharts با پالت معکوس‌شونده؛ legend، grid، tooltip و انیمیشن هنگام تغییر تم یا جهت دوباره ترسیم می‌شوند.',
    proof: '۸ نوع نمودار آماده',
  },
  {
    id: 'a11y',
    icon: 'person-arms-up',
    tone: 'success',
    title: 'دسترس‌پذیری در اولویت',
    text: 'ناوبری با کیبورد، تمرکز قابل مشاهده، ARIA روی تب/آکاردئون/مودال، و پشتیبانی از `prefers-reduced-motion`.',
    proof: 'طراحی‌شده با WCAG 2.2',
  },
  {
    id: 'devex',
    icon: 'terminal',
    tone: 'info',
    title: 'برای توسعه‌دهنده ساخته شده',
    text: 'Vite + SCSS بدون وابستگی به فریم‌ورک جاوااسکریپت، سرویس لایه‌ی قابل تعویض (mock ↔ API)، و اسکریپت‌های QA برای لینک، ساختار و i18n.',
    proof: 'npm run qa:all',
  },
];

/** Full FAQ — the answers are complete, not teasers (12 entries). */
export const FAQ = [
  {
    id: 'license',
    group: 'مجوز و خرید',
    icon: 'patch-check',
    question: 'مجوز خرید چطور است؟ برای چند پروژه می‌توانم استفاده کنم؟',
    answer:
      'مجوز استاندارد برای یک محصول نهایی (یک دامنه یا یک اپلیکیشن) است و می‌توانید بدون هزینه اضافه نسخه توسعه/استیجینگ همان محصول را هم داشته باشید. برای آژانس‌ها که برای هر مشتری نسخه جدا می‌سازند، مجوز Extended لازم است. سورس کامل (HTML، SCSS، JS، فایل‌های سازنده صفحات) تحویل داده می‌شود و محدودیت زمانی برای استفاده ندارد.',
    meta: ['۱ پروژه = ۱ مجوز', 'بدون انقضا', 'سورس کامل'],
  },
  {
    id: 'stack',
    group: 'فنی',
    icon: 'box-seam',
    question: 'آیا به React / Vue / Angular نیاز دارد؟',
    answer:
      'نه. هسته‌ی قالب Vanilla JS (ES Modules) است و فقط Bootstrap 5.3 برای grid و utility‌ها، ApexCharts برای نمودار و Leaflet برای نقشه را بار می‌گیرد. به همین دلیل روی هر بک‌اندی (Laravel، Django، Rails، .NET، Node) مستقیم می‌نشیند؛ اگر فریم‌ورک می‌خواهید، کامپوننت‌ها بدون تغییر markup قابل پورت هستند چون منطق آن‌ها در یک فایل core/*.js جدا زندگی می‌کند.',
    meta: ['Vite 7', 'Bootstrap 5.3', 'بدون jQuery'],
  },
  {
    id: 'offline',
    group: 'استقرار',
    icon: 'hdd-network',
    question: 'آیا بدون اینترنت و روی سرور داخلی هم کار می‌کند؟',
    answer:
      'بله. فونت وزیرمتن محلی‌سازی شده (public/assets/fonts)، آیکن‌ها Bootstrap Icons به‌صورت فونت محلی‌اند، و نقشه با کاشی محلی/CDN قابل تنظیم است. تنها چیزی که در حالت آفلاین باید عوض کنید نقشه است: `config.map.tiles` را روی سرور کاشی داخلی بگذارید تا Leaflet از CDN نخواند. هیچ API خارجی در زمان اجرا صدا زده نمی‌شود.',
    meta: ['فونت محلی', 'PWA آماده', 'بدون telemetry'],
  },
  {
    id: 'api',
    group: 'اتصال به بک‌اند',
    icon: 'plug',
    question: 'چطور به API واقعی وصلش کنم؟',
    answer:
      'همه داده‌ها از لایه `src/services/*.service.js` می‌آید و هر متد داخل `call()` است: در حالت mock یک resolver محلی اجرا می‌شود، با تنظیم `NOVA_ADMIN_API.baseUrl` همان مسیر با fetch واقعی صدا زده می‌شود. یعنی وصل‌کردن به بک‌اند یعنی تغییر دو خط در config و نوشتن فرمت پاسخ، بدون دست‌زدن به صفحه‌ها. خطا، تأخیر و retry هم همان‌جا متمرکز است.',
    meta: ['config.api.baseUrl', ' ApiError یکسان', 'retry + timeout'],
  },
  {
    id: 'theme',
    group: 'ظاهر و تم',
    icon: 'droplet',
    question: 'رنگ و تم سازمانی خودم را چطور ست کنم؟',
    answer:
      'تنها نقطه‌ی تعریف، `src/scss/config/_palettes.scss` است: هشت پالت رنگی و شش تم آن‌جا هستند. با کپی یک پالت و افزودنش به فهرست، هم تم سفارشی دارید، هم رنگ نمودارها و هم badge‌ها خودکار می‌گیرند چون همه از متغیرهای `--nv-*` خوانده می‌شوند. برای مشتری‌ای که فقط لوگو عوض می‌خواهد، `config.brandMark` و `src/assets/logo.svg` کافی است.',
    meta: ['SCSS token-driven', 'تم تاریک خودکار', '۰ جادوی سیاه'],
  },
  {
    id: 'responsiveness',
    group: 'ریسپانسیو',
    icon: 'phone',
    question: 'وضعیت ریسپانسیو و تغییر چیدمان ستون‌ها چطور است؟',
    answer:
      'هر چیدمان در یک breakpoint‌های از پیش تعریف‌شده به حالت امن برمی‌گردد: زیر ۱۴۰۰px حالت دو ستونه به ریل جمع‌شونده تبدیل می‌شود، زیر ۹۹۲px سایدبار کشویی می‌شود و جدول‌ها اسکرول افقی می‌گیرند. انتخاب کاربر در حافظه می‌ماند ولی اولویت با عرض واقعی صفحه است — پس هیچ‌وقت محتوای بیرون‌زده یا ستون خالی ندارید، حتی اگر کاربر روی موبایل «دو ستونه» را انتخاب کرده باشد.',
    meta: ['۵ breakpoint', 'fallback خودکار', 'حافظه چیدمان'],
  },
  {
    id: 'forms',
    group: 'فرم‌ها',
    icon: 'ui-checks',
    question: 'اعتبارسنجی فرم‌ها و فرمت اعداد فارسی چگونه کار می‌کند؟',
    answer:
      'ماژول `form.js` با delegate روی هر `[data-validate]` می‌نشیند: قوانین با attribute (`data-rule="email|min:6"`) نوشته می‌شوند، پیام خطا زیر فیلد و با `aria-describedby` اعلام می‌شود، و `aria-invalid` ست می‌شود. ورودی‌های عددی رقم فارسی و عربی را می‌پذیرند و به عدد لاتین تبدیل می‌کنند؛ `formatter.js` هم همان عدد را با جداکنگر هزارگان و واحد پولی نمایش می‌دهد.',
    meta: ['Rules با attribute', 'aria-invalid', 'مبدل رقم'],
  },
  {
    id: 'updates',
    group: 'پشتیبانی',
    icon: 'arrow-repeat',
    question: 'آپدیت‌ها و پشتیبانی چطور است؟',
    answer:
      'تا ۱۲ ماه آپدیت رایگان دارید. هر نسخه یک CHANGELOG با شماره نسخه دارد و چون ساختار پوشه‌ها تفکیک روشن دارد (core / pages / components / data)، ارتقا معمولاً با کشیدن فایل‌های جدید و اجراي `npm run gen:all` انجام می‌شود. برای پرسش‌های فنی، تیکت در صفحه پشتیبانی یا ایمیل مستقیم — پاسخ کاری ما کمتر از یک روز کاری است.',
    meta: ['۱۲ ماه', 'CHANGELOG', 'کمتر از ۱ روز'],
  },
  {
    id: 'build',
    group: 'بیلد و انتشار',
    icon: 'hammer',
    question: 'نحوه build و خروجی گرفتن برای production چطور است؟',
    answer:
      'سه دستور کافی است: `npm run gen:all` (تولید ۲۰۶ صفحه، sitemap و manifest از یک منبع واحد)، `npm run build` (خروجی به `dist/` با CSS و JS بهینه‌شده و asset‌های hash‌دار) و `npm run preview` برای پیش‌نمایش. خروجی یک پوشه استاتیک است؛ روی هر nginx، Apache، Netlify یا S3 بدون سرور اجرا می‌شود.',
    meta: ['dist/', 'asset hash', 'بدون backend'],
  },
  {
    id: 'i18n',
    group: 'چندزبانه',
    icon: 'translate',
    question: 'زبان سوم (عربی/انگلیسی) اضافه کنم؟',
    answer:
      'زبان‌ها در `src/locales/{fa,en,ar}.js` هستند و کلیدها با `t()` خوانده می‌شوند. برای زبان جدید یک فایل بسازید و آن را در `LOCALES` ثبت کنید؛ ترجمه متن‌های آزاد (متن‌های لندینگ، توضیح صفحه‌ها) با افزودن سه‌تایی به `phrases.js` انجام می‌شود. اعداد، تاریخ و جداکنگرها هم خودکار با زبان عوض می‌شوند چون از همان ماژول اعداد و تقویم می‌آیند.',
    meta: ['۳ زبان آماده', 'file-per-locale', 'ارقام محلی'],
  },
  {
    id: 'security',
    group: 'امنیت',
    icon: 'shield-lock',
    question: 'صفحه احراز هویت و مدیریت نشست‌ها آماده است؟',
    answer:
      'ورود، ثبت‌نام، بازیابی رمز، قفل‌شدن، تأیید دو مرحله‌ای، فهرست نشست‌های فعال و لاگ ورود‌ها آماده است. چون قالب بک‌اند ندارد، این صفحه‌ها UI و جریان را نشان می‌دهند و اتصال به سرویس واقعی از همان `auth.service.js` انجام می‌شود. توصیه امنیتی ما: کوکی `HttpOnly + SameSite=Lax`، کوتاه‌کردن عمر access token و نگه‌داشتن refresh token در سمت سرور.',
    meta: ['۷ صفحه احراز هویت', '2FA', 'مدیریت نشست'],
  },
  {
    id: 'dark',
    group: 'تم تاریک',
    icon: 'moon-stars',
    question: 'حالت تاریک روی نمودار، جدول و تصویر چه می‌کند؟',
    answer:
      'تم تاریک فقط رنگ پس‌زمینه نیست: پالت نمودارها تیره‌تر و روشن‌تر می‌شوند، grid و axis‌ها بازتر می‌شوند، سایه‌ها کم‌رنگ‌تر و مرزها پررنگ‌تر می‌شوند، و badge‌ها به نسخه «soft» خودشان می‌روند. پیش‌نمایش داشبورد در همین صفحه هم با تم شما عوض می‌شود چون دو نسخه SVG (روشن و تاریک) با `<picture>` ارائه می‌شود.',
    meta: ['palette swap', 'کنتراست AA', 'بدون پرش'],
  },
];

/** Quick-start steps — mirrors the README commands exactly. */
export const STEPS = [
  {
    n: 1,
    title: 'دریافت و نصب',
    text: 'پروژه را کپی کنید و وابستگی‌ها را نصب کنید.',
    code: 'npm install',
  },
  {
    n: 2,
    title: 'تولید صفحه‌ها',
    text: 'منو، مسیرها، ترجمه‌های صفحه و sitemap از یک manifest ساخته می‌شوند.',
    code: 'npm run gen:all',
  },
  {
    n: 3,
    title: 'شخصی‌سازی',
    text: 'نام برند، رنگ اصلی و چیدمان پیش‌فرض را در `src/config/config.js` و `_palettes.scss` عوض کنید.',
    code: 'src/config/config.js',
  },
  {
    n: 4,
    title: 'اجرای محلی',
    text: 'سرور توسعه با HMR بالا می‌آید و پیش‌نمایش زنده را نشان می‌دهد.',
    code: 'npm run dev',
  },
  {
    n: 5,
    title: 'خروجی production',
    text: 'پوشه `dist/` را روی هر هاست استاتیک بگذارید — تمام.',
    code: 'npm run build',
  },
];


/** The code snippet shown in the architecture band — real, from the service layer. */
export const CODE_SAMPLE = `// src/services/analytics.service.js — one shape for mock and REST
export const analyticsService = {
  /** GET /analytics/revenue?range=30d */
  revenue(query = {}) {
    return call('list', \`analytics/revenue?range=\${query.range ?? '30d'}\`, {
      resolver: () => seriesFor(query),   // demo data
    });
  },
};

/* config.api = { baseUrl: '/api', useMocks: false }
   → the very same page now talks to your backend,
   with ApiError, timeout and retry already handled. */`;

/** What's new — the landing page timeline, fed by the same changelog data. */
export const RELEASE_HEADLINE = {
  version: config.version,
  title: 'نسخه ۱٫۰٫۰ — انتشار عمومی',
  items: [
    '۲۰۶ صفحه فارسی با RTL کامل و تقویم جلالی',
    '۱۰ داشبورد تخصصی + ۶ چیدمان قابل تغییر',
    'لایه سرویس قابل تعویض (mock ↔ API واقعی)',
    'کیت رابط با ۶۳+ کامپوننت و ۸ نوع نمودار',
    'PWA، حالت تاریک خودکار و پشتیبانی از کیبورد',
  ],
};

export default { HERO_BADGES, HERO_STATS, SHOWCASE, FEATURES, FAQ, STEPS, RELEASE_HEADLINE, CODE_SAMPLE };
