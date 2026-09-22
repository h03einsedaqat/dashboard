# ساخت و انتشار

خروجی قالب یک پوشه استاتیک است: هر فایل HTML یک صفحه مستقل، یک فایل CSS و چند فایل JS. روی هر هاست ساده‌ای اجرا می‌شود.

## ساخت خروجی

```bash
npm run build
```

زنجیره ساخت به ترتیب زیر اجرا می‌شود و همه مراحل باید سبز باشند:

1. `node tools/build-pages.mjs --mode build` — خواندن `tools/manifest.mjs` و تولید ۲۰۶ صفحه در `src/pages/`
2. `node tools/gen-assets.mjs` — تولید لوگو، ۲۴ آواتار، ۲۴ تصویر محصول و ۱۲ لوگوی برند به‌صورت SVG
3. `node tools/gen-nav.mjs` — تولید `src/data/navigation.js`، `public/sitemap.xml` و `public/robots.txt`
4. `vite build` — باندل کردن CSS، JS و فونت‌ها در `dist/`
5. `node tools/flatten-dist.mjs` — انتقال `dist/src/pages/**` به ریشه `dist/` و اصلاح مسیرهای نسبی

> نکته: هیچ‌وقت فایل‌های `dist/` را دستی جابه‌جا نکنید. مرحله `flatten-dist` این کار را انجام می‌دهد و مسیر همه دارایی‌ها را با عمق جدید هماهنگ می‌کند.

## نتیجه ساخت

```text
dist/
├── index.html                 صفحه محصول
├── widgets.html, preview.html  صفحه‌های سطح ریشه
├── dashboards/*.html          ۱۰ داشبورد
├── apps/ ai/ crm/ ecommerce/ finance/ hr/ logistics/ …
├── assets/css/modules-<hash>.css
├── assets/js/{modules,content,ai,apps,kit,vendor-*}-<hash>.js
├── assets/fonts/Vazirmatn-*.woff2
├── assets/img/{avatars,products,brands}/
├── robots.txt
└── sitemap.xml
```

اندازه خروجی حدود ۲۴ مگابایت است که بیشتر آن آواتارها و تصاویر SVG و نمودارها است.

## پیش‌نمایش خروجی

```bash
npm run preview -- --port 4173
```

## انتشار روی هاست

### ۱) هاست اشتراکی / cPanel

محتوای پوشه `dist/` را در `public_html` آپلود کنید. تمام شد.

### ۲) Netlify / Vercel / Cloudflare Pages

| تنظیم | مقدار |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | ۱۸ یا بالاتر |

### ۳) GitHub Pages

```bash
npm run build
npx gh-pages -d dist
```

اگر سایت در زیرمسیر منتشر می‌شود (`user.github.io/repo/`)، لینک‌ها نسبی هستند و مشکلی پیش نمی‌آید؛ فقط `website` را در `src/config/config.js` برابر آدرس نهایی بگذارید تا `sitemap.xml` درست تولید شود.

### ۴) Nginx (نمونه)

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

## هدرهای پیشنهادی کش

| مسیر | سیاست |
| --- | --- |
| `assets/**` | ۱ سال، `immutable` (نام فایل‌ها هش دارند) |
| `**.html` | بدون کش یا `must-revalidate` |
| `sitemap.xml`, `robots.txt` | ۱ روز |

## چک‌لیست پیش از انتشار

- `npm run qa:all` سبز است (ساخت + لینک‌ها + اجرای کنترل‌کننده‌ها)
- در `src/config/config.js` مقادیر `appName`، `tagline`، `website`، `supportEmail` و `defaultLanguage` نهایی شده‌اند
- صفحات خطای هاست (۴۰۴) به `system/404.html` هدایت شده‌اند
- `sitemap.xml` آدرس دامنه نهایی را دارد
- فایل `LICENSE.txt` و اعتبارها حفظ شده‌اند
