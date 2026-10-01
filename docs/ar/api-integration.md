# الربط بـ API

طبقة البيانات في القالب منفصلة عن الواجهة: لا تلمس المكونات البيانات النموذجية أبداً وجميعها تقرأ من `src/services/*`. والنتيجة أن ربط واجهة خلفية حقيقية تغيير صغير.

## العقد

| الطريقة | المسار | الوظيفة |
| --- | --- | --- |
| `GET` | `/resource?page=1&perPage=10&search=&sort=&order=&filters…` | قائمة مع ترقيم الصفحات |
| `GET` | `/resource/:id` | سجل واحد |
| `POST` | `/resource` | إنشاء |
| `PUT` | `/resource/:id` | استبدال |
| `PATCH` | `/resource/:id` | تحديث جزئي |
| `DELETE` | `/resource/:id` | حذف |

لاستجابة القائمة غلاف ثابت:

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

## تفعيل الوضع الحقيقي

```js
// src/config/config.js
api: {
  baseUrl: '/api',
  timeout: 8000,
  useMocks: false,   // ← هذا وحده يكفي
},
```

أو دون تغيير الشيفرة، قبل تحميل `main.js`:

```html
<script>
  window.NOVA_ADMIN_API = { baseUrl: 'https://api.example.com/v1', useMocks: false, timeout: 10000 };
</script>
```

من هذه اللحظة ترسل دوال `services.*` نفسها طلبات حقيقية؛ ولا يتغير أي متحكم.

## أمثلة الطلبات

```js
import * as services from './services/index.js';

const page = await services.orderService.list({ page: 1, perPage: 20, search: 'INV', sort: 'createdAt', order: 'desc', filters: { status: 'paid' } });
const order = await services.orderService.get('in-1024');
const created = await services.orderService.create({ customer: 'شركة ألفا', total: 24000000 });
await services.orderService.patch(created.id, { status: 'paid' });
await services.orderService.remove(created.id);
```

## الأخطاء

تُحوَّل كل استجابة فاشلة إلى `ApiError`:

```js
import { ApiError } from './services/client.js';

try {
  await services.productService.get('missing-id');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status, error.code, error.message);
    toast.danger('خطأ', error.message);
  }
}
```

| الرمز | الحالة | المعنى |
| --- | --- | --- |
| `api_error` | ٥٠٠ | خطأ عام |
| `not_found` | ٤٠٤ | لم يُعثر على السجل |
| `validation_error` | ٤٢٢ | بيانات إدخال غير صالحة |
| `unauthorized` | ٤٠١ | يلزم تسجيل الدخول |

## إضافة خدمة جديدة

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

ثم صدّرها من `src/services/index.js` وسجّلها في السجل الافتراضي:

```js
export { campaignService } from './marketing.service.js';
// …
campaigns: campaignService,
```

من هذه اللحظة يعمل `data-resource="campaigns"` في أي جدول.

## التوافق مع واجهات خلفية مختلفة

إذا كانت واجهتك البرمجية ترسل الاستجابة في غلاف آخر (`{ data: [...], meta: {...} }`)، فعدّل `client.js` فقط: حوّل مخرجات `fetch` إلى الشكل القياسي أعلاه وتبقى بقية الطبقة كما هي.

> ملاحظة: التأخير المصطنع (`mockLatency`) موجود لإظهار حالات التحميل. ولا يوجد هذا التأخير في الوضع الحقيقي.

> تحذير: لا تستورد أبداً البيانات النموذجية مباشرة في متحكم؛ فهذا بالضبط ما يمنعك لاحقاً من الربط بـ API.
