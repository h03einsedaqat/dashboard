# Localization

The template ships with three complete languages: **Persian (default)**, **English** and **Arabic**. All interface text is read from dictionaries, and a language change is applied at runtime.

## Language files

```text
src/locales/
├── fa.js          Persian dictionary (default and reference language)
├── en.js          English
├── ar.js          Arabic
├── chrome.js      shell strings: ui.*, section.*, role.*
├── generated.js   generated: nav.*, pages, titles
└── index.js       dictionary merge + helpers
```

Merge order in `index.js`: `chrome` → `generated` → hand-written dictionary. In other words, the language dictionary always wins.

## Usage in HTML

```html
<!-- text -->
<button data-i18n="ui.export">خروجی</button>

<!-- attributes -->
<input data-i18n-placeholder="ui.searchPlaceholder" placeholder="جستجو…">
<button data-i18n-title="ui.close" aria-label="بستن"></button>

<!-- HTML content (use sparingly) -->
<p data-i18n-html="landing.footerText"></p>
```

The value inside the tag is only the **fallback text**; it is what is shown if JavaScript does not run.

## Usage in JavaScript

```js
import { t, setLanguage, language, dict } from './js/core/i18n.js';

t('ui.save');                       // translate a key
t('table.rows', '', { count: 24 }); // variable interpolation: "24 rows"
setLanguage('en');                  // change language (direction is updated too)
```

## Changing the language from the UI

- The header button with `[data-language-switch]`
- The customizer: `[data-customizer="language"] [data-value="ar"]`
- Command palette (Ctrl+K) → "Change language"

```js
import { setLanguage } from './js/core/i18n.js';
setLanguage('ar', { direction: 'rtl' });   // the direction can also be set manually
```

## Adding a new language

1. Copy `src/locales/tr.js` from `en.js` and translate it:

```js
export const tr = {
  meta: { code: 'tr', label: 'Türkçe', dir: 'ltr', locale: 'tr-TR' },
  ui: { save: 'Kaydet', cancel: 'İptal', … },
  …
};
```

2. Import it in `src/locales/index.js` and add it to `dictionaries`:

```js
import { tr } from './tr.js';
const dictionaries = { fa, en, ar, tr };
```

3. If the language is right-to-left, set `dir: 'rtl'`; everything else is automatic (font, direction, digit set).

## Digits and numbers

| Language | Digit set |
| --- | --- |
| fa | ۰۱۲۳۴۵۶۷۸۹ |
| ar | ٠١٢٣٤٥٦٧٨٩ |
| en | 0123456789 |

Numbers are always formatted with `formatNumber`, `formatCurrency`, `formatPercent` or `toDigits` — never put a `Number` directly into text:

```js
import { formatCurrency, formatNumber, formatPercent } from './js/core/numbers.js';

formatCurrency(2480000000, 'IRR', { compact: true }); // 2.5 billion rials
formatPercent(4.83);                                  // 4.8%
```

## Dates and calendars

With `src/js/core/jalali.js` dates are displayed in both the Jalali (Solar Hijri) and the Gregorian calendar:

```js
import { formatDate, relativeTime, toJalali, toGregorian } from './js/core/jalali.js';

formatDate('2026-09-22');        // 31 Shahrivar 1405
relativeTime('2026-09-20');      // 2 days ago
```

The active calendar is switched with the `calendar` axis in the appearance settings (`jalali` ⇄ `gregorian`), and all tables, calendars and time-series charts respect it.

> Tip: a language update emits the `language:change` event. Tables, charts and calendars listen to it and rebuild their labels; if you write a new module, handle the same event.

> Warning: do not write interface text inside JS files (controllers) — only sample data and demo text are allowed there.
