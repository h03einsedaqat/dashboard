# Theme customization

The product's entire look is controlled by **CSS tokens**. No colour or size is hard-coded in the components, so changing one token affects every page.

## Core tokens

```scss
/* src/scss/base/_tokens.scss */
:root {
  /* colours */
  --nv-primary: #4f46e5;
  --nv-primary-hover: #4338ca;
  --nv-primary-active: #3730a3;
  --nv-secondary: #64748b;
  --nv-success: #059669;
  --nv-warning: #d97706;
  --nv-danger: #dc2626;
  --nv-info: #0284c7;

  /* surfaces */
  --nv-bg: #f6f7fb;
  --nv-surface: #ffffff;
  --nv-surface-2: #f1f3f9;
  --nv-border: #e2e6ef;
  --nv-divider: #eef1f7;

  /* text */
  --nv-text: #0f172a;
  --nv-text-2: #475069;
  --nv-text-muted: #7b8399;
  --nv-heading: #0b1220;

  /* spacing, radius, shadow, typography */
  --nv-space-1: 0.25rem;  /* … up to --nv-space-12 */
  --nv-radius-sm: 0.5rem; /* xs | sm | md | lg | xl | pill */
  --nv-shadow-sm: 0 1px 2px rgb(15 23 42 / 6%);
  --nv-text-h4: clamp(1.05rem, 1.6vw, 1.25rem);
}
```

## Built-in themes

| Theme | How to enable |
| --- | --- |
| Light | `<html data-theme="light">` |
| Dark | `<html data-theme="dark">` |
| System | `<html data-theme="system">` — follows `prefers-color-scheme` |

The colour palette is set with `data-primary` on `<html>`: `indigo`, `blue`, `emerald`, `violet`, `orange`, `rose`.

## Customization axes

| Axis | Attribute on `<html>` | Values |
| --- | --- | --- |
| Colour mode | `data-theme` | `light` \| `dark` \| `system` |
| Primary colour | `data-primary` | six palettes |
| Layout | `data-layout` | `default` \| `mini` \| `collapse` \| `horizontal` \| `twocol` \| `boxed` |
| Direction | `data-direction` | `rtl` \| `ltr` |
| Density | `data-density` | `comfortable` \| `compact` |
| Font size | `data-font-size` | `sm` \| `md` \| `lg` |
| Sidebar style | `data-sidebar-style` | `fixed` \| `floating` \| `compact` |
| Calendar | `data-calendar` | `jalali` \| `gregorian` |

## Controlling it from JavaScript

```js
import { theme } from './js/core/theme.js';

theme.set('primary', 'emerald');     // change the primary colour
// layout / density / sidebarStyle are fixed since 1.1 and set() has no effect on them
theme.toggleTheme();                 // light ⇄ dark
theme.toggleDirection();             // rtl ⇄ ltr
theme.reset();                       // back to the defaults
theme.onChange('primary', (value) => console.log(value));
```

The ready-made user panel also works through `[data-customizer="<axis>"] [data-value="<value>"]`; just put the same structure on any page (example: the [product preview](../preview.html) page).

## Storage

Settings are stored in `localStorage` with the `nova` prefix:

```text
nova:theme, nova:primary, nova:layout, nova:direction,
nova:density, nova:fontSize, nova:sidebarStyle, nova:calendar,
nova:sidebar:collapsed, nova:table:prefs, nova:dashboard:widgets
```

> Tip: to prevent a theme flash while loading, the `public/assets/js/theme-boot.js` script reads the tokens from `localStorage` before rendering and applies them to `<html>`. Do not remove this file.

## Creating a new colour theme

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

Then add `teal` to `PALETTES` in `src/js/core/theme.js` and to the `defaultPrimary` list in `config.js`. The whole product, charts included, picks up the new colour.

## Changing the font

The default font is Vazirmatn, loaded from `node_modules`. To change it:

1. Put the new font in `public/assets/fonts/`.
2. Change the `--nv-font` value in `src/scss/base/_fonts.scss`.
3. For Persian digit support, also set `--nv-font-numeric`.

## Printing

To print any section, put `data-print="#selector"` on a button; the print layer hides the whole shell and prints only that section (invoice, report, label).
