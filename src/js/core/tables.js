/**
 * NOVAADMIN — responsive tables
 * ------------------------------------------------------------------
 * Every `table.table` in the app gets two guarantees on small screens:
 *
 *   1. it can never push its card (or the page) wider than the viewport —
 *      tables that were not already inside a scroll container are wrapped in
 *      `.table-wrap`;
 *   2. on phones (< 576px) rows become stacked «record cards»: each cell shows
 *      its column label next to its value, the first real column is the card
 *      title, the row checkbox sits in the corner and the action buttons form
 *      the card footer. Nothing is cut off and nothing needs a sideways swipe.
 *
 * Labels come from the table head, so authored tables, generated tables and
 * DataTable rows all behave the same way. Rows that are re-rendered later
 * (paging, sorting, filters) are labelled by a single batched observer.
 *
 * Opt out per table with `class="table--no-stack"` or `data-stack="false"`.
 */

const ENHANCED = 'tableEnhanced';
const SKIP_SELECTOR = '.table--no-stack, [data-stack="false"], .calendar__grid table, .apexcharts-canvas table';

function isScrollContainer(node) {
  if (!node || node.nodeType !== 1 || !node.classList) return false;
  if (node.classList.contains('table-wrap') || node.classList.contains('table-responsive')) return true;
  const style = getComputedStyle(node);
  return /(auto|scroll)/.test(style.overflowX);
}

function ensureWrapped(table) {
  const parent = table.parentElement;
  if (!parent || isScrollContainer(parent)) return;
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  parent.insertBefore(wrap, table);
  wrap.append(table);
}

/** Header labels per visual column (colspan aware). */
function headLabels(table) {
  const row = table.tHead?.rows?.[table.tHead.rows.length - 1];
  if (!row) return null;
  const labels = [];
  Array.from(row.cells).forEach((cell) => {
    const text = (cell.dataset.label || cell.textContent || '').replace(/\s+/g, ' ').trim();
    const span = Math.max(1, Number(cell.colSpan) || 1);
    const isSelect = cell.classList.contains('cell--select') || Boolean(cell.querySelector('input[type="checkbox"]'));
    for (let i = 0; i < span; i += 1) labels.push({ text, isSelect });
  });
  return labels;
}

function isActionCell(td, label) {
  if (td.classList.contains('cell--actions') || td.dataset.cell === 'actions') return true;
  const hasControls = td.querySelector('button, a.icon-btn, a.btn, .dropdown');
  if (!hasControls) return false;
  const text = td.textContent.replace(/\s+/g, '').trim();
  return !label?.text || text.length === 0 || /^(عملیات|actions|الإجراءات)$/i.test(label?.text ?? '');
}

function labelRow(tr, labels) {
  if (tr.dataset.stacked === '1') return;
  const cells = Array.from(tr.cells ?? tr.children ?? []);
  if (cells.length === 1 && cells[0].colSpan > 1) {
    cells[0].classList.add('cell--full');
    tr.dataset.stacked = '1';
    return;
  }
  let primaryAssigned = false;
  let col = 0;
  cells.forEach((td) => {
    const label = labels?.[col];
    col += Math.max(1, Number(td.colSpan) || 1);
    if (td.classList.contains('cell--select') || label?.isSelect || (td.querySelector('input[type="checkbox"][data-row-select]') && td.textContent.trim() === '')) {
      td.classList.add('cell--select');
      return;
    }
    if (!td.hasAttribute('data-label') && label?.text) td.setAttribute('data-label', label.text);
    if (isActionCell(td, label)) {
      td.classList.add('cell--row-actions');
      return;
    }
    if (!primaryAssigned && !td.hidden) {
      td.classList.add('cell--stack-title');
      primaryAssigned = true;
    }
  });
  tr.dataset.stacked = '1';
}

function enhanceTable(table) {
  if (!table || table.tagName !== 'TABLE') return;
  if (table.closest(SKIP_SELECTOR) || table.matches(SKIP_SELECTOR)) return;
  if (!table.dataset[ENHANCED]) {
    ensureWrapped(table);
    table.classList.add('table--stack');
    table.dataset[ENHANCED] = '1';
  }
  const labels = headLabels(table);
  Array.from(table.tBodies ?? table.querySelectorAll('tbody')).forEach((body) => Array.from(body.rows ?? body.querySelectorAll('tr')).forEach((tr) => labelRow(tr, labels)));
}

export function enhanceTables(root = document) {
  const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
  if (scope.tagName === 'TABLE') {
    enhanceTable(scope);
    return;
  }
  scope.querySelectorAll('table.table, table.ais-table').forEach(enhanceTable);
}

let observer = null;
let queued = false;

/** Labels rows added later (DataTable paging, filters, live updates). */
export function observeTables(root = document.body) {
  if (observer || !root || typeof MutationObserver === 'undefined') return observer;
  observer = new MutationObserver((mutations) => {
    if (queued) return;
    const relevant = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) => node.nodeType === 1 && (node.tagName === 'TR' || node.tagName === 'TABLE' || node.tagName === 'TBODY' || node.querySelector?.('table, tr'))),
    );
    if (!relevant) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceTables(document);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

export default { enhanceTables, observeTables };
