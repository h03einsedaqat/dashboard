# Data tables

`DataTable` is the template's most complete component: search, filters, sorting, pagination, show/hide columns, multi-select, bulk actions, CSV/Excel/print export and four states (loading, empty, error, ready). All of it is written without any external dependency.

## Declarative usage (the simplest way)

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

You can also define columns with `data-columns` (JSON) or with `<th data-column="…">`:

```html
<th data-column="number" data-type="primary" data-sub="customer" data-sortable>Order number</th>
<th data-column="total" data-type="currency" data-align="end" data-sortable>Amount</th>
<th data-column="status" data-type="badge">Status</th>
```

## Programmatic usage

```js
import { createDataTable } from './js/core/datatable.js';

const table = createDataTable(document.querySelector('[data-datatable]'), {
  resource: 'products',
  perPage: 20,
  sort: 'createdAt',
  order: 'desc',
  filters: { status: 'active' },
  columns: [
    { key: 'name', label: 'Product name', type: 'primary', sub: 'sku', avatar: 'image', sortable: true },
    { key: 'price', label: 'Price', type: 'currency', align: 'end', sortable: true },
    { key: 'inventory', label: 'Stock', type: 'number', align: 'end' },
    { key: 'rating', label: 'Rating', type: 'rating' },
    { key: 'status', label: 'Status', type: 'badge', labels: { active: 'Active', draft: 'Draft' } },
    { key: 'actions', label: 'Actions', type: 'actions', href: 'ecommerce/product-details.html?id={id}' },
  ],
});
```

## Column types

| `type` | Output |
| --- | --- |
| `text` | Plain text (default) |
| `primary` | Bold title + subtitle (`sub`) and optional avatar |
| `number` | Number with localized thousands separators |
| `currency` | Amount in the active currency |
| `percent` | Percentage with sign |
| `date` | Date in the active calendar (Jalali/Gregorian) |
| `relative` | "2 days ago" |
| `badge` | Status badge using the `labels` map |
| `progress` | Progress bar with value |
| `rating` | Stars |
| `boolean` | Coloured check/cross |
| `avatar` | Round image |
| `chips` | List of tags |
| `link` | A link on the value itself |
| `actions` | Link to a details page using the `{id}` pattern |

## Filters

Quick filters are built with the `field=value|value` syntax and can refer to a data key or a display value. Each of these filters is shown as a `<select>` next to the search box:

```html
<div data-datatable data-resource="tickets"
     data-filters="priority=high|normal|low,statusLabel=Open|In review|Closed"></div>
```

## Events

```js
import { bus, EVENTS } from './js/core/bus.js';

bus.on(EVENTS.tableSelection, ({ resource, ids }) => console.log(resource, ids));
bus.on(EVENTS.dataChanged, ({ resource, action }) => console.log(resource, action));
```

## Exporting

The `[data-export="csv|excel|print"]` buttons in the table toolbar work automatically. For any other part of the page, just mark a container with `data-exportable="#selector"` (or call `exportable(root)`).

## States

| State | Display |
| --- | --- |
| Loading | Row skeletons instead of the table |
| Empty | A "No items found" message with a clear-filters button |
| Error | An error message with a "Try again" button |
| Active selection | Bulk action bar with a count and bulk delete |

## Saving user preferences

The resource name (`resource`) is the storage key; hidden columns, sort order and row count are kept in `localStorage` with the `nova:table:` prefix and restored on the next visit.

```js
localStorage.removeItem('nova:table:orders'); // back to the default state
```

> Tip: if you build a table after the page renders, call `initDataTables(scope)` or `createDataTable(node)`; building again on the same node is safe (internal WeakMap cache).

> Warning: always set `type: 'date'` or `'relative'` for date columns so they update correctly when the Jalali/Gregorian calendar changes.
