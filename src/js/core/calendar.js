/**
 * NOVAADMIN — calendar component PRO - single unified month view
 * Clean, professional, no clutter. Only month view with mini calendar sidebar.
 */
import { $, $$, on, render, escapeHtml } from './dom.js';
import { bus, EVENTS } from './bus.js';
import { toast } from './toast.js';
import { modal } from './modal.js';
import * as jdate from './jalali.js';
import { toDigits, formatNumber } from './numbers.js';

const state = new WeakMap();

export async function initCalendar(root) {
  if (!root || state.has(root)) return state.get(root);
  const instance = {
    root,
    view: 'month',
    cursor: new Date(),
    events: [],
    categories: [],
    filters: new Set(),
    resource: root.dataset.calendarResource ?? 'calendar',
  };
  state.set(root, instance);

  const { calendarService } = await import('../../services/app.service.js');
  const [events, categories] = await Promise.all([
    calendarService.list({ from: jdate.addDays(instance.cursor, -45), to: jdate.addDays(instance.cursor, 60) }).catch(()=>[]),
    calendarService.categories().catch(()=>[
      { id:'work', label:'کاری', tone:'primary' },
      { id:'meeting', label:'جلسه', tone:'info' },
      { id:'deadline', label:'ددلاین', tone:'danger' },
      { id:'personal', label:'شخصی', tone:'success' },
    ]),
  ]);
  instance.events = events;
  instance.categories = categories;

  bindControls(instance);
  paint(instance);
  return instance;
}

function bindControls(instance) {
  const { root } = instance;
  on(root, 'click', (event) => {
    const nav = event.target.closest('[data-calendar-prev], [data-calendar-next], [data-calendar-today]');
    if (nav) {
      const isPrev = nav.hasAttribute('data-calendar-prev');
      const isNext = nav.hasAttribute('data-calendar-next');
      const isToday = nav.hasAttribute('data-calendar-today');
      if (isToday) instance.cursor = new Date();
      else instance.cursor = jdate.addMonths(instance.cursor, isPrev ? -1 : 1);
      paint(instance);
      return;
    }
    const cat = event.target.closest('[data-calendar-category], [data-cat]');
    if (cat) {
      const id = cat.dataset.calendarCategory || cat.dataset.cat;
      if (!id) return;
      if (instance.filters.has(id)) instance.filters.delete(id);
      else instance.filters.add(id);
      // toggle visual
      $$('[data-calendar-category], [data-cat]', root).forEach(el => {
        const eid = el.dataset.calendarCategory || el.dataset.cat;
        if (eid === id) el.classList.toggle('is-active', instance.filters.has(id) || instance.filters.size===0);
      });
      // If no filter active, show all
      if (instance.filters.size === 0) {
        $$('[data-calendar-category], [data-cat]', root).forEach(el => el.classList.add('is-active'));
      }
      paint(instance);
      return;
    }
    const slot = event.target.closest('[data-calendar-slot]');
    if (slot && !event.target.closest('[data-calendar-event]')) {
      openEventModal(instance, { startAt: slot.dataset.calendarSlot });
      return;
    }
    const ev = event.target.closest('[data-calendar-event]');
    if (ev) {
      const found = instance.events.find((e) => e.id === ev.dataset.calendarEvent);
      if (found) openEventModal(instance, found);
    }
  });
}

function visibleEvents(instance) {
  if (!instance.filters.size) return instance.events;
  return instance.events.filter((e) => instance.filters.has(e.category));
}

function paint(instance) {
  const { root } = instance;
  const title = $('[data-calendar-title]', root);
  const grid = $('[data-calendar-grid]', root);
  if (title) title.textContent = titleFor(instance);
  if (grid) {
    render(grid, monthMarkup(instance));
  }
  paintMini(instance);
  const count = $('[data-calendar-count]', root);
  if (count) count.textContent = `${toDigits(visibleEvents(instance).length)} رویداد`;
}

function titleFor(instance) {
  const p = jdate.parts(instance.cursor);
  const month = jdate.monthLabel(p.year, p.month);
  return `${month} ${toDigits(p.year)}`;
}

