/**
 * NOVAADMIN — shell layout controller
 * ------------------------------------------------------------------
 * Owns everything about the frame around the content:
 *   • sidebar collapse/hide toggles (persisted per browser)
 *   • mobile drawer + backdrop + swipe-to-close
 *   • sub-menu accordion, active-link tracking and rail fly-outs
 *   • sticky header shadow, reading progress and back-to-top
 *   • secondary (two-column) navigation for `[data-layout='twocol']`
 */
import { $, $$, on, debounce, lockScroll } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { storage, KEYS } from './storage.js';
import { theme } from './theme.js';

const state = {
  collapsed: storage.get(KEYS.sidebarCollapsed, false),
  hidden: storage.get(KEYS.sidebarHidden, false),
  open: false,
};

function applySidebar() {
  const root = document.documentElement;
  root.classList.toggle('sidebar-collapsed', Boolean(state.collapsed));
  root.classList.toggle('sidebar-hidden', Boolean(state.hidden));
  document.body.classList.toggle('sidebar-open', Boolean(state.open));
  $$('[data-sidebar-toggle]').forEach((button) => {
    button.setAttribute('aria-expanded', String(!state.hidden));
  });
  bus.emit(EVENTS.layout, { collapsed: state.collapsed, hidden: state.hidden, open: state.open, layout: theme.get('layout') });
}

function persist() {
  storage.set(KEYS.sidebarCollapsed, state.collapsed);
  storage.set(KEYS.sidebarHidden, state.hidden);
}

export const layout = {
  state,

  toggleCollapse() {
    state.collapsed = !state.collapsed;
    state.hidden = false;
    persist();
    applySidebar();
  },

  toggleHidden() {
    state.hidden = !state.hidden;
    if (state.hidden) state.collapsed = false;
    persist();
    applySidebar();
  },

  openDrawer() {
    state.open = true;
    lockScroll(true);
    applySidebar();
  },

  closeDrawer() {
    if (!state.open) return;
    state.open = false;
    lockScroll(false);
    applySidebar();
  },

  toggleDrawer() {
    if (state.open) layout.closeDrawer();
    else layout.openDrawer();
  },

  /** Switches layout through the theme engine so it stays persisted. */
  setLayout(value) {
    theme.set('layout', value);
    state.open = false;
    applySidebar();
  },

  highlightActive() {
    const current = document.body?.dataset.page ?? '';
    if (!current) return;
    const normalized = current.replace(/^\.\//, '');
    $$('.app-sidebar a.nav__link, .topnav a.nav__link, .app-secondary a').forEach((link) => {
      const href = link.getAttribute('href') ?? '';
      if (!href || href.startsWith('#')) return;
      const clean = href.replace(/^\.\.\//, '').replace(/^\.\//, '').replace(/^\//, '');
      const isActive = clean === normalized || clean.endsWith(`/${normalized}`);
      if (!isActive) return;
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
      const item = link.closest('.nav__item');
      item?.classList.add('is-open');
      item?.parentElement?.closest('.nav__item')?.classList.add('is-open');
    });
  },

  /** Accordion behaviour for nested navigation. */
  initNav() {
    on(document, 'click', (event) => {
      const toggle = event.target.closest('[data-nav-toggle]');
      if (toggle) {
        event.preventDefault();
        const item = toggle.closest('.nav__item');
        if (!item) return;
        const isOpen = item.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        // Accordion: close sibling groups at the same level.
        if (item.parentElement?.classList.contains('nav__root') || item.parentElement?.classList.contains('nav__sub')) {
          [...item.parentElement.children].forEach((sibling) => {
            if (sibling !== item && sibling.classList.contains('is-open') && sibling.querySelector('[data-nav-toggle]')) {
              sibling.classList.remove('is-open');
              sibling.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
            }
          });
        }
        return;
      }
      if (event.target.closest('.app-sidebar a, .topnav a, .app-secondary a')) layout.closeDrawer();
    });
  },

  initBackdrop() {
    on(document, 'click', (event) => {
      if (event.target.closest('[data-sidebar-backdrop]')) layout.closeDrawer();
    });
  },

  initSwipe() {
    const sidebar = $('#app-sidebar') ?? $('[data-app-sidebar]');
    if (!sidebar) return;
    let startX = 0;
    let tracking = false;
    on(document, 'touchstart', (event) => {
      const touch = event.touches[0];
      const fromEdge = touch.clientX < 40 || (document.documentElement.dir === 'rtl' && touch.clientX > window.innerWidth - 40);
      tracking = state.open || fromEdge;
      startX = touch.clientX;
    }, { passive: true });
    on(document, 'touchend', (event) => {
      if (!tracking) return;
      const dx = (event.changedTouches[0]?.clientX ?? startX) - startX;
      const rtl = document.documentElement.dir === 'rtl';
      if (!state.open && ((rtl && dx < -60) || (!rtl && dx > 60))) layout.openDrawer();
      else if (state.open && Math.abs(dx) > 60) layout.closeDrawer();
      tracking = false;
    }, { passive: true });
  },

  initScrollEffects() {
    const header = $('.app-header');
    const progress = $('[data-scroll-progress]');
    const toTop = $('[data-back-to-top]');
    const update = () => {
      const scrollY = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header?.classList.toggle('is-scrolled', scrollY > 8);
      if (progress) progress.style.width = `${max > 0 ? Math.min(100, (scrollY / max) * 100) : 0}%`;
      if (toTop) toTop.classList.toggle('is-visible', scrollY > 480);
    };
    on(window, 'scroll', debounce(update, 40), { passive: true });
    on(toTop, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  },

  /** Enhances every table so `data-table-sticky` headers stay readable. */
  initStickyTables() {
    $$('[data-table-sticky]').forEach((node) => node.classList.add('table--sticky'));
  },

  init() {
    applySidebar();
    layout.highlightActive();
    layout.initNav();
    layout.initBackdrop();
    layout.initSwipe();
    layout.initScrollEffects();
    layout.initStickyTables();

    $$('[data-sidebar-toggle]').forEach((button) => on(button, 'click', () => layout.toggleHidden()));
    $$('[data-sidebar-collapse]').forEach((button) => on(button, 'click', () => layout.toggleCollapse()));
    $$('[data-sidebar-open]').forEach((button) => on(button, 'click', () => layout.toggleDrawer()));
    $$('[data-drawer-close]').forEach((button) => on(button, 'click', () => layout.closeDrawer()));

    // Close the mobile drawer when the viewport grows back to desktop.
    const mq = window.matchMedia('(min-width: 992px)');
    mq.addEventListener?.('change', (event) => {
      if (event.matches) layout.closeDrawer();
    });
    return layout;
  },
};

export default layout;
