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
import { config } from '../../config/config.js';
import { searchService, commandService } from '../../services/index.js';
import { navigation, navigationSections, navigationCount } from '../../data/navigation.js';
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

export async function initLanding() {
  const node = $('[data-landing]') ?? host();
  if (!node) return;
  node.dataset.appClaimed = '1';

  const [highlights, counters, testimonials, pricing, faq, tech] = await Promise.all([
    services.contentService.highlights(),
    services.contentService.counters(),
    services.contentService.testimonials(),
    services.contentService.pricing(),
    services.contentService.faq(),
    services.contentService.techStack(),
  ]);

  $$('[data-counter]', node).forEach((counter) => {
    const target = Number(counter.dataset.counter ?? 0);
    let current = 0;
    const step = Math.max(1, Math.round(target / 40));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      counter.textContent = formatNumber(current);
    }, 24);
  });

  const grid = $('[data-landing-highlights]', node);
  if (grid) {
    render(
      grid,
      highlights
        .map(
          (item) => `<article class="card card--icon" data-reveal><span class="card__icon"><i class="bi bi-${escapeHtml(item.icon ?? 'stars')}"></i></span>
            <h3 class="card__title">${escapeHtml(item.title)}</h3><p class="card__subtitle">${escapeHtml(item.text ?? item.body ?? '')}</p></article>`,
        )
        .join(''),
    );
  }

  const testimonialGrid = $('[data-landing-testimonials]', node);
  if (testimonialGrid) {
    render(
      testimonialGrid,
      testimonials
        .map(
          (item) => `<figure class="card"><div class="card__body"><span class="rating rating--readonly">${Array.from({ length: 5 }, (_, index) => `<i class="bi bi-star${index < item.rating ? '-fill' : ''}"></i>`).join('')}</span>
            <blockquote class="mt-3 mb-3">${escapeHtml(item.text)}</blockquote>
            <figcaption class="d-flex align-items-center gap-3"><img class="avatar avatar--sm" src="${escapeHtml(item.avatar)}" alt=""><div><strong>${escapeHtml(item.name)}</strong><span class="list-item__sub">${escapeHtml(item.role)}</span></div></figcaption></div></figure>`,
        )
        .join(''),
    );
  }

  const pricingHost = $('[data-landing-pricing]', node);
  if (pricingHost) {
    render(
      pricingHost,
      pricing
        .map(
          (plan) => `<article class="price-card ${plan.featured ? 'price-card--featured' : ''}">
            ${plan.featured ? '<span class="price-card__badge">پیشنهاد ویژه</span>' : ''}
            <h3 class="price-card__name">${escapeHtml(plan.name)}</h3>
            <p class="price-card__desc">${escapeHtml(plan.description ?? '')}</p>
            <p class="price-card__amount">${formatCurrency(plan.price, 'IRR', { compact: true })}<span>/ ماه</span></p>
            <ul class="price-card__list">${(plan.features ?? []).map((feature) => `<li><i class="bi bi-check2-circle"></i> ${escapeHtml(feature)}</li>`).join('')}</ul>
            <a class="btn ${plan.featured ? 'btn-primary' : 'btn-light'} w-100" href="system/pricing.html">شروع کنید</a>
          </article>`,
        )
        .join(''),
    );
  }

  const faqHost = $('[data-landing-faq]', node);
  if (faqHost) {
    render(
      faqHost,
      `<div class="faq-list" data-accordion>${faq
        .map(
          (item, index) => `<div class="accordion-item"><button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-accordion-toggle aria-expanded="${index === 0}">${escapeHtml(item.question)}<i class="bi bi-chevron-down"></i></button>
            <div class="accordion-body" data-accordion-body ${index === 0 ? '' : 'hidden'}><p>${escapeHtml(item.answer)}</p></div></div>`,
        )
        .join('')}</div>`,
    );
  }

  const techHost = $('[data-landing-tech]', node);
  if (techHost) {
    render(
      techHost,
      tech
        .map((item) => `<div class="integration-card"><span class="integration-card__logo"><i class="bi bi-${escapeHtml(item.icon ?? 'code-slash')}"></i></span><div class="integration-card__body"><strong class="integration-card__title">${escapeHtml(item.name)}</strong><p class="integration-card__text">${escapeHtml(item.text ?? item.description ?? '')}</p></div></div>`)
        .join(''),
    );
  }

  $$('[data-counter]', node).forEach((counter) => counter.removeAttribute('data-counter'));
  initCharts(node);
  on(node, 'click', (event) => {
    const switcher = event.target.closest('[data-demo-switch]');
    if (switcher) {
      event.preventDefault();
      const demo = switcher.dataset.demoSwitch;
      window.location.href = demo === 'current' ? 'dashboards/analytics.html' : `dashboards/${demo}.html`;
    }
  });
  on($('[data-newsletter]', node), 'submit', async (event) => {
    event.preventDefault();
    const input = $('input', event.currentTarget);
    await services.contentService.subscribe(input.value);
    input.value = '';
    toast.success('عضویت انجام شد', 'خبرنامه ماهانه برای شما ارسال می‌شود.');
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
    if (value) window.location.href = `search.html?q=${encodeURIComponent(value)}`;
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
        (demo) => `<a class="landing-demo" href="dashboards/${demo.id}.html"><i class="bi bi-${escapeHtml(demo.icon)}" aria-hidden="true"></i><strong>${escapeHtml(demo.label.fa)}</strong><span>${escapeHtml(demo.label.en)}</span></a>`,
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

  initCharts(node);
}

/* ================================================================ auth */

export async function initAuth() {
  const node = $('[data-auth]') ?? document.querySelector('.auth-page');
  if (!node) return;
  // Pages carry `data-resource="auth-…"`; keying off that instead of the file
  // path keeps every variation (split, minimal, 2FA, lock…) working.
  const page = document.querySelector('[data-resource^="auth-"]')?.dataset.resource ?? kit.pageId();

  const forms = {
    'auth-login-minimal': null, // filled from the login spec below
    'auth-login-split': null,
    'auth-login': {
      title: 'ورود به حساب',
      fields: [
        { name: 'email', label: 'ایمیل', type: 'email', rule: 'email', required: true, placeholder: 'you@company.com' },
        { name: 'password', label: 'گذرواژه', type: 'password', rule: 'password', min: 8, required: true },
      ],
      submit: 'ورود',
      note: 'گذرواژه را فراموش کرده‌اید؟',
    },
    'auth-register': {
      title: 'ساخت حساب جدید',
      fields: [
        { name: 'name', label: 'نام و نام خانوادگی', required: true },
        { name: 'email', label: 'ایمیل', type: 'email', rule: 'email', required: true },
        { name: 'phone', label: 'تلفن همراه', rule: 'phone' },
        { name: 'password', label: 'گذرواژه', type: 'password', rule: 'password', min: 8, required: true },
        { name: 'confirm', label: 'تکرار گذرواژه', type: 'password', match: 'password', required: true },
        { name: 'terms', label: 'قوانین و شرایط را می‌پذیرم', type: 'switch' },
      ],
      submit: 'ساخت حساب',
      note: 'حساب کاربری دارید؟',
    },
    'auth-forgot': { title: 'بازیابی گذرواژه', fields: [{ name: 'email', label: 'ایمیل حساب', type: 'email', rule: 'email', required: true }], submit: 'ارسال پیوند بازیابی', note: 'پیوند بازیابی تا ۱۰ دقیقه معتبر است.' },
    'auth-reset': {
      title: 'تعیین گذرواژه جدید',
      fields: [
        { name: 'password', label: 'گذرواژه جدید', type: 'password', rule: 'password', min: 8, required: true },
        { name: 'confirm', label: 'تکرار گذرواژه', type: 'password', match: 'password', required: true },
      ],
      submit: 'ثبت گذرواژه',
      note: 'پس از ثبت، همه نشست‌ها بسته می‌شوند.',
    },
  };

  if (page === 'auth-verify' || page === 'auth-2fa') {
    render(
      node,
      `<div class="auth-card">
        <div class="auth-card__head"><img src="assets/logo-mark.svg" alt="" width="44" height="44">
          <h2 class="auth-card__title">${page === 'auth-2fa' ? 'ورود دو مرحله‌ای' : 'تأیید ایمیل'}</h2>
          <p class="auth-card__text">${page === 'auth-2fa' ? 'کد ۶ رقمی برنامه احراز هویت را وارد کنید.' : 'کد ارسال‌شده به ایمیل خود را وارد کنید.'}</p></div>
        <form data-otp-form class="d-flex flex-column gap-3">
          <div class="otp-row" data-otp>${Array.from({ length: 6 }, (_, index) => `<input class="form-control otp-input numeric" inputmode="numeric" maxlength="1" aria-label="رقم ${index + 1}">`).join('')}</div>
          <button class="btn btn-primary w-100" type="submit" data-submit>تأیید کد</button>
          <button class="btn btn-ghost w-100" type="button" data-resend>ارسال دوباره کد</button>
        </form>
      </div>`,
    );
    const inputs = $$('[data-otp] input', node);
    inputs.forEach((input, index) =>
      on(input, 'input', () => {
        if (input.value && inputs[index + 1]) inputs[index + 1].focus();
      }),
    );
    on($('[data-otp]', node), 'paste', (event) => {
      const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (!text) return;
      event.preventDefault();
      inputs.forEach((input, index) => {
        input.value = text[index] ?? '';
      });
      inputs[Math.min(text.length, 5)].focus();
    });
    on($('[data-otp-form]', node), 'submit', (event) => {
      event.preventDefault();
      const code = inputs.map((input) => input.value).join('');
      if (code.length < 6) {
        toast.warning('کد ناقص است', 'کد ۶ رقمی را کامل وارد کنید.');
        return;
      }
      toast.success('تأیید شد', 'در حال انتقال به داشبورد…');
      setTimeout(() => window.location.assign('dashboards/analytics.html'), 900);
    });
    on($('[data-resend]', node), 'click', () => toast.info('کد ارسال شد', 'کد جدید تا ۲ دقیقه دیگر می‌رسد.'));
    return;
  }

  if (page === 'auth-lock') {
    render(
      node,
      `<div class="auth-card"><div class="auth-card__head"><img class="avatar avatar--2xl" src="assets/img/avatars/avatar-08.svg" alt=""><h2 class="auth-card__title">سارا محمدی</h2><p class="auth-card__text">برای ادامه، گذرواژه خود را وارد کنید.</p></div>
        <form data-lock-form class="form-stack">${formMarkup([{ name: 'password', label: 'گذرواژه', type: 'password', required: true }])}
          <button class="btn btn-primary w-100" type="submit">باز کردن قفل</button>
          <a class="btn btn-ghost w-100" href="login.html">ورود با حساب دیگر</a></form></div>`,
    );
    on($('[data-lock-form]', node), 'submit', (event) => {
      event.preventDefault();
      const value = $('[name="password"]', event.currentTarget).value;
      if (value.length < 4) {
        toast.warning('گذرواژه کوتاه است', 'گذرواژه صحیح را وارد کنید.');
        return;
      }
      toast.success('خوش آمدید', 'در حال انتقال به داشبورد…');
      setTimeout(() => window.location.assign('dashboards/analytics.html'), 900);
    });
    return;
  }

  if (page === 'auth-logout') {
    render(node, `<div class="auth-card"><div class="auth-card__head"><img src="assets/logo-mark.svg" alt="" width="44" height="44"><h2 class="auth-card__title">از حساب خود خارج شدید</h2><p class="auth-card__text">برای ادامه دوباره وارد شوید. داده‌های شما محفوظ است.</p></div><a class="btn btn-primary w-100" href="login.html">ورود دوباره</a></div>`);
    return;
  }

  forms['auth-login-minimal'] = forms['auth-login-split'] = forms['auth-login'];
  const spec = forms[page] ?? forms['auth-login'];
  const isLogin = page.startsWith('auth-login');
  render(
    node,
    `<div class="auth-card">
      <div class="auth-card__head"><img src="assets/logo-mark.svg" alt="" width="44" height="44">
        <h2 class="auth-card__title">${escapeHtml(spec.title)}</h2>
        <p class="auth-card__text">${escapeHtml(spec.note)}</p></div>
      <form data-auth-form class="form-stack" novalidate>
        ${formMarkup(spec.fields)}
        ${isLogin ? `<div class="d-flex align-items-center justify-content-between"><label class="form-check"><input type="checkbox" class="form-check-input" name="remember" checked><span class="form-check-label">مرا به خاطر بسپار</span></label><a class="fs-caption" href="forgot-password.html">فراموشی گذرواژه؟</a></div>` : ''}
        <button class="btn btn-primary w-100" type="submit" data-submit>${escapeHtml(spec.submit)}</button>
      </form>
      <div class="auth-card__divider"><span>یا ادامه با</span></div>
      <div class="d-flex gap-2"><button class="btn btn-light w-100" type="button" data-social="google"><i class="bi bi-google"></i> گوگل</button><button class="btn btn-light w-100" type="button" data-social="github"><i class="bi bi-github"></i> گیت‌هاب</button></div>
      <div class="auth-card__foot">${isLogin ? 'حساب ندارید؟ <a href="register.html">ثبت‌نام کنید</a>' : 'حساب دارید؟ <a href="login.html">ورود</a>'}</div>
    </div>`,
  );

  on($('[data-auth-form]', node), 'submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { validateForm } = await import('../core/form.js');
    if (!validateForm(form).valid) {
      toast.warning('فرم کامل نیست', 'فیلدها را بررسی کنید.');
      return;
    }
    const button = $('[data-submit]', form);
    button.classList.add('is-loading');
    try {
      toast.success('با موفقیت انجام شد', 'در حال انتقال…');
      setTimeout(() => window.location.assign(page === 'auth-register' ? 'verify-email.html' : 'dashboards/analytics.html'), 900);
    } finally {
      button.classList.remove('is-loading');
    }
  });
  on(node, 'click', (event) => {
    const social = event.target.closest('[data-social]');
    if (social) toast.info('ورود اجتماعی', 'در نسخه نمایشی، ورود با سرویس‌های بیرونی غیرفعال است.');
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
              <ul class="price-card__list">${(plan.features ?? []).map((feature) => `<li><i class="bi bi-check2-circle"></i> ${escapeHtml(feature)}</li>`).join('')}</ul>
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
    if (value) window.location.href = `search.html?q=${encodeURIComponent(value)}`;
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
