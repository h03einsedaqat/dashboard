# چندزبانه

قالب با سه زبان کامل عرضه می‌شود: **فارسی (پیش‌فرض)**، **انگلیسی** و **عربی**. تمام متن‌های رابط از دیکشنری خوانده می‌شوند و تغییر زبان در زمان اجرا، بدون رفرش صفحه اعمال می‌شود.

## فایل‌های زبان

```text
src/locales/
├── fa.js          دیکشنری فارسی (زبان پیش‌فرض و مرجع)
├── en.js          انگلیسی
├── ar.js          عربی
├── chrome.js      متن‌های پوسته: ui.*، section.*، role.*
├── generated.js   تولیدشده: nav.*، صفحه‌ها، عنوان‌ها
└── index.js       ادغام دیکشنری‌ها + توابع کمکی
```

ترتیب ادغام در `index.js`: `chrome` → `generated` → دیکشنری دست‌نویس. یعنی دیکشنری زبان همیشه برنده است.

## استفاده در HTML

```html
<!-- متن -->
<button data-i18n="ui.export">خروجی</button>

<!-- صفت‌ها -->
<input data-i18n-placeholder="ui.searchPlaceholder" placeholder="جستجو…">
<button data-i18n-title="ui.close" aria-label="بستن"></button>

<!-- محتوای HTML (کمتر استفاده کنید) -->
<p data-i18n-html="landing.footerText"></p>
```

مقدار داخل تگ فقط **متن پیش‌فرض** است؛ اگر جاوااسکریپت اجرا نشود، همان نمایش داده می‌شود.

## استفاده در جاوااسکریپت

```js
import { t, setLanguage, language, dict } from './js/core/i18n.js';

t('ui.save');                       // ترجمه کلید
t('table.rows', '', { count: 24 }); // جای‌گذاری متغیر: "۲۴ سطر"
setLanguage('en');                  // تغییر زبان (جهت هم به‌روز می‌شود)
```

## تغییر زبان از رابط کاربری

- دکمه هدر با `[data-language-switch]`
- پنل شخصی‌سازی: `[data-customizer="language"] [data-value="ar"]`
- پالت فرمان (Ctrl+K) → «تغییر زبان»

```js
import { setLanguage } from './js/core/i18n.js';
setLanguage('ar', { direction: 'rtl' });   // جهت را دستی هم می‌توان تعیین کرد
```

## افزودن زبان جدید

1. فایل `src/locales/tr.js` را از `en.js` کپی کنید و ترجمه کنید:

```js
export const tr = {
  meta: { code: 'tr', label: 'Türkçe', dir: 'ltr', locale: 'tr-TR' },
  ui: { save: 'Kaydet', cancel: 'İptal', … },
  …
};
```

2. در `src/locales/index.js` آن را import و به `dictionaries` اضافه کنید:

```js
import { tr } from './tr.js';
const dictionaries = { fa, en, ar, tr };
```

3. اگر زبان راست‌به‌چپ است، `dir: 'rtl'` بگذارید؛ بقیه چیزها خودکار است (فونت، جهت، مجموعه ارقام).

## ارقام و اعداد

| زبان | مجموعه ارقام |
| --- | --- |
| fa | ۰۱۲۳۴۵۶۷۸۹ |
| ar | ٠١٢٣٤٥٦٧٨٩ |
| en | 0123456789 |

اعداد همیشه با `formatNumber`، `formatCurrency`، `formatPercent` یا `toDigits` قالب می‌شوند — هیچ‌گاه `Number` را مستقیم در متن نگذارید:

```js
import { formatCurrency, formatNumber, formatPercent } from './js/core/numbers.js';

formatCurrency(2480000000, 'IRR', { compact: true }); // ۲٫۵ میلیارد ریال
formatPercent(4.83);                                  // ۴٫۸٪
```

## تاریخ و تقویم

با `src/js/core/jalali.js` تاریخ‌ها هم در تقویم شمسی و هم میلادی نمایش داده می‌شوند:

```js
import { formatDate, relativeTime, toJalali, toGregorian } from './js/core/jalali.js';

formatDate('2026-09-22');        // ۳۱ شهریور ۱۴۰۵
relativeTime('2026-09-20');      // ۲ روز پیش
```

تقویم فعال با محور `calendar` در تنظیمات ظاهری جابه‌جا می‌شود (`jalali` ⇄ `gregorian`) و همه جدول‌ها، تقویم‌ها و نمودارهای زمانی همان را رعایت می‌کنند.

> نکته: به‌روزرسانی زبان رویداد `language:change` را منتشر می‌کند. جدول‌ها، نمودارها و تقویم‌ها به آن گوش می‌دهند و برچسب‌ها را دوباره می‌سازند؛ اگر ماژول جدیدی نوشتید، همین رویداد را مدیریت کنید.

> هشدار: متن فارسی را داخل فایل‌های JS (کنترل‌کننده‌ها) برای رابط کاربری ننویسید — تنها داده نمونه و متن‌های دمویی مجاز هستند.
