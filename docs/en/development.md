# Development environment

The project runs on Vite: changes to SCSS, JS or HTML are applied immediately without a full reload, and page routes are clean.

## Running the project

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

| Common issue | Cause and fix |
| --- | --- |
| Styles are not applied in development | Vite serves `.scss` files as JS modules; in `src/partials/head.html` the link is written with `?direct` so it is served directly with `Content-Type: text/css` |
| The `/dashboards/analytics.html` route returns 404 | The dev middleware in `tools/nova-plugin.mjs` maps clean routes to `src/pages/**`; restart the server once after adding a new page |

## Everyday workflow

1. **New page?** Add an item to the sidebar in `tools/manifest.mjs` and run `npm run gen:pages`.
2. **New component?** Create the SCSS file in `src/scss/components/` and wire it into `src/scss/main.scss`.
3. **New behaviour?** Write the logic in `src/js/core/` (generic) or `src/js/pages/` (specific to one area).
4. **New data?** Add it in `src/data/` and consume it through `src/services/`; never write raw data in a controller.

## Build flow

```text
tools/build-pages.mjs   →  src/pages/**.html        (206 pages)
tools/gen-assets.mjs    →  public/assets/**        (logo, avatars, products, brands)
tools/gen-nav.mjs       →  src/data/navigation.js + public/sitemap.xml
vite build              →  dist/assets/{css,js,fonts}
tools/flatten-dist.mjs  →  final dist/ tidy-up and relative path fixes
```

> Tip: never edit the `src/pages/**` pages by hand; these files are rewritten on every build. For custom content, create a file with the same name in `src/partials/pages/<page path>.html`.

## Quality control

```bash
npm run qa:links   # broken links, missing files, unstyled classes, accessibility, SEO
npm run qa:smoke   # actually boots the controllers in a simulated DOM
```

`qa:links` works on the `dist/` folder, so run `npm run build` first. `qa:smoke` needs no browser and runs 142 page scenarios.

> Goal: never ship a change unless both of these quality checks are green.

## Code standards

- ES modules with `import`/`export`; no `var`, no jQuery and no globals outside `window.NOVA`.
- CSS with logical properties (`inset-inline`, `margin-block`) — never raw `left/right`.
- Light BEM naming: `.block`, `.block__element`, `.block--modifier`.
- One job per function; a short comment at the top of the file.
- Interface text is read from `src/locales/**`; literal strings inside JS are only allowed for sample data.

## Adding a dependency

```bash
npm install chartjs-plugin-annotation
```

Then add it to `manualChunks` in `vite.config.js` if needed and initialise it in `src/js/core/charts.js`. Keep dependencies few; all the core components are hand-built.

## Debugging

- `window.NOVA` in the console: access to services, theme, layout, `NOVA.data('orders', { perPage: 5 })` and `NOVA.url('users/list.html')`.
- `Ctrl + K` for the command palette, `Ctrl + /` for shortcuts.
- To simulate network errors, turn on `mockErrors` in `src/config/config.js`.
