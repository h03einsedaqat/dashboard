/**
 * NOVAADMIN — toast notifications
 * ------------------------------------------------------------------
 * Four RTL-safe positions, stacking, auto-dismiss with a real progress bar,
 * pause-on-hover and keyboard dismissal. Toasts are announced through an
 * `aria-live="polite"` region so screen readers pick them up.
 *
 *   toast({ type: 'success', title: 'ذخیره شد', text: 'تغییرات اعمال شد.' });
 *   toast.success('کپی شد', 'در پیام‌رسان درج کنید');
 *   toast.host('top-center');           // switch default position
 *
 * Host markup (created automatically when missing):
 *   <div class="toast-host" data-toast-host data-position="bottom-end"></div>
 */
import { $, create, on } from './dom.js';
import { toastTemplates } from './toast.templates.js';

export const TOAST_POSITIONS = ['bottom-end', 'bottom-start', 'top-end', 'top-start', 'top-center', 'bottom-center'];

const state = {
  position: document.documentElement.getAttribute('data-direction') === 'rtl' ? 'bottom-start' : 'bottom-end',
  limit: 4,
  queue: [],
};

function host(position = state.position) {
  let node = $(`[data-toast-host][data-position="${position}"]`);
  if (node) return node;
  const existing = $('[data-toast-host]');
  if (existing && !existing.hasAttribute('data-position')) {
    existing.setAttribute('data-position', position);
    return existing;
  }
  node = create('div', {
    class: 'toast-host',
    dataset: { toastHost: '', position },
    role: 'region',
    'aria-live': 'polite',
    'aria-label': 'اعلان‌های سیستم',
  });
  document.body.append(node);
  return node;
}

/**
 * @param {Object} options
 * @param {'success'|'danger'|'warning'|'info'|'primary'} [options.type]
 * @param {string} options.title
 * @param {string} [options.text]
 * @param {number} [options.duration]   ms — 0 keeps it until dismissed
 * @param {string} [options.position]
 * @param {{ label: string, onClick: Function }} [options.action]
 * @param {boolean} [options.closable]
 * @param {string} [options.icon]       bootstrap-icons name override
 */
export function toast({
  type = 'info',
  title = '',
  text = '',
  duration = 4200,
  position = state.position,
  action = null,
  closable = true,
  icon = null,
} = {}) {
  const container = host(position);
  const node = create('div', {
    class: `nv-toast nv-toast--${type}`,
    role: type === 'danger' ? 'alert' : 'status',
    dataset: { toast: '' },
  });
  node.innerHTML = toastTemplates({ type, title, text, icon, action, closable, duration });

  container.append(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));

  let timer = null;
  let remaining = duration;
  let startedAt = Date.now();

  const progress = node.querySelector('.nv-toast__progress');

  const start = () => {
    if (!duration) return;
    startedAt = Date.now();
    timer = setTimeout(dismiss, remaining);
    if (progress) progress.style.animationDuration = `${remaining}ms`;
  };
  const pause = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining -= Date.now() - startedAt;
    progress?.classList.add('is-paused');
  };
  const resume = () => {
    progress?.classList.remove('is-paused');
    if (!timer && remaining > 0) start();
  };

  function dismiss() {
    clearTimeout(timer);
    node.classList.remove('is-visible');
    node.classList.add('is-leaving');
    node.addEventListener('transitionend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
    state.queue = state.queue.filter((item) => item !== node);
  }

  node.addEventListener('mouseenter', pause);
  node.addEventListener('mouseleave', resume);
  node.addEventListener('focusin', pause);
  node.addEventListener('focusout', resume);
  on(node.querySelector('[data-toast-close]'), 'click', dismiss);
  on(node.querySelector('[data-toast-action]'), 'click', (event) => {
    action?.onClick?.(event);
    dismiss();
  });

  start();

  // Trim the oldest toast when the visible stack exceeds the limit.
  const stack = Array.from(container.querySelectorAll('[data-toast]'));
  if (stack.length > state.limit) stack.slice(0, stack.length - state.limit).forEach((old) => old.remove());

  state.queue.push(node);
  return { close: dismiss, node };
}

toast.success = (title, text, options) => toast({ ...options, type: 'success', title, text });
toast.danger = (title, text, options) => toast({ ...options, type: 'danger', title, text });
toast.warning = (title, text, options) => toast({ ...options, type: 'warning', title, text });
toast.info = (title, text, options) => toast({ ...options, type: 'info', title, text });

toast.host = (position) => {
  if (!TOAST_POSITIONS.includes(position)) return state.position;
  state.position = position;
  host(position);
  return position;
};

toast.position = () => state.position;
toast.limit = (value) => {
  state.limit = Math.max(1, Number(value) || 4);
  return state.limit;
};
toast.clear = () => {
  document.querySelectorAll('[data-toast]').forEach((node) => node.remove());
};

/** Wires the position picker used on the UI Kit page. */
export function initToastControls(root = document) {
  const picker = $('[data-toast-position]', root);
  if (picker) {
    picker.value = state.position;
    on(picker, 'change', () => toast.host(picker.value));
  }
  document.querySelectorAll('[data-toast-demo]').forEach((button) => {
    on(button, 'click', () => {
      const type = button.dataset.toastDemo || 'info';
      toast({
        type,
        title: button.dataset.toastTitle || 'اعلان نمونه',
        text: button.dataset.toastText || 'این پیام از طریق سیستم اعلان قالب نمایش داده شد.',
        action: button.dataset.toastAction ? { label: 'مشاهده', onClick: () => {} } : null,
      });
    });
  });
}

export default toast;
