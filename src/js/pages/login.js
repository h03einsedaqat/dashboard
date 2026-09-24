/**
 * NOVAADMIN — premium login experience
 * ------------------------------------------------------------------
 * The demo opens here first (see `authGuard()` in main.js). The page is fully
 * self-contained: aurora visual side with real product screenshots, a glass
 * form card with floating labels, one-click demo sign-in, validation with
 * inline messages, caps-lock hint, password reveal, and a success hand-off
 * animation before the redirect.
 */
import { $, $$, on, escapeHtml } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { toggleTheme } from '../core/theme.js';
import { goTo, url } from '../core/links.js';
import * as services from '../../services/index.js';

const DEMO = { email: 'demo@novaadmin.dev', password: '12345678' };

const QUOTES = [
  { text: 'ساخت پنل داخلی که قبلاً دو هفته طول می‌کشید، با نوا ادمین در دو روز تحویل شد.', name: 'مهدی رضایی', role: 'مدیر فنی، داده‌پردازان پارس', avatar: 'assets/img/avatars/avatar-11.svg' },
  { text: 'کارگاه هوش مصنوعی و داشبوردهای آماده، تجربه تیم ما را کاملاً متحول کرد.', name: 'نگین شریفی', role: 'طراح محصول، استودیو آرکا', avatar: 'assets/img/avatars/avatar-06.svg' },
  { text: 'RTL واقعی، تقویم شمسی و نمودارهای تمیز — دقیقاً همان چیزی که دنبالش بودیم.', name: 'سعید امینی', role: 'بنیان‌گذار، سرویس ابری ویرا', avatar: 'assets/img/avatars/avatar-03.svg' },
];

const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const MS_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>';

function particles(count = 22) {
  return Array.from({ length: count }, (_, i) => {
    const x = (i * 37) % 100;
    const y = (i * 53) % 100;
    const size = 2 + (i % 3);
    const delay = (i % 7) * -1.3;
    const dur = 6 + (i % 5) * 2;
    return `<i style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s"></i>`;
  }).join('');
}

