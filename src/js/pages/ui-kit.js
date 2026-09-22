/**
 * NOVAADMIN — component library pages (`ui/*.html`)
 * ------------------------------------------------------------------
 * Every page under `ui/` is a live specimen sheet, not a screenshot: the markup
 * below is the same markup customers copy into their own screens, wired to the
 * same controllers (`core/form.js`, `core/ui.js`, `core/modal.js`,
 * `core/toast.js`, `core/datatable.js`, `core/charts.js`), so what you see on
 * the page is exactly what the component does.
 *
 * Layout of this module:
 *   1. small composition helpers (`demoItem`, `demoSection`…)
 *   2. `PAGES` — one builder per slug, each returning page markup plus an
 *      optional `wire()` step for interactions that need real JavaScript
 *   3. `initUiKit()` — resolves the slug, renders and calls `wire()`
 *
 * Adding a page means adding one entry to `PAGES`; the manifest already points
 * `ui/<slug>.html` at this controller.
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { toast, TOAST_POSITIONS } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { initCharts } from '../core/charts.js';
import { theme, LAYOUTS } from '../core/theme.js';
import { setLanguage } from '../core/i18n.js';
import { formatCurrency, formatNumber, formatPercent, toDigits } from '../core/numbers.js';
import { formatDate, relativeTime } from '../core/jalali.js';
import { createDataTable } from '../core/datatable.js';
import { ICON_GROUPS, ICON_TOTAL } from '../../data/icons.js';
import {
  card,
  pageHeader,
  host,
  pageId,
  chartBox,
  tabs,
  statCard,
  statusBadge,
  infoRows,
  timeline,
  skeleton,
  emptyState,
  errorState,
  kpiCards,
  services,
} from './kit.js';

/* ======================================================= composition helpers */

/** A labelled demo cell: `demoItem('کردی', '<button …>')`. */
const demoItem = (label, body, hint = '') =>
  `<div class="demo-item"><span class="demo-item__label">${escapeHtml(label)}</span>${body}${hint ? `<span class="demo-item__hint">${hint}</span>` : ''}</div>`;

/** A grid of demo cells. */
const demoGrid = (items, columns = 2) => `<div class="demo-grid demo-grid--${columns}">${items.join('')}</div>`;

/** A card that groups one family of components. */
const demoSection = ({ title, subtitle = '', body, wide = false, actions = '', foot = '' }) =>
  card({ title, subtitle, body: demoGrid(Array.isArray(body) ? body : [body], wide ? 3 : 2), actions, foot });

/** Neutral stage around a single component. */
const box = (content, { start = false, tall = false } = {}) =>
  `<div class="demo-box${start ? ' demo-box--start' : ''}${tall ? ' demo-box--tall' : ''}">${content}</div>`;

const row = (content, variant = '') => `<div class="demo-row${variant ? ` demo-row--${variant}` : ''}">${content}</div>`;

const swatch = (name, value, label) =>
  `<div class="demo-swatch"><div class="demo-swatch__chip" style="background:${value}"></div><div class="demo-swatch__meta"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(name)}</span></div></div>`;

const tokenRow = (token, label, value = '') =>
  `<div class="demo-token"><span class="demo-token__dot" style="background:var(${token})"></span><code>${escapeHtml(token)}</code><span>${escapeHtml(label)}</span>${value ? `<span class="ms-auto">${value}</span>` : ''}</div>`;

/**
 * Wraps the sections of a page. Sections are HTML strings, but a page may pass
 * `{ html }` when it needs to mix pre-built cards with `demoSection()` output.
 */
const page = (title, subtitle, icon, sections, actions = '') =>
  `<div class="dashboard-shell">${pageHeader({ title, subtitle, icon, actions })}${sections
    .map((section) => (typeof section === 'string' ? section : section?.html ?? ''))
    .join('')}</div>`;

/* =================================================================== buttons */

const BUTTON_TONES = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'dark'];

function buildButtons() {
  const sections = [
    demoSection({
      title: 'رنگ‌ها و سبک‌ها',
      subtitle: 'هر رنگ در پنج سبک: تو‌پر، نرم، خطی، روشن و شبح — همه بر پایه توکن رنگ اصلی',
      body: BUTTON_TONES.map((tone) =>
        demoItem(
          tone,
          row(
            `<button class="btn btn-${tone}" type="button">تو‌پر</button>
             <button class="btn btn-soft-${tone === 'dark' ? 'neutral' : tone}" type="button">نرم</button>
             <button class="btn btn-outline-${tone === 'dark' ? 'secondary' : tone}" type="button">خطی</button>
             <button class="btn btn-ghost" type="button">شبح</button>`,
          ),
        ),
      ),
      wide: true,
    }),
    demoSection({
      title: 'اندازه‌ها و شکل‌ها',
      subtitle: 'چهار اندازه، دکمه تمام‌عرض، دکمه آیکونی و گروه دکمه',
      body: [
        demoItem('اندازه‌ها', row(`<button class="btn btn-primary btn-sm" type="button">کوچک</button><button class="btn btn-primary" type="button">متوسط</button><button class="btn btn-primary btn-lg" type="button">بزرگ</button>`)),
        demoItem('دکمه آیکونی', row(`<button class="icon-btn" type="button" aria-label="ویرایش"><i class="bi bi-pencil"></i></button><button class="icon-btn icon-btn--sm" type="button" aria-label="حذف"><i class="bi bi-trash"></i></button><button class="icon-btn icon-btn--danger" type="button" aria-label="خطر"><i class="bi bi-exclamation-triangle"></i></button>`)),
        demoItem('با آیکون', row(`<button class="btn btn-primary" type="button"><i class="bi bi-plus-lg"></i> افزودن</button><button class="btn btn-light" type="button">دانلود <i class="bi bi-download"></i></button>`)),
        demoItem('گروه دکمه', row(`<div class="btn-group" role="group" aria-label="نمایش"><button class="btn btn-light is-active" type="button">روز</button><button class="btn btn-light" type="button">هفته</button><button class="btn btn-light" type="button">ماه</button></div>`)),
        demoItem('تمام‌عرض', `<button class="btn btn-primary btn-block" type="button">ذخیره تغییرات</button>`),
        demoItem('لینک', row(`<a class="btn btn-link" href="#">دکمه لینکی</a>`)),
      ],
    }),
    demoSection({
      title: 'حالت‌ها',
      subtitle: 'غیرفعال، در حال بارگذاری و در حال اجرا — همه با همان کلاس‌های پایه',
      body: [
        demoItem('غیرفعال', row(`<button class="btn btn-primary" type="button" disabled>غیرفعال</button><button class="btn btn-soft-primary" type="button" disabled>نرم غیرفعال</button>`)),
        demoItem('بارگذاری', `<button class="btn btn-primary" type="button" data-demo-loading>${'<span class="spinner spinner--sm" aria-hidden="true"></span> ذخیره‌سازی'}</button>`, 'برای دیدن حالت بارگذاری کلیک کنید'),
        demoItem('نوار ابزار صفحه', box('<div class="page-head-row__actions"><button class="btn btn-primary" type="button"><i class="bi bi-plus-lg"></i> مورد جدید</button><button class="btn btn-light" type="button"><i class="bi bi-funnel"></i> فیلتر</button><button class="btn btn-light" type="button"><i class="bi bi-three-dots"></i></button></div>', { start: true })),
      ],
    }),
  ];
  return { title: 'دکمه‌ها', subtitle: 'همه اندازه‌ها، رنگ‌ها، حالت‌ها و آیکون‌ها روی یک صفحه', icon: 'ui-checks', sections };
}

/* ==================================================================== inputs */

