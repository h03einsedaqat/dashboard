# البناء والنشر

مخرجات القالب مجلد ثابت: كل ملف HTML صفحة مستقلة، مع ملف CSS واحد وبضعة ملفات JS. ويعمل على أي استضافة بسيطة.

## بناء المخرجات

```bash
npm run build
```

تُنفَّذ سلسلة البناء بالترتيب التالي ويجب أن تنجح جميع المراحل:

1. `node tools/build-pages.mjs --mode build` — قراءة `tools/manifest.mjs` وتوليد ٢٠٦ صفحات في `src/pages/`
2. `node tools/gen-assets.mjs` — توليد الشعار و٢٤ صورة رمزية و٢٤ صورة منتج و١٢ شعار علامة بصيغة SVG
3. `node tools/gen-nav.mjs` — توليد `src/data/navigation.js` و`public/sitemap.xml` و`public/robots.txt`
4. `vite build` — تجميع CSS وJS والخطوط في `dist/`
5. `node tools/flatten-dist.mjs` — نقل `dist/src/pages/**` إلى جذر `dist/` وتصحيح المسارات النسبية

> ملاحظة: لا تنقل ملفات `dist/` يدوياً أبداً. تتولى مرحلة `flatten-dist` ذلك وتوائم مسارات جميع الأصول مع العمق الجديد.

## نتيجة البناء

```text
dist/
├── index.html                 صفحة المنتج
├── widgets.html, preview.html  صفحات على مستوى الجذر
├── dashboards/*.html          ١٠ لوحات تحكم
├── apps/ ai/ crm/ ecommerce/ finance/ hr/ logistics/ …
├── assets/css/modules-<hash>.css
├── assets/js/{modules,content,ai,apps,kit,vendor-*}-<hash>.js
├── assets/fonts/Vazirmatn-*.woff2
├── assets/img/{avatars,products,brands}/
├── robots.txt
└── sitemap.xml
```

حجم المخرجات نحو ٢٤ ميغابايت، معظمها صور رمزية وصور SVG ومخططات.

## معاينة المخرجات

```bash
npm run preview -- --port 4173
```

## النشر على الاستضافة

### ١) استضافة مشتركة / cPanel

ارفع محتوى المجلد `dist/` إلى `public_html`. انتهى.

### ٢) Netlify / Vercel / Cloudflare Pages

| الإعداد | القيمة |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | ١٨ أو أعلى |

### ٣) GitHub Pages

```bash
npm run build
npx gh-pages -d dist
```

إذا نُشر الموقع في مسار فرعي (`user.github.io/repo/`)، فالروابط نسبية ولن تحدث مشكلة؛ فقط اضبط `website` في `src/config/config.js` على العنوان النهائي ليُولَّد `sitemap.xml` بشكل صحيح.

### ٤) Nginx (مثال)

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

## ترويسات التخزين المؤقت المقترحة

| المسار | السياسة |
| --- | --- |
| `assets/**` | سنة واحدة، `immutable` (أسماء الملفات مجزّأة) |
| `**.html` | بلا تخزين مؤقت أو `must-revalidate` |
| `sitemap.xml`, `robots.txt` | يوم واحد |

## قائمة التحقق قبل النشر

- `npm run qa:all` ناجح (البناء + الروابط + تشغيل المتحكمات)
- القيم `appName` و`tagline` و`website` و`supportEmail` و`defaultLanguage` نهائية في `src/config/config.js`
- صفحات خطأ الاستضافة (٤٠٤) موجّهة إلى `system/404.html`
- يحتوي `sitemap.xml` على النطاق النهائي
- الملف `LICENSE.txt` والإشادات محفوظة
