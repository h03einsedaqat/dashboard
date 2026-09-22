# RTL و LTR

پشتیبانی دوجهته در NOVAADMIN «وصله‌شده» نیست؛ از پایه ساخته شده است. تمام استایل‌ها با **ویژگی‌های منطقی** (logical properties) نوشته شده‌اند و هیچ‌جا `margin-left` یا `left: 0` دستی وجود ندارد.

## نحوه کار

| لایه | روش |
| --- | --- |
| ریشه سند | `<html dir="rtl">` یا `<html dir="ltr">` |
| بوت‌استرپ | نسخه RTL یا LTR به‌صورت پویا جایگزین می‌شود |
| CSS پروژه | `inset-inline`, `margin-inline`, `padding-block`, `border-inline-start` |
| آیکن‌های جهت‌دار | کلاس `flip-rtl` |
| چیدمان‌های خاص | گرید بدون تعیین جهت (auto-flow) یا `grid-auto-flow: column` |

```scss
/* نمونه از سایدبار */
.app-sidebar {
  inline-size: var(--nv-sidebar-w);
  inset-inline-start: 0;
  border-inline-end: 1px solid var(--nv-border);
}
.app-main {
  margin-inline-start: var(--nv-sidebar-w);
}
```

## تغییر جهت در زمان اجرا

```js
import { theme } from './js/core/theme.js';
theme.toggleDirection();
// یا
theme.set('direction', 'ltr');
```

یا از دکمه‌ای با `data-direction-toggle` یا از پنل شخصی‌سازی: `[data-customizer="direction"] [data-value="ltr"]`.

## نکات مهم برای کامپوننت‌ها

- **دراپ‌دان‌ها:** پنل با `inset-inline-start/end` تراز می‌شود؛ از `dropdown-menu--end` استفاده کنید تا در هر دو جهت درست باز شود.
- **نمودارها:** محورها با `rtl: true` در `src/js/core/charts.js` تنظیم می‌شوند و اعداد همیشه لاتین و چپ‌به‌راست رندر می‌شوند (`--nv-numeric`).
- **تقویم و کانبان:** ستون‌ها از منطق گرید پیروی می‌کنند؛ جابه‌جایی کارت‌ها با SortableJS و ذخیره ترتیب در `localStorage`.
- **برگه چاپ فاکتور:** جهت بر اساس جهت صفحه تنظیم می‌شود و اعداد با `dir="ltr"` جدا می‌شوند.
- **فرم‌ها:** آیکون‌های داخل ورودی با `padding-inline-start` فاصله می‌گیرند، نه `padding-left`.

## آیکن‌های جهت‌دار

```html
<i class="bi bi-arrow-left flip-rtl" aria-hidden="true"></i>
```

کلاس `flip-rtl` در `src/scss/utilities/_helpers.scss` تعریف شده و در حالت `rtl` آیکن را ۱۸۰ درجه می‌چرخاند.

## تست دوجهته

1. با `Ctrl + Shift + L` (یا دکمه `[data-direction-toggle]`) جهت را عوض کنید.
2. این صفحه‌ها را در هر دو جهت بررسی کنید: `dashboards/analytics.html`، `crm/pipeline.html`، `apps/calendar.html`، `apps/email.html`، `finance/invoice-details.html`، `ui/tables.html`.
3. مطمئن شوید هیچ نوار افقی اضافه (overflow) ایجاد نمی‌شود و پنل‌های شناور از لبه صفحه بیرون نمی‌زنند.

> نکته: اگر کامپوننت سفارشی می‌سازید، هرگز از `left/right/top/bottom` استفاده نکنید. اگر ناچار بودید، نسخه `[dir='rtl']` را کنار آن بنویسید و دلیلش را کامنت کنید.

> هشدار: بوت‌استرپ RTL را با CSS سفارشی روی `[dir='rtl']` بازنویسی نکنید؛ فقط از توکن‌های منطقی استفاده کنید تا دو حالت از یک منبع تغذیه شوند.
