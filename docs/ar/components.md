# المكونات

تضم مكتبة مكونات NOVAADMIN ٣٩ مكوّناً جاهزاً. جميعها مبنية من رموز نظام التصميم، وتعمل بشكل صحيح في كل التخطيطات وفي الاتجاهين، ويمكن مشاهدتها في صفحات `ui/*`.

## قائمة المكونات

| الفئة | المكونات | صفحة العرض |
| --- | --- | --- |
| أساسية | زر، زر أيقونة، مجموعة أزرار، segmented | `ui/buttons.html` |
| أساسية | شارة، رقاقة حالة، صورة رمزية، مؤشر الاتصال | `ui/badges.html`, `ui/avatars.html` |
| أساسية | بطاقة، بطاقة إحصائية، بطاقة وسائط، مربع | `ui/cards.html` |
| النماذج | حقل إدخال، قائمة اختيار، اختيار متعدد، مفتاح، منزلق، رفع، OTP، بحث | `ui/forms.html`, `ui/inputs.html` |
| التنقل | تبويبات، أكورديون، قائمة منسدلة، مسار التنقل، ترقيم الصفحات، شريط جانبي متداخل | `ui/tabs.html`, `ui/dropdowns.html` |
| البيانات | جدول، جدول بيانات، شجرة، قائمة مجمّعة، خط زمني | `ui/tables.html`, `ui/timeline.html` |
| التغذية الراجعة | تنبيه، رسالة منبثقة، نافذة، تأكيد، حالة فارغة، حالة خطأ، هيكل تحميل | `ui/alerts.html`, `ui/toasts.html`, `ui/states.html` |
| العرض | مخطط، تقدّم، تقييم، تقويم، كانبان، دردشة | `ui/charts.html`, `ui/progress.html` |
| التخطيط | شبكة، عمودان، صندوق، أداة | `ui/grid.html` |
| الطباعة | العناوين، الفقرة، الرابط، كتلة الشيفرة | `ui/typography.html` |

## أمثلة الشيفرة

### الأزرار

```html
<button class="btn btn-primary">حفظ</button>
<button class="btn btn-light">إلغاء</button>
<button class="btn btn-soft-success">موافقة</button>
<button class="btn btn-danger btn-sm">حذف</button>
<button class="icon-btn" aria-label="تعديل"><i class="bi bi-pencil"></i></button>
```

### البطاقة الإحصائية

```html
<article class="stat-card">
  <div class="stat-card__head">
    <span class="stat-card__label">إيراد الشهر</span>
    <span class="stat-card__icon stat-card__icon--primary"><i class="bi bi-cash-stack"></i></span>
  </div>
  <p class="stat-card__value numeric">٢٫٤ مليار</p>
  <span class="stat-card__trend"><i class="bi bi-arrow-up-right"></i> ١٢٫٤٪</span>
</article>
```

### صناديق التنبيه

```html
<div class="callout callout--info"><i class="bi bi-info-circle"></i><div><strong>ملاحظة</strong><p class="mb-0">نص إرشادي</p></div></div>
<div class="callout callout--warning"><i class="bi bi-exclamation-triangle"></i><div><strong>تحذير</strong><p class="mb-0">نص التحذير</p></div></div>
```

### الرسائل المنبثقة (Toast) من جافاسكريبت

```js
import { toast } from './js/core/toast.js';

toast.success('تم الحفظ', 'تم تسجيل التغييرات بنجاح.');
toast.warning('انتباه', 'حقلان إلزاميان فارغان.');
toast.danger('خطأ', 'تعذّر الاتصال بالخادم.');
toast.info('معلومة', 'يتوفر إصدار جديد.');
```

موضع الرسائل قابل للاختيار: `data-toast-host="top-start"` و`top-end` و`bottom-start` و`bottom-end`؛ وتنعكس في وضع RTL.

### الحوار والتأكيد

```js
import { modal } from './js/core/modal.js';

await modal.confirm({ title: 'حذف المنتج', text: 'لا يمكن التراجع عن هذا الإجراء.', tone: 'danger', confirmText: 'احذف' });
modal.alert({ title: 'معلومة', text: 'الملف جاهز للتنزيل.' });
```

### التبويبات والأكورديون

```html
<div class="tabs" data-tabs>
  <nav class="nav nav-tabs" role="tablist">
    <button class="nav-link active" data-tab="a" role="tab">القسم الأول</button>
    <button class="nav-link" data-tab="b" role="tab">القسم الثاني</button>
  </nav>
  <div class="tab-content">
    <div class="tab-pane active" data-tab-panel="a">…</div>
    <div class="tab-pane" data-tab-panel="b" hidden>…</div>
  </div>
</div>
```

تُسجَّل السلوكيات في `src/js/core/ui.js`؛ والصفحات التي تبني محتواها بجافاسكريبت يجب أن تستدعي `initUi(root)` بعد العرض (متحكمات القالب تفعل ذلك).

## بنية الفئات

```text
.block               الأساس
.block__element      جزء داخلي
.block--modifier     حالة أو حجم
.is-*                حالة سلوكية تغيّرها JS (is-active، is-loading)
```

> ملاحظة: تأتي الألوان من الرموز فقط؛ لإنشاء حالة جديدة استخدم `--nv-*` لا رمز لون مباشراً.

> تحذير: لا تثبّت فئات `is-*` السلوكية في HTML. إذا كان يجب أن يبدأ عنصر في الحالة النشطة، فاستخدم متحكماً أو `[data-tabs]` ليبقى المنطق في مكان واحد.
