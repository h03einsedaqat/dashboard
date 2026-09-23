/**
 * NOVAADMIN — toast markup template
 * Kept separate from the toast controller so the markup can be reused by
 * documentation pages and unit-tested in isolation.
 */
import { escapeHtml } from './dom.js';

const ICONS = {
  success: 'check2-circle',
  danger: 'x-octagon',
  warning: 'exclamation-triangle',
  info: 'info-circle',
  primary: 'bell',
};

export function toastTemplates({ type = 'info', title = '', text = '', icon = null, action = null, closable = true, duration = 4200 } = {}) {
  const iconName = icon ?? ICONS[type] ?? 'bell';
  return `
    <span class="nv-toast__icon" aria-hidden="true"><i class="bi bi-${escapeHtml(iconName)}"></i></span>
    <div class="nv-toast__body">
      <p class="nv-toast__title">${escapeHtml(title)}</p>
      ${text ? `<p class="nv-toast__text">${escapeHtml(text)}</p>` : ''}
      ${action?.label ? `<button type="button" class="btn btn-sm btn-soft-${type} nv-toast__action" data-toast-action>${escapeHtml(action.label)}</button>` : ''}
    </div>
    ${closable ? '<button type="button" class="icon-btn icon-btn--sm nv-toast__close" data-toast-close aria-label="بستن اعلان"><i class="bi bi-x-lg" aria-hidden="true"></i></button>' : ''}
    ${duration ? `<span class="nv-toast__progress" aria-hidden="true"></span>` : ''}`;
}

export default toastTemplates;
