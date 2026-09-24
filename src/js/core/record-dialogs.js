/**
 * NOVAADMIN — record dialogs
 * ------------------------------------------------------------------
 * Built-in «view» and «edit» dialogs for every DataTable row. Before this
 * module existed the edit button only broadcast an event nobody listened to,
 * so most tables had a pencil that did nothing. Now every table gets:
 *
 *   openRecordView({ record, columns, resource })   → rich read-only sheet
 *   openRecordEdit({ record, columns, service })    → validated edit form
 *
 * Fields are derived from the record itself, labelled through the column
 * registry + a shared dictionary, and typed (number, date, status select,
 * boolean switch, tags) so the form always matches the data.
 */
import { $, $$, on, escapeHtml } from './dom.js';
import { modal } from './modal.js';
import { toast } from './toast.js';
import { formatCurrency, formatNumber, toDigits } from './numbers.js';
import { formatDate, relativeTime } from './jalali.js';

/** Persian labels for raw status / enum values that appear in the mock data. */
export const STATUS_LABELS = {
  active: 'فعال', inactive: 'غیرفعال', pending: 'در انتظار', processing: 'در حال پردازش', completed: 'تکمیل‌شده', cancelled: 'لغو‌شده', canceled: 'لغو‌شده',
  refunded: 'مرجوع‌شده', paid: 'پرداخت‌شده', unpaid: 'پرداخت‌نشده', overdue: 'معوق', draft: 'پیش‌نویس', void: 'باطل', published: 'منتشرشده', archived: 'بایگانی',
  'out-of-stock': 'ناموجود', invited: 'دعوت‌شده', suspended: 'تعلیق', open: 'باز', 'in-progress': 'در حال انجام', in_progress: 'در حال انجام', resolved: 'حل‌شده', closed: 'بسته',
  'on-leave': 'در مرخصی', terminated: 'پایان همکاری', preparing: 'آماده‌سازی', 'in-transit': 'در مسیر', 'out-for-delivery': 'در حال تحویل', delivered: 'تحویل‌شده',
  delayed: 'تأخیری', returned: 'برگشتی', new: 'جدید', qualified: 'واجد شرایط', proposal: 'پیشنهاد', negotiation: 'مذاکره', won: 'موفق', lost: 'ناموفق',
  contacted: 'تماس گرفته‌شده', unqualified: 'فاقد شرایط', approved: 'تأییدشده', rejected: 'ردشده', backlog: 'بک‌لاگ', todo: 'برای انجام', review: 'بازبینی', done: 'انجام‌شده',
  trialing: 'آزمایشی', past_due: 'سررسید گذشته', scheduled: 'زمان‌بندی‌شده', paused: 'متوقف', answered: 'پاسخ داده‌شده', missed: 'بی‌پاسخ', voicemail: 'پیغام صوتی',
  inbound: 'ورودی', outbound: 'خروجی', expired: 'منقضی', failed: 'ناموفق', success: 'موفق', online: 'آنلاین', offline: 'آفلاین', away: 'دور از میز', busy: 'مشغول',
  available: 'در دسترس', 'on-route': 'در مسیر', idle: 'آماده', maintenance: 'در تعمیر', operational: 'عملیاتی', full: 'تکمیل ظرفیت', low: 'کم', medium: 'متوسط',
  high: 'زیاد', urgent: 'فوری', critical: 'بحرانی', normal: 'عادی', call: 'تماس', meeting: 'جلسه', email: 'ایمیل', task: 'وظیفه', note: 'یادداشت', 'at-risk': 'در معرض خطر',
  'on-track': 'طبق برنامه', 'on-hold': 'متوقف', planning: 'برنامه‌ریزی', confirmed: 'قطعی', tentative: 'غیرقطعی', percent: 'درصدی', fixed: 'مبلغ ثابت', shipping: 'ارسال رایگان',
  spam: 'اسپم', hidden: 'مخفی', true: 'بله', false: 'خیر', present: 'حاضر', absent: 'غایب', late: 'تأخیر', remote: 'دورکار', 'full-time': 'تمام‌وقت', 'part-time': 'پاره‌وقت',
  credit: 'واریز', debit: 'برداشت', in: 'ورودی', out: 'خروجی', income: 'درآمد', expense: 'هزینه', transfer: 'انتقال',
};

