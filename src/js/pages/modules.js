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
import { formatDate, relativeTime } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import { initKanban } from '../core/kanban.js';
import * as kit from './kit.js';

const { card, statCard, infoRows, timeline, emptyState, paint, host, tabs, pageHeader, kanbanMarkup, formMarkup, collectValues, openRecordForm, chart, exportable, queryParam, statusBadge, toolButtons, statsFrom } = kit;
const services = kit.services;

/* ------------------------------------------------------------------ helpers */

/** Detail pages: fetch `?id=` and render header + info list + tabs. */
async function detailPage({ resource, id, title, badge, meta = [], tabs: tabDefs = [], actions = '' }) {
  const node = host();
  if (!node) return null;
  const service = services.default[resource];
  render(node, `<div class="dashboard-shell">${kit.skeleton(3)}</div>`);
  try {
    const record = service.get ? await service.get(id) : (await service.list({ perPage: 1 })).items[0];
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: record.title ?? record.name ?? record.number ?? record.subject ?? title, subtitle: meta.map((m) => m(record)).filter(Boolean).join(' • '), icon: 'layers', badges: badge ? [badge(record)] : [], actions })}
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
async function loadRecord(resource, id) {
  const service = services.default[resource];
  if (!service?.get) return null;
  try {
    return await service.get(id);
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
      setTimeout(() => window.location.assign('ecommerce/products.html'), 900);
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
        : board.columns.map((column) => ({
            id: column.id,
            label: column.label ?? column.title,
            tone: column.tone,
            items: (column.tasks ?? column.items ?? []).map((task) => ({
              id: task.id,
              title: task.title,
              meta: task.assignee,
              avatar: task.assigneeAvatar,
              progress: task.progress,
              tone: task.priorityTone ?? 'primary',
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
            badges: [statusBadge(`مجموع: ${formatCurrency(columns.reduce((sum, c) => sum + c.items.reduce((s, i) => s + (i.value ?? 0), 0), 0), 'IRR', { compact: true })}`, 'primary')],
            actions: toolButtons({ create: isCrm ? 'معامله جدید' : 'تسک جدید' }),
          })}
          ${kanbanMarkup({ columns })}
        </div>`,
      );

      initKanban($('[data-kanban]', node));
      bus.once('kanban:move', async ({ id, status, previous }) => {
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
      render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);
      const [cashFlow, balance, aging] = await Promise.all([
        services.financeReportsService.cashFlow(),
        services.financeReportsService.balanceSheet(),
        services.financeReportsService.aging(),
      ]);
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'نمای کلی مالی', subtitle: 'جریان نقدی، ترازنامه و مطالبات', icon: 'cash-stack', actions: toolButtons({ exportResource: 'transactions' }) })}
          ${statsFrom({ inflow: cashFlow.inflow, outflow: cashFlow.outflow, net: cashFlow.net, outstanding: aging.total ?? 0 }, [
            ['inflow', 'ورودی دوره', 'currency', 'success', 'arrow-down-circle'],
            ['outflow', 'خروجی دوره', 'currency', 'danger', 'arrow-up-circle'],
            ['net', 'خالص', 'currency', 'primary', 'activity'],
            ['outstanding', 'مطالبات باز', 'currency', 'warning', 'hourglass-split'],
          ])}
          <div class="widget-grid">
            ${card({ title: 'جریان نقدی', subtitle: 'شش ماه گذشته', body: `<div class="chart" data-chart="area" data-chart-height="320" data-chart-key="cashflow"></div>` })}
            ${card({ title: 'ساختار درآمد', body: `<div class="chart" data-chart="donut" data-chart-height="320" data-chart-key="income-split"></div>` })}
          </div>
          ${card({ title: 'گزارش سنی مطالبات', flush: true, body: `<table class="table"><thead><tr><th>بازه</th><th>مبلغ</th><th>سهم</th></tr></thead><tbody>${(aging.buckets ?? [])
            .map((bucket) => `<tr><td>${escapeHtml(bucket.label)}</td><td class="numeric">${formatCurrency(bucket.total, 'IRR')}</td><td><div class="progress progress--sm"><div class="progress-bar progress-bar--${bucket.tone ?? 'primary'}" style="width:${bucket.percent}%"></div></div></td></tr>`)
            .join('')}</tbody></table>` })}
        </div>`,
      );
      await Promise.all([
        chart($('[data-chart-key="cashflow"]', node), { type: 'area', series: cashFlow.series, labels: cashFlow.labels }),
        chart($('[data-chart-key="income-split"]', node), { type: 'donut', series: (balance.assets ?? []).map((row) => row.value), labels: (balance.assets ?? []).map((row) => row.label) }),
      ]);
      exportable(node, 'transactions');
      return;
    }

    case 'finance/invoice-details.html': {
      const id = queryParam('id');
      const node = host();
      const invoice = await loadRecord('invoices', id);
      if (!invoice) {
        render(node, kit.errorState('فاکتور مورد نظر پیدا نشد'));
        on($('[data-retry]', node), 'click', () => (window.location.href = 'finance/invoices.html'));
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
        setTimeout(() => window.location.assign('finance/invoices.html'), 900);
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
    case 'projects/details.html': {
      const id = queryParam('id');
      const node = host();
      render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);
      const project = await loadRecord('projects', id);
      if (!project) {
        render(node, kit.errorState('پروژه مورد نظر پیدا نشد'));
        return;
      }
      const [activity, members, files, workload] = await Promise.all([
        services.projectFeedService.activity(project.id),
        services.projectFeedService.members(project.id),
        services.projectFeedService.files(project.id),
        services.projectFeedService.workload(project.id),
      ]);
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: project.name,
            subtitle: `${project.client ?? ''} • مدیر پروژه: ${project.owner ?? '—'}`,
            icon: 'kanban',
            badges: [statusBadge(project.statusLabel ?? project.status, 'primary'), statusBadge(`پیشرفت ${toDigits(project.progress)}٪`, 'success')],
            actions: '<a class="btn btn-light" href="projects/kanban.html"><i class="bi bi-kanban"></i> تابلوی کانبان</a><a class="btn btn-primary" href="projects/tasks.html"><i class="bi bi-list-task"></i> مدیریت تسک‌ها</a>',
          })}
          ${statsFrom({ budget: project.budget, spent: project.spent, tasks: project.tasksCount ?? 0, members: members.length }, [
            ['budget', 'بودجه', 'currency', 'primary', 'wallet2'],
            ['spent', 'هزینه‌شده', 'currency', 'warning', 'cash-coin'],
            ['tasks', 'تسک‌ها', 'number', 'info', 'list-check'],
            ['members', 'اعضای تیم', 'number', 'success', 'people'],
          ])}
          <div class="widget-grid">
            ${card({ title: 'پیشرفت انجام کار', body: `<div class="chart" data-chart="radialBar" data-chart-height="300" data-chart-series='${JSON.stringify([project.progress ?? 0])}' data-chart-labels='["پیشرفت پروژه"]'></div>` })}
            ${card({ title: 'توزیع بار کاری تیم', body: `<div class="chart" data-chart="bar" data-chart-height="300" data-chart-series='${JSON.stringify([{ name: 'تسک‌های باز', data: workload.map((row) => row.open ?? 0) }])}' data-chart-labels='${JSON.stringify(workload.map((row) => row.name))}'></div>` })}
          </div>
          ${tabs([
            { id: 'team', label: 'تیم', icon: 'people', body: card({ flush: true, body: `<ul class="list-group">${members.map((member) => `<li class="list-item"><img class="avatar avatar--sm" src="${escapeHtml(member.avatar)}" alt=""><span class="list-item__title">${escapeHtml(member.name)}<span class="list-item__sub">${escapeHtml(member.role ?? '')}</span></span><span class="list-item__meta">${toDigits(member.tasks ?? 0)} تسک</span></li>`).join('')}</ul>` }) },
            { id: 'activity', label: 'فعالیت‌ها', icon: 'activity', body: card({ body: timeline(activity.slice(0, 8).map((item) => ({ title: item.title, text: item.text, time: relativeTime(item.at), tone: item.tone ?? 'primary', icon: item.icon ?? 'dot' }))) }) },
            { id: 'files', label: 'فایل‌ها', icon: 'folder2-open', body: card({ flush: true, body: `<ul class="list-group">${files.map((file) => `<li class="list-item"><span class="file-card__icon"><i class="bi bi-file-earmark"></i></span><span class="list-item__title">${escapeHtml(file.name)}<span class="list-item__sub">${escapeHtml(file.size ?? '')}</span></span><span class="list-item__meta">${relativeTime(file.at)}</span></li>`).join('')}</ul>` }) },
            { id: 'milestones', label: 'نقاط عطف', icon: 'flag', body: card({ body: milestoneList(project.id) }) },
          ])}
        </div>`,
      );
      initCharts(node);
      return;
    }

    case 'projects/timeline.html': {
      const node = host();
      const { items } = await services.projects.list({ perPage: 12 });
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'زمان‌بندی پروژه‌ها', subtitle: 'نمای گانت بر پایه تاریخ شروع و پایان هر پروژه', icon: 'calendar-range', actions: toolButtons({}) })}
          ${card({
            flush: true,
            body: `<div class="gantt">${items
              .map((project) => {
                const start = new Date(project.startDate ?? project.createdAt ?? Date.now());
                const end = new Date(project.dueDate ?? Date.now());
                const span = Math.max(1, Math.round((end - start) / 86400000));
                const offset = Math.max(0, Math.min(80, new Date(project.startDate ?? Date.now()).getDate()));
                return `<div class="gantt__row"><span class="gantt__label">${escapeHtml(project.name)}</span>
                  <div class="gantt__track"><div class="gantt__bar gantt__bar--${project.progress > 70 ? 'success' : project.progress > 40 ? 'primary' : 'warning'}" style="inset-inline-start:${offset}%;width:${Math.min(100 - offset, Math.max(8, span / 2))}%"><span>${toDigits(project.progress ?? 0)}٪</span></div></div>
                  <span class="gantt__dates numeric">${formatDate(start, { format: 'short' })} — ${formatDate(end, { format: 'short' })}</span></div>`;
              })
              .join('')}</div>`,
          })}
        </div>`,
      );
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
      const topics = await services.knowledgeBaseService.list();
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'پایگاه دانش', subtitle: 'مقاله‌های آماده برای پاسخ سریع به مشتریان', icon: 'book', actions: toolButtons({ create: 'مقاله جدید' }) })}
          <div class="search-overlay__head" style="position:static;border:1px solid var(--nv-border);border-radius:var(--nv-radius-lg)"><i class="bi bi-search"></i><input class="form-control" type="search" placeholder="جستجو در مقاله‌ها…" data-kb-search></div>
          <div class="grid grid--cards" data-kb-list>${kbCards(topics)}</div>
        </div>`,
      );
      on($('[data-kb-search]', node), 'input', async (event) => {
        const found = await services.knowledgeBaseService.search(event.target.value);
        render($('[data-kb-list]', node), kbCards(found.length ? found : topics));
      });
      on($('[data-create]', node), 'click', () => toast.info('ساخت مقاله', 'برای ساخت مقاله، فرم CMS را در بخش محتوا استفاده کنید.'));
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
          ${card({ title: 'فهرست امروز', flush: true, body: `<table class="table table--hover"><thead><tr><th>کارمند</th><th>ورود</th><th>خروج</th><th>ساعت کارکرد</th><th>وضعیت</th></tr></thead><tbody>${(today.items ?? [])
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
      const items = payroll.items ?? payroll;
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
      const [jobs, candidates] = await Promise.all([services.recruitmentService.jobs(), services.recruitmentService.candidates()]);
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
          ${card({ flush: true, body: `<ul class="list-group">${items.map((row) => `<li class="list-item"><span class="tile tile--soft"><i class="bi bi-diagram-2"></i></span><span class="list-item__title">${escapeHtml(row.name)}<span class="list-item__sub">سرپرست: ${escapeHtml(row.head ?? '—')}</span></span><span class="list-item__meta">${toDigits(row.headcount ?? 0)} نفر • ${formatCurrency(row.budget ?? 0, 'IRR', { compact: true })}</span></li>`).join('')}</ul>` })}
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
      const [map, performance, shipments] = await Promise.all([services.trackingService.map(), services.trackingService.performance(), services.shipmentService.list({ perPage: 8 })]);
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({ title: 'ردیابی محموله‌ها', subtitle: 'موقعیت لحظه‌ای و عملکرد تحویل', icon: 'geo-alt', actions: toolButtons({ exportResource: 'shipments' }) })}
          ${statsFrom(performance, [
            ['onTime', 'تحویل به‌موقع', 'percent', 'success', 'clock-history'],
            ['delayed', 'تأخیری', 'number', 'danger', 'alarm'],
            ['inTransit', 'در مسیر', 'number', 'info', 'truck'],
            ['delivered', 'تحویل‌شده امروز', 'number', 'primary', 'box-seam'],
          ])}
          <div class="grid grid--sidebar">
            ${card({ title: 'نقشه مسیرها', body: `<div class="map-canvas" data-map>${(map.markers ?? map ?? [])
              .map(
                (marker, index) => `<span class="status-dot status-dot--pulse" style="position:absolute;inset-block-start:${20 + (index * 13) % 60}%;inset-inline-start:${15 + (index * 21) % 70}%" title="${escapeHtml(marker.label ?? '')}"></span>`,
              )
              .join('')}<span class="map-canvas__hint">نمای نمایشی نقشه — در نسخه نهایی با سرویس نقشه جایگزین می‌شود.</span></div>` })}
            ${card({ title: 'محموله‌های فعال', flush: true, body: `<ul class="list-group">${(shipments.items ?? [])
              .map(
                (shipment) => `<li class="list-item"><span class="status-dot status-dot--${shipment.status === 'delayed' ? 'danger' : shipment.status === 'delivered' ? 'success' : 'primary'}"></span><span class="list-item__title">${escapeHtml(shipment.tracking)}<span class="list-item__sub">${escapeHtml(shipment.destination ?? '')}</span></span><span class="list-item__meta">${relativeTime(shipment.eta ?? shipment.updatedAt)}</span></li>`,
              )
              .join('')}</ul>` })}
          </div>
        </div>`,
      );
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

async function initReports() {
  const page = kit.pageId();
  const type = page.split('/').pop().replace('.html', '');
  const node = host();
  if (!node) return;
  render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);

  const report = await services.analyticsService.report(type === 'finance' ? 'finance' : type);
  const labels = report.labels ?? [];
  const series = report.series ? [report.series] : report.seriesList ?? [];

  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: `${report.title ?? 'گزارش'} ${escapeHtml(type)}`,
        subtitle: 'گزارش تعاملی با امکان تغییر بازه زمانی و خروجی گرفتن',
        icon: 'bar-chart-line',
        actions: `<div class="segmented" data-report-range>${['7d', '30d', '90d', '12m'].map((range) => `<button type="button" class="segmented__item ${range === '30d' ? 'is-active' : ''}" data-value="${range}">${range === '12m' ? '۱۲ ماه' : range === '90d' ? '۹۰ روز' : range === '30d' ? '۳۰ روز' : '۷ روز'}</button>`).join('')}</div>
          ${toolButtons({ exportResource: type })}`,
      })}
      ${statsFrom(report.summary ?? {}, Object.entries(report.summary ?? {}).slice(0, 4).map(([key]) => [key, report.labelsFor?.[key] ?? key, typeof report.summary[key] === 'number' && report.summary[key] > 1000 ? 'number' : 'number', 'primary', 'graph-up']))}
      <div class="widget-grid">
        ${card({ title: 'روند کلی', body: `<div class="chart" data-chart="${report.chartType ?? 'area'}" data-chart-height="340" data-chart-series='${JSON.stringify(series)}' data-chart-labels='${JSON.stringify(labels)}'></div>` })}
        ${card({ title: 'سهم دسته‌ها', body: `<div class="chart" data-chart="donut" data-chart-height="340" data-chart-series='${JSON.stringify((report.breakdown ?? []).map((row) => row.value))}' data-chart-labels='${JSON.stringify((report.breakdown ?? []).map((row) => row.label))}'></div>` })}
      </div>
      ${card({ title: 'جدول تفصیلی', flush: true, body: reportTable(report) })}
    </div>`,
  );
  initCharts(node);
  exportable(node, type);
  on($('[data-report-range]', node), 'click', (event) => {
    const preset = event.target.closest('[data-range]');
    if (!preset) return;
    $$('[data-value]', preset.closest('[data-report-range]') ?? node).forEach((item) => item.classList.toggle('is-active', item === preset));
    toast.info('بازه زمانی تغییر کرد', 'داده‌های گزارش با بازه جدید بازخوانی می‌شود.');
  });
}

