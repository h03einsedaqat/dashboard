/**
 * NOVAADMIN — page header reconciliation
 * ------------------------------------------------------------------
 * Every generated page ships a `.page-head` (breadcrumb, title, subtitle slot,
 * action slot). Page controllers, on top of that, render their own header card
 * with a title, a subtitle and their own export/columns/create buttons — so the
 * visitor sees *two* toolbars stacked over each other, an empty subtitle line
 * and a wide gap before the first chart. That gap was the single most reported
 * layout complaint.
 *
 * This module folds the controller header into the real one, once, after the
 * page has painted:
 *
 *   • the subtitle lands in `.page-head__sub` (or is derived from the page)
 *   • badges and actions are moved up, duplicates removed by label
 *   • the redundant card is taken out of the flow
 *
 * It is intentionally layout-agnostic: it only moves nodes that already exist,
 * so any page — including a hand-written one — behaves the same way.
 */
import { $, $$, on } from './dom.js';

/** One-line description per dashboard, so a page never opens with an empty slot. */
const DASHBOARD_INTROS = {
  analytics: 'دید کامل ترافیک، درآمد و رفتار کاربر؛ با مقایسه دوره‌ای و منبع بازدید.',
  ecommerce: 'سفارش‌ها، سبد خرید، موجودی و بازگشتی‌ها در یک نگاه — به‌همراه بهترین فروش‌ها.',
  crm: 'قیف فروش، ارزش Pipeline و پیگیری آخرین گفت‌وگو با هر مشتری.',
  saas: 'درآمد ماهانه تکرارشونده، ریزش، انبساط و توزیع پلن‌های اشتراک.',
  finance: 'جریان نقدی، مطالبات، هزینه‌ها و سود خالص با تفکیک ماه به ماه.',
  projects: 'پیشرفت اسپرینت‌ها، بار کاری تیم‌ها و مایل‌استون‌های در پیش رو.',
  hr: 'حضور و غیاب، مرخصی‌ها، فرآیند استخدام و شاخص رضایت کارکنان.',
  support: 'صف تیکت‌ها، رعایت SLA، زمان نخستین پاسخ و رضایت مشتری در یک صفحه.',
  ai: 'مصرف توکن، سهم مدل‌ها، هزینه ماهانه و وضعیت کارهای زمان‌بندی‌شده.',
  logistics: 'محموله‌ها در مسیر، وضعیت انبارها، عملکرد راننده‌ها و زمان تحویل.',
};

/** One-line description per area (used when a page has no controller header). */
const AREA_INTROS = {
  dashboards: 'ده داشبورد تخصصی با داده نمونه واقعی؛ همه نمودارها با تم و زبان صفحه سازگار می‌شوند.',
  ai: 'کارگاه هوش مصنوعی: گفتگو، نویسندگی، خلاصه‌سازی، تصویر، زمان‌بند و حساب مصرف.',
  users: 'مدیریت حساب‌ها، نقش‌ها، دسترسی‌ها، تیم‌ها و نشست‌های فعال.',
  customers: 'پروفایل مشتری، تاریخچه خرید، امتیاز رضایت و بخش‌بندی کمپین‌ها.',
  ecommerce: 'کاتالوگ، موجودی، سفارش‌ها و نظرات مشتریان — با عملیات گروهی روی جدول.',
  crm: 'مخاطبین، شرکت‌ها، سرنخ‌ها و معاملات؛ از اولین تماس تا قرارداد.',
  finance: 'فاکتورها، تراکنش‌ها، بودجه و گزارش سود و زیان.',
  projects: 'پروژه‌ها، تسک‌ها، کانبان و زمان‌بندی؛ با نمودار پیشرفت تیم.',
  support: 'تیکت‌ها، پایگاه دانش، سطح خدمات و رضایت پشتیبانی.',
  hr: 'کارکنان، حضور و غیاب، مرخصی، حقوق و فرآیند استخدام.',
  logistics: 'محموله‌ها، ناوگان، انبارها و مسیرهای توزیع.',
  reports: 'گزارش‌های آماده با فیلتر بازه زمانی و خروجی CSV/اکسل.',
  apps: 'فضای کاری اپلیکیشن‌ها: ایمیل، گفتگو، تقویم، فایل و اعلان‌ها.',
  cms: 'نوشته‌ها، رسانه‌ها، دسته‌بندی‌ها و دیدگاه‌های کاربران.',
  settings: 'تنظیمات عمومی حساب، ظاهر، زبان، امنیت و یکپارچه‌سازی‌ها.',
  profile: 'هویت، امنیت، اعلان‌ها و صورت‌حساب کاربر جاری.',
  system: 'صفحات سیستمی: وضعیت سرویس، مرکز راهنما، پلن‌ها و صفحات خطا.',
  ui: 'کیت رابط کاربری: نمونه زنده هر کامپوننت با تمام حالت‌ها.',
  widgets: 'کتابخانه ابزارک‌های آماده داشبورد — با داده واقعی و قابل کپی.',
  docs: 'مستندات فنی قالب: نصب، ساختار، تنظیمات و راهنمای اتصال به API.',
};

const textOf = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
const keyOf = (node) => `${textOf(node).toLowerCase()}|${node?.querySelector('i')?.className ?? ''}`;

