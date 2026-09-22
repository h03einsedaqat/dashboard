# اتصال به API

لایه داده قالب از رابط کاربری جدا است: کامپوننت‌ها هیچ‌وقت به داده نمونه دست نمی‌زنند و همه از `src/services/*` می‌خوانند. نتیجه این‌که وصل‌کردن بک‌اند واقعی یک تغییر کوچک است.

## قرارداد

| متد | مسیر | کار |
| --- | --- | --- |
| `GET` | `/resource?page=1&perPage=10&search=&sort=&order=&filters…` | فهرست با صفحه‌بندی |
| `GET` | `/resource/:id` | یک رکورد |
| `POST` | `/resource` | ساخت |
| `PUT` | `/resource/:id` | جایگزینی |
| `PATCH` | `/resource/:id` | به‌روزرسانی جزئی |
| `DELETE` | `/resource/:id` | حذف |

پاسخ فهرست یک پاکت ثابت دارد:

```json
{
  "items": [],
  "total": 128,
  "page": 1,
  "perPage": 10,
  "pages": 13,
  "hasNext": true,
  "hasPrev": false
}
```

## روشن کردن حالت واقعی

```js
// src/config/config.js
api: {
  baseUrl: '/api',
  timeout: 8000,
  useMocks: false,   // ← همین‌جا کافی است
},
```

یا بدون تغییر کد، قبل از بارگذاری `main.js`:

```html
<script>
  window.NOVA_ADMIN_API = { baseUrl: 'https://api.example.com/v1', useMocks: false, timeout: 10000 };
</script>
```

از این لحظه همان توابع `services.*` درخواست واقعی می‌فرستند؛ هیچ کنترل‌کننده‌ای تغییر نمی‌کند.

## نمونه درخواست

```js
import * as services from './services/index.js';

const page = await services.orderService.list({ page: 1, perPage: 20, search: 'INV', sort: 'createdAt', order: 'desc', filters: { status: 'paid' } });
const order = await services.orderService.get('in-1024');
const created = await services.orderService.create({ customer: 'شرکت آلفا', total: 24000000 });
await services.orderService.patch(created.id, { status: 'paid' });
await services.orderService.remove(created.id);
```

## خطاها

هر پاسخ ناموفق به `ApiError` تبدیل می‌شود:

```js
import { ApiError } from './services/client.js';

try {
  await services.productService.get('missing-id');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status, error.code, error.message);
    toast.danger('خطا', error.message);
  }
}
```

| کد | وضعیت | معنی |
| --- | --- | --- |
| `api_error` | ۵۰۰ | خطای عمومی |
| `not_found` | ۴۰۴ | رکورد پیدا نشد |
| `validation_error` | ۴۲۲ | داده ورودی نامعتبر |
| `unauthorized` | ۴۰۱ | نیاز به ورود |

## افزودن سرویس جدید

```js
// src/services/marketing.service.js
import { createResourceService } from './resource.js';
import { campaigns } from '../data/marketing.js';

export const campaignService = createResourceService({
  name: 'campaigns',
  collection: () => campaigns,
  idPrefix: 'cp',
  searchFields: ['name', 'channel', 'owner'],
  sortFields: ['name', 'budget', 'startedAt'],
});
```

سپس در `src/services/index.js` آن را export و در رجیستری پیش‌فرض ثبت کنید:

```js
export { campaignService } from './marketing.service.js';
// …
campaigns: campaignService,
```

از این لحظه `data-resource="campaigns"` در هر جدولی کار می‌کند.

## تطبیق با بک‌اندهای مختلف

اگر API شما پاسخ را در پاکت دیگری می‌فرستد (`{ data: [...], meta: {...} }`)، فقط `client.js` را تطبیق دهید: خروجی `fetch` را به شکل استاندارد بالا تبدیل کنید و بقیه لایه دست‌نخورده می‌ماند.

> نکته: تأخیر مصنوعی (`mockLatency`) برای دیده‌شدن حالت‌های بارگذاری است. در حالت واقعی این تأخیر وجود ندارد.

> هشدار: هرگز داده نمونه را مستقیم در کنترل‌کننده import نکنید؛ همین کار باعث می‌شود بعداً نتوانید به API وصل شوید.
