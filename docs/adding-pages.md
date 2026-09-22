# افزودن صفحه جدید

سه راه برای اضافه کردن صفحه وجود دارد. برای هر سه، منبع حقیقت `tools/manifest.mjs` است.

## راه اول: افزودن به منو (پیشنهادی)

در `tools/manifest.mjs` آیتم جدید را در بخش مناسب اضافه کنید:

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

سپس:

```bash
npm run gen:pages    # صفحه‌ها ساخته می‌شوند
npm run build        # ساخت کامل
```

خروجی: `src/pages/marketing/campaigns.html` و `src/pages/marketing/budget.html` به‌همراه ورودی منو، breadcrumb، عنوان‌ها در سه زبان و مسیر در `sitemap.xml`.

| کلید | مقدارهای مجاز | کار |
| --- | --- | --- |
| `kind` | `dashboard` \| `list` \| `detail` \| `form` \| `app` \| `doc` \| `ui` \| `system` \| `auth` | تعیین پوسته و رفتار پیش‌فرض |
| `resource` | نام منبع در `src/services/index.js` | جدول/داده صفحه از کجا بیاید |
| `url` | مسیر نسبی با پسوند `.html` | آدرس نهایی صفحه |
| `badge` | `{ text, variant }` | نشان کنار آیتم منو |

## راه دوم: صفحه بدون منو

اگر صفحه فقط از یک جای دیگر لینک می‌شود (مثل جزئیات)، از `extraPages` استفاده کنید:

```js
export const extraPages = [
  { url: 'marketing/campaign-details.html', label: L('جزئیات کمپین', 'Campaign Details', 'تفاصیل'), kind: 'app', resource: 'campaigns' },
];
```

## راه سوم: بدنه اختصاصی

صفحه‌های تولیدشده بدنه‌شان یک جای‌نگهدار است:

```html
<div data-app="overview" data-resource="campaigns" data-title="کمپین‌ها"></div>
```

برای نوشتن HTML دلخواه، فایل هم‌نام را در `src/partials/pages/` بسازید (مسیر = مسیر صفحه):

```text
src/partials/pages/marketing/budget.html
```

از این لحظه، این فایل به‌جای جای‌نگهدار در صفحه قرار می‌گیرد و در ساخت‌های بعدی حفظ می‌شود. نمونه واقعی در همین قالب: `src/partials/pages/preview.html`.

> نکته: داخل این فایل‌ها می‌توانید از `{{ROOT}}`، `{{APP_NAME}}`، `{{VERSION}}` و `{{TAGLINE}}` استفاده کنید؛ این توکن‌ها در زمان ساخت جای‌گذاری می‌شوند.

## نوشتن کنترل‌کننده

اگر صفحه رفتار اختصاصی دارد، آن را در `src/js/pages/` بنویسید و در `src/main.js` مسیرش را وصل کنید:

```js
// src/js/pages/marketing.js
import { $, on, render, escapeHtml } from '../core/dom.js';
import * as kit from './kit.js';

export async function initMarketing() {
  const node = $('[data-app="overview"]');
  if (!node) return;
  node.dataset.appClaimed = '1';                    // جای‌نگهدار را از رندرکننده عمومی می‌گیرد
  const items = await kit.services.campaignService.list({ perPage: 12 });
  render(node, `<div class="dashboard-shell">${kit.pageHeader({ title: 'کمپین‌ها', icon: 'megaphone' })}…</div>`);
}
```

```js
// src/main.js — داخل AREA_CONTROLLERS
'marketing/': async () => (await import('./js/pages/marketing.js')).initMarketing(),
```

نکته مهم: پرچم `appClaimed` را پیش از رندر بگذارید؛ وگرنه رندرکننده عمومی همان جای‌نگهدار را پر می‌کند و محتوای شما پاک می‌شود.

## ترجمه صفحه

عنوان صفحه به‌صورت خودکار با کلید `nav.<id>` در `src/locales/generated.js` ساخته می‌شود و از `label` منیفست می‌آید. برای متن‌های داخل بدنه، از `data-i18n` و کلیدهای `src/locales/*.js` استفاده کنید.

## چک‌لیست افزودن صفحه

1. ورودی منیفست نوشته شد و `npm run gen:pages` سبز است
2. مسیر صفحه در مرورگر باز می‌شود و در دو جهت RTL/LTR درست است
3. در تم روشن و تاریک بررسی شد
4. بدون خطای کنسول و بدون overflow افقی در ۳۲۰ پیکسل
5. `npm run qa:all` سبز است