/** Moves children of `source` into `target`, skipping nodes already present. */
function moveChildren(source, target) {
  if (!source || !target) return 0;
  const seen = new Set($$('*', target).map(keyOf));
  let moved = 0;
  [...source.children].forEach((child) => {
    const key = keyOf(child);
    if (seen.has(key) && !child.matches('[data-demo-switch], [data-widget-editor]')) return;
    seen.add(key);
    target.append(child);
    moved += 1;
  });
  source.remove();
  return moved;
}

/**
 * @param {ParentNode} [root]
 * @returns {number} how many pages-level headers were folded in
 */
export function reconcilePageHeads(root = document) {
  const head = root.querySelector?.('.page-head');
  if (!head) return 0;
  const scope = head.parentElement ?? root;
  /** The controller-rendered header: `<header class="card"><div class="page-head-row">`. */
  const row = $$('.page-head-row', scope).find((node) => !head.contains(node) && !node.closest('.page-head'));

  if (row) {
    const card = row.closest('.card') ?? row;
    const title = $('.page-head-row__title', row);
    const sub = $('.page-head-row__sub', row);
    const badges = $('.badge-dot-list', row);
    const actions = $('.page-head-row__actions', row);
    const headTitle = $('.page-head__title', head);
    const headSub = $('.page-head__sub', head);
    const headActions = $('.page-head__actions', head) ?? null;

    /* A controller title is more specific than the navigation label (it carries
       the record name on details pages), so it wins. */
    if (title && headTitle && textOf(title) && textOf(title) !== textOf(headTitle)) {
      headTitle.textContent = textOf(title);
    }
    if (sub && headSub && !textOf(headSub)) headSub.textContent = textOf(sub);
    if (badges) {
      const slot = $('.page-head__badges', head) ?? (() => {
        const node = document.createElement('div');
        node.className = 'page-head__badges';
        head.querySelector('.page-head__text')?.append(node);
        return node;
      })();
      moveChildren(badges, slot);
    }
    if (actions) {
      const slot = headActions ?? (() => {
        const node = document.createElement('div');
        node.className = 'page-head__actions';
        head.append(node);
        return node;
      })();
      moveChildren(actions, slot);
    }
    /* The row is empty now, so the whole card goes — that is the gap. */
    if (!textOf(card.querySelector('.card__body') ?? card).length) card.remove();
    else card.classList.add('card--collapsed');
  }

  /**
   * Dashboards own a real toolbar inside `.dash-head` (range presets, refresh,
   * widget editor, export). Keeping the generated page-head buttons as well put
   * two export menus on the same screen, so the page-head buttons move down and
   * only the demo switcher stays up.
   */
  const dashHead = $('.dash-head', scope);
  if (dashHead) {
    const headActions = $('.page-head__actions', head);
    if (headActions) {
      const keep = $$('[data-demo-next], [data-demo-switch]', headActions);
      const dashActions = $('.dash-head__actions', dashHead) ?? (() => {
        const node = document.createElement('div');
        node.className = 'dash-head__actions';
        dashHead.append(node);
        return node;
      })();
      [...headActions.children].forEach((child) => {
        if (keep.includes(child)) return;
        if (child.querySelector('[data-widget-editor]') && dashHead.querySelector('[data-widget-edit]')) return;
        if (child.querySelector('[data-export-menu]') && dashHead.querySelector('[data-export]')) return;
        dashActions.prepend(child);
      });
      if (!headActions.children.length) headActions.remove();
    }
  }

  fillSubtitle(head);
  collapseEmptyActions(head);
  return 1;
}

/** Derives the subtitle from the page when neither markup nor controller gave one. */
function fillSubtitle(head) {
  const slot = $('.page-head__sub', head);
  if (!slot) return;
  if (textOf(slot)) return;
  const page = document.body?.dataset?.page ?? '';
  const slug = page.split('/').pop()?.replace('.html', '') ?? '';
  const area = page.split('/')[0] ?? '';
  const text = (area === 'dashboards' ? DASHBOARD_INTROS[slug] : null) ?? AREA_INTROS[area] ?? '';
  if (text) {
    slot.textContent = text;
    slot.dataset.i18nDerived = '1';
  }
}

/** An action slot with no buttons leaves a stray gap in the flex row. */
function collapseEmptyActions(head) {
  const actions = $('.page-head__actions', head);
  if (actions && !actions.children.length) actions.remove();
}

/**
 * Keeps the header in step with late renders (record modals, table reloads,
 * language switches) without paying for a MutationObserver on every page.
 */
export function observePageHeads(root = document.body) {
  if (!root || typeof MutationObserver === 'undefined') return null;
  let frame = 0;
  const observer = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      reconcilePageHeads(document);
    });
  });
  const scope = $('.page-body') ?? root;
  observer.observe(scope, { childList: true, subtree: true });
  /** A re-render triggered from the dashboard toolbar must re-run it too. */
  on(document, 'click', (event) => {
    if (event.target.closest('[data-dashboard-refresh], [data-range-preset], [data-widget-edit]')) {
      window.setTimeout(() => reconcilePageHeads(document), 60);
    }
  });
  return observer;
}

export default { reconcilePageHeads, observePageHeads };