function buildInputs() {
  const sections = [
    demoSection({
      title: 'ورودی‌های متنی',
      body: [
        demoItem('متن ساده', `<label class="form-label" for="demo-text">نام و نام خانوادگی</label><input class="form-control" id="demo-text" type="text" placeholder="مثلاً سارا محمدی">`),
        demoItem('ایمیل', `<label class="form-label" for="demo-email">ایمیل سازمانی</label><input class="form-control" id="demo-email" type="email" placeholder="name@company.ir">`),
        demoItem('گذرواژه', `<label class="form-label" for="demo-pass">گذرواژه</label><input class="form-control" id="demo-pass" type="password" value="Nova@1404"><span class="form-hint">حداقل ۸ نویسه، شامل عدد و حرف بزرگ</span>`),
        demoItem('جستجو', `<div class="input-group"><span class="input-group__addon"><i class="bi bi-search"></i></span><input class="form-control" type="search" placeholder="جستجو در فهرست…"></div>`),
        demoItem('عددی با شمارنده', `<input class="form-control" type="number" value="120" min="0" max="999" data-counter-format="number" inputmode="numeric">`),
        demoItem('تاریخ (شمسی)', `<input class="form-control" type="text" value="${formatDate(new Date(), { format: 'medium' })}" readonly><span class="form-hint">قالب تقویم از تنظیمات کاربر خوانده می‌شود</span>`),
      ],
    }),
    demoSection({
      title: 'انتخاب‌گرها',
      body: [
        demoItem('لیست انتخابی', `<select class="form-select"><option>همه وضعیت‌ها</option><option>فعال</option><option>در انتظار</option><option>غیرفعال</option></select>`),
        demoItem('چندانتخابی', `<select class="form-select" multiple size="4"><option selected>فروش</option><option selected>پشتیبانی</option><option>بازاریابی</option><option>مالی</option></select>`),
        demoItem('ورودی برچسبی', `<div class="tag-input" data-tag-input><input class="form-control" type="text" placeholder="برچسب بزنید و Enter بفشارید" value="فوری, داخلی"></div>`, 'با Enter هر برچسب اضافه می‌شود'),
        demoItem('اسلایدر', `<input class="form-range" type="range" min="0" max="100" value="64" data-range-output><span class="form-hint" data-range-value>۶۴</span>`),
        demoItem('فایل', `<input class="form-control" type="file">`),
        demoItem('انتخاب رنگ', `<div class="swatches" data-swatch-group>${['primary', 'success', 'warning', 'danger', 'info', 'violet'].map((tone) => `<button type="button" class="swatch" data-swatch="${tone}" aria-label="رنگ ${tone}" style="background:var(--nv-${tone === 'primary' ? 'primary' : tone})"></button>`).join('')}</div>`),
      ],
    }),
    demoSection({
      title: 'چک، رادیو و سوییچ',
      body: [
        demoItem('چک‌باکس', `<div class="form-check"><input class="form-check-input" type="checkbox" id="d-chk1" checked><label class="form-check-label" for="d-chk1">ارسال ایمیل اطلاع‌رسانی</label></div><div class="form-check"><input class="form-check-input" type="checkbox" id="d-chk2"><label class="form-check-label" for="d-chk2">فعال‌سازی گزارش هفتگی</label></div>`),
        demoItem('رادیو', `<div class="form-check"><input class="form-check-input" type="radio" name="d-radio" id="d-r1" checked><label class="form-check-label" for="d-r1">ارسال فوری</label></div><div class="form-check"><input class="form-check-input" type="radio" name="d-radio" id="d-r2"><label class="form-check-label" for="d-r2">ارسال زمان‌بندی‌شده</label></div>`),
        demoItem('سوییچ', `<div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="d-sw1" checked><label class="form-check-label" for="d-sw1">حالت تاریک خودکار</label></div><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="d-sw2"><label class="form-check-label" for="d-sw2">اعلان صوتی</label></div>`),
        demoItem('دکمه‌های رادیویی', `<div class="btn-group" role="group" aria-label="اولویت">${['کم', 'متوسط', 'زیاد'].map((label, index) => `<label class="btn btn-outline-primary${index === 1 ? ' is-active' : ''}"><input class="visually-hidden" type="radio" name="d-priority" value="${label}" ${index === 1 ? 'checked' : ''}>${label}</label>`).join('')}</div>`, 'انتخاب با کلیک روی هر بخش'),
      ],
    }),
    demoSection({
      title: 'حالت‌های اعتبارسنجی',
      subtitle: 'خطا، موفق، راهنما و غیرفعال — با همان کلاس‌های `core/form.js`',
      body: [
        demoItem('خطا', `<input class="form-control is-invalid" type="text" value="نامعتبر"><span class="field-feedback field-feedback--error"><i class="bi bi-exclamation-circle"></i> این مقدار معتبر نیست.</span>`),
        demoItem('موفق', `<input class="form-control is-valid" type="text" value="سارا محمدی"><span class="field-feedback field-feedback--success"><i class="bi bi-check2-circle"></i> ذخیره شد.</span>`),
        demoItem('راهنما', `<input class="form-control" type="text" placeholder="کد پرسنلی"><span class="form-hint">۸ رقم، بدون خط تیره</span>`),
        demoItem('غیرفعال / فقط خواندنی', `<input class="form-control" type="text" value="غیرقابل ویرایش" disabled><input class="form-control mt-2" type="text" value="فقط خواندنی" readonly>`),
      ],
    }),
  ];
  return { title: 'ورودی‌های پیشرفته', subtitle: 'ورودی‌ها، انتخاب‌گرها، برچسب‌ها و اسلایدرها', icon: 'input-cursor-text', sections };
}

/* ===================================================================== forms */

function buildForms() {
  const sections = [
    demoSection({
      title: 'فرم عمودی با اعتبارسنجی زنده',
      subtitle: 'قواعد را از `data-rule` می‌خواند؛ همان کنترلری که همه فرم‌های قالب استفاده می‌کنند',
      wide: true,
      body: `<form class="form-grid" data-validate novalidate>
        <div><label class="form-label" for="f-first">نام <span class="text-danger">*</span></label><input class="form-control" id="f-first" name="firstName" type="text" data-rule="required" placeholder="سارا"></div>
        <div><label class="form-label" for="f-last">نام خانوادگی <span class="text-danger">*</span></label><input class="form-control" id="f-last" name="lastName" type="text" data-rule="required" placeholder="محمدی"></div>
        <div><label class="form-label" for="f-mail">ایمیل <span class="text-danger">*</span></label><input class="form-control" id="f-mail" name="email" type="email" data-rule="email" placeholder="name@company.ir"></div>
        <div><label class="form-label" for="f-phone">موبایل</label><input class="form-control" id="f-phone" name="phone" type="tel" data-rule="phone" inputmode="numeric" placeholder="۰۹۱۲۳۴۵۶۷۸۹"></div>
        <div class="span-full"><label class="form-label" for="f-note">توضیحات</label><textarea class="form-control" id="f-note" name="note" rows="3" placeholder="توضیح کوتاه…"></textarea></div>
        <div><label class="form-label" for="f-role">نقش</label><select class="form-select" id="f-role" name="role"><option>مدیر</option><option>کارشناس</option><option>مشاهده‌گر</option></select></div>
        <div class="form-check form-switch align-self-end"><input class="form-check-input" type="checkbox" role="switch" id="f-active" name="active" checked><label class="form-check-label" for="f-active">حساب فعال باشد</label></div>
        <div class="span-full form-actions"><button class="btn btn-primary" type="submit">ذخیره کاربر</button><button class="btn btn-light" type="reset">پاک‌کردن</button></div>
      </form>`,
    }),
    demoSection({
      title: 'چیدمان‌های فرم',
      body: [
        demoItem('فرم افقی', `<div class="form-grid form-grid--wide"><div><label class="form-label" for="h-1">کد</label><input class="form-control" id="h-1" type="text"></div><div><label class="form-label" for="h-2">عنوان</label><input class="form-control" id="h-2" type="text"></div><div class="span-full form-actions"><button class="btn btn-primary" type="button">ثبت</button></div></div>`),
        demoItem('فرم درون‌خطی', `<form class="demo-row" data-validate novalidate><input class="form-control" type="email" data-rule="email" placeholder="ایمیل برای خبرنامه" style="max-width:16rem"><button class="btn btn-primary" type="submit">عضویت</button></form>`),
        demoItem('گروه ورودی', `<div class="input-group"><span class="input-group__addon">IRR</span><input class="form-control" type="text" value="۱۲٬۵۰۰٬۰۰۰"><span class="input-group__addon">ریال</span></div>`),
        demoItem('فرم جستجو', `<form class="input-group"><input class="form-control" type="search" placeholder="جستجوی سریع…"><button class="btn btn-primary" type="submit"><i class="bi bi-search"></i></button></form>`),
      ],
    }),
    demoSection({
      title: 'بازخورد فرم',
      subtitle: 'خلاصه خطاها، پیام موفقیت و فرم غیرفعال',
      body: [
        demoItem('خلاصه خطا', `<div class="alert alert--danger"><span class="alert__icon"><i class="bi bi-exclamation-octagon"></i></span><div class="alert__body"><p class="alert__title">۲ خطا نیاز به اصلاح دارد</p><p class="mb-0">ایمیل تکراری است و شماره موبایل نامعتبر است.</p></div></div>`),
        demoItem('موفقیت', `<div class="alert alert--success"><span class="alert__icon"><i class="bi bi-check2-circle"></i></span><div class="alert__body"><p class="alert__title">ذخیره شد</p><p class="mb-0">تغییرات با موفقیت ثبت شد.</p></div></div>`),
        demoItem('فرم غیرفعال', `<fieldset disabled><div class="form-grid"><div><label class="form-label" for="dis-1">فیلد قفل‌شده</label><input class="form-control" id="dis-1" type="text" value="غیرقابل ویرایش"></div><div><label class="form-label" for="dis-2">انتخاب قفل‌شده</label><select class="form-select" id="dis-2"><option>گزینه</option></select></div></div></fieldset>`),
      ],
    }),
  ];
  return { title: 'فرم‌ها', subtitle: 'اعتبارسنجی، چیدمان‌ها و حالت‌های کامل فرم', icon: 'ui-radios', sections };
}

/* ==================================================================== tables */

