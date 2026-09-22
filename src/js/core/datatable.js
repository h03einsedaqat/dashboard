/**
 * NOVAADMIN — DataTable
 * ------------------------------------------------------------------
 * One component powers every list, report and detail table in the template:
 * remote-style search, multi-select filters, sortable columns, pagination,
 * column visibility, row selection with bulk actions, CSV/Excel/print export,
 * loading skeletons, empty and error states — plus localStorage preferences.
 *
 * Declarative markup (columns are read from the table head):
 *
 *   <div data-datatable data-resource="orders" data-per-page="10">
 *     <div data-datatable-toolbar></div>           ← optional custom toolbar
 *     <table class="table">
 *       <thead><tr>
 *         <th data-column="number" data-type="primary" data-sortable>شماره</th>
 *         <th data-column="total"  data-type="currency" data-sortable>مبلغ</th>
 *       </tr></thead>
 *       <tbody data-datatable-body></tbody>
 *     </table>
 *     <div data-datatable-foot></div>
 *   </div>
 *
 * Programmatic usage:
 *   import { createDataTable } from '../core/datatable.js';
 *   createDataTable(node, { resource: 'products', perPage: 12 });
 */
import { $, $$, on, create, render, escapeHtml, debounce } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { toast } from './toast.js';
import { modal } from './modal.js';
import { storage } from './storage.js';
import { formatCurrency, formatNumber, formatPercent, toDigits, parseNumber } from './numbers.js';
import { formatDate, relativeTime } from './jalali.js';
import * as services from '../../services/index.js';

const tables = new WeakMap();

const STATUS_TONES = {
  active: 'success', completed: 'success', paid: 'success', delivered: 'success', success: 'success', done: 'success', resolved: 'success', won: 'success', published: 'success', approved: 'success', present: 'success', operational: 'success',
  pending: 'warning', processing: 'info', in_progress: 'primary', 'in-progress': 'primary', review: 'warning', paused: 'warning', trialing: 'info', partial: 'warning', late: 'warning', delayed: 'warning', scheduled: 'info', draft: 'neutral', negotiating: 'warning',
  cancelled: 'danger', canceled: 'danger', failed: 'danger', overdue: 'danger', rejected: 'danger', blocked: 'danger', churned: 'danger', lost: 'danger', returned: 'danger', refunded: 'neutral', expired: 'neutral', archived: 'neutral', closed: 'neutral', inactive: 'neutral', suspended: 'danger', terminated: 'danger', void: 'neutral', unpaid: 'warning', 'on-hold': 'warning', 'at-risk': 'warning', critical: 'danger', urgent: 'danger',
};

function toneFor(value) {
  const key = String(value ?? '').toLowerCase().replace(/\s+/g, '-');
  return STATUS_TONES[key] ?? 'neutral';
}

