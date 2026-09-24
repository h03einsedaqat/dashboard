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

  wireLandingHeader(node);
  initMarquee(node);
  initHeroShowcase(node);
  initFaqControls(node);

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
  return `assets/img/previews/${id}-${mode}.svg`;
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

  const items = SHOWCASE.map((entry) => ({ ...entry, url: `dashboards/${entry.id}.html` }));
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
          chip.textContent = `${first.delta >= 0 ? '+' : '−'}${toDigits(Math.abs(first.delta))}٪ ${escapeHtml(first.label)}`;
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
        <source type="image/svg+xml" srcset="${escapeHtml(previewSrc(item.id))}" />
        <img id="${id}" data-preview-id="${escapeHtml(item.id)}" src="${escapeHtml(previewSrc(item.id))}" width="1600" height="1000" alt="پیش‌نمایش ${escapeHtml(item.title)} در ${config.appName}" decoding="async" />
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
    .map((demo) => {
      const meta = SHOWCASE.find((entry) => entry.id === demo.id) ?? {};
      const extra = extras.get(demo.id) ?? {};
      const label = demo.label?.fa ?? demo.id;
      return `<div class="col-sm-6 col-xl-4">
        <article class="landing-demo-card" data-reveal>
          <a class="landing-demo-card__media" href="${escapeHtml(demo.url ?? `dashboards/${demo.id}.html`)}" aria-label="باز کردن داشبورد ${escapeHtml(label)}">
            <picture>
              <source type="image/svg+xml" srcset="${escapeHtml(previewSrc(demo.id))}" />
              <img data-preview-id="${escapeHtml(demo.id)}" src="${escapeHtml(previewSrc(demo.id))}" width="1600" height="1000" loading="lazy" decoding="async" alt="پیش‌نمایش داشبورد ${escapeHtml(label)} — ${escapeHtml(meta.text ?? '')}" />
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
  const layouts = [
    { value: 'sidebar', icon: 'layout-sidebar-inset', title: 'سایدبار (پیش‌فرض)', text: 'ستون کناری باز با زیرمنوی آکاردئونی.' },
    { value: 'mini', icon: 'layout-sidebar', title: 'مینی', text: 'فقط آیکن‌ها؛ با هاور، نام منو نمایان می‌شود.' },
    { value: 'collapse', icon: 'list-nested', title: 'جمع‌شونده', text: 'سایدبار باریک با ریل آیکن و حالت کشویی.' },
    { value: 'horizontal', icon: 'menu-button-wide', title: 'افقی', text: 'منوی بالای صفحه با گروه‌های بازشو — بدون ستون کناری.' },
    { value: 'twocol', icon: 'columns-gap', title: 'دو ستونی', text: 'ریل آیکن + پنل دوم برای زیرمENU گروه فعال.' },
    { value: 'boxed', icon: 'border', title: 'باکس‌دار', text: 'همان چیدمان داخل یک قاب با عرض محدود.' },
  ];
  const current = theme.snapshot?.()?.layout ?? 'default';
  const isOn = (value) => (value === 'sidebar' ? current === 'default' || current === 'sidebar' : current === value);
  return layouts
    .map(
      (layout) => `<button class="landing-layout${isOn(layout.value) ? ' is-active' : ''}" type="button" data-layout-option="${escapeHtml(layout.value)}" aria-pressed="${isOn(layout.value)}">
        <span class="landing-layout__head">
          <i class="bi bi-${escapeHtml(layout.icon)}" aria-hidden="true"></i>
          <span class="landing-layout__title">${escapeHtml(layout.title)}</span>
          <i class="bi bi-check2-circle landing-layout__check" aria-hidden="true"></i>
        </span>
        <span class="landing-layout__preview" aria-hidden="true"><i></i><i></i></span>
        <span class="landing-layout__text">${escapeHtml(layout.text)}</span>
      </button>`,
    )
    .join('');
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

async function landingPricing() {
  const plans = await services.contentService.pricing();
  return (plans ?? [])
    .map(
      (plan) => `<article class="landing-plan${plan.featured ? ' landing-plan--featured' : ''}">
        ${plan.featured ? '<span class="landing-plan__flag">پیشنهاد ما</span>' : ''}
        <header><h3 class="landing-plan__name">${escapeHtml(plan.name ?? plan.title)}</h3><p class="landing-plan__tagline">${escapeHtml(plan.tagline ?? plan.text ?? '')}</p></header>
        <p class="landing-plan__price">${escapeHtml(plan.price ?? '')}${plan.period ? `<small>${escapeHtml(plan.period)}</small>` : ''}</p>
        <ul class="landing-plan__list">${(plan.features ?? plan.items ?? []).map((feature) => `<li><i class="bi bi-check2" aria-hidden="true"></i> ${escapeHtml(feature)}</li>`).join('')}</ul>
        <a class="btn ${plan.featured ? 'btn-light' : 'btn-primary'}" href="auth/register.html">${escapeHtml(plan.cta ?? 'خرید و دانلود')}</a>
      </article>`,
    )
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

  const navHost = $('[data-docs-nav]');
  if (navHost && nav?.length) {
    render(
      navHost,
      nav
        .map(
          (group) => `<div class="docs-nav__group"><p class="docs-nav__label">${escapeHtml(group.title)}</p><ul class="list-group">${group.items
            .map((item) => `<li><a class="files-nav__link ${item.url === page ? 'is-active' : ''}" href="${escapeHtml(item.url)}"><i class="bi bi-file-earmark-text"></i><span>${escapeHtml(item.title)}</span></a></li>`)
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
          render($('[data-docs-nav]'), '');
          return;
        }
        const found = await searchService.search(term, { limit: 10 });
        render(
          $('[data-docs-nav]'),
          `<p class="docs-nav__label">نتایج جستجو</p><ul class="list-group">${found.items
            .map((item) => `<li><a class="files-nav__link" href="${escapeHtml(item.url)}"><i class="bi bi-search"></i><span>${escapeHtml(item.title)}</span></a></li>`)
            .join('') || '<li class="list-item text-muted">نتیجه‌ای یافت نشد</li>'}</ul>`,
        );
      }, 220),
    );
  }

  const toc = $('[data-docs-toc]');
  if (toc) {
    $$('h2, h3', node).forEach((heading) => {
      heading.id = heading.id || heading.textContent.trim().replace(/\s+/g, '-').slice(0, 40);
      toc.insertAdjacentHTML('beforeend', `<a class="docs-toc__link ${heading.tagName === 'H3' ? 'is-sub' : ''}" href="#${heading.id}">${escapeHtml(heading.textContent.trim())}</a>`);
    });
  }

  const pager = $('[data-docs-pager]');
  if (pager) {
    render(
      pager,
      `<div class="docs-pager">
        ${info?.prev ? `<a class="btn btn-light" href="${escapeHtml(info.prev)}"><i class="bi bi-arrow-right"></i> قبلی</a>` : '<span></span>'}
        ${info?.next ? `<a class="btn btn-primary" href="${escapeHtml(info.next)}">بعدی <i class="bi bi-arrow-left"></i></a>` : '<span></span>'}
      </div>`,
    );
  }

  $$('[data-copy]').forEach((button) =>
    on(button, 'click', async () => {
      const pre = button.closest('.code-block')?.querySelector('code');
      if (!pre) return;
      await navigator.clipboard?.writeText(pre.textContent);
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
  const titles = {
    general: 'تنظیمات عمومی',
    appearance: 'ظاهر و تم',
    layout: 'چیدمان',
    localization: 'بومی‌سازی',
    notifications: 'اعلان‌ها',
    security: 'امنیت',
    integrations: 'یکپارچه‌سازی‌ها',
    email: 'ایمیل',
    api: 'API',
    billing: 'صورتحساب',
    system: 'سیستم',
  };
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: titles[section] ?? 'تنظیمات',
        subtitle: 'تغییرات بلافاصله ذخیره و اعمال می‌شوند',
        icon: 'gear',
        badges: [statusBadge('آخرین ذخیره: همین حالا', 'success')],
        actions: '<a class="btn btn-light" href="settings/appearance.html"><i class="bi bi-palette2"></i> ظاهر</a><a class="btn btn-light" href="settings/api.html"><i class="bi bi-plug"></i> API</a>',
      })}
      <div class="grid grid--sidebar">
        <section class="card">
          <header class="card__head">
            <div>
              <h2 class="card__title">${escapeHtml(titles[section] ?? 'تنظیمات')}</h2>
              <p class="card__subtitle">${escapeHtml(settingsIntro[section] ?? 'سازگار با RTL، تقویم شمسی و ارقام فارسی')}</p>
            </div>
            <div class="card__actions">${statusBadge(`بخش ${escapeHtml(section)}`, 'neutral')}</div>
          </header>
          <div class="card__body">
            <form data-settings-form="${escapeHtml(section)}" novalidate>
              ${formMarkup(settingsFields(section, values), values ?? {}, { wide: true })}
              <div class="form-actions form-actions--end">
                <button class="btn btn-light" type="reset"><i class="bi bi-arrow-counterclockwise"></i> بازنشانی</button>
                <button class="btn btn-primary" type="submit"><i class="bi bi-check2"></i> ذخیره تنظیمات</button>
              </div>
            </form>
          </div>
        </section>

        <div class="dashboard-shell">
          ${card({
            title: 'مقدارهای فعلی',
            subtitle: 'خروجی سرویس تنظیمات، همان چیزی که صفحه می‌خواند',
            body: `<div class="info-rows">${Object.entries(values ?? {})
              .slice(0, 8)
              .map(([key, value]) => infoRows([[key, `<span class="numeric">${escapeHtml(typeof value === 'boolean' ? (value ? 'فعال' : 'غیرفعال') : String(value ?? '—'))}</span>`]]))
              .join('')}</div>`,
          })}
          ${card({
            title: 'نکته‌های این بخش',
            body: `<ul class="checklist">${(settingsTips[section] ?? settingsTips.general).map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`,
          })}
          ${card({
            title: 'تنظیمات مرتبط',
            body: `<div class="demo-token-list">${[
              ['general', 'عمومی', 'gear'],
              ['appearance', 'ظاهر و تم', 'palette2'],
              ['localization', 'بومی‌سازی', 'translate'],
              ['notifications', 'اعلان‌ها', 'bell'],
              ['security', 'امنیت', 'shield-check'],
              ['api', 'API', 'plug'],
            ]
              .filter(([id]) => id !== section)
              .map(([id, label, icon]) => `<a class="demo-token" href="settings/${id}.html"><span class="tile tile--soft tile--icon"><i class="bi bi-${icon}"></i></span><span>${label}</span><i class="bi bi-chevron-left ms-auto"></i></a>`)
              .join('')}</div>`,
          })}
        </div>
      </div>
    </div>`,
  );

  const form = $('[data-settings-form]', node);
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
      { name: 'direction', label: 'جهت پیش‌فرض', type: 'select', options: [{ value: 'rtl', label: 'راست‌به‌چپ' }, { value: 'ltr', label: 'چپ‌به‌راست' }] },
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
  const user = (await services.userService.list({ perPage: 1 })).items[0];
  const section = kit.pageId().split('/').pop().replace('.html', '');
  render(
    node,
    `<div class="dashboard-shell">
      ${card({
        body: `<div class="profile-head">
          <img class="profile-head__avatar" src="${escapeHtml(user.avatar)}" alt="">
          <div class="profile-head__meta"><h1 class="profile-head__name">${escapeHtml(user.name)}</h1><p class="profile-head__role">${escapeHtml(user.roleLabel ?? 'مدیر ارشد')} • ${escapeHtml(user.team ?? '')}</p>
            <div class="badge-dot-list">${statusBadge('فعال', 'success')}${statusBadge(user.email, 'info')}</div></div>
          <div class="ms-auto d-flex gap-2"><button class="btn btn-light" type="button" data-change-avatar><i class="bi bi-camera"></i> تغییر تصویر</button><button class="btn btn-primary" type="button" data-save-profile><i class="bi bi-check2"></i> ذخیره</button></div>
        </div>`,
      })}
      ${tabs([
        { id: 'overview', label: 'نمای کلی', icon: 'person', body: profileOverview(user) },
        { id: 'activity', label: 'فعالیت‌ها', icon: 'activity', body: card({ title: 'آخرین فعالیت‌ها', body: profileActivity() }) },
        { id: 'security', label: 'امنیت', icon: 'shield-lock', body: profileSecurity() },
        { id: 'sessions', label: 'نشست‌ها', icon: 'laptop', body: card({ title: 'دستگاه‌های فعال', flush: true, body: '<div data-session-list>' + kit.skeleton(3) + '</div>' }) },
        { id: 'notifications', label: 'اعلان‌ها', icon: 'bell', body: card({ title: 'اولویت‌های اعلان', body: '<div data-pref-list>' + kit.skeleton(3) + '</div>' }) },
        { id: 'documents', label: 'اسناد', icon: 'folder2', body: card({ title: 'اسناد شخصی', flush: true, body: '<ul class="list-group"><li class="list-item"><i class="bi bi-file-earmark-text"></i><span class="list-item__title">قرارداد همکاری.pdf<span class="list-item__sub">۲۴۰ کیلوبایت</span></span></li><li class="list-item"><i class="bi bi-file-earmark-text"></i><span class="list-item__title">فیش حقوقی-مهر.pdf<span class="list-item__sub">۱۸۰ کیلوبایت</span></span></li></ul>' }) },
        { id: 'projects', label: 'پروژه‌ها', icon: 'kanban', body: '<div data-profile-projects>' + kit.skeleton(2) + '</div>' },
        { id: 'invoices', label: 'فاکتورها', icon: 'receipt', body: '<div data-profile-invoices>' + kit.skeleton(2) + '</div>' },
        { id: 'keys', label: 'کلیدهای API', icon: 'key', body: '<div data-profile-keys>' + kit.skeleton(2) + '</div>' },
      ])}
    </div>`,
  );
  initCharts(node);

  const sessionHost = $('[data-session-list]', node);
  if (sessionHost) {
    const sessions = await services.sessionService.list();
    render(sessionHost, `<ul class="list-group">${(sessions.items ?? sessions).map((session) => `<li class="list-item"><span class="tile tile--soft tile--icon"><i class="bi bi-${session.device === 'موبایل' ? 'phone' : 'laptop'}"></i></span><span class="list-item__title">${escapeHtml(session.browser ?? '')}<span class="list-item__sub">${escapeHtml(session.location ?? '')} • ${escapeHtml(session.ip ?? '')}</span></span><span class="list-item__meta">${relativeTime(session.lastSeen)}<button class="btn btn-ghost btn-sm" type="button" data-revoke-session="${escapeHtml(session.id)}">پایان</button></span></li>`).join('')}</ul>`);
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
      { name: 'email', label: 'اعلان ایمیلی', type: 'switch', value: true },
      { name: 'push', label: 'اعلان مرورگر', type: 'switch', value: true },
      { name: 'sms', label: 'پیامک رویدادهای امنیتی', type: 'switch', value: false },
      { name: 'weekly', label: 'خلاصه هفتگی', type: 'switch', value: true },
    ]));
  }
  on(node, 'click', async (event) => {
    if (event.target.closest('[data-change-avatar]')) {
      modal.open({
        title: 'تغییر تصویر پروفایل',
        content: `<div class="avatar-upload"><img class="avatar-upload__preview" src="${escapeHtml(user.avatar)}" alt=""><div class="avatar-upload__actions"><label class="btn btn-light"><i class="bi bi-upload"></i> انتخاب فایل<input type="file" hidden accept="image/*"></label><button class="btn btn-soft-danger" type="button" data-remove-avatar><i class="bi bi-trash3"></i> حذف</button></div></div>`,
        footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-save-avatar>ذخیره تصویر</button>',
        onMount: (panel) => on($('[data-save-avatar]', panel), 'click', () => {
          toast.success('تصویر ذخیره شد', 'تصویر پروفایل به‌روزرسانی شد.');
          modal.closeTop();
        }),
      });
      return;
    }
    if (event.target.closest('[data-save-profile]')) {
      toast.success('پروفایل ذخیره شد', `بخش «${section}» به‌روزرسانی شد.`);
    }
  });

  const projectsHost = $('[data-profile-projects]', node);
  if (projectsHost) {
    const projects = await services.projectService.list({ perPage: 4 });
    render(projectsHost, card({ title: 'پروژه‌های من', flush: true, body: `<ul class="list-group">${(projects.items ?? projects).map((project) => `<li class="list-item"><span class="list-item__title">${escapeHtml(project.name)}<span class="list-item__sub">${escapeHtml(project.client ?? '')}</span></span><span class="list-item__meta"><div class="progress progress--sm" style="min-width:7rem"><div class="progress-bar" style="width:${project.progress ?? 0}%"></div></div>${toDigits(project.progress ?? 0)}٪</span></li>`).join('')}</ul>` }));
  }
  const invoiceHost = $('[data-profile-invoices]', node);
  if (invoiceHost) {
    const invoices = await services.invoiceService.list({ perPage: 4 });
    render(invoiceHost, card({ title: 'فاکتورهای اخیر', flush: true, body: `<ul class="list-group">${(invoices.items ?? invoices).map((invoice) => `<li class="list-item"><span class="list-item__title">${escapeHtml(invoice.number)}<span class="list-item__sub">${formatDate(invoice.issuedAt, { format: 'medium' })}</span></span><span class="list-item__meta">${formatCurrency(invoice.total, 'IRR', { compact: true })}${statusBadge(invoice.statusLabel ?? invoice.status, invoice.status === 'paid' ? 'success' : 'warning')}</span></li>`).join('')}</ul>` }));
  }
  const keysHost = $('[data-profile-keys]', node);
  if (keysHost) {
    const keys = await services.apiKeys.list();
    render(keysHost, card({ title: 'کلیدهای API من', flush: true, body: `<ul class="list-group">${(keys.items ?? keys).map((key) => `<li class="list-item"><i class="bi bi-key"></i><span class="list-item__title">${escapeHtml(key.name)}<span class="list-item__sub">${escapeHtml(key.masked ?? '')}</span></span><span class="list-item__meta">${key.lastUsed ? relativeTime(key.lastUsed) : 'استفاده نشده'}</span></li>`).join('')}</ul>` }));
  }
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
          <a class="landing-demo-card__media" href="dashboards/${demo.id}.html" aria-label="باز کردن داشبورد ${escapeHtml(demo.label.fa)}">
            <picture>
              <source type="image/svg+xml" srcset="${escapeHtml(previewSrc(demo.id))}" />
              <img data-preview-id="${escapeHtml(demo.id)}" src="${escapeHtml(previewSrc(demo.id))}" width="1600" height="1000" loading="lazy" decoding="async" alt="پیش‌نمایش داشبورد ${escapeHtml(demo.label.fa)}" />
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
  const node = $('[data-auth]') ?? document.querySelector('.auth-page');
  if (!node) return;
  // Pages carry `data-resource="auth-…"`; keying off that instead of the file
  // path keeps every variation (split, minimal, 2FA, lock…) working.
  const page = document.querySelector('[data-resource^="auth-"]')?.dataset.resource ?? kit.pageId();

  /** Per-page copy and layout. `variation` drives the visual differences. */
  const specs = {
    'auth-login': {
      variation: 'standard',
      head: { titleKey: 'auth.loginTitle', title: 'ورود به حساب', textKey: 'auth.loginSubtitle', text: 'برای ادامه، اطلاعات حساب خود را وارد کنید', icon: 'shield-lock' },
      fields: [AUTH_FIELDS.email, AUTH_FIELDS.password],
      submitKey: 'auth.login',
      submit: 'ورود',
      redirect: 'dashboards/analytics.html',
    },
    'auth-login-split': {
      variation: 'social-first',
      head: { titleKey: 'auth.loginTitle', title: 'ورود به حساب', textKey: 'auth.loginSubtitle', text: 'برای ادامه، اطلاعات حساب خود را وارد کنید', icon: 'stars' },
      fields: [AUTH_FIELDS.email, AUTH_FIELDS.password],
      submitKey: 'auth.login',
      submit: 'ورود',
      redirect: 'dashboards/analytics.html',
    },
    'auth-login-minimal': {
      variation: 'minimal',
      head: { titleKey: 'auth.loginTitle', title: 'ورود به حساب', textKey: 'auth.loginSubtitle', text: 'برای ادامه، اطلاعات حساب خود را وارد کنید', icon: 'box-arrow-in-right' },
      fields: [AUTH_FIELDS.email, AUTH_FIELDS.password],
      submitKey: 'auth.login',
      submit: 'ورود',
      redirect: 'dashboards/analytics.html',
    },
    'auth-register': {
      variation: 'standard',
      wide: true,
      head: { titleKey: 'auth.registerTitle', title: 'ساخت حساب جدید', textKey: 'auth.registerSubtitle', text: 'در چند ثانیه حساب خود را بسازید', icon: 'person-plus' },
      fields: [AUTH_FIELDS.name, AUTH_FIELDS.email, AUTH_FIELDS.phone, AUTH_FIELDS.newPassword, AUTH_FIELDS.confirm],
      terms: true,
      submitKey: 'auth.createAccount',
      submit: 'ساخت حساب',
      redirect: 'auth/verify-email.html',
    },
    'auth-forgot': {
      variation: 'standard',
      head: { titleKey: 'auth.forgotTitle', title: 'بازیابی رمز عبور', textKey: 'auth.forgotSubtitle', text: 'ایمیل خود را وارد کنید تا لینک بازیابی ارسال شود', icon: 'key' },
      fields: [AUTH_FIELDS.email],
      submitKey: 'auth.sendLink',
      submit: 'ارسال لینک بازیابی',
      backLink: true,
    },
    'auth-reset': {
      variation: 'standard',
      head: { titleKey: 'auth.resetTitle', title: 'تعیین رمز عبور جدید', textKey: 'auth.resetSubtitle', text: 'رمز عبور قوی انتخاب کنید', icon: 'shield-lock' },
      fields: [AUTH_FIELDS.newPassword, AUTH_FIELDS.confirm],
      submitKey: 'auth.updatePassword',
      submit: 'به‌روزرسانی رمز عبور',
      redirect: 'auth/login.html',
    },
    'auth-login-2fa': {
      variation: 'standard',
      head: { titleKey: 'auth.twoFactorTitle', title: 'ورود دو مرحله‌ای', textKey: 'auth.twoFactorSubtitle', text: 'کد برنامه احراز هویت را وارد کنید', icon: 'shield-check' },
      otp: true,
      redirect: 'dashboards/analytics.html',
    },
    'auth-verify': {
      variation: 'standard',
      head: { titleKey: 'auth.verifyTitle', title: 'تأیید حساب کاربری', textKey: 'auth.verifySubtitle', text: 'کد ۶ رقمی ارسال‌شده به ایمیل را وارد کنید', icon: 'envelope-check' },
      otp: true,
      redirect: 'dashboards/analytics.html',
    },
    'auth-lock': {
      variation: 'minimal',
      head: { titleKey: 'auth.lockTitle', title: 'صفحه قفل شده است', textKey: 'auth.lockSubtitle', text: 'برای ادامه رمز عبور خود را وارد کنید', icon: 'lock' },
      fields: [AUTH_FIELDS.password],
      submitKey: 'auth.unlock',
      submit: 'باز کردن قفل',
      avatar: 'assets/img/avatars/avatar-08.svg',
      person: 'سارا محمدی',
      redirect: 'dashboards/analytics.html',
      secondary: { href: 'login.html', key: 'auth.useAnotherAccount', text: 'ورود با حساب دیگر' },
    },
    'auth-logout': {
      variation: 'minimal',
      head: { titleKey: 'auth.loggedOut', title: 'از حساب خود خارج شدید', textKey: 'auth.lockSubtitle', text: 'برای ادامه رمز عبور خود را وارد کنید', icon: 'box-arrow-right' },
      success: { key: 'auth.success', text: 'نشست شما با موفقیت بسته شد. داده‌های شما محفوظ است.' },
      actions: [
        { href: 'login.html', className: 'btn-primary', icon: 'box-arrow-in-right', key: 'auth.backToSignIn', text: 'بازگشت به ورود' },
        { href: 'index.html', className: 'btn-light', icon: 'house-door', key: 'auth.backHome', text: 'بازگشت به صفحه اصلی' },
      ],
    },
  };

  const spec = specs[page] ?? specs['auth-login'];

  /**
   * The marketing aside previews the same dashboard in both themes, and the
   * theme can be flipped from the tools bar under the card — so the visible
   * screenshot is re-picked on every theme change instead of being baked into
   * the generated HTML.
   */
  const syncAuthShot = () => {
    const mode = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    $$('[data-auth-shot]').forEach((image) => {
      image.hidden = image.dataset.authShot !== mode;
    });
  };
  syncAuthShot();
  bus.on(EVENTS.theme, syncAuthShot);

  const variation = spec.variation ?? 'standard';
  const cardClasses = ['auth-card', spec.wide ? 'auth-card--wide' : '', variation === 'minimal' ? 'auth-card--plain' : ''].filter(Boolean).join(' ');

  // ---------------------------------------------------------------- OTP flow
  if (spec.otp) {
    render(
      node,
      `<div class="${cardClasses}">
        ${authBrandMark()}
        ${authHead(spec.head)}
        <form data-otp-form class="form-stack" novalidate>
          <div class="form-field">
            <label class="form-label" data-i18n="auth.codeLabel">کد تأیید</label>
            <div class="otp-row" data-otp>${Array.from({ length: 6 }, (_, index) => `<input class="form-control otp-input numeric" inputmode="numeric" maxlength="1" aria-label="رقم ${index + 1}">`).join('')}</div>
          </div>
          <button class="btn btn-primary w-100" type="submit" data-submit><i class="bi bi-check2-circle" aria-hidden="true"></i> <span data-i18n="auth.verifyAction">تأیید کد</span></button>
          <button class="btn btn-light w-100" type="button" data-resend><i class="bi bi-arrow-repeat" aria-hidden="true"></i> <span data-i18n="auth.resendCode">ارسال دوباره کد</span></button>
          <a class="btn btn-ghost w-100" href="login.html"><i class="bi bi-arrow-right" aria-hidden="true"></i> <span data-i18n="auth.backToSignIn">بازگشت به ورود</span></a>
        </form>
        ${authNote('envelope-check')}
      </div>`,
    );

    const inputs = $$('[data-otp] input', node);
    inputs.forEach((input, index) =>
      on(input, 'input', () => {
        if (input.value && inputs[index + 1]) inputs[index + 1].focus();
      }),
    );
    on($('[data-otp]', node), 'paste', (event) => {
      const text = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? '';
      if (!text) return;
      event.preventDefault();
      inputs.forEach((input, index) => {
        input.value = text[index] ?? '';
      });
      inputs[Math.min(text.length, 5)]?.focus();
    });
    on($('[data-otp-form]', node), 'submit', (event) => {
      event.preventDefault();
      const code = inputs.map((input) => input.value).join('');
      if (code.length < 6) {
        toast.warning('کد ناقص است', 'کد ۶ رقمی را کامل وارد کنید.');
        return;
      }
      toast.success('تأیید شد', 'در حال انتقال به داشبورد…');
      setTimeout(() => goTo(spec.redirect ?? 'dashboards/analytics.html'), 900);
    });
    on($('[data-resend]', node), 'click', () => toast.info('کد ارسال شد', 'کد جدید تا ۲ دقیقه دیگر می‌رسد.'));
    return;
  }

  // ------------------------------------------------- simple status card only
  if (spec.actions?.length) {
    render(
      node,
      `<div class="${cardClasses}">
        ${authBrandMark()}
        ${authHead(spec.head)}
        ${spec.success ? `<p class="auth-success"><i class="bi bi-check2-circle" aria-hidden="true"></i> <span data-i18n="${spec.success.key}">${spec.success.text}</span></p>` : ''}
        <div class="auth-card__actions">${spec.actions
          .map(
            (action) =>
              `<a class="btn ${action.className} w-100" href="${action.href}"><i class="bi bi-${action.icon}" aria-hidden="true"></i> <span data-i18n="${action.key}">${action.text}</span></a>`,
          )
          .join('')}</div>
        ${authNote()}
      </div>`,
    );
    return;
  }

  // ------------------------------------------------------------- form cards
  const head = spec.avatar
    ? `<header class="auth-card__head">
        <img class="avatar avatar--2xl" src="${url(spec.avatar)}" alt="" width="72" height="72">
        <h2 class="auth-card__title">${escapeHtml(spec.person ?? '')}</h2>
        <p class="auth-card__text" data-i18n="${spec.head.textKey}">${spec.head.text}</p>
      </header>`
    : `${authBrandMark()}${authHead(spec.head)}`;

  render(
    node,
    `<div class="${cardClasses}">
      ${head}
      ${spec.fields.some((field) => field.name === 'email') && variation !== 'minimal' ? authDemoBox() : ''}
      ${variation === 'social-first' ? authSocial() : ''}
      <form data-auth-form class="form-stack" novalidate>
        <div class="form-grid">${spec.fields.map(authField).join('')}</div>
        ${
          spec.terms
            ? `<label class="form-check"><input type="checkbox" class="form-check-input" name="terms" required><span class="form-check-label" data-i18n="auth.acceptTerms">قوانین و مقررات را می‌پذیرم</span></label>`
            : ''
        }
        ${
          spec.fields.some((field) => field.name === 'password') && page.startsWith('auth-login')
            ? `<div class="auth-meta">
                <label class="form-check"><input type="checkbox" class="form-check-input" name="remember" checked><span class="form-check-label" data-i18n="auth.remember">مرا به خاطر بسپار</span></label>
                <a class="fs-caption" href="forgot-password.html" data-i18n="auth.forgot">رمز عبور را فراموش کرده‌اید؟</a>
              </div>`
            : ''
        }
        <button class="btn btn-primary w-100" type="submit" data-submit><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> <span data-i18n="${spec.submitKey}">${spec.submit}</span></button>
        ${
          spec.secondary
            ? `<a class="btn btn-ghost w-100" href="${spec.secondary.href}"><i class="bi bi-person" aria-hidden="true"></i> <span data-i18n="${spec.secondary.key}">${spec.secondary.text}</span></a>`
            : ''
        }
      </form>
      ${variation === 'social-first' ? '' : authSocial()}
      ${variation === 'social-first' ? authWhyList() : ''}
      ${authNote()}
      ${
        spec.backLink
          ? `<div class="auth-card__foot"><a href="login.html" data-i18n="auth.backToLogin"><i class="bi bi-arrow-right" aria-hidden="true"></i> بازگشت به ورود</a></div>`
          : `<div class="auth-card__foot"><span data-i18n="${page === 'auth-register' ? 'auth.hasAccount' : 'auth.noAccount'}">${page === 'auth-register' ? 'قبلاً ثبت‌نام کرده‌اید؟' : 'حساب کاربری ندارید؟'}</span> <a href="${page === 'auth-register' ? 'login.html' : 'register.html'}" data-i18n="${page === 'auth-register' ? 'auth.login' : 'auth.register'}">${page === 'auth-register' ? 'ورود' : 'ثبت‌نام'}</a></div>`
      }
    </div>`,
  );

  // ------------------------------------------------------------ interactions
  const demoBox = $('[data-demo-box]', node);
  if (demoBox) {
    const fillDemo = () => {
      const form = $('[data-auth-form]', node);
      if (!form) return null;
      const filled = [];
      for (const [name, value] of Object.entries(AUTH_DEMO)) {
        const input = $(`[name="${name}"]`, form);
        if (!input) continue;
        input.value = value;
        /* Real events, so validation, the password meter and the submit state
           all react exactly as they do on typed input. */
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled.push(input);
      }
      return { form, filled };
    };

    on($('[data-demo-fill]', demoBox), 'click', () => {
      const result = fillDemo();
      if (!result) return;
      toast.info('اطلاعات آزمایشی وارد شد', 'فرم پر شد؛ با دکمه «ورود و ادامه» مستقیم وارد شوید.');
      const more = document.createElement('button');
      more.type = 'submit';
      more.className = 'btn btn-primary btn-sm w-100 auth-demo__go';
      more.innerHTML = '<i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> ورود و ادامه';
      more.addEventListener('click', (event) => {
        event.preventDefault();
        if (typeof result.form.requestSubmit === 'function') result.form.requestSubmit();
        else result.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      demoBox.append(more);
    });
  }

  on($('[data-auth-form]', node), 'submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { validateForm } = await import('../core/form.js');
    if (!validateForm(form).valid) {
      toast.warning('فرم کامل نیست', 'فیلدها را بررسی کنید.');
      return;
    }
    const button = $('[data-submit]', form);
    const label = button.querySelector('[data-i18n]');
    const original = label?.textContent;
    button.classList.add('is-loading');
    button.disabled = true;
    if (label) label.textContent = page === 'auth-register' ? 'در حال ساخت حساب…' : 'در حال ورود…';
    // The template has no backend: the mock service answers, then the demo
    // dashboard opens. Swap this call for your own authentication endpoint.
    await services.authService.login({ email: form.email?.value ?? '', password: form.password?.value ?? '' }).catch(() => null);
    toast.success('ورود موفق', 'در حال انتقال به داشبورد…');
    /*
     * `?next=` lets a timed-out session come back to the page it was on. Only a
     * in-template relative path is accepted, so the parameter can never be used
     * to push somebody to another host.
     */
    const next = new URLSearchParams(window.location.search).get('next');
    const target = next && /^[a-z0-9][a-z0-9./_-]*\.html$/i.test(next) && !/^\/\//.test(next) ? next : spec.redirect ?? 'dashboards/analytics.html';
    setTimeout(() => goTo(target), 800);
    button.classList.remove('is-loading');
    button.disabled = false;
    if (label && original) label.textContent = original;
  });

  on(node, 'click', (event) => {
    const social = event.target.closest('[data-social]');
    if (social) toast.info('ورود اجتماعی', `سرویس ${social.dataset.social.toUpperCase()} در نسخه نمایشی غیرفعال است.`);
  });
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
        <div class="pricing-grid" data-pricing-grid>${plans
          .map(
            (plan) => `<article class="price-card ${plan.featured ? 'price-card--featured' : ''}">${plan.featured ? '<span class="price-card__badge">محبوب‌ترین</span>' : ''}
              <h3 class="price-card__name">${escapeHtml(plan.name)}</h3><p class="price-card__desc">${escapeHtml(plan.description ?? '')}</p>
              <p class="price-card__amount" data-price-monthly="${plan.price}" data-price-yearly="${Math.round(plan.price * 10)}">${formatCurrency(plan.price, 'IRR', { compact: true })}<span>/ ماه</span></p>
              <ul class="price-card__list">${(plan.features ?? []).map((feature) => `<li><i class="bi bi-check2-circle" aria-hidden="true"></i> ${escapeHtml(feature)}</li>`).join('')}</ul>
              <button class="btn ${plan.featured ? 'btn-primary' : 'btn-light'} w-100" type="button" data-choose-plan="${escapeHtml(plan.id)}">انتخاب پلن</button></article>`,
          )
          .join('')}</div>
        ${card({ title: 'مقایسه کامل', flush: true, body: compareTable(plans) })}
      </div>`,
    );
    on($('[data-billing-toggle]', node), 'change', (event) => {
      const yearly = event.target.checked;
      $$('[data-price-monthly]', node).forEach((price) => {
        const value = Number(yearly ? price.dataset.priceYearly : price.dataset.priceMonthly);
        price.innerHTML = `${formatCurrency(value, 'IRR', { compact: true })}<span>/ ${yearly ? 'سال' : 'ماه'}</span>`;
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
    const log = await services.contentService.changelog();
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'تغییرات نسخه‌ها', subtitle: 'تاریخچه کامل نسخه‌ها و تغییرات هر انتشار', icon: 'clipboard-data' })}
        ${card({ body: log
          .map(
            (release) => {
              /**
               * One release in the mock data: `{ version, date (Jalali string),
               * highlights, items: [{ type, text }] }`. Entries are grouped by
               * change type so the page can show the coloured type chips.
               */
              const items = release.items ?? [];
              const groups = release.groups ?? [...new Set(items.map((item) => item.type ?? 'added'))].map((type) => ({ type, items: items.filter((item) => (item.type ?? 'added') === type) }));
              const date = /^[۰-۹0-9/:-]+$/.test(String(release.date ?? '')) ? release.date : formatDate(release.date, { format: 'medium' });
              return `<section class="changelog-item"><header class="d-flex align-items-center gap-3"><span class="changelog-item__version">v${escapeHtml(release.version)}</span><span class="changelog-item__date">${escapeHtml(date ?? '')}</span>${release.badge ? statusBadge(release.badge, 'primary') : ''}</header>
              ${release.highlights ? `<p class="changelog-item__highlights">${escapeHtml(release.highlights)}</p>` : ''}
              ${groups
                .map(
                  (group) => `<h4 class="mt-3"><span class="changelog-type changelog-type--${escapeHtml(group.type)}">${escapeHtml(group.type)}</span></h4><ul class="checklist">${(group.items ?? []).map((item) => `<li>${escapeHtml(item.text ?? item)}</li>`).join('')}</ul>`,
                )
                .join('')}</section>`;
            },
          )
          .join('') })}
      </div>`,
    );
    return;
  }

  if (name === 'status') {
    const overview = await services.statusService.overview();
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'وضعیت سرویس‌ها', subtitle: `آپ‌تایم کلی ${toDigits(overview.uptime)}٪`, icon: 'activity', badges: [statusBadge(overview.overall === 'operational' ? 'همه سرویس‌ها فعال' : 'اختلال جزئی', overview.overall === 'operational' ? 'success' : 'warning')] })}
        <div class="card"><div class="card__body">${overview.services
          .map(
            (service) => `<div class="status-service ${service.state !== 'operational' ? 'status-service--warning' : ''}"><div><p class="status-service__name"><span class="status-dot status-dot--${service.state === 'operational' ? 'online' : 'warning'}"></span>${escapeHtml(service.name)}</p>
              <p class="status-service__meta">${toDigits(service.latency ?? 0)} میلی‌ثانیه • ${toDigits(service.uptime)}٪ آپ‌تایم</p></div>
              <div class="status-uptime">${(overview.uptimeBars ?? []).slice(-20).map((bar) => `<span class="status-uptime__bar" style="block-size:${Math.max(20, bar)}%"></span>`).join('')}</div></div>`,
          )
          .join('')}</div></div>
        ${card({ title: 'رویدادها', flush: true, body: `<ul class="list-group">${(overview.incidents ?? []).map((incident) => `<li class="list-item"><span class="status-dot status-dot--${incident.severity === 'high' ? 'danger' : 'warning'}"></span><span class="list-item__title">${escapeHtml(incident.title)}<span class="list-item__sub">${escapeHtml(incident.text ?? '')}</span></span><span class="list-item__meta">${relativeTime(incident.at)}</span></li>`).join('')}</ul>` })}
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
      title: 'به‌زودی',
      text: 'این بخش در نسخه‌های بعدی منتشر می‌شود. برای اطلاع از زمان انتشار، خبرنامه محصول را دنبال کنید.',
      icon: 'rocket-takeoff',
      tone: 'primary',
      action: '<a class="btn btn-light" href="index.html">بازگشت</a>',
      hints: ['تغییرات نسخه‌ها در صفحه «تغییرات نسخه» ثبت می‌شود'],
    },
  };
  const state = states[name] ?? states[404];
  render(
    node,
    `<div class="dashboard-shell">
      <div class="status-hero status-hero--${state.tone}" style="flex-direction:column;text-align:center;padding-block:3.5rem">
        <span class="status-hero__icon"><i class="bi bi-${state.icon}"></i></span>
        <h1 class="status-hero__title">${escapeHtml(state.title)}</h1>
        <p class="status-hero__text">${escapeHtml(state.text)}</p>
        <form class="input-group" data-error-search style="max-width:26rem;width:100%">
          <input class="form-control" type="search" placeholder="جستجو در صفحات…" aria-label="جستجو">
          <button class="btn btn-light" type="submit"><i class="bi bi-search"></i></button>
        </form>
        <div class="d-flex gap-2 justify-content-center flex-wrap">${state.action}<a class="btn btn-light" href="system/help-center.html">مرکز راهنما</a></div>
      </div>
      <div class="grid grid--3">
        ${(state.hints ?? []).map((hint, index) => statCard({ label: `راهکار ${toDigits(index + 1)}`, value: `<span class="fs-body">${escapeHtml(hint)}</span>`, icon: ['check2-circle', 'search', 'headset'][index % 3], tone: ['success', 'info', 'primary'][index % 3] })).join('')}
      </div>
      <div class="grid grid--3">
        <a class="demo-link" href="index.html"><i class="bi bi-house-door"></i> داشبورد</a>
        <a class="demo-link" href="system/help-center.html"><i class="bi bi-life-preserver"></i> مرکز راهنما</a>
        <a class="demo-link" href="system/contact.html"><i class="bi bi-envelope"></i> تماس با پشتیبانی</a>
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
  const features = [...new Set(plans.flatMap((plan) => plan.features ?? []))];
  return `<div class="table-wrap"><table class="table table--bordered compare-table"><thead><tr><th>ویژگی</th>${plans.map((plan) => `<th class="text-center">${escapeHtml(plan.name)}</th>`).join('')}</tr></thead>
    <tbody>${features
      .map(
        (feature) => `<tr><th scope="row">${escapeHtml(feature)}</th>${plans
          .map((plan) => `<td class="text-center">${(plan.features ?? []).includes(feature) ? '<i class="bi bi-check2-circle text-success"></i>' : '<i class="bi bi-dash text-muted"></i>'}</td>`)
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
          <header class="card__head"><div><h2 class="card__title">دسترسی سریع</h2><p class="card__subtitle">میان‌برهای پرکاربرد تیم</p></div></header>
          <div class="card__body">
            <div class="grid grid--2">${[['افزودن محصول', 'ecommerce/product-create.html', 'box-seam'], ['فاکتور جدید', 'finance/invoice-create.html', 'receipt'], ['کاربر جدید', 'users/create.html', 'person-plus'], ['گفتگوی هوشمند', 'ai/chat.html', 'chat-square-dots']]
              .map(([label, url, icon]) => `<a class="tile tile--soft tile--icon" href="${url}"><i class="bi bi-${icon}"></i><span>${label}</span></a>`)
              .join('')}</div>
          </div>
        </section>
      </div>
    </div>`,
  );

  initCharts(node);
}

export default { initLanding, initPreview, initSearchResults, initDocs, initSettings, initProfile, initAuth, initSystemPages, initWidgetsPage };