function buildTables() {
  const sections = [
    [
      card({
        title: 'جدول داده با جستجو، مرتب‌سازی و صفحه‌بندی',
        subtitle: 'همان کامپوننت DataTable که در فهرست‌های مدیریتی استفاده می‌شود',
        flush: true,
        body: `<div class="table-wrap" data-datatable data-resource="users" data-per-page="5">
            <div class="datatable__toolbar" data-datatable-toolbar></div>
            <table class="table table--hover"><thead><tr>
              <th data-column="name" data-type="primary" data-avatar="avatar" data-sub="email" data-sortable>کاربر</th>
              <th data-column="roleLabel" data-type="text" data-sortable>نقش</th>
              <th data-column="team" data-type="text">تیم</th>
              <th data-column="status" data-type="status" data-labels='{"active":"فعال","invited":"دعوت‌شده","suspended":"مسدود"}'>وضعیت</th>
              <th data-column="lastActive" data-type="date" data-sortable>آخرین فعالیت</th>
              <th data-column="progress" data-type="progress" data-align="end">پیشرفت</th>
            </tr></thead><tbody data-datatable-body></tbody></table>
            <div class="datatable__foot" data-datatable-foot></div>
          </div>`,
      }),
    ],
    demoSection({
      title: 'گونه‌های جدول',
      body: [
        demoItem('ساده', `<div class="table-responsive"><table class="table"><thead><tr><th>نام</th><th>مقدار</th></tr></thead><tbody><tr><td>سفارش</td><td class="numeric">۱٬۲۴۰</td></tr><tr><td>بازگشتی</td><td class="numeric">۸۸</td></tr></tbody></table></div>`),
        demoItem('خط‌دار', `<div class="table-responsive"><table class="table table--striped"><thead><tr><th>#</th><th>مشتری</th><th>مبلغ</th></tr></thead><tbody><tr><td>۱</td><td>سارا محمدی</td><td class="numeric">۴۸٬۰۰۰٬۰۰۰</td></tr><tr><td>۲</td><td>علی رضایی</td><td class="numeric">۲۱٬۵۰۰٬۰۰۰</td></tr></tbody></table></div>`),
        demoItem('فشرده', `<div class="table-responsive"><table class="table table--sm table--hover"><tbody><tr><td>تسک طراحی</td><td>${statusBadge('انجام‌شده', 'success')}</td></tr><tr><td>تسک بک‌اند</td><td>${statusBadge('در جریان', 'info')}</td></tr></tbody></table></div>`),
        demoItem('ستون‌های عددی و وضعیت', `<div class="table-responsive"><table class="table table--hover"><thead><tr><th>پروژه</th><th class="text-end">پیشرفت</th><th>وضعیت</th></tr></thead><tbody><tr><td>مهاجرت ابری</td><td class="text-end numeric">${formatPercent(72, { decimals: 0 })}</td><td>${statusBadge('در جریان', 'info')}</td></tr><tr><td>بازطراحی سایت</td><td class="text-end numeric">${formatPercent(94, { decimals: 0 })}</td><td>${statusBadge('نزدیک پایان', 'warning')}</td></tr></tbody></table></div>`),
      ],
      wide: true,
    }),
    demoSection({
      title: 'کارت و اطراف جدول',
      body: [
        demoItem('جدول داخل کارت', card({ title: 'فاکتورهای اخیر', flush: true, body: `<table class="table table--hover"><tbody><tr><td>INV-۱۰۲۴</td><td class="numeric">${formatCurrency(48500000, 'IRR', { compact: true })}</td><td>${statusBadge('پرداخت‌شده', 'success')}</td></tr><tr><td>INV-۱۰۲۵</td><td class="numeric">${formatCurrency(12250000, 'IRR', { compact: true })}</td><td>${statusBadge('در انتظار', 'warning')}</td></tr></tbody></table>`, foot: '<a class="btn btn-light btn-sm" href="#">همه فاکتورها</a>' })),
        demoItem('حالت خالی', emptyState({ title: 'موردی ثبت نشده', text: 'اولین رکورد خود را اضافه کنید.', icon: 'inbox', action: '<button class="btn btn-primary btn-sm" type="button">افزودن مورد</button>' })),
        demoItem('حالت بارگذاری', `<div class="table-responsive"><table class="table"><tbody>${skeleton(4)}</tbody></table></div>`),
      ],
    }),
  ];
  return { title: 'جدول‌ها', subtitle: 'جدول داده کامل، گونه‌ها و حالت‌های خالی و بارگذاری', icon: 'table', sections };
}

/* ==================================================================== charts */

async function buildCharts() {
  const [revenue, traffic] = await Promise.all([
    services.analyticsService.revenue({ range: '12m' }),
    services.analyticsService.traffic({ range: '30d' }),
  ]);
  const series = revenue.series.map((item) => ({ name: item.label, data: item.data }));
  const sections = [
    demoSection({
      title: 'نمودارهای خطی و ستونی',
      subtitle: 'داده از سرویس تحلیلها؛ محورها، راهنما و تولتیپ خودکار RTL می‌شوند',
      wide: true,
      body: [
        demoItem('ناحیه‌ای', chartBox({ type: 'area', height: 260, series, labels: revenue.labels })),
        demoItem('ستونی', chartBox({ type: 'column', height: 260, series: [series[0]], labels: revenue.labels })),
        demoItem('خطی', chartBox({ type: 'line', height: 260, series, labels: revenue.labels })),
        demoItem('میله‌ای افقی', chartBox({ type: 'bar', height: 260, series: [{ name: 'سفارش', data: traffic.visits.slice(0, 6) }], labels: traffic.labels.slice(0, 6) })),
      ],
    }),
    demoSection({
      title: 'نمودارهای دایره‌ای و مقایسه‌ای',
      wide: true,
      body: [
        demoItem('دوناتی', chartBox({ type: 'donut', height: 260, series: [44, 32, 18, 6], labels: ['فروشگاه', 'CRM', 'مالی', 'پشتیبانی'] })),
        demoItem('دایره‌ای', chartBox({ type: 'pie', height: 260, series: [38, 27, 20, 15], labels: ['موبایل', 'دسکتاپ', 'تبلت', 'سایر'] })),
        demoItem('راداری', chartBox({ type: 'radar', height: 260, series: [{ name: 'امتیاز', data: [82, 68, 74, 91, 63] }], labels: ['سرعت', 'دقت', 'پشتیبانی', 'قیمت', 'طراحی'] })),
        demoItem('حلقه‌ای', chartBox({ type: 'radialBar', height: 260, series: [72, 54, 36], labels: ['فروش', 'پشتیبانی', 'مالی'] })),
      ],
    }),
    demoSection({
      title: 'Sparkline در کارت‌های شاخص',
      body: [
        demoItem('کارت با نمودار کوچک', statCard({ label: 'درآمد ماه', value: formatCurrency(revenue.total, 'IRR', { compact: true }), meta: 'در مقایسه با ماه قبل', trend: revenue.growth, icon: 'graph-up-arrow', tone: 'success', spark: revenue.series[0].data.slice(-10) })),
        demoItem('کارت منفی', statCard({ label: 'نرخ ریزش', value: formatPercent(2.4, { decimals: 1 }), meta: 'کاهش ۰٫۶ واحد', trend: -0.6, icon: 'arrow-down-right-circle', tone: 'danger', spark: [18, 16, 17, 14, 15, 12, 11, 9] })),
      ],
    }),
  ];
  return { title: 'نمودارها', subtitle: 'همه انواع نمودار با توکن‌های طراحی و پشتیبانی کامل RTL', icon: 'bar-chart-line', sections, after: (node) => initCharts(node) };
}

/* ===================================================================== cards */

function buildCards() {
  const sections = [
    demoSection({
      title: 'ساختار کارت',
      body: [
        demoItem('کارت پایه', card({ body: '<p class="mb-0">کارت ساده با بدنه و بدون سرصفحه.</p>' })),
        demoItem('کارت با سرصفحه و اکشن', card({ title: 'گزارش فروش', subtitle: 'به‌روزرسانی امروز', icon: 'graph-up', actions: '<button class="icon-btn icon-btn--sm" type="button" aria-label="بیشتر"><i class="bi bi-three-dots"></i></button>', body: '<p class="mb-0">سرصفحه، زیرعنوان، آیکون و اکشن در یک ردیف.</p>' })),
        demoItem('کارت با پانویس', card({ title: 'پرداخت‌ها', body: '<p class="mb-0">بدنه کارت با پانویس عملیات.</p>', foot: '<button class="btn btn-primary btn-sm" type="button">پرداخت</button><button class="btn btn-light btn-sm" type="button">جزئیات</button>' })),
        demoItem('کارت فهرست', card({ title: 'آخرین تراکنش‌ها', flush: true, body: `<ul class="list-group"><li class="list-item"><span class="list-item__title">سارا محمدی<span class="list-item__sub">امروز • ۱۰:۲۴</span></span><span class="list-item__meta numeric">${formatCurrency(4200000, 'IRR', { compact: true })}</span></li><li class="list-item"><span class="list-item__title">علی رضایی<span class="list-item__sub">دیروز • ۱۶:۱۰</span></span><span class="list-item__meta numeric">${formatCurrency(1800000, 'IRR', { compact: true })}</span></li></ul>` })),
      ],
      wide: true,
    }),
    demoSection({
      title: 'کارت‌های شاخص و آماری',
      body: [
        demoItem('کارت شاخص', statCard({ label: 'کاربران فعال', value: toDigits(4820), meta: 'در ۳۰ روز گذشته', trend: 12.4, icon: 'people', tone: 'primary' })),
        demoItem('کارت شاخص دوم', statCard({ label: 'نرخ تبدیل', value: formatPercent(4.8, { decimals: 1 }), meta: 'هدف ۵٪', trend: 0.9, icon: 'funnel', tone: 'violet' })),
        demoItem('کارت وضعیت', `<div class="card"><div class="card__body"><div class="status-hero"><span class="status-hero__icon"><i class="bi bi-shield-check"></i></span><div><h3 class="status-hero__title">همه سرویس‌ها پایدار</h3><p class="status-hero__text">آخرین بررسی: ${toDigits(2)} دقیقه پیش</p></div></div></div></div>`),
        demoItem('کارت خالی', emptyState({ title: 'هنوز گزارشی نیست', text: 'پس از اولین فروش، گزارش اینجا ساخته می‌شود.', icon: 'bar-chart', action: '<button class="btn btn-soft-primary btn-sm" type="button">ساخت گزارش</button>' })),
      ],
    }),
  ];
  return { title: 'کارت‌ها', subtitle: 'کارت‌ها با سرصفحه، بدنه، پانویس، رسانه و حالت خالی', icon: 'card-text', sections };
}

/* ==================================================================== badges */

