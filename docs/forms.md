# فرم و اعتبارسنجی

تمام فرم‌ها با پیام‌های فارسی، اعتبارسنجی زنده و هفت حالت بصری آماده‌اند. هیچ کتابخانه اعتبارسنجی نصب نمی‌شود.

## حالت‌های فرم

| حالت | کلاس / وضعیت |
| --- | --- |
| پیش‌فرض | `.form-control` |
| فوکوس | خودکار توسط CSS (`:focus-visible`) |
| پرشده | `.is-filled` (با JS بعد از ورود مقدار) |
| غیرفعال | `disabled` |
| فقط‌خواندنی | `readonly` |
| خطا | `.is-invalid` + `.field-feedback` |
| موفق | `.is-valid` |
| در حال ارسال | `.is-loading` روی دکمه ثبت |

## اعتبارسنجی اعلانی

```html
<form data-validate novalidate>
  <div class="form-field">
    <label class="form-label" for="email">ایمیل</label>
    <input id="email" name="email" class="form-control" type="email" required data-rule="email" data-validate-live="true">
    <p class="field-feedback" hidden></p>
  </div>

  <div class="form-field">
    <label class="form-label" for="nationalId">کد ملی</label>
    <input id="nationalId" name="nationalId" class="form-control" data-rule="nationalId">
  </div>

  <div class="form-field">
    <label class="form-label" for="password">گذرواژه</label>
    <input id="password" name="password" class="form-control" type="password" required data-rule="password" data-min="8" data-password-field="#password-meter">
    <div class="password-meter" id="password-meter"><span data-password-bar></span><span data-password-bar></span><span data-password-bar></span><span data-password-bar></span><small data-password-label></small></div>
  </div>

  <div class="form-field">
    <label class="form-label" for="confirm">تکرار گذرواژه</label>
    <input id="confirm" name="confirm" class="form-control" type="password" required data-match="password">
  </div>

  <button class="btn btn-primary" type="submit">ذخیره</button>
</form>
```

## قواعد آماده

| قاعده | بررسی |
| --- | --- |
| `required` | خالی نبودن |
| `email` | قالب ایمیل |
| `phone` | شماره موبایل ایران (۰۹xxxxxxxxx) |
| `nationalId` | کد ملی با رقم کنترلی |
| `postal` | کد پستی ۱۰ رقمی |
| `iban` | شبا با پیشوند IR |
| `url` | نشانی وب |
| `number` | عدد (با پشتیبانی ارقام فارسی) |
| `password` | حداقل طول (`data-min`) |
| `pattern` | الگوی `data-pattern` |
| `min` / `max` | طول مقدار |
| `match` | برابری با فیلد دیگر |
| `terms` | پذیرش قوانین |

ارقام فارسی و عربی پیش از بررسی به لاتین تبدیل می‌شوند؛ کاربر می‌تواند «۰۹۱۲۳۴۵۶۷۸۹» یا «09123456789» بنویسد.

## اعتبارسنجی برنامه‌ای

```js
import { validateForm, validateField } from './js/core/form.js';

const { valid, fields } = validateForm(form);
if (!valid) {
  console.log(fields.filter((item) => !item.valid).map((item) => item.field.name));
}
```

## ویجت‌های فرم

| ویجت | نشانه در HTML |
| --- | --- |
| ناحیه کشیدن فایل | `[data-file-drop]` |
| ورودی برچسب‌دار | `[data-tag-input]` |
| نوار قدرت گذرواژه | `[data-password-field="#meter"]` + `[data-password-bar]` |
| انتخاب وابسته | `[data-depends-on="province"]` |
| شمارنده | `[data-stepper]` |
| کد یک‌بار‌مصرف | `[data-otp]` با `.otp-row` و `.otp-input` |
| برنامه‌ریز تاریخ | `input[type="date"]` / `[data-datepicker]` |
| ورودی مبلغ با ماسک هزارگان | `[data-currency-input]` |

همه این‌ها با `initForms()` در `main.js` راه‌اندازی می‌شوند و روی محتوای تازه‌رندرشده هم با `initForms(scope)` قابل اعمال‌اند.

## فرم‌های پویا

برای ساختن فرم از روی تعریف (مثل فرم‌های «افزودن رکورد»):

```js
import { formMarkup, collectValues, openRecordForm } from './js/pages/kit.js';

const markup = formMarkup([
  { name: 'title', label: 'عنوان', required: true },
  { name: 'price', label: 'قیمت', type: 'number', rule: 'number' },
  { name: 'status', label: 'وضعیت', type: 'select', options: ['active', 'draft'] },
  { name: 'notes', label: 'توضیحات', type: 'textarea', col: 2, rows: 4 },
]);
```

> نکته: دکمه ثبت را با کلاس `is-loading` علامت بزنید تا در طول درخواست غیرفعال و اسپینری شود؛ در همه فرم‌های قالب همین الگو استفاده شده است.

> هشدار: هرگز اعتبارسنجی سمت کلاینت را جای اعتبارسنجی سرور نگذارید. این لایه برای تجربه کاربری است، نه امنیت.
