# کامپوننت‌ها

کتابخانه کامپوننت NOVAADMIN شامل ۳۹ کامپوننت آماده است. همه از توکن‌های Design System ساخته شده‌اند، در هر شش چیدمان و هر دو جهت درست کار می‌کنند و در صفحات `ui/*` قابل مشاهده‌اند.

## فهرست کامپوننت‌ها

| دسته | کامپوننت | صفحه نمایش |
| --- | --- | --- |
| پایه | دکمه، دکمه آیکون، گروه دکمه، segmented | `ui/buttons.html` |
| پایه | نشان، چیپ وضعیت، آواتار، نشان‌گر آنلاین | `ui/badges.html`, `ui/avatars.html` |
| پایه | کارت، کارت آماری، کارت رسانه، کاشی | `ui/cards.html` |
| فرم | ورودی، انتخاب، چند‌انتخابی، سوییچ، اسلایدر، آپلود، OTP، جستجو | `ui/forms.html`, `ui/inputs.html` |
| ناوبری | تب، آکاردئون، دراپ‌دان، بردکرامب، صفحه‌بندی، سایدبار تو در تو | `ui/tabs.html`, `ui/dropdowns.html` |
| داده | جدول، جدول داده، درخت، فهرست گروهی، تایم‌لاین | `ui/tables.html`, `ui/timeline.html` |
| بازخورد | پیام، توست، مودال، تأییدیه، حالت خالی، حالت خطا، اسکلتون | `ui/alerts.html`, `ui/toasts.html`, `ui/states.html` |
| نمایش | نمودار، پیشرفت، رتبه‌بندی، تقویم، کانبان، چت | `ui/charts.html`, `ui/progress.html` |
| چیدمان | گرید، دو ستونی، جعبه، ابزارک | `ui/grid.html` |
| تایپوگرافی | سرتیترها، پاراگراف، لینک، بلوک کد | `ui/typography.html` |

## نمونه‌های کد

### دکمه‌ها

```html
<button class="btn btn-primary">ذخیره</button>
<button class="btn btn-light">انصراف</button>
<button class="btn btn-soft-success">تأیید</button>
<button class="btn btn-danger btn-sm">حذف</button>
<button class="icon-btn" aria-label="ویرایش"><i class="bi bi-pencil"></i></button>
```

### کارت آماری

```html
<article class="stat-card">
  <div class="stat-card__head">
    <span class="stat-card__label">درآمد ماه</span>
    <span class="stat-card__icon stat-card__icon--primary"><i class="bi bi-cash-stack"></i></span>
  </div>
  <p class="stat-card__value numeric">۲٫۴ میلیارد</p>
  <span class="stat-card__trend"><i class="bi bi-arrow-up-right"></i> ۱۲٫۴٪</span>
</article>
```

### جعبه‌های بازخورد

```html
<div class="callout callout--info"><i class="bi bi-info-circle"></i><div><strong>نکته</strong><p class="mb-0">متن راهنما</p></div></div>
<div class="callout callout--warning"><i class="bi bi-exclamation-triangle"></i><div><strong>هشدار</strong><p class="mb-0">متن هشدار</p></div></div>
```

### پیام (Toast) از جاوااسکریپت

```js
import { toast } from './js/core/toast.js';

toast.success('ذخیره شد', 'تغییرات با موفقیت ثبت شد.');
toast.warning('توجه', 'دو فیلد الزامی خالی است.');
toast.danger('خطا', 'ارتباط با سرور برقرار نشد.');
toast.info('اطلاع', 'نسخه جدید در دسترس است.');
```

موقعیت پیام‌ها قابل انتخاب است: `data-toast-host="top-start"`, `top-end`, `bottom-start`, `bottom-end`؛ در حالت RTL آینه می‌شوند.

### گفتگو و تأییدیه

```js
import { modal } from './js/core/modal.js';

await modal.confirm({ title: 'حذف محصول', text: 'این عمل بازگشت‌پذیر نیست.', tone: 'danger', confirmText: 'حذف کن' });
modal.alert({ title: 'اطلاع', text: 'فایل آماده دانلود است.' });
```

### تب و آکاردئون

```html
<div class="tabs" data-tabs>
  <nav class="nav nav-tabs" role="tablist">
    <button class="nav-link active" data-tab="a" role="tab">بخش اول</button>
    <button class="nav-link" data-tab="b" role="tab">بخش دوم</button>
  </nav>
  <div class="tab-content">
    <div class="tab-pane active" data-tab-panel="a">…</div>
    <div class="tab-pane" data-tab-panel="b" hidden>…</div>
  </div>
</div>
```

رفتارها در `src/js/core/ui.js` ثبت می‌شوند؛ صفحاتی که محتوایشان را با جاوااسکریپت می‌سازند باید پس از رندر، `initUi(root)` را صدا بزنند (کنترل‌کننده‌های قالب این کار را انجام می‌دهند).

## ساختار کلاس‌ها

```text
.block               پایه
.block__element      بخش داخلی
.block--modifier     حالت یا اندازه
.is-*                حالت رفتاری که با JS عوض می‌شود (is-active، is-loading)
```

> نکته: رنگ‌ها فقط از توکن‌ها می‌آیند؛ برای ساختن حالت جدید از `--nv-*` استفاده کنید، نه کد رنگ مستقیم.

> هشدار: کلاس‌های رفتاری `is-*` را در HTML ثابت نگذارید. اگر عنصری در حالت فعال باید باشد، از کنترل‌کننده یا `[data-tabs]` استفاده کنید تا منطق در یک جا بماند.