function buildBadges() {
  const tones = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral', 'violet'];
  const sections = [
    demoSection({
      title: 'نشان‌ها',
      body: [
        demoItem('نرم', row(tones.map((tone) => `<span class="badge badge--soft-${tone}">${tone}</span>`).join(''))),
        demoItem('تو‌پر', row(tones.slice(0, 5).map((tone) => `<span class="badge badge--solid-${tone}">${tone}</span>`).join(''))),
        demoItem('خطی', row(tones.slice(0, 5).map((tone) => `<span class="badge badge--outline">${tone}</span>`).join(''))),
        demoItem('اندازه‌ها', row('<span class="badge badge--soft-primary badge--lg">بزرگ</span><span class="badge badge--soft-primary">متوسط</span><span class="badge badge--soft-primary badge--pill">قرصی</span>')),
      ],
      wide: true,
    }),
    demoSection({
      title: 'وضعیت‌ها با نقطه رنگی',
      body: [
        demoItem('فهرست وضعیت', `<ul class="badge-dot-list"><li><span class="status-dot status-dot--success"></span>فعال</li><li><span class="status-dot status-dot--warning"></span>در انتظار تأیید</li><li><span class="status-dot status-dot--danger"></span>مسدود</li><li><span class="status-dot status-dot--neutral"></span>آرشیو</li></ul>`),
        demoItem('ترکیب با آیکون', row('<span class="badge badge--soft-success"><i class="bi bi-check2"></i> تأییدشده</span><span class="badge badge--soft-danger"><i class="bi bi-x-lg"></i> رد‌شده</span><span class="badge badge--soft-info"><i class="bi bi-clock"></i> در انتظار</span>')),
        demoItem('شمارنده روی آیکون', `<button class="icon-btn" type="button" aria-label="اعلان‌ها"><i class="bi bi-bell"></i><span class="badge badge--solid-danger badge--pill">${toDigits(7)}</span></button>`),
      ],
    }),
    demoSection({
      title: 'بَرچسب‌ها و فیلترها',
      body: [
        demoItem('برچسب قابل حذف', row('<span class="chip">طراحی<button class="chip__remove" type="button" aria-label="حذف"><i class="bi bi-x"></i></button></span><span class="chip">بک‌اند<button class="chip__remove" type="button" aria-label="حذف"><i class="bi bi-x"></i></button></span>')),
        demoItem('برچسب فیلتر', row(['همه', 'فعال', 'بایگانی'].map((label, index) => `<span class="chip chip--filter${index === 0 ? ' is-active' : ''}" role="button">${label}</span>`).join(''))),
      ],
    }),
  ];
  return { title: 'نشان‌ها', subtitle: 'نشان‌ها، وضعیت‌ها، شمارنده‌ها و برچسب‌ها', icon: 'patch-check', sections };
}

/* ==================================================================== alerts */

function buildAlerts() {
  const sections = [
    demoSection({
      title: 'پیام‌های سیستمی',
      subtitle: 'هشت تُن رنگی با آیکون، عنوان و بدنه',
      wide: true,
      body: ['info', 'success', 'warning', 'danger'].map((tone) =>
        demoItem(
          tone,
          `<div class="alert alert--${tone}"><span class="alert__icon"><i class="bi bi-${tone === 'danger' ? 'exclamation-octagon' : tone === 'warning' ? 'exclamation-triangle' : tone === 'success' ? 'check2-circle' : 'info-circle'}"></i></span><div class="alert__body"><p class="alert__title">${tone === 'info' ? 'اطلاع‌رسانی' : tone === 'success' ? 'عملیات موفق' : tone === 'warning' ? 'نیازمند بررسی' : 'خطای جدی'}</p><p class="mb-0">متن نمونه برای نمایش این تُن رنگی در کنار آیکون و عنوان.</p></div></div>`,
        ),
      ),
    }),
    demoSection({
      title: 'پیام‌های قابل بستن و دارای اکشن',
      body: [
        demoItem('قابل بستن', `<div class="alert alert--info" data-alert><span class="alert__icon"><i class="bi bi-info-circle"></i></span><div class="alert__body"><p class="alert__title">به‌روزرسانی موجود است</p><p class="mb-0">نسخه ۱٫۱ آماده نصب است.</p></div><button class="alert__close" type="button" data-alert-close aria-label="بستن"><i class="bi bi-x-lg"></i></button></div>`),
        demoItem('با دکمه‌های عملیات', `<div class="alert alert--warning"><span class="alert__icon"><i class="bi bi-exclamation-triangle"></i></span><div class="alert__body"><p class="alert__title">اشتراک رو به اتمام است</p><p class="mb-2">۳ روز تا پایان دوره باقی مانده است.</p><button class="btn btn-warning btn-sm" type="button">تمدید اشتراک</button></div></div>`),
        demoItem('اطلاعیه خالی از رنگ', `<div class="alert alert--neutral"><span class="alert__icon"><i class="bi bi-pin-angle"></i></span><div class="alert__body"><p class="mb-0">این یک یادداشت بدون وضعیت خاص است.</p></div></div>`),
      ],
    }),
  ];
  return { title: 'پیام‌ها', subtitle: 'هشدارها، اطلاعیه‌ها و پیام‌های سیستمی', icon: 'exclamation-triangle', sections };
}

/* ==================================================================== toasts */

function buildToasts() {
  const labels = {
    'bottom-end': 'پایین راست (پیش‌فرض RTL)',
    'bottom-start': 'پایین چپ',
    'top-end': 'بالا راست',
    'top-start': 'بالا چپ',
    'top-center': 'بالای وسط',
    'bottom-center': 'پایین وسط',
  };
  const sections = [
    demoSection({
      title: 'اعلان‌های شش‌موقعیتی',
      subtitle: 'دکمه‌ها واقعاً اعلان می‌سازند؛ موقعیت‌ها با RTL/LTR جابه‌جا می‌شوند',
      wide: true,
      body: TOAST_POSITIONS.map((position) =>
        demoItem(
          labels[position] ?? position,
          `<button class="btn btn-light" type="button" data-demo-toast="${position}"><i class="bi bi-bell"></i> نمایش در ${escapeHtml(labels[position] ?? position)}</button>`,
          position,
        ),
      ),
    }),
    demoSection({
      title: 'انواع اعلان',
      body: ['success', 'info', 'warning', 'danger'].map((type) =>
        demoItem(
          type,
          `<button class="btn btn-soft-${type}" type="button" data-demo-toast-type="${type}">اعلان ${type}</button>`,
        ),
      ),
    }),
    demoSection({
      title: 'اعلان با اکشن و بدون بستن',
      body: [
        demoItem('با دکمه اکشن', `<button class="btn btn-primary" type="button" data-demo-toast-action>نمایش اعلان با اکشن</button>`),
        demoItem('ماندگار', `<button class="btn btn-dark" type="button" data-demo-toast-sticky>اعلان ماندگار</button>`),
      ],
    }),
  ];
  return { title: 'اعلان‌ها', subtitle: 'اعلان‌های شش‌موقعیتی سازگار با RTL', icon: 'bell', sections };
}

/* ==================================================================== modals */

function buildModals() {
  const sections = [
    demoSection({
      title: 'پنجره‌های گفتگو',
      subtitle: 'اندازه‌ها، محتوای غنی و پانویس عملیات — با فوکوس‌تراپ و بسته‌شدن با Esc',
      wide: true,
      body: [
        demoItem('کوچک', `<button class="btn btn-light" type="button" data-demo-modal="sm">پنجره کوچک</button>`),
        demoItem('متوسط', `<button class="btn btn-light" type="button" data-demo-modal="md">پنجره متوسط</button>`),
        demoItem('بزرگ', `<button class="btn btn-light" type="button" data-demo-modal="lg">پنجره بزرگ</button>`),
        demoItem('تمام‌صفحه', `<button class="btn btn-light" type="button" data-demo-modal="full">پنجره تمام‌صفحه</button>`),
        demoItem('فرم داخل پنجره', `<button class="btn btn-primary" type="button" data-demo-modal-form>فرم افزودن کاربر</button>`),
        demoItem('تأیید حذف', `<button class="btn btn-danger" type="button" data-demo-confirm>حذف با تأیید</button>`),
      ],
    }),
    demoSection({
      title: 'کشو و پنجره اطلاعات',
      body: [
        demoItem(
          'کشو کناری',
          `<button class="btn btn-light" type="button" data-drawer-open="#demo-drawer">باز کردن کشو</button>
           <div id="demo-drawer" hidden data-title="جزئیات سفارش" data-side="end">${infoRows([
             ['شماره', 'ORD-۱۰۲۴'],
             ['مشتری', 'سارا محمدی'],
             ['مبلغ', formatCurrency(48500000, 'IRR')],
             ['وضعیت', statusBadge('در حال ارسال', 'info')],
             ['تاریخ', formatDate(new Date(), { format: 'long' })],
           ])}</div>`,
        ),
        demoItem('پنجره اطلاعات', `<button class="btn btn-light" type="button" data-demo-modal-info>نمایش جزئیات</button>`),
      ],
    }),
  ];
  return { title: 'پنجره‌ها', subtitle: 'پنجره‌ها، تأییدها و کشوها', icon: 'window-stack', sections };
}

/* ================================================================= dropdowns */

