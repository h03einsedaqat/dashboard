# Troubleshooting

This section is based on problems that genuinely occur in HTML/Vite projects. Each entry contains the symptom, the cause and the fix.

## The page opens without styles

**Symptom:** text is shown without colour or spacing; in the network panel, the SCSS file was loaded with `Content-Type: application/javascript`.

**Cause:** in development Vite serves `.scss` files as JS modules and the browser does not apply them as a stylesheet.

**Fix:** the stylesheet link must carry the `?direct` parameter (in `src/partials/head.html`):

```html
<link rel="stylesheet" href="/src/scss/main.scss?direct">
```

In the final output (`npm run build`) this link is replaced with a hashed CSS file.

## Links from nested pages return 404

**Cause:** every page sits one folder deeper, so `users/list.html` from inside `crm/contacts.html` must be `../users/list.html`.

**Fix:** links generated at runtime are fixed automatically by `src/js/core/links.js` (`fixLinks` + `observeLinks`). If you write a fixed link yourself:

```html
<a href="{{ROOT}}users/list.html">Users</a>
```

Or use `NOVA.url('users/list.html')` in JavaScript.

## Pages end up in `dist/src/pages` after building

**Cause:** Vite input keys must have the `.html` extension.

**Fix:** make sure `tools/build-pages.mjs` and `tools/flatten-dist.mjs` are in the `npm run build` chain and that the `flatten-dist` step is the last one.

## Classes I wrote in JS have no styles

**Fix:** run `npm run qa:links`; this tool compares every class used in HTML and in JS templates with the existing styles and lists what is missing.

## `{{...}}` tokens are left in the output HTML

**Cause:** you added a new token that is not in the token map in `tools/nova-plugin.mjs`.

**Fix:** add it to `TOKENS` and run `npm run build` again. To check:

```bash
grep -ro "{{[A-Z_]*}}" dist --include=*.html | sort -u
```

## Table data does not load and "No items found" is shown

**Possible causes:**
1. The resource name in `data-resource` does not match the registry key in `src/services/index.js`.
2. The default filter is too strict; press the "Clear filters" button.
3. The field name does not exist in the service's `searchFields`; the search box works but returns nothing.

## My changes are lost on the next build

**Cause:** the `src/pages/**` files are rewritten on every build.

**Fix:** make the change in `src/partials/pages/<path>.html` or in the relevant controller in `src/js/pages/**`.

## The Persian font does not load

**Cause:** the font is read from `node_modules/vazirmatn`. If `node_modules` is incomplete, the woff2 file cannot be found.

**Fix:** run `npm install` to completion. In the final output the font is in `dist/assets/fonts/`; check that it is there:

```bash
ls dist/assets/fonts/
```

## A chart stays empty

**Possible causes:** the chart container does not exist, `data-chart-key` is duplicated, or `initCharts` was called before the DOM was rendered.

**Fix:** call `initCharts(scope)` after rendering. `npm run qa:smoke` tests this very behaviour in a simulated DOM and points out the faulty page.

## Something sticks out past the page edge in RTL

**Cause:** using `left/right` instead of logical properties.

**Fix:** `left` → `inset-inline-start`, `right` → `inset-inline-end`, `margin-left` → `margin-inline-start`, `border-left` → `border-inline-start`. Then test the page in both directions.

## The page has an extra horizontal scrollbar on mobile

**Common causes:** a table without `.table-responsive`, a fixed pixel width, or `white-space: nowrap` on long text.

**Fix:** wrap tables in `.table-responsive`, write widths as `min(100%, …)` and handle long text with `text-wrap: pretty` or word breaking. Test widths 320/375/414.

## Routine: how do I find the error?

```bash
npm run qa:links     # output errors (links, assets, classes, accessibility)
npm run qa:smoke     # controller runtime errors
```

Both tools report failure with a non-zero exit code, and you can run the same commands in CI.

> Tip: if you see a console error, messages are printed with the `[NOVAADMIN]` prefix; include the error text and file name in your report.
