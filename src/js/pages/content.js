/**
 * NOVAADMIN — content, account and system pages
 * ------------------------------------------------------------------
 * Landing page, documentation, settings, profile, UI-kit demos, invoices,
 * authentication flows, search results and the system/error pages.
 *
 * All of them talk to the same service layer as the rest of the template, so
 * every figure, list and form behaves like a real application screen.
 */
import { $, $$, on, render, escapeHtml, debounce } from '../core/dom.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { storage, KEYS } from '../core/storage.js';
import { theme } from '../core/theme.js';
import { setLanguage } from '../core/i18n.js';
import { formatCurrency, formatNumber, formatPercent, toDigits } from '../core/numbers.js';
import { formatDate, relativeTime } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { withState } from '../core/load.js';
import { SHOWCASE, FEATURES, FAQ, STEPS, RELEASE_HEADLINE, CODE_SAMPLE } from '../../data/landing.js';
import { config } from '../../config/config.js';
import { searchService, commandService } from '../../services/index.js';
import { navigation, navigationSections, navigationCount } from '../../data/navigation.js';
import { goTo, url } from '../core/links.js';
import * as kit from './kit.js';

const {
  card,
  statCard,
  infoRows,
  timeline,
  paint,
  host,
  tabs,
  pageHeader,
  formMarkup,
  collectValues,
  openRecordForm,
  exportable,
  kpiCards,
  emptyState,
  statusBadge,
  toolButtons,
  statsFrom,
  chart,
  asRows,
  chartBox,
  services,
} = kit;

/* ===================================================== landing / marketing */

/**
 * Landing page — the shop window of the template.
 * ------------------------------------------------------------------
 * Two rules shape this module:
 *
 *   1. **Every block is a state machine.** Each section is loaded through
 *      `withState()`, so it starts as a skeleton, becomes content, or shows a
 *      retryable error card. No panel is ever silently empty — including when
 *      a service rejects.
 *   2. **What is advertised is what ships.** The hero preview and the demo
 *      gallery render the generated dashboard pictures (`tools/gen-previews.mjs`),
 *      drawn from the same mock data the real dashboards use, and they follow
 *      the visitor's theme (light / dark) like every other page.
 */
export async function initLanding() {
  const node = $('[data-landing]') ?? host();
  if (!node) return;
  node.dataset.appClaimed = '1';

  /* `config.version` (mirrored in package.json) is the single source of the release
     number: the hero badge and the changelog heading print it, so nothing goes stale
     on the next release. */
  $$('[data-app-version]').forEach((target) => {
    const text = toDigits(config.version ?? '');
    if (text) target.textContent = text;
  });

  wireLandingHeader(node);
  initMarquee(node);
  initHeroShowcase(node);
  initFaqControls(node);

  /* The landing never skips the login page: every “login / live demo” CTA
     goes to auth/login.html, which offers “continue as …” when a session is
     already active. */
  const block = (selector, load, options = {}) => {
    const target = $(selector, node);
    if (!target) return Promise.resolve();
    return withState(target, load, { skeleton: 'card', ...options });
  };

  await Promise.all([
    block('[data-landing-highlights]', landingFeatures, { skeleton: 'card' }),
    block('[data-landing-demos]', landingDemos, { skeleton: 'card', title: 'دموها' }),
    block('[data-landing-layouts]', landingLayouts, { skeleton: 'list', title: 'چیدمان‌ها' }),
    block('[data-landing-ai]', landingAi, { skeleton: 'list', title: 'بخش هوش مصنوعی' }),
    block('[data-landing-tech]', landingTech, { skeleton: 'text', title: 'پشته فناوری' }),
    block('[data-landing-steps]', landingSteps, { skeleton: 'card', title: 'شروع سریع' }),
    block('[data-landing-release]', landingRelease, { skeleton: 'list', title: 'تازه‌های نسخه' }),
    block('[data-landing-testimonials]', landingTestimonials, { skeleton: 'card', title: 'نظرات' }),
    block('[data-landing-pricing]', landingPricing, { skeleton: 'card', title: 'پلن‌ها' }),
    block('[data-landing-faq]', landingFaq, { skeleton: 'list', title: 'پرسش‌های پرتکرار', wrap: false }),
    block('[data-ai-stats]', landingAiStats, { skeleton: 'kpi', title: 'آمار AI' }),
    landingCounters(node),
  ]);

  /* The FAQ is interactive only once its items exist. */
  initFaqControls(node);
  $$('[data-code]', node).forEach((el) => {
    el.innerHTML = highlightCode(CODE_SAMPLE);
  });
}

/* ----------------------------------------------------- shared landing helpers */

/** Preview picture for a dashboard, in the theme the visitor is looking at. */
function previewSrc(id, mode = landingMode()) {
  return `assets/img/shots/${id}-${mode}.jpg`;
}

function landingMode() {
  const snapshot = theme.snapshot?.() ?? {};
  if (snapshot.theme === 'system' || !snapshot.theme) {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  }
  return snapshot.theme === 'dark' ? 'dark' : 'light';
}

/** Re-points every preview image on the page after a theme change. */
function syncLandingImages(root = document) {
  $$('[data-preview-id]', root).forEach((img) => {
    const id = img.dataset.previewId;
    const wanted = previewSrc(id);
    if (img.getAttribute('src') !== wanted) {
      if (typeof Image === 'undefined') {
        img.setAttribute('src', wanted);
        return;
      }
      img.style.opacity = '0';
      const next = new Image();
      next.alt = img.alt;
      next.width = img.width;
      next.height = img.height;
      next.decoding = 'async';
      next.onload = () => {
        img.replaceWith(Object.assign(next, { style: 'transition: opacity 220ms var(--nv-ease)' }));
        requestAnimationFrame(() => {
          next.style.opacity = '1';
        });
      };
      next.src = wanted;
      return;
    }
  });
}