function buildDropdowns() {
  const sections = [
    demoSection({
      title: 'منوهای کشویی',
      body: [
        demoItem('پایه', `<div class="dropdown"><button class="btn btn-light" type="button" data-dropdown-toggle aria-expanded="false">عملیات <i class="bi bi-chevron-down"></i></button><ul class="dropdown-menu" data-dropdown-menu><li><button class="dropdown-item" type="button"><i class="bi bi-pencil"></i> ویرایش</button></li><li><button class="dropdown-item" type="button"><i class="bi bi-files"></i> کپی</button></li><li><hr class="dropdown-divider"></li><li><button class="dropdown-item text-danger" type="button"><i class="bi bi-trash"></i> حذف</button></li></ul></div>`),
        demoItem('راست‌چین', `<div class="dropdown"><button class="btn btn-primary" type="button" data-dropdown-toggle aria-expanded="false">فیلترها <i class="bi bi-funnel"></i></button><ul class="dropdown-menu dropdown-menu-end" data-dropdown-menu><li><span class="dropdown-header">وضعیت</span></li><li><label class="dropdown-item"><input class="form-check-input" type="checkbox" checked> فعال</label></li><li><label class="dropdown-item"><input class="form-check-input" type="checkbox"> غیرفعال</label></li></ul></div>`),
        demoItem('دکمه تقسیم‌شده', `<div class="btn-group"><button class="btn btn-primary" type="button">ذخیره</button><button class="btn btn-primary dropdown-toggle" type="button" data-dropdown-toggle aria-expanded="false"><i class="bi bi-chevron-down"></i></button><ul class="dropdown-menu dropdown-menu-end" data-dropdown-menu><li><button class="dropdown-item" type="button">ذخیره و بستن</button></li><li><button class="dropdown-item" type="button">ذخیره به‌عنوان پیش‌نویس</button></li></ul></div>`),
        demoItem('منوی کاربر', `<div class="dropdown"><button class="btn btn-light" type="button" data-dropdown-toggle aria-expanded="false"><img class="avatar avatar--xs" src="assets/img/avatars/avatar-02.svg" alt=""> سارا محمدی <i class="bi bi-chevron-down"></i></button><ul class="dropdown-menu" data-dropdown-menu><li><button class="dropdown-item" type="button"><i class="bi bi-person"></i> پروفایل</button></li><li><button class="dropdown-item" type="button"><i class="bi bi-gear"></i> تنظیمات</button></li><li><hr class="dropdown-divider"></li><li><button class="dropdown-item text-danger" type="button"><i class="bi bi-box-arrow-right"></i> خروج</button></li></ul></div>`),
      ],
    }),
    demoSection({
      title: 'منوی زمینه و راهنمای تعاملی',
      body: [
        demoItem('منوی زمینه (راست‌کلیک)', `<div class="demo-box demo-box--tall" data-context-menu>برای دیدن منوی زمینه راست‌کلیک کنید<div class="dropdown"><ul class="dropdown-menu" data-dropdown-menu><li><button class="dropdown-item" type="button">باز کردن</button></li><li><button class="dropdown-item" type="button">تغییر نام</button></li></ul></div></div>`),
        demoItem('انتخاب‌گر با جستجو', `<div class="dropdown"><button class="btn btn-light w-100" type="button" data-dropdown-toggle aria-expanded="false"><i class="bi bi-search"></i> جستجو و انتخاب</button><ul class="dropdown-menu w-100" data-dropdown-menu><li><input class="form-control form-control--sm" type="search" placeholder="جستجو…"></li><li><button class="dropdown-item" type="button">تهران</button></li><li><button class="dropdown-item" type="button">اصفهان</button></li><li><button class="dropdown-item" type="button">شیراز</button></li></ul></div>`),
      ],
    }),
  ];
  return { title: 'منوهای کشویی', subtitle: 'منوهای کشویی، دکمه تقسیم‌شده و منوی زمینه', icon: 'chevron-down', sections };
}

/* ====================================================================== tabs */

function buildTabs() {
  const panes = [
    { id: 'overview', label: 'نمای کلی', icon: 'speedometer2', body: '<p class="mb-0">تب اول با محتوای خلاصه.</p>' },
    { id: 'details', label: 'جزئیات', icon: 'list-ul', badge: 12, body: '<p class="mb-0">تب دوم با نشان عددی روی عنوان.</p>' },
    { id: 'activity', label: 'فعالیت‌ها', icon: 'activity', body: '<p class="mb-0">تب سوم برای تاریخچه و رویدادها.</p>' },
  ];
  const sections = [
    demoSection({
      title: 'تب‌ها',
      body: [
        demoItem('تب کلاسیک', tabs(panes, { id: 'demo-tabs' })),
        demoItem('تب قرصی', tabs(panes, { id: 'demo-tabs-pills', pills: true })),
      ],
    }),
    demoSection({
      title: 'آکاردئون',
      body: [
        demoItem('تک‌بازشو', `<div class="faq-list" data-accordion>${[
          ['چطور رنگ اصلی را تغییر دهم؟', 'از تنظیمات ظاهر یا متغیر --nv-primary استفاده کنید.'],
          ['آیا صفحات مستقل هستند؟', 'بله؛ هر صفحه یک HTML جداگانه با کنترلر خودش است.'],
        ].map(([q, a], index) => `<div class="accordion-item"><button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-accordion-toggle aria-expanded="${index === 0}">${q}<i class="bi bi-chevron-down"></i></button><div class="accordion-body" data-accordion-body ${index === 0 ? '' : 'hidden'}><p class="mb-0">${a}</p></div></div>`).join('')}</div>`),
        demoItem('چند‌بازشو', `<div class="faq-list" data-accordion="multi">${[
          ['پشتیبانی RTL چطور کار می‌کند؟', 'با منطق logical properties و توکن جهت؛ کل چیدمان خودکار آینه می‌شود.'],
          ['چه مرورگرهایی پشتیبانی می‌شوند؟', 'همه مرورگرهای مدرن با پشتیبانی ES2022.'],
        ].map(([q, a]) => `<div class="accordion-item"><button class="accordion-button collapsed" type="button" data-accordion-toggle aria-expanded="false">${q}<i class="bi bi-chevron-down"></i></button><div class="accordion-body" data-accordion-body hidden><p class="mb-0">${a}</p></div></div>`).join('')}</div>`),
      ],
    }),
    demoSection({
      title: 'جابه‌جایی نما',
      body: [
        demoItem('شبکه / فهرست', `<div data-view-switch><div class="demo-row"><button class="btn btn-light btn-sm is-active" type="button" data-view="grid"><i class="bi bi-grid"></i> شبکه</button><button class="btn btn-light btn-sm" type="button" data-view="list"><i class="bi bi-list-ul"></i> فهرست</button></div><div data-view-grid><div class="grid grid--3 mt-3">${[1, 2, 3].map((i) => `<div class="demo-box">کارت ${toDigits(i)}</div>`).join('')}</div></div><div data-view-list hidden><ul class="list-group mt-3"><li class="list-item">ردیف یک</li><li class="list-item">ردیف دو</li></ul></div></div>`),
      ],
    }),
  ];
  return { title: 'تب‌ها و آکاردئون', subtitle: 'تب‌ها، قرص‌ها، آکاردئون و جابه‌جایی نما', icon: 'layout-text-window-reverse', sections };
}

/* ================================================================== tooltips */

function buildTooltips() {
  const placements = ['top', 'bottom', 'start', 'end'];
  const sections = [
    demoSection({
      title: 'راهنمای ابزار',
      subtitle: 'چهار جهت، همه با کلید `data-tooltip` و پشتیبانی صفحه‌کلید',
      body: placements.map((placement) =>
        demoItem(
          placement,
          `<button class="btn btn-light" type="button" data-tooltip="راهنمای ${placement}" data-tooltip-placement="${placement}"><i class="bi bi-info-circle"></i> راهنما</button>`,
        ),
      ),
    }),
    demoSection({
      title: 'روی آیکون‌ها و متن',
      body: [
        demoItem('آیکون‌ها', row(['pencil', 'trash', 'arrow-repeat', 'download'].map((icon) => `<button class="icon-btn" type="button" data-tooltip="${icon}" aria-label="${icon}"><i class="bi bi-${icon}"></i></button>`).join(''))),
        demoItem('متن راهنما', `<p class="mb-0">مبلغ <span class="text-decoration-underline" data-tooltip="شامل مالیات بر ارزش افزوده">با احتساب مالیات</span> محاسبه شده است.</p>`),
      ],
    }),
  ];
  return { title: 'راهنمای ابزار', subtitle: 'راهنماها و پاپ‌اورها در چهار جهت', icon: 'chat-square-quote', sections };
}

/* ================================================================== timeline */

async function buildTimeline() {
  const activity = await services.activityService.list({ perPage: 6 });
  const items = (activity.items ?? []).map((item) => ({ title: item.title ?? item.action, text: item.text ?? item.description, time: item.at ?? item.createdAt, icon: item.icon, tone: item.tone }));
  const sections = [
    demoSection({
      title: 'خط زمانی زنده',
      subtitle: 'داده از سرویس فعالیت‌ها؛ زمان‌ها با فاصله انسانی فارسی و تقویم شمسی',
      wide: true,
      body: demoItem('فعالیت‌های اخیر', timeline(items.length ? items : [{ title: 'رویداد نمونه', text: 'توضیح رویداد', time: new Date().toISOString(), icon: 'dot', tone: 'primary' }])),
    }),
    demoSection({
      title: 'گونه‌های خط زمانی',
      body: [
        demoItem('فشرده', timeline([{ title: 'ایجاد پروژه', time: new Date(Date.now() - 3600000).toISOString(), icon: 'plus', tone: 'success' }, { title: 'ویرایش تسک', time: new Date(Date.now() - 7200000).toISOString(), icon: 'pencil', tone: 'info' }], { compact: true })),
        demoItem('با فیلتر', `<div data-timeline-scope="#demo-feed"><div class="demo-row"><button class="btn btn-light btn-sm is-active" type="button" data-timeline-filter="all">همه</button><button class="btn btn-light btn-sm" type="button" data-timeline-filter="task">تسک‌ها</button><button class="btn btn-light btn-sm" type="button" data-timeline-filter="file">فایل‌ها</button></div><div id="demo-feed">${timeline([{ title: 'تسک جدید', text: 'فیلتر task', time: new Date().toISOString(), icon: 'check2', tone: 'primary', type: 'task' }, { title: 'فایل بارگذاری شد', text: 'فیلتر file', time: new Date(Date.now() - 5400000).toISOString(), icon: 'paperclip', tone: 'info', type: 'file' }])}</div></div>`),
        demoItem('با آواتار', `<ul class="timeline">${[1, 2].map((i) => `<li class="timeline__item"><span class="timeline__marker timeline__marker--primary"><img class="avatar avatar--xs" src="assets/img/avatars/avatar-0${i}.svg" alt=""></span><div class="timeline__content"><p class="timeline__title">کاربر ${toDigits(i)} وضعیت را تغییر داد</p><p class="timeline__text">${toDigits(3)} دقیقه پیش</p></div></li>`).join('')}</ul>`),
      ],
    }),
  ];
  return { title: 'خط زمانی', subtitle: 'خط زمانی و فید فعالیت با فیلتر و آواتار', icon: 'clock-history', sections };
}

/* ================================================================== progress */

