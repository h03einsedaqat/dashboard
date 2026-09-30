# تعدد اللغات

يأتي القالب بثلاث لغات كاملة: **الفارسية (الافتراضية)** و**الإنجليزية** و**العربية**. تُقرأ جميع نصوص الواجهة من القواميس، ويُطبَّق تغيير اللغة وقت التشغيل.

## ملفات اللغة

```text
src/locales/
├── fa.js          القاموس الفارسي (اللغة الافتراضية والمرجعية)
├── en.js          الإنجليزية
├── ar.js          العربية
├── chrome.js      نصوص الهيكل: ui.* وsection.* وrole.*
├── generated.js   مولّد: nav.* والصفحات والعناوين
└── index.js       دمج القواميس + دوال مساعدة
```

ترتيب الدمج في `index.js`: `chrome` ← `generated` ← القاموس المكتوب يدوياً. أي أن قاموس اللغة هو الغالب دائماً.

## الاستخدام في HTML

```html
<!-- نص -->
<button data-i18n="ui.export">خروجی</button>

<!-- السمات -->
<input data-i18n-placeholder="ui.searchPlaceholder" placeholder="جستجو…">
<button data-i18n-title="ui.close" aria-label="بستن"></button>

<!-- محتوى HTML (استخدمه بقلّة) -->
<p data-i18n-html="landing.footerText"></p>
```

القيمة داخل الوسم هي **النص الاحتياطي** فقط؛ وهي ما يُعرض إذا لم تُنفَّذ جافاسكريبت.

## الاستخدام في جافاسكريبت

```js
import { t, setLanguage, language, dict } from './js/core/i18n.js';

t('ui.save');                       // ترجمة مفتاح
t('table.rows', '', { count: 24 }); // إدراج متغير: "٢٤ صفاً"
setLanguage('en');                  // تغيير اللغة (ويُحدَّث الاتجاه أيضاً)
```

## تغيير اللغة من الواجهة

- زر الترويسة ذو `[data-language-switch]`
- لوحة التخصيص: `[data-customizer="language"] [data-value="ar"]`
- لوحة الأوامر (Ctrl+K) ← «تغيير اللغة»

```js
import { setLanguage } from './js/core/i18n.js';
setLanguage('ar', { direction: 'rtl' });   // يمكن تحديد الاتجاه يدوياً أيضاً
```

## إضافة لغة جديدة

1. انسخ الملف `src/locales/tr.js` من `en.js` وترجمه:

```js
export const tr = {
  meta: { code: 'tr', label: 'Türkçe', dir: 'ltr', locale: 'tr-TR' },
  ui: { save: 'Kaydet', cancel: 'İptal', … },
  …
};
```

2. استورده في `src/locales/index.js` وأضفه إلى `dictionaries`:

```js
import { tr } from './tr.js';
const dictionaries = { fa, en, ar, tr };
```

3. إذا كانت اللغة من اليمين إلى اليسار فاضبط `dir: 'rtl'`؛ وكل ما عدا ذلك تلقائي (الخط، الاتجاه، مجموعة الأرقام).

## الأرقام والأعداد

| اللغة | مجموعة الأرقام |
| --- | --- |
| fa | ۰۱۲۳۴۵۶۷۸۹ |
| ar | ٠١٢٣٤٥٦٧٨٩ |
| en | 0123456789 |

تُنسَّق الأعداد دائماً بـ `formatNumber` أو `formatCurrency` أو `formatPercent` أو `toDigits` — لا تضع `Number` مباشرة في النص أبداً:

```js
import { formatCurrency, formatNumber, formatPercent } from './js/core/numbers.js';

formatCurrency(2480000000, 'IRR', { compact: true }); // ٢٫٥ مليار ريال
formatPercent(4.83);                                  // ٤٫٨٪
```

## التاريخ والتقويم

بواسطة `src/js/core/jalali.js` تُعرض التواريخ بالتقويم الهجري الشمسي وبالميلادي:

```js
import { formatDate, relativeTime, toJalali, toGregorian } from './js/core/jalali.js';

formatDate('2026-09-22');        // ٣١ شهريور ١٤٠٥
relativeTime('2026-09-20');      // قبل يومين
```

يُبدَّل التقويم النشط بمحور `calendar` في إعدادات المظهر (`jalali` ⇄ `gregorian`)، وتلتزم به جميع الجداول والتقاويم والمخططات الزمنية.

> ملاحظة: يُطلق تحديث اللغة الحدث `language:change`. تستمع إليه الجداول والمخططات والتقاويم وتعيد بناء تسمياتها؛ إذا كتبت وحدة جديدة، فتعامل مع الحدث نفسه.

> تحذير: لا تكتب نصوص الواجهة داخل ملفات JS (المتحكمات) — المسموح فقط البيانات النموذجية ونصوص العرض التجريبي.
