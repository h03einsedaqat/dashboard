# التقويم الهجري الشمسي

يعمل القالب بأكمله بالتقويم الهجري الشمسي (الجلالي): التواريخ والأرقام وأسماء الأشهر مترجمة، ويمكنك التبديل إلى الميلادي في أي لحظة.

## تحويل التاريخ

```js
import { toJalali, toGregorian, parts, formatDate, relativeTime, monthLabel, weekdayLabels } from './js/core/jalali.js';

toJalali(new Date('2026-09-22'));   // { jy: 1405, jm: 6, jd: 31 }
toGregorian(1405, 6, 31);           // Date
parts('2026-09-22');                // أجزاء التاريخ في التقويم النشط
```

تتم التحويلات بمكتبة `jalaali-js` (الأسماء المصدَّرة من نوع ESM المسماة؛ ولا يعمل الاستيراد الافتراضي).

## التنسيق

```js
formatDate('2026-09-22');                       // ٣١ شهريور ١٤٠٥
formatDate('2026-09-22', { format: 'long' });    // ٣١ شهريور ١٤٠٥
formatDate('2026-09-22', { format: 'medium' });
formatDate('2026-09-22', { format: 'time' });    // ١٤:٣٠
formatDate('2026-09-22', { format: 'datetime' });
formatDate('2026-09-22', { system: 'gregorian' }); // 22 September 2026
relativeTime('2026-09-20');                     // قبل يومين
```

## تطبيق التقويم (Calendar app)

تحتوي الصفحة `apps/calendar.html` على أربعة أنماط عرض: الشهر والأسبوع واليوم والقائمة.

```html
<div class="calendar-shell" data-calendar data-calendar-view="month" data-calendar-resource="calendar"></div>
```

| السمة | الوظيفة |
| --- | --- |
| `data-calendar-view` | العرض الأولي: `month` \| `week` \| `day` \| `agenda` |
| `data-calendar-resource` | اسم المورد في طبقة الخدمات |
| `data-calendar-mini` | تقويم صغير بجانب الصفحة |

الإمكانات:

- سحب حدث وإفلاته في يوم آخر (تغيير التاريخ بحركة واحدة)
- إنشاء حدث بالنقر على اليوم، والتعديل والحذف مع التأكيد
- تصنيف الأحداث بالألوان (عمل، شخصي، اجتماع، تذكير)
- مفتاح تبديل التقويم: `data-customizer="calendar"` أو `theme.set('calendar', 'gregorian')`
- تُحفظ الأحداث في `localStorage` لتبقى عند التنقل بين الصفحات

## التقويم الهجري الشمسي في الجداول والمخططات

تُنسَّق أعمدة التاريخ في جداول البيانات بـ `type: 'date'` أو `type: 'relative'` وتتبع محور التقويم الحالي:

```js
{ key: 'createdAt', label: 'تاریخ ثبت', type: 'date', sortable: true }
```

## العطل الرسمية

توجد قائمة العطل في `src/js/core/jalali.js` (الثابت `JALALI_HOLIDAYS`) وتُعرض بلون مختلف في التقويم. لسنة جديدة يكفي تحديث المصفوفة.

> ملاحظة: تتبع الأرقام المعروضة اللغة النشطة (فارسية أو عربية أو لاتينية)، لكن الحسابات تتم دائماً بالأرقام اللاتينية. استخدم `toDigits` للتحويل عند العرض و`toLatinDigits` للحساب.

> تحذير: لا تعمل أبداً بـ `new Date('۱۴۰۵/۰۶/۳۱')`؛ احتفظ دائماً بمدخلات التاريخ ميلادية (ISO) وحوّلها للعرض فقط.
