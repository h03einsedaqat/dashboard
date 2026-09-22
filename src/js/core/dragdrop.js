/**
 * NOVAADMIN — drag & drop loader
 * ------------------------------------------------------------------
 * SortableJS is the only third-party DOM library this template needs. Every
 * drag surface (kanban columns, calendar slots, sortable lists, widget
 * customiser) goes through this module so a single decision point controls how
 * the dependency is loaded and what happens when it is not available.
 *
 * Design goals:
 *  - One shared import promise: the library is fetched once per page, no matter
 *    how many sortable areas the page has.
 *  - Never throw. A missing or broken drag library disables the interaction and
 *    logs a warning; the page keeps working (click/keyboard paths stay alive).
 *  - Accept only real DOM elements, so a bad selector cannot take the page down.
 *
 * Usage:
 *   import { createSortable } from '../core/dragdrop.js';
 *   const sortable = await createSortable(column, { group: 'nova-kanban' });
 */

let sortablePromise = null;

/** Loads SortableJS once, resolving to `null` when it cannot be used. */
export function loadSortable() {
  if (!sortablePromise) {
    sortablePromise = import('sortablejs')
      .then((mod) => mod?.default ?? mod ?? null)
      .catch((error) => {
        console.warn('[nova:dnd] sortablejs is unavailable — drag & drop stays disabled', error);
        return null;
      });
  }
  return sortablePromise;
}

const isElement = (value) => Boolean(value) && typeof value === 'object' && value.nodeType === 1 && typeof value.appendChild === 'function';

/**
 * Makes `element` sortable.
 * @param {Element} element target container
 * @param {Object} [options] SortableJS options
 * @returns {Promise<Object|null>} the Sortable instance, or `null` when skipped
 */
export async function createSortable(element, options = {}) {
  if (!isElement(element)) return null;
  const Sortable = await loadSortable();
  if (!Sortable || typeof Sortable.create !== 'function') return null;
  try {
    return Sortable.create(element, options);
  } catch (error) {
    console.warn('[nova:dnd] this container could not be made sortable', error);
    return null;
  }
}

/** Convenience wrapper: makes every element in `elements` sortable. */
export async function createSortables(elements, options = {}) {
  const list = Array.from(elements ?? []).filter(isElement);
  const created = await Promise.all(list.map((element) => createSortable(element, options)));
  return created.filter(Boolean);
}