function monthMarkup(instance) {
  const p = jdate.parts(instance.cursor);
  const cells = jdate.monthGrid(p.year, p.month);
  const labels = jdate.weekdayLabels();
  const header = labels.map((label) => `<div class="calendar__weekday">${escapeHtml(label)}</div>`).join('');
  const grid = cells
    .map((cell) => {
      const dayEvents = eventsOn(instance, cell.date);
      const pills = dayEvents.slice(0, 3).map((event) => eventPill(event)).join('');
      const more = dayEvents.length > 3 ? `<div class="calendar__more" style="font-size:10px; color:var(--nv-primary); font-weight:700; padding:4px 8px; background:var(--nv-primary-soft); border-radius:999px; display:inline-flex; margin-top:4px;">+${toDigits(dayEvents.length - 3)} بیشتر</div>` : '';
      const classes = ['calendar__cell', cell.inMonth ? '' : 'is-outside', cell.today ? 'is-today' : '', cell.holiday ? 'is-holiday' : ''].filter(Boolean).join(' ');
      return `<div class="${classes}" data-calendar-day="${dateKey(cell.date)}" data-calendar-slot="${slotIso(cell.date, 9)}">
        <span class="calendar__date">${toDigits(cell.day)}</span>
        <div class="calendar__events" style="display:flex; flex-direction:column; gap:3px; margin-top:6px;">${pills}${more}</div>
      </div>`;
    })
    .join('');
  // wrap in grid
  return `${header}${grid}`;
}