function markup() {
  const q = QUOTES[0];
  return `<div class="lx">
    <section class="lx-side" aria-label="فرم ورود">
      <div class="lx-top">
        <a class="lx-back" href="${url('index.html')}"><i class="bi bi-arrow-right" aria-hidden="true"></i> صفحه اصلی</a>
        <div class="lx-top__tools">
          <button class="lx-icon-btn" type="button" data-lx-theme aria-label="تغییر تم"><i class="bi bi-moon-stars" aria-hidden="true"></i></button>
        </div>
      </div>

      <div class="lx-card" data-lx-card>
        <a class="lx-logo" href="${url('index.html')}" aria-label="NOVAADMIN">
          <span class="lx-logo__mark"><img src="${url('assets/logo-mark.svg')}" alt="" width="30" height="30"></span>
          <span class="lx-logo__text"><b>NOVA<em>ADMIN</em></b><small>پنل مدیریت هوشمند</small></span>
        </a>
        <header class="lx-head">
          <h1>خوش برگشتید <span class="lx-wave" aria-hidden="true">👋</span></h1>
          <p>برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.</p>
        </header>

        <button class="lx-demo" type="button" data-lx-demo>
          <span class="lx-demo__icon"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i></span>
          <span class="lx-demo__text"><strong>ورود سریع با حساب دمو</strong><small dir="ltr">${DEMO.email}</small></span>
          <i class="bi bi-arrow-left lx-demo__arrow" aria-hidden="true"></i>
        </button>

        <div class="lx-divider"><span>یا ورود با ایمیل</span></div>

        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="email">
            <i class="bi bi-envelope lx-field__icon" aria-hidden="true"></i>
            <input id="lx-email" class="lx-field__input" type="email" name="email" placeholder=" " autocomplete="email" dir="ltr" required>
            <label for="lx-email" class="lx-field__label">آدرس ایمیل</label>
            <span class="lx-field__ok"><i class="bi bi-check-circle-fill" aria-hidden="true"></i></span>
          </div>
          <p class="lx-error" data-error="email" hidden></p>

          <div class="lx-field" data-field="password">
            <i class="bi bi-shield-lock lx-field__icon" aria-hidden="true"></i>
            <input id="lx-password" class="lx-field__input" type="password" name="password" placeholder=" " autocomplete="current-password" dir="ltr" required minlength="6">
            <label for="lx-password" class="lx-field__label">رمز عبور</label>
            <button class="lx-eye" type="button" data-lx-eye aria-label="نمایش رمز عبور"><i class="bi bi-eye" aria-hidden="true"></i></button>
          </div>
          <p class="lx-error" data-error="password" hidden></p>
          <p class="lx-caps" data-lx-caps hidden><i class="bi bi-capslock-fill" aria-hidden="true"></i> Caps Lock روشن است</p>

          <div class="lx-row">
            <label class="lx-switch"><input type="checkbox" name="remember" checked><span class="lx-switch__track"><span></span></span> مرا به خاطر بسپار</label>
            <a class="lx-link" href="${url('auth/forgot-password.html')}">فراموشی رمز؟</a>
          </div>

          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">ورود به پنل</span>
            <i class="bi bi-arrow-left lx-submit__icon" aria-hidden="true"></i>
            <span class="lx-submit__spinner" aria-hidden="true"></span>
          </button>
        </form>

        <div class="lx-divider"><span>یا ادامه با</span></div>
        <div class="lx-social">
          <button type="button" class="lx-social__btn" data-lx-social="Google">${GOOGLE_SVG}<span>گوگل</span></button>
          <button type="button" class="lx-social__btn" data-lx-social="GitHub"><i class="bi bi-github" aria-hidden="true"></i><span>گیت‌هاب</span></button>
          <button type="button" class="lx-social__btn" data-lx-social="Microsoft">${MS_SVG}<span>مایکروسافت</span></button>
        </div>

        <p class="lx-foot">حساب کاربری ندارید؟ <a href="${url('auth/register.html')}">ایجاد حساب رایگان</a></p>
      </div>

      <ul class="lx-trust">
        <li><i class="bi bi-shield-check" aria-hidden="true"></i> اتصال رمزنگاری‌شده SSL</li>
        <li><i class="bi bi-fingerprint" aria-hidden="true"></i> ورود دومرحله‌ای</li>
        <li><i class="bi bi-lock" aria-hidden="true"></i> حریم خصوصی داده‌ها</li>
      </ul>

      <div class="lx-success" data-lx-success hidden>
        <div class="lx-success__inner">
          <svg class="lx-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-16"/></svg>
          <h2>خوش آمدید، سارا!</h2>
          <p>در حال آماده‌سازی داشبورد شما…</p>
          <div class="lx-progress"><span></span></div>
        </div>
      </div>
    </section>

    <section class="lx-visual" aria-hidden="true">
      <div class="lx-aurora"><span></span><span></span><span></span></div>
      <div class="lx-grid"></div>
      <div class="lx-particles">${particles()}</div>

      <div class="lx-copy">
        <span class="lx-pill"><span class="lx-pill__dot"></span> نسخه ۱٫۰٫۲ · همه سرویس‌ها فعال</span>
        <h2>کسب‌وکارتان را <span class="lx-grad">هوشمندتر</span> مدیریت کنید</h2>
        <p>۱۰ داشبورد تخصصی، کارگاه هوش مصنوعی، گزارش‌های لحظه‌ای و ده‌ها ماژول آماده — همه در یک پنل فارسی.</p>
      </div>

      <div class="lx-stage">
        <figure class="lx-shot lx-shot--back"><img src="${url('assets/img/shots/ai-studio-dark.jpg')}" alt="" width="1440" height="900"></figure>
        <figure class="lx-shot lx-shot--front">
          <span class="lx-shot__bar"><i></i><i></i><i></i><b>novaadmin.app/dashboards/analytics</b></span>
          <img src="${url('assets/img/shots/analytics-dark.jpg')}" alt="" width="1440" height="900">
        </figure>
        <div class="lx-chip lx-chip--rev">
          <span class="lx-chip__icon lx-chip__icon--green"><i class="bi bi-graph-up-arrow"></i></span>
          <div><small>درآمد این ماه</small><strong>۱۸٫۶ میلیارد</strong></div>
          <b class="lx-chip__delta">+۱۲٫۴٪</b>
        </div>
        <div class="lx-chip lx-chip--ai">
          <span class="lx-chip__icon lx-chip__icon--ai"><i class="bi bi-stars"></i></span>
          <div><small>دستیار هوشمند</small><strong>۳ بینش جدید برای امروز</strong></div>
        </div>
        <div class="lx-chip lx-chip--sec">
          <span class="lx-chip__icon lx-chip__icon--blue"><i class="bi bi-shield-lock-fill"></i></span>
          <div><small>امنیت حساب</small><strong>محافظت‌شده</strong></div>
        </div>
      </div>

      <figure class="lx-quote" data-lx-quote>
        <div class="lx-quote__stars">★★★★★</div>
        <blockquote data-lx-quote-text>«${escapeHtml(q.text)}»</blockquote>
        <figcaption><img data-lx-quote-avatar src="${url(q.avatar)}" alt="" width="40" height="40"><span><b data-lx-quote-name>${escapeHtml(q.name)}</b><small data-lx-quote-role>${escapeHtml(q.role)}</small></span>
          <span class="lx-quote__dots">${QUOTES.map((_, i) => `<i class="${i === 0 ? 'is-active' : ''}"></i>`).join('')}</span></figcaption>
      </figure>
    </section>
  </div>`;
}