function highlightCode(source) {
  return escapeHtml(source)
    .replace(/(\/\/[^\n]*)/g, '<span class="tok-c">$1</span>')
    .replace(/(&#39;[^&]*?&#39;|`[^`]*`)/g, '<span class="tok-s">$1</span>')
    .replace(/\b(export|const|async|await|return|function|import|from|new|=&gt;)\b/g, '<span class="tok-k">$1</span>');
}

/* ---------------------------------------------------------------- chrome bits */

/**
 * Header shared by every chrome-less marketing page: stuck shadow, a mobile
 * menu button (created when the page did not ship one), active-section
 * tracking, the Jalali year in the footer and the newsletter form.
 * Small, self-contained and all optional — the page stays readable with every
 * one of them missing.
 */
export function wireLandingHeader(node = document) {
  const header = $('.landing-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
    onScroll();
    on(window, 'scroll', debounce(onScroll, 60), { passive: true });
  }

  const menu = $('.landing-header .landing-nav', node) ?? $('.landing-nav');
  let menuButton = $('[data-landing-menu]');
  if (menu && !menuButton) {
    /* The preview page ships no button; without one the nav would simply vanish
       below the breakpoint, so it is created here instead of duplicating markup. */
    const actions = $('.landing-header__actions');
    if (actions) {
      menuButton = document.createElement('button');
      menuButton.type = 'button';
      menuButton.className = 'btn btn-sm btn-icon btn-outline-secondary';
      menuButton.setAttribute('data-landing-menu', '');
      menuButton.setAttribute('aria-controls', 'landing-nav');
      menuButton.setAttribute('aria-label', 'فهرست بخش‌ها');
      menuButton.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
      actions.prepend(menuButton);
    }
  }
  if (menuButton && menu) {
    const setMenu = (open) => {
      menu.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.innerHTML = `<i class="bi bi-${open ? 'x-lg' : 'list'}" aria-hidden="true"></i>`;
    };
    on(menuButton, 'click', () => setMenu(!menu.classList.contains('is-open')));
    on(menu, 'click', (event) => {
      if (event.target.closest('a')) setMenu(false);
    });
    on(document, 'keydown', (event) => {
      if (event.key === 'Escape') setMenu(false);
    });
  }

  const links = $$('.landing-nav__link', node);
  const sections = links.map((link) => $(link.getAttribute('href'), node)).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`));
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 1] },
    );
    sections.forEach((section) => spy.observe(section));
  }

  const yearNode = $('[data-year]', node);
  if (yearNode) {
    try {
      yearNode.textContent = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date());
    } catch {
      yearNode.textContent = toDigits(new Date().getFullYear());
    }
  }

  const newsletter = $('[data-newsletter]', node);
  if (newsletter) {
    on(newsletter, 'submit', async (event) => {
      event.preventDefault();
      const input = $('input[type="email"]', newsletter);
      const button = $('button[type="submit"]', newsletter);
      const note = $('.landing-cta__note', newsletter.parentElement ?? newsletter);
      const value = (input?.value ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        input?.setCustomValidity('یک ایمیل معتبر بنویسید');
        input?.reportValidity();
        input?.setCustomValidity('');
        input?.focus();
        return;
      }
      button?.classList.add('is-loading');
      if (button) button.disabled = true;
      try {
        await services.contentService.subscribe(value);
        input.value = '';
        if (note) note.innerHTML = '<i class="bi bi-check2-circle"></i> عضویت ثبت شد — خبرنامه ماهانه برای شما ارسال می‌شود.';
        toast.success('عضویت انجام شد', 'خبرنامه ماهانه برای شما ارسال می‌شود.');
      } catch (error) {
        toast.error('عضویت ناموفق بود', error?.message ?? 'دوباره تلاش کنید.');
      } finally {
        button?.classList.remove('is-loading');
        if (button) button.disabled = false;
      }
    });
  }
}

/** The scrolling proof strip needs its content twice for a seamless loop. */
function initMarquee(node) {
  const track = $('[data-marquee]', node);
  if (!track || track.dataset.cloned === '1') return;
  track.dataset.cloned = '1';
  track.insertAdjacentHTML('beforeend', track.innerHTML);
}

/* ---------------------------------------------------------------- the device */

/**
 * The hero product preview.
 *
 * It is not a video and not a static screenshot: it is a real `<img>` per demo
 * in both themes, with tab semantics, arrow-key navigation, auto-rotation that
 * pauses while the visitor is reading or hovering, and the two live numbers of
 * that dashboard fetched from the same analytics service the dashboards use.
 */
function initHeroShowcase(node) {
  const shell = $('[data-showcase]', node);
  if (!shell || shell.dataset.ready === '1') return;
  shell.dataset.ready = '1';

  const items = SHOWCASE.map((entry) => ({ ...entry, url: `auth/login.html?next=${encodeURIComponent(`dashboards/${entry.id}.html`)}` }));
  const tabsHost = $('[data-showcase-tabs]', shell);
  const mediaHost = $('[data-showcase-media]', shell);
  const caption = $('[data-showcase-caption]', shell);
  const metricsHost = $('[data-showcase-metrics]', shell);
  const slugNode = $('[data-showcase-slug]', shell);
  if (!tabsHost || !mediaHost) return;

  let index = Math.max(0, items.findIndex((item) => item.id === (document.body.dataset.page || '').split('/').pop()?.replace('.html', '')));
  if (index < 0) index = 0;
  let timer = null;

  render(
    tabsHost,
    items
      .map(
        (item, position) =>
          `<button class="landing-device__tab" type="button" role="tab" id="showcase-tab-${escapeHtml(item.id)}" aria-controls="showcase-media" aria-selected="${position === index}" data-showcase-index="${position}" tabindex="${position === index ? 0 : -1}">${escapeHtml(item.title)}</button>`,
      )
      .join(''),
  );

  const paintMetrics = (item) => {
    render(
      metricsHost,
      item.metrics
        .map((metric) => `<span class="landing-device__metric"><span>${escapeHtml(metric.label)}</span><b>${escapeHtml(metric.value)}</b></span>`)
        .join(''),
    );
    /* Real KPI of that demo, when the service answers — the page never waits on it. */
    services.analyticsService
      ?.kpis?.(item.id)
      ?.then((kpis) => {
        const first = (kpis ?? [])[0];
        const chip = $('[data-showcase-delta]', shell);
        if (chip && first) {
          chip.textContent = `${first.delta >= 0 ? '+' : '−'}${toDigits(Math.abs(first.delta))}٪`;
        }
      })
      ?.catch(() => {});
  };

  const show = (position) => {
    index = (position + items.length) % items.length;
    const item = items[index];
    tabsHost.querySelectorAll('.landing-device__tab').forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (slugNode) slugNode.textContent = item.id;
    if (caption) caption.textContent = `${item.title} — ${item.text}`;
    paintMetrics(item);
    shell.classList.remove('is-ready');
    mediaHost.classList.add('is-swapping');
    const id = `showcase-${item.id}-${Date.now()}`;
    const picture = `<picture>
        <img id="${id}" data-preview-id="${escapeHtml(item.id)}" src="${escapeHtml(previewSrc(item.id))}" width="1440" height="900" alt="پیش‌نمایش ${escapeHtml(item.title)} در ${config.appName}" decoding="async" />
      </picture>`;
    const fallback = () => {
      render(
        mediaHost,
        `<div class="state-panel state-panel--empty"><i class="bi bi-image-alt"></i><span class="state-panel__title">پیش‌نمایش در دسترس نیست</span><span class="state-panel__text">برای دیدن این دمو وارد پنل شوید.</span><a class="btn btn-sm btn-primary" href="${escapeHtml(item.url)}">باز کردن دمو</a></div>`,
      );
      shell.classList.add('is-ready');
    };
    /*
     * The picture is decoded before it is swapped in, so changing demo never
     * flashes a half-drawn frame. When the browser (or a headless harness) has
     * no `Image`, the markup is inserted directly — an `<img>` that cannot
     * decode simply shows its alt text, which is still better than a blank box.
     */
    if (typeof Image === 'undefined') {
      render(mediaHost, picture);
      shell.classList.add('is-ready');
      return;
    }
    const preload = new Image();
    preload.onload = () => {
      render(mediaHost, picture);
      shell.classList.add('is-ready');
      setTimeout(() => mediaHost.classList.remove('is-swapping'), 460);
    };
    preload.onerror = fallback;
    preload.src = previewSrc(item.id);
  };

  show(index);

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const start = () => {
    stop();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    timer = setInterval(() => show(index + 1), 7000);
  };
  on(tabsHost, 'click', (event) => {
    const tab = event.target.closest('[data-showcase-index]');
    if (!tab) return;
    show(Number(tab.dataset.showcaseIndex));
    start();
  });
  on(tabsHost, 'keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const forward = event.key === 'ArrowLeft'; /* RTL: left points to the next item */
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index + (forward ? 1 : -1);
    show(next);
    tabsHost.querySelector('.landing-device__tab.is-active')?.focus();
    start();
  });
  on(shell, 'mouseenter', stop);
  on(shell, 'mouseleave', start);
  on(shell, 'focusin', stop);
  on(shell, 'focusout', start);
  on(document, 'visibilitychange', () => (document.hidden ? stop() : start()));
  bus.on(EVENTS.theme, () => {
    syncLandingImages(node);
    show(index);
  });
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver((entries) => (entries[0].isIntersecting ? start() : stop()));
    visibility.observe(shell);
  } else {
    start();
  }
}

/* ------------------------------------------------------------ data sections */

async function landingFeatures() {
  const served = await services.contentService.highlights().catch(() => []);
  const items = FEATURES.length ? FEATURES : served.map((item) => ({ ...item, proof: '' }));
  return items
    .map(
      (item) => `<div class="col-sm-6 col-xl-3">
        <article class="landing-feature landing-feature--${escapeHtml(item.tone ?? 'primary')}">
          <span class="landing-feature__icon"><i class="bi bi-${escapeHtml(item.icon ?? 'stars')}" aria-hidden="true"></i></span>
          <h3 class="landing-feature__title">${escapeHtml(item.title)}</h3>
          <p class="landing-feature__text">${escapeHtml(item.text ?? item.body ?? '')}</p>
          ${item.proof ? `<span class="landing-feature__proof"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> ${escapeHtml(item.proof)}</span>` : ''}
        </article></div>`,
    )
    .join('');
}

async function landingDemos() {
  const demos = config.demos ?? [];
  const pagesByDemo = await services.demoService
    ?.switcher?.()
    ?.catch(() => []);
  const extras = new Map((pagesByDemo ?? []).map((row) => [row.id, row]));
  return demos
    .map((demo, position) => {
      const meta = SHOWCASE.find((entry) => entry.id === demo.id) ?? {};
      const extra = extras.get(demo.id) ?? {};
      const label = demo.label?.fa ?? demo.id;
      /* 10 demos: two rows of three, then one row of four — no orphan card. */
      const cols = demos.length === 10 && position >= 6 ? 'col-sm-6 col-xl-3' : 'col-sm-6 col-xl-4';
      return `<div class="${cols}">
        <article class="landing-demo-card" data-reveal>
          <a class="landing-demo-card__media" href="${escapeHtml(`auth/login.html?next=${encodeURIComponent(demo.url ?? `dashboards/${demo.id}.html`)}`)}" aria-label="باز کردن داشبورد ${escapeHtml(label)}">
            <picture>
              <img data-preview-id="${escapeHtml(demo.id)}" src="${escapeHtml(previewSrc(demo.id))}" width="1440" height="900" loading="lazy" decoding="async" alt="پیش‌نمایش داشبورد ${escapeHtml(label)} — ${escapeHtml(meta.text ?? '')}" />
            </picture>
            <span class="landing-demo-card__open"><i class="bi bi-box-arrow-up-left" aria-hidden="true"></i> باز کردن دمو</span>
          </a>
          <div class="landing-demo-card__body">
            <span class="landing-demo-card__icon"><i class="bi bi-${escapeHtml(demo.icon ?? 'window')}" aria-hidden="true"></i></span>
            <div style="min-width:0">
              <h3 class="landing-demo-card__title">${escapeHtml(meta.title ?? label)}</h3>
              <p class="landing-demo-card__text">${escapeHtml(meta.text ?? extra.description ?? '')}</p>
            </div>
          </div>
          <footer class="landing-demo-card__foot">
            <span><i class="bi bi-layers" aria-hidden="true"></i> ${escapeHtml(extra.section ?? 'بخش کامل')}</span>
            ${(meta.metrics ?? []).slice(0, 2).map((metric) => `<span>${escapeHtml(metric.label)}: <b>${escapeHtml(metric.value)}</b></span>`).join('')}
          </footer>
        </article></div>`;
    })
    .join('');
}

async function landingLayouts() {
  const cards = [
    { icon: 'layout-sidebar-inset', title: 'سایدبار کامل', text: 'منوی کناری با زیرمنوی آکاردئونی، جست‌وجو و نشان‌گر صفحه فعال.', preview: 'sidebar' },
    { icon: 'layout-sidebar', title: 'ریل جمع‌شونده', text: 'با دکمه هدر یا Ctrl + B سایدبار به ریل آیکن تبدیل می‌شود و فضای کار بیشتر می‌شود.', preview: 'mini' },
    { icon: 'phone', title: 'کشوی موبایل', text: 'در تبلت و موبایل منو کشویی و لمسی است؛ جدول‌ها کارت می‌شوند و دکمه‌ها از کادر بیرون نمی‌زنند.', preview: 'collapse' },
  ];
  const palettes = [
    ['indigo', '#4f46e5'], ['blue', '#2563eb'], ['emerald', '#059669'], ['violet', '#7c3aed'], ['rose', '#e11d48'], ['orange', '#ea580c'],
  ];
  const current = theme.snapshot?.() ?? theme.state ?? {};
  const staticCards = cards
    .map(
      (card) => `<article class="landing-layout landing-layout--static">
        <span class="landing-layout__head">
          <i class="bi bi-${escapeHtml(card.icon)}" aria-hidden="true"></i>
          <span class="landing-layout__title">${escapeHtml(card.title)}</span>
        </span>
        <span class="landing-layout__preview is-${escapeHtml(card.preview)}" aria-hidden="true"><i></i><i></i></span>
        <span class="landing-layout__text">${escapeHtml(card.text)}</span>
      </article>`,
    )
    .join('');
  const themeCard = `<article class="landing-layout landing-layout--static">
      <span class="landing-layout__head">
        <i class="bi bi-moon-stars" aria-hidden="true"></i>
        <span class="landing-layout__title">حالت روشن / تاریک</span>
      </span>
      <span class="landing-layout__swatches" role="group" aria-label="حالت تم">
        <button type="button" class="landing-chip${current.theme === 'light' ? ' is-active' : ''}" data-theme-option="light"><i class="bi bi-sun" aria-hidden="true"></i> روشن</button>
        <button type="button" class="landing-chip${current.theme === 'dark' ? ' is-active' : ''}" data-theme-option="dark"><i class="bi bi-moon-stars" aria-hidden="true"></i> تاریک</button>
        <button type="button" class="landing-chip${current.theme === 'system' ? ' is-active' : ''}" data-theme-option="system"><i class="bi bi-display" aria-hidden="true"></i> سیستم</button>
      </span>
      <span class="landing-layout__text">پالت تاریک برای همه کامپوننت‌ها و نمودارها طراحی شده، نه فقط وارونه‌سازی رنگ.</span>
    </article>`;
  const dirCard = `<article class="landing-layout landing-layout--static">
      <span class="landing-layout__head">
        <i class="bi bi-translate" aria-hidden="true"></i>
        <span class="landing-layout__title">سه زبان، جهت خودکار</span>
      </span>
      <span class="landing-layout__preview is-sidebar" aria-hidden="true"><i></i><i></i></span>
      <span class="landing-layout__text">فارسی و عربی راست‌چین، انگلیسی چپ‌چین؛ جهت همیشه از زبان پیروی می‌کند و هیچ ترکیب ناسازگاری ساخته نمی‌شود.</span>
    </article>`;
  const colorCard = `<article class="landing-layout landing-layout--static">
      <span class="landing-layout__head">
        <i class="bi bi-palette" aria-hidden="true"></i>
        <span class="landing-layout__title">شش رنگ اصلی</span>
      </span>
      <span class="landing-layout__swatches" role="group" aria-label="رنگ اصلی">
        ${palettes
          .map(
            ([name, hex]) =>
              `<button type="button" class="landing-swatch${current.primary === name ? ' is-active' : ''}" data-primary-option="${name}" style="--swatch:${hex}" aria-label="${name}" aria-pressed="${current.primary === name}"></button>`,
          )
          .join('')}
      </span>
      <span class="landing-layout__text">رنگ برند را انتخاب کنید؛ دکمه‌ها، نمودارها و نشان‌ها یکجا هماهنگ می‌شوند.</span>
    </article>`;
  return staticCards + themeCard + dirCard + colorCard;
}

async function landingAi() {
  const pages = [
    { url: 'ai/dashboard.html', icon: 'speedometer2', title: 'نمای کلی مصرف', text: 'توکن، هزینه و خطاها به تفکیک مدل.' },
    { url: 'ai/chat.html', icon: 'chat-dots', title: 'محاوره', text: 'جریان پاسخ، ابزارها و تاریخچه.' },
    { url: 'ai/playground.html', icon: 'braces-asterisk', title: 'ساخت پرامپت', text: 'متغیر، نمونه و تست زنده.' },
    { url: 'ai/prompts.html', icon: 'collection', title: 'کتابخانه پرامپت', text: 'جست‌وجو، برچسب و نسخه‌بندی.' },
    { url: 'ai/api-keys.html', icon: 'key', title: 'کلیدها', text: 'ساخت، چرخش و محدوده دسترسی.' },
    { url: 'ai/usage.html', icon: 'graph-up', title: 'قبض و مصرف', text: 'روند هزینه و پیش‌بینی ماه.' },
  ];
  return pages
    .map(
      (page) => `<a class="landing-ai-item" href="${escapeHtml(page.url)}">
        <i class="bi bi-${escapeHtml(page.icon)}" aria-hidden="true"></i>
        <strong>${escapeHtml(page.title)}</strong>
        <span>${escapeHtml(page.text)}</span>
      </a>`,
    )
    .join('');
}

async function landingAiStats() {
  const [usage, keys] = await Promise.all([services.usageService?.overview?.().catch(() => null), services.apiKeyService?.list?.().catch(() => null)]);
  const rows = [
    { label: 'توکن ۳۰ روز', value: usage ? formatNumber(usage.tokens ?? 0) : '—' },
    { label: 'کلید فعال', value: keys ? toDigits((keys.items ?? keys ?? []).length) : '—' },
  ];
  return `<div class="row g-3">${rows
    .map(
      (row) => `<div class="col-6"><div class="tile tile--soft"><span class="tile__label">${escapeHtml(row.label)}</span><strong class="tile__value">${escapeHtml(row.value)}</strong></div></div>`,
    )
    .join('')}</div>`;
}

async function landingTech() {
  const tech = await services.contentService.techStack();
  return (tech ?? [])
    .map(
      (item) => `<span class="landing-tech__item"><i class="bi bi-${escapeHtml(item.icon ?? 'box-seam')}" aria-hidden="true"></i>
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.note ?? item.version ?? '')}</small></span></span>`,
    )
    .join('');
}

async function landingSteps() {
  return STEPS.map(
    (step) => `<li class="landing-step">
      <h3 class="landing-step__title">${escapeHtml(step.title)}</h3>
      <p class="landing-step__text">${escapeHtml(step.text)}</p>
      <code class="landing-step__code">${escapeHtml(step.code)}</code>
      <button class="btn btn-sm btn-light landing-step__copy" type="button" data-copy="${escapeHtml(step.code)}" title="کپی"><i class="bi bi-clipboard" aria-hidden="true"></i></button>
    </li>`,
  ).join('');
}

async function landingRelease() {
  const changelog = await services.contentService.changelog?.().catch(() => []);
  const first = (changelog ?? [])[0];
  const items = RELEASE_HEADLINE.items.concat(first?.entries?.slice(0, 3) ?? []);
  return items.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
}

async function landingTestimonials() {
  const items = await services.contentService.testimonials();
  return (items ?? [])
    .slice(0, 6)
    .map(
      (item) => `<figure class="landing-quote">
        <span class="landing-quote__stars" aria-label="${toDigits(item.rating ?? 5)} از ۵ ستاره">${Array.from({ length: 5 }, (_, index) => `<i class="bi bi-star${index < (item.rating ?? 5) ? '-fill' : ''}" aria-hidden="true"></i>`).join('')}</span>
        <blockquote class="landing-quote__text">${escapeHtml(item.text ?? item.quote ?? '')}</blockquote>
        <figcaption class="landing-quote__who">
          ${item.avatar ? `<img class="landing-quote__avatar" src="${escapeHtml(item.avatar)}" alt="" width="38" height="38" loading="lazy" />` : '<span class="landing-quote__avatar" aria-hidden="true"></span>'}
          <span><span class="landing-quote__name">${escapeHtml(item.name)}</span><br /><span class="landing-quote__role">${escapeHtml(item.role ?? '')}</span></span>
        </figcaption>
      </figure>`,
    )
    .join('');
}

/**
 * `pricingPlans` keeps features as `{ text, included }` objects and the price as a
 * raw number in Toman. Every pricing surface — the landing cards, `system/pricing`
 * and the comparison table — reads the list through this, so an object never
 * reaches `escapeHtml()` (which printed "[object Object]") and all three views agree
 * on what an excluded feature means.
 */
function planView(plan) {
  const price = Number(plan?.price) || 0;
  const features = (plan?.features ?? plan?.items ?? []).map((feature) =>
    typeof feature === 'string'
      ? { text: feature, included: true }
      : { text: String(feature?.text ?? feature?.label ?? ''), included: feature?.included !== false },
  );
  return {
    ...plan,
    raw: plan,
    name: plan?.name ?? plan?.title ?? 'پلن',
    description: plan?.description ?? plan?.tagline ?? plan?.text ?? '',
    price,
    features,
    badge: plan?.badge ?? (plan?.featured ? 'پیشنهاد ما' : ''),
  };
}

async function landingPricing() {
  const plans = (await services.contentService.pricing()) ?? [];
  return plans
    .map((raw, index) => {
      const plan = planView(raw);
      /* `price: 0` means free, `price: null` means "ask us" — the two must not read
         the same way. */
      const custom = !(plan.price > 0) && plan.raw?.price == null;
      const amount = plan.price > 0 ? formatNumber(plan.price) : custom ? 'تماس بگیرید' : 'رایگان';
      const unit = plan.price > 0 ? 'تومان' : '';
      const period = plan.price > 0 ? plan.period || 'پرداخت یک‌باره' : custom ? 'قیمت‌گذاری اختصاصی' : 'برای همیشه';
      const icons = ['rocket-takeoff', 'person-workspace', 'briefcase', 'buildings'];
      return `<article class="landing-plan${plan.featured ? ' landing-plan--featured' : ''}">
        ${plan.badge ? `<span class="landing-plan__flag"><i class="bi bi-star-fill" aria-hidden="true"></i> ${escapeHtml(plan.badge)}</span>` : ''}
        <header class="landing-plan__head"><span class="landing-plan__icon"><i class="bi bi-${icons[index % icons.length]}" aria-hidden="true"></i></span><div><h3 class="landing-plan__name">${escapeHtml(plan.name)}</h3><p class="landing-plan__tagline">${escapeHtml(plan.description)}</p></div></header>
        <div class="landing-plan__price${custom ? ' landing-plan__price--text' : ''}"><span class="landing-plan__amount">${amount}</span>${unit ? `<span class="landing-plan__unit">${unit}</span>` : ''}</div>
        <p class="landing-plan__period"><i class="bi bi-clock-history" aria-hidden="true"></i> ${escapeHtml(period)}</p>
        <ul class="landing-plan__list">${plan.features
          .map(
            (feature) => `<li${feature.included ? '' : ' class="is-excluded"'}><i class="bi ${feature.included ? 'bi-check2' : 'bi-x-lg'}" aria-hidden="true"></i> ${escapeHtml(feature.text)}${
              feature.included ? '' : '<span class="visually-hidden"> — در این پلن نیست</span>'
            }</li>`,
          )
          .join('')}</ul>
        <a class="btn ${plan.featured ? 'btn-light' : 'btn-primary'}" href="auth/register.html">${escapeHtml(plan.cta ?? 'خرید و دانلود')}</a>
      </article>`;
    })
    .join('');
}

async function landingFaq() {
  const items = FAQ.map((item, index) => ({ ...item, open: index === 0 }));
  const groups = [...new Set(items.map((item) => item.group))];
  const chips = $('[data-faq-chips]');
  if (chips) {
    render(
      chips,
      [`<button class="landing-faq__chip is-active" type="button" data-faq-group="all" aria-pressed="true">همه</button>`]
        .concat(groups.map((group, index) => `<button class="landing-faq__chip" type="button" data-faq-group="${index}" aria-pressed="false">${escapeHtml(group)}</button>`))
        .join(''),
    );
  }
  return items
    .map(
      (item, index) => `<div class="accordion-item${item.open ? ' is-open' : ''}" data-faq-item data-group="${escapeHtml(String(groups.indexOf(item.group)))}" id="faq-${escapeHtml(item.id)}">
        <h3 class="accordion-header">
          <button class="accordion-button${item.open ? '' : ' collapsed'}" type="button" data-accordion-toggle aria-expanded="${item.open}" aria-controls="faq-${escapeHtml(item.id)}-body">
            <i class="bi bi-${escapeHtml(item.icon ?? 'question-circle')}" aria-hidden="true"></i>
            <span>${escapeHtml(item.question)}</span>
            <i class="bi bi-chevron-down" aria-hidden="true"></i>
          </button>
        </h3>
        <div class="accordion-body" id="faq-${escapeHtml(item.id)}-body" role="region" aria-labelledby="faq-${escapeHtml(item.id)}" data-accordion-body${item.open ? '' : ' hidden'}>
          <p>${escapeHtml(item.answer)}</p>
          ${(item.meta ?? []).length ? `<div class="accordion__tags">${item.meta.map((meta) => `<span class="accordion__tag">${escapeHtml(meta)}</span>`).join('')}</div>` : ''}
        </div>
      </div>`,
    )
    .join('');
}

async function landingCounters(node) {
  const counters = await services.contentService.counters().catch(() => []);
  const band = $$('[data-band-number]', node);
  if (counters?.length && band.length) {
    counters.slice(0, band.length).forEach((item, index) => {
      const el = band[index];
      if (!el) return;
      el.dataset.bandNumber = String(item.value ?? el.dataset.bandNumber);
      el.dataset.counter = String(Number(item.value) || 0);
      el.dataset.counterSuffix = String(item.suffix ?? '');
      $('.landing-stat__label', el.parentElement)?.replaceChildren(document.createTextNode(String(item.label ?? '')));
      $('.landing-stat__note', el.parentElement)?.replaceChildren(document.createTextNode(String(item.note ?? '')));
    });
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  $$('[data-counter]', node).forEach((counter) => {
    const target = Number(counter.dataset.counter ?? 0);
    const suffix = counter.dataset.counterSuffix ?? '';
    if (reduce || !target) {
      counter.textContent = `${formatNumber(target)}${suffix}`;
      return;
    }
    let current = 0;
    const step = Math.max(1, Math.round(target / 40));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      counter.textContent = `${formatNumber(current)}${target === 0 ? '' : suffix}`;
    }, 24);
  });
}

/**
 * FAQ interactions that the generic accordion does not cover: free-text search,
 * topic chips, open/close-all, the `.collapsed` class Bootstrap-style CSS keeps
 * and deep links such as `index.html#faq-license`.
 */
function initFaqControls(node) {
  const list = $('[data-landing-faq]', node);
  if (!list || list.dataset.wired === '1') return;
  list.dataset.wired = '1';

  const items = () => $$('[data-faq-item]', list);
  const setOpen = (item, open) => {
    item.classList.toggle('is-open', open);
    const button = $('.accordion-button', item);
    const body = $('[data-accordion-body]', item);
    button?.classList.toggle('collapsed', !open);
    button?.setAttribute('aria-expanded', String(open));
    if (body) body.hidden = !open;
  };

  const search = $('[data-faq-search]', node);
  const empty = $('[data-faq-empty]', node);
  const apply = () => {
    const term = (search?.value ?? '').trim().toLowerCase();
    const group = $('.landing-faq__chip.is-active')?.dataset.faqGroup ?? 'all';
    let visible = 0;
    items().forEach((item) => {
      const matchesText = !term || item.textContent.toLowerCase().includes(term);
      const matchesGroup = group === 'all' || item.dataset.group === group;
      const show = matchesText && matchesGroup;
      item.hidden = !show;
      if (show) visible += 1;
      if (show && term) setOpen(item, true);
      if (!show) setOpen(item, false);
    });
    if (empty) empty.hidden = visible > 0;
  };
  if (search) on(search, 'input', debounce(apply, 120));

  on(node, 'click', (event) => {
    const chip = event.target.closest('[data-faq-group]');
    if (chip) {
      event.preventDefault();
      $$('[data-faq-group]', node).forEach((other) => {
        const active = other === chip;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      apply();
      return;
    }
    if (event.target.closest('[data-faq-reset]')) {
      if (search) search.value = '';
      $$('[data-faq-group]', node).forEach((other, index) => {
        other.classList.toggle('is-active', index === 0);
        other.setAttribute('aria-pressed', String(index === 0));
      });
      apply();
      return;
    }
    const toggleAll = event.target.closest('[data-faq-expand]');
    if (toggleAll) {
      const open = toggleAll.dataset.faqExpand !== 'true';
      toggleAll.dataset.faqExpand = String(open);
      toggleAll.innerHTML = open ? 'بستن همه' : 'باز کردن همه';
      items().forEach((item) => !item.hidden && setOpen(item, open));
    }
  });

  /* A single question per click when the list is not being searched. */
  on(list, 'click', (event) => {
    const button = event.target.closest('[data-accordion-toggle]');
    if (!button || (search?.value ?? '').trim()) return;
    const item = button.closest('[data-faq-item]');
    const willOpen = !item.classList.contains('is-open');
    items().forEach((other) => other !== item && setOpen(other, false));
    setOpen(item, willOpen);
  });

  const hash = window.location.hash?.replace('#', '');
  if (hash?.startsWith('faq-')) {
    const target = $(`#${hash}`, node);
    if (target) {
      setOpen(target, true);
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220);
    }
  }
}

/**
 * The stats band under the quick-start steps keeps its authored value but
 * re-renders the digits for the active language (۲۰۶ / 206 / ٢٠٦). Exported so
 * the language switch can refresh it without re-rendering the whole page.
 */
export function refreshLandingNumbers(root = document) {
  $$('[data-band-number]', root).forEach((item) => {
    const raw = item.dataset.bandNumber ?? item.textContent;
    const match = String(raw).match(/^([\d۰-۹]+)(.*)$/);
    if (!match) return;
    item.textContent = `${formatNumber(match[1])}${match[2]}`;
  });
}

/* ============================================================== search page */

export async function initSearchResults() {
  const node = host();
  const term = kit.queryParam('q');
  const tabsList = await Promise.all(['همه', 'صفحات', 'کاربران', 'محصولات', 'سفارش‌ها'].map((label) => Promise.resolve(label)));
  const results = term ? await searchService.search(term, { limit: 40 }) : { items: [], total: 0 };
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'جستجوی سراسری', subtitle: term ? `نتایج برای «${term}» — ${toDigits(results.total)} مورد` : 'عبارت مورد نظر را جستجو کنید', icon: 'search' })}
      <form class="search-overlay__head" style="position:static;border:1px solid var(--nv-border);border-radius:var(--nv-radius-lg)" data-search-form>
        <i class="bi bi-search"></i>
        <input class="form-control" type="search" name="q" value="${escapeHtml(term)}" placeholder="جستجو در صفحات، ماژول‌ها و اسناد…" aria-label="جستجو">
        <button class="btn btn-primary" type="submit">جستجو</button>
      </form>
      <div class="segmented">${tabsList.map((label, index) => `<button class="segmented__item ${index === 0 ? 'is-active' : ''}" type="button" data-search-tab="${label}">${label}</button>`).join('')}</div>
      <div class="search-results" data-search-results>${results.items
        .map(
          (item) => `<article class="search-result"><header class="search-result__head"><span class="badge badge--soft-primary">${escapeHtml(item.section ?? 'صفحه')}</span><a class="search-result__title" href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></header>
            <p class="search-result__text">${escapeHtml(item.description ?? '')}</p>
            <footer class="list-item__meta"><a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a></footer></article>`,
        )
        .join('') || (term ? emptyState({ title: 'نتیجه‌ای یافت نشد', text: 'املا را بررسی کنید یا کلیدواژه دیگری بنویسید.', icon: 'search' }) : browseAllMarkup())}</div>
      ${term ? '' : `<p class="dash-status">${toDigits(navigationCount)} صفحه در ${toDigits(navigationSections.length)} بخش — برای پرش سریع Ctrl + K را بزنید.</p>`}
    </div>`,
  );

  on($('[data-search-form]', node), 'submit', (event) => {
    event.preventDefault();
    const value = $('input[name="q"]', node)?.value?.trim();
    if (value) goTo(`search.html?q=${encodeURIComponent(value)}`);
  });
  on(node, 'click', (event) => {
    const chip = event.target.closest('[data-browse-section]');
    if (!chip) return;
    const section = chip.dataset.browseSection;
    const list = $('[data-search-results]', node);
    if (list) {
      paint(
        list,
        navigation
          .filter((entry) => entry.section === section)
          .slice(0, 60)
          .map(
            (entry) => `<article class="search-result"><header class="search-result__head"><span class="badge badge--soft-neutral">${escapeHtml(entry.kind)}</span><a class="search-result__title" href="${escapeHtml(entry.url)}">${escapeHtml(entry.title.fa)}</a></header>
              <footer class="list-item__meta"><span>${escapeHtml(sectionLabel(entry.section))}</span><a href="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</a></footer></article>`,
          )
          .join('') || emptyState({ title: 'صفحه‌ای در این بخش نیست', icon: 'inbox' }),
      );
    }
    $$('[data-browse-section]', node).forEach((item) => item.classList.toggle('is-active', item === chip));
  });
}

/** Human labels for the generated section ids (Persian-first). */
function sectionLabel(id) {
  return (
    {
      main: 'داشبوردها',
      applications: 'اپلیکیشن‌ها',
      'users-access': 'کاربران و دسترسی',
      'reports-content': 'گزارش‌ها و محتوا',
      'account-settings': 'حساب کاربری و تنظیمات',
      developers: 'توسعه‌دهندگان و اسناد',
      app: 'صفحات عمومی',
      docs: 'مستندات',
    }[id] ?? id
  );
}

/** Empty-state of the search page: browse every shipped page by section. */
function browseAllMarkup() {
  const groups = navigationSections.map((section) => ({
    section,
    pages: navigation.filter((entry) => entry.section === section),
  }));
  return `<section class="browse-sections">
    <header class="browse-sections__head"><h2>مرور همه صفحات</h2><p>${toDigits(navigation.length)} صفحه آماده در این نسخه — یک بخش را انتخاب کنید.</p></header>
    <div class="segmented segmented--wrap">${groups
      .map((group) => `<button type="button" class="segmented__item" data-browse-section="${group.section}">${sectionLabel(group.section)} <span class="badge badge--soft-neutral">${toDigits(group.pages.length)}</span></button>`)
      .join('')}</div>
    <div class="browse-sections__grid">${groups
      .map(
        (group) => `<article class="card"><header class="card__head"><h3 class="card__title">${sectionLabel(group.section)}</h3></header>
          <div class="card__body"><ul class="list-group list-group--flush">${group.pages
            .slice(0, 8)
            .map(
              (entry) => `<li class="list-group__item list-item list-item--interactive"><a class="list-item__body" href="${entry.url}"><span class="list-item__title">${escapeHtml(entry.title.fa)}</span><small class="list-item__sub">${escapeHtml(entry.url)}</small></a><i class="bi bi-chevron-${document.documentElement.dir === 'rtl' ? 'left' : 'right'}"></i></li>`,
            )
            .join('')}</ul>${group.pages.length > 8 ? `<p class="text-muted mt-3">و ${toDigits(group.pages.length - 8)} صفحه دیگر…</p>` : ''}</div></article>`,
      )
      .join('')}</div>
  </section>`;
}

/* ==================================================================== docs */

