# RTL وLTR

دعم الاتجاهين في NOVAADMIN ليس «ترقيعاً»؛ بل مبني من الأساس. كُتبت جميع الأنماط بـ **الخصائص المنطقية** (logical properties) ولا يوجد في أي مكان `margin-left` أو `left: 0` يدوي.

## طريقة العمل

| الطبقة | الأسلوب |
| --- | --- |
| جذر المستند | `<html dir="rtl">` أو `<html dir="ltr">` |
| Bootstrap | يُستبدل إصدار RTL أو LTR ديناميكياً |
| CSS المشروع | `inset-inline`, `margin-inline`, `padding-block`, `border-inline-start` |
| الأيقونات الاتجاهية | الفئة `flip-rtl` |
| التخطيطات الخاصة | شبكات لا تحدد الاتجاه (auto-flow) أو `grid-auto-flow: column` |

```scss
/* مثال من الشريط الجانبي */
.app-sidebar {
  inline-size: var(--nv-sidebar-w);
  inset-inline-start: 0;
  border-inline-end: 1px solid var(--nv-border);
}
.app-main {
  margin-inline-start: var(--nv-sidebar-w);
}
```

## تغيير الاتجاه وقت التشغيل

```js
import { theme } from './js/core/theme.js';
theme.toggleDirection();
// أو
theme.set('direction', 'ltr');
```

أو عبر زر يحمل `data-direction-toggle`. (منذ الإصدار 1.1 أُزيل خيار الاتجاه من لوحة التخصيص وأصبح الاتجاه يتغير مع اللغة.)

## ملاحظات مهمة للمكونات

- **القوائم المنسدلة:** تُحاذى اللوحة بـ `inset-inline-start/end`؛ استخدم `dropdown-menu--end` لتنفتح بشكل صحيح في الاتجاهين.
- **المخططات:** تُضبط المحاور بـ `rtl: true` في `src/js/core/charts.js` وتُعرض الأرقام دائماً من اليسار إلى اليمين (`--nv-numeric`).
- **التقويم وكانبان:** تتبع الأعمدة منطق الشبكة؛ ويتم نقل البطاقات بـ SortableJS وحفظ الترتيب في `localStorage`.
- **ورقة طباعة الفاتورة:** يُضبط الاتجاه حسب اتجاه الصفحة وتُعزل الأرقام بـ `dir="ltr"`.
- **النماذج:** تُباعد الأيقونات داخل الحقول بـ `padding-inline-start` لا `padding-left`.

## الأيقونات الاتجاهية

```html
<i class="bi bi-arrow-left flip-rtl" aria-hidden="true"></i>
```

الفئة `flip-rtl` معرّفة في `src/scss/utilities/_helpers.scss` وتدير الأيقونة ١٨٠ درجة في وضع `rtl`.

## اختبار الاتجاهين

1. غيّر الاتجاه بـ `Ctrl + Shift + L` (أو بالزر `[data-direction-toggle]`).
2. افحص هذه الصفحات في الاتجاهين: `dashboards/analytics.html` و`crm/pipeline.html` و`apps/calendar.html` و`apps/email.html` و`finance/invoice-details.html` و`ui/tables.html`.
3. تأكد من عدم ظهور شريط تمرير أفقي إضافي (overflow) وعدم خروج اللوحات العائمة عن حافة الصفحة.

> ملاحظة: إذا أنشأت مكوّناً مخصصاً، فلا تستخدم أبداً `left/right/top/bottom`. وإن اضطررت، فاكتب نسخة `[dir='rtl']` بجانبه واشرح السبب في تعليق.

> تحذير: لا تُعِد كتابة Bootstrap RTL بـ CSS مخصص على `[dir='rtl']`؛ استخدم الرموز المنطقية فقط ليتغذى الوضعان من مصدر واحد.
