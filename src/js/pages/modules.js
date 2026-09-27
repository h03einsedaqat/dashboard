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
      await detailPage({
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
              <img class="detail-split__media" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />
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
      const overview = await services.catalogService.overview();
      const catList = await services.categoryService?.list?.({ perPage: 50 }).catch(() => null) ?? { items: [] };
      let categories = catList.items?.length ? catList.items : [
        { id: 'cat-1', name: 'لپ‌تاپ و اولترابوک', slug: 'laptops-ultrabooks', icon: 'laptop', products: 38, parent: 'کالای دیجیتال', status: 'active', revenue: 4200000000 },
        { id: 'cat-2', name: 'گوشی موبایل و تبلت', slug: 'phones-tablets', icon: 'phone', products: 45, parent: 'کالای دیجیتال', status: 'active', revenue: 5800000000 },
        { id: 'cat-3', name: 'هدفون و تجهیزات صوتی', slug: 'audio-headphones', icon: 'headphones', products: 29, parent: 'لوازم جانبی', status: 'active', revenue: 1950000000 },
        { id: 'cat-4', name: 'ساعت و گجت‌های هوشمند', slug: 'smartwatches-gadgets', icon: 'smartwatch', products: 22, parent: 'پوشیدنی‌ها', status: 'active', revenue: 1420000000 },
        { id: 'cat-5', name: 'لوازم جانبی کامپیوتر', slug: 'computer-accessories', icon: 'mouse', products: 64, parent: 'تجهیزات جانبی', status: 'active', revenue: 2310000000 },
        { id: 'cat-6', name: 'تجهیزات ذخیره‌سازی داده', slug: 'storage-devices', icon: 'hdd', products: 19, parent: 'سخت‌افزار', status: 'inactive', revenue: 890000000 },
        { id: 'cat-7', name: 'کنسول بازی و گیمینگ', slug: 'gaming-consoles', icon: 'controller', products: 31, parent: 'سرگرمی', status: 'active', revenue: 3750000000 },
        { id: 'cat-8', name: 'پرینتر و تجهیزات اداری', slug: 'printers-office', icon: 'printer', products: 14, parent: 'ماشین‌های اداری', status: 'inactive', revenue: 640000000 },
      ];

      const renderCategories = (filterText = '') => {
        const filtered = categories.filter((c) => !filterText || c.name.toLowerCase().includes(filterText.toLowerCase()) || c.slug.toLowerCase().includes(filterText.toLowerCase()));
        const activeCount = categories.filter((c) => c.status === 'active').length;
        const inactiveCount = categories.length - activeCount;

        render(
          node,
          `<div class="dashboard-shell">
            ${pageHeader({
              title: 'دسته‌بندی‌های فروشگاه',
              subtitle: 'مدیریت و پیکربندی ساختار دسته‌بندی‌ها با امکان فعال یا غیرفعال‌سازی آنی',
              icon: 'tags',
              actions: `<button class="btn btn-primary" type="button" data-add-cat><i class="bi bi-plus-lg me-1"></i>افزودن دسته‌بندی جدید</button>`
            })}
            <div class="stat-grid mb-4">
              <article class="stat-card stat-card--primary">
                <span class="stat-card__icon"><i class="bi bi-tags"></i></span>
                <p class="stat-card__label">کل دسته‌بندی‌ها</p>
                <p class="stat-card__value">${toDigits(categories.length)}</p>
                <p class="stat-card__meta">سرگروه‌ها و زیرمجموعه‌ها</p>
              </article>
              <article class="stat-card stat-card--success">
                <span class="stat-card__icon"><i class="bi bi-check-circle"></i></span>
                <p class="stat-card__label">دسته‌های فعال</p>
                <p class="stat-card__value text-success">${toDigits(activeCount)}</p>
                <p class="stat-card__meta text-success"><i class="bi bi-eye"></i> قابل مشاهده در ویترین</p>
              </article>
              <article class="stat-card stat-card--warning">
                <span class="stat-card__icon"><i class="bi bi-pause-circle"></i></span>
                <p class="stat-card__label">دسته‌های غیرفعال</p>
                <p class="stat-card__value text-warning">${toDigits(inactiveCount)}</p>
                <p class="stat-card__meta text-muted"><i class="bi bi-eye-slash"></i> موقتاً مخفی در فروشگاه</p>
              </article>
              <article class="stat-card stat-card--info">
                <span class="stat-card__icon"><i class="bi bi-box-seam"></i></span>
                <p class="stat-card__label">محصولات تحت پوشش</p>
                <p class="stat-card__value">${toDigits(categories.reduce((s, c) => s + (c.products || 0), 0))}</p>
                <p class="stat-card__meta">تعداد کالاهای ثبت‌شده</p>
              </article>
            </div>
            <div class="card">
              <div class="card__head d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <h2 class="card__title">فهرست و وضعیت دسته‌بندی‌ها</h2>
                  <p class="card__subtitle">برای فعال یا غیرفعال کردن نمایش دسته، کلید سوییچ مربوطه را تغییر دهید</p>
                </div>
                <div class="d-flex gap-2">
                  <div class="input-icon" style="min-width: 220px;">
                    <i class="bi bi-search"></i>
                    <input type="search" class="form-control form-control-sm" placeholder="جستجوی دسته‌بندی..." data-search-cat value="${escapeHtml(filterText)}">
                  </div>
                </div>
              </div>
              <div class="card__body p-0">
                <div class="table-wrap">
                  <table class="table table--hover mb-0">
                    <thead>
                      <tr>
                        <th>نام و آیکون دسته</th>
                        <th>پیوند یکتا (Slug)</th>
                        <th>دسته والد</th>
                        <th>تعداد محصولات</th>
                        <th>وضعیت کنونی</th>
                        <th>سوییچ فعال / غیرفعال</th>
                        <th class="text-end">عملیات</th>
                      </tr>
                    </thead>
                    <tbody data-cat-tbody>
                      ${filtered.map((cat) => `
                        <tr data-cat-id="${cat.id}">
                          <td>
                            <div class="d-flex align-items-center gap-2">
                              <span class="tile tile--soft tile--icon tile--soft-primary" style="width:36px; height:36px; border-radius:10px; display:grid; place-items:center;">
                                <i class="bi bi-${cat.icon || 'tag'}"></i>
                              </span>
                              <div>
                                <span class="fw-bold">${escapeHtml(cat.name)}</span>
                                <small class="text-muted d-block">${cat.id}</small>
                              </div>
                            </div>
                          </td>
                          <td><code>${escapeHtml(cat.slug || cat.id)}</code></td>
                          <td>${escapeHtml(cat.parent || '— (دسته اصلی)')}</td>
                          <td class="numeric fw-semibold">${toDigits(cat.products || 0)} کالا</td>
                          <td>
                            <span class="badge badge--soft-${cat.status === 'active' ? 'success' : 'secondary'}" data-status-badge="${cat.id}">
                              ${cat.status === 'active' ? 'فعال' : 'غیرفعال'}
                            </span>
                          </td>
                          <td>
                            <div class="form-check form-switch m-0" style="min-height:auto;">
                              <input class="form-check-input" type="checkbox" role="switch" data-toggle-cat="${cat.id}" ${cat.status === 'active' ? 'checked' : ''} style="cursor:pointer; width:2.5em; height:1.25em;">
                            </div>
                          </td>
                          <td class="text-end">
                            <button class="btn btn-sm btn-light" type="button" data-edit-cat="${cat.id}" title="ویرایش"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-light text-danger" type="button" data-del-cat="${cat.id}" title="حذف"><i class="bi bi-trash"></i></button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>`
        );
      };

      renderCategories();

      // Search event
      on(node, 'input', (e) => {
        const input = e.target.closest('[data-search-cat]');
        if (input) {
          renderCategories(input.value);
        }
      });

      // Switch toggle event listener
      on(node, 'change', (e) => {
        const toggle = e.target.closest('[data-toggle-cat]');
        if (!toggle) return;
        const catId = toggle.dataset.toggleCat;
        const cat = categories.find((c) => c.id === catId);
        if (!cat) return;
        const isChecked = toggle.checked;
        cat.status = isChecked ? 'active' : 'inactive';
        
        const badge = $(`[data-status-badge="${catId}"]`, node);
        if (badge) {
          badge.className = `badge badge--soft-${isChecked ? 'success' : 'secondary'}`;
          badge.textContent = isChecked ? 'فعال' : 'غیرفعال';
        }
        toast.success(
          isChecked ? 'دسته‌بندی فعال شد' : 'دسته‌بندی غیرفعال شد',
          `وضعیت «${cat.name}» به ${isChecked ? 'فعال (منتشرشده در ویترین)' : 'غیرفعال (مخفی)'} تغییر یافت.`
        );
      });

      // Add category modal
      on(node, 'click', (e) => {
        if (e.target.closest('[data-add-cat]')) {
          modal.open({
            title: 'افزودن دسته‌بندی جدید',
            content: `
              <form id="new-cat-form" class="stack gap-3">
                <div>
                  <label class="form-label">نام دسته‌بندی</label>
                  <input type="text" name="name" class="form-control" required placeholder="مثلاً لوازم خانگی هوشمند">
                </div>
                <div>
                  <label class="form-label">پیوند یکتا (Slug)</label>
                  <input type="text" name="slug" class="form-control" placeholder="smart-home">
                </div>
                <div>
                  <label class="form-label">دسته والد (سرگروه)</label>
                  <select name="parent" class="form-select">
                    <option value="">— دسته اصلی (بدون والد) —</option>
                    ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-check form-switch pt-2">
                  <input class="form-check-input" type="checkbox" name="active" id="new-cat-active" checked>
                  <label class="form-check-label" for="new-cat-active">دسته‌بندی بلافاصله فعال و منتشر شود</label>
                </div>
              </form>
            `,
            footer: `
              <button class="btn btn-light" type="button" data-modal-close>انصراف</button>
              <button class="btn btn-primary" type="button" data-save-new-cat>ثبت دسته‌بندی</button>
            `
          });
        }
        if (e.target.closest('[data-save-new-cat]')) {
          const form = $('#new-cat-form');
          if (form) {
            const name = form.name.value.trim();
            if (!name) {
              toast.warning('خطای ورودی', 'لطفاً نام دسته‌بندی را وارد کنید.');
              return;
            }
            const newCat = {
              id: `cat-${categories.length + 1}`,
              name,
              slug: form.slug.value.trim() || name.replace(/\s+/g, '-'),
              icon: 'tag',
              products: 0,
              parent: form.parent.value || null,
              status: form.active.checked ? 'active' : 'inactive',
              revenue: 0
            };
            categories.unshift(newCat);
            modal.close();
            renderCategories();
            toast.success('دسته‌بندی جدید ثبت شد', `دسته‌بندی «${name}» با موفقیت اضافه شد.`);
          }
        }
      });

      return;
    }

    case 'ecommerce/brands.html':
    case 'ecommerce/tags.html':
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

  // Gallery state
  let productImages = values.images || [
    { id: 'img-1', url: values.image || 'assets/img/products/product-01.svg', name: 'تصویر اصلی ۱', isCover: true },
    { id: 'img-2', url: 'assets/img/products/product-02.svg', name: 'نمای زاویه‌دار ۲', isCover: false },
  ];
  let currentImageIndex = 0;

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
        <!-- Gallery & Carousel Column -->
        <div class="col-lg-5">
          <div class="card h-100">
            <div class="card__head d-flex justify-content-between align-items-center">
              <div>
                <h3 class="card__title fs-6 fw-bold m-0"><i class="bi bi-images me-1 text-primary"></i> گالری و تصاویر محصول</h3>
                <p class="card__subtitle m-0 small text-muted">آپلود چندین عکس با پیش‌نمایش Carousel متحرک</p>
              </div>
            </div>
            <div class="card__body" data-gallery-container></div>
          </div>
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

  const galleryContainer = $('[data-gallery-container]', node);

  const renderGalleryUi = () => {
    if (!galleryContainer) return;
    const currentImg = productImages[currentImageIndex] || productImages[0];
    const isMulti = productImages.length >= 2;

    render(
      galleryContainer,
      `<div class="d-flex flex-column gap-3">
        <!-- Dropzone Area -->
        <div class="p-3 text-center rounded-3 border border-2 border-dashed" data-dropzone style="background: var(--nv-surface-2); cursor: pointer; transition: all 0.2s ease;">
          <input type="file" multiple accept="image/*" class="d-none" data-file-input>
          <i class="bi bi-cloud-arrow-up fs-2 text-primary d-block mb-1"></i>
          <span class="fw-bold d-block small">کلیک کنید یا فایل‌های عکس را به اینجا بکشید</span>
          <span class="text-muted" style="font-size: 11px;">امکان انتخاب همزمان چندین عکس (PNG, JPG, WebP)</span>
          <div class="mt-2 d-flex justify-content-center gap-2">
            <button type="button" class="btn btn-xs btn-outline-primary" data-btn-browse><i class="bi bi-folder-plus me-1"></i>انتخاب فایل‌ها</button>
            <button type="button" class="btn btn-xs btn-light" data-add-sample-photos><i class="bi bi-magic me-1"></i>افزودن تصاویر نمونه</button>
          </div>
        </div>

        ${productImages.length > 0 ? `
          <!-- Main Carousel Display -->
          <div class="position-relative rounded-3 border overflow-hidden d-flex align-items-center justify-content-center" style="background: var(--nv-surface); min-height: 270px; height: 270px;">
            <img src="${escapeHtml(currentImg.url)}" alt="${escapeHtml(currentImg.name)}" style="max-height: 240px; max-width: 90%; object-fit: contain; transition: transform 0.3s ease;">
            
            ${isMulti ? `
              <button type="button" class="btn btn-sm btn-dark rounded-circle position-absolute start-0 top-50 translate-middle-y ms-2 shadow-sm" data-carousel-prev title="تصویر قبلی" style="width:34px; height:34px; display:grid; place-items:center; z-index:2;">
                <i class="bi bi-chevron-right"></i>
              </button>
              <button type="button" class="btn btn-sm btn-dark rounded-circle position-absolute end-0 top-50 translate-middle-y me-2 shadow-sm" data-carousel-next title="تصویر بعدی" style="width:34px; height:34px; display:grid; place-items:center; z-index:2;">
                <i class="bi bi-chevron-left"></i>
              </button>
              <div class="position-absolute bottom-0 start-50 translate-middle-x mb-2 badge bg-dark bg-opacity-75 rounded-pill px-3 py-1" style="font-size:11px; z-index:2;">
                تصویر ${toDigits(currentImageIndex + 1)} از ${toDigits(productImages.length)}
              </div>
            ` : ''}

            <!-- Image Actions Overlay -->
            <div class="position-absolute top-0 end-0 m-2 d-flex gap-1" style="z-index:2;">
              ${currentImg.isCover ? `
                <span class="badge bg-primary shadow-sm"><i class="bi bi-star-fill me-1"></i>کاور اصلی</span>
              ` : `
                <button type="button" class="btn btn-xs btn-light shadow-sm" data-set-cover="${currentImg.id}" title="انتخاب به عنوان کاور">
                  <i class="bi bi-star me-1"></i>کاور اصلی شود
                </button>
              `}
              <button type="button" class="btn btn-xs btn-danger shadow-sm" data-delete-img="${currentImg.id}" title="حذف این تصویر">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

          <!-- Thumbnails Row -->
          <div>
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="small fw-bold">تصاویر آپلودشده (${toDigits(productImages.length)} عکس):</span>
              <span class="text-muted" style="font-size: 11px;">برای مشاهده در اسلایدر کلیک کنید</span>
            </div>
            <div class="d-flex align-items-center gap-2 overflow-auto py-1">
              ${productImages.map((img, idx) => `
                <div class="position-relative rounded-2 border ${idx === currentImageIndex ? 'border-primary border-2 shadow-sm' : 'border-secondary-subtle'}" data-thumb-idx="${idx}" style="width: 58px; height: 58px; flex-shrink: 0; cursor: pointer; padding: 2px; background: var(--nv-surface); transition: all 0.2s ease;">
                  <img src="${escapeHtml(img.url)}" alt="" style="width: 100%; height: 100%; object-fit: contain;">
                  ${img.isCover ? '<span class="position-absolute top-0 start-0 badge bg-primary p-0 d-flex align-items-center justify-content-center" style="width:16px; height:16px; font-size: 9px; border-radius: 4px;"><i class="bi bi-check"></i></span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`
    );
  };

  renderGalleryUi();

  // Gallery Events
  on(galleryContainer, 'click', (e) => {
    // Browse trigger
    if (e.target.closest('[data-btn-browse]') || e.target.closest('[data-dropzone]')) {
      const fileInput = $('[data-file-input]', galleryContainer);
      if (fileInput && !e.target.closest('button')) fileInput.click();
      else if (e.target.closest('[data-btn-browse]')) fileInput?.click();
    }

    // Add sample photos
    if (e.target.closest('[data-add-sample-photos]')) {
      const samples = [
        { id: `img-${Date.now()}-1`, url: 'assets/img/products/product-01.svg', name: 'تصویر نمونه ۱ (کاور)', isCover: productImages.length === 0 },
        { id: `img-${Date.now()}-2`, url: 'assets/img/products/product-02.svg', name: 'تصویر نمونه ۲', isCover: false },
        { id: `img-${Date.now()}-3`, url: 'assets/img/products/product-03.svg', name: 'تصویر نمونه ۳', isCover: false },
        { id: `img-${Date.now()}-4`, url: 'assets/img/products/product-04.svg', name: 'تصویر نمونه ۴', isCover: false },
      ];
      productImages = [...productImages, ...samples];
      toast.success('تصاویر نمونه افزوده شد', `${samples.length} تصویر با موفقیت به اسلایدر اضافه گردید.`);
      renderGalleryUi();
      return;
    }

    // Prev / Next carousel
    if (e.target.closest('[data-carousel-prev]')) {
      currentImageIndex = (currentImageIndex - 1 + productImages.length) % productImages.length;
      renderGalleryUi();
      return;
    }
    if (e.target.closest('[data-carousel-next]')) {
      currentImageIndex = (currentImageIndex + 1) % productImages.length;
      renderGalleryUi();
      return;
    }

    // Select thumbnail
    const thumbEl = e.target.closest('[data-thumb-idx]');
    if (thumbEl) {
      currentImageIndex = Number(thumbEl.dataset.thumbIdx);
      renderGalleryUi();
      return;
    }

    // Set cover
    const setCoverBtn = e.target.closest('[data-set-cover]');
    if (setCoverBtn) {
      const imgId = setCoverBtn.dataset.setCover;
      productImages.forEach((img) => {
        img.isCover = img.id === imgId;
      });
      toast.success('کاور اصلی انتخاب شد', 'این تصویر به عنوان کاور پیش‌فرض محصول تنظیم شد.');
      renderGalleryUi();
      return;
    }

    // Delete image
    const delBtn = e.target.closest('[data-delete-img]');
    if (delBtn) {
      const imgId = delBtn.dataset.deleteImg;
      productImages = productImages.filter((img) => img.id !== imgId);
      if (productImages.length > 0 && !productImages.some((i) => i.isCover)) {
        productImages[0].isCover = true;
      }
      currentImageIndex = Math.max(0, Math.min(currentImageIndex, productImages.length - 1));
      toast.info('تصویر حذف شد', 'تصویر از گالری محصول برداشته شد.');
      renderGalleryUi();
      return;
    }
  });

  // File upload change handler
  on(galleryContainer, 'change', (e) => {
    const fileInput = e.target.closest('[data-file-input]');
    if (!fileInput || !fileInput.files.length) return;
    const files = Array.from(fileInput.files);
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      productImages.push({
        id: `img-${Date.now()}-${index}`,
        url,
        name: file.name,
        isCover: productImages.length === 0 && index === 0,
      });
    });
    toast.success('آپلود موفق', `${files.length} تصویر جدید بارگذاری شد.`);
    currentImageIndex = productImages.length - 1;
    renderGalleryUi();
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

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: isCrm ? 'قیف فروش' : 'کانبان پروژه',
            subtitle: isCrm ? 'کارت‌ها را بین مراحل جابجا کنید — تغییر مرحله واقعی است و در حافظه مرورگر نگه داشته می‌شود.' : 'جابجایی کارت‌ها وضعیت تسک را تغییر می‌دهد.',
            icon: 'kanban',
            badges: [isCrm ? statusBadge(`مجموع: ${formatCurrency(columns.reduce((sum, c) => sum + c.items.reduce((s, i) => s + (i.value ?? 0), 0), 0), 'IRR', { compact: true })}`, 'primary') : statusBadge(`${toDigits(columns.reduce((sum, c) => sum + c.items.length, 0))} تسک در ${toDigits(columns.length)} ستون`, 'primary')],
            actions: toolButtons({ create: isCrm ? 'معامله جدید' : 'تسک جدید' }),
          })}
          ${kanbanMarkup({ columns })}
        </div>`,
      );

      initKanban($('[data-kanban]', node));
      if (window.__novaKanbanOff) window.__novaKanbanOff();
      window.__novaKanbanOff = bus.on('kanban:move', async ({ id, status, previous }) => {
        try {
          if (isCrm) await services.pipelineService.move(id, status, 0);
          else await services.kanbanService.move(id, status, previous);
          toast.success('مرحله به‌روزرسانی شد', 'تغییر با موفقیت ذخیره شد.');
          bus.emit(EVENTS.dataChanged, { resource: isCrm ? 'deals' : 'tasks', action: 'move', id });
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
                .filter(([key, value]) => !['id', 'timeline', 'notes', 'avatar', 'logo'].includes(key) && (typeof value === 'string' || typeof value === 'number'))
                .slice(0, 10)
                .map(([key, value]) => [key, String(value)]),
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
       * sheet as `rows`, and receivables as a *plain array* of buckets. Every
       * number on this page is read from those fields; the ageing percentages
       * are derived here rather than expected from the service.
       */
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
        const peak = Math.max(1, ...buckets.map((bucket) => bucket.amount ?? 0));
        const assets = (balance.rows ?? []).filter((row) => row.value > 0);
        const liabilities = (balance.rows ?? []).filter((row) => row.value <= 0);
        return `<div class="dashboard-shell">
          ${pageHeader({
            title: 'نمای کلی مالی',
            subtitle: 'جریان نقدی دوازده ماه، ترازنامه و مطالبات باز — همه از همان لایه سرویس',
            icon: 'cash-stack',
            actions: toolButtons({ create: 'ثبت دستی', exportResource: 'transactions' }),
          })}
          ${statsFrom(
            { inflow: cashFlow.inflow, outflow: cashFlow.outflow, net: cashFlow.net, outstanding },
            [
              ['inflow', 'ورودی دوره', 'currency', 'success', 'arrow-down-circle'],
              ['outflow', 'خروجی دوره', 'currency', 'danger', 'arrow-up-circle'],
              ['net', 'خالص دوره', 'currency', 'primary', 'activity'],
              ['outstanding', 'مطالبات باز', 'currency', 'warning', 'hourglass-split'],
            ],
          )}
          <div class="widget-grid">
            ${card({
              span: 8,
              title: 'جریان نقدی دوازده ماه',
              subtitle: 'ستون‌های ورودی و خروجی از رکوردهای واقعی ماه‌به‌ماه ساخته شده‌اند',
              body: `<div class="chart" data-chart-key="cashflow" data-chart="bar" data-chart-height="320" data-chart-series='${JSON.stringify([
                { name: 'ورودی', data: months.map((row) => row.inflow) },
                { name: 'خروجی', data: months.map((row) => row.outflow) },
              ])}' data-chart-labels='${JSON.stringify(labels)}'></div>`,
              foot: `<span class="fs-caption text-muted">بیشترین ورودی: <strong class="numeric">${escapeHtml(
                formatCurrency(Math.max(0, ...months.map((row) => row.inflow)), 'IRR', { compact: true }),
              )}</strong> · کمترین خالص ماهانه: <strong class="numeric">${escapeHtml(
                formatCurrency(Math.min(...months.map((row) => row.inflow - row.outflow)), 'IRR', { compact: true }),
              )}</strong></span>`,
            })}
            ${card({
              span: 4,
              title: 'ترکیب ترازنامه',
              subtitle: `${toDigits(assets.length)} دارایی در برابر ${toDigits(liabilities.length)} بدهی`,
              body: `<div class="chart" data-chart-key="balance" data-chart="donut" data-chart-height="220" data-chart-series='${JSON.stringify(
                assets.map((row) => row.value),
              )}' data-chart-labels='${JSON.stringify(assets.map((row) => row.label))}'></div>
                ${infoRows(
                  [...assets, ...liabilities].map((row) => [
                    row.label,
                    `<span class="numeric ${row.value > 0 ? 'text-success' : 'text-danger'}">${escapeHtml(formatCurrency(row.value, 'IRR', { compact: true }))}</span>`,
                  ]),
                )}`,
            })}
            ${card({
              span: 4,
              title: 'صورت سود و زیان',
              subtitle: `حاشیه سود ${toDigits(profit.margin ?? 0)}٪`,
              body: `<ul class="list-group list-group--flush">${(profit.lines ?? [])
                .map(
                  (line) => `<li class="list-group__item"><span class="list-item__title">${escapeHtml(line.label)}</span><span class="list-item__meta numeric text-${line.tone ?? 'default'}">${escapeHtml(
                    formatCurrency(line.value, 'IRR', { compact: true }),
                  )}</span></li>`,
                )
                .join('')}</ul>`,
            })}
            ${card({
              span: 8,
              title: 'گزارش سنی مطالبات',
              subtitle: `${toDigits(buckets.reduce((sum, bucket) => sum + (bucket.count ?? 0), 0))} فاکتور تسویه‌نشده بر اساس روزهای گذشته از سررسید`,
              flush: (buckets ?? []).length > 0,
              body: (buckets ?? []).length
                ? `<div class="table-wrap"><table class="table table--hover table--compact"><thead><tr><th>بازه</th><th class="text-center">فاکتور</th><th class="text-end">مبلغ باز</th><th>سهم از کل</th></tr></thead><tbody>${buckets
                    .map(
                      (bucket) => `<tr>
                        <th scope="row">${escapeHtml(bucket.label)}</th>
                        <td class="text-center numeric">${toDigits(bucket.count ?? 0)}</td>
                        <td class="text-end numeric">${escapeHtml(formatCurrency(bucket.amount ?? 0, 'IRR'))}</td>
                        <td><div class="progress progress--sm"><div class="progress-bar progress-bar--${bucket.days > 60 ? 'danger' : bucket.days > 30 ? 'warning' : 'primary'}" style="width:${Math.round(
                          ((bucket.amount ?? 0) / peak) * 100,
                        )}%"></div></div></td>
                      </tr>`,
                    )
                    .join('')}</tbody></table></div>`
                : emptyState({ title: 'فاکتور تسویه‌نشده‌ای وجود ندارد', text: 'همه فاکتورهای این دوره پرداخت شده‌اند.', icon: 'check2-circle' }),
            })}
            ${card({
              span: 12,
              title: 'ریتم ماهانه',
              subtitle: 'همان اعداد نمودار، به‌صورت جدول — برای مغایرت‌گیری و پیوست گزارش',
              flush: true,
              body: `<div class="table-wrap"><table class="table table--hover table--compact"><thead><tr><th>ماه</th><th class="text-end">ورودی</th><th class="text-end">خروجی</th><th class="text-end">خالص</th><th class="text-end">نرخ پوشش</th></tr></thead><tbody>${months
                .map((row, index) => {
                  const net = row.inflow - row.outflow;
                  const cover = row.outflow ? Math.round((row.inflow / row.outflow) * 100) : 0;
                  return `<tr><th scope="row">${escapeHtml(labels[index] ?? '')}</th>
                    <td class="text-end numeric">${escapeHtml(formatCurrency(row.inflow, 'IRR', { compact: true }))}</td>
                    <td class="text-end numeric">${escapeHtml(formatCurrency(row.outflow, 'IRR', { compact: true }))}</td>
                    <td class="text-end numeric ${net >= 0 ? 'text-success' : 'text-danger'}">${escapeHtml(formatCurrency(net, 'IRR', { compact: true }))}</td>
                    <td class="text-end numeric">${toDigits(cover)}٪</td></tr>`;
                })
                .join('')}</tbody></table></div>`,
            })}
          </div>
        </div>`;
      };
      await withState(node, paint, {
        skeleton: 'chart',
        title: 'نمای کلی مالی',
        onData: (target) => {
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
          <div class="stat-grid mb-4">
            <article class="stat-card stat-card--primary">
              <span class="stat-card__icon"><i class="bi bi-receipt"></i></span>
              <p class="stat-card__label">کل صورتحساب‌ها</p>
              <p class="stat-card__value">${formatCurrency(totalAmount, 'IRR')}</p>
              <p class="stat-card__meta text-success"><i class="bi bi-arrow-up-right"></i> +۱۴٫۵٪ نسبت به دوره قبل</p>
            </article>
            <article class="stat-card stat-card--success">
              <span class="stat-card__icon"><i class="bi bi-check-circle"></i></span>
              <p class="stat-card__label">وصول‌شده (تسویه کامل)</p>
              <p class="stat-card__value">${formatCurrency(paidAmount, 'IRR')}</p>
              <p class="stat-card__meta text-success"><i class="bi bi-shield-check"></i> نرخ وصول ۹۲٫۴٪</p>
            </article>
            <article class="stat-card stat-card--danger">
              <span class="stat-card__icon"><i class="bi bi-exclamation-octagon"></i></span>
              <p class="stat-card__label">معوق و سررسید گذشته</p>
              <p class="stat-card__value">${formatCurrency(overdueAmount, 'IRR')}</p>
              <p class="stat-card__meta text-danger"><i class="bi bi-clock-history"></i> ${toDigits(overdueCount)} فاکتور نیازمند پیگیری</p>
            </article>
            <article class="stat-card stat-card--warning">
              <span class="stat-card__icon"><i class="bi bi-hourglass-split"></i></span>
              <p class="stat-card__label">در انتظار پرداخت</p>
              <p class="stat-card__value">${formatCurrency(pendingAmount, 'IRR')}</p>
              <p class="stat-card__meta text-muted">مهلت تسویه تا انتهای ماه جاری</p>
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
        monthTicks.push({ left: pos(cursor.getTime()), label: formatDate(cursor.toISOString(), { format: 'medium' }).split(' ').slice(1).join(' ') || formatDate(cursor.toISOString(), { format: 'short' }) });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      const today = pos(Date.now());
      const toneOf = (p) => (p.status === 'completed' ? 'success' : p.health === 'critical' ? 'danger' : p.health === 'at-risk' ? 'warning' : p.status === 'on-hold' ? 'neutral' : 'primary');
      const stat = (st) => items.filter((p) => p.status === st).length;
      render(
        node,
        `<div class="ais">
          <div class="ais-kpis">
            <article class="ais-kpi ais-kpi--primary"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-kanban"></i></span><span class="ais-kpi__label">پروژه‌های فعال</span></div><p class="ais-kpi__value">${toDigits(stat('active'))}</p><div class="ais-kpi__meta">از ${toDigits(items.length)} پروژه</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--success"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-check2-circle"></i></span><span class="ais-kpi__label">تکمیل‌شده</span></div><p class="ais-kpi__value">${toDigits(stat('completed'))}</p><div class="ais-kpi__meta">تحویل به مشتری</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--warning"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-exclamation-triangle"></i></span><span class="ais-kpi__label">در معرض ریسک</span></div><p class="ais-kpi__value">${toDigits(items.filter((p) => p.health !== 'good').length)}</p><div class="ais-kpi__meta">نیازمند توجه</div><div style="height:10px"></div></article>
            <article class="ais-kpi ais-kpi--info"><div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-speedometer2"></i></span><span class="ais-kpi__label">میانگین پیشرفت</span></div><p class="ais-kpi__value">${toDigits(Math.round(items.reduce((s, p) => s + p.progress, 0) / items.length))}٪</p><div class="ais-kpi__meta">همه پروژه‌ها</div><div style="height:10px"></div></article>
          </div>
          <section class="card">
            <header class="card__head"><span class="card__icon"><i class="bi bi-calendar-range"></i></span><div><h2 class="card__title">نمای گانت پروژه‌ها</h2><p class="card__subtitle">مدت هر پروژه، پیشرفت و خط امروز</p></div>
              <div class="card__actions pj-legend"><span><i class="ais-dot ais-dot--primary"></i> در جریان</span><span><i class="ais-dot ais-dot--success"></i> تکمیل</span><span><i class="ais-dot ais-dot--warning"></i> ریسک</span><span><i class="ais-dot ais-dot--danger"></i> بحرانی</span></div></header>
            <div class="card__body"><div class="pj-gantt">
              <div class="pj-gantt__head"><div class="pj-gantt__label">پروژه</div><div class="pj-gantt__scale">${monthTicks.map((m, i) => (monthTicks.length > 8 && i % 2 ? '' : `<span style="inset-inline-start:${m.left}%">${escapeHtml(m.label)}</span>`)).join('')}</div></div>
              ${items
                .map((p) => {
                  const l = pos(new Date(p.startDate).getTime());
                  const w = Math.max(3, pos(new Date(p.dueDate).getTime()) - l);
                  return `<div class="pj-gantt__row">
                    <a class="pj-gantt__label" href="projects/details.html?id=${escapeHtml(p.id)}"><img src="${escapeHtml(p.ownerAvatar)}" alt=""><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.owner)}</small></span></a>
                    <div class="pj-gantt__track">
                      ${monthTicks.map((m) => `<i class="pj-gantt__grid" style="inset-inline-start:${m.left}%"></i>`).join('')}
                      <div class="pj-gantt__bar ais-tone--${toneOf(p)}" style="inset-inline-start:${l}%;width:${w}%" title="${escapeHtml(p.name)}"><span class="pj-gantt__fill" style="width:${p.progress}%"></span><b>${toDigits(p.progress)}٪</b></div>
                    </div>
                  </div>`;
                })
                .join('')}
              <div class="pj-gantt__today" style="--today:${today.toFixed(2)}"><span>امروز</span></div>
            </div></div>
          </section>
          <div class="ais-grid">
            ${card({ title: 'پیشرفت پروژه‌ها', icon: 'bar-chart', body: '<div class="chart" data-chart-owner="controller" data-tl="progress" style="min-height:340px"></div>' }).replace('<section class="card', '<section data-col="8" class="card')}
            ${card({ title: 'وضعیت سلامت', icon: 'heart-pulse', body: '<div class="chart" data-chart-owner="controller" data-tl="health" style="min-height:340px"></div>' }).replace('<section class="card', '<section data-col="4" class="card')}
          </div>
        </div>`,
      );
      await Promise.all([
        chart($('[data-tl="progress"]', node), { type: 'bar', height: 340, labels: items.map((p) => p.name.split(' — ')[0]), series: [{ name: 'پیشرفت ٪', data: items.map((p) => p.progress) }, { name: 'زمان سپری‌شده ٪', data: items.map((p) => { const a = new Date(p.startDate).getTime(); const b = new Date(p.dueDate).getTime(); return Math.max(0, Math.min(100, Math.round(((Date.now() - a) / Math.max(1, b - a)) * 100))); }) }], colors: ['#6366f1', '#cbd5e1'] }),
        chart($('[data-tl="health"]', node), { type: 'donut', height: 340, labels: ['سالم', 'در معرض ریسک', 'بحرانی'], series: ['good', 'at-risk', 'critical'].map((h) => items.filter((p) => p.health === h).length), colors: ['#10b981', '#f59e0b', '#ef4444'] }),
      ]);
      return;
    }

    case 'projects/tasks.html':
    case 'projects/backlog.html': {
      const node = host();
      const isBacklog = page.endsWith('backlog.html');
      const data = isBacklog ? await services.backlogService.list() : await services.taskService.list({ perPage: 12 });
      const items = data.items ?? data;
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: isBacklog ? 'بک‌لاگ محصول' : 'فهرست تسک‌ها', subtitle: isBacklog ? 'موارد اولویت‌دار برای اسپرینت بعدی' : 'همه تسک‌ها با فیلتر وضعیت و اولویت', icon: 'list-task', actions: toolButtons({ create: 'تسک جدید', exportResource: 'tasks' }) })}
          ${card({
            flush: true,
            body: `<ul class="list-group" data-task-list>${items
              .map(
                (task) => `<li class="list-item list-item--interactive" data-task="${escapeHtml(task.id)}">
                  <span class="status-dot status-dot--${task.status === 'done' ? 'success' : task.status === 'in-progress' ? 'primary' : 'muted'}"></span>
                  <span class="list-item__title">${escapeHtml(task.title)}<span class="list-item__sub">${escapeHtml(task.project ?? '')} • موعد: ${formatDate(task.dueDate, { format: 'short' })}</span></span>
                  <span class="badge badge--soft-${task.priority === 'critical' || task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'neutral'}">${escapeHtml(task.priorityLabel ?? task.priority ?? '')}</span>
                  <span class="list-item__meta"><img class="avatar avatar--xs" src="${escapeHtml(task.assigneeAvatar ?? 'assets/img/avatars/avatar-01.svg')}" alt="">${toDigits(task.progress ?? 0)}٪</span>
                </li>`,
              )
              .join('')}</ul>`,
          })}
        </div>`,
      );
      on($('[data-create]', node), 'click', () => openRecordForm({ resource: 'tasks', title: 'افزودن تسک', fields: crudFields('tasks'), onSaved: () => window.location.reload() }));
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
      const [agents, sla] = await Promise.all([services.agentService.workload(), services.supportStatsService.sla()]);
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'کارشناسان پشتیبانی', subtitle: 'توزیع بار کاری و کیفیت پاسخ‌دهی', icon: 'headset', badges: [statusBadge(`رعایت SLA: ${toDigits(sla.compliance ?? 0)}٪`, 'success')] })}
          <div class="grid grid--cards">${agents
            .map(
              (agent) => `<article class="card">
                <div class="card__body d-flex flex-column gap-3">
                  <div class="d-flex align-items-center gap-3"><img class="avatar avatar--lg" src="${escapeHtml(agent.avatar)}" alt=""><div><h3 class="card__title">${escapeHtml(agent.name)}</h3><p class="card__subtitle">${escapeHtml(agent.role ?? 'کارشناس پشتیبانی')}</p></div>
                  <span class="status-dot status-dot--${agent.status === 'online' ? 'online' : agent.status === 'busy' ? 'busy' : 'offline'} ms-auto"></span></div>
                  ${infoRows([
                    ['تیکت باز', toDigits(agent.open ?? 0)],
                    ['حل‌شده امروز', toDigits(agent.resolvedToday ?? 0)],
                    ['میانگین پاسخ', `${toDigits(agent.firstResponseMinutes ?? 0)} دقیقه`],
                    ['رضایت', `${toDigits(agent.csat ?? 0)}٪`],
                  ])}
                </div>
              </article>`,
            )
            .join('')}</div>
        </div>`,
      );
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
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'حضور و غیاب', subtitle: 'وضعیت امروز و روند ماهانه', icon: 'clock-history', actions: '<button class="btn btn-light" type="button" data-check-in><i class="bi bi-box-arrow-in-right"></i> ثبت ورود</button><button class="btn btn-primary" type="button" data-check-out><i class="bi bi-box-arrow-right"></i> ثبت خروج</button>' })}
          ${statsFrom({ present: today.present, remote: today.remote, onLeave: today.onLeave, late: today.late }, [
            ['present', 'حاضر', 'number', 'success', 'person-check'],
            ['remote', 'دورکاری', 'number', 'info', 'house'],
            ['onLeave', 'مرخصی', 'number', 'warning', 'calendar-x'],
            ['late', 'تأخیر', 'number', 'danger', 'alarm'],
          ])}
          ${card({ title: 'روند حضور ماهانه', body: `<div class="chart" data-chart="column" data-chart-height="320" data-chart-series='${JSON.stringify([{ name: 'حاضر', data: monthly.present ?? monthly.map?.((m) => m.present) ?? [] }])}' data-chart-labels='${JSON.stringify(monthly.labels ?? [])}'></div>` })}
          ${card({ title: 'فهرست امروز', flush: true, body: `<table class="table table--hover"><thead><tr><th>کارمند</th><th>ورود</th><th>خروج</th><th>ساعت کارکرد</th><th>وضعیت</th></tr></thead><tbody>${(asRows(today))
            .map(
              (row) => `<tr><td><div class="table__primary"><img class="avatar avatar--sm" src="${escapeHtml(row.avatar ?? 'assets/img/avatars/avatar-01.svg')}" alt=""><span class="table__primary-title">${escapeHtml(row.name)}</span></div></td>
              <td class="numeric">${escapeHtml(row.checkIn ?? '—')}</td><td class="numeric">${escapeHtml(row.checkOut ?? '—')}</td><td class="numeric">${toDigits(row.hours ?? 0)} ساعت</td>
              <td>${statusBadge(row.statusLabel ?? row.status ?? 'حاضر', row.status === 'late' ? 'warning' : row.status === 'absent' ? 'danger' : 'success')}</td></tr>`,
            )
            .join('')}</tbody></table>` })}
        </div>`,
      );
      initCharts(node);
      on($('[data-check-in]', node), 'click', async () => {
        const result = await services.attendanceService.checkIn();
        toast.success('ورود ثبت شد', `ساعت ${result.time ?? 'اکنون'} ثبت گردید.`);
      });
      on($('[data-check-out]', node), 'click', async () => {
        const result = await services.attendanceService.checkOut();
        toast.success('خروج ثبت شد', `مجموع کارکرد امروز: ${toDigits(result.hours ?? 0)} ساعت`);
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

          <!-- Executive Employee Hero Card -->
          <div class="card mb-4 overflow-hidden border-0 shadow-sm" style="background: linear-gradient(135deg, var(--nv-surface) 0%, var(--nv-surface-2) 100%);">
            <div style="height: 90px; background: linear-gradient(90deg, rgba(var(--nv-primary-rgb), 0.75), #06b6d4, #6366f1); position: relative;">
              <span class="badge bg-dark bg-opacity-50 text-white position-absolute top-0 end-0 m-3 px-3 py-1 rounded-pill" style="font-size:11px;">
                <i class="bi bi-building me-1"></i>دفتر مرکزی نووا
              </span>
            </div>
            <div class="card__body p-4 pt-0">
              <div class="d-flex flex-wrap align-items-end justify-content-between gap-3" style="margin-top: -45px;">
                <div class="d-flex align-items-end gap-3 flex-wrap">
                  <div class="position-relative">
                    <img src="${escapeHtml(employee.avatar)}" alt="${escapeHtml(employee.name)}" class="rounded-circle border border-4 border-white shadow" style="width: 90px; height: 90px; object-fit: cover; background: var(--nv-surface);">
                    <span class="position-absolute bottom-0 end-0 p-2 bg-success border border-2 border-white rounded-circle" title="حاضر در محل کار"></span>
                  </div>
                  <div class="pb-1">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      <h2 class="h4 fw-bold m-0 text-heading">${escapeHtml(employee.name)}</h2>
                      <span class="badge badge--soft-primary font-monospace">${escapeHtml(employee.code || 'EMP-1024')}</span>
                      <span class="badge badge--soft-${employee.status === 'active' ? 'success' : 'warning'}">${employee.status === 'active' ? 'مشغول به کار' : 'در مرخصی'}</span>
                    </div>
                    <p class="text-muted m-0 mt-1 small">
                      <i class="bi bi-briefcase me-1"></i>${escapeHtml(employee.position ?? 'متخصص توسعه نرم‌افزار')} • 
                      <i class="bi bi-diagram-3 me-1"></i>${escapeHtml(employee.department ?? 'فناوری اطلاعات')} • 
                      <i class="bi bi-geo-alt me-1"></i>${escapeHtml(employee.city ?? 'تهران')}
                    </p>
                  </div>
                </div>
                <div class="d-flex gap-2 pb-1">
                  <button class="btn btn-sm btn-outline-primary" type="button" data-award-btn><i class="bi bi-award me-1"></i>ثبت تشویقی / ارتقا</button>
                  <button class="btn btn-sm btn-light" type="button" data-export-profile><i class="bi bi-printer me-1"></i>حکم کارگزینی</button>
                </div>
              </div>
            </div>
          </div>

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
                          <tr><th style="color: var(--nv-text-muted);">شماره تماس همراه:</th><td class="numeric">${escapeHtml(employee.phone ?? '۰۹۱۲۳۴۵۶۷۸۹')}</td></tr>
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

          <div class="grid" style="grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr); gap: 24px; align-items: start;">
            <div class="card logi-map-card overflow-hidden">
              <div class="card__head" style="padding:16px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="tile tile--soft tile--icon tile--soft-primary" style="width:40px;height:40px;"><i class="bi bi-broadcast-pin" style="color:var(--nv-primary);font-size:1.25rem;"></i></span>
                  <div>
                    <h3 class="card__title" style="margin:0; font-size:15px; font-weight:800;">نقشه ماهواره‌ای و زنده ناوبری ایران</h3>
                    <p style="margin:0; font-size:11px; color:var(--nv-text-muted);">پایش بلادرنگ هاب‌های ترانزیتی و خودروها • نقشه تعاملی با کنترل کامل</p>
                  </div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-primary btn-sm" data-filter="all">همه (${toDigits(vehicles.length)})</button>
                  <button class="btn btn-light btn-sm" data-filter="active">در حرکت (${toDigits(vehicles.filter((v) => v.status === 'active').length)})</button>
                  <button class="btn btn-light btn-sm" data-filter="delayed">دارای هشدار (${toDigits(vehicles.filter((v) => v.status === 'delayed').length)})</button>
                  <button class="btn btn-outline-secondary btn-sm" data-fit-iran title="دید کامل نقشه ایران"><i class="bi bi-aspect-ratio me-1"></i>کل کشور</button>
                </div>
              </div>

              <div class="card__body p-0 position-relative">
                <div id="logistics-leaflet-map" style="height: 560px; width: 100%; position: relative; z-index: 1;"></div>
                
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
                  <span class="tile tile--soft tile--icon tile--soft-${item.tone}" style="width:36px; height:36px; border-radius:10px; display:grid; place-items:center;">
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
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

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
            attributionControl: false,
          });

          // Add modern Map Tiles
          const tileUrl = isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

          L.tileLayer(tileUrl, { maxZoom: 18, subdomains: 'abcd' }).addTo(map);

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
                    <p style="margin:0; font-size:12px; color:var(--nv-text-muted);">${v.phone} • گواهینامه پایه یک ترانزیت بین‌المللی</p>
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
              <a class="btn btn-outline-primary btn-sm" href="tel:${v.phone}"><i class="bi bi-telephone me-1"></i> تماس با راننده</a>
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
      const { items, summary } = await services.shipmentService.list({ perPage: 12 });
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'محموله‌ها', subtitle: 'مدیریت چرخه ارسال از انبار تا تحویل', icon: 'truck', actions: toolButtons({ create: 'محموله جدید', exportResource: 'shipments' }) })}
          ${statsFrom(summary ?? { active: items.length, delayed: items.filter((i) => i.status === 'delayed').length }, [
            ['active', 'محموله فعال', 'number', 'primary', 'truck'],
            ['delayed', 'تأخیری', 'number', 'danger', 'alarm'],
            ['delivered', 'تحویل‌شده', 'number', 'success', 'check2-circle'],
            ['onTime', 'به‌موقع', 'percent', 'info', 'stopwatch'],
          ])}
          ${card({ flush: true, body: `<table class="table table--hover"><thead><tr><th>کد رهگیری</th><th>مقصد</th><th>وضعیت</th><th>پیشرفت</th><th>زمان تخمینی</th><th></th></tr></thead><tbody>${items
            .map(
              (shipment) => `<tr><td class="numeric">${escapeHtml(shipment.tracking)}</td><td>${escapeHtml(shipment.destination ?? '')}</td>
                <td>${statusBadge(shipment.statusLabel ?? shipment.status, shipment.status === 'delivered' ? 'success' : shipment.status === 'delayed' ? 'danger' : 'info')}</td>
                <td><div class="progress progress--sm"><div class="progress-bar" style="width:${Math.min(100, shipment.progress ?? 40)}%"></div></div></td>
                <td>${formatDate(shipment.eta, { format: 'short' })}</td>
                <td><button class="btn btn-light btn-sm" type="button" data-advance-shipment="${escapeHtml(shipment.id)}">مرحله بعد</button></td></tr>`,
            )
            .join('')}</tbody></table>` })}
        </div>`,
      );
      on(node, 'click', async (event) => {
        const button = event.target.closest('[data-advance-shipment]');
        if (!button) return;
        const result = await services.shipmentActions.advance(button.dataset.advanceShipment);
        toast.success('وضعیت محموله تغییر کرد', `وضعیت جدید: ${result.statusLabel ?? result.status ?? 'به‌روزرسانی شد'}`);
        button.closest('tr').querySelector('td:nth-child(3)').innerHTML = statusBadge(result.statusLabel ?? result.status ?? '', 'info');
      });
      on($('[data-create]', node), 'click', () => openRecordForm({ resource: 'shipments', title: 'محموله جدید', fields: crudFields('shipments'), onSaved: () => window.location.reload() }));
      exportable(node, 'shipments');
      return;
    }

    default:
      return;
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
                    <span class="tile tile--soft tile--icon tile--soft-${r.tone}" style="width:42px; height:42px; border-radius:12px; display:grid; place-items:center; flex-shrink:0;">
                      <i class="bi bi-${r.icon}" style="font-size:1.25rem;"></i>
                    </span>
                    <div>
                      <h3 class="card__title" style="margin:0 0 2px; font-size:14px; font-weight:800;">${r.label.split('(')[0].trim()}</h3>
                      <span style="font-size:11px; color:var(--nv-text-muted); font-family:var(--nv-font-mono);">${r.id}</span>
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
      const matrix = await services.roleService.matrix();
      const modules = matrix.modules.map((module) => (typeof module === 'string' ? { id: module, label: module } : module));
      const permissions = matrix.permissions.map((permission) => (typeof permission === 'string' ? { id: permission, label: PERMISSION_LABELS[permission] ?? permission } : permission));
      const holders = (permissionId) =>
        matrix.roles
          .map((role) => ({ role, modules: Object.entries(role.grants ?? {}).filter(([, list]) => list.includes(permissionId)).map(([id]) => id) }))
          .filter((entry) => entry.modules.length);

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'مدیریت مجوزها و دسترسی‌های خرد',
            subtitle: 'کنترل دقیق قابلیت‌های خواندن، ایجاد، ویرایش، حذف و خروجی داده‌ها به تفکیک ماژول‌ها',
            icon: 'key-fill',
            actions: '<button class="btn btn-primary" type="button" data-custom-perm><i class="bi bi-plus-lg"></i> تعریف مجوز سفارشی</button>',
          })}
          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'کل مجوزهای تعریف‌شده', value: toDigits(permissions.length), hint: 'انواع عملیات مجاز', tone: 'primary', icon: 'key' })}
            ${statCard({ label: 'نقش‌های دریافت‌کننده', value: toDigits(matrix.roles.length), hint: 'نقش‌های دارای مجوز', tone: 'info', icon: 'shield-lock' })}
            ${statCard({ label: 'ماژول‌های دارای دسترسی', value: toDigits(modules.length), hint: 'پوشش کامل بخش‌ها', tone: 'success', icon: 'grid-3x3-gap' })}
            ${statCard({ label: 'مجوزهای پرکاربرد', value: 'view, create', hint: 'اعطا شده به اغلب نقش‌ها', tone: 'warning', icon: 'award' })}
          </div>
          ${card({
            title: 'پوشش مجوزها در ماژول‌های سامانه',
            subtitle: 'عدد هر خانه = تعداد ماژول‌هایی که این نقش با این مجوز مشاهده یا ویرایش می‌کند',
            flush: true,
            body: `<div class="table-responsive"><table class="table table--hover table--bordered">
              <thead><tr><th>نقش کاربری</th>${permissions
                .map((permission) => `<th class="text-center">${escapeHtml(permission.label)}</th>`)
                .join('')}<th class="text-center">مجموع گرنت‌ها</th></tr></thead>
              <tbody>${matrix.roles
                .map((role) => {
                  const cells = permissions.map((permission) =>
                    Object.entries(role.grants ?? {}).filter(([, list]) => list.includes(permission.id)).length,
                  );
                  const total = cells.reduce((sum, value) => sum + value, 0);
                  return `<tr><th scope="row">${escapeHtml(role.label ?? role.id)}<span class="table__primary-sub">${toDigits(role.users ?? 0)} کاربر</span></th>${cells
                    .map(
                      (value) =>
                        `<td class="text-center">${value ? `<span class="badge badge--soft-success rounded-pill">${toDigits(value)}</span>` : '<span class="text-muted">—</span>'}</td>`,
                    )
                    .join('')}<td class="text-center"><strong class="numeric text-primary">${toDigits(total)}</strong></td></tr>`;
                })
                .join('')}</tbody></table></div>`,
          })}

          <div class="grid grid--cards mt-4">${permissions
            .map((permission) => {
              const owners = holders(permission.id);
              const share = matrix.roles.length ? Math.round((owners.length / matrix.roles.length) * 100) : 0;
              return `<article class="card" data-permission="${escapeHtml(permission.id)}">
                <div class="card__head" style="padding:16px 20px; border-bottom:1px solid var(--nv-border); display:flex; justify-content:space-between; align-items:center;">
                  <div><h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">${escapeHtml(permission.label)}</h3><p class="card__subtitle" style="margin:0; font-size:11px;">${toDigits(owners.reduce((sum, entry) => sum + entry.modules.length, 0))} گرنت روی ${toDigits(new Set(owners.flatMap((entry) => entry.modules)).size)} ماژول</p></div>
                  <span class="badge badge--soft-${share > 60 ? 'success' : share > 20 ? 'warning' : 'danger'} rounded-pill">${toDigits(share)}٪ نقش‌ها</span>
                </div>
                <div class="card__body" style="padding:18px 20px;">
                  <div class="progress progress--sm"><div class="progress-bar ${share > 60 ? 'bg-success' : 'bg-primary'}" style="width:${share}%"></div></div>
                  <p class="card__subtitle mt-3" style="font-size:12px; color:var(--nv-text-muted);">${escapeHtml(permission.description ?? PERMISSION_NOTES[permission.id] ?? '')}</p>
                  ${owners.length
                    ? `<ul class="list-group list-group--flush mt-2">${owners
                        .map(
                          (entry) => `<li class="list-group__item" style="padding:8px 12px; display:flex; justify-content:space-between;"><span class="list-item__title" style="font-size:12px; font-weight:700;">${escapeHtml(entry.role.label ?? entry.role.id)}</span><span class="list-item__meta numeric" style="font-size:11px;">${toDigits(entry.modules.length)} ماژول</span></li>`,
                        )
                        .join('')}</ul>`
                    : emptyState({ title: 'هیچ نقشی این مجوز را ندارد', text: 'برای ایمن‌سازی، این مجوز را به نقش مدیر بدهید.', icon: 'shield-exclamation' })}
                </div>
              </article>`;
            })
            .join('')}</div>
        </div>`,
      );

      on(node, 'click', (e) => {
        if (e.target.closest('[data-custom-perm]')) {
          toast.info('تعریف مجوز', 'فرم ایجاد مجوز سفارشی باز شد.');
        }
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
      { name: 'country', label: 'کشور', type: 'select', options: ['ایران', 'آلمان', 'چین', 'ژاپن'] },
      { name: 'website', label: 'وبسایت', rule: 'url', placeholder: 'https://example.com' },
    ],
    tags: [
      { name: 'name', label: 'برچسب', required: true },
      { name: 'color', label: 'رنگ', type: 'select', options: ['primary', 'success', 'warning', 'danger', 'info'] },
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
