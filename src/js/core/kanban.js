/**
 * NOVAADMIN — Kanban board (v1.1)
 * ------------------------------------------------------------------
 * Drag & drop board used by the project kanban, the CRM pipeline and any
 * other columned view.
 *
 *  - The whole card is the drag surface (buttons/links inside it still work).
 *  - SortableJS runs in fallback mode, so mouse, pen and touch get the same
 *    floating card, the same drop placeholder and the same auto-scroll of the
 *    board / column while dragging near an edge.
 *  - On touch, a short press (160ms) picks the card up — a normal swipe keeps
 *    scrolling the board.
 *  - The target column is highlighted, counters and stage totals update live,
 *    the dropped card flashes, and the move can be undone from the toast.
 *  - Every card also has a «move to…» menu (keyboard and one-hand friendly).
 *
 * Markup contract
 *   <div data-kanban data-kanban-resource="tasks" [data-kanban-persist="false"]>
 *     <div class="kanban__column" data-kanban-column="in-progress" data-kanban-label="در حال انجام">
 *       <div class="kanban__body" data-kanban-body>
 *         <article class="kanban-card" data-kanban-card data-id="tsk-1">…</article>
 *       </div>
 *       <div class="kanban__foot"><button data-kanban-add>…</button></div>
 *     </div>
 *   </div>
 *
 * Events: `kanban:move` on the bus with
 *   { id, status, previousStatus, previous, position, previousPosition, resource, undo }
 * When `data-kanban-persist="false"` the page owns persistence (it listens to
 * the bus); otherwise the board saves through the project kanban service.
 */
import { $$, on, debounce, escapeHtml } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { toast } from './toast.js';
import { formatNumber, formatCurrency } from './numbers.js';
import { createSortable } from './dragdrop.js';

const boards = new WeakMap();
const IGNORE = 'button, a, input, select, textarea, label, [contenteditable], .dropdown-menu';

const columnOf = (node) => node?.closest?.('[data-kanban-column]') ?? null;
const bodyOf = (column) => column?.querySelector('[data-kanban-body]') ?? null;
const labelOf = (column) =>
  column?.dataset.kanbanLabel || column?.querySelector('.kanban__title')?.textContent.trim() || column?.dataset.kanbanColumn || '';
const cardsIn = (body) => $$('[data-kanban-card]', body);

export async function initKanban(root) {
  if (!root || boards.has(root)) return boards.get(root);
  const options = {
    resource: root.dataset.kanbanResource ?? 'tasks',
    persist: root.dataset.kanbanPersist !== 'false',
    onMove: root.dataset.kanbanOnMove ? window[String(root.dataset.kanbanOnMove).replace(/^window\./, '')] : null,
    sortables: [],
  };
  boards.set(root, options);

  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  let origin = null;

  const bodies = $$('[data-kanban-column]', root).map(bodyOf).filter(Boolean);
  const created = await Promise.all(
    bodies.map((body) =>
      createSortable(body, {
        group: `kanban-${options.resource}`,
        draggable: '[data-kanban-card]',
        filter: IGNORE,
        preventOnFilter: false,
        animation: 180,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackClass: 'kanban-card--floating',
        fallbackTolerance: 4,
        ghostClass: 'kanban-card--placeholder',
        chosenClass: 'kanban-card--chosen',
        delay: coarse ? 160 : 0,
        delayOnTouchOnly: true,
        touchStartThreshold: 6,
        emptyInsertThreshold: 28,
        swapThreshold: 0.65,
        scroll: true,
        bubbleScroll: true,
        scrollSensitivity: 90,
        scrollSpeed: 16,
        onChoose: () => navigator.vibrate?.(8),
        onStart: ({ item, from, oldIndex }) => {
          origin = { column: columnOf(from), index: oldIndex };
          root.classList.add('is-dragging');
          columnOf(from)?.classList.add('is-source');
          item.setAttribute('aria-grabbed', 'true');
          closeMenus(root);
        },
        onMove: ({ to }) => {
          const target = columnOf(to);
          $$('.kanban__column.is-over', root).forEach((column) => column !== target && column.classList.remove('is-over'));
          target?.classList.add('is-over');
          return true;
        },
        onChange: () => refreshAll(root),
        onEnd: ({ item, to, from, newIndex, oldIndex }) => {
          root.classList.remove('is-dragging');
          item.removeAttribute('aria-grabbed');
          $$('.kanban__column.is-over, .kanban__column.is-source', root).forEach((column) => column.classList.remove('is-over', 'is-source'));
          refreshAll(root);
          if (from === to && newIndex === oldIndex) return;
          commitMove(root, item, { fromColumn: columnOf(from), toColumn: columnOf(to), oldIndex: origin?.index ?? oldIndex, newIndex });
          origin = null;
        },
      }),
    ),
  );
  options.sortables = created.filter(Boolean);
  root.classList.toggle('kanban--dnd', options.sortables.length > 0);

  enhanceCards(root);

  on(root, 'click', (event) => {
    const trigger = event.target.closest('[data-kanban-move]');
    if (trigger) {
      event.preventDefault();
      toggleMenu(root, trigger);
      return;
    }
    const target = event.target.closest('[data-kanban-move-to]');
    if (target) {
      const card = target.closest('[data-kanban-card]');
      const toColumn = root.querySelector(`[data-kanban-column="${CSS.escape(target.dataset.kanbanMoveTo)}"]`);
      closeMenus(root);
      if (card && toColumn) moveCard(root, card, toColumn, 0);
      return;
    }
    if (!event.target.closest('.kanban-menu')) closeMenus(root);
  });
  on(document, 'keydown', (event) => {
    if (event.key === 'Escape') closeMenus(root);
  });

  $$('[data-kanban-add]', root).forEach((button) => on(button, 'click', () => addCard(root, button)));
  $$('[data-kanban-filter]', root).forEach((input) => on(input, 'input', debounce(() => filter(root, input.value), 160)));

  refreshAll(root);
  return options;
}

