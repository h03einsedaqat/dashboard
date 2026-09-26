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
import { goTo } from '../core/links.js';
import { withState } from '../core/load.js';
import * as kit from './kit.js';

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

    case 'ecommerce/categories.html':
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
    { name: 'sku', label: 'کد کالا', required: true },
    { name: 'brand', label: 'برند', type: 'select', options: ['نووا', 'آرکا', 'داده‌پرداز', 'ویرا'], required: true },
    { name: 'category', label: 'دسته‌بندی', type: 'select', options: ['لپ‌تاپ', 'موبایل', 'هدفون', 'ساعت هوشمند', 'لوازم جانبی'], required: true },
    { name: 'price', label: 'قیمت پایه (ریال)', type: 'number', inputMode: 'numeric', required: true, rule: 'number' },
    { name: 'discount', label: 'تخفیف (٪)', type: 'number', inputMode: 'numeric' },
    { name: 'stock', label: 'موجودی', type: 'number', inputMode: 'numeric', required: true, rule: 'number' },
    { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'published', label: 'منتشرشده' }, { value: 'draft', label: 'پیش‌نویس' }, { value: 'archived', label: 'بایگانی' }] },
    { name: 'tags', label: 'برچسب‌ها', type: 'tags', hint: 'با کاما جدا کنید' },
    { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 5 },
  ];
  const values = id ? await loadRecord('products', id) : {};
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: id ? 'ویرایش محصول' : 'افزودن محصول جدید', subtitle: 'اطلاعات پایه، قیمت‌گذاری و وضعیت انتشار', icon: 'box-seam', actions: '<a class="btn btn-light" href="ecommerce/products.html"><i class="bi bi-arrow-right"></i> بازگشت به فهرست</a>' })}
      ${card({ body: `<form data-product-form novalidate>${formMarkup(fields, values)}<div class="form-actions form-actions--end"><button type="reset" class="btn btn-light">بازنشانی</button><button type="submit" class="btn btn-primary" data-submit>${id ? 'ذخیره تغییرات' : 'ثبت محصول'}</button></div></form>` })}
    </div>`,
  );
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
      if (id) await services.productService.update(id, payload);
      else await services.productService.create(payload);
      toast.success('ذخیره شد', 'فهرست محصولات به‌روزرسانی شد.');
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
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: employee.name, subtitle: `${employee.position ?? ''} • ${employee.department ?? ''}`, icon: 'person-vcard' })}
          <div class="grid grid--sidebar">
            ${card({
              body: `<div class="profile-head"><img class="profile-head__avatar" src="${escapeHtml(employee.avatar)}" alt="">
                <div class="profile-head__meta"><h2 class="profile-head__name">${escapeHtml(employee.name)}</h2><p class="profile-head__role">${escapeHtml(employee.position ?? '')}</p>
                <div class="badge-dot-list">${statusBadge(employee.statusLabel ?? employee.status ?? 'فعال', 'success')}${statusBadge(employee.type ?? 'تمام‌وقت', 'info')}</div></div>
                <div class="ms-auto d-flex gap-2"><button class="btn btn-light" type="button" data-message><i class="bi bi-envelope"></i> پیام</button><a class="btn btn-primary" href="hr/employees.html">فهرست کارکنان</a></div></div>
              ${infoRows([
                ['کد پرسنلی', employee.code ?? employee.id],
                ['دپارتمان', employee.department ?? '—'],
                ['مدیر مستقیم', employee.manager ?? '—'],
                ['ایمیل', employee.email ?? '—'],
                ['تلفن', employee.phone ?? '—'],
                ['تاریخ استخدام', formatDate(employee.hiredAt, { format: 'long' })],
                ['محل کار', employee.location ?? 'تهران'],
                ['عملکرد', `${toDigits(employee.performance ?? 0)} از ۵`],
              ])}`,
            })}
            <div class="stack">
              ${card({ title: 'خلاصه عملکرد', body: `<div class="chart" data-chart="radialBar" data-chart-height="240" data-chart-series='${JSON.stringify([Math.round(((employee.performance ?? 4) / 5) * 100)])}' data-chart-labels='["امتیاز عملکرد"]'></div>` })}
              ${card({ title: 'سابقه فعالیت', body: timeline([
                { title: 'ارتقای شغلی', text: 'از کارشناس به کارشناس ارشد', time: '۴ ماه پیش', tone: 'success', icon: 'arrow-up-circle' },
                { title: 'دوره آموزشی', text: 'مدیریت پروژه چابک', time: '۶ ماه پیش', tone: 'info', icon: 'mortarboard' },
                { title: 'پیوستن به تیم', text: employee.department ?? '', time: formatDate(employee.hiredAt, { format: 'medium' }), tone: 'primary', icon: 'person-plus' },
              ], { compact: true }) })}
            </div>
          </div>
        </div>`,
      );
      initCharts(node);
      on($('[data-message]', node), 'click', () =>
        modal.prompt({ title: 'ارسال پیام', label: 'متن پیام', placeholder: 'پیام شما…' }).then((value) => {
          if (value) toast.success('پیام ارسال شد', 'پیام در صندوق ارسالی ثبت شد.');
        }),
      );
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
        services.trackingService.performance().catch(() => ({ onTime: 94.6, delayed: 3, inTransit: 18, delivered: 86 })),
        services.shipmentService.list({ perPage: 10 }).catch(() => ({ items: [] })),
        (services.logisticsService?.routes?.() ?? kit.services?.routeService?.list?.({ perPage: 20 }) ?? Promise.resolve({ items: [] })).catch(() => ({ items: [] })),
        (services.logisticsService?.drivers?.() ?? kit.services?.driverService?.list?.({ perPage: 10 }) ?? Promise.resolve({ items: [] })).catch(() => ({ items: [] })),
      ]);
      const markers = mapData.markers ?? mapData ?? [];
      const shipItems = shipments.items ?? shipments ?? [];
      const routes = routesData.items ?? routesData ?? [];
      const drivers = driversData.items ?? driversData ?? [];

      // Iran map city positions (percentage based for responsive)
      const cityPos = {
        'تهران': { x: 44, y: 28, tone: 'primary' },
        'اصفهان': { x: 47, y: 48, tone: 'info' },
        'مشهد': { x: 78, y: 30, tone: 'success' },
        'شیراز': { x: 52, y: 70, tone: 'warning' },
        'تبریز': { x: 22, y: 18, tone: 'primary' },
        'بندرعباس': { x: 62, y: 88, tone: 'danger' },
        'کرج': { x: 42, y: 26, tone: 'primary' },
        'اهواز': { x: 28, y: 62, tone: 'info' },
      };

      const getPos = (label) => {
        if (cityPos[label]) return cityPos[label];
        // fallback from markers if lat/lng available
        const m = markers.find(mm => (mm.label||'').includes(label));
        if (m && m.lat && m.lng) {
          // rough Iran lat 25-40, lng 44-62 => map to 0-100
          const y = ((40 - m.lat) / 15) * 80 + 10;
          const x = ((m.lng - 44) / 18) * 80 + 10;
          return { x, y, tone: m.tone || 'primary' };
        }
        return { x: 50, y: 50, tone: 'primary' };
      };

      const routeDefs = [
        { id: 'r1', from: 'تهران', to: 'اصفهان', status: 'active', trucks: 2 },
        { id: 'r2', from: 'تهران', to: 'مشهد', status: 'active', trucks: 1 },
        { id: 'r3', from: 'تهران', to: 'تبریز', status: 'active', trucks: 1 },
        { id: 'r4', from: 'اصفهان', to: 'شیراز', status: 'active', trucks: 2 },
        { id: 'r5', from: 'مشهد', to: 'بندرعباس', status: 'delayed', trucks: 1 },
        { id: 'r6', from: 'تهران', to: 'اهواز', status: 'active', trucks: 1 },
      ];

      const routeSvg = routeDefs.map(r => {
        const a = getPos(r.from);
        const b = getPos(r.to);
        const mx = (a.x + b.x)/2;
        const my = (a.y + b.y)/2 - 6;
        return `<path class="logi-map__route ${r.status==='delayed'?'logi-map__route--delayed': r.status==='active'?'logi-map__route--active':''}" d="M ${a.x*10} ${a.y*5.2} Q ${mx*10} ${my*5.2} ${b.x*10} ${b.y*5.2}" />`;
      }).join('');

      const markersHtml = Object.entries(cityPos).slice(0,6).map(([name, p]) => {
        return `<div class="logi-marker" style="left:${p.x}%; top:${p.y}%;" data-city="${escapeHtml(name)}">
          <div class="logi-marker__pin logi-marker__pin--${p.tone}"><i class="bi bi-geo-alt-fill"></i></div>
          <div class="logi-marker__label">${escapeHtml(name)} <small>${markers.find(mm=>mm.label===name)?.value ?? (Math.floor(Math.random()*60+20))}</small></div>
        </div>`;
      }).join('');

      const trucksHtml = routeDefs.flatMap((r, ri) => {
        const a = getPos(r.from);
        const b = getPos(r.to);
        return Array.from({length: r.trucks}).map((_, ti) => {
          const offset = (ti*18 + 12 + ri*7) % 78 + 10;
          const x = a.x + (b.x - a.x) * (offset/100);
          const y = a.y + (b.y - a.y) * (offset/100);
          const tone = r.status==='delayed' ? 'delayed' : (offset>85 ? 'delivered' : '');
          return `<div class="logi-map__truck ${tone ? 'logi-map__truck--'+tone : ''}" data-route="${r.id}" data-progress="${offset}" style="left:${x}%; top:${y}%;"><i class="bi bi-truck"></i></div>`;
        });
      }).join('');

      const perf = performance || { onTime: 94.6, delayed: 3, inTransit: 18, delivered: 86 };

      render(
        node,
        `<div class="logi-pro">
          ${pageHeader({ title: 'ردیابی زنده محموله‌ها', subtitle: 'نقشه تعاملی ایران • موقعیت لحظه‌ای ناوگان و عملکرد تحویل', icon: 'geo-alt', actions: toolButtons({ exportResource: 'shipments' }) })}
          <div class="kpi-row grid grid--4">
            ${statCard({ label: 'تحویل به‌موقع', value: formatPercent(perf.onTime ?? 94.6, {decimals:1}), hint: 'نسبت به دیروز ۲.۴٪ رشد', tone: 'success', icon: 'clock-history', trend: '+2.4%' })}
            ${statCard({ label: 'تأخیری', value: toDigits(perf.delayed ?? 3), hint: 'نیاز به پیگیری', tone: 'warning', icon: 'alarm', trend: '-1' })}
            ${statCard({ label: 'در مسیر', value: toDigits(perf.inTransit ?? 18), hint: 'فعال در جاده', tone: 'info', icon: 'truck', trend: '+3' })}
            ${statCard({ label: 'تحویل امروز', value: toDigits(perf.delivered ?? 86), hint: 'از ۱۲۴ مرسوله', tone: 'primary', icon: 'box-seam', trend: '+12%' })}
          </div>

          <div class="grid" style="grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.9fr); gap: 24px; align-items: start;">
            <div class="card logi-map-card">
              <div class="card__head" style="padding:16px 20px; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="tile tile--soft tile--icon tile--soft-primary"><i class="bi bi-map"></i></span>
                  <div><h3 class="card__title" style="margin:0; font-size:14px;">نقشه زنده ناوگان — ایران</h3><p style="margin:0; font-size:11px; color:var(--nv-text-muted);">به‌روزرسانی هر ۱۵ ثانیه • ${toDigits(markers.length || 6)} نقطه فعال</p></div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-light btn-sm" data-map-filter="all">همه</button>
                  <button class="btn btn-soft-primary btn-sm" data-map-filter="active">فعال</button>
                  <button class="btn btn-soft-warning btn-sm" data-map-filter="delayed">تأخیری</button>
                </div>
              </div>
              <div class="card__body" style="padding:0;">
                <div class="logi-map" data-logi-map>
                  <div class="logi-map__grid"></div>
                  <svg class="logi-map__routes" viewBox="0 0 1000 520" preserveAspectRatio="none">${routeSvg}</svg>
                  ${markersHtml}
                  ${trucksHtml}
                  <div class="logi-map__controls">
                    <button class="logi-map__ctrl" data-map-zoom="in"><i class="bi bi-zoom-in"></i></button>
                    <button class="logi-map__ctrl" data-map-zoom="out"><i class="bi bi-zoom-out"></i></button>
                    <button class="logi-map__ctrl" data-map-layers><i class="bi bi-layers"></i></button>
                    <button class="logi-map__ctrl" data-map-locate style="background:var(--nv-primary); color:#fff; border-color:var(--nv-primary);"><i class="bi bi-crosshair"></i></button>
                  </div>
                  <div class="logi-map__legend">
                    <span><i style="background:var(--nv-primary)"></i> در مسیر</span>
                    <span><i style="background:var(--nv-success)"></i> تحویل شده</span>
                    <span><i style="background:var(--nv-warning)"></i> تأخیری</span>
                    <span><i style="background:var(--nv-info)"></i> انبار</span>
                  </div>
                </div>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px;">
              ${card({ title: 'محموله‌های در حال حرکت', actions: `<span class="badge badge--soft-primary">${toDigits(shipItems.length)} فعال</span>`, flush: true, body: `<div style="max-height: 380px; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:8px;">${shipItems.slice(0,6).map((shipment) => {
                const tone = shipment.status === 'delayed' ? 'danger' : shipment.status === 'delivered' ? 'success' : shipment.status === 'in-transit' || shipment.status === 'out-for-delivery' ? 'primary' : 'info';
                const progress = shipment.progress ?? Math.floor(Math.random()*60+20);
                return `<div class="logi-shipment-card" data-shipment="${escapeHtml(shipment.id)}">
                  <div class="logi-shipment-card__icon logi-shipment-card__icon--${tone}"><i class="bi bi-box-seam"></i></div>
                  <div class="logi-shipment-card__body">
                    <div class="logi-shipment-card__title">${escapeHtml(shipment.tracking)} • ${escapeHtml(shipment.destination ?? '')}</div>
                    <div class="logi-shipment-card__sub"><span class="badge badge--soft-${tone}" style="font-size:10px;">${escapeHtml(shipment.statusLabel ?? shipment.status)}</span> ${escapeHtml(shipment.driver ?? '')} • ${relativeTime(shipment.eta ?? shipment.updatedAt)}</div>
                    <div class="progress progress--sm" style="margin-top:8px; height:4px;"><div class="progress-bar" style="width:${progress}%"></div></div>
                  </div>
                  <div class="logi-shipment-card__progress"><span class="numeric" style="font-size:11px; font-weight:800;">${toDigits(progress)}%</span></div>
                </div>`;
              }).join('')}${shipItems.length===0?`<div class="empty-state" style="padding:20px; text-align:center; color:var(--nv-text-muted);">محموله فعالی یافت نشد</div>`:''}</div>` })}

              ${card({ title: 'عملکرد ناوگان', body: `
                <div style="display:flex; flex-direction:column; gap:16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:12px; font-weight:600;">رانندگان فعال</span><span class="badge badge--soft-success">${toDigits(drivers.length || 12)} نفر</span></div>
                  <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;">
                    ${(drivers.slice(0,5).length ? drivers.slice(0,5) : Array.from({length:5}).map((_,i)=>({name: 'راننده '+(i+1), avatar: 'assets/img/avatars/avatar-0'+(i+1)+'.svg', status: 'on-route'}))).map(d => `
                      <div style="flex:0 0 auto; text-align:center;">
                        <img src="${escapeHtml(d.avatar || 'assets/img/avatars/avatar-01.svg')}" style="width:44px; height:44px; border-radius:14px; border:2px solid var(--nv-border);">
                        <div style="font-size:10px; font-weight:700; margin-top:4px; max-width:60px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(d.name||'راننده')}</div>
                        <span class="status-dot status-dot--${d.status==='on-route'?'success':'warning'}" style="margin-top:2px;"></span>
                      </div>
                    `).join('')}
                  </div>
                  <div class="progress-group" style="display:flex; flex-direction:column; gap:10px;">
                    <div><div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;"><span>ظرفیت ناوگان</span><span class="numeric">78%</span></div><div class="progress progress--sm"><div class="progress-bar" style="width:78%"></div></div></div>
                    <div><div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;"><span>میانگین تحویل</span><span class="numeric">2.4 روز</span></div><div class="progress progress--sm"><div class="progress-bar" style="width:92%; background:var(--nv-success)"></div></div></div>
                  </div>
                </div>
              ` })}
            </div>
          </div>

          <div class="grid grid--3">
            ${card({ title: 'مسیرهای پرتردد', flush: true, body: `<table class="table table--hover"><thead><tr><th>مسیر</th><th>مرسوله</th><th>وضعیت</th><th>هزینه</th></tr></thead><tbody>${(routes.length ? routes : [{name:'تهران → اصفهان', shipments:12, status:'active', cost:18400000},{name:'تهران → مشهد', shipments:8, status:'active', cost:32600000},{name:'اصفهان → شیراز', shipments:9, status:'active', cost:19800000}]).slice(0,4).map(r=>`<tr><td style="font-weight:600; font-size:12px;">${escapeHtml(r.name||r.id)}</td><td class="numeric">${toDigits(r.shipments||0)}</td><td>${statusBadge(r.status==='active'?'فعال': r.status==='delayed'?'تأخیری':'برنامه‌ریزی', r.status==='active'?'success': r.status==='delayed'?'warning':'info')}</td><td class="numeric" style="font-size:11px;">${formatCurrency(r.cost||0,'IRR',{compact:true})}</td></tr>`).join('')}</tbody></table>` })}
            ${card({ title: 'هشدارهای زنده', flush: true, body: `<ul class="list-group">${[
              {icon:'alarm', tone:'warning', text:'تأخیر در مسیر مشهد → بندرعباس', time:'۲ دقیقه پیش'},
              {icon:'fuel-pump', tone:'info', text:'نیاز به سوخت‌گیری ناوگان ۰۴', time:'۱۵ دقیقه پیش'},
              {icon:'check-circle', tone:'success', text:'تحویل موفق NVX-482193 به شیراز', time:'۳۲ دقیقه پیش'},
              {icon:'geo', tone:'danger', text:'خروج از مسیر مجاز - راننده ۱۲', time:'۱ ساعت پیش'},
            ].map(a=>`<li class="list-item"><span class="tile tile--soft tile--icon tile--soft-${a.tone}"><i class="bi bi-${a.icon}"></i></span><span class="list-item__title" style="font-size:12px;">${a.text}<span class="list-item__sub">${a.time}</span></span></li>`).join('')}</ul>` })}
            ${card({ title: 'آمار تحویل هفتگی', body: `<div style="height:160px;" data-chart="delivery-weekly">${chartBox({type:'line', height:160})}</div><div style="display:flex; gap:12px; margin-top:12px; font-size:11px; color:var(--nv-text-muted);"><span style="display:flex; align-items:center; gap:4px;"><i style="width:8px; height:8px; border-radius:50%; background:var(--nv-primary); display:inline-block;"></i> تحویل شده</span><span style="display:flex; align-items:center; gap:4px;"><i style="width:8px; height:8px; border-radius:50%; background:var(--nv-warning); display:inline-block;"></i> تأخیری</span></div>` })}
          </div>
        </div>`,
      );

      // animate trucks
      const mapEl = $('[data-logi-map]', node);
      if (mapEl) {
        let raf;
        const animate = () => {
          $$('.logi-map__truck', mapEl).forEach(truck => {
            let prog = parseFloat(truck.dataset.progress || '0');
            prog = (prog + 0.08) % 100;
            truck.dataset.progress = prog;
            const routeId = truck.dataset.route;
            const rd = routeDefs.find(r=>r.id===routeId);
            if (!rd) return;
            const a = getPos(rd.from);
            const b = getPos(rd.to);
            const x = a.x + (b.x - a.x) * (prog/100);
            const y = a.y + (b.y - a.y) * (prog/100);
            truck.style.left = x+'%';
            truck.style.top = y+'%';
          });
          raf = requestAnimationFrame(animate);
        };
        animate();
        on(mapEl, 'mouseenter', () => cancelAnimationFrame(raf));
        on(mapEl, 'mouseleave', () => animate());
      }

      // shipment click -> toast
      on(node, 'click', (e) => {
        const cardEl = e.target.closest('[data-shipment]');
        if (cardEl) {
          const id = cardEl.dataset.shipment;
          const sh = shipItems.find(s=>s.id===id);
          if (sh) modal.alert({ title: sh.tracking + ' — ' + (sh.destination||''), text: 'وضعیت: '+(sh.statusLabel||sh.status)+'\nراننده: '+(sh.driver||'')+'\nپیشرفت: '+(sh.progress||0)+'%', tone: 'primary' });
        }
        const city = e.target.closest('[data-city]');
        if (city) {
          toast.info(city.dataset.city, 'مرسوله‌های این شهر: '+(markers.find(m=>m.label===city.dataset.city)?.value || Math.floor(Math.random()*50+10))+' مورد');
        }
      });

      exportable(node, 'shipments');
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
          ${pageHeader({
            title: user.name,
            subtitle: `${user.email} • ${user.team ?? ''}`,
            icon: 'person-badge',
            badges: [statusBadge(user.statusLabel ?? user.status, user.status === 'active' ? 'success' : 'warning')],
            actions: `<button class="btn btn-light" type="button" data-reset-password><i class="bi bi-key"></i> بازنشانی گذرواژه</button>
              <button class="btn btn-primary" type="button" data-edit-user><i class="bi bi-pencil"></i> ویرایش</button>`,
          })}
          <div class="grid grid--sidebar">
            ${card({
              body: `<div class="profile-head"><img class="profile-head__avatar" src="${escapeHtml(user.avatar)}" alt="">
                <div class="profile-head__meta"><h2 class="profile-head__name">${escapeHtml(user.name)}</h2><p class="profile-head__role">${escapeHtml(user.roleLabel ?? user.role ?? '')}</p>
                  <div class="badge-dot-list">${statusBadge(user.twoFactor ? 'ورود دو مرحله‌ای فعال' : 'ورود دو مرحله‌ای غیرفعال', user.twoFactor ? 'success' : 'warning')}</div></div></div>
              ${infoRows([
                ['شناسه کاربر', user.id],
                ['ایمیل', user.email],
                ['تلفن', user.phone ?? '—'],
                ['تیم', user.team ?? '—'],
                ['آخرین فعالیت', relativeTime(user.lastActive)],
                ['تاریخ عضویت', formatDate(user.joinedAt ?? user.createdAt, { format: 'long' })],
                ['دسترسی', escapeHtml(String(user.permissions ?? 12)) + ' مجوز'],
              ])}`,
            })}
            <div class="stack">
              ${card({ title: 'فعالیت‌های اخیر', body: timeline(activity.slice(0, 6).map((item) => ({ title: item.title, text: item.text, time: relativeTime(item.at), tone: item.tone ?? 'primary', icon: item.icon ?? 'activity' })), { compact: true }) })}
              ${card({ title: 'نشست‌های فعال', flush: true, body: `<ul class="list-group" data-session-list>${kit.skeleton(2)}</ul>` })}
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
            (session) => `<li class="list-item" data-session="${escapeHtml(session.id)}"><span class="tile tile--soft tile--icon"><i class="bi bi-${session.device === 'موبایل' ? 'phone' : 'laptop'}"></i></span><span class="list-item__title">${escapeHtml(session.browser ?? '')}<span class="list-item__sub">${escapeHtml(session.location ?? '')}</span></span><span class="list-item__meta"><button class="btn btn-ghost btn-sm" type="button" data-revoke>پایان نشست</button></span></li>`,
          )
          .join(''),
      );
      on($('[data-session-list]', node), 'click', async (event) => {
        const revoke = event.target.closest('[data-revoke]');
        if (!revoke) return;
        await services.sessionService.revoke(revoke.closest('[data-session]').dataset.session);
        revoke.closest('[data-session]').remove();
        toast.success('نشست پایان یافت', 'دسترسی این دستگاه بسته شد.');
      });
      on($('[data-reset-password]', node), 'click', async () => {
        const ok = await modal.confirm({ title: 'بازنشانی گذرواژه', text: 'پیوند بازنشانی برای کاربر ایمیل می‌شود.', tone: 'warning', confirmText: 'ارسال پیوند' });
        if (ok) toast.success('پیوند ارسال شد', `ایمیل بازنشانی به ${user.email} رفت.`);
      });
      on($('[data-edit-user]', node), 'click', () => openRecordForm({ resource: 'users', id: user.id, title: 'ویرایش کاربر', fields: crudFields('users'), onSaved: () => window.location.reload() }));
      return;
    }

    case 'users/roles.html':
    case 'users/permissions.html': {
      const node = host();
      const matrix = await services.roleService.matrix();
      const modules = matrix.modules.map((module) => (typeof module === 'string' ? { id: module, label: module } : module));
      const editable = ['view', 'create', 'edit'];

      /*
       * Two pages, two honest views of the same contract: `roles.html` answers
       * “what may this role touch per module”, `permissions.html` answers
       * “who holds this capability”. Rendering the same matrix twice would make
       * one of them look like a copy-paste.
       */
      if (page === 'users/permissions.html') {
        const permissions = matrix.permissions.map((permission) => (typeof permission === 'string' ? { id: permission, label: PERMISSION_LABELS[permission] ?? permission } : permission));
        const holders = (permissionId) =>
          matrix.roles
            .map((role) => ({ role, modules: Object.entries(role.grants ?? {}).filter(([, list]) => list.includes(permissionId)).map(([id]) => id) }))
            .filter((entry) => entry.modules.length);
        const paint = () =>
          render(
            node,
            `<div class="dashboard-shell">
          ${pageHeader({
            title: 'مجوزها',
            subtitle: 'هر مجوز روی چه تعداد ماژول و به چه نقش‌هایی داده شده است',
            icon: 'key',
            actions: toolButtons({ create: 'مجوز سفارشی' }),
          })}
          ${statsFrom(
            {
              permissions: permissions.length,
              roles: matrix.roles.length,
              widest: permissions.length
                ? Math.max(...permissions.map((permission) => holders(permission.id).reduce((sum, entry) => sum + entry.modules.length, 0)))
                : 0,
              unprotected: permissions.filter((permission) => !holders(permission.id).length).length,
            },
            [
              ['permissions', 'مجوزها', 'number', 'primary', 'key'],
              ['roles', 'نقش‌ها', 'number', 'info', 'people'],
              ['widest', 'بیشترین کاربرد یک مجوز', 'number', 'success', 'award'],
              ['unprotected', 'بدون دارنده', 'number', 'danger', 'shield-exclamation'],
            ],
          )}
          ${card({
            title: 'پوشش مجوزها',
            subtitle: 'عدد هر خانه = تعداد ماژول‌هایی که این نقش با این مجوز می‌بیند',
            flush: true,
            body: `<div class="table-wrap"><table class="table table--hover table--bordered table--compact">
              <thead><tr><th>نقش</th>${permissions
                .map((permission) => `<th class="text-center">${escapeHtml(permission.label)}</th>`)
                .join('')}<th class="text-center">مجموع</th></tr></thead>
              <tbody>${matrix.roles
                .map((role) => {
                  const grantsByModule = Object.values(role.grants ?? {}).flat();
                  const cells = permissions.map((permission) =>
                    Object.entries(role.grants ?? {}).filter(([, list]) => list.includes(permission.id)).length,
                  );
                  const total = cells.reduce((sum, value) => sum + value, 0);
                  return `<tr><th scope="row">${escapeHtml(role.label ?? role.id)}<span class="table__primary-sub">${toDigits(role.users ?? 0)} کاربر</span></th>${cells
                    .map(
                      (value) =>
                        `<td class="text-center">${value ? `<span class="badge badge--soft-success rounded-pill">${toDigits(value)}</span>` : '<span class="text-muted">—</span>'}</td>`,
                    )
                    .join('')}<td class="text-center"><strong class="numeric">${toDigits(total)}</strong><span class="visually-hidden">از ${toDigits(grantsByModule.length)} grant</span></td></tr>`;
                })
                .join('')}</tbody></table></div>`,
          })}
          <div class="grid grid--cards">${permissions
            .map((permission) => {
              const owners = holders(permission.id);
              const share = matrix.roles.length ? Math.round((owners.length / matrix.roles.length) * 100) : 0;
              return `<article class="card" data-permission="${escapeHtml(permission.id)}">
                <div class="card__head">
                  <div><h3 class="card__title">${escapeHtml(permission.label)}</h3><p class="card__subtitle">${toDigits(owners.reduce((sum, entry) => sum + entry.modules.length, 0))} grant روی ${toDigits(new Set(owners.flatMap((entry) => entry.modules)).size)} ماژول</p></div>
                  <span class="badge badge--soft-${share > 60 ? 'success' : share > 20 ? 'warning' : 'danger'} rounded-pill">${toDigits(share)}٪ نقش‌ها</span>
                </div>
                <div class="card__body">
                  <div class="progress progress--sm"><div class="progress-bar progress-bar--primary" style="width:${share}%"></div></div>
                  <p class="card__subtitle mt-3">${escapeHtml(permission.description ?? PERMISSION_NOTES[permission.id] ?? '')}</p>
                  ${owners.length
                    ? `<ul class="list-group list-group--flush mt-2">${owners
                        .map(
                          (entry) => `<li class="list-group__item"><span class="list-item__title">${escapeHtml(entry.role.label ?? entry.role.id)}</span><span class="list-item__meta numeric">${toDigits(entry.modules.length)} ماژول</span></li>`,
                        )
                        .join('')}</ul>`
                    : emptyState({ title: 'هیچ نقشی این مجوز را ندارد', text: 'برای ایمن‌سازی، این مجوز را به نقش مدیر بدهید.', icon: 'shield-exclamation' })}
                </div>
                <div class="card__foot">
                  <button class="btn btn-light btn-sm" type="button" data-permission-grant="${escapeHtml(permission.id)}"><i class="bi bi-check2-all"></i> اعطا به همه نقش‌ها</button>
                  <button class="btn btn-ghost btn-sm" type="button" data-permission-audit="${escapeHtml(permission.id)}"><i class="bi bi-search"></i> بررسی ماژول‌ها</button>
                </div>
              </article>`;
            })
            .join('')}</div>
        </div>`,
            );
        paint();

        on(node, 'click', async (event) => {
          const grant = event.target.closest('[data-permission-grant]');
          if (grant) {
            const permissionId = grant.dataset.permissionGrant;
            const missing = matrix.roles.filter((role) => !holders(permissionId).some((entry) => entry.role.id === role.id));
            if (!missing.length) {
              toast.info('نیازی به تغییر نیست', `همه نقش‌ها همین حالا «${PERMISSION_LABELS[permissionId] ?? permissionId}» را دارند.`);
              return;
            }
            const ok = await modal.confirm({
              title: 'اعطای گروهی مجوز',
              text: `${toDigits(missing.length)} نقش این مجوز را ندارد. به همه اعطا شود؟`,
              confirmText: 'اعطا کن',
              tone: 'primary',
            });
            if (!ok) return;
            missing.forEach((role) => {
              role.grants = role.grants ?? {};
              modules.forEach((module) => {
                const list = role.grants[module.id] ?? (role.grants[module.id] = []);
                if (!list.includes(permissionId)) list.push(permissionId);
              });
            });
            paint();
            toast.success('اعطا شد', `«${PERMISSION_LABELS[permissionId] ?? permissionId}» به ${toDigits(missing.length)} نقش افزوده شد.`);
            return;
          }
          const audit = event.target.closest('[data-permission-audit]');
          if (audit) {
            const permissionId = audit.dataset.permissionAudit;
            const owners = holders(permissionId);
            modal.open({
              title: `دارندگان مجوز «${PERMISSION_LABELS[permissionId] ?? permissionId}»`,
              body: `<ul class="list-group">${owners
                .map(
                  (entry) =>
                    `<li class="list-group__item"><span class="list-item__title">${escapeHtml(entry.role.label ?? entry.role.id)}</span><span class="list-item__meta">${escapeHtml(
                      entry.modules.map((id) => modules.find((module) => module.id === id)?.label ?? id).join('، '),
                    )}</span></li>`,
                )
                .join('')}</ul>`,
            });
          }
        });
        exportable(node, 'permissions');
        return;
      }

      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'نقش‌ها و دسترسی‌ها', subtitle: 'برای هر نقش مشخص کنید کدام ماژول‌ها قابل مشاهده و ویرایش هستند', icon: 'shield-lock', actions: toolButtons({ create: 'نقش جدید' }) })}
          ${statsFrom({ roles: matrix.roles.length, modules: modules.length, permissions: matrix.permissions.length, grants: matrix.roles.reduce((sum, role) => sum + Object.values(role.grants).flat().length, 0) }, [
            ['roles', 'نقش‌ها', 'number', 'primary', 'shield-check'],
            ['modules', 'ماژول‌ها', 'number', 'info', 'grid-3x3-gap'],
            ['permissions', 'نوع مجوز', 'number', 'violet', 'key'],
            ['grants', 'مجوزهای فعال', 'number', 'success', 'check2-square'],
          ])}
          ${card({
            title: 'ماتریس دسترسی',
            subtitle: 'تیک هر خانه یعنی نقش به ماژول دسترسی ویرایش دارد.',
            flush: true,
            body: `<div class="table-wrap"><table class="table table--hover table--bordered" data-permission-matrix>
              <thead><tr><th>ماژول</th>${matrix.roles.map((role) => `<th class="text-center">${escapeHtml(role.label ?? role.id)}<span class="table__primary-sub">${toDigits(role.users ?? 0)} کاربر</span></th>`).join('')}</tr></thead>
              <tbody>${modules
                .map(
                  (module) => `<tr><th scope="row">${escapeHtml(module.label ?? module.id)}</th>${matrix.roles
                    .map((role) => {
                      const grants = role.grants?.[module.id] ?? [];
                      const checked = grants.some((permission) => editable.includes(permission));
                      const full = grants.includes('delete') && grants.includes('export');
                      return `<td class="text-center"><label class="form-switch form-switch--sm"><input type="checkbox" class="form-check-input" data-role="${escapeHtml(role.id)}" data-module="${escapeHtml(module.id)}" ${checked ? 'checked' : ''} ${full ? 'data-full="1"' : ''}><span class="visually-hidden">${escapeHtml(role.label ?? role.id)} — ${escapeHtml(module.label ?? module.id)}</span></label></td>`;
                    })
                    .join('')}</tr>`,
                )
                .join('')}</tbody></table></div>`,
            foot: '<button class="btn btn-primary" type="button" data-save-matrix><i class="bi bi-check2"></i> ذخیره تغییرات</button><span class="text-muted fs-caption ms-3">تغییرات روی همه کاربران این نقش اعمال می‌شود.</span>',
          })}
          <div class="grid grid--cards">${matrix.roles
            .map(
              (role) => `<article class="card"><div class="card__body">
                <div class="d-flex align-items-center gap-3"><span class="tile tile--soft tile--primary tile--icon"><i class="bi bi-shield-check"></i></span><div><h3 class="card__title">${escapeHtml(role.label ?? role.id)}</h3><p class="card__subtitle">سطح دسترسی ${toDigits(role.level ?? 0)}٪</p></div></div>
                <div class="progress progress--sm mt-3"><div class="progress-bar progress-bar--primary" style="width:${Math.min(100, role.level ?? 0)}%"></div></div>
                ${infoRows([
                  ['کاربران', toDigits(role.users ?? 0)],
                  ['ماژول‌های مجاز', toDigits(Object.entries(role.grants ?? {}).filter(([, list]) => list.length).length)],
                  ['نوع', escapeHtml(role.type ?? 'نقش سیستمی')],
                ])}
              </div></article>`,
            )
            .join('')}</div>
        </div>`,
      );

      on($('[data-save-matrix]', node), 'click', async () => {
        const inputs = $$('[data-permission-matrix] input[type="checkbox"]', node);
        const byRole = inputs.reduce((acc, input) => {
          acc[input.dataset.role] = acc[input.dataset.role] ?? [];
          if (input.checked) acc[input.dataset.role].push(input.dataset.module);
          return acc;
        }, {});
        const button = $('[data-save-matrix]', node);
        button.classList.add('is-loading');
        try {
          await Promise.all(Object.entries(byRole).map(([roleId, modules]) => services.roleService.update(roleId, { modules })));
          toast.success('مجوزها ذخیره شد', 'دسترسی‌های جدید بلافاصله اعمال می‌شود.');
          bus.emit(EVENTS.dataChanged, { resource: 'roles', action: 'update' });
        } finally {
          button.classList.remove('is-loading');
        }
      });
      on($('[data-create]', node), 'click', () =>
        modal.open({
          title: 'تعریف نقش جدید',
          subtitle: 'نقش جدید بر پایه دسترسی‌های انتخاب‌شده ساخته می‌شود.',
          content: `<form data-role-form novalidate>${formMarkup([
            { name: 'label', label: 'نام نقش', required: true },
            { name: 'description', label: 'توضیح کوتاه', col: 2 },
          ])}<fieldset class="form-section"><legend class="form-section__title">دسترسی ماژول‌ها</legend><div class="grid grid--3">${modules
            .map((module) => `<label class="form-check"><input type="checkbox" class="form-check-input" name="modules" value="${escapeHtml(module.id)}" /><span class="form-check-label">${escapeHtml(module.label ?? module.id)}</span></label>`)
            .join('')}</div></fieldset></form>`,
          footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="submit" class="btn btn-primary" data-role-submit>ایجاد نقش</button>',
          onMount: (panel) => {
            on($('[data-role-submit]', panel), 'click', async () => {
              const form = $('[data-role-form]', panel);
              const { validateForm } = await import('../core/form.js');
              if (!validateForm(form).valid) {
                toast.warning('نام نقش الزامی است', 'برای نقش یک نام انتخاب کنید.');
                return;
              }
              const values = collectValues(form);
              const chosen = $$('input[name="modules"]:checked', form).map((input) => input.value);
              await services.roleService.update(values.label, { modules: chosen });
              toast.success('نقش ایجاد شد', `${chosen.length} ماژول برای این نقش فعال شد.`);
              modal.closeTop();
            });
          },
        }),
      );
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
    case 'customers/details.html': {
      const id = kit.queryParam('id');
      const record = (await loadRecord('customers', id)) ?? (await services.customerService.list({ perPage: 1 })).items[0];
      const orders = await services.orderService.list({ perPage: 5 });
      const node = host();
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: record.company ?? record.name ?? 'مشتری',
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
        { label: 'ارزش کل', value: formatCurrency(record.value ?? 480000000, 'IRR', { compact: true }), icon: 'cash-stack', tone: 'success' },
        { label: 'شاخص رضایت', value: formatPercent(4.6), icon: 'emoji-smile', tone: 'info' },
        { label: 'بدهی', value: formatCurrency(12000000, 'IRR', { compact: true }), icon: 'exclamation-circle', tone: 'warning' },
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
      const labels = { enterprise: 'سازمانی', smb: 'کسب‌وکار کوچک', startup: 'استارتاپ', retail: 'خرد' };
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
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'دسته‌بندی مشتریان', subtitle: 'بخش‌بندی بر پایه ارزش خرید، تعداد سفارش و نوع حساب', icon: 'diagram-3' })}
          <div class="grid grid--2">
            ${card({ title: 'سهم درآمد هر بخش', body: chartBox({ key: 'segments', type: 'donut', height: 320, series: segments.map((s) => s.revenue), labels: segments.map((s) => s.label) }) })}
            ${card({ title: 'تعداد مشتری هر بخش', body: chartBox({ key: 'segmentSizes', type: 'bar', height: 320, series: [{ name: 'مشتری', data: segments.map((s) => s.count) }], labels: segments.map((s) => s.label) }) })}
          </div>
          ${card({
            title: 'فهرست بخش‌ها',
            flush: true,
            body: `<div class="table-responsive"><table class="table table--hover"><thead><tr><th>بخش</th><th class="text-end">تعداد مشتری</th><th class="text-end">سفارش‌ها</th><th class="text-end">ارزش کل</th><th class="text-end">میانگین سبد</th></tr></thead>
              <tbody>${segments
                .map(
                  (segment) => `<tr><td class="table__primary">${escapeHtml(segment.label)}</td><td class="text-end numeric">${toDigits(segment.count)}</td>
                    <td class="text-end numeric">${toDigits(segment.orders)}</td><td class="text-end numeric">${formatCurrency(segment.revenue, 'IRR', { compact: true })}</td>
                    <td class="text-end numeric">${formatCurrency(segment.count ? segment.revenue / segment.count : 0, 'IRR', { compact: true })}</td></tr>`,
                )
                .join('')}</tbody></table></div>`,
          })}
        </div>`,
      );
      initCharts(node);
      return;
    }

    default:
      return;
  }
}

/* ==================================================================== exports */

/**
 * Named exports: `src/main.js` routes an area prefix straight to these
 * (`import('./js/pages/modules.js')).initEcommerce()`), so they must be real
 * exports — the grouped object below is kept for programmatic use.
 */
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