/* ------------------------------------------------------------------ renderers */
const renderers = {
  text: (row, column) => escapeHtml(resolve(row, column) ?? '—'),
  primary: (row, column) => {
    const primary = resolve(row, column) ?? '—';
    const sub = column.sub && resolve(row, column.sub);
    const avatar = column.avatar && resolve(row, column.avatar);
    return `<div class="table__primary">
      ${avatar ? `<img class="avatar avatar--sm" src="${escapeHtml(avatar)}" alt="" loading="lazy" />` : ''}
      <div class="table__primary-text"><span class="table__primary-title">${escapeHtml(primary)}</span>${sub ? `<span class="table__primary-sub">${escapeHtml(sub)}</span>` : ''}</div>
    </div>`;
  },
  currency: (row, column) => `<span class="numeric">${formatCurrency(resolve(row, column) ?? 0, column.currency ?? 'IRR', { compact: Boolean(column.compact) })}</span>`,
  number: (row, column) => `<span class="numeric">${formatNumber(resolve(row, column) ?? 0)}</span>`,
  percent: (row, column) => {
    const value = Number(resolve(row, column) ?? 0);
    const trend = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    return `<span class="trend trend--${trend}">${column.raw ? formatPercent(value, { sign: true }) : escapeHtml(resolve(row, column))}</span>`;
  },
  badge: (row, column) => {
    const value = resolve(row, column);
    const label = column.labels?.[value] ?? value ?? '—';
    return `<span class="badge badge--soft-${toneFor(value)}">${escapeHtml(label)}</span>`;
  },
  status: (row, column) => {
    const value = resolve(row, column);
    const label = column.labels?.[value] ?? resolve(row, column.label) ?? value ?? '—';
    return `<span class="status-dot status-dot--${toneFor(value)}"><span>${escapeHtml(label)}</span></span>`;
  },
  avatar: (row, column) => {
    const src = resolve(row, column) ?? 'assets/img/avatars/avatar-01.svg';
    const name = column.name ? resolve(row, column.name) : '';
    return `<img class="avatar avatar--sm" src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy" />`;
  },
  avatars: (row, column) => {
    const list = resolve(row, column) ?? [];
    return `<div class="avatar-group">${list.slice(0, 3).map((item) => `<img class="avatar avatar--xs" src="${escapeHtml(item.avatar ?? item)}" alt="" loading="lazy" />`).join('')}${list.length > 3 ? `<span class="avatar avatar--xs avatar--soft-primary">+${toDigits(list.length - 3)}</span>` : ''}</div>`;
  },
  progress: (row, column) => {
    const value = Number(resolve(row, column) ?? 0);
    const tone = column.tone ?? (value >= 100 ? 'success' : value < 30 ? 'danger' : 'primary');
    return `<div class="table__progress"><div class="progress progress--sm"><div class="progress-bar progress-bar--${tone}" style="width:${Math.min(100, value)}%"></div></div><span class="numeric">${formatPercent(value, { decimals: 0 })}</span></div>`;
  },
  date: (row, column) => `<span class="numeric">${formatDate(resolve(row, column), { format: column.format ?? 'short' })}</span>`,
  relative: (row, column) => `<span title="${escapeHtml(formatDate(resolve(row, column), { format: 'long' }))}">${relativeTime(resolve(row, column))}</span>`,
  rating: (row, column) => {
    const value = Number(resolve(row, column) ?? 0);
    return `<span class="rating rating--readonly" aria-label="${toDigits(value)} از ۵">${Array.from({ length: 5 }, (_, i) => `<i class="bi bi-star${i < Math.round(value) ? '-fill' : ''}" aria-hidden="true"></i>`).join('')}</span>`;
  },
  tags: (row, column) => {
    const list = resolve(row, column) ?? [];
    return list.slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ') || '—';
  },
  thumbnail: (row, column) => `<img class="table__thumb" src="${escapeHtml(resolve(row, column))}" alt="" loading="lazy" />`,
  link: (row, column) => {
    const url = (column.href ?? '').replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(resolve(row, key) ?? ''));
    return `<a class="table__link" href="${escapeHtml(url)}">${escapeHtml(resolve(row, column) ?? '—')}</a>`;
  },
  actions: (row, column) => {
    const url = (column.href ?? '').replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(resolve(row, key) ?? ''));
    return `<div class="table__actions">
      ${url ? `<a class="icon-btn icon-btn--sm" href="${escapeHtml(url)}" title="مشاهده" aria-label="مشاهده"><i class="bi bi-eye" aria-hidden="true"></i></a>` : ''}
      <button type="button" class="icon-btn icon-btn--sm" data-row-edit title="ویرایش" aria-label="ویرایش"><i class="bi bi-pencil" aria-hidden="true"></i></button>
      <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-row-delete title="حذف" aria-label="حذف"><i class="bi bi-trash3" aria-hidden="true"></i></button>
    </div>`;
  },
};

function resolve(row, column) {
  if (typeof column === 'string') return column.split('.').reduce((acc, key) => acc?.[key], row);
  if (column.field) return column.field.split('.').reduce((acc, key) => acc?.[key], row);
  return undefined;
}

