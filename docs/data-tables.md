# جدول داده

`DataTable` کامل‌ترین کامپوننت قالب است: جستجو، فیلتر، مرتب‌سازی، صفحه‌بندی، نمایش/پنهان کردن ستون، انتخاب چندگانه، عملیات گروهی، خروجی CSV/اکسل/چاپ و چهار حالت وضعیت (بارگذاری، خالی، خطا، آماده). همه بدون هیچ وابستگی بیرونی نوشته شده است.

## استفاده اعلانی (ساده‌ترین راه)

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

ستون‌ها را هم می‌توانید با `data-columns` (JSON) یا با `<th data-column="…">` تعریف کنید:

```html
<th data-column="number" data-type="primary" data-sub="customer" data-sortable>شماره سفارش</th>
<th data-column="total" data-type="currency" data-align="end" data-sortable>مبلغ</th>
<th data-column="status" data-type="badge">وضعیت</th>
```

## استفاده برنامه‌ای

```js
import { createDataTable } from './js/core/datatable.js';

const table = createDataTable(document.querySelector('[data-datatable]'), {
  resource: 'products',
  perPage: 20,
  sort: 'createdAt',
  order: 'desc',
  filters: { status: 'active' },
  columns: [
    { key: 'name', label: 'نام محصول', type: 'primary', sub: 'sku', avatar: 'image', sortable: true },
    { key: 'price', label: 'قیمت', type: 'currency', align: 'end', sortable: true },
    { key: 'inventory', label: 'موجودی', type: 'number', align: 'end' },
    { key: 'rating', label: 'امتیاز', type: 'rating' },
    { key: 'status', label: 'وضعیت', type: 'badge', labels: { active: 'فعال', draft: 'پیش‌نویس' } },
    { key: 'actions', label: 'عملیات', type: 'actions', href: 'ecommerce/product-details.html?id={id}' },
  ],
});
```

## نوع ستون‌ها

| `type` | خروجی |
| --- | --- |
| `text` | متن ساده (پیش‌فرض) |
| `primary` | عنوان پررنگ + زیرعنوان (`sub`) و آواتار اختیاری |
| `number` | عدد با جداکننده هزارگان فارسی |
| `currency` | مبلغ با ارز فعال |
| `percent` | درصد با علامت |
| `date` | تاریخ بر اساس تقویم فعال (شمسی/میلادی) |
| `relative` | «۲ روز پیش» |
| `badge` | نشان وضعیت با نقشه `labels` |
| `progress` | نوار پیشرفت با عدد |
| `rating` | ستاره‌ها |
| `boolean` | تیک/ضربدر با رنگ |
| `avatar` | تصویر گرد |
| `chips` | فهرست برچسب‌ها |
| `link` | لینک روی همان مقدار |
| `actions` | لینک به صفحه جزئیات با الگوی `{id}` |

## فیلترها

فیلترهای سریع با ساختار `field=value|value` ساخته می‌شوند و می‌توانند به کلید داده یا مقدار نمایشی اشاره کنند. هر یک از این فیلترها به‌صورت `<select>` کنار جستجو نمایش داده می‌شود:

```html
<div data-datatable data-resource="tickets"
     data-filters="priority=high|normal|low,statusLabel=باز|در حال بررسی|بسته"></div>
```

## رویدادها

```js
import { bus, EVENTS } from './js/core/bus.js';

bus.on(EVENTS.tableSelection, ({ resource, ids }) => console.log(resource, ids));
bus.on(EVENTS.dataChanged, ({ resource, action }) => console.log(resource, action));
```

## خروجی گرفتن

دکمه‌های `[data-export="csv|excel|print"]` در نوار ابزار جدول به‌صورت خودکار کار می‌کنند. برای هر بخش دیگری از صفحه، کافی است ظرفی را با `data-exportable="#selector"` علامت بزنید (یا `exportable(root)` را صدا بزنید).

## وضعیت‌ها

| حالت | نمایش |
| --- | --- |
| بارگذاری | اسکلتون سطر به‌جای جدول |
| خالی | پیام «موردی یافت نشد» با دکمه پاک‌کردن فیلترها |
| خطا | پیام خطا با دکمه «تلاش دوباره» |
| انتخاب فعال | نوار عملیات گروهی با شمارش و حذف گروهی |

## ذخیره ترجیحات کاربر

نام منبع (`resource`) کلید ذخیره است؛ ستون‌های پنهان، ترتیب مرتب‌سازی و تعداد سطر در `localStorage` با پیشوند `nova:table:` نگه‌داری می‌شوند و در بازدید بعدی بازگردانده می‌شوند.

```js
localStorage.removeItem('nova:table:orders'); // بازگشت به حالت پیش‌فرض
```

> نکته: اگر جدول را بعد از رندر صفحه می‌سازید، `initDataTables(scope)` یا `createDataTable(node)` را صدا بزنید؛ ساخت دوباره روی همان گره بی‌خطر است (کش داخلی WeakMap).

> هشدار: برای ستون‌های تاریخی همیشه `type: 'date'` یا `'relative'` بگذارید تا با تغییر تقویم شمسی/میلادی درست به‌روز شوند.
