# Installation

Installing NOVAADMIN requires Node.js. If you only want to put the **ready-made output** on a host, you need no tooling at all: upload the `html/` folder from the product package directly.

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 18 or later | Only for building and the development environment |
| npm | 9 or later | Dependency management |
| A modern browser | Chrome / Edge / Firefox / Safari | Supports CSS Nesting, `:has()` and ES2022 |

## Step by step

1. Extract the product ZIP into your project folder:

```bash
unzip NOVAADMIN-1.0.0.zip -d novaadmin
cd novaadmin
```

2. Install the dependencies:

```bash
npm install
```

3. Start the development environment:

```bash
npm run dev
```

Then open `http://localhost:5173`. The product (landing) page appears and you can enter the demos from there.

4. Build the final output:

```bash
npm run build
```

The output is written to the `dist/` folder; this is the folder that goes on your host.

> Tip: `npm run build` runs four steps back to back: generating pages from the manifest, generating graphic assets, the Vite bundle and a final tidy-up of the output. Do not run any of them by hand.

## Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with live reload on port 5173 |
| `npm run build` | Full build of the output into `dist/` |
| `npm run preview` | Preview the built output |
| `npm run gen:pages` | Only generate pages from the manifest |
| `npm run gen:assets` | Generate the logo, avatars, product images and brand logos |
| `npm run gen:nav` | Generate `navigation.js`, `sitemap.xml` and `robots.txt` |
| `npm run gen:all` | All three generation steps above |
| `npm run qa:links` | Output quality control (links, assets, CSS, accessibility) |
| `npm run qa:smoke` | Runs the real controllers inside a simulated DOM |
| `npm run qa:all` | Build + both quality checks |
| `npm run package` | Build the final, shippable package |

## Installing on shared hosting (no Node)

1. Upload the whole `html/` folder from the product package.
2. Make sure `index.html` is at the domain root.
3. If the site runs in a subfolder (such as `example.com/admin/`), all links are relative and work unchanged.

> Warning: do not edit the template files directly over FTP. Always change the source project and run `npm run build` again; otherwise your changes are lost on the next build.

## Quick troubleshooting

- **Port 5173 is in use:** `npm run dev -- --port 5180`
- **Installation stopped with an error:** `npm cache clean --force`, then `rm -rf node_modules package-lock.json && npm install`
- **Fonts do not load:** the `vazirmatn` dependency must be inside `node_modules`; in the final output the fonts are moved to `assets/fonts/`.
- More questions → [Troubleshooting](troubleshooting.html)
