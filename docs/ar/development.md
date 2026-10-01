# بيئة التطوير

يعمل المشروع على Vite: تُطبَّق التغييرات في SCSS أو JS أو HTML فوراً دون إعادة تحميل كاملة، ومسارات الصفحات نظيفة.

## تشغيل المشروع

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

| مشكلة شائعة | السبب والحل |
| --- | --- |
| لا تُطبَّق الأنماط في وضع التطوير | يقدّم Vite ملف `.scss` كوحدة JS؛ لذا كُتب الرابط في `src/partials/head.html` مع `?direct` ليُقدَّم مباشرة بـ `Content-Type: text/css` |
| المسار `/dashboards/analytics.html` يعطي خطأ ٤٠٤ | يربط الوسيط البرمجي للتطوير في `tools/nova-plugin.mjs` المسار النظيف بـ `src/pages/**`؛ أعد تشغيل الخادم مرة واحدة بعد إضافة صفحة جديدة |

## سير العمل اليومي

1. **صفحة جديدة؟** أضف عنصراً إلى الشريط الجانبي في `tools/manifest.mjs` ونفّذ `npm run gen:pages`.
2. **مكوّن جديد؟** أنشئ ملف SCSS في `src/scss/components/` واربطه بـ `src/scss/main.scss`.
3. **سلوك جديد؟** اكتب المنطق في `src/js/core/` (عام) أو `src/js/pages/` (خاص بقسم واحد).
4. **بيانات جديدة؟** أضفها في `src/data/` واستهلكها عبر `src/services/`؛ ولا تكتب بيانات خاماً في المتحكم أبداً.

## مسار البناء

```text
tools/build-pages.mjs   →  src/pages/**.html        (٢٠٦ صفحات)
tools/gen-assets.mjs    →  public/assets/**        (الشعار، الصور الرمزية، المنتجات، العلامات)
tools/gen-nav.mjs       →  src/data/navigation.js + public/sitemap.xml
vite build              →  dist/assets/{css,js,fonts}
tools/flatten-dist.mjs  →  الترتيب النهائي لـ dist/ وتصحيح المسارات النسبية
```

> ملاحظة: لا تعدّل صفحات `src/pages/**` يدوياً أبداً؛ فهذه الملفات تُعاد كتابتها في كل بناء. للمحتوى المخصص، أنشئ ملفاً بالاسم نفسه في `src/partials/pages/<مسار الصفحة>.html`.

## ضبط الجودة

```bash
npm run qa:links   # الروابط المعطوبة، الملفات المفقودة، الفئات بلا أنماط، إمكانية الوصول، SEO
npm run qa:smoke   # تشغيل فعلي للمتحكمات في DOM محاكى
```

يعمل `qa:links` على المجلد `dist/`؛ لذا نفّذ `npm run build` أولاً. ولا يحتاج `qa:smoke` إلى متصفح ويشغّل ١٤٢ سيناريو صفحة.

> الهدف: لا تسلّم أي تغيير ما لم ينجح فحصا الجودة هذان.

## معايير الشيفرة

- وحدات ES مع `import`/`export`؛ بلا `var` وبلا jQuery وبلا متغيرات عامة خارج `window.NOVA`.
- CSS بالخصائص المنطقية (`inset-inline`, `margin-block`) — ولا `left/right` مباشرة أبداً.
- تسمية BEM مخففة: `.block` و`.block__element` و`.block--modifier`.
- مهمة واحدة لكل دالة؛ وتعليق قصير أعلى الملف.
- تُقرأ نصوص الواجهة من `src/locales/**`؛ والنصوص الحرفية داخل JS مسموحة للبيانات النموذجية فقط.

## إضافة اعتمادية

```bash
npm install chartjs-plugin-annotation
```

ثم أضفها عند الحاجة إلى `manualChunks` في `vite.config.js` وهيّئها في `src/js/core/charts.js`. أبقِ عدد الاعتماديات قليلاً؛ فجميع المكونات الأساسية مصنوعة يدوياً.

## تصحيح الأخطاء

- `window.NOVA` في وحدة التحكم: وصول إلى الخدمات والسمة والتخطيط و`NOVA.data('orders', { perPage: 5 })` و`NOVA.url('users/list.html')`.
- `Ctrl + K` للوحة الأوامر، و`Ctrl + /` للاختصارات.
- لمحاكاة خطأ في الشبكة، فعّل `mockErrors` في `src/config/config.js`.
