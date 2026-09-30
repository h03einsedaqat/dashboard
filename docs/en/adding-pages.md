# Adding a new page

There are three ways to add a page. For all three, the source of truth is `tools/manifest.mjs`.

## Option 1: add it to the menu (recommended)

Add the new item to the right section in `tools/manifest.mjs`:

```js
{
  id: 'marketing',
  label: L('بازاریابی', 'Marketing', 'التسويق'),
  icon: 'megaphone',
  kind: 'list',
  children: [
    { id: 'mkt-campaigns', label: L('کمپین‌ها', 'Campaigns', 'الحملات'), icon: 'send', url: 'marketing/campaigns.html', resource: 'campaigns', kind: 'list' },
    { id: 'mkt-budget', label: L('بودجه', 'Budget', 'الميزانية'), icon: 'wallet2', url: 'marketing/budget.html', kind: 'overview' },
  ],
}
```

Then:

```bash
npm run gen:pages    # pages are generated
npm run build        # full build
```

Output: `src/pages/marketing/campaigns.html` and `src/pages/marketing/budget.html`, together with the menu entry, breadcrumb, titles in three languages and the route in `sitemap.xml`.

| Key | Allowed values | Purpose |
| --- | --- | --- |
| `kind` | `dashboard` \| `list` \| `detail` \| `form` \| `app` \| `doc` \| `ui` \| `system` \| `auth` | Chooses the shell and default behaviour |
| `resource` | A resource name in `src/services/index.js` | Where the page's table/data comes from |
| `url` | Relative path with the `.html` extension | Final page address |
| `badge` | `{ text, variant }` | Badge next to the menu item |

## Option 2: a page without a menu entry

If the page is only linked from somewhere else (like a details page), use `extraPages`:

```js
export const extraPages = [
  { url: 'marketing/campaign-details.html', label: L('جزئیات کمپین', 'Campaign Details', 'تفاصیل'), kind: 'app', resource: 'campaigns' },
];
```

## Option 3: a custom body

Generated pages have a placeholder as their body:

```html
<div data-app="overview" data-resource="campaigns" data-title="Campaigns"></div>
```

To write your own HTML, create a file with the same name in `src/partials/pages/` (path = page path):

```text
src/partials/pages/marketing/budget.html
```

From then on this file is placed in the page instead of the placeholder and is preserved in later builds. A real example in this template: `src/partials/pages/preview.html`.

> Tip: inside these files you can use `{{ROOT}}`, `{{APP_NAME}}`, `{{VERSION}}` and `{{TAGLINE}}`; these tokens are substituted at build time.

## Writing a controller

If the page has its own behaviour, write it in `src/js/pages/` and wire its route in `src/main.js`:

```js
// src/js/pages/marketing.js
import { $, on, render, escapeHtml } from '../core/dom.js';
import * as kit from './kit.js';

export async function initMarketing() {
  const node = $('[data-app="overview"]');
  if (!node) return;
  node.dataset.appClaimed = '1';                    // claims the placeholder from the generic renderer
  const items = await kit.services.campaignService.list({ perPage: 12 });
  render(node, `<div class="dashboard-shell">${kit.pageHeader({ title: 'Campaigns', icon: 'megaphone' })}…</div>`);
}
```

```js
// src/main.js — inside AREA_CONTROLLERS
'marketing/': async () => (await import('./js/pages/marketing.js')).initMarketing(),
```

Important: set the `appClaimed` flag before rendering; otherwise the generic renderer fills the same placeholder and your content is wiped.

## Translating the page

The page title is generated automatically with the `nav.<id>` key in `src/locales/generated.js` and comes from the manifest `label`. For text inside the body, use `data-i18n` and the keys in `src/locales/*.js`.

## Checklist for adding a page

1. The manifest entry is written and `npm run gen:pages` is green
2. The page route opens in the browser and is correct in both RTL and LTR
3. Checked in the light and dark themes
4. No console errors and no horizontal overflow at 320 pixels
5. `npm run qa:all` is green
