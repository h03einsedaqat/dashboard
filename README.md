# NOVAADMIN — قالب پنل مدیریت چندمنظوره، فارسی‌محور

**نسخه ۱٫۰٫۰** · HTML5 + SCSS + ES2022 + Vite · بدون jQuery · بدون بک‌اند · آماده فروش و تحویل

قالب مدیریتی کامل با ۲۰۶ صفحه مستقل، ۱۰ داشبورد تخصصی، کارگاه هوش مصنوعی، سیستم طراحی توکن‌محور، پشتیبانی هم‌سطح RTL و LTR، تقویم شمسی و سه زبان فارسی/انگلیسی/عربی — با ۲۳ موضوع مستندات درون خود قالب.

---

## ۳۰ ثانیه تا اجرا

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # خروجی آماده انتشار در dist/
```

> اگر فقط می‌خواهید نتیجه را ببینید، محتوای پوشه `html/` (در بسته محصول) را روی هر هاست استاتیکی بگذارید؛ نیازی به Node.js نیست.

---

## چه چیزی در این قالب هست؟

| بخش | جزئیات |
| --- | --- |
| **صفحات** | ۲۰۶ صفحه مستقل HTML — ۱۰ داشبورد، ۷۸ صفحه اپلیکیشن، ۴۷ جدول فهرست، ۲۱ صفحه UI Kit، ۲۳ مستند، ۱۶ صفحه سیستمی، ۱۱ صفحه احراز هویت |
| **داشبوردها** | آنالیتیکس، فروشگاهی، CRM، SaaS، مالی، پروژه‌ها، منابع انسانی، پشتیبانی، هوش مصنوعی، لجستیک — هر یک با KPI، نمودار، جدول و فعالیت اختصاصی |
| **هوش مصنوعی** | چت، نویسنده، خلاصه‌ساز، بازتولید محتوا، کتابخانه پرامپت، استودیو تصویر، زمان‌بند، مصرف و هزینه، مدل‌ها، کلیدهای API، تاریخچه |
| **ماژول‌ها** | کاربران و نقش‌ها، تیم‌ها، مشتریان، فروشگاه (محصول، سفارش، انبار، کوپن)، CRM (قیف فروش، معامله، تماس، کمپین)، پروژه و وظایف، کانبان، تقویم، ایمیل، گفتگو، فایل‌ها، تیکت‌ها، CMS، مالی |
| **ظاهر** | تم روشن/تاریک/سیستم، ۶ پالت رنگی، ۶ چیدمان، ۳ حالت تراکم/اندازه فونت، سبک‌های سایدبار (ثابت، شناور، ریل) |
| **دوجهته** | RTL و LTR از پایه با ویژگی‌های منطقی CSS؛ هیچ بازنویسی اختصاصی RTL لازم نیست |
| **چندزبانه** | فارسی (پیش‌فرض)، انگلیسی، عربی؛ ارقام فارسی/عربی/لاتین، تقویم شمسی و میلادی |
| **کامپوننت‌ها** | ۳۹ کامپوننت آماده، جدول داده کامل (جستجو، فیلتر، مرتب‌سازی، انتخاب، خروجی)، نمودارها، کانبان، تقویم، چت، ساخت فاکتور |
| **کیفیت** | دو ابزار کنترل کیفیت داخلی: بررسی لینک/CSS/دسترس‌پذیری و اجرای واقعی کنترل‌کننده‌ها |

---

## ساختار پروژه

```text
├── index.html                  صفحه محصول
├── src/
│   ├── pages/**                ۲۰۶ صفحه تولیدشده
│   ├── partials/**             قطعه‌های مشترک (head، هدر، پاپ‌آپ‌ها، مستندات)
│   ├── scss/**                 توکن، تم، کامپوننت، چیدمان، ترکیب صفحه
│   ├── js/core/**              ۲۰ ماژول هسته
│   ├── js/pages/**             کنترل‌کننده هر بخش
│   ├── services/**             لایه داده با قرارداد REST
│   ├── data/**                 داده نمونه (تکرارپذیر با بذر ثابت)
│   ├── locales/**              دیکشنری fa/en/ar
│   └── config/config.js        برند، پیش‌فرض‌ها، ارز، منطقه زمانی
├── docs/                       ۲۳ موضوع مستندات (مارک‌داون)
├── public/assets/**            لوگو، آواتار، تصویر محصول، لوگوی برند (SVG)
└── tools/**                    تولید صفحه، دارایی، مستندات، کنترل کیفیت، بسته‌بندی
```

توضیح کامل: [`src/pages` تولیدشده است و ویرایش نمی‌شود] → [مستندات ساختار پروژه](docs/folder-structure.md)

---

## اسکریپت‌ها

| دستور | کار |
| --- | --- |
| `npm run dev` | تولید فایل‌های مشتق‌شده و اجرای سرور توسعه با بارگذاری زنده |
| `npm run build` | ساخت کامل خروجی (`gen:all` → `vite build` → مرتب‌سازی) |
| `npm run preview` | پیش‌نمایش خروجی ساخته‌شده در `dist/` |
| `npm run gen:all` | تولید مستندات، صفحه‌ها، دارایی‌ها و نقشه سایت |
| `npm run gen:docs` | تبدیل `docs/*.md` به صفحه‌های HTML مستندات |
| `npm run gen:pages` | ساخت ۲۰۶ صفحه از منیفست |
| `npm run gen:assets` | تولید لوگو، آواتار، تصویر محصول و لوگوی برندها |
| `npm run gen:nav` | ساخت منوی سراسری، `sitemap.xml` و `robots.txt` |
| `npm run qa:links` | کنترل خروجی: لینک شکسته، دارایی گم‌شده، کلاس بی‌استایل، دسترس‌پذیری، SEO |
| `npm run qa:smoke` | اجرای همه صفحه‌ها در DOM شبیه‌سازی‌شده (بدون نیاز به مرورگر) |
| `npm run qa:toggles` | کلیک واقعی روی کلید زبان و تم در هر صفحه و بررسی نتیجه |
| `npm run qa:i18n` | بازرسی ترجمه‌ها: کلیدهای استفاده‌شده در fa/en/ar |
| `npm run qa:responsive` | بازرسی واکنش‌گرایی: ویوپورت، جدول‌ها، دراور موبایل، نقاط شکست ۳۲۰ تا ۱۹۲۰ |
| `npm run qa:all` | ساخت + همه کنترل‌های کیفیت |
| `npm run package` | ساخت بسته نهایی قابل تحویل (ZIP) |

> پوشه‌های `src/pages`، `src/partials/docs`، `src/data/navigation.js`، `public/sitemap.xml` و `public/robots.txt` **تولیدشده** هستند و در گیت نگه داشته نمی‌شوند؛ با `npm run gen:all` (و به‌صورت خودکار در `dev` و `build`) بازساخته می‌شوند.

---

## شخصی‌سازی سریع

```js
// src/config/config.js
export const config = {
  appName: 'پنل من',
  tagline: 'سامانه مدیریت داخلی',
  defaultLanguage: 'fa',      // fa | en | ar
  defaultDirection: 'rtl',    // rtl | ltr
  defaultTheme: 'light',      // light | dark | system
  defaultPrimary: 'indigo',   // indigo | blue | emerald | violet | orange | rose
  defaultLayout: 'sidebar',   // sidebar | mini | collapse | horizontal | twocol | boxed
  defaultCalendar: 'jalali',  // jalali | gregorian
  currency: 'IRR',            // IRR | USD | EUR | AED
  api: { useMocks: true, baseUrl: '/api' },
};
```

- **لوگو:** فایل‌های `public/assets/logo*.svg` را جایگزین کنید.
- **رنگ سازمانی:** یک پالت در `src/scss/base/_palettes.scss` اضافه کنید.
- **داده واقعی:** `api.useMocks = false` و آدرس `baseUrl` را بگذارید؛ هیچ کنترل‌کننده‌ای تغییر نمی‌کند.

---

## مستندات

مستندات کامل داخل خود قالب است: `docs/introduction.html` (۲۳ موضوع: نصب، ساختار، تم، RTL، چندزبانه، تقویم شمسی، کامپوننت‌ها، جدول داده، فرم، نمودار، افزودن صفحه، اتصال API، احراز هویت، Laravel، استقرار، رفع اشکال، مهاجرت، اعتبارها…).

منابع مارک‌داون همان مستندات در پوشه `docs/` قرار دارد و با `npm run gen:docs` به صفحه تبدیل می‌شود.

---

## مرورگرهای پشتیبانی‌شده

| مرورگر | نسخه |
| --- | --- |
| Chrome / Edge | ۱۰۵+ |
| Firefox | ۱۱۵+ |
| Safari | ۱۵٫۴+ |
| موبایل | iOS Safari 15.4+, Chrome Android 105+ |

قالب از ویژگی‌های مدرن CSS (`:has()`, nesting, logical properties) و ES2022 استفاده می‌کند؛ مرورگرهای قدیمی‌تر پشتیبانی نمی‌شوند.

---

## مجوز

استفاده در پروژه‌های شخصی و تجاری شما مجاز است؛ فروش مجدد یا توزیع فایل‌های منبع مجاز نیست. متن کامل در [`LICENSE.txt`](LICENSE.txt) و فهرست کتابخانه‌ها با مجوزهایشان در [`docs/credits.md`](docs/credits.md).

---

## تاریخچه تغییرات

نسخه ۱٫۰٫۰ اولین انتشار عمومی است. جزئیات در [`CHANGELOG.md`](CHANGELOG.md).

---

## English summary

**NOVAADMIN** is a premium, Persian-first multi-purpose admin dashboard template built with HTML5, SCSS, ES2022 modules and Vite. Every page is a standalone HTML file — no framework, no backend required.

- 206 standalone pages: 10 specialised dashboards, 78 application screens, 47 list tables, 21 UI-kit pages, 23 documentation topics, 16 system pages, 11 auth variations
- Design-system driven: CSS custom properties for colour, typography, spacing, radii and shadows; light/dark/system themes; 6 brand palettes; 6 layouts
- First-class RTL **and** LTR using logical properties, plus full fa/en/ar localisation with Persian digits and the Jalali calendar
- Mock REST service layer (`src/services/*`) so a real API is a one-line switch
- Ships with two quality gates: a static audit (`npm run qa:links`) and a runtime smoke suite (`npm run qa:smoke`) that boots every controller in a simulated DOM

```bash
npm install && npm run dev      # start developing
npm run qa:all                  # build + audit + smoke tests
npm run package                 # produce the deliverable ZIP
```
