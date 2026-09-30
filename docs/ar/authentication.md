# المصادقة

لصفحات المصادقة في القالب واجهة كاملة وسلوك حقيقي، لكنها غير مرتبطة بواجهة خلفية. يشرح هذا القسم ما هو جاهز وما يجب فعله للربط.

## الصفحات المتوفرة

| الصفحة | المسار | ملاحظة |
| --- | --- | --- |
| تسجيل الدخول | `auth/login.html` | عمودان مع لوحة تعريفية |
| دخول مبسّط | `auth/login-minimal.html` | بلا لوحة جانبية، التركيز على النموذج |
| دخول بعمودين | `auth/login-split.html` | تخطيط ترويجي مختلف |
| إنشاء حساب | `auth/register.html` | تحقق كامل + قوة كلمة المرور |
| استعادة كلمة المرور | `auth/forgot-password.html` | إرسال رابط |
| إعادة التعيين | `auth/reset-password.html` | كلمة مرور جديدة + تأكيدها |
| تأكيد البريد | `auth/verify-email.html` | رمز من ٦ أرقام (OTP) |
| الدخول بخطوتين | `auth/two-factor.html` | رمز تطبيق المصادقة |
| قفل الشاشة | `auth/lock-screen.html` | فتح بكلمة المرور |
| تسجيل الخروج | `auth/logout.html` | تأكيد الخروج |
| خطأ الدخول | `auth/error.html` | حالة الخطأ |

تستخدم جميع الصفحات الهيكل `app-body--auth`: بلا شريط جانبي، مع أزرار السمة/الاتجاه/اللغة واختصار «الدخول إلى العرض التجريبي».

## ما الذي يعمل فعلاً؟

- التحقق من جميع الحقول (البريد، الرقم، الرقم الوطني، كلمة المرور، تطابق التأكيد)
- حقول الرمز لمرة واحدة مع الانتقال التلقائي بين الخانات ولصق الرمز
- حالة تحميل الزر ورسائل النجاح/الخطأ
- الانتقال إلى لوحة التحكم بعد النجاح (محاكاة)
- تحديد المحاولات وأزرار «الدخول بـ Google/GitHub» التي تعرض رسالة إعلامية في العرض التجريبي

## الربط بـ API حقيقية

1. أنشئ خدمة مصادقة:

```js
// src/services/auth.service.js
import { call } from './client.js';

export const authService = {
  login: (credentials) => call('post', 'auth/login', { body: credentials, resolver: () => ({ token: 'demo', user: { name: 'سارا محمدي' } }) }),
  register: (payload) => call('post', 'auth/register', { body: payload }),
  forgot: (email) => call('post', 'auth/forgot', { body: { email } }),
  verify: (code) => call('post', 'auth/verify', { body: { code } }),
  logout: () => call('post', 'auth/logout'),
};
```

2. في `src/js/pages/content.js` داخل `initAuth()`، اربط معالج الإرسال بها:

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
    toast.danger('فشل تسجيل الدخول', error.message);
  } finally {
    button.classList.remove('is-loading');
  }
});
```

3. أضف الرمز إلى الترويسات في `client.js`:

```js
const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
```

4. للمسارات المحمية، تحقّق في أعلى `main.js` من وجود الرمز وإلا فأعد التوجيه إلى `auth/login.html`. (في النسخة التجريبية هذا التحقق متساهل لتكون كل الصفحات قابلة للتصفح بحرية.)

## ملاحظات أمنية

- لا تحفظ كلمة المرور أبداً في `localStorage`؛ الرمز فقط.
- احمِ مسارات `auth/*` من جهة الخادم أيضاً.
- للرمز لمرة واحدة، تحكّم في مدة الصلاحية وعدد المحاولات على الخادم.
- استخدم رمز CSRF في النماذج الحقيقية.

> ملاحظة: لا يثبّت القالب أي خدمة مصادقة خارجية (بلا Firebase/Supabase) ليبقى اختيار الواجهة الخلفية حراً.

> تحذير: في الوضع التجريبي لا تُحفظ أي بيانات للمستخدم؛ ما تدخله يبقى في ذلك المتصفح وفي ذاكرة الصفحة فقط.
