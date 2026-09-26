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

  /** Accordion behaviour for nested navigation - FIXED for mini/horizontal/twocol */
  initNav() {
    on(document, 'click', (event) => {
      const toggle = event.target.closest('[data-nav-toggle]');
      if (toggle) {
        const item = toggle.closest('.nav__item');
        if (!item) return;
        const root = document.documentElement;
        const isRail = root.classList.contains('sidebar-collapsed') || ['mini', 'collapse'].includes(root.dataset.layout);
        const isHorizontal = root.dataset.layout === 'horizontal';
        const isTwocol = root.dataset.layout === 'twocol';
        
        // In rail modes (mini/collapse/collapsed), toggle should open fly-out, not accordion
        if (isRail || isHorizontal || isTwocol) {
          event.preventDefault();
          event.stopPropagation();
          const isOpen = item.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', String(isOpen));
          // Close other open items at same level
          if (item.parentElement) {
            [...item.parentElement.children].forEach((sibling) => {
              if (sibling !== item && sibling.classList.contains('is-open')) {
                sibling.classList.remove('is-open');
                sibling.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
              }
            });
          }
          return;
        }
        
        event.preventDefault();
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
      // Close drawer on link click (mobile)
      if (event.target.closest('.app-sidebar a, .topnav a, .app-secondary a')) {
        // Don't prevent default - let link work
        layout.closeDrawer();
        // Close all open dropdowns in horizontal/twocol after navigation - PURE HOVER for horizontal (no remain)
        const root = document.documentElement;
        if (root.dataset.layout === 'horizontal') {
          // For horizontal: always close after click, hover only (user requested)
          document.querySelectorAll('.nav__item--has-sub.is-open').forEach((el) => {
            el.classList.remove('is-open');
            el.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
          });
        } else if (['twocol', 'mini', 'collapse'].includes(root.dataset.layout) || root.classList.contains('sidebar-collapsed')) {
          document.querySelectorAll('.nav__item--has-sub.is-open').forEach((el) => {
            // Keep active group open, close others
            if (!el.querySelector('a.is-active')) {
              el.classList.remove('is-open');
              el.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
            }
          });
        }
      }
    });
    
    // Close dropdowns when clicking outside
    on(document, 'click', (event) => {
      const root = document.documentElement;
      const isSpecialLayout = ['horizontal', 'twocol', 'mini', 'collapse'].includes(root.dataset.layout) || root.classList.contains('sidebar-collapsed');
      if (!isSpecialLayout) return;
      if (event.target.closest('.nav__item--has-sub, .app-secondary')) return;
      document.querySelectorAll('.nav__item--has-sub.is-open').forEach((el) => {
        if (!el.querySelector('a.is-active')) {
          el.classList.remove('is-open');
          el.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
        }
      });
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
        // Enhance horizontal dropdowns: add header with icon+label inside each sub
        $$('.nav__item--has-sub', clone).forEach((item) => {
          // Use direct children to avoid :scope compatibility issues
          const btn = Array.from(item.children).find(c => c.classList?.contains('nav__link'));
          const sub = Array.from(item.children).find(c => c.classList?.contains('nav__sub'));
          if (!btn || !sub) return;
          const label = btn.querySelector('.nav__label')?.textContent?.trim() ?? '';
          const icon = btn.querySelector('.nav__icon')?.innerHTML ?? '';
          if (!sub.querySelector('.topnav__dropdown-header')) {
            const count = Array.from(sub.children).filter(c => c.classList?.contains('nav__item')).length;
            const header = create('li', { class: 'topnav__dropdown-header' });
            header.innerHTML = `<span class="topnav__dropdown-icon">${icon}</span><span class="topnav__dropdown-title">${label}</span><span class="topnav__dropdown-badge">${count} آیتم</span>`;
            sub.prepend(header);
          }
          // Ensure all links inside are clickable and visible
          $$('a.nav__link', sub).forEach((a) => {
            a.style.pointerEvents = 'auto';
            a.style.display = 'flex';
            a.style.visibility = 'visible';
            a.style.opacity = '1';
          });
          // Ensure sub items are visible
          Array.from(sub.children).forEach((li) => {
            if (li.classList?.contains('nav__item')) {
              li.style.display = 'block';
              li.style.visibility = 'visible';
              li.style.opacity = '1';
            }
          });
          // Force sub to be hidden initially (will be shown on hover via CSS)
          sub.style.visibility = '';
          sub.style.opacity = '';
        });
        layout.highlightActive();
        const active = $('.nav__link.is-active', clone);
        active?.closest('.nav__item--has-sub')?.classList.add('is-open');
        // Fix links depth for topnav
        import('../core/links.js').then(m => m.fixLinks(clone)).catch(()=>{});
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
    /* Hover-opened fly-outs must also work with a keyboard - HOVERABLE LIKE MINI */
    // For horizontal, make it fully hoverable like mini: mouseenter shows, mouseleave hides with delay
    on(mount, 'mouseenter', (event) => {
      const item = event.target.closest('.nav__item--has-sub');
      if (!item) return;
      const root = document.documentElement;
      if (root.dataset.layout !== 'horizontal') return;
      // Close siblings
      [...mount.querySelectorAll('.nav__item--has-sub.is-open')].forEach((node) => {
        if (node !== item) node.classList.remove('is-open');
      });
      item.classList.add('is-open');
    }, true);
    on(mount, 'mouseleave', (event) => {
      const item = event.target.closest('.nav__item--has-sub');
      if (!item) return;
      const root = document.documentElement;
      if (root.dataset.layout !== 'horizontal') return;
      // Delay hide to allow moving to dropdown
      setTimeout(() => {
        if (!item.matches(':hover') && !item.querySelector('.nav__sub:hover')) {
          // Keep active group open if it contains active link
          if (!item.querySelector('a.is-active')) {
            item.classList.remove('is-open');
          }
        }
      }, 150);
    }, true);
    on(mount, 'click', (event) => {
      const toggle = event.target.closest('[data-nav-toggle]');
      if (!toggle) return;
      event.preventDefault();
      event.stopPropagation();
      const root = document.documentElement;
      // For horizontal: pure hover, click should NOT keep open (user requested)
      if (root.dataset.layout === 'horizontal') {
        const item = toggle.closest('.nav__item');
        if (!item) return;
        // Close all, don't keep open after click
        [...mount.querySelectorAll('.nav__item--has-sub.is-open')].forEach((node) => {
          node.classList.remove('is-open');
          node.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
        });
        return;
      }
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
      // First try to find active link's group
      const active = $('.app-sidebar .nav__link.is-active, .topnav .nav__link.is-active');
      if (active) {
        const sub = active.closest('.nav__sub');
        const group = sub?.closest('.nav__item--has-sub');
        if (group) {
          const subList = group.querySelector('.nav__sub');
          if (subList && subList.children.length) return { group, subList };
        }
      }
      // Then try open group (clicked)
      const openGroup = $('.app-sidebar .nav__item--has-sub.is-open');
      if (openGroup) {
        const subList = openGroup.querySelector('.nav__sub');
        if (subList && subList.children.length) return { group: openGroup, subList };
      }
      // Fallback: first group with children
      const firstGroup = $('.app-sidebar .nav__item--has-sub');
      if (firstGroup) {
        const subList = firstGroup.querySelector('.nav__sub');
        if (subList && subList.children.length) return { group: firstGroup, subList };
      }
      return null;
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
      const groupIconHtml = icon ? icon.outerHTML : '<i class="bi bi-collection"></i>';
      panel.setAttribute('aria-label', label);
      panel.innerHTML = `
        <div class="app-secondary__header">
          <div class="app-secondary__title"><span class="app-secondary__title-icon">${groupIconHtml}</span><span class="app-secondary__title-text">${label}</span></div>
          <div class="app-secondary__search">
            <i class="bi bi-search"></i>
            <input type="search" placeholder="جستجو..." aria-label="جستجو در ${label}" />
          </div>
        </div>
        <div class="app-secondary__body">
          <ul class="app-secondary__list"></ul>
        </div>
        <div class="app-secondary__foot">
          <span class="app-secondary__count"></span>
        </div>`;
      const list = $('.app-secondary__list', panel);
      const countEl = $('.app-secondary__count', panel);
      const searchInput = $('.app-secondary__search input', panel);
      let totalCount = 0;
      $$(':scope > .nav__item', subList).forEach((item) => {
        const link = item.querySelector('a.nav__link');
        if (!link) return;
        totalCount++;
        const li = create('li', { class: 'app-secondary__item' });
        const clone = link.cloneNode(true);
        clone.classList.add('app-secondary__link');
        clone.classList.toggle('is-active', link.classList.contains('is-active'));
        if (link.classList.contains('is-active')) clone.setAttribute('aria-current', 'page');
        else clone.removeAttribute('aria-current');
        clone.removeAttribute('data-tooltip');
        const href = link.getAttribute('href');
        if (href) clone.setAttribute('href', href);
        clone.style.pointerEvents = 'auto';
        // Enhance icon wrapper
        const iconSlot = clone.querySelector('.nav__icon');
        if (iconSlot) {
          iconSlot.classList.add('app-secondary__icon');
        } else if (icon) {
          const host = create('span', { class: 'app-secondary__icon' });
          host.innerHTML = icon.outerHTML;
          clone.prepend(host);
        }
        li.append(clone);
        list.append(li);
      });
      if (countEl) countEl.textContent = `${totalCount} آیتم`;
      // Search filtering
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const q = searchInput.value.trim().toLowerCase();
          let visible = 0;
          $$('.app-secondary__item', panel).forEach((li) => {
            const txt = li.textContent.toLowerCase();
            const show = !q || txt.includes(q);
            li.hidden = !show;
            if (show) visible++;
          });
          if (countEl) countEl.textContent = q ? `${visible} / ${totalCount}` : `${totalCount} آیتم`;
        });
      }
      setFlag(true);
      import('../core/links.js').then(m => m.fixLinks(panel)).catch(()=>{});
      $$('a', panel).forEach(a => {
        a.style.pointerEvents = 'auto';
        a.addEventListener('click', () => layout.closeDrawer());
      });
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
