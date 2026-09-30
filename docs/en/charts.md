# Charts

All charts are built on ApexCharts and share one skin: colours from the active tokens, the Vazirmatn font, automatic right-to-left direction and a rebuild when the theme changes.

## Declarative usage

```html
<div class="chart" data-chart-key="revenue" data-chart="area" data-chart-height="320"></div>
```

The page controller fetches the data from the service layer and passes it to `initCharts(root)`. To build a chart by hand, provide `data-chart-series` as JSON:

```html
<div class="chart"
     data-chart="column"
     data-chart-height="300"
     data-chart-series='[{"name":"Sales","data":[120,180,140,210]}]'
     data-chart-labels='["Farvardin","Ordibehesht","Khordad","Tir"]'></div>
```

## Programmatic usage

```js
// Option 1 — directly on an element
import { createChart } from './js/core/charts.js';

await createChart(document.querySelector('#revenue'), {
  type: 'area',
  height: 320,
  series: [{ name: 'Revenue', data: [42, 58, 51, 74] }],
  labels: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir'],
});

// Option 2 — from a page controller with the `kit.chart` helper
import { chart } from './js/pages/kit.js';

container.innerHTML = chart({ key: 'revenue', type: 'area', height: 320, series: [{ name: 'Revenue', data: [42, 58, 51, 74] }], labels: ['Farvardin'] });
initCharts(container);
```

## Supported types

| Type | Suggested use |
| --- | --- |
| `area` | Revenue and traffic trends |
| `line` | Comparing two time series |
| `column` | Category comparison, monthly sales |
| `bar` | Horizontal ranking (product, agent) |
| `donut` | Share (device, plan, traffic source) |
| `pie` | Simple distribution |
| `radar` | Comparing several metrics |
| `radialBar` | Single-metric progress |
| `heatmap` | Hourly/daily patterns |
| `sparkline` | Micro chart inside a stat card |

## Colours and theme

The palette is read from the `--nv-chart-1…6` tokens, so charts change too when `data-primary` changes or when switching between light and dark.

```js
import { refreshCharts } from './js/core/charts.js';
refreshCharts();   // after a theme or language change
```

Automatically, the `theme.js` module emits the theme-change event and `charts.js` rebuilds every chart on the page; no extra code is needed.

## Number format and calendar labels

Axes and tooltips use `numbers.js`: localized thousands separators, compact numbers (`formatCompact`) and localized percentages. Time labels follow the active calendar (Jalali or Gregorian).

## Performance

- Charts are only built when their container is on the page (`initCharts` works on `[data-chart-key]`).
- When the window is resized, the chart rescales without being rebuilt.
- On heavy pages, do not build charts inside hidden tabs; call `initCharts(panel)` after the tab is shown.

> Tip: to remove a chart before rebuilding, call `chartInstance.destroy()`; `charts.js` keeps instances in a `WeakMap` so you do not leak memory.

> Warning: the `vendor-charts` bundle is about 540 KB and is only loaded on pages that have charts (code splitting with Vite). Do not add it to pages without charts.
