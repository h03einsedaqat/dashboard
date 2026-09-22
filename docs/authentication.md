# احراز هویت

صفحات احراز هویت در قالب، رابط کامل و رفتار واقعی دارند اما به بک‌اند وصل نیستند. این بخش توضیح می‌دهد چه چیزی آماده است و برای وصل شدن چه باید کرد.

## صفحات موجود

| صفحه | مسیر | نکته |
| --- | --- | --- |
| ورود | `auth/login.html` | دو ستونه با پنل معرفی |
| ورود ساده | `auth/login-minimal.html` | بدون پنل کنار، تمرکز روی فرم |
| ورود دو ستونه | `auth/login-split.html` | چیدمان تبلیغاتی متفاوت |
| ثبت‌نام | `auth/register.html` | اعتبارسنجی کامل + قدرت گذرواژه |
| بازیابی گذرواژه | `auth/forgot-password.html` | ارسال پیوند |
| بازنشانی | `auth/reset-password.html` | گذرواژه جدید + تکرار |
| تأیید ایمیل | `auth/verify-email.html` | کد ۶ رقمی (OTP) |
| ورود دو مرحله‌ای | `auth/two-factor.html` | کد برنامه احراز هویت |
| قفل صفحه | `auth/lock-screen.html` | باز کردن با گذرواژه |
| خروج | `auth/logout.html` | تأیید خروج |
| خطای ورود | `auth/error.html` | حالت خطا |

همه صفحات از پوسته `app-body--auth` استفاده می‌کنند: بدون سایدبار، با دکمه‌های تم/جهت/زبان و میان‌بر «ورود به دمو».

## چه چیزی واقعی کار می‌کند؟

- اعتبارسنجی همه فیلدها (ایمیل، شماره، کد ملی، گذرواژه، تطابق تکرار)
- ورودی‌های کد یک‌بار‌مصرف با پرش خودکار بین خانه‌ها و چسباندن کد
- حالت بارگذاری دکمه و پیام‌های موفقیت/خطا
- انتقال به داشبورد پس از موفقیت (شبیه‌سازی‌شده)
- محدودسازی و دکمه‌های «ورود با گوگل/گیت‌هاب» که در دمو پیام اطلاع می‌دهند

## وصل کردن به API واقعی

1. یک سرویس احراز هویت بسازید:

```js
// src/services/auth.service.js
import { call } from './client.js';

export const authService = {
  login: (credentials) => call('post', 'auth/login', { body: credentials, resolver: () => ({ token: 'demo', user: { name: 'سارا محمدی' } }) }),
  register: (payload) => call('post', 'auth/register', { body: payload }),
  forgot: (email) => call('post', 'auth/forgot', { body: { email } }),
  verify: (code) => call('post', 'auth/verify', { body: { code } }),
  logout: () => call('post', 'auth/logout'),
};
```

2. در `src/js/pages/content.js` داخل `initAuth()`، هندلر submit را به آن وصل کنید:

```js
const { authService } = await import('../../services/auth.service.js');

on($('[data-auth-form]', node), 'submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('[data-submit]', form);
  button.classList.add('is-loading');
  try {
    const session = await authService.login(collectValues(form));
    localStorage.setItem('nova:token', session.token);
    window.location.assign('dashboards/analytics.html');
  } catch (error) {
    toast.danger('ورود ناموفق', error.message);
  } finally {
    button.classList.remove('is-loading');
  }
});
```

3. توکن را در `client.js` به هدرها اضافه کنید:

```js
const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
```

4. برای مسیرهای محافظت‌شده، در بالای `main.js` بررسی کنید که توکن وجود دارد و در غیر این صورت به `auth/login.html` هدایت کنید. (در نسخه دمو، این بررسی غیرفعال است تا همه صفحات آزادانه قابل مشاهده باشند.)

## نکات امنیتی

- گذرواژه را هرگز در `localStorage` نگه ندارید؛ فقط توکن.
- مسیرهای `auth/*` را در سمت سرور هم محافظت کنید.
- برای کد یک‌بار‌مصرف، انقضا و تعداد تلاش را در سرور کنترل کنید.
- در فرم‌های واقعی از CSRF token استفاده کنید.

> نکته: قالب هیچ سرویس احراز هویت بیرونی نصب نمی‌کند (بدون Firebase/Supabase) تا انتخاب بک‌اند آزاد بماند.

> هشدار: در حالت دمو هیچ داده‌ای از کاربر ذخیره نمی‌شود؛ چیزی که وارد می‌کنید فقط در همان مرورگر و در حافظه صفحه می‌ماند.