export const statusLabel = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return STATUS_LABELS[String(value).toLowerCase()] ?? String(value);
};

/** Human labels for common field names (fallback when a column is not defined). */
const FIELD_LABELS = {
  id: 'شناسه', name: 'نام', title: 'عنوان', email: 'ایمیل', phone: 'تلفن', status: 'وضعیت', statusLabel: 'وضعیت', company: 'شرکت', customer: 'مشتری', contact: 'مخاطب',
  owner: 'مسئول', city: 'شهر', country: 'کشور', address: 'نشانی', amount: 'مبلغ', total: 'مبلغ کل', price: 'قیمت', value: 'مقدار', type: 'نوع', category: 'دسته‌بندی',
  createdAt: 'تاریخ ایجاد', updatedAt: 'آخرین به‌روزرسانی', at: 'تاریخ', date: 'تاریخ', description: 'توضیحات', notes: 'یادداشت', note: 'یادداشت', code: 'کد', role: 'نقش',
  roleLabel: 'نقش', team: 'تیم', department: 'دپارتمان', position: 'سمت', duration: 'مدت', direction: 'جهت', startsAt: 'زمان شروع', location: 'محل', attendees: 'شرکت‌کنندگان',
  agenda: 'دستور جلسه', with: 'طرف جلسه', from: 'از تاریخ', to: 'تا تاریخ', minOrder: 'حداقل سفارش', used: 'استفاده‌شده', limit: 'سقف استفاده', products: 'محصولات',
  rating: 'امتیاز', slug: 'نامک', parent: 'دسته والد', revenue: 'درآمد', color: 'رنگ', stock: 'موجودی', sku: 'کد کالا', brand: 'برند', method: 'روش', reference: 'کد پیگیری',
  source: 'منبع', progress: 'پیشرفت', budget: 'بودجه', dueDate: 'موعد', priority: 'اولویت', tags: 'برچسب‌ها', recording: 'فایل ضبط', plan: 'پلن', number: 'شماره', vendor: 'تأمین‌کننده',
  balance: 'موجودی', bank: 'بانک', gateway: 'درگاه', fee: 'کارمزد', invoice: 'فاکتور', recurring: 'تکرارشونده', seats: 'تعداد کاربر', mrr: 'درآمد ماهانه', subject: 'موضوع',
  related: 'مرتبط با', outcome: 'نتیجه', score: 'امتیاز', industry: 'صنعت', website: 'وب‌سایت', employees: 'کارکنان', vehicle: 'خودرو', plate: 'پلاک', zone: 'منطقه',
  deliveries: 'تحویل‌ها', capacity: 'ظرفیت', staff: 'کارکنان', salary: 'حقوق', hiredAt: 'تاریخ استخدام', placedAt: 'تاریخ ثبت', issuedAt: 'تاریخ صدور', dueAt: 'سررسید',
  paid: 'پرداخت‌شده', payment: 'روش پرداخت', tracking: 'کد رهگیری', destination: 'مقصد', origin: 'مبدأ', carrier: 'شرکت حمل', driver: 'راننده', eta: 'زمان تخمینی',
  logo: 'لوگو', avatar: 'تصویر', image: 'تصویر', lastContact: 'آخرین تماس', lastActive: 'آخرین فعالیت', probability: 'احتمال', stage: 'مرحله', expectedClose: 'بستن مورد انتظار',
};