/** Adds the «move to» trigger to every card that does not have one yet. */
function enhanceCards(root) {
  cardsIn(root).forEach((card) => {
    if (card.querySelector('[data-kanban-move]')) return;
    const legacy = card.querySelector('[data-kanban-handle]');
    const title = card.querySelector('.kanban-card__title')?.textContent.trim() ?? '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-btn icon-btn--sm kanban-card__move';
    button.dataset.kanbanMove = '';
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `انتقال «${title}» به ستون دیگر`);
    button.title = 'انتقال به…';
    button.innerHTML = '<i class="bi bi-three-dots" aria-hidden="true"></i>';
    if (legacy) legacy.replaceWith(button);
    else (card.querySelector('.kanban-card__head') ?? card).append(button);
  });
}

function closeMenus(root) {
  $$('.kanban-menu', root).forEach((menu) => menu.remove());
  $$('[data-kanban-move][aria-expanded="true"]', root).forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function toggleMenu(root, trigger) {
  const open = trigger.getAttribute('aria-expanded') === 'true';
  closeMenus(root);
  if (open) return;
  const card = trigger.closest('[data-kanban-card]');
  const current = columnOf(card);
  const menu = document.createElement('div');
  menu.className = 'kanban-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `<p class="kanban-menu__title">انتقال به</p>${$$('[data-kanban-column]', root)
    .map((column) => {
      const id = column.dataset.kanbanColumn;
      const dot = column.querySelector('.status-dot')?.className ?? 'status-dot';
      const here = column === current;
      return `<button type="button" role="menuitem" class="kanban-menu__item${here ? ' is-current' : ''}" data-kanban-move-to="${escapeHtml(id)}" ${here ? 'disabled aria-disabled="true"' : ''}><span class="${escapeHtml(dot)}" aria-hidden="true"></span>${escapeHtml(labelOf(column))}${here ? '<i class="bi bi-check2" aria-hidden="true"></i>' : ''}</button>`;
    })
    .join('')}`;
  card.append(menu);
  trigger.setAttribute('aria-expanded', 'true');
  menu.querySelector('.kanban-menu__item:not([disabled])')?.focus({ preventScroll: true });
}

/** Programmatic move (menu, undo) — same bookkeeping as a drag. */
function moveCard(root, card, toColumn, index = 0, { silent = false } = {}) {
  const fromColumn = columnOf(card);
  const toBody = bodyOf(toColumn);
  if (!toBody || !fromColumn) return;
  const oldIndex = cardsIn(bodyOf(fromColumn)).indexOf(card);
  const siblings = cardsIn(toBody).filter((node) => node !== card);
  const ref = siblings[index] ?? null;
  toBody.insertBefore(card, ref);
  refreshAll(root);
  if (!silent) {
    commitMove(root, card, { fromColumn, toColumn, oldIndex, newIndex: cardsIn(toBody).indexOf(card) });
    card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

function commitMove(root, card, { fromColumn, toColumn, oldIndex, newIndex }) {
  const options = boards.get(root) ?? {};
  const id = card.dataset.id;
  const status = toColumn?.dataset.kanbanColumn;
  const previousStatus = fromColumn?.dataset.kanbanColumn;
  flash(card);
  if (!id || !status) return;
  const undo = () => {
    if (!fromColumn) return;
    moveCard(root, card, fromColumn, oldIndex, { silent: true });
    flash(card);
    const payload = { id, status: previousStatus, previousStatus: status, previous: status, position: oldIndex, previousPosition: newIndex, resource: options.resource, reverted: true };
    bus.emit('kanban:move', payload);
    if (typeof options.onMove === 'function') options.onMove(payload);
    else if (options.persist) persist(payload);
  };
  const payload = { id, status, previousStatus, previous: previousStatus, position: newIndex, previousPosition: oldIndex, resource: options.resource, undo, statusLabel: labelOf(toColumn), previousLabel: labelOf(fromColumn) };
  bus.emit('kanban:move', payload);
  if (typeof options.onMove === 'function') options.onMove(payload);
  else if (options.persist) persist(payload);
}

function flash(card) {
  card.classList.remove('kanban-card--dropped');
  // Restart the animation even on consecutive drops.
  void card.offsetWidth;
  card.classList.add('kanban-card--dropped');
  setTimeout(() => card.classList.remove('kanban-card--dropped'), 900);
}

function refreshColumn(column) {
  const body = bodyOf(column);
  if (!body) return;
  const cards = cardsIn(body).filter((card) => !card.classList.contains('kanban-card--floating'));
  const visible = cards.filter((card) => !card.hidden);
  const countNode = column.querySelector('[data-kanban-count]');
  if (countNode) countNode.textContent = formatNumber(visible.length);
  const sum = visible.reduce((total, card) => total + Number(card.dataset.value ?? 0), 0);
  const sumNode = column.querySelector('[data-kanban-sum]');
  if (sumNode) {
    sumNode.textContent = sum ? formatCurrency(sum, 'IRR', { compact: true }) : '';
    sumNode.hidden = !sum;
  }
  column.classList.toggle('is-empty', visible.length === 0);
}

function refreshAll(root) {
  $$('[data-kanban-column]', root).forEach(refreshColumn);
}

/** Client-side search across card titles — mirrors server-side filtering. */
function filter(root, term) {
  const needle = String(term ?? '').trim().toLowerCase();
  cardsIn(root).forEach((card) => {
    card.hidden = Boolean(needle) && !card.textContent.toLowerCase().includes(needle);
  });
  refreshAll(root);
}

async function persist(payload) {
  const module = await import('../../services/project.service.js');
  try {
    await module.kanbanService.move(payload.id, payload.status, payload.position);
    bus.emit(EVENTS.dataChanged, { scope: 'kanban', resource: payload.resource });
  } catch (error) {
    toast({ type: 'danger', title: 'جابجایی ذخیره نشد', text: error.message });
  }
}

function addCard(root, button) {
  const column = columnOf(button);
  const body = bodyOf(column);
  if (!body) return;
  const title = window.prompt('عنوان کارت جدید را وارد کنید:', 'کارت بدون عنوان');
  if (!title || !title.trim()) return;
  const node = document.createElement('article');
  node.className = 'kanban-card';
  node.dataset.kanbanCard = '';
  node.dataset.id = `local-${Date.now()}`;
  node.innerHTML = `<div class="kanban-card__head"><span class="badge badge--soft-primary">جدید</span></div><p class="kanban-card__title">${escapeHtml(title.trim())}</p>`;
  body.prepend(node);
  enhanceCards(root);
  refreshColumn(column);
  flash(node);
  toast({ type: 'success', title: 'کارت اضافه شد', text: `«${title.trim()}» به ستون «${labelOf(column)}» اضافه شد.` });
  bus.emit('kanban:add', { id: node.dataset.id, title: title.trim(), column: column.dataset.kanbanColumn });
}

export const kanban = { init: initKanban, refresh: refreshAll, filter, add: addCard, move: moveCard };
export default kanban;
