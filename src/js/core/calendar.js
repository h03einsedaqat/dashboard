/**
 * NOVAADMIN — calendar component
 * ------------------------------------------------------------------
 * Month / week / day / agenda views with Jalali or Gregorian dates, category
 * filtering, event CRUD through a modal, drag & drop rescheduling and a
 * mini-calendar sidebar.
 *
 * Contract
 *   <div data-calendar data-calendar-view="month" data-calendar-resource="calendar">
 *     <div data-calendar-grid></div>            ← rendered by this module
 *     <div data-calendar-title></div>           ← month label
 *     <button data-calendar-prev|next|today>
 *     <div data-calendar-views><button data-view="week">…</button></div>
 *     <div data-calendar-mini></div>
 *   </div>
 */
import { $, $$, on, create, render, escapeHtml } from './dom.js';
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
    view: root.dataset.calendarView ?? 'month',
    cursor: new Date(),
    events: [],
    categories: [],
    filters: new Set(),
    resource: root.dataset.calendarResource ?? 'calendar',
  };
  state.set(root, instance);

  const { calendarService } = await import('../../services/app.service.js');
  const [events, categories] = await Promise.all([
    calendarService.list({ from: jdate.addDays(instance.cursor, -45), to: jdate.addDays(instance.cursor, 60) }),
    calendarService.categories(),
  ]);
  instance.events = events;
  instance.categories = categories;

  bindControls(instance);
  renderChips(instance);
  paint(instance);
  return instance;
}

function bindControls(instance) {
  const { root } = instance;
  on(root, 'click', (event) => {
    const nav = event.target.closest('[data-calendar-prev], [data-calendar-next], [data-calendar-today]');
    if (nav) {
      const step = nav.hasAttribute('data-calendar-prev') ? -1 : nav.hasAttribute('data-calendar-next') ? 1 : 0;
      instance.cursor = step === 0 ? new Date() : shift(instance, step);
      paint(instance);
      return;
    }
    const viewButton = event.target.closest('[data-calendar-views] [data-view], [data-view]');
    if (viewButton && viewButton.dataset.view) {
      instance.view = viewButton.dataset.view;
      $$('[data-view]', root).forEach((node) => node.classList.toggle('is-active', node === viewButton));
      root.dataset.calendarView = instance.view;
      paint(instance);
      return;
    }
    const chip = event.target.closest('[data-calendar-category]');
    if (chip) {
      const id = chip.dataset.calendarCategory;
      if (instance.filters.has(id)) instance.filters.delete(id);
      else instance.filters.add(id);
      chip.classList.toggle('is-active', instance.filters.has(id));
      paint(instance);
      return;
    }
    const slot = event.target.closest('[data-calendar-slot]');
    if (slot && !event.target.closest('[data-calendar-event]')) {
      openEventModal(instance, { startAt: slot.dataset.calendarSlot });
      return;
    }
    const chipEvent = event.target.closest('[data-calendar-event]');
    if (chipEvent) {
      const found = instance.events.find((e) => e.id === chipEvent.dataset.calendarEvent);
      if (found) openEventModal(instance, found);
    }
  });
}

const shift = (instance, step) => (instance.view === 'day' ? jdate.addDays(instance.cursor, step) : instance.view === 'week' ? jdate.addDays(instance.cursor, step * 7) : jdate.addMonths(instance.cursor, step));

function visibleEvents(instance) {
  const filtered = instance.filters.size ? instance.events.filter((e) => instance.filters.has(e.category)) : instance.events;
  return filtered;
}

function paint(instance) {
  const { root, view } = instance;
  const title = $('[data-calendar-title]', root);
  const grid = $('[data-calendar-grid]', root);
  if (title) title.textContent = titleFor(instance);
  if (grid) {
    grid.dataset.view = view;
    render(grid, view === 'month' ? monthMarkup(instance) : view === 'week' ? weekMarkup(instance) : view === 'day' ? dayMarkup(instance) : agendaMarkup(instance));
  }
  paintMini(instance);
  bindDrag(instance);
  const count = $('[data-calendar-count]', root);
  if (count) count.textContent = formatNumber(visibleEvents(instance).length);
  bus.emit('calendar:rendered', { view, cursor: instance.cursor.toISOString() });
}