/** Parses `data-columns` / `<th>` definitions into column objects. */
function readColumns(root) {
  const json = root.dataset.columns;
  if (json) {
    try {
      return JSON.parse(json);
    } catch (error) {
      console.warn('[nova:datatable] data-columns is not valid JSON', error);
    }
  }
  return $$('th[data-column]', root).map((th) => ({
    key: th.dataset.column,
    label: th.textContent.trim(),
    type: th.dataset.type ?? 'text',
    sortable: th.hasAttribute('data-sortable'),
    field: th.dataset.field ?? th.dataset.column,
    sub: th.dataset.sub,
    avatar: th.dataset.avatar,
    labels: th.dataset.labels ? JSON.parse(th.dataset.labels) : undefined,
    href: th.dataset.href,
    hidden: th.hasAttribute('data-hidden'),
    align: th.dataset.align,
  }));
}

/** Human-readable column header cell for the generated `<thead>`. */
function headCell(column) {
  const classes = [column.sortable ? 'is-sortable' : '', column.align === 'end' ? 'text-end' : ''].filter(Boolean).join(' ');
  return `<th data-column="${column.key}" data-type="${column.type}" ${column.sortable ? 'data-sortable' : ''} class="${classes}" ${column.hidden ? 'data-hidden' : ''}>${escapeHtml(column.label)}</th>`;
}

export function createDataTable(root, options = {}) {
  if (!root) return null;
  if (tables.has(root)) return tables.get(root);

  const resource = options.resource ?? root.dataset.resource ?? 'orders';
  const service = options.service ?? services.default[resource] ?? services.orderService;
  const perPageOptions = [10, 20, 50, 100];
  const columns = options.columns ?? readColumns(root);
  const prefsKey = `table:${resource}`;
  const saved = storage.get(prefsKey, {});

  const instance = {
    root,
    resource,
    service,
    columns,
    state: {
      page: 1,
      perPage: Number(root.dataset.perPage ?? saved.perPage ?? options.perPage ?? perPageOptions[0]),
      search: '',
      sort: saved.sort ?? options.sort ?? null,
      order: saved.order ?? options.order ?? 'desc',
      filters: saved.filters ?? options.filters ?? {},
      hidden: saved.hidden ?? columns.filter((c) => c.hidden).map((c) => c.key),
      selected: new Set(),
      status: 'idle',
      rows: [],
      total: 0,
      pages: 1,
    },
  };
  tables.set(root, instance);

  buildShell(instance);
  bindEvents(instance);
  attachLoad(instance);
  instance.load();
  return instance;
}

