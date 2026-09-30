# Components

The NOVAADMIN component library contains 39 ready-made components. All of them are built from the Design System tokens, work correctly in every layout and in both directions, and can be seen on the `ui/*` pages.

## Component list

| Category | Components | Demo page |
| --- | --- | --- |
| Basics | Button, icon button, button group, segmented | `ui/buttons.html` |
| Basics | Badge, status chip, avatar, online indicator | `ui/badges.html`, `ui/avatars.html` |
| Basics | Card, stat card, media card, tile | `ui/cards.html` |
| Forms | Input, select, multi-select, switch, slider, upload, OTP, search | `ui/forms.html`, `ui/inputs.html` |
| Navigation | Tabs, accordion, dropdown, breadcrumb, pagination, nested sidebar | `ui/tabs.html`, `ui/dropdowns.html` |
| Data | Table, data table, tree, grouped list, timeline | `ui/tables.html`, `ui/timeline.html` |
| Feedback | Alert, toast, modal, confirmation, empty state, error state, skeleton | `ui/alerts.html`, `ui/toasts.html`, `ui/states.html` |
| Display | Chart, progress, rating, calendar, kanban, chat | `ui/charts.html`, `ui/progress.html` |
| Layout | Grid, two-column, box, widget | `ui/grid.html` |
| Typography | Headings, paragraph, link, code block | `ui/typography.html` |

## Code samples

### Buttons

```html
<button class="btn btn-primary">Save</button>
<button class="btn btn-light">Cancel</button>
<button class="btn btn-soft-success">Approve</button>
<button class="btn btn-danger btn-sm">Delete</button>
<button class="icon-btn" aria-label="Edit"><i class="bi bi-pencil"></i></button>
```

### Stat card

```html
<article class="stat-card">
  <div class="stat-card__head">
    <span class="stat-card__label">Monthly revenue</span>
    <span class="stat-card__icon stat-card__icon--primary"><i class="bi bi-cash-stack"></i></span>
  </div>
  <p class="stat-card__value numeric">2.4 billion</p>
  <span class="stat-card__trend"><i class="bi bi-arrow-up-right"></i> 12.4%</span>
</article>
```

### Callouts

```html
<div class="callout callout--info"><i class="bi bi-info-circle"></i><div><strong>Tip</strong><p class="mb-0">Help text</p></div></div>
<div class="callout callout--warning"><i class="bi bi-exclamation-triangle"></i><div><strong>Warning</strong><p class="mb-0">Warning text</p></div></div>
```

### Toasts from JavaScript

```js
import { toast } from './js/core/toast.js';

toast.success('Saved', 'Your changes were saved successfully.');
toast.warning('Heads up', 'Two required fields are empty.');
toast.danger('Error', 'Could not connect to the server.');
toast.info('Info', 'A new version is available.');
```

The toast position is selectable: `data-toast-host="top-start"`, `top-end`, `bottom-start`, `bottom-end`; they are mirrored in RTL mode.

### Dialogs and confirmations

```js
import { modal } from './js/core/modal.js';

await modal.confirm({ title: 'Delete product', text: 'This action cannot be undone.', tone: 'danger', confirmText: 'Delete' });
modal.alert({ title: 'Info', text: 'The file is ready to download.' });
```

### Tabs and accordion

```html
<div class="tabs" data-tabs>
  <nav class="nav nav-tabs" role="tablist">
    <button class="nav-link active" data-tab="a" role="tab">First section</button>
    <button class="nav-link" data-tab="b" role="tab">Second section</button>
  </nav>
  <div class="tab-content">
    <div class="tab-pane active" data-tab-panel="a">…</div>
    <div class="tab-pane" data-tab-panel="b" hidden>…</div>
  </div>
</div>
```

Behaviours are registered in `src/js/core/ui.js`; pages that build their content with JavaScript must call `initUi(root)` after rendering (the template's controllers already do this).

## Class structure

```text
.block               base
.block__element      inner part
.block--modifier     state or size
.is-*                behavioural state toggled by JS (is-active, is-loading)
```

> Tip: colours come from tokens only; to create a new state use `--nv-*`, not a raw colour code.

> Warning: do not hard-code the behavioural `is-*` classes in HTML. If an element must start active, use a controller or `[data-tabs]` so the logic stays in one place.
