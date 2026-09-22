# تقویم شمسی

کل قالب با تقویم شمسی کار می‌کند: تاریخ‌ها، اعداد و نام ماه‌ها فارسی هستند و می‌توانید در هر لحظه به میلادی سوئیچ کنید.

## تبدیل تاریخ

```js
import { toJalali, toGregorian, parts, formatDate, relativeTime, monthLabel, weekdayLabels } from './js/core/jalali.js';

toJalali(new Date('2026-09-22'));   // { jy: 1405, jm: 6, jd: 31 }
toGregorian(1405, 6, 31);           // Date
parts('2026-09-22');                // اجزای تاریخ در تقویم فعال
```

تبدیل‌ها روی کتابخانه `jalaali-js` انجام می‌شوند (نام‌های صادرشده ESM هستند؛ import پیش‌فرض کار نمی‌کند).

## قالب‌بندی

```js
formatDate('2026-09-22');                       // ۳۱ شهریور ۱۴۰۵
formatDate('2026-09-22', { format: 'long' });    // ۳۱ شهریور ۱۴۰۵
formatDate('2026-09-22', { format: 'medium' });
formatDate('2026-09-22', { format: 'time' });    // ۱۴:۳۰
formatDate('2026-09-22', { format: 'datetime' });
formatDate('2026-09-22', { system: 'gregorian' }); // 22 September 2026
relativeTime('2026-09-20');                     // ۲ روز پیش
```

## تقویم برنامه (Calendar app)

صفحه `apps/calendar.html` چهار نما دارد: ماه، هفته، روز و فهرست.

```html
<div class="calendar-shell" data-calendar data-calendar-view="month" data-calendar-resource="calendar"></div>
```

| ویژگی | کار |
| --- | --- |
| `data-calendar-view` | نمای اولیه: `month` \| `week` \| `day` \| `agenda` |
| `data-calendar-resource` | نام منبع در لایه سرویس |
| `data-calendar-mini` | تقویم کوچک کنار صفحه |

قابلیت‌ها:

- کشیدن‌و‌رها کردن رویداد به روز دیگر (تغییر تاریخ با یک حرکت)
- ساخت رویداد با کلیک روی روز، ویرایش و حذف با تأیید
- دسته‌بندی رنگی رویدادها (کاری، شخصی، جلسه، یادآوری)
- کلید تغییر تقویم: `data-customizer="calendar"` یا `theme.set('calendar', 'gregorian')`
- رویدادها در `localStorage` نگه‌داری می‌شوند تا رفت‌و‌برگشت بین صفحات حفظ شود

## تقویم شمسی در جدول‌ها و نمودارها

ستون‌های تاریخ در جدول‌های داده با `type: 'date'` یا `type: 'relative'` قالب‌بندی می‌شوند و از محور تقویم فعلی پیروی می‌کنند:

```js
{ key: 'createdAt', label: 'تاریخ ثبت', type: 'date', sortable: true }
```

## تعطیلات رسمی

فهرست تعطیلات در `src/js/core/jalali.js` (ثابت `JALALI_HOLIDAYS`) قرار دارد و در تقویم با رنگ متفاوت نمایش داده می‌شود. برای سال جدید فقط آرایه را به‌روز کنید.

> نکته: نمایش ارقام در تقویم همیشه فارسی است، اما محاسبات با اعداد لاتین انجام می‌شود. برای تبدیل نمایشی از `toDigits` و برای محاسبه از `toLatinDigits` استفاده کنید.

> هشدار: هرگز با `new Date('۱۴۰۵/۰۶/۳۱')` کار نکنید؛ ورودی تاریخ را همیشه میلادی (ISO) نگه دارید و فقط برای نمایش تبدیل کنید.
