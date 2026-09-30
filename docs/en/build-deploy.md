# Build and release

The template's output is a static folder: every HTML file is a standalone page, plus one CSS file and a few JS files. It runs on any simple host.

## Building the output

```bash
npm run build
```

The build chain runs in the following order and every step must be green:

1. `node tools/build-pages.mjs --mode build` — reads `tools/manifest.mjs` and generates 206 pages in `src/pages/`
2. `node tools/gen-assets.mjs` — generates the logo, 24 avatars, 24 product images and 12 brand logos as SVG
3. `node tools/gen-nav.mjs` — generates `src/data/navigation.js`, `public/sitemap.xml` and `public/robots.txt`
4. `vite build` — bundles CSS, JS and fonts into `dist/`
5. `node tools/flatten-dist.mjs` — moves `dist/src/pages/**` to the root of `dist/` and fixes relative paths

> Tip: never move files in `dist/` by hand. The `flatten-dist` step does it and aligns every asset path with the new depth.

## Build result

```text
dist/
├── index.html                 product page
├── widgets.html, preview.html  root-level pages
├── dashboards/*.html          10 dashboards
├── apps/ ai/ crm/ ecommerce/ finance/ hr/ logistics/ …
├── assets/css/modules-<hash>.css
├── assets/js/{modules,content,ai,apps,kit,vendor-*}-<hash>.js
├── assets/fonts/Vazirmatn-*.woff2
├── assets/img/{avatars,products,brands}/
├── robots.txt
└── sitemap.xml
```

The output is about 24 MB, most of which is avatars, SVG images and charts.

## Previewing the output

```bash
npm run preview -- --port 4173
```

## Publishing to a host

### 1) Shared hosting / cPanel

Upload the contents of the `dist/` folder to `public_html`. Done.

### 2) Netlify / Vercel / Cloudflare Pages

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 18 or higher |

### 3) GitHub Pages

```bash
npm run build
npx gh-pages -d dist
```

If the site is published under a sub-path (`user.github.io/repo/`), links are relative so nothing breaks; just set `website` in `src/config/config.js` to the final address so `sitemap.xml` is generated correctly.

### 4) Nginx (example)

```nginx
server {
  listen 80;
  root /var/www/novaadmin;
  index index.html;

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location / {
    try_files $uri $uri.html $uri/ =404;
  }
}
```

## Recommended cache headers

| Path | Policy |
| --- | --- |
| `assets/**` | 1 year, `immutable` (file names are hashed) |
| `**.html` | No cache or `must-revalidate` |
| `sitemap.xml`, `robots.txt` | 1 day |

## Pre-release checklist

- `npm run qa:all` is green (build + links + controller runs)
- `appName`, `tagline`, `website`, `supportEmail` and `defaultLanguage` are finalised in `src/config/config.js`
- The host's error pages (404) point to `system/404.html`
- `sitemap.xml` contains the final domain
- `LICENSE.txt` and the credits are preserved