function buildProgress() {
  const tones = ['primary', 'success', 'warning', 'danger', 'info'];
  const sections = [
    demoSection({
      title: 'نوار پیشرفت',
      body: [
        demoItem('پایه', `<div class="progress"><div class="progress-bar" style="width:64%"></div></div>`),
        demoItem('با برچسب', `<div class="progress"><div class="progress-bar" style="width:78%">${formatPercent(78, { decimals: 0 })}</div></div>`),
        demoItem('نازک', `<div class="progress progress--sm"><div class="progress-bar" style="width:42%"></div></div>`),
        demoItem('راه‌راه', `<div class="progress"><div class="progress-bar progress-bar--striped" style="width:56%"></div></div>`),
        demoItem('بی‌نهایت', `<div class="progress"><div class="progress-bar progress-bar--indeterminate" style="width:100%"></div></div>`),
        demoItem('چندبخشی', `<div class="progress">${[['32', 'primary'], ['24', 'success'], ['18', 'warning']].map(([w, tone]) => `<div class="progress-bar progress-bar--${tone}" style="width:${w}%"></div>`).join('')}</div>`),
      ],
      wide: true,
    }),
    demoSection({
      title: 'حلقه‌ها و سنجه‌ها',
      body: [
        ...tones.slice(0, 3).map((tone, index) => {
          const value = [68, 45, 92][index];
          return demoItem(
            `حلقه ${tone}`,
            `<div class="gauge" style="--nv-gauge-color:var(--nv-${tone})">
              <svg viewBox="0 0 36 36" role="img" aria-label="${tone}">
                <circle class="gauge__track" cx="18" cy="18" r="15.9"></circle>
                <circle class="gauge__value" cx="18" cy="18" r="15.9" stroke-dasharray="${value} 100"></circle>
              </svg>
              <span class="gauge__label"><span class="gauge__number">${formatPercent(value, { decimals: 0 })}</span><span class="gauge__caption">${tone}</span></span>
            </div>`,
          );
        }),
      ],
    }),
    demoSection({
      title: 'گام‌ها و اهداف',
      body: [
        demoItem('پیشرفت هدف', `<div class="mb-3"><div class="d-flex justify-content-between mb-2"><span class="fs-caption">درآمد فصل</span><strong class="numeric">${formatCurrency(740000000, 'IRR', { compact: true })}</strong></div><div class="progress progress--sm"><div class="progress-bar" style="width:74%"></div></div></div><div><div class="d-flex justify-content-between mb-2"><span class="fs-caption">مشتریان جدید</span><strong class="numeric">${toDigits(148)}</strong></div><div class="progress progress--sm"><div class="progress-bar progress-bar--success" style="width:52%"></div></div></div>`),
        demoItem('مقایسه شاخص‌ها', `<div class="demo-token-list">${[['دقت پیش‌بینی', 88], ['رضایت مشتری', 94], ['سرعت پاسخ', 71]].map(([label, value]) => `<div class="demo-token"><span>${label}</span><span class="ms-auto numeric">${formatPercent(value, { decimals: 0 })}</span></div><div class="progress progress--sm"><div class="progress-bar" style="width:${value}%"></div></div>`).join('')}</div>`),
      ],
    }),
  ];
  return { title: 'پیشرفت', subtitle: 'نوارها، حلقه‌ها و سنجه‌های پیشرفت', icon: 'speedometer2', sections };
}

/* =================================================================== avatars */

function buildAvatars() {
  const sections = [
    demoSection({
      title: 'اندازه‌ها',
      body: [
        demoItem('تصویری', row(['xs', 'sm', '', 'lg', 'xl'].map((size) => `<img class="avatar${size ? ` avatar--${size}` : ''}" src="assets/img/avatars/avatar-03.svg" alt="کاربر">`).join(''))),
        demoItem('حرف اول', row(['xs', 'sm', '', 'lg'].map((size) => `<span class="avatar avatar--${size || 'md'} avatar--soft-primary">س</span>`).join(''))),
        demoItem('وضعیت', row(`<span class="avatar"><img src="assets/img/avatars/avatar-04.svg" alt="کاربر"><span class="status-dot status-dot--success avatar__status"></span></span><span class="avatar"><img src="assets/img/avatars/avatar-05.svg" alt="کاربر"><span class="status-dot status-dot--warning avatar__status"></span></span>`)),
        demoItem('گروه', `<div class="avatar-group">${[1, 2, 3, 4].map((i) => `<img class="avatar" src="assets/img/avatars/avatar-0${i}.svg" alt="کاربر ${toDigits(i)}">`).join('')}<span class="avatar avatar--soft-neutral">+${toDigits(8)}</span></div>`),
      ],
      wide: true,
    }),
    demoSection({
      title: 'ترکیب با متن',
      body: [
        demoItem('فهرست کاربران', `<ul class="list-group">${[1, 2, 3].map((i) => `<li class="list-item"><span class="table__primary"><img class="avatar avatar--sm" src="assets/img/avatars/avatar-0${i}.svg" alt=""><span class="table__primary-text"><span class="table__primary-title">کاربر نمونه ${toDigits(i)}</span><span class="table__primary-sub">نقش: کارشناس</span></span></span><span class="list-item__meta">${statusBadge('فعال', 'success')}</span></li>`).join('')}</ul>`),
      ],
    }),
  ];
  return { title: 'آواتارها', subtitle: 'آواتارها، گروه‌ها و نشانگر وضعیت', icon: 'person-circle', sections };
}

/* ================================================================ typography */

function buildTypography() {
  const scale = [
    ['display', '--nv-text-display', 'نمایشی — تیتر اصلی صفحه'],
    ['h1', '--nv-text-h1', 'سرتیتر سطح یک'],
    ['h2', '--nv-text-h2', 'سرتیتر سطح دو'],
    ['h3', '--nv-text-h3', 'سرتیتر سطح سه'],
    ['h4', '--nv-text-h4', 'سرتیتر کارت'],
    ['body', '--nv-text-body', 'متن اصلی رابط کاربری'],
    ['body-sm', '--nv-text-body-sm', 'متن کمکی'],
    ['caption', '--nv-text-caption', 'برچسب و فراداده'],
    ['micro', '--nv-text-micro', 'ریزترین اندازه'],
  ];
  const sections = [
    demoSection({
      title: 'مقیاس تایپوگرافی',
      subtitle: 'فونت وزیرمتن با اعداد فارسی؛ اندازه‌ها از توکن‌های CSS می‌آیند و در تنظیمات ظاهر قابل تغییرند',
      wide: true,
      body: scale.map(([name, token, sample]) => `<div class="demo-type-row"><span class="demo-type-row__sample" style="font-size:var(${token})">${sample}</span><span class="demo-type-row__meta">${name} · ${token}</span></div>`).join(''),
    }),
    demoSection({
      title: 'متن و فهرست',
      body: [
        demoItem('پاراگراف', `<p>این پاراگراف نمونه با فاصله خطوط متعادل نمایش داده می‌شود؛ ارتفاع خط و فاصله حروف برای متن فارسی تنظیم شده است تا خواندن متن‌های طولانی راحت باشد.</p><p class="mb-0 text-muted">متن کم‌رنگ برای توضیحات ثانویه.</p>`),
        demoItem('فهرست‌ها', `<ul><li>فهرست نقطه‌ای ساده</li><li>با آیتم دوم<ul><li>زیرفهرست</li></ul></li></ul><ol><li>فهرست شماره‌دار</li><li>آیتم دوم</li></ol>`),
        demoItem('نقل‌قول', `<blockquote>طراحی خوب دیده نمی‌شود؛ فقط کار می‌کند.<footer class="fs-caption text-muted">— ضرب‌المثلی در طراحی محصول</footer></blockquote>`),
        demoItem('کد و کلید', `<p>برای اجرای پروژه <code>npm run dev</code> را بزنید و سپس کلید <kbd>Ctrl</kbd> + <kbd>K</kbd> را امتحان کنید.</p><pre class="demo-code">npm install\nnpm run dev</pre>`),
      ],
    }),
    demoSection({
      title: 'اعداد، ارز و تاریخ',
      body: [
        demoItem('اعداد فارسی', `<p class="mb-1 numeric">${toDigits(1234567)}</p><p class="mb-0 fs-caption text-muted">جداکننده هزار و ارقام فارسی</p>`),
        demoItem('ارز', `<p class="mb-1 numeric">${formatCurrency(48500000, 'IRR')}</p><p class="mb-0 numeric fs-caption text-muted">${formatCurrency(12400, 'USD')}</p>`),
        demoItem('درصد و کسر', `<p class="mb-1 numeric">${formatPercent(37.4, { decimals: 1 })}</p><p class="mb-0 numeric fs-caption text-muted">${formatNumber(0.42, { decimals: 2 })}</p>`),
        demoItem('تاریخ شمسی و نسبی', `<p class="mb-1">${formatDate(new Date(), { format: 'long' })}</p><p class="mb-0 fs-caption text-muted">${relativeTime(new Date(Date.now() - 5400000).toISOString())}</p>`),
      ],
    }),
  ];
  return { title: 'تایپوگرافی', subtitle: 'مقیاس کامل تایپوگرافی، متن، فهرست و قالب‌بندی', icon: 'fonts', sections };
}

/* ====================================================================== grid */

