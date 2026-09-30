# النشر على الاستضافة

القالب ثابت؛ والنشر يعني نسخ مجلد المخرجات. يضم هذا القسم ملاحظات عملية للاستضافات الحقيقية.

## متطلبات الاستضافة

- دعم ملفات `.woff2` (تدعمها كل الاستضافات الحديثة)
- إمكانية ضبط ترويسات التخزين المؤقت (اختياري لكنه موصى به)
- شهادة SSL (موصى بها لـ `theme-boot.js` و`localStorage` على نطاق آمن)

## الطريقة ١ — الرفع المباشر

```bash
npm run build
rsync -avz dist/ user@server:/var/www/html/
```

## الطريقة ٢ — مجلد فرعي

يجعل القالب جميع الروابط نسبية؛ لذا يعمل دون تغيير في `https://example.com/admin/` أيضاً. فقط غيّر `website` في `src/config/config.js` إلى العنوان النهائي ليُولَّد `sitemap.xml` بشكل صحيح.

## الطريقة ٣ — شبكة CDN

| المسار | التخزين المؤقت |
| --- | --- |
| `assets/**` | سنة واحدة، `immutable` |
| `*.html` | بلا تخزين مؤقت أو `no-cache` |
| `sitemap.xml` / `robots.txt` | يوم واحد |

أسماء ملفات الحزم مجزّأة (`modules-DnMG3z6r.css`)؛ لذا يمكن نشر إصدار جديد دون القلق من ذاكرة مؤقتة قديمة.

## إعدادات الاستضافة المشتركة

ملف `.htaccess` نموذجي (Apache):

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

بهذه القواعد يعمل كل من `dashboards/analytics.html` و`dashboards/analytics`.

## ترويسات الأمان المقترحة

```apache
Header set X-Content-Type-Options "nosniff"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Permissions-Policy "geolocation=(), microphone=()"
```

## صفحة الخطأ

عرّف الملف `system/404.html` كصفحة خطأ النطاق (في cPanel ← Error Pages). والحالات الأخرى: `system/403.html` و`system/500.html` و`system/maintenance.html` و`system/offline.html`.

## قائمة التحقق بعد النشر

1. افتح الصفحة الرئيسية ولوحة تحكم واحدة على الحاسوب والجوال.
2. تأكد من عدم وجود أخطاء في وحدة تحكم المتصفح.
3. جرّب الوضع الداكن وتغيير اللغة (يجب أن تبقى الإعدادات محفوظة).
4. انقر رابطاً نسبياً من صفحة متداخلة (`crm/contacts.html` ← `users/details.html`).
5. افتح `sitemap.xml` و`robots.txt`.
6. السرعة: استخدم أداة Lighthouse؛ والمتوقع درجة أعلى من ٩٠ للأداء وإمكانية الوصول.

> ملاحظة: إذا لم يكن الضغط متاحاً على الخادم، فاعلم أن Vite يطبع حجم gzip فقط — أما ملفات `.css` و`.js` النهائية فغير مضغوطة؛ وتفعيل gzip على الخادم يُحدث فرقاً ملموساً في السرعة.

> تحذير: المجلد `tools/` للبناء فقط ويجب ألا يُرفع إلى الاستضافة. وكذلك `node_modules` ومجلد `docs/` بصيغة Markdown.
