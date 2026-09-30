# Jalali calendar

The whole template works with the Jalali (Solar Hijri) calendar: dates, numbers and month names are localized, and you can switch to Gregorian at any time.

## Date conversion

```js
import { toJalali, toGregorian, parts, formatDate, relativeTime, monthLabel, weekdayLabels } from './js/core/jalali.js';

toJalali(new Date('2026-09-22'));   // { jy: 1405, jm: 6, jd: 31 }
toGregorian(1405, 6, 31);           // Date
parts('2026-09-22');                // date parts in the active calendar
```

Conversions are done with the `jalaali-js` library (exports are ESM named exports; a default import does not work).

## Formatting

```js
formatDate('2026-09-22');                       // 31 Shahrivar 1405
formatDate('2026-09-22', { format: 'long' });    // 31 Shahrivar 1405
formatDate('2026-09-22', { format: 'medium' });
formatDate('2026-09-22', { format: 'time' });    // 14:30
formatDate('2026-09-22', { format: 'datetime' });
formatDate('2026-09-22', { system: 'gregorian' }); // 22 September 2026
relativeTime('2026-09-20');                     // 2 days ago
```

## Calendar app

The `apps/calendar.html` page has four views: month, week, day and agenda.

```html
<div class="calendar-shell" data-calendar data-calendar-view="month" data-calendar-resource="calendar"></div>
```

| Attribute | Purpose |
| --- | --- |
| `data-calendar-view` | Initial view: `month` \| `week` \| `day` \| `agenda` |
| `data-calendar-resource` | Resource name in the service layer |
| `data-calendar-mini` | Small side calendar |

Features:

- Drag and drop an event onto another day (reschedule in one move)
- Create an event by clicking a day; edit, and delete with confirmation
- Colour-coded event categories (work, personal, meeting, reminder)
- Calendar switch key: `data-customizer="calendar"` or `theme.set('calendar', 'gregorian')`
- Events are kept in `localStorage` so they survive navigating between pages

## Jalali calendar in tables and charts

Date columns in data tables are formatted with `type: 'date'` or `type: 'relative'` and follow the current calendar axis:

```js
{ key: 'createdAt', label: 'تاریخ ثبت', type: 'date', sortable: true }
```

## Public holidays

The holiday list lives in `src/js/core/jalali.js` (the `JALALI_HOLIDAYS` constant) and is shown in a different colour in the calendar. For a new year, just update the array.

> Tip: displayed digits follow the active language (Persian, Arabic or Latin), but calculations are always done with Latin digits. Use `toDigits` for display conversion and `toLatinDigits` for calculations.

> Warning: never work with `new Date('۱۴۰۵/۰۶/۳۱')`; always keep date input in Gregorian (ISO) and convert only for display.
