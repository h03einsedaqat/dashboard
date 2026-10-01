# API integration

The template's data layer is separate from the UI: components never touch sample data and all of them read from `src/services/*`. As a result, connecting a real backend is a small change.

## Contract

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/resource?page=1&perPage=10&search=&sort=&order=&filters…` | Paginated list |
| `GET` | `/resource/:id` | Single record |
| `POST` | `/resource` | Create |
| `PUT` | `/resource/:id` | Replace |
| `PATCH` | `/resource/:id` | Partial update |
| `DELETE` | `/resource/:id` | Delete |

The list response has a fixed envelope:

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

## Enabling real mode

```js
// src/config/config.js
api: {
  baseUrl: '/api',
  timeout: 8000,
  useMocks: false,   // ← this is all it takes
},
```

Or, without changing code, before `main.js` loads:

```html
<script>
  window.NOVA_ADMIN_API = { baseUrl: 'https://api.example.com/v1', useMocks: false, timeout: 10000 };
</script>
```

From then on the same `services.*` functions send real requests; no controller changes.

## Request examples

```js
import * as services from './services/index.js';

const page = await services.orderService.list({ page: 1, perPage: 20, search: 'INV', sort: 'createdAt', order: 'desc', filters: { status: 'paid' } });
const order = await services.orderService.get('in-1024');
const created = await services.orderService.create({ customer: 'Alpha Co.', total: 24000000 });
await services.orderService.patch(created.id, { status: 'paid' });
await services.orderService.remove(created.id);
```

## Errors

Every failed response is turned into an `ApiError`:

```js
import { ApiError } from './services/client.js';

try {
  await services.productService.get('missing-id');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status, error.code, error.message);
    toast.danger('Error', error.message);
  }
}
```

| Code | Status | Meaning |
| --- | --- | --- |
| `api_error` | 500 | Generic error |
| `not_found` | 404 | Record not found |
| `validation_error` | 422 | Invalid input data |
| `unauthorized` | 401 | Sign-in required |

## Adding a new service

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

Then export it from `src/services/index.js` and register it in the default registry:

```js
export { campaignService } from './marketing.service.js';
// …
campaigns: campaignService,
```

From then on `data-resource="campaigns"` works in any table.

## Adapting to different backends

If your API returns responses in a different envelope (`{ data: [...], meta: {...} }`), only adapt `client.js`: convert the `fetch` output to the standard shape above and the rest of the layer stays untouched.

> Tip: the artificial delay (`mockLatency`) exists so loading states are visible. There is no such delay in real mode.

> Warning: never import sample data directly in a controller; doing so is exactly what later prevents you from connecting to an API.