/** Creates the toolbar / body / footer scaffolding when the page omits it. */
function buildShell(instance) {
  const { root, columns } = instance;
  const body = $('[data-datatable-body]', root);
  if (!body) {
    const table = $('table', root) ?? root.appendChild(create('table', { class: 'table table--hover' }));
    if (!$('thead', table)) {
      table.append(create('thead', { html: `<tr>${columns.map(headCell).join('')}</tr>` }));
    } else if (!$('thead th[data-column]', table)) {
      $('thead tr', table).innerHTML = columns.map(headCell).join('');
    }
    if (!$('tbody', table)) table.append(create('tbody', { dataset: { datatableBody: '' } }));
  }
  const selectable = root.dataset.selectable !== 'false';
  const headRow = $('thead tr', root);
  if (selectable && headRow && !$('[data-select-all]', headRow)) {
    const th = create('th', {
      class: 'cell--select',
      html: '<input type="checkbox" class="form-check-input" data-select-all aria-label="انتخاب همه ردیف‌ها" />',
    });
    headRow.prepend(th);
  }

  if (!$('[data-datatable-toolbar]', root) && instance.root.dataset.toolbar !== 'false') {
    root.prepend(
      create('div', {
        class: 'datatable__toolbar',
        html: `
          ${instance.root.dataset.search === 'false' ? '' : `<div class="datatable__search"><i class="bi bi-search" aria-hidden="true"></i><input type="search" class="form-control" data-datatable-search placeholder="جستجو…" aria-label="جستجو در جدول" /></div>`}
          <div class="datatable__toolbar-actions">
            <div data-datatable-filters class="datatable__filters"></div>
            <div class="dropdown">
              <button type="button" class="btn btn-light btn-sm" data-dropdown-toggle aria-expanded="false"><i class="bi bi-layout-three-columns" aria-hidden="true"></i><span>ستون‌ها</span></button>
              <div class="dropdown-menu dropdown-menu--end" data-dropdown-menu><div class="column-picker" data-datatable-columns></div></div>
            </div>
            <div class="dropdown">
              <button type="button" class="btn btn-light btn-sm" data-dropdown-toggle aria-expanded="false"><i class="bi bi-download" aria-hidden="true"></i><span>خروجی</span></button>
              <div class="dropdown-menu dropdown-menu--end" data-dropdown-menu>
                <button type="button" class="dropdown-item" data-export="csv"><i class="bi bi-filetype-csv" aria-hidden="true"></i>CSV</button>
                <button type="button" class="dropdown-item" data-export="excel"><i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i>اکسل</button>
                <button type="button" class="dropdown-item" data-export="print"><i class="bi bi-printer" aria-hidden="true"></i>چاپ</button>
              </div>
            </div>
          </div>`,
      }),
    );
  } else if (!$('[data-datatable-search]', root) && instance.root.dataset.search !== 'false') {
    const host = $('[data-datatable-toolbar]', root);
    host?.prepend(
      create('div', { class: 'datatable__search', html: '<i class="bi bi-search" aria-hidden="true"></i><input type="search" class="form-control" data-datatable-search placeholder="جستجو…" aria-label="جستجو در جدول" />' }),
    );
  }

  if (!$('[data-datatable-foot]', root) && instance.root.dataset.pagination !== 'false') {
    root.append(create('div', { class: 'datatable__foot', dataset: { datatableFoot: '' } }));
  }

  // Wrap the table so it can scroll horizontally on small screens.
  const table = $('table', root);
  if (table && !table.parentElement?.classList.contains('table-wrap')) {
    const wrap = create('div', { class: 'table-wrap', dataset: { datatableWrap: '' } });
    table.parentElement.insertBefore(wrap, table);
    wrap.append(table);
  }
  renderColumnsPicker(instance);
  renderFilters(instance);
}

function renderColumnsPicker(instance) {
  const host = $('[data-datatable-columns]', instance.root);
  if (!host) return;
  render(
    host,
    `${instance.columns
      .map(
        (column) => `<label class="form-check form-check--sm">
          <input type="checkbox" class="form-check-input" data-column-toggle="${column.key}" ${instance.state.hidden.includes(column.key) ? '' : 'checked'} />
          <span class="form-check-label">${escapeHtml(column.label)}</span>
        </label>`,
      )
      .join('')}
     <button type="button" class="btn btn-ghost btn-sm w-100 mt-2" data-columns-reset>بازنشانی ستون‌ها</button>`,
  );
}

