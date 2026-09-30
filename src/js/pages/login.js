/**
 * NOVAADMIN — premium login experience
 * ------------------------------------------------------------------
 * The demo opens here first (see `authGuard()` in main.js). The page is fully
 * self-contained: aurora visual side with real product screenshots, a glass
 * form card with floating labels, one-click demo sign-in, validation with
 * inline messages, caps-lock hint, password reveal, and a success hand-off
 * animation before the redirect.
 *
 * v1.1 — every visible string (both columns, validation, toasts, aria labels)
 * comes from the `COPY` dictionary below, so switching the language translates
 * the whole page instead of a handful of phrases. When a session is already
 * active the card offers “continue as …” instead of silently skipping the form.
 */
import { $, $$, on, escapeHtml } from '../core/dom.js';
import { toast } from '../core/toast.js';

import { goTo, url } from '../core/links.js';
import { getSession, setSession, clearSession, safeNext } from '../core/auth.js';
import { language } from '../core/i18n.js';
import { toDigits } from '../core/numbers.js';
import { config } from '../../config/config.js';
import * as services from '../../services/index.js';

const DEMO = { email: 'demo@novaadmin.dev', password: '12345678' };

const COPY = {
  fa: {
    pageTitle: 'ورود به NOVAADMIN',
    formRegion: 'فرم ورود',
    home: 'صفحه اصلی',
    language: 'تغییر زبان',
    theme: 'تغییر تم',
    tagline: 'پنل مدیریت هوشمند',
    title: 'خوش برگشتید',
    lead: 'برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.',
    demo: 'ورود سریع با حساب دمو',
    orEmail: 'یا ورود با ایمیل',
    email: 'آدرس ایمیل',
    password: 'رمز عبور',
    showPassword: 'نمایش رمز عبور',
    hidePassword: 'پنهان کردن رمز عبور',
    caps: 'Caps Lock روشن است',
    remember: 'مرا به خاطر بسپار',
    forgot: 'فراموشی رمز؟',
    submit: 'ورود به پنل',
    orContinue: 'یا ادامه با',
    google: 'گوگل',
    github: 'گیت‌هاب',
    microsoft: 'مایکروسافت',
    noAccount: 'حساب کاربری ندارید؟',
    register: 'ایجاد حساب رایگان',
    trustSsl: 'اتصال رمزنگاری‌شده SSL',
    trust2fa: 'ورود دومرحله‌ای',
    trustPrivacy: 'حریم خصوصی داده‌ها',
    welcome: (name) => `خوش آمدید، ${name}!`,
    preparing: 'در حال آماده‌سازی داشبورد شما…',
    pill: (v) => `نسخه ${v} · همه سرویس‌ها فعال`,
    heroA: 'کسب‌وکارتان را',
    heroB: 'هوشمندتر',
    heroC: 'مدیریت کنید',
    heroText: '۱۰ داشبورد تخصصی، کارگاه هوش مصنوعی، گزارش‌های لحظه‌ای و ده‌ها ماژول آماده — همه در یک پنل فارسی.',
    chipRevenue: 'درآمد این ماه',
    chipRevenueValue: '۱۸٫۶ میلیارد',
    chipRevenueDelta: '+۱۲٫۴٪',
    chipAi: 'دستیار هوشمند',
    chipAiValue: '۳ بینش جدید برای امروز',
    chipSec: 'امنیت حساب',
    chipSecValue: 'محافظت‌شده',
    emailRequired: 'ایمیل را وارد کنید.',
    emailInvalid: 'فرمت ایمیل درست نیست.',
    passwordRequired: 'رمز عبور را وارد کنید.',
    passwordShort: 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
    okTitle: 'ورود موفق',
    okText: 'در حال انتقال به داشبورد مدیریت…',
    socialTitle: (p) => `ورود با ${p}`,
    socialText: 'در نسخه نمایشی از «ورود سریع با حساب دمو» استفاده کنید.',
    activeTitle: 'شما هم‌اکنون وارد شده‌اید',
    activeText: (who) => `نشست فعال با حساب ${who}`,
    continue: 'ادامه به داشبورد',
    switchAccount: 'ورود با حساب دیگر',
    switchedTitle: 'از حساب قبلی خارج شدید',
    switchedText: 'اکنون می‌توانید با حساب دیگری وارد شوید.',
    quotes: [
      { text: 'ساخت پنل داخلی که قبلاً دو هفته طول می‌کشید، با نوا ادمین در دو روز تحویل شد.', name: 'مهدی رضایی', role: 'مدیر فنی، داده‌پردازان پارس' },
      { text: 'کارگاه هوش مصنوعی و داشبوردهای آماده، تجربه تیم ما را کاملاً متحول کرد.', name: 'نگین شریفی', role: 'طراح محصول، استودیو آرکا' },
      { text: 'RTL واقعی، تقویم شمسی و نمودارهای تمیز — دقیقاً همان چیزی که دنبالش بودیم.', name: 'سعید امینی', role: 'بنیان‌گذار، سرویس ابری ویرا' },
    ],
    demoName: 'سارا محمدی',
    demoFirst: 'سارا',
    demoRole: 'مدیر ارشد',
  },
  en: {
    pageTitle: 'Sign in to NOVAADMIN',
    formRegion: 'Sign-in form',
    home: 'Home',
    language: 'Change language',
    theme: 'Toggle theme',
    tagline: 'Smart admin dashboard',
    title: 'Welcome back',
    lead: 'Enter your account details to sign in to the admin panel.',
    demo: 'Quick sign-in with the demo account',
    orEmail: 'or sign in with email',
    email: 'Email address',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    caps: 'Caps Lock is on',
    remember: 'Remember me',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    orContinue: 'or continue with',
    google: 'Google',
    github: 'GitHub',
    microsoft: 'Microsoft',
    noAccount: 'Don’t have an account?',
    register: 'Create a free account',
    trustSsl: 'SSL-encrypted connection',
    trust2fa: 'Two-factor sign-in',
    trustPrivacy: 'Data privacy',
    welcome: (name) => `Welcome, ${name}!`,
    preparing: 'Preparing your dashboard…',
    pill: (v) => `Version ${v} · All systems operational`,
    heroA: 'Run your business',
    heroB: 'smarter',
    heroC: 'than ever',
    heroText: '10 specialised dashboards, an AI workspace, live reports and dozens of ready-made modules — all in one panel.',
    chipRevenue: 'Revenue this month',
    chipRevenueValue: '18.6 B',
    chipRevenueDelta: '+12.4%',
    chipAi: 'AI assistant',
    chipAiValue: '3 new insights today',
    chipSec: 'Account security',
    chipSecValue: 'Protected',
    emailRequired: 'Please enter your email.',
    emailInvalid: 'That email address doesn’t look right.',
    passwordRequired: 'Please enter your password.',
    passwordShort: 'Password must be at least 6 characters.',
    okTitle: 'Signed in',
    okText: 'Taking you to the dashboard…',
    socialTitle: (p) => `Sign in with ${p}`,
    socialText: 'In the demo, use “Quick sign-in with the demo account”.',
    activeTitle: 'You’re already signed in',
    activeText: (who) => `Active session for ${who}`,
    continue: 'Continue to dashboard',
    switchAccount: 'Use another account',
    switchedTitle: 'Signed out of the previous account',
    switchedText: 'You can now sign in with another account.',
    quotes: [
      { text: 'An internal panel that used to take two weeks was delivered in two days with NovaAdmin.', name: 'Mehdi Rezaei', role: 'CTO, Dadehpardazan Pars' },
      { text: 'The AI workspace and ready-made dashboards completely changed how our team works.', name: 'Negin Sharifi', role: 'Product designer, Arka Studio' },
      { text: 'Real RTL, a Jalali calendar and clean charts — exactly what we were looking for.', name: 'Saeed Amini', role: 'Founder, Vira Cloud' },
    ],
    demoName: 'Sara Mohammadi',
    demoFirst: 'Sara',
    demoRole: 'Administrator',
  },
  ar: {
    pageTitle: 'تسجيل الدخول إلى NOVAADMIN',
    formRegion: 'نموذج تسجيل الدخول',
    home: 'الصفحة الرئيسية',
    language: 'تغيير اللغة',
    theme: 'تبديل السمة',
    tagline: 'لوحة إدارة ذكية',
    title: 'مرحبًا بعودتك',
    lead: 'أدخل بيانات حسابك لتسجيل الدخول إلى لوحة الإدارة.',
    demo: 'دخول سريع بالحساب التجريبي',
    orEmail: 'أو الدخول بالبريد الإلكتروني',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    caps: 'مفتاح Caps Lock مفعّل',
    remember: 'تذكرني',
    forgot: 'نسيت كلمة المرور؟',
    submit: 'الدخول إلى اللوحة',
    orContinue: 'أو المتابعة باستخدام',
    google: 'جوجل',
    github: 'غيت هب',
    microsoft: 'مايكروسوفت',
    noAccount: 'ليس لديك حساب؟',
    register: 'إنشاء حساب مجاني',
    trustSsl: 'اتصال مشفّر SSL',
    trust2fa: 'تحقق بخطوتين',
    trustPrivacy: 'خصوصية البيانات',
    welcome: (name) => `أهلًا بك، ${name}!`,
    preparing: 'جارٍ تجهيز لوحة التحكم…',
    pill: (v) => `الإصدار ${v} · جميع الخدمات تعمل`,
    heroA: 'أدِر أعمالك',
    heroB: 'بذكاء',
    heroC: 'أكبر',
    heroText: '10 لوحات متخصصة، ومساحة ذكاء اصطناعي، وتقارير لحظية وعشرات الوحدات الجاهزة — كلها في لوحة واحدة.',
    chipRevenue: 'إيرادات هذا الشهر',
    chipRevenueValue: '١٨٫٦ مليار',
    chipRevenueDelta: '+١٢٫٤٪',
    chipAi: 'المساعد الذكي',
    chipAiValue: '٣ رؤى جديدة لليوم',
    chipSec: 'أمان الحساب',
    chipSecValue: 'محمي',
    emailRequired: 'يرجى إدخال البريد الإلكتروني.',
    emailInvalid: 'صيغة البريد الإلكتروني غير صحيحة.',
    passwordRequired: 'يرجى إدخال كلمة المرور.',
    passwordShort: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
    okTitle: 'تم تسجيل الدخول',
    okText: 'جارٍ الانتقال إلى لوحة التحكم…',
    socialTitle: (p) => `الدخول باستخدام ${p}`,
    socialText: 'في النسخة التجريبية استخدم «دخول سريع بالحساب التجريبي».',
    activeTitle: 'أنت مسجّل الدخول بالفعل',
    activeText: (who) => `جلسة نشطة للحساب ${who}`,
    continue: 'المتابعة إلى اللوحة',
    switchAccount: 'الدخول بحساب آخر',
    switchedTitle: 'تم الخروج من الحساب السابق',
    switchedText: 'يمكنك الآن تسجيل الدخول بحساب آخر.',
    quotes: [
      { text: 'لوحة داخلية كانت تستغرق أسبوعين، سُلّمت في يومين مع نوفا أدمن.', name: 'مهدي رضائي', role: 'المدير التقني، بارس لمعالجة البيانات' },
      { text: 'مساحة الذكاء الاصطناعي واللوحات الجاهزة غيّرت تجربة فريقنا بالكامل.', name: 'نكين شريفي', role: 'مصممة منتجات، استوديو آركا' },
      { text: 'دعم حقيقي للاتجاه من اليمين، وتقويم هجري شمسي ورسوم بيانية نظيفة — تمامًا ما كنا نبحث عنه.', name: 'سعيد أميني', role: 'المؤسس، فيرا السحابية' },
    ],
    demoName: 'سارا محمدي',
    demoFirst: 'سارا',
    demoRole: 'المدير العام',
  },
};