function titleFor(instance) {
  const p = jdate.parts(instance.cursor);
  const month = jdate.monthLabel(p.year, p.month);
  if (instance.view === 'day') return jdate.formatDate(instance.cursor, { format: 'long' });
  if (instance.view === 'week') {
    const days = jdate.weekDays(instance.cursor);
    const first = jdate.parts(days[0]);
    const last = jdate.parts(days[6]);
    return `${toDigits(first.day)} ${jdate.monthLabel(first.year, first.month)} — ${toDigits(last.day)} ${jdate.monthLabel(last.year, last.month)} ${toDigits(last.year)}`;
  }
  if (instance.view === 'agenda') return `${month} ${toDigits(p.year)}`;
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
      const pills = dayEvents.slice(0, 3)
        .map((event) => eventPill(event))
        .join('');
      const more = dayEvents.length > 3 ? `<button type="button" class="calendar__more" data-calendar-day-more="${dateKey(cell.date)}">+${toDigits(dayEvents.length - 3)} رویداد دیگر</button>` : '';
      const classes = ['calendar__cell', cell.inMonth ? '' : 'is-outside', cell.today ? 'is-today' : '', cell.holiday ? 'is-holiday' : '', cell.weekend ? 'is-weekend' : ''].filter(Boolean).join(' ');
      return `<div class="${classes}" data-calendar-day="${dateKey(cell.date)}" data-calendar-slot="${slotIso(cell.date, 9)}">
        <span class="calendar__date">${toDigits(cell.inMonth ? cell.day : cell.day)}</span>
        <div class="calendar__events">${pills}${more}</div>
      </div>`;
    })
    .join('');
  return `<div class="calendar__grid">${header}${grid}</div>`;
}

function weekMarkup(instance) {
  const days = jdate.weekDays(instance.cursor);
  const head = days
    .map((date) => {
      const p = jdate.parts(date);
      const today = jdate.isSameDay(date, new Date());
      return `<div class="calendar__weekday ${today ? 'is-today' : ''}"><span>${escapeHtml(jdate.weekdayLabels({ short: false })[jdate.weekDayIndex(date)])}</span><strong>${toDigits(p.day)}</strong></div>`;
    })
    .join('');
  const columns = days
    .map((date) => {
      const list = eventsOn(instance, date).map((event) => eventPill(event)).join('');
      return `<div class="calendar__col" data-calendar-day="${dateKey(date)}" data-calendar-slot="${slotIso(date, 9)}">
        <div class="calendar__col-body">${list || '<span class="calendar__empty-slot">—</span>'}</div>
      </div>`;
    })
    .join('');
  return `<div class="calendar__grid calendar__grid--week"><div class="calendar__week-head">${head}</div><div class="calendar__week-body">${columns}</div></div>`;
}

function dayMarkup(instance) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  const dayEvents = eventsOn(instance, instance.cursor);
  const rows = hours
    .map((hour) => {
      const slotEvents = dayEvents.filter((event) => new Date(event.startAt).getHours() === hour);
      return `<div class="calendar__hour" data-calendar-slot="${slotIso(instance.cursor, hour)}">
        <span class="calendar__hour-label">${toDigits(String(hour).padStart(2, '0'))}:۰۰</span>
        <div class="calendar__slots">${slotEvents.map((event) => eventBlock(event)).join('')}</div>
      </div>`;
    })
    .join('');
  return `<div class="calendar__time-grid">${rows}</div>`;
}

function agendaMarkup(instance) {
  const days = Array.from({ length: 14 }, (_, i) => jdate.addDays(instance.cursor, i - 3));
  return `<div class="agenda-list">${days
    .map((date) => {
      const list = eventsOn(instance, date);
      const p = jdate.parts(date);
      return `<div class="agenda-day">
        <div class="agenda-day__date"><span class="agenda-day__dow">${escapeHtml(jdate.weekdayLabels({ short: false })[jdate.weekDayIndex(date)])}</span><span class="agenda-day__num">${toDigits(p.day)}</span><span class="agenda-day__month">${escapeHtml(jdate.monthLabel(p.year, p.month))}</span></div>
        <div class="agenda-day__items">${
          list.length
            ? list
                .map(
                  (event) => `<button type="button" class="agenda-item" data-calendar-event="${event.id}">
                    <span class="agenda-item__time">${toDigits(new Date(event.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</span>
                    <span class="agenda-item__title">${escapeHtml(event.title)}</span>
                    <span class="agenda-item__meta">${escapeHtml(event.location ?? '')}</span>
                  </button>`,
                )
                .join('')
            : '<span class="agenda-day__empty">رویدادی ثبت نشده است</span>'
        }</div>
      </div>`;
    })
    .join('')}</div>`;
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
  return `<button type="button" class="calendar-event calendar-event--${event.category}" data-calendar-event="${event.id}" title="${escapeHtml(event.title)}">
    <span class="calendar-event__dot"></span><span class="calendar-event__time">${toDigits(time)}</span><span class="calendar-event__title">${escapeHtml(event.title)}</span>
  </button>`;
}

