/**
 * NOVAADMIN — Kanban board
 * ------------------------------------------------------------------
 * Drag & drop board used by tasks, CRM pipeline and any other columned view.
 * SortableJS provides the pointer handling; this module owns the data contract
 * (`data-kanban` root + `data-kanban-column` / `data-kanban-card` children),
 * optimistic reordering, WIP counters and the `kanban:move` event.
 *
 * Markup contract
 *   <div data-kanban data-kanban-resource="tasks">
 *     <div class="kanban__column" data-kanban-column="in-progress">
 *       <div class="kanban__body" data-kanban-body>
 *         <article class="kanban-card" data-kanban-card data-id="tsk-1">…</article>
 *       </div>
 *       <div class="kanban__foot"><button data-kanban-add>…</button></div>
 *     </div>
 *   </div>
 */
import { $$, on, debounce } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { toast } from './toast.js';
import { formatNumber } from './numbers.js';

const boards = new WeakMap();

export async function initKanban(root) {
  if (!root || boards.has(root)) return boards.get(root);
  const Sortable = (await import('sortablejs')).default;
  const options = {
    resource: root.dataset.kanbanResource ?? 'tasks',
    onMove: root.dataset.kanbanOnMove ? window[String(root.dataset.kanbanOnMove).replace(/^window\./, '')] : null,
    columns: [],
    sortables: [],
  };
  boards.set(root, options);

  const columns = $$('[data-kanban-column]', root);
  columns.forEach((column) => {
    const body = column.querySelector('[data-kanban-body]');
    if (!body) return;
    const sortable = Sortable.create(body, {
      group: options.resource,
      animation: 160,
      easing: 'cubic-bezier(.2,.7,.3,1)',
      ghostClass: 'kanban-card--ghost',
      dragClass: 'kanban-card--dragging',
      chosenClass: 'kanban-card--chosen',
      handle: '[data-kanban-handle]',
      fallbackOnBody: true,
      swapThreshold: 0.6,
      delay: 60,
      delayOnTouchOnly: true,
      onStart: () => root.classList.add('is-dragging'),
      onEnd: ({ item, to, from, newIndex }) => {
        root.classList.remove('is-dragging');
        const id = item.dataset.id;
        const status = to.closest('[data-kanban-column]')?.dataset.kanbanColumn;
        const previous = from.closest('[data-kanban-column]')?.dataset.kanbanColumn;
        refreshColumn(from);
        refreshColumn(to);
        if (!id || !status) return;
        const payload = { id, status, position: newIndex, previousStatus: previous, resource: options.resource };
        bus.emit('kanban:move', payload);
        if (typeof options.onMove === 'function') options.onMove(payload);
        else persist(root, payload);
      },
    });
    options.sortables.push(sortable);
    options.columns.push({ id: column.dataset.kanbanColumn, node: column, sortable });
  });

  // Add-card buttons create a real card in the column (mock mode: local only).
  $$('[data-kanban-add]', root).forEach((button) => {
    on(button, 'click', () => addCard(root, button));
  });

  $$('[data-kanban-filter]', root).forEach((input) => {
    on(
      input,
      'input',
      debounce(() => filter(root, input.value), 160),
    );
  });

  refreshAll(root);
  return options;
}

function refreshColumn(column) {
  const body = column.querySelector('[data-kanban-body]');
  if (!body) return;
  const count = $$('[data-kanban-card]', body).length;
  const countNode = column.querySelector('[data-kanban-count]');
  if (countNode) countNode.textContent = formatNumber(count);
  const sum = $$('[data-kanban-card]', body).reduce((total, card) => total + Number(card.dataset.value ?? 0), 0);
  const sumNode = column.querySelector('[data-kanban-sum]');
  if (sumNode && sum) {
    sumNode.textContent = formatNumber(sum, { });
    sumNode.hidden = false;
  }
  body.parentElement?.classList.toggle('is-empty', count === 0);
}

function refreshAll(root) {
  $$('[data-kanban-column]', root).forEach(refreshColumn);
}

/** Client-side search across card titles — mirrors server-side filtering. */
function filter(root, term) {
  const needle = String(term ?? '').trim().toLowerCase();
  $$('[data-kanban-card]', root).forEach((card) => {
    const haystack = card.textContent.toLowerCase();
    card.hidden = Boolean(needle) && !haystack.includes(needle);
  });
  refreshAll(root);
}

async function persist(root, payload) {
  const module = await import('../../services/project.service.js');
  try {
    await module.kanbanService.move(payload.id, payload.status, payload.position);
    bus.emit(EVENTS.dataChanged, { scope: 'kanban', resource: payload.resource });
  } catch (error) {
    toast({ type: 'danger', title: 'جابجایی ذخیره نشد', text: error.message });
  }
}

function addCard(root, button) {
  const column = button.closest('[data-kanban-column]');
  const body = column?.querySelector('[data-kanban-body]');
  if (!body) return;
  const template = document.getElementById('kanban-card-template');
  const title = window.prompt('عنوان کارت جدید را وارد کنید:', 'کارت بدون عنوان');
  if (!title) return;
  const node = template
    ? template.content.firstElementChild.cloneNode(true)
    : document.createElement('article');
  node.classList.add('kanban-card');
  node.dataset.kanbanCard = '';
  node.dataset.id = `local-${Date.now()}`;
  node.innerHTML = `<div class="kanban-card__head"><span class="badge badge--soft-primary">جدید</span></div><h4 class="kanban-card__title">${title.replace(/</g, '&lt;')}</h4>`;
  body.append(node);
  refreshColumn(column);
  toast({ type: 'success', title: 'کارت اضافه شد', text: `«${title}» به ستون جاری اضافه شد.` });
  bus.emit('kanban:add', { id: node.dataset.id, title, column: column.dataset.kanbanColumn });
}

export const kanban = { init: initKanban, refresh: refreshAll, filter, add: addCard };
export default kanban;