export async function initDocs() {
  const node = $('[data-docs-content]') ?? host();
  if (!node) return;
  node.dataset.appClaimed = '1';
  const page = kit.pageId();
  const nav = await services.docsService.nav('fa');
  const info = await services.docsService.page(page);

  // Add reading progress indicator at top of docs
  if (!$('#docs-reading-progress')) {
    document.body.insertAdjacentHTML('afterbegin', '<div id="docs-reading-progress" style="position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--nv-primary),#8b5cf6);z-index:9999;width:0%;transition:width 0.1s;"></div>');
    window.addEventListener('scroll', () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0) {
        const p = Math.min(100, Math.max(0, (window.scrollY / h) * 100));
        const bar = document.getElementById('docs-reading-progress');
        if (bar) bar.style.width = `${p}%`;
      }
    }, { passive: true });
  }

  const navHost = $('[data-docs-nav]');
  if (navHost && nav?.length) {
    render(
      navHost,
      nav
        .map(
          (group) => `<div class="docs-nav__group mb-3"><p class="docs-nav__label" style="font-weight:800; font-size:12px; color:var(--nv-heading); text-transform:uppercase; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i class="bi bi-folder-fill text-primary"></i> ${escapeHtml(group.title)}</p><ul class="list-group" style="gap:3px;">${group.items
            .map((item) => `<li><a class="files-nav__link ${item.url === page ? 'is-active' : ''}" href="${escapeHtml(item.url)}" style="border-radius:8px; padding:6px 12px; font-size:12px; display:flex; align-items:center; gap:8px;"><i class="bi bi-file-earmark-text${item.url === page ? '-fill text-primary' : ''}"></i><span>${escapeHtml(item.title)}</span></a></li>`)
            .join('')}</ul></div>`,
        )
        .join(''),
    );
  }
  const search = $('[data-docs-search]');
  if (search) {
    on(
      search,
      'input',
      debounce(async (event) => {
        const term = event.target.value.trim();
        if (!term) {
          if (navHost && nav?.length) {
            render(
              navHost,
              nav
                .map(
                  (group) => `<div class="docs-nav__group mb-3"><p class="docs-nav__label" style="font-weight:800; font-size:12px; color:var(--nv-heading); text-transform:uppercase; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i class="bi bi-folder-fill text-primary"></i> ${escapeHtml(group.title)}</p><ul class="list-group" style="gap:3px;">${group.items
                    .map((item) => `<li><a class="files-nav__link ${item.url === page ? 'is-active' : ''}" href="${escapeHtml(item.url)}" style="border-radius:8px; padding:6px 12px; font-size:12px; display:flex; align-items:center; gap:8px;"><i class="bi bi-file-earmark-text${item.url === page ? '-fill text-primary' : ''}"></i><span>${escapeHtml(item.title)}</span></a></li>`)
                    .join('')}</ul></div>`,
                )
                .join(''),
            );
          }
          return;
        }
        const found = await searchService.search(term, { limit: 10 });
        render(
          navHost,
          `<p class="docs-nav__label" style="font-weight:800; font-size:12px; color:var(--nv-primary); margin-bottom:8px;">نتایج جستجو (${toDigits(found.items.length)})</p><ul class="list-group" style="gap:4px;">${found.items
            .map((item) => `<li><a class="files-nav__link" href="${escapeHtml(item.url)}" style="border-radius:8px; padding:6px 10px; font-size:12px;"><i class="bi bi-search text-primary"></i><span>${escapeHtml(item.title)}</span></a></li>`)
            .join('') || '<li class="list-item text-muted" style="font-size:12px; padding:8px;">نتیجه‌ای یافت نشد</li>'}</ul>`,
        );
      }, 220),
    );
  }

  const toc = $('[data-docs-toc]');
  if (toc) {
    toc.innerHTML = '<div style="font-size:12px; font-weight:800; margin-bottom:10px; color:var(--nv-heading);"><i class="bi bi-list-nested me-1"></i> سرفصل‌های این صفحه</div>';
    $$('h2, h3', node).forEach((heading) => {
      heading.id = heading.id || heading.textContent.trim().replace(/\s+/g, '-').slice(0, 40);
      toc.insertAdjacentHTML('beforeend', `<a class="docs-toc__link ${heading.tagName === 'H3' ? 'is-sub' : ''}" href="#${heading.id}" style="display:block; font-size:12px; padding:${heading.tagName==='H3'?'3px 14px 3px 0':'4px 0'}; color:var(--nv-text-muted);">${escapeHtml(heading.textContent.trim())}</a>`);
    });
  }

  const pager = $('[data-docs-pager]');
  if (pager) {
    render(
      pager,
      `<div class="docs-pager" style="display:flex; justify-content:space-between; align-items:center; margin-top:40px; padding-top:20px; border-top:1px solid var(--nv-border);">
        ${info?.prev ? `<a class="btn btn-light btn-sm" href="${escapeHtml(info.prev)}"><i class="bi bi-arrow-right"></i> بخش قبلی</a>` : '<span></span>'}
        ${info?.next ? `<a class="btn btn-primary btn-sm" href="${escapeHtml(info.next)}">بخش بعدی <i class="bi bi-arrow-left"></i></a>` : '<span></span>'}
      </div>`,
    );
  }

  $$('[data-copy]').forEach((button) =>
    on(button, 'click', async () => {
      const pre = button.closest('.code-block')?.querySelector('code') || button.parentElement?.querySelector('code');
      if (!pre) return;
      await navigator.clipboard?.writeText(pre.textContent).catch(()=>null);
      button.innerHTML = '<i class="bi bi-check2 text-success"></i> کپی شد';
      setTimeout(() => { button.innerHTML = '<i class="bi bi-copy"></i> کپی'; }, 2000);
      toast.success('کد کپی شد', 'نمونه کد در حافظه موقت قرار گرفت.');
    }),
  );
}

/* ================================================================ settings */

