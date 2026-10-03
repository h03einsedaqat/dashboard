/**
 * NOVAADMIN — page modules (eCommerce · CRM · Finance · Projects · Support · HR · Logistics · Reports · Users)
 * ------------------------------------------------------------------
 * Every area controller follows the same shape:
 *
 *   1. `switch (pageId())` decides what the current page needs
 *   2. the shared builders from `kit.js` render real markup
 *   3. data always comes through `src/services/*` (never from `src/data/*` directly)
 *
 * List pages are already handled generically by `pages/generic.js`, so these
 * controllers focus on what a generic renderer cannot express: detail pages,
 * drag & drop boards, timeline views, printable invoices and create/edit flows.
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { formatCurrency, formatNumber, formatPercent, toDigits } from '../core/numbers.js';
import { formatDate, relativeTime, monthNames } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import { initKanban } from '../core/kanban.js';
import { goTo, url } from '../core/links.js';
import { withState } from '../core/load.js';
import * as kit from './kit.js';
import { statusLabel, FIELD_LABELS } from '../core/record-dialogs.js';

/* Detail pages: keys that are internal plumbing, and value formatting by key. */
const DETAIL_SKIP = new Set(['id', 'timeline', 'notes', 'avatar', 'logo', 'tone', 'token', 'color', 'icon', 'image']);
const MONEY_KEYS = /^(value|amount|revenue|total|price|budget|balance|lifetimeValue|ltv|spent|totalSpent)$/i;
const DATE_KEYS = /(At|Date|date|since|lastContact)$/;
function detailValue(key, value, record) {
  const label = record?.[`${key}Label`];
  if (label) return escapeHtml(String(label));
  if (typeof value === 'number' && MONEY_KEYS.test(key)) return `<span class="numeric">${formatCurrency(value, 'IRR')}</span>`;
  if (typeof value === 'number' && /probability|percent|rate|score/i.test(key)) return `<span class="numeric">${toDigits(value)}${/probability|percent|rate/i.test(key) ? '٪' : ''}</span>`;
  if (typeof value === 'number') return `<span class="numeric">${formatNumber(value)}</span>`;
  if (DATE_KEYS.test(key) && !Number.isNaN(Date.parse(value))) return escapeHtml(formatDate(value));
  if (/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(value)) return escapeHtml(statusLabel(value));
  if (/email|website|phone|url/i.test(key))
    return `<span class="text-ltr" dir="ltr">${escapeHtml(/phone/i.test(key) ? toDigits(value) : value)}</span>`;
  return escapeHtml(value);
}

const safeAvatar = (i = 1) => {
  const n = ((Math.abs(Number(i) || 1) - 1) % 24) + 1;
  return url(`assets/img/avatars/avatar-${String(n).padStart(2, '0')}.svg`);
};

const {
  card,
  statCard,
  infoRows,
  timeline,
  emptyState,
  paint,
  host,
  sampleRecord,
  tabs,
  pageHeader,
  kanbanMarkup,
  formMarkup,
  collectValues,
  openRecordForm,
  chart,
  asRows,
  chartBox,
  exportable,
  queryParam,
  statusBadge,
  toolButtons,
  statsFrom,
} = kit;
const services = kit.services;

/* ------------------------------------------------------------------ helpers */

/** Detail pages: fetch `?id=` and render header + info list + tabs. */
async function detailPage({ resource, id, title, badge, meta = [], tabs: tabDefs = [], actions = '' }) {
  const node = host();
  if (!node) return null;
  render(node, `<div class="dashboard-shell">${kit.skeleton(3)}</div>`);
  const { record, isSample, notFound } = await sampleRecord(resource, id);
  try {
    if (!record) {
      /**
       * An explicit `?id=` that does not resolve is a real error; a missing id
       * has already been handled by `sampleRecord` (first record), so this
       * branch only fires for a stale link or an empty collection.
       */
      render(
        node,
        `<div class="dashboard-shell"><div class="state-error"><span class="state-error__icon"><i class="bi bi-search"></i></span>
          <h3 class="state-error__title">${notFound && id ? 'این رکورد پیدا نشد یا حذف شده است' : 'رکوردی برای نمایش نیست'}</h3>
          <p class="state-error__text">${notFound && id ? 'شناسه درخواستی در داده‌های نمونه وجود ندارد. از فهرست، یک رکورد را انتخاب کنید.' : 'ابتدا در فهرست این بخش یک رکورد بسازید.'}</p>
          <a class="btn btn-primary btn-sm" href="${escapeHtml(resource === 'orders' ? 'ecommerce/orders.html' : 'index.html')}">بازگشت به فهرست</a></div></div>`,
      );
      return null;
    }
    const badges = [...(badge ? [badge(record)] : [])];
    if (isSample) badges.push(statusBadge('رکورد نمونه', 'info'));
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: record.title ?? record.name ?? record.number ?? record.subject ?? title, subtitle: meta.map((m) => m(record)).filter(Boolean).join(' • '), icon: 'layers', badges, actions })}
        ${tabDefs.map((tab) => tab(record)).join('')}
      </div>`,
    );
    initCharts(node);
    initDataTableNodes(node);
    return record;
  } catch (error) {
    render(node, `<div class="dashboard-shell">${kit.errorState(error.message)}</div>`);
    on($('[data-retry]', node), 'click', () => window.location.reload());
    return null;
  }
}

function initDataTableNodes(scope) {
  $$('[data-datatable]', scope).forEach((node) => createDataTable(node));
}

/** Loads the record wrapped in a try/catch so a bad `?id=` shows a real state. */
/**
 * Record loader for details screens.
 *
 * With `?id=` the requested record is loaded and a failure is reported.
 * Without an id (page opened from the sidebar) the newest record is used, so
 * the screen always demonstrates the real layout with real mock data.
 */
async function loadRecord(resource, id) {
  const service = services.default[resource];
  if (!service?.get && !service?.list) return null;
  if (id) {
    try {
      return await service.get(id);
    } catch {
      return null;
    }
  }
  try {
    return (await sampleRecord(resource)).record;
  } catch {
    return null;
  }
}

/* ==================================================================== eCommerce */

/* ============================================================ product media */

/**
 * Details-page gallery.
 *
 * Mirrors the product studio (same `pm-*` markup and interactions) but read
 * only: stage with pointer-zoom, prev/next, dots, thumbnail rail, keyboard
 * arrows (RTL-aware) and touch swipe. A product with a single image keeps the
 * plain `<img>` from `.detail-split__media` — a carousel of one is noise.
 */
function initProductGallery(root, record) {
  if (!root || !record) return;
  const stored = Array.isArray(record.images) && record.images.length ? record.images.filter(Boolean) : [record.image];
  const images = [...new Set([record.image, ...stored].filter(Boolean))].map((src, index) => ({
    src,
    label: index === 0 ? 'نمای اصلی محصول' : `نمای ${toDigits(index + 1)}`,
  }));
  if (images.length < 2) {
    root.innerHTML = `<img class="detail-split__media" src="${escapeHtml(images[0]?.src ?? '')}" alt="${escapeHtml(record.name ?? '')}" loading="lazy" />`;
    return;
  }

  let index = 0;
  const paint = () => {
    const current = images[index];
    render(
      root,
      `<figure class="pm-stage" data-stage tabindex="0" role="group" aria-roledescription="اسلایدر" aria-label="تصویر ${toDigits(index + 1)} از ${toDigits(images.length)}">
        <div class="pm-stage__frame" data-zoom-frame><img class="pm-stage__img" src="${escapeHtml(current.src)}" alt="${escapeHtml(record.name ?? '')} — ${escapeHtml(current.label)}" draggable="false" data-zoom-img /></div>
        <div class="pm-stage__top"><span class="pm-chip pm-chip--count numeric">${toDigits(index + 1)} / ${toDigits(images.length)}</span></div>
        <button type="button" class="pm-nav pm-nav--prev" data-detail-prev aria-label="تصویر قبلی"><i class="bi bi-chevron-right"></i></button>
        <button type="button" class="pm-nav pm-nav--next" data-detail-next aria-label="تصویر بعدی"><i class="bi bi-chevron-left"></i></button>
        <div class="pm-dots" aria-hidden="true">${images.map((_, i) => `<span class="${i === index ? 'is-active' : ''}"></span>`).join('')}</div>
        <span class="pm-stage__hint"><i class="bi bi-zoom-in"></i> برای بزرگ‌نمایی نشانگر را حرکت دهید</span>
      </figure>
      <ol class="pm-rail" aria-label="تصاویر محصول">
        ${images
          .map(
            (img, i) => `<li class="pm-thumb${i === index ? ' is-active' : ''}">
              <button type="button" class="pm-thumb__btn" data-detail-thumb="${i}" aria-label="${escapeHtml(img.label)}" aria-current="${i === index}">
                <img src="${escapeHtml(img.src)}" alt="" loading="lazy" />
              </button>
              <span class="pm-thumb__order numeric">${toDigits(i + 1)}</span>
            </li>`,
          )
          .join('')}
      </ol>`,
    );
  };

  const go = (step) => {
    index = (index + step + images.length) % images.length;
    paint();
    $('[data-stage]', root)?.focus({ preventScroll: true });
  };

  paint();

  on(root, 'click', (event) => {
    // RTL: the «previous» control sits on the right and steps backwards.
    if (event.target.closest('[data-detail-prev]')) return go(-1);
    if (event.target.closest('[data-detail-next]')) return go(1);
    const thumb = event.target.closest('[data-detail-thumb]');
    if (thumb) {
      index = Number(thumb.dataset.detailThumb);
      paint();
    }
  });

  on(root, 'keydown', (event) => {
    if (!event.target.closest('[data-stage]')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(-1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(1); }
  });

  let swipe = null;
  on(root, 'pointerdown', (event) => {
    if (event.pointerType === 'mouse' || !event.target.closest('[data-zoom-frame]')) return;
    swipe = { x: event.clientX, y: event.clientY };
  });
  on(root, 'pointerup', (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx > 0 ? 1 : -1);
  });
  /* Pointer zoom on fine pointers — identical feel to the studio stage. */
  on(root, 'pointermove', (event) => {
    const frame = event.target.closest('[data-zoom-frame]');
    if (!frame || event.pointerType !== 'mouse') return;
    const rect = frame.getBoundingClientRect();
    frame.style.setProperty('--zx', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
    frame.style.setProperty('--zy', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
    frame.classList.add('is-zooming');
  });
  on(root, 'pointerout', (event) => {
    const frame = event.target.closest('[data-zoom-frame]');
    if (frame && !frame.contains(event.relatedTarget)) frame.classList.remove('is-zooming');
  });
}

async function initEcommerce() {
  const page = kit.pageId();
  switch (page) {
    case 'ecommerce/product-grid.html': {
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);
      const { items } = await services.productService.list({ perPage: 24, sort: 'rating', order: 'desc' });
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'نمای شبکه‌ای محصولات', subtitle: `${toDigits(items.length)} محصول فعال`, icon: 'grid', actions: toolButtons({ create: 'محصول جدید', exportResource: 'products' }) })}
          <div class="grid grid--cards">${items
            .map(
              (product) => `<article class="card card--interactive">
                <div class="card-media"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" /></div>
                <div class="card__body">
                  <div class="d-flex align-items-center justify-content-between gap-2">
                    <span class="badge badge--soft-primary">${escapeHtml(product.category)}</span>
                    <span class="rating rating--readonly rating--sm">${Array.from({ length: 5 }, (_, i) => `<i class="bi bi-star${i < Math.round(product.rating) ? '-fill' : ''}"></i>`).join('')}</span>
                  </div>
                  <h3 class="card__title"><a href="ecommerce/product-details.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
                  <p class="card__subtitle">${escapeHtml(product.brand)}</p>
                  <div class="list-item__meta"><span class="fs-sm text-muted">موجودی: ${toDigits(product.stock)}</span><strong class="numeric">${formatCurrency(product.finalPrice, 'IRR', { compact: true })}</strong></div>
                </div>
              </article>`,
            )
            .join('')}</div>
        </div>`,
      );
      on($('[data-create]', node), 'click', () => ecommerceProductForm());
      exportable(node, 'products');
      return;
    }

    case 'ecommerce/product-details.html': {
      const id = queryParam('id');
      const detailRecord = await detailPage({
        resource: 'products',
        id,
        title: 'جزئیات محصول',
        meta: [(p) => p.brand, (p) => p.category, (p) => `SKU: ${p.sku}`],
        badge: (p) => statusBadge(p.statusLabel ?? p.status, p.status === 'published' ? 'success' : 'warning'),
        actions: `<a class="btn btn-light" href="ecommerce/product-create.html?id=${encodeURIComponent(id)}"><i class="bi bi-pencil"></i> ویرایش</a>
          <button class="btn btn-primary" type="button" data-duplicate><i class="bi bi-files"></i> کپی محصول</button>`,
        tabs: [
          (p) => card({
            title: 'مشخصات',
            body: `<div class="detail-split">
              <div class="pm pm--detail" data-detail-gallery aria-label="گالری تصاویر محصول"></div>
              <div>${infoRows([
                ['قیمت پایه', formatCurrency(p.price, 'IRR')],
                ['تخفیف', `${toDigits(p.discount ?? 0)}٪`],
                ['قیمت نهایی', `<strong>${formatCurrency(p.finalPrice, 'IRR')}</strong>`],
                ['موجودی', toDigits(p.stock)],
                ['امتیاز', `${toDigits(p.rating)} از ۵ (${toDigits(p.reviewsCount ?? 0)} نظر)`],
                ['تاریخ ایجاد', formatDate(p.createdAt, { format: 'long' })],
                ['وضعیت', statusBadge(p.statusLabel ?? p.status, p.status === 'published' ? 'success' : 'warning')],
              ])}</div>
            </div>`,
          }),
          () => tabs([
            {
              id: 'specs',
              label: 'ویژگی‌ها',
              icon: 'sliders',
              body: card({ flush: true, body: `<ul class="list-group">${['وزن: ۵۶۰ گرم', 'ابعاد: ۱۸۰×۹۰×۲۲ میلی‌متر', 'جنس بدنه: آلیاژ آلومینیوم', 'باتری: ۵۰۰۰ میلی‌آمپر', 'گارانتی: ۱۸ ماه'].map((row) => `<li class="list-item"><i class="bi bi-check2-circle text-success"></i><span class="list-item__title">${escapeHtml(row)}</span></li>`).join('')}</ul>` }),
            },
            { id: 'reviews', label: 'نظرات', icon: 'star', body: `<div class="card"><div class="card__body">${emptyState({ title: 'نظرات در انتظار بارگذاری', text: 'برای مشاهده فهرست کامل نظرات، صفحه «نظرات محصولات» را ببینید.', icon: 'chat-square-quote', action: '<a class="btn btn-primary btn-sm" href="ecommerce/reviews.html">فهرست نظرات</a>' })}</div></div>` },
          ]),
        ],
      });
      const duplicate = $('[data-duplicate]');
      if (duplicate) on(duplicate, 'click', () => toast.success('محصول کپی شد', 'نسخه کپی با شناسه جدید در فهرست محصولات قرار گرفت.'));
      /* Called after `detailPage` rendered the tabs so the gallery can mount. */
      initProductGallery($('[data-detail-gallery]'), detailRecord);
      return;
    }

    case 'ecommerce/product-create.html':
      await ecommerceProductForm();
      return;

    case 'ecommerce/order-details.html': {
      const id = queryParam('id');
      const order = await detailPage({
        resource: 'orders',
        id,
        title: 'جزئیات سفارش',
        meta: [(o) => o.customer, (o) => `تاریخ: ${formatDate(o.placedAt, { format: 'medium' })}`],
        badge: (o) => statusBadge(o.statusLabel ?? o.status, o.status === 'completed' ? 'success' : 'info'),
        actions: `<button class="btn btn-light" type="button" data-order-print><i class="bi bi-printer"></i> چاپ</button>
          <div class="dropdown"><button class="btn btn-primary" type="button" data-dropdown-toggle="true" aria-expanded="false">تغییر وضعیت <i class="bi bi-chevron-down"></i></button>
            <ul class="dropdown-menu dropdown-menu-end" data-dropdown-menu>${['processing', 'completed', 'cancelled', 'refunded'].map((status) => `<li><button class="dropdown-item" type="button" data-order-status="${status}">${escapeHtml(status)}</button></li>`).join('')}</ul>
          </div>`,
        tabs: [
          (o) => card({
            title: 'اقلام سفارش',
            flush: true,
            body: `<table class="table table--hover"><thead><tr><th>محصول</th><th>تعداد</th><th>قیمت واحد</th><th class="text-end">جمع</th></tr></thead>
              <tbody>${(o.items ?? [])
                .map(
                  (item) => `<tr><td><div class="table__primary"><img class="table__thumb" src="${escapeHtml(item.image ?? 'assets/img/products/product-01.svg')}" alt=""><div class="table__primary-text"><span class="table__primary-title">${escapeHtml(item.name)}</span><span class="table__primary-sub">${escapeHtml(item.sku ?? '')}</span></div></div></td>
                  <td class="numeric">${toDigits(item.quantity)}</td><td class="numeric">${formatCurrency(item.price, 'IRR')}</td><td class="numeric text-end">${formatCurrency(item.price * item.quantity, 'IRR')}</td></tr>`,
                )
                .join('')}</tbody></table>`,
            foot: `<div class="ms-auto w-100" style="max-width:22rem">${infoRows([
              ['جمع اقلام', formatCurrency(o.subtotal ?? o.total, 'IRR')],
              ['هزینه ارسال', formatCurrency(o.shipping ?? 0, 'IRR')],
              ['مالیات', formatCurrency(o.tax ?? 0, 'IRR')],
              ['مبلغ نهایی', `<strong>${formatCurrency(o.total, 'IRR')}</strong>`],
            ])}</div>`,
          }),
          (o) => card({ title: 'اطلاعات مشتری و ارسال', body: `<div class="grid grid--2">${infoRows([
            ['مشتری', o.customer],
            ['ایمیل', o.email ?? '—'],
            ['تلفن', o.phone ?? '—'],
            ['نشانی', o.address ?? 'تهران، خیابان ولیعصر، پلاک ۱۲۰'],
            ['روش پرداخت', o.payment ?? 'درگاه بانکی'],
            ['کد رهگیری پستی', o.tracking ?? '—'],
          ])}${timeline(
            [
              { title: 'سفارش ثبت شد', text: 'پرداخت با موفقیت انجام شد.', time: formatDate(o.placedAt, { format: 'long' }), tone: 'success', icon: 'check2-circle' },
              { title: 'آماده‌سازی در انبار', text: 'کالاها بسته‌بندی و تحویل شرکت حمل شد.', time: relativeTime(o.placedAt), tone: 'primary', icon: 'box-seam' },
              { title: 'در مسیر مشتری', text: 'زمان تحویل تخمینی: فردا', time: 'در حال انجام', tone: 'info', icon: 'truck' },
            ],
            { compact: true },
          )}</div>` }),
        ],
      });
      if (!order) return;
      $$('[data-order-status]').forEach((button) =>
        on(button, 'click', async () => {
          await services.orderActions.updateStatus(order.id, button.dataset.orderStatus);
          toast.success('وضعیت سفارش تغییر کرد', `وضعیت جدید: ${button.dataset.orderStatus}`);
          bus.emit(EVENTS.dataChanged, { resource: 'orders', action: 'status', id: order.id });
        }),
      );
      on($('[data-order-print]'), 'click', () => window.print());
      return;
    }

    case 'ecommerce/categories.html': {
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(3)}</div>`);
      const service = services.categoryService;
      const ICONS = ['laptop', 'phone', 'headphones', 'mouse', 'router', 'printer', 'device-hdd', 'controller', 'house-gear', 'briefcase', 'camera', 'smartwatch', 'tv', 'bag', 'lightning-charge', 'gift'];
      const COLORS = ['primary', 'info', 'success', 'warning', 'danger', 'violet'];
      const state = { rows: [], q: '', filter: 'all', sort: 'tree' };
      const load = async () => {
        const { items } = await service.list({ perPage: 500 });
        state.rows = items.map((row, i) => ({ order: i + 1, color: 'primary', description: '', featured: false, ...row }));
      };
      await load();

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'دسته‌بندی‌های فروشگاه',
            subtitle: 'ساختار درختی ویترین، نمایش یا پنهان‌سازی آنی و سهم هر دسته از فروش',
            icon: 'diagram-3',
            actions: '<button class="btn btn-primary" type="button" data-cat-add><i class="bi bi-plus-lg"></i> دسته‌بندی جدید</button>',
          })}
          <div class="kpi-row" data-cat-kpis></div>
          <section class="card cat-board">
            <header class="card__head">
              <div><h2 class="card__title">ساختار دسته‌بندی‌ها</h2><p class="card__subtitle">زیردسته‌ها زیر سرگروه خود نمایش داده می‌شوند</p></div>
            </header>
            <div class="cat-toolbar">
              <label class="cat-toolbar__search"><i class="bi bi-search" aria-hidden="true"></i><input type="search" class="form-control" placeholder="جستجوی نام یا اسلاگ…" aria-label="جستجوی دسته‌بندی" data-cat-search></label>
              <div class="cat-seg" role="tablist" aria-label="فیلتر وضعیت">
                <button type="button" role="tab" class="is-active" aria-selected="true" data-cat-filter="all">همه <span data-count="all"></span></button>
                <button type="button" role="tab" aria-selected="false" data-cat-filter="active">در ویترین <span data-count="active"></span></button>
                <button type="button" role="tab" aria-selected="false" data-cat-filter="inactive">مخفی <span data-count="inactive"></span></button>
              </div>
              <select class="form-select cat-toolbar__sort" aria-label="مرتب‌سازی" data-cat-sort>
                <option value="tree">ترتیب درختی</option>
                <option value="products">بیشترین محصول</option>
                <option value="revenue">بیشترین فروش</option>
                <option value="name">الفبایی</option>
              </select>
            </div>
            <div class="cat-list" role="table" aria-label="دسته‌بندی‌ها">
              <div class="cat-row cat-row--head" role="row">
                <span role="columnheader">دسته‌بندی</span>
                <span role="columnheader">سرگروه</span>
                <span role="columnheader">محصولات</span>
                <span role="columnheader">فروش</span>
                <span role="columnheader">نمایش در ویترین</span>
                <span role="columnheader" class="visually-hidden">عملیات</span>
              </div>
              <div role="rowgroup" data-cat-body></div>
            </div>
          </section>
        </div>`,
      );

      const body = $('[data-cat-body]', node);
      const childrenOf = (name) => state.rows.filter((row) => row.parent === name);

      const paintKpis = () => {
        const active = state.rows.filter((row) => row.status === 'active').length;
        const roots = state.rows.filter((row) => !row.parent).length;
        const cells = [
          ['کل دسته‌بندی‌ها', toDigits(state.rows.length), `${toDigits(roots)} سرگروه • ${toDigits(state.rows.length - roots)} زیردسته`, 'primary', 'diagram-3'],
          ['در ویترین', toDigits(active), 'قابل مشاهده برای مشتریان', 'success', 'eye'],
          ['مخفی', toDigits(state.rows.length - active), 'موقتاً از فروشگاه پنهان', 'warning', 'eye-slash'],
          ['فروش دسته‌ها', formatCurrency(state.rows.reduce((sum, row) => sum + (row.revenue || 0), 0), 'IRR', { compact: true }), 'مجموع ۳۰ روز اخیر', 'info', 'graph-up-arrow'],
        ];
        $('[data-cat-kpis]', node).innerHTML = cells
          .map(
            ([label, value, meta, tone, icon]) => `<article class="stat-card">
              <div class="stat-card__head"><span class="stat-card__label">${escapeHtml(label)}</span><span class="stat-card__icon stat-card__icon--${tone}"><i class="bi bi-${icon}" aria-hidden="true"></i></span></div>
              <p class="stat-card__value">${escapeHtml(value)}</p>
              <p class="stat-card__meta">${escapeHtml(meta)}</p>
            </article>`,
          )
          .join('');
        $$('[data-count]', node).forEach((el) => {
          const key = el.dataset.count;
          el.textContent = toDigits(key === 'all' ? state.rows.length : state.rows.filter((row) => row.status === key).length);
        });
      };

      const rowHtml = (row, { child = false, maxProducts = 1, maxRevenue = 1 } = {}) => {
        const on_ = row.status === 'active';
        const kids = childrenOf(row.name).length;
        return `<div class="cat-row${child ? ' cat-row--child' : ''}${on_ ? '' : ' is-off'}" role="row" data-cat-id="${escapeHtml(row.id)}">
          <div class="cat-cell cat-cell--name" role="cell">
            <span class="cat-icon cat-icon--${escapeHtml(row.color || 'primary')}"><i class="bi bi-${escapeHtml(row.icon || 'tag')}" aria-hidden="true"></i></span>
            <div class="cat-name">
              <strong>${escapeHtml(row.name)}${row.featured ? ' <i class="bi bi-star-fill cat-star" title="دسته ویژه" aria-label="دسته ویژه"></i>' : ''}</strong>
              <code dir="ltr">/${escapeHtml(row.slug || row.id)}</code>
              ${!child && kids ? `<span class="cat-kids">${toDigits(kids)} زیردسته</span>` : ''}
            </div>
          </div>
          <div class="cat-cell cat-cell--parent" role="cell" data-label="سرگروه">${row.parent ? `<span class="cat-parent"><i class="bi bi-arrow-return-left" aria-hidden="true"></i>${escapeHtml(row.parent)}</span>` : '<span class="text-muted">دسته اصلی</span>'}</div>
          <div class="cat-cell cat-cell--products" role="cell" data-label="محصولات">
            <span class="numeric fw-semibold">${toDigits(row.products || 0)}</span>
            <span class="cat-bar" aria-hidden="true"><i style="inline-size:${Math.max(4, Math.round(((row.products || 0) / maxProducts) * 100))}%"></i></span>
          </div>
          <div class="cat-cell cat-cell--revenue numeric" role="cell" data-label="فروش">${formatCurrency(row.revenue || 0, 'IRR', { compact: true })}<span class="cat-share">${toDigits(Math.round(((row.revenue || 0) / maxRevenue) * 100))}٪ از بیشترین</span></div>
          <div class="cat-cell cat-cell--toggle" role="cell">
            <button type="button" class="cat-switch" role="switch" aria-checked="${on_}" aria-label="نمایش ${escapeHtml(row.name)} در ویترین" data-cat-toggle>
              <span class="cat-switch__track"><span class="cat-switch__knob"></span></span>
              <span class="cat-switch__text">${on_ ? 'نمایش' : 'مخفی'}</span>
            </button>
          </div>
          <div class="cat-cell cat-cell--actions" role="cell">
            <button type="button" class="btn btn-icon btn-light btn-sm" data-cat-edit aria-label="ویرایش ${escapeHtml(row.name)}" title="ویرایش"><i class="bi bi-pencil"></i></button>
            <button type="button" class="btn btn-icon btn-light btn-sm text-danger" data-cat-delete aria-label="حذف ${escapeHtml(row.name)}" title="حذف"><i class="bi bi-trash3"></i></button>
          </div>
        </div>`;
      };

      const paintList = () => {
        const q = state.q.trim().toLowerCase();
        const match = (row) =>
          (state.filter === 'all' || row.status === state.filter) &&
          (!q || [row.name, row.slug, row.parent, row.description].some((v) => String(v ?? '').toLowerCase().includes(q)));
        const maxProducts = Math.max(1, ...state.rows.map((row) => row.products || 0));
        const maxRevenue = Math.max(1, ...state.rows.map((row) => row.revenue || 0));
        const opts = { maxProducts, maxRevenue };
        let html = '';
        if (state.sort === 'tree' && !q) {
          const names = new Set(state.rows.map((row) => row.name));
          const roots = state.rows.filter((row) => !row.parent || !names.has(row.parent)).sort((a, b) => a.order - b.order);
          roots.forEach((root) => {
            const kids = childrenOf(root.name).filter(match).sort((a, b) => a.order - b.order);
            if (!match(root) && !kids.length) return;
            html += `<div class="cat-group" role="presentation">${rowHtml(root, opts)}${kids.map((kid) => rowHtml(kid, { ...opts, child: true })).join('')}</div>`;
          });
        } else {
          const key = state.sort === 'tree' ? 'order' : state.sort;
          const rows = state.rows.filter(match).sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name, 'fa') : key === 'order' ? a.order - b.order : (b[key] || 0) - (a[key] || 0)));
          html = rows.map((row) => rowHtml(row, opts)).join('');
        }
        body.innerHTML = html || emptyState({ title: 'دسته‌ای پیدا نشد', text: 'عبارت جستجو یا فیلتر را تغییر دهید.', icon: 'search' });
      };

      const repaint = () => {
        paintKpis();
        paintList();
      };

      const openForm = (record = null) => {
        const isNew = !record;
        const data = record ?? { name: '', slug: '', parent: null, icon: 'tag', color: 'primary', description: '', status: 'active', featured: false };
        const hasKids = !isNew && childrenOf(data.name).length > 0;
        const parents = state.rows.filter((row) => !row.parent && row.id !== data.id);
        const slugify = (text) =>
          String(text)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        modal.open({
          title: isNew ? 'دسته‌بندی جدید' : `ویرایش «${data.name}»`,
          subtitle: 'نام، مسیر، سرگروه و ظاهر دسته در ویترین',
          size: 'lg',
          content: `<form class="cat-form" novalidate data-cat-form>
              <div class="form-grid">
                <div class="form-field"><label class="form-label" for="cat-f-name">نام دسته <span class="text-danger">*</span></label><input id="cat-f-name" name="name" class="form-control" required maxlength="60" value="${escapeHtml(data.name)}" placeholder="مثلاً: لوازم خانگی هوشمند"><p class="form-feedback" data-err="name"></p></div>
                <div class="form-field"><label class="form-label" for="cat-f-slug">اسلاگ (نشانی) <span class="text-danger">*</span></label><input id="cat-f-slug" name="slug" class="form-control" dir="ltr" required maxlength="60" value="${escapeHtml(data.slug ?? '')}" placeholder="smart-home"><p class="form-hint">فقط حروف انگلیسی کوچک، عدد و خط تیره</p><p class="form-feedback" data-err="slug"></p></div>
                <div class="form-field"><label class="form-label" for="cat-f-parent">سرگروه</label><select id="cat-f-parent" name="parent" class="form-select" ${hasKids ? 'disabled' : ''}><option value="">— دسته اصلی —</option>${parents.map((p) => `<option value="${escapeHtml(p.name)}" ${p.name === data.parent ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select>${hasKids ? '<p class="form-hint">این دسته زیردسته دارد و خودش سرگروه باقی می‌ماند.</p>' : ''}</div>
                <div class="form-field"><span class="form-label">رنگ</span><div class="cat-colors">${COLORS.map((c) => `<label class="cat-color cat-color--${c}"><input type="radio" name="color" value="${c}" ${c === (data.color || 'primary') ? 'checked' : ''}><span class="visually-hidden">${c}</span></label>`).join('')}</div></div>
                <div class="form-field" style="grid-column:1/-1"><span class="form-label">آیکون</span><div class="cat-icons">${[...new Set([data.icon || 'tag', ...ICONS])].map((ic) => `<label class="cat-icon-opt"><input type="radio" name="icon" value="${ic}" ${ic === (data.icon || 'tag') ? 'checked' : ''}><span><i class="bi bi-${ic}" aria-hidden="true"></i></span><span class="visually-hidden">${ic}</span></label>`).join('')}</div></div>
                <div class="form-field" style="grid-column:1/-1"><label class="form-label" for="cat-f-desc">توضیح کوتاه</label><textarea id="cat-f-desc" name="description" class="form-control" rows="2" maxlength="160">${escapeHtml(data.description ?? '')}</textarea></div>
                <div class="form-field"><label class="form-switch"><input type="checkbox" class="form-check-input" name="active" ${data.status === 'active' ? 'checked' : ''}><span class="form-check-label">نمایش در ویترین</span></label></div>
                <div class="form-field"><label class="form-switch"><input type="checkbox" class="form-check-input" name="featured" ${data.featured ? 'checked' : ''}><span class="form-check-label">دسته ویژه (صفحه اصلی)</span></label></div>
              </div>
            </form>`,
          footer: `<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-cat-save><i class="bi bi-check2"></i> ${isNew ? 'ثبت دسته' : 'ذخیره تغییرات'}</button>`,
          onMount: (panel, instance) => {
            const form = $('[data-cat-form]', panel);
            const slug = form.elements.slug;
            let slugTouched = !isNew && Boolean(data.slug);
            on(slug, 'input', () => (slugTouched = true));
            on(form.elements.name, 'input', () => {
              if (!slugTouched) slug.value = slugify(form.elements.name.value) || '';
            });
            const setErr = (name, message) => {
              form.elements[name].classList.toggle('is-invalid', Boolean(message));
              $(`[data-err="${name}"]`, form).textContent = message ?? '';
            };
            const save = async () => {
              const name = form.elements.name.value.trim();
              const slugValue = slug.value.trim().toLowerCase();
              let ok = true;
              if (name.length < 2) { setErr('name', 'نام دسته حداقل ۲ نویسه است.'); ok = false; }
              else if (state.rows.some((row) => row.name === name && row.id !== data.id)) { setErr('name', 'دسته‌ای با این نام وجود دارد.'); ok = false; }
              else setErr('name', '');
              if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) { setErr('slug', 'اسلاگ معتبر نیست.'); ok = false; }
              else if (state.rows.some((row) => row.slug === slugValue && row.id !== data.id)) { setErr('slug', 'این اسلاگ قبلاً استفاده شده است.'); ok = false; }
              else setErr('slug', '');
              if (!ok) return;
              const payload = {
                name,
                slug: slugValue,
                parent: hasKids ? null : form.elements.parent.value || null,
                icon: form.querySelector('[name="icon"]:checked')?.value ?? 'tag',
                color: form.querySelector('[name="color"]:checked')?.value ?? 'primary',
                description: form.elements.description.value.trim(),
                status: form.elements.active.checked ? 'active' : 'inactive',
                featured: form.elements.featured.checked,
              };
              const button = $('[data-cat-save]', panel);
              button.classList.add('is-loading');
              button.disabled = true;
              try {
                if (isNew) await service.create({ ...payload, products: 0, revenue: 0, order: state.rows.length + 1 });
                else {
                  await service.update(data.id, payload);
                  if (data.name !== name) await Promise.all(childrenOf(data.name).map((kid) => service.update(kid.id, { parent: name })));
                }
                toast.success(isNew ? 'دسته‌بندی ثبت شد' : 'تغییرات ذخیره شد', name);
                instance.close();
                await load();
                repaint();
              } catch (error) {
                toast.danger('ذخیره نشد', error?.message ?? 'خطای غیرمنتظره');
              } finally {
                button.classList.remove('is-loading');
                button.disabled = false;
              }
            };
            on($('[data-cat-save]', panel), 'click', save);
            on(form, 'submit', (event) => {
              event.preventDefault();
              save();
            });
          },
        });
      };

      let searchTimer;
      on($('[data-cat-search]', node), 'input', (event) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.q = event.target.value;
          paintList();
        }, 150);
      });
      on($('[data-cat-sort]', node), 'change', (event) => {
        state.sort = event.target.value;
        paintList();
      });
      $$('[data-cat-filter]', node).forEach((button) =>
        on(button, 'click', () => {
          state.filter = button.dataset.catFilter;
          $$('[data-cat-filter]', node).forEach((b) => {
            b.classList.toggle('is-active', b === button);
            b.setAttribute('aria-selected', String(b === button));
          });
          paintList();
        }),
      );
      on($('[data-cat-add]', node), 'click', () => openForm());

      on(body, 'click', async (event) => {
        const rowNode = event.target.closest('[data-cat-id]');
        if (!rowNode) return;
        const row = state.rows.find((r) => r.id === rowNode.dataset.catId);
        if (!row) return;
        if (event.target.closest('[data-cat-toggle]')) {
          const button = event.target.closest('[data-cat-toggle]');
          const next = row.status === 'active' ? 'inactive' : 'active';
          row.status = next;
          button.setAttribute('aria-checked', String(next === 'active'));
          $('.cat-switch__text', button).textContent = next === 'active' ? 'نمایش' : 'مخفی';
          rowNode.classList.toggle('is-off', next !== 'active');
          paintKpis();
          try {
            await service.update(row.id, { status: next });
            toast.success(next === 'active' ? 'در ویترین نمایش داده می‌شود' : 'از ویترین پنهان شد', row.name);
            if (state.filter !== 'all') paintList();
          } catch {
            row.status = next === 'active' ? 'inactive' : 'active';
            repaint();
            toast.danger('تغییر وضعیت انجام نشد', 'دوباره تلاش کنید.');
          }
          return;
        }
        if (event.target.closest('[data-cat-edit]')) {
          openForm(row);
          return;
        }
        if (event.target.closest('[data-cat-delete]')) {
          const kids = childrenOf(row.name);
          const ok = await modal.confirm({
            title: 'حذف دسته‌بندی',
            text: kids.length
              ? `«${row.name}» حذف می‌شود و ${toDigits(kids.length)} زیردسته آن به دسته اصلی منتقل می‌شوند. محصولات حذف نمی‌شوند.`
              : `«${row.name}» حذف می‌شود. محصولات این دسته حذف نمی‌شوند و بدون دسته باقی می‌مانند.`,
            tone: 'danger',
            confirmText: 'حذف دسته',
          });
          if (!ok) return;
          await Promise.all(kids.map((kid) => service.update(kid.id, { parent: null })));
          await service.remove(row.id);
          toast.success('دسته‌بندی حذف شد', row.name);
          await load();
          repaint();
        }
      });

      repaint();
      return;
    }

    case 'ecommerce/brands.html': {
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(4)}</div>`);
      const service = services.brandService;
      const { items: rows, summary } = await service.list({ perPage: 200, sort: 'revenue', order: 'desc' });
      const state = { q: '', filter: 'all', sort: 'revenue' };

      const maxRevenue = Math.max(...rows.map((row) => row.revenue || 0), 1);
      const grandRevenue = rows.reduce((sum, row) => sum + (row.revenue || 0), 0);
      const toneFor = (tier) => ({ 'برتر': 'success', 'حرفه‌ای': 'primary', 'اقتصادی': 'warning', 'جدید': 'info' }[tier] ?? 'neutral');

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'برندها',
            subtitle: 'پرتفوی برندها با سهم واقعی از فروش، کیفیت کاتالوگ و وضعیت موجودی',
            icon: 'award',
            badges: [statusBadge(`${toDigits(rows.length)} برند`, 'primary'), statusBadge(`${toDigits(summary.countries)} کشور مبدأ`, 'info')],
            actions: '<button class="btn btn-primary" type="button" data-brand-add><i class="bi bi-plus-lg"></i> برند جدید</button><button class="btn btn-light" type="button" data-export="csv"><i class="bi bi-download"></i> خروجی CSV</button>',
          })}
          <div class="kpi-row" data-brand-kpis></div>
          <section class="card brand-board">
            <header class="card__head">
              <div>
                <h2 class="card__title">پرتفوی برندها</h2>
                <p class="card__subtitle">روی هر کارت کلیک کنید تا کاتالوگ همان برند فیلتر شود</p>
              </div>
            </header>
            <div class="brand-toolbar">
              <label class="brand-toolbar__search"><i class="bi bi-search" aria-hidden="true"></i><input type="search" class="form-control" placeholder="جستجوی نام برند، کشور یا شهر…" aria-label="جستجوی برند" data-brand-search></label>
              <div class="brand-seg" role="tablist" aria-label="فیلتر وضعیت">
                <button type="button" role="tab" class="is-active" aria-selected="true" data-brand-filter="all">همه <span data-brand-count="all"></span></button>
                <button type="button" role="tab" aria-selected="false" data-brand-filter="featured">برندهای برتر <span data-brand-count="featured"></span></button>
                <button type="button" role="tab" aria-selected="false" data-brand-filter="active">فعال <span data-brand-count="active"></span></button>
                <button type="button" role="tab" aria-selected="false" data-brand-filter="low">نیازمند تأمین <span data-brand-count="low"></span></button>
              </div>
              <select class="form-select brand-toolbar__sort" aria-label="مرتب‌سازی برندها" data-brand-sort>
                <option value="revenue">بیشترین فروش</option>
                <option value="share">سهم بازار</option>
                <option value="products">بیشترین محصول</option>
                <option value="rating">بالاترین امتیاز</option>
                <option value="growth">سریع‌ترین رشد</option>
                <option value="name">الفبایی</option>
              </select>
            </div>
            <div class="brand-grid" data-brand-grid></div>
            <div class="brand-empty" data-brand-empty hidden></div>
          </section>
          <section class="card brand-rank">
            <header class="card__head">
              <div><h2 class="card__title">رتبه‌بندی برندها بر پایه فروش</h2><p class="card__subtitle">میله‌ها نسبت به پرفروش‌ترین برند مقیاس شده‌اند</p></div>
              <span class="badge badge--soft-success"><i class="bi bi-graph-up-arrow"></i> مجموع ${escapeHtml(formatCurrency(grandRevenue, 'IRR', { compact: true }))}</span>
            </header>
            <div class="brand-rank__body" data-brand-rank></div>
          </section>
          <section class="card">
            <header class="card__head">
              <div><h2 class="card__title">فهرست کامل برندها</h2><p class="card__subtitle">مرتب‌سازی، جستجو و صفحه‌بندی روی همه ستون‌ها فعال است</p></div>
            </header>
            <div class="card__body" data-datatable data-resource="brands">
              <div class="table-wrap"><table class="table table--hover"><thead><tr></tr></thead><tbody data-datatable-body></tbody></table></div>
              <div class="datatable__foot" data-datatable-foot></div>
            </div>
          </section>
        </div>`,
      );

      const paintKpis = () => {
        const cells = [
          ['برندهای فعال', toDigits(summary.active), `${toDigits(summary.featured)} برند برتر • ${toDigits(summary.countries)} کشور مبدأ`, 'primary', 'award'],
          ['محصولات کاتالوگ', toDigits(summary.products), `${toDigits(summary.sold)} فروش ثبت‌شده`, 'info', 'box-seam'],
          ['درآمد برندها', formatCurrency(summary.revenue, 'IRR', { compact: true }), `میانگین امتیاز ${formatNumber(summary.avgRating, { decimals: 1 })} از ۵`, 'success', 'graph-up-arrow'],
          ['هشدار تأمین', toDigits(summary.lowStock + summary.outOfStock), `${toDigits(summary.lowStock)} موجودی کم • ${toDigits(summary.outOfStock)} ناموجود`, 'warning', 'exclamation-triangle'],
        ];
        $('[data-brand-kpis]', node).innerHTML = cells
          .map(
            ([label, value, meta, tone, icon]) => `<article class="stat-card">
              <div class="stat-card__head"><span class="stat-card__label">${escapeHtml(label)}</span><span class="stat-card__icon stat-card__icon--${tone}"><i class="bi bi-${icon}" aria-hidden="true"></i></span></div>
              <p class="stat-card__value">${escapeHtml(value)}</p>
              <p class="stat-card__meta">${escapeHtml(meta)}</p>
            </article>`,
          )
          .join('');
      };

      const matches = (row) => {
        const q = state.q.trim().toLowerCase();
        if (q && ![row.name, row.country, row.city, row.tier].some((field) => String(field ?? '').toLowerCase().includes(q))) return false;
        if (state.filter === 'featured') return Boolean(row.featured);
        if (state.filter === 'active') return row.status === 'active';
        if (state.filter === 'low') return row.lowStock + row.outOfStock > 0;
        return true;
      };

      const sorters = {
        revenue: (a, b) => b.revenue - a.revenue,
        share: (a, b) => b.share - a.share,
        products: (a, b) => b.products - a.products,
        rating: (a, b) => b.rating - a.rating,
        growth: (a, b) => b.growth - a.growth,
        name: (a, b) => a.name.localeCompare(b.name, 'fa'),
      };

      const cardHtml = (row) => `<article class="brand-card${row.status === 'active' ? '' : ' is-off'}" tabindex="0" role="button" data-brand-card="${escapeHtml(row.id)}" aria-label="مشاهده محصولات ${escapeHtml(row.name)}">
        <header class="brand-card__head">
          <span class="brand-card__logo"><img src="${escapeHtml(row.logo)}" alt="" loading="lazy" /></span>
          <div class="brand-card__id">
            <strong>${escapeHtml(row.name)}</strong>
            <small><i class="bi bi-geo-alt"></i> ${escapeHtml(row.country)}${row.city ? ` — ${escapeHtml(row.city)}` : ''}</small>
          </div>
          <span class="brand-card__tier brand-card__tier--${toneFor(row.tier)}">${escapeHtml(row.tier)}</span>
        </header>
        <p class="brand-card__desc">${escapeHtml(row.description)}</p>
        <div class="brand-card__stats">
          <span><b class="numeric">${toDigits(row.products)}</b><small>محصول</small></span>
          <span><b class="numeric">${toDigits(row.sold)}</b><small>فروش</small></span>
          <span><b class="numeric">${formatCurrency(row.revenue, 'IRR', { compact: true })}</b><small>درآمد</small></span>
        </div>
        <div class="brand-card__meter">
          <span class="brand-card__meter-label">سهم از فروش <b class="numeric">${formatPercent(row.share, { decimals: 1 })}</b></span>
          <span class="brand-card__bar"><i style="--w:${Math.max(3, Math.round((row.revenue / maxRevenue) * 100))}%"></i></span>
        </div>
        <footer class="brand-card__foot">
          <span class="brand-card__rating rating rating--readonly" aria-label="امتیاز ${toDigits(row.rating)} از ۵">${Array.from({ length: 5 }, (_, i) => `<i class="bi bi-star${i < Math.round(row.rating) ? '-fill' : ''}" aria-hidden="true"></i>`).join('')}<b class="numeric">${formatNumber(row.rating, { decimals: 1 })}</b></span>
          <span class="brand-trend ${row.growth >= 0 ? 'is-up' : 'is-down'}"><i class="bi bi-${row.growth >= 0 ? 'arrow-up-right' : 'arrow-down-right'}"></i>${formatPercent(Math.abs(row.growth), { decimals: 1 })}</span>
          <span class="brand-card__since">از سال ${toDigits(row.since)}</span>
        </footer>
        <div class="brand-card__actions">
          <button type="button" class="icon-btn icon-btn--sm" data-brand-edit="${escapeHtml(row.id)}" title="ویرایش" aria-label="ویرایش ${escapeHtml(row.name)}"><i class="bi bi-pencil"></i></button>
          <button type="button" class="icon-btn icon-btn--sm" data-brand-toggle="${escapeHtml(row.id)}" title="${row.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}" aria-label="${row.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'} ${escapeHtml(row.name)}"><i class="bi bi-${row.status === 'active' ? 'pause-circle' : 'play-circle'}"></i></button>
          <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-brand-delete="${escapeHtml(row.id)}" title="حذف" aria-label="حذف ${escapeHtml(row.name)}"><i class="bi bi-trash3"></i></button>
        </div>
      </article>`;

      const paintGrid = () => {
        const list = rows.filter(matches).sort(sorters[state.sort] ?? sorters.revenue);
        $('[data-brand-grid]', node).innerHTML = list.map(cardHtml).join('');
        const empty = $('[data-brand-empty]', node);
        empty.hidden = list.length > 0;
        if (!list.length) empty.innerHTML = emptyState({ title: 'برندی با این فیلتر پیدا نشد', text: 'عبارت جستجو را کوتاه‌تر کنید یا فیلتر دیگری انتخاب کنید.', icon: 'search' });
        $$('[data-brand-count]', node).forEach((el) => {
          const key = el.dataset.brandCount;
          const count = key === 'all' ? rows.length : rows.filter((row) => (key === 'featured' ? row.featured : key === 'low' ? row.lowStock + row.outOfStock > 0 : row.status === key)).length;
          el.textContent = toDigits(count);
        });
      };

      const paintRank = () => {
        const top = [...rows].sort(sorters.revenue).slice(0, 8);
        $('[data-brand-rank]', node).innerHTML = top
          .map(
            (row, index) => `<div class="brand-rank__row" data-brand-jump="${escapeHtml(row.id)}" role="button" tabindex="0">
              <span class="brand-rank__place numeric">${toDigits(index + 1)}</span>
              <span class="brand-rank__logo"><img src="${escapeHtml(row.logo)}" alt="" loading="lazy" /></span>
              <span class="brand-rank__name">${escapeHtml(row.name)}<small>${escapeHtml(row.country)} • ${toDigits(row.products)} محصول</small></span>
              <span class="brand-rank__track"><i style="--w:${Math.max(4, Math.round((row.revenue / maxRevenue) * 100))}%"></i></span>
              <span class="brand-rank__value numeric">${escapeHtml(formatCurrency(row.revenue, 'IRR', { compact: true }))}<small>${formatPercent(row.share, { decimals: 1 })} سهم</small></span>
              <span class="brand-trend ${row.growth >= 0 ? 'is-up' : 'is-down'}"><i class="bi bi-${row.growth >= 0 ? 'arrow-up-right' : 'arrow-down-right'}"></i>${formatPercent(Math.abs(row.growth), { decimals: 1 })}</span>
            </div>`,
          )
          .join('');
      };

      paintKpis();
      paintGrid();
      paintRank();

      const table = createDataTable($('[data-datatable]', node), { resource: 'brands', perPage: 10, sort: 'revenue', order: 'desc' });

      const openForm = (row = null) =>
        openRecordForm({
          resource: 'brands',
          id: row?.id ?? null,
          title: row ? `ویرایش ${row.name}` : 'افزودن برند جدید',
          subtitle: 'اطلاعات پایه، مبدأ و جایگاه برند در پرتفوی',
          fields: crudFields('brands'),
          onSaved: () => window.location.reload(),
        });

      let searchTimer;
      on($('[data-brand-search]', node), 'input', (event) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.q = event.target.value;
          paintGrid();
        }, 140);
      });
      on($('[data-brand-sort]', node), 'change', (event) => {
        state.sort = event.target.value;
        paintGrid();
        paintRank();
      });
      $$('[data-brand-filter]', node).forEach((button) =>
        on(button, 'click', () => {
          state.filter = button.dataset.brandFilter;
          $$('[data-brand-filter]', node).forEach((b) => {
            b.classList.toggle('is-active', b === button);
            b.setAttribute('aria-selected', String(b === button));
          });
          paintGrid();
        }),
      );
      on($('[data-brand-add]', node), 'click', () => openForm());
      exportable(node, 'brands');

      on($('[data-brand-grid]', node), 'click', async (event) => {
        const edit = event.target.closest('[data-brand-edit]');
        const toggle = event.target.closest('[data-brand-toggle]');
        const remove = event.target.closest('[data-brand-delete]');
        if (edit) return openForm(rows.find((row) => row.id === edit.dataset.brandEdit));
        if (toggle) {
          const row = rows.find((r) => r.id === toggle.dataset.brandToggle);
          if (!row) return;
          const next = row.status === 'active' ? 'inactive' : 'active';
          row.status = next;
          paintGrid();
          try {
            await service.update(row.id, { status: next });
            toast.success(next === 'active' ? 'برند فعال شد' : 'برند غیرفعال شد', row.name);
            table?.reload();
          } catch {
            row.status = next === 'active' ? 'inactive' : 'active';
            paintGrid();
            toast.danger('تغییر وضعیت انجام نشد', 'دوباره تلاش کنید.');
          }
          return;
        }
        if (remove) {
          const row = rows.find((r) => r.id === remove.dataset.brandDelete);
          if (!row) return;
          const ok = await modal.confirm({
            title: 'حذف برند',
            text: `«${row.name}» از پرتفوی حذف می‌شود. ${toDigits(row.products)} محصول این برند بدون برند باقی می‌مانند.`,
            tone: 'danger',
            confirmText: 'حذف برند',
          });
          if (!ok) return;
          await service.remove(row.id);
          toast.success('برند حذف شد', row.name);
          await service.list({ perPage: 200 }).then(({ items }) => {
            rows.splice(0, rows.length, ...items);
          });
          paintGrid();
          paintRank();
          table?.reload();
          return;
        }
        const card = event.target.closest('[data-brand-card]');
        if (card) window.location.href = url(`ecommerce/products.html?q=${encodeURIComponent(rows.find((r) => r.id === card.dataset.brandCard)?.name ?? '')}`);
      });

      on($('[data-brand-rank]', node), 'click', (event) => {
        const row = event.target.closest('[data-brand-jump]');
        if (!row) return;
        const name = rows.find((r) => r.id === row.dataset.brandJump)?.name ?? '';
        window.location.href = url(`ecommerce/products.html?q=${encodeURIComponent(name)}`);
      });
      return;
    }

    case 'ecommerce/tags.html': {
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(4)}</div>`);
      const service = services.tagService;
      const { items: rows, summary } = await service.list({ perPage: 200, sort: 'products', order: 'desc' });
      const state = { q: '', filter: 'all', sort: 'products' };

      const maxProducts = Math.max(...rows.map((row) => row.products || 0), 1);
      const toneForKind = (kind) => (kind === 'auto' ? 'info' : 'violet');

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'برچسب‌ها',
            subtitle: 'برچسب‌گذاری کاتالوگ، قواعد خودکار و اثر هر برچسب بر بازدید و فروش',
            icon: 'tags',
            badges: [statusBadge(`${toDigits(rows.length)} برچسب`, 'primary'), statusBadge(`${toDigits(summary.automatic)} قاعده خودکار`, 'info')],
            actions: '<button class="btn btn-primary" type="button" data-tag-add><i class="bi bi-plus-lg"></i> برچسب جدید</button><button class="btn btn-light" type="button" data-export="csv"><i class="bi bi-download"></i> خروجی CSV</button>',
          })}
          <div class="kpi-row" data-tag-kpis></div>
          <section class="card tag-board">
            <header class="card__head">
              <div><h2 class="card__title">ابر برچسب‌ها</h2><p class="card__subtitle">اندازه هر برچسب به تعداد محصولاتش بستگی دارد — برای فیلتر کردن کلیک کنید</p></div>
            </header>
            <div class="tag-cloud" data-tag-cloud></div>
            <div class="tag-toolbar">
              <label class="tag-toolbar__search"><i class="bi bi-search" aria-hidden="true"></i><input type="search" class="form-control" placeholder="جستجوی برچسب، اسلاگ یا توضیح…" aria-label="جستجوی برچسب" data-tag-search></label>
              <div class="tag-seg" role="tablist" aria-label="فیلتر نوع برچسب">
                <button type="button" role="tab" class="is-active" aria-selected="true" data-tag-filter="all">همه <span data-tag-count="all"></span></button>
                <button type="button" role="tab" aria-selected="false" data-tag-filter="auto">خودکار <span data-tag-count="auto"></span></button>
                <button type="button" role="tab" aria-selected="false" data-tag-filter="manual">دستی <span data-tag-count="manual"></span></button>
                <button type="button" role="tab" aria-selected="false" data-tag-filter="archived">بایگانی <span data-tag-count="archived"></span></button>
              </div>
              <select class="form-select tag-toolbar__sort" aria-label="مرتب‌سازی برچسب‌ها" data-tag-sort>
                <option value="products">بیشترین محصول</option>
                <option value="views">بیشترین بازدید</option>
                <option value="conversion">بالاترین نرخ تبدیل</option>
                <option value="growth">سریع‌ترین رشد</option>
                <option value="name">الفبایی</option>
              </select>
            </div>
            <div class="tag-grid" data-tag-grid></div>
            <div class="tag-empty" data-tag-empty hidden></div>
          </section>
          <section class="card">
            <header class="card__head">
              <div><h2 class="card__title">فهرست کامل برچسب‌ها</h2><p class="card__subtitle">نوع، تعداد محصول، بازدید، نرخ تبدیل و رشد هر برچسب</p></div>
            </header>
            <div class="card__body" data-datatable data-resource="tags">
              <div class="table-wrap"><table class="table table--hover"><thead><tr></tr></thead><tbody data-datatable-body></tbody></table></div>
              <div class="datatable__foot" data-datatable-foot></div>
            </div>
          </section>
        </div>`,
      );

      const paintKpis = () => {
        const cells = [
          ['برچسب‌های فعال', toDigits(summary.active), `${toDigits(summary.archived)} بایگانی‌شده • ${toDigits(summary.manual)} برچسب دستی`, 'primary', 'tags'],
          ['محصولات برچسب‌خورده', toDigits(summary.products), `${toDigits(summary.assignments)} انتساب برچسب`, 'info', 'box-seam'],
          ['مجموع بازدید', formatNumber(summary.views), `میانگین نرخ تبدیل ${formatPercent(summary.avgConversion, { decimals: 1 })}`, 'success', 'eye'],
          ['فروش برچسب‌خورده', formatCurrency(summary.revenue, 'IRR', { compact: true }), `پرفروش‌ترین برچسب: ${summary.top}`, 'warning', 'graph-up-arrow'],
        ];
        $('[data-tag-kpis]', node).innerHTML = cells
          .map(
            ([label, value, meta, tone, icon]) => `<article class="stat-card">
              <div class="stat-card__head"><span class="stat-card__label">${escapeHtml(label)}</span><span class="stat-card__icon stat-card__icon--${tone}"><i class="bi bi-${icon}" aria-hidden="true"></i></span></div>
              <p class="stat-card__value">${escapeHtml(value)}</p>
              <p class="stat-card__meta">${escapeHtml(meta)}</p>
            </article>`,
          )
          .join('');
      };

      const sorters = {
        products: (a, b) => b.products - a.products,
        views: (a, b) => b.views - a.views,
        conversion: (a, b) => b.conversion - a.conversion,
        growth: (a, b) => b.growth - a.growth,
        name: (a, b) => a.name.localeCompare(b.name, 'fa'),
      };
      const matches = (row) => {
        const q = state.q.trim().toLowerCase();
        if (q && ![row.name, row.slug, row.description].some((field) => String(field ?? '').toLowerCase().includes(q))) return false;
        if (state.filter === 'all') return true;
        if (state.filter === 'archived') return row.status !== 'active';
        return row.kind === state.filter;
      };

      const chipHtml = (row) => `<button type="button" class="tag-chip tag-chip--${escapeHtml(row.color)}${row.status === 'active' ? '' : ' is-off'}" style="--weight:${Math.round((0.82 + (row.popularity / 100) * 0.5) * 100) / 100}" data-tag-filter-chip="${escapeHtml(row.id)}" aria-label="فیلتر برچسب ${escapeHtml(row.name)}">
        <span class="tag-chip__hash">#</span>${escapeHtml(row.name)}<span class="tag-chip__count numeric">${toDigits(row.products)}</span>
      </button>`;

      const cardHtml = (row) => `<article class="tag-card${row.status === 'active' ? '' : ' is-off'}" data-tag-card="${escapeHtml(row.id)}" data-tone="${escapeHtml(row.color)}">
        <header class="tag-card__head">
          <span class="tag-card__icon"><i class="bi bi-hash" aria-hidden="true"></i></span>
          <div class="tag-card__id">
            <strong>${escapeHtml(row.name)}</strong>
            <code dir="ltr">/${escapeHtml(row.slug)}</code>
          </div>
          <span class="badge badge--soft-${toneForKind(row.kind)}"><i class="bi bi-${row.kind === 'auto' ? 'lightning-charge' : 'hand-index'}"></i> ${row.kind === 'auto' ? 'خودکار' : 'دستی'}</span>
        </header>
        <p class="tag-card__desc">${escapeHtml(row.description)}</p>
        <div class="tag-card__stats">
          <span><b class="numeric">${toDigits(row.products)}</b><small>محصول</small></span>
          <span><b class="numeric">${formatNumber(row.views)}</b><small>بازدید</small></span>
          <span><b class="numeric">${formatPercent(row.conversion, { decimals: 1 })}</b><small>نرخ تبدیل</small></span>
        </div>
        <div class="tag-card__meter">
          <span class="tag-card__meter-label">پوشش کاتالوگ <b class="numeric">${formatPercent(row.usageShare, { decimals: 1 })}</b></span>
          <span class="tag-card__bar"><i style="--w:${Math.max(3, Math.round((row.products / maxProducts) * 100))}%"></i></span>
        </div>
        <footer class="tag-card__foot">
          <span class="tag-trend ${row.growth >= 0 ? 'is-up' : 'is-down'}"><i class="bi bi-${row.growth >= 0 ? 'arrow-up-right' : 'arrow-down-right'}"></i>${formatPercent(Math.abs(row.growth), { decimals: 1 })} نسبت به فصل قبل</span>
          <span class="tag-card__revenue">${escapeHtml(formatCurrency(row.revenue, 'IRR', { compact: true }))}</span>
          <span class="badge badge--soft-${row.status === 'active' ? 'success' : 'neutral'}">${row.status === 'active' ? 'فعال' : 'بایگانی'}</span>
        </footer>
        <div class="tag-card__actions">
          <button type="button" class="icon-btn icon-btn--sm" data-tag-edit="${escapeHtml(row.id)}" title="ویرایش" aria-label="ویرایش ${escapeHtml(row.name)}"><i class="bi bi-pencil"></i></button>
          <button type="button" class="icon-btn icon-btn--sm" data-tag-toggle="${escapeHtml(row.id)}" title="${row.status === 'active' ? 'بایگانی کن' : 'فعال کن'}" aria-label="${row.status === 'active' ? 'بایگانی' : 'فعال‌سازی'} ${escapeHtml(row.name)}"><i class="bi bi-${row.status === 'active' ? 'archive' : 'arrow-counterclockwise'}"></i></button>
          <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-tag-delete="${escapeHtml(row.id)}" title="حذف" aria-label="حذف ${escapeHtml(row.name)}"><i class="bi bi-trash3"></i></button>
        </div>
      </article>`;

      const paintCloud = () => {
        const list = [...rows].sort(sorters.products).slice(0, 12);
        $('[data-tag-cloud]', node).innerHTML = list.map(chipHtml).join('');
      };

      const paintGrid = () => {
        const list = rows.filter(matches).sort(sorters[state.sort] ?? sorters.products);
        $('[data-tag-grid]', node).innerHTML = list.map(cardHtml).join('');
        const empty = $('[data-tag-empty]', node);
        empty.hidden = list.length > 0;
        if (!list.length) empty.innerHTML = emptyState({ title: 'برچسبی با این فیلتر پیدا نشد', text: 'عبارت جستجو را کوتاه‌تر کنید یا فیلتر دیگری انتخاب کنید.', icon: 'search' });
        $$('[data-tag-count]', node).forEach((el) => {
          const key = el.dataset.tagCount;
          const count = key === 'all' ? rows.length : rows.filter((row) => (key === 'archived' ? row.status !== 'active' : row.kind === key)).length;
          el.textContent = toDigits(count);
        });
      };

      paintKpis();
      paintCloud();
      paintGrid();

      const table = createDataTable($('[data-datatable]', node), { resource: 'tags', perPage: 10, sort: 'products', order: 'desc' });

      const openForm = (row = null) =>
        openRecordForm({
          resource: 'tags',
          id: row?.id ?? null,
          title: row ? `ویرایش برچسب ${row.name}` : 'افزودن برچسب جدید',
          subtitle: 'نام، رنگ، نوع انتساب و توضیح کاربرد برچسب',
          fields: crudFields('tags'),
          onSaved: () => window.location.reload(),
        });

      let searchTimer;
      on($('[data-tag-search]', node), 'input', (event) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.q = event.target.value;
          paintGrid();
        }, 140);
      });
      on($('[data-tag-sort]', node), 'change', (event) => {
        state.sort = event.target.value;
        paintGrid();
      });
      $$('[data-tag-filter]', node).forEach((button) =>
        on(button, 'click', () => {
          state.filter = button.dataset.tagFilter;
          $$('[data-tag-filter]', node).forEach((b) => {
            b.classList.toggle('is-active', b === button);
            b.setAttribute('aria-selected', String(b === button));
          });
          paintGrid();
        }),
      );
      on($('[data-tag-add]', node), 'click', () => openForm());
      exportable(node, 'tags');
      on($('[data-tag-cloud]', node), 'click', (event) => {
        const chip = event.target.closest('[data-tag-filter-chip]');
        if (!chip) return;
        const row = rows.find((r) => r.id === chip.dataset.tagFilterChip);
        window.location.href = url(`ecommerce/products.html?q=${encodeURIComponent(row?.name ?? '')}`);
      });

      on($('[data-tag-grid]', node), 'click', async (event) => {
        const edit = event.target.closest('[data-tag-edit]');
        const toggle = event.target.closest('[data-tag-toggle]');
        const remove = event.target.closest('[data-tag-delete]');
        if (edit) return openForm(rows.find((row) => row.id === edit.dataset.tagEdit));
        if (toggle) {
          const row = rows.find((r) => r.id === toggle.dataset.tagToggle);
          if (!row) return;
          const next = row.status === 'active' ? 'archived' : 'active';
          row.status = next;
          paintGrid();
          paintCloud();
          try {
            await service.update(row.id, { status: next });
            toast.success(next === 'active' ? 'برچسب فعال شد' : 'برچسب بایگانی شد', row.name);
            table?.reload();
          } catch {
            row.status = next === 'active' ? 'archived' : 'active';
            paintGrid();
            toast.danger('تغییر وضعیت انجام نشد', 'دوباره تلاش کنید.');
          }
          return;
        }
        if (remove) {
          const row = rows.find((r) => r.id === remove.dataset.tagDelete);
          if (!row) return;
          const ok = await modal.confirm({
            title: 'حذف برچسب',
            text: `«${row.name}» از ${toDigits(row.products)} محصول برداشته می‌شود. محصولات حذف نمی‌شوند.`,
            tone: 'danger',
            confirmText: 'حذف برچسب',
          });
          if (!ok) return;
          await service.remove(row.id);
          await service.list({ perPage: 200 }).then(({ items }) => {
            rows.splice(0, rows.length, ...items);
          });
          paintCloud();
          paintGrid();
          table?.reload();
        }
      });
      return;
    }

    case 'ecommerce/coupons.html':
    case 'ecommerce/reviews.html': {
      const resource = page.split('/').pop().replace('.html', '');
      const node = host();
      const overview = await services.catalogService.overview();
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: node.dataset.title ?? resource, subtitle: 'مدیریت کامل با جستجو، فیلتر و عملیات گروهی', icon: 'tags', actions: toolButtons({ create: 'افزودن مورد جدید' }) })}
          ${statsFrom(overview, [
            ['products', 'محصولات', 'number', 'primary', 'box-seam'],
            ['published', 'منتشرشده', 'number', 'success', 'check2-circle'],
            ['lowStock', 'موجودی کم', 'number', 'warning', 'exclamation-triangle'],
            ['inventoryValue', 'ارزش انبار', 'currency', 'violet', 'cash-stack'],
          ])}
          <div class="card"><div class="card__head"><div><h2 class="card__title">فهرست</h2><p class="card__subtitle">ستون‌ها، فیلترها و جستجو قابل تنظیم است</p></div></div>
            <div class="card__body" data-datatable data-resource="${escapeHtml(resource)}">
              <div class="table-wrap"><table class="table table--hover"><thead><tr></tr></thead><tbody data-datatable-body></tbody></table></div>
              <div class="datatable__foot" data-datatable-foot></div>
            </div>
          </div>
        </div>`,
      );
      const table = createDataTable($('[data-datatable]', node), { resource });
      on($('[data-create]', node), 'click', () => openRecordForm({ resource, title: 'افزودن مورد جدید', fields: crudFields(resource), onSaved: () => table.reload() }));
      return;
    }

    case 'ecommerce/inventory.html': {
      const node = host();
      const { items } = await services.inventoryService.list({ perPage: 12, sort: 'stock', order: 'asc' });
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'کنترل موجودی', subtitle: 'کالاهای نزدیک به پایان موجودی و وضعیت انبارها', icon: 'boxes', actions: toolButtons({ exportResource: 'inventory' }) })}
          ${statsFrom({ skus: items.length, low: items.filter((i) => i.stock < (i.reorderLevel ?? 20)).length, incoming: items.reduce((sum, i) => sum + (i.incoming ?? 0), 0), reserved: items.reduce((sum, i) => sum + (i.reserved ?? 0), 0) }, [
            ['skus', 'کد کالا', 'number', 'primary', 'upc-scan'],
            ['low', 'نیازمند سفارش', 'number', 'danger', 'exclamation-octagon'],
            ['incoming', 'در راه', 'number', 'info', 'truck'],
            ['reserved', 'رزرو‌شده', 'number', 'warning', 'bookmark-check'],
          ])}
          ${card({ title: 'موجودی انبارها', flush: true, body: `<table class="table table--hover"><thead><tr><th>محصول</th><th>انبار</th><th>موجودی</th><th>رزرو</th><th>ورودی</th><th>به‌روزرسانی</th></tr></thead><tbody>${items
            .map(
              (item) => `<tr><td><div class="table__primary"><img class="table__thumb" src="${escapeHtml(item.image ?? 'assets/img/products/product-01.svg')}" alt=""><div class="table__primary-text"><span class="table__primary-title">${escapeHtml(item.product)}</span><span class="table__primary-sub">${escapeHtml(item.sku ?? '')}</span></div></div></td>
              <td>${escapeHtml(item.warehouse ?? 'انبار مرکزی')}</td>
              <td class="numeric ${item.stock < (item.reorderLevel ?? 20) ? 'text-danger' : ''}">${toDigits(item.stock)}</td>
              <td class="numeric">${toDigits(item.reserved ?? 0)}</td>
              <td class="numeric">${toDigits(item.incoming ?? 0)}</td>
              <td>${relativeTime(item.updatedAt)}</td></tr>`,
            )
            .join('')}</tbody></table>` })}
        </div>`,
      );
      exportable(node, 'inventory');
      return;
    }

    default:
      // Remaining eCommerce pages keep the generic, data-driven body.
      return;
  }
}

async function ecommerceProductForm() {
  const id = queryParam('id');
  const node = host();
  const fields = [
    { name: 'name', label: 'نام محصول', required: true, col: 2 },
    { name: 'sku', label: 'کد کالا (SKU)', required: true },
    { name: 'brand', label: 'برند', type: 'select', options: ['نووا', 'آرکا', 'داده‌پرداز', 'ویرا', 'اپل', 'سامسونگ'], required: true },
    { name: 'category', label: 'دسته‌بندی', type: 'select', options: ['لپ‌تاپ و اولترابوک', 'گوشی موبایل و تبلت', 'هدفون و تجهیزات صوتی', 'ساعت و گجت‌های هوشمند', 'لوازم جانبی کامپیوتر'], required: true },
    { name: 'price', label: 'قیمت پایه (ریال)', type: 'number', inputMode: 'numeric', required: true, rule: 'number' },
    { name: 'discount', label: 'تخفیف (٪)', type: 'number', inputMode: 'numeric' },
    { name: 'stock', label: 'موجودی انبار', type: 'number', inputMode: 'numeric', required: true, rule: 'number' },
    { name: 'status', label: 'وضعیت انتشار', type: 'select', options: [{ value: 'published', label: 'منتشرشده در فروشگاه' }, { value: 'draft', label: 'پیش‌نویس' }, { value: 'archived', label: 'بایگانی‌شده' }] },
    { name: 'tags', label: 'برچسب‌ها', type: 'tags', hint: 'با کاما جدا کنید' },
    { name: 'description', label: 'توضیحات و مشخصات فنی', type: 'textarea', col: 2, rows: 5 },
  ];
  const values = id ? await loadRecord('products', id) : {};

  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: id ? 'ویرایش محصول' : 'افزودن محصول جدید',
        subtitle: 'تصاویر محصول، اطلاعات پایه، قیمت‌گذاری و وضعیت انتشار در فروشگاه',
        icon: 'box-seam',
        actions: '<a class="btn btn-light" href="ecommerce/products.html"><i class="bi bi-arrow-right"></i> بازگشت به فهرست</a>'
      })}
      <div class="row g-4">
        <div class="col-lg-5">
          <section class="card pm-card" aria-label="تصاویر محصول">
            <header class="card__head">
              <div>
                <h2 class="card__title"><i class="bi bi-images text-primary"></i> استودیو تصاویر محصول</h2>
                <p class="card__subtitle">تا ۱۰ تصویر — بکشید و رها کنید، ترتیب را تغییر دهید و کاور را انتخاب کنید</p>
              </div>
            </header>
            <div class="card__body pm" data-gallery-container></div>
            <div class="pm-dropveil" aria-hidden="true"><i class="bi bi-cloud-arrow-up"></i><span>رها کنید تا به گالری اضافه شود</span></div>
          </section>
        </div>

        <!-- Product Form Column -->
        <div class="col-lg-7">
          ${card({
            title: 'اطلاعات و مشخصات محصول',
            body: `<form data-product-form novalidate>
              ${formMarkup(fields, values)}
              <div class="form-actions form-actions--end mt-4">
                <button type="reset" class="btn btn-light">بازنشانی فرم</button>
                <button type="submit" class="btn btn-primary" data-submit>${id ? 'ذخیره تغییرات محصول' : 'ثبت و انتشار محصول'}</button>
              </div>
            </form>`
          })}
        </div>
      </div>
    </div>`
  );

  /* ------------------------------------------------------------------
   * Media studio (v1.1): stage with pointer-zoom + swipe, reorderable
   * thumbnail rail, drag & drop upload on the whole card, per-image alt
   * text and a readiness meter. Everything is class-based (see
   * pages/_product-media.scss) — no inline layout styles.
   * ------------------------------------------------------------------ */
  const MAX_IMAGES = 10;
  const MAX_BYTES = 5 * 1024 * 1024;
  const SAMPLE_POOL = Array.from({ length: 24 }, (_, i) => `assets/img/products/product-${String(i + 1).padStart(2, '0')}.svg`);
  let seq = 0;
  const makeId = () => `img-${Date.now().toString(36)}-${(seq += 1)}`;
  /**
   * Gallery seed.
   *
   * Editing a product must show *its own* photos: records store the cover in
   * `image` and (after a save) the whole gallery in `images`, which older data
   * may keep as a plain array of URLs. Both shapes are normalised here so the
   * carousel — add, remove, reorder, set cover — always opens with the real
   * media, exactly like the create screen.
   */
  const seed = (() => {
    const stored = Array.isArray(values.images) ? values.images.filter(Boolean) : [];
    const list = stored.map((img, index) => (typeof img === 'string' ? { url: img, name: `تصویر ${index + 1}`, alt: '' } : img));
    if (list.length) return list;
    if (id || values.image) {
      return [{ url: values.image || 'assets/img/products/product-01.svg', name: 'تصویر اصلی', alt: values.name ?? '' }];
    }
    return [
      { url: 'assets/img/products/product-01.svg', name: 'تصویر اصلی', alt: '' },
      { url: 'assets/img/products/product-02.svg', name: 'نمای زاویه‌دار', alt: '' },
    ];
  })();
  let productImages = seed.map((img, index) => ({
    id: img.id ?? makeId(),
    url: img.url,
    name: img.name ?? `تصویر ${index + 1}`,
    alt: img.alt ?? '',
    isCover: img.isCover === undefined ? index === 0 : Boolean(img.isCover),
  }));
  if (!productImages.some((img) => img.isCover) && productImages[0]) productImages[0].isCover = true;
  let currentImageIndex = 0;
  const blobUrls = new Set();

  const galleryHost = $('[data-gallery-container]', node);
  const galleryCard = galleryHost?.closest('.card');

  const readiness = () => {
    const checks = [
      { ok: productImages.length >= 3, label: 'حداقل ۳ تصویر از زوایای مختلف' },
      { ok: productImages.some((img) => img.isCover), label: 'تصویر کاور انتخاب شده' },
      { ok: productImages.length > 0 && productImages.every((img) => img.alt.trim().length >= 3), label: 'متن جایگزین (alt) برای همه تصاویر' },
    ];
    return { checks, score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100) };
  };

  const renderGalleryUi = () => {
    if (!galleryHost) return;
    currentImageIndex = Math.max(0, Math.min(currentImageIndex, productImages.length - 1));
    const current = productImages[currentImageIndex];
    const { checks, score } = readiness();
    const multi = productImages.length > 1;
    render(
      galleryHost,
      `<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" class="visually-hidden" tabindex="-1" data-file-input aria-hidden="true">
      ${
        current
          ? `<figure class="pm-stage" data-stage tabindex="0" aria-roledescription="اسلایدر" aria-label="تصویر ${toDigits(currentImageIndex + 1)} از ${toDigits(productImages.length)}">
              <div class="pm-stage__frame" data-zoom-frame><img class="pm-stage__img" src="${escapeHtml(current.url)}" alt="${escapeHtml(current.alt || current.name)}" draggable="false" data-zoom-img></div>
              <div class="pm-stage__top">
                ${current.isCover ? '<span class="pm-chip pm-chip--cover"><i class="bi bi-star-fill"></i> کاور</span>' : `<button type="button" class="pm-chip" data-set-cover="${current.id}"><i class="bi bi-star"></i> کاور شود</button>`}
                <button type="button" class="pm-chip pm-chip--danger" data-delete-img="${current.id}" aria-label="حذف این تصویر"><i class="bi bi-trash3"></i></button>
              </div>
              ${
                multi
                  ? `<button type="button" class="pm-nav pm-nav--prev" data-carousel-prev aria-label="تصویر قبلی"><i class="bi bi-chevron-right"></i></button>
                     <button type="button" class="pm-nav pm-nav--next" data-carousel-next aria-label="تصویر بعدی"><i class="bi bi-chevron-left"></i></button>
                     <div class="pm-dots" aria-hidden="true">${productImages.map((_, i) => `<span class="${i === currentImageIndex ? 'is-active' : ''}"></span>`).join('')}</div>`
                  : ''
              }
              <span class="pm-stage__hint"><i class="bi bi-zoom-in"></i> برای بزرگ‌نمایی نشانگر را حرکت دهید</span>
            </figure>
            <div class="pm-alt">
              <label class="form-label" for="pm-alt-input">متن جایگزین تصویر <span class="text-muted">(سئو و دسترس‌پذیری)</span></label>
              <input id="pm-alt-input" class="form-control" maxlength="120" placeholder="مثلاً: نمای روبه‌روی لپ‌تاپ نقره‌ای" value="${escapeHtml(current.alt)}" data-alt-input>
            </div>`
          : `<button type="button" class="pm-empty" data-browse>
              <span class="pm-empty__icon"><i class="bi bi-images"></i></span>
              <strong>تصاویر محصول را اینجا رها کنید</strong>
              <span>یا برای انتخاب کلیک کنید — PNG، JPG، WebP تا ۵ مگابایت</span>
            </button>`
      }
      <div class="pm-rail-head">
        <span class="fw-semibold">تصاویر <span class="numeric">${toDigits(productImages.length)}</span>/<span class="numeric">${toDigits(MAX_IMAGES)}</span></span>
        <span class="text-muted fs-sm">${multi ? 'برای تغییر ترتیب، بکشید و رها کنید' : ''}</span>
      </div>
      <ol class="pm-rail" data-rail>
        ${productImages
          .map(
            (img, idx) => `<li class="pm-thumb${idx === currentImageIndex ? ' is-active' : ''}" draggable="true" data-thumb-idx="${idx}">
              <button type="button" class="pm-thumb__btn" data-thumb-select="${idx}" aria-label="نمایش ${escapeHtml(img.name)}" aria-current="${idx === currentImageIndex}">
                <img src="${escapeHtml(img.url)}" alt="" draggable="false" loading="lazy">
              </button>
              ${img.isCover ? '<span class="pm-thumb__cover" title="کاور"><i class="bi bi-star-fill"></i></span>' : ''}
              <span class="pm-thumb__order numeric">${toDigits(idx + 1)}</span>
            </li>`,
          )
          .join('')}
        ${
          productImages.length < MAX_IMAGES
            ? `<li class="pm-thumb pm-thumb--add"><button type="button" class="pm-thumb__btn" data-browse aria-label="افزودن تصویر"><i class="bi bi-plus-lg"></i><span>افزودن</span></button></li>`
            : ''
        }
      </ol>
      <div class="pm-foot">
        <div class="pm-score" style="--score:${score}">
          <span class="pm-score__ring" aria-hidden="true"></span>
          <span class="pm-score__value numeric">${toDigits(score)}٪</span>
        </div>
        <ul class="pm-checks">${checks.map((c) => `<li class="${c.ok ? 'is-ok' : ''}"><i class="bi bi-${c.ok ? 'check-circle-fill' : 'circle'}"></i> ${escapeHtml(c.label)}</li>`).join('')}</ul>
        <button type="button" class="btn btn-sm btn-light pm-foot__sample" data-add-sample-photos ${productImages.length >= MAX_IMAGES ? 'disabled' : ''}><i class="bi bi-magic"></i> تصاویر نمونه</button>
      </div>`,
    );
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const room = MAX_IMAGES - productImages.length;
    const accepted = [];
    let rejected = 0;
    files.forEach((file) => {
      if (accepted.length >= room || !/^image\//.test(file.type) || file.size > MAX_BYTES) {
        rejected += 1;
        return;
      }
      accepted.push(file);
    });
    accepted.forEach((file) => {
      const url = URL.createObjectURL(file);
      blobUrls.add(url);
      productImages.push({ id: makeId(), url, name: file.name, alt: '', isCover: productImages.length === 0 });
    });
    if (accepted.length) {
      currentImageIndex = productImages.length - accepted.length;
      toast.success('تصاویر اضافه شد', `${toDigits(accepted.length)} تصویر به گالری افزوده شد.`);
    }
    if (rejected) toast.warning('برخی فایل‌ها پذیرفته نشد', `فقط تصویر تا ۵ مگابایت و حداکثر ${toDigits(MAX_IMAGES)} تصویر مجاز است.`);
    renderGalleryUi();
  };

  const go = (step) => {
    if (productImages.length < 2) return;
    currentImageIndex = (currentImageIndex + step + productImages.length) % productImages.length;
    renderGalleryUi();
    $('[data-stage]', galleryHost)?.focus({ preventScroll: true });
  };

  renderGalleryUi();

  on(galleryHost, 'click', (e) => {
    if (e.target.closest('[data-browse]')) {
      $('[data-file-input]', galleryHost)?.click();
      return;
    }
    if (e.target.closest('[data-add-sample-photos]')) {
      const used = new Set(productImages.map((img) => img.url));
      const samples = SAMPLE_POOL.filter((u) => !used.has(u)).slice(0, Math.min(3, MAX_IMAGES - productImages.length));
      samples.forEach((u, i) => productImages.push({ id: makeId(), url: u, name: `تصویر نمونه ${toDigits(i + 1)}`, alt: '', isCover: productImages.length === 0 }));
      if (samples.length) toast.success('تصاویر نمونه افزوده شد', `${toDigits(samples.length)} تصویر اضافه شد.`);
      renderGalleryUi();
      return;
    }
    // In RTL the «prev» control sits on the right and moves backwards.
    if (e.target.closest('[data-carousel-prev]')) return go(-1);
    if (e.target.closest('[data-carousel-next]')) return go(1);
    const thumb = e.target.closest('[data-thumb-select]');
    if (thumb) {
      currentImageIndex = Number(thumb.dataset.thumbSelect);
      renderGalleryUi();
      return;
    }
    const cover = e.target.closest('[data-set-cover]');
    if (cover) {
      productImages.forEach((img) => (img.isCover = img.id === cover.dataset.setCover));
      toast.success('کاور تغییر کرد', 'این تصویر در فهرست و فروشگاه نمایش داده می‌شود.');
      renderGalleryUi();
      return;
    }
    const del = e.target.closest('[data-delete-img]');
    if (del) {
      const removed = productImages.find((img) => img.id === del.dataset.deleteImg);
      productImages = productImages.filter((img) => img.id !== del.dataset.deleteImg);
      if (removed && blobUrls.has(removed.url)) {
        URL.revokeObjectURL(removed.url);
        blobUrls.delete(removed.url);
      }
      if (productImages.length && !productImages.some((img) => img.isCover)) productImages[0].isCover = true;
      toast.info('تصویر حذف شد', removed?.name ?? '');
      renderGalleryUi();
    }
  });

  on(galleryHost, 'change', (e) => {
    const input = e.target.closest('[data-file-input]');
    if (!input) return;
    addFiles(input.files);
    input.value = '';
  });

  on(galleryHost, 'input', (e) => {
    const alt = e.target.closest('[data-alt-input]');
    if (!alt || !productImages[currentImageIndex]) return;
    productImages[currentImageIndex].alt = alt.value;
    const { checks, score } = readiness();
    const scoreEl = $('.pm-score', galleryHost);
    if (scoreEl) {
      scoreEl.style.setProperty('--score', score);
      $('.pm-score__value', scoreEl).textContent = `${toDigits(score)}٪`;
    }
    $$('.pm-checks li', galleryHost).forEach((li, i) => {
      li.classList.toggle('is-ok', checks[i].ok);
      li.querySelector('i').className = `bi bi-${checks[i].ok ? 'check-circle-fill' : 'circle'}`;
    });
  });

  on(galleryHost, 'keydown', (e) => {
    if (!e.target.closest('[data-stage]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); }
  });

  /* Pointer zoom (fine pointers) + horizontal swipe (touch). */
  let swipe = null;
  on(galleryHost, 'pointermove', (e) => {
    const frame = e.target.closest('[data-zoom-frame]');
    if (!frame || e.pointerType !== 'mouse') return;
    const rect = frame.getBoundingClientRect();
    frame.style.setProperty('--zx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    frame.style.setProperty('--zy', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    frame.classList.add('is-zooming');
  });
  on(galleryHost, 'pointerout', (e) => {
    const frame = e.target.closest('[data-zoom-frame]');
    if (frame && !frame.contains(e.relatedTarget)) frame.classList.remove('is-zooming');
  });
  on(galleryHost, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !e.target.closest('[data-zoom-frame]')) return;
    swipe = { x: e.clientX, y: e.clientY };
  });
  on(galleryHost, 'pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx > 0 ? 1 : -1);
  });

  /* Drag files anywhere on the card. */
  if (galleryCard) {
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    on(galleryCard, 'dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      galleryCard.classList.add('is-dropping');
    });
    on(galleryCard, 'dragover', (e) => {
      if (hasFiles(e)) e.preventDefault();
    });
    on(galleryCard, 'dragleave', (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) galleryCard.classList.remove('is-dropping');
    });
    on(galleryCard, 'drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      galleryCard.classList.remove('is-dropping');
      addFiles(e.dataTransfer.files);
    });
  }

  /* Reorder thumbnails (HTML5 drag on desktop). */
  let dragFrom = null;
  on(galleryHost, 'dragstart', (e) => {
    const li = e.target.closest('[data-thumb-idx]');
    if (!li) return;
    dragFrom = Number(li.dataset.thumbIdx);
    li.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  on(galleryHost, 'dragover', (e) => {
    if (dragFrom === null) return;
    const li = e.target.closest('[data-thumb-idx]');
    if (!li) return;
    e.preventDefault();
    $$('.pm-thumb.is-over', galleryHost).forEach((n) => n.classList.remove('is-over'));
    li.classList.add('is-over');
  });
  on(galleryHost, 'drop', (e) => {
    if (dragFrom === null) return;
    const li = e.target.closest('[data-thumb-idx]');
    e.preventDefault();
    if (li) {
      const to = Number(li.dataset.thumbIdx);
      const activeId = productImages[currentImageIndex]?.id;
      const [moved] = productImages.splice(dragFrom, 1);
      productImages.splice(to, 0, moved);
      currentImageIndex = Math.max(0, productImages.findIndex((img) => img.id === activeId));
    }
    dragFrom = null;
    renderGalleryUi();
  });
  on(galleryHost, 'dragend', () => {
    dragFrom = null;
    $$('.pm-thumb.is-dragging, .pm-thumb.is-over', galleryHost).forEach((n) => n.classList.remove('is-dragging', 'is-over'));
  });

  // Form Submission
  const form = $('[data-product-form]', node);
  on(form, 'submit', async (event) => {
    event.preventDefault();
    if (!(await import('../core/form.js')).validateForm(form).valid) {
      toast.warning('فرم کامل نیست', 'فیلدهای الزامی را تکمیل کنید.');
      return;
    }
    const button = $('[data-submit]', form);
    button.classList.add('is-loading');
    try {
      const payload = collectValues(form);
      payload.images = productImages;
      payload.image = (productImages.find((i) => i.isCover) || productImages[0])?.url || 'assets/img/products/product-01.svg';
      if (id) await services.productService.update(id, payload);
      else await services.productService.create(payload);
      toast.success('ذخیره شد', 'محصول و گالری تصاویر با موفقیت در سیستم ثبت گردید.');
      setTimeout(() => goTo('ecommerce/products.html'), 900);
    } finally {
      button.classList.remove('is-loading');
    }
  });
}

/* ========================================================================= CRM */

async function initCrm() {
  const page = kit.pageId();
  switch (page) {
    case 'crm/pipeline.html':
    case 'projects/kanban.html': {
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(3, 'card')}</div>`);
      const isCrm = page.startsWith('crm');
      const board = isCrm ? await services.pipelineService.board() : await services.kanbanService.board();
      const columns = isCrm
        ? board.stages.map((stage) => ({
            id: stage.id,
            label: stage.label,
            tone: stage.tone,
            items: (stage.deals ?? stage.items ?? []).map((deal) => ({
              id: deal.id,
              title: deal.title,
              text: deal.company,
              meta: deal.owner,
              avatar: deal.ownerAvatar,
              value: deal.value,
              tone: stage.tone,
              tag: stage.label,
            })),
          }))
        : (Array.isArray(board) ? board : board.columns ?? []).map((column) => ({
            id: column.id,
            label: column.label ?? column.title,
            tone: column.tone,
            items: (column.cards ?? column.tasks ?? column.items ?? []).slice(0, 10).map((task) => ({
              id: task.id,
              title: task.title,
              text: task.project,
              meta: task.assignee,
              avatar: task.assigneeAvatar,
              progress: task.progress,
              tone: { urgent: 'danger', high: 'warning', medium: 'info', low: 'neutral' }[task.priority] ?? 'primary',
              tag: task.priorityLabel ?? 'تسک',
            })),
          }));

      /* Moves survive reloads: the board is re-ordered from the saved layout. */
      const layoutKey = `nova:kanban:${isCrm ? 'crm' : 'projects'}`;
      const readLayout = () => {
        try {
          return JSON.parse(localStorage.getItem(layoutKey) ?? '{}') ?? {};
        } catch {
          return {};
        }
      };
      const saved = readLayout();
      if (Object.keys(saved).length) {
        const all = columns.flatMap((column) => column.items.map((item) => ({ item, from: column.id })));
        columns.forEach((column) => (column.items = []));
        all.forEach(({ item, from }) => {
          const target = columns.find((column) => column.id === saved[item.id]?.status) ?? columns.find((column) => column.id === from);
          if (isCrm && target) {
            item.tag = target.label;
            item.tone = target.tone;
          }
          target?.items.push(item);
        });
        columns.forEach((column) => column.items.sort((a, b) => (saved[a.id]?.position ?? 999) - (saved[b.id]?.position ?? 999)));
      }
      const saveLayout = () => {
        const layout = {};
        $$('[data-kanban-column]', node).forEach((column) =>
          $$('[data-kanban-card]', column).forEach((card, index) => (layout[card.dataset.id] = { status: column.dataset.kanbanColumn, position: index })),
        );
        try {
          localStorage.setItem(layoutKey, JSON.stringify(layout));
        } catch {
          /* storage full — the move is still applied for this visit */
        }
      };

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: isCrm ? 'قیف فروش' : 'کانبان پروژه',
            subtitle: isCrm ? 'کارت را بگیرید و در مرحله دیگر رها کنید (یا از منوی ⋯ روی کارت) — مرحله ذخیره می‌شود و قابل بازگردانی است.' : 'کارت را بگیرید و در ستون دیگر رها کنید (یا از منوی ⋯ روی کارت) — وضعیت تسک ذخیره می‌شود.',
            icon: 'kanban',
            badges: [isCrm ? statusBadge(`مجموع: ${formatCurrency(columns.reduce((sum, c) => sum + c.items.reduce((s, i) => s + (i.value ?? 0), 0), 0), 'IRR', { compact: true })}`, 'primary') : statusBadge(`${toDigits(columns.reduce((sum, c) => sum + c.items.length, 0))} تسک در ${toDigits(columns.length)} ستون`, 'primary')],
            actions: toolButtons({ create: isCrm ? 'معامله جدید' : 'تسک جدید' }),
          })}
          ${kanbanMarkup({ columns })}
        </div>`,
      );

      initKanban($('[data-kanban]', node));
      if (window.__novaKanbanOff) window.__novaKanbanOff();
      window.__novaKanbanOff = bus.on('kanban:move', async ({ id, status, position, statusLabel, previousLabel, undo, reverted }) => {
        const card = $(`[data-kanban-card][data-id="${CSS.escape(id)}"]`, node);
        const column = $(`[data-kanban-column="${CSS.escape(status)}"]`, node);
        if (isCrm && card && column) {
          /* The stage badge follows the card. */
          const stage = columns.find((c) => c.id === status);
          const badge = card.querySelector('.kanban-card__head .badge');
          if (badge && stage) {
            badge.className = `badge badge--soft-${stage.tone ?? 'primary'}`;
            badge.textContent = stage.label;
          }
        }
        saveLayout();
        try {
          if (isCrm) await services.pipelineService.move(id, status, position ?? 0);
          else await services.kanbanService.move(id, status, position ?? 0);
          bus.emit(EVENTS.dataChanged, { resource: isCrm ? 'deals' : 'tasks', action: 'move', id });
          if (reverted) toast.info('جابجایی برگردانده شد', '');
          else if (previousLabel !== statusLabel)
            toast.success(isCrm ? 'مرحله معامله تغییر کرد' : 'وضعیت تسک تغییر کرد', `از «${previousLabel}» به «${statusLabel}»`, { action: undo ? { label: 'بازگردانی', onClick: undo } : null, duration: 5000 });
        } catch (error) {
          toast.danger('جابجایی ذخیره نشد', error.message);
        }
      });
      on($('[data-create]', node), 'click', () =>
        openRecordForm({
          resource: isCrm ? 'deals' : 'tasks',
          title: isCrm ? 'افزودن معامله' : 'افزودن تسک',
          fields: crudFields(isCrm ? 'deals' : 'tasks'),
          onSaved: () => window.location.reload(),
        }),
      );
      return;
    }

    case 'crm/contact-details.html':
    case 'crm/company-details.html':
    case 'crm/deal-details.html': {
      const map = {
        'crm/contact-details.html': 'contacts',
        'crm/company-details.html': 'companies',
        'crm/deal-details.html': 'deals',
      };
      const resource = map[page];
      const id = queryParam('id');
      await detailPage({
        resource,
        id,
        title: 'جزئیات',
        meta: [
          (r) => r.title ?? r.industry ?? r.company ?? '',
          (r) => r.email ?? r.city ?? r.owner ?? '',
        ],
        badge: (r) => statusBadge(r.statusLabel ?? r.status ?? r.stageLabel ?? 'فعال', r.status === 'inactive' ? 'neutral' : 'success'),
        tabs: [
          (r) => card({
            title: 'اطلاعات پایه',
            body: `<div class="grid grid--2">${infoRows(
              Object.entries(r)
                .filter(([key, value]) => !DETAIL_SKIP.has(key) && !/(Label|Id|Avatar|En)$/.test(key) && (typeof value === 'string' || typeof value === 'number') && value !== '')
                .slice(0, 12)
                .map(([key, value]) => [FIELD_LABELS[key] ?? key, detailValue(key, value, r)]),
            )}</div>`,
          }),
          () => tabs([
            { id: 'activity', label: 'فعالیت‌ها', icon: 'activity', body: card({ title: 'آخرین تعاملات', body: activityFeed() }) },
            { id: 'notes', label: 'یادداشت‌ها', icon: 'journal-text', body: card({ title: 'یادداشت‌های تیم', body: notesCard(), flush: false }) },
            { id: 'files', label: 'فایل‌ها', icon: 'paperclip', body: card({ title: 'پیوست‌ها', flush: true, body: filesList() }) },
          ]),
        ],
      });
      return;
    }

    default:
      return;
  }
}

function activityFeed() {
  return timeline(
    [
      { title: 'تماس تلفنی ثبت شد', text: 'مدت مکالمه ۱۲ دقیقه — نتیجه: نیاز به پیشنهاد قیمت', time: '۲ ساعت پیش', tone: 'info', icon: 'telephone' },
      { title: 'ایمیل پیگیری ارسال شد', text: 'قالب «پیشنهاد همکاری» ارسال شد.', time: 'دیروز', tone: 'primary', icon: 'envelope' },
      { title: 'جلسه آنلاین برگزار شد', text: 'حاضران: تیم فروش و کارشناس فنی مشتری', time: '۳ روز پیش', tone: 'success', icon: 'camera-video' },
      { title: 'پیش‌فاکتور صادر شد', text: 'مبلغ ۴۸۰٫۰۰۰٫۰۰۰ ریال', time: 'هفته گذشته', tone: 'warning', icon: 'receipt' },
    ],
    { compact: true },
  );
}

function notesCard() {
  return `${timeline(
    [
      { title: 'یادداشت فروش', text: 'بودجه مشتری برای فصل جاری ۵۰۰ میلیون ریال است؛ تخفیف حجمی پیشنهاد شود.', time: '۳ روز پیش', tone: 'primary', icon: 'pencil' },
      { title: 'یادداشت پشتیبانی', text: 'دو تیکت باز درباره مهاجرت داده‌ها وجود دارد.', time: '۱ هفته پیش', tone: 'warning', icon: 'life-preserver' },
    ],
    { compact: true },
  )}
  <form class="form-stack mt-3" data-note-form>
    <textarea class="form-control" rows="3" name="note" placeholder="یادداشت جدید…"></textarea>
    <div class="form-actions form-actions--end"><button class="btn btn-primary btn-sm" type="submit"><i class="bi bi-plus-lg"></i> افزودن یادداشت</button></div>
  </form>`;
}

function filesList() {
  return `<ul class="list-group">${[
    ['پیش‌فاکتور-۱۴۰۵.pdf', '۲۴۰ کیلوبایت'],
    ['قرارداد-همکاری.docx', '۸۶ کیلوبایت'],
    ['معرفی-محصول-.pptx', '۱٫۲ مگابایت'],
  ]
    .map(([name, size]) => `<li class="list-item"><span class="file-card__icon file-card__icon--pdf"><i class="bi bi-file-earmark-text"></i></span><span class="list-item__title">${escapeHtml(name)}</span><span class="list-item__meta">${escapeHtml(size)}</span></li>`)
    .join('')}</ul>`;
}

/* ===================================================================== Finance */

async function initFinance() {
  const page = kit.pageId();
  switch (page) {
    case 'finance/overview.html': {
      const node = host();
      /**
       * `financeReportsService` answers with the shapes the data layer keeps —
       * cash flow as twelve `{ month, inflow, outflow }` buckets, the balance
       * sheet as `rows`, receivables as a plain array of buckets and P&L as
       * `lines`. Every figure on this page is derived from those fields: the
       * half-over-half deltas, the runway, the current ratio and the cover
       * meter are computed here, never hard-coded.
       */
      /**
       * The chart is drawn from `onData` (after the shell is in the DOM), while
       * the series are computed inside `paint` — so the payload is handed over
       * through this variable instead of being closed over.
       */
      let cashflowChart = null;

      const paint = async () => {
        const [cashFlow, balance, aging, profit] = await Promise.all([
          services.financeReportsService.cashFlow(),
          services.financeReportsService.balanceSheet(),
          services.financeReportsService.aging(),
          services.financeReportsService.profitAndLoss(),
        ]);
        const months = cashFlow.series ?? [];
        const JALALI = monthNames().jalali;
        const labels = months.map((row) => JALALI[row.month % 12] ?? `ماه ${row.month + 1}`);
        const buckets = Array.isArray(aging) ? aging : (aging?.buckets ?? []);
        const outstanding = buckets.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0);
        const outstandingCount = buckets.reduce((sum, bucket) => sum + (bucket.count ?? 0), 0);
        const rows = balance.rows ?? [];
        const assets = rows.filter((row) => row.value > 0);
        const liabilities = rows.filter((row) => row.value < 0);
        const assetTotal = assets.reduce((sum, row) => sum + row.value, 0);
        const liabilityTotal = Math.abs(liabilities.reduce((sum, row) => sum + row.value, 0));
        const netWorth = assetTotal - liabilityTotal;
        const cash = rows.find((row) => row.label?.includes('نقد'))?.value ?? assets[0]?.value ?? 0;
        const burn = (cashFlow.outflow ?? 0) / Math.max(1, months.length);
        const runway = burn ? cash / burn : 0;
        const currentRatio = liabilityTotal ? assetTotal / liabilityTotal : 0;
        const netMargin = profit.revenue ? (profit.net / profit.revenue) * 100 : 0;

        /** Second half of the period against the first — the "so what?" delta. */
        const half = Math.max(1, Math.floor(months.length / 2));
        const sumOf = (side, key) =>
          months.slice(side === 'recent' ? -half : 0, side === 'recent' ? months.length : half).reduce((sum, row) => sum + (row[key] ?? 0), 0);
        const delta = (key) => {
          const before = sumOf('early', key);
          return before ? Number((((sumOf('recent', key) - before) / before) * 100).toFixed(1)) : 0;
        };
        const netSeries = months.map((row) => row.inflow - row.outflow);
        const spark = (key) => months.map((row) => (key === 'net' ? row.inflow - row.outflow : row[key]));
        const peakAging = Math.max(1, ...buckets.map((bucket) => bucket.amount ?? 0));
        const worstMonth = months.reduce((worst, row, index) => (row.inflow - row.outflow < (months[worst]?.inflow ?? 0) - (months[worst]?.outflow ?? 0) ? index : worst), 0);
        const bestMonth = months.reduce((best, row, index) => (row.inflow - row.outflow > (months[best]?.inflow ?? 0) - (months[best]?.outflow ?? 0) ? index : best), 0);
        const meter = (value, max) => Math.max(3, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));

        cashflowChart = {
          labels,
          series: [
            { name: 'ورودی', data: months.map((row) => row.inflow), type: 'column' },
            { name: 'خروجی', data: months.map((row) => row.outflow), type: 'column' },
            { name: 'خالص', data: netSeries, type: 'line', dashed: true },
          ],
        };

        return `<div class="dashboard-shell fin">
          ${pageHeader({
            title: 'نمای کلی مالی',
            subtitle: 'تصویر یک‌نگاه از نقدینگی، مطالبات و سودآوری — محاسبه‌شده از داده‌های همین ماه',
            icon: 'cash-stack',
            badges: [
              statusBadge(`حاشیه سود خالص ${toDigits(netMargin.toFixed(1))}٪`, netMargin >= 0 ? 'success' : 'danger'),
              statusBadge(`${toDigits(outstandingCount)} فاکتور باز`, outstandingCount ? 'warning' : 'success'),
            ],
            actions: toolButtons({ create: 'ثبت دستی', exportResource: 'transactions' }),
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'ورودی دوره', value: formatCurrency(cashFlow.inflow ?? 0, 'IRR', { compact: true }), trend: delta('inflow'), meta: 'نیمه دوم در برابر نیمه اول', tone: 'success', icon: 'arrow-down-circle', spark: spark('inflow'), id: 'fin-inflow' })}
            ${statCard({ label: 'خروجی دوره', value: formatCurrency(cashFlow.outflow ?? 0, 'IRR', { compact: true }), trend: -delta('outflow'), meta: 'رشد کمتر، بهتر', tone: 'danger', icon: 'arrow-up-circle', spark: spark('outflow'), id: 'fin-outflow' })}
            ${statCard({ label: 'خالص دوره', value: formatCurrency(cashFlow.net ?? 0, 'IRR', { compact: true }), trend: delta('net'), meta: `${toDigits(months.length)} ماه مالی`, tone: 'primary', icon: 'activity', spark: spark('net'), id: 'fin-net' })}
            ${statCard({ label: 'مطالبات باز', value: formatCurrency(outstanding, 'IRR', { compact: true }), meta: `${toDigits(outstandingCount)} فاکتور تسویه‌نشده`, tone: 'warning', icon: 'hourglass-split', id: 'fin-open' })}
          </div>

          <div class="widget-grid fin-grid">
            ${card({
              span: 8,
              className: 'fin-chart-card',
              icon: 'graph-up-arrow',
              title: 'جریان نقدی دوازده ماه',
              subtitle: 'ستون‌ها ورودی و خروجی، خط‌چین خالص هر ماه — همه از رکوردهای واقعی',
              actions: `<div class="fin-chart-legend">
                <span><i class="fin-dot fin-dot--in"></i> ورودی</span>
                <span><i class="fin-dot fin-dot--out"></i> خروجی</span>
                <span><i class="fin-dot fin-dot--net"></i> خالص</span>
              </div>`,
              body: `<div class="chart" data-chart-key="cashflow" data-chart-owner="controller" data-chart-height="330" style="min-height:330px"></div>`,
              foot: `<div class="fin-chart-foot">
                <span><i class="bi bi-arrow-up-right-circle text-success"></i> بهترین ماه: <strong>${escapeHtml(labels[bestMonth] ?? '')}</strong> با خالص <strong class="numeric">${escapeHtml(formatCurrency(netSeries[bestMonth] ?? 0, 'IRR', { compact: true }))}</strong></span>
                <span><i class="bi bi-arrow-down-right-circle text-danger"></i> ضعیف‌ترین ماه: <strong>${escapeHtml(labels[worstMonth] ?? '')}</strong> با خالص <strong class="numeric">${escapeHtml(formatCurrency(netSeries[worstMonth] ?? 0, 'IRR', { compact: true }))}</strong></span>
              </div>`,
            })}
            ${card({
              span: 4,
              icon: 'speedometer2',
              title: 'سلامت مالی',
              subtitle: 'نسبت‌های کلیدی از ترازنامه و جریان نقدی',
              body: `<ul class="fin-meters">
                <li class="fin-meter">
                  <div class="fin-meter__head"><span>دوره بقای نقدی</span><b class="numeric">${toDigits(runway.toFixed(1))} ماه</b></div>
                  <span class="fin-meter__bar fin-meter__bar--${runway >= 6 ? 'good' : runway >= 3 ? 'warn' : 'bad'}"><i style="--w:${meter(runway, 12)}%"></i></span>
                  <p class="fin-meter__hint">موجودی نقدی ${escapeHtml(formatCurrency(cash, 'IRR', { compact: true }))} ÷ میانگین خروجی ماهانه</p>
                </li>
                <li class="fin-meter">
                  <div class="fin-meter__head"><span>نسبت جاری</span><b class="numeric">${toDigits(currentRatio.toFixed(2))}</b></div>
                  <span class="fin-meter__bar fin-meter__bar--${currentRatio >= 1.5 ? 'good' : currentRatio >= 1 ? 'warn' : 'bad'}"><i style="--w:${meter(currentRatio, 3)}%"></i></span>
                  <p class="fin-meter__hint">دارایی‌ها ${escapeHtml(formatCurrency(assetTotal, 'IRR', { compact: true }))} در برابر تعهدات ${escapeHtml(formatCurrency(liabilityTotal, 'IRR', { compact: true }))}</p>
                </li>
                <li class="fin-meter">
                  <div class="fin-meter__head"><span>حاشیه سود خالص</span><b class="numeric">${toDigits(netMargin.toFixed(1))}٪</b></div>
                  <span class="fin-meter__bar fin-meter__bar--${netMargin >= 20 ? 'good' : netMargin >= 8 ? 'warn' : 'bad'}"><i style="--w:${meter(netMargin, 40)}%"></i></span>
                  <p class="fin-meter__hint">سود خالص ${escapeHtml(formatCurrency(profit.net ?? 0, 'IRR', { compact: true }))} از درآمد ${escapeHtml(formatCurrency(profit.revenue ?? 0, 'IRR', { compact: true }))}</p>
                </li>
                <li class="fin-meter">
                  <div class="fin-meter__head"><span>ارزش خالص</span><b class="numeric">${escapeHtml(formatCurrency(netWorth, 'IRR', { compact: true }))}</b></div>
                  <span class="fin-meter__bar fin-meter__bar--${netWorth > 0 ? 'good' : 'bad'}"><i style="--w:${meter(Math.abs(netWorth), Math.max(1, assetTotal))}%"></i></span>
                  <p class="fin-meter__hint">${toDigits(assets.length)} قلم دارایی و ${toDigits(liabilities.length)} قلم تعهد</p>
                </li>
              </ul>`,
            })}

            ${card({
              span: 5,
              icon: 'calendar2-check',
              title: 'نردبان سنی مطالبات',
              subtitle: `${toDigits(outstandingCount)} فاکتور باز در ${toDigits(buckets.length)} بازه سررسید`,
              body: buckets.length
                ? `<ul class="fin-aging">${buckets
                    .map((bucket, index) => {
                      const share = Math.round(((bucket.amount ?? 0) / (outstanding || 1)) * 100);
                      const tone = index === 0 ? 'good' : bucket.days > 60 ? 'bad' : bucket.days > 30 ? 'warn' : 'info';
                      return `<li class="fin-aging__row">
                        <span class="fin-aging__label">${escapeHtml(bucket.label)}<small>${toDigits(bucket.count ?? 0)} فاکتور</small></span>
                        <span class="fin-aging__bar fin-aging__bar--${tone}"><i style="--w:${Math.round(((bucket.amount ?? 0) / peakAging) * 100)}%"></i></span>
                        <span class="fin-aging__amount"><b class="numeric">${escapeHtml(formatCurrency(bucket.amount ?? 0, 'IRR', { compact: true }))}</b><small>${toDigits(share)}٪ سبد</small></span>
                      </li>`;
                    })
                    .join('')}</ul>
                  <p class="fin-aging__note"><i class="bi bi-info-circle"></i> تمرکز روی بازه‌های بالای ۶۰ روز = ریسک وصول؛ تماس با مشتریان این بازه در اولویت است.</p>`
                : emptyState({ title: 'فاکتور تسویه‌نشده‌ای وجود ندارد', text: 'همه فاکتورهای این دوره پرداخت شده‌اند.', icon: 'check2-circle' }),
            })}

            ${card({
              span: 3,
              icon: 'pie-chart',
              title: 'ترکیب سود و زیان',
              subtitle: `حاشیه سود ${toDigits(profit.margin ?? 0)}٪`,
              body: `<ul class="fin-pl">${(profit.lines ?? [])
                .map((line) => {
                  const magnitude = Math.abs(line.value ?? 0);
                  const base = Math.max(1, profit.revenue ?? 1);
                  return `<li class="fin-pl__row">
                    <span class="fin-pl__label">${escapeHtml(line.label)}</span>
                    <span class="fin-pl__bar"><i class="fin-pl__fill fin-pl__fill--${escapeHtml(line.tone ?? 'neutral')}" style="--w:${Math.round((magnitude / base) * 100)}%"></i></span>
                    <b class="numeric ${line.value < 0 ? 'text-danger' : 'text-success'}">${escapeHtml(formatCurrency(line.value, 'IRR', { compact: true }))}</b>
                  </li>`;
                })
                .join('')}</ul>
              <div class="fin-pl__total"><span>سود خالص</span><strong class="numeric">${escapeHtml(formatCurrency(profit.net ?? 0, 'IRR', { compact: true }))}</strong></div>`,
            })}

            ${card({
              span: 4,
              icon: 'wallet2',
              title: 'ترکیب ترازنامه',
              subtitle: `${toDigits(assets.length)} دارایی در برابر ${toDigits(liabilities.length)} تعهد`,
              body: `<div class="chart" data-chart-key="balance" data-chart="donut" data-chart-height="212" data-chart-series='${JSON.stringify(assets.map((row) => row.value))}' data-chart-labels='${JSON.stringify(assets.map((row) => row.label))}'></div>
                ${infoRows(
                  [...assets, ...liabilities].map((row) => [
                    row.label,
                    `<span class="numeric ${row.value > 0 ? 'text-success' : 'text-danger'}">${escapeHtml(formatCurrency(row.value, 'IRR', { compact: true }))}</span>`,
                  ]),
                )}`,
            })}
          </div>

          ${card({
            className: 'mt-4',
            icon: 'table',
            title: 'ریتم ماهانه',
            subtitle: 'همان اعداد نمودار، به‌صورت جدول — برای مغایرت‌گیری و پیوست گزارش',
            flush: true,
            body: `<div class="table-wrap"><table class="table table--hover table--compact fin-table"><thead><tr><th>ماه</th><th class="text-end">ورودی</th><th class="text-end">خروجی</th><th class="text-end">خالص</th><th class="text-center">روند</th><th class="text-end">نرخ پوشش</th></tr></thead><tbody>${months
              .map((row, index) => {
                const net = row.inflow - row.outflow;
                const previous = index ? months[index - 1].inflow - months[index - 1].outflow : null;
                const dir = previous === null ? 0 : Math.sign(net - previous);
                const cover = row.outflow ? Math.round((row.inflow / row.outflow) * 100) : 0;
                return `<tr>
                  <th scope="row">${escapeHtml(labels[index] ?? '')}</th>
                  <td class="text-end numeric">${escapeHtml(formatCurrency(row.inflow, 'IRR', { compact: true }))}</td>
                  <td class="text-end numeric">${escapeHtml(formatCurrency(row.outflow, 'IRR', { compact: true }))}</td>
                  <td class="text-end numeric ${net >= 0 ? 'text-success' : 'text-danger'}">${escapeHtml(formatCurrency(net, 'IRR', { compact: true }))}</td>
                  <td class="text-center"><span class="fin-trend fin-trend--${dir > 0 ? 'up' : dir < 0 ? 'down' : 'flat'}"><i class="bi bi-arrow-${dir > 0 ? 'up' : dir < 0 ? 'down' : 'right'}-short"></i>${dir === 0 ? 'ثابت' : toDigits(Math.abs(Math.round(((net - previous) / Math.max(1, Math.abs(previous))) * 100)))}٪</span></td>
                  <td class="text-end"><span class="fin-cover fin-cover--${cover >= 130 ? 'good' : cover >= 100 ? 'warn' : 'bad'}">${toDigits(cover)}٪</span></td>
                </tr>`;
              })
              .join('')}</tbody>
            <tfoot><tr><th scope="row">جمع دوره</th><td class="text-end numeric">${escapeHtml(formatCurrency(cashFlow.inflow ?? 0, 'IRR', { compact: true }))}</td><td class="text-end numeric">${escapeHtml(formatCurrency(cashFlow.outflow ?? 0, 'IRR', { compact: true }))}</td><td class="text-end numeric">${escapeHtml(formatCurrency(cashFlow.net ?? 0, 'IRR', { compact: true }))}</td><td></td><td class="text-end">${toDigits(cashFlow.outflow ? Math.round(((cashFlow.inflow ?? 0) / cashFlow.outflow) * 100) : 0)}٪</td></tr></tfoot></table></div>`,
          })}
        </div>`;
      };
      await withState(node, paint, {
        skeleton: 'chart',
        title: 'نمای کلی مالی',
        onData: (target) => {
          /* Drawn through the controller API so the series colours match the
             legend dots exactly (green in, red out, slate net). */
          if (cashflowChart) {
            chart($('[data-chart-key="cashflow"]', target), {
              type: 'bar',
              mixed: true,
              height: 330,
              labels: cashflowChart.labels,
              series: cashflowChart.series,
              colors: ['#10b981', '#ef4444', '#64748b'],
            });
          }
          initCharts(target);
          exportable(target, 'transactions');
        },
      });
      return;
    }

    case 'finance/invoices.html': {
      const node = host();
      const { items } = await services.invoiceService.list({ perPage: 100 });
      const totalAmount = items.reduce((sum, inv) => sum + (inv.total ?? 0), 0);
      const paidAmount = items.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + (inv.paid ?? inv.total ?? 0), 0);
      const overdueAmount = items.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.total ?? 0), 0);
      const pendingAmount = items.filter((inv) => inv.status === 'pending').reduce((sum, inv) => sum + (inv.total ?? 0), 0);

      const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      const invoicedSeries = [1850, 2120, 2480, 2310, 2890, 3240, 3050, 3620, 3940, 3780, 4320, 4850];
      const collectedSeries = [1680, 1940, 2290, 2180, 2690, 3080, 2920, 3450, 3760, 3610, 4150, 4690];
      const chartTrendSeries = JSON.stringify([
        { name: 'مبالغ صادرشده (میلیون تومان)', data: invoicedSeries },
        { name: 'مبالغ وصول‌شده نقدی (میلیون تومان)', data: collectedSeries },
      ]);

      /**
       * KPI figures. Amounts print *compact* (کوتاه) so a long Rial string can
       * never burst out of a phone card — the full number stays available in the
       * `title` of each value — and every rate on the card is derived from the
       * records instead of being typed in by hand.
       */
      const DAY = 86400000;
      const overdueItems = items.filter((inv) => inv.status === 'overdue');
      const collectionRate = totalAmount ? Math.round((paidAmount / totalAmount) * 100) : 0;
      const avgOverdueDays = overdueItems.length
        ? Math.round(
            overdueItems.reduce((sum, inv) => sum + Math.max(0, Math.round((Date.now() - new Date(inv.dueDate ?? inv.issuedAt ?? Date.now()).getTime()) / DAY)), 0) /
              overdueItems.length,
          )
        : 0;
      const overdueShare = totalAmount ? Math.round((overdueAmount / totalAmount) * 100) : 0;

      const paidCount = items.filter((inv) => inv.status === 'paid').length || 18;
      const pendingCount = items.filter((inv) => inv.status === 'pending').length || 8;
      const overdueCount = items.filter((inv) => inv.status === 'overdue').length || 5;
      const draftCount = items.filter((inv) => inv.status === 'draft' || inv.status === 'cancelled').length || 3;
      const statusDonutSeries = JSON.stringify([paidCount, pendingCount, overdueCount, draftCount]);
      const statusDonutLabels = JSON.stringify(['تسویه‌شده (پرداخت)', 'در انتظار پرداخت', 'سررسید گذشته (معوق)', 'پیش‌نویس و لغوشده']);

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'مدیریت و صدور فاکتورها',
            subtitle: 'سامانه یکپارچه حسابداری اسناد، پایش جریان وصول مطالبات و گزارش تحلیلی سررسیدها',
            icon: 'file-earmark-spreadsheet',
            actions: `<a class="btn btn-primary" href="finance/invoice-create.html"><i class="bi bi-plus-lg me-1"></i>صدور فاکتور جدید</a>
              <button class="btn btn-light" type="button" data-export-invoices><i class="bi bi-file-earmark-excel me-1"></i>خروجی اکسل</button>`,
          })}
          <div class="stat-grid inv-kpis mb-4">
            <article class="stat-card stat-card--primary">
              <span class="stat-card__icon"><i class="bi bi-receipt"></i></span>
              <p class="stat-card__label">کل صورتحساب‌ها</p>
              <p class="stat-card__value" title="${escapeHtml(formatCurrency(totalAmount, 'IRR'))}">${escapeHtml(formatCurrency(totalAmount, 'IRR', { compact: true }))}</p>
              <p class="stat-card__meta"><i class="bi bi-files"></i> ${toDigits(items.length)} فاکتور در سامانه</p>
            </article>
            <article class="stat-card stat-card--success">
              <span class="stat-card__icon"><i class="bi bi-check-circle"></i></span>
              <p class="stat-card__label">وصول‌شده (تسویه کامل)</p>
              <p class="stat-card__value" title="${escapeHtml(formatCurrency(paidAmount, 'IRR'))}">${escapeHtml(formatCurrency(paidAmount, 'IRR', { compact: true }))}</p>
              <p class="stat-card__meta text-success"><i class="bi bi-shield-check"></i> نرخ وصول ${toDigits(collectionRate)}٪</p>
              <span class="stat-card__meter" role="img" aria-label="نرخ وصول ${toDigits(collectionRate)} درصد"><i style="--w:${collectionRate}%"></i></span>
            </article>
            <article class="stat-card stat-card--danger">
              <span class="stat-card__icon"><i class="bi bi-exclamation-octagon"></i></span>
              <p class="stat-card__label">معوق و سررسید گذشته</p>
              <p class="stat-card__value" title="${escapeHtml(formatCurrency(overdueAmount, 'IRR'))}">${escapeHtml(formatCurrency(overdueAmount, 'IRR', { compact: true }))}</p>
              <p class="stat-card__meta text-danger"><i class="bi bi-clock-history"></i> ${toDigits(overdueCount)} فاکتور · میانگین ${toDigits(avgOverdueDays)} روز تأخیر</p>
              <span class="stat-card__meter stat-card__meter--danger" role="img" aria-label="${toDigits(overdueShare)} درصد از کل"><i style="--w:${Math.min(100, overdueShare)}%"></i></span>
            </article>
            <article class="stat-card stat-card--warning">
              <span class="stat-card__icon"><i class="bi bi-hourglass-split"></i></span>
              <p class="stat-card__label">در انتظار پرداخت</p>
              <p class="stat-card__value" title="${escapeHtml(formatCurrency(pendingAmount, 'IRR'))}">${escapeHtml(formatCurrency(pendingAmount, 'IRR', { compact: true }))}</p>
              <p class="stat-card__meta text-muted"><i class="bi bi-hourglass"></i> ${toDigits(pendingCount)} فاکتور تا سررسید</p>
            </article>
          </div>
          <div class="widget-grid mb-4">
            <section class="card" data-span="8">
              <header class="card__head">
                <div>
                  <h2 class="card__title">روند ماهانه صدور و وصول فاکتورها (۱۲ ماهه)</h2>
                  <p class="card__subtitle">مقایسه مبالغ اسناد مالی صادره در برابر دریافتی‌های نقدی محقق‌شده به تفکیک ماه</p>
                </div>
                <div class="card__actions">
                  <span class="badge badge--soft-primary">سال مالی جاری</span>
                </div>
              </header>
              <div class="card__body">
                <div class="chart" data-chart="area" data-chart-height="310" data-chart-series='${chartTrendSeries}' data-chart-labels='${JSON.stringify(months)}'></div>
              </div>
            </section>
            <section class="card" data-span="4">
              <header class="card__head">
                <div>
                  <h2 class="card__title">توزیع وضعیت پرداخت فاکتورها</h2>
                  <p class="card__subtitle">سهم ریالی و تعداد اسناد مالی بر اساس شرایط تسویه</p>
                </div>
              </header>
              <div class="card__body">
                <div class="chart" data-chart="donut" data-chart-height="310" data-chart-series='${statusDonutSeries}' data-chart-labels='${statusDonutLabels}'></div>
              </div>
            </section>
          </div>
          <div class="card">
            <div class="card__head d-flex justify-content-between align-items-center">
              <div>
                <h2 class="card__title">فهرست آخرین فاکتورهای صادره</h2>
                <p class="card__subtitle">فهرست بلادرنگ اسناد با امکان مشاهده، چاپ و تغییر وضعیت تسویه</p>
              </div>
            </div>
            <div class="card__body p-0">
              <div class="table-wrap">
                <table class="table table--hover mb-0">
                  <thead>
                    <tr>
                      <th>شماره فاکتور</th>
                      <th>مشتری / طرف‌حساب</th>
                      <th>تاریخ صدور</th>
                      <th>سررسید</th>
                      <th>مبلغ فاکتور</th>
                      <th>وضعیت</th>
                      <th class="text-end">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.slice(0, 10).map((inv) => `
                      <tr>
                        <td>
                          <a href="finance/invoice-details.html?id=${encodeURIComponent(inv.id)}" class="fw-semibold text-primary text-decoration-none">
                            <i class="bi bi-file-earmark-text me-1"></i>${escapeHtml(inv.number)}
                          </a>
                        </td>
                        <td>
                          <div class="d-flex align-items-center gap-2">
                            <img src="${escapeHtml(inv.avatar || 'assets/img/avatars/avatar-01.svg')}" class="rounded-circle" width="30" height="30" alt="">
                            <div>
                              <div class="fw-semibold">${escapeHtml(inv.customer)}</div>
                              <small class="text-muted">${escapeHtml(inv.email || '')}</small>
                            </div>
                          </div>
                        </td>
                        <td>${formatDate(inv.issuedAt, { format: 'medium' })}</td>
                        <td>${formatDate(inv.dueAt, { format: 'medium' })}</td>
                        <td class="fw-bold numeric">${formatCurrency(inv.total, 'IRR')}</td>
                        <td>
                          <span class="badge badge--soft-${inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : inv.status === 'pending' ? 'warning' : 'secondary'}">
                            ${escapeHtml(inv.statusLabel ?? (inv.status === 'paid' ? 'پرداخت‌شده' : inv.status === 'overdue' ? 'سررسید گذشته' : 'در انتظار پرداخت'))}
                          </span>
                        </td>
                        <td class="text-end">
                          <a class="btn btn-sm btn-light" href="finance/invoice-details.html?id=${encodeURIComponent(inv.id)}" title="مشاهده جزئیات">
                            <i class="bi bi-eye"></i>
                          </a>
                          <button class="btn btn-sm btn-light" type="button" onclick="window.print()" title="چاپ">
                            <i class="bi bi-printer"></i>
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>`,
      );
      initCharts(node);
      on($('[data-export-invoices]', node), 'click', () => {
        toast.success('دریافت گزارش', 'فایل اکسل فاکتورهای مالی در حال بارگیری است.');
      });
      return;
    }

    case 'finance/invoice-details.html': {
      const id = queryParam('id');
      const node = host();
      const invoice = await loadRecord('invoices', id);
      if (!invoice) {
        render(node, kit.errorState('فاکتور مورد نظر پیدا نشد'));
        on($('[data-retry]', node), 'click', () => goTo('finance/invoices.html'));
        return;
      }
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: `فاکتور ${escapeHtml(invoice.number)}`,
            subtitle: `${escapeHtml(invoice.customer)} • سررسید ${formatDate(invoice.dueAt, { format: 'medium' })}`,
            icon: 'receipt',
            badges: [statusBadge(invoice.statusLabel ?? invoice.status, invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'danger' : 'warning')],
            actions: `<button class="btn btn-light" type="button" data-print><i class="bi bi-printer"></i> چاپ</button>
              <button class="btn btn-light" type="button" data-invoice-send><i class="bi bi-send"></i> ارسال</button>
              <button class="btn btn-primary" type="button" data-invoice-paid><i class="bi bi-check2-circle"></i> ثبت پرداخت</button>`,
          })}
          <article class="invoice-doc" id="invoice-doc">${invoiceMarkup(invoice)}</article>
          <div class="grid grid--2">
            ${card({ title: 'پیگیری', body: timeline([
              { title: 'صدور فاکتور', time: formatDate(invoice.issuedAt, { format: 'long' }), tone: 'primary', icon: 'file-earmark-text' },
              { title: 'ارسال به مشتری', text: 'ایمیل با پیوست PDF ارسال شد.', time: '۱ روز بعد', tone: 'info', icon: 'envelope-check' },
              invoice.status === 'paid' ? { title: 'پرداخت کامل', text: 'تراکنش با موفقیت تسویه شد.', time: 'ثبت شده', tone: 'success', icon: 'cash-coin' } : { title: 'در انتظار پرداخت', text: 'یادآوری خودکار فعال است.', time: 'زمان‌بندی شده', tone: 'warning', icon: 'alarm' },
            ], { compact: true }) })}
            ${card({ title: 'اطلاعات مشتری', body: infoRows([
              ['مشتری', invoice.customer],
              ['شناسه مالیاتی', invoice.taxId ?? '—'],
              ['نشانی', invoice.address ?? 'تهران، خیابان ولیعصر، برج نووا'],
              ['روش پرداخت', invoice.method ?? 'انتقال بانکی'],
            ]) })}
          </div>
        </div>`,
      );
      on($('[data-print]', node), 'click', () => window.print());
      on($('[data-invoice-send]', node), 'click', async () => {
        await services.invoiceActions.send(invoice.id);
        toast.success('فاکتور ارسال شد', 'ایمیل همراه پیوست برای مشتری ارسال گردید.');
      });
      on($('[data-invoice-paid]', node), 'click', async () => {
        await services.invoiceActions.markPaid(invoice.id);
        toast.success('پرداخت ثبت شد', 'وضعیت فاکتور به «پرداخت‌شده» تغییر کرد.');
        bus.emit(EVENTS.dataChanged, { resource: 'invoices', action: 'paid', id: invoice.id });
      });
      return;
    }

    case 'finance/invoice-create.html': {
      const node = host();
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'صدور فاکتور جدید', subtitle: 'اقلام را اضافه کنید؛ جمع و مالیات خودکار محاسبه می‌شود.', icon: 'file-earmark-plus', actions: '<a class="btn btn-light" href="finance/invoices.html">بازگشت</a>' })}
          ${card({
            body: `<form data-invoice-form novalidate>
              ${formMarkup([
                { name: 'customer', label: 'مشتری', required: true },
                { name: 'email', label: 'ایمیل', type: 'email', rule: 'email' },
                { name: 'issuedAt', label: 'تاریخ صدور', type: 'date', required: true },
                { name: 'dueAt', label: 'سررسید', type: 'date', required: true },
                { name: 'currency', label: 'واحد پول', type: 'select', options: ['IRR', 'USD', 'EUR', 'AED'] },
                { name: 'method', label: 'روش پرداخت', type: 'select', options: ['انتقال بانکی', 'کارت اعتباری', 'کیف پول'] },
                { name: 'notes', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
              ])}
              <h3 class="form-section__title mt-4">اقلام فاکتور</h3>
              <div class="table-wrap"><table class="table" data-invoice-items><thead><tr><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th class="text-end">جمع</th><th></th></tr></thead><tbody></tbody></table></div>
              <div class="form-actions"><button class="btn btn-light btn-sm" type="button" data-add-item><i class="bi bi-plus-lg"></i> افزودن ردیف</button>
                <div class="ms-auto w-100" style="max-width:20rem">${infoRows([['جمع اقلام', '<span data-invoice-subtotal>۰</span>'], ['مالیات ۹٪', '<span data-invoice-tax>۰</span>'], ['مبلغ نهایی', '<strong data-invoice-total>۰</strong>']])}</div>
              </div>
              <div class="form-actions form-actions--end"><button type="reset" class="btn btn-light">پاک کردن</button><button type="submit" class="btn btn-primary" data-submit>ثبت فاکتور</button></div>
            </form>`,
          })}
        </div>`,
      );
      const form = $('[data-invoice-form]', node);
      const tbody = $('[data-invoice-items] tbody', form);
      const addRow = () => {
        const row = document.createElement('tr');
        row.innerHTML = `<td><input class="form-control form-control--sm" name="itemTitle" value="خدمات مشاوره"></td>
          <td><input class="form-control form-control--sm numeric" name="itemQty" type="number" value="1" min="1" data-qty></td>
          <td><input class="form-control form-control--sm numeric" name="itemPrice" type="number" value="25000000" step="10000" data-price></td>
          <td class="text-end numeric" data-line-total>۲۵٫۰۰۰٫۰۰۰</td>
          <td><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove-row aria-label="حذف ردیف"><i class="bi bi-trash3"></i></button></td>`;
        return row;
      };
      const recalc = () => {
        let subtotal = 0;
        $$('tbody tr', form).forEach((row) => {
          const qty = Number($('[data-qty]', row).value) || 0;
          const price = Number($('[data-price]', row).value) || 0;
          const total = qty * price;
          subtotal += total;
          $('[data-line-total]', row).textContent = formatCurrency(total, 'IRR');
        });
        const tax = Math.round(subtotal * 0.09);
        $('[data-invoice-subtotal]', form).textContent = formatCurrency(subtotal, 'IRR');
        $('[data-invoice-tax]', form).textContent = formatCurrency(tax, 'IRR');
        $('[data-invoice-total]', form).textContent = formatCurrency(subtotal + tax, 'IRR');
      };
      tbody.append(addRow(), addRow());
      recalc();
      on($('[data-add-item]', form), 'click', () => {
        tbody.append(addRow());
        recalc();
      });
      on(tbody, 'input', recalc);
      on(tbody, 'click', (event) => {
        if (!event.target.closest('[data-remove-row]')) return;
        if (tbody.children.length === 1) {
          toast.warning('حداقل یک ردیف لازم است', 'آخرین ردیف قابل حذف نیست.');
          return;
        }
        event.target.closest('tr').remove();
        recalc();
      });
      on(form, 'submit', async (event) => {
        event.preventDefault();
        const { validateForm } = await import('../core/form.js');
        if (!validateForm(form).valid) {
          toast.warning('فرم کامل نیست', 'فیلدهای الزامی را تکمیل کنید.');
          return;
        }
        const values = collectValues(form);
        const items = $$('tbody tr', form).map((row) => ({
          title: $('[name="itemTitle"]', row).value,
          quantity: Number($('[data-qty]', row).value),
          price: Number($('[data-price]', row).value),
        }));
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
        await services.invoiceService.create({ ...values, items, subtotal, tax: Math.round(subtotal * 0.09), total: Math.round(subtotal * 1.09), status: 'unpaid' });
        toast.success('فاکتور ثبت شد', 'شماره فاکتور جدید در فهرست قابل مشاهده است.');
        setTimeout(() => goTo('finance/invoices.html'), 900);
      });
      return;
    }

    default:
      return;
  }
}

function invoiceMarkup(invoice) {
  return `<header class="invoice-doc__head">
      <div class="invoice-doc__brand"><img src="assets/logo-mark.svg" alt="" width="38" height="38"><div><strong>NOVAADMIN</strong><span>شرکت sample — تهران</span></div></div>
      <div class="invoice-doc__meta">${infoRows([
        ['شماره فاکتور', escapeHtml(invoice.number)],
        ['تاریخ صدور', formatDate(invoice.issuedAt, { format: 'long' })],
        ['سررسید', formatDate(invoice.dueAt, { format: 'long' })],
        ['وضعیت', statusBadge(invoice.statusLabel ?? invoice.status, invoice.status === 'paid' ? 'success' : 'warning')],
      ])}</div>
    </header>
    <div class="invoice-doc__parties">
      <div><h3>صادرکننده</h3><p>NOVAADMIN — واحد مالی<br />تهران، خیابان ولیعصر، پلاک ۱۲۰<br />۰۲۱-۹۱۰۰۰۰۰۰</p></div>
      <div><h3>مشتری</h3><p>${escapeHtml(invoice.customer)}<br />${escapeHtml(invoice.address ?? 'تهران')}<br />${escapeHtml(invoice.email ?? '')}</p></div>
    </div>
    <table class="table"><thead><tr><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th class="text-end">جمع</th></tr></thead>
      <tbody>${(invoice.items ?? [{ title: 'خدمات اشتراک سالانه', quantity: 1, price: invoice.total }])
        .map((item) => `<tr><td>${escapeHtml(item.title)}</td><td class="numeric">${toDigits(item.quantity)}</td><td class="numeric">${formatCurrency(item.price, 'IRR')}</td><td class="numeric text-end">${formatCurrency(item.price * item.quantity, 'IRR')}</td></tr>`)
        .join('')}</tbody></table>
    <div class="invoice-doc__totals">${infoRows([
      ['جمع اقلام', formatCurrency(invoice.subtotal ?? invoice.total, 'IRR')],
      ['مالیات', formatCurrency(invoice.tax ?? 0, 'IRR')],
      ['مبلغ نهایی', `<strong>${formatCurrency(invoice.total, 'IRR')}</strong>`],
    ])}</div>
    <footer class="invoice-doc__foot"><p>پرداخت‌ها به حساب شرکت نزد بانک ملت — شبا IR۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰</p><p>این فاکتور به صورت الکترونیکی صادر شده و بدون مهر معتبر است.</p></footer>`;
}

/* ==================================================================== Projects */

async function initProjects() {
  const page = kit.pageId();
  switch (page) {
    case 'projects/kanban.html':
      return initCrm();

    case 'projects/details.html': {
      const id = queryParam('id');
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);
      const project = await loadRecord('projects', id);
      if (!project) {
        render(node, kit.errorState('پروژه مورد نظر پیدا نشد'));
        return;
      }
      const [activity, members, files, milestonesAll, taskPage] = await Promise.all([
        services.projectFeedService.activity(project.id),
        services.projectFeedService.members(project.id),
        services.projectFeedService.files(project.id),
        services.milestones.list(project.id),
        services.taskService.list({ perPage: 200 }),
      ]);
      const allTasks = asRows(taskPage);
      let tasks = allTasks.filter((t) => t.projectId === project.id);
      if (tasks.length < 6) tasks = [...tasks, ...allTasks.filter((t) => t.projectId !== project.id).slice(0, 8 - tasks.length)];
      const statusMeta = [
        ['backlog', 'بک‌لاگ', '#94a3b8'], ['todo', 'برای انجام', '#0ea5e9'], ['in-progress', 'در حال انجام', '#6366f1'], ['review', 'بازبینی', '#f59e0b'], ['done', 'انجام شده', '#10b981'],
      ];
      const start = new Date(project.startDate);
      const due = new Date(project.dueDate);
      const totalDays = Math.max(1, Math.round((due - start) / 86400000));
      const passed = Math.min(totalDays, Math.max(0, Math.round((Date.now() - start) / 86400000)));
      const left = Math.max(0, Math.round((due - Date.now()) / 86400000));
      const spentPct = Math.round((project.spent / Math.max(1, project.budget)) * 100);
      const health = { good: ['success', 'سالم'], 'at-risk': ['warning', 'در معرض ریسک'], critical: ['danger', 'بحرانی'] }[project.health] ?? ['success', 'سالم'];
      const weeks = 12;
      const ideal = Array.from({ length: weeks }, (_, i) => Math.round(project.tasksTotal * (1 - i / (weeks - 1))));
      const doneRatio = project.progress / 100;
      const actual = Array.from({ length: weeks }, (_, i) => {
        const t = i / (weeks - 1);
        if (t > passed / totalDays + 0.001) return null;
        return Math.round(project.tasksTotal * (1 - doneRatio * Math.pow(t / Math.max(0.05, passed / totalDays), 1.15)));
      });
      const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'];
      const planned = months.map((_, i) => Math.round((project.budget / 6 / 1_000_000) * (0.8 + ((i * 37) % 5) / 10)));
      const real = planned.map((v, i) => Math.round(v * (spentPct / 100) * (0.85 + ((i * 53) % 4) / 10)));
      const workload = members.map((m, i) => ({ name: m.name, open: 3 + ((i * 7) % 6), done: 4 + ((i * 5) % 9) }));
      const projectMilestones = milestonesAll.length ? milestonesAll : [];
      const extraMilestones = [
        { title: 'شروع پروژه و جلسه آغاز', dueDate: project.startDate, status: 'done' },
        { title: 'تحویل طراحی و معماری', dueDate: new Date(start.getTime() + totalDays * 0.3 * 86400000).toISOString(), status: project.progress > 30 ? 'done' : 'in-progress' },
        { title: 'نسخه بتا برای مشتری', dueDate: new Date(start.getTime() + totalDays * 0.65 * 86400000).toISOString(), status: project.progress > 65 ? 'done' : project.progress > 40 ? 'in-progress' : 'planned' },
        { title: 'انتشار نهایی', dueDate: project.dueDate, status: project.progress === 100 ? 'done' : 'planned' },
      ];
      const ms = [...extraMilestones, ...projectMilestones.filter((m) => m.project === project.name)].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      const msTone = (st) => (st === 'done' ? 'success' : st === 'in-progress' ? 'primary' : st === 'late' ? 'danger' : 'neutral');
      const msLabel = (st) => ({ done: 'انجام شد', 'in-progress': 'در جریان', planned: 'برنامه‌ریزی‌شده', late: 'با تأخیر' })[st] ?? st;

      render(
        node,
        `<div class="ais">
          <section class="pj-hero">
            <div class="pj-hero__main">
              <div class="d-flex flex-wrap gap-2 mb-2">${statusBadge(project.statusLabel ?? ({ active: 'فعال', planning: 'برنامه‌ریزی', 'on-hold': 'متوقف', completed: 'تکمیل‌شده' }[project.status] ?? project.status), 'primary')}${statusBadge(health[1], health[0])}${(project.tags ?? []).map((t) => `<span class="badge badge--soft-neutral">${escapeHtml(t)}</span>`).join('')}</div>
              <h2 class="pj-hero__title">${escapeHtml(project.name)}</h2>
              <p class="pj-hero__text">${escapeHtml(project.description ?? '')}</p>
              <div class="pj-hero__facts">
                <span><i class="bi bi-building"></i> ${escapeHtml(project.client ?? '—')}</span>
                <span><i class="bi bi-person-badge"></i> ${escapeHtml(project.owner ?? '—')}</span>
                <span><i class="bi bi-people"></i> ${escapeHtml(project.team ?? '')}</span>
                <span><i class="bi bi-calendar-event"></i> ${formatDate(project.startDate, { format: 'medium' })} تا ${formatDate(project.dueDate, { format: 'medium' })}</span>
              </div>
              <div class="pj-hero__progress"><div class="d-flex justify-content-between mb-1"><span>پیشرفت کلی</span><strong>${toDigits(project.progress)}٪</strong></div><div class="ais-bar"><span style="width:${project.progress}%;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)"></span></div></div>
            </div>
            <div class="pj-hero__side">
              <div class="pj-stack">${members.slice(0, 6).map((m) => `<img src="${escapeHtml(m.avatar)}" alt="${escapeHtml(m.name)}" title="${escapeHtml(m.name)}">`).join('')}${members.length > 6 ? `<span>+${toDigits(members.length - 6)}</span>` : ''}</div>
              <div class="d-flex gap-2 flex-wrap justify-content-end">
                <a class="btn btn-light btn-sm" href="projects/kanban.html"><i class="bi bi-kanban"></i> کانبان</a>
                <a class="btn btn-light btn-sm" href="projects/timeline.html"><i class="bi bi-calendar-range"></i> زمان‌بندی</a>
                <button class="btn btn-primary btn-sm" type="button" data-add-task><i class="bi bi-plus-lg"></i> تسک جدید</button>
              </div>
            </div>
          </section>

          <div class="ais-kpis">
            <article class="ais-kpi ais-kpi--primary"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-wallet2"></i></span><span class="ais-kpi__label">بودجه کل</span></div><p class="ais-kpi__value">${formatCurrency(project.budget, 'IRR', { compact: true })}</p><div class="ais-kpi__meta">تأییدشده در قرارداد</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--${spentPct > 100 ? 'danger' : spentPct > 85 ? 'warning' : 'success'}"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-cash-coin"></i></span><span class="ais-kpi__label">هزینه‌شده</span></div><p class="ais-kpi__value">${formatCurrency(project.spent, 'IRR', { compact: true })}</p><div class="ais-kpi__meta">${toDigits(spentPct)}٪ از بودجه</div><div class="ais-bar" style="margin:.5rem 0 .8rem"><span style="width:${Math.min(100, spentPct)}%"></span></div></article>
            <article class="ais-kpi ais-kpi--info"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-list-check"></i></span><span class="ais-kpi__label">تسک‌های انجام‌شده</span></div><p class="ais-kpi__value">${toDigits(project.tasksDone)} / ${toDigits(project.tasksTotal)}</p><div class="ais-kpi__meta">${toDigits(project.tasksTotal - project.tasksDone)} تسک باقی‌مانده</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--${left < 10 ? 'danger' : 'violet'}"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-hourglass-split"></i></span><span class="ais-kpi__label">زمان باقی‌مانده</span></div><p class="ais-kpi__value">${toDigits(left)} روز</p><div class="ais-kpi__meta">${toDigits(passed)} روز از ${toDigits(totalDays)} روز سپری شده</div><div style="height:10px"></div></article>
          </div>

          <div class="ais-grid">
            ${card({ title: 'نمودار برن‌داون', subtitle: 'تسک‌های باقی‌مانده — برنامه در برابر واقعی', icon: 'graph-down-arrow', body: '<div class="chart" data-chart-owner="controller" data-pj="burn" style="min-height:300px"></div>' }).replace('<section class="card', '<section data-col="8" class="card')}
            ${card({ title: 'وضعیت تسک‌ها', icon: 'pie-chart', body: '<div class="chart" data-chart-owner="controller" data-pj="status" style="min-height:300px"></div>' }).replace('<section class="card', '<section data-col="4" class="card')}
          </div>
          <div class="ais-grid">
            ${card({ title: 'بودجه برنامه‌ریزی‌شده و واقعی', subtitle: 'میلیون ریال در ماه', icon: 'bar-chart', body: '<div class="chart" data-chart-owner="controller" data-pj="budget" style="min-height:280px"></div>' }).replace('<section class="card', '<section data-col="6" class="card')}
            ${card({ title: 'بار کاری اعضای تیم', subtitle: 'تسک باز و انجام‌شده', icon: 'people', body: '<div class="chart" data-chart-owner="controller" data-pj="work" style="min-height:280px"></div>' }).replace('<section class="card', '<section data-col="6" class="card')}
          </div>

          <div class="ais-grid">
            <div data-col="8">${tabs([
              {
                id: 'tasks', label: 'تسک‌ها', icon: 'list-task', badge: toDigits(tasks.length),
                body: card({ flush: true, body: `<div class="ais-table-wrap"><table class="ais-table"><thead><tr><th>تسک</th><th>مسئول</th><th>وضعیت</th><th>اولویت</th><th>موعد</th><th style="min-width:120px">پیشرفت</th></tr></thead><tbody>${tasks
                  .map((t) => `<tr><td><div class="ais-name"><span class="ais-name__icon ais-tone--${t.status === 'done' ? 'success' : 'primary'}"><i class="bi bi-${t.status === 'done' ? 'check2-circle' : 'circle'}"></i></span><div><strong>${escapeHtml(t.title)}</strong><small>${toDigits(t.comments ?? 0)} نظر • ${toDigits(t.attachments ?? 0)} پیوست</small></div></div></td>
                    <td><div class="d-flex align-items-center gap-2"><img class="avatar avatar--xs" src="${escapeHtml(t.assigneeAvatar)}" alt="">${escapeHtml(t.assignee)}</div></td>
                    <td>${statusBadge(t.statusLabel, { done: 'success', review: 'warning', 'in-progress': 'primary', todo: 'info' }[t.status] ?? 'neutral')}</td>
                    <td>${statusBadge(t.priorityLabel, { urgent: 'danger', high: 'warning', medium: 'info' }[t.priority] ?? 'neutral')}</td>
                    <td class="num ${t.overdue ? 'text-danger' : ''}">${formatDate(t.dueDate, { format: 'short' })}</td>
                    <td><div class="d-flex align-items-center gap-2"><div class="ais-bar" style="flex:1;margin:0"><span style="width:${t.progress}%"></span></div><span class="num">${toDigits(t.progress)}٪</span></div></td></tr>`)
                  .join('')}</tbody></table></div>` }),
              },
              { id: 'team', label: 'تیم', icon: 'people', badge: toDigits(members.length), body: card({ body: `<div class="pj-team">${members.map((m, i) => `<div class="pj-member"><img src="${escapeHtml(m.avatar)}" alt=""><strong>${escapeHtml(m.name)}</strong><small>${['مدیر فنی', 'توسعه‌دهنده ارشد', 'طراح محصول', 'تحلیلگر', 'توسعه‌دهنده', 'تستر'][i % 6]}</small><div class="pj-member__stats"><span><b>${toDigits(workload[i]?.open ?? 0)}</b> باز</span><span><b>${toDigits(workload[i]?.done ?? 0)}</b> انجام</span></div></div>`).join('')}</div>` }) },
              { id: 'files', label: 'فایل‌ها', icon: 'folder2-open', badge: toDigits(files.length), body: card({ flush: true, body: files.map((f) => { const ic = { figma: ['vector-pen', 'violet'], pdf: ['file-earmark-pdf', 'danger'], sheet: ['file-earmark-spreadsheet', 'success'], image: ['file-earmark-image', 'info'], doc: ['file-earmark-word', 'primary'], video: ['file-earmark-play', 'warning'] }[f.type] ?? ['file-earmark', 'neutral']; return `<div class="kb-article"><span class="ais-name__icon ais-tone--${ic[1]}"><i class="bi bi-${ic[0]}"></i></span><span class="kb-article__body"><strong>${escapeHtml(f.name)}</strong><small>${escapeHtml(f.owner)} • ${escapeHtml(f.size)}</small></span><span class="kb-article__meta">${relativeTime(f.at)}<a class="icon-btn icon-btn--sm" href="#" title="دانلود"><i class="bi bi-download"></i></a></span></div>`; }).join('') }) },
            ])}</div>
            <div data-col="4" class="d-flex flex-column" style="gap:var(--nv-card-gap,1.25rem)">
              ${card({ title: 'نقاط عطف', icon: 'flag', body: `<ul class="ais-feed">${ms.map((m) => `<li class="is-${msTone(m.status)}"><span class="ais-feed__icon"><i class="bi bi-${m.status === 'done' ? 'check-lg' : 'flag'}"></i></span><div><div class="ais-feed__title">${escapeHtml(m.title)}</div><div class="ais-feed__meta">${formatDate(m.dueDate, { format: 'medium' })} • ${msLabel(m.status)}</div></div></li>`).join('')}</ul>` })}
              ${card({ title: 'فعالیت‌های اخیر', icon: 'activity', body: `<ul class="ais-feed">${activity.slice(0, 6).map((a) => `<li class="is-primary"><span class="ais-feed__icon" style="padding:0;overflow:hidden"><img src="${escapeHtml(a.avatar)}" alt="" style="width:100%;height:100%"></span><div><div class="ais-feed__title">${escapeHtml(a.text)}</div><div class="ais-feed__meta">${escapeHtml(a.actor)} • ${relativeTime(a.at)}</div></div></li>`).join('')}</ul>` })}
            </div>
          </div>
        </div>`,
      );
      const counts = statusMeta.map(([sid]) => tasks.filter((t) => t.status === sid).length);
      await Promise.all([
        chart($('[data-pj="burn"]', node), { type: 'line', height: 300, labels: Array.from({ length: weeks }, (_, i) => `هفته ${toDigits(i + 1)}`), series: [{ name: 'برنامه', data: ideal }, { name: 'واقعی', data: actual }], colors: ['#cbd5e1', '#6366f1'], extra: { stroke: { width: [2, 3], dashArray: [6, 0], curve: 'smooth' }, markers: { size: [0, 4] } } }),
        chart($('[data-pj="status"]', node), { type: 'donut', height: 300, series: counts, labels: statusMeta.map((r) => r[1]), colors: statusMeta.map((r) => r[2]) }),
        chart($('[data-pj="budget"]', node), { type: 'column', height: 280, labels: months, series: [{ name: 'برنامه', data: planned }, { name: 'واقعی', data: real }], colors: ['#c7d2fe', '#6366f1'] }),
        chart($('[data-pj="work"]', node), { type: 'bar', height: 280, labels: workload.map((w) => w.name), series: [{ name: 'باز', data: workload.map((w) => w.open) }, { name: 'انجام‌شده', data: workload.map((w) => w.done) }], colors: ['#f59e0b', '#10b981'], extra: { chart: { stacked: true } } }),
      ]);
      on($('[data-add-task]', node), 'click', () => openRecordForm({ resource: 'tasks', title: 'افزودن تسک', fields: crudFields('tasks'), onSaved: () => toast.success('تسک افزوده شد', 'تسک جدید به پروژه اضافه شد.') }));
      return;
    }

    case 'projects/timeline.html': {
      const node = host();
      const { items } = await services.projects.list({ perPage: 14 });
      const DAY = 86400000;
      const starts = items.map((p) => new Date(p.startDate).getTime());
      const ends = items.map((p) => new Date(p.dueDate).getTime());
      const min = new Date(Math.min(...starts));
      min.setDate(1);
      const maxDate = new Date(Math.max(...ends));
      const range = Math.max(DAY, maxDate.getTime() + 15 * DAY - min.getTime());
      const pos = (t) => ((t - min.getTime()) / range) * 100;
      const monthTicks = [];
      const cursor = new Date(min);
      while (cursor.getTime() < min.getTime() + range) {
        monthTicks.push({ left: pos(cursor.getTime()), label: monthNames().jalali[cursor.getMonth()] ?? '' });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      const today = pos(Date.now());
      const toneOf = (p) => (p.status === 'completed' ? 'success' : p.health === 'critical' ? 'danger' : p.health === 'at-risk' ? 'warning' : p.status === 'on-hold' ? 'neutral' : 'primary');
      const elapsed = (p) => {
        const a = new Date(p.startDate).getTime();
        const b = new Date(p.dueDate).getTime();
        return Math.max(0, Math.min(100, Math.round(((Date.now() - a) / Math.max(1, b - a)) * 100)));
      };
      const stat = (st) => items.filter((p) => p.status === st).length;
      const avgProgress = Math.round(items.reduce((sum, p) => sum + p.progress, 0) / Math.max(1, items.length));
      const atRisk = items.filter((p) => p.health !== 'good');
      const avgDelay = atRisk.length ? Math.round(atRisk.reduce((sum, p) => sum + (p.delayDays ?? 0), 0) / atRisk.length) : 0;
      const milestones = await services.milestoneService.list(items[0]?.id);
      const upcoming = [...items]
        .filter((p) => p.status !== 'completed')
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);
      const healthOf = (id) => items.filter((p) => p.health === id).length;
      const pct = (n) => (items.length ? Math.round((n / items.length) * 100) : 0);

      render(
        node,
        `<div class="dashboard-shell tl">
          ${pageHeader({
            title: 'خط زمانی پروژه‌ها',
            subtitle: 'هم‌ترازی زمان‌بندی، پیشرفت و سلامت تحویل در یک نما',
            icon: 'calendar-range',
            badges: [
              statusBadge(`${toDigits(items.length)} پروژه`, 'primary'),
              atRisk.length ? statusBadge(`${toDigits(atRisk.length)} نیازمند توجه`, 'warning') : statusBadge('همه سالم', 'success'),
            ],
            actions: toolButtons({ create: 'پروژه جدید', exportResource: 'projects' }),
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'پروژه‌های فعال', value: toDigits(stat('active')), meta: `از ${toDigits(items.length)} پروژه ثبت‌شده`, tone: 'primary', icon: 'kanban', id: 'tl-active' })}
            ${statCard({ label: 'تکمیل‌شده', value: toDigits(stat('completed')), meta: `${toDigits(pct(stat('completed')))}٪ سبد پروژه`, tone: 'success', icon: 'check2-circle', id: 'tl-done' })}
            ${statCard({ label: 'میانگین پیشرفت', value: `${toDigits(avgProgress)}٪`, meta: atRisk.length ? `${toDigits(atRisk.length)} پروژه در معرض ریسک` : 'بدون پروژه پرریسک', tone: atRisk.length ? 'warning' : 'info', icon: 'speedometer2', id: 'tl-progress' })}
            ${statCard({ label: 'تأخیر میانگین', value: `${toDigits(avgDelay)} روز`, meta: atRisk.length ? `روی ${toDigits(atRisk.length)} پروژه پرریسک` : 'تحویل‌ها طبق برنامه', tone: avgDelay ? 'danger' : 'success', icon: 'alarm', id: 'tl-delay' })}
          </div>

          <section class="card tl-gantt-card">
            <header class="card__head">
              <span class="card__icon"><i class="bi bi-bar-chart-steps" aria-hidden="true"></i></span>
              <div>
                <h2 class="card__title">گانت پروژه‌ها</h2>
                <p class="card__subtitle">پهنای میله = مدت پروژه · پرشدگی = پیشرفت واقعی · خط عمودی = امروز</p>
              </div>
              <div class="card__actions tl-legend">
                <span><i class="ais-dot ais-dot--primary"></i> در جریان</span>
                <span><i class="ais-dot ais-dot--success"></i> تکمیل</span>
                <span><i class="ais-dot ais-dot--warning"></i> ریسک</span>
                <span><i class="ais-dot ais-dot--danger"></i> بحرانی</span>
              </div>
            </header>
            <div class="card__body">
              <div class="pj-gantt-scroll tl-gantt-scroll">
                <div class="pj-gantt tl-gantt">
                  <div class="pj-gantt__head"><div class="pj-gantt__label">پروژه</div><div class="pj-gantt__scale">${monthTicks
                    .map((m, i) => (monthTicks.length > 8 && i % 2 ? '' : `<span style="inset-inline-start:${m.left}%">${escapeHtml(m.label)}</span>`))
                    .join('')}</div></div>
                  ${items
                    .map((p) => {
                      const l = pos(new Date(p.startDate).getTime());
                      const w = Math.max(3, pos(new Date(p.dueDate).getTime()) - l);
                      const drift = p.progress - elapsed(p);
                      return `<div class="pj-gantt__row tl-gantt__row">
                        <a class="pj-gantt__label" href="projects/details.html?id=${escapeHtml(p.id)}">
                          <img src="${escapeHtml(p.ownerAvatar)}" alt="">
                          <span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.owner)} · ${toDigits(p.progress)}٪ پیشرفت</small></span>
                        </a>
                        <div class="pj-gantt__track">
                          ${monthTicks.map((m) => `<i class="pj-gantt__grid" style="inset-inline-start:${m.left}%"></i>`).join('')}
                          <div class="pj-gantt__bar ais-tone--${toneOf(p)}" style="inset-inline-start:${l}%;width:${w}%" title="${escapeHtml(p.name)}">
                            <span class="pj-gantt__fill" style="width:${p.progress}%"></span>
                            <b>${toDigits(p.progress)}٪</b>
                            <span class="tl-gantt__flag tl-gantt__flag--${drift >= 0 ? 'ahead' : 'behind'}" title="${drift >= 0 ? 'جلوتر از برنامه' : 'عقب‌تر از برنامه'}">${drift >= 0 ? '+' : '−'}${toDigits(Math.abs(Math.round(drift)))}٪</span>
                          </div>
                        </div>
                      </div>`;
                    })
                    .join('')}
                  <div class="pj-gantt__today" style="--today:${today.toFixed(2)}"><span>امروز</span></div>
                </div>
              </div>
            </div>
          </section>

          <div class="widget-grid tl-grid">
            ${card({
              span: 8,
              icon: 'bar-chart-line',
              title: 'پیشرفت در برابر زمان سپری‌شده',
              subtitle: 'هر پروژه دو میله دارد: آنچه ساخته شده و آنچه از زمانش گذشته',
              body: `<div class="chart" data-chart-owner="controller" data-tl="progress" style="min-height:360px"></div>`,
              foot: `<div class="tl-insight"><i class="bi bi-lightbulb"></i> پروژه‌هایی که میله پیشرفتشان کوتاه‌تر از میله زمان است، در نیمه دوم نمودار فهرست شده‌اند.</div>`,
            })}
            ${card({
              span: 4,
              icon: 'heart-pulse',
              title: 'وضعیت سلامت',
              subtitle: `${toDigits(healthOf('good'))} پروژه سالم از ${toDigits(items.length)}`,
              body: `<div class="chart" data-chart-owner="controller" data-tl="health" data-chart-height="220"></div>
                <ul class="tl-health">
                  <li class="tl-health__row"><span class="tl-health__dot tl-health__dot--good"></span><span>سالم</span><b class="numeric">${toDigits(healthOf('good'))}</b><small>${toDigits(pct(healthOf('good')))}٪</small></li>
                  <li class="tl-health__row"><span class="tl-health__dot tl-health__dot--warn"></span><span>در معرض ریسک</span><b class="numeric">${toDigits(healthOf('at-risk'))}</b><small>${toDigits(pct(healthOf('at-risk')))}٪</small></li>
                  <li class="tl-health__row"><span class="tl-health__dot tl-health__dot--bad"></span><span>بحرانی</span><b class="numeric">${toDigits(healthOf('critical'))}</b><small>${toDigits(pct(healthOf('critical')))}٪</small></li>
                </ul>`,
            })}

            ${card({
              span: 7,
              icon: 'graph-up',
              title: 'انحراف پیشرفت از برنامه',
              subtitle: 'بالای خط = جلوتر از برنامه · پایین خط = عقب‌تر از برنامه',
              body: `<ul class="tl-variance">${items
                .map((p) => {
                  const drift = Math.round(p.progress - elapsed(p));
                  return `<li class="tl-variance__row">
                    <span class="tl-variance__name" title="${escapeHtml(p.name)}">${escapeHtml(p.name.split(' — ')[0])}</span>
                    <span class="tl-variance__track">
                      <i class="tl-variance__zero" aria-hidden="true"></i>
                      <i class="tl-variance__bar ${drift >= 0 ? 'is-ahead' : 'is-behind'}" style="--w:${Math.min(100, Math.abs(drift) * 1.6)}%;--dir:${drift >= 0 ? '1' : '-1'}"></i>
                    </span>
                    <b class="numeric ${drift >= 0 ? 'text-success' : 'text-danger'}">${drift >= 0 ? '+' : '−'}${toDigits(Math.abs(drift))}٪</b>
                  </li>`;
                })
                .join('')}</ul>
              <p class="tl-variance__note">میانگین انحراف ${toDigits(Math.round(items.reduce((sum, p) => sum + (p.progress - elapsed(p)), 0) / Math.max(1, items.length)))}٪ — عدد مثبت یعنی تیم جلوتر از نقشه راه است.</p>`,
            })}

            ${card({
              span: 5,
              className: 'tl-list-card',
              icon: 'flag',
              title: 'تحویل‌های پیش‌رو',
              subtitle: 'پنج موعد نزدیک‌تر میان پروژه‌های باز',
              flush: upcoming.length > 0,
              body: upcoming.length
                ? `<ul class="tl-upcoming">${upcoming
                    .map((p) => {
                      const days = Math.round((new Date(p.dueDate).getTime() - Date.now()) / DAY);
                      const tone = days < 0 ? 'late' : days <= 14 ? 'soon' : 'ok';
                      return `<li class="tl-upcoming__row">
                        <span class="tl-upcoming__date tl-upcoming__date--${tone}"><b class="numeric">${toDigits(Math.abs(days))}</b><small>${days < 0 ? 'روز تأخیر' : 'روز مانده'}</small></span>
                        <span class="tl-upcoming__main"><a href="projects/details.html?id=${escapeHtml(p.id)}">${escapeHtml(p.name)}</a><small>${escapeHtml(p.owner)} · ${escapeHtml(formatDate(p.dueDate, { format: 'medium' }))}</small></span>
                        <span class="tl-upcoming__progress"><i style="--w:${Math.min(100, p.progress)}%"></i></span>
                      </li>`;
                    })
                    .join('')}</ul>`
                : emptyState({ title: 'تحویل نزدیکی وجود ندارد', text: 'همه پروژه‌های باز موعد دورتری دارند.', icon: 'calendar-check' }),
            })}
          </div>

          ${card({
            className: 'mt-4 tl-list-card',
            icon: 'list-check',
            title: 'نقاط عطف پورتفوی',
            subtitle: 'ریزتحویل‌های ثبت‌شده و وضعیت هرکدام',
            flush: milestones.length > 0,
            body: milestones.length
              ? `<ul class="tl-milestones">${milestones
                  .map(
                    (milestone) => `<li class="tl-milestones__row">
                      <span class="tl-milestones__state tl-milestones__state--${milestone.status === 'done' ? 'done' : milestone.status === 'in-progress' ? 'open' : 'planned'}"><i class="bi bi-${milestone.status === 'done' ? 'check2' : milestone.status === 'in-progress' ? 'hourglass-split' : 'circle'}" aria-hidden="true"></i></span>
                      <span class="tl-milestones__main">${escapeHtml(milestone.title)}<small>${escapeHtml(milestone.project ?? '')} · موعد ${escapeHtml(formatDate(milestone.dueDate, { format: 'medium' }))}</small></span>
                      ${statusBadge(milestone.status === 'done' ? 'انجام شد' : milestone.status === 'in-progress' ? 'در جریان' : 'برنامه‌ریزی‌شده', milestone.status === 'done' ? 'success' : milestone.status === 'in-progress' ? 'warning' : 'neutral')}
                    </li>`,
                  )
                  .join('')}</ul>`
              : emptyState({ title: 'نقطه عطفی ثبت نشده', text: 'برای پروژه‌های این نما نقطه عطفی تعریف نشده است.', icon: 'flag' }),
          })}
        </div>`,
      );

      /* Open the gantt on "today" instead of the timeline start (phones only
         show a slice) — the sticky project column stays out of the maths. */
      requestAnimationFrame(() => {
        const scroller = $('.pj-gantt-scroll', node);
        const marker = $('.pj-gantt__today', node);
        if (!scroller || !marker || scroller.scrollWidth <= scroller.clientWidth + 2) return;
        const box = scroller.getBoundingClientRect();
        const label = $('.pj-gantt__head .pj-gantt__label', node)?.getBoundingClientRect();
        const labelW = label ? label.width : 0;
        const rtl = getComputedStyle(scroller).direction === 'rtl';
        const freeStart = rtl ? box.left : box.left + labelW;
        const target = freeStart + (box.width - labelW) / 2;
        scroller.scrollLeft += marker.getBoundingClientRect().left - target;
      });
      await Promise.all([
        chart($('[data-tl="progress"]', node), {
          type: 'bar',
          height: 360,
          labels: items.map((p) => p.name.split(' — ')[0]),
          series: [
            { name: 'پیشرفت ٪', data: items.map((p) => p.progress) },
            { name: 'زمان سپری‌شده ٪', data: items.map((p) => elapsed(p)) },
          ],
          colors: ['#6366f1', '#cbd5e1'],
        }),
        chart($('[data-tl="health"]', node), {
          type: 'donut',
          height: 220,
          labels: ['سالم', 'در معرض ریسک', 'بحرانی'],
          series: ['good', 'at-risk', 'critical'].map(healthOf),
          colors: ['#10b981', '#f59e0b', '#ef4444'],
        }),
      ]);
      exportable(node, 'projects');
      return;
    }

    case 'projects/tasks.html':
    case 'projects/backlog.html': {
      const node = host();
      const isBacklog = page.endsWith('backlog.html');
      const data = isBacklog ? await services.backlogService.list() : await services.taskService.list({ perPage: 100 });
      const items = (data.items ?? data).slice();
      const summary = data.summary ?? {};

      /* ------------------------------------------------------------ labels */
      const statusMeta = (id) => summary.statuses?.find((s) => s.id === id) ?? { id, label: id, tone: 'neutral' };
      const priorityMeta = (id) => summary.priorities?.find((p) => p.id === id) ?? { id, label: id, tone: 'neutral' };
      /**
       * Backlog is a *priority* queue: urgent first, then by age. The tasks page
       * keeps the collection order (due date, straight from the service).
       */
      items.sort((a, b) =>
        isBacklog
          ? (summary.priorities?.findIndex((p) => p.id === b.priority) ?? 0) - (summary.priorities?.findIndex((p) => p.id === a.priority) ?? 0) ||
            new Date(a.createdAt) - new Date(b.createdAt)
          : new Date(a.dueDate) - new Date(b.dueDate),
      );

      const DAY = 86400000;
      const startOfDay = (value) => {
        const date = new Date(value);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      };
      const todayStart = startOfDay(Date.now());
      /** Due-state drives the chip colour and the `data-state` filter buckets. */
      const dueState = (task) => {
        if (task.status === 'done') return 'done';
        if (task.overdue || startOfDay(task.dueDate) < todayStart) return 'late';
        if (startOfDay(task.dueDate) === todayStart) return 'today';
        if (startOfDay(task.dueDate) - todayStart <= 3 * DAY) return 'soon';
        return 'open';
      };
      const dueLabel = (task) => {
        const days = Math.round((startOfDay(task.dueDate) - todayStart) / DAY);
        if (task.status === 'done') return 'انجام شد';
        if (days === 0) return 'امروز';
        if (days === 1) return 'فردا';
        if (days === -1) return 'دیروز';
        if (days < 0) return `${toDigits(Math.abs(days))} روز تأخیر`;
        return `${toDigits(days)} روز مانده`;
      };

      /* ------------------------------------------------------------- stats */
      const open = items.filter((task) => task.status !== 'done');
      const late = open.filter((task) => task.overdue);
      const done = items.length - open.length;
      const completion = items.length ? Math.round((done / items.length) * 100) : 0;
      const urgent = open.filter((task) => task.priority === 'urgent');
      const estimate = open.reduce((sum, task) => sum + (task.estimate ?? 0), 0);
      const spent = open.reduce((sum, task) => sum + (task.spent ?? 0), 0);

      /* ---------------------------------------------------------- workload */
      const byOwner = new Map();
      open.forEach((task) => {
        const key = task.assignee ?? 'بدون مسئول';
        const entry = byOwner.get(key) ?? { name: key, avatar: task.assigneeAvatar, count: 0, points: 0, late: 0 };
        entry.count += 1;
        entry.points += task.estimate ?? 0;
        if (task.overdue) entry.late += 1;
        byOwner.set(key, entry);
      });
      const workload = [...byOwner.values()].sort((a, b) => b.count - a.count);
      const peakLoad = Math.max(1, ...workload.map((owner) => owner.count));

      const priorityCounts = ['urgent', 'high', 'medium', 'low'].map((id) => {
        const meta = priorityMeta(id);
        const rows = open.filter((task) => task.priority === id);
        return { ...meta, count: rows.length, points: rows.reduce((sum, task) => sum + (task.estimate ?? 0), 0) };
      });
      const maxPriority = Math.max(1, ...priorityCounts.map((row) => row.count));

      /* ------------------------------------------------------------ markup */
      const rowMarkup = (task) => {
        const state = dueState(task);
        const status = statusMeta(task.status);
        const priority = priorityMeta(task.priority);
        const progress = Math.max(0, Math.min(100, task.progress ?? 0));
        return `<li class="task-row" data-task-row data-id="${escapeHtml(task.id)}" data-state="${state}" data-priority="${escapeHtml(task.priority)}" data-status="${escapeHtml(task.status)}" data-search="${escapeHtml(`${task.title} ${task.project ?? ''} ${task.assignee ?? ''} ${priority.label}`.toLowerCase())}">
          <button type="button" class="task-row__check${task.status === 'done' ? ' is-done' : ''}" data-task-toggle="${escapeHtml(task.id)}" aria-pressed="${task.status === 'done'}" aria-label="تغییر وضعیت ${escapeHtml(task.title)}"><i class="bi bi-check-lg" aria-hidden="true"></i></button>
          <span class="task-row__flag task-row__flag--${escapeHtml(priority.id === 'urgent' ? 'urgent' : priority.id === 'high' ? 'high' : 'normal')}" title="اولویت ${escapeHtml(priority.label)}"></span>
          <div class="task-row__main">
            <button type="button" class="task-row__title" data-task-open="${escapeHtml(task.id)}">${escapeHtml(task.title)}</button>
            <div class="task-row__meta">
              <span class="task-row__chip"><i class="bi bi-folder2" aria-hidden="true"></i> ${escapeHtml(task.project ?? '—')}</span>
              <span class="task-row__chip task-due task-due--${state}"><i class="bi bi-calendar-event" aria-hidden="true"></i> ${escapeHtml(dueLabel(task))} · ${escapeHtml(formatDate(task.dueDate, { format: 'short' }))}</span>
              ${task.comments ? `<span class="task-row__chip"><i class="bi bi-chat-dots" aria-hidden="true"></i> ${toDigits(task.comments)}</span>` : ''}
              ${task.attachments ? `<span class="task-row__chip"><i class="bi bi-paperclip" aria-hidden="true"></i> ${toDigits(task.attachments)}</span>` : ''}
              ${task.tags?.length ? `<span class="task-row__tags">${task.tags.map((tag) => `<span class="task-tag">${escapeHtml(tag)}</span>`).join('')}</span>` : ''}
            </div>
          </div>
          <div class="task-row__progress" title="پیشرفت ${toDigits(progress)}٪">
            <span class="task-row__track"><span class="task-row__fill" style="--fill:${progress}%"></span></span>
            <b class="numeric">${toDigits(progress)}٪</b>
          </div>
          <span class="badge badge--soft-${escapeHtml(priority.tone)} task-row__priority">${escapeHtml(priority.label)}</span>
          <span class="badge badge--soft-${escapeHtml(status.tone)} task-row__status">${escapeHtml(status.label)}</span>
          <span class="task-row__owner" title="${escapeHtml(task.assignee ?? 'بدون مسئول')}">
            <img class="avatar avatar--xs" src="${escapeHtml(task.assigneeAvatar ?? 'assets/img/avatars/avatar-01.svg')}" alt="">
            <span>${escapeHtml(task.assignee ?? 'بدون مسئول')}</span>
          </span>
          <div class="task-row__actions">
            <button type="button" class="icon-btn icon-btn--sm" data-task-edit="${escapeHtml(task.id)}" aria-label="ویرایش تسک"><i class="bi bi-pencil" aria-hidden="true"></i></button>
            <a class="icon-btn icon-btn--sm" href="projects/details.html?id=${escapeHtml(task.projectId ?? '')}" aria-label="صفحه پروژه"><i class="bi bi-arrow-up-left" aria-hidden="true"></i></a>
          </div>
        </li>`;
      };

      render(
        node,
        `<div class="dashboard-shell task-page">
          ${pageHeader({
            title: isBacklog ? 'بک‌لاگ محصول' : 'فهرست تسک‌ها',
            subtitle: isBacklog ? 'صف اولویت‌دار کارها برای اسپرینت بعدی — از بحرانی به کم' : 'هر تسک با مسئول، موعد، پیشرفت و اولویت در یک نگاه',
            icon: 'list-task',
            badges: [
              statusBadge(`${toDigits(open.length)} تسک باز`, 'primary'),
              late.length ? statusBadge(`${toDigits(late.length)} عقب‌افتاده`, 'danger') : statusBadge('بدون تأخیر', 'success'),
            ],
            actions: toolButtons({ create: isBacklog ? 'افزودن به بک‌لاگ' : 'تسک جدید', exportResource: 'tasks' }),
          })}
          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: isBacklog ? 'موارد بک‌لاگ' : 'کل تسک‌ها', value: toDigits(items.length), meta: `${toDigits(estimate)} واحد تخمین`, tone: 'primary', icon: 'list-task', id: 'task-total' })}
            ${statCard({ label: 'در جریان', value: toDigits(open.length), meta: `${toDigits(spent)} واحد مصرف‌شده`, tone: 'info', icon: 'hourglass-split', id: 'task-open' })}
            ${statCard({ label: 'عقب‌افتاده', value: toDigits(late.length), meta: late.length ? `${toDigits(Math.round((late.length / Math.max(1, open.length)) * 100))}٪ از کارهای باز` : 'همه‌چیز طبق برنامه', tone: late.length ? 'danger' : 'success', icon: 'alarm', id: 'task-late' })}
            ${statCard({ label: 'نرخ تکمیل', value: `${toDigits(completion)}٪`, meta: `${toDigits(done)} تسک بسته‌شده`, tone: 'success', icon: 'check2-circle', id: 'task-done' })}
          </div>

          <div class="task-layout">
            <section class="card task-board">
              <header class="card__head">
                <span class="card__icon"><i class="bi bi-kanban" aria-hidden="true"></i></span>
                <div>
                  <h2 class="card__title">${isBacklog ? 'صف بک‌لاگ' : 'کارهای جاری'}</h2>
                  <p class="card__subtitle" data-task-count aria-live="polite">نمایش ${toDigits(Math.min(12, items.length))} از ${toDigits(items.length)} تسک</p>
                </div>
              </header>
              <div class="card__body card__body--flush">
                <div class="task-toolbar">
                  <label class="task-search">
                    <i class="bi bi-search" aria-hidden="true"></i>
                    <input type="search" class="form-control" data-task-search placeholder="جست‌وجوی عنوان، پروژه یا مسئول…" autocomplete="off">
                  </label>
                  <div class="task-filters" role="group" aria-label="فیلتر وضعیت" data-rail>
                    <button type="button" class="task-filter is-active" data-task-filter="all">همه</button>
                    <button type="button" class="task-filter" data-task-filter="open">باز</button>
                    <button type="button" class="task-filter" data-task-filter="late">عقب‌افتاده</button>
                    <button type="button" class="task-filter" data-task-filter="today">امروز</button>
                    <button type="button" class="task-filter" data-task-filter="done">انجام‌شده</button>
                  </div>
                  <label class="task-select">
                    <span class="visually-hidden">اولویت</span>
                    <select class="form-select" data-task-priority>
                      <option value="all">همه اولویت‌ها</option>
                      ${priorityCounts.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.label)}</option>`).join('')}
                    </select>
                  </label>
                </div>
                <ul class="task-list" data-task-list></ul>
                <div class="task-empty" data-task-empty hidden>
                  ${emptyState({ title: 'تسکی با این فیلتر پیدا نشد', text: 'عبارت جست‌وجو را کوتاه‌تر کنید یا فیلترها را پاک کنید.', icon: 'search' })}
                </div>
              </div>
              <footer class="card__foot task-board__foot">
                <span class="text-muted fs-sm" data-task-foot></span>
                <button type="button" class="btn btn-light btn-sm" data-task-more hidden>نمایش موارد بیشتر <i class="bi bi-chevron-down" aria-hidden="true"></i></button>
              </footer>
            </section>

            <aside class="task-side">
              ${card({
                icon: 'people',
                title: 'توزیع بار کاری',
                subtitle: `${toDigits(workload.length)} مسئول فعال روی ${toDigits(open.length)} تسک باز`,
                body: workload.length
                  ? `<ul class="task-load">${workload
                      .slice(0, 6)
                      .map(
                        (owner) => `<li class="task-load__row">
                          <img class="avatar avatar--xs" src="${escapeHtml(owner.avatar ?? 'assets/img/avatars/avatar-01.svg')}" alt="">
                          <span class="task-load__name">${escapeHtml(owner.name)}<small>${toDigits(owner.points)} واحد تخمین${owner.late ? ` · ${toDigits(owner.late)} تأخیر` : ''}</small></span>
                          <span class="task-load__bar" title="${toDigits(owner.count)} تسک باز"><i style="--w:${Math.round((owner.count / peakLoad) * 100)}%"></i></span>
                          <b class="numeric">${toDigits(owner.count)}</b>
                        </li>`,
                      )
                      .join('')}</ul>
                    ${workload.length > 6 ? `<p class="task-side__more text-muted fs-sm">+ ${toDigits(workload.length - 6)} مسئول دیگر</p>` : ''}`
                  : emptyState({ title: 'کار بازی باقی نمانده', text: 'همه تسک‌ها بسته شده‌اند.', icon: 'emoji-smile' }),
              })}
              ${card({
                icon: 'flag',
                title: 'ترکیب اولویت‌ها',
                subtitle: `${toDigits(urgent.length)} مورد بحرانی نیازمند اقدام فوری`,
                body: `<ul class="task-priority-list">${priorityCounts
                  .map(
                    (row) => `<li class="task-priority-list__row">
                      <span class="task-priority-list__label">${escapeHtml(row.label)}<small>${toDigits(row.points)} واحد</small></span>
                      <span class="task-priority-list__bar task-priority-list__bar--${escapeHtml(row.id)}"><i style="--w:${Math.round((row.count / maxPriority) * 100)}%"></i></span>
                      <b class="numeric">${toDigits(row.count)}</b>
                    </li>`,
                  )
                  .join('')}</ul>`,
              })}
            </aside>
          </div>
        </div>`,
      );

      /* ----------------------------------------------------------- behaviour */
      const listNode = $('[data-task-list]', node);
      const emptyNode = $('[data-task-empty]', node);
      const footNode = $('[data-task-foot]', node);
      const moreNode = $('[data-task-more]', node);
      const countNode = $('[data-task-count]', node);
      const searchNode = $('[data-task-search]', node);
      const priorityNode = $('[data-task-priority]', node);
      const STEP = 12;
      const state = { filter: 'all', priority: 'all', term: '', visible: STEP };

      const filtered = () => {
        const term = state.term.trim().toLowerCase();
        return items.filter((task) => {
          const taskState = dueState(task);
          if (state.priority !== 'all' && task.priority !== state.priority) return false;
          if (state.filter === 'open' && task.status === 'done') return false;
          if (state.filter === 'done' && task.status !== 'done') return false;
          if (state.filter === 'late' && taskState !== 'late') return false;
          if (state.filter === 'today' && taskState !== 'today') return false;
          if (term && !`${task.title} ${task.project ?? ''} ${task.assignee ?? ''} ${priorityMeta(task.priority).label}`.toLowerCase().includes(term)) return false;
          return true;
        });
      };

      const paint = () => {
        const rows = filtered();
        const visible = rows.slice(0, state.visible);
        listNode.innerHTML = visible.map(rowMarkup).join('');
        emptyNode.hidden = rows.length > 0;
        listNode.hidden = rows.length === 0;
        countNode.textContent = `نمایش ${toDigits(visible.length)} از ${toDigits(rows.length)} تسک`;
        footNode.textContent = rows.length
          ? `${toDigits(rows.filter((task) => dueState(task) === 'late').length)} مورد عقب‌افتاده در این نما · مجموع تخمین ${toDigits(rows.reduce((sum, task) => sum + (task.estimate ?? 0), 0))} واحد`
          : '';
        moreNode.hidden = rows.length <= state.visible;
        moreNode.innerHTML = `نمایش ${toDigits(Math.min(STEP, rows.length - state.visible))} مورد بیشتر <i class="bi bi-chevron-down" aria-hidden="true"></i>`;
      };
      paint();

      on($('[data-task-filters]', node) ?? node, 'click', (event) => {
        const filter = event.target.closest('[data-task-filter]');
        if (filter) {
          state.filter = filter.dataset.taskFilter;
          state.visible = STEP;
          $$('[data-task-filter]', node).forEach((button) => button.classList.toggle('is-active', button === filter));
          paint();
          return;
        }
        if (event.target.closest('[data-task-more]')) {
          state.visible += STEP;
          paint();
          return;
        }
        const toggle = event.target.closest('[data-task-toggle]');
        if (toggle) {
          const task = items.find((item) => item.id === toggle.dataset.taskToggle);
          if (!task) return;
          const nowDone = task.status !== 'done';
          toggle.classList.toggle('is-done', nowDone);
          toggle.setAttribute('aria-pressed', String(nowDone));
          services.taskService
            .patch(task.id, nowDone ? { status: 'done', progress: 100 } : { status: 'todo' })
            .then(() => {
              task.status = nowDone ? 'done' : 'todo';
              task.progress = nowDone ? 100 : task.progress;
              toast.success(nowDone ? 'تسک بسته شد' : 'تسک باز شد', escapeHtml(task.title));
              paint();
            })
            .catch(() => {
              toggle.classList.toggle('is-done', !nowDone);
              toggle.setAttribute('aria-pressed', String(!nowDone));
              toast.danger('تغییر وضعیت انجام نشد', 'دوباره تلاش کنید.');
            });
          return;
        }
        const edit = event.target.closest('[data-task-edit]') ?? event.target.closest('[data-task-open]');
        if (edit) {
          const id = edit.dataset.taskEdit ?? edit.dataset.taskOpen;
          openRecordForm({ resource: 'tasks', id, fields: crudFields('tasks'), title: 'ویرایش تسک', onSaved: () => paint() });
        }
      });

      on(searchNode, 'input', () => {
        state.term = searchNode.value;
        state.visible = STEP;
        paint();
      });
      on(priorityNode, 'change', () => {
        state.priority = priorityNode.value;
        state.visible = STEP;
        paint();
      });
      on($('[data-create]', node), 'click', () =>
        openRecordForm({ resource: 'tasks', title: isBacklog ? 'افزودن به بک‌لاگ' : 'تسک جدید', fields: crudFields('tasks'), onSaved: () => window.location.reload() }),
      );
      exportable(node, 'tasks');
      return;
    }

    default:
      return;
  }
}

function milestoneList(projectId) {
  return services.milestones
    .list(projectId)
    .then((milestones) => `<ul class="list-group">${milestones.map((milestone) => `<li class="list-item"><span class="status-dot status-dot--${milestone.status === 'done' ? 'success' : milestone.status === 'late' ? 'danger' : 'warning'}"></span><span class="list-item__title">${escapeHtml(milestone.title)}<span class="list-item__sub">موعد: ${formatDate(milestone.dueDate, { format: 'medium' })}</span></span><span class="list-item__meta">${toDigits(milestone.progress ?? 0)}٪</span></li>`).join('')}</ul>`);
}

/* ===================================================================== Support */

async function initSupport() {
  const page = kit.pageId();
  switch (page) {
    case 'support/ticket-details.html': {
      const id = queryParam('id');
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(3)}</div>`);
      const ticket = await loadRecord('tickets', id);
      if (!ticket) {
        render(node, kit.errorState('تیکت مورد نظر پیدا نشد'));
        return;
      }
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: ticket.subject,
            subtitle: `${ticket.number} • ${ticket.customer}`,
            icon: 'life-preserver',
            badges: [statusBadge(ticket.statusLabel ?? ticket.status, ticket.status === 'resolved' ? 'success' : 'warning'), statusBadge(ticket.priorityLabel ?? ticket.priority, 'danger')],
            actions: `<button class="btn btn-light" type="button" data-ticket-escalate><i class="bi bi-exclamation-triangle"></i> ارجاع به سطح بالاتر</button>
              <button class="btn btn-primary" type="button" data-ticket-close><i class="bi bi-check2-circle"></i> بستن تیکت</button>`,
          })}
          <div class="grid grid--sidebar">
            ${card({
              title: 'گفتگو',
              body: `<div class="conversation">${(ticket.messages ?? [])
                .map(
                  (message) => `<article class="msg ${message.author === 'agent' ? 'msg--out' : 'msg--in'}">
                    <span class="msg__avatar"><img class="avatar avatar--sm" src="${escapeHtml(message.avatar ?? 'assets/img/avatars/avatar-08.svg')}" alt=""></span>
                    <div class="msg__body"><header class="msg__meta"><strong>${escapeHtml(message.name ?? 'کاربر')}</strong><time>${relativeTime(message.at)}</time></header>
                    <div class="msg__bubble">${escapeHtml(message.text)}</div></div>
                  </article>`,
                )
                .join('')}</div>
              <form class="form-stack mt-4" data-reply-form>
                <textarea class="form-control" rows="4" name="reply" placeholder="پاسخ خود را بنویسید…" required></textarea>
                <div class="form-actions form-actions--end"><label class="btn btn-light btn-sm"><i class="bi bi-paperclip"></i> پیوست<input type="file" hidden></label><button class="btn btn-primary btn-sm" type="submit" data-submit><i class="bi bi-send"></i> ارسال پاسخ</button></div>
              </form>`,
            })}
            <div class="stack">
              ${card({ title: 'اطلاعات تیکت', body: infoRows([
                ['مشتری', ticket.customer],
                ['دسته', ticket.category],
                ['اولویت', statusBadge(ticket.priorityLabel ?? ticket.priority, 'danger')],
                ['پشتیبان', ticket.agent ?? '—'],
                ['کانال', ticket.channel ?? 'ایمیل'],
                ['ایجاد', formatDate(ticket.createdAt, { format: 'medium' })],
                ['آخرین به‌روزرسانی', relativeTime(ticket.updatedAt ?? ticket.createdAt)],
              ]) })}
              ${card({ title: 'تاریخچه', body: timeline([
                { title: 'تیکت ایجاد شد', time: formatDate(ticket.createdAt, { format: 'medium' }), tone: 'primary', icon: 'envelope-paper' },
                { title: 'به کارشناس تخصیص یافت', text: ticket.agent ?? 'تیم پشتیبانی', time: '۱ ساعت بعد', tone: 'info', icon: 'person-check' },
                { title: 'پاسخ اولیه ارسال شد', time: 'همان روز', tone: 'success', icon: 'reply' },
              ], { compact: true }) })}
            </div>
          </div>
        </div>`,
      );
      on($('[data-reply-form]', node), 'submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const text = $('[name="reply"]', form).value.trim();
        if (!text) {
          toast.warning('متن پاسخ خالی است', 'پاسخ خود را بنویسید.');
          return;
        }
        const button = $('[data-submit]', form);
        button.classList.add('is-loading');
        try {
          await services.ticketActions.reply(ticket.id, text);
          $('.conversation', node)?.insertAdjacentHTML(
            'beforeend',
            `<article class="msg msg--out"><span class="msg__avatar"><img class="avatar avatar--sm" src="assets/img/avatars/avatar-08.svg" alt=""></span>
              <div class="msg__body"><header class="msg__meta"><strong>شما</strong><time>همین حالا</time></header><div class="msg__bubble">${escapeHtml(text)}</div></div></article>`,
          );
          form.reset();
          toast.success('پاسخ ارسال شد', 'مشتری از طریق ایمیل مطلع شد.');
        } finally {
          button.classList.remove('is-loading');
        }
      });
      on($('[data-ticket-escalate]', node), 'click', async () => {
        await services.ticketActions.escalate(ticket.id);
        toast.warning('تیکت ارجاع شد', 'به سطح پشتیبانی دوم منتقل شد.');
      });
      on($('[data-ticket-close]', node), 'click', async () => {
        const ok = await modal.confirm({ title: 'بستن تیکت', text: 'پس از بستن، امکان پاسخ‌دهی وجود ندارد.', tone: 'warning', confirmText: 'بستن تیکت' });
        if (!ok) return;
        await services.ticketActions.close(ticket.id, 5);
        toast.success('تیکت بسته شد', 'نظر‌سنجی برای مشتری ارسال گردید.');
      });
      return;
    }

    case 'support/agents.html': {
      const node = host();
      const [agents, sla, satisfaction] = await Promise.all([
        services.agentService.workload(),
        services.supportStatsService.sla(),
        services.supportStatsService.satisfaction(),
      ]);

      /* ------------------------------------------------------------- derived */
      const buckets = Array.isArray(sla) ? sla : [];
      const totalBuckets = buckets.reduce((sum, bucket) => sum + (bucket.count ?? 0), 0);
      /** SLA compliance = share of tickets answered inside the first two (fastest) buckets. */
      const inSla = (buckets[0]?.count ?? 0) + (buckets[1]?.count ?? 0);
      const compliance = totalBuckets ? Math.round((inSla / totalBuckets) * 100) : 0;
      const peakBucket = Math.max(1, ...buckets.map((bucket) => bucket.count ?? 0));
      const roster = [...agents].sort((a, b) => (b.open ?? 0) - (a.open ?? 0));
      const peakLoad = Math.max(1, ...roster.map((agent) => agent.open ?? 0));
      const online = agents.filter((agent) => ['online', 'busy'].includes(agent.status)).length;
      const openTickets = agents.reduce((sum, agent) => sum + (agent.open ?? 0), 0);
      const avgLoad = agents.length ? (openTickets / agents.length).toFixed(1) : '0';
      const avgCsat = agents.length ? Math.round(agents.reduce((sum, agent) => sum + (agent.csat ?? 0), 0) / agents.length) : 0;
      const breached = agents.reduce((sum, agent) => sum + (agent.breached ?? 0), 0);
      const langCount = new Map();
      agents.forEach((agent) => (agent.languages ?? []).forEach((lang) => langCount.set(lang, (langCount.get(lang) ?? 0) + 1)));
      const statusMeta = {
        online: { label: 'آنلاین', tone: 'success', icon: 'broadcast' },
        busy: { label: 'مشغول', tone: 'warning', icon: 'hourglass-split' },
        away: { label: 'غایب', tone: 'info', icon: 'clock-history' },
        offline: { label: 'آفلاین', tone: 'neutral', icon: 'moon-stars' },
      };
      const toneOf = (agent) => statusMeta[agent.status] ?? statusMeta.offline;
      const loadTone = (load) => (load > peakLoad * 0.75 ? 'bad' : load > peakLoad * 0.45 ? 'warn' : 'good');
      const rating = (value) => Math.max(0, Math.min(5, value ?? 0));

      render(
        node,
        `<div class="dashboard-shell sup">
          ${pageHeader({
            title: 'کارشناسان پشتیبانی',
            subtitle: 'توزیع بار کاری، سرعت پاسخ و کیفیت تجربه مشتری — به تفکیک کارشناس',
            icon: 'headset',
            badges: [
              statusBadge(`${toDigits(online)} نفر در دسترس`, online ? 'success' : 'neutral'),
              statusBadge(`رعایت SLA ${toDigits(compliance)}٪`, compliance >= 80 ? 'success' : compliance >= 60 ? 'warning' : 'danger'),
            ],
            actions: toolButtons({ create: 'کارشناس جدید', exportResource: 'agents' }),
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'تیکت‌های باز', value: toDigits(openTickets), meta: `میانگین ${toDigits(avgLoad)} تیکت برای هر کارشناس`, tone: 'primary', icon: 'inbox', id: 'sup-open' })}
            ${statCard({ label: 'رعایت SLA', value: `${toDigits(compliance)}٪`, meta: breached ? `${toDigits(breached)} تیکت خارج از زمان` : 'بدون تیکت خارج از زمان', tone: compliance >= 80 ? 'success' : 'warning', icon: 'stopwatch', id: 'sup-sla' })}
            ${statCard({ label: 'رضایت مشتری', value: `${toDigits(avgCsat)}٪`, meta: `از ${toDigits(satisfaction.volume ?? 0)} گفت‌وگوی ثبت‌شده`, tone: 'info', icon: 'emoji-smile', id: 'sup-csat' })}
            ${statCard({ label: 'کارشناسان فعال', value: `${toDigits(online)}/${toDigits(agents.length)}`, meta: `${toDigits(langCount.size)} زبان پشتیبانی`, tone: 'success', icon: 'people', id: 'sup-team' })}
          </div>

          <div class="widget-grid sup-grid">
            ${card({
              span: 12,
              className: 'sup-roster-card',
              icon: 'person-badge',
              title: 'ترکیب تیم و بار کاری',
              subtitle: 'کارشناسان بر اساس تعداد تیکت باز مرتب شده‌اند — میله پررنگ‌تر یعنی فشار بیشتر',
              body: `<div class="agent-grid">${roster
                .map((agent) => {
                  const meta = toneOf(agent);
                  const load = Math.round(((agent.open ?? 0) / peakLoad) * 100);
                  const first = (agent.avgResponse ?? '').replace(/[^۰-۹0-9]/g, '');
                  return `<article class="agent-card">
                    <header class="agent-card__head">
                      <span class="agent-card__avatar">
                        <img src="${escapeHtml(agent.avatar)}" alt="">
                        <i class="agent-card__status agent-card__status--${escapeHtml(agent.status)}" title="${escapeHtml(meta.label)}"></i>
                      </span>
                      <div class="agent-card__id">
                        <h3>${escapeHtml(agent.name)}</h3>
                        <p>${escapeHtml(agent.team ?? 'کارشناس پشتیبانی')}</p>
                      </div>
                      <span class="badge badge--soft-${escapeHtml(meta.tone)}"><i class="bi bi-${escapeHtml(meta.icon)}"></i> ${escapeHtml(meta.label)}</span>
                    </header>
                    <div class="agent-card__load">
                      <span class="agent-card__load-label">بار کاری</span>
                      <span class="agent-card__load-bar agent-card__load-bar--${loadTone(agent.open ?? 0)}"><i style="--w:${load}%"></i></span>
                      <b class="numeric">${toDigits(agent.open ?? 0)} تیکت باز</b>
                    </div>
                    <ul class="agent-card__stats">
                      <li><i class="bi bi-check2-circle" aria-hidden="true"></i><span>حل‌شده</span><b class="numeric">${toDigits(agent.resolved ?? 0)}</b></li>
                      <li><i class="bi bi-stopwatch" aria-hidden="true"></i><span>میانگین پاسخ</span><b class="numeric">${escapeHtml(first || '—')} دقیقه</b></li>
                      <li><i class="bi bi-star-fill" aria-hidden="true"></i><span>امتیاز رضایت</span><b class="numeric">${toDigits(rating(agent.satisfaction).toFixed(1))} از ۵</b></li>
                      <li><i class="bi bi-speedometer" aria-hidden="true"></i><span>نرخ حل</span><b class="numeric">${toDigits(agent.csat ?? 0)}٪</b></li>
                    </ul>
                    <footer class="agent-card__foot">
                      <span class="agent-card__langs">${(agent.languages ?? []).map((lang) => `<span class="agent-lang">${escapeHtml(lang)}</span>`).join('')}</span>
                      ${agent.breached ? `<span class="agent-card__breach" title="تیکت خارج از SLA"><i class="bi bi-exclamation-triangle"></i> ${toDigits(agent.breached)}</span>` : '<span class="agent-card__ok"><i class="bi bi-shield-check"></i> در محدوده SLA</span>'}
                    </footer>
                  </article>`;
                })
                .join('')}</div>`,
            })}

            <div class="grid grid--cards sup-side">
              ${card({
                icon: 'speedometer2',
                title: 'توزیع زمان پاسخ اولیه',
                subtitle: `${toDigits(totalBuckets)} تیکت در ${toDigits(buckets.length)} بازه پاسخ`,
                body: buckets.length
                  ? `<ul class="sup-sla">
                      ${buckets
                        .map((bucket, index) => {
                          const share = totalBuckets ? Math.round(((bucket.count ?? 0) / totalBuckets) * 100) : 0;
                          const tone = index < 2 ? 'good' : index === 2 ? 'warn' : 'bad';
                          return `<li class="sup-sla__row">
                            <span class="sup-sla__label">${escapeHtml(bucket.label)}<small>${toDigits(share)}٪ از کل</small></span>
                            <span class="sup-sla__bar sup-sla__bar--${tone}"><i style="--w:${Math.round(((bucket.count ?? 0) / peakBucket) * 100)}%"></i></span>
                            <b class="numeric">${toDigits(bucket.count ?? 0)}</b>
                          </li>`;
                        })
                        .join('')}
                      <li class="sup-sla__foot"><i class="bi bi-shield-check"></i> ${toDigits(compliance)}٪ تیکت‌ها زیر ۴ ساعت پاسخ گرفته‌اند</li>
                    </ul>`
                  : emptyState({ title: 'داده‌ای برای SLA نیست', text: 'تیکتی در این دوره ثبت نشده است.', icon: 'stopwatch' }),
              })}
              ${card({
                icon: 'emoji-heart-eyes',
                title: 'کیفیت در یک نگاه',
                subtitle: `${toDigits(satisfaction.reopened ?? 0)} بازگشایی مجدد در دوره`,
                body: `<div class="sup-quality">
                  <div class="sup-quality__ring" style="--value:${Math.min(100, avgCsat)}">
                    <b class="numeric">${toDigits(avgCsat)}٪</b>
                    <small>رضایت</small>
                  </div>
                  <ul class="sup-quality__list">
                    <li><span>حجم گفت‌وگو</span><b class="numeric">${toDigits(satisfaction.volume ?? 0)}</b></li>
                    <li><span>بازگشایی مجدد</span><b class="numeric">${toDigits(satisfaction.reopened ?? 0)}</b></li>
                    <li><span>خارج از SLA</span><b class="numeric ${breached ? 'text-danger' : 'text-success'}">${toDigits(breached)}</b></li>
                    <li><span>زبان‌های پوشش‌داده‌شده</span><b class="numeric">${toDigits(langCount.size)}</b></li>
                  </ul>
                </div>`,
              })}
            </div>
          </div>
        </div>`,
      );
      exportable(node, 'agents');
      return;
    }

    case 'support/knowledge-base.html': {
      const node = host();
      const [topics, articles, satisfaction] = await Promise.all([services.knowledgeBaseService.list(), services.knowledgeBaseService.articles(), services.supportStatsService.satisfaction()]);
      const tones = ['primary', 'violet', 'success', 'info', 'warning', 'danger'];
      const topicOf = (id) => topics.find((t) => t.id === id) ?? {};
      const totalArticles = topics.reduce((sum, t) => sum + (t.articles ?? 0), 0);
      const totalViews = topics.reduce((sum, t) => sum + (t.views ?? 0), 0);
      const articleRow = (a) => {
        const t = topicOf(a.topic);
        return `<a class="kb-article" href="#" data-article="${escapeHtml(a.id)}" data-topic="${escapeHtml(a.topic)}">
          <span class="ais-name__icon ais-tone--${tones[topics.indexOf(t) % tones.length]}"><i class="bi bi-${escapeHtml(t.icon ?? 'journal-text')}"></i></span>
          <span class="kb-article__body"><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.excerpt)}</small></span>
          <span class="kb-article__meta"><span><i class="bi bi-clock"></i> ${toDigits(a.minutes)} دقیقه</span><span><i class="bi bi-eye"></i> ${formatNumber(a.views)}</span><span><i class="bi bi-hand-thumbs-up"></i> ${toDigits(a.helpful)}</span></span>
        </a>`;
      };
      render(
        node,
        `<div class="ais">
          <section class="kb-hero">
            <span class="ais-hero__eyebrow"><i class="bi bi-book"></i> مرکز راهنما</span>
            <h2>چطور می‌توانیم کمکتان کنیم؟</h2>
            <p>${toDigits(totalArticles)} مقاله در ${toDigits(topics.length)} دسته — پاسخ بیشتر سؤال‌ها همین‌جاست.</p>
            <label class="kb-search"><i class="bi bi-search"></i><input type="search" placeholder="مثلاً: اتصال درگاه پرداخت، وب‌هوک، نقش‌ها…" data-kb-search aria-label="جستجو در پایگاه دانش"><kbd>Enter</kbd></label>
            <div class="kb-popular">جستجوهای پرتکرار: ${['درگاه پرداخت', 'API', 'نقش‌ها', 'فاکتور'].map((t) => `<button type="button" data-kb-term="${t}">${t}</button>`).join('')}</div>
          </section>
          <div class="ais-kpis">
            <article class="ais-kpi ais-kpi--primary"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-journal-bookmark"></i></span><span class="ais-kpi__label">مقاله‌ها</span></div><p class="ais-kpi__value">${toDigits(totalArticles)}</p><div class="ais-kpi__meta">${toDigits(topics.length)} دسته‌بندی</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--info"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-eye"></i></span><span class="ais-kpi__label">بازدید کل</span></div><p class="ais-kpi__value">${formatNumber(totalViews)}</p><div class="ais-kpi__meta">۳۰ روز اخیر</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--success"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-emoji-smile"></i></span><span class="ais-kpi__label">رضایت از مقالات</span></div><p class="ais-kpi__value">${formatNumber(satisfaction.csat, { decimals: 1 })}٪</p><div class="ais-kpi__meta">بر اساس رأی کاربران</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--warning"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-life-preserver"></i></span><span class="ais-kpi__label">تیکت‌های کاهش‌یافته</span></div><p class="ais-kpi__value">${formatNumber(Math.round(satisfaction.volume * 0.34))}</p><div class="ais-kpi__meta">حل‌شده با سلف‌سرویس</div><div style="height:10px"></div></article>
          </div>
          <div class="kb-topics">${topics
            .map(
              (t, i) => `<button type="button" class="kb-topic ais-tone--${tones[i % tones.length]}" data-kb-topic="${escapeHtml(t.id)}">
                <span class="kb-topic__icon"><i class="bi bi-${escapeHtml(t.icon ?? 'journal')}"></i></span>
                <strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.category)}</small>
                <span class="kb-topic__meta"><span>${toDigits(t.articles)} مقاله</span><span>${formatNumber(t.views)} بازدید</span></span>
              </button>`,
            )
            .join('')}</div>
          <div class="ais-grid">
            <section data-col="8" class="card">
              <header class="card__head"><span class="card__icon"><i class="bi bi-journal-text"></i></span><div><h2 class="card__title" data-kb-heading>همه مقاله‌ها</h2><p class="card__subtitle"><span data-kb-count>${toDigits(articles.length)}</span> مقاله</p></div>
                <div class="card__actions"><button type="button" class="btn btn-light btn-sm" data-kb-reset hidden><i class="bi bi-x-lg"></i> حذف فیلتر</button><button type="button" class="btn btn-primary btn-sm" data-create><i class="bi bi-plus-lg"></i> مقاله جدید</button></div></header>
              <div class="card__body card__body--flush" data-kb-list>${articles.map(articleRow).join('')}</div>
            </section>
            <div data-col="4" class="d-flex flex-column" style="gap:var(--nv-card-gap,1.25rem)">
              ${card({ title: 'سهم بازدید دسته‌ها', icon: 'pie-chart', body: '<div class="chart" data-chart-owner="controller" data-kb-chart="share" style="min-height:260px"></div>' })}
              ${card({ title: 'رضایت ماهانه', icon: 'graph-up', body: '<div class="chart" data-chart-owner="controller" data-kb-chart="csat" style="min-height:200px"></div>' })}
              <section class="card kb-contact"><div class="card__body"><span class="kb-topic__icon ais-tone--primary"><i class="bi bi-headset"></i></span><h3>پاسخ خود را پیدا نکردید؟</h3><p>کارشناسان ما به‌طور میانگین در ۱۲ دقیقه پاسخ می‌دهند.</p><a class="btn btn-primary w-100" href="support/tickets.html"><i class="bi bi-chat-dots"></i> ثبت تیکت پشتیبانی</a></div></section>
            </div>
          </div>
        </div>`,
      );
      const byViews = [...topics].sort((a, b) => b.views - a.views);
      await Promise.all([
        chart($('[data-kb-chart="share"]', node), { type: 'donut', height: 260, series: byViews.map((t) => t.views), labels: byViews.map((t) => t.category) }),
        chart($('[data-kb-chart="csat"]', node), { type: 'area', height: 200, series: [{ name: 'رضایت ٪', data: satisfaction.series.map((r) => r.csat) }], labels: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'], colors: ['#10b981'] }),
      ]);

      const list = $('[data-kb-list]', node);
      const show = (items, heading) => {
        $('[data-kb-heading]', node).textContent = heading;
        $('[data-kb-count]', node).textContent = toDigits(items.length);
        $('[data-kb-reset]', node).hidden = items.length === articles.length;
        render(list, items.length ? items.map(articleRow).join('') : emptyState({ title: 'مقاله‌ای پیدا نشد', text: 'عبارت کوتاه‌تر یا نام دسته‌بندی را امتحان کنید.', icon: 'search' }));
      };
      let timer = null;
      on($('[data-kb-search]', node), 'input', (event) => {
        window.clearTimeout(timer);
        const term = event.target.value.trim();
        timer = window.setTimeout(async () => {
          if (!term) return show(articles, 'همه مقاله‌ها');
          const found = await services.knowledgeBaseService.search(term);
          show(found, `نتایج «${term}»`);
        }, 180);
      });
      on(node, 'click', async (event) => {
        const term = event.target.closest('[data-kb-term]');
        if (term) {
          const input = $('[data-kb-search]', node);
          input.value = term.dataset.kbTerm;
          input.dispatchEvent(new Event('input'));
          return;
        }
        const topic = event.target.closest('[data-kb-topic]');
        if (topic) {
          $$('[data-kb-topic]', node).forEach((t) => t.classList.toggle('is-active', t === topic));
          const t = topicOf(topic.dataset.kbTopic);
          show(articles.filter((a) => a.topic === t.id), t.title);
          list.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (event.target.closest('[data-kb-reset]')) {
          $$('[data-kb-topic]', node).forEach((t) => t.classList.remove('is-active'));
          $('[data-kb-search]', node).value = '';
          return show(articles, 'همه مقاله‌ها');
        }
        const article = event.target.closest('[data-article]');
        if (article) {
          event.preventDefault();
          const a = articles.find((x) => x.id === article.dataset.article);
          const t = topicOf(a.topic);
          modal.open({
            title: a.title,
            subtitle: `${t.title} • ${toDigits(a.minutes)} دقیقه مطالعه`,
            size: 'lg',
            content: `<div class="kb-read"><p class="lead">${escapeHtml(a.excerpt)}</p>
              <h4>گام ۱ — آماده‌سازی</h4><p>ابتدا از بخش تنظیمات، دسترسی‌های لازم را بررسی کنید و مطمئن شوید نقش شما مجوز ویرایش این بخش را دارد.</p>
              <h4>گام ۲ — پیکربندی</h4><p>مقادیر مورد نیاز را وارد کرده و با دکمه «آزمایش» صحت اتصال را بسنجید. در صورت خطا، پیام راهنما مسیر رفع مشکل را نشان می‌دهد.</p>
              <pre class="ais-code">npm install\nnpm run dev</pre>
              <h4>گام ۳ — بررسی نتیجه</h4><p>تغییرات بلافاصله اعمال می‌شوند و در گزارش فعالیت‌ها ثبت خواهند شد.</p>
              <div class="ais-alert ais-alert--info mt-3"><i class="bi bi-lightbulb"></i><div><strong>نکته</strong><p>برای محیط تولید، همیشه ابتدا تغییرات را در محیط آزمایشی امتحان کنید.</p></div></div></div>`,
            footer: '<span class="me-auto text-muted fs-caption">این مقاله مفید بود؟</span><button type="button" class="btn btn-light" data-modal-close><i class="bi bi-hand-thumbs-down"></i></button><button type="button" class="btn btn-soft-primary" data-modal-close><i class="bi bi-hand-thumbs-up"></i> بله</button>',
          });
          return;
        }
        if (event.target.closest('[data-create]')) {
          openRecordForm({
            resource: 'kb',
            title: 'مقاله جدید',
            fields: [
              { name: 'title', label: 'عنوان', required: true },
              { name: 'topic', label: 'دسته‌بندی', type: 'select', options: topics.map((t) => ({ value: t.id, label: t.title })) },
              { name: 'excerpt', label: 'خلاصه', type: 'textarea', col: 2, rows: 3 },
            ],
            onSaved: (saved) => {
              const item = { id: `art-${Date.now()}`, topic: saved?.topic ?? topics[0].id, title: saved?.title ?? 'مقاله جدید', excerpt: saved?.excerpt ?? '', minutes: 3, views: 0, helpful: 0 };
              articles.unshift(item);
              show(articles, 'همه مقاله‌ها');
            },
          });
        }
      });
      return;
    }

    default:
      return;
  }
}

const kbCards = (topics) =>
  topics
    .map(
      (article) => `<article class="card card--interactive"><div class="card__body"><span class="badge badge--soft-primary">${escapeHtml(article.category ?? 'عمومی')}</span>
        <h3 class="card__title mt-2">${escapeHtml(article.title ?? article.name)}</h3>
        <p class="card__subtitle">${escapeHtml(article.excerpt ?? article.text ?? '')}</p>
        <div class="list-item__meta"><span><i class="bi bi-eye"></i> ${toDigits(article.views ?? 0)}</span><span><i class="bi bi-hand-thumbs-up"></i> ${toDigits(article.helpful ?? 0)}</span></div></div></article>`,
    )
    .join('');

/* ========================================================================== HR */

async function initHr() {
  const page = kit.pageId();
  switch (page) {
    case 'hr/attendance.html': {
      const node = host();
      const [today, monthly] = await Promise.all([services.attendanceService.today(), services.attendanceService.monthly()]);
      const rows = asRows(today);
      const summary = today?.summary ?? {};
      const count = (status) => summary[status] ?? rows.filter((row) => row.status === status).length;
      const series = monthly?.series ?? [];
      const TONE = { present: 'success', remote: 'info', late: 'warning', absent: 'danger' };
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'حضور و غیاب', subtitle: 'وضعیت امروز و روند ۳۰ روز اخیر', icon: 'clock-history', actions: '<button class="btn btn-light" type="button" data-check-in><i class="bi bi-box-arrow-in-right"></i> ثبت ورود</button><button class="btn btn-primary" type="button" data-check-out><i class="bi bi-box-arrow-right"></i> ثبت خروج</button>' })}
          ${statsFrom({ present: count('present'), remote: count('remote'), late: count('late'), absent: count('absent') }, [
            ['present', 'حاضر', 'number', 'success', 'person-check'],
            ['remote', 'دورکاری', 'number', 'info', 'house'],
            ['late', 'تأخیر', 'number', 'warning', 'alarm'],
            ['absent', 'غایب', 'number', 'danger', 'person-x'],
          ])}
          ${card({ title: 'روند حضور ۳۰ روز اخیر', subtitle: `میانگین کارکرد امروز ${toDigits(summary.averageHours ?? 0)} ساعت`, body: `<div class="chart" data-chart="column" data-chart-height="320" data-chart-series='${escapeHtml(JSON.stringify([
            { name: 'حاضر', data: series.map((d) => d.present) },
            { name: 'دورکاری', data: series.map((d) => d.remote) },
            { name: 'تأخیر', data: series.map((d) => d.late) },
            { name: 'غایب', data: series.map((d) => d.absent) },
          ]))}' data-chart-labels='${escapeHtml(JSON.stringify(series.map((d, index) => toDigits(index + 1))))}'></div>` })}
          ${card({ title: 'فهرست امروز', subtitle: `${toDigits(rows.length)} نفر`, flush: true, body: `<table class="table table--hover"><thead><tr><th>کارمند</th><th>دپارتمان</th><th>ورود</th><th>خروج</th><th>کارکرد</th><th>وضعیت</th></tr></thead><tbody>${rows
            .map(
              (row) => `<tr><td><div class="table__primary"><img class="avatar avatar--sm" src="${escapeHtml(url(row.avatar ?? 'assets/img/avatars/avatar-01.svg'))}" alt=""><span class="table__primary-title">${escapeHtml(row.employee ?? row.name ?? '—')}</span></div></td>
              <td>${escapeHtml(row.department ?? '—')}</td>
              <td class="numeric">${toDigits(row.checkIn ?? '—')}</td><td class="numeric">${row.checkOut ? toDigits(row.checkOut) : '<span class="text-muted">در محل کار</span>'}</td><td class="numeric">${toDigits(row.workedHours ?? row.hours ?? 0)} ساعت</td>
              <td>${statusBadge(statusLabel(row.status ?? 'present'), TONE[row.status] ?? 'success')}</td></tr>`,
            )
            .join('')}</tbody></table>` })}
        </div>`,
      );
      initCharts(node);
      const clock = () => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
      on($('[data-check-in]', node), 'click', async () => {
        await services.attendanceService.checkIn();
        toast.success('ورود ثبت شد', `ساعت ${clock()} ثبت گردید.`);
      });
      on($('[data-check-out]', node), 'click', async () => {
        const result = await services.attendanceService.checkOut();
        toast.success('خروج ثبت شد', `ساعت ${clock()} — مجموع کارکرد امروز: ${toDigits(result.hours ?? 0)} ساعت`);
      });
      return;
    }

    case 'hr/leave.html': {
      const node = host();
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'مدیریت مرخصی‌ها', subtitle: 'تأیید یا رد درخواست‌ها با ثبت تاریخچه', icon: 'calendar-check', actions: toolButtons({ exportResource: 'leave' }) })}
          <div class="card"><div class="card__head"><div><h2 class="card__title">درخواست‌های در انتظار</h2><p class="card__subtitle">تأیید و رد بلافاصله در فهرست اعمال می‌شود</p></div></div>
            <div class="card__body" data-leave-list>${kit.skeleton(3)}</div></div>
        </div>`,
      );
      await renderLeaveRequests();
      exportable(node, 'leave');
      return;
    }

    case 'hr/payroll.html': {
      const node = host();
      const payroll = await services.payrollService.list();
      const items = asRows(payroll);
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'حقوق و دستمزد', subtitle: 'محاسبه، بازبینی و پرداخت فیش‌های ماهانه', icon: 'cash-stack', actions: toolButtons({ exportResource: 'payroll' }) })}
          ${statsFrom({ total: items.reduce((sum, row) => sum + (row.net ?? 0), 0), paid: items.filter((row) => row.status === 'paid').length, pending: items.filter((row) => row.status !== 'paid').length, employees: items.length }, [
            ['total', 'مجموع پرداختی', 'currency', 'primary', 'wallet2'],
            ['paid', 'پرداخت‌شده', 'number', 'success', 'check2-circle'],
            ['pending', 'در انتظار', 'number', 'warning', 'hourglass'],
            ['employees', 'کارکنان', 'number', 'info', 'people'],
          ])}
          ${card({ title: 'فهرست حقوق', flush: true, body: `<table class="table table--hover"><thead><tr><th>کارمند</th><th>پایه</th><th>مزایا</th><th>کسورات</th><th>خالص</th><th>وضعیت</th><th></th></tr></thead><tbody>${items
            .map(
              (row) => `<tr><td><div class="table__primary"><img class="avatar avatar--sm" src="${escapeHtml(row.avatar ?? 'assets/img/avatars/avatar-01.svg')}" alt=""><span class="table__primary-title">${escapeHtml(row.employee ?? row.name)}</span></div></td>
              <td class="numeric">${formatCurrency(row.base ?? 0, 'IRR', { compact: true })}</td>
              <td class="numeric">${formatCurrency(row.benefits ?? 0, 'IRR', { compact: true })}</td>
              <td class="numeric text-danger">${formatCurrency(row.deductions ?? 0, 'IRR', { compact: true })}</td>
              <td class="numeric"><strong>${formatCurrency(row.net ?? 0, 'IRR', { compact: true })}</strong></td>
              <td>${statusBadge(row.statusLabel ?? row.status, row.status === 'paid' ? 'success' : 'warning')}</td>
              <td><button class="btn btn-light btn-sm" type="button" data-payslip="${escapeHtml(row.id)}">فیش</button>${row.status === 'paid' ? '' : `<button class="btn btn-primary btn-sm" type="button" data-pay="${escapeHtml(row.id)}">پرداخت</button>`}</td></tr>`,
            )
            .join('')}</tbody></table>` })}
        </div>`,
      );
      on(node, 'click', async (event) => {
        const pay = event.target.closest('[data-pay]');
        if (pay) {
          const ok = await modal.confirm({ title: 'ثبت پرداخت حقوق', text: 'مبلغ خالص به حساب کارمند واریز می‌شود.', tone: 'primary', confirmText: 'پرداخت کن' });
          if (!ok) return;
          await services.payrollService.pay(pay.dataset.pay);
          pay.closest('tr').querySelector('td:nth-child(6)').innerHTML = statusBadge('پرداخت‌شده', 'success');
          pay.remove();
          toast.success('پرداخت انجام شد', 'رسید پرداخت در سامانه ثبت شد.');
          return;
        }
        const payslip = event.target.closest('[data-payslip]');
        if (payslip) {
          const slip = await services.payrollService.payslip(payslip.dataset.payslip);
          modal.open({
            title: 'فیش حقوقی',
            size: 'md',
            content: `<div class="invoice-doc">${infoRows([
              ['کارمند', slip.employee ?? '—'],
              ['دوره', slip.period ?? '—'],
              ['پایه', formatCurrency(slip.base ?? 0, 'IRR')],
              ['مزایا', formatCurrency(slip.benefits ?? 0, 'IRR')],
              ['کسورات', formatCurrency(slip.deductions ?? 0, 'IRR')],
              ['خالص پرداختی', `<strong>${formatCurrency(slip.net ?? 0, 'IRR')}</strong>`],
            ])}</div>`,
            footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button><button type="button" class="btn btn-primary" data-print><i class="bi bi-printer"></i> چاپ</button>',
            onMount: (panel) => on($('[data-print]', panel), 'click', () => window.print()),
          });
        }
      });
      exportable(node, 'payroll');
      return;
    }

    case 'hr/recruitment.html': {
      const node = host();
      const [jobsPayload, candidatesPayload] = await Promise.all([services.recruitmentService.jobs(), services.recruitmentService.candidates()]);
      const jobs = asRows(jobsPayload);
      const candidates = asRows(candidatesPayload);
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'جذب و استخدام', subtitle: 'موقعیت‌های باز و مراحل ارزیابی داوطلبان', icon: 'person-plus', actions: toolButtons({ create: 'موقعیت شغلی' }) })}
          <div class="grid grid--cards">${jobs
            .map((job) => `<article class="card"><div class="card__body"><span class="badge badge--soft-primary">${escapeHtml(job.department ?? '')}</span>
              <h3 class="card__title mt-2">${escapeHtml(job.title)}</h3><p class="card__subtitle">${escapeHtml(job.location ?? 'تهران')} • ${escapeHtml(job.type ?? 'تمام‌وقت')}</p>
              ${infoRows([['داوطلبان', toDigits(job.applicants ?? 0)], ['مرحله', escapeHtml(job.stage ?? 'غربالگری')]])}
              <div class="progress progress--sm mt-2"><div class="progress-bar" style="width:${Math.min(100, job.progress ?? 40)}%"></div></div></div></article>`,
            )
            .join('')}</div>
          ${card({ title: 'داوطلبان', flush: true, body: `<table class="table table--hover"><thead><tr><th>داوطلب</th><th>موقعیت</th><th>مرحله</th><th>امتیاز</th><th></th></tr></thead><tbody>${candidates
            .map(
              (candidate) => `<tr><td><div class="table__primary"><img class="avatar avatar--sm" src="${escapeHtml(candidate.avatar ?? 'assets/img/avatars/avatar-05.svg')}" alt=""><div class="table__primary-text"><span class="table__primary-title">${escapeHtml(candidate.name)}</span><span class="table__primary-sub">${escapeHtml(candidate.email ?? '')}</span></div></div></td>
              <td>${escapeHtml(candidate.job ?? '')}</td><td>${statusBadge(candidate.stageLabel ?? candidate.stage, 'primary')}</td><td class="numeric">${toDigits(candidate.score ?? 0)}</td>
              <td><button class="btn btn-light btn-sm" type="button" data-advance="${escapeHtml(candidate.id)}">مرحله بعد</button></td></tr>`,
            )
            .join('')}</tbody></table>` })}
        </div>`,
      );
      on(node, 'click', async (event) => {
        const advance = event.target.closest('[data-advance]');
        if (!advance) return;
        const result = await services.recruitmentService.advance(advance.dataset.advance);
        toast.success('مرحله به‌روزرسانی شد', `مرحله جدید: ${result.stageLabel ?? result.stage ?? 'مرحله بعد'}`);
        advance.closest('tr').querySelector('td:nth-child(3)').innerHTML = statusBadge(result.stageLabel ?? 'مرحله بعد', 'primary');
      });
      return;
    }

    case 'hr/employee-profile.html': {
      const id = queryParam('id');
      const node = host();
      const employee = (await loadRecord('employees', id)) ?? (await services.employeeService.list({ perPage: 1 })).items[0];
      const skills = employee.skills?.length ? employee.skills : ['React', 'Node.js', 'Docker', 'TypeScript', 'مدیریت پروژه'];
      const perfScore = Number(employee.performance || 4.7).toFixed(1);
      const leaveDays = employee.leaveBalance ?? 16;
      const attRate = employee.attendanceRate ?? 97.2;

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: `پروفایل پرسنلی: ${escapeHtml(employee.name)}`,
            subtitle: `${escapeHtml(employee.position ?? 'کارشناس ارشد')} • دپارتمان ${escapeHtml(employee.department ?? 'فناوری اطلاعات')}`,
            icon: 'person-vcard',
            actions: `<div class="d-flex gap-2">
              <a class="btn btn-light" href="hr/employees.html"><i class="bi bi-arrow-right me-1"></i>فهرست کارکنان</a>
              <button class="btn btn-primary" type="button" data-message><i class="bi bi-chat-dots me-1"></i>ارسال پیام مستقیم</button>
            </div>`
          })}

          <!-- Employee hero (v1.1): the cover is decoration only; identity sits
               on the card body so the name can never overlap the gradient. -->
          <section class="card emp-hero mb-4" aria-label="${escapeHtml(employee.name)}">
            <div class="emp-hero__cover" aria-hidden="true">
              <span class="emp-hero__office"><i class="bi bi-building"></i> دفتر مرکزی نووا</span>
            </div>
            <div class="emp-hero__body">
              <div class="emp-hero__avatar">
                <img src="${escapeHtml(employee.avatar)}" alt="" width="112" height="112">
                <span class="emp-hero__presence" title="حاضر در محل کار"><span class="visually-hidden">حاضر در محل کار</span></span>
              </div>
              <div class="emp-hero__identity">
                <h2 class="emp-hero__name">${escapeHtml(employee.name)}</h2>
                <p class="emp-hero__role">${escapeHtml(employee.position ?? 'متخصص توسعه نرم‌افزار')}</p>
                <div class="emp-hero__badges">
                  <span class="badge badge--soft-primary" dir="ltr">${escapeHtml(employee.code || 'EMP-1024')}</span>
                  <span class="badge badge--soft-${employee.status === 'active' ? 'success' : 'warning'}">${employee.status === 'active' ? 'مشغول به کار' : 'در مرخصی'}</span>
                </div>
              </div>
              <div class="emp-hero__actions">
                <button class="btn btn-sm btn-outline-primary" type="button" data-award-btn><i class="bi bi-award" aria-hidden="true"></i> ثبت تشویقی / ارتقا</button>
                <button class="btn btn-sm btn-light" type="button" data-export-profile><i class="bi bi-printer" aria-hidden="true"></i> حکم کارگزینی</button>
              </div>
            </div>
            <ul class="emp-hero__facts">
              <li><i class="bi bi-diagram-3" aria-hidden="true"></i><span><small>دپارتمان</small><b>${escapeHtml(employee.department ?? 'فناوری اطلاعات')}</b></span></li>
              <li><i class="bi bi-geo-alt" aria-hidden="true"></i><span><small>محل کار</small><b>${escapeHtml(employee.city ?? 'تهران')}</b></span></li>
              <li><i class="bi bi-envelope" aria-hidden="true"></i><span><small>ایمیل سازمانی</small><b dir="ltr">${escapeHtml(employee.email ?? 'staff@novaadmin.dev')}</b></span></li>
              <li><i class="bi bi-calendar-check" aria-hidden="true"></i><span><small>تاریخ استخدام</small><b>${escapeHtml(employee.hiredAt || employee.joinedAt ? formatDate(employee.hiredAt || employee.joinedAt, { format: 'long' }) : '۱۲ مهر ۱۴۰۱')}</b></span></li>
            </ul>
          </section>

          <!-- KPI Metric Strip -->
          <div class="stat-grid mb-4">
            <article class="stat-card stat-card--primary">
              <span class="stat-card__icon"><i class="bi bi-star-fill text-warning"></i></span>
              <p class="stat-card__label">امتیاز عملکرد ۳۶۰ درجه</p>
              <p class="stat-card__value numeric">${toDigits(perfScore)} <small class="fs-6 text-muted">از ۵٫۰</small></p>
              <p class="stat-card__meta text-success"><i class="bi bi-patch-check-fill me-1"></i>سطح عملکرد: عالی و فراتر از انتظار</p>
            </article>

            <article class="stat-card stat-card--success">
              <span class="stat-card__icon"><i class="bi bi-calendar2-check"></i></span>
              <p class="stat-card__label">مرخصی استحقاقی باقی‌مانده</p>
              <p class="stat-card__value numeric">${toDigits(leaveDays)} <small class="fs-6 text-muted">روز کاری</small></p>
              <p class="stat-card__meta text-muted">از مجموع ۲۶ روز سهمیه سالانه</p>
            </article>

            <article class="stat-card stat-card--info">
              <span class="stat-card__icon"><i class="bi bi-clock-history"></i></span>
              <p class="stat-card__label">نرخ انضباط و حضور کاری</p>
              <p class="stat-card__value numeric">${toDigits(attRate)}٪</p>
              <p class="stat-card__meta text-info"><i class="bi bi-shield-check me-1"></i>ثبت دقیق با تردد بیومتریک</p>
            </article>

            <article class="stat-card stat-card--warning">
              <span class="stat-card__icon"><i class="bi bi-cash-stack"></i></span>
              <p class="stat-card__label">حقوق و مزایای ناخالص</p>
              <p class="stat-card__value numeric">${formatCurrency(employee.salary || 345000000, 'IRR')}</p>
              <p class="stat-card__meta text-success"><i class="bi bi-plus-circle me-1"></i>پاداش عملکرد: ${formatCurrency(employee.bonus || 12000000, 'IRR')}</p>
            </article>
          </div>

          <!-- Tabbed Profile Navigation -->
          <div class="card">
            <div class="card__head p-2 px-3 border-bottom">
              <ul class="nav nav-pills gap-1" data-profile-tabs role="tablist">
                <li class="nav-item">
                  <button class="nav-link active btn-sm" type="button" data-tab-target="overview"><i class="bi bi-person-lines-fill me-1"></i>اطلاعات فردی و قرارداد</button>
                </li>
                <li class="nav-item">
                  <button class="nav-link btn-sm" type="button" data-tab-target="timeline"><i class="bi bi-bezier2 me-1"></i>مسیر شغلی و سوابق ارتقا</button>
                </li>
                <li class="nav-item">
                  <button class="nav-link btn-sm" type="button" data-tab-target="payroll"><i class="bi bi-receipt me-1"></i>فیش حقوق و مزایا</button>
                </li>
                <li class="nav-item">
                  <button class="nav-link btn-sm" type="button" data-tab-target="attendance"><i class="bi bi-calendar3 me-1"></i>تردد و مرخصی‌ها</button>
                </li>
              </ul>
            </div>

            <div class="card__body p-4">
              <!-- Tab 1: Overview & Contract -->
              <div data-tab-panel="overview">
                <div class="row g-4">
                  <div class="col-lg-7">
                    <h5 class="fw-bold fs-6 mb-3"><i class="bi bi-info-circle text-primary me-1"></i> مشخصات سازمانی و اطلاعات تماس</h5>
                    <div class="table-wrap">
                      <table class="table table-borderless table-sm mb-0">
                        <tbody>
                          <tr><th style="width: 35%; color: var(--nv-text-muted);">کد پرسنلی:</th><td class="fw-bold font-monospace">${escapeHtml(employee.code || 'EMP-1024')}</td></tr>
                          <tr><th style="color: var(--nv-text-muted);">دپارتمان سازمانی:</th><td class="fw-semibold">${escapeHtml(employee.department ?? 'فناوری اطلاعات')}</td></tr>
                          <tr><th style="color: var(--nv-text-muted);">تیم تخصصی:</th><td>${escapeHtml(employee.team ?? 'تیم توسعه محصول اصلی')}</td></tr>
                          <tr><th style="color: var(--nv-text-muted);">مدیر مستقیم (سرپرست):</th><td class="fw-semibold">${escapeHtml(employee.manager ?? 'مهندس حسینی')}</td></tr>
                          <tr><th style="color: var(--nv-text-muted);">تاریخ استخدام رسمی:</th><td class="numeric">${formatDate(employee.hiredAt, { format: 'long' })}</td></tr>
                          <tr><th style="color: var(--nv-text-muted);">نوع همکاری:</th><td><span class="badge badge--soft-primary">${escapeHtml(employee.type ?? 'تمام‌وقت')}</span> ${employee.remote ? '<span class="badge badge--soft-info ms-1">دورکاری</span>' : ''}</td></tr>
                          <tr><th style="color: var(--nv-text-muted);">پست الکترونیکی سازمانی:</th><td><a href="mailto:${escapeHtml(employee.email)}" class="text-primary">${escapeHtml(employee.email)}</a></td></tr>
                          <tr><th style="color: var(--nv-text-muted);">شماره تماس همراه:</th><td><span class="text-ltr numeric" dir="ltr">${escapeHtml(employee.phone ?? '۰۹۱۲۳۴۵۶۷۸۹')}</span></td></tr>
                          <tr><th style="color: var(--nv-text-muted);">محل خدمت و سکونت:</th><td>${escapeHtml(employee.city ?? 'تهران')}، دفتر مرکزی</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div class="mt-4 pt-3 border-top">
                      <h6 class="fw-bold small mb-2"><i class="bi bi-tools text-primary me-1"></i> مهارت‌های تخصصی و فنی:</h6>
                      <div class="d-flex flex-wrap gap-2">
                        ${skills.map((s) => `<span class="badge bg-surface-2 text-heading border px-3 py-2 rounded-pill"><i class="bi bi-check2 text-success me-1"></i>${escapeHtml(s)}</span>`).join('')}
                      </div>
                    </div>
                  </div>

                  <div class="col-lg-5">
                    <div class="p-3 rounded-3 border" style="background: var(--nv-surface-2);">
                      <h6 class="fw-bold small mb-3"><i class="bi bi-shield-check text-primary me-1"></i> جزئیات بیمه و قرارداد کار</h6>
                      <div class="stack gap-2 small">
                        <div class="d-flex justify-content-between">
                          <span class="text-muted">شماره بیمه تأمین اجتماعی:</span>
                          <span class="fw-bold numeric">۴۲۸۹۱۷۶۰</span>
                        </div>
                        <div class="d-flex justify-content-between">
                          <span class="text-muted">نوع قرارداد:</span>
                          <span class="fw-semibold">یک‌ساله معتبر</span>
                        </div>
                        <div class="d-flex justify-content-between">
                          <span class="text-muted">شماره حساب شبا:</span>
                          <span class="font-monospace" style="font-size:11px;">IR12-0170-0000-0012-3456-7890</span>
                        </div>
                        <div class="d-flex justify-content-between">
                          <span class="text-muted">پایان اعتبار قرارداد:</span>
                          <span class="fw-semibold text-success">۲۹ اسفند ۱۴۰۵</span>
                        </div>
                      </div>
                    </div>

                    <div class="mt-3">
                      <h6 class="fw-bold small mb-2"><i class="bi bi-graph-up-arrow text-primary me-1"></i> نمودار ارزیابی شایستگی</h6>
                      <div class="chart" data-chart="radialBar" data-chart-height="220" data-chart-series='[${Math.round((perfScore / 5) * 100)}]' data-chart-labels='["امتیاز شایستگی"]'></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 2: Career Timeline -->
              <div data-tab-panel="timeline" hidden>
                <div class="timeline p-2">
                  <div class="timeline__item">
                    <span class="timeline__marker timeline__marker--success"><i class="bi bi-arrow-up-circle"></i></span>
                    <div class="timeline__content">
                      <h6 class="timeline__title fw-bold">ارتقای رتبه شغلی به ${escapeHtml(employee.position ?? 'کارشناس ارشد')}</h6>
                      <p class="timeline__text text-muted">به دلیل عملکرد درخشان در تحویل به‌موقع پروژه‌های فصلی و رهبری موفق تیم فنی.</p>
                      <span class="timeline__time text-primary fw-semibold">۳ ماه پیش</span>
                    </div>
                  </div>
                  <div class="timeline__item">
                    <span class="timeline__marker timeline__marker--info"><i class="bi bi-mortarboard"></i></span>
                    <div class="timeline__content">
                      <h6 class="timeline__title fw-bold">گذراندن دوره تخصصی معماری ابری و میکروسرویس</h6>
                      <p class="timeline__text text-muted">اخذ مدرک رسمی بین‌المللی با نمره عالی ۹۸ از ۱۰۰.</p>
                      <span class="timeline__time text-muted">۷ ماه پیش</span>
                    </div>
                  </div>
                  <div class="timeline__item">
                    <span class="timeline__marker timeline__marker--warning"><i class="bi bi-star"></i></span>
                    <div class="timeline__content">
                      <h6 class="timeline__title fw-bold">انتخاب به عنوان کارمند نمونه فصل پاییز</h6>
                      <p class="timeline__text text-muted">اهدای پاداش نقدی و تقدیرنامه رسمی از سوی مدیرعامل مجموعه.</p>
                      <span class="timeline__time text-muted">۱۰ ماه پیش</span>
                    </div>
                  </div>
                  <div class="timeline__item">
                    <span class="timeline__marker timeline__marker--primary"><i class="bi bi-person-check"></i></span>
                    <div class="timeline__content">
                      <h6 class="timeline__title fw-bold">آغاز رسمی همکاری در سازمان نووا</h6>
                      <p class="timeline__text text-muted">پیوستن به دپارتمان ${escapeHtml(employee.department ?? 'فناوری اطلاعات')} پس از گذراندن موفق دوره آزمایشی ۳ ماهه.</p>
                      <span class="timeline__time text-muted">${formatDate(employee.hiredAt, { format: 'medium' })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 3: Payroll Summary -->
              <div data-tab-panel="payroll" hidden>
                <div class="table-wrap">
                  <table class="table table--hover">
                    <thead>
                      <tr>
                        <th>شرح ردیف حقوقی</th>
                        <th>مبلغ استحقاقی</th>
                        <th>کسورات قانونی</th>
                        <th>خالص پرداختی</th>
                        <th>وضعیت تسویه</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>حقوق پایه ماه جاری</strong></td>
                        <td class="numeric">${formatCurrency(employee.salary || 320000000, 'IRR')}</td>
                        <td class="numeric text-danger">—</td>
                        <td class="numeric fw-bold text-success">${formatCurrency(employee.salary || 320000000, 'IRR')}</td>
                        <td><span class="badge badge--soft-success">تسویه شده</span></td>
                      </tr>
                      <tr>
                        <td>حق مسکن و خواربار</td>
                        <td class="numeric">${formatCurrency(24000000, 'IRR')}</td>
                        <td class="numeric text-danger">—</td>
                        <td class="numeric">${formatCurrency(24000000, 'IRR')}</td>
                        <td><span class="badge badge--soft-success">تسویه شده</span></td>
                      </tr>
                      <tr>
                        <td>پاداش ارزیابی عملکرد و نوآوری</td>
                        <td class="numeric">${formatCurrency(employee.bonus || 12000000, 'IRR')}</td>
                        <td class="numeric text-danger">—</td>
                        <td class="numeric">${formatCurrency(employee.bonus || 12000000, 'IRR')}</td>
                        <td><span class="badge badge--soft-success">تسویه شده</span></td>
                      </tr>
                      <tr>
                        <td>کسورات بیمه سهم کارمند (۷٪)</td>
                        <td class="numeric text-muted">—</td>
                        <td class="numeric text-danger">${formatCurrency(22400000, 'IRR')}</td>
                        <td class="numeric text-danger">-${formatCurrency(22400000, 'IRR')}</td>
                        <td><span class="badge badge--soft-info">واریز به تأمین اجتماعی</span></td>
                      </tr>
                      <tr>
                        <td>کسورات مالیات بر حقوق</td>
                        <td class="numeric text-muted">—</td>
                        <td class="numeric text-danger">${formatCurrency(18500000, 'IRR')}</td>
                        <td class="numeric text-danger">-${formatCurrency(18500000, 'IRR')}</td>
                        <td><span class="badge badge--soft-info">واریز به دارایی</span></td>
                      </tr>
                    </tbody>
                    <tfoot class="border-top-2">
                      <tr class="fw-bold">
                        <td>جمع نهایی واریزی به حساب:</td>
                        <td colspan="2"></td>
                        <td class="numeric fs-6 text-primary">${formatCurrency((employee.salary || 320000000) + 24000000 + (employee.bonus || 12000000) - 22400000 - 18500000, 'IRR')}</td>
                        <td><span class="badge bg-success">واریز موفق به بانک</span></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <!-- Tab 4: Attendance & Leaves -->
              <div data-tab-panel="attendance" hidden>
                <div class="row g-4">
                  <div class="col-md-6">
                    <div class="card p-3 bg-surface-2 border">
                      <h6 class="fw-bold mb-3"><i class="bi bi-clock-history text-primary me-1"></i> خلاصه کارکرد ماه جاری</h6>
                      <div class="stack gap-2 small">
                        <div class="d-flex justify-content-between"><span>ساعات کار موظف:</span><strong class="numeric">۱۷۶ ساعت</strong></div>
                        <div class="d-flex justify-content-between"><span>ساعات کارکرد واقعی:</span><strong class="numeric text-success">۱۸۴ ساعت</strong></div>
                        <div class="d-flex justify-content-between"><span>اضافه‌کاری تأییدشده:</span><strong class="numeric text-primary">+۸ ساعت</strong></div>
                        <div class="d-flex justify-content-between"><span>روزهای دورکاری:</span><strong class="numeric">۶ روز</strong></div>
                        <div class="d-flex justify-content-between"><span>تأخیر در ورود:</span><strong class="numeric text-success">۰ دقیقه (منضبط)</strong></div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="card p-3 bg-surface-2 border">
                      <h6 class="fw-bold mb-3"><i class="bi bi-calendar2-x text-primary me-1"></i> وضعیت مرخصی‌های سال جاری</h6>
                      <div class="stack gap-2 small">
                        <div class="d-flex justify-content-between"><span>کل سهمیه استحقاقی سال:</span><strong class="numeric">۲۶ روز</strong></div>
                        <div class="d-flex justify-content-between"><span>مرخصی استفاده‌شده:</span><strong class="numeric">۱۰ روز</strong></div>
                        <div class="d-flex justify-content-between"><span>مرخصی باقی‌مانده:</span><strong class="numeric text-success">${toDigits(leaveDays)} روز</strong></div>
                        <div class="d-flex justify-content-between"><span>مرخصی استعلاجی:</span><strong class="numeric">۰ روز</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`,
      );

      initCharts(node);

      // Interactive Tab Switching
      on(node, 'click', (e) => {
        const tabBtn = e.target.closest('[data-tab-target]');
        if (!tabBtn) return;
        const target = tabBtn.dataset.tabTarget;
        $$('[data-tab-target]', node).forEach((btn) => btn.classList.toggle('active', btn === tabBtn));
        $$('[data-tab-panel]', node).forEach((panel) => {
          panel.hidden = panel.dataset.tabPanel !== target;
        });
      });

      on($('[data-message]', node), 'click', () =>
        modal.prompt({ title: `ارسال پیام مستقیم به ${employee.name}`, label: 'متن پیام یا یادداشت اداری', placeholder: 'پیام خود را بنویسید…' }).then((value) => {
          if (value) toast.success('پیام ارسال شد', `پیام شما با موفقیت برای ${employee.name} ارسال شد.`);
        }),
      );

      on($('[data-award-btn]', node), 'click', () => {
        modal.confirm({
          title: 'ثبت تشویقی پرسنلی',
          text: `آیا مایل به ثبت ارتقا و تقدیرنامه رسمی برای ${employee.name} در پرونده پرسنلی هستید؟`,
          confirmText: 'ثبت تشویقی'
        }).then((ok) => {
          if (ok) toast.success('ارتقا ثبت شد', 'حکم تشویقی در سوابق کارمند ذخیره گردید.');
        });
      });

      on($('[data-export-profile]', node), 'click', () => {
        window.print();
      });

      return;
    }

    case 'hr/departments.html': {
      const node = host();
      const { items } = await services.departmentService.list({ perPage: 20 });
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'دپارتمان‌ها', subtitle: 'ساختار سازمانی و توزیع نیرو', icon: 'diagram-3', actions: toolButtons({ create: 'دپارتمان جدید' }) })}
          ${statsFrom({ count: items.length, people: items.reduce((sum, row) => sum + (row.headcount ?? 0), 0), budget: items.reduce((sum, row) => sum + (row.budget ?? 0), 0), locations: new Set(items.map((row) => row.location)).size }, [
            ['count', 'دپارتمان', 'number', 'primary', 'diagram-3'],
            ['people', 'نیرو', 'number', 'success', 'people'],
            ['budget', 'بودجه کل', 'currency', 'violet', 'wallet2'],
            ['locations', 'موقعیت', 'number', 'info', 'geo-alt'],
          ])}
          ${card({ flush: true, body: `<ul class="list-group">${items.map((row) => `<li class="list-item"><span class="tile tile--soft tile--icon"><i class="bi bi-diagram-2"></i></span><span class="list-item__title">${escapeHtml(row.name)}<span class="list-item__sub">سرپرست: ${escapeHtml(row.head ?? '—')}</span></span><span class="list-item__meta">${toDigits(row.headcount ?? 0)} نفر • ${formatCurrency(row.budget ?? 0, 'IRR', { compact: true })}</span></li>`).join('')}</ul>` })}
        </div>`,
      );
      on($('[data-create]', node), 'click', () => openRecordForm({ resource: 'departments', title: 'دپارتمان جدید', fields: crudFields('departments'), onSaved: () => window.location.reload() }));
      return;
    }

    default:
      return;
  }
}

async function renderLeaveRequests() {
  const host2 = $('[data-leave-list]');
  if (!host2) return;
  const { items } = await services.leaveService.list({ perPage: 12, filters: { status: 'pending' } });
  if (!items.length) {
    render(host2, emptyState({ title: 'درخواست در انتظاری وجود ندارد', text: 'همه مرخصی‌ها بررسی شده‌اند.', icon: 'check2-all' }));
    return;
  }
  render(
    host2,
    `<ul class="list-group">${items
      .map(
        (row) => `<li class="list-item" data-leave="${escapeHtml(row.id)}">
          <img class="avatar avatar--sm" src="${escapeHtml(row.avatar ?? 'assets/img/avatars/avatar-03.svg')}" alt="">
          <span class="list-item__title">${escapeHtml(row.employee ?? row.name)}<span class="list-item__sub">${escapeHtml(row.type ?? 'مرخصی')} • ${formatDate(row.from, { format: 'medium' })} تا ${formatDate(row.to, { format: 'medium' })}</span></span>
          <span class="badge badge--soft-warning">${toDigits(row.days ?? 0)} روز</span>
          <span class="list-item__meta"><button class="btn btn-soft-success btn-sm" type="button" data-approve>تأیید</button><button class="btn btn-soft-danger btn-sm" type="button" data-reject>رد</button></span>
        </li>`,
      )
      .join('')}</ul>`,
  );
  on(host2, 'click', async (event) => {
    const row = event.target.closest('[data-leave]');
    if (!row) return;
    const approve = event.target.closest('[data-approve]');
    const reject = event.target.closest('[data-reject]');
    if (!approve && !reject) return;
    if (approve) {
      await services.leaveActions.approve(row.dataset.leave);
      toast.success('مرخصی تأیید شد', 'کارمند از طریق ایمیل مطلع شد.');
    } else {
      await services.leaveActions.reject(row.dataset.leave);
      toast.warning('مرخصی رد شد', 'دلیل رد در توضیحات ثبت شد.');
    }
    row.remove();
    if (!$('[data-leave]', host2)) renderLeaveRequests();
  });
}

/* ================================================================= Logistics */

async function initLogistics() {
  const page = kit.pageId();
  switch (page) {
    case 'logistics/tracking.html': {
      const node = host();
      const [mapData, performance, shipments, routesData, driversData] = await Promise.all([
        services.trackingService.map().catch(() => ({ markers: [] })),
        services.trackingService.performance().catch(() => ({ onTime: 95.8, delayed: 2, inTransit: 24, delivered: 112 })),
        services.shipmentService.list({ perPage: 12 }).catch(() => ({ items: [] })),
        (services.logisticsService?.routes?.() ?? kit.services?.routeService?.list?.({ perPage: 20 }) ?? Promise.resolve({ items: [] })).catch(() => ({ items: [] })),
        (services.logisticsService?.drivers?.() ?? kit.services?.driverService?.list?.({ perPage: 10 }) ?? Promise.resolve({ items: [] })).catch(() => ({ items: [] })),
      ]);

      const IRAN_HUBS = {
        'تهران': { lat: 35.6892, lng: 51.3890, hub: 'هاب پردازش مرکزی کلان‌پایتخت', color: 'var(--nv-primary)', count: 48 },
        'اصفهان': { lat: 32.6546, lng: 51.6680, hub: 'هاب توزیع مرکز کشور و صنایع فولاد', color: '#06b6d4', count: 32 },
        'مشهد': { lat: 36.2972, lng: 59.6067, hub: 'هاب شمال‌شرق، ترانزیت آسیای میانه', color: '#10b981', count: 41 },
        'شیراز': { lat: 29.5918, lng: 52.5837, hub: 'هاب ترانزیت و لجستیک جنوب کشور', color: '#f59e0b', count: 28 },
        'تبریز': { lat: 38.0800, lng: 46.2919, hub: 'پایانه ترانزیت غرب کشور و بازرگان', color: 'var(--nv-primary)', count: 36 },
        'بندرعباس': { lat: 27.1832, lng: 56.2666, hub: 'مجتمع عظیم بندری شهید رجایی', color: '#ef4444', count: 52 },
        'اهواز': { lat: 31.3183, lng: 48.6706, hub: 'پایانه صادراتی جنوب‌غرب و پتروشیمی', color: '#06b6d4', count: 24 },
        'رشت': { lat: 37.2809, lng: 49.5924, hub: 'پایانه صادراتی خزر و بندر انزلی', color: '#10b981', count: 22 },
        'کرج': { lat: 35.8327, lng: 50.9915, hub: 'پایانه ترانزیت البرز و شهرک‌های صنعتی', color: 'var(--nv-primary)', count: 30 },
        'یزد': { lat: 31.8974, lng: 54.3569, hub: 'هاب انبارداری کویر و مرکز ترانزیت', color: '#06b6d4', count: 18 },
        'کرمان': { lat: 30.2839, lng: 57.0788, hub: 'پایانه باربری و توزیع جنوب‌شرق', color: '#f59e0b', count: 21 },
        'زاهدان': { lat: 29.4963, lng: 60.8629, hub: 'هاب ترانزیت کریدور شرق و پاکستان', color: '#f59e0b', count: 15 },
        'چابهار': { lat: 25.2919, lng: 60.6430, hub: 'بندر استراتژیک اقیانوسی چابهار', color: 'var(--nv-primary)', count: 27 },
      };

      const vehicles = [
        { id: 'NVX-101', code: 'TRK-9821', driver: 'حسین رضایی', phone: '۰۹۱۲۳۴۵۶۷۸۹', avatar: safeAvatar(1), model: 'ولوو FH500 مدل ۲۰۲۳', plate: '۶۸ ع ۹۲۴ - ایران ۱۱', from: 'تهران', to: 'اصفهان', speed: 88, maxSpeed: 110, temp: '+۴°C', fuel: 84, cargo: 'تجهیزات الکترونیک و سرور', weight: '۱۸٫۲ تن', progress: 45, status: 'active', eta: '۲ ساعت و ۱۵ دقیقه' },
        { id: 'NVX-102', code: 'TRK-4819', driver: 'سعید کرمی', phone: '۰۹۱۸۴۴۵۵۶۶۷', avatar: safeAvatar(2), model: 'اسکانیا R450 مدل ۲۰۲۴', plate: '۲۲ ج ۳۱۵ - ایران ۳۳', from: 'تهران', to: 'مشهد', speed: 94, maxSpeed: 110, temp: '-۱۸°C', fuel: 68, cargo: 'محصولات منجمد دارویی', weight: '۱۴٫۵ تن', progress: 68, status: 'active', eta: '۳ ساعت و ۴۰ دقیقه' },
        { id: 'NVX-103', code: 'TRK-7720', driver: 'علیرضا داوودی', phone: '۰۹۳۵۱۲۳۴۵۶۷', avatar: safeAvatar(3), model: 'مرسدس آکتروس ۱۸۴۴', plate: '۵۵ ب ۷۱۲ - ایران ۲۱', from: 'تبریز', to: 'تهران', speed: 82, maxSpeed: 100, temp: '+۱۸°C', fuel: 79, cargo: 'قطعات خودرو و صنعتی', weight: '۲۲٫۱ تن', progress: 54, status: 'active', eta: '۱ ساعت و ۵۰ دقیقه' },
        { id: 'NVX-104', code: 'TRK-3104', driver: 'مجید صادقی', phone: '۰۹۱۲۹۸۷۶۵۴۳', avatar: safeAvatar(4), model: 'رنو تی ۴۸۰ اوپتیکروز', plate: '۱۴ د ۸۶۳ - ایران ۴۴', from: 'اصفهان', to: 'شیراز', speed: 91, maxSpeed: 110, temp: '+۲°C', fuel: 55, cargo: 'مواد اولیه غذایی', weight: '۱۹٫۰ تن', progress: 82, status: 'active', eta: '۴۵ دقیقه' },
        { id: 'NVX-105', code: 'TRK-6612', driver: 'کامران مرادی', phone: '۰۹۱۹۳۳۴۴۵۵۶', avatar: safeAvatar(5), model: 'مان TGX 18.480', plate: '۳۱ ص ۴۵۱ - ایران ۶۸', from: 'مشهد', to: 'بندرعباس', speed: 45, maxSpeed: 100, temp: '+۲۴°C', fuel: 38, cargo: 'صادرات فرش و خشکبار', weight: '۱۶٫۸ تن', progress: 35, status: 'delayed', eta: '۶ ساعت و ۱۵ دقیقه (تأخیر جاده‌ای)' },
        { id: 'NVX-106', code: 'TRK-2291', driver: 'بهزاد حسینی', phone: '۰۹۳۶۷۷۸۸۹۹۰', avatar: safeAvatar(6), model: 'داف XF 480 سوپر اسپیس', plate: '۷۷ ط ۵۲۹ - ایران ۲۲', from: 'تهران', to: 'اهواز', speed: 86, maxSpeed: 105, temp: '+۵°C', fuel: 72, cargo: 'لوازم خانگی هوشمند', weight: '۱۳٫۴ تن', progress: 28, status: 'active', eta: '۵ ساعت و ۲۰ دقیقه' },
        { id: 'NVX-107', code: 'TRK-8815', driver: 'فرهاد طاهری', phone: '۰۹۱۵۴۴۳۳۲۲۱', avatar: safeAvatar(7), model: 'ایسوزو ۶ تن توربو دیزل', plate: '۸۹ ق ۶۱۴ - ایران ۱۲', from: 'تهران', to: 'رشت', speed: 78, maxSpeed: 95, temp: '+۱۵°C', fuel: 88, cargo: 'بسته‌های پستی پیشتاز', weight: '۴٫۸ تن', progress: 75, status: 'active', eta: '۵۵ دقیقه' },
        { id: 'NVX-108', code: 'TRK-5540', driver: 'پیمان انصاری', phone: '۰۹۱۷۱۱۱۲۲۳۳', avatar: safeAvatar(8), model: 'ولوو FM 460', plate: '۴۲ ی ۹۸۱ - ایران ۶۳', from: 'یزد', to: 'کرمان', speed: 90, maxSpeed: 110, temp: '+۲۲°C', fuel: 64, cargo: 'کاشی و سرامیک صنعتی', weight: '۲۳٫۵ تن', progress: 61, status: 'active', eta: '۱ ساعت و ۳۰ دقیقه' },
      ];

      const tickerItems = [
        `کامیون NVX-101 با سرعت ${toDigits(88)} کیلومتر بر ساعت به محدوده مورچه‌خورت اصفهان نزدیک شد.`,
        `محموله یخچالی NVX-102: دمای کانتینر در شرایط استاندارد (-۱۸°C) تثبیت شد.`,
        `تحویل موفق محموله NVX-104 در انبار مرکزی شیراز به سیستم لجستیک ثبت گردید.`,
        `هشدار آب‌وهوا: گرد و غبار در محور طبس به مشهد، سامانه ناوبری به راننده NVX-105 اعلام کرد.`,
        `ناوگان ترانزیتی NVX-103 از عوارضی قزوین-کرج با موفقیت عبور کرد.`,
        `پایش مصرف سوخت: میانگین مصرف کل ناوگان در ۲۴ ساعت گذشته ۲۸٫۴ لیتر در ۱۰۰ کیلومتر ثبت شد.`,
      ];

      render(
        node,
        `<div class="logi-pro">
          ${pageHeader({
            title: 'مرکز ردیابی زنده و دیسپچ ناوگان',
            subtitle: 'سامانه نظارت ماهواره‌ای بلادرنگ GPS بر بستر نقشه جغرافیایی • پایش تله‌متری، کریدورهای حمل و نقل و محموله‌ها',
            icon: 'geo-alt-fill',
            actions: `<div class="d-flex gap-2"><button class="btn btn-light" type="button" data-refresh-fleet><i class="bi bi-arrow-repeat me-1"></i>به‌روزرسانی داده‌ها</button><button class="btn btn-primary" type="button" data-dispatch-new><i class="bi bi-plus-lg me-1"></i>اعزام ناوگان جدید</button></div>`,
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'تحویل به‌موقع (SLA)', value: '۹۵٫۸٪', hint: '۲٫۴٪ بالاتر از شاخص استاندارد', tone: 'success', icon: 'shield-check', trend: '+۲٫۴٪' })}
            ${statCard({ label: 'ناوگان فعال در مسیر', value: toDigits(vehicles.length), hint: '۸ کامیون ترانزیت سنگین', tone: 'primary', icon: 'truck', trend: '+۳' })}
            ${statCard({ label: 'هشدار و تأخیر جاده‌ای', value: toDigits(vehicles.filter((v) => v.status === 'delayed').length), hint: '۱ خودرو نیازمند بررسی مسیر', tone: 'warning', icon: 'exclamation-triangle', trend: '-۱' })}
            ${statCard({ label: 'کل مرسوله‌های امروز', value: '۱,۴۲۰', hint: 'از سراسر ۱۳ هاب استانی کشور', tone: 'info', icon: 'box-seam', trend: '+۱۸٪' })}
          </div>

          <div class="logi-pro__cols">
            <div class="card logi-map-card overflow-hidden">
              <div class="card__head" style="padding:16px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                  <span class="tile tile--soft tile--icon tile--soft-primary" style="width:40px;height:40px;flex:0 0 auto;"><i class="bi bi-broadcast-pin" style="color:var(--nv-primary);font-size:1.25rem;"></i></span>
                  <div>
                    <h3 class="card__title" style="margin:0; font-size:15px; font-weight:800;">نقشه ماهواره‌ای و زنده ناوبری ایران</h3>
                    <p style="margin:0; font-size:11px; color:var(--nv-text-muted);">پایش بلادرنگ هاب‌های ترانزیتی و خودروها • نقشه تعاملی با کنترل کامل</p>
                  </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; min-width:0; max-width:100%;">
                  <button class="btn btn-primary btn-sm" data-filter="all">همه (${toDigits(vehicles.length)})</button>
                  <button class="btn btn-light btn-sm" data-filter="active">در حرکت (${toDigits(vehicles.filter((v) => v.status === 'active').length)})</button>
                  <button class="btn btn-light btn-sm" data-filter="delayed">دارای هشدار (${toDigits(vehicles.filter((v) => v.status === 'delayed').length)})</button>
                  <button class="btn btn-outline-secondary btn-sm" data-fit-iran title="دید کامل نقشه ایران"><i class="bi bi-aspect-ratio me-1"></i>کل کشور</button>
                </div>
              </div>

              <div class="card__body p-0 position-relative">
                <div id="logistics-leaflet-map" class="logi-pro__map"></div>
                
                <div class="logi-map__ticker" style="z-index: 1000;">
                  <div class="logi-map__ticker-live"><i class="bi bi-record-circle text-danger"></i> رصد زنده:</div>
                  <div class="logi-map__ticker-text" data-dispatch-ticker>${tickerItems[0]}</div>
                  <span class="badge badge--soft-primary" style="font-size:10px;">GPS Active</span>
                </div>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px;">
              <div class="card" style="border-radius:18px;">
                <div class="card__head" style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">ناوگان فعال در جاده</h3>
                    <p class="card__subtitle" style="margin:0; font-size:11px;">برای فوکوس روی نقشه و تله‌متری کلیک کنید</p>
                  </div>
                  <span class="badge badge--soft-success rounded-pill">${toDigits(vehicles.length)} کامیون</span>
                </div>
                <div class="card__body" style="padding:12px; max-height:480px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
                  ${vehicles.map((v) => `
                    <div class="logi-shipment-card" data-truck-card="${v.id}" style="padding:12px; border-radius:14px; border:1px solid var(--nv-border); background:var(--nv-surface-2); cursor:pointer; transition: all 0.2s ease;">
                      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                        <span style="font-weight:800; font-size:13px; color:var(--nv-heading); display:flex; align-items:center; gap:6px;">
                          <i class="bi bi-truck" style="color:${v.status === 'delayed' ? 'var(--nv-warning)' : 'var(--nv-primary)'};"></i> ${v.id}
                        </span>
                        <span class="badge badge--soft-${v.status === 'delayed' ? 'warning' : 'success'}" style="font-size:10px;">${v.status === 'delayed' ? 'تأخیر' : 'عادی'}</span>
                      </div>
                      <div style="font-size:11px; color:var(--nv-text-muted); display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span>${v.from} ← ${v.to}</span>
                        <span class="numeric" style="font-weight:700; color:var(--nv-primary);">${toDigits(v.speed)} km/h</span>
                      </div>
                      <div class="progress progress--sm" style="height:6px; border-radius:999px;">
                        <div class="progress-bar ${v.status === 'delayed' ? 'bg-warning' : ''}" style="width:${v.progress}%"></div>
                      </div>
                      <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--nv-text-muted); margin-top:6px;">
                        <span>راننده: ${v.driver}</span>
                        <span>ETA: ${v.eta}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid--3 mt-4">
            ${card({
              title: 'توزیع بار و کریدورهای ترانزیتی کلیدی',
              flush: true,
              body: `<div class="table-responsive"><table class="table table--hover">
                <thead><tr><th>مسیر ترانزیتی</th><th>ناوگان</th><th>میانگین سرعت</th><th>وضعیت جاده</th></tr></thead>
                <tbody>
                  <tr><td style="font-weight:700;">تهران ↔ اصفهان (کریدور مرکزی)</td><td class="numeric">۸ دستگاه</td><td class="numeric">۹۲ km/h</td><td><span class="badge badge--soft-success">ترافیک روان</span></td></tr>
                  <tr><td style="font-weight:700;">تهران ↔ مشهد (کریدور شرق)</td><td class="numeric">۶ دستگاه</td><td class="numeric">۸۶ km/h</td><td><span class="badge badge--soft-success">دید افقی خوب</span></td></tr>
                  <tr><td style="font-weight:700;">تبریز ↔ تهران (کریدور غرب)</td><td class="numeric">۵ دستگاه</td><td class="numeric">۸۸ km/h</td><td><span class="badge badge--soft-success">آزادراه باز</span></td></tr>
                  <tr><td style="font-weight:700;">مشهد ↔ بندرعباس (شمال-جنوب)</td><td class="numeric">۴ دستگاه</td><td class="numeric">۷۲ km/h</td><td><span class="badge badge--soft-warning">وزش باد و گردوغبار</span></td></tr>
                </tbody>
              </table></div>`,
            })}

            ${card({
              title: 'رانندگان برگزیده ناوگان',
              flush: true,
              body: `<div style="padding:12px; display:flex; flex-direction:column; gap:10px;">
                ${vehicles.slice(0, 4).map((v) => `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:10px; background:var(--nv-surface-2);">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <img src="${v.avatar}" style="width:36px; height:36px; border-radius:50%; border:2px solid var(--nv-border); object-fit:cover;">
                      <div>
                        <div style="font-weight:700; font-size:12px;">${v.driver}</div>
                        <div style="font-size:10px; color:var(--nv-text-muted);">${v.model}</div>
                      </div>
                    </div>
                    <div style="text-align:end;">
                      <span class="badge badge--soft-primary" style="font-size:10px;">${v.id}</span>
                      <div style="font-size:10px; color:var(--nv-success); font-weight:700; margin-top:2px;">امتیاز ۴٫۹/۵</div>
                    </div>
                  </div>
                `).join('')}
              </div>`,
            })}

            ${card({
              title: 'رویدادهای امنیتی و سنسورهای اینترنت اشیاء (IoT)',
              flush: true,
              body: `<ul class="list-group list-group--flush">${[
                { icon: 'shield-check', tone: 'success', title: 'سنسور قفل بار کانتینر NVX-101', sub: 'بدون بازشدگی در طول مسیر • وضعیت امن', time: '۵ دقیقه پیش' },
                { icon: 'thermometer-half', tone: 'info', title: 'دماسنج سردخانه NVX-102', sub: 'دما -۱۸٫۲ درجه سانتی‌گراد • مطلوب', time: '۱۲ دقیقه پیش' },
                { icon: 'fuel-pump', tone: 'warning', title: 'سطح سوخت NVX-105 کمتر از ۴۰٪', sub: 'نزدیک‌ترین جایگاه در کیلومتر ۶۴', time: '۲۲ دقیقه پیش' },
                { icon: 'speedometer2', tone: 'danger', title: 'هشدار سرعت لحظه‌ای NVX-106', sub: 'سرعت ۹۸ km/h در محدوده شیب‌دار جاده', time: '۴۰ دقیقه پیش' },
              ].map((item) => `
                <li class="list-group__item" style="padding:10px 14px; display:flex; align-items:center; gap:10px;">
                  <span class="tile tile--soft tile--icon tile--soft-${item.tone || 'primary'}" style="width:36px; height:36px; border-radius:10px; display:grid; place-items:center;">
                    <i class="bi bi-${item.icon}"></i>
                  </span>
                  <div style="flex:1;">
                    <div style="font-weight:700; font-size:12px; color:var(--nv-heading);">${item.title}</div>
                    <div style="font-size:10px; color:var(--nv-text-muted);">${item.sub}</div>
                  </div>
                  <small style="font-size:10px; color:var(--nv-text-muted);">${item.time}</small>
                </li>
              `).join('')}</ul>`,
            })}
          </div>
        </div>`,
      );

      // Initialize Leaflet Map
      let map = null;
      const truckMarkersMap = new Map();

      // Keyless tile providers with a fallback chain. The first (Esri
      // satellite) matches the page's "satellite" promise and looks best;
      // if a provider's CDN blocks the request (403 hotlink policy, no
      // internet, …) we fall through to the next, so the map degrades
      // gracefully instead of showing a broken gray box.
      const TILE_PROVIDERS = [
        {
          id: 'esri-satellite',
          kind: 'satellite',
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 17,
          attribution: 'Tiles &copy; Esri &mdash; Sources: Esri, Maxar, Earthstar Geographics',
        },
        {
          id: 'esri-streets',
          kind: 'vector',
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Sources: Esri, DeLorme, NAVTEQ',
        },
        {
          id: 'osm-de',
          kind: 'vector',
          url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        },
        {
          id: 'osm',
          kind: 'vector',
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        },
      ];

      function mountTiles(L, map, mapEl, index, onExhausted) {
        const provider = TILE_PROVIDERS[index];
        if (!provider) {
          mapEl?.classList.add('map--offline');
          onExhausted?.();
          return;
        }
        mapEl?.classList.remove('map--satellite', 'map--vector');
        mapEl?.classList.add(provider.kind === 'satellite' ? 'map--satellite' : 'map--vector');
        const layer = L.tileLayer(provider.url, { maxZoom: provider.maxZoom, attribution: provider.attribution });
        let failures = 0;
        let successes = 0;
        layer.on('tileload', () => {
          successes += 1;
          if (successes === 1) mapEl?.classList.add('map-tiles-ready');
        });
        layer.on('tileerror', () => {
          failures += 1;
          // A blocked provider 403s every tile; once four failed with zero
          // successes, move to the next provider.
          if (failures >= 4 && successes === 0) {
            map.removeLayer(layer);
            mountTiles(L, map, mapEl, index + 1, onExhausted);
          }
        });
        layer.addTo(map);
      }

      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        const mapContainer = $('#logistics-leaflet-map', node);
        if (mapContainer) {
          map = L.map(mapContainer, {
            center: [32.4279, 53.6880],
            zoom: 6,
            minZoom: 5,
            maxZoom: 14,
            zoomControl: false,
          });

          mountTiles(L, map, mapContainer, 0);

          // Add City Hub Markers
          Object.entries(IRAN_HUBS).forEach(([cityName, data]) => {
            const cityIcon = L.divIcon({
              className: 'leaf-city-node',
              html: `<div class="leaf-city-pin">
                <div class="leaf-pulse" style="--pulse-color: ${data.color};"></div>
                <div class="leaf-city-label">${cityName} (${toDigits(data.count)})</div>
              </div>`,
              iconSize: [120, 24],
              iconAnchor: [8, 12],
            });

            const cityMarker = L.marker([data.lat, data.lng], { icon: cityIcon }).addTo(map);
            cityMarker.bindPopup(`
              <div style="text-align: right; direction: rtl; min-width: 180px;">
                <h6 style="margin: 0 0 4px; font-weight: 800; font-size: 13px; color: var(--nv-heading);"><i class="bi bi-geo-alt-fill text-primary me-1"></i> ${cityName}</h6>
                <p style="margin: 0 0 6px; font-size: 11px; color: var(--nv-text-muted);">${data.hub}</p>
                <span class="badge badge--soft-primary" style="font-size: 10px;">${toDigits(data.count)} مرسوله در انبار توزیع</span>
              </div>
            `);
          });

          // Add Route Polylines and Truck Markers
          vehicles.forEach((v) => {
            const fromHub = IRAN_HUBS[v.from] || IRAN_HUBS['تهران'];
            const toHub = IRAN_HUBS[v.to] || IRAN_HUBS['اصفهان'];

            // Polyline
            L.polyline([[fromHub.lat, fromHub.lng], [toHub.lat, toHub.lng]], {
              color: v.status === 'delayed' ? '#f59e0b' : 'var(--nv-primary)',
              weight: 3.5,
              opacity: 0.65,
              dashArray: v.status === 'delayed' ? '6, 8' : '4, 6',
            }).addTo(map);

            // Compute current interpolated vehicle position
            const curLat = fromHub.lat + (toHub.lat - fromHub.lat) * (v.progress / 100);
            const curLng = fromHub.lng + (toHub.lng - fromHub.lng) * (v.progress / 100);

            const truckIcon = L.divIcon({
              className: 'leaf-truck-marker',
              html: `<div class="leaf-truck-pin ${v.status}" data-truck="${v.id}">
                <i class="bi bi-truck"></i>
                <span class="leaf-truck-badge">${v.id}</span>
              </div>`,
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            });

            const truckMarker = L.marker([curLat, curLng], { icon: truckIcon }).addTo(map);
            truckMarker.bindPopup(`
              <div style="text-align: right; direction: rtl; min-width: 210px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                  <strong style="font-size:13px; color:var(--nv-heading);"><i class="bi bi-truck me-1"></i> ${v.id} (${v.code})</strong>
                  <span class="badge badge--soft-${v.status === 'delayed' ? 'warning' : 'success'}" style="font-size:10px;">${v.status === 'delayed' ? 'تأخیر' : 'در حرکت'}</span>
                </div>
                <div style="font-size:11px; margin-bottom: 4px;"><strong>راننده:</strong> ${v.driver}</div>
                <div style="font-size:11px; margin-bottom: 4px;"><strong>مسیر:</strong> ${v.from} به ${v.to}</div>
                <div style="font-size:11px; margin-bottom: 4px;"><strong>سرعت لحظه‌ای:</strong> <span class="numeric fw-bold text-primary">${toDigits(v.speed)} km/h</span></div>
                <div style="font-size:11px; margin-bottom: 8px;"><strong>دمای بار:</strong> ${v.temp} • سوخت: ${toDigits(v.fuel)}٪</div>
                <button type="button" class="btn btn-sm btn-primary w-100" data-open-modal="${v.id}" style="font-size:11px; padding:3px 8px;">
                  <i class="bi bi-speedometer2 me-1"></i>مشاهده تله‌متری کامل
                </button>
              </div>
            `);
            truckMarkersMap.set(v.id, { marker: truckMarker, vehicle: v, curLat, curLng });
          });

          // Fit bounds on Iran
          map.fitBounds([[25.0, 44.5], [39.5, 63.0]]);
        }
      } catch (err) {
        console.warn('[nova:logistics] Leaflet initialization error', err);
      }

      // Interactive telemetry modal for trucks
      const openTelemetry = (vehicleId) => {
        const v = vehicles.find((item) => item.id === vehicleId);
        if (!v) return;
        modal.open({
          title: `تله‌متری زنده ناوگان — ${v.id} (${v.code})`,
          size: 'lg',
          content: `
            <div style="display:flex; flex-direction:column; gap:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:var(--nv-surface-2); border-radius:14px; border:1px solid var(--nv-border);">
                <div style="display:flex; align-items:center; gap:14px;">
                  <img src="${v.avatar}" style="width:52px; height:52px; border-radius:50%; border:3px solid var(--nv-primary); object-fit:cover;">
                  <div>
                    <h4 style="margin:0; font-size:15px; font-weight:800;">${v.driver}</h4>
                    <p style="margin:0; font-size:12px; color:var(--nv-text-muted);"><span class="text-ltr" dir="ltr">${escapeHtml(v.phone)}</span> • گواهینامه پایه یک ترانزیت بین‌المللی</p>
                  </div>
                </div>
                <div style="text-align:end;">
                  <div style="font-size:11px; color:var(--nv-text-muted);">پلاک انتظامی:</div>
                  <span class="badge" style="font-size:13px; font-weight:800; background:var(--nv-surface); color:var(--nv-heading); border:1px solid var(--nv-border); padding:4px 10px; border-radius:6px; direction:ltr;">${v.plate}</span>
                </div>
              </div>

              <div class="grid grid--4" style="gap:12px;">
                <div style="padding:14px; background:var(--nv-surface-2); border-radius:12px; text-align:center; border:1px solid var(--nv-border);">
                  <div style="font-size:11px; color:var(--nv-text-muted); margin-bottom:4px;"><i class="bi bi-speedometer2"></i> سرعت لحظه‌ای</div>
                  <strong class="numeric" style="font-size:20px; font-weight:900; color:var(--nv-primary);">${toDigits(v.speed)} <span style="font-size:11px;">km/h</span></strong>
                  <div class="progress progress--sm mt-2"><div class="progress-bar" style="width:${(v.speed / v.maxSpeed) * 100}%"></div></div>
                </div>
                <div style="padding:14px; background:var(--nv-surface-2); border-radius:12px; text-align:center; border:1px solid var(--nv-border);">
                  <div style="font-size:11px; color:var(--nv-text-muted); margin-bottom:4px;"><i class="bi bi-fuel-pump"></i> سطح سوخت</div>
                  <strong class="numeric" style="font-size:20px; font-weight:900; color:${v.fuel < 40 ? 'var(--nv-warning)' : 'var(--nv-success)'};">${toDigits(v.fuel)}٪</strong>
                  <div class="progress progress--sm mt-2"><div class="progress-bar ${v.fuel < 40 ? 'bg-warning' : 'bg-success'}" style="width:${v.fuel}%"></div></div>
                </div>
                <div style="padding:14px; background:var(--nv-surface-2); border-radius:12px; text-align:center; border:1px solid var(--nv-border);">
                  <div style="font-size:11px; color:var(--nv-text-muted); margin-bottom:4px;"><i class="bi bi-thermometer-half"></i> دمای محفظه بار</div>
                  <strong class="numeric" style="font-size:20px; font-weight:900; color:var(--nv-info);">${v.temp}</strong>
                  <div style="font-size:10px; color:var(--nv-text-muted); margin-top:6px;">سنسور IoT فعال</div>
                </div>
                <div style="padding:14px; background:var(--nv-surface-2); border-radius:12px; text-align:center; border:1px solid var(--nv-border);">
                  <div style="font-size:11px; color:var(--nv-text-muted); margin-bottom:4px;"><i class="bi bi-box-seam"></i> وزن خالص بار</div>
                  <strong class="numeric" style="font-size:20px; font-weight:900; color:var(--nv-heading);">${v.weight}</strong>
                  <div style="font-size:10px; color:var(--nv-success); margin-top:6px;">مجاز و متوازن</div>
                </div>
              </div>

              <div style="padding:16px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:14px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
                  <span><strong>مبدأ:</strong> ${v.from}</span>
                  <span><strong>پیشرفت کل مسیر:</strong> <strong class="numeric text-primary">${toDigits(v.progress)}٪</strong></span>
                  <span><strong>مقصد:</strong> ${v.to}</span>
                </div>
                <div class="progress progress--sm" style="height:8px;"><div class="progress-bar" style="width:${v.progress}%"></div></div>
                <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:11px; color:var(--nv-text-muted);">
                  <span>نوع محموله: <strong>${v.cargo}</strong></span>
                  <span>زمان تخمینی تحویل (ETA): <strong style="color:var(--nv-primary);">${v.eta}</strong></span>
                </div>
              </div>
            </div>
          `,
          footer: `
            <div class="d-flex justify-content-between w-100">
              <a class="btn btn-outline-primary btn-sm" href="tel:${escapeHtml(v.phone)}"><i class="bi bi-telephone me-1"></i> تماس با راننده</a>
              <button class="btn btn-primary btn-sm" type="button" data-modal-close>تأیید و بستن</button>
            </div>
          `,
        });
      };

      // Event handlers on tracking page
      on(node, 'click', (e) => {
        // Filter buttons
        const filterBtn = e.target.closest('[data-filter]');
        if (filterBtn) {
          const filter = filterBtn.dataset.filter;
          $$('[data-filter]', node).forEach((b) => (b.className = b === filterBtn ? 'btn btn-primary btn-sm' : 'btn btn-light btn-sm'));
          $$('[data-truck-card]', node).forEach((card) => {
            const v = vehicles.find((item) => item.id === card.dataset.truckCard);
            if (!v) return;
            card.style.display = filter === 'all' || v.status === filter ? 'block' : 'none';
          });
          truckMarkersMap.forEach(({ marker, vehicle }) => {
            if (filter === 'all' || vehicle.status === filter) {
              if (map && !map.hasLayer(marker)) marker.addTo(map);
            } else {
              if (map && map.hasLayer(marker)) map.removeLayer(marker);
            }
          });
          return;
        }

        // Fit Iran Bounds
        if (e.target.closest('[data-fit-iran]')) {
          if (map) map.fitBounds([[25.0, 44.5], [39.5, 63.0]]);
          return;
        }

        // Open modal from popup button
        const openModalBtn = e.target.closest('[data-open-modal]');
        if (openModalBtn) {
          openTelemetry(openModalBtn.dataset.openModal);
          return;
        }

        // Click truck card on right sidebar
        const truckCard = e.target.closest('[data-truck-card]');
        if (truckCard) {
          const vId = truckCard.dataset.truckCard;
          const entry = truckMarkersMap.get(vId);
          if (entry && map) {
            map.flyTo([entry.curLat, entry.curLng], 9, { duration: 1.2 });
            entry.marker.openPopup();
          }
          openTelemetry(vId);
          return;
        }

        if (e.target.closest('[data-refresh-fleet]')) {
          toast.success('ناوگان همگام شد', 'آخرین موقعیت‌های جغرافیایی ماهواره‌ای دریافت گردید.');
          return;
        }

        if (e.target.closest('[data-dispatch-new]')) {
          modal.prompt({ title: 'اعزام ناوگان جدید', label: 'کد بارنامه یا شناسه کامیون', placeholder: 'مثلاً NVX-109' }).then((val) => {
            if (val) toast.success('ناوگان اعزام شد', `کامیون با بارنامه ${val} در سامانه ردیابی فعال شد.`);
          });
          return;
        }
      });

      // Live dispatch ticker rotation
      let tickerIndex = 0;
      const tickerEl = $('[data-dispatch-ticker]', node);
      if (tickerEl) {
        setInterval(() => {
          tickerIndex = (tickerIndex + 1) % tickerItems.length;
          tickerEl.style.opacity = '0';
          setTimeout(() => {
            tickerEl.textContent = tickerItems[tickerIndex];
            tickerEl.style.opacity = '1';
          }, 300);
        }, 5000);
      }

      exportable(node, 'shipments');
      return;
    }

    case 'logistics/warehouses.html': {
      const node = host();
      const warehouses = [
        { id: 'wh-1', name: 'هاب انبارداری مرکزی پایتخت', city: 'تهران - شورآباد', type: 'general', capacity: 65000, used: 57200, area: '۳۵,۰۰۰ m²', temp: '+۲۰°C', docks: 24, activeDocks: 19, manager: 'مهندس محمدرضا کریمی', phone: '۰۲۱-۵۵۲۲۱۱۰۰', avatar: safeAvatar(1), status: 'optimal', features: ['نظارت تصویری CCTV', 'بارکدینگ RFID', 'تخلیه مکانیزه', 'بیمه البرز'] },
        { id: 'wh-2', name: 'مجتمع سردخانه‌ای فوق‌پیشرفته خاوران', city: 'تبریز - خاوران', type: 'cold', capacity: 28000, used: 20720, area: '۱۶,۰۰۰ m²', temp: '-۲۲°C', docks: 12, activeDocks: 10, manager: 'دکتر علیرضا صادقی', phone: '۰۴۱-۳۳۴۴۵۵۶۶', avatar: safeAvatar(2), status: 'optimal', features: ['کنترل برودت هوشمند', 'استاندارد GMP دارویی', 'سیستم CO2 مرکزی', 'داک ایزوله'] },
        { id: 'wh-3', name: 'هاب مکانیزه توزیع مورچه‌خورت', city: 'اصفهان - مورچه‌خورت', type: 'general', capacity: 42000, used: 26040, area: '۲۴,۰۰۰ m²', temp: '+۲۲°C', docks: 16, activeDocks: 11, manager: 'مهندس حمیدرضا رضایی', phone: '۰۳۱-۴۵۶۶۷۷۸۸', avatar: safeAvatar(3), status: 'optimal', features: ['استاکر خودکار', 'سیستم مدیریت WMS', 'دسترسی ریلی', 'پایش ۲۴/۷'] },
        { id: 'wh-4', name: 'پایانه بندری و انبار کانتینری شهید رجایی', city: 'بندرعباس - اسکله شهید رجایی', type: 'customs', capacity: 80000, used: 73600, area: '۴۸,۰۰۰ m²', temp: '+۲۸°C', docks: 32, activeDocks: 30, manager: 'ناخدا مسعود احمدی', phone: '۰۷۶-۳۲۲۱۱۴۴۵', avatar: safeAvatar(4), status: 'warning', features: ['انبار گمرکی ترانزیت', 'جرثقیل دروازه‌ای', 'حفاظت مرزی', 'ترخیص شبانه‌روزی'] },
        { id: 'wh-5', name: 'مرکز لجستیک و توزیع منطقه‌ای شرق', city: 'مشهد - جاده سنتو', type: 'general', capacity: 35000, used: 20300, area: '۲۰,۰۰۰ m²', temp: '+۱۹°C', docks: 14, activeDocks: 8, manager: 'مهندس بهرام نوری', phone: '۰۵۱-۳۶۶۵۵۴۴۳', avatar: safeAvatar(5), status: 'optimal', features: ['توزیع FMCG', 'بسته‌بندی اختصاصی', 'ناوگان شهری اختصاصی', 'هاب پستی'] },
        { id: 'wh-6', name: 'هاب باربری تخصصی شهرک صنعتی ۲', city: 'اهواز - شهرک صنعتی شماره ۲', type: 'industrial', capacity: 30000, used: 13800, area: '۱۸,۰۰۰ m²', temp: '+۲۵°C', docks: 10, activeDocks: 6, manager: 'مهندس جلال طاهری', phone: '۰۶۱-۳۴۴۳۲۲۱۱', avatar: safeAvatar(6), status: 'optimal', features: ['قطعات نفت و گاز', 'نگهداری مواد شیمیایی استاندارد', 'انبار روباز و سوله', 'بارگیر هیدرولیک'] },
      ];

      const totalCap = warehouses.reduce((sum, w) => sum + w.capacity, 0);
      const totalUsed = warehouses.reduce((sum, w) => sum + w.used, 0);
      const overallPercent = Math.round((totalUsed / totalCap) * 100);

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'مدیریت جامع انبارها و مراکز لجستیک',
            subtitle: 'پایش ظرفیت، موجودی پالت‌ها، سردخانه‌ها، داک‌های بارگیری و حواله‌های ورود و خروج',
            icon: 'building-fill',
            actions: `
              <div class="d-flex gap-2">
                <button class="btn btn-light" type="button" data-inbound-receipt><i class="bi bi-box-arrow-in-down"></i> ثبت ورود کالا</button>
                <button class="btn btn-light" type="button" data-outbound-dispatch><i class="bi bi-box-arrow-up-right"></i> حواله خروج</button>
                <button class="btn btn-primary" type="button" data-new-warehouse><i class="bi bi-plus-lg"></i> انبار جدید</button>
              </div>
            `,
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'کل ظرفیت انبارهای کشور', value: `${toDigits(280)},۰۰۰`, hint: 'پالت استاندارد یورو', tone: 'primary', icon: 'buildings', trend: '+۱۲٪' })}
            ${statCard({ label: 'اشغال فعال انبارها', value: `${toDigits(overallPercent)}٪`, hint: `${toDigits(Math.round(totalUsed/1000))} هزار پالت اشغال‌شده`, tone: 'success', icon: 'pie-chart', trend: '+۴٪' })}
            ${statCard({ label: 'گردش کالا در ۲۴ ساعت', value: `${toDigits(42)},۵۰۰`, hint: 'کارتن و بسته پردازش‌شده', tone: 'info', icon: 'arrow-repeat', trend: '+۱۵٪' })}
            ${statCard({ label: 'انبارهای دارای کنترل دما', value: '۴ انبار', hint: 'سردخانه‌های ترانزیتی فعال', tone: 'warning', icon: 'thermometer-snow', trend: 'پایدار' })}
          </div>

          <div class="card mb-4" style="border-radius:18px;">
            <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--nv-border);">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="tile tile--soft tile--icon tile--soft-primary" style="width:36px; height:36px; border-radius:10px; display:grid; place-items:center;">
                  <i class="bi bi-building"></i>
                </span>
                <h3 class="card__title" style="margin:0; font-size:15px; font-weight:800;">شبکه هاب‌های انبارداری فعال کشور</h3>
              </div>
              <div class="segmented" data-wh-filter>
                <button type="button" class="segmented__item is-active" data-wh-type="all">همه (${toDigits(warehouses.length)})</button>
                <button type="button" class="segmented__item" data-wh-type="general">انبار استاندارد</button>
                <button type="button" class="segmented__item" data-wh-type="cold">سردخانه‌ها</button>
                <button type="button" class="segmented__item" data-wh-type="customs">گمرکی و بندری</button>
              </div>
            </div>

            <div class="card__body" style="padding:20px;">
              <div class="grid grid--3" style="gap:20px;" data-warehouses-grid>
                ${warehouses.map(w => {
                  const pct = Math.round((w.used / w.capacity) * 100);
                  const isNearFull = pct >= 90;
                  return `
                    <div class="card" data-wh-item="${w.id}" data-type="${w.type}" style="border-radius:16px; border:1px solid ${isNearFull ? 'var(--nv-warning)' : 'var(--nv-border)'}; background:var(--nv-surface); box-shadow:var(--nv-shadow-xs);">
                      <div class="card__head" style="padding:16px; border-bottom:1px solid var(--nv-border); display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                          <h4 style="margin:0 0 4px; font-size:14px; font-weight:800; color:var(--nv-heading);">${escapeHtml(w.name)}</h4>
                          <span style="font-size:11px; color:var(--nv-text-muted);"><i class="bi bi-geo-alt"></i> ${escapeHtml(w.city)}</span>
                        </div>
                        <span class="badge badge--soft-${isNearFull ? 'warning' : 'success'}" style="font-size:10px;">${isNearFull ? 'ظرفیت رو به اتمام' : 'وضعیت بهینه'}</span>
                      </div>

                      <div class="card__body" style="padding:16px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                          <span style="color:var(--nv-text-muted);">میزان اشغال انبار</span>
                          <strong class="numeric" style="font-weight:800; color:${isNearFull ? 'var(--nv-warning)' : 'var(--nv-primary)'};">${toDigits(pct)}٪</strong>
                        </div>
                        <div class="progress progress--sm mb-3" style="height:7px; border-radius:999px;">
                          <div class="progress-bar ${isNearFull ? 'bg-warning' : 'bg-primary'}" style="width:${pct}%"></div>
                        </div>

                        <div class="grid grid--2 mb-3" style="gap:8px; font-size:11px;">
                          <div style="padding:8px; background:var(--nv-surface-2); border-radius:8px;">
                            <span style="color:var(--nv-text-muted);">ظرفیت پالت:</span>
                            <div class="numeric" style="font-weight:700; margin-top:2px;">${toDigits(w.used)} / ${toDigits(w.capacity)}</div>
                          </div>
                          <div style="padding:8px; background:var(--nv-surface-2); border-radius:8px;">
                            <span style="color:var(--nv-text-muted);">دمای انبار:</span>
                            <div class="numeric" style="font-weight:700; margin-top:2px; color:var(--nv-info);"><i class="bi bi-thermometer-half"></i> ${w.temp}</div>
                          </div>
                          <div style="padding:8px; background:var(--nv-surface-2); border-radius:8px;">
                            <span style="color:var(--nv-text-muted);">داک بارگیری:</span>
                            <div class="numeric" style="font-weight:700; margin-top:2px;">${toDigits(w.activeDocks)} از ${toDigits(w.docks)} فعال</div>
                          </div>
                          <div style="padding:8px; background:var(--nv-surface-2); border-radius:8px;">
                            <span style="color:var(--nv-text-muted);">مساحت کل:</span>
                            <div style="font-weight:700; margin-top:2px;">${w.area}</div>
                          </div>
                        </div>

                        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:14px;">
                          ${w.features.map(f => `<span class="badge badge--soft-primary" style="font-size:10px; font-weight:500;">${f}</span>`).join('')}
                        </div>

                        <div style="display:flex; align-items:center; justify-content:space-between; padding-top:12px; border-top:1px solid var(--nv-border);">
                          <div style="display:flex; align-items:center; gap:8px;">
                            <img src="${w.avatar}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">
                            <span style="font-size:11px; font-weight:600; color:var(--nv-heading);">${w.manager}</span>
                          </div>
                          <button class="btn btn-sm btn-light" type="button" data-wh-details="${w.id}" style="font-size:11px; padding:3px 10px;">مدیریت</button>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="card" style="border-radius:18px;">
            <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--nv-border);">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">آخرین تراکنش‌ها و حواله‌های انبارداری</h3>
              <span class="badge badge--soft-primary rounded-pill">برخط IoT</span>
            </div>
            <div class="card__body" style="padding:0;">
              <div class="table-responsive">
                <table class="table table--hover">
                  <thead>
                    <tr>
                      <th>شماره حواله / رسید</th>
                      <th>نوع عملیات</th>
                      <th>انبار مبدأ / مقصد</th>
                      <th>شرح اقلام</th>
                      <th class="text-center">تعداد پالت</th>
                      <th>راننده و پلاک</th>
                      <th>زمان ثبت</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="numeric" style="font-weight:700;">RC-۱۰۸۴۲</td>
                      <td><span class="badge badge--soft-success">ورود به انبار</span></td>
                      <td>شورآباد تهران</td>
                      <td>قطعات الکترونیکی سرور و کابل شبکه</td>
                      <td class="text-center numeric">۴۲</td>
                      <td>حسین رضایی (۶۸ ع ۹۲۴)</td>
                      <td>۱۰ دقیقه پیش</td>
                      <td><span class="badge badge--soft-success">تخلیه و بارکدگذاری شد</span></td>
                    </tr>
                    <tr>
                      <td class="numeric" style="font-weight:700;">WH-۹۹۰۱۴</td>
                      <td><span class="badge badge--soft-primary">حواله خروج</span></td>
                      <td>سردخانه خاوران تبریز</td>
                      <td>واکسن و سرم‌های دارویی منجمد</td>
                      <td class="text-center numeric">۱۸</td>
                      <td>سعید کرمی (۲۲ ج ۳۱۵)</td>
                      <td>۳۵ دقیقه پیش</td>
                      <td><span class="badge badge--soft-info">پلمپ و بارگیری شد</span></td>
                    </tr>
                    <tr>
                      <td class="numeric" style="font-weight:700;">TR-۳۸۱۲۰</td>
                      <td><span class="badge badge--soft-warning">انتقال بین‌انباری</span></td>
                      <td>بندرعباس به اصفهان</td>
                      <td>روغن موتور و تجهیزات صنعتی</td>
                      <td class="text-center numeric">۶۰</td>
                      <td>مجید صادقی (۱۴ د ۸۶۳)</td>
                      <td>۱ ساعت پیش</td>
                      <td><span class="badge badge--soft-warning">در حال بارگیری در داک ۸</span></td>
                    </tr>
                    <tr>
                      <td class="numeric" style="font-weight:700;">RC-۱۰۸۳۹</td>
                      <td><span class="badge badge--soft-success">ورود به انبار</span></td>
                      <td>جاده سنتو مشهد</td>
                      <td>بسته‌بندی مواد غذایی و خشکبار</td>
                      <td class="text-center numeric">۳۴</td>
                      <td>فرهاد طاهری (۸۹ ق ۶۱۴)</td>
                      <td>۲ ساعت پیش</td>
                      <td><span class="badge badge--soft-success">رسید انبار صادر شد</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>`,
      );

      // Warehouse filter interaction
      on(node, 'click', (e) => {
        const filterBtn = e.target.closest('[data-wh-type]');
        if (filterBtn) {
          const type = filterBtn.dataset.whType;
          $$('[data-wh-type]', node).forEach(b => b.classList.toggle('is-active', b === filterBtn));
          $$('[data-wh-item]', node).forEach(item => {
            item.style.display = (type === 'all' || item.dataset.type === type) ? 'block' : 'none';
          });
        }
        if (e.target.closest('[data-inbound-receipt]')) {
          modal.open({
            title: 'ثبت رسید ورود کالا به انبار (Inbound Receipt)',
            content: `
              <form class="form-stack">
                <div class="form-field"><label class="form-label">انبار مقصد</label><select class="form-select"><option>هاب انبارداری مرکزی پایتخت (شورآباد)</option><option>سردخانه خاوران تبریز</option><option>هاب مکانیزه مورچه‌خورت اصفهان</option><option>پایانه کانتینری شهید رجایی بندرعباس</option></select></div>
                <div class="form-field"><label class="form-label">شرح محموله / کالا</label><input class="form-control" placeholder="مثال: قطعات الکترونیک سرور" required></div>
                <div class="grid grid--2"><div class="form-field"><label class="form-label">تعداد پالت</label><input class="form-control" type="number" value="24"></div><div class="form-field"><label class="form-label">شماره بارنامه</label><input class="form-control" placeholder="BL-99201"></div></div>
                <div class="form-field"><label class="form-label">راننده و خودرو</label><input class="form-control" placeholder="نام راننده و شماره پلاک"></div>
              </form>
            `,
            footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-confirm-rc>ثبت رسید انبار</button>',
            onMount: (panel) => on($('[data-confirm-rc]', panel), 'click', () => { toast.success('رسید انبار ثبت شد', 'کد رسید RC-۱۰۸۴۳ صادر گردید.'); modal.closeTop(); }),
          });
        }
        if (e.target.closest('[data-outbound-dispatch]')) {
          modal.open({
            title: 'صدور حواله خروج کالا (Outbound Dispatch)',
            content: `
              <form class="form-stack">
                <div class="form-field"><label class="form-label">انبار مبدأ</label><select class="form-select"><option>هاب انبارداری مرکزی پایتخت</option><option>سردخانه خاوران تبریز</option><option>هاب مکانیزه اصفهان</option></select></div>
                <div class="form-field"><label class="form-label">مشتری / سفارش مقصد</label><input class="form-control" placeholder="نام مشتری یا شناسه سفارش ORD-..."></div>
                <div class="grid grid--2"><div class="form-field"><label class="form-label">تعداد پالت خروجی</label><input class="form-control" type="number" value="12"></div><div class="form-field"><label class="form-label">داک بارگیری</label><select class="form-select"><option>داک شماره ۴</option><option>داک شماره ۸</option><option>داک شماره ۱۲</option></select></div></div>
              </form>
            `,
            footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-confirm-disp>تأیید و صدور حواله</button>',
            onMount: (panel) => on($('[data-confirm-disp]', panel), 'click', () => { toast.success('حواله خروج صادر شد', 'مجوز خروج WH-۹۹۰۱۵ به داک بارگیری ارسال شد.'); modal.closeTop(); }),
          });
        }
        if (e.target.closest('[data-new-warehouse]')) {
          toast.info('تعریف انبار جدید', 'فرم تعریف هاب انبارداری باز شد.');
        }
      });
      exportable(node, 'warehouses');
      return;
    }

    case 'logistics/shipments.html': {
      const node = host();
      /**
       * All 40 shipments come from the service (12 per page would hide the
       * delayed ones), and the second card ranks the *carriers* by on-time
       * performance — the number logistics managers actually act on.
       */
      const { items, summary } = await services.shipmentService.list({ perPage: 100 });
      const statusMeta = (id) => summary?.statuses?.find((status) => status.id === id) ?? { id, label: id, tone: 'neutral' };
      const DAY = 86400000;
      const sorted = [...items].sort((a, b) => {
        const rank = (shipment) => (shipment.status === 'delayed' ? 0 : shipment.status === 'out-for-delivery' ? 1 : shipment.status === 'in-transit' ? 2 : 3);
        return rank(a) - rank(b) || new Date(a.eta) - new Date(b.eta);
      });
      const delayed = items.filter((item) => item.status === 'delayed');
      const inTransit = items.filter((item) => ['in-transit', 'out-for-delivery'].includes(item.status));
      const delivered = items.filter((item) => item.status === 'delivered');
      const costTotal = items.reduce((sum, item) => sum + (item.cost ?? 0), 0);
      const onTime = summary?.onTimeRate ?? 0;
      const avgCost = items.length ? Math.round(costTotal / items.length) : 0;
      const etaOf = (item) => {
        const days = Math.round((new Date(item.eta).getTime() - Date.now()) / DAY);
        if (item.status === 'delivered') return { tone: 'done', text: 'تحویل شد' };
        if (item.status === 'returned') return { tone: 'done', text: 'مرجوع شد' };
        if (days < 0) return { tone: 'late', text: `${toDigits(Math.abs(days))} روز تأخیر` };
        if (days === 0) return { tone: 'soon', text: 'امروز' };
        if (days === 1) return { tone: 'soon', text: 'فردا' };
        return { tone: days <= 3 ? 'soon' : 'ok', text: `${toDigits(days)} روز مانده` };
      };
      /** Steps of the delivery pipeline, mirrored from the seeded event list. */
      const steps = ['ثبت', 'انبار', 'سورتینگ', 'مسیر', 'تحویل'];
      const stepIndex = (item) => {
        if (item.status === 'delivered') return steps.length - 1;
        if (item.status === 'preparing') return 1;
        if (item.status === 'returned') return 2;
        return ['in-transit', 'delayed'].includes(item.status) ? 3 : 4;
      };
      const carriers = [...new Set(items.map((item) => item.carrier))].map((name) => {
        const rows = items.filter((item) => item.carrier === name);
        const late = rows.filter((item) => item.status === 'delayed').length;
        const done = rows.filter((item) => item.status === 'delivered').length;
        const performance = Math.round(((rows.length - late) / Math.max(1, rows.length)) * 100);
        return { name, count: rows.length, late, done, performance, avgCost: rows.reduce((sum, item) => sum + (item.cost ?? 0), 0) / Math.max(1, rows.length) };
      }).sort((a, b) => b.performance - a.performance);
      const peakCarrier = Math.max(1, ...carriers.map((carrier) => carrier.count));
      const statusCounts = (summary?.statuses ?? []).map((status) => ({ ...status, count: items.filter((item) => item.status === status.id).length })).filter((status) => status.count);
      const maxStatus = Math.max(1, ...statusCounts.map((status) => status.count));

      render(
        node,
        `<div class="dashboard-shell ship">
          ${pageHeader({
            title: 'محموله‌ها',
            subtitle: 'چرخه ارسال از انبار تا تحویل مشتری — با تفکیک وضعیت، حامل و تأخیرها',
            icon: 'truck',
            badges: [
              statusBadge(`${toDigits(inTransit.length)} در مسیر`, 'info'),
              delayed.length ? statusBadge(`${toDigits(delayed.length)} تأخیری`, 'warning') : statusBadge('بدون تأخیر', 'success'),
            ],
            actions: toolButtons({ create: 'محموله جدید', exportResource: 'shipments' }),
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'محموله فعال', value: toDigits(summary?.activeShipments ?? inTransit.length), meta: `${toDigits(items.length)} محموله در سامانه`, tone: 'primary', icon: 'truck', id: 'ship-active' })}
            ${statCard({ label: 'تحویل‌شده', value: toDigits(delivered.length), meta: `امروز ${toDigits(summary?.deliveredToday ?? 0)} تحویل`, tone: 'success', icon: 'check2-circle', id: 'ship-done' })}
            ${statCard({ label: 'تأخیری', value: toDigits(delayed.length), meta: delayed.length ? 'نیازمند تماس با حامل' : 'همه محموله‌ها طبق برنامه', tone: delayed.length ? 'danger' : 'success', icon: 'alarm', id: 'ship-late' })}
            ${statCard({ label: 'تحویل به‌موقع', value: `${toDigits(onTime)}٪`, meta: `میانگین هزینه ${escapeHtml(formatCurrency(avgCost, 'IRR', { compact: true }))} هر محموله`, tone: 'info', icon: 'stopwatch', id: 'ship-ontime' })}
          </div>

          <div class="widget-grid">
            ${card({
              span: 12,
              className: 'ship-table-card',
              icon: 'box-seam',
              title: 'پیگیری محموله‌ها',
              subtitle: 'تأخیری‌ها در صدر فهرست — روی هر ردیف برای جزئیات رهگیری کلیک کنید',
              flush: true,
              body: `<div class="table-wrap">
                <table class="table table--hover ship-table">
                  <thead><tr><th>کد رهگیری</th><th>مقصد</th><th>وضعیت</th><th>پیشرفت</th><th>زمان تخمینی</th><th class="text-end">کرایه</th><th></th></tr></thead>
                  <tbody>${sorted
                    .map((shipment) => {
                      const meta = statusMeta(shipment.status);
                      const eta = etaOf(shipment);
                      const index = stepIndex(shipment);
                      return `<tr data-shipment="${escapeHtml(shipment.id)}" data-tracking="${escapeHtml(shipment.tracking)}" data-status="${escapeHtml(shipment.status)}">
                        <td>
                          <button type="button" class="ship-code" data-ship-track="${escapeHtml(shipment.tracking)}">${escapeHtml(shipment.tracking)}</button>
                          <span class="ship-code__sub">${escapeHtml(shipment.customer ?? '')}</span>
                        </td>
                        <td>
                          <span class="ship-route"><b>${escapeHtml(shipment.destination ?? '')}</b><small>${escapeHtml(shipment.origin ?? '')} → مقصد</small></span>
                        </td>
                        <td>
                          <span class="ship-status ship-status--${escapeHtml(meta.tone)}"><i class="ship-status__dot"></i>${escapeHtml(meta.label)}</span>
                          <span class="ship-carrier">${escapeHtml(shipment.carrier ?? '')}</span>
                        </td>
                        <td>
                          <span class="ship-steps" title="${toDigits(shipment.progress ?? 0)}٪">${steps
                            .map((step, stepIdx) => `<i class="${stepIdx <= index ? 'is-done' : ''}" title="${escapeHtml(step)}"></i>`)
                            .join('')}</span>
                          <span class="ship-steps__label">${escapeHtml(steps[index] ?? '')}</span>
                        </td>
                        <td>
                          <span class="ship-eta ship-eta--${eta.tone}"><i class="bi bi-calendar-event"></i>${escapeHtml(eta.text)}</span>
                          <span class="ship-eta__date">${escapeHtml(formatDate(shipment.eta, { format: 'short' }))}</span>
                        </td>
                        <td class="text-end numeric">${escapeHtml(formatCurrency(shipment.cost ?? 0, 'IRR', { compact: true }))}</td>
                        <td>
                          <div class="ship-row-actions">
                            <button type="button" class="icon-btn icon-btn--sm" data-ship-track="${escapeHtml(shipment.tracking)}" aria-label="رهگیری"><i class="bi bi-geo-alt"></i></button>
                            ${shipment.status === 'delivered' || shipment.status === 'returned' ? '' : `<button type="button" class="icon-btn icon-btn--sm" data-advance-shipment="${escapeHtml(shipment.id)}" aria-label="مرحله بعد"><i class="bi bi-arrow-left-right"></i></button>`}
                          </div>
                        </td>
                      </tr>`;
                    })
                    .join('')}</tbody>
                </table>
              </div>`,
            })}

            <div class="grid grid--cards ship-side">
              ${card({
                icon: 'building-up',
                title: 'عملکرد حامل‌ها',
                subtitle: `${toDigits(carriers.length)} حامل فعال روی ${toDigits(items.length)} محموله`,
                body: `<ul class="ship-carriers">${carriers
                  .map(
                    (carrier) => `<li class="ship-carriers__row">
                      <span class="ship-carriers__name">${escapeHtml(carrier.name)}<small>${toDigits(carrier.count)} محموله · میانگین ${escapeHtml(formatCurrency(carrier.avgCost, 'IRR', { compact: true }))}</small></span>
                      <span class="ship-carriers__bar"><i style="--w:${Math.round((carrier.count / peakCarrier) * 100)}%"></i></span>
                      <span class="ship-carriers__perf ship-carriers__perf--${carrier.performance >= 90 ? 'good' : carrier.performance >= 75 ? 'warn' : 'bad'}">${toDigits(carrier.performance)}٪</span>
                    </li>`,
                  )
                  .join('')}</ul>
                <p class="ship-carriers__note"><i class="bi bi-info-circle"></i> درصدها = سهم محموله‌های بدون تأخیر از کل محموله‌های آن حامل.</p>`,
              })}
              ${card({
                icon: 'pie-chart',
                title: 'ترکیب وضعیت‌ها',
                subtitle: `${toDigits(statusCounts.length)} وضعیت فعال در دوره`,
                body: `<ul class="ship-status-mix">${statusCounts
                  .map(
                    (status) => `<li class="ship-status-mix__row">
                      <span class="ship-status-mix__label"><i class="ship-status__dot ship-status__dot--${escapeHtml(status.tone)}"></i> ${escapeHtml(status.label)}</span>
                      <span class="ship-status-mix__bar"><i style="--w:${Math.round((status.count / maxStatus) * 100)}%"></i></span>
                      <b class="numeric">${toDigits(status.count)}</b>
                    </li>`,
                  )
                  .join('')}</ul>
                <div class="ship-cost">
                  <span>مجموع کرایه دوره</span>
                  <strong class="numeric">${escapeHtml(formatCurrency(costTotal, 'IRR', { compact: true }))}</strong>
                </div>`,
              })}
            </div>
          </div>
        </div>`,
      );

      /* ------------------------------------------------------------------- */
      on(node, 'click', async (event) => {
        const track = event.target.closest('[data-ship-track]');
        if (track) {
          const shipment = await services.shipmentActions.track(track.dataset.shipTrack);
          const events = shipment.timeline ?? shipment.events ?? [];
          modal.open({
            title: `رهگیری ${escapeHtml(shipment.tracking ?? '')}`,
            subtitle: `${escapeHtml(shipment.origin ?? '')} → ${escapeHtml(shipment.destination ?? '')} · ${escapeHtml(shipment.carrier ?? '')}`,
            size: 'md',
            content: `<div class="ship-track">
              <div class="ship-track__meta">
                ${infoRows([
                  ['وضعیت', statusBadge(shipment.statusLabel ?? shipment.status ?? '', shipment.tone ?? 'info')],
                  ['رانه/راننده', escapeHtml(shipment.driver ?? '—')],
                  ['وزن', escapeHtml(shipment.weight ?? '—')],
                  ['تعداد بسته', toDigits(shipment.packages ?? 0)],
                  ['مسافت', escapeHtml(shipment.distance ?? '—')],
                  ['زمان تخمینی', escapeHtml(formatDate(shipment.eta, { format: 'medium' }))],
                ])}
              </div>
              <ol class="ship-track__timeline">${events
                .map(
                  (step, index) => `<li class="ship-track__step${step.done ? ' is-done' : ''}${index === events.filter((s) => s.done).length - 1 ? ' is-current' : ''}">
                    <span class="ship-track__bullet"><i class="bi bi-${step.done ? 'check2' : 'circle'}" aria-hidden="true"></i></span>
                    <span class="ship-track__body"><b>${escapeHtml(step.label ?? '')}</b><small>${escapeHtml(formatDate(step.at, { format: 'medium' }))}</small></span>
                  </li>`,
                )
                .join('')}</ol>
            </div>`,
            footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button>',
          });
          return;
        }
        const button = event.target.closest('[data-advance-shipment]');
        if (!button) return;
        const row = button.closest('tr');
        button.classList.add('is-loading');
        try {
          const result = await services.shipmentActions.advance(button.dataset.advanceShipment);
          const meta = statusMeta(result.status);
          const statusCell = row?.querySelector('.ship-status');
          if (statusCell) {
            statusCell.className = `ship-status ship-status--${meta.tone}`;
            statusCell.innerHTML = `<i class="ship-status__dot"></i>${escapeHtml(result.statusLabel ?? meta.label)}`;
          }
          row?.setAttribute('data-status', result.status ?? '');
          toast.success('وضعیت محموله به‌روزرسانی شد', `وضعیت جدید: ${result.statusLabel ?? meta.label}`);
        } catch (error) {
          toast.danger('به‌روزرسانی نشد', error?.message ?? 'دوباره تلاش کنید.');
        } finally {
          button.classList.remove('is-loading');
        }
      });
      on($('[data-create]', node), 'click', () =>
        openRecordForm({ resource: 'shipments', title: 'محموله جدید', fields: crudFields('shipments'), onSaved: () => window.location.reload() }),
      );
      exportable(node, 'shipments');
      return;
    }

  }
}

/* =================================================================== Reports */

const REPORT_RANGES = [
  { value: '7d', label: '۷ روز' },
  { value: '30d', label: '۳۰ روز' },
  { value: '90d', label: '۹۰ روز' },
  { value: '12m', label: '۱۲ ماه' },
];

/** Charts have to be (re)drawn every time a report paints — including retries. */
function paintCharts(target) {
  initCharts(target);
}

/** Cell renderer for a report table: types come from the service contract. */
function reportCell(value, type) {
  if (value === null || value === undefined || value === '') return '<span class="text-muted">—</span>';
  switch (type) {
    case 'currency':
      return `<span class="numeric">${escapeHtml(formatCurrency(value, 'IRR', { compact: true }))}</span>`;
    case 'percent':
      return `<span class="numeric">${escapeHtml(formatPercent(Number(value) > 1 ? value : value * 100, { decimals: 1 }))}</span>`;
    case 'number':
      return `<span class="numeric">${escapeHtml(formatNumber(value))}</span>`;
    case 'delta': {
      const number = Number(value);
      const tone = number >= 0 ? 'success' : 'danger';
      return `<span class="text-${tone} numeric">${number >= 0 ? '▲' : '▼'} ${escapeHtml(formatNumber(Math.abs(number)))}</span>`;
    }
    case 'date':
      return `<span class="numeric">${escapeHtml(formatDate(value, { dateStyle: 'short' }))}</span>`;
    case 'badge':
      return statusBadge(String(value), badgeToneFor(String(value)));
    default:
      return escapeHtml(String(value));
  }
}

/** Maps a status-ish label onto the template's badge tones. */
function badgeToneFor(label) {
  const text = String(label).toLowerCase();
  if (/paid|delivered|won|active|resolved|completed|on-track|green|موفق|تکمیل|فعال|ارسال/.test(text)) return 'success';
  if (/pending|processing|trial|open|todo|in-progress|review|at-risk|amber|در انتظار|در حال|بررسی/.test(text)) return 'warning';
  if (/refund|cancel|overdue|lost|breach|delayed|terminated|unpaid|مرجوع|لغو|معوق|تأخیر|اخذ/.test(text)) return 'danger';
  return 'neutral';
}


async function initReports() {
  const page = kit.pageId();
  const type = page.split('/').pop().replace('.html', '');
  const node = host();
  if (!node) return;

  let range = new URLSearchParams(window.location.search).get('range') ?? '30d';

  const load = async () => {
    const report = await services.analyticsService.report(type, { range });
    const labels = report.labels ?? [];
    const series = report.series ?? [];
    const summary = report.totals ?? {};
    const summaryKeys = Object.keys(summary);
    return `<div class="dashboard-shell">
      ${pageHeader({
        title: report.title ?? 'گزارش',
        subtitle: `${report.text ?? ''} — آخرین به‌روزرسانی ${escapeHtml(relativeTime(report.generatedAt ?? new Date()))}`,
        icon: report.icon ?? 'bar-chart-line',
        actions: `<div class="segmented" data-report-range>${REPORT_RANGES.map(
          (item) => `<button type="button" class="segmented__item ${item.value === range ? 'is-active' : ''}" data-range="${item.value}">${item.label}</button>`,
        ).join('')}</div>
          ${toolButtons({ exportResource: type })}`,
      })}
      ${summaryKeys.length
        ? `<div class="kpi-row" data-reveal>${summaryKeys
            .slice(0, 4)
            .map((key, index) => {
              const value = summary[key];
              const isMoney = /revenue|inflow|outflow|net|ltv|average|fee|sold|stock/i.test(key);
              const isPercent = /rate|csat|churn|progress|onTime/i.test(key);
              const formatted = isMoney
                ? formatCurrency(value, 'IRR', { compact: true })
                : isPercent
                  ? `${formatNumber(value, { decimals: Number(value) < 100 ? 1 : 0 })}٪`
                  : formatNumber(value);
              const tones = ['primary', 'success', 'info', 'warning'];
              return `<article class="stat-card stat-card--${tones[index % 4]}">
                <div class="stat-card__head">
                  <span class="stat-card__label">${escapeHtml(reportLabels[key] ?? key)}</span>
                  <span class="stat-card__icon stat-card__icon--${tones[index % 4]}"><i class="bi bi-${index % 2 ? 'graph-up-arrow' : 'clipboard-data'}" aria-hidden="true"></i></span>
                </div>
                <p class="stat-card__value">${escapeHtml(formatted)}</p>
                <p class="stat-card__meta">در بازه انتخابی</p>
              </article>`;
            })
            .join('')}</div>`
        : ''}

      <div class="widget-grid">
        ${card({
          span: 8,
          title: 'روند دوره',
          subtitle: 'مقدار واقعی در برابر هدف — با تغییر بازه زمانی بالا به بالا به‌روز می‌شود',
          body: `<div class="chart" data-chart="${report.chartType ?? 'area'}" data-chart-height="340" data-chart-series='${JSON.stringify(series)}' data-chart-labels='${JSON.stringify(labels)}'></div>`,
        })}
        ${card({
          span: 4,
          title: 'تفکیک',
          subtitle: 'سهم هر گروه از کل',
          body: (report.breakdown ?? []).length
            ? `<div class="chart" data-chart="donut" data-chart-height="340" data-chart-series='${JSON.stringify((report.breakdown ?? []).map((row) => row.value))}' data-chart-labels='${JSON.stringify((report.breakdown ?? []).map((row) => row.label))}'></div>`
            : emptyState({ title: 'تفکیکی برای این بازه نیست', text: 'بازه دیگری را امتحان کنید.', icon: 'pie-chart' }),
        })}
        ${card({
          span: 12,
          title: 'جدول تفصیلی',
          subtitle: `${toDigits((report.rows ?? []).length)} رکورد — قابل مرتب‌سازی و خروجی`,
          flush: true,
          body: `<div data-export-table>${reportTable(report)}</div>`,
          actions: `<button class="btn btn-light btn-sm" type="button" data-report-copy><i class="bi bi-clipboard" aria-hidden="true"></i> کد جدول</button>
            <button class="btn btn-light btn-sm" type="button" data-report-print><i class="bi bi-printer" aria-hidden="true"></i> چاپ</button>`,
        })}
      </div>
    </div>`;
  };

  await withState(node, load, { skeleton: 'chart', title: 'گزارش', keepLast: false, onData: paintCharts });
  exportable(node, type);

  on(node, 'click', async (event) => {
    const preset = event.target.closest('[data-range]');
    if (preset) {
      range = preset.dataset.range;
      /* The chosen range is kept in the URL so a report can be shared or reloaded. */
      const url = new URL(window.location.href);
      url.searchParams.set('range', range);
      window.history.replaceState({}, '', url);
      await withState(node, load, { skeleton: 'chart', keepLast: true, onData: paintCharts });
      return;
    }
    if (event.target.closest('[data-report-print]')) {
      window.print();
      return;
    }
    if (event.target.closest('[data-report-copy]')) {
      const table = $('table', node);
      const text = table ? [...table.querySelectorAll('tr')].map((row) => [...row.children].map((cell) => cell.textContent.trim()).join('\t')).join('\n') : '';
      try {
        await navigator.clipboard.writeText(text);
        toast.success('کپی شد', 'جدول گزارش با جداساز ستون در کلیپ‌بورد است.');
      } catch {
        toast.warning('کپی ممکن نشد', 'دستی انتخاب کنید — مرورگر اجازه دسترسی به کلیپ‌بورد نداد.');
      }
    }
  });
}

const reportLabels = {
  revenue: 'درآمد',
  orders: 'سفارش‌ها',
  average: 'میانگین سبد',
  returns: 'مرجوعی',
  target: 'هدف',
  best: 'بهترین دوره',
  customers: 'مشتریان',
  new: 'مشتری جدید',
  ltv: 'ارزش هر مشتری',
  churn: 'نرخ ریزش',
  products: 'محصولات',
  sold: 'فروش رفته',
  stock: 'موجودی',
  outOfStock: 'ناموجود',
  inflow: 'واریز',
  outflow: 'برداشت',
  net: 'خالص',
  fee: 'کارمزد',
  projects: 'پروژه‌ها',
  onTrack: 'در مسیر',
  atRisk: 'در معرض خطر',
  avgProgress: 'میانگین پیشرفت',
  sessions: 'نشست‌ها',
  peak: 'اوج',
  pages: 'صفحه',
  bounce: 'نرخ پرش',
  volume: 'حجم تیکت',
  open: 'باز',
  breach: 'نقض SLA',
  csat: 'رضایت مشتری',
  shipments: 'محموله‌ها',
  delivered: 'تحویل شده',
  delayed: 'تأخیر',
  onTime: 'تحویل به‌موقع',
};

function reportTable(report) {
  const rows = report.rows ?? report.table ?? [];
  if (!rows.length) return emptyState({ title: 'داده تفصیلی برای این گزارش موجود نیست', text: 'برای مشاهده داده، بازه دیگری را انتخاب کنید.', icon: 'table' });
  const columns = report.columns ?? Object.keys(rows[0]).map((key) => ({ key, label: reportLabels[key] ?? key }));
  return `<div class="table-wrap"><table class="table table--hover table--compact"><thead><tr>${columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(
      (row) => `<tr>${columns
        .map((column) => `<td class="${column.type === 'text' ? '' : 'table__cell'}">${reportCell(row[column.key], column.type)}</td>`)
        .join('')}</tr>`,
    )
    .join('')}</tbody></table></div>`;
}

/* ===================================================================== Users */

/** Persian labels for the modules the permission matrix covers. */
const MODULE_LABELS = {
  users: 'کاربران',
  products: 'محصولات',
  orders: 'سفارش‌ها',
  invoices: 'صورت‌حساب‌ها',
  projects: 'پروژه‌ها',
  tickets: 'تیکت‌ها',
  reports: 'گزارش‌ها',
  settings: 'تنظیمات',
  inventory: 'انبار',
  shipments: 'محموله‌ها',
  payroll: 'حقوق و دستمزد',
  cms: 'مدیریت محتوا',
};

/** Icon for each permission verb in the matrix legend. */
const PERMISSION_ICONS = {
  view: 'eye',
  create: 'plus-circle',
  edit: 'pencil-square',
  delete: 'trash3',
  export: 'download',
  approve: 'check2-circle',
  impersonate: 'person-badge',
};

/** Human labels for the permission verbs the matrix speaks. */
const PERMISSION_LABELS = {
  view: 'مشاهده',
  create: 'ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
  export: 'خروجی گرفتن',
  approve: 'تأیید',
  impersonate: 'ورود به‌عنوان کاربر',
};

/** One-line explanation shown on each capability card. */
const PERMISSION_NOTES = {
  view: 'نمایش فهرست و جزئیات؛ کم‌خطرترین مجوز.',
  create: 'ساخت رکورد جدید در ماژول‌های مجاز.',
  edit: 'ویرایش رکوردهای موجود — روی ماتریس به‌عنوان دسترسی نوشتن شمارش می‌شود.',
  delete: 'حذف رکورد؛ در بیشتر نقش‌ها عمداً محدود شده است.',
  export: 'دریافت خروجی CSV و چاپ گزارش.',
  approve: 'تأیید درخواست‌ها (مرخصی، هزینه، بازگشت وجه).',
  impersonate: 'فقط برای تیم پشتیبانی و با ثبت در گزارش فعالیت.',
};

async function initUsers() {
  const page = kit.pageId();
  switch (page) {
    case 'users/grid.html': {
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);
      const [{ COLUMNS }, dialogs] = await Promise.all([import('../core/columns.js'), import('../core/record-dialogs.js')]);
      const service = services.userService;
      const PAGE = 12;
      const TONES = { active: 'success', invited: 'info', suspended: 'danger', inactive: 'secondary', pending: 'warning' };
      const state = { rows: [], q: '', status: '', role: '', shown: PAGE };
      const load = async () => {
        const { items } = await service.list({ perPage: 500 });
        state.rows = items;
      };
      await load();
      const roles = [...new Map(state.rows.map((u) => [u.role, u.roleLabel ?? u.role])).entries()];
      const statuses = [...new Set(state.rows.map((u) => u.status))];
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'نمایش شبکه‌ای کاربران', subtitle: 'کارت پروفایل هر عضو با نقش، تیم، وضعیت و عملکرد', icon: 'grid-3x3-gap', actions: toolButtons({ create: 'کاربر جدید', exportResource: 'users' }) })}
          <section class="card user-grid__toolbar" data-reveal>
            <div class="card__body">
              <label class="user-grid__search"><i class="bi bi-search" aria-hidden="true"></i><input class="form-control" type="search" placeholder="جستجوی نام، ایمیل یا تیم…" data-ug-search aria-label="جستجو"></label>
              <select class="form-select" data-ug-status aria-label="وضعیت"><option value="">همه وضعیت‌ها</option>${statuses.map((st) => `<option value="${escapeHtml(st)}">${escapeHtml(dialogs.statusLabel(st))}</option>`).join('')}</select>
              <select class="form-select" data-ug-role aria-label="نقش"><option value="">همه نقش‌ها</option>${roles.map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join('')}</select>
              <span class="badge badge--soft-primary rounded-pill user-grid__count" data-ug-count></span>
            </div>
          </section>
          <div class="user-grid" data-ug-list aria-live="polite"></div>
          <div class="user-grid__more"><button type="button" class="btn btn-light" data-ug-more><i class="bi bi-arrow-down-circle"></i> نمایش کاربران بیشتر</button></div>
        </div>`,
      );
      const list = $('[data-ug-list]', node);
      const more = $('[data-ug-more]', node);
      const filtered = () => {
        const q = state.q.trim().toLowerCase();
        return state.rows.filter(
          (u) =>
            (!state.status || u.status === state.status) &&
            (!state.role || u.role === state.role) &&
            (!q || [u.name, u.email, u.team, u.roleLabel].some((v) => String(v ?? '').toLowerCase().includes(q))),
        );
      };
      const cardHtml = (u) => `<article class="user-card" data-id="${escapeHtml(u.id)}">
          <div class="user-card__cover" aria-hidden="true"></div>
          <div class="user-card__head">
            <span class="user-card__avatar"><img src="${escapeHtml(u.avatar)}" alt="" loading="lazy" width="64" height="64"><i class="user-card__dot user-card__dot--${escapeHtml(u.status)}"></i></span>
            <div class="user-card__id">
              <h3 class="user-card__name"><a href="${url(`users/details.html?id=${encodeURIComponent(u.id)}`)}">${escapeHtml(u.name)}</a></h3>
              <p class="user-card__mail" dir="ltr">${escapeHtml(u.email)}</p>
            </div>
          </div>
          <div class="user-card__tags">
            <span class="badge badge--soft-primary">${escapeHtml(u.roleLabel ?? u.role)}</span>
            ${statusBadge(dialogs.statusLabel(u.status), TONES[u.status] ?? 'secondary')}
            ${u.twoFactor ? '<span class="badge badge--soft-success" title="ورود دو مرحله‌ای فعال"><i class="bi bi-shield-check"></i> 2FA</span>' : ''}
          </div>
          <dl class="user-card__stats">
            <div><dt>تیم</dt><dd>${escapeHtml(u.team ?? '—')}</dd></div>
            <div><dt>پروژه</dt><dd class="numeric">${toDigits(u.projects ?? 0)}</dd></div>
            <div><dt>کار انجام‌شده</dt><dd class="numeric">${toDigits(u.tasksDone ?? 0)}</dd></div>
          </dl>
          <div class="user-card__progress" title="تکمیل پروفایل">
            <div class="d-flex justify-content-between fs-sm"><span class="text-muted">تکمیل پروفایل</span><span class="numeric">${toDigits(u.progress ?? 0)}٪</span></div>
            <div class="progress progress--sm"><div class="progress-bar" style="width:${Number(u.progress) || 0}%"></div></div>
          </div>
          <footer class="user-card__foot">
            <span class="fs-sm text-muted"><i class="bi bi-clock-history"></i> ${escapeHtml(relativeTime(u.lastActive))}</span>
            <div class="user-card__actions">
              <a class="btn btn-icon btn-light btn-sm" href="${url(`users/details.html?id=${encodeURIComponent(u.id)}`)}" aria-label="مشاهده ${escapeHtml(u.name)}" title="مشاهده"><i class="bi bi-eye"></i></a>
              <button type="button" class="btn btn-icon btn-light btn-sm" data-ug-edit aria-label="ویرایش ${escapeHtml(u.name)}" title="ویرایش"><i class="bi bi-pencil"></i></button>
              <button type="button" class="btn btn-icon btn-light btn-sm text-danger" data-ug-delete aria-label="حذف ${escapeHtml(u.name)}" title="حذف"><i class="bi bi-trash3"></i></button>
            </div>
          </footer>
        </article>`;
      const paintGrid = () => {
        const rows = filtered();
        const visible = rows.slice(0, state.shown);
        $('[data-ug-count]', node).textContent = `${toDigits(rows.length)} کاربر`;
        list.innerHTML = visible.length
          ? visible.map(cardHtml).join('')
          : emptyState({ title: 'کاربری با این فیلتر پیدا نشد', text: 'عبارت جستجو یا فیلترها را تغییر دهید.', icon: 'people' });
        more.parentElement.hidden = rows.length <= state.shown;
      };
      const reload = async () => {
        await load();
        paintGrid();
      };
      let timer;
      on($('[data-ug-search]', node), 'input', (event) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          state.q = event.target.value;
          state.shown = PAGE;
          paintGrid();
        }, 180);
      });
      on($('[data-ug-status]', node), 'change', (event) => {
        state.status = event.target.value;
        state.shown = PAGE;
        paintGrid();
      });
      on($('[data-ug-role]', node), 'change', (event) => {
        state.role = event.target.value;
        state.shown = PAGE;
        paintGrid();
      });
      on(more, 'click', () => {
        state.shown += PAGE;
        paintGrid();
      });
      on(list, 'click', async (event) => {
        const cardNode = event.target.closest('.user-card');
        if (!cardNode) return;
        const record = state.rows.find((u) => String(u.id) === cardNode.dataset.id);
        if (!record) return;
        if (event.target.closest('[data-ug-edit]')) {
          dialogs.openRecordEdit({ record, columns: COLUMNS.users, service, rows: state.rows, resource: 'users', onSaved: reload });
        } else if (event.target.closest('[data-ug-delete]')) {
          const ok = await modal.confirm({ title: 'حذف کاربر', text: `حساب «${record.name}» و نشست‌های فعال آن حذف می‌شود.`, tone: 'danger', confirmText: 'حذف کاربر' });
          if (!ok) return;
          await service.remove(record.id);
          toast.success('کاربر حذف شد', record.name);
          reload();
        }
      });
      on($('[data-create]', node), 'click', () => {
        const blank = { name: '', email: '', phone: '', role: roles[0]?.[0] ?? 'viewer', team: state.rows[0]?.team ?? '', status: 'invited', twoFactor: false };
        dialogs.openRecordEdit({ record: blank, columns: COLUMNS.users, service, rows: state.rows, resource: 'users', isNew: true, onSaved: reload });
      });
      exportable(node, 'users');
      paintGrid();
      return;
    }

    case 'users/create.html': {
      const node = host();
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'افزودن کاربر', subtitle: 'اطلاعات حساب، نقش دسترسی و تیم', icon: 'person-plus', actions: '<a class="btn btn-light" href="users/list.html">بازگشت</a>' })}
          ${card({
            body: `<form data-user-form novalidate>
              ${formMarkup([
                { name: 'name', label: 'نام و نام خانوادگی', required: true },
                { name: 'email', label: 'ایمیل سازمانی', type: 'email', rule: 'email', required: true },
                { name: 'phone', label: 'تلفن همراه', rule: 'phone', hint: 'مثال: ۰۹۱۲۳۴۵۶۷۸۹' },
                { name: 'nationalId', label: 'کد ملی', rule: 'nationalId' },
                { name: 'role', label: 'نقش', type: 'select', options: [{ value: 'admin', label: 'مدیر' }, { value: 'editor', label: 'ویرایشگر' }, { value: 'support', label: 'پشتیبان' }, { value: 'viewer', label: 'بازدیدکننده' }], required: true },
                { name: 'team', label: 'تیم', type: 'select', options: ['فروش', 'پشتیبانی', 'فنی', 'مالی', 'بازاریابی'] },
                { name: 'password', label: 'گذرواژه', type: 'password', rule: 'password', min: 8, required: true, hint: 'حداقل ۸ کاراکتر شامل حرف و رقم' },
                { name: 'confirm', label: 'تکرار گذرواژه', type: 'password', match: 'password', required: true },
                { name: 'twoFactor', label: 'اجبار ورود دو مرحله‌ای', type: 'switch', hint: 'برای همه نشست‌های این کاربر فعال می‌شود.' },
                { name: 'bio', label: 'معرفی کوتاه', type: 'textarea', col: 2, rows: 3 },
              ])}
              <div class="form-actions form-actions--end"><button type="reset" class="btn btn-light">پاک کردن</button><button type="submit" class="btn btn-primary" data-submit>ایجاد کاربر و ارسال دعوت‌نامه</button></div>
            </form>`,
          })}
        </div>`,
      );
      const form = $('[data-user-form]', node);
      on(form, 'submit', async (event) => {
        event.preventDefault();
        const { validateForm } = await import('../core/form.js');
        if (!validateForm(form).valid) {
          toast.warning('فرم کامل نیست', 'خطاهای مشخص‌شده را برطرف کنید.');
          return;
        }
        const values = collectValues(form);
        delete values.confirm;
        const button = $('[data-submit]', form);
        button.classList.add('is-loading');
        try {
          await services.userService.create({ ...values, status: 'invited' });
          toast.success('کاربر ایجاد شد', 'دعوت‌نامه به ایمیل کاربر ارسال شد.');
          setTimeout(() => goTo('users/list.html'), 900);
        } finally {
          button.classList.remove('is-loading');
        }
      });
      return;
    }

    case 'users/details.html': {
      const id = queryParam('id');
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(3)}</div>`);
      const user = await loadRecord('users', id);
      if (!user) {
        render(node, kit.errorState('کاربر مورد نظر پیدا نشد'));
        return;
      }
      const activity = await services.activityService.forResource('users', user.id);
      render(
        node,
        `<div class="dashboard-shell">
          <!-- User Profile Hero Header -->
          <div class="card mb-4" style="border-radius:24px; overflow:hidden; border:1px solid var(--nv-border); box-shadow:var(--nv-shadow-sm);">
            <div style="height:140px; background:linear-gradient(135deg, var(--nv-primary) 0%, #8b5cf6 50%, #06b6d4 100%); position:relative;">
              <div style="position:absolute; inset:0; background:radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 60%); pointer-events:none;"></div>
            </div>
            <div class="card__body" style="padding:0 28px 24px; margin-top:-52px; display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:20px; position:relative;">
              <div style="display:flex; align-items:flex-end; gap:20px; flex-wrap:wrap;">
                <div style="position:relative; width:96px; height:96px; border-radius:26px; padding:3px; background:linear-gradient(135deg, var(--nv-primary) 0%, #a855f7 50%, #06b6d4 100%); box-shadow:0 12px 28px -6px rgba(99,102,241,0.4); flex-shrink:0;">
                  <img class="profile-head__avatar" src="${url(user.avatar || safeAvatar(1))}" style="width:100%; height:100%; border-radius:23px; object-fit:cover; background:var(--nv-surface); display:block; border:3px solid var(--nv-surface);" alt="${escapeHtml(user.name)}">
                  <span style="position:absolute; bottom:-2px; left:-2px; width:18px; height:18px; border-radius:50%; background:#10b981; border:3px solid var(--nv-surface); box-shadow:0 0 0 2px rgba(16,185,129,0.3);" title="آنلاین و فعال"></span>
                </div>
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <h1 style="margin:0; font-size:20px; font-weight:900; color:var(--nv-heading); letter-spacing:-0.02em;">${escapeHtml(user.name)}</h1>
                    <span class="badge badge--soft-primary" style="font-size:11px; padding:3px 10px; border-radius:999px; display:inline-flex; align-items:center; gap:4px;">
                      <i class="bi bi-patch-check-fill text-primary" style="font-size:12px;"></i> تاییدشده
                    </span>
                    <span class="badge badge--soft-${user.status==='active'?'success':'warning'}" style="font-size:11px;">${statusBadge(user.statusLabel ?? user.status, user.status === 'active' ? 'success' : 'warning')}</span>
                  </div>
                  <p style="margin:6px 0 0; font-size:12px; color:var(--nv-text-muted); display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span><i class="bi bi-shield-check text-primary"></i> ${escapeHtml(user.roleLabel ?? user.role ?? 'کاربر ارشد')}</span>
                    <span>•</span>
                    <span><i class="bi bi-envelope"></i> ${escapeHtml(user.email)}</span>
                    <span>•</span>
                    <span><i class="bi bi-people"></i> ${escapeHtml(user.team ?? 'تیم عملیات پلتفرم')}</span>
                  </p>
                </div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-light btn-sm" type="button" data-reset-password style="border-radius:10px; font-weight:700;"><i class="bi bi-key"></i> بازنشانی گذرواژه</button>
                <button class="btn btn-primary btn-sm" type="button" data-edit-user style="border-radius:10px; font-weight:700;"><i class="bi bi-pencil"></i> ویرایش پروفایل</button>
              </div>
            </div>
          </div>

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'پروژه‌های تحت نظارت', value: toDigits(6), hint: '۲ پروژه اسپرینت جاری', tone: 'primary', icon: 'kanban' })}
            ${statCard({ label: 'وظایف تکمیل‌شده', value: toDigits(142), hint: '۹۸٫۶٪ نرخ موفقیت SLA', tone: 'success', icon: 'check2-all' })}
            ${statCard({ label: 'مجوزهای دسترسی', value: toDigits(user.permissions ?? 18), hint: 'سطح دسترسی پیشرفته', tone: 'info', icon: 'shield-lock' })}
            ${statCard({ label: 'مدت عضویت', value: '۲ سال', hint: formatDate(user.joinedAt ?? user.createdAt, { format: 'short' }), tone: 'warning', icon: 'calendar-check' })}
          </div>

          <div class="grid grid--sidebar">
            <div class="card" style="border-radius:18px;">
              <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border);">
                <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">اطلاعات تماس و سازمانی</h3>
              </div>
              <div class="card__body" style="padding:20px;">
                ${infoRows([
                  ['شناسه یکتای حساب', user.id],
                  ['ایمیل سازمانی', user.email],
                  ['شماره تماس همراه', user.phone ?? '۰۹۱۲۳۴۵۶۷۸۹'],
                  ['تیم تخصصی', user.team ?? 'تیم هسته پلتفرم'],
                  ['آخرین فعالیت برخط', relativeTime(user.lastActive)],
                  ['تاریخ پیوستن به سامانه', formatDate(user.joinedAt ?? user.createdAt, { format: 'long' })],
                  ['احراز هویت دو مرحله‌ای (2FA)', user.twoFactor ? 'فعال (پیامک و TOTP)' : 'غیرفعال'],
                ])}
              </div>
            </div>

            <div class="stack">
              ${card({
                title: 'تاریخچه فعالیت‌های اخیر کاربر',
                icon: 'activity',
                body: timeline(activity.slice(0, 6).map((item) => ({ title: item.title, text: item.text, time: relativeTime(item.at), tone: item.tone ?? 'primary', icon: item.icon ?? 'activity' })), { compact: true })
              })}
              ${card({
                title: 'نشست‌های فعال و دستگاه‌های متصل',
                icon: 'laptop',
                flush: true,
                body: `<ul class="list-group" data-session-list>${kit.skeleton(2)}</ul>`
              })}
            </div>
          </div>
        </div>`,
      );
      const sessions = await services.sessionService.list();
      render(
        $('[data-session-list]', node),
        (sessions.items ?? sessions)
          .slice(0, 4)
          .map(
            (session, idx) => `<li class="list-item" data-session="${escapeHtml(session.id)}" style="padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="tile tile--soft tile--icon tile--soft-${idx === 0 ? 'primary' : 'secondary'}" style="width:38px; height:38px; border-radius:10px; display:grid; place-items:center;">
                  <i class="bi bi-${session.device === 'موبایل' || String(session.device).includes('iPhone') ? 'phone' : 'laptop'}"></i>
                </span>
                <div>
                  <div style="font-weight:700; font-size:13px; color:var(--nv-heading);">${escapeHtml(session.browser ?? 'Google Chrome')} • ${escapeHtml(session.device ?? 'دسکتاپ')} ${idx === 0 ? '<span class="badge badge--soft-primary" style="font-size:10px; margin-inline-start:4px;">دستگاه فعلی</span>' : ''}</div>
                  <div style="font-size:11px; color:var(--nv-text-muted); margin-top:2px;">نشانی IP: <span style="direction:ltr; display:inline-block; font-family:var(--nv-font-mono);">${escapeHtml(session.ip ?? '185.190.22.4')}</span> (${escapeHtml(session.location ?? 'تهران، ایران')})</div>
                </div>
              </div>
              <span class="list-item__meta"><button class="btn btn-ghost btn-sm text-danger" type="button" data-revoke style="font-size:11px;">خروج دستگاه</button></span>
            </li>`,
          )
          .join(''),
      );
      on($('[data-session-list]', node), 'click', async (event) => {
        const revoke = event.target.closest('[data-revoke]');
        if (!revoke) return;
        await services.sessionService.revoke(revoke.closest('[data-session]').dataset.session);
        revoke.closest('[data-session]').remove();
        toast.success('نشست پایان یافت', 'دسترسی این دستگاه با موفقیت بسته شد.');
      });
      on($('[data-reset-password]', node), 'click', async () => {
        const ok = await modal.confirm({ title: 'بازنشانی گذرواژه کاربر', text: `یک پیوند امن ایجاد گذرواژه جدید برای «${user.email}» ارسال می‌شود.`, tone: 'warning', confirmText: 'ارسال ایمیل بازنشانی' });
        if (ok) toast.success('پیوند ارسال شد', `ایمیل حاوی توکن بازنشانی به ${user.email} فرستاده شد.`);
      });
      on($('[data-edit-user]', node), 'click', () => openRecordForm({ resource: 'users', id: user.id, title: 'ویرایش مشخصات کاربر', fields: crudFields('users'), onSaved: () => window.location.reload() }));
      return;
    }

    case 'users/roles.html': {
      const node = host();
      const matrix = await services.roleService.matrix();
      const rolesList = [
        { id: 'super_admin', label: 'مدیر کل سامانه (Super Administrator)', users: 1, coverage: 100, tone: 'danger', icon: 'shield-fill-check', desc: 'دسترسی نامحدود و سطح روت به تمام ماژول‌ها، تنظیمات امنیتی، پرداخت‌ها و سرور', members: [1], capabilities: ['مدیریت دیتابیس و پشتیبان‌گیری', 'تعریف و لغو تمام نقش‌ها', 'تایید پرداخت‌ها و دسترسی به درگاه', 'مشاهده لاگ‌های جامع ممیزی'] },
        { id: 'operations_lead', label: 'مدیر عملیات و لجستیک (Operations Lead)', users: 4, coverage: 85, tone: 'primary', icon: 'truck', desc: 'نظارت کامل بر ناوگان خودرویی، انبارها، اعزام رانندگان و رهگیری زنده محموله‌ها', members: [2, 3, 4, 5], capabilities: ['دیسپچ و اعزام رانندگان جدید', 'تخصیص ظرفیت انبارها و سردخانه‌ها', 'صدور بارنامه و حواله‌های خروج', 'مدیریت هشدارهای سنسورهای IoT'] },
        { id: 'finance_manager', label: 'مدیر مالی و حسابداری (Finance Lead)', users: 3, coverage: 75, tone: 'success', icon: 'cash-stack', desc: 'مدیریت چرخه فاکتورها، تراکنش‌های بانکی، تسویه حساب‌ها و گزارشات مالیاتی', members: [6, 7, 8], capabilities: ['صدور و ابطال پیش‌فاکتورها', 'تسویه حساب نماینده‌های فروش', 'دریافت خروجی گزارشات دارایی', 'مدیریت کیف پول و بدهی مشتریان'] },
        { id: 'cms_editor', label: 'مدیر محصول و محتوا (Content Lead)', users: 6, coverage: 65, tone: 'info', icon: 'pencil-square', desc: 'تولید و انتشار مقالات، برگه‌ها، کاتالوگ محصولات، مدیریت رسانه و پاسخ به دیدگاه‌ها', members: [9, 10, 11, 12], capabilities: ['انتشار نوشته‌ها و صفحات وب', 'پاسخ و تایید دیدگاه‌های کاربران', 'دسته‌بندی و برچسب‌گذاری محصولات', 'مدیریت کتابخانه تصاویر و فایل‌ها'] },
        { id: 'support_agent', label: 'کارشناس ارشد پشتیبانی (Support Specialist)', users: 12, coverage: 40, tone: 'warning', icon: 'headset', desc: 'پاسخگویی به تیکت‌های پشتیبانی، گفتگوی زنده با مشتریان و پیگیری مرجوعی‌ها', members: [13, 14, 15, 16], capabilities: ['پاسخ به تیکت‌های دریافتی مشتریان', 'مشاهده تاریخچه سفارشات مشتری', 'چت آنلاین تیمی و مشتریان', 'تغییر وضعیت تیکت به حل‌شده'] },
        { id: 'security_auditor', label: 'حسابرس امنیتی (Security Auditor)', users: 2, coverage: 30, tone: 'violet', icon: 'eye-fill', desc: 'دسترسی فقط‌خواندنی به رویدادهای ورود، لاگ‌های ممیزی و نشست‌های فعال کاربران', members: [17, 18], capabilities: ['مشاهده لاگ‌های امنیتی تغییرناپذیر', 'بررسی تغییرات سطوح دسترسی', 'مانیتورینگ آدرس‌های IP مشکوک', 'دریافت خروجی گزارشات بازرسی'] },
      ];

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'نقش‌ها و سطوح دسترسی کاربران',
            subtitle: 'مدیریت و پیکربندی نقش‌های اداری، تفکیک وظایف و تخصیص صلاحیت‌ها به پرسنل',
            icon: 'shield-lock-fill',
            actions: '<button class="btn btn-primary" type="button" data-create-role><i class="bi bi-plus-lg"></i> تعریف نقش جدید</button>',
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'نقش‌های سازمانی فعال', value: toDigits(rolesList.length), hint: '۶ نقش استاندارد تفکیک‌شده', tone: 'primary', icon: 'shield-check' })}
            ${statCard({ label: 'کل پرسنل دارای نقش', value: toDigits(rolesList.reduce((s, r) => s + r.users, 0)), hint: 'کاربران فعال سامانه', tone: 'info', icon: 'people-fill' })}
            ${statCard({ label: 'ماژول‌های تحت حفاظت', value: toDigits(matrix.modules?.length ?? 12), hint: 'تفکیک دسترسی خواندن/نوشتن', tone: 'success', icon: 'grid-3x3-gap-fill' })}
            ${statCard({ label: 'نوع مجوزهای انفرادی', value: toDigits(matrix.permissions?.length ?? 8), hint: 'view, create, edit, delete...', tone: 'warning', icon: 'key-fill' })}
          </div>

          <div class="grid grid--3 mb-4" style="gap:20px;">
            ${rolesList.map(r => `
              <div class="card" style="border-radius:18px; border:1px solid var(--nv-border); background:var(--nv-surface); display:flex; flex-direction:column;">
                <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border); display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span class="tile tile--soft tile--icon tile--soft-${r.tone || 'primary'}" style="width:42px; height:42px; border-radius:12px; display:grid; place-items:center; flex-shrink:0;">
                      <i class="bi bi-${r.icon}" style="font-size:1.25rem;"></i>
                    </span>
                    <div>
                      <h3 class="card__title" style="margin:0 0 2px; font-size:14px; font-weight:800;">${r.label.split('(')[0].trim()}</h3>
                      <code dir="ltr" title="شناسه سیستمی نقش" style="font-size:11px; color:var(--nv-text-muted); font-family:var(--nv-font-mono); background:none; padding:0;">${r.id}</code>
                    </div>
                  </div>
                  <span class="badge badge--soft-${r.tone} rounded-pill" style="font-size:11px;">${toDigits(r.users)} کاربر</span>
                </div>

                <div class="card__body" style="padding:18px 20px; flex:1; display:flex; flex-direction:column;">
                  <p style="font-size:12px; color:var(--nv-text-muted); line-height:1.7; margin:0 0 14px;">${r.desc}</p>

                  <div style="margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px;">
                      <span style="color:var(--nv-text-muted);">پوشش دسترسی به ماژول‌ها</span>
                      <strong class="numeric" style="color:var(--nv-primary); font-weight:800;">${toDigits(r.coverage)}٪</strong>
                    </div>
                    <div class="progress progress--sm" style="height:6px; border-radius:999px;">
                      <div class="progress-bar ${r.coverage === 100 ? 'bg-danger' : r.coverage > 70 ? 'bg-primary' : 'bg-info'}" style="width:${r.coverage}%"></div>
                    </div>
                  </div>

                  <div style="font-size:11px; font-weight:700; color:var(--nv-heading); margin-bottom:8px;">اختیارات کلیدی این نقش:</div>
                  <ul style="list-style:none; padding:0; margin:0 0 16px; display:flex; flex-direction:column; gap:6px; flex:1;">
                    ${r.capabilities.map(cap => `
                      <li style="font-size:11px; color:var(--nv-text); display:flex; align-items:center; gap:6px;">
                        <i class="bi bi-check-circle-fill" style="color:var(--nv-success); font-size:12px;"></i>
                        <span>${cap}</span>
                      </li>
                    `).join('')}
                  </ul>

                  <div style="display:flex; align-items:center; justify-content:space-between; padding-top:14px; border-top:1px solid var(--nv-border);">
                    <div style="display:flex; margin-inline-start:6px;">
                      ${r.members.map(m => `<img src="${safeAvatar(m)}" style="width:30px; height:30px; border-radius:50%; border:2px solid var(--nv-surface); margin-inline-start:-8px; object-fit:cover;" alt="">`).join('')}
                    </div>
                    <div style="display:flex; gap:6px;">
                      <a class="btn btn-sm btn-light" href="users/permissions.html" style="font-size:11px; padding:4px 10px;">مجوزها</a>
                      <button class="btn btn-sm btn-soft-primary" type="button" data-edit-role="${r.id}" style="font-size:11px; padding:4px 10px;">ویرایش نقش</button>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          ${card({
            title: 'ماتریس تطبیق سریع نقش‌ها و ماژول‌های سامانه',
            subtitle: 'نمای کلی دسترسی نقش‌های فعال به تفکیک ماژول‌های سازمانی',
            flush: true,
            body: `<div class="table-responsive"><table class="table table--hover table--bordered">
              <thead>
                <tr>
                  <th>ماژول سیستمی</th>
                  ${rolesList.map(r => `<th class="text-center" style="font-size:12px;">${r.label.split('(')[0].trim()}<span class="table__primary-sub">${toDigits(r.users)} کاربر</span></th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${['داشبوردها و آمار', 'فروشگاه و سفارشات', 'مدیریت مشتریان و CRM', 'امور مالی و پیش‌فاکتورها', 'پروژه‌ها و تسک‌ها', 'تیکت‌های پشتیبانی', 'لجستیک و ناوگان', 'مدیریت کاربران و نقش‌ها', 'تنظیمات سیستم و API'].map((mod, i) => `
                  <tr>
                    <td style="font-weight:700;">${mod}</td>
                    <td class="text-center"><span class="badge badge--soft-success"><i class="bi bi-check2"></i> کامل</span></td>
                    <td class="text-center">${[0, 6].includes(i) ? '<span class="badge badge--soft-success"><i class="bi bi-check2"></i> کامل</span>' : '<span class="badge badge--soft-light text-muted">فقط خواندن</span>'}</td>
                    <td class="text-center">${[0, 3].includes(i) ? '<span class="badge badge--soft-success"><i class="bi bi-check2"></i> کامل</span>' : '<span class="badge badge--soft-light text-muted">—</span>'}</td>
                    <td class="text-center">${[0, 1, 4].includes(i) ? '<span class="badge badge--soft-success"><i class="bi bi-check2"></i> ویرایش</span>' : '<span class="badge badge--soft-light text-muted">—</span>'}</td>
                    <td class="text-center">${[0, 2, 5].includes(i) ? '<span class="badge badge--soft-info"><i class="bi bi-check2"></i> پاسخ</span>' : '<span class="badge badge--soft-light text-muted">—</span>'}</td>
                    <td class="text-center"><span class="badge badge--soft-warning"><i class="bi bi-eye"></i> فقط خواندن</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table></div>`
          })}
        </div>`,
      );

      on(node, 'click', (e) => {
        if (e.target.closest('[data-create-role]')) {
          modal.open({
            title: 'تعریف نقش سازمانی جدید',
            content: `
              <form class="form-stack">
                <div class="form-field"><label class="form-label">عنوان نقش *</label><input class="form-control" placeholder="مثال: کارشناس ارشد انبارداری" required></div>
                <div class="form-field"><label class="form-label">شناسه یکتا (Slug)</label><input class="form-control" placeholder="warehouse_specialist" style="direction:ltr;"></div>
                <div class="form-field"><label class="form-label">توضیح مأموریت و اختیارات نقش</label><textarea class="form-control" rows="2" placeholder="شرح وظایف این نقش..."></textarea></div>
                <div class="form-field"><label class="form-label">الگوبرداری دسترسی از نقش</label><select class="form-select"><option>مدیر عملیات و لجستیک</option><option>کارشناس پشتیبانی</option><option>مدیر مالی</option></select></div>
              </form>
            `,
            footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-save-new-role>ایجاد و ذخیره نقش</button>',
            onMount: (panel) => on($('[data-save-new-role]', panel), 'click', () => { toast.success('نقش جدید ایجاد شد', 'می‌توانید مجوزهای تکمیلی را در صفحه مجوزها اختصاص دهید.'); modal.closeTop(); }),
          });
        }
        const editBtn = e.target.closest('[data-edit-role]');
        if (editBtn) {
          toast.info('ویرایش نقش', `تنظیمات نقش ${editBtn.dataset.editRole} باز شد.`);
        }
      });
      exportable(node, 'roles');
      return;
    }

    case 'users/permissions.html': {
      const node = host();
      const [matrix, userList] = await Promise.all([services.roleService.matrix(), services.userService.list({ perPage: 200 })]);
      /** Role → number of accounts, so chips and the summary show real figures. */
      const userCount = (roleId) => (userList.items ?? userList).filter((user) => user.role === roleId).length;
      const modules = matrix.modules.map((module) => (typeof module === 'string' ? { id: module, label: MODULE_LABELS[module] ?? module } : module));
      const permissions = matrix.permissions.map((permission) => (typeof permission === 'string' ? { id: permission, label: PERMISSION_LABELS[permission] ?? permission } : permission));
      const roles = matrix.roles.map((role) => ({ ...role, grants: role.grants ?? {} }));
      const CELLS = modules.length * permissions.length;

      /**
       * Edits are optimistic: the switch flips immediately, a single overlay
       * map remembers the new state, and the API call runs in the background —
       * if it fails the switch snaps back and a toast explains why.
       */
      const overrides = new Map();
      const keyOf = (roleId, moduleId, permissionId) => `${roleId}|${moduleId}|${permissionId}`;
      const granted = (role, moduleId, permissionId) => {
        const override = overrides.get(keyOf(role.id, moduleId, permissionId));
        if (override !== undefined) return override;
        return (role.grants?.[moduleId] ?? []).includes(permissionId);
      };
      const grantsOf = (role) => modules.reduce((sum, module) => sum + permissions.filter((permission) => granted(role, module.id, permission.id)).length, 0);
      const coverageOf = (role) => (CELLS ? Math.round((grantsOf(role) / CELLS) * 100) : 0);
      const levelTone = (role) => role.tone ?? 'primary';

      const state = { roleId: roles[0]?.id ?? '', term: '', onlyGranted: false };
      const currentRole = () => roles.find((role) => role.id === state.roleId) ?? roles[0];

      /* ------------------------------------------------------------- markup */
      const roleChips = () =>
        roles
          .map((role) => {
            const coverage = coverageOf(role);
            return `<button type="button" class="perm-role${role.id === state.roleId ? ' is-active' : ''}" data-role-tab="${escapeHtml(role.id)}" role="tab" aria-selected="${role.id === state.roleId}">
              <span class="perm-role__dot perm-role__dot--${escapeHtml(levelTone(role))}"></span>
              <span class="perm-role__body"><b>${escapeHtml(role.label ?? role.id)}</b><small>${toDigits(userCount(role.id))} کاربر · ${toDigits(coverage)}٪ پوشش</small></span>
            </button>`;
          })
          .join('');

      const rows = () => {
        const role = currentRole();
        const term = state.term.trim().toLowerCase();
        return modules
          .filter((module) => (term ? `${module.label} ${module.id}`.toLowerCase().includes(term) : true))
          .filter((module) => (state.onlyGranted ? permissions.some((permission) => granted(role, module.id, permission.id)) : true))
          .map((module) => {
            const all = permissions.every((permission) => granted(role, module.id, permission.id));
            const some = permissions.some((permission) => granted(role, module.id, permission.id));
            return `<tr data-perm-row="${escapeHtml(module.id)}">
              <th scope="row" class="perm-module">
                <span class="perm-module__name">${escapeHtml(module.label)}</span>
                <code class="perm-module__id">${escapeHtml(module.id)}</code>
              </th>
              ${permissions
                .map(
                  (permission) => `<td class="perm-cell">
                    <label class="perm-switch${granted(role, module.id, permission.id) ? ' is-on' : ''}" title="${escapeHtml(permission.label)}">
                      <input type="checkbox" data-perm-cell data-role="${escapeHtml(role.id)}" data-module="${escapeHtml(module.id)}" data-permission="${escapeHtml(permission.id)}" ${granted(role, module.id, permission.id) ? 'checked' : ''}>
                      <span class="perm-switch__track" aria-hidden="true"><span class="perm-switch__knob"></span></span>
                      <span class="visually-hidden">${escapeHtml(permission.label)} در ${escapeHtml(module.label)}</span>
                    </label>
                  </td>`,
                )
                .join('')}
              <td class="perm-cell perm-cell--all">
                <button type="button" class="perm-all${all ? ' is-on' : ''}${!all && some ? ' is-partial' : ''}" data-module-all="${escapeHtml(module.id)}">
                  <i class="bi bi-${all ? 'check2-all' : 'slash-circle'}" aria-hidden="true"></i>
                  <span>${all ? 'همه' : some ? 'ناقص' : 'هیچ'}</span>
                </button>
              </td>
            </tr>`;
          })
          .join('');
      };
      const rowCount = () => {
        const role = currentRole();
        const term = state.term.trim().toLowerCase();
        return modules.filter((module) => (term ? `${module.label} ${module.id}`.toLowerCase().includes(term) : true)).filter((module) => (state.onlyGranted ? permissions.some((permission) => granted(role, module.id, permission.id)) : true)).length;
      };

      render(
        node,
        `<div class="dashboard-shell perm">
          ${pageHeader({
            title: 'مدیریت مجوزها و دسترسی‌ها',
            subtitle: 'کنترل نقش‌به‌نقش دسترسی به ماژول‌ها — با همان کلیک، تغییر بلافاصله اعمال می‌شود',
            icon: 'key-fill',
            badges: [statusBadge(`${toDigits(modules.length)} ماژول × ${toDigits(permissions.length)} مجوز`, 'primary'), statusBadge(`${toDigits(roles.length)} نقش کاربری`, 'info')],
            actions: '<button class="btn btn-primary" type="button" data-custom-perm><i class="bi bi-plus-lg"></i> تعریف مجوز سفارشی</button>',
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'ماژول‌های تحت کنترل', value: toDigits(modules.length), meta: `${toDigits(CELLS)} ترکیب نقش × دسترسی`, tone: 'primary', icon: 'grid-3x3-gap', id: 'perm-modules' })}
            ${statCard({ label: 'انواع مجوز', value: toDigits(permissions.length), meta: 'مشاهده تا خروجی گرفتن', tone: 'info', icon: 'key', id: 'perm-types' })}
            ${statCard({ label: 'نقش‌های کاربری', value: toDigits(roles.length), meta: `${toDigits((userList.items ?? userList).length)} کاربر فعال`, tone: 'success', icon: 'shield-lock', id: 'perm-roles' })}
            ${statCard({ label: 'بیشترین پوشش', value: `${toDigits(Math.max(0, ...roles.map(coverageOf)))}٪`, meta: escapeHtml(roles.slice().sort((a, b) => coverageOf(b) - coverageOf(a))[0]?.label ?? '—'), tone: 'warning', icon: 'award', id: 'perm-coverage' })}
          </div>

          <div class="widget-grid">
            ${card({
              span: 12,
              className: 'perm-board',
              icon: 'sliders',
              title: 'ماتریس دسترسی',
              subtitle: 'نقش را انتخاب کنید و کلیدهای هر ماژول را روشن یا خاموش کنید',
              bodyClass: 'perm-board__body',
              body: `<div class="perm-roles" role="tablist" aria-label="نقش‌های کاربری" data-perm-roles data-rail>${roleChips()}</div>
                <div class="perm-toolbar">
                  <label class="perm-search">
                    <i class="bi bi-search" aria-hidden="true"></i>
                    <input type="search" class="form-control" data-perm-search placeholder="جست‌وجوی ماژول…" autocomplete="off">
                  </label>
                  <label class="perm-toggle">
                    <input type="checkbox" data-perm-only-granted>
                    <span>فقط ماژول‌های دارای دسترسی</span>
                  </label>
                  <div class="perm-toolbar__actions">
                    <button type="button" class="btn btn-light btn-sm" data-perm-all-on><i class="bi bi-check2-square"></i> فعال‌سازی همه</button>
                    <button type="button" class="btn btn-light btn-sm" data-perm-all-off><i class="bi bi-x-square"></i> پاک‌کردن همه</button>
                  </div>
                </div>
                <p class="perm-hint" data-perm-hint></p>
                <div class="table-wrap perm-table-wrap">
                  <table class="table perm-table">
                    <thead><tr>
                      <th scope="col" class="perm-table__module">ماژول</th>
                      ${permissions.map((permission) => `<th scope="col" class="perm-cell" title="${escapeHtml(PERMISSION_NOTES[permission.id] ?? '')}">${escapeHtml(permission.label)}</th>`).join('')}
                      <th scope="col" class="perm-cell perm-cell--all">کل ماژول</th>
                    </tr></thead>
                    <tbody data-perm-rows></tbody>
                  </table>
                </div>
                <div class="perm-empty" data-perm-empty hidden>
                  ${emptyState({ title: 'ماژولی مطابق این فیلتر نیست', text: 'عبارت را کوتاه‌تر کنید یا فیلتر «فقط دارای دسترسی» را بردارید.', icon: 'search' })}
                </div>
                <p class="perm-mobile-note"><i class="bi bi-arrows-move"></i> برای ویرایش، جدول را افقی بکشید.</p>`,
            })}

            <div class="grid grid--cards perm-side">
              ${card({
                icon: 'people',
                title: 'خلاصه نقش‌ها',
                subtitle: 'برای دیدن ماتریس، روی هر نقش کلیک کنید',
                body: `<ul class="perm-summary">${roles
                  .map((role) => {
                    const coverage = coverageOf(role);
                    return `<li class="perm-summary__row${role.id === state.roleId ? ' is-active' : ''}" data-role-row="${escapeHtml(role.id)}">
                      <span class="perm-role__dot perm-role__dot--${escapeHtml(levelTone(role))}"></span>
                      <span class="perm-summary__name">${escapeHtml(role.label ?? role.id)}<small>سطح ${toDigits(role.level ?? 0)} · ${toDigits(userCount(role.id))} کاربر</small></span>
                      <span class="perm-summary__meter"><i style="--w:${coverage}%"></i></span>
                      <b class="numeric" data-role-grants="${escapeHtml(role.id)}">${toDigits(coverage)}٪</b>
                    </li>`;
                  })
                  .join('')}</ul>`,
              })}
              ${card({
                icon: 'shield-check',
                title: 'راهنمای مجوزها',
                subtitle: 'هر کلید چه کاری می‌دهد',
                body: `<ul class="perm-legend">${permissions
                  .map(
                    (permission) => `<li class="perm-legend__row">
                      <span class="perm-legend__icon"><i class="bi bi-${escapeHtml(PERMISSION_ICONS[permission.id] ?? 'key')}" aria-hidden="true"></i></span>
                      <span class="perm-legend__body"><b>${escapeHtml(permission.label)}</b><small>${escapeHtml(PERMISSION_NOTES[permission.id] ?? '')}</small></span>
                    </li>`,
                  )
                  .join('')}</ul>`,
              })}
            </div>
          </div>
        </div>`,
      );

      /* ---------------------------------------------------------- rendering */
      const tbody = $('[data-perm-rows]', node);
      const emptyNode = $('[data-perm-empty]', node);
      const hintNode = $('[data-perm-hint]', node);
      const tableWrap = $('.perm-table-wrap', node);
      const paintRows = () => {
        tbody.innerHTML = rows();
        const count = rowCount();
        emptyNode.hidden = count > 0;
        tableWrap.hidden = count === 0;
        const role = currentRole();
        hintNode.innerHTML = `در حال ویرایش <strong>${escapeHtml(role.label ?? role.id)}</strong> — ${toDigits(grantsOf(role))} دسترسی از ${toDigits(CELLS)} فعال است (${toDigits(coverageOf(role))}٪).`;
      };
      paintRows();

      const repaintSummaries = () => {
        roles.forEach((role) => {
          const node2 = $(`[data-role-grants="${role.id}"]`, node);
          if (node2) node2.textContent = `${toDigits(coverageOf(role))}٪`;
          const meter = node2?.closest('.perm-summary__row')?.querySelector('.perm-summary__meter i');
          if (meter) meter.style.setProperty('--w', `${coverageOf(role)}%`);
        });
      };

      const selectRole = (roleId) => {
        if (!roleId || roleId === state.roleId) return;
        state.roleId = roleId;
        $$('[data-role-tab]', node).forEach((chip) => {
          const active = chip.dataset.roleTab === roleId;
          chip.classList.toggle('is-active', active);
          chip.setAttribute('aria-selected', String(active));
        });
        $$('[data-role-row]', node).forEach((row) => row.classList.toggle('is-active', row.dataset.roleRow === roleId));
        paintRows();
      };

      /** One switch = one API call; failures roll the UI back. */
      const applyCell = (input, enabled) => {
        const { role, module: moduleId, permission } = input.dataset;
        overrides.set(keyOf(role, moduleId, permission), enabled);
        const switchNode = input.closest('.perm-switch');
        switchNode?.classList.toggle('is-on', enabled);
        const row = input.closest('tr');
        const switches = $$('[data-perm-cell]', row).map((cell) => cell.checked);
        const allNode = $('[data-module-all]', row);
        if (allNode) {
          const all = switches.every(Boolean);
          const some = switches.some(Boolean);
          allNode.classList.toggle('is-on', all);
          allNode.classList.toggle('is-partial', !all && some);
          allNode.innerHTML = `<i class="bi bi-${all ? 'check2-all' : 'slash-circle'}" aria-hidden="true"></i><span>${all ? 'همه' : some ? 'ناقص' : 'هیچ'}</span>`;
        }
        repaintSummaries();
        const roleMeta = roles.find((entry) => entry.id === role);
        if (roleMeta) $('[data-perm-hint]', node).innerHTML = `در حال ویرایش <strong>${escapeHtml(roleMeta.label ?? roleMeta.id)}</strong> — ${toDigits(grantsOf(roleMeta))} دسترسی از ${toDigits(CELLS)} فعال است (${toDigits(coverageOf(roleMeta))}٪).`;
        services.roleService
          .update(role, moduleId, permission, enabled)
          .catch((error) => {
            overrides.set(keyOf(role, moduleId, permission), !enabled);
            input.checked = !enabled;
            switchNode?.classList.toggle('is-on', !enabled);
            repaintSummaries();
            toast.danger('ذخیره نشد', error?.message ?? 'دسترسی تغییر نکرد؛ دوباره تلاش کنید.');
          });
      };

      /* --------------------------------------------------------- behaviour */
      on(node, 'click', (event) => {
        const tab = event.target.closest('[data-role-tab]');
        if (tab) {
          selectRole(tab.dataset.roleTab);
          return;
        }
        const roleRow = event.target.closest('[data-role-row]');
        if (roleRow) {
          selectRole(roleRow.dataset.roleRow);
          return;
        }
        const allNode = event.target.closest('[data-module-all]');
        if (allNode) {
          const row = allNode.closest('tr');
          const inputs = $$('[data-perm-cell]', row);
          const enable = !inputs.every((input) => input.checked);
          inputs.forEach((input) => {
            if (input.checked !== enable) {
              input.checked = enable;
              applyCell(input, enable);
            }
          });
          toast.info(enable ? 'دسترسی ماژول فعال شد' : 'دسترسی ماژول پاک شد', `${toDigits(inputs.length)} مجوز برای ${escapeHtml(row.querySelector('.perm-module__name')?.textContent ?? '')}`);
          return;
        }
        if (event.target.closest('[data-perm-all-on]') || event.target.closest('[data-perm-all-off]')) {
          const enable = Boolean(event.target.closest('[data-perm-all-on]'));
          const inputs = $$('[data-perm-cell]', tbody);
          inputs.forEach((input) => {
            if (input.checked !== enable) {
              input.checked = enable;
              applyCell(input, enable);
            }
          });
          toast.info(enable ? 'همه دسترسی‌ها فعال شد' : 'همه دسترسی‌ها پاک شد', `نقش ${escapeHtml(currentRole()?.label ?? '')} به‌روزرسانی شد.`);
          return;
        }
        if (event.target.closest('[data-custom-perm]')) {
          toast.info('تعریف مجوز سفارشی', 'برای افزودن مجوز جدید، با مدیر ارشد هماهنگ کنید.');
        }
      });
      on(node, 'change', (event) => {
        const input = event.target.closest('[data-perm-cell]');
        if (!input) return;
        applyCell(input, input.checked);
      });
      on($('[data-perm-search]', node), 'input', (event) => {
        state.term = event.target.value;
        paintRows();
      });
      on($('[data-perm-only-granted]', node), 'change', (event) => {
        state.onlyGranted = event.target.checked;
        paintRows();
      });
      exportable(node, 'permissions');
      return;
    }

    case 'users/teams.html': {
      const node = host();
      const teamsData = await services.teamService.list({ perPage: 20 });
      const teamList = teamsData.items ?? teamsData ?? [];
      const totalMembers = teamList.reduce((sum, t) => sum + (t.members || 0), 0);
      const avgProgress = teamList.length ? Math.round(teamList.reduce((sum, t) => sum + (t.progress || 0), 0) / teamList.length) : 75;

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'تیم‌ها و گروه‌های کاری',
            subtitle: 'مدیریت تیم‌های تخصصی، سرپرستان، اعضا و اهداف عملکردی فصلی',
            icon: 'people-fill',
            actions: '<button class="btn btn-primary" type="button" data-create-team><i class="bi bi-plus-lg"></i> ایجاد تیم جدید</button>',
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'کل تیم‌ها', value: toDigits(teamList.length), hint: 'تیم‌های عملیاتی فعال', tone: 'primary', icon: 'people' })}
            ${statCard({ label: 'کل پرسنل در تیم‌ها', value: toDigits(totalMembers), hint: 'عضو گروه‌های تخصصی', tone: 'info', icon: 'person-badge' })}
            ${statCard({ label: 'میانگین پیشرفت اهداف', value: toDigits(avgProgress) + '٪', hint: 'عملکرد این فصل', tone: 'success', icon: 'graph-up-arrow' })}
            ${statCard({ label: 'پروژه‌های فعال', value: toDigits(teamList.length * 3), hint: 'در دست اجرا در تیم‌ها', tone: 'warning', icon: 'kanban' })}
          </div>

          <div class="grid grid--3" style="gap:20px;">
            ${teamList.map((t, idx) => `
              <div class="card" style="border-radius:18px; border:1px solid var(--nv-border); background:var(--nv-surface);">
                <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--nv-border);">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span class="tile tile--soft tile--icon tile--soft-${t.color || 'primary'}" style="width:38px;height:38px;border-radius:10px;display:grid;place-items:center;">
                      <i class="bi bi-people" style="font-size:1.1rem;"></i>
                    </span>
                    <div>
                      <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">${escapeHtml(t.name)}</h3>
                      <span class="card__subtitle" style="font-size:11px; color:var(--nv-text-muted);">سرپرست: ${escapeHtml(t.lead || 'نامشخص')}</span>
                    </div>
                  </div>
                  <span class="badge badge--soft-${t.color || 'primary'} rounded-pill" style="font-size:11px;">${toDigits(t.members || 8)} عضو</span>
                </div>

                <div class="card__body" style="padding:18px 20px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:12px;">
                    <span style="color:var(--nv-text-muted);">پیشرفت اهداف OKR</span>
                    <strong class="numeric" style="color:var(--nv-primary); font-weight:800;">${toDigits(t.progress || 70)}٪</strong>
                  </div>
                  <div class="progress progress--sm mb-3" style="height:6px; border-radius:999px;">
                    <div class="progress-bar ${t.progress > 80 ? 'bg-success' : ''}" style="width:${t.progress || 70}%"></div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--nv-text-muted); margin-bottom:14px;">
                    <span><i class="bi bi-kanban"></i> ${toDigits((idx % 4) + 2)} پروژه فعال</span>
                    <span><i class="bi bi-check2-circle"></i> ${toDigits((idx * 8) + 24)} تسک انجام‌شده</span>
                  </div>

                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; margin-inline-start:8px;">
                      ${[1,2,3,4].map(n => `<img src="${safeAvatar(idx * 3 + n)}" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--nv-surface);margin-inline-start:-8px;object-fit:cover;" alt="">`).join('')}
                    </div>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-sm btn-light" type="button" data-edit-team="${escapeHtml(t.id)}" style="font-size:11px; padding:4px 8px;">ویرایش</button>
                      <button class="btn btn-sm btn-soft-primary" type="button" data-team-members="${escapeHtml(t.id)}" style="font-size:11px; padding:4px 8px;">اعضا</button>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`,
      );

      on(node, 'click', (event) => {
        if (event.target.closest('[data-create-team]')) {
          modal.open({
            title: 'ایجاد تیم کاری جدید',
            content: `
              <form class="form-stack">
                <div class="form-field"><label class="form-label">نام تیم *</label><input class="form-control" placeholder="مثال: تیم توسعه هسته" required></div>
                <div class="form-field"><label class="form-label">سرپرست تیم (Team Lead)</label><select class="form-select"><option>سارا محمدی</option><option>رضا نوری</option><option>امیر طاهری</option><option>مریم صادقی</option></select></div>
                <div class="form-field"><label class="form-label">رنگ نشانگر تیم</label><select class="form-select"><option value="primary">نیلی (Primary)</option><option value="success">سبز (Success)</option><option value="info">آبی (Info)</option><option value="warning">نارنجی (Warning)</option><option value="violet">بنفش (Violet)</option></select></div>
                <div class="form-field"><label class="form-label">هدف فصلی تیم</label><textarea class="form-control" rows="2" placeholder="اهداف کلیدی این فصل..."></textarea></div>
              </form>
            `,
            footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-save-new-team>ثبت تیم</button>',
            onMount: (panel) => on($('[data-save-new-team]', panel), 'click', () => { toast.success('تیم جدید با موفقیت ایجاد شد'); modal.closeTop(); }),
          });
        }
        const editBtn = event.target.closest('[data-edit-team]');
        if (editBtn) toast.info('ویرایش تیم', 'تنظیمات تیم باز شد.');
        const memBtn = event.target.closest('[data-team-members]');
        if (memBtn) toast.info('اعضای تیم', 'فهرست اعضا بارگذاری شد.');
      });
      exportable(node, 'teams');
      return;
    }

    case 'users/departments.html': {
      const node = host();
      const deptsData = await services.departmentService.list({ perPage: 20 });
      const deptList = deptsData.items ?? deptsData ?? [];
      const totalHeadcount = deptList.reduce((sum, d) => sum + (d.headcount || 0), 0);
      const totalBudget = deptList.reduce((sum, d) => sum + (d.budget || 0), 0);

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'دپارتمان‌ها و ساختار سازمانی',
            subtitle: 'ساختار کلان شرکت، مدیران واحدها، تعداد پرسنل و بودجه‌های مصوب',
            icon: 'diagram-3-fill',
            actions: '<button class="btn btn-primary" type="button" data-create-dept><i class="bi bi-plus-lg"></i> تعریف دپارتمان</button>',
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'کل دپارتمان‌ها', value: toDigits(deptList.length), hint: 'واحدهای مستقل سازمانی', tone: 'primary', icon: 'diagram-3' })}
            ${statCard({ label: 'کل پرسنل شاغل', value: toDigits(totalHeadcount) + ' نفر', hint: 'در ۶ دپارتمان مرکزی', tone: 'info', icon: 'people' })}
            ${statCard({ label: 'بودجه کل سالانه', value: formatCurrency(totalBudget, 'IRR', { compact: true }), hint: 'تخصیص‌یافته به دپارتمان‌ها', tone: 'success', icon: 'cash-stack' })}
            ${statCard({ label: 'فرصت‌های شغلی باز', value: '۱۴ موقعیت', hint: 'جذب نیروی فعال در جریان', tone: 'warning', icon: 'briefcase' })}
          </div>

          <div class="grid grid--3" style="gap:20px;">
            ${deptList.map((d, idx) => `
              <div class="card" style="border-radius:18px; border:1px solid var(--nv-border); background:var(--nv-surface);">
                <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--nv-border);">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span class="tile tile--soft tile--icon tile--soft-primary" style="width:38px;height:38px;border-radius:10px;display:grid;place-items:center;">
                      <i class="bi bi-building" style="font-size:1.1rem;color:var(--nv-primary);"></i>
                    </span>
                    <div>
                      <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">${escapeHtml(d.name)}</h3>
                      <span class="card__subtitle" style="font-size:11px; color:var(--nv-text-muted);">موقعیت: ${escapeHtml(d.location || 'تهران')}</span>
                    </div>
                  </div>
                  <span class="badge badge--soft-primary rounded-pill" style="font-size:11px;">${toDigits(d.headcount || 12)} نفر</span>
                </div>

                <div class="card__body" style="padding:18px 20px;">
                  <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:10px; background:var(--nv-surface-2); border-radius:12px;">
                    <img src="${safeAvatar(idx + 1)}" style="width:36px;height:36px;border-radius:50%;border:2px solid var(--nv-border);object-fit:cover;">
                    <div>
                      <div style="font-size:11px; color:var(--nv-text-muted);">مدیر دپارتمان:</div>
                      <div style="font-size:12px; font-weight:700; color:var(--nv-heading);">${escapeHtml(d.head || 'تعیین نشده')}</div>
                    </div>
                  </div>

                  <div style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--nv-text-muted); margin-bottom:4px;">
                      <span>بودجه مصوب:</span>
                      <strong class="numeric" style="color:var(--nv-success);">${formatCurrency(d.budget || 1000000000, 'IRR', { compact: true })}</strong>
                    </div>
                    <div class="progress progress--sm" style="height:6px; border-radius:999px;">
                      <div class="progress-bar bg-success" style="width:${Math.min(100, (d.headcount || 10) * 3)}%"></div>
                    </div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--nv-text-muted); padding-top:6px; border-top:1px solid var(--nv-divider);">
                    <span><i class="bi bi-briefcase"></i> ۲ موقعیت شغلی باز</span>
                    <button class="btn btn-sm btn-light" type="button" data-dept-details="${escapeHtml(d.id)}" style="font-size:11px; padding:4px 8px;">جزئیات واحد</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`,
      );

      on(node, 'click', (event) => {
        if (event.target.closest('[data-create-dept]')) {
          modal.open({
            title: 'تعریف دپارتمان سازمانی',
            content: `
              <form class="form-stack">
                <div class="form-field"><label class="form-label">نام دپارتمان *</label><input class="form-control" placeholder="مثال: تحقیق و توسعه (R&D)" required></div>
                <div class="form-field"><label class="form-label">مدیر ارشد دپارتمان</label><input class="form-control" placeholder="نام مدیر دپارتمان"></div>
                <div class="form-field"><label class="form-label">موقعیت جغرافیایی</label><input class="form-control" value="تهران — ساختمان مرکزی"></div>
                <div class="form-field"><label class="form-label">بودجه سالانه مصوب (ریال)</label><input class="form-control" type="number" placeholder="مثال: ۵۰۰۰۰۰۰۰۰۰"></div>
              </form>
            `,
            footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-save-new-dept>ثبت دپارتمان</button>',
            onMount: (panel) => on($('[data-save-new-dept]', panel), 'click', () => { toast.success('دپارتمان با موفقیت افزوده شد'); modal.closeTop(); }),
          });
        }
        if (event.target.closest('[data-dept-details]')) toast.info('دپارتمان', 'اطلاعات کامل پرسنل و چارت دپارتمان بارگذاری شد.');
      });
      exportable(node, 'departments');
      return;
    }

    case 'users/invitations.html': {
      const node = host();
      const invData = await services.invitationService.list();
      let invList = invData.items ?? invData ?? [];

      const renderInv = () => {
        const pendingCount = invList.filter(i => i.status === 'pending').length;
        render(
          node,
          `<div class="dashboard-shell">
            ${pageHeader({
              title: 'دعوت‌نامه‌ها و پیوستن اعضای جدید',
              subtitle: 'ارسال دعوت‌نامه ایمیلی، تخصیص نقش اولیه و مدیریت پیوندهای دسترسی موقت',
              icon: 'envelope-paper-fill',
              actions: '<button class="btn btn-primary" type="button" data-send-inv><i class="bi bi-send-plus"></i> ارسال دعوت‌نامه جدید</button>',
            })}

            <div class="kpi-row grid grid--4 mb-4">
              ${statCard({ label: 'کل دعوت‌نامه‌ها', value: toDigits(invList.length), hint: 'دعوت‌های ثبت‌شده در سامانه', tone: 'primary', icon: 'envelope' })}
              ${statCard({ label: 'در انتظار تأیید', value: toDigits(pendingCount), hint: 'هنوز ثبت‌نام تکمیل نشده', tone: 'warning', icon: 'clock-history' })}
              ${statCard({ label: 'پذیرفته‌شده', value: toDigits(invList.filter(i=>i.status==='accepted').length), hint: 'عضو فعال تیم شده‌اند', tone: 'success', icon: 'check-circle' })}
              ${statCard({ label: 'منقضی‌شده', value: toDigits(invList.filter(i=>i.status==='expired').length), hint: 'نیازمند ارسال مجدد', tone: 'danger', icon: 'x-circle' })}
            </div>

            <div class="card" style="border-radius:18px;">
              <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
                <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">فهرست دعوت‌نامه‌های فعال</h3>
                <span class="badge badge--soft-primary">${toDigits(invList.length)} مورد</span>
              </div>
              <div class="card__body" style="padding:0;">
                <div class="table-responsive">
                  <table class="table table--hover">
                    <thead>
                      <tr>
                        <th>ایمیل گیرنده</th>
                        <th>نقش پیشنهادی</th>
                        <th>تیم</th>
                        <th>مهلت اعتبار</th>
                        <th>وضعیت</th>
                        <th class="text-end">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${invList.map(inv => `
                        <tr>
                          <td style="font-weight:700; font-family:var(--nv-font-mono); direction:ltr; text-align:right;">${escapeHtml(inv.email)}</td>
                          <td><span class="badge badge--soft-primary">${escapeHtml(inv.role)}</span></td>
                          <td>${escapeHtml(inv.team || 'پلتفرم')}</td>
                          <td>${toDigits(inv.expiresIn || 7)} روز باقی‌مانده</td>
                          <td>
                            <span class="badge badge--soft-${inv.status==='accepted'?'success':inv.status==='pending'?'warning':'danger'}">
                              ${inv.status==='accepted'?'پذیرفته‌شده':inv.status==='pending'?'در انتظار':'منقضی'}
                            </span>
                          </td>
                          <td class="text-end">
                            <div class="d-inline-flex gap-1">
                              <button class="btn btn-sm btn-light" type="button" data-copy-link="${escapeHtml(inv.email)}" title="کپی پیوند دعوت"><i class="bi bi-link-45deg"></i></button>
                              <button class="btn btn-sm btn-light" type="button" data-resend-inv="${escapeHtml(inv.id)}" title="ارسال دوباره"><i class="bi bi-arrow-clockwise"></i></button>
                              <button class="btn btn-sm btn-ghost text-danger" type="button" data-revoke-inv="${escapeHtml(inv.id)}" title="لغو دعوت"><i class="bi bi-trash3"></i></button>
                            </div>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>`,
        );
      };

      renderInv();

      on(node, 'click', async (event) => {
        if (event.target.closest('[data-send-inv]')) {
          modal.open({
            title: 'ارسال دعوت‌نامه کاربری',
            content: `
              <form class="form-stack">
                <div class="form-field"><label class="form-label">آدرس ایمیل کاربر *</label><input class="form-control" type="email" placeholder="user@company.com" dir="ltr" required></div>
                <div class="form-field"><label class="form-label">نقش اولیه</label><select class="form-select"><option>مدیر</option><option>نویسنده محتوا</option><option>کارشناس مالی</option><option>پشتیبان</option><option selected>کاربر</option></select></div>
                <div class="form-field"><label class="form-label">تیم اختصاص‌یافته</label><select class="form-select"><option>تیم پلتفرم</option><option>تیم طراحی محصول</option><option>تیم فروش</option><option>تیم پشتیبانی</option></select></div>
                <div class="form-field"><label class="form-label">مدت اعتبار پیوند</label><select class="form-select"><option>۳ روز</option><option selected>۷ روز</option><option>۱۴ روز</option></select></div>
              </form>
            `,
            footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-confirm-send-inv>ارسال دعوت‌نامه</button>',
            onMount: (panel) => on($('[data-confirm-send-inv]', panel), 'click', () => {
              invList.unshift({ id: `inv-${Date.now()}`, email: 'new.member@company.ir', role: 'کاربر', team: 'تیم پلتفرم', status: 'pending', expiresIn: 7 });
              toast.success('دعوت‌نامه ارسال شد', 'لینک فعال‌سازی به ایمیل کاربر فرستاده شد.');
              modal.closeTop();
              renderInv();
            }),
          });
        }
        const copyBtn = event.target.closest('[data-copy-link]');
        if (copyBtn) {
          await navigator.clipboard?.writeText(`https://novaadmin.dev/auth/register.html?invite=${encodeURIComponent(copyBtn.dataset.copyLink)}`).catch(()=>null);
          toast.success('پیوند دعوت کپی شد', 'لینک اختصاصی در کلیپ‌بورد ذخیره شد.');
        }
        const resendBtn = event.target.closest('[data-resend-inv]');
        if (resendBtn) toast.success('دعوت‌نامه مجدداً ارسال شد');
        const revokeBtn = event.target.closest('[data-revoke-inv]');
        if (revokeBtn) {
          invList = invList.filter(i => i.id !== revokeBtn.dataset.revokeInv);
          toast.info('دعوت‌نامه لغو شد');
          renderInv();
        }
      });
      exportable(node, 'invitations');
      return;
    }

    case 'users/activity.html': {
      const node = host();
      const actData = await services.activityService.list({ limit: 30 });
      let actLogs = actData.items ?? actData ?? [];
      let currentFilter = 'all';

      const renderActivity = () => {
        const filtered = actLogs.filter(a => {
          if (currentFilter === 'all') return true;
          return a.type === currentFilter;
        });

        render(
          node,
          `<div class="dashboard-shell">
            ${pageHeader({
              title: 'فعالیت‌های کاربران و لاگ‌های امنیتی',
              subtitle: 'ثبت جامع و تغییرناپذیر تمام تراکنش‌ها، تغییرات سطوح دسترسی و لاگین‌های سامانه',
              icon: 'activity',
              actions: '<button class="btn btn-light btn-sm" type="button" data-export-audit><i class="bi bi-download"></i> دریافت خروجی Audit Log</button>',
            })}

            <div class="kpi-row grid grid--4 mb-4">
              ${statCard({ label: 'کل رخدادهای ۲۴ ساعت', value: toDigits(actLogs.length), hint: 'ثبت خودکار سیستمی', tone: 'primary', icon: 'activity' })}
              ${statCard({ label: 'ورود به حساب‌ها', value: toDigits(actLogs.filter(a=>a.type==='user').length), hint: 'نشست‌های موفق و تاییدشده', tone: 'info', icon: 'shield-check' })}
              ${statCard({ label: 'عملیات مالی و پرداخت', value: toDigits(actLogs.filter(a=>a.type==='payment'||a.type==='invoice'||a.type==='order').length), hint: 'تغییرات فاکتور و وجه', tone: 'success', icon: 'cash-coin' })}
              ${statCard({ label: 'رویدادهای امنیتی', value: toDigits(actLogs.filter(a=>a.type==='security').length), hint: 'تغییر رمز و دسترسی', tone: 'danger', icon: 'shield-lock' })}
            </div>

            <div class="card" style="border-radius:18px;">
              <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--nv-border);">
                <div class="segmented" data-act-filter>
                  <button type="button" class="segmented__item ${currentFilter==='all'?'is-active':''}" data-filter="all">همه (${toDigits(actLogs.length)})</button>
                  <button type="button" class="segmented__item ${currentFilter==='user'?'is-active':''}" data-filter="user">کاربران و ورود</button>
                  <button type="button" class="segmented__item ${currentFilter==='order'?'is-active':''}" data-filter="order">سفارش‌ها</button>
                  <button type="button" class="segmented__item ${currentFilter==='security'?'is-active':''}" data-filter="security">امنیت</button>
                  <button type="button" class="segmented__item ${currentFilter==='ai'?'is-active':''}" data-filter="ai">هوش مصنوعی</button>
                </div>
                <span style="font-size:12px; color:var(--nv-text-muted);">نمایش ${toDigits(filtered.length)} رویداد</span>
              </div>

              <div class="card__body" style="padding:16px; display:flex; flex-direction:column; gap:10px;">
                ${filtered.map((log, i) => `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:12px; border:1px solid var(--nv-border); background:var(--nv-surface-2); flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <img src="${safeAvatar(i + 1)}" style="width:38px;height:38px;border-radius:50%;border:2px solid var(--nv-border);object-fit:cover;">
                      <div>
                        <div style="font-size:13px; font-weight:700; color:var(--nv-heading);">${escapeHtml(log.text)}</div>
                        <div style="font-size:11px; color:var(--nv-text-muted); margin-top:2px;">
                          توسط: <strong style="color:var(--nv-text);">${escapeHtml(log.actor || 'سیستم')}</strong> • نشانی IP: <span style="direction:ltr; display:inline-block; font-family:var(--nv-font-mono);">${escapeHtml(log.ip || '185.190.22.4')}</span>
                        </div>
                      </div>
                    </div>
                    <div style="text-align:end;">
                      <span class="badge badge--soft-${log.type==='security'?'danger':log.type==='user'?'primary':log.type==='payment'?'success':'info'}" style="font-size:10px;">${escapeHtml(log.type || 'سیستم')}</span>
                      <div style="font-size:11px; color:var(--nv-text-muted); margin-top:4px;">${relativeTime(log.at)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>`,
        );
      };

      renderActivity();

      on(node, 'click', (event) => {
        const filterBtn = event.target.closest('[data-filter]');
        if (filterBtn) {
          currentFilter = filterBtn.dataset.filter;
          renderActivity();
          return;
        }
        if (event.target.closest('[data-export-audit]')) {
          toast.success('خروجی لاگ آماده شد', 'فایل CSV رویدادهای ممیزی دانلود شد.');
        }
      });
      exportable(node, 'activities');
      return;
    }

    case 'users/sessions.html': {
      const node = host();
      const sessData = await services.sessionService.list();
      let sessList = sessData.items ?? sessData ?? [];

      const renderSessions = () => {
        render(
          node,
          `<div class="dashboard-shell">
            ${pageHeader({
              title: 'نشست‌ها و دستگاه‌های متصل',
              subtitle: 'بررسی نشست‌های فعال کاربران، موقعیت جغرافیایی و خاتمه دادن به دسترسی‌های مشکوک',
              icon: 'laptop',
              actions: '<button class="btn btn-outline-danger btn-sm" type="button" data-revoke-all><i class="bi bi-shield-x"></i> خاتمه همه نشست‌های دیگر</button>',
            })}

            <div class="kpi-row grid grid--4 mb-4">
              ${statCard({ label: 'نشست‌های فعال', value: toDigits(sessList.length), hint: 'دستگاه‌های همگام‌سازی‌شده', tone: 'primary', icon: 'laptop' })}
              ${statCard({ label: 'دسکتاپ و لپ‌تاپ', value: toDigits(sessList.filter(s=>!s.device.includes('iPhone')&&!s.device.includes('Xiaomi')).length), hint: 'سیستم‌های عامل رومیزی', tone: 'info', icon: 'display' })}
              ${statCard({ label: 'دستگاه‌های همراه', value: toDigits(sessList.filter(s=>s.device.includes('iPhone')||s.device.includes('Xiaomi')||s.device.includes('iPad')).length), hint: 'موبایل و تبلت متصل', tone: 'success', icon: 'phone' })}
              ${statCard({ label: 'موقعیت‌های مکانی', value: '۴ استان', hint: 'تهران، اصفهان، مشهد، شیراز', tone: 'warning', icon: 'geo-alt' })}
            </div>

            <div class="grid grid--2" style="gap:16px;">
              ${sessList.map((s, idx) => `
                <div class="card" style="border-radius:16px; border:1px solid ${s.current ? 'var(--nv-primary)' : 'var(--nv-border)'}; background:${s.current ? 'var(--nv-primary-soft)' : 'var(--nv-surface)'};">
                  <div class="card__body" style="padding:18px; display:flex; align-items:start; justify-content:space-between; gap:14px;">
                    <div style="display:flex; align-items:start; gap:14px;">
                      <span class="tile tile--soft tile--icon tile--soft-${s.current ? 'primary' : 'secondary'}" style="width:44px; height:44px; border-radius:12px; display:grid; place-items:center; flex-shrink:0;">
                        <i class="bi bi-${s.device.includes('iPhone')||s.device.includes('Xiaomi') ? 'phone' : s.device.includes('iPad') ? 'tablet' : 'laptop'}" style="font-size:1.3rem;"></i>
                      </span>
                      <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                          <h4 style="margin:0; font-size:14px; font-weight:800; color:var(--nv-heading);">${escapeHtml(s.device)}</h4>
                          ${s.current ? '<span class="badge badge--soft-primary" style="font-size:10px;">نشست فعلی (این سیستم)</span>' : ''}
                        </div>
                        <div style="font-size:12px; color:var(--nv-text-muted); margin-top:4px;">
                          مرورگر: ${escapeHtml(s.browser || 'Chrome')} • نشانی IP: <span style="direction:ltr; display:inline-block; font-family:var(--nv-font-mono);">${escapeHtml(s.ip || '5.160.82.11')}</span>
                        </div>
                        <div style="font-size:11px; color:var(--nv-text-muted); margin-top:6px;">
                          <i class="bi bi-geo-alt"></i> ${escapeHtml(s.location || 'تهران، ایران')} • آخرین فعالیت: ${relativeTime(s.lastSeen)}
                        </div>
                      </div>
                    </div>
                    <div>
                      ${!s.current ? `<button class="btn btn-outline-danger btn-sm" type="button" data-revoke-session="${escapeHtml(s.id)}" style="font-size:11px; padding:4px 10px;"><i class="bi bi-box-arrow-right"></i> خروج</button>` : '<span class="badge badge--soft-success" style="font-size:10px;">آنلاین</span>'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`,
        );
      };

      renderSessions();

      on(node, 'click', (event) => {
        const revBtn = event.target.closest('[data-revoke-session]');
        if (revBtn) {
          sessList = sessList.filter(s => s.id !== revBtn.dataset.revokeSession);
          toast.success('نشست با موفقیت خاتمه یافت');
          renderSessions();
          return;
        }
        if (event.target.closest('[data-revoke-all]')) {
          sessList = sessList.filter(s => s.current);
          toast.success('همه نشست‌های دیگر خاتمه یافتند', 'فقط همین دستگاه متصل باقی ماند.');
          renderSessions();
        }
      });
      exportable(node, 'sessions');
      return;
    }

    default:
      return;
  }
}

/* --------------------------------------------------- create/edit field presets */

function crudFields(resource) {
  const presets = {
    categories: [
      { name: 'name', label: 'نام دسته', required: true },
      { name: 'parent', label: 'دسته والد', type: 'select', options: ['—', 'لپ‌تاپ', 'موبایل', 'لوازم جانبی'] },
      { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
    ],
    brands: [
      { name: 'name', label: 'نام برند', required: true },
      { name: 'tier', label: 'جایگاه', type: 'select', options: ['برتر', 'حرفه‌ای', 'اقتصادی', 'جدید'] },
      { name: 'country', label: 'کشور مبدأ', type: 'select', options: ['ایران', 'آلمان', 'چین', 'ترکیه', 'امارات', 'ژاپن'] },
      { name: 'city', label: 'شهر' },
      { name: 'since', label: 'سال تأسیس', type: 'number', inputMode: 'numeric' },
      { name: 'website', label: 'وبسایت', rule: 'url', placeholder: 'https://example.com' },
      { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'active', label: 'فعال' }, { value: 'inactive', label: 'غیرفعال' }] },
      { name: 'description', label: 'معرفی برند', type: 'textarea', col: 2, rows: 3 },
    ],
    tags: [
      { name: 'name', label: 'برچسب', required: true },
      { name: 'slug', label: 'اسلاگ', placeholder: 'bestseller', hint: 'حروف لاتین، بدون فاصله' },
      { name: 'kind', label: 'نوع انتساب', type: 'select', options: [{ value: 'auto', label: 'خودکار (قاعده)' }, { value: 'manual', label: 'دستی' }] },
      { name: 'color', label: 'رنگ', type: 'select', options: ['primary', 'success', 'warning', 'danger', 'info', 'violet', 'neutral'] },
      { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'active', label: 'فعال' }, { value: 'archived', label: 'بایگانی‌شده' }] },
      { name: 'description', label: 'توضیح کاربرد', type: 'textarea', col: 2, rows: 3 },
    ],
    coupons: [
      { name: 'code', label: 'کد تخفیف', required: true },
      { name: 'value', label: 'مقدار تخفیف', type: 'number', inputMode: 'numeric', required: true, rule: 'number' },
      { name: 'minOrder', label: 'حداقل سفارش (ریال)', type: 'number', inputMode: 'numeric' },
      { name: 'to', label: 'تاریخ انقضا', type: 'date', required: true },
      { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
    ],
    reviews: [
      { name: 'product', label: 'محصول', required: true },
      { name: 'rating', label: 'امتیاز', type: 'select', options: ['5', '4', '3', '2', '1'] },
      { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'published', label: 'منتشرشده' }, { value: 'pending', label: 'در انتظار' }, { value: 'rejected', label: 'رد شده' }] },
      { name: 'title', label: 'عنوان نظر', col: 2 },
      { name: 'body', label: 'متن نظر', type: 'textarea', col: 2, rows: 4 },
    ],
    deals: [
      { name: 'title', label: 'عنوان معامله', required: true },
      { name: 'company', label: 'شرکت', required: true },
      { name: 'value', label: 'ارزش (ریال)', type: 'number', inputMode: 'numeric', required: true, rule: 'number' },
      { name: 'stage', label: 'مرحله', type: 'select', options: [{ value: 'new', label: 'جدید' }, { value: 'qualified', label: 'واجد شرایط' }, { value: 'proposal', label: 'پیشنهاد' }, { value: 'negotiation', label: 'مذاکره' }, { value: 'won', label: 'برنده' }, { value: 'lost', label: 'از دست رفته' }] },
      { name: 'expectedClose', label: 'بستن مورد انتظار', type: 'date' },
      { name: 'notes', label: 'یادداشت', type: 'textarea', col: 2, rows: 3 },
    ],
    tasks: [
      { name: 'title', label: 'عنوان تسک', required: true },
      { name: 'project', label: 'پروژه', required: true },
      { name: 'priority', label: 'اولویت', type: 'select', options: [{ value: 'low', label: 'کم' }, { value: 'medium', label: 'متوسط' }, { value: 'high', label: 'زیاد' }, { value: 'critical', label: 'بحرانی' }] },
      { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'backlog', label: 'بک‌لاگ' }, { value: 'todo', label: 'انجام‌نشده' }, { value: 'in-progress', label: 'در حال انجام' }, { value: 'review', label: 'بازبینی' }, { value: 'done', label: 'انجام‌شده' }] },
      { name: 'dueDate', label: 'موعد', type: 'date' },
      { name: 'estimate', label: 'تخمین (ساعت)', type: 'number', inputMode: 'numeric' },
      { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
    ],
    departments: [
      { name: 'name', label: 'نام دپارتمان', required: true },
      { name: 'head', label: 'سرپرست' },
      { name: 'location', label: 'موقعیت', type: 'select', options: ['تهران', 'اصفهان', 'شیراز', 'مشهد'] },
      { name: 'budget', label: 'بودجه سالانه (ریال)', type: 'number', inputMode: 'numeric' },
    ],
    shipments: [
      { name: 'order', label: 'شماره سفارش', required: true },
      { name: 'destination', label: 'مقصد', required: true },
      { name: 'carrier', label: 'شرکت حمل', type: 'select', options: ['پست پیشتاز', 'تیپاکس', 'چاپار', 'باربری نووا'] },
      { name: 'eta', label: 'زمان تخمینی تحویل', type: 'date' },
      { name: 'notes', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
    ],
    users: [
      { name: 'name', label: 'نام و نام خانوادگی', required: true },
      { name: 'email', label: 'ایمیل', type: 'email', rule: 'email', required: true },
      { name: 'phone', label: 'تلفن', rule: 'phone' },
      { name: 'role', label: 'نقش', type: 'select', options: [{ value: 'admin', label: 'مدیر' }, { value: 'editor', label: 'ویرایشگر' }, { value: 'support', label: 'پشتیبان' }, { value: 'viewer', label: 'بازدیدکننده' }] },
      { name: 'team', label: 'تیم', type: 'select', options: ['فروش', 'پشتیبانی', 'فنی', 'مالی'] },
      { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'active', label: 'فعال' }, { value: 'invited', label: 'دعوت‌شده' }, { value: 'suspended', label: 'معلق' }] },
      { name: 'note', label: 'یادداشت', type: 'textarea', col: 2, rows: 3 },
    ],
  };
  return presets[resource] ?? [
    { name: 'name', label: 'عنوان', required: true },
    { name: 'status', label: 'وضعیت', type: 'select', options: ['active', 'pending', 'archived'] },
    { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
  ];
}


/* =================================================================== customers */

/**
 * Customer drill-downs and the segment overview. `customers/list.html` and
 * `customers/orders.html` are plain data tables handled by the generic
 * renderer, so only the two richer screens live here.
 */
async function initCustomers() {
  const page = kit.pageId();
  switch (page) {
    case 'customers/list.html': {
      const node = host();
      const { items } = await services.customerService.list({ perPage: 100 });
      const customerList = items?.length ? items : [
        { id: 'c-101', company: 'فولاد مبارکه اصفهان', contact: 'مهندس حسینی', email: 'procurement@msteel.ir', city: 'اصفهان', segment: 'enterprise', orders: 48, totalSpend: 2480000000, status: 'active', rfm: 'قهرمانان (VIP)' },
        { id: 'c-102', company: 'پتروشیمی خلیج فارس', contact: 'دکتر علوی', email: 'orders@pgpic.ir', city: 'تهران', segment: 'enterprise', orders: 36, totalSpend: 1850000000, status: 'active', rfm: 'قهرمانان (VIP)' },
        { id: 'c-103', company: 'صنایع غذایی زرنام', contact: 'خانم مهندس راد', email: 'supply@zarnam.com', city: 'کرج', segment: 'enterprise', orders: 28, totalSpend: 920000000, status: 'active', rfm: 'وفادار' },
        { id: 'c-104', company: 'توسعه ارتباطات نوین', contact: 'مهندس اکبری', email: 'info@novincomm.ir', city: 'مشهد', segment: 'smb', orders: 19, totalSpend: 460000000, status: 'active', rfm: 'وفادار' },
        { id: 'c-105', company: 'ابر داده سپهر', contact: 'امیر محمدی', email: 'contact@sepehrcloud.io', city: 'تهران', segment: 'startup', orders: 14, totalSpend: 280000000, status: 'active', rfm: 'رشد بالقوه' },
        { id: 'c-106', company: 'پخش سراسری کویر', contact: 'رضا کمالی', email: 'kavir@distrib.ir', city: 'یزد', segment: 'smb', orders: 22, totalSpend: 390000000, status: 'active', rfm: 'وفادار' },
        { id: 'c-107', company: 'هوشمند سازان اروند', contact: 'مریم صالحی', email: 'm.salehi@arvandiot.ir', city: 'اهواز', segment: 'startup', orders: 8, totalSpend: 150000000, status: 'pending', rfm: 'تازه‌وارد' },
        { id: 'c-108', company: 'داروسازی سبحان', contact: 'دکتر صابری', email: 'purchasing@sobhan.ir', city: 'رشت', segment: 'enterprise', orders: 31, totalSpend: 1120000000, status: 'active', rfm: 'قهرمانان (VIP)' },
      ];

      const totalRevenue = customerList.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
      let currentSeg = 'all';

      const renderCustomerTable = () => {
        const filtered = customerList.filter(c => {
          if (currentSeg === 'all') return true;
          return c.segment === currentSeg;
        });

        render(
          node,
          `<div class="dashboard-shell">
            ${pageHeader({
              title: 'مدیریت و تحلیل پیشرفته مشتریان',
              subtitle: 'بانک جامع مشتریان، تحلیل ارزش طول عمر (LTV)، سوابق تراکنش‌ها و رتبه‌بندی RFM',
              icon: 'people-fill',
              actions: `
                <div class="d-flex gap-2">
                  <button class="btn btn-light btn-sm" type="button" data-export-cust><i class="bi bi-download"></i> خروجی اکسل</button>
                  <button class="btn btn-primary btn-sm" type="button" data-new-cust><i class="bi bi-person-plus"></i> مشتری جدید</button>
                </div>
              `,
            })}

            <div class="kpi-row grid grid--4 mb-4">
              ${statCard({ label: 'کل مشتریان ثبت‌شده', value: toDigits(customerList.length * 18), hint: 'بانک اطلاعاتی فعال', tone: 'primary', icon: 'people' })}
              ${statCard({ label: 'ارزش کل تراکنش‌ها (LTV)', value: formatCurrency(totalRevenue, 'IRR', { compact: true }), hint: 'مجموع گردش حساب‌ها', tone: 'success', icon: 'cash-stack' })}
              ${statCard({ label: 'مشتریان سازمانی (Enterprise)', value: toDigits(customerList.filter(c=>c.segment==='enterprise').length * 8), hint: 'حساب‌های کلان B2B', tone: 'info', icon: 'building' })}
              ${statCard({ label: 'نرخ بازگشت به خرید', value: '۷۴٫۸٪', hint: 'شاخص وفاداری مشتریان', tone: 'warning', icon: 'repeat' })}
            </div>

            <div class="card" style="border-radius:18px;">
              <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--nv-border);">
                <div class="segmented" data-cust-filter>
                  <button type="button" class="segmented__item ${currentSeg==='all'?'is-active':''}" data-seg="all">همه (${toDigits(customerList.length)})</button>
                  <button type="button" class="segmented__item ${currentSeg==='enterprise'?'is-active':''}" data-seg="enterprise">سازمانی (B2B)</button>
                  <button type="button" class="segmented__item ${currentSeg==='smb'?'is-active':''}" data-seg="smb">کسب‌وکارها (SMB)</button>
                  <button type="button" class="segmented__item ${currentSeg==='startup'?'is-active':''}" data-seg="startup">استارتاپ‌ها</button>
                </div>

                <div class="input-group input-group--icon" style="max-width:22rem;">
                  <i class="bi bi-search"></i>
                  <input class="form-control form-control--sm" type="search" placeholder="جستجوی شرکت، نام یا شهر..." data-cust-search>
                </div>
              </div>

              <div class="card__body" style="padding:0;">
                <div class="table-responsive">
                  <table class="table table--hover">
                    <thead>
                      <tr>
                        <th>نام شرکت و سازمان</th>
                        <th>مسئول خرید / رابط</th>
                        <th>شهر و استان</th>
                        <th>بخش‌بندی</th>
                        <th class="text-center">سفارش‌ها</th>
                        <th class="text-end">مجموع خرید (LTV)</th>
                        <th>رتبه RFM</th>
                        <th>وضعیت</th>
                        <th class="text-end">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filtered.map((c, idx) => `
                        <tr data-cust-row="${c.id}">
                          <td>
                            <div style="display:flex; align-items:center; gap:10px;">
                              <img src="${safeAvatar(idx + 1)}" style="width:36px; height:36px; border-radius:10px; object-fit:cover; border:1px solid var(--nv-border);" alt="">
                              <div>
                                <a href="customers/details.html?id=${encodeURIComponent(c.id)}" style="font-weight:800; font-size:13px; color:var(--nv-heading); text-decoration:none;">${escapeHtml(c.company)}</a>
                                <div style="font-size:11px; color:var(--nv-text-muted); font-family:var(--nv-font-mono);">${escapeHtml(c.email)}</div>
                              </div>
                            </div>
                          </td>
                          <td style="font-size:12px; font-weight:600;">${escapeHtml(c.contact)}</td>
                          <td><span class="badge badge--soft-light text-muted" style="font-size:11px;"><i class="bi bi-geo-alt"></i> ${escapeHtml(c.city)}</span></td>
                          <td><span class="badge badge--soft-${c.segment==='enterprise'?'primary':c.segment==='smb'?'info':'warning'}" style="font-size:10px;">${c.segment==='enterprise'?'سازمانی':c.segment==='smb'?'کسب‌وکار':'استارتاپ'}</span></td>
                          <td class="text-center numeric" style="font-weight:700;">${toDigits(c.orders)}</td>
                          <td class="text-end numeric" style="font-weight:800; color:var(--nv-primary);">${formatCurrency(c.totalSpend, 'IRR', { compact: true })}</td>
                          <td><span class="badge badge--soft-success" style="font-size:10px;">${escapeHtml(c.rfm || 'وفادار')}</span></td>
                          <td><span class="badge badge--soft-${c.status==='active'?'success':'warning'}" style="font-size:10px;">${c.status==='active'?'فعال':'در انتظار'}</span></td>
                          <td class="text-end">
                            <div class="d-flex justify-content-end gap-1">
                              <a class="btn btn-sm btn-light" href="customers/details.html?id=${encodeURIComponent(c.id)}" style="font-size:11px; padding:3px 8px;" title="مشاهده پرونده"><i class="bi bi-eye"></i></a>
                              <button class="btn btn-sm btn-light" type="button" data-new-order="${c.id}" style="font-size:11px; padding:3px 8px;" title="ثبت سفارش"><i class="bi bi-cart-plus"></i></button>
                            </div>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>`,
        );
      };

      renderCustomerTable();

      on(node, 'click', (e) => {
        const segBtn = e.target.closest('[data-seg]');
        if (segBtn) {
          currentSeg = segBtn.dataset.seg;
          renderCustomerTable();
          return;
        }
        if (e.target.closest('[data-export-cust]')) {
          toast.success('خروجی اکسل آماده شد', 'فایل اکسل مشتریان دانلود شد.');
        }
        if (e.target.closest('[data-new-cust]')) {
          modal.open({
            title: 'ثبت اطلاعات مشتری جدید',
            content: `
              <form class="form-stack">
                <div class="form-field"><label class="form-label">نام شرکت / سازمان *</label><input class="form-control" placeholder="مثال: شرکت داده‌پردازی پیشرو" required></div>
                <div class="grid grid--2"><div class="form-field"><label class="form-label">نام رابط / مسئول خرید</label><input class="form-control" placeholder="نام و نام خانوادگی"></div><div class="form-field"><label class="form-label">شماره تماس</label><input class="form-control" placeholder="۰۲۱-۸۸..."></div></div>
                <div class="grid grid--2"><div class="form-field"><label class="form-label">ایمیل سازمانی</label><input class="form-control" type="email" placeholder="info@company.ir"></div><div class="form-field"><label class="form-label">شهر فعالیت</label><input class="form-control" placeholder="تهران"></div></div>
                <div class="form-field"><label class="form-label">نوع بخش‌بندی (Segment)</label><select class="form-select"><option value="enterprise">سازمانی و B2B کلان</option><option value="smb">کسب‌وکار کوچک و متوسط</option><option value="startup">استارتاپ و دانش‌بنیان</option></select></div>
              </form>
            `,
            footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-confirm-new-cust>ثبت مشتری</button>',
            onMount: (panel) => on($('[data-confirm-new-cust]', panel), 'click', () => { toast.success('مشتری جدید ثبت شد', 'پرونده مشتری با موفقیت ایجاد گردید.'); modal.closeTop(); }),
          });
        }
      });

      on(node, 'input', (e) => {
        const searchInput = e.target.closest('[data-cust-search]');
        if (searchInput) {
          const val = searchInput.value.trim().toLowerCase();
          $$('[data-cust-row]', node).forEach(row => {
            row.style.display = val ? (row.textContent.toLowerCase().includes(val) ? '' : 'none') : '';
          });
        }
      });

      exportable(node, 'customers');
      return;
    }

    case 'customers/details.html': {
      const id = kit.queryParam('id');
      const record = (await loadRecord('customers', id)) ?? (await services.customerService.list({ perPage: 1 })).items[0];
      const orders = await services.orderService.list({ perPage: 5 });
      const node = host();
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: record.company ?? record.name ?? 'مشتری سازمانی',
            subtitle: `${record.contact ?? ''} • ${record.city ?? ''}`,
            icon: 'person-vcard',
            badges: [statusBadge(record.statusLabel ?? 'فعال', 'success')],
            actions: '<a class="btn btn-light" href="customers/list.html"><i class="bi bi-arrow-right"></i> بازگشت به فهرست</a>',
          })}
          <div class="kpi-row" data-customer-kpis></div>
          <div class="grid grid--sidebar">
            ${card({ title: 'اطلاعات مشتری', body: infoRows(Object.entries(record).filter(([, value]) => typeof value === 'string' || typeof value === 'number').slice(0, 12).map(([key, value]) => [key, String(value)])) })}
            <div class="stack">
              ${card({ title: 'آخرین سفارش‌ها', flush: true, body: `<div class="table-responsive"><table class="table table--hover"><thead><tr><th>شماره</th><th>تاریخ</th><th>وضعیت</th><th class="text-end">مبلغ</th></tr></thead>
                <tbody>${orders.items
                  .map((order) => `<tr><td class="table__primary"><a class="table__link" href="ecommerce/order-details.html?id=${encodeURIComponent(order.id)}">${escapeHtml(order.number)}</a></td><td>${formatDate(order.createdAt)}</td><td>${statusBadge(order.statusLabel ?? order.status)}</td><td class="text-end numeric">${formatCurrency(order.total, 'IRR', { compact: true })}</td></tr>`)
                  .join('')}</tbody></table></div>` })}
              ${card({ title: 'تعاملات اخیر', body: timeline([
                { title: 'تماس پشتیبانی', text: 'رفع مشکل درخواست مرجوعی', time: '۲ روز پیش', tone: 'info', icon: 'headset' },
                { title: 'ارسال پیش‌فاکتور', text: 'پیش‌فاکتور تمدید سالانه', time: '۵ روز پیش', tone: 'primary', icon: 'receipt' },
                { title: 'به‌روزرسانی پروفایل', text: 'تغییر آدرس و اطلاعات مالی', time: '۲ هفته پیش', tone: 'success', icon: 'pencil' },
              ], { compact: true }) })}
            </div>
          </div>
        </div>`,
      );
      const kpis = [
        { label: 'سفارش‌ها', value: toDigits(24), icon: 'bag', tone: 'primary' },
        { label: 'ارزش کل (LTV)', value: formatCurrency(record.totalSpend ?? record.value ?? 480000000, 'IRR', { compact: true }), icon: 'cash-stack', tone: 'success' },
        { label: 'شاخص رضایت', value: formatPercent(4.6), icon: 'emoji-smile', tone: 'info' },
        { label: 'بدهی جاری', value: formatCurrency(12000000, 'IRR', { compact: true }), icon: 'exclamation-circle', tone: 'warning' },
      ];
      render(
        $('[data-customer-kpis]', node),
        kpis
          .map(
            (kpi) => `<article class="stat-card"><div class="stat-card__head"><span class="stat-card__label">${escapeHtml(kpi.label)}</span>
              <span class="stat-card__icon stat-card__icon--${kpi.tone}"><i class="bi bi-${kpi.icon}"></i></span></div><p class="stat-card__value numeric">${kpi.value}</p></article>`,
          )
          .join(''),
      );
      return;
    }

    case 'customers/segments.html': {
      const node = host();
      const { items } = await services.customerService.list({ perPage: 200 });
      const labels = { enterprise: 'سازمانی (Enterprise B2B)', smb: 'کسب‌وکار متوسط (SMB)', startup: 'استارتاپ و دانش‌بنیان', retail: 'فروشگاهی و خرد' };
      const grouped = new Map();
      for (const customer of items) {
        const key = customer.segment ?? 'retail';
        const bucket = grouped.get(key) ?? { key, label: labels[key] ?? key, count: 0, revenue: 0, orders: 0 };
        bucket.count += 1;
        bucket.revenue += customer.totalSpend ?? 0;
        bucket.orders += customer.orders ?? 0;
        grouped.set(key, bucket);
      }
      const segments = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
      const totalRev = segments.reduce((s, seg) => s + seg.revenue, 0);

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'دسته‌بندی و بخش‌بندی مشتریان (RFM Segmentation)',
            subtitle: 'تحلیل رفتار خرید، ارزش طول عمر (LTV)، تفکیک بخش‌های درآمدی و استراتژی‌های حفظ مشتری',
            icon: 'diagram-3-fill',
            actions: '<button class="btn btn-primary" type="button" data-new-campaign><i class="bi bi-megaphone"></i> تعریف کمپین بخش‌بندی</button>',
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'بخش‌های فعال درآمدی', value: toDigits(segments.length), hint: 'دسته‌بندی بر مبنای RFM', tone: 'primary', icon: 'pie-chart' })}
            ${statCard({ label: 'بالاترین سهم درآمد', value: '۶۴٪', hint: 'متعلق به بخش سازمانی', tone: 'success', icon: 'trophy' })}
            ${statCard({ label: 'میانگین سفارش هر بخش', value: toDigits(Math.round(segments.reduce((s,seg)=>s+seg.orders,0)/segments.length)), hint: 'سفارشات موفق دوره‌ای', tone: 'info', icon: 'bag-check' })}
            ${statCard({ label: 'نرخ بازگشت مشتری (Retention)', value: '۸۲٫۴٪', hint: 'شاخص وفاداری مشتریان', tone: 'warning', icon: 'arrow-repeat' })}
          </div>

          <!-- Segment Highlight Cards -->
          <div class="grid grid--4 mb-4" style="gap:16px;">
            <div class="card" style="border-radius:16px; border:1px solid var(--nv-border); background:var(--nv-surface); padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge--soft-primary" style="font-size:11px;">قهرمانان (VIP)</span>
                <span style="font-size:11px; color:var(--nv-success); font-weight:700;">سهم: ۶۴٪</span>
              </div>
              <h4 style="margin:0 0 6px; font-size:14px; font-weight:800;">سازمانی و دولتی</h4>
              <p style="margin:0 0 10px; font-size:11px; color:var(--nv-text-muted);">خرید بالا و چرخه منظم قراردادها</p>
              <div class="progress progress--sm" style="height:5px;"><div class="progress-bar bg-primary" style="width:64%;"></div></div>
            </div>

            <div class="card" style="border-radius:16px; border:1px solid var(--nv-border); background:var(--nv-surface); padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge--soft-info" style="font-size:11px;">مشتریان باارزش</span>
                <span style="font-size:11px; color:var(--nv-info); font-weight:700;">سهم: ۲۲٪</span>
              </div>
              <h4 style="margin:0 0 6px; font-size:14px; font-weight:800;">کسب‌وکارهای متوسط (SMB)</h4>
              <p style="margin:0 0 10px; font-size:11px; color:var(--nv-text-muted);">تکرار خرید ماهانه با رشد پایدار</p>
              <div class="progress progress--sm" style="height:5px;"><div class="progress-bar bg-info" style="width:22%;"></div></div>
            </div>

            <div class="card" style="border-radius:16px; border:1px solid var(--nv-border); background:var(--nv-surface); padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge--soft-warning" style="font-size:11px;">پتانسیل رشد</span>
                <span style="font-size:11px; color:var(--nv-warning); font-weight:700;">سهم: ۱۱٪</span>
              </div>
              <h4 style="margin:0 0 6px; font-size:14px; font-weight:800;">استارتاپ‌ها و نوپاها</h4>
              <p style="margin:0 0 10px; font-size:11px; color:var(--nv-text-muted);">نرخ پذیرش ابزارهای جدید عالی</p>
              <div class="progress progress--sm" style="height:5px;"><div class="progress-bar bg-warning" style="width:11%;"></div></div>
            </div>

            <div class="card" style="border-radius:16px; border:1px solid var(--nv-border); background:var(--nv-surface); padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge--soft-danger" style="font-size:11px;">در معرض ریزش</span>
                <span style="font-size:11px; color:var(--nv-danger); font-weight:700;">سهم: ۳٪</span>
              </div>
              <h4 style="margin:0 0 6px; font-size:14px; font-weight:800;">مشتریان کم‌تحرک</h4>
              <p style="margin:0 0 10px; font-size:11px; color:var(--nv-text-muted);">عدم خرید در ۶۰ روز گذشته</p>
              <div class="progress progress--sm" style="height:5px;"><div class="progress-bar bg-danger" style="width:3%;"></div></div>
            </div>
          </div>

          <div class="grid grid--2 mb-4">
            ${card({ title: 'سهم درآمدی هر بخش از کل فروش', body: chartBox({ key: 'segments', type: 'donut', height: 320, series: segments.map((s) => s.revenue), labels: segments.map((s) => s.label) }) })}
            ${card({ title: 'تعداد مشتریان در هر سگمنت', body: chartBox({ key: 'segmentSizes', type: 'bar', height: 320, series: [{ name: 'مشتری', data: segments.map((s) => s.count) }], labels: segments.map((s) => s.label) }) })}
          </div>

          ${card({
            title: 'جدول تحلیلی عملکرد سگمنت‌های مشتریان',
            subtitle: 'بررسی شاخص‌های میانگین سبد خرید، تعداد تراکنش و سهم ریالی هر بخش',
            flush: true,
            body: `<div class="table-responsive"><table class="table table--hover">
              <thead>
                <tr>
                  <th>عنوان سگمنت</th>
                  <th class="text-end">تعداد مشتریان</th>
                  <th class="text-end">کل سفارش‌ها</th>
                  <th class="text-end">درآمد کل</th>
                  <th class="text-end">میانگین هر مشتری</th>
                  <th class="text-center">سهم درآمدی</th>
                  <th class="text-end">استراتژی پیشنهادی</th>
                </tr>
              </thead>
              <tbody>
                ${segments.map((segment) => {
                  const sharePct = totalRev ? Math.round((segment.revenue / totalRev) * 100) : 0;
                  return `
                    <tr>
                      <td class="table__primary" style="font-weight:800;">${escapeHtml(segment.label)}</td>
                      <td class="text-end numeric">${toDigits(segment.count)}</td>
                      <td class="text-end numeric">${toDigits(segment.orders)}</td>
                      <td class="text-end numeric" style="font-weight:700; color:var(--nv-primary);">${formatCurrency(segment.revenue, 'IRR', { compact: true })}</td>
                      <td class="text-end numeric">${formatCurrency(segment.count ? segment.revenue / segment.count : 0, 'IRR', { compact: true })}</td>
                      <td class="text-center"><span class="badge badge--soft-${sharePct > 40 ? 'primary' : sharePct > 15 ? 'info' : 'warning'} rounded-pill">${toDigits(sharePct)}٪</span></td>
                      <td class="text-end">
                        <button class="btn btn-sm btn-light" type="button" data-segment-action="${segment.key}" style="font-size:11px; padding:3px 10px;">اجرای کمپین</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table></div>`,
          })}
        </div>`,
      );
      initCharts(node);

      on(node, 'click', (e) => {
        const segBtn = e.target.closest('[data-segment-action]');
        if (segBtn) {
          toast.success('کمپین فعال شد', `کمپین بازاریابی برای بخش «${segBtn.dataset.segmentAction}» ایجاد گردید.`);
        }
        if (e.target.closest('[data-new-campaign]')) {
          toast.info('کمپین جدید', 'فرم تعریف کمپین هوشمند سگمنت باز شد.');
        }
      });
      return;
    }

    default:
      return;
  }
}

export {
  initEcommerce,
  initCustomers,
  initCrm,
  initFinance,
  initProjects,
  initSupport,
  initHr,
  initLogistics,
  initReports,
  initUsers,
};

export const areaControllers = {
  initEcommerce,
  initCustomers,
  initCrm,
  initFinance,
  initProjects,
  initSupport,
  initHr,
  initLogistics,
  initReports,
  initUsers,
};

export default areaControllers;
