# Deploying to a host

The template is static; deploying means copying the output folder. This section contains practical notes for real hosts.

## Host requirements

- Support for `.woff2` files (every modern host has it)
- The ability to set cache headers (optional but recommended)
- An SSL certificate (recommended for `theme-boot.js` and `localStorage` on a secure domain)

## Method 1 — direct upload

```bash
npm run build
rsync -avz dist/ user@server:/var/www/html/
```

## Method 2 — subfolder

The template makes every link relative, so it also works unchanged at `https://example.com/admin/`. Just change `website` in `src/config/config.js` to the final address so `sitemap.xml` is generated correctly.

## Method 3 — CDN

| Path | Cache |
| --- | --- |
| `assets/**` | 1 year, `immutable` |
| `*.html` | No cache or `no-cache` |
| `sitemap.xml` / `robots.txt` | 1 day |

Bundle file names are hashed (`modules-DnMG3z6r.css`), so a new version can be released without worrying about stale caches.

## Shared hosting settings

Sample `.htaccess` (Apache):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^([^\.]+)$ $1.html [NC,L]
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml
</IfModule>
```

With these rules both `dashboards/analytics.html` and `dashboards/analytics` work.

## Recommended security headers

```apache
Header set X-Content-Type-Options "nosniff"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Permissions-Policy "geolocation=(), microphone=()"
```

## Error page

Register `system/404.html` as the domain's error page (in cPanel → Error Pages). Other states: `system/403.html`, `system/500.html`, `system/maintenance.html`, `system/offline.html`.

## Post-release checklist

1. Open the home page and one dashboard on desktop and mobile.
2. Make sure there are no errors in the browser console.
3. Try dark mode and switching language (settings must persist).
4. Click a relative link from a nested page (`crm/contacts.html` → `users/details.html`).
5. Open `sitemap.xml` and `robots.txt`.
6. Speed: use Lighthouse; expect scores above 90 for performance and accessibility.

> Tip: if your server cannot compress, note that Vite only reports gzip sizes — the output `.css` and `.js` files themselves are not compressed; enabling server gzip makes a noticeable difference in speed.

> Warning: the `tools/` folder is for building only and must not be uploaded to the host. The same goes for `node_modules` and the Markdown `docs/`.