const HIDDEN_KEYS = new Set(['avatar', 'image', 'logo', 'ownerAvatar', 'assigneeAvatar', 'driverAvatar', 'agentAvatar', 'items', 'timeline', 'messages', 'events', 'tone', 'customerId', 'companyId', 'productId', 'projectId']);
const READONLY_KEYS = new Set(['id', 'createdAt', 'updatedAt']);
const DATE_KEY = /(At|Date|date|^at$|^from$|^to$|^eta$|^since$|Close$|^lastRun$|^lastSeen$|^lastUsed$)/;
const MONEY_KEY = /^(amount|total|price|finalPrice|budget|spent|revenue|value|balance|mrr|fee|minOrder|salary|subtotal|paid|cost|openValue|estimatedValue|net|base|bonus|deductions|weighted|totalSpend)$/;

function labelFor(key, columns) {
  const column = columns.find((col) => col.key === key || col.field === key);
  return column?.label ?? FIELD_LABELS[key] ?? key;
}

function isDateLike(key, value) {
  if (typeof value !== 'string') return false;
  return DATE_KEY.test(key) && !Number.isNaN(Date.parse(value));
}

/** Pretty value for the read-only sheet. */
function displayValue(key, value) {
  if (value === null || value === undefined || value === '') return '<span class="text-muted">—</span>';
  if (typeof value === 'boolean') return value ? '<span class="badge badge--soft-success">بله</span>' : '<span class="badge badge--soft-neutral">خیر</span>';
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="text-muted">—</span>';
    if (value.every((item) => typeof item !== 'object')) return value.map((item) => `<span class="tag">${escapeHtml(String(item))}</span>`).join(' ');
    return `<span class="badge badge--soft-primary">${toDigits(value.length)} مورد</span>`;
  }
  if (typeof value === 'object') return `<span class="text-muted">${escapeHtml(Object.values(value).slice(0, 3).join(' · '))}</span>`;
  if (key === 'status' || key === 'stage' || key === 'priority' || key === 'direction') return `<span class="badge badge--soft-primary">${escapeHtml(statusLabel(value))}</span>`;
  if (typeof value === 'number') return MONEY_KEY.test(key) ? `<span class="numeric">${formatCurrency(value, 'IRR')}</span>` : `<span class="numeric">${formatNumber(value)}</span>`;
  if (isDateLike(key, value)) return `<span class="numeric">${formatDate(value, { format: 'long' })}</span> <span class="text-muted fs-caption">(${relativeTime(value)})</span>`;
  if (key === 'color' && /^#|^rgb|^var/.test(value)) return `<span class="d-inline-flex align-items-center gap-2"><span class="color-dot" style="background:${escapeHtml(value)}"></span>${escapeHtml(value)}</span>`;
  if (/^https?:\/\//.test(value)) return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">${escapeHtml(value)}</a>`;
  return escapeHtml(statusLabel(value));
}

const primaryText = (record) => record.name ?? record.title ?? record.number ?? record.code ?? record.subject ?? record.reference ?? record.tracking ?? record.contact ?? record.customer ?? record.employee ?? record.product ?? record.email ?? record.id;
const secondaryText = (record) => record.company ?? record.email ?? record.category ?? record.customer ?? record.description ?? record.department ?? '';

/** Read-only detail sheet. */
export function openRecordView({ record, columns = [], resource = '', onEdit = null, onDelete = null, detailsHref = '' }) {
  if (!record) return null;
  const image = record.avatar ?? record.image ?? record.logo ?? record.ownerAvatar ?? null;
  const keys = Object.keys(record).filter((key) => !HIDDEN_KEYS.has(key) && key !== 'statusLabel' && key !== 'stageLabel' && key !== 'priorityLabel');
  const status = record.statusLabel ?? (record.status ? statusLabel(record.status) : '');
  const highlights = keys.filter((key) => typeof record[key] === 'number').slice(0, 3);
  const content = `<div class="record-sheet">
    <div class="record-sheet__hero">
      ${image ? `<img class="record-sheet__avatar" src="${escapeHtml(image)}" alt="" />` : `<span class="record-sheet__avatar record-sheet__avatar--icon"><i class="bi bi-layers"></i></span>`}
      <div class="record-sheet__id">
        <h3 class="record-sheet__title">${escapeHtml(String(primaryText(record)))}</h3>
        ${secondaryText(record) ? `<p class="record-sheet__sub">${escapeHtml(String(secondaryText(record))).slice(0, 140)}</p>` : ''}
        <div class="record-sheet__chips">
          ${status ? `<span class="badge badge--soft-primary rounded-pill">${escapeHtml(status)}</span>` : ''}
          <span class="badge badge--soft-neutral rounded-pill numeric">#${escapeHtml(String(record.id))}</span>
        </div>
      </div>
    </div>
    ${highlights.length ? `<div class="record-sheet__stats">${highlights.map((key) => `<div class="record-sheet__stat"><span>${escapeHtml(labelFor(key, columns))}</span><strong>${displayValue(key, record[key])}</strong></div>`).join('')}</div>` : ''}
    <dl class="record-sheet__grid">${keys
      .filter((key) => key !== 'id')
      .map((key) => `<div class="record-sheet__row"><dt>${escapeHtml(labelFor(key, columns))}</dt><dd>${displayValue(key, record[key])}</dd></div>`)
      .join('')}</dl>
  </div>`;
  return modal.open({
    title: 'جزئیات رکورد',
    subtitle: resource ? `منبع داده: ${resource}` : '',
    size: 'lg',
    content,
    footer: `${onDelete ? '<button type="button" class="btn btn-soft-danger me-auto" data-sheet-delete><i class="bi bi-trash3"></i> حذف</button>' : ''}
      ${detailsHref ? `<a class="btn btn-light" href="${escapeHtml(detailsHref)}"><i class="bi bi-box-arrow-up-left"></i> صفحه کامل</a>` : ''}
      <button type="button" class="btn btn-light" data-modal-close>بستن</button>
      ${onEdit ? '<button type="button" class="btn btn-primary" data-sheet-edit><i class="bi bi-pencil"></i> ویرایش</button>' : ''}`,
    onMount: (panel, instance) => {
      on($('[data-sheet-edit]', panel), 'click', () => {
        instance.close();
        setTimeout(() => onEdit?.(), 180);
      });
      on($('[data-sheet-delete]', panel), 'click', () => {
        instance.close();
        setTimeout(() => onDelete?.(), 180);
      });
    },
  });
}

/** Distinct values of `key` across rows — used for status selects. */
function optionsFrom(rows, key, current) {
  const values = new Set(rows.map((row) => row?.[key]).filter((value) => value !== undefined && value !== null && value !== ''));
  if (current !== undefined && current !== null && current !== '') values.add(current);
  return [...values].map((value) => ({ value: String(value), label: statusLabel(value) }));
}

const toInputDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

/** Validated edit form built from the record's own fields. */
export function openRecordEdit({ record, columns = [], service, rows = [], resource = '', onSaved = null, isNew = false }) {
  if (!record || !service) return null;
  const ENUM_KEYS = ['status', 'stage', 'priority', 'type', 'direction', 'category', 'channel', 'method', 'gateway', 'department', 'team', 'plan', 'role', 'source', 'carrier', 'zone'];
  const keys = Object.keys(record).filter((key) => !HIDDEN_KEYS.has(key) && !/Label$/.test(key) && !READONLY_KEYS.has(key) && (typeof record[key] !== 'object' || record[key] === null || (Array.isArray(record[key]) && record[key].every((item) => typeof item !== 'object'))));
  const fields = keys.slice(0, 14).map((key) => {
    const value = record[key];
    const label = labelFor(key, columns);
    const id = `rec-${key}-${Math.random().toString(36).slice(2, 7)}`;
    const wide = typeof value === 'string' && value.length > 60;
    let control;
    const enumOptions = ENUM_KEYS.includes(key) ? optionsFrom(rows, key, value) : [];
    if (typeof value === 'boolean') {
      return `<div class="form-field"><label class="form-switch"><input id="${id}" name="${key}" type="checkbox" class="form-check-input" ${value ? 'checked' : ''} data-kind="boolean"><span class="form-check-label">${escapeHtml(label)}</span></label></div>`;
    }
    if (enumOptions.length > 1) {
      control = `<select id="${id}" name="${key}" class="form-select" data-kind="text">${enumOptions.map((opt) => `<option value="${escapeHtml(opt.value)}" ${String(value) === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}</select>`;
    } else if (typeof value === 'number') {
      control = `<input id="${id}" name="${key}" type="number" step="any" class="form-control numeric" value="${escapeHtml(String(value))}" data-kind="number" required>`;
    } else if (Array.isArray(value)) {
      control = `<input id="${id}" name="${key}" class="form-control" value="${escapeHtml(value.join('، '))}" data-kind="list"><p class="form-hint">موارد را با ویرگول جدا کنید</p>`;
    } else if (isDateLike(key, value)) {
      control = `<input id="${id}" name="${key}" type="date" class="form-control" value="${toInputDate(value)}" data-kind="date">`;
    } else if (wide) {
      control = `<textarea id="${id}" name="${key}" rows="3" class="form-control" data-kind="text">${escapeHtml(value ?? '')}</textarea>`;
    } else {
      control = `<input id="${id}" name="${key}" class="form-control" value="${escapeHtml(value ?? '')}" data-kind="text" ${['name', 'title', 'code'].includes(key) ? 'required' : ''}>`;
    }
    return `<div class="form-field"${wide ? ' style="grid-column:1/-1"' : ''}><label class="form-label" for="${id}">${escapeHtml(label)}</label>${control}</div>`;
  });
  return modal.open({
    title: isNew ? 'افزودن مورد جدید' : 'ویرایش رکورد',
    subtitle: isNew ? 'فیلدها را تکمیل کنید' : `${primaryText(record)} — تغییرات بلافاصله در جدول اعمال می‌شود`,
    size: 'lg',
    content: `<form class="record-form" data-record-edit novalidate><div class="form-grid">${fields.join('')}</div></form>`,
    footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-record-save><i class="bi bi-check2"></i> ذخیره تغییرات</button>',
    onMount: (panel, instance) => {
      const form = $('[data-record-edit]', panel);
      const save = $('[data-record-save]', panel);
      const submit = async () => {
        let valid = true;
        $$('[required]', form).forEach((input) => {
          const empty = !String(input.value ?? '').trim();
          input.classList.toggle('is-invalid', empty);
          if (empty) valid = false;
        });
        if (!valid) {
          toast.warning('فرم کامل نیست', 'فیلدهای الزامی را تکمیل کنید.');
          return;
        }
        const payload = {};
        $$('[name]', form).forEach((input) => {
          const kind = input.dataset.kind;
          if (kind === 'boolean') payload[input.name] = input.checked;
          else if (kind === 'number') {
            const number = Number(String(input.value).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
            payload[input.name] = Number.isFinite(number) ? number : record[input.name];
          } else if (kind === 'list') payload[input.name] = input.value.split(/[,،]/).map((item) => item.trim()).filter(Boolean);
          else if (kind === 'date') payload[input.name] = input.value ? new Date(input.value).toISOString() : record[input.name];
          else payload[input.name] = input.value.trim();
        });
        if (payload.status && record.statusLabel !== undefined) payload.statusLabel = statusLabel(payload.status);
        save.classList.add('is-loading');
        save.disabled = true;
        try {
          const saved = isNew ? await service.create(payload) : await service.update(record.id, payload);
          toast.success(isNew ? 'مورد جدید ثبت شد' : 'تغییرات ذخیره شد', 'جدول به‌روزرسانی شد.');
          instance.close();
          onSaved?.(saved);
        } catch (error) {
          toast.danger('ذخیره نشد', error?.message ?? 'خطای غیرمنتظره');
        } finally {
          save.classList.remove('is-loading');
          save.disabled = false;
        }
      };
      on(save, 'click', submit);
      on(form, 'submit', (event) => {
        event.preventDefault();
        submit();
      });
    },
  });
}

export default { openRecordView, openRecordEdit, statusLabel, STATUS_LABELS };
