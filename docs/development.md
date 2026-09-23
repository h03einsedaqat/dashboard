# محیط توسعه

پروژه با Vite اجرا می‌شود: تغییر در SCSS، JS یا HTML بلافاصله بدون رفرش کامل اعمال می‌شود و مسیر صفحات تمیز است.

## اجرای پروژه

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

| باگ رایج | علت و راه‌حل |
| --- | --- |
| استایل‌ها در حالت توسعه اعمال نمی‌شوند | Vite فایل `.scss` را به‌صورت ماژول JS سرو می‌کند؛ در `src/partials/head.html` لینک با `?direct` نوشته شده تا مستقیم با `Content-Type: text/css` سرو شود |
| مسیر `/dashboards/analytics.html` خطای ۴۰۴ می‌دهد | میان‌افزار توسعه در `tools/nova-plugin.mjs` مسیر تمیز را به `src/pages/**` نگاشت می‌کند؛ بعد از افزودن صفحه جدید یک‌بار سرور را ری‌استارت کنید |

## ساختار کار در روزمره

1. **صفحه جدید؟** در `tools/manifest.mjs` یک آیتم به سایدبار اضافه کنید و `npm run gen:pages` بگیرید.
2. **کامپوننت جدید؟** فایل SCSS را در `src/scss/components/` بسازید و به `src/scss/main.scss` وصل کنید.
3. **رفتار جدید؟** منطق را در `src/js/core/` (عمومی) یا `src/js/pages/` (مخصوص یک بخش) بنویسید.
4. **داده جدید؟** در `src/data/` اضافه کنید و از طریق `src/services/` مصرف کنید؛ هرگز در کنترل‌کننده داده خام ننویسید.

## جریان ساخت

```text
tools/build-pages.mjs   →  src/pages/**.html        (۲۰۶ صفحه)
tools/gen-assets.mjs    →  public/assets/**        (لوگو، آواتار، محصول، برند)
tools/gen-nav.mjs       →  src/data/navigation.js + public/sitemap.xml
vite build              →  dist/assets/{css,js,fonts}
tools/flatten-dist.mjs  →  مرتب‌سازی نهایی dist/ و اصلاح مسیرهای نسبی
```

> نکته: هرگز صفحه‌های `src/pages/**` را دستی ویرایش نکنید؛ این فایل‌ها در هر ساخت بازنویسی می‌شوند. برای محتوای اختصاصی، فایل هم‌نام را در `src/partials/pages/<مسیر صفحه>.html` بسازید.

## کنترل کیفیت

```bash
npm run qa:links   # لینک‌های شکسته، فایل‌های گم‌شده، کلاس‌های بدون استایل، دسترس‌پذیری، SEO
npm run qa:smoke   # راه‌اندازی واقعی کنترل‌کننده‌ها در DOM شبیه‌سازی‌شده
```

خروجی `qa:links` روی پوشه `dist/` کار می‌کند؛ پس اول `npm run build` بگیرید. `qa:smoke` نیازی به مرورگر ندارد و ۱۴۲ سناریوی صفحه را اجرا می‌کند.

> هدف: هیچ تغییری را بدون سبز بودن این دو کنترل کیفیت تحویل ندهید.

## استانداردهای کد

- ماژول‌های ES با `import`/`export`؛ بدون `var`، بدون jQuery و بدون متغیر جهانی خارج از `window.NOVA`.
- CSS با ویژگی‌های منطقی (`inset-inline`, `margin-block`) — هرگز `left/right` مستقیم.
- نام‌گذاری BEM سبک: `.block`, `.block__element`, `.block--modifier`.
- هر تابع یک کار؛ توضیح با کامنت کوتاه در بالای فایل.
- متن‌های رابط کاربری از `src/locales/**` خوانده می‌شوند؛ رشته فارسی داخل JS فقط برای داده نمونه مجاز است.

## افزودن وابستگی

```bash
npm install chartjs-plugin-annotation
```

سپس در `vite.config.js` در صورت نیاز به `manualChunks` اضافه کنید و در `src/js/core/charts.js` مقداردهی اولیه کنید. تعداد وابستگی‌ها را کم نگه دارید؛ همه کامپوننت‌های اصلی دست‌ساز هستند.

## دیباگ

- `window.NOVA` در کنسول: دسترسی به سرویس‌ها، تم، چیدمان، `NOVA.data('orders', { perPage: 5 })` و `NOVA.url('users/list.html')`.
- `Ctrl + K` برای پالت فرمان‌ها، `Ctrl + /` برای میان‌برها.
- برای شبیه‌سازی خطای شبکه، `mockErrors` را در `src/config/config.js` روشن کنید.
