# تخصيص السمة

يُتحكّم في مظهر المنتج بالكامل عبر **رموز CSS**. لا يوجد أي لون أو حجم مثبّت في المكونات؛ لذا يؤثر تغيير رمز واحد في جميع الصفحات.

## الرموز الأساسية

```scss
/* src/scss/base/_tokens.scss */
:root {
  /* الألوان */
  --nv-primary: #4f46e5;
  --nv-primary-hover: #4338ca;
  --nv-primary-active: #3730a3;
  --nv-secondary: #64748b;
  --nv-success: #059669;
  --nv-warning: #d97706;
  --nv-danger: #dc2626;
  --nv-info: #0284c7;

  /* الأسطح */
  --nv-bg: #f6f7fb;
  --nv-surface: #ffffff;
  --nv-surface-2: #f1f3f9;
  --nv-border: #e2e6ef;
  --nv-divider: #eef1f7;

  /* النص */
  --nv-text: #0f172a;
  --nv-text-2: #475069;
  --nv-text-muted: #7b8399;
  --nv-heading: #0b1220;

  /* المسافات، الانحناء، الظل، الطباعة */
  --nv-space-1: 0.25rem;  /* … حتى --nv-space-12 */
  --nv-radius-sm: 0.5rem; /* xs | sm | md | lg | xl | pill */
  --nv-shadow-sm: 0 1px 2px rgb(15 23 42 / 6%);
  --nv-text-h4: clamp(1.05rem, 1.6vw, 1.25rem);
}
```

## السمات الجاهزة

| السمة | طريقة التفعيل |
| --- | --- |
| فاتحة | `<html data-theme="light">` |
| داكنة | `<html data-theme="dark">` |
| حسب النظام | `<html data-theme="system">` — تتبع `prefers-color-scheme` |

تُحدَّد لوحة الألوان بـ `data-primary` على `<html>`: `indigo`, `blue`, `emerald`, `violet`, `orange`, `rose`.

## محاور التخصيص

| المحور | السمة على `<html>` | القيم |
| --- | --- | --- |
| وضع الألوان | `data-theme` | `light` \| `dark` \| `system` |
| اللون الأساسي | `data-primary` | ست لوحات |
| التخطيط | `data-layout` | `default` \| `mini` \| `collapse` \| `horizontal` \| `twocol` \| `boxed` |
| الاتجاه | `data-direction` | `rtl` \| `ltr` |
| الكثافة | `data-density` | `comfortable` \| `compact` |
| حجم الخط | `data-font-size` | `sm` \| `md` \| `lg` |
| نمط الشريط الجانبي | `data-sidebar-style` | `fixed` \| `floating` \| `compact` |
| التقويم | `data-calendar` | `jalali` \| `gregorian` |

## التحكم من جافاسكريبت

```js
import { theme } from './js/core/theme.js';

theme.set('primary', 'emerald');     // تغيير اللون الأساسي
// layout / density / sidebarStyle ثابتة منذ الإصدار 1.1 ولا يؤثر set فيها
theme.toggleTheme();                 // فاتح ⇄ داكن
theme.toggleDirection();             // rtl ⇄ ltr
theme.reset();                       // العودة إلى القيم الافتراضية
theme.onChange('primary', (value) => console.log(value));
```

تعمل لوحة المستخدم الجاهزة أيضاً عبر `[data-customizer="<المحور>"] [data-value="<القيمة>"]`؛ يكفي وضع البنية نفسها في أي صفحة (مثال: صفحة [معاينة المنتج](../preview.html)).

## التخزين

تُحفظ الإعدادات في `localStorage` بالبادئة `nova`:

```text
nova:theme, nova:primary, nova:layout, nova:direction,
nova:density, nova:fontSize, nova:sidebarStyle, nova:calendar,
nova:sidebar:collapsed, nova:table:prefs, nova:dashboard:widgets
```

> ملاحظة: لمنع وميض السمة أثناء التحميل، يقرأ السكربت `public/assets/js/theme-boot.js` الرموز من `localStorage` قبل العرض ويطبّقها على `<html>`. لا تحذف هذا الملف.

## إنشاء سمة لونية جديدة

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

ثم أضف `teal` إلى `PALETTES` في `src/js/core/theme.js` وإلى قائمة `defaultPrimary` في `config.js`. سيأخذ المنتج كله، بما فيه المخططات، اللون الجديد.

## تغيير الخط

الخط الافتراضي هو Vazirmatn ويُحمّل من `node_modules`. لتغييره:

1. ضع الخط الجديد في `public/assets/fonts/`.
2. غيّر قيمة `--nv-font` في `src/scss/base/_fonts.scss`.
3. لدعم الأرقام الفارسية، اضبط `--nv-font-numeric` أيضاً.

## الطباعة

لطباعة أي قسم، ضع `data-print="#selector"` على الزر؛ فتخفي طبقة الطباعة الهيكل كله وتطبع ذلك القسم فقط (فاتورة، تقرير، ملصق).