export async function initSettings() {
  const node = host();
  const all = await services.settingsService.get();
  const section = kit.pageId().split('/').pop().replace('.html', '');
  /* `get()` is grouped per settings section; a page shows its own slice. */
  const values = { ...(all?.[section] ?? {}), ...(all?.general ?? {}), ...(all?.features ?? {}) };

  const settingsNav = [
    { id: 'general', label: 'عمومی', icon: 'gear' },
    { id: 'appearance', label: 'ظاهر و تم', icon: 'palette2' },
    { id: 'layout', label: 'چیدمان', icon: 'layout-split' },
    { id: 'system', label: 'سیستم', icon: 'cpu' },
    { id: 'billing', label: 'صورتحساب و پلن', icon: 'credit-card-2-front' },
    { id: 'security', label: 'امنیت', icon: 'shield-check' },
    { id: 'notifications', label: 'اعلان‌ها', icon: 'bell' },
    { id: 'localization', label: 'بومی‌سازی', icon: 'translate' },
    { id: 'api', label: 'API', icon: 'plug' },
  ];

  const navHtml = `
    <div class="mb-4" style="overflow-x:auto; padding-bottom:4px;">
      <div class="nav nav-pills flex-nowrap" style="gap:8px;">
        ${settingsNav.map(n => `
          <a class="nav-link ${n.id === section ? 'active' : ''}" href="settings/${n.id}.html" style="white-space:nowrap; border-radius:12px; font-weight:700; font-size:13px; padding:8px 16px;">
            <i class="bi bi-${n.icon} me-1"></i> ${n.label}
          </a>
        `).join('')}
      </div>
    </div>
  `;

  // Bespoke view for Appearance
  if (section === 'appearance') {
    const curTheme = theme.get('theme') || 'light';
    const curPrimary = theme.get('primary') || 'indigo';
    const curFont = theme.get('fontSize') || 'md';
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'تنظیمات ظاهر و تم',
          subtitle: 'شخصی‌سازی حالت روز/شب، رنگ‌های برند و سبک نمایش داشبورد',
          icon: 'palette2',
          actions: '<button class="btn btn-primary" type="button" data-save-settings><i class="bi bi-check2"></i> ذخیره تغییرات</button>',
        })}
        ${navHtml}

        <div class="grid grid--2 mb-4" style="gap:20px;">
          <div class="card" style="border-radius:18px;">
            <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">حالت پوسته (Theme Mode)</h3>
            </div>
            <div class="card__body" style="padding:20px;">
              <div class="grid grid--3" style="gap:12px;">
                <div class="theme-choice-card ${curTheme==='light'?'is-active':''}" data-set-theme="light" style="cursor:pointer; border:2px solid ${curTheme==='light'?'var(--nv-primary)':'var(--nv-border)'}; border-radius:14px; padding:16px 14px; text-align:center; background:var(--nv-surface-2); color:var(--nv-heading); transition:all 0.2s;">
                  <div style="width:48px; height:32px; border-radius:8px; margin:0 auto; display:flex; align-items:center; justify-content:center; background:#ffffff; border:1px solid #e2e8f0; box-shadow:var(--nv-shadow-xs);">
                    <i class="bi bi-sun-fill" style="font-size:16px; color:#f59e0b;"></i>
                  </div>
                  <div style="font-weight:800; font-size:13px; margin-top:10px; color:var(--nv-heading);">روشن (Light)</div>
                  <small style="font-size:10px; color:var(--nv-text-muted);">پوسته سفید و درخشان</small>
                </div>
                <div class="theme-choice-card ${curTheme==='dark'?'is-active':''}" data-set-theme="dark" style="cursor:pointer; border:2px solid ${curTheme==='dark'?'var(--nv-primary)':'var(--nv-border)'}; border-radius:14px; padding:16px 14px; text-align:center; background:var(--nv-surface-2); color:var(--nv-heading); transition:all 0.2s;">
                  <div style="width:48px; height:32px; border-radius:8px; margin:0 auto; display:flex; align-items:center; justify-content:center; background:#0f172a; border:1px solid #334155; box-shadow:var(--nv-shadow-xs);">
                    <i class="bi bi-moon-stars-fill" style="font-size:16px; color:#818cf8;"></i>
                  </div>
                  <div style="font-weight:800; font-size:13px; margin-top:10px; color:var(--nv-heading);">تیره (Dark)</div>
                  <small style="font-size:10px; color:var(--nv-text-muted);">حالت شب و کاهش خستگی چشم</small>
                </div>
                <div class="theme-choice-card ${curTheme==='system'?'is-active':''}" data-set-theme="system" style="cursor:pointer; border:2px solid ${curTheme==='system'?'var(--nv-primary)':'var(--nv-border)'}; border-radius:14px; padding:16px 14px; text-align:center; background:var(--nv-surface-2); color:var(--nv-heading); transition:all 0.2s;">
                  <div style="width:48px; height:32px; border-radius:8px; margin:0 auto; overflow:hidden; display:flex; border:1px solid var(--nv-border); box-shadow:var(--nv-shadow-xs);">
                    <div style="flex:1; background:#ffffff; display:flex; align-items:center; justify-content:center;"><i class="bi bi-sun-fill" style="font-size:12px; color:#f59e0b;"></i></div>
                    <div style="flex:1; background:#0f172a; display:flex; align-items:center; justify-content:center;"><i class="bi bi-moon-stars-fill" style="font-size:12px; color:#818cf8;"></i></div>
                  </div>
                  <div style="font-weight:800; font-size:13px; margin-top:10px; color:var(--nv-heading);">سیستم (خودکار)</div>
                  <small style="font-size:10px; color:var(--nv-text-muted);">هماهنگ با سیستم‌عامل کاربر</small>
                </div>
              </div>
            </div>
          </div>

          <div class="card" style="border-radius:18px;">
            <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">رنگ سازمانی و تأکیدی (Brand Accent)</h3>
            </div>
            <div class="card__body" style="padding:20px;">
              <div style="display:flex; flex-wrap:wrap; gap:12px;">
                ${[
                  { id: 'indigo', name: 'نیلی (Indigo)', color: '#6366f1' },
                  { id: 'blue', name: 'آبی (Ocean Blue)', color: '#3b82f6' },
                  { id: 'emerald', name: 'زمردی (Emerald)', color: '#10b981' },
                  { id: 'violet', name: 'بنفش (Violet)', color: '#8b5cf6' },
                  { id: 'rose', name: 'رز (Rose)', color: '#f43f5e' },
                  { id: 'orange', name: 'نارنجی (Amber)', color: '#f59e0b' },
                ].map(p => `
                  <div data-set-primary="${p.id}" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:8px 14px; border-radius:12px; border:2px solid ${curPrimary===p.id?'var(--nv-primary)':'var(--nv-border)'}; background:var(--nv-surface-2);">
                    <span style="width:18px; height:18px; border-radius:50%; background:${p.color};"></span>
                    <span style="font-size:12px; font-weight:700;">${p.name}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
            <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">اندازه فونت</h3>
          </div>
          <div class="card__body" style="padding:20px;">
            <div class="grid grid--2" style="gap:20px;">
              <div>
                <label class="form-label">مقیاس فونت رابط کاربری</label>
                <select class="form-select" data-setting-fontsize>
                  <option value="sm"${curFont === 'sm' ? ' selected' : ''}>کوچک (13px)</option>
                  <option value="md"${curFont === 'md' ? ' selected' : ''}>استاندارد (14px - پیشنهادی)</option>
                  <option value="lg"${curFont === 'lg' ? ' selected' : ''}>بزرگ (15px)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>`,
    );

    on(node, 'click', (e) => {
      const themeBtn = e.target.closest('[data-set-theme]');
      if (themeBtn) {
        const t = themeBtn.dataset.setTheme;
        theme.set('theme', t);
        toast.success('تم تغییر کرد', { light: 'حالت روشن فعال شد.', dark: 'حالت تاریک فعال شد.', system: 'تم از تنظیمات سیستم پیروی می‌کند.' }[t] ?? '');
        $$('.theme-choice-card', node).forEach(c => c.style.borderColor = 'var(--nv-border)');
        themeBtn.style.borderColor = 'var(--nv-primary)';
      }
      const primaryBtn = e.target.closest('[data-set-primary]');
      if (primaryBtn) {
        const p = primaryBtn.dataset.setPrimary;
        theme.set('primary', p);
        toast.success('رنگ اصلی تغییر کرد', 'رنگ برند در همه صفحه‌ها اعمال شد.');
        $$('[data-set-primary]', node).forEach((chip) => {
          chip.style.borderColor = chip === primaryBtn ? 'var(--nv-primary)' : 'var(--nv-border)';
        });
      }
      if (e.target.closest('[data-save-settings]')) {
        toast.success('تنظیمات ظاهر ذخیره شد', 'تغییرات به‌صورت خودکار ذخیره می‌شوند.');
      }
    });
    on($('[data-setting-fontsize]', node), 'change', (e) => {
      theme.set('fontSize', e.target.value);
      toast.success('اندازه فونت تغییر کرد');
    });
    return;
  }

  // Bespoke view for Layout
  if (section === 'layout') {
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'تنظیمات چیدمان و سایدبار',
          subtitle: 'پیکربندی ساختار بدنه، سبک منوها و رفتار هدر داشبورد',
          icon: 'layout-split',
          actions: '<button class="btn btn-primary" type="button" data-save-settings><i class="bi bi-check2"></i> ذخیره تغییرات</button>',
        })}
        ${navHtml}

        <div class="card mb-4" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
            <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">ساختار پنل</h3>
          </div>
          <div class="card__body" style="padding:20px;">
            <p style="margin:0 0 16px; font-size:13px; color:var(--nv-text-muted); line-height:1.9;">پنل از یک ساختار پایدار و تست‌شده استفاده می‌کند: سایدبار کناری در دسکتاپ، کشوی لمسی زیر ۹۹۲ پیکسل و جهت صفحه که خودکار از زبان پیروی می‌کند (فارسی و عربی راست‌چین، انگلیسی چپ‌چین).</p>
            <div class="grid grid--2" style="gap:24px;">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="sidebar-rail" data-setting-rail ${document.documentElement.classList.contains('sidebar-collapsed') ? 'checked' : ''}>
                <label class="form-check-label" for="sidebar-rail" style="font-size:13px; font-weight:700;">سایدبار جمع‌شده (ریل آیکن)</label>
                <div style="font-size:11px; color:var(--nv-text-muted); margin-top:2px;">فقط آیکن منوها نمایش داده می‌شود؛ با Ctrl + B یا دکمه هدر هم قابل تغییر است. (در دسکتاپ)</div>
              </div>
              <div>
                <label class="form-label" for="setting-language">زبان رابط کاربری</label>
                <select class="form-select" id="setting-language" data-setting-language>
                  <option value="fa"${document.documentElement.lang === 'fa' ? ' selected' : ''}>فارسی (راست‌چین)</option>
                  <option value="en"${document.documentElement.lang === 'en' ? ' selected' : ''}>English (LTR)</option>
                  <option value="ar"${document.documentElement.lang === 'ar' ? ' selected' : ''}>العربية (راست‌چین)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>`,
    );

    on($('[data-setting-rail]', node), 'change', (e) => {
      const want = e.target.checked;
      if (document.documentElement.classList.contains('sidebar-collapsed') !== want) {
        document.querySelector('[data-sidebar-collapse]')?.click();
      }
      toast.success(want ? 'سایدبار جمع شد' : 'سایدبار باز شد');
    });
    on($('[data-setting-language]', node), 'change', (e) => setLanguage(e.target.value));
    on(node, 'click', (e) => {
      if (e.target.closest('[data-save-settings]')) {
        toast.success('تنظیمات ذخیره شد', 'تغییرات به‌صورت خودکار ذخیره می‌شوند.');
      }
    });
    return;
  }

  // Bespoke view for General
  if (section === 'general') {
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'تنظیمات عمومی پلتفرم',
          subtitle: 'نام تجاری، لوگو، زمان پیش‌فرض و هویت سازمانی داشبورد',
          icon: 'gear-fill',
          actions: '<button class="btn btn-primary" type="button" data-save-settings><i class="bi bi-check2"></i> ذخیره تنظیمات عمومی</button>',
        })}
        ${navHtml}

        <div class="grid grid--3 mb-4" style="gap:20px;">
          <div class="card" style="border-radius:18px; grid-column: span 1;">
            <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">لوگو و نماد تجاری</h3>
            </div>
            <div class="card__body" style="padding:20px; text-align:center;">
              <div style="width:96px; height:96px; border-radius:20px; background:var(--nv-surface-2); border:2px dashed var(--nv-border); display:grid; place-items:center; margin:0 auto 16px;">
                <img src="assets/logo-mark.svg" style="width:48px; height:48px;" alt="Logo">
              </div>
              <label class="btn btn-sm btn-light">
                <i class="bi bi-upload"></i> بارگذاری لوگوی جدید
                <input type="file" hidden accept="image/*">
              </label>
              <div style="font-size:11px; color:var(--nv-text-muted); margin-top:8px;">فرمت‌های SVG, PNG یا WebP تا حجم ۱ مگابایت</div>
            </div>
          </div>

          <div class="card" style="border-radius:18px; grid-column: 1 / -1;">
            <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">مشخصات اصلی سامانه</h3>
            </div>
            <div class="card__body" style="padding:20px;">
              <form class="form-stack">
                <div class="grid grid--2" style="gap:16px;">
                  <div class="form-field"><label class="form-label">نام سامانه (Title) *</label><input class="form-control" value="نواادمین — پنل مدیریت هوشمند"></div>
                  <div class="form-field"><label class="form-label">ایمیل پشتیبانی عمومی</label><input class="form-control" value="support@novaadmin.dev" dir="ltr"></div>
                  <div class="form-field"><label class="form-label">منطقه زمانی پیش‌فرض</label><select class="form-select"><option selected>تهران (GMT+3:30)</option><option>استانبول (GMT+3:00)</option><option>دبی (GMT+4:00)</option></select></div>
                  <div class="form-field"><label class="form-label">قالب نمایش تاریخ</label><select class="form-select"><option selected>۱۴۰۳/۰۷/۰۴ (شمسی رسمی)</option><option>۴ مهر ۱۴۰۳</option><option>2026-09-26 (میلادی)</option></select></div>
                </div>
                <div class="form-field mt-3"><label class="form-label">توضیحات متای پلتفرم</label><textarea class="form-control" rows="2">جامع‌ترین و سریع‌ترین سیستم طراحی و داشبورد مدیریتی سازمانی با پشتیبانی کامل از زبان فارسی و تقویم جلالی.</textarea></div>
              </form>
            </div>
          </div>
        </div>
      </div>`,
    );

    on(node, 'click', (e) => {
      if (e.target.closest('[data-save-settings]')) {
        toast.success('تنظیمات عمومی با موفقیت ذخیره شد');
      }
    });
    return;
  }

  // Bespoke view for System
  if (section === 'system') {
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'وضعیت و تنظیمات پیشرفته سیستم',
          subtitle: 'پایش سلامت سرورها، کش، نگهداری دوره‌ای و نسخه‌های نرم‌افزاری',
          icon: 'cpu-fill',
          actions: '<button class="btn btn-outline-danger btn-sm" type="button" data-clear-cache><i class="bi bi-trash3"></i> پاک‌سازی حافظه کش</button>',
        })}
        ${navHtml}

        <div class="grid grid--4 mb-4" style="gap:16px;">
          ${statCard({ label: 'وضعیت سلامت سرور', value: '۱۰۰٪ پایدار', hint: 'آپ‌تایم: ۹۹٫۹۸٪ در سال جاری', tone: 'success', icon: 'activity' })}
          ${statCard({ label: 'مصرف حافظه RAM', value: '۱٫۲ / ۴ GB', hint: '۲۸٪ مصرف شده (نرمال)', tone: 'info', icon: 'memory' })}
          ${statCard({ label: 'پایگاه داده', value: 'PostgreSQL 16', hint: 'اتصال فعال و همگام', tone: 'primary', icon: 'database' })}
          ${statCard({ label: 'نسخه پلتفرم', value: `v${config.version} Pro`, hint: 'آخرین پچ امنیتی نصب است', tone: 'warning', icon: 'patch-check' })}
        </div>

        <div class="grid grid--2 mb-4" style="gap:20px;">
          <div class="card" style="border-radius:18px;">
            <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">حالت‌های اجرایی و محیط</h3>
            </div>
            <div class="card__body" style="padding:20px;">
              <div class="form-stack" style="gap:16px;">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="maint-mode">
                  <label class="form-check-label" for="maint-mode" style="font-weight:700; font-size:13px;">حالت تعمیرات و نگهداری (Maintenance Mode)</label>
                  <p style="font-size:11px; color:var(--nv-text-muted); margin:2px 0 0;">در صورت فعال‌سازی، فقط مدیران ارشد به سامانه دسترسی خواهند داشت.</p>
                </div>
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="debug-mode">
                  <label class="form-check-label" for="debug-mode" style="font-weight:700; font-size:13px;">حالت اشکال‌زدایی (Debug Mode)</label>
                  <p style="font-size:11px; color:var(--nv-text-muted); margin:2px 0 0;">لاگ‌های تفصیلی در کنسول و پاسخ‌های API برای خطایابی نمایش داده می‌شوند.</p>
                </div>
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="auto-backup" checked>
                  <label class="form-check-label" for="auto-backup" style="font-weight:700; font-size:13px;">پشتیبان‌گیری خودکار روزانه ابری</label>
                  <p style="font-size:11px; color:var(--nv-text-muted); margin:2px 0 0;">هر بامداد ساعت ۰۳:۰۰ نسخه پشتیبان رمزنگاری‌شده تهیه می‌شود.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="card" style="border-radius:18px;">
            <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">عملیات نگهداری فوری</h3>
            </div>
            <div class="card__body" style="padding:20px; display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:12px; background:var(--nv-surface-2);">
                <div>
                  <strong style="font-size:13px;">پشتیبان‌گیری اضطراری</strong>
                  <div style="font-size:11px; color:var(--nv-text-muted);">ذخیره آنی پایگاه داده و فایل‌ها در فضای S3</div>
                </div>
                <button class="btn btn-sm btn-primary" type="button" data-instant-backup><i class="bi bi-cloud-arrow-down"></i> شروع بک‌آپ</button>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:12px; background:var(--nv-surface-2);">
                <div>
                  <strong style="font-size:13px;">بهینه‌سازی شاخص‌های دیتابیس</strong>
                  <div style="font-size:11px; color:var(--nv-text-muted);">اجرای VACUUM و Reindex روی جدول‌ها</div>
                </div>
                <button class="btn btn-sm btn-light" type="button" data-opt-db><i class="bi bi-speedometer2"></i> بهینه‌سازی</button>
              </div>
            </div>
          </div>
        </div>
      </div>`,
    );

    on(node, 'click', (e) => {
      if (e.target.closest('[data-clear-cache]')) {
        toast.success('حافظه کش با موفقیت پاک شد');
      }
      if (e.target.closest('[data-instant-backup]')) {
        toast.info('پشتیبان‌گیری آغاز شد', 'فایل ZIP پس از آماده‌سازی ایمیل خواهد شد.');
      }
      if (e.target.closest('[data-opt-db]')) {
        toast.success('دیتابیس بهینه‌سازی شد', 'شاخص‌های جدول‌ها بازسازی گردید.');
      }
    });
    return;
  }

  // Bespoke view for Billing
  if (section === 'billing') {
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'اشتراک، پلن و صورتحساب‌ها',
          subtitle: 'مدیریت طرح تجاری، سقف کاربران، فاکتورهای مالی و درگاه پرداخت',
          icon: 'credit-card-2-front-fill',
          actions: '<button class="btn btn-primary" type="button" data-upgrade-plan><i class="bi bi-star"></i> ارتقای پلن به VIP</button>',
        })}
        ${navHtml}

        <div class="card mb-4" style="border-radius:20px; overflow:hidden; border:2px solid var(--nv-primary); background:linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%);">
          <div class="card__body" style="padding:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge badge--soft-primary" style="font-size:12px; padding:6px 12px; border-radius:999px;">طرح فعال</span>
                <h2 style="margin:0; font-size:22px; font-weight:900; color:var(--nv-heading);">پلن سازمانی نامحدود (Enterprise Pro)</h2>
              </div>
              <p style="margin:8px 0 0; font-size:13px; color:var(--nv-text-muted);">تمدید سالانه خودکار • موعد تمدید بعدی: <strong>۱۵ اسفند ۱۴۰۳</strong></p>
            </div>
            <div style="text-align:end;">
              <div style="font-size:24px; font-weight:900; color:var(--nv-primary);">۴۵,۰۰۰,۰۰۰ <span style="font-size:14px; font-weight:400; color:var(--nv-text-muted);">تومان / سالانه</span></div>
              <span class="badge badge--soft-success" style="margin-top:4px;"><i class="bi bi-shield-check"></i> پرداخت موفق</span>
            </div>
          </div>
          <div style="padding:16px 24px; background:var(--nv-surface); border-top:1px solid var(--nv-border); display:flex; gap:32px; flex-wrap:wrap;">
            <div><span style="font-size:11px; color:var(--nv-text-muted);">کاربران مجاز:</span> <strong style="font-size:13px;">۲۴ / ۱۰۰ کاربر</strong></div>
            <div><span style="font-size:11px; color:var(--nv-text-muted);">فضای ذخیره‌سازی ابری:</span> <strong style="font-size:13px;">۴۵ / ۱۰۰ گیگابایت</strong></div>
            <div><span style="font-size:11px; color:var(--nv-text-muted);">درخواست‌های API ماهانه:</span> <strong style="font-size:13px;">۴۲۰k / ۱,۰۰۰k</strong></div>
          </div>
        </div>

        <div class="card" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border); display:flex; justify-content:space-between; align-items:center;">
            <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">تاریخچه فاکتورهای دوره‌ای</h3>
            <span class="badge badge--soft-primary">۴ فاکتور صادر شده</span>
          </div>
          <div class="card__body" style="padding:0;">
            <div class="table-responsive">
              <table class="table table--hover">
                <thead>
                  <tr>
                    <th>شماره فاکتور</th>
                    <th>بابت</th>
                    <th>تاریخ صدور</th>
                    <th>مبلغ کل</th>
                    <th>وضعیت</th>
                    <th class="text-end">دریافت PDF</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>INV-1403-908</strong></td>
                    <td>اشتراک سالانه پلن سازمانی</td>
                    <td style="font-size:12px; color:var(--nv-text-muted);">۱۵ اسفند ۱۴۰۲</td>
                    <td class="numeric"><strong>۴۵,۰۰۰,۰۰۰ تومان</strong></td>
                    <td><span class="badge badge--soft-success">پرداخت‌شده</span></td>
                    <td class="text-end"><button class="btn btn-sm btn-light" type="button" data-download-inv><i class="bi bi-file-earmark-pdf"></i> دانلود</button></td>
                  </tr>
                  <tr>
                    <td><strong>INV-1403-451</strong></td>
                    <td>خرید بسته پیامک انبوه سازمانی</td>
                    <td style="font-size:12px; color:var(--nv-text-muted);">۲۰ تیر ۱۴۰۳</td>
                    <td class="numeric"><strong>۳,۲۰۰,۰۰۰ تومان</strong></td>
                    <td><span class="badge badge--soft-success">پرداخت‌شده</span></td>
                    <td class="text-end"><button class="btn btn-sm btn-light" type="button" data-download-inv><i class="bi bi-file-earmark-pdf"></i> دانلود</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`,
    );

    on(node, 'click', (e) => {
      if (e.target.closest('[data-upgrade-plan]')) {
        toast.info('ارتقای پلن', 'درگاه پرداخت سازمانی در حال آماده‌سازی است.');
      }
      if (e.target.closest('[data-download-inv]')) {
        toast.success('فاکتور رسمی دانلود شد');
      }
    });
    return;
  }

  // Fallback for remaining settings (security, notifications, localization, api) with enhanced form markup
  const titles = {
    general: 'تنظیمات عمومی',
    appearance: 'ظاهر و تم',
    layout: 'چیدمان',
    localization: 'بومی‌سازی و زبان',
    notifications: 'اعلان‌ها و پیام‌ها',
    security: 'امنیت و کنترل دسترسی',
    integrations: 'یکپارچه‌سازی‌ها',
    email: 'سرور ارسال ایمیل',
    api: 'تنظیمات API و وب‌هوک',
    billing: 'صورتحساب',
    system: 'سیستم',
  };

  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: titles[section] ?? 'تنظیمات',
        subtitle: 'تغییرات بلافاصله ذخیره و در سطح سیستم اعمال می‌شوند',
        icon: 'gear',
        badges: [statusBadge('وضعیت: برخط', 'success')],
      })}
      ${navHtml}

      <div class="grid grid--sidebar">
        <section class="card" style="border-radius:18px;">
          <header class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
            <div>
              <h2 class="card__title" style="margin:0; font-size:14px; font-weight:800;">${escapeHtml(titles[section] ?? 'تنظیمات')}</h2>
              <p class="card__subtitle" style="margin:2px 0 0; font-size:11px;">${escapeHtml(settingsIntro[section] ?? 'سازگار با RTL، تقویم شمسی و ارقام فارسی')}</p>
            </div>
          </header>
          <div class="card__body" style="padding:20px;">
            <form data-settings-form="${escapeHtml(section)}" novalidate>
              ${formMarkup(settingsFields(section, values), values ?? {}, { wide: true })}
              <div class="form-actions form-actions--end mt-4">
                <button class="btn btn-light" type="reset"><i class="bi bi-arrow-counterclockwise"></i> بازنشانی</button>
                <button class="btn btn-primary" type="submit"><i class="bi bi-check2"></i> ذخیره تنظیمات</button>
              </div>
            </form>
          </div>
        </section>

        <div class="dashboard-shell">
          ${card({
            title: 'نکته‌های کاربردی این بخش',
            body: `<ul class="checklist">${(settingsTips[section] ?? settingsTips.general).map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`,
          })}
        </div>
      </div>
    </div>`,
  );

  const form = $('[data-settings-form]', node);
  if (form) {
    on(form, 'submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      button?.classList.add('is-loading');
      const next = collectValues(form);
      await services.settingsService.update(section, next).catch(() => null);
      button?.classList.remove('is-loading');
      toast.success('تنظیمات ذخیره شد', 'تغییرات این بخش اعمال و در حساب شما نگه داشته شد.');
      bus.emit(EVENTS.dataChanged, { resource: 'settings', action: 'update', id: section });
    });
    on(form, 'reset', () => toast.info('بازنشانی شد', 'مقدارها به آخرین وضعیت ذخیره‌شده بازگشتند.'));
  }
}

/** Short description shown above each settings form. */
const settingsIntro = {
  general: 'نام برنامه، منطقه زمانی و قالب تاریخ پیش‌فرض کل قالب را کنترل می‌کند.',
  appearance: 'تم، رنگ اصلی و تراکم — همان گزینه‌هایی که در تنظیمات سریع هدر هم هست.',
  layout: 'چیدمان پیش‌فرض، جهت و رفتار هدر و منو برای همه کاربران جدید.',
  localization: 'زبان، واحد پول، تقویم و نوع ارقام در همه ماژول‌ها اعمال می‌شود.',
  notifications: 'تعیین کنید کدام رویدادها با ایمیل، مرورگر یا خلاصه دوره‌ای ارسال شوند.',
  security: 'سیاست گذرواژه، ورود دو مرحله‌ای و محدودسازی نشست‌ها.',
  integrations: 'اتصال درگاه پرداخت، فضای ذخیره‌سازی و وب‌هوک‌های خروجی.',
  email: 'تنظیمات سرور ارسال ایمیل؛ با دکمه «ارسال آزمایشی» صحت اتصال را بسنجید.',
  api: 'نشانی پایه، مهلت پاسخ و سیاست تلاش مجدد برای همه درخواست‌های سرویس.',
  billing: 'پلن، تعداد کاربران و اطلاعات صورت‌حساب سازمان.',
  system: 'حالت تعمیرات، اشکال‌زدایی، کش و پشتیبان‌گیری خودکار.',
};

/** Contextual guidance under each settings form. */
const settingsTips = {
  general: ['نام برنامه در عنوان صفحات و ایمیل‌های سیستمی استفاده می‌شود.', 'منطقه زمانی روی نمایش همه تاریخ‌ها اثر دارد.', 'قالب تاریخ برای تقویم شمسی و میلادی جداگانه اعمال می‌شود.'],
  appearance: ['رنگ اصلی از میان شش پالت آماده انتخاب می‌شود و روی نمودارها هم اثر می‌گذارد.', 'حالت «سیستم» تنظیمات سیستم‌عامل کاربر را دنبال می‌کند.'],
  layout: ['چیدمان افقی برای پنل‌های ساده و چیدمان دو ستونی برای صفحه‌های پرتراکم مناسب است.', 'هدر چسبان در موبایل تجربه بهتری می‌دهد.'],
  localization: ['ارقام فارسی روی اعداد جدول، نمودار و مبالغ اعمال می‌شود.', 'تقویم شمسی برای کسب‌وکارهای ایرانی و میلادی برای تیم‌های بین‌المللی مناسب است.'],
  notifications: ['اعلان مرورگر نیازمند اجازه کاربر است.', 'خلاصه دوره‌ای فشار اعلان‌ها را کم می‌کند.'],
  security: ['ورود دو مرحله‌ای برای نقش‌های مدیریتی توصیه می‌شود.', 'پایان نشست کوتاه‌تر امنیت را بالا می‌برد و راحتی را کم می‌کند.'],
  integrations: ['کليدهای دسترسی را در متغیرهای محیطی نگه دارید، نه در کد.', 'وب‌هوک را با یک سرور تست بسنجید.'],
  email: ['برای سرویس‌های ابری معمولاً پورت ۵۸۷ با TLS توصیه می‌شود.', 'نام کاربری اغلب همان ایمیل کامل است.'],
  api: ['در حالت نمایشی، پاسخ‌ها از لایه mock می‌آید و ساختار آن با API واقعی یکسان است.', 'برای اتصال به سرور واقعی، مقدار useMocks را در config.js خاموش کنید.'],
  billing: ['تعداد کاربران روی مبلغ صورت‌حساب اثر دارد.', 'ایمیل صورت‌حساب معمولاً ایمیل واحد مالی است.'],
  system: ['حالت تعمیرات دسترسی همه کاربران غیرمدیر را محدود می‌کند.', 'حالت اشکال‌زدایی فقط در محیط توسعه فعال شود.'],
};

function settingsFields(section, values) {
  const common = [
    { name: 'appName', label: 'نام برنامه', required: true },
    { name: 'timezone', label: 'منطقه زمانی', type: 'select', options: ['Asia/Tehran', 'Asia/Dubai', 'Europe/London', 'America/New_York'] },
    { name: 'dateFormat', label: 'قالب تاریخ', type: 'select', options: ['YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] },
    { name: 'language', label: 'زبان پیش‌فرض', type: 'select', options: [{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }] },
    { name: 'description', label: 'توضیح کوتاه', type: 'textarea', col: 2, rows: 3 },
  ];
  const map = {
    appearance: [
      { name: 'theme', label: 'حالت تم', type: 'select', options: ['light', 'dark', 'system'] },
      { name: 'primary', label: 'رنگ اصلی', type: 'select', options: ['indigo', 'blue', 'emerald', 'violet', 'rose', 'orange'] },
      { name: 'sidebarStyle', label: 'سبک سایدبار', type: 'select', options: ['fixed', 'floating', 'compact'] },
      { name: 'density', label: 'تراکم', type: 'select', options: ['comfortable', 'compact'] },
      { name: 'fontSize', label: 'اندازه فونت', type: 'select', options: ['sm', 'md', 'lg'] },
    ],
    layout: [
      { name: 'layout', label: 'چیدمان پیش‌فرض', type: 'select', options: ['sidebar', 'mini', 'collapse', 'horizontal', 'twocol', 'boxed'] },
      { name: 'stickyHeader', label: 'هدر چسبان', type: 'switch' },
      { name: 'compactSidebar', label: 'منوی جمع‌شده در شروع', type: 'switch' },
    ],
    localization: [
      { name: 'currency', label: 'واحد پول', type: 'select', options: ['IRR', 'USD', 'EUR', 'AED'] },
      { name: 'calendar', label: 'تقویم', type: 'select', options: ['jalali', 'gregorian'] },
      { name: 'digits', label: 'ارقام', type: 'select', options: [{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'لاتین' }] },
      { name: 'firstDay', label: 'اول هفته', type: 'select', options: ['شنبه', 'یکشنبه', 'دوشنبه'] },
    ],
    notifications: [
      { name: 'email', label: 'اعلان ایمیلی', type: 'switch' },
      { name: 'browser', label: 'اعلان مرورگر', type: 'switch' },
      { name: 'mentions', label: 'منشن‌ها', type: 'switch' },
      { name: 'marketing', label: 'پیام‌های بازاریابی', type: 'switch' },
      { name: 'digest', label: 'خلاصه دوره‌ای', type: 'select', options: ['realtime', 'daily', 'weekly'] },
    ],
    security: [
      { name: 'twoFactor', label: 'ورود دو مرحله‌ای اجباری', type: 'switch' },
      { name: 'sessionTimeout', label: 'پایان نشست (دقیقه)', type: 'number', inputMode: 'numeric' },
      { name: 'passwordPolicy', label: 'سیاست گذرواژه', type: 'select', options: ['basic', 'strong', 'strict'] },
      { name: 'ipAllowlist', label: 'فهرست IP مجاز', placeholder: '۱۹۲.۱۶۸.۱.۱, ۱۰.۰.۰.۵' },
    ],
    integrations: [
      { name: 'payments', label: 'درگاه پرداخت', value: true, type: 'switch' },
      { name: 'storage', label: 'فضای ذخیره‌سازی ابری', value: true, type: 'switch' },
      { name: 'smtp', label: 'سرور ایمیل (SMTP)', value: false, type: 'switch' },
      { name: 'webhookUrl', label: 'نشانی Webhook', rule: 'url', placeholder: 'https://example.com/hook' },
    ],
    email: [
      { name: 'host', label: 'میزبان SMTP', required: true },
      { name: 'port', label: 'پورت', type: 'number', inputMode: 'numeric' },
      { name: 'username', label: 'نام کاربری', rule: 'email' },
      { name: 'encryption', label: 'رمزنگاری', type: 'select', options: ['TLS', 'SSL', 'بدون رمزنگاری'] },
    ],
    api: [
      { name: 'baseUrl', label: 'نشانی پایه API', rule: 'url', placeholder: '/api' },
      { name: 'timeout', label: 'مهلت پاسخ (میلی‌ثانیه)', type: 'number', inputMode: 'numeric' },
      { name: 'retries', label: 'تعداد تلاش مجدد', type: 'number', inputMode: 'numeric' },
      { name: 'logs', label: 'ثبت لاگ درخواست‌ها', type: 'switch' },
    ],
    billing: [
      { name: 'plan', label: 'پلن فعلی', type: 'select', options: ['استارتر', 'حرفه‌ای', 'سازمانی'] },
      { name: 'seats', label: 'تعداد کاربران', type: 'number', inputMode: 'numeric' },
      { name: 'billingEmail', label: 'ایمیل صورت‌حساب', rule: 'email' },
      { name: 'vat', label: 'شماره اقتصادی', },
    ],
    system: [
      { name: 'maintenance', label: 'حالت تعمیرات', type: 'switch' },
      { name: 'debug', label: 'حالت اشکال‌زدایی', type: 'switch' },
      { name: 'cache', label: 'مدت کش (دقیقه)', type: 'number', inputMode: 'numeric' },
      { name: 'backup', label: 'پشتیبان‌گیری خودکار', type: 'switch' },
    ],
  };
  return map[section] ?? [...common, ...(map.appearance ?? [])];
}

/* ================================================================= profile */

export async function initProfile() {
  const node = host();
  const user = (await services.userService.list({ perPage: 1 })).items[0] || {
    name: 'سارا محمدی',
    email: 'sara.mohammadi@novaadmin.dev',
    phone: '+98 912 345 6789',
    roleLabel: 'مدیر ارشد محصول',
    team: 'تیم پلتفرم',
    avatar: 'assets/img/avatars/avatar-01.svg',
  };
  let section = kit.pageId().split('/').pop().replace('.html', '');
  if (section === 'api-keys') section = 'keys';

  const overviewHtml = `
    <div class="grid grid--3 mb-4" style="gap:16px;">
      ${statCard({ label: 'پروژه‌های هدایت‌شده', value: '۱۲ پروژه', hint: '۹ پروژه با موفقیت تحویل شد', tone: 'primary', icon: 'kanban' })}
      ${statCard({ label: 'تسک‌های انجام‌شده', value: '۴۵۲ تسک', hint: 'نرخ تکمیل ۹۶٪ در موعد', tone: 'success', icon: 'check2-all' })}
      ${statCard({ label: 'امتیاز امنیت حساب', value: '۹۶٪', hint: 'ورود دو مرحله‌ای فعال است', tone: 'info', icon: 'shield-check' })}
    </div>
    <div class="card" style="border-radius:18px;">
      <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border); display:flex; justify-content:space-between; align-items:center;">
        <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">اطلاعات شناسنامه‌ای و حساب کاربری</h3>
        <span class="badge badge--soft-success">حساب تأییدشده</span>
      </div>
      <div class="card__body" style="padding:20px;">
        <form class="form-stack">
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
            <div class="form-field"><label class="form-label">نام و نام خانوادگی *</label><input class="form-control" value="${escapeHtml(user.name)}" required></div>
            <div class="form-field"><label class="form-label">آدرس ایمیل کاری</label><input class="form-control" value="${escapeHtml(user.email)}" dir="ltr" readonly></div>
            <div class="form-field"><label class="form-label">شماره همراه</label><input class="form-control" value="${escapeHtml(user.phone || '+۹۸ ۹۱۲ ۳۴۵ ۶۷۸۹')}" dir="ltr"></div>
            <div class="form-field"><label class="form-label">سمت سازمانی</label><input class="form-control" value="${escapeHtml(user.roleLabel || 'مدیر ارشد محصول')}" readonly></div>
            <div class="form-field"><label class="form-label">تیم اختصاص‌یافته</label><input class="form-control" value="${escapeHtml(user.team || 'تیم پلتفرم')}" readonly></div>
            <div class="form-field"><label class="form-label">منطقه زمانی</label><select class="form-select"><option selected>تهران (GMT+3:30)</option><option>دبی (GMT+4:00)</option><option>استانبول (GMT+3:00)</option></select></div>
          </div>
          <div class="form-field mt-3"><label class="form-label">درباره من و بیوگرافی</label><textarea class="form-control" rows="3">مدیر محصول با بیش از ۸ سال تجربه در طراحی و توسعه سیستم‌های نرم‌افزاری مقیاس‌پذیر، سیستم‌های طراحی Enterprise و رابط‌های کاربری راست‌به‌چپ (RTL).</textarea></div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
            <button class="btn btn-light" type="reset">بازنشانی</button>
            <button class="btn btn-primary" type="button" data-save-profile><i class="bi bi-check2"></i> ذخیره تغییرات</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const activityHtml = `
    <div class="card" style="border-radius:18px;">
      <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--nv-border);">
        <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">تاریخچه فعالیت‌های اخیر شما</h3>
        <span class="badge badge--soft-primary">۳۰ روز گذشته</span>
      </div>
      <div class="card__body" style="padding:20px;">
        ${timeline([
          { title: 'ورود موفق به پنل مدیریت', text: 'از مرورگر Chrome 128 روی سیستم‌عامل macOS • نشانی IP: 5.160.82.11 (تهران)', time: '۱۰ دقیقه پیش', tone: 'success', icon: 'box-arrow-in-right' },
          { title: 'ایجاد کلید جدید API', text: 'کلید Production-Mobile با دسترسی خواندن/نوشتن صادر شد.', time: '۲ ساعت پیش', tone: 'primary', icon: 'key' },
          { title: 'تغییر تنظیمات اعلان‌ها', text: 'اعلان‌های ایمیلی برای رویدادهای امنیتی فعال شد.', time: 'دیروز', tone: 'info', icon: 'bell' },
          { title: 'صدور پیش‌فاکتور فروش', text: 'فاکتور شماره INV-۲۳۸۱ برای مشتری ویرا ابری ایجاد شد.', time: '۲ روز پیش', tone: 'success', icon: 'receipt' },
          { title: 'تغییر رمز عبور حساب', text: 'گذرواژه با احراز هویت دوعاملی پیامکی به‌روزرسانی شد.', time: '۵ روز پیش', tone: 'warning', icon: 'shield-lock' },
        ])}
      </div>
    </div>
  `;

  const securityHtml = `
    <div class="grid grid--2" style="gap:20px;">
      <div class="card" style="border-radius:18px;">
        <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
          <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">تغییر گذرواژه حساب</h3>
          <p class="card__subtitle" style="margin:0; font-size:11px;">گذرواژه باید حداقل ۸ کاراکتر شامل حروف و اعداد باشد.</p>
        </div>
        <div class="card__body" style="padding:20px;">
          <form class="form-stack">
            <div class="form-field"><label class="form-label">گذرواژه فعلی</label><input class="form-control" type="password" placeholder="••••••••"></div>
            <div class="form-field"><label class="form-label">گذرواژه جدید</label><input class="form-control" type="password" placeholder="حداقل ۸ کاراکتر"></div>
            <div class="form-field"><label class="form-label">تکرار گذرواژه جدید</label><input class="form-control" type="password" placeholder="تکرار رمز عبور"></div>
            <div class="progress progress--sm mt-2" style="height:6px;"><div class="progress-bar bg-success" style="width:85%"></div></div>
            <span style="font-size:11px; color:var(--nv-success); font-weight:700;">قدرت گذرواژه: عالی</span>
            <div class="mt-4"><button class="btn btn-primary" type="button" data-change-password><i class="bi bi-shield-check"></i> به‌روزرسانی گذرواژه</button></div>
          </form>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:20px;">
        <div class="card" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">ورود دو مرحله‌ای (2FA)</h3>
              <p class="card__subtitle" style="margin:0; font-size:11px;">امنیت حساب خود را با نرم‌افزارهای احراز هویت بالا ببرید.</p>
            </div>
            <span class="badge badge--soft-success">فعال</span>
          </div>
          <div class="card__body" style="padding:20px;">
            <p style="font-size:12px; color:var(--nv-text-muted); line-height:1.7;">ورود دو مرحله‌ای با Google Authenticator یا SMS فعال است. در هر بار ورود کد یک‌بارمصرف درخواست می‌شود.</p>
            <div class="d-flex gap-2">
              <button class="btn btn-light btn-sm" type="button" data-setup-2fa><i class="bi bi-qr-code"></i> پیکربندی مجدد</button>
              <button class="btn btn-outline-danger btn-sm" type="button" data-disable-2fa>غیرفعال‌سازی</button>
            </div>
          </div>
        </div>

        <div class="card" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
            <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">هشدارهای امنیتی ورود</h3>
          </div>
          <div class="card__body" style="padding:20px;">
            <div class="form-check form-switch mb-3">
              <input class="form-check-input" type="checkbox" id="alert-new-device" checked>
              <label class="form-check-label" for="alert-new-device" style="font-size:12px;">اطلاع‌رسانی ایمیلی هنگام ورود از دستگاه جدید</label>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="alert-ip-change" checked>
              <label class="form-check-label" for="alert-ip-change" style="font-size:12px;">هشدار پیامکی در صورت تغییر مشکوک IP</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  render(
    node,
    `<div class="dashboard-shell">
      <div class="card mb-4" style="border-radius:24px; overflow:hidden; border:1px solid var(--nv-border); box-shadow:var(--nv-shadow-sm);">
        <div style="height:140px; background:linear-gradient(135deg, var(--nv-primary) 0%, #8b5cf6 50%, #06b6d4 100%); position:relative;">
          <div style="position:absolute; inset:0; background:radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 60%); pointer-events:none;"></div>
        </div>
        <div class="card__body" style="padding:0 28px 24px; margin-top:-52px; display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:20px; position:relative;">
          <div style="display:flex; align-items:flex-end; gap:20px; flex-wrap:wrap;">
            <div style="position:relative; width:96px; height:96px; border-radius:26px; padding:3px; background:linear-gradient(135deg, var(--nv-primary) 0%, #a855f7 50%, #06b6d4 100%); box-shadow:0 12px 28px -6px rgba(99,102,241,0.4); flex-shrink:0;">
              <img class="profile-head__avatar" src="${url(user.avatar || 'assets/img/avatars/avatar-01.svg')}" style="width:100%; height:100%; border-radius:23px; object-fit:cover; background:var(--nv-surface); display:block; border:3px solid var(--nv-surface);" alt="${escapeHtml(user.name)}">
              <span style="position:absolute; bottom:-2px; left:-2px; width:18px; height:18px; border-radius:50%; background:#10b981; border:3px solid var(--nv-surface); box-shadow:0 0 0 2px rgba(16,185,129,0.3);" title="آنلاین و فعال"></span>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h1 style="margin:0; font-size:20px; font-weight:900; color:var(--nv-heading); letter-spacing:-0.02em;">${escapeHtml(user.name)}</h1>
                <span class="badge badge--soft-primary" style="font-size:11px; padding:3px 10px; border-radius:999px; display:inline-flex; align-items:center; gap:4px;">
                  <i class="bi bi-patch-check-fill text-primary" style="font-size:12px;"></i> تاییدشده
                </span>
              </div>
              <p style="margin:6px 0 0; font-size:12px; color:var(--nv-text-muted); display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span><i class="bi bi-shield-check text-primary"></i> ${escapeHtml(user.roleLabel ?? 'مدیر ارشد پلتفرم')}</span>
                <span>•</span>
                <span><i class="bi bi-building"></i> ${escapeHtml(user.team ?? 'تیم هسته محصول')}</span>
                <span>•</span>
                <span><i class="bi bi-geo-alt"></i> تهران، ایران</span>
              </p>
            </div>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-light btn-sm" type="button" data-change-avatar style="border-radius:10px; font-weight:700;"><i class="bi bi-camera"></i> ویرایش تصویر</button>
            <a class="btn btn-primary btn-sm" href="profile/security.html" style="border-radius:10px; font-weight:700;"><i class="bi bi-shield-lock"></i> امنیت حساب</a>
          </div>
        </div>
      </div>

      ${tabs([
        { id: 'overview', label: 'نمای کلی', icon: 'person', body: overviewHtml, active: section === 'overview' },
        { id: 'activity', label: 'فعالیت‌ها', icon: 'activity', body: activityHtml, active: section === 'activity' },
        { id: 'security', label: 'امنیت', icon: 'shield-lock', body: securityHtml, active: section === 'security' },
        { id: 'sessions', label: 'نشست‌ها', icon: 'laptop', body: card({ title: 'دستگاه‌های فعال متصل به حساب', flush: true, body: '<div data-session-list>' + kit.skeleton(3) + '</div>' }), active: section === 'sessions' },
        { id: 'notifications', label: 'اعلان‌ها', icon: 'bell', body: card({ title: 'تنظیمات ارسال پیام و ایمیل', body: '<div data-pref-list>' + kit.skeleton(3) + '</div>' }), active: section === 'notifications' },
        { id: 'keys', label: 'کلیدهای API', icon: 'key', body: '<div data-profile-keys>' + kit.skeleton(2) + '</div>', active: section === 'keys' },
        { id: 'invoices', label: 'فاکتورها', icon: 'receipt', body: '<div data-profile-invoices>' + kit.skeleton(2) + '</div>', active: section === 'invoices' },
      ])}
    </div>`,
  );
  initCharts(node);

  const sessionHost = $('[data-session-list]', node);
  if (sessionHost) {
    const sessions = await services.sessionService.list();
    render(sessionHost, `<ul class="list-group list-group--flush">${(sessions.items ?? sessions).map((s, i) => `
      <li class="list-group__item" style="padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="tile tile--soft tile--icon tile--soft-${i===0?'primary':'secondary'}" style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;">
            <i class="bi bi-${s.device.includes('iPhone')||s.device.includes('Xiaomi') ? 'phone' : 'laptop'}"></i>
          </span>
          <div>
            <div style="font-weight:700; font-size:13px; color:var(--nv-heading);">${escapeHtml(s.device)} ${i===0?'<span class="badge badge--soft-primary" style="font-size:10px;">نشست فعلی</span>':''}</div>
            <div style="font-size:11px; color:var(--nv-text-muted);">${escapeHtml(s.browser)} • IP: <span style="direction:ltr; display:inline-block; font-family:var(--nv-font-mono);">${escapeHtml(s.ip)}</span> (${escapeHtml(s.location)})</div>
          </div>
        </div>
        <div>
          ${i !== 0 ? `<button class="btn btn-sm btn-outline-danger" type="button" data-revoke-session="${escapeHtml(s.id)}" style="font-size:11px; padding:3px 8px;">خاتمه</button>` : '<span class="badge badge--soft-success" style="font-size:10px;">آنلاین</span>'}
        </div>
      </li>
    `).join('')}</ul>`);
    on(sessionHost, 'click', async (event) => {
      const button = event.target.closest('[data-revoke-session]');
      if (!button) return;
      await services.sessionService.revoke(button.dataset.revokeSession);
      button.closest('li').remove();
      toast.success('نشست پایان یافت', 'دسترسی این دستگاه بسته شد.');
    });
  }

  const prefHost = $('[data-pref-list]', node);
  if (prefHost) {
    render(prefHost, formMarkup([
      { name: 'email', label: 'ارسال ایمیل رویدادهای مالی و فاکتور', type: 'switch', value: true },
      { name: 'push', label: 'اعلان بلادرنگ مرورگر (Push Notification)', type: 'switch', value: true },
      { name: 'sms', label: 'ارسال پیامک برای هشدارهای امنیتی بحرانی', type: 'switch', value: true },
      { name: 'weekly', label: 'خلاصه ایمیلی عملکرد هفتگی تیم', type: 'switch', value: false },
    ]));
  }

  const keysHost = $('[data-profile-keys]', node);
  if (keysHost) {
    const keys = await services.apiKeys.list();
    render(keysHost, card({
      title: 'کلیدهای اختصاصی API شما',
      actions: '<button class="btn btn-primary btn-sm" type="button" data-create-api-key><i class="bi bi-plus-lg"></i> تولید کلید جدید</button>',
      flush: true,
      body: `
        <div class="table-responsive">
          <table class="table table--hover">
            <thead><tr><th>نام توکن</th><th>کلید (Secret)</th><th>دسترسی</th><th>تاریخ ساخت</th><th>آخرین استفاده</th><th class="text-end">عملیات</th></tr></thead>
            <tbody>
              ${(keys.items ?? keys).map(k => `
                <tr>
                  <td style="font-weight:700;"><i class="bi bi-key-fill text-warning me-1"></i> ${escapeHtml(k.name)}</td>
                  <td><code style="direction:ltr; font-size:12px;">${escapeHtml(k.token || 'nv_live_8f2c91ad4b7e')}</code></td>
                  <td><span class="badge badge--soft-primary">${escapeHtml((k.scopes || ['read','write']).join(' / '))}</span></td>
                  <td style="font-size:12px; color:var(--nv-text-muted);">${k.createdAt ? formatDate(k.createdAt, { format: 'medium' }) : '۱۴۰۳/۰۶/۱۵'}</td>
                  <td style="font-size:12px; color:var(--nv-text-muted);">${k.lastUsed ? relativeTime(k.lastUsed) : 'اخیراً'}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-light" type="button" data-copy-key="${escapeHtml(k.token || 'nv_live_8f2c91ad4b7e')}" title="کپی کلید"><i class="bi bi-copy"></i></button>
                    <button class="btn btn-sm btn-ghost text-danger" type="button" data-del-key="${escapeHtml(k.id)}" title="ابطال کلید"><i class="bi bi-trash3"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    }));
  }

  const invoiceHost = $('[data-profile-invoices]', node);
  if (invoiceHost) {
    const invoices = await services.invoiceService.list({ perPage: 4 });
    render(invoiceHost, card({ title: 'فاکتورهای پرداخت‌شده من', flush: true, body: `<ul class="list-group">${(invoices.items ?? invoices).map((invoice) => `<li class="list-item"><span class="list-item__title">${escapeHtml(invoice.number)}<span class="list-item__sub">${formatDate(invoice.issuedAt, { format: 'medium' })}</span></span><span class="list-item__meta">${formatCurrency(invoice.total, 'IRR', { compact: true })}${statusBadge(invoice.statusLabel ?? invoice.status, invoice.status === 'paid' ? 'success' : 'warning')}</span></li>`).join('')}</ul>` }));
  }

  on(node, 'click', async (event) => {
    if (event.target.closest('[data-change-avatar]')) {
      toast.info('انتخاب تصویر', 'پنجره بارگذاری آواتار باز شد.');
    }
    if (event.target.closest('[data-save-profile]')) {
      toast.success('تغییرات پروفایل با موفقیت ذخیره شد');
    }
    if (event.target.closest('[data-change-password]')) {
      toast.success('گذرواژه با موفقیت تغییر کرد');
    }
    if (event.target.closest('[data-setup-2fa]')) {
      toast.info('پیکربندی ۲FA', 'کد QR احراز هویت دوعاملی آماده اسکن است.');
    }
    if (event.target.closest('[data-create-api-key]')) {
      toast.success('کلید جدید API تولید شد');
    }
    const copyKey = event.target.closest('[data-copy-key]');
    if (copyKey) {
      await navigator.clipboard?.writeText(copyKey.dataset.copyKey).catch(()=>null);
      toast.success('کلید API کپی شد');
    }
  });
}

const profileOverview = (user) =>
  card({
    title: 'اطلاعات حساب',
    body: `<div class="grid grid--2">${formMarkup([
      { name: 'name', label: 'نام و نام خانوادگی', value: user.name, required: true },
      { name: 'email', label: 'ایمیل', type: 'email', value: user.email, rule: 'email' },
      { name: 'phone', label: 'تلفن همراه', value: user.phone, rule: 'phone' },
      { name: 'nationalId', label: 'کد ملی', rule: 'nationalId' },
      { name: 'position', label: 'سمت', value: user.roleLabel },
      { name: 'team', label: 'تیم', value: user.team },
      { name: 'bio', label: 'درباره من', type: 'textarea', rows: 4, col: 2, value: 'مدیر محصول با تمرکز بر تجربه کاربری فارسی و سیستم‌های طراحی.' },
    ])}</div>`,
  });

const profileActivity = () =>
  timeline([
    { title: 'ورود به سیستم', text: 'از مرورگر کروم — تهران', time: '۱۰ دقیقه پیش', tone: 'success', icon: 'box-arrow-in-right' },
    { title: 'ویرایش محصول', text: 'قیمت هدفون نووا پرو به‌روزرسانی شد.', time: '۲ ساعت پیش', tone: 'primary', icon: 'pencil' },
    { title: 'صدور فاکتور', text: 'فاکتور INV-۱۴۰۵-۰۱۲ برای مشتری ویرا', time: 'دیروز', tone: 'info', icon: 'receipt' },
    { title: 'تغییر دسترسی', text: 'نقش کاربر «امیر» به ویرایشگر تغییر کرد.', time: '۳ روز پیش', tone: 'warning', icon: 'shield-check' },
  ]);

const profileSecurity = () =>
  card({
    title: 'امنیت حساب',
    body: `${formMarkup([
      { name: 'current', label: 'گذرواژه فعلی', type: 'password' },
      { name: 'password', label: 'گذرواژه جدید', type: 'password', rule: 'password', min: 8 },
      { name: 'confirm', label: 'تکرار گذرواژه', type: 'password', match: 'password' },
      { name: 'twoFactor', label: 'ورود دو مرحله‌ای', type: 'switch', value: true },
    ])}
    <div class="form-actions"><button class="btn btn-primary" type="button" data-change-password>تغییر گذرواژه</button><button class="btn btn-light" type="button" data-active-sessions>نمایش نشست‌های فعال</button></div>`,
  });

/* ================================================================== UI kit */
/*
 * The component library lives in `ui-kit.js` — one builder per `ui/*.html`
 * page. It is routed from `main.js` (`'ui/'`), so nothing is referenced from
 * this module any more; the shared primitives still come from `kit.js`.
 */

/* ========================================================= product preview */

/**
 * `preview.html` — the live product preview: demos, layout gallery and palette
 * picker all wired to the theme engine, so the visitor sees the change
 * immediately on the page they are already looking at.
 */
export async function initPreview() {
  const node = $('[data-landing]') ?? host();
  if (!node) return;
  node.dataset.appClaimed = '1';

  const layoutLabels = { default: 'سایدبار', mini: 'مینی', collapse: 'جمع‌شده', horizontal: 'افقی', twocol: 'دو ستونی', boxed: 'باکس‌دار' };

  paint(
    $('[data-preview-demos]', node),
    config.demos
      .map(
        (demo) => `<div class="col-sm-6 col-xl-4"><article class="landing-demo-card">
          <a class="landing-demo-card__media" href="auth/login.html?next=dashboards/${demo.id}.html" aria-label="باز کردن داشبورد ${escapeHtml(demo.label.fa)}">
            <picture>
              <img data-preview-id="${escapeHtml(demo.id)}" src="${escapeHtml(previewSrc(demo.id))}" width="1440" height="900" loading="lazy" decoding="async" alt="پیش‌نمایش داشبورد ${escapeHtml(demo.label.fa)}" />
            </picture>
            <span class="landing-demo-card__open"><i class="bi bi-box-arrow-up-left" aria-hidden="true"></i> باز کردن</span>
          </a>
          <div class="landing-demo-card__body">
            <span class="landing-demo-card__icon"><i class="bi bi-${escapeHtml(demo.icon)}" aria-hidden="true"></i></span>
            <div style="min-width:0">
              <h3 class="landing-demo-card__title">${escapeHtml(demo.label.fa)}</h3>
              <p class="landing-demo-card__text">${escapeHtml(demo.label.en)} — داده، نمودار و جدول اختصاصی</p>
            </div>
          </div>
        </article></div>`,
      )
      .join(''),
  );

  const layoutHost = $('[data-preview-layouts]', node);
  if (layoutHost) {
    layoutHost.dataset.customizer = 'layout';
    paint(
      layoutHost,
      theme.LAYOUTS.map(
        (layout) => `<button type="button" class="layout-option" data-value="${layout}" aria-pressed="false"><span class="layout-option__preview is-${layout === 'default' ? 'sidebar' : layout}"></span><span>${layoutLabels[layout] ?? layout}</span></button>`,
      ).join(''),
    );
  }

  const paletteHost = $('[data-preview-palettes]', node);
  if (paletteHost) {
    paletteHost.dataset.customizer = 'primary';
    paint(
      paletteHost,
      theme.PALETTES.map((palette) => `<button type="button" class="swatch swatch--lg" data-value="${palette}" style="--swatch: var(--nv-${palette})" aria-label="${palette}"></button>`).join(''),
    );
  }

  on(node, 'click', (event) => {
    const option = event.target.closest('[data-preview-layouts] [data-value], [data-preview-palettes] [data-value]');
    if (!option) return;
    const group = option.closest('[data-preview-layouts]') ? 'چیدمان' : 'رنگ اصلی';
    toast.success('ظاهر به‌روز شد', `${group}: ${option.dataset.value}`);
  });

  /* The preview page is the one place where a theme change must repaint the
     pictures: every mock-up exists as a light and a dark drawing. */
  wireLandingHeader(node);
  /* The hosts are tagged with `data-customizer` at runtime, i.e. after theme.js
     synced the page — one extra pass keeps the current choice highlighted. */
  theme.sync?.();
  bus.on(EVENTS.theme, () => syncLandingImages(node));

  initCharts(node);
}

/* ================================================================ auth */

/**
 * Field renderer for the authentication screens.
 *
 * The template's own `formMarkup()` is the right tool for record forms; the
 * sign-in screens need the same fields with a leading icon, an optional
 * password reveal button and an optional strength meter — all wired to the
 * controllers in `core/form.js` (`[data-password-toggle]`, `[data-password-field]`).
 */
function authField({ name, label, labelKey, type = 'text', icon = 'input-cursor', placeholder = '', required = false, autocomplete = '', rule = '', min = 0, match = '', meter = false }) {
  const id = `auth-${name}`;
  const text = labelKey ? `<span data-i18n="${labelKey}">${label}</span>` : label;
  const labelHtml = `<label class="form-label" for="${id}">${text}${required ? ' <span class="text-danger" aria-hidden="true">*</span>' : ''}</label>`;
  const attrs = [
    'class="form-control"',
    required ? 'required' : '',
    rule ? `data-rule="${rule}"` : '',
    min ? `data-min="${min}"` : '',
    match ? `data-match="${match}"` : '',
    autocomplete ? `autocomplete="${autocomplete}"` : '',
    meter ? `data-password-field="#${id}-meter"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const input = `<input id="${id}" name="${name}" type="${type}" ${attrs} placeholder="${escapeHtml(placeholder)}">`;
  const control =
    type === 'password'
      ? `<div class="input-group input-group--icon input-group--icon-end">
          <i class="bi bi-lock" aria-hidden="true"></i>${input}
          <button class="input-group__icon" type="button" data-password-toggle="#${id}" aria-label="نمایش رمز عبور"><i class="bi bi-eye" aria-hidden="true"></i></button>
        </div>
        ${
          meter
            ? `<div class="password-strength" id="${id}-meter" data-score="0"><span></span><span></span><span></span><span></span><small class="password-meter__label" data-password-label></small></div>`
            : ''
        }`
      : `<div class="input-group input-group--icon"><i class="bi bi-${icon}" aria-hidden="true"></i>${input}</div>`;
  return `<div class="form-field">${labelHtml}${control}</div>`;
}

const AUTH_FIELDS = {
  email: { name: 'email', label: 'ایمیل', labelKey: 'auth.email', type: 'email', icon: 'envelope', rule: 'email', required: true, autocomplete: 'email', placeholder: 'you@company.com' },
  password: { name: 'password', label: 'رمز عبور', labelKey: 'auth.password', type: 'password', required: true, autocomplete: 'current-password', placeholder: '••••••••' },
  newPassword: { name: 'password', label: 'رمز عبور جدید', labelKey: 'auth.newPassword', type: 'password', rule: 'password', min: 8, required: true, autocomplete: 'new-password', meter: true },
  confirm: { name: 'confirm', label: 'تکرار رمز عبور', labelKey: 'auth.confirmPassword', type: 'password', match: 'password', required: true, autocomplete: 'new-password' },
  name: { name: 'name', label: 'نام و نام خانوادگی', labelKey: 'auth.fullName', icon: 'person', required: true, autocomplete: 'name' },
  phone: { name: 'phone', label: 'شماره موبایل', labelKey: 'auth.phone', icon: 'telephone', rule: 'phone', autocomplete: 'tel' },
};

/** The demo account every authentication screen mentions. */
const AUTH_DEMO = { email: 'demo@novaadmin.dev', password: '12345678' };

function authDemoBox() {
  return `<div class="auth-demo" data-demo-box>
    <div class="auth-demo__row"><span data-i18n="auth.demoEmail">ایمیل آزمایشی</span><code dir="ltr">${AUTH_DEMO.email}</code></div>
    <div class="auth-demo__row"><span data-i18n="auth.demoPassword">رمز آزمایشی</span><code dir="ltr">${AUTH_DEMO.password}</code></div>
    <button class="btn btn-light btn-sm" type="button" data-demo-fill><i class="bi bi-magic" aria-hidden="true"></i> <span data-i18n="auth.fillDemo">پر کردن خودکار فرم</span></button>
  </div>`;
}

function authSocial() {
  return `<div class="auth-card__divider"><span data-i18n="auth.orContinue">یا ادامه با</span></div>
    <div class="auth-social">
      <button class="btn btn-light" type="button" data-social="google"><i class="bi bi-google" aria-hidden="true"></i> <span data-i18n="auth.socialGoogle">گوگل</span></button>
      <button class="btn btn-light" type="button" data-social="github"><i class="bi bi-github" aria-hidden="true"></i> <span data-i18n="auth.socialGithub">گیت‌هاب</span></button>
      <button class="btn btn-light" type="button" data-social="sso"><i class="bi bi-shield-lock" aria-hidden="true"></i> SSO</button>
    </div>`;
}

function authBrandMark() {
  return `<div class="auth-card__brand">
    <img src="assets/logo-mark.svg" alt="" width="40" height="40">
    <span class="auth-card__brand-text"><strong>NOVAADMIN</strong><small data-i18n="auth.secureNote">اتصال شما رمزنگاری‌شده است؛ اطلاعات ورود روی سرور ذخیره نمی‌شود.</small></span>
  </div>`;
}

function authHead({ titleKey, title, textKey, text, icon = 'shield-lock' }) {
  return `<header class="auth-card__head">
    <span class="auth-card__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></span>
    <h2 class="auth-card__title" data-i18n="${titleKey}">${title}</h2>
    <p class="auth-card__text" data-i18n="${textKey}">${text}</p>
  </header>`;
}

function authNote(icon = 'shield-check') {
  return `<p class="auth-note"><i class="bi bi-${icon}" aria-hidden="true"></i> <span data-i18n="auth.secureNote">اتصال شما رمزنگاری‌شده است؛ اطلاعات ورود روی سرور ذخیره نمی‌شود.</span></p>`;
}

function authWhyList() {
  return `<ul class="auth-why">
    <li><i class="bi bi-layout-text-window-reverse" aria-hidden="true"></i> <span data-i18n="auth.whyOne">۲۰۶ صفحه آماده و ۱۰ داشبورد با داده واقعی</span></li>
    <li><i class="bi bi-translate" aria-hidden="true"></i> <span data-i18n="auth.whyTwo">سه زبان، RTL کامل و تقویم شمسی</span></li>
    <li><i class="bi bi-life-preserver" aria-hidden="true"></i> <span data-i18n="auth.whyThree">مستندات فارسی و پشتیبانی شش‌ماهه</span></li>
  </ul>`;
}


export async function initAuth() {
  const page = document.querySelector('[data-resource^="auth-"]')?.dataset.resource ?? kit.pageId();
  
  // Any login page uses dedicated initLoginPro
  if (page.includes('login') || page === 'auth-login') {
    const { initLoginPro } = await import('./login.js');
    if (initLoginPro()) return;
  }

  const node = $('[data-auth]') ?? document.querySelector('.auth-page') ?? document.querySelector('.lx-page') ?? document.getElementById('main-content');
  if (!node) return;
  
  if (page === 'auth-logout' || page === 'auth-lock') {
    const { clearSession } = await import('../core/auth.js');
    clearSession();
  }

  const { url, goTo } = await import('../core/links.js');
  const { toast } = await import('../core/toast.js');
  const services = kit.services;

  const DEMO = { email: 'demo@novaadmin.dev', password: '12345678' };
  const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  const MS_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>';

  function particles(count = 12) {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return '';
    return Array.from({ length: count }, (_, i) => {
      const x = (i * 37) % 100;
      const y = (i * 53) % 100;
      const size = 2 + (i % 3);
      const delay = (i % 7) * -1.3;
      const dur = 6 + (i % 5) * 2;
      return `<i style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s"></i>`;
    }).join('');
  }

  const QUOTES = [
    { text: 'ساخت پنل داخلی که قبلاً دو هفته طول می‌کشید، با نوا ادمین در دو روز تحویل شد.', name: 'مهدی رضایی', role: 'مدیر فنی، داده‌پردازان پارس', avatar: 'assets/img/avatars/avatar-11.svg' },
    { text: 'RTL واقعی، تقویم شمسی و نمودارهای تمیز — دقیقاً همان چیزی که دنبالش بودیم.', name: 'سعید امینی', role: 'بنیان‌گذار، سرویس ابری ویرا', avatar: 'assets/img/avatars/avatar-03.svg' },
  ];

  function visualSide() {
    const q = QUOTES[Math.floor(Math.random()*QUOTES.length)];
    return `<section class="lx-visual" aria-hidden="true">
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
      </div>
      <figure class="lx-quote">
        <div class="lx-quote__stars">★★★★★</div>
        <blockquote>«${escapeHtml(q.text)}»</blockquote>
        <figcaption><img src="${url(q.avatar)}" alt="" width="40" height="40"><span><b>${escapeHtml(q.name)}</b><small>${escapeHtml(q.role)}</small></span></figcaption>
      </figure>
    </section>`;
  }

  function topBar() {
    return `<div class="lx-top">
      <a class="lx-back" href="${url('index.html')}"><i class="bi bi-arrow-right"></i> صفحه اصلی</a>
      <div class="lx-top__tools">
        <div class="dropdown">
          <button class="lx-icon-btn" type="button" data-dropdown-toggle="true" aria-expanded="false" aria-label="تغییر زبان"><i class="bi bi-translate"></i></button>
          <ul class="dropdown-menu" data-dropdown-menu data-language-switch data-language-list></ul>
        </div>
        <button class="lx-icon-btn" type="button" data-theme-toggle aria-label="تغییر تم"><i class="bi bi-moon-stars"></i></button>
      </div>
    </div>`;
  }

  function logo() {
    return `<a class="lx-logo" href="${url('index.html')}" aria-label="NOVAADMIN">
      <span class="lx-logo__mark"><img src="${url('assets/logo-mark.svg')}" alt="" width="30" height="30"></span>
      <span class="lx-logo__text"><b>NOVA<em>ADMIN</em></b><small>پنل مدیریت هوشمند</small></span>
    </a>`;
  }

  function divider(text) {
    return `<div class="lx-divider"><span>${text}</span></div>`;
  }

  function socialRow() {
    return `<div class="lx-social">
      <button type="button" class="lx-social__btn" data-lx-social="Google">${GOOGLE_SVG}<span>گوگل</span></button>
      <button type="button" class="lx-social__btn" data-lx-social="GitHub"><i class="bi bi-github"></i><span>گیت‌هاب</span></button>
      <button type="button" class="lx-social__btn" data-lx-social="Microsoft">${MS_SVG}<span>مایکروسافت</span></button>
    </div>`;
  }

  function trustRow() {
    return `<ul class="lx-trust">
      <li><i class="bi bi-shield-check"></i> اتصال رمزنگاری‌شده SSL</li>
      <li><i class="bi bi-fingerprint"></i> ورود دومرحله‌ای</li>
      <li><i class="bi bi-lock"></i> حریم خصوصی داده‌ها</li>
    </ul>`;
  }

  function otpMarkup() {
    return `<div class="form-field">
      <label class="form-label">کد تأیید ۶ رقمی</label>
      <div class="otp-row" data-otp>${Array.from({ length: 6 }, (_, i) => `<input class="form-control otp-input numeric" inputmode="numeric" maxlength="1" aria-label="رقم ${i+1}">`).join('')}</div>
      <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:11px; color:var(--nv-text-muted);"><span>کد به ایمیل شما ارسال شد</span><button type="button" class="btn btn-ghost btn-sm" data-resend style="font-size:11px; padding:2px 8px;">ارسال مجدد</button></div>
    </div>`;
  }

  const normalized = (() => {
    const map = {
      'auth-login': 'auth-login',
      'auth/login.html': 'auth-login',
      'auth-login-split': 'auth-login-split',
      'auth/login-split.html': 'auth-login-split',
      'auth-login-minimal': 'auth-login-minimal',
      'auth/login-minimal.html': 'auth-login-minimal',
      'auth-register': 'auth-register',
      'auth/register.html': 'auth-register',
      'auth-forgot': 'auth-forgot',
      'auth/forgot-password.html': 'auth-forgot',
      'auth-reset': 'auth-reset',
      'auth/reset-password.html': 'auth-reset',
      'auth-verify': 'auth-verify',
      'auth/verify-email.html': 'auth-verify',
      'auth-verify-email': 'auth-verify',
      'auth-2fa': 'auth-2fa',
      'auth/two-factor.html': 'auth-2fa',
      'auth-login-2fa': 'auth-2fa',
      'auth-two-factor': 'auth-2fa',
      'auth-lock': 'auth-lock',
      'auth/lock-screen.html': 'auth-lock',
      'auth-lock-screen': 'auth-lock',
      'auth-logout': 'auth-logout',
      'auth/logout.html': 'auth-logout',
    };
    return map[page] || page;
  })();

  let formHtml = '';
  let headTitle = '';
  let headSub = '';
  let footLink = '';
  let showSocial = false;

  switch (normalized) {
    case 'auth-login':
    case 'auth-login-split':
    case 'auth-login-minimal':
      headTitle = 'خوش برگشتید 👋';
      headSub = 'برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.';
      showSocial = true;
      formHtml = `
        <button class="lx-demo" type="button" data-lx-demo>
          <span class="lx-demo__icon"><i class="bi bi-lightning-charge-fill"></i></span>
          <span class="lx-demo__text"><strong>ورود سریع با حساب دمو</strong><small dir="ltr">demo@novaadmin.dev</small></span>
          <i class="bi bi-arrow-left lx-demo__arrow"></i>
        </button>
        <div class="lx-divider"><span>یا ورود با ایمیل</span></div>
        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="email">
            <i class="bi bi-envelope lx-field__icon"></i>
            <input id="lx-email" class="lx-field__input" type="email" name="email" placeholder=" " autocomplete="email" dir="ltr" required>
            <label for="lx-email" class="lx-field__label">آدرس ایمیل</label>
          </div>
          <p class="lx-error" data-error="email" hidden></p>
          <div class="lx-field" data-field="password">
            <i class="bi bi-shield-lock lx-field__icon"></i>
            <input id="lx-password" class="lx-field__input" type="password" name="password" placeholder=" " autocomplete="current-password" dir="ltr" required minlength="6">
            <label for="lx-password" class="lx-field__label">رمز عبور</label>
            <button class="lx-eye" type="button" data-lx-eye><i class="bi bi-eye"></i></button>
          </div>
          <p class="lx-error" data-error="password" hidden></p>
          <div class="lx-row">
            <label class="lx-switch"><input type="checkbox" name="remember" checked><span class="lx-switch__track"><span></span></span> مرا به خاطر بسپار</label>
            <a class="lx-link" href="${url('auth/forgot-password.html')}">فراموشی رمز؟</a>
          </div>
          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">ورود به پنل</span>
            <i class="bi bi-arrow-left lx-submit__icon"></i>
            <span class="lx-submit__spinner"></span>
          </button>
        </form>`;
      footLink = `<p class="lx-foot">حساب کاربری ندارید؟ <a href="${url('auth/register.html')}">ایجاد حساب رایگان</a></p>`;
      break;

    case 'auth-register':
      headTitle = 'ساخت حساب جدید ✨';
      headSub = 'در چند ثانیه حساب خود را بسازید و به پنل دسترسی پیدا کنید.';
      showSocial = true;
      formHtml = `
        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="name">
            <i class="bi bi-person lx-field__icon"></i>
            <input id="lx-name" class="lx-field__input" type="text" name="name" placeholder=" " autocomplete="name" required>
            <label for="lx-name" class="lx-field__label">نام و نام خانوادگی</label>
          </div>
          <p class="lx-error" data-error="name" hidden></p>
          <div class="lx-field" data-field="email">
            <i class="bi bi-envelope lx-field__icon"></i>
            <input id="lx-email" class="lx-field__input" type="email" name="email" placeholder=" " autocomplete="email" dir="ltr" required>
            <label for="lx-email" class="lx-field__label">آدرس ایمیل</label>
          </div>
          <p class="lx-error" data-error="email" hidden></p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="lx-field" data-field="password">
              <i class="bi bi-shield-lock lx-field__icon"></i>
              <input id="lx-password" class="lx-field__input" type="password" name="password" placeholder=" " autocomplete="new-password" dir="ltr" required minlength="8">
              <label for="lx-password" class="lx-field__label">رمز عبور</label>
              <button class="lx-eye" type="button" data-lx-eye aria-label="نمایش رمز"><i class="bi bi-eye"></i></button>
            </div>
            <div class="lx-field" data-field="confirm">
              <i class="bi bi-shield-check lx-field__icon"></i>
              <input id="lx-confirm" class="lx-field__input" type="password" name="confirm" placeholder=" " autocomplete="new-password" dir="ltr" required>
              <label for="lx-confirm" class="lx-field__label">تکرار رمز</label>
            </div>
          </div>
          <p class="lx-error" data-error="password" hidden></p>
          <label class="lx-switch" style="font-size:12px;"><input type="checkbox" name="terms" required><span class="lx-switch__track"><span></span></span> <span><a href="${url('system/terms.html')}" target="_blank">قوانین و مقررات</a> را می‌پذیرم</span></label>
          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">ساخت حساب</span>
            <i class="bi bi-arrow-left lx-submit__icon"></i>
            <span class="lx-submit__spinner"></span>
          </button>
        </form>`;
      footLink = `<p class="lx-foot">قبلاً ثبت‌نام کرده‌اید؟ <a href="${url('auth/login.html')}">ورود به حساب</a></p>`;
      break;

    case 'auth-forgot':
      headTitle = 'بازیابی رمز عبور 🔑';
      headSub = 'ایمیل خود را وارد کنید تا لینک بازیابی برای شما ارسال شود.';
      formHtml = `
        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="email">
            <i class="bi bi-envelope lx-field__icon"></i>
            <input id="lx-email" class="lx-field__input" type="email" name="email" placeholder=" " autocomplete="email" dir="ltr" required>
            <label for="lx-email" class="lx-field__label">آدرس ایمیل</label>
          </div>
          <p class="lx-error" data-error="email" hidden></p>
          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">ارسال لینک بازیابی</span>
            <i class="bi bi-send lx-submit__icon"></i>
            <span class="lx-submit__spinner"></span>
          </button>
        </form>`;
      footLink = `<p class="lx-foot"><a href="${url('auth/login.html')}"><i class="bi bi-arrow-right"></i> بازگشت به ورود</a></p>`;
      break;

    case 'auth-reset':
      headTitle = 'رمز عبور جدید 🛡️';
      headSub = 'رمز عبور قوی و امن برای حساب خود انتخاب کنید.';
      formHtml = `
        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="password">
            <i class="bi bi-shield-lock lx-field__icon"></i>
            <input id="lx-password" class="lx-field__input" type="password" name="password" placeholder=" " autocomplete="new-password" dir="ltr" required minlength="8">
            <label for="lx-password" class="lx-field__label">رمز عبور جدید</label>
            <button class="lx-eye" type="button" data-lx-eye><i class="bi bi-eye"></i></button>
          </div>
          <div class="lx-field" data-field="confirm">
            <i class="bi bi-shield-check lx-field__icon"></i>
            <input id="lx-confirm" class="lx-field__input" type="password" name="confirm" placeholder=" " autocomplete="new-password" dir="ltr" required>
            <label for="lx-confirm" class="lx-field__label">تکرار رمز عبور</label>
          </div>
          <p class="lx-error" data-error="password" hidden></p>
          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">به‌روزرسانی رمز عبور</span>
            <i class="bi bi-check2-circle lx-submit__icon"></i>
            <span class="lx-submit__spinner"></span>
          </button>
        </form>`;
      footLink = `<p class="lx-foot"><a href="${url('auth/login.html')}">بازگشت به ورود</a></p>`;
      break;

    case 'auth-verify':
      headTitle = 'تأیید ایمیل ✉️';
      headSub = 'کد ۶ رقمی ارسال شده به ایمیل خود را وارد کنید.';
      formHtml = `
        <form class="lx-form" data-lx-form novalidate>
          ${otpMarkup()}
          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">تأیید و ادامه</span>
            <i class="bi bi-check2-circle lx-submit__icon"></i>
            <span class="lx-submit__spinner"></span>
          </button>
        </form>`;
      footLink = `<p class="lx-foot">کد را دریافت نکردید؟ <a href="#" data-resend>ارسال مجدد</a> • <a href="${url('auth/login.html')}">بازگشت</a></p>`;
      break;

    case 'auth-2fa':
      headTitle = 'احراز هویت دو مرحله‌ای 🔐';
      headSub = 'کد ۶ رقمی برنامه احراز هویت خود را وارد کنید.';
      formHtml = `
        <form class="lx-form" data-lx-form novalidate>
          ${otpMarkup()}
          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">تأیید کد</span>
            <i class="bi bi-shield-check lx-submit__icon"></i>
            <span class="lx-submit__spinner"></span>
          </button>
        </form>`;
      footLink = `<p class="lx-foot"><a href="${url('auth/login.html')}">استفاده از حساب دیگر</a></p>`;
      break;

    case 'auth-lock':
      headTitle = 'صفحه قفل است 🔒';
      headSub = 'برای ادامه، رمز عبور خود را وارد کنید.';
      formHtml = `
        <div style="text-align:center; margin-bottom:20px;">
          <img src="${url('assets/img/avatars/avatar-08.svg')}" alt="" width="88" height="88" style="border-radius:28px; border:3px solid var(--nv-surface); box-shadow:var(--nv-shadow-lg);">
          <h3 style="margin:12px 0 4px; font-weight:900; font-size:16px;">سارا محمدی</h3>
          <p style="margin:0; font-size:12px; color:var(--nv-text-muted);">مدیر محصول • sara@novaadmin.dev</p>
        </div>
        <form class="lx-form" data-lx-form novalidate>
          <div class="lx-field" data-field="password">
            <i class="bi bi-shield-lock lx-field__icon"></i>
            <input id="lx-password" class="lx-field__input" type="password" name="password" placeholder=" " autocomplete="current-password" dir="ltr" required>
            <label for="lx-password" class="lx-field__label">رمز عبور</label>
            <button class="lx-eye" type="button" data-lx-eye><i class="bi bi-eye"></i></button>
          </div>
          <p class="lx-error" data-error="password" hidden></p>
          <button class="lx-submit" type="submit" data-lx-submit>
            <span class="lx-submit__label">باز کردن قفل</span>
            <i class="bi bi-unlock lx-submit__icon"></i>
            <span class="lx-submit__spinner"></span>
          </button>
        </form>`;
      footLink = `<p class="lx-foot"><a href="${url('auth/login.html')}">ورود با حساب دیگر</a></p>`;
      break;

    case 'auth-logout':
      headTitle = 'خارج شدید 👋';
      headSub = 'نشست شما با موفقیت بسته شد. داده‌های شما محفوظ است.';
      formHtml = `
        <div style="text-align:center; padding:20px 0;">
          <div style="width:80px; height:80px; border-radius:28px; background:var(--nv-success-soft); color:var(--nv-success); display:grid; place-items:center; font-size:36px; margin:0 auto 16px;"><i class="bi bi-check2-circle"></i></div>
          <p style="font-size:13px; color:var(--nv-text-muted); line-height:1.8;">از اینکه از نواادمین استفاده کردید سپاسگزاریم. برای ورود مجدد، یکی از گزینه‌های زیر را انتخاب کنید.</p>
          <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
            <a class="lx-submit" href="${url('auth/login.html')}" style="text-decoration:none;"><span class="lx-submit__label">بازگشت به ورود</span><i class="bi bi-box-arrow-in-right lx-submit__icon"></i></a>
            <a class="btn btn-light w-100" href="${url('index.html')}" style="height:48px; border-radius:12px; font-weight:700;"><i class="bi bi-house-door"></i> صفحه اصلی</a>
          </div>
        </div>`;
      break;

    default:
      headTitle = 'ورود به حساب';
      headSub = 'برای ادامه وارد شوید.';
      formHtml = `<form class="lx-form" data-lx-form><div class="lx-field"><input class="lx-field__input" name="email" placeholder=" "><label class="lx-field__label">ایمیل</label></div><button class="lx-submit" type="submit"><span class="lx-submit__label">ورود</span></button></form>`;
  }

  const markup = `
    <div class="lx">
      <section class="lx-side" aria-label="فرم احراز هویت">
        ${topBar()}
        <div class="lx-card" data-lx-card>
          ${logo()}
          <header class="lx-head">
            <h1>${headTitle}</h1>
            <p>${headSub}</p>
          </header>
          ${formHtml}
          ${showSocial ? divider('یا ادامه با') : ''}
          ${showSocial ? socialRow() : ''}
          ${footLink}
        </div>
        ${trustRow()}
        <div class="lx-success" data-lx-success hidden>
          <div class="lx-success__inner">
            <svg class="lx-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-16"/></svg>
            <h2>خوش آمدید!</h2>
            <p>در حال انتقال به داشبورد…</p>
            <div class="lx-progress"><span></span></div>
          </div>
        </div>
      </section>
      ${visualSide()}
    </div>`;

  const mainEl = document.getElementById('main-content') ?? document.querySelector('.auth-page') ?? node;
  if (mainEl.id === 'main-content' || mainEl.classList.contains('auth-page')) {
    mainEl.className = 'lx-page';
    mainEl.innerHTML = `<h1 class="visually-hidden">${headTitle}</h1>${markup}`;
    document.body.classList.add('lx-body');
  } else {
    render(node, markup);
  }

  const rootEl = document.querySelector('.lx');
  if (!rootEl) return;

  const form = rootEl.querySelector('[data-lx-form]');
  const email = form ? form.querySelector('[name="email"]') : null;
  const password = form ? form.querySelector('[name="password"]') : null;
  const submit = form ? form.querySelector('[data-lx-submit]') : null;

  const setError = (name, message) => {
    const field = form ? form.querySelector(`[data-field="${name}"]`) : null;
    const box = form ? form.querySelector(`[data-error="${name}"]`) : null;
    if (field) field.classList.toggle('is-invalid', Boolean(message));
    if (box) {
      box.hidden = !message;
      box.innerHTML = message ? `<i class="bi bi-exclamation-circle"></i> ${message}` : '';
    }
  };

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  if (form) {
    on(form, 'input', () => {
      if (email && validEmail(email.value.trim())) setError('email','');
      if (password && password.value.length >= 6) setError('password','');
    });
    on(form.querySelector('[data-lx-eye]'), 'click', (e) => {
      const btn = e.currentTarget;
      const input = btn.closest('.lx-field')?.querySelector('input');
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = `<i class="bi bi-${show ? 'eye-slash' : 'eye'}"></i>`;
    });
  }

  const otpInputs = rootEl.querySelectorAll('[data-otp] input');
  if (otpInputs.length) {
    otpInputs.forEach((input, idx) => {
      on(input, 'input', () => {
        if (input.value && otpInputs[idx+1]) otpInputs[idx+1].focus();
      });
      on(input, 'keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && otpInputs[idx-1]) otpInputs[idx-1].focus();
      });
    });
    on(rootEl.querySelector('[data-otp]'), 'paste', (e) => {
      const txt = e.clipboardData?.getData('text')?.replace(/\D/g,'').slice(0,6) ?? '';
      if (!txt) return;
      e.preventDefault();
      otpInputs.forEach((inp,i)=> inp.value = txt[i] ?? '');
      otpInputs[Math.min(txt.length,5)]?.focus();
    });
  }

  on(rootEl, 'click', (e) => {
    const demoBtn = e.target.closest('[data-lx-demo]');
    if (demoBtn) {
      e.preventDefault();
      if (email) email.value = DEMO.email;
      if (password) password.value = DEMO.password;
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      return;
    }
    const social = e.target.closest('[data-lx-social]');
    if (social) {
      e.preventDefault();
      if (email) email.value = DEMO.email;
      if (password) password.value = DEMO.password;
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      return;
    }
    const resend = e.target.closest('[data-resend]');
    if (resend) {
      toast.info('کد ارسال شد', 'کد جدید تا ۲ دقیقه دیگر می‌رسد.');
    }
  });

  if (form) {
    on(form, 'submit', async (ev) => {
      ev.preventDefault();
      let valid = true;
      if (email && !validEmail(email.value.trim())) {
        setError('email','ایمیل معتبر وارد کنید');
        valid = false;
      }
      if (password && password.value.length < 6 && normalized !== 'auth-forgot') {
        setError('password','رمز عبور حداقل ۶ کاراکتر');
        valid = false;
      }
      if (otpInputs.length) {
        const code = Array.from(otpInputs).map(i=>i.value).join('');
        if (code.length < 6) {
          toast.warning('کد ناقص است','کد ۶ رقمی را کامل وارد کنید');
          return;
        }
      }
      if (!valid) {
        toast.warning('فرم کامل نیست','فیلدها را بررسی کنید');
        return;
      }
      if (submit) {
        submit.classList.add('is-loading');
        submit.disabled = true;
      }
      const syncEmail = email ? email.value.trim() : 'demo@novaadmin.dev';
      {
        const { setSession } = await import('../core/auth.js');
        setSession({ email: syncEmail, name: 'سارا محمدی' });
      }
      try {
        if (services.authService?.login && email) {
          await services.authService.login({ email: email.value, password: password?.value ?? '' }).catch(()=>null);
        }
      } catch {}
      const successEl = rootEl.querySelector('[data-lx-success]');
      if (successEl) {
        successEl.hidden = false;
        rootEl.querySelector('[data-lx-card]')?.setAttribute('hidden','');
      }
      let target = 'dashboards/analytics.html';
      if (normalized === 'auth-register') target = 'auth/verify-email.html';
      else if (normalized === 'auth-forgot') target = 'auth/login.html';
      else if (normalized === 'auth-reset') target = 'auth/login.html';
      else if (normalized === 'auth-verify') target = 'dashboards/analytics.html';
      else if (normalized === 'auth-2fa') target = 'dashboards/analytics.html';
      else if (normalized === 'auth-lock') target = 'dashboards/analytics.html';
      const next = new URLSearchParams(window.location.search).get('next');
      const safeNext = next && /^[a-z0-9][a-z0-9./_-]*\.html$/i.test(next) && !/^\/\//.test(next) ? next : target;
      try { toast.success('موفق', 'در حال انتقال…'); } catch {}
      setTimeout(() => goTo(safeNext), 900);
    });
  }

  // FIX: Ensure all auth links work correctly - landing, login, etc
  // Fix topBar "صفحه اصلی" -> should go to landing (index.html)
  on(rootEl, 'click', (e) => {
    const backLink = e.target.closest('.lx-back, [data-lx-home]');
    if (backLink) {
      e.preventDefault();
      const href = backLink.getAttribute('href');
      if (href) {
        // Always go to landing page
        goTo('index.html');
      }
    }
    // Fix foot links like "بازگشت به ورود", "بازگشت به صفحه اصلی"
    const footLink = e.target.closest('.lx-foot a, .lx-card a[href*="login"], .lx-card a[href*="index"]');
    if (footLink && !footLink.hasAttribute('data-resend') && !footLink.hasAttribute('data-lx-social')) {
      const href = footLink.getAttribute('href');
      if (href && href.includes('login.html')) {
        e.preventDefault();
        goTo('auth/login.html');
      } else if (href && href.includes('index.html')) {
        e.preventDefault();
        goTo('index.html');
      } else if (href && href.includes('register.html')) {
        e.preventDefault();
        goTo('auth/register.html');
      }
    }
  });

  // Ensure fixLinks runs for auth pages
  try {
    const { fixLinks } = await import('../core/links.js');
    fixLinks(rootEl);
  } catch {}
}



