# تنظیمات

همه تنظیمات محصول در یک فایل است: `src/config/config.js`. این فایل هیچ importی ندارد تا هم در مرورگر و هم در ابزارهای Node قابل استفاده باشد.

## برند و نسخه

```js
export const config = {
  appName: 'NOVAADMIN',
  appShortName: 'NOVA',
  tagline: 'Modern. Persian-First. Enterprise Ready.',
  version: '1.0.0',
  releaseDate: '2026-09-22',

  logo: 'assets/logo.svg',
  logoMark: 'assets/logo-mark.svg',
  logoDark: 'assets/logo-dark.svg',
  favicon: 'assets/favicon.svg',
  …
};
```

با تغییر `appName`، همه‌جا (عنوان صفحه، سایدبار، فوتر، متا، نام بسته) به‌روز می‌شود؛ مقادیر از طریق توکن‌های `{{APP_NAME}}`، `{{TAGLINE}}` و `{{VERSION}}` در زمان ساخت جای‌گذاری می‌شوند.

## پیش‌فرض‌های ظاهری

| کلید | مقدارهای مجاز | توضیح |
| --- | --- | --- |
| `defaultLanguage` | `fa`, `en`, `ar` | زبان اولیه رابط |
| `defaultDirection` | `rtl`, `ltr` | جهت اولیه |
| `defaultTheme` | `light`, `dark`, `system` | حالت رنگ |
| `defaultPrimary` | `indigo`, `blue`, `emerald`, `violet`, `orange`, `rose` | رنگ اصلی |
| `defaultLayout` | `sidebar`, `mini`, `collapse`, `horizontal`, `twocol`, `boxed` | چیدمان |
| `defaultDensity` | `comfortable`, `compact` | تراکم |
| `defaultFontSize` | `sm`, `md`, `lg` | اندازه پایه متن |
| `defaultSidebarStyle` | `fixed`, `floating`, `compact` | سبک سایدبار |
| `defaultCalendar` | `jalali`, `gregorian` | تقویم پیش‌فرض |

## منطقه، ارز و تاریخ

```js
currency: 'IRR',                        // IRR | USD | EUR | AED
currencyList: ['IRR', 'USD', 'EUR', 'AED'],
timezone: 'Asia/Tehran',
dateFormat: 'YYYY/MM/DD',
```

فرمت ارز و اعداد در `src/js/core/numbers.js` تعریف شده و همه‌جا از همان تابع استفاده می‌شود؛ برای افزودن ارز جدید کافی است یک سطر اضافه کنید:

```js
export const CURRENCIES = {
  IRR: { label: 'ریال', symbol: 'ریال', digits: 0, fa: 'fa-IR' },
  USD: { label: 'دلار', symbol: '$', digits: 2, fa: 'en-US' },
  AED: { label: 'درهم', symbol: 'د.إ', digits: 2, fa: 'ar-AE' },
  EUR: { label: 'یورو', symbol: '€', digits: 2, fa: 'de-DE' },
};
```

## رفتار و داده

```js
storagePrefix: 'nova',          // پیشوند کلیدهای localStorage
mockLatency: [180, 420],        // تأخیر شبیه‌سازی‌شده پاسخ سرویس‌ها
mockErrors: false,              // true ⇒ گاهی پاسخ خطا برگردانده می‌شود
defaultPageSize: 10,            // تعداد سطر پیش‌فرض جدول‌ها
```

## قابلیت‌ها

```js
features: {
  commandPalette: true,
  globalSearch: true,
  themeCustomizer: true,
  demoSwitcher: true,
  notifications: true,
  shortcutsHelp: true,
  dashboardCustomizer: true,
  chat: true,
  aiWorkspace: true,
},
```

اگر قابلیتی را `false` کنید، دکمه و پنل مربوطه در پوسته حذف می‌شود؛ منطق آن هم اجرا نمی‌شود.

## اتصال به بک‌اند

```js
api: {
  baseUrl: '/api',
  timeout: 8000,
  useMocks: true,   // false ⇒ درخواست واقعی HTTP
},
```

با `useMocks: false` لایه سرویس‌ها به‌جای داده نمونه، درخواست واقعی می‌فرستد. جزئیات قرارداد در [اتصال به API](api-integration.html).

## تغییر داده‌های نمونه

| فایل | محتوا |
| --- | --- |
| `src/data/analytics.js` | سری‌های زمانی، KPI، منابع ترافیک |
| `src/data/commerce.js` | محصولات، سفارش‌ها، موجودی، کوپن‌ها |
| `src/data/crm.js` | مخاطبین، شرکت‌ها، معاملات، کمپین‌ها |
| `src/data/finance.js` | تراکنش‌ها، فاکتورها، اشتراک‌ها |
| `src/data/people.js` | کاربران، نقش‌ها، تیم |
| `src/data/projects.js` | پروژه‌ها، تسک‌ها، کانبان |
| `src/data/support.js` | تیکت‌ها، کارشناسان، پایگاه دانش |
| `src/data/hr.js` | کارکنان، حضور، مرخصی، حقوق |
| `src/data/logistics.js` | محموله‌ها، راننده‌ها، انبارها |
| `src/data/ai.js` | مدل‌ها، پرامپت‌ها، گفتگوها، مصرف |
| `src/data/system.js` | لندینگ، پلن‌ها، پرسش‌ها، مستندات، میان‌برها |
| `src/data/rng.js` | مولد شبه‌تصادفی با بذر ثابت (خروجی تکرارپذیر) |

> نکته: همه داده‌ها با `rng.js` و بذر ثابت ساخته می‌شوند؛ در هر بار ساخت، جدول‌ها و نمودارها یکسان‌اند. اگر داده تصادفی می‌خواهید، بذر را در `rng.js` تغییر دهید.

> هشدار: هیچ‌وقت در فایل‌های `src/data/**` از `import` دوگانه یا وابستگی متقابل استفاده نکنید؛ این فایل‌ها باید درخت بدون دور بمانند.