function eventBlock(event) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt ?? start.getTime() + 60 * 60000);
  return `<div class="calendar-event calendar-event--${event.category} calendar-event--block" data-calendar-event="${event.id}">
    <span class="calendar-event__time">${toDigits(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`)} — ${toDigits(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`)}</span>
    <strong class="calendar-event__title">${escapeHtml(event.title)}</strong>
  </div>`;
}

function renderChips(instance) {
  const host = $('[data-calendar-categories]', instance.root);
  if (!host) return;
  render(
    host,
    instance.categories
      .map((category) => `<button type="button" class="chip chip--filter" data-calendar-category="${category.id}"><span class="status-dot status-dot--${category.tone}"></span>${escapeHtml(category.label)}</button>`)
      .join(''),
  );
}

function paintMini(instance) {
  const host = $('[data-calendar-mini]', instance.root);
  if (!host) return;
  const p = jdate.parts(instance.cursor);
  const cells = jdate.monthGrid(p.year, p.month);
  const head = jdate
    .weekdayLabels()
    .map((label) => `<span class="mini-calendar__dow">${escapeHtml(label)}</span>`)
    .join('');
  const days = cells
    .map((cell) => {
      const classes = ['mini-calendar__day', cell.inMonth ? '' : 'is-outside', cell.today ? 'is-today' : '', jdate.isSameDay(cell.date, instance.cursor) ? 'is-selected' : '', eventsOn(instance, cell.date).length ? 'has-events' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${classes}" data-mini-day="${dateKey(cell.date)}">${toDigits(cell.day)}</button>`;
    })
    .join('');
  render(host, `<div class="mini-calendar__head"><button type="button" class="icon-btn icon-btn--sm" data-mini-prev aria-label="ماه قبل">‹</button><span class="mini-calendar__title">${escapeHtml(jdate.monthLabel(p.year, p.month))} ${toDigits(p.year)}</span><button type="button" class="icon-btn icon-btn--sm" data-mini-next aria-label="ماه بعد">›</button></div><div class="mini-calendar__grid">${head}${days}</div>`);
  on($('[data-mini-prev]', host), 'click', () => {
    instance.cursor = jdate.addMonths(instance.cursor, -1);
    paint(instance);
  });
  on($('[data-mini-next]', host), 'click', () => {
    instance.cursor = jdate.addMonths(instance.cursor, 1);
    paint(instance);
  });
  $$('[data-mini-day]', host).forEach((node) => {
    on(node, 'click', () => {
      instance.cursor = new Date(node.dataset.miniDay);
      paint(instance);
    });
  });
}

async function bindDrag(instance) {
  const draggables = $$('[data-calendar-event]', instance.root);
  if (!draggables.length) return;
  const { default: Sortable } = await import('sortablejs');
  $$('[data-calendar-day], [data-calendar-slot]', instance.root).forEach((zone) => {
    if (zone.dataset.sortableReady === '1') return;
    zone.dataset.sortableReady = '1';
    Sortable.create(zone, {
      group: 'nova-calendar',
      animation: 140,
      draggable: '[data-calendar-event]',
      ghostClass: 'is-dragging',
      onAdd: async ({ item, to }) => {
        const id = item.dataset.calendarEvent;
        const slot = to.dataset.calendarSlot;
        if (!id || !slot) return;
        const found = instance.events.find((e) => e.id === id);
        const duration = found ? Math.round((new Date(found.endAt) - new Date(found.startAt)) / 60000) : 60;
        item.remove();
        try {
          const { calendarService } = await import('../../services/app.service.js');
          const updated = await calendarService.move(id, slot, duration);
          if (found) {
            found.startAt = updated.startAt;
            found.endAt = updated.endAt;
          }
          paint(instance);
          toast({ type: 'success', title: 'زمان‌بندی به‌روزرسانی شد', text: `${found?.title ?? 'رویداد'} به ${jdate.formatDate(slot, { format: 'long' })} منتقل شد.` });
        } catch (error) {
          toast({ type: 'danger', title: 'جابجایی انجام نشد', text: error.message });
        }
      },
    });
  });
}

async function openEventModal(instance, eventOrSlot = {}) {
  const isNew = !eventOrSlot.id;
  const event = isNew
    ? {
        id: null,
        title: '',
        category: 'meeting',
        startAt: eventOrSlot.startAt ?? new Date().toISOString(),
        duration: 60,
        location: '',
        reminder: '۱۵ دقیقه قبل',
        description: '',
      }
    : eventOrSlot;

  const start = new Date(event.startAt);
  const html = `
    <form class="form-grid" data-calendar-form novalidate>
      <div class="form-section">
        <label class="form-label" for="ev-title">عنوان رویداد</label>
        <input class="form-control" id="ev-title" name="title" required value="${escapeHtml(event.title ?? '')}" placeholder="مثلاً جلسه بازبینی اسپرینت" />
      </div>
      <div class="form-grid form-grid--2">
        <div>
          <label class="form-label" for="ev-category">دسته</label>
          <select class="form-select" id="ev-category" name="category">
            ${instance.categories.map((c) => `<option value="${c.id}" ${c.id === event.category ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label" for="ev-reminder">یادآور</label>
          <select class="form-select" id="ev-reminder" name="reminder">
            ${['۱۵ دقیقه قبل', '۳۰ دقیقه قبل', '۱ ساعت قبل', 'بدون یادآور'].map((option) => `<option ${option === event.reminder ? 'selected' : ''}>${option}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid form-grid--2">
        <div>
          <label class="form-label" for="ev-date">تاریخ</label>
          <input class="form-control" id="ev-date" name="date" type="date" dir="ltr" value="${start.toISOString().slice(0, 10)}" />
        </div>
        <div>
          <label class="form-label" for="ev-time">ساعت شروع</label>
          <input class="form-control" id="ev-time" name="time" type="time" dir="ltr" value="${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}" />
        </div>
      </div>
      <div class="form-grid form-grid--2">
        <div>
          <label class="form-label" for="ev-duration">مدت (دقیقه)</label>
          <input class="form-control" id="ev-duration" name="duration" type="number" min="15" step="15" value="${event.duration ?? 60}" />
        </div>
        <div>
          <label class="form-label" for="ev-location">مکان</label>
          <input class="form-control" id="ev-location" name="location" value="${escapeHtml(event.location ?? '')}" placeholder="اتاق جلسات ۱ یا آنلاین" />
        </div>
      </div>
      <div class="form-section">
        <label class="form-label" for="ev-desc">توضیحات</label>
        <textarea class="form-control" id="ev-desc" name="description" rows="3" placeholder="دستور جلسه یا یادداشت">${escapeHtml(event.description ?? '')}</textarea>
      </div>
      <div class="form-actions">
        ${isNew ? '' : '<button type="button" class="btn btn-soft-danger" data-calendar-delete>حذف رویداد</button>'}
        <button type="button" class="btn btn-light" data-modal-close>انصراف</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'افزودن رویداد' : 'ذخیره تغییرات'}</button>
      </div>
    </form>`;

  const instanceModal = modal.open({
    title: isNew ? 'افزودن رویداد جدید' : 'ویرایش رویداد',
    content: html,
    size: 'lg',
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
        if (!payload.title) {
          form.querySelector('[name="title"]').classList.add('is-invalid');
          return;
        }
        const { calendarService } = await import('../../services/app.service.js');
        const button = form.querySelector('[type="submit"]');
        button.classList.add('is-loading');
        try {
          if (isNew) {
            const created = await calendarService.create(payload);
            instance.events.push({ ...payload, id: created.id });
            toast({ type: 'success', title: 'رویداد ثبت شد', text: payload.title });
          } else {
            await calendarService.update(event.id, payload);
            Object.assign(event, payload);
            toast({ type: 'success', title: 'تغییرات ذخیره شد', text: payload.title });
          }
          instanceModal.close();
          paint(instance);
          bus.emit(EVENTS.dataChanged, { scope: 'calendar' });
        } catch (error) {
          toast({ type: 'danger', title: 'ذخیره نشد', text: error.message });
        } finally {
          button.classList.remove('is-loading');
        }
      });

      on($('[data-calendar-delete]', panel), 'click', async () => {
        const confirmed = await modal.confirm({
          title: 'حذف رویداد',
          text: `آیا از حذف «${event.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
          confirmText: 'حذف کن',
          tone: 'danger',
        });
        if (!confirmed) return;
        const { calendarService } = await import('../../services/app.service.js');
        await calendarService.remove(event.id);
        instance.events = instance.events.filter((e) => e.id !== event.id);
        instanceModal.close();
        paint(instance);
        toast({ type: 'success', title: 'رویداد حذف شد', text: event.title });
      });
    },
  });
}

export const calendar = { init: initCalendar, state };
export default calendar;
