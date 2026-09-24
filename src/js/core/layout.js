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
import { $, $$, create, on, debounce, lockScroll } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { storage, KEYS } from './storage.js';
import { theme } from './theme.js';

/** True below the `lg` breakpoint, where the sidebar becomes a drawer. */
const isMobile = () => window.matchMedia('(max-width: 991.98px)').matches;

const state = {
  collapsed: storage.get(KEYS.sidebarCollapsed, false),
  hidden: storage.get(KEYS.sidebarHidden, false),
  open: false,
};

function applySidebar() {
  const root = document.documentElement;
  /* On a phone `.sidebar-hidden` would leave no navigation at all. */
  if (isMobile()) state.hidden = false;
  root.classList.toggle('sidebar-collapsed', Boolean(state.collapsed));
  root.classList.toggle('sidebar-hidden', Boolean(state.hidden));
  document.body.classList.toggle('sidebar-open', Boolean(state.open));
  const mobile = isMobile();
  $$('[data-sidebar-toggle]').forEach((button) => {
    button.setAttribute('aria-expanded', String(mobile ? state.open : !state.hidden));
    const label = mobile ? button.dataset.labelOpen : button.dataset.labelClose;
    if (label) button.setAttribute('aria-label', label);
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
  /**
   * Horizontal layout: the top navigation row.
   *
   * The header ships an empty `<div class="topnav" data-nav-mount hidden>` slot
   * that nothing used to fill — picking "افقی" in the customizer therefore
   * removed the sidebar and left *no navigation at all* behind. The row is now
   * built from the sidebar's own `<ul class="nav__root">` (a clone, so all the
   * active-link, tooltip and accordion wiring keeps working) whenever the
   * horizontal layout is active.
   */
  initTopNav() {
    const group = $('[data-topnav-group]');
    const mount = $('[data-nav-mount]');
    if (!group || !mount) return null;
    const source = $('.app-sidebar .nav__root');

    const sync = () => {
      const isHorizontal = document.documentElement.dataset.layout === 'horizontal';
      group.hidden = !isHorizontal;
      if (!isHorizontal) {
        mount.innerHTML = '';
        return;
      }
      if (!mount.children.length && source) {
        const clone = source.cloneNode(true);
        clone.classList.add('nav--top');
        clone.removeAttribute('id');
        mount.append(clone);
        layout.highlightActive();
        /** The group the current page belongs to starts open. */
        const active = $('.nav__link.is-active', clone);
        active?.closest('.nav__item--has-sub')?.classList.add('is-open');
      }
      /** A horizontal shell never has a rail to collapse: hide those buttons. */
      $$('[data-sidebar-collapse], [data-sidebar-toggle]').forEach((button) => {
        if (isHorizontal) button.setAttribute('data-layout-hidden', '');
        else button.removeAttribute('data-layout-hidden');
      });
    };

    sync();
    bus.on(EVENTS.layout, sync);
    bus.on(EVENTS.language, () => window.setTimeout(() => {
      mount.innerHTML = '';
      sync();
    }, 60));
    /* Hover-opened fly-outs must also work with a keyboard. */
    on(mount, 'click', (event) => {
      const toggle = event.target.closest('[data-nav-toggle]');
      if (!toggle) return;
      const item = toggle.closest('.nav__item');
      if (!item) return;
      [...mount.querySelectorAll('.nav__item--has-sub.is-open')].forEach((node) => {
        if (node !== item) node.classList.remove('is-open');
      });
      item.classList.toggle('is-open');
    });
    return mount;
  },

  /**
   * Two-column layout: a secondary panel next to the content that lists the
   * children of the group the current page belongs to.
   *
   * The panel is built from the sidebar that already ships with the page, so it
   * always matches the manifest — no second source of truth to keep in sync —
   * and it is rebuilt whenever the layout or the language changes (labels are
   * cloned *after* the translator has run, so they arrive translated).
   *
   * `html.has-secondary` tells the stylesheet that the panel really exists: the
   * three-column grid may only be applied then, otherwise a page whose group has
   * no children kept a phantom 15rem empty column next to the content.
   */
  initSecondaryNav() {
    const shell = $('[data-app-shell]');
    if (!shell) return;
    const isTwocol = () => document.documentElement.dataset.layout === 'twocol';
    let panel = $('.app-secondary', shell);

    const setFlag = (on_) => document.documentElement.classList.toggle('has-secondary', Boolean(on_));

    const close = () => {
      panel?.remove();
      panel = null;
      setFlag(false);
    };

    const activeGroup = () => {
      const active = $('.app-sidebar .nav__link.is-active, .topnav .nav__link.is-active');
      const sub = active?.closest('.nav__sub');
      const group = sub?.closest('.nav__item--has-sub') ?? $('.app-sidebar .nav__item--has-sub.is-open');
      if (!group) return null;
      const subList = group.querySelector('.nav__sub');
      if (!subList || !subList.children.length) return null;
      return { group, subList };
    };

    const build = () => {
      if (!isTwocol()) {
        close();
        return;
      }
      const data = activeGroup();
      if (!data) {
        close();
        /* A two-column layout without a secondary panel must fall back to the
           plain one, otherwise the content sits in a squeezed third of the
           screen with a blank column beside it. */
        document.documentElement.classList.add('twocol-fallback');
        return;
      }
      document.documentElement.classList.remove('twocol-fallback');
      const { group, subList } = data;
      if (!panel) {
        panel = create('aside', {
          class: 'app-secondary',
          dataset: { appSecondary: '' },
          role: 'navigation',
        });
        const main = $('.app-main', shell);
        shell.insertBefore(panel, main ?? null);
      }
      const label = group.querySelector(':scope > .nav__link .nav__label')?.textContent.trim() ?? '';
      const icon = group.querySelector(':scope > .nav__link .nav__icon i');
      panel.setAttribute('aria-label', label);
      panel.innerHTML = `
        <p class="app-secondary__title">${label}</p>
        <ul class="app-secondary__list"></ul>`;
      const list = $('.app-secondary__list', panel);
      $$(':scope > .nav__item', subList).forEach((item) => {
        const link = item.querySelector('a.nav__link');
        if (!link) return;
        const li = create('li', { class: 'app-secondary__item' });
        const clone = link.cloneNode(true);
        clone.classList.add('app-secondary__link');
        clone.classList.toggle('is-active', link.classList.contains('is-active'));
        if (link.classList.contains('is-active')) clone.setAttribute('aria-current', 'page');
        else clone.removeAttribute('aria-current');
        // The rail tooltip is meaningless in a full-width list.
        clone.removeAttribute('data-tooltip');
        const iconSlot = clone.querySelector('.nav__icon i');
        if (!iconSlot && icon) {
          const host = create('span', { class: 'app-secondary__icon' });
          host.innerHTML = icon.outerHTML;
          clone.prepend(host);
        }
        li.append(clone);
        list.append(li);
      });
      // Keep the group header icon for visual continuity with the sidebar.
      if (icon) panel.querySelector('.app-secondary__title')?.prepend(icon.cloneNode(true));
      setFlag(true);
      /** A panel that ended up with a single entry is not worth its column. */
      if (!$$('.app-secondary__link', panel).length) close();
    };

    build();
    bus.on(EVENTS.layout, build);
    bus.on(EVENTS.language, () => window.setTimeout(build, 60));
    on(document, 'click', (event) => {
      if (event.target.closest('[data-nav-toggle]')) window.setTimeout(build, 30);
    });
  },

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
    layout.initSecondaryNav();
    layout.initTopNav();

    /**
     * One hamburger, two behaviours: below `lg` the sidebar is an off-canvas
     * drawer that has to be opened (and closed), above it the same button
     * removes the rail from the flow. Before this the mobile button only ever
     * *hid* the sidebar, so a phone had no way to reach the navigation.
     */
    $$('[data-sidebar-toggle]').forEach((button) => on(button, 'click', () => (isMobile() ? layout.toggleDrawer() : layout.toggleHidden())));

    // A drawer that was left open during a resize must not lock scrolling.
    window.matchMedia('(min-width: 992px)').addEventListener?.('change', (event) => {
      if (event.matches) layout.closeDrawer();
    });
    $$('[data-sidebar-collapse]').forEach((button) => on(button, 'click', () => layout.toggleCollapse()));
    $$('[data-sidebar-open]').forEach((button) => on(button, 'click', () => layout.toggleDrawer()));
    $$('[data-drawer-close]').forEach((button) => on(button, 'click', () => layout.closeDrawer()));

    return layout;
  },
};

export default layout;