const AVATARS = ['assets/img/avatars/avatar-11.svg', 'assets/img/avatars/avatar-06.svg', 'assets/img/avatars/avatar-03.svg'];

function currentLang() {
  let lang = null;
  try {
    lang = new URLSearchParams(window.location.search).get('lang');
  } catch {}
  lang = lang || safeLanguage() || document.documentElement.getAttribute('lang') || 'fa';
  return COPY[lang] ? lang : 'fa';
}
function safeLanguage() {
  try {
    return language();
  } catch {
    return null;
  }
}

let L = COPY.fa;

const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const MS_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>';

function particles(count = 12) {
  // Reduced from 22 to 12 for performance, and respect prefers-reduced-motion
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    return '';
  }
  return Array.from({ length: count }, (_, i) => {
    const x = (i * 37) % 100;
    const y = (i * 53) % 100;
    const size = 2 + (i % 3);
    const delay = (i % 7) * -1.3;
    const dur = 6 + (i % 5) * 2;
    return `<i style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s"></i>`;
  }).join('');
}

function markup(session) {
  const q = L.quotes[0];
  const e = escapeHtml;
  const who = session ? e(session.email || session.name || '') : '';
  return `<div class="lx" data-no-i18n>
    <section class="lx-side" aria-label="${e(L.formRegion)}">
      <div class="lx-top">
        <a class="lx-back" href="${url('index.html')}"><i class="bi bi-arrow-right" aria-hidden="true"></i> ${e(L.home)}</a>
        <div class="lx-top__tools">
          <div class="dropdown">
            <button class="lx-icon-btn" type="button" data-dropdown-toggle="true" aria-expanded="false" aria-label="${e(L.language)}" title="${e(L.language)}"><i class="bi bi-translate" aria-hidden="true"></i></button>
            <ul class="dropdown-menu" data-dropdown-menu data-language-switch data-language-list></ul>
          </div>
          <button class="lx-icon-btn" type="button" data-theme-toggle aria-label="${e(L.theme)}" title="${e(L.theme)}"><i class="bi bi-moon-stars" aria-hidden="true"></i></button>
        </div>
      </div>

      <div class="lx-card" data-lx-card>
        <a class="lx-logo" href="${url('index.html')}" aria-label="NOVAADMIN">
          <span class="lx-logo__mark"><img src="${url('assets/logo-mark.svg')}" alt="" width="30" height="30"></span>
          <span class="lx-logo__text"><b>NOVA<em>ADMIN</em></b><small>${e(L.tagline)}</small></span>
        </a>
        <header class="lx-head">
          <h1>${e(L.title)} <span class="lx-wave" aria-hidden="true">👋</span></h1>
          <p>${e(L.lead)}</p>
        </header>

        ${
          session
            ? `<div class="lx-session" data-lx-session role="status">
          <span class="lx-session__icon"><i class="bi bi-person-check-fill" aria-hidden="true"></i></span>
          <div class="lx-session__text"><strong>${e(L.activeTitle)}</strong><small dir="auto">${e(L.activeText(''))}<b dir="ltr">${who}</b></small></div>
          <div class="lx-session__actions">
            <button class="lx-session__go" type="button" data-lx-continue>${e(L.continue)} <i class="bi bi-arrow-left" aria-hidden="true"></i></button>
            <button class="lx-session__alt" type="button" data-lx-switch>${e(L.switchAccount)}</button>
          </div>
        </div>`
            : ''
        }

        <button class="lx-demo" type="button" data-lx-demo>
          <span class="lx-demo__icon"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i></span>
          <span class="lx-demo__text"><strong>${e(L.demo)}</strong><small dir="ltr">${DEMO.email}</small></span>
          <i class="bi bi-arrow-left lx-demo__arrow" aria-hidden="true"></i>
        </button>

        <div class="lx-divider"><span>${e(L.orEmail)}</span></div>

        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="email">
            <i class="bi bi-envelope lx-field__icon" aria-hidden="true"></i>
            <input id="lx-email" class="lx-field__input" type="email" name="email" placeholder=" " autocomplete="email" dir="ltr" required>
            <label for="lx-email" class="lx-field__label">${e(L.email)}</label>
            <span class="lx-field__ok"><i class="bi bi-check-circle-fill" aria-hidden="true"></i></span>
          </div>
          <p class="lx-error" data-error="email" role="alert" hidden></p>

          <div class="lx-field" data-field="password">
            <i class="bi bi-shield-lock lx-field__icon" aria-hidden="true"></i>
            <input id="lx-password" class="lx-field__input" type="password" name="password" placeholder=" " autocomplete="current-password" dir="ltr" required minlength="6">
            <label for="lx-password" class="lx-field__label">${e(L.password)}</label>
            <button class="lx-eye" type="button" data-lx-eye aria-label="${e(L.showPassword)}"><i class="bi bi-eye" aria-hidden="true"></i></button>
          </div>
          <p class="lx-error" data-error="password" role="alert" hidden></p>
          <p class="lx-caps" data-lx-caps hidden><i class="bi bi-capslock-fill" aria-hidden="true"></i> ${e(L.caps)}</p>

          <div class="lx-row">
            <label class="lx-switch"><input type="checkbox" name="remember" checked><span class="lx-switch__track"><span></span></span> ${e(L.remember)}</label>
            <a class="lx-link" href="${url('auth/forgot-password.html')}">${e(L.forgot)}</a>
          </div>

          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">${e(L.submit)}</span>
            <i class="bi bi-arrow-left lx-submit__icon" aria-hidden="true"></i>
            <span class="lx-submit__spinner" aria-hidden="true"></span>
          </button>
        </form>

        <div class="lx-divider"><span>${e(L.orContinue)}</span></div>
        <div class="lx-social">
          <button type="button" class="lx-social__btn" data-lx-social="${e(L.google)}">${GOOGLE_SVG}<span>${e(L.google)}</span></button>
          <button type="button" class="lx-social__btn" data-lx-social="${e(L.github)}"><i class="bi bi-github" aria-hidden="true"></i><span>${e(L.github)}</span></button>
          <button type="button" class="lx-social__btn" data-lx-social="${e(L.microsoft)}">${MS_SVG}<span>${e(L.microsoft)}</span></button>
        </div>

        <p class="lx-foot">${e(L.noAccount)} <a href="${url('auth/register.html')}">${e(L.register)}</a></p>
      </div>

      <ul class="lx-trust">
        <li><i class="bi bi-shield-check" aria-hidden="true"></i> ${e(L.trustSsl)}</li>
        <li><i class="bi bi-fingerprint" aria-hidden="true"></i> ${e(L.trust2fa)}</li>
        <li><i class="bi bi-lock" aria-hidden="true"></i> ${e(L.trustPrivacy)}</li>
      </ul>

      <div class="lx-success" data-lx-success hidden>
        <div class="lx-success__inner">
          <svg class="lx-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-16"/></svg>
          <h2 data-lx-welcome>${e(L.welcome(L.demoFirst))}</h2>
          <p>${e(L.preparing)}</p>
          <div class="lx-progress"><span></span></div>
        </div>
      </div>
    </section>

    <section class="lx-visual" aria-hidden="true">
      <div class="lx-aurora"><span></span><span></span><span></span></div>
      <div class="lx-grid"></div>
      <div class="lx-particles">${particles()}</div>

      <div class="lx-copy">
        <span class="lx-pill"><span class="lx-pill__dot"></span> ${e(L.pill(toDigits(config.version ?? '1.1.0')))}</span>
        <h2>${e(L.heroA)} <span class="lx-grad">${e(L.heroB)}</span> ${e(L.heroC)}</h2>
        <p>${e(L.heroText)}</p>
      </div>

      <div class="lx-stage">
        <figure class="lx-shot lx-shot--back"><img src="${url('assets/img/shots/ai-studio-dark.jpg')}" alt="" width="1440" height="900"></figure>
        <figure class="lx-shot lx-shot--front">
          <span class="lx-shot__bar"><i></i><i></i><i></i><b>novaadmin.app/dashboards/analytics</b></span>
          <img src="${url('assets/img/shots/analytics-dark.jpg')}" alt="" width="1440" height="900">
        </figure>
        <div class="lx-chip lx-chip--rev">
          <span class="lx-chip__icon lx-chip__icon--green"><i class="bi bi-graph-up-arrow"></i></span>
          <div><small>${e(L.chipRevenue)}</small><strong>${e(L.chipRevenueValue)}</strong></div>
          <b class="lx-chip__delta" dir="ltr">${e(L.chipRevenueDelta)}</b>
        </div>
        <div class="lx-chip lx-chip--ai">
          <span class="lx-chip__icon lx-chip__icon--ai"><i class="bi bi-stars"></i></span>
          <div><small>${e(L.chipAi)}</small><strong>${e(L.chipAiValue)}</strong></div>
        </div>
        <div class="lx-chip lx-chip--sec">
          <span class="lx-chip__icon lx-chip__icon--blue"><i class="bi bi-shield-lock-fill"></i></span>
          <div><small>${e(L.chipSec)}</small><strong>${e(L.chipSecValue)}</strong></div>
        </div>
      </div>

      <figure class="lx-quote" data-lx-quote>
        <div class="lx-quote__stars">★★★★★</div>
        <blockquote data-lx-quote-text>«${e(q.text)}»</blockquote>
        <figcaption><img data-lx-quote-avatar src="${url(AVATARS[0])}" alt="" width="40" height="40"><span><b data-lx-quote-name>${e(q.name)}</b><small data-lx-quote-role>${e(q.role)}</small></span>
          <span class="lx-quote__dots">${L.quotes.map((_, i) => `<i class="${i === 0 ? 'is-active' : ''}"></i>`).join('')}</span></figcaption>
      </figure>
    </section>
  </div>`;
}

