/**
 * NOVAADMIN — application event bus
 * ------------------------------------------------------------------
 * Modules stay decoupled: the theme engine emits `theme:change`, the table
 * component emits `datatable:selection`, the widget editor emits
 * `widgets:change`. Any page controller can react without importing peers.
 *
 *   import { bus } from '../core/bus.js';
 *   bus.on('theme:change', ({ theme }) => console.log(theme));
 *   bus.emit('datatable:selection', { ids: ['o-12001'] });
 */
const listeners = new Map();

export const bus = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => bus.off(event, handler);
  },

  once(event, handler) {
    const off = bus.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  },

  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },

  emit(event, payload = {}) {
    listeners.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[nova:bus] handler for "${event}" failed`, error);
      }
    });
    listeners.get('*')?.forEach((handler) => handler({ event, payload }));
  },

  clear(event) {
    if (event) listeners.delete(event);
    else listeners.clear();
  },
};

/** Event names in one place so typos surface immediately. */
export const EVENTS = {
  theme: 'theme:change',
  primary: 'primary:change',
  direction: 'direction:change',
  language: 'language:change',
  layout: 'layout:change',
  density: 'density:change',
  calendarDate: 'calendar:date',
  tableSelection: 'datatable:selection',
  tableRefreshed: 'datatable:refreshed',
  widgets: 'widgets:change',
  toast: 'toast:show',
  command: 'command:run',
  notifications: 'notifications:change',
  dataChanged: 'data:changed',
};

export default bus;
