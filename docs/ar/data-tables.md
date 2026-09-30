# جداول البيانات

`DataTable` هو أكمل مكوّن في القالب: البحث والفلترة والترتيب وترقيم الصفحات وإظهار/إخفاء الأعمدة والتحديد المتعدد والعمليات الجماعية والتصدير إلى CSV/Excel/الطباعة وأربع حالات (تحميل، فارغ، خطأ، جاهز). وكل ذلك مكتوب دون أي اعتماد خارجي.

## الاستخدام التصريحي (أبسط طريقة)

```html
<div data-datatable
     data-resource="orders"
     data-per-page="10"
     data-selectable="true"
     data-search="true"
     data-filters="status=paid|unpaid|refunded">
  <table class="table table--hover"></table>
</div>
```

يمكنك أيضاً تعريف الأعمدة بـ `data-columns` (JSON) أو بـ `<th data-column="…">`:

```html
<th data-column="number" data-type="primary" data-sub="customer" data-sortable>رقم الطلب</th>
<th data-column="total" data-type="currency" data-align="end" data-sortable>المبلغ</th>
<th data-column="status" data-type="badge">الحالة</th>
```

## الاستخدام البرمجي

```js
import { createDataTable } from './js/core/datatable.js';

const table = createDataTable(document.querySelector('[data-datatable]'), {
  resource: 'products',
  perPage: 20,
  sort: 'createdAt',
  order: 'desc',
  filters: { status: 'active' },
  columns: [
    { key: 'name', label: 'اسم المنتج', type: 'primary', sub: 'sku', avatar: 'image', sortable: true },
    { key: 'price', label: 'السعر', type: 'currency', align: 'end', sortable: true },
    { key: 'inventory', label: 'المخزون', type: 'number', align: 'end' },
    { key: 'rating', label: 'التقييم', type: 'rating' },
    { key: 'status', label: 'الحالة', type: 'badge', labels: { active: 'نشط', draft: 'مسودة' } },
    { key: 'actions', label: 'الإجراءات', type: 'actions', href: 'ecommerce/product-details.html?id={id}' },
  ],
});
```

## أنواع الأعمدة

| `type` | المخرجات |
| --- | --- |
| `text` | نص بسيط (افتراضي) |
| `primary` | عنوان عريض + عنوان فرعي (`sub`) وصورة رمزية اختيارية |
| `number` | عدد بفواصل آلاف محلية |
| `currency` | مبلغ بالعملة النشطة |
| `percent` | نسبة مئوية مع الإشارة |
| `date` | تاريخ حسب التقويم النشط (هجري شمسي/ميلادي) |
| `relative` | «قبل يومين» |
| `badge` | شارة حالة بخريطة `labels` |
| `progress` | شريط تقدّم مع القيمة |
| `rating` | نجوم |
| `boolean` | علامة صح/خطأ ملوّنة |
| `avatar` | صورة دائرية |
| `chips` | قائمة وسوم |
| `link` | رابط على القيمة نفسها |
| `actions` | رابط إلى صفحة التفاصيل بنمط `{id}` |

## الفلاتر

تُبنى الفلاتر السريعة بالصيغة `field=value|value` ويمكن أن تشير إلى مفتاح البيانات أو إلى القيمة المعروضة. ويُعرض كل فلتر منها كـ `<select>` بجانب البحث:

```html
<div data-datatable data-resource="tickets"
     data-filters="priority=high|normal|low,statusLabel=مفتوحة|قيد المراجعة|مغلقة"></div>
```

## الأحداث

```js
import { bus, EVENTS } from './js/core/bus.js';

bus.on(EVENTS.tableSelection, ({ resource, ids }) => console.log(resource, ids));
bus.on(EVENTS.dataChanged, ({ resource, action }) => console.log(resource, action));
```

## التصدير

تعمل أزرار `[data-export="csv|excel|print"]` في شريط أدوات الجدول تلقائياً. ولأي جزء آخر من الصفحة، يكفي تعليم حاوية بـ `data-exportable="#selector"` (أو استدعاء `exportable(root)`).

## الحالات

| الحالة | العرض |
| --- | --- |
| التحميل | هياكل صفوف بدلاً من الجدول |
| فارغ | رسالة «لم يُعثر على عناصر» مع زر مسح الفلاتر |
| خطأ | رسالة خطأ مع زر «إعادة المحاولة» |
| تحديد نشط | شريط العمليات الجماعية مع العدّ والحذف الجماعي |

## حفظ تفضيلات المستخدم

اسم المورد (`resource`) هو مفتاح الحفظ؛ تُحفظ الأعمدة المخفية وترتيب الفرز وعدد الصفوف في `localStorage` بالبادئة `nova:table:` وتُستعاد في الزيارة التالية.

```js
localStorage.removeItem('nova:table:orders'); // العودة إلى الحالة الافتراضية
```

> ملاحظة: إذا أنشأت الجدول بعد عرض الصفحة، فاستدعِ `initDataTables(scope)` أو `createDataTable(node)`؛ وإعادة الإنشاء على العقدة نفسها آمنة (ذاكرة WeakMap داخلية).

> تحذير: اضبط دائماً `type: 'date'` أو `'relative'` لأعمدة التاريخ لتتحدّث بشكل صحيح عند تبديل التقويم الهجري الشمسي/الميلادي.
