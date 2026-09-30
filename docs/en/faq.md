# FAQ

## General

**Does it need a backend?**
No. Every page works with sample data. To connect a real API, see [API integration](api-integration.html).

**Can I use React/Vue too?**
The template is pure HTML/CSS/JS. You can load the bundle inside a React project, but the template's main advantage is that it is not tied to a framework.

**How many pages does it have?**
206 standalone pages (10 dashboards, 78 apps, 47 list tables, 21 UI Kit pages, 23 docs, 16 system pages, 11 authentication pages) plus the product page and the preview page.

**Are the fonts freely licensed?**
Yes. The Vazirmatn font is released under the SIL OFL and Bootstrap Icons under MIT. Details in [Credits](credits.html).

## Look and theme

**How do I set my brand colour?**
Create a new palette in `src/scss/base/_palettes.scss` and set `data-primary` to it. See [Theme customization](theme-customization.html).

**How do I change the logo?**
Replace `public/assets/logo.svg` (and the `logo-dark.svg`, `logo-mark.svg` and `favicon.svg` variants) with your own design; do not rename them.

**Does dark mode work for every component?**
Yes. The dark theme is built with tokens, not by overriding components, so any new element you build with tokens is supported automatically.

**How do I change the font size?**
From the customizer or with `theme.set('fontSize', 'lg')`. Since version 1.1, layout, density and menu style are fixed at their tested values and have been removed from the customizer so the shell never breaks.

## Data and tables

**Where do I change the data?**
In the `src/data/*.js` files. All of them are built from one generator with a fixed seed (`src/data/rng.js`), so the output is reproducible.

**How do I build a new table?**
See [Data tables](data-tables.html); with `data-datatable` and `data-resource` it takes a few lines.

**What about server-side filtering and sorting?**
The `page`, `perPage`, `search`, `sort`, `order` and filter parameters are sent to the API in the same request; your backend just has to accept them.

## Translation and calendar

**How do I add a fourth language?**
See [Localization](localization.html) — one dictionary file and one line in `index.js`.

**Do numbers always stay Persian?**
In Persian, yes. In English the digits become Latin and in Arabic they become Arabic-Indic; the direction changes too.

**How do I enable the Gregorian calendar?**
`theme.set('calendar', 'gregorian')` or the "Calendar" option in the customizer.

## Build and release

**Why does `npm run dev` run on port 5173?**
It is Vite's default port. Change it with `npm run dev -- --port 5180`.

**Why are styles not applied in development?**
The stylesheet link in `src/partials/head.html` is written with `?direct` so Vite serves it as CSS. If that parameter is removed, the file is served as a JS module and the page stays unstyled.

**Where do I upload the output?**
The contents of `dist/`. See [Deployment](deployment.html).

**How do I build the sales package?**
`npm run package` — it produces a standard ZIP with the `html/`, `source/`, `documentation/`, `assets/`, `screenshots/` and `changelog/` folders.

## Support

**Are updates free?**
The support and update period is described in `LICENSE.txt`.

**How do I report a bug?**
Via the support email (`supportEmail` in `src/config/config.js`), mentioning the version, browser and reproduction steps. Before sending, run `npm run qa:all` and attach the result.

> Tip: before asking, check [Troubleshooting](troubleshooting.html); most common problems are answered there.
