/**
 * NOVAADMIN — resource factory
 * ------------------------------------------------------------------
 * `createResourceService()` wraps one collection from `src/data/*` in the
 * REST contract used everywhere in the template (list / get / create / update
 * / patch / remove) and adds the query engine the DataTable depends on:
 * search, multi-field filtering, sorting, pagination and id lookup.
 *
 * Services stay tiny because all of this lives here once:
 *
 *   export const productService = createResourceService({
 *     name: 'products',
 *     collection: () => list,
 *     searchFields: ['name', 'sku'],
 *   });
 */
import { ApiError, call } from './client.js';

const collator = new Intl.Collator(['fa', 'en'], { numeric: true, sensitivity: 'base' });

function normalise(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function matchesSearch(item, term, fields) {
  const needle = normalise(term);
  if (!needle) return true;
  return fields.some((field) => {
    const value = field.split('.').reduce((acc, key) => acc?.[key], item);
    if (Array.isArray(value)) return value.some((v) => normalise(v).includes(needle));
    return normalise(value).includes(needle);
  });
}

function matchesFilters(item, filters) {
  return Object.entries(filters ?? {}).every(([key, expected]) => {
    if (expected === '' || expected === null || expected === undefined) return true;
    const actual = key.split('.').reduce((acc, part) => acc?.[part], item);
    if (Array.isArray(expected)) return expected.length === 0 || expected.includes(actual);
    if (typeof expected === 'object' && expected.from !== undefined) {
      const at = new Date(actual).getTime();
      const from = expected.from ? new Date(expected.from).getTime() : -Infinity;
      const to = expected.to ? new Date(expected.to).getTime() : Infinity;
      return at >= from && at <= to;
    }
    if (typeof expected === 'boolean') return actual === expected;
    return normalise(actual) === normalise(expected);
  });
}

/**
 * Query engine shared by every mock-backed service.
 * @param {Array} rows  collection snapshot
 * @param {Object} query { page, perPage, search, searchFields, sort, order, filters }
 */
export function runQuery(rows, query = {}) {
  const {
    page = 1,
    perPage = 10,
    search = '',
    searchFields = [],
    sort = null,
    order = 'desc',
    filters = {},
    select = null,
  } = query;

  let items = rows.filter((row) => matchesFilters(row, filters));
  if (search) items = items.filter((row) => matchesSearch(row, search, searchFields));

  if (sort) {
    items = [...items].sort((a, b) => {
      const av = sort.split('.').reduce((acc, key) => acc?.[key], a);
      const bv = sort.split('.').reduce((acc, key) => acc?.[key], b);
      const numeric = typeof av === 'number' && typeof bv === 'number';
      const result = numeric ? av - bv : collator.compare(av ?? '', bv ?? '');
      return order === 'asc' ? result : -result;
    });
  }

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * perPage;
  const paged = items.slice(start, start + perPage);

  return {
    items: select ? paged.map((row) => select(row)) : paged,
    total,
    page: current,
    perPage,
    pages,
    hasNext: current < pages,
    hasPrev: current > 1,
  };
}

let seq = 0;
const nextId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}${(seq += 1).toString(36)}`;

/**
 * @param {Object} options
 * @param {string} options.name            REST resource name, e.g. `products`
 * @param {Function} options.collection    () => Array — usually a mock data module
 * @param {string[]} [options.searchFields]
 * @param {string[]} [options.sortFields]
 * @param {string} [options.idPrefix]
 * @param {Function} [options.extend]      (payload, query) => payload — decorate list results
 */
export function createResourceService({
  name,
  collection,
  searchFields = ['name', 'title', 'label'],
  sortFields = [],
  idPrefix = 'nv',
  extend,
} = {}) {
  /** Session-level overlay so create/update/delete actually stick while browsing. */
  /*
   * The overlay is mirrored to sessionStorage: every screen is a standalone
   * HTML page, so without it an edit or a delete was forgotten the moment the
   * visitor opened the details page or came back to the list.
   */
  const storeKey = `nova:overlay:${name}`;
  const overlay = { created: [], updated: new Map(), removed: new Set() };
  try {
    const saved = typeof sessionStorage !== 'undefined' ? JSON.parse(sessionStorage.getItem(storeKey) ?? 'null') : null;
    if (saved) {
      overlay.created = saved.created ?? [];
      overlay.updated = new Map(saved.updated ?? []);
      overlay.removed = new Set(saved.removed ?? []);
    }
  } catch {
    /* private mode / corrupted entry — start clean */
  }
  const persist = () => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify({ created: overlay.created, updated: [...overlay.updated], removed: [...overlay.removed] }));
    } catch {
      /* storage full or unavailable — the in-memory overlay still works */
    }
  };

  const snapshot = () => {
    const base = typeof collection === 'function' ? collection() : collection;
    const rows = (Array.isArray(base) ? base : []).filter((row) => !overlay.removed.has(String(row.id)));
    const patched = rows.map((row) => (overlay.updated.has(String(row.id)) ? { ...row, ...overlay.updated.get(String(row.id)) } : row));
    const created = overlay.created.map((row) => (overlay.updated.has(String(row.id)) ? { ...row, ...overlay.updated.get(String(row.id)) } : row));
    return [...created, ...patched];
  };

  const service = {
    name,
    searchFields,
    sortFields,

    /** GET /resource */
    async list(query = {}) {
      const resolver = () => {
        const result = runQuery(snapshot(), { searchFields, ...query });
        return extend ? { ...result, ...extend(result, query) } : result;
      };
      return call('list', name, { query, resolver });
    },

    /** GET /resource/:id */
    async get(id, options = {}) {
      const resolver = () => {
        const row = snapshot().find((item) => String(item.id) === String(id));
        if (!row) throw new ApiError('مورد درخواستی یافت نشد.', { status: 404, code: 'not_found' });
        return row;
      };
      return call('get', name, { id, resolver, signal: options.signal });
    },

    /** POST /resource */
    async create(payload) {
      const resolver = () => {
        const row = {
          id: payload.id ?? nextId(idPrefix),
          createdAt: payload.createdAt ?? new Date().toISOString(),
          ...payload,
        };
        overlay.created.unshift(row);
        persist();
        return row;
      };
      return call('create', name, { body: payload, resolver });
    },

    /** PUT /resource/:id */
    async update(id, payload) {
      const resolver = () => {
        const collectionRows = snapshot();
        const current = collectionRows.find((item) => String(item.id) === String(id));
        if (!current) throw new ApiError('مورد درخواستی یافت نشد.', { status: 404, code: 'not_found' });
        const next = { ...current, ...payload, id: current.id, updatedAt: new Date().toISOString() };
        overlay.updated.set(String(current.id), next);
        persist();
        return next;
      };
      return call('update', name, { id, body: payload, resolver });
    },

    /** PATCH /resource/:id — partial update, keeps untouched keys. */
    async patch(id, payload) {
      return service.update(id, payload);
    },

    /** DELETE /resource/:id */
    async remove(id) {
      const resolver = () => {
        const exists = snapshot().some((item) => String(item.id) === String(id));
        if (!exists) throw new ApiError('مورد درخواستی یافت نشد.', { status: 404, code: 'not_found' });
        overlay.created = overlay.created.filter((row) => String(row.id) !== String(id));
        overlay.updated.delete(String(id));
        overlay.removed.add(String(id));
        persist();
        return { id, deleted: true };
      };
      return call('remove', name, { id, resolver });
    },

    /** Bulk delete used by DataTable row-selection toolbars. */
    async removeMany(ids = []) {
      const results = await Promise.all(ids.map((id) => service.remove(id)));
      return { deleted: results.length, ids };
    },

    /** Lightweight lookup helper for `<select>` inputs. */
    async options({ valueField = 'id', labelField = 'name', query = {} } = {}) {
      const { items } = await service.list({ perPage: 500, ...query });
      return items.map((item) => ({ value: item[valueField], label: item[labelField] }));
    },

    /** Restores the mock overlay — used by demos and “reset demo data”. */
    reset() {
      overlay.created = [];
      overlay.updated.clear();
      overlay.removed.clear();
      persist();
    },

    get size() {
      return snapshot().length;
    },
  };

  return service;
}

export default createResourceService;
