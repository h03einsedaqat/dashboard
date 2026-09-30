# الإعدادات

جميع إعدادات المنتج في ملف واحد: `src/config/config.js`. لا يحتوي هذا الملف على أي استيراد ليكون قابلاً للاستخدام في المتصفح وفي أدوات Node معاً.

## العلامة والإصدار

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

بتغيير `appName` يتحدّث الاسم في كل مكان (عنوان الصفحة، الشريط الجانبي، التذييل، الوسوم الوصفية، اسم الحزمة)؛ إذ تُستبدل القيم وقت البناء عبر الرموز `{{APP_NAME}}` و`{{TAGLINE}}` و`{{VERSION}}`.

## القيم الافتراضية للمظهر

| المفتاح | القيم المسموح بها | ملاحظات |
| --- | --- | --- |
| `defaultLanguage` | `fa`, `en`, `ar` | لغة الواجهة الأولية |
| `defaultDirection` | `rtl`, `ltr` | الاتجاه الأولي |
| `defaultTheme` | `light`, `dark`, `system` | وضع الألوان |
| `defaultPrimary` | `indigo`, `blue`, `emerald`, `violet`, `orange`, `rose` | اللون الأساسي |
| `defaultLayout` | `sidebar`, `mini`, `collapse`, `horizontal`, `twocol`, `boxed` | التخطيط |
| `defaultDensity` | `comfortable`, `compact` | الكثافة |
| `defaultFontSize` | `sm`, `md`, `lg` | حجم النص الأساسي |
| `defaultSidebarStyle` | `fixed`, `floating`, `compact` | نمط الشريط الجانبي |
| `defaultCalendar` | `jalali`, `gregorian` | التقويم الافتراضي |

## المنطقة والعملة والتاريخ

```js
currency: 'IRR',                        // IRR | USD | EUR | AED
currencyList: ['IRR', 'USD', 'EUR', 'AED'],
timezone: 'Asia/Tehran',
dateFormat: 'YYYY/MM/DD',
```

صيغة العملة والأرقام معرّفة في `src/js/core/numbers.js` وتُستخدم الدالة نفسها في كل مكان؛ ولإضافة عملة جديدة يكفي سطر واحد:

```js
export const CURRENCIES = {
  IRR: { label: 'ریال', symbol: 'ریال', digits: 0, fa: 'fa-IR' },
  USD: { label: 'دلار', symbol: '$', digits: 2, fa: 'en-US' },
  AED: { label: 'درهم', symbol: 'د.إ', digits: 2, fa: 'ar-AE' },
  EUR: { label: 'یورو', symbol: '€', digits: 2, fa: 'de-DE' },
};
```

## السلوك والبيانات

```js
storagePrefix: 'nova',          // بادئة مفاتيح localStorage
mockLatency: [180, 420],        // تأخير محاكى لاستجابة الخدمات
mockErrors: false,              // true ⇒ تُعاد أحياناً استجابة خطأ
defaultPageSize: 10,            // العدد الافتراضي لصفوف الجداول
```

## الميزات

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

إذا جعلت ميزة ما `false`، يُزال زرها ولوحتها من الهيكل ولا يُنفّذ منطقها.

## الربط بالواجهة الخلفية

```js
api: {
  baseUrl: '/api',
  timeout: 8000,
  useMocks: true,   // false ⇒ طلبات HTTP حقيقية
},
```

مع `useMocks: false` ترسل طبقة الخدمات طلبات حقيقية بدلاً من البيانات النموذجية. تفاصيل العقد في [الربط بـ API](api-integration.html).

## تغيير البيانات النموذجية

| الملف | المحتوى |
| --- | --- |
| `src/data/analytics.js` | السلاسل الزمنية، مؤشرات KPI، مصادر الزيارات |
| `src/data/commerce.js` | المنتجات، الطلبات، المخزون، القسائم |
| `src/data/crm.js` | جهات الاتصال، الشركات، الصفقات، الحملات |
| `src/data/finance.js` | المعاملات، الفواتير، الاشتراكات |
| `src/data/people.js` | المستخدمون، الأدوار، الفريق |
| `src/data/projects.js` | المشاريع، المهام، كانبان |
| `src/data/support.js` | التذاكر، الخبراء، قاعدة المعرفة |
| `src/data/hr.js` | الموظفون، الحضور، الإجازات، الرواتب |
| `src/data/logistics.js` | الشحنات، السائقون، المستودعات |
| `src/data/ai.js` | النماذج، الموجّهات، المحادثات، الاستهلاك |
| `src/data/system.js` | الهبوط، الخطط، الأسئلة، الوثائق، الاختصارات |
| `src/data/rng.js` | مولّد شبه عشوائي ببذرة ثابتة (مخرجات قابلة للتكرار) |

> ملاحظة: تُبنى جميع البيانات بـ `rng.js` وبذرة ثابتة؛ لذا تكون الجداول والمخططات متطابقة في كل بناء. إذا أردت بيانات عشوائية، فغيّر البذرة في `rng.js`.

> تحذير: لا تستخدم أبداً استيراداً مزدوجاً أو اعتماداً متبادلاً في ملفات `src/data/**`؛ يجب أن تبقى شجرة بلا حلقات.