const eventsOn = (instance, date) => visibleEvents(instance).filter((event) => jdate.isSameDay(event.startAt, date));
const dateKey = (date) => jdate.formatIso(date);
function slotIso(date, hour) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function eventPill(event) {
  const time = new Date(event.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const tone = event.tone || (event.category==='meeting'?'info': event.category==='deadline'?'danger': event.category==='personal'?'success':'primary');
  return `<button type="button" class="calendar-event calendar-event--${event.category}" data-calendar-event="${event.id}" title="${escapeHtml(event.title)}" style="background:var(--nv-${tone}-soft); color:var(--nv-${tone}); border-inline-start:3px solid var(--nv-${tone});">
    <span class="calendar-event__dot" style="background:var(--nv-${tone});"></span><span class="calendar-event__time" style="font-size:10px;">${toDigits(time)}</span><span class="calendar-event__title" style="font-size:11px; font-weight:600;">${escapeHtml(event.title)}</span>
  </button>`;
}

function paintMini(instance) {
  const host = $('[data-calendar-mini]', instance.root);
  if (!host) return;
  const p = jdate.parts(instance.cursor);
  const cells = jdate.monthGrid(p.year, p.month);
  const head = jdate.weekdayLabels().map((label) => `<span class="mini-calendar__dow">${escapeHtml(label.slice(0,1))}</span>`).join('');
  const days = cells.map((cell) => {
    const classes = ['mini-calendar__day', cell.inMonth ? '' : 'is-outside', cell.today ? 'is-today' : '', jdate.isSameDay(cell.date, instance.cursor) ? 'is-selected' : '', eventsOn(instance, cell.date).length ? 'has-events' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-mini-day="${dateKey(cell.date)}">${toDigits(cell.day)}</button>`;
  }).join('');
  render(host, `<div class="mini-calendar__head"><button type="button" class="icon-btn icon-btn--sm" data-mini-prev>‹</button><span class="mini-calendar__title">${escapeHtml(jdate.monthLabel(p.year, p.month))} ${toDigits(p.year)}</span><button type="button" class="icon-btn icon-btn--sm" data-mini-next>›</button></div><div class="mini-calendar__grid" style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px;">${head}${days}</div>`);
  on($('[data-mini-prev]', host), 'click', () => { instance.cursor = jdate.addMonths(instance.cursor, -1); paint(instance); });
  on($('[data-mini-next]', host), 'click', () => { instance.cursor = jdate.addMonths(instance.cursor, 1); paint(instance); });
  $$('[data-mini-day]', host).forEach((node) => {
    on(node, 'click', () => { instance.cursor = new Date(node.dataset.miniDay); paint(instance); });
  });
}

async function openEventModal(instance, eventOrSlot = {}) {
  const isNew = !eventOrSlot.id;
  const event = isNew ? { id: null, title: '', category: 'meeting', startAt: eventOrSlot.startAt ?? new Date().toISOString(), duration: 60, location: '', reminder: '۱۵ دقیقه قبل', description: '' } : eventOrSlot;
  const start = new Date(event.startAt);
  const html = `
    <form class="form-grid" data-calendar-form novalidate style="gap:16px;">
      <div class="form-field"><label class="form-label">عنوان رویداد *</label><input class="form-control" name="title" required value="${escapeHtml(event.title ?? '')}" placeholder="مثلاً جلسه بازبینی اسپرینت" style="height:48px; border-radius:12px; font-weight:700;" /></div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-field"><label class="form-label">دسته</label><select class="form-select" name="category" style="border-radius:12px;">${instance.categories.map((c) => `<option value="${c.id}" ${c.id === event.category ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}</select></div>
        <div class="form-field"><label class="form-label">یادآور</label><select class="form-select" name="reminder" style="border-radius:12px;">${['۱۵ دقیقه قبل', '۳۰ دقیقه قبل', '۱ ساعت قبل', 'بدون یادآور'].map((option) => `<option ${option === event.reminder ? 'selected' : ''}>${option}</option>`).join('')}</select></div>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-field"><label class="form-label">تاریخ</label><input class="form-control" name="date" type="date" dir="ltr" value="${start.toISOString().slice(0, 10)}" style="border-radius:12px;" /></div>
        <div class="form-field"><label class="form-label">ساعت</label><input class="form-control" name="time" type="time" dir="ltr" value="${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}" style="border-radius:12px;" /></div>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-field"><label class="form-label">مدت (دقیقه)</label><input class="form-control" name="duration" type="number" min="15" step="15" value="${event.duration ?? 60}" style="border-radius:12px;" /></div>
        <div class="form-field"><label class="form-label">مکان</label><input class="form-control" name="location" value="${escapeHtml(event.location ?? '')}" placeholder="اتاق جلسات ۱" style="border-radius:12px;" /></div>
      </div>
      <div class="form-field"><label class="form-label">توضیحات</label><textarea class="form-control" name="description" rows="3" placeholder="یادداشت..." style="border-radius:12px;">${escapeHtml(event.description ?? '')}</textarea></div>
      <div style="display:flex; gap:8px; justify-content:flex-end; padding-top:8px; border-top:1px solid var(--nv-divider); margin-top:8px;">
        ${isNew ? '' : '<button type="button" class="btn btn-soft-danger" data-calendar-delete style="margin-inline-end:auto; border-radius:12px;">حذف</button>'}
        <button type="button" class="btn btn-light" data-modal-close style="border-radius:12px;">انصراف</button>
        <button type="submit" class="btn btn-primary" style="border-radius:12px; font-weight:800;">${isNew ? 'افزودن رویداد' : 'ذخیره'}</button>
      </div>
    </form>`;

  const instanceModal = modal.open({
    title: isNew ? 'افزودن رویداد جدید' : 'ویرایش رویداد',
    content: html,
    size: 'md',
    onMount: (panel) => {
      const form = $('[data-calendar-form]', panel);
      on(form, 'submit', async (submitEvent) => {
        submitEvent.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const startAt = new Date(`${data.date}T${data.time}:00`);
        const payload = {
          title: String(data.title ?? '').trim(),
          category: data.category,
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() + Number(data.duration) * 60000).toISOString(),
          duration: Number(data.duration),
          location: data.location,
          reminder: data.reminder,
          description: data.description,
        };
        if (!payload.title) { form.querySelector('[name="title"]').classList.add('is-invalid'); return; }
        const { calendarService } = await import('../../services/app.service.js');
        const button = form.querySelector('[type="submit"]');
        button.classList.add('is-loading');
        try {
          if (isNew) {
            const created = await calendarService.create(payload).catch(()=>({id:'ev-'+Date.now()}));
            instance.events.push({ ...payload, id: created.id });
            toast.success('رویداد ثبت شد', payload.title);
          } else {
            await calendarService.update(event.id, payload).catch(()=>null);
            Object.assign(event, payload);
            toast.success('تغییرات ذخیره شد', payload.title);
          }
          instanceModal.close();
          paint(instance);
          bus.emit(EVENTS.dataChanged, { scope: 'calendar' });
        } catch (error) {
          toast.error('ذخیره نشد', error.message);
        } finally {
          button.classList.remove('is-loading');
        }
      });
      on($('[data-calendar-delete]', panel), 'click', async () => {
        const confirmed = await modal.confirm({ title: 'حذف رویداد', text: `آیا از حذف «${event.title}» مطمئن هستید؟`, confirmText: 'حذف کن', tone: 'danger' });
        if (!confirmed) return;
        const { calendarService } = await import('../../services/app.service.js');
        await calendarService.remove(event.id).catch(()=>null);
        instance.events = instance.events.filter((e) => e.id !== event.id);
        instanceModal.close();
        paint(instance);
        toast.success('رویداد حذف شد', event.title);
      });
    },
  });
}