function renderFilters(instance) {
  const host = $('[data-datatable-filters]', instance.root);
  if (!host) return;
  const config = instance.root.dataset.filters;
  if (!config) {
    host.remove();
    return;
  }
  const specs = config.split(',').map((entry) => {
    const [field, rawOptions] = entry.split(':');
    return { field: field.trim(), options: (rawOptions ?? '').split('|').map((option) => option.trim()).filter(Boolean) };
  });
  render(
    host,
    specs
      .map(
        (spec) => `<select class="form-select form-select-sm" data-datatable-filter="${spec.field}" aria-label="فیلتر ${spec.field}">
          <option value="">همه ${escapeHtml(spec.field)}</option>
          ${spec.options.map((option) => `<option value="${escapeHtml(option)}" ${instance.state.filters[spec.field] === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
        </select>`,
      )
      .join(''),
  );
}

function bindEvents(instance) {
  const { root } = instance;

  const search = $('[data-datatable-search]', root);
  if (search) {
    search.value = instance.state.search;
    on(search, 'input', debounce(() => {
      instance.state.search = search.value.trim();
      instance.state.page = 1;
      instance.load();
    }, 260));
  }

  on(root, 'click', (event) => {
    const sortHeader = event.target.closest('th[data-sortable]');
    if (sortHeader) {
      const key = sortHeader.dataset.column;
      if (instance.state.sort === key) instance.state.order = instance.state.order === 'asc' ? 'desc' : 'asc';
      else {
        instance.state.sort = key;
        instance.state.order = 'asc';
      }
      instance.state.page = 1;
      persist(instance);
      instance.load();
      return;
    }

    const pageLink = event.target.closest('[data-page]');
    if (pageLink) {
      const target = pageLink.dataset.page;
      const next = target === 'first' ? 1 : target === 'last' ? instance.state.pages : Number(target);
      instance.state.page = Math.min(Math.max(1, next), instance.state.pages);
      instance.load();
      return;
    }

    const exportButton = event.target.closest('[data-export]');
    if (exportButton) {
      instance.export(exportButton.dataset.export);
      return;
    }

    const bulkDelete = event.target.closest('[data-bulk-delete]');
    if (bulkDelete) {
      instance.removeSelected();
      return;
    }

    const clearSelection = event.target.closest('[data-clear-selection]');
    if (clearSelection) {
      instance.state.selected.clear();
      syncSelection(instance);
      return;
    }

    const rowDelete = event.target.closest('[data-row-delete]');
    if (rowDelete) {
      const row = rowDelete.closest('tr');
      instance.removeRow(row?.dataset.id);
      return;
    }

    const rowEdit = event.target.closest('[data-row-edit]');
    if (rowEdit) {
      const row = rowEdit.closest('tr');
      bus.emit('datatable:edit', { id: row?.dataset.id, resource: instance.resource, table: instance });
    }
  });

  on(root, 'change', (event) => {
    const columnToggle = event.target.closest('[data-column-toggle]');
    if (columnToggle) {
      const key = columnToggle.dataset.columnToggle;
      instance.state.hidden = columnToggle.checked ? instance.state.hidden.filter((c) => c !== key) : [...new Set([...instance.state.hidden, key])];
      applyColumnVisibility(instance);
      persist(instance);
      return;
    }
    const perPage = event.target.closest('[data-per-page]');
    if (perPage) {
      instance.state.perPage = Number(perPage.value);
      instance.state.page = 1;
      persist(instance);
      instance.load();
      return;
    }
    const filter = event.target.closest('[data-datatable-filter]');
    if (filter) {
      const value = filter.value;
      const field = filter.dataset.datatableFilter;
      if (value) instance.state.filters[field] = value;
      else delete instance.state.filters[field];
      instance.state.page = 1;
      persist(instance);
      instance.load();
      return;
    }
    const selectAll = event.target.closest('[data-select-all]');
    if (selectAll) {
      const checkboxes = $$('[data-row-select]', root);
      checkboxes.forEach((box) => {
        box.checked = selectAll.checked;
        if (selectAll.checked) instance.state.selected.add(box.value);
        else instance.state.selected.delete(box.value);
      });
      syncSelection(instance);
      return;
    }
    const rowBox = event.target.closest('[data-row-select]');
    if (rowBox) {
      if (rowBox.checked) instance.state.selected.add(rowBox.value);
      else instance.state.selected.delete(rowBox.value);
      syncSelection(instance);
    }
  });

  on($('[data-columns-reset]', root), 'click', () => {
    instance.state.hidden = [];
    $$('[data-column-toggle]', root).forEach((box) => {
      box.checked = true;
    });
    applyColumnVisibility(instance);
    persist(instance);
  });
}

function persist(instance) {
  storage.set(`table:${instance.resource}`, {
    perPage: instance.state.perPage,
    sort: instance.state.sort,
    order: instance.state.order,
    filters: instance.state.filters,
    hidden: instance.state.hidden,
  });
}

function applyColumnVisibility(instance) {
  const { state } = instance;
  $$('th[data-column]', instance.root).forEach((th) => {
    th.hidden = state.hidden.includes(th.dataset.column);
  });
  $$('tbody td[data-cell]', instance.root).forEach((cell) => {
    cell.hidden = state.hidden.includes(cell.dataset.cell);
  });
}

/** Loads one page of data — with real loading / error / empty states. */
function attachLoad(instance) {
  instance.load = async () => {
    const body = $('[data-datatable-body]', instance.root) ?? $('tbody', instance.root);
    instance.state.status = 'loading';
    renderState(instance, 'loading');
    try {
      const query = {
        page: instance.state.page,
        perPage: instance.state.perPage,
        search: instance.state.search,
        sort: instance.state.sort,
        order: instance.state.order,
        filters: instance.state.filters,
      };
      const result = await instance.service.list(query);
      const rows = result?.items ?? result ?? [];
      instance.state.rows = rows;
      instance.state.total = result?.total ?? rows.length;
      instance.state.pages = result?.pages ?? Math.max(1, Math.ceil(instance.state.total / instance.state.perPage));
      instance.state.page = result?.page ?? instance.state.page;
      renderRows(instance, rows);
      renderFoot(instance, result ?? {});
      applyColumnVisibility(instance);
      syncSelection(instance);
      instance.state.status = rows.length ? 'ready' : 'empty';
      renderState(instance, instance.state.status);
      bus.emit(EVENTS.tableRefreshed, { resource: instance.resource, table: instance, result });
    } catch (error) {
      instance.state.status = 'error';
      renderState(instance, 'error', error);
      console.error('[nova:datatable]', error);
    }
  };

  instance.reload = () => {
    instance.state.selected.clear();
    return instance.load();
  };

  instance.removeRow = async (id) => {
    if (!id) return;
    const ok = await modal.confirm({ title: 'حذف مورد', text: 'این مورد برای همیشه حذف می‌شود. ادامه می‌دهید؟', tone: 'danger', confirmText: 'حذف کن' });
    if (!ok) return;
    try {
      await instance.service.remove(id);
      toast.success('حذف شد', 'مورد انتخاب‌شده حذف گردید.');
      instance.state.selected.delete(String(id));
      await instance.load();
      bus.emit(EVENTS.dataChanged, { resource: instance.resource, action: 'delete', id });
    } catch (error) {
      toast.danger('حذف نشد', error.message);
    }
  };

  instance.removeSelected = async () => {
    const ids = [...instance.state.selected];
    if (!ids.length) return;
    const ok = await modal.confirm({ title: 'حذف موارد انتخاب‌شده', text: `${toDigits(ids.length)} مورد حذف خواهد شد. ادامه می‌دهید؟`, tone: 'danger', confirmText: 'حذف کن' });
    if (!ok) return;
    try {
      if (instance.service.removeMany) await instance.service.removeMany(ids);
      else await Promise.all(ids.map((id) => instance.service.remove(id)));
      instance.state.selected.clear();
      toast.success('انجام شد', `${toDigits(ids.length)} مورد حذف شد.`);
      await instance.load();
      bus.emit(EVENTS.dataChanged, { resource: instance.resource, action: 'bulk-delete', ids });
    } catch (error) {
      toast.danger('عملیات انجام نشد', error.message);
    }
  };

  instance.export = (format = 'csv') => {
    const rows = instance.state.rows;
    if (!rows.length) {
      toast.warning('داده‌ای برای خروجی نیست', 'ابتدا فیلترها را تغییر دهید.');
      return;
    }
    if (format === 'print') {
      window.print();
      toast.info('نسخه چاپی', 'پنجره چاپ سیستم باز شد.');
      return;
    }
    const visible = instance.columns.filter((column) => !instance.state.hidden.includes(column.key) && column.type !== 'actions');
    const header = visible.map((column) => `"${column.label}"`).join(',');
    const body = rows
      .map((row) => visible.map((column) => `"${String(resolve(row, column) ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const csv = format === 'excel' ? `\ufeff${header}\n${body}` : `${header}\n${body}`;
    const blob = new Blob([csv], { type: format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = create('a', { href: url, download: `${instance.resource}-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xls' : 'csv'}` });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('فایل خروجی آماده شد', `${toDigits(rows.length)} ردیف در قالب ${format.toUpperCase()} ذخیره شد.`);
  };
}

function renderRows(instance, rows) {
  const { columns } = instance;
  const body = $('[data-datatable-body]', instance.root) ?? $('tbody', instance.root);
  if (!body) return;
  const selectable = instance.root.dataset.selectable !== 'false';
  const markup = rows
    .map((row, index) => {
      const cells = columns
        .map((column) => {
          const renderer = renderers[column.type] ?? renderers.text;
          const align = column.align === 'end' ? ' text-end' : '';
          const value = renderer(row, column);
          return `<td class="cell--${column.type}${align}" data-cell="${escapeHtml(column.key)}" ${column.hidden ? 'hidden' : ''}>${value}</td>`;
        })
        .join('');
      return `<tr data-id="${escapeHtml(row.id)}" data-index="${index}">
        ${selectable ? `<td class="cell--select"><input type="checkbox" class="form-check-input" data-row-select value="${escapeHtml(row.id)}" aria-label="انتخاب ردیف ${index + 1}" /></td>` : ''}
        ${cells}
      </tr>`;
    })
    .join('');
  render(body, markup);
  $$('tr', body).forEach((tr) => {
    if (instance.root.dataset.clickable === 'false') return;
    on(tr, 'dblclick', () => bus.emit('datatable:open', { id: tr.dataset.id, resource: instance.resource }));
  });
}

function renderFoot(instance, result) {
  const foot = $('[data-datatable-foot]', instance.root);
  const { state } = instance;
  const total = state.total;
  const from = total === 0 ? 0 : (state.page - 1) * state.perPage + 1;
  const to = Math.min(total, state.page * state.perPage);

  if (foot) {
    const pages = state.pages;
    const windowSize = 5;
    let start = Math.max(1, state.page - Math.floor(windowSize / 2));
    const end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, Math.min(start, Math.max(1, end - windowSize + 1)));
    const numbers = [];
    for (let i = start; i <= end; i += 1) numbers.push(i);

    render(
      foot,
      `<div class="datatable__info">${total === 0 ? 'موردی برای نمایش نیست' : `نمایش ${toDigits(from)} تا ${toDigits(to)} از ${toDigits(total)} مورد`}</div>
      <div class="datatable__pager">
        <select class="form-select form-select-sm page-size" data-per-page aria-label="تعداد ردیف در صفحه">
          ${[10, 20, 50, 100].map((size) => `<option value="${size}" ${size === state.perPage ? 'selected' : ''}>${toDigits(size)} ردیف</option>`).join('')}
        </select>
        <nav class="pagination" role="navigation" aria-label="صفحه‌بندی">
          <button type="button" class="page-item ${state.page === 1 ? 'disabled' : ''}" data-page="first" aria-label="صفحه اول"><i class="bi bi-chevron-double-right" aria-hidden="true"></i></button>
          <button type="button" class="page-item ${state.page === 1 ? 'disabled' : ''}" data-page="${state.page - 1}" aria-label="قبلی"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
          ${numbers.map((number) => `<button type="button" class="page-item ${number === state.page ? 'is-active' : ''}" data-page="${number}" ${number === state.page ? 'aria-current="page"' : ''}>${toDigits(number)}</button>`).join('')}
          <button type="button" class="page-item ${state.page >= pages ? 'disabled' : ''}" data-page="${state.page + 1}" aria-label="بعدی"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
          <button type="button" class="page-item ${state.page >= pages ? 'disabled' : ''}" data-page="last" aria-label="صفحه آخر"><i class="bi bi-chevron-double-left" aria-hidden="true"></i></button>
        </nav>
      </div>`,
    );
  }
  applyColumnVisibility(instance);
}

function renderState(instance, status, error) {
  const host = $('[data-datatable-wrap]', instance.root) ?? $('.table-wrap', instance.root) ?? instance.root;
  let overlay = $('[data-datatable-state]', instance.root);
  if (!overlay) {
    overlay = create('div', { class: 'datatable__state', dataset: { datatableState: '' } });
    host.append(overlay);
  }
  if (status === 'ready') {
    overlay.hidden = true;
    instance.root.classList.remove('is-loading', 'is-empty', 'is-error');
    return;
  }
  overlay.hidden = false;
  instance.root.classList.toggle('is-loading', status === 'loading');
  instance.root.classList.toggle('is-empty', status === 'empty');
  instance.root.classList.toggle('is-error', status === 'error');

  if (status === 'loading') {
    render(overlay, `<div class="datatable__loading" aria-live="polite"><span class="spinner spinner--sm" aria-hidden="true"></span><span>در حال دریافت داده‌ها…</span></div>`);
    return;
  }
  if (status === 'empty') {
    render(
      overlay,
      `<div class="empty-state empty-state--sm"><span class="empty-state__icon" aria-hidden="true"><i class="bi bi-inbox"></i></span>
        <h3 class="empty-state__title">نتیجه‌ای یافت نشد</h3>
        <p class="empty-state__text">عبارت جستجو یا فیلترها را تغییر دهید تا نتایج بیشتری ببینید.</p>
        <div class="empty-state__actions"><button type="button" class="btn btn-light btn-sm" data-clear-filters>پاک کردن فیلترها</button></div></div>`,
    );
    on($('[data-clear-filters]', overlay), 'click', () => {
      instance.state.search = '';
      instance.state.filters = {};
      instance.state.page = 1;
      const search = $('[data-datatable-search]', instance.root);
      if (search) search.value = '';
      $$('[data-datatable-filter]', instance.root).forEach((select) => {
        select.value = '';
      });
      instance.load();
    });
    return;
  }
  render(
    overlay,
    `<div class="state-error"><span class="state-error__icon" aria-hidden="true"><i class="bi bi-exclamation-triangle"></i></span>
      <h3 class="state-error__title">خطا در دریافت داده‌ها</h3>
      <p class="state-error__text">${escapeHtml(error?.message ?? 'ارتباط با سرویس برقرار نشد.')}</p>
      <button type="button" class="btn btn-primary btn-sm" data-retry>تلاش دوباره</button></div>`,
  );
  on($('[data-retry]', overlay), 'click', () => instance.load());
}

function syncSelection(instance) {
  const selectionBar = $('[data-datatable-selection]', instance.root);
  const count = instance.state.selected.size;
  if (selectionBar) {
    selectionBar.hidden = count === 0;
    const label = $('[data-selection-count]', selectionBar);
    if (label) label.textContent = `${toDigits(count)} مورد انتخاب شده`;
  }
  const selectAll = $('[data-select-all]', instance.root);
  if (selectAll) {
    const boxes = $$('[data-row-select]', instance.root);
    selectAll.checked = boxes.length > 0 && boxes.every((box) => box.checked);
    selectAll.indeterminate = !selectAll.checked && boxes.some((box) => box.checked);
  }
  bus.emit(EVENTS.tableSelection, { resource: instance.resource, ids: [...instance.state.selected] });
}

/** Boots every declarative table on the page. */
export function initDataTables(root = document) {
  return $$('[data-datatable]', root).map((node) => createDataTable(node));
}

export const datatable = { create: createDataTable, init: initDataTables, renderers, resolve, toneFor };

export default datatable;