export function initLoginPro() {
  const main = document.getElementById('main-content') ?? document.querySelector('.auth-page');
  if (!main) return false;
  main.className = 'lx-page';
  main.innerHTML = `<h1 class="visually-hidden">ورود به NOVAADMIN</h1>${markup()}`;
  document.body.classList.add('lx-body');

  const form = $('[data-lx-form]', main);
  const email = $('[name="email"]', form);
  const password = $('[name="password"]', form);
  const submit = $('[data-lx-submit]', form);
  const card = $('[data-lx-card]', main);

  const setError = (name, message) => {
    const field = $(`[data-field="${name}"]`, form);
    const box = $(`[data-error="${name}"]`, form);
    field?.classList.toggle('is-invalid', Boolean(message));
    if (box) {
      box.hidden = !message;
      box.innerHTML = message ? `<i class="bi bi-exclamation-circle" aria-hidden="true"></i> ${message}` : '';
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
    button.setAttribute('aria-label', show ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور');
    password.focus();
  });
  const caps = $('[data-lx-caps]', form);
  on(password, 'keyup', (event) => {
    if (caps && event.getModifierState) caps.hidden = !event.getModifierState('CapsLock');
  });

  const signIn = async () => {
    const values = { email: email.value.trim(), password: password.value };
    let ok = true;
    if (!validEmail(values.email)) {
      setError('email', values.email ? 'فرمت ایمیل درست نیست.' : 'ایمیل را وارد کنید.');
      ok = false;
    }
    if (values.password.length < 6) {
      setError('password', values.password ? 'رمز عبور باید حداقل ۶ کاراکتر باشد.' : 'رمز عبور را وارد کنید.');
      ok = false;
    }
    if (!ok) {
      card.classList.remove('is-shake');
      void card.offsetWidth;
      card.classList.add('is-shake');
      return;
    }
    submit.classList.add('is-loading');
    submit.disabled = true;
    await Promise.all([services.authService?.login?.(values).catch(() => null), new Promise((r) => setTimeout(r, 900))]);
    const session = JSON.stringify({ email: values.email, name: 'سارا محمدی', at: Date.now() });
    try {
      const remember = $('[name="remember"]', form)?.checked;
      (remember ? window.localStorage : window.sessionStorage).setItem('nova:session', session);
    } catch {
      /* storage unavailable: the guard treats that as signed in */
    }
    const overlay = $('[data-lx-success]', main);
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    const next = new URLSearchParams(window.location.search).get('next');
    const target = next && /^[a-z0-9][a-z0-9./_-]*\.html$/i.test(next) && !next.startsWith('auth/') ? next : 'dashboards/analytics.html';
    setTimeout(() => goTo(target), 1600);
  };

  on(form, 'submit', (event) => {
    event.preventDefault();
    signIn();
  });

  on($('[data-lx-demo]', main), 'click', async () => {
    /* Types the demo credentials visibly, then signs in. */
    email.value = '';
    password.value = '';
    for (const ch of DEMO.email) {
      email.value += ch;
      await new Promise((r) => setTimeout(r, 18));
    }
    refresh();
    for (const ch of DEMO.password) {
      password.value += ch;
      await new Promise((r) => setTimeout(r, 30));
    }
    refresh();
    signIn();
  });

  on(main, 'click', (event) => {
    const social = event.target.closest('[data-lx-social]');
    if (social) toast.info('ورود با ' + social.dataset.lxSocial, 'در نسخه نمایشی از «ورود سریع با حساب دمو» استفاده کنید.');
  });
  on($('[data-lx-theme]', main), 'click', () => toggleTheme());

  /* Rotating testimonial. */
  let index = 0;
  const quote = $('[data-lx-quote]', main);
  if (quote && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    setInterval(() => {
      index = (index + 1) % QUOTES.length;
      const item = QUOTES[index];
      quote.classList.add('is-fading');
      setTimeout(() => {
        $('[data-lx-quote-text]', quote).textContent = `«${item.text}»`;
        $('[data-lx-quote-name]', quote).textContent = item.name;
        $('[data-lx-quote-role]', quote).textContent = item.role;
        $('[data-lx-quote-avatar]', quote).src = url(item.avatar);
        $$('.lx-quote__dots i', quote).forEach((dot, i) => dot.classList.toggle('is-active', i === index));
        quote.classList.remove('is-fading');
      }, 350);
    }, 6000);
  }

  /* Subtle parallax on the visual side. */
  const stage = $('.lx-stage', main);
  const visual = $('.lx-visual', main);
  if (stage && visual && window.matchMedia?.('(pointer: fine)')?.matches) {
    on(visual, 'mousemove', (event) => {
      const r = visual.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - 0.5;
      const y = (event.clientY - r.top) / r.height - 0.5;
      stage.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
      stage.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
    });
    on(visual, 'mouseleave', () => {
      stage.style.setProperty('--rx', '0deg');
      stage.style.setProperty('--ry', '0deg');
    });
  }
  setTimeout(() => email.focus({ preventScroll: true }), 300);
  return true;
}

export default { initLoginPro };
