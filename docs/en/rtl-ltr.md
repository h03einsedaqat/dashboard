# RTL and LTR

Bidirectional support in NOVAADMIN is not "patched on"; it is built in from the ground up. All styles are written with **logical properties** and there is no manual `margin-left` or `left: 0` anywhere.

## How it works

| Layer | Approach |
| --- | --- |
| Document root | `<html dir="rtl">` or `<html dir="ltr">` |
| Bootstrap | The RTL or LTR build is swapped in dynamically |
| Project CSS | `inset-inline`, `margin-inline`, `padding-block`, `border-inline-start` |
| Directional icons | The `flip-rtl` class |
| Special layouts | Direction-agnostic grids (auto-flow) or `grid-auto-flow: column` |

```scss
/* example from the sidebar */
.app-sidebar {
  inline-size: var(--nv-sidebar-w);
  inset-inline-start: 0;
  border-inline-end: 1px solid var(--nv-border);
}
.app-main {
  margin-inline-start: var(--nv-sidebar-w);
}
```

## Changing direction at runtime

```js
import { theme } from './js/core/theme.js';
theme.toggleDirection();
// or
theme.set('direction', 'ltr');
```

Or use a button with `data-direction-toggle`. (Since version 1.1 the direction option has been removed from the customizer and the direction changes together with the language.)

## Important notes for components

- **Dropdowns:** the panel is aligned with `inset-inline-start/end`; use `dropdown-menu--end` so it opens correctly in both directions.
- **Charts:** axes are configured with `rtl: true` in `src/js/core/charts.js`, and numbers are always rendered left-to-right (`--nv-numeric`).
- **Calendar and kanban:** columns follow grid logic; cards are moved with SortableJS and their order is saved in `localStorage`.
- **Invoice print sheet:** the direction follows the page direction and numbers are isolated with `dir="ltr"`.
- **Forms:** icons inside inputs are spaced with `padding-inline-start`, not `padding-left`.

## Directional icons

```html
<i class="bi bi-arrow-left flip-rtl" aria-hidden="true"></i>
```

The `flip-rtl` class is defined in `src/scss/utilities/_helpers.scss` and rotates the icon 180 degrees in `rtl` mode.

## Bidirectional testing

1. Switch the direction with `Ctrl + Shift + L` (or the `[data-direction-toggle]` button).
2. Check these pages in both directions: `dashboards/analytics.html`, `crm/pipeline.html`, `apps/calendar.html`, `apps/email.html`, `finance/invoice-details.html`, `ui/tables.html`.
3. Make sure no extra horizontal scrollbar (overflow) appears and floating panels do not stick out past the page edge.

> Tip: if you build a custom component, never use `left/right/top/bottom`. If you have to, write the `[dir='rtl']` variant next to it and explain why in a comment.

> Warning: do not override Bootstrap RTL with custom CSS on `[dir='rtl']`; use logical tokens only, so both modes are fed from a single source.
