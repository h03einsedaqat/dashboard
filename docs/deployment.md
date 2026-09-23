# استقرار در هاست

قالب استاتیک است؛ استقرار یعنی کپی‌کردن پوشه خروجی. این بخش نکات عملی برای هاست‌های واقعی است.

## پیش‌نیازهای هاست

- پشتیبانی از فایل‌های `.woff2` (همه هاست‌های امروزی دارند)
- امکان تنظیم هدر کش (اختیاری اما توصیه‌شده)
- گواهی SSL (برای `theme-boot.js` و `localStorage` روی دامنه امن توصیه می‌شود)

## روش ۱ — آپلود مستقیم

```bash
npm run build
rsync -avz dist/ user@server:/var/www/html/
```

## روش ۲ — زیرپوشه

قالب همه لینک‌ها را نسبی می‌سازد، پس در `https://example.com/admin/` هم بدون تغییر کار می‌کند. فقط `website` را در `src/config/config.js` به آدرس نهایی تغییر دهید تا `sitemap.xml` درست تولید شود.

## روش ۳ — CDN

| مسیر | کش |
| --- | --- |
| `assets/**` | ۱ سال، `immutable` |
| `*.html` | بدون کش یا `no-cache` |
| `sitemap.xml` / `robots.txt` | ۱ روز |

نام فایل‌های باندل هش دارند (`modules-DnMG3z6r.css`)، پس انتشار نسخه جدید بدون نگرانی از کش قدیمی انجام می‌شود.

## تنظیمات هاست اشتراکی

`.htaccess` نمونه (Apache):

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

با این قواعد، هم `dashboards/analytics.html` و هم `dashboards/analytics` کار می‌کنند.

## هدرهای امنیتی پیشنهادی

```apache
Header set X-Content-Type-Options "nosniff"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Permissions-Policy "geolocation=(), microphone=()"
```

## صفحه خطا

فایل `system/404.html` را به‌عنوان صفحه خطای دامنه معرفی کنید (در cPanel → Error Pages). بقیه حالت‌ها: `system/403.html`, `system/500.html`, `system/maintenance.html`, `system/offline.html`.

## چک‌لیست پس از انتشار

1. صفحه اصلی و یک داشبورد را در دسکتاپ و موبایل باز کنید.
2. در کنسول مرورگر خطا نداشته باشید.
3. حالت تاریک و تغییر زبان را بیازمایید (تنظیمات باید ذخیره بماند).
4. یک لینک نسبی از یک صفحه تودرتو بزنید (`crm/contacts.html` → `users/details.html`).
5. `sitemap.xml` و `robots.txt` را باز کنید.
6. سرعت: از ابزار Lighthouse استفاده کنید؛ انتظار امتیاز بالای ۹۰ برای عملکرد و دسترس‌پذیری وجود دارد.

> نکته: اگر روی سرور امکان فشرده‌سازی ندارید، فایل‌های `.css` و `.js` خروجی گزیپ‌شده‌اند (Vite گزارش حجم gzip را چاپ می‌کند) اما فایل نهایی فشرده نیست؛ فعال‌کردن gzip سرور تفاوت محسوسی در سرعت ایجاد می‌کند.

> هشدار: پوشه `tools/` فقط برای ساخت است و نباید روی هاست آپلود شود. همین‌طور `node_modules` و `docs/` مارک‌داون.
