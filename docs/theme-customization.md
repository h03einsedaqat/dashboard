# شخصی‌سازی تم

تمام ظاهر محصول با **توکن‌های CSS** کنترل می‌شود. هیچ رنگ یا اندازه‌ای در کامپوننت‌ها هاردکد نشده؛ پس تغییر یک توکن روی همه صفحات اثر می‌گذارد.

## توکن‌های اصلی

```scss
/* src/scss/base/_tokens.scss */
:root {
  /* رنگ‌ها */
  --nv-primary: #4f46e5;
  --nv-primary-hover: #4338ca;
  --nv-primary-active: #3730a3;
  --nv-secondary: #64748b;
  --nv-success: #059669;
  --nv-warning: #d97706;
  --nv-danger: #dc2626;
  --nv-info: #0284c7;

  /* سطوح */
  --nv-bg: #f6f7fb;
  --nv-surface: #ffffff;
  --nv-surface-2: #f1f3f9;
  --nv-border: #e2e6ef;
  --nv-divider: #eef1f7;

  /* متن */
  --nv-text: #0f172a;
  --nv-text-2: #475069;
  --nv-text-muted: #7b8399;
  --nv-heading: #0b1220;

  /* فاصله، شعاع، سایه، تایپوگرافی */
  --nv-space-1: 0.25rem;  /* … تا --nv-space-12 */
  --nv-radius-sm: 0.5rem; /* xs | sm | md | lg | xl | pill */
  --nv-shadow-sm: 0 1px 2px rgb(15 23 42 / 6%);
  --nv-text-h4: clamp(1.05rem, 1.6vw, 1.25rem);
}
```

## تم‌های آماده

| تم | نحوه فعال‌سازی |
| --- | --- |
| روشن | `<html data-theme="light">` |
| تاریک | `<html data-theme="dark">` |
| سیستم | `<html data-theme="system">` — از `prefers-color-scheme` پیروی می‌کند |

پالت رنگی با `data-primary` روی `<html>` تعیین می‌شود: `indigo`, `blue`, `emerald`, `violet`, `orange`, `rose`.

## شش محور شخصی‌سازی

| محور | ویژگی روی `<html>` | مقدارها |
| --- | --- | --- |
| حالت رنگ | `data-theme` | `light` \| `dark` \| `system` |
| رنگ اصلی | `data-primary` | شش پالت |
| چیدمان | `data-layout` | `default` \| `mini` \| `collapse` \| `horizontal` \| `twocol` \| `boxed` |
| جهت | `data-direction` | `rtl` \| `ltr` |
| تراکم | `data-density` | `comfortable` \| `compact` |
| اندازه فونت | `data-font-size` | `sm` \| `md` \| `lg` |
| سبک سایدبار | `data-sidebar-style` | `fixed` \| `floating` \| `compact` |
| تقویم | `data-calendar` | `jalali` \| `gregorian` |

## کنترل از جاوااسکریپت

```js
import { theme } from './js/core/theme.js';

theme.set('primary', 'emerald');     // تغییر رنگ اصلی
theme.set('layout', 'mini');         // تغییر چیدمان
theme.toggleTheme();                 // روشن ⇄ تاریک
theme.toggleDirection();             // rtl ⇄ ltr
theme.reset();                       // بازگشت به پیش‌فرض‌ها
theme.onChange('primary', (value) => console.log(value));
```

پنل آماده کاربر هم از طریق `[data-customizer="<محور>"] [data-value="<مقدار>"]` کار می‌کند؛ کافی است همین ساختار را در هر صفحه‌ای بگذارید (نمونه: صفحه [پیش‌نمایش محصول](../preview.html)).

## ذخیره‌سازی

تنظیمات در `localStorage` با پیشوند `nova` ذخیره می‌شوند:

```text
nova:theme, nova:primary, nova:layout, nova:direction,
nova:density, nova:fontSize, nova:sidebarStyle, nova:calendar,
nova:sidebar:collapsed, nova:table:prefs, nova:dashboard:widgets
```

> نکته: برای جلوگیری از پرش تم هنگام بارگذاری، اسکریپت `public/assets/js/theme-boot.js` پیش از رندر، توکن‌ها را از `localStorage` می‌خواند و روی `<html>` می‌نشاند. این فایل را حذف نکنید.

## ساختن تم رنگی جدید

```scss
/* src/scss/base/_palettes.scss */
[data-primary='teal'] {
  --nv-primary: #0d9488;
  --nv-primary-hover: #0f766e;
  --nv-primary-active: #115e59;
  --nv-primary-rgb: 13 148 136;
  --nv-primary-soft: rgb(13 148 136 / 12%);
  --nv-primary-soft-fg: #0f766e;
}
```

سپس `teal` را به `PALETTES` در `src/js/core/theme.js` و به فهرست `defaultPrimary` در `config.js` اضافه کنید. کل محصول، از جمله نمودارها، رنگ جدید را می‌گیرد.

## تغییر فونت

فونت پیش‌فرض Vazirmatn است و از `node_modules` بارگذاری می‌شود. برای تغییر:

1. فونت جدید را در `public/assets/fonts/` بگذارید.
2. در `src/scss/base/_fonts.scss` مقدار `--nv-font` را عوض کنید.
3. برای پشتیبانی از ارقام فارسی، `--nv-font-numeric` را هم تنظیم کنید.

## چاپ

برای چاپ هر بخش، `data-print="#selector"` را روی دکمه بگذارید؛ رابط چاپ تمام پوسته را پنهان و فقط همان بخش را چاپ می‌کند (فاکتور، گزارش، برچسب).