function reportTable(report) {
  const rows = report.table ?? report.rows ?? [];
  if (!rows.length) return emptyState({ title: 'داده تفصیلی برای این گزارش موجود نیست', text: 'برای مشاهده داده، بازه دیگری را انتخاب کنید.', icon: 'table' });
  const keys = Object.keys(rows[0]);
  return `<div class="table-wrap"><table class="table table--hover"><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td class="${typeof row[key] === 'number' ? 'numeric' : ''}">${escapeHtml(String(row[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ===================================================================== Users */

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
          setTimeout(() => window.location.assign('users/list.html'), 900);
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
            (session) => `<li class="list-item" data-session="${escapeHtml(session.id)}"><span class="tile tile--soft"><i class="bi bi-${session.device === 'موبایل' ? 'phone' : 'laptop'}"></i></span><span class="list-item__title">${escapeHtml(session.browser ?? '')}<span class="list-item__sub">${escapeHtml(session.location ?? '')}</span></span><span class="list-item__meta"><button class="btn btn-ghost btn-sm" type="button" data-revoke>پایان نشست</button></span></li>`,
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
                <div class="d-flex align-items-center gap-3"><span class="tile tile--soft tile--primary"><i class="bi bi-shield-check"></i></span><div><h3 class="card__title">${escapeHtml(role.label ?? role.id)}</h3><p class="card__subtitle">سطح دسترسی ${toDigits(role.level ?? 0)}٪</p></div></div>
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
            ${card({ title: 'سهم درآمد هر بخش', body: chart({ key: 'segments', type: 'donut', height: 320, series: segments.map((s) => s.revenue), labels: segments.map((s) => s.label) }) })}
            ${card({ title: 'تعداد مشتری هر بخش', body: chart({ key: 'segmentSizes', type: 'bar', height: 320, series: [{ name: 'مشتری', data: segments.map((s) => s.count) }], labels: segments.map((s) => s.label) }) })}
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