function buildGrid() {
  const cell = (n) => `<div class="demo-box">${toDigits(n)} ستون</div>`;
  const sections = [
    demoSection({
      title: 'شبکه ۱۲ ستونی',
      subtitle: 'بر پایه شبکه Bootstrap 5 با فاصله‌های نووآد‌مین؛ در موبایل تک‌ستونی می‌شود',
      wide: true,
      body: [
        demoItem('ردیف کامل', `<div class="row g-2">${cell(12)}</div>`),
        demoItem('دو ستون مساوی', `<div class="row g-2"><div class="col-12 col-md-6">${cell(6)}</div><div class="col-12 col-md-6">${cell(6)}</div></div>`),
        demoItem('سه ستون', `<div class="row g-2"><div class="col-12 col-md-4">${cell(4)}</div><div class="col-12 col-md-4">${cell(4)}</div><div class="col-12 col-md-4">${cell(4)}</div></div>`),
        demoItem('چهار ستون', `<div class="row g-2"><div class="col-6 col-lg-3">${cell(3)}</div><div class="col-6 col-lg-3">${cell(3)}</div><div class="col-6 col-lg-3">${cell(3)}</div><div class="col-6 col-lg-3">${cell(3)}</div></div>`),
        demoItem('ستون نامساوی', `<div class="row g-2"><div class="col-12 col-lg-8">${cell(8)}</div><div class="col-12 col-lg-4">${cell(4)}</div></div>`),
        demoItem('با آفست', `<div class="row g-2"><div class="col-6 offset-3">${cell('6 + offset')}</div></div>`),
      ],
    }),
    demoSection({
      title: 'چیدمان‌های آماده قالب',
      body: [
        demoItem('کارت‌های شاخص', `<div class="kpi-row">${[1, 2, 3, 4].map((i) => statCard({ label: `شاخص ${toDigits(i)}`, value: toDigits(i * 120), meta: 'نمونه', icon: 'graph-up', tone: ['primary', 'success', 'warning', 'info'][i - 1] })).join('')}</div>`),
        demoItem('دو ستونی محتوا', `<div class="grid grid--2"><div class="demo-box demo-box--tall">ستون اصلی</div><div class="demo-box demo-box--tall">ستون کنار</div></div>`),
        demoItem('سه ستونی کارت', `<div class="grid grid--3">${[1, 2, 3].map((i) => `<div class="card"><div class="card__body">کارت ${toDigits(i)}</div></div>`).join('')}</div>`),
        demoItem('فاصله‌ها', `<div class="demo-token-list">${[['--nv-space-2', '۸px'], ['--nv-space-4', '۱۶px'], ['--nv-space-6', '۲۴px'], ['--nv-space-8', '۳۲px']].map(([token, px]) => `<div class="demo-token"><code>${token}</code><span class="demo-bar" style="width:${px}"></span><span>${px}</span></div>`).join('')}</div>`),
      ],
    }),
  ];
  return { title: 'شبکه و چیدمان', subtitle: 'سیستم شبکه ۱۲ ستونی و چیدمان‌های آماده', icon: 'grid-3x3-gap', sections };
}

/* ==================================================================== colors */

function buildColors() {
  const palette = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`--nv-chart-${n}`, `رنگ نمودار ${toDigits(n)}`]);
  const semantic = [
    ['--nv-primary', 'رنگ اصلی برند'],
    ['--nv-surface', 'سطح کارت'],
    ['--nv-surface-2', 'سطح دوم'],
    ['--nv-border', 'خط جداکننده'],
    ['--nv-success', 'موفق'],
    ['--nv-warning', 'هشدار'],
    ['--nv-danger', 'خطر'],
    ['--nv-info', 'اطلاعات'],
  ];
  const paletteLabels = { indigo: 'نیلی', blue: 'آبی', emerald: 'زمردی', violet: 'بنفش', orange: 'نارنجی', rose: 'سرخابی' };
  const sections = [
    demoSection({
      title: 'پالت فعال',
      subtitle: 'یک متغیر CSS، همه اجزا؛ با تغییر پالت از تنظیمات ظاهر، این صفحه هم عوض می‌شود',
      wide: true,
      body: `<div class="demo-swatch-grid">${semantic.map(([token, label]) => swatch(token, `var(${token})`, label)).join('')}</div>`,
    }),
    demoSection({
      title: 'رنگ‌های نمودار',
      wide: true,
      body: `<div class="demo-swatch-grid">${palette.map(([token, label]) => swatch(token, `var(${token})`, label)).join('')}</div>`,
    }),
    demoSection({
      title: 'پالت‌های اصلی آماده',
      subtitle: 'شش پالت قالب؛ با کلیک روی هر پالت، رنگ اصلی در کل صفحه تغییر می‌کند',
      body: `<div class="demo-row">${theme.PALETTES.map((id) => `<button class="btn btn-light" type="button" data-demo-primary="${id}">${escapeHtml(paletteLabels[id] ?? id)}</button>`).join('')}</div>`,
    }),
    demoSection({
      title: 'توکن‌های سطح و متن',
      body: [
        demoItem('سطوح', `<div class="demo-token-list">${tokenRow('--nv-surface', 'کارت و پنل')}${tokenRow('--nv-surface-2', 'پس‌زمینه ثانویه')}${tokenRow('--nv-surface-3', 'سطح سوم')}${tokenRow('--nv-surface-inset', 'فرورفته')}</div>`),
        demoItem('متن', `<div class="demo-token-list">${tokenRow('--nv-text', 'متن اصلی')}${tokenRow('--nv-text-2', 'متن ثانویه')}${tokenRow('--nv-text-disabled', 'غیرفعال')}</div>`),
      ],
    }),
  ];
  return { title: 'رنگ‌ها', subtitle: 'پالت‌ها، توکن‌های رنگ و سطوح', icon: 'droplet-half', sections };
}

/* ===================================================================== icons */

function buildIcons() {
  const groups = Object.entries(ICON_GROUPS);
  const tiles = (group, icons) =>
    icons
      .map(
        ([name]) =>
          `<div class="demo-icon" data-icon-name="${escapeHtml(name)}" data-icon-group="${escapeHtml(group)}" data-tooltip="bi bi-${escapeHtml(name)}"><i class="bi bi-${escapeHtml(name)}" aria-hidden="true"></i><span>${escapeHtml(name)}</span></div>`,
      )
      .join('');

  const sections = [
    {
      html: card({
        title: 'جامع آیکون‌ها',
        subtitle: `${toDigits(ICON_TOTAL)} گلیف از Bootstrap Icons با فونت محلی — بدون درخواست شبکه، آماده در حالت روشن و تاریک`,
        body: `<div class="demo-row demo-row--between">
            <div class="input-group" style="max-width:20rem"><span class="input-group__addon"><i class="bi bi-search"></i></span><input class="form-control" type="search" placeholder="جستجوی نام آیکون…" data-icon-search></div>
            <span class="badge badge--soft-neutral" data-icon-count>${toDigits(ICON_TOTAL)} آیکون</span>
          </div>
          <div class="demo-row mt-3">
            <button class="btn btn-light btn-sm is-active" type="button" data-icon-filter="*">همه</button>
            ${groups.map(([group, icons]) => `<button class="btn btn-light btn-sm" type="button" data-icon-filter="${escapeHtml(group)}">${escapeHtml(group)} <span class="badge badge--soft-neutral">${toDigits(icons.length)}</span></button>`).join('')}
          </div>
          <div class="mt-4">
            ${groups.map(([group, icons]) => `<h3 class="card__title mb-3" data-icon-heading="${escapeHtml(group)}">${escapeHtml(group)} <span class="badge badge--soft-primary">${toDigits(icons.length)}</span></h3><div class="demo-icon-grid" data-icon-shelf="${escapeHtml(group)}">${tiles(group, icons)}</div>`).join('')}
          </div>`,
      }),
    },
    {
      html: demoSection({
        title: 'کاربرد در رابط کاربری',
        subtitle: 'آیکون‌ها همان‌طور که در دکمه، نشان، فهرست و کارت استفاده می‌شوند',
        wide: true,
        body: [
          demoItem('دکمه‌ها', row(`<button class="btn btn-primary" type="button"><i class="bi bi-download"></i> دانلود گزارش</button><button class="btn btn-light" type="button"><i class="bi bi-pencil"></i> ویرایش</button><button class="btn btn-soft-danger" type="button"><i class="bi bi-trash"></i> حذف</button>`)),
          demoItem('فهرست با آیکون', `<ul class="list-group">${[['speedometer2', 'داشبورد'], ['people', 'کاربران'], ['wallet2', 'مالی']].map(([icon, label]) => `<li class="list-item"><span class="tile tile--soft tile--icon"><i class="bi bi-${icon}"></i></span><span class="list-item__title">${label}<span class="list-item__sub">آیکون ${icon}</span></span><span class="list-item__meta"><i class="bi bi-chevron-left"></i></span></li>`).join('')}</ul>`),
        ],
      }),
    },
  ];

  return {
    title: 'آیکون‌ها',
    subtitle: 'کتابخانه آیکون با جستجو و فیلتر گروهی',
    icon: 'asterisk',
    sections,
    after: (node) => {
      const input = $('[data-icon-search]', node);
      const count = $('[data-icon-count]', node);
      const tilesAll = $$('[data-icon-name]', node);
      let group = '*';
      const apply = () => {
        const term = (input?.value ?? '').trim().toLowerCase();
        let visible = 0;
        tilesAll.forEach((tile) => {
          const matchGroup = group === '*' || tile.dataset.iconGroup === group;
          const matchTerm = !term || tile.dataset.iconName.includes(term);
          tile.hidden = !(matchGroup && matchTerm);
          if (!tile.hidden) visible += 1;
        });
        $$('[data-icon-shelf]', node).forEach((shelf) => {
          const heading = $(`[data-icon-heading="${shelf.dataset.iconShelf}"]`, node);
          const anyVisible = $$('[data-icon-name]', shelf).some((tile) => !tile.hidden);
          shelf.hidden = !anyVisible;
          if (heading) heading.hidden = !anyVisible;
        });
        if (count) count.textContent = `${toDigits(visible)} آیکون`;
      };
      if (input) on(input, 'input', apply);
      $$('[data-icon-filter]', node).forEach((button) =>
        on(button, 'click', () => {
          group = button.dataset.iconFilter;
          $$('[data-icon-filter]', node).forEach((item) => item.classList.toggle('is-active', item === button));
          apply();
        }),
      );
    },
  };
}

/* ==================================================================== states */