/* ============================================================= system pages */

export async function initSystemPages() {
  const node = host();
  const page = kit.pageId();
  const name = page.split('/').pop().replace('.html', '');

  if (name === 'pricing') {
    const plans = await services.contentService.pricing();
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'پلن‌ها و قیمت‌گذاری', subtitle: 'پلن مناسب تیم خود را انتخاب کنید — تغییر پلن در هر زمان ممکن است', icon: 'tags' })}
        <div class="toggle-billing"><span>پرداخت ماهانه</span><label class="form-switch"><input type="checkbox" class="form-check-input" data-billing-toggle><span class="visually-hidden">پرداخت سالانه</span></label><span>پرداخت سالانه (۲۰٪ تخفیف)</span></div>
        <div class="pricing-grid" data-pricing-grid>${(plans ?? [])
          .map((raw) => {
            const plan = planView(raw);
            return `<article class="price-card ${plan.featured ? 'price-card--featured' : ''}">${plan.featured ? `<span class="price-card__badge">${escapeHtml(plan.badge || 'محبوب‌ترین')}</span>` : ''}
              <h3 class="price-card__name">${escapeHtml(plan.name)}</h3><p class="price-card__desc">${escapeHtml(plan.description)}</p>
              <p class="price-card__amount" data-price-monthly="${plan.price}" data-price-yearly="${plan.price * 10}">${formatNumber(plan.price)} تومان<span>/ ماه</span></p>
              <ul class="price-card__list">${plan.features
                .map(
                  (feature) => `<li class="${feature.included ? '' : 'is-excluded'}"><i class="bi ${feature.included ? 'bi-check2-circle' : 'bi-x-circle'}" aria-hidden="true"></i> ${escapeHtml(feature.text)}</li>`,
                )
                .join('')}</ul>
              <button class="btn ${plan.featured ? 'btn-primary' : 'btn-light'} w-100" type="button" data-choose-plan="${escapeHtml(plan.id)}">انتخاب پلن</button></article>`;
          })
          .join('')}</div>
        ${card({ title: 'مقایسه کامل', flush: true, body: compareTable(plans) })}
      </div>`,
    );
    on($('[data-billing-toggle]', node), 'change', (event) => {
      const yearly = event.target.checked;
      $$('[data-price-monthly]', node).forEach((price) => {
        const value = Number(yearly ? price.dataset.priceYearly : price.dataset.priceMonthly);
        price.innerHTML = `${formatNumber(value)} تومان<span>/ ${yearly ? 'سال' : 'ماه'}</span>`;
      });
    });
    on(node, 'click', (event) => {
      const plan = event.target.closest('[data-choose-plan]');
      if (!plan) return;
      modal.alert({ title: 'انتخاب پلن', text: 'برای ادامه، اطلاعات پرداخت باید ثبت شود. این مرحله در نسخه نمایشی غیرفعال است.', tone: 'primary' });
    });
    return;
  }

  if (name === 'faq') {
    const faq = await services.contentService.faq();
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'پرسش‌های متداول', subtitle: 'پاسخ سریع به رایج‌ترین سؤالات', icon: 'patch-question' })}
        ${card({ body: `<div class="faq-list">${faq
          .map(
            (item, index) => `<div class="accordion-item"><button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-accordion-toggle aria-expanded="${index === 0}">${escapeHtml(item.q ?? item.question)}<i class="bi bi-chevron-down"></i></button>
              <div class="accordion-body" data-accordion-body ${index === 0 ? '' : 'hidden'}><p>${escapeHtml(item.a ?? item.answer ?? '')}</p></div></div>`,
          )
          .join('')}</div>` })}
      </div>`,
    );
    return;
  }

  if (name === 'changelog') {
    const log = (await services.contentService.changelog()) ?? [];
    /** Type chips in a fixed, meaningful order with localized labels. */
    const TYPES = {
      added: { label: 'افزوده شد', icon: 'plus-circle' },
      improved: { label: 'بهبود', icon: 'stars' },
      changed: { label: 'تغییر', icon: 'arrow-repeat' },
      fixed: { label: 'رفع اشکال', icon: 'bug' },
      removed: { label: 'حذف شد', icon: 'dash-circle' },
    };
    const ORDER = ['fixed', 'improved', 'added', 'changed', 'removed'];
    const current = log[0];
    const totals = ORDER.map((type) => [type, (current?.items ?? []).filter((item) => (item.type ?? 'added') === type).length]).filter(([, count]) => count);
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'تغییرات نسخه‌ها',
          subtitle: 'تاریخچه کامل نسخه‌ها و تغییرات هر انتشار',
          icon: 'clipboard-data',
          badges: current ? [statusBadge(`نسخه فعلی ${current.version}`, 'primary')] : [],
        })}
        ${current ? `<div class="changelog-summary">${totals
          .map(([type, count]) => `<span class="changelog-type changelog-type--${type}"><i class="bi bi-${TYPES[type].icon}" aria-hidden="true"></i> ${toDigits(count)} ${TYPES[type].label}</span>`)
          .join('')}</div>` : ''}
        ${card({ body: log.length ? log
          .map((release, index) => {
            const items = release.items ?? [];
            const types = [...new Set(items.map((item) => item.type ?? 'added'))].sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99);
            const groups = release.groups ?? types.map((type) => ({ type, items: items.filter((item) => (item.type ?? 'added') === type) }));
            const date = /^[۰-۹0-9/:-]+$/.test(String(release.date ?? '')) ? release.date : formatDate(release.date, { format: 'medium' });
            return `<section class="changelog-item${index === 0 ? ' is-current' : ''}">
              <header class="changelog-item__head">
                <span class="changelog-item__version">v${escapeHtml(release.version)}</span>
                <span class="changelog-item__date"><i class="bi bi-calendar3" aria-hidden="true"></i> ${escapeHtml(toDigits(date ?? ''))}</span>
                ${release.badge ? statusBadge(release.badge, index === 0 ? 'success' : 'primary') : ''}
              </header>
              ${release.highlights ? `<p class="changelog-item__highlights">${escapeHtml(release.highlights)}</p>` : ''}
              ${groups
                .map((group) => {
                  const meta = TYPES[group.type] ?? { label: group.type, icon: 'dot' };
                  return `<h4 class="changelog-item__group"><span class="changelog-type changelog-type--${escapeHtml(group.type)}"><i class="bi bi-${meta.icon}" aria-hidden="true"></i> ${escapeHtml(meta.label)}</span></h4>
                  <ul class="checklist changelog-list changelog-list--${escapeHtml(group.type)}">${(group.items ?? []).map((item) => `<li><i class="bi bi-${meta.icon}" aria-hidden="true"></i><span>${escapeHtml(item.text ?? item)}</span></li>`).join('')}</ul>`;
                })
                .join('')}
            </section>`;
          })
          .join('') : emptyState({ icon: 'clock-history', title: 'هنوز نسخه‌ای ثبت نشده است' }) })}
      </div>`,
    );
    return;
  }

  if (name === 'status') {
    const overview = await services.statusService.overview();
    const STATE = {
      operational: { label: 'فعال', tone: 'success', dot: 'online' },
      degraded: { label: 'کندی', tone: 'warning', dot: 'warning' },
      down: { label: 'قطع', tone: 'danger', dot: 'danger' },
    };
    const INCIDENT = {
      investigating: { label: 'در حال بررسی', tone: 'warning' },
      identified: { label: 'شناسایی شد', tone: 'warning' },
      monitoring: { label: 'تحت نظر', tone: 'info' },
      resolved: { label: 'رفع شد', tone: 'success' },
    };
    const bars = (overview.uptimeBars ?? []).slice(-30);
    /** Per-service history: the shared timeline plus the service's own current state. */
    const history = (service) =>
      bars
        .map((bar, index) => {
          const state = index === bars.length - 1 && service.state !== 'operational' ? service.state : typeof bar === 'object' ? bar.state ?? 'operational' : 'operational';
          return `<span class="status-uptime__bar" data-state="${escapeHtml(state)}" title="${escapeHtml(STATE[state]?.label ?? state)}"></span>`;
        })
        .join('');
    const when = (value) => (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(value) ? value : relativeTime(value));
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'وضعیت سرویس‌ها', subtitle: `آپ‌تایم کلی ${toDigits(overview.uptime)}٪ در ۹۰ روز گذشته`, icon: 'activity', badges: [statusBadge(overview.overall === 'operational' ? 'همه سرویس‌ها فعال' : 'اختلال جزئی', overview.overall === 'operational' ? 'success' : 'warning')] })}
        ${card({
          title: 'سرویس‌ها',
          subtitle: `${toDigits(bars.length)} روز اخیر`,
          flush: true,
          body: `<div class="status-list">${(overview.services ?? [])
            .map((service) => {
              const meta = STATE[service.state] ?? STATE.operational;
              return `<div class="status-service${service.state !== 'operational' ? ' status-service--warning' : ''}">
                <div class="status-service__info">
                  <p class="status-service__name"><span class="status-dot status-dot--${meta.dot}"></span>${escapeHtml(service.name)}</p>
                  <p class="status-service__meta">${toDigits(formatNumber(service.response ?? service.latency ?? 0))} میلی‌ثانیه • ${toDigits(service.uptime)}٪ آپ‌تایم</p>
                </div>
                <div class="status-uptime" aria-label="تاریخچه ${toDigits(bars.length)} روز">${history(service)}</div>
                <span class="status-service__state">${statusBadge(meta.label, meta.tone)}</span>
              </div>`;
            })
            .join('')}</div>`,
        })}
        ${card({
          title: 'رویدادها',
          flush: true,
          body: `<ul class="list-group">${(overview.incidents ?? [])
            .map((incident) => {
              const meta = INCIDENT[incident.state] ?? INCIDENT.investigating;
              const updates = incident.updates ?? (incident.text ? [incident.text] : []);
              return `<li class="list-item status-incident"><span class="status-dot status-dot--${meta.tone === 'success' ? 'online' : 'warning'}"></span><span class="list-item__title">${escapeHtml(incident.title)}<span class="list-item__sub">${escapeHtml(updates[updates.length - 1] ?? '')}</span></span><span class="list-item__meta">${statusBadge(meta.label, meta.tone)}<small>${escapeHtml(toDigits(when(incident.at)))}</small></span></li>`;
            })
            .join('')}</ul>`,
        })}
      </div>`,
    );
    return;
  }

  if (name === 'help-center') {
    const [topics, articles] = await Promise.all([services.helpService.topics(), services.helpService.articles()]);
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'مرکز راهنما', subtitle: 'راهنمای گام‌به‌گام برای همه بخش‌های قالب', icon: 'life-preserver' })}
        <div class="grid grid--cards">${topics.map((topic) => `<article class="card card--interactive"><div class="card__body"><span class="tile tile--soft tile--icon"><i class="bi bi-${escapeHtml(topic.icon ?? 'book')}"></i></span><h3 class="card__title mt-2">${escapeHtml(topic.title)}</h3><p class="card__subtitle">${escapeHtml(topic.text ?? '')}</p><span class="badge badge--soft-primary">${toDigits(topic.count ?? 0)} مقاله</span></div></article>`).join('')}</div>
        ${card({ title: 'پرخواننده‌ترین مقاله‌ها', flush: true, body: `<ul class="list-group">${articles.slice(0, 8).map((article) => `<li class="list-item list-item--interactive"><i class="bi bi-file-earmark-text"></i><span class="list-item__title">${escapeHtml(article.title)}<span class="list-item__sub">${escapeHtml(article.topic ?? '')}</span></span><span class="list-item__meta"><button class="btn btn-soft-primary btn-sm" type="button" data-rate="${escapeHtml(article.id)}">مفید بود</button></span></li>`).join('')}</ul>` })}
      </div>`,
    );
    on(node, 'click', async (event) => {
      const rate = event.target.closest('[data-rate]');
      if (!rate) return;
      await services.helpService.rate(rate.dataset.rate, true);
      toast.success('ممنون از بازخورد شما', 'نظر شما ثبت شد.');
    });
    return;
  }

  if (name === 'contact') {
    const channels = await services.contentService.contact();
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'تماس با ما', subtitle: 'پرسش، پیشنهاد یا گزارش اشکال را برای ما بفرستید', icon: 'envelope-paper' })}
        <div class="grid grid--sidebar">
          ${card({ body: `<form data-contact-form class="form-stack" novalidate>${formMarkup([
            { name: 'name', label: 'نام و نام خانوادگی', required: true },
            { name: 'email', label: 'ایمیل', type: 'email', rule: 'email', required: true },
            { name: 'subject', label: 'موضوع', required: true, col: 2 },
            { name: 'message', label: 'متن پیام', type: 'textarea', rows: 6, col: 2, required: true },
            { name: 'copy', label: 'یک نسخه از پیام برای من ارسال شود', type: 'switch' },
          ])}<button class="btn btn-primary" type="submit" data-submit>ارسال پیام</button></form>` })}
          <div class="stack">${channels
            .map(
              (channel) => `<div class="integration-card"><span class="integration-card__logo"><i class="bi bi-${escapeHtml(channel.icon ?? 'envelope')}"></i></span><div class="integration-card__body"><strong class="integration-card__title">${escapeHtml(channel.title)}</strong><p class="integration-card__text">${escapeHtml(channel.value)}</p></div></div>`,
            )
            .join('')}</div>
        </div>
      </div>`,
    );
    on($('[data-contact-form]', node), 'submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const { validateForm } = await import('../core/form.js');
      if (!validateForm(form).valid) {
        toast.warning('فرم کامل نیست', 'فیلدهای الزامی را تکمیل کنید.');
        return;
      }
      const button = $('[data-submit]', form);
      button.classList.add('is-loading');
      try {
        await services.contentService.submitContact(collectValues(form));
        form.reset();
        toast.success('پیام ارسال شد', 'کارشناسان ما تا ۲۴ ساعت پاسخ می‌دهند.');
      } finally {
        button.classList.remove('is-loading');
      }
    });
    return;
  }

  if (name === 'terms' || name === 'privacy') {
    const sections = await services.contentService.legal(name === 'privacy' ? 'privacy' : 'terms');
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: name === 'privacy' ? 'سیاست حفظ حریم خصوصی' : 'قوانین و شرایط استفاده', subtitle: `آخرین به‌روزرسانی: ${formatDate(new Date(), { format: 'long' })}`, icon: 'file-earmark-lock' })}
        <div class="grid grid--sidebar">
          ${card({ body: `<div class="legal-body">${(sections ?? [])
            .map((section, index) => `<section><h2 id="legal-${index}">${escapeHtml(section.heading ?? section.title)}</h2><p>${escapeHtml(section.body ?? section.text ?? '')}</p></section>`)
            .join('')}</div>` })}
          ${card({ title: 'فهرست مطالب', body: `<div class="legal-toc">${(sections ?? []).map((section, index) => `<a href="#legal-${index}">${escapeHtml(section.heading ?? section.title)}</a>`).join('')}</div>` })}
        </div>
      </div>`,
    );
    return;
  }

  if (name === 'blank') {
    render(node, card({ body: emptyState({ title: 'صفحه خالی آماده سفارشی‌سازی', text: 'این صفحه فقط شامل شل قالب است تا محتوای خود را در آن قرار دهید.', icon: 'file-earmark', action: '<a class="btn btn-primary btn-sm" href="docs/structure.html">ساختار فایل‌ها</a>' }) }));
    return;
  }

  // Error pages: 404 / 403 / 500 / maintenance / offline / coming-soon
  const states = {
    404: {
      title: 'صفحه پیدا نشد',
      text: 'نشانی وارد شده وجود ندارد یا جابجا شده است. می‌توانید از جستجوی سراسری استفاده کنید یا به داشبورد بازگردید.',
      icon: 'compass',
      tone: 'primary',
      action: '<a class="btn btn-primary" href="index.html">بازگشت به داشبورد</a>',
      hints: ['نشانی را دوباره بررسی کنید', 'از جستجوی سراسری (Ctrl + K) استفاده کنید', 'اگر از یک لینک قدیمی آمده‌اید، از منوی کنار صفحه مسیر تازه را پیدا کنید'],
    },
    403: {
      title: 'دسترسی مجاز نیست',
      text: 'نقش کاربری فعال شما اجازه مشاهده این بخش را ندارد. در صورت نیاز، از مدیر سیستم بخواهید سطح دسترسی را تغییر دهد.',
      icon: 'shield-lock',
      tone: 'danger',
      action: '<a class="btn btn-primary" href="dashboards/analytics.html">بازگشت به داشبورد</a>',
      hints: ['نقش‌ها و سطوح دسترسی در بخش نقش‌ها مدیریت می‌شوند', 'برای بررسی نشست‌های فعال به امنیت پروفایل سر بزنید'],
    },
    500: {
      title: 'خطای سرور',
      text: 'مشکلی در پردازش درخواست رخ داد. رخداد به‌صورت خودکار ثبت شد؛ چند لحظه بعد دوباره تلاش کنید.',
      icon: 'bug',
      tone: 'danger',
      action: '<button class="btn btn-primary" type="button" data-retry-page>تلاش دوباره</button>',
      hints: ['وضعیت سرویس‌ها را از صفحه وضعیت پیگیری کنید', 'در صورت تکرار، شناسه رخداد را به پشتیبانی بدهید'],
    },
    maintenance: {
      title: 'در حال به‌روزرسانی',
      text: 'برای ارتقای سرویس، دسترسی موقتاً محدود شده است. داده‌های شما امن است و پس از پایان کار همه چیز به‌حالت عادی بازمی‌گردد.',
      icon: 'tools',
      tone: 'warning',
      action: '<a class="btn btn-primary" href="system/status.html">وضعیت سرویس‌ها</a>',
      hints: ['زمان‌بندی به‌روزرسانی در صفحه وضعیت منتشر می‌شود'],
    },
    offline: {
      title: 'اتصال اینترنت قطع است',
      text: 'دسترسی به شبکه برقرار نیست. پس از وصل شدن اتصال، داده‌های نمایشی به‌صورت خودکار همگام می‌شوند.',
      icon: 'wifi-off',
      tone: 'warning',
      action: '<button class="btn btn-primary" type="button" data-retry-page>بررسی دوباره</button>',
      hints: ['اتصال Wi‑Fi یا داده موبایل را بررسی کنید', 'فیلترشکن یا پروکسی سازمانی می‌تواند مانع اتصال باشد'],
    },
    'coming-soon': {
      title: 'به‌زودی رونمایی می‌شود',
      text: 'این بخش هیجان‌انگیز در حال توسعه و بهینه‌سازی نهایی است و به‌زودی در دسترس شما قرار می‌گیرد.',
      icon: 'rocket-takeoff-fill',
      tone: 'primary',
      code: 'SOON',
      action: '<a class="btn btn-primary" href="index.html"><i class="bi bi-house"></i> بازگشت به داشبورد</a>',
      hints: ['اطلاعیه انتشار در وبلاگ رسمی', 'می‌توانید برای دریافت ایمیل رونمایی ثبت‌نام کنید', 'پشتیبانی ۲۴ ساعته پاسخگوی سوالات شماست'],
    },
  };
  const state = states[name] ?? { ...states[404], code: name.match(/\d+/) ? name : '404' };

  if (name === 'coming-soon') {
    render(
      node,
      `<div class="dashboard-shell" style="max-width:800px; margin:40px auto; text-align:center;">
        <div class="card" style="border-radius:24px; padding:40px 24px; border:1px solid var(--nv-border); box-shadow:var(--nv-shadow-lg);">
          <div style="width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg, var(--nv-primary), #8b5cf6); color:#fff; display:grid; place-items:center; margin:0 auto 20px; font-size:32px; box-shadow:0 10px 25px rgba(99,102,241,0.3);">
            <i class="bi bi-rocket-takeoff"></i>
          </div>
          <h1 style="font-size:28px; font-weight:900; color:var(--nv-heading); margin-bottom:10px;">به‌زودی رونمایی می‌شود</h1>
          <p style="color:var(--nv-text-muted); font-size:14px; max-width:500px; margin:0 auto 30px; line-height:1.8;">ما در حال آماده‌سازی قابلیت‌های پیشرفته و شگفت‌انگیز جدیدی در این ماژول هستیم. زمان‌سنج زیر تا رونمایی رسمی معکوس می‌شمارد.</p>

          <div style="display:flex; justify-content:center; gap:16px; margin-bottom:36px; flex-wrap:wrap;">
            <div style="background:var(--nv-surface-2); border:1px solid var(--nv-border); border-radius:16px; padding:16px 20px; min-width:85px;">
              <div style="font-size:28px; font-weight:900; color:var(--nv-primary);" class="numeric">۱۴</div>
              <div style="font-size:11px; color:var(--nv-text-muted); font-weight:700;">روز</div>
            </div>
            <div style="background:var(--nv-surface-2); border:1px solid var(--nv-border); border-radius:16px; padding:16px 20px; min-width:85px;">
              <div style="font-size:28px; font-weight:900; color:var(--nv-primary);" class="numeric">۰۸</div>
              <div style="font-size:11px; color:var(--nv-text-muted); font-weight:700;">ساعت</div>
            </div>
            <div style="background:var(--nv-surface-2); border:1px solid var(--nv-border); border-radius:16px; padding:16px 20px; min-width:85px;">
              <div style="font-size:28px; font-weight:900; color:var(--nv-primary);" class="numeric">۴۵</div>
              <div style="font-size:11px; color:var(--nv-text-muted); font-weight:700;">دقیقه</div>
            </div>
            <div style="background:var(--nv-surface-2); border:1px solid var(--nv-border); border-radius:16px; padding:16px 20px; min-width:85px;">
              <div style="font-size:28px; font-weight:900; color:var(--nv-primary);" class="numeric">۲۳</div>
              <div style="font-size:11px; color:var(--nv-text-muted); font-weight:700;">ثانیه</div>
            </div>
          </div>

          <form class="input-group" style="max-width:440px; margin:0 auto 24px;" data-coming-soon-form>
            <input class="form-control" type="email" placeholder="ایمیل خود را وارد کنید..." required>
            <button class="btn btn-primary" type="submit">خبرم کن</button>
          </form>

          <div><a class="btn btn-light btn-sm" href="index.html"><i class="bi bi-arrow-right"></i> بازگشت به صفحه اصلی</a></div>
        </div>
      </div>`,
    );
    on($('[data-coming-soon-form]', node), 'submit', (e) => {
      e.preventDefault();
      toast.success('ایمیل شما ثبت شد', 'به محض رونمایی اطلاع‌رسانی خواهیم کرد.');
    });
    return;
  }

  if (name === 'maintenance') {
    render(
      node,
      `<div class="dashboard-shell" style="max-width:760px; margin:40px auto; text-align:center;">
        <div class="card" style="border-radius:24px; padding:40px 24px; border:1px solid var(--nv-border);">
          <div style="width:72px; height:72px; border-radius:20px; background:rgba(245, 158, 11, 0.15); color:var(--nv-warning); display:grid; place-items:center; margin:0 auto 20px; font-size:32px;">
            <i class="bi bi-tools"></i>
          </div>
          <h1 style="font-size:26px; font-weight:900; color:var(--nv-heading); margin-bottom:10px;">در حال ارتقا و نگهداری سیستم</h1>
          <p style="color:var(--nv-text-muted); font-size:14px; max-width:480px; margin:0 auto 24px; line-height:1.8;">پایگاه داده و سرورهای پردازشی پلتفرم در حال به‌روزرسانی امنیتی هستند. داده‌های شما امن است و تا دقایقی دیگر سیستم به حالت عادی بازمی‌گردد.</p>

          <div style="max-width:420px; margin:0 auto 30px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:8px;">
              <span>پیشرفت عملیات</span>
              <span class="text-warning numeric">۷۸٪</span>
            </div>
            <div class="progress" style="height:8px; border-radius:999px;">
              <div class="progress-bar progress-bar--warning progress-bar--striped progress-bar--animated" style="width:78%;"></div>
            </div>
            <small style="color:var(--nv-text-muted); font-size:11px; display:block; margin-top:6px;">زمان تقریبی باقیمانده: ۳۰ دقیقه</small>
          </div>

          <div class="d-flex justify-content-center gap-2">
            <button class="btn btn-primary btn-sm" type="button" data-retry-page><i class="bi bi-arrow-clockwise"></i> بررسی وضعیت</button>
            <a class="btn btn-light btn-sm" href="system/status.html">پایش سرورها</a>
          </div>
        </div>
      </div>`,
    );
    on($('[data-retry-page]', node), 'click', () => {
      toast.info('بررسی برقراری سرور...');
      setTimeout(() => window.location.reload(), 600);
    });
    return;
  }

  // General 404, 500, 403 error pages
  render(
    node,
    `<div class="dashboard-shell" style="max-width:840px; margin:30px auto; text-align:center;">
      <div class="card mb-4" style="border-radius:24px; padding:44px 24px; border:1px solid var(--nv-border); position:relative; overflow:hidden;">
        <div style="font-size:84px; font-weight:900; line-height:1; letter-spacing:-2px; background:linear-gradient(135deg, var(--nv-${state.tone}), #8b5cf6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:12px;" class="numeric">
          ${escapeHtml(state.code || name)}
        </div>
        <h1 style="font-size:24px; font-weight:900; color:var(--nv-heading); margin-bottom:10px;">${escapeHtml(state.title)}</h1>
        <p style="color:var(--nv-text-muted); font-size:14px; max-width:520px; margin:0 auto 28px; line-height:1.8;">${escapeHtml(state.text)}</p>

        <form class="input-group" data-error-search style="max-width:380px; margin:0 auto 28px;">
          <input class="form-control" type="search" placeholder="جستجوی سریع بین صفحات پلتفرم..." aria-label="جستجو">
          <button class="btn btn-primary" type="submit"><i class="bi bi-search"></i></button>
        </form>

        <div class="d-flex gap-2 justify-content-center flex-wrap">
          ${state.action}
          <a class="btn btn-light" href="system/help-center.html"><i class="bi bi-life-preserver"></i> مرکز راهنما</a>
          <a class="btn btn-light" href="system/contact.html"><i class="bi bi-envelope"></i> تماس با پشتیبانی</a>
        </div>
      </div>

      <div class="grid grid--3">
        ${(state.hints ?? []).map((hint, index) => statCard({ label: `راهکار ${toDigits(index + 1)}`, value: `<span class="fs-body">${escapeHtml(hint)}</span>`, icon: ['check2-circle', 'search', 'headset'][index % 3], tone: ['success', 'info', 'primary'][index % 3] })).join('')}
      </div>
    </div>`,
  );
  on($('[data-retry-page]', node), 'click', () => {
    toast.info('بررسی دوباره', 'در حال تلاش برای اتصال…');
    setTimeout(() => window.location.reload(), 600);
  });
  on($('[data-error-search]', node), 'submit', (event) => {
    event.preventDefault();
    const value = $('input', event.currentTarget).value.trim();
    if (value) goTo(`search.html?q=${encodeURIComponent(value)}`);
  });
}

function compareTable(plans) {
  const views = (plans ?? []).map(planView);
  /* Compare by the feature text: the same feature is a different object in each
     plan, so identity (`.includes`) never matched and every cell showed a tick. */
  const features = [...new Set(views.flatMap((plan) => plan.features.map((feature) => feature.text)))];
  const holds = (plan, text) => plan.features.some((feature) => feature.text === text && feature.included);
  return `<div class="table-wrap"><table class="table table--bordered compare-table"><thead><tr><th>ویژگی</th>${views
    .map((plan) => `<th class="text-center">${escapeHtml(plan.name)}</th>`)
    .join('')}</tr></thead>
    <tbody>${features
      .map(
        (text) => `<tr><th scope="row">${escapeHtml(text)}</th>${views
          .map(
            (plan) => `<td class="text-center">${
              holds(plan, text) ? '<i class="bi bi-check2-circle text-success"></i><span class="visually-hidden">دارد</span>' : '<i class="bi bi-dash text-muted"></i><span class="visually-hidden">ندارد</span>'
            }</td>`,
          )
          .join('')}</tr>`,
      )
      .join('')}</tbody></table></div>`;
}

/* ================================================================ widgets */

/**
 * `widgets.html` — the widget catalogue. Every card uses the same helpers the
 * dashboards use, so it doubles as a copy-paste reference for customers.
 */
export async function initWidgetsPage() {
  const node = host();
  const [kpis, series, activity, tasks, tickets] = await Promise.all([
    services.analyticsService.kpis('overview'),
    services.analyticsService.revenue({ range: '12m' }).catch(() => null),
    services.activityService.list({ perPage: 6 }),
    services.taskService.list({ perPage: 5 }),
    services.ticketService.list({ perPage: 4 }),
  ]);

  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: 'کتابخانه ابزارک‌ها',
        subtitle: 'ابزارک‌های آماده داشبورد — همه با داده نمونه واقعی و قابل کپی در صفحات شما',
        icon: 'grid-1x2',
        actions: `${toolButtons({})}<button class="btn btn-light" type="button" data-widget-edit><i class="bi bi-sliders"></i> شخصی‌سازی چیدمان</button>`,
      })}
      <div data-widget-editor hidden></div>
      <div class="kpi-row">${kpiCards(kpis)}</div>

      <div class="widget-grid" id="widget-grid" data-widget-grid>
        <section class="card" data-widget="revenue-chart" data-widget-title="نمودار درآمد">
          <header class="card__head"><div><h2 class="card__title">نمودار درآمد ۱۲ ماه</h2><p class="card__subtitle">ناحیه‌ای با گرادیان پالت فعال</p></div>
            <div class="card__actions">${toolButtons({})}</div></header>
          <div class="card__body">${chartBox({ key: 'widget-revenue', type: 'area', height: 300, series: [{ name: 'درآمد', data: series?.series?.[0]?.data ?? [42, 58, 51, 74, 63, 88, 71, 96, 82, 104, 92, 118] }], labels: series?.labels ?? months })}</div>
        </section>

        <section class="card" data-widget="device-split" data-widget-title="دستگاه‌ها">
          <header class="card__head"><div><h2 class="card__title">سهم دستگاه‌ها</h2><p class="card__subtitle">موبایل در صدر ترافیک ورودی</p></div></header>
          <div class="card__body">${chartBox({ key: 'widget-devices', type: 'donut', height: 300, series: [58, 31, 11], labels: ['موبایل', 'دسکتاپ', 'تبلت'] })}</div>
        </section>

        <section class="card" data-widget="progress-goals" data-widget-title="اهداف">
          <header class="card__head"><div><h2 class="card__title">پیشرفت اهداف فصل</h2><p class="card__subtitle">سه شاخص کلیدی فروش</p></div></header>
          <div class="card__body">
            ${[['درآمد هدف', 78, 'success'], ['مشتری جدید', 54, 'primary'], ['نرخ تمدید', 91, 'info']]
              .map(
                ([label, value, tone]) => `<div class="mb-4"><div class="d-flex justify-content-between mb-2"><span class="fs-caption">${label}</span><strong class="numeric">${formatPercent(value, { decimals: 0 })}</strong></div>
                  <div class="progress progress--sm"><div class="progress-bar progress-bar--${tone}" style="width:${value}%"></div></div></div>`,
              )
              .join('')}
          </div>
        </section>

        <section class="card" data-widget="activity-feed" data-widget-title="فعالیت‌ها">
          <header class="card__head"><div><h2 class="card__title">فعالیت‌های اخیر</h2><p class="card__subtitle">رویدادهای زنده سیستم</p></div>
            <div class="card__actions"><a class="btn btn-light btn-sm" href="users/activity.html">همه فعالیت‌ها</a></div></header>
          <div class="card__body">${timeline(
            activity.items.map((item) => ({ title: item.title, text: item.text ?? '', time: relativeTime(item.at), tone: item.tone ?? 'primary', icon: item.icon ?? 'activity' })),
            { compact: true },
          )}</div>
        </section>

        <section class="card" data-widget="task-list" data-widget-title="تسک‌ها">
          <header class="card__head"><div><h2 class="card__title">تسک‌های جاری</h2><p class="card__subtitle">مرتب‌شده بر اساس اولویت</p></div>
            <div class="card__actions"><a class="btn btn-light btn-sm" href="projects/tasks.html">همه تسک‌ها</a></div></header>
          <div class="card__body">
            <ul class="list-group list-group--flush">${tasks.items
              .map(
                (task) => `<li class="list-group__item list-item list-item--interactive">
                  <span class="form-check"><input class="form-check-input" type="checkbox" ${task.status === 'done' ? 'checked' : ''} aria-label="${escapeHtml(task.title)}"></span>
                  <div class="list-item__body"><span class="list-item__title">${escapeHtml(task.title)}</span><small class="list-item__sub">${escapeHtml(task.assignee ?? '')}</small></div>
                  ${statusBadge(task.priorityLabel ?? task.priority ?? 'متوسط', task.priority === 'high' ? 'danger' : 'neutral')}</li>`,
              )
              .join('')}</ul>
          </div>
        </section>

        <section class="card" data-widget="ticket-queue" data-widget-title="صف تیکت‌ها">
          <header class="card__head"><div><h2 class="card__title">صف پشتیبانی</h2><p class="card__subtitle">تیکت‌های در انتظار پاسخ</p></div>
            <div class="card__actions"><a class="btn btn-light btn-sm" href="support/tickets.html">همه تیکت‌ها</a></div></header>
          <div class="card__body">
            <div class="table-responsive"><table class="table table--hover"><thead><tr><th>موضوع</th><th>اولویت</th><th class="text-end">آخرین به‌روزرسانی</th></tr></thead>
              <tbody>${tickets.items
                .map(
                  (ticket) => `<tr><td class="table__primary"><a class="table__link" href="support/ticket-details.html?id=${encodeURIComponent(ticket.id)}">${escapeHtml(ticket.subject)}</a></td>
                    <td>${statusBadge(ticket.priorityLabel ?? 'عادی', ticket.priority === 'high' ? 'danger' : 'neutral')}</td><td class="text-end">${relativeTime(ticket.updatedAt ?? ticket.createdAt)}</td></tr>`,
                )
                .join('')}</tbody></table></div>
          </div>
        </section>

        <section class="card" data-widget="quick-actions" data-widget-title="دسترسی سریع">
          <header class="card__head"><div><h2 class="card__title">دسترسی سریع</h2><p class="card__subtitle">عملیات و میان‌برهای پرکاربرد روزانه</p></div></header>
          <div class="card__body">
            <div class="nv-quick-grid">
              <a class="nv-quick-card" href="ecommerce/product-create.html">
                <span class="nv-quick-card__icon nv-quick-card__icon--primary"><i class="bi bi-box-seam"></i></span>
                <div class="nv-quick-card__content">
                  <span class="nv-quick-card__title">افزودن محصول</span>
                  <span class="nv-quick-card__desc">ثبت کالا و انبارداری</span>
                </div>
                <i class="bi bi-arrow-left nv-quick-card__arrow"></i>
              </a>
              <a class="nv-quick-card" href="finance/invoices.html">
                <span class="nv-quick-card__icon nv-quick-card__icon--success"><i class="bi bi-receipt"></i></span>
                <div class="nv-quick-card__content">
                  <span class="nv-quick-card__title">فاکتور جدید</span>
                  <span class="nv-quick-card__desc">صدور آنی صورت‌حساب</span>
                </div>
                <i class="bi bi-arrow-left nv-quick-card__arrow"></i>
              </a>
              <a class="nv-quick-card" href="users/create.html">
                <span class="nv-quick-card__icon nv-quick-card__icon--info"><i class="bi bi-person-plus"></i></span>
                <div class="nv-quick-card__content">
                  <span class="nv-quick-card__title">کاربر جدید</span>
                  <span class="nv-quick-card__desc">تعریف نقش و سطح دسترسی</span>
                </div>
                <i class="bi bi-arrow-left nv-quick-card__arrow"></i>
              </a>
              <a class="nv-quick-card" href="ai/chat.html">
                <span class="nv-quick-card__icon nv-quick-card__icon--warning"><i class="bi bi-stars"></i></span>
                <div class="nv-quick-card__content">
                  <span class="nv-quick-card__title">دستیار هوش مصنوعی</span>
                  <span class="nv-quick-card__desc">گفتگوی تحلیلی و پرامپت‌ها</span>
                </div>
                <i class="bi bi-arrow-left nv-quick-card__arrow"></i>
              </a>
              <a class="nv-quick-card" href="cms/post-create.html">
                <span class="nv-quick-card__icon nv-quick-card__icon--violet"><i class="bi bi-pencil-square"></i></span>
                <div class="nv-quick-card__content">
                  <span class="nv-quick-card__title">نوشته جدید</span>
                  <span class="nv-quick-card__desc">انتشار مقاله و بهینه‌سازی سئو</span>
                </div>
                <i class="bi bi-arrow-left nv-quick-card__arrow"></i>
              </a>
              <a class="nv-quick-card" href="support/tickets.html">
                <span class="nv-quick-card__icon nv-quick-card__icon--danger"><i class="bi bi-headset"></i></span>
                <div class="nv-quick-card__content">
                  <span class="nv-quick-card__title">تیکت‌های مشتریان</span>
                  <span class="nv-quick-card__desc">پاسخ‌گویی به درخواست‌های جاری</span>
                </div>
                <i class="bi bi-arrow-left nv-quick-card__arrow"></i>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>`,
  );

  initCharts(node);
}

export default { initLanding, initPreview, initSearchResults, initDocs, initSettings, initProfile, initAuth, initSystemPages, initWidgetsPage };
