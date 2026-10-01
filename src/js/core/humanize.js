/**
 * NOVAADMIN — raw value humanizer
 * ------------------------------------------------------------------
 * Controllers render mock data straight from the service layer, and a few
 * surfaces (badges, info rows, select options) used to print raw enum keys such
 * as `paid`, `on-hold` or `industry`. This pass maps any such leaf to its Persian
 * label from the shared dictionaries so a raw key never reaches the screen,
 * including rows added later (paging, filters, live updates).
 */
import { STATUS_LABELS, FIELD_LABELS } from './record-dialogs.js';

const RAW = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/i;
const lookup = (text) => STATUS_LABELS[text] ?? STATUS_LABELS[text.toLowerCase()] ?? STATUS_LABELS[text.replace(/_/g, '-')] ?? null;
const lang = () => document.documentElement.lang || 'fa';

function humanizeNode(root) {
  if (lang() !== 'fa' || !root?.querySelectorAll) return;
  root.querySelectorAll('.badge, [class*="badge--"], .status-pill').forEach((el) => {
    if (el.children.length > 1 || el.dataset.raw === 'keep') return;
    const textNode = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!textNode) return;
    const text = textNode.textContent.trim();
    if (!RAW.test(text)) return;
    const label = lookup(text);
    if (label) {
      textNode.textContent = textNode.textContent.replace(text, label);
      el.dataset.value = text;
    }
  });
  root.querySelectorAll('.info-row__label, dt').forEach((el) => {
    const text = el.textContent.trim();
    if (el.children.length || !RAW.test(text)) return;
    const label = FIELD_LABELS[text];
    if (label) el.textContent = label;
  });
  root.querySelectorAll('.info-row__value').forEach((el) => {
    const text = el.textContent.trim();
    if (el.children.length || !RAW.test(text)) return;
    const label = lookup(text);
    if (label) el.textContent = label;
  });
  root.querySelectorAll('select option').forEach((el) => {
    const text = el.textContent.trim();
    if (text !== el.value || !RAW.test(text)) return;
    const label = lookup(text);
    if (label) el.textContent = label;
  });
}

let observer = null;
let frame = 0;
export function humanize(root = document) {
  try {
    humanizeNode(root);
  } catch {
    /* Cosmetic pass — never break a page. */
  }
}

export function observeHumanize(root = document.body) {
  if (observer || !root || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      humanize(document.querySelector('main') ?? document);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
}

export default { humanize, observeHumanize };