function buildStates() {
  const sections = [
    demoSection({
      title: 'وضعیت‌های بارگذاری',
      subtitle: 'اسکلتون‌ها دقیقاً شکل محتوای نهایی را دارند تا پرش چیدمان رخ ندهد',
      wide: true,
      body: [
        demoItem('اسکلتون کارت', card({ body: skeleton(3) })),
        demoItem('اسکلتون جدول', `<div class="table-responsive"><table class="table"><tbody>${skeleton(4)}</tbody></table></div>`),
        demoItem('شاخص در حال بارگذاری', `<div class="kpi-row">${[1, 2, 3].map(() => `<article class="stat-card is-loading"><div class="stat-card__head"><span class="stat-card__label">در حال دریافت…</span><span class="stat-card__icon stat-card__icon--primary"><i class="bi bi-hourglass-split"></i></span></div><p class="stat-card__value">—</p></article>`).join('')}</div>`),
      ],
    }),
    demoSection({
      title: 'خالی، خطا و موفقیت',
      body: [
        demoItem('خالی', emptyState({ title: 'چیزی برای نمایش نیست', text: 'با افزودن اولین مورد این بخش پر می‌شود.', icon: 'inbox', action: '<button class="btn btn-primary btn-sm" type="button">افزودن مورد</button>' })),
        demoItem('خطا', errorState('دریافت داده‌ها با خطا مواجه شد') + '<div class="mt-3">' + `<button class="btn btn-light btn-sm" type="button" data-retry><i class="bi bi-arrow-clockwise"></i> تلاش دوباره</button>` + '</div>'),
        demoItem('موفقیت', `<div class="card"><div class="card__body"><div class="status-hero"><span class="status-hero__icon"><i class="bi bi-check2-circle"></i></span><div><h3 class="status-hero__title">تغییرات ذخیره شد</h3><p class="status-hero__text">همه تنظیمات با موفقیت اعمال شد.</p></div></div></div></div>`),
      ],
    }),
    demoSection({
      title: 'تغییر زنده وضعیت',
      subtitle: 'یک دکمه، سه حالت: بارگذاری → داده → خالی',
      body: [
        demoItem(
          'چرخه وضعیت',
          `<div class="demo-row"><button class="btn btn-primary" type="button" data-demo-state="loading">بارگذاری</button><button class="btn btn-light" type="button" data-demo-state="data">داده</button><button class="btn btn-light" type="button" data-demo-state="empty">خالی</button></div><div data-demo-state-host class="mt-3">${skeleton(3)}</div>`,
        ),
      ],
    }),
  ];
  return {
    title: 'وضعیت‌ها',
    subtitle: 'بارگذاری، خالی، خطا و موفقیت',
    icon: 'hourglass-split',
    sections,
    after: (node) => {
      const hostNode = $('[data-demo-state-host]', node);
      if (!hostNode) return;
      const paint = (state) => {
        if (state === 'loading') render(hostNode, skeleton(3));
        else if (state === 'empty') render(hostNode, emptyState({ title: 'داده‌ای وجود ندارد', text: 'پس از افزودن رکورد، اینجا نمایش داده می‌شود.', icon: 'inbox' }));
        else {
          render(
            hostNode,
            `<ul class="list-group">${[1, 2, 3].map((i) => `<li class="list-item"><span class="list-item__title">رکورد ${toDigits(i)}<span class="list-item__sub">داده نمونه</span></span><span class="list-item__meta">${statusBadge('فعال', 'success')}</span></li>`).join('')}</ul>`,
          );
        }
        $$('[data-demo-state]', node).forEach((button) => button.classList.toggle('is-active', button.dataset.demoState === state));
      };
      $$('[data-demo-state]', node).forEach((button) => on(button, 'click', () => paint(button.dataset.demoState)));
    },
  };
}

/* ===================================================================== PAGES */

const PAGES = {
  'buttons.html': buildButtons,
  'inputs.html': buildInputs,
  'forms.html': buildForms,
  'tables.html': buildTables,
  'charts.html': buildCharts,
  'cards.html': buildCards,
  'badges.html': buildBadges,
  'alerts.html': buildAlerts,
  'toasts.html': buildToasts,
  'modals.html': buildModals,
  'dropdowns.html': buildDropdowns,
  'tabs.html': buildTabs,
  'tooltips.html': buildTooltips,
  'timeline.html': buildTimeline,
  'progress.html': buildProgress,
  'avatars.html': buildAvatars,
  'typography.html': buildTypography,
  'grid.html': buildGrid,
  'colors.html': buildColors,
  'icons.html': buildIcons,
  'states.html': buildStates,
};

/* =========================================================== interactions */

/** Demo-only wiring: everything here drives real components, nothing is faked. */
function wireDemos(node) {
  // Buttons ---------------------------------------------------------------
  $$('[data-demo-loading]', node).forEach((button) => {
    on(button, 'click', () => {
      if (button.classList.contains('is-loading')) return;
      button.classList.add('is-loading');
      window.setTimeout(() => {
        button.classList.remove('is-loading');
        toast.success('ذخیره شد', 'حالت بارگذاری دکمه نمایش داده شد.');
      }, 1400);
    });
  });

  // Toasts ----------------------------------------------------------------
  $$('[data-demo-toast]', node).forEach((button) => {
    on(button, 'click', () => toast({ type: 'info', title: 'اعلان نمونه', text: 'این اعلان در موقعیت انتخابی نمایش داده شد.', position: button.dataset.demoToast }));
  });
  $$('[data-demo-toast-type]', node).forEach((button) => {
    const type = button.dataset.demoToastType;
    on(button, 'click', () => toast({ type, title: `اعلان ${type}`, text: 'متن نمونه برای این نوع اعلان.' }));
  });
  on($('[data-demo-toast-action]', node), 'click', () =>
    toast({ type: 'success', title: 'فایل آماده است', text: 'برای دانلود روی دکمه بزنید.', action: { label: 'دانلود', onClick: () => toast.success('دانلود آغاز شد') } }),
  );
  on($('[data-demo-toast-sticky]', node), 'click', () => toast({ type: 'warning', title: 'اعلان ماندگار', text: 'این اعلان تا بسته‌شدن باقی می‌ماند.', duration: 0 }));

  // Modals ----------------------------------------------------------------
  const modalContent = (size) => ({
    title: `پنجره ${size}`,
    size,
    content: `<p>این پنجره با اندازه <code>${size}</code> باز شده است و با کلید Esc یا کلیک بیرون بسته می‌شود.</p>${infoRows([['سایز', size], ['فوکوس‌تراپ', 'فعال'], ['بستن با Esc', 'بله']])}`,
    footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button><button type="button" class="btn btn-primary" data-modal-close>تأیید</button>',
  });
  $$('[data-demo-modal]', node).forEach((button) => on(button, 'click', () => modal.open(modalContent(button.dataset.demoModal === 'full' ? 'full' : button.dataset.demoModal))));
  on($('[data-demo-modal-form]', node), 'click', () =>
    modal.open({
      title: 'افزودن کاربر',
      size: 'lg',
      content: `<form class="form-grid" data-validate novalidate><div><label class="form-label" for="m-name">نام</label><input class="form-control" id="m-name" name="name" type="text" data-rule="required"></div><div><label class="form-label" for="m-mail">ایمیل</label><input class="form-control" id="m-mail" name="email" type="email" data-rule="email"></div></form>`,
      footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-primary" data-modal-save>ذخیره</button>',
      onMount: (panel) => on($('[data-modal-save]', panel), 'click', () => { modal.closeTop(); toast.success('کاربر افزوده شد'); }),
    }),
  );
  on($('[data-demo-confirm]', node), 'click', async () => {
    const ok = await modal.confirm({ title: 'حذف مورد', text: 'این عملیات قابل بازگشت نیست.', tone: 'danger', confirmText: 'حذف کن' });
    toast({ type: ok ? 'success' : 'info', title: ok ? 'حذف شد' : 'لغو شد', text: ok ? 'مورد انتخاب‌شده حذف شد.' : 'عملیات حذف لغو شد.' });
  });
  on($('[data-demo-modal-info]', node), 'click', () =>
    modal.open({ title: 'جزئیات سفارش', size: 'md', content: infoRows([['شماره', 'ORD-۱۰۲۴'], ['مشتری', 'سارا محمدی'], ['مبلغ', formatCurrency(48500000, 'IRR')], ['تاریخ', formatDate(new Date(), { format: 'long' })]]), footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button>' }),
  );

  // Tabs view switch / primary palette ------------------------------------
  $$('[data-demo-primary]', node).forEach((button) => on(button, 'click', () => theme.setPrimary(button.dataset.demoPrimary)));

  // Range output ----------------------------------------------------------
  $$('[data-range-output]', node).forEach((input) => {
    const output = input.parentElement?.querySelector('[data-range-value]');
    if (!output) return;
    const sync = () => {
      output.textContent = toDigits(input.value);
    };
    on(input, 'input', sync);
    sync();
  });
}

/* ================================================================== entry */

/**
 * Renders the component-library page that belongs to the current URL.
 * Falls back to a clear placeholder if a slug has no builder yet, so a new page
 * never renders an empty screen.
 */
export async function initUiKit() {
  const node = host();
  if (!node) return;
  const slug = pageId().split('/').pop() || 'buttons.html';
  const builder = PAGES[slug];
  node.dataset.appClaimed = '1';

  if (!builder) {
    render(node, page('کیت رابط کاربری', 'این بخش از کتابخانه کامپوننت', 'palette2', [
      demoSection({ title: 'صفحه در دست ساخت', body: emptyState({ title: 'این صفحه به‌زودی تکمیل می‌شود', text: 'از صفحه دکمه‌ها شروع کنید.', icon: 'tools', action: '<a class="btn btn-primary btn-sm" href="ui/buttons.html">دکمه‌ها</a>' }) }),
    ]));
    return;
  }

  const { title, subtitle, icon, sections, after } = await builder();
  render(node, page(title, subtitle, icon, sections));
  wireDemos(node);
  if (typeof after === 'function') after(node);
}

export default { initUiKit, PAGES };
