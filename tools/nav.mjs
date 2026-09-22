/**
 * NOVAADMIN — navigation markup renderer (build time)
 * ------------------------------------------------------------------
 * Produces the sidebar / docs navigation markup that is *inlined into every
 * page*. Static markup means: real links for crawlers and QA tools, zero
 * layout shift, and a working "no-JS" first paint. The runtime only needs to
 * add behaviour (accordion, dropdown, active state) — never to build the DOM.
 */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `{{ROOT}}` keeps every link portable across dev server and static hosting. */
export const href = (url) => `{{ROOT}}${url}`;

function renderBadge(badge) {
  if (!badge) return '';
  return `<span class="badge badge--soft-${badge.variant} nav__badge">${esc(badge.text)}</span>`;
}

function renderLink(item, active) {
  const isActive = active === item.url;
  const label = esc(item.label.fa);
  const i18n = ` nav-${item.id}`;
  if (item.children?.length) {
    const childActive = item.children.some((c) => c.url === active);
    return `<li class="nav__item nav__item--has-sub${childActive ? ' is-open' : ''}" data-nav-item data-nav-id="${item.id}">
          <button class="nav__link" type="button" data-nav-toggle aria-expanded="${childActive ? 'true' : 'false'}">
            <span class="nav__icon"><i class="bi bi-${item.icon}" aria-hidden="true"></i></span>
            <span class="nav__label" data-i18n="nav.${item.id}">${label}</span>
            ${renderBadge(item.badge)}
            <i class="bi bi-chevron-down nav__caret" aria-hidden="true"></i>
          </button>
          <ul class="nav__sub" data-nav-sub>${item.children.map((c) => renderLink(c, active)).join('')}</ul>
        </li>`;
  }
  return `<li class="nav__item" data-nav-item data-nav-id="${item.id}">
          <a class="nav__link${isActive ? ' is-active' : ''}" href="${href(item.url)}"${isActive ? ' aria-current="page"' : ''} data-nav-link data-tooltip="${label}">
            <span class="nav__icon"><i class="bi bi-${item.icon}" aria-hidden="true"></i></span>
            <span class="nav__label" data-i18n="nav.${item.id}">${label}</span>
            ${renderBadge(item.badge)}
          </a>
        </li>`;
}

/**
 * Full sidebar navigation.
 * @param {Array} sections manifest sections ({label, items})
 * @param {string} active  url of the current page (relative, no root prefix)
 */
export function renderNav(sections, active = '', { docsOnly = false } = {}) {
  const html = sections
    .map((section) => {
      const items = section.items.filter((item) => (docsOnly ? item.id === 'docs' : true));
      if (!items.length) return '';
      const header = section.label
        ? `<li class="nav__section"${docsOnly ? ' hidden' : ''}><span data-i18n="section.${slug(section.label.en)}">${esc(section.label.fa)}</span></li>`
        : '';
      return `${header}${items.map((item) => renderLink(item, active)).join('')}`;
    })
    .join('');
  return `<ul class="nav__root">${html}</ul>`;
}

/** Flattened list of leaf pages, used by generators and QA. */
export function flatten(sections) {
  const pages = [];
  const walk = (items, trail = []) => {
    for (const item of items) {
      const path = [...trail, item];
      if (item.url) pages.push({ ...item, trail: path });
      if (item.children) walk(item.children, path);
    }
  };
  for (const section of sections) walk(section.items);
  return pages;
}

/** Breadcrumb trail (ancestors) for the active page. */
export function trailFor(sections, active) {
  const found = flatten(sections).find((p) => p.url === active);
  if (!found) return { trail: [], page: null };
  const trail = found.trail;
  return { trail, page: trail[trail.length - 1], parents: trail.slice(0, -1) };
}

export function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function renderBreadcrumbs(parents, page, labels = {}) {
  if (!parents.length) return '';
  const items = parents
    .map((p, i) => {
      const last = i === parents.length - 1;
      const text = `<span data-i18n="nav.${p.id}">${esc(labels[p.id] ?? p.label.fa)}</span>`;
      return last
        ? `<li class="breadcrumb__item" aria-current="page">${text}</li>`
        : `<li class="breadcrumb__item"><a href="${href(p.url)}">${text}</a></li>`;
    })
    .join('');
  return `<nav class="breadcrumb-nav" aria-label="مسیر صفحه"><ol class="breadcrumb">${items}<li class="breadcrumb__item" aria-current="page"><span data-i18n="nav.${page.id}">${esc(
    labels[page.id] ?? page.label.fa,
  )}</span></li></ol></nav>`;
}
