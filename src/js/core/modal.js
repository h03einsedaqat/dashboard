/**
 * NOVAADMIN — modal, drawer & confirmation service
 * ------------------------------------------------------------------
 * One controller for every overlay surface so focus handling, scroll locking,
 * Escape support, backdrop clicks and RTL animation stay consistent:
 *
 *   const instance = modal.open({ title: 'ویرایش', content: html, size: 'lg', onMount(el) {} });
 *   const ok = await modal.confirm({ title: 'حذف شود؟', text: '…', tone: 'danger' });
 *   const drawer = modal.drawer({ title: 'فیلترها', content: html, side: 'start' });
 *
 * `modal.sweet()` exposes the bundled SweetAlert2 for the two places where a
 * richer dialog is worth it (destructive flows on the UI Kit page and the
 * payment demo), themed with the template's design tokens.
 */
import { $, $$, create, on, focusTrap, lockScroll, escapeHtml, ready } from './dom.js';
import { toast } from './toast.js';

const stack = [];

const SIZE_CLASS = { sm: 'modal-sm', md: '', lg: 'modal-lg', xl: 'modal-xl', full: 'modal-full' };

function host() {
  let node = $('[data-modal-host]');
  if (node) return node;
  node = create('div', { class: 'modal-host', dataset: { modalHost: '' } });
  document.body.append(node);
  return node;
}

function onEscape(event) {
  if (event.key !== 'Escape') return;
  const top = stack.at(-1);
  if (top?.options.closeOnEscape !== false) top.close();
}

