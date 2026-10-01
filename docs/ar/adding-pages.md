# إضافة صفحة جديدة

توجد ثلاث طرق لإضافة صفحة. ومصدر الحقيقة في الثلاث هو `tools/manifest.mjs`.

## الطريقة الأولى: الإضافة إلى القائمة (موصى بها)

أضف العنصر الجديد في القسم المناسب من `tools/manifest.mjs`:

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

ثم:

```bash
npm run gen:pages    # تُولَّد الصفحات
npm run build        # بناء كامل
```

المخرجات: `src/pages/marketing/campaigns.html` و`src/pages/marketing/budget.html` مع عنصر القائمة ومسار التنقل والعناوين بثلاث لغات والمسار في `sitemap.xml`.

| المفتاح | القيم المسموح بها | الوظيفة |
| --- | --- | --- |
| `kind` | `dashboard` \| `list` \| `detail` \| `form` \| `app` \| `doc` \| `ui` \| `system` \| `auth` | تحديد الهيكل والسلوك الافتراضي |
| `resource` | اسم مورد في `src/services/index.js` | مصدر جدول/بيانات الصفحة |
| `url` | مسار نسبي بالامتداد `.html` | العنوان النهائي للصفحة |
| `badge` | `{ text, variant }` | شارة بجانب عنصر القائمة |

## الطريقة الثانية: صفحة بلا قائمة

إذا كانت الصفحة تُربط فقط من مكان آخر (مثل صفحة التفاصيل)، فاستخدم `extraPages`:

```js
export const extraPages = [
  { url: 'marketing/campaign-details.html', label: L('جزئیات کمپین', 'Campaign Details', 'تفاصيل'), kind: 'app', resource: 'campaigns' },
];
```

## الطريقة الثالثة: محتوى مخصص

محتوى الصفحات المولّدة هو موضع محجوز:

```html
<div data-app="overview" data-resource="campaigns" data-title="الحملات"></div>
```

لكتابة HTML خاص بك، أنشئ ملفاً بالاسم نفسه في `src/partials/pages/` (المسار = مسار الصفحة):

```text
src/partials/pages/marketing/budget.html
```

من هذه اللحظة يوضع هذا الملف في الصفحة بدلاً من الموضع المحجوز ويُحفظ في عمليات البناء اللاحقة. مثال حقيقي في هذا القالب: `src/partials/pages/preview.html`.

> ملاحظة: يمكنك داخل هذه الملفات استخدام `{{ROOT}}` و`{{APP_NAME}}` و`{{VERSION}}` و`{{TAGLINE}}`؛ وتُستبدل هذه الرموز وقت البناء.

## كتابة المتحكم

إذا كان للصفحة سلوك خاص، فاكتبه في `src/js/pages/` واربط مساره في `src/main.js`:

```js
// src/js/pages/marketing.js
import { $, on, render, escapeHtml } from '../core/dom.js';
import * as kit from './kit.js';

export async function initMarketing() {
  const node = $('[data-app="overview"]');
  if (!node) return;
  node.dataset.appClaimed = '1';                    // يستحوذ على الموضع المحجوز من العارض العام
  const items = await kit.services.campaignService.list({ perPage: 12 });
  render(node, `<div class="dashboard-shell">${kit.pageHeader({ title: 'الحملات', icon: 'megaphone' })}…</div>`);
}
```

```js
// src/main.js — داخل AREA_CONTROLLERS
'marketing/': async () => (await import('./js/pages/marketing.js')).initMarketing(),
```

مهم: اضبط العلامة `appClaimed` قبل العرض؛ وإلا فسيملأ العارض العام الموضع نفسه ويُمحى محتواك.

## ترجمة الصفحة

يُنشأ عنوان الصفحة تلقائياً بالمفتاح `nav.<id>` في `src/locales/generated.js` ويأتي من `label` في البيان. وللنصوص داخل المحتوى، استخدم `data-i18n` ومفاتيح `src/locales/*.js`.

## قائمة التحقق لإضافة صفحة

1. كُتب عنصر البيان و`npm run gen:pages` ناجح
2. يُفتح مسار الصفحة في المتصفح وهو صحيح في الاتجاهين RTL/LTR
3. فُحصت في السمتين الفاتحة والداكنة
4. لا أخطاء في وحدة التحكم ولا تجاوز أفقي عند ٣٢٠ بكسل
5. `npm run qa:all` ناجح