export function initLoginPro() {
  const main = document.getElementById('main-content') ?? document.querySelector('.auth-page') ?? document.querySelector('.lx-page');
  if (!main) return false;
  const lang = currentLang();
  L = COPY[lang];
  const session = getSession();
  const next = safeNext(new URLSearchParams(window.location.search).get('next'));

  main.className = 'lx-page';
  main.innerHTML = `<h1 class="visually-hidden">${escapeHtml(L.pageTitle)}</h1>${markup(session)}`;
  document.body.classList.add('lx-body');
  document.title = `${L.pageTitle}`;

  const form = $('[data-lx-form]', main);
  const email = $('[name="email"]', form);
  const password = $('[name="password"]', form);
  const remember = $('[name="remember"]', form);
  const submit = $('[data-lx-submit]', form);
  const card = $('[data-lx-card]', main);

  /* Language list + theme toggle live inside the freshly rendered markup. */
  import('../core/i18n.js')
    .then((m) => {
      m.initSelectors?.(main);
      m.renderLanguageLabels?.(main);
    })
    .catch(() => {});

  const setError = (name, message) => {
    const field = $(`[data-field="${name}"]`, form);
    const box = $(`[data-error="${name}"]`, form);
    field?.classList.toggle('is-invalid', Boolean(message));
    if (box) {
      box.hidden = !message;
      box.innerHTML = message ? `<i class="bi bi-exclamation-circle" aria-hidden="true"></i> ${escapeHtml(message)}` : '';
    }
  };
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  const refresh = () => {
    $('[data-field="email"]', form)?.classList.toggle('is-valid', validEmail(email.value.trim()));
    if (validEmail(email.value.trim())) setError('email', '');
    if (password.value.length >= 6) setError('password', '');
  };
  on(email, 'input', refresh);
  on(password, 'input', refresh);

  on($('[data-lx-eye]', form), 'click', (event) => {
    const button = event.currentTarget;
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    button.innerHTML = `<i class="bi bi-${show ? 'eye-slash' : 'eye'}" aria-hidden="true"></i>`;
    button.setAttribute('aria-label', show ? L.hidePassword : L.showPassword);
    password.focus();
  });
  const caps = $('[data-lx-caps]', form);
  on(password, 'keyup', (event) => {
    if (caps && event.getModifierState) caps.hidden = !event.getModifierState('CapsLock');
  });

  let busy = false;
  const handOff = (target) => {
    const overlay = $('[data-lx-success]', main);
    if (overlay) {
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('is-visible'));
    }
    toast.success(L.okTitle, L.okText);
    setTimeout(() => goTo(target, { replace: true }), 600);
  };

  const signIn = async () => {
    if (busy) return;
    const values = { email: email.value.trim(), password: password.value };
    let ok = true;
    if (!validEmail(values.email)) {
      setError('email', values.email ? L.emailInvalid : L.emailRequired);
      ok = false;
    }
    if (values.password.length < 6) {
      setError('password', values.password ? L.passwordShort : L.passwordRequired);
      ok = false;
    }
    if (!ok) {
      card.classList.remove('is-shake');
      void card.offsetWidth;
      card.classList.add('is-shake');
      (validEmail(values.email) ? password : email).focus();
      return;
    }
    busy = true;
    submit.classList.add('is-loading');
    submit.disabled = true;

    setSession({ email: values.email, name: L.demoName, role: L.demoRole, remember: remember?.checked !== false });
    document.documentElement.classList.remove('is-guarded');

    try {
      await services.authService?.login?.(values).catch(() => null);
    } catch {}
    handOff(next);
  };

  on(form, 'submit', (event) => {
    event.preventDefault();
    signIn();
  });

  on($('[data-lx-demo]', main), 'click', (event) => {
    event.preventDefault();
    email.value = DEMO.email;
    password.value = DEMO.password;
    refresh();
    signIn();
  });

  on($('[data-lx-continue]', main), 'click', () => {
    const active = getSession();
    if (!active) {
      $('[data-lx-session]', main)?.remove();
      return;
    }
    const welcome = $('[data-lx-welcome]', main);
    if (welcome) welcome.textContent = L.welcome(String(active.name || L.demoFirst).split(' ')[0]);
    handOff(next);
  });
  on($('[data-lx-switch]', main), 'click', () => {
    clearSession();
    $('[data-lx-session]', main)?.remove();
    toast.info(L.switchedTitle, L.switchedText);
    email.focus();
  });

  on(main, 'click', (event) => {
    const social = event.target.closest('[data-lx-social]');
    if (social) toast.info(L.socialTitle(social.dataset.lxSocial), L.socialText);
  });

  /* Rotating testimonial. */
  let index = 0;
  const quote = $('[data-lx-quote]', main);
  if (quote && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    setInterval(() => {
      if (document.hidden) return;
      index = (index + 1) % L.quotes.length;
      const item = L.quotes[index];
      quote.classList.add('is-fading');
      setTimeout(() => {
        $('[data-lx-quote-text]', quote).textContent = `«${item.text}»`;
        $('[data-lx-quote-name]', quote).textContent = item.name;
        $('[data-lx-quote-role]', quote).textContent = item.role;
        $('[data-lx-quote-avatar]', quote).src = url(AVATARS[index]);
        $$('.lx-quote__dots i', quote).forEach((dot, i) => dot.classList.toggle('is-active', i === index));
        quote.classList.remove('is-fading');
      }, 350);
    }, 6000);
  }

  /* Subtle parallax on the visual side - throttled with RAF for performance */
  const stage = $('.lx-stage', main);
  const visual = $('.lx-visual', main);
  if (stage && visual && window.matchMedia?.('(pointer: fine)')?.matches && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    let rafId = null;
    let lastX = 0, lastY = 0;
    on(visual, 'mousemove', (event) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const r = visual.getBoundingClientRect();
        const x = (lastX - r.left) / r.width - 0.5;
        const y = (lastY - r.top) / r.height - 0.5;
        stage.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
        stage.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
      });
    });
    on(visual, 'mouseleave', () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      stage.style.setProperty('--rx', '0deg');
      stage.style.setProperty('--ry', '0deg');
    });
  }
  if (!session && window.matchMedia?.('(pointer: fine)')?.matches) setTimeout(() => email.focus({ preventScroll: true }), 300);
  return true;
}

export default { initLoginPro };
