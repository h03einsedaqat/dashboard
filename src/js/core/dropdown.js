/**
 * NOVAADMIN — dropdown controller
 * ------------------------------------------------------------------
 * Bootstrap's dropdown plugin is deliberately not bundled, so this module
 * implements the behaviour with the same markup contract:
 *
 *   <div class="dropdown">
 *     <button data-dropdown-toggle aria-expanded="false">…</button>
 *     <div class="dropdown-menu" data-dropdown-menu>…</div>
 *   </div>
 *
 * Features: click/hover open, outside click + Escape close, keyboard
 * navigation (arrows, Home/End, Enter), submenu support, viewport-aware
 * alignment for RTL, and auto-close when a menu item triggers navigation.
 */
import { $, $$, on } from './dom.js';

const openMenus = new Set();

function menuOf(trigger) {
  const id = trigger.dataset.dropdownToggle;
  if (id && id !== 'true') return document.getElementById(id) ?? trigger.parentElement?.querySelector('[data-dropdown-menu]');
  return trigger.parentElement?.querySelector('[data-dropdown-menu]');
}

function close(trigger, { focus = false } = {}) {
  const menu = menuOf(trigger);
  if (!menu) return;
  menu.classList.remove('is-open');
  menu.removeAttribute('data-open');
  trigger.setAttribute('aria-expanded', 'false');
  openMenus.delete(trigger);
  if (focus) trigger.focus();
}

export function closeAll(except = null) {
  [...openMenus].forEach((trigger) => {
    if (trigger !== except) close(trigger);
  });
}

function open(trigger, { focusFirst = false } = {}) {
  const menu = menuOf(trigger);
  if (!menu) return;
  closeAll(trigger);
  menu.classList.add('is-open');
  menu.dataset.open = 'true';
  trigger.setAttribute('aria-expanded', 'true');
  openMenus.add(trigger);
  align(menu, trigger);
  if (focusFirst) {
    const first = menu.querySelector('.dropdown-item, a, button');
    first?.focus({ preventScroll: true });
  }
}

/**
 * Nudges the panel back inside the viewport (RTL-safe). The offset is a signed
 * pixel value consumed by `translate` in `components/_dropdowns.scss`, so the
 * menu never falls off the screen edge on narrow viewports.
 */
function align(menu, trigger) {
  menu.style.removeProperty('--nv-menu-shift');
  const rect = menu.getBoundingClientRect();
  const viewport = window.innerWidth;
  if (!rect.width || !viewport) return;
  if (rect.right > viewport - 8) {
    const shift = -Math.min(rect.right - viewport + 12, rect.width);
    menu.style.setProperty('--nv-menu-shift', `${Math.round(shift)}px`);
  } else if (rect.left < 8) {
    const shift = Math.max(8 - rect.left, 0);
    menu.style.setProperty('--nv-menu-shift', `${Math.round(shift)}px`);
  }
}

function toggle(trigger, options) {
  const menu = menuOf(trigger);
  if (!menu) return;
  if (menu.classList.contains('is-open')) close(trigger, { focus: options?.focus });
  else open(trigger, options);
}

function items(menu) {
  return $$('.dropdown-item:not([disabled]):not(.is-disabled), a, button:not([disabled])', menu).filter((node) => node.offsetParent !== null);
}

export function initDropdowns(root = document) {
  on(root, 'click', (event) => {
    const trigger = event.target.closest('[data-dropdown-toggle]');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      toggle(trigger);
      return;
    }
    // Any click inside an open menu closes it — including links and actions.
    const inside = event.target.closest('[data-dropdown-menu]');
    if (inside) {
      const triggerNode = [...openMenus].find((t) => menuOf(t) === inside);
      if (triggerNode && !event.target.closest('[data-dropdown-keep-open]')) close(triggerNode);
      return;
    }
    if (!event.target.closest('[data-dropdown-menu]')) closeAll();
  });

  on(document, 'keydown', (event) => {
    const trigger = openMenus.size ? [...openMenus].at(-1) : null;
    if (event.key === 'Escape' && trigger) {
      close(trigger, { focus: true });
      return;
    }
    if (!trigger) return;
    const menu = menuOf(trigger);
    if (!menu) return;
    const list = items(menu);
    if (!list.length) return;
    const index = list.indexOf(document.activeElement);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        (list[index + 1] ?? list[0]).focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        (list[index - 1] ?? list.at(-1)).focus();
        break;
      case 'Home':
        event.preventDefault();
        list[0].focus();
        break;
      case 'End':
        event.preventDefault();
        list.at(-1).focus();
        break;
      case 'Tab':
        close(trigger);
        break;
      default:
        break;
    }
  });

  on(window, 'resize', () => closeAll());

  // Hover-open support (`data-dropdown-hover`) for mega menus on desktop.
  $$('[data-dropdown-hover]', root).forEach((host) => {
    let timer;
    host.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: none)').matches) return;
      clearTimeout(timer);
      timer = setTimeout(() => open(host.querySelector('[data-dropdown-toggle]')), 90);
    });
    host.addEventListener('mouseleave', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const trigger = host.querySelector('[data-dropdown-toggle]');
        if (trigger && !host.matches(':focus-within')) close(trigger);
      }, 160);
    });
  });

  return { closeAll };
}

export const dropdown = { init: initDropdowns, open, close, closeAll, toggle };
export default dropdown;
