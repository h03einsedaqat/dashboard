# النماذج والتحقق

جميع النماذج جاهزة برسائل محلية وتحقق مباشر وعدة حالات مرئية. ولا تُثبَّت أي مكتبة تحقق.

## حالات النموذج

| الحالة | الفئة / الخاصية |
| --- | --- |
| افتراضي | `.form-control` |
| التركيز | تلقائي عبر CSS (`:focus-visible`) |
| معبّأ | `.is-filled` (بواسطة JS بعد إدخال قيمة) |
| معطّل | `disabled` |
| للقراءة فقط | `readonly` |
| خطأ | `.is-invalid` + `.field-feedback` |
| ناجح | `.is-valid` |
| قيد الإرسال | `.is-loading` على زر الإرسال |

## التحقق التصريحي

```html
<form data-validate novalidate>
  <div class="form-field">
    <label class="form-label" for="email">البريد الإلكتروني</label>
    <input id="email" name="email" class="form-control" type="email" required data-rule="email" data-validate-live="true">
    <p class="field-feedback" hidden></p>
  </div>

  <div class="form-field">
    <label class="form-label" for="nationalId">الرقم الوطني</label>
    <input id="nationalId" name="nationalId" class="form-control" data-rule="nationalId">
  </div>

  <div class="form-field">
    <label class="form-label" for="password">كلمة المرور</label>
    <input id="password" name="password" class="form-control" type="password" required data-rule="password" data-min="8" data-password-field="#password-meter">
    <div class="password-meter" id="password-meter"><span data-password-bar></span><span data-password-bar></span><span data-password-bar></span><span data-password-bar></span><small data-password-label></small></div>
  </div>

  <div class="form-field">
    <label class="form-label" for="confirm">تأكيد كلمة المرور</label>
    <input id="confirm" name="confirm" class="form-control" type="password" required data-match="password">
  </div>

  <button class="btn btn-primary" type="submit">حفظ</button>
</form>
```

## القواعد الجاهزة

| القاعدة | التحقق |
| --- | --- |
| `required` | عدم الفراغ |
| `email` | صيغة البريد الإلكتروني |
| `phone` | رقم جوال إيراني (09xxxxxxxxx) |
| `nationalId` | الرقم الوطني الإيراني مع رقم التحقق |
| `postal` | رمز بريدي من ١٠ أرقام |
| `iban` | رقم IBAN (شبا) بالبادئة IR |
| `url` | عنوان ويب |
| `number` | عدد (مع دعم الأرقام الفارسية) |
| `password` | الحد الأدنى للطول (`data-min`) |
| `pattern` | النمط `data-pattern` |
| `min` / `max` | طول القيمة |
| `match` | المساواة مع حقل آخر |
| `terms` | قبول الشروط |

تُحوَّل الأرقام الفارسية والعربية إلى لاتينية قبل التحقق؛ فيمكن للمستخدم كتابة «۰۹۱۲۳۴۵۶۷۸۹» أو «٠٩١٢٣٤٥٦٧٨٩» أو «09123456789».

## التحقق البرمجي

```js
import { validateForm, validateField } from './js/core/form.js';

const { valid, fields } = validateForm(form);
if (!valid) {
  console.log(fields.filter((item) => !item.valid).map((item) => item.field.name));
}
```

## أدوات النماذج

| الأداة | العلامة في HTML |
| --- | --- |
| منطقة إفلات الملفات | `[data-file-drop]` |
| حقل الوسوم | `[data-tag-input]` |
| مقياس قوة كلمة المرور | `[data-password-field="#meter"]` + `[data-password-bar]` |
| قائمة اختيار تابعة | `[data-depends-on="province"]` |
| عدّاد | `[data-stepper]` |
| رمز لمرة واحدة | `[data-otp]` مع `.otp-row` و`.otp-input` |
| منتقي التاريخ | `input[type="date"]` / `[data-datepicker]` |
| حقل مبلغ بقناع الآلاف | `[data-currency-input]` |

تُهيَّأ جميعها بـ `initForms()` في `main.js`، ويمكن تطبيقها على المحتوى المعروض حديثاً بـ `initForms(scope)`.

## النماذج الديناميكية

لبناء نموذج من تعريف (مثل نماذج «إضافة سجل»):

```js
import { formMarkup, collectValues, openRecordForm } from './js/pages/kit.js';

const markup = formMarkup([
  { name: 'title', label: 'العنوان', required: true },
  { name: 'price', label: 'السعر', type: 'number', rule: 'number' },
  { name: 'status', label: 'الحالة', type: 'select', options: ['active', 'draft'] },
  { name: 'notes', label: 'الوصف', type: 'textarea', col: 2, rows: 4 },
]);
```

> ملاحظة: علّم زر الإرسال بالفئة `is-loading` ليُعطَّل ويعرض مؤشر تحميل طوال الطلب؛ وهذا النمط مستخدم في جميع نماذج القالب.

> تحذير: لا تستبدل أبداً التحقق من جهة الخادم بالتحقق من جهة العميل. هذه الطبقة لتجربة المستخدم لا للأمان.