function mountOverlay(instance) {
  const { options } = instance;
  const container = options.container ?? host();
  const isDrawer = options.variant === 'drawer';
  const node = create('div', {
    class: isDrawer ? 'drawer-overlay' : 'modal-backdrop',
    dataset: { modalId: instance.id },
    role: 'presentation',
  });

  const panelClass = isDrawer
    ? `drawer${options.side === 'start' ? ' drawer--start' : ''}${options.size === 'lg' ? ' drawer--lg' : ''}`
    : `modal${SIZE_CLASS[options.size] ? ` ${SIZE_CLASS[options.size]}` : ''}${options.scrollable ? ' modal--scrollable' : ''}${options.centered ? ' modal--centered' : ''}`;

  node.innerHTML = `
    <div class="${panelClass}" role="dialog" aria-modal="true" aria-label="${escapeHtml(options.title ?? 'پنجره')}" tabindex="-1">
      ${
        options.header === false
          ? ''
          : `<header class="modal__header">
              <div>
                <h2 class="modal__title">${escapeHtml(options.title ?? '')}</h2>
                ${options.subtitle ? `<p class="modal__subtitle">${escapeHtml(options.subtitle)}</p>` : ''}
              </div>
              <button type="button" class="icon-btn" data-modal-close aria-label="بستن"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
            </header>`
      }
      <div class="modal__body" data-modal-content>${options.content ?? ''}</div>
      ${options.footer ? `<footer class="modal__footer" data-modal-footer>${options.footer}</footer>` : ''}
    </div>`;

  const panel = node.firstElementChild;

  instance.node = node;
  instance.panel = panel;
  instance.releaseTrap = focusTrap(panel);
  const previousFocus = document.activeElement;

  node.addEventListener('mousedown', (event) => {
    if (event.target === node && options.closeOnBackdrop !== false) instance.close();
  });
  $$('[data-modal-close]', panel).forEach((button) => on(button, 'click', () => instance.close()));

  container.append(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  lockScroll(true);
  document.addEventListener('keydown', onEscape);

  const autofocus = $('[autofocus]', panel) ?? panel.querySelector('input:not([type="hidden"]), textarea, select, button');
  setTimeout(() => autofocus?.focus({ preventScroll: true }), 80);

  options.onMount?.(panel, instance);

  instance.restoreFocus = () => {
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  };
  return instance;
}

function createInstance(options) {
  const instance = {
    id: `modal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    options,
    closed: false,
    open() {
      stack.push(instance);
      mountOverlay(instance);
      return instance;
    },
    close(result) {
      if (instance.closed) return;
      instance.closed = true;
      stack.splice(stack.indexOf(instance), 1);
      if (!stack.length) {
        lockScroll(false);
        document.removeEventListener('keydown', onEscape);
      }
      instance.releaseTrap?.();
      instance.node?.classList.remove('is-visible');
      instance.node?.classList.add('is-leaving');
      const finish = () => {
        instance.node?.remove();
        instance.restoreFocus?.();
        options.onClose?.(result);
        instance.resolve?.(result);
      };
      setTimeout(finish, 220);
    },
  };
  return instance;
}

export const modal = {
  /** Opens a modal and returns its instance (`instance.close()`). */
  open(options = {}) {
    return createInstance(options).open();
  },

  /** Centered drawer panel (filters, details, composer). */
  drawer(options = {}) {
    return modal.open({ ...options, variant: 'drawer', centered: false, size: options.size ?? 'lg' });
  },

  /**
   * Promise-based confirmation used by every destructive action.
   * @returns {Promise<boolean>}
   */
  confirm({ title = 'تأیید عملیات', text = '', confirmText = 'تأیید', cancelText = 'انصراف', tone = 'primary', icon = null } = {}) {
    return new Promise((resolve) => {
      const instance = createInstance({
        title: '',
        header: false,
        size: 'sm',
        centered: true,
        closeOnBackdrop: false,
        content: `
          <div class="confirm-body">
            <span class="confirm-icon confirm-icon--${tone}" aria-hidden="true"><i class="bi bi-${icon ?? (tone === 'danger' ? 'exclamation-octagon' : 'question-circle')}"></i></span>
            <h3 class="confirm-title">${escapeHtml(title)}</h3>
            ${text ? `<p class="confirm-text">${escapeHtml(text)}</p>` : ''}
          </div>
          <div class="confirm-actions">
            <button type="button" class="btn btn-light" data-confirm-cancel>${escapeHtml(cancelText)}</button>
            <button type="button" class="btn btn-${tone}" data-confirm-ok autofocus>${escapeHtml(confirmText)}</button>
          </div>`,
        onMount: (panel) => {
          on($('[data-confirm-ok]', panel), 'click', () => instance.close(true));
          on($('[data-confirm-cancel]', panel), 'click', () => instance.close(false));
        },
      });
      instance.resolve = resolve;
      instance.open();
      clickOutside(instance.panel, () => instance.close(false));
    });
  },

  /** Alert-style dialog (no cancel button). */
  alert({ title = 'توجه', text = '', okText = 'متوجه شدم', tone = 'primary' } = {}) {
    return new Promise((resolve) => {
      const instance = createInstance({
        title: '',
        header: false,
        size: 'sm',
        centered: true,
        content: `
          <div class="confirm-body">
            <span class="confirm-icon confirm-icon--${tone}" aria-hidden="true"><i class="bi bi-info-circle"></i></span>
            <h3 class="confirm-title">${escapeHtml(title)}</h3>
            ${text ? `<p class="confirm-text">${escapeHtml(text)}</p>` : ''}
          </div>
          <div class="confirm-actions"><button type="button" class="btn btn-${tone}" data-confirm-ok autofocus>${escapeHtml(okText)}</button></div>`,
        onMount: (panel) => on($('[data-confirm-ok]', panel), 'click', () => instance.close(true)),
      });
      instance.resolve = resolve;
      instance.open();
    });
  },

  /** Prompt replacement with validation — returns the value or null. */
  prompt({ title = 'ورود اطلاعات', label = 'مقدار', value = '', placeholder = '', confirmText = 'ذخیره', validate = null } = {}) {
    return new Promise((resolve) => {
      const instance = createInstance({
        title,
        size: 'sm',
        content: `
          <form class="form-grid" data-prompt-form novalidate>
            <div class="form-section">
              <label class="form-label" for="prompt-input">${escapeHtml(label)}</label>
              <input class="form-control" id="prompt-input" name="value" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autofocus />
              <p class="field-feedback field-feedback--error" data-prompt-error hidden></p>
            </div>
          </form>`,
        footer: `<button type="button" class="btn btn-light" data-prompt-cancel>انصراف</button><button type="button" class="btn btn-primary" data-prompt-ok>${escapeHtml(confirmText)}</button>`,
        onMount: (panel) => {
          const form = $('[data-prompt-form]', panel);
          const input = $('[name="value"]', form);
          const error = $('[data-prompt-error]', panel);
          const submit = () => {
            const result = validate ? validate(input.value) : true;
            if (result !== true) {
              error.textContent = result || 'مقدار وارد شده معتبر نیست.';
              error.hidden = false;
              input.classList.add('is-invalid');
              return;
            }
            instance.close(input.value.trim());
          };
          on(form, 'submit', (event) => {
            event.preventDefault();
            submit();
          });
          on($('[data-prompt-ok]', panel), 'click', submit);
          on($('[data-prompt-cancel]', panel), 'click', () => instance.close(null));
        },
      });
      instance.resolve = resolve;
      instance.open();
    });
  },

  closeTop() {
    stack.at(-1)?.close();
  },

  closeAll() {
    [...stack].forEach((instance) => instance.close());
  },

  /** SweetAlert2, themed with the current design tokens (lazy-loaded). */
  async sweet({ title, text, icon = 'warning', confirmText = 'تأیید', tone = 'danger' } = {}) {
    const [{ default: Swal }] = await Promise.all([import('sweetalert2')]);
    const tokens = getComputedStyle(document.documentElement);
    const result = await Swal.fire({
      title,
      text,
      icon,
      confirmButtonText: confirmText,
      showCancelButton: true,
      cancelButtonText: 'انصراف',
      buttonsStyling: false,
      customClass: {
        popup: 'nv-swal',
        confirmButton: `btn btn-${tone}`,
        cancelButton: 'btn btn-light',
      },
      didOpen: () => {
        const popup = document.querySelector('.nv-swal');
        if (popup) {
          popup.style.setProperty('--nv-swal-radius', tokens.getPropertyValue('--nv-radius-lg').trim());
          popup.style.setProperty('--nv-swal-bg', tokens.getPropertyValue('--nv-surface').trim());
        }
      },
    });
    return result.isConfirmed;
  },
};

/** Resolves when a click lands outside `panel` — used to dismiss light dialogs. */
function clickOutside(panel, handler) {
  const listener = (event) => {
    if (panel && !panel.contains(event.target)) {
      setTimeout(handler, 0);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', listener, { once: true }), 0);
}

/** Delegated openers: `data-modal="#id"`, `data-ajax-modal`, `data-confirm-action`. */
export function initDeclarativeOverlays(root = document) {
  on(root, 'click', (event) => {
    const opener = event.target.closest('[data-modal-open]');
    if (opener) {
      const template = document.querySelector(opener.dataset.modalOpen);
      if (template) {
        modal.open({
          title: template.dataset.title,
          subtitle: template.dataset.subtitle,
          size: template.dataset.size ?? 'md',
          content: template.innerHTML,
        });
      }
      return;
    }

    const drawerOpener = event.target.closest('[data-drawer-open]');
    if (drawerOpener) {
      const target = document.querySelector(drawerOpener.dataset.drawerOpen);
      if (target) {
        modal.drawer({
          title: target.dataset.title ?? '',
          side: target.dataset.side ?? 'end',
          content: target.innerHTML,
        });
      }
      return;
    }

    const confirmTrigger = event.target.closest('[data-confirm]');
    if (confirmTrigger) {
      event.preventDefault();
      modal
        .confirm({
          title: confirmTrigger.dataset.confirmTitle ?? 'تأیید عملیات',
          text: confirmTrigger.dataset.confirm ?? '',
          tone: confirmTrigger.dataset.confirmTone ?? 'danger',
          confirmText: confirmTrigger.dataset.confirmOk ?? 'حذف کن',
        })
        .then((ok) => {
          if (!ok) return;
          if (confirmTrigger.dataset.confirmToast !== 'false') {
            toast({ type: 'success', title: 'انجام شد', text: 'عملیات درخواستی با موفقیت اجرا شد.' });
          }
          confirmTrigger.dispatchEvent(new CustomEvent('nova:confirmed', { bubbles: true }));
        });
      return;
    }

    if (event.target.closest('[data-modal-close]')) {
      modal.closeTop();
    }
  });
}

ready(() => initDeclarativeOverlays());

export default modal;
