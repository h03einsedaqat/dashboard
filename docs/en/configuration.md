# Configuration

All product settings live in one file: `src/config/config.js`. It has no imports so it can be used both in the browser and in Node tools.

## Brand and version

```js
export const config = {
  appName: 'NOVAADMIN',
  appShortName: 'NOVA',
  tagline: 'Modern. Persian-First. Enterprise Ready.',
  version: '1.0.0',
  releaseDate: '2026-09-22',

  logo: 'assets/logo.svg',
  logoMark: 'assets/logo-mark.svg',
  logoDark: 'assets/logo-dark.svg',
  favicon: 'assets/favicon.svg',
  …
};
```

Changing `appName` updates it everywhere (page title, sidebar, footer, meta, package name); values are substituted at build time through the `{{APP_NAME}}`, `{{TAGLINE}}` and `{{VERSION}}` tokens.

## Appearance defaults

| Key | Allowed values | Notes |
| --- | --- | --- |
| `defaultLanguage` | `fa`, `en`, `ar` | Initial interface language |
| `defaultDirection` | `rtl`, `ltr` | Initial direction |
| `defaultTheme` | `light`, `dark`, `system` | Colour mode |
| `defaultPrimary` | `indigo`, `blue`, `emerald`, `violet`, `orange`, `rose` | Primary colour |
| `defaultLayout` | `sidebar`, `mini`, `collapse`, `horizontal`, `twocol`, `boxed` | Layout |
| `defaultDensity` | `comfortable`, `compact` | Density |
| `defaultFontSize` | `sm`, `md`, `lg` | Base text size |
| `defaultSidebarStyle` | `fixed`, `floating`, `compact` | Sidebar style |
| `defaultCalendar` | `jalali`, `gregorian` | Default calendar |

## Region, currency and date

```js
currency: 'IRR',                        // IRR | USD | EUR | AED
currencyList: ['IRR', 'USD', 'EUR', 'AED'],
timezone: 'Asia/Tehran',
dateFormat: 'YYYY/MM/DD',
```

Currency and number formatting is defined in `src/js/core/numbers.js` and the same function is used everywhere; adding a new currency takes a single line:

```js
export const CURRENCIES = {
  IRR: { label: 'ریال', symbol: 'ریال', digits: 0, fa: 'fa-IR' },
  USD: { label: 'دلار', symbol: '$', digits: 2, fa: 'en-US' },
  AED: { label: 'درهم', symbol: 'د.إ', digits: 2, fa: 'ar-AE' },
  EUR: { label: 'یورو', symbol: '€', digits: 2, fa: 'de-DE' },
};
```

## Behaviour and data

```js
storagePrefix: 'nova',          // prefix for localStorage keys
mockLatency: [180, 420],        // simulated service response latency
mockErrors: false,              // true ⇒ occasionally returns an error response
defaultPageSize: 10,            // default number of table rows
```

## Features

```js
features: {
  commandPalette: true,
  globalSearch: true,
  themeCustomizer: true,
  demoSwitcher: true,
  notifications: true,
  shortcutsHelp: true,
  dashboardCustomizer: true,
  chat: true,
  aiWorkspace: true,
},
```

If you set a feature to `false`, its button and panel are removed from the shell and its logic does not run.

## Connecting to a backend

```js
api: {
  baseUrl: '/api',
  timeout: 8000,
  useMocks: true,   // false ⇒ real HTTP requests
},
```

With `useMocks: false` the service layer sends real requests instead of returning sample data. Contract details are in [API integration](api-integration.html).

## Changing the sample data

| File | Contents |
| --- | --- |
| `src/data/analytics.js` | Time series, KPIs, traffic sources |
| `src/data/commerce.js` | Products, orders, inventory, coupons |
| `src/data/crm.js` | Contacts, companies, deals, campaigns |
| `src/data/finance.js` | Transactions, invoices, subscriptions |
| `src/data/people.js` | Users, roles, team |
| `src/data/projects.js` | Projects, tasks, kanban |
| `src/data/support.js` | Tickets, agents, knowledge base |
| `src/data/hr.js` | Employees, attendance, leave, payroll |
| `src/data/logistics.js` | Shipments, drivers, warehouses |
| `src/data/ai.js` | Models, prompts, conversations, usage |
| `src/data/system.js` | Landing, plans, FAQ, documentation, shortcuts |
| `src/data/rng.js` | Pseudo-random generator with a fixed seed (reproducible output) |

> Tip: all data is built with `rng.js` and a fixed seed, so tables and charts are identical on every build. If you want random data, change the seed in `rng.js`.

> Warning: never use duplicate `import`s or mutual dependencies in `src/data/**` files; they must remain an acyclic tree.
