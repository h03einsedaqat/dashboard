/**
 * NOVAADMIN — Application services
 * (email, chat, calendar, file manager, media library, notes)
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import {
  emails, MAIL_FOLDERS, MAIL_LABELS, conversations, calendarEvents, CALENDAR_CATEGORIES,
  fileSystem, mediaLibrary, storage, notes, presence,
} from '../data/apps.js';

/* ------------------------------------------------------------------- email */
export const mailService = {
  folders: () => call('list', 'mail/folders', { resolver: () => MAIL_FOLDERS }),
  labels: () => call('list', 'mail/labels', { resolver: () => MAIL_LABELS }),
  async list({ folder = 'inbox', search = '', page = 1, perPage = 12 } = {}) {
    return call('list', 'mail', {
      query: { folder, search, page, perPage },
      resolver: () => {
        const filtered = emails.filter((mail) => {
          const inFolder = folder === 'starred' ? mail.starred : mail.folder === folder;
          const hit = !search || `${mail.subject} ${mail.from} ${mail.preview}`.toLowerCase().includes(search.toLowerCase());
          return inFolder && hit;
        });
        const start = (page - 1) * perPage;
        return {
          items: filtered.slice(start, start + perPage),
          total: filtered.length,
          page,
          perPage,
          pages: Math.max(1, Math.ceil(filtered.length / perPage)),
          unread: emails.filter((m) => m.unread).length,
        };
      },
    });
  },
  get: (id) => call('get', `mail/${id}`, { resolver: () => emails.find((m) => m.id === id) }),
  async toggleStar(id, starred) {
    return call('patch', `mail/${id}`, { resolver: () => ({ id, starred }) });
  },
  async toggleRead(id, unread) {
    return call('patch', `mail/${id}`, { resolver: () => ({ id, unread }) });
  },
  async move(id, folder) {
    return call('patch', `mail/${id}/move`, { resolver: () => ({ id, folder, movedAt: new Date().toISOString() }) });
  },
  async send(payload) {
    return call('create', 'mail/send', {
      body: payload,
      resolver: () => ({ id: `em-${Date.now()}`, folder: 'sent', at: new Date().toISOString(), ...payload }),
      latency: [400, 1100],
    });
  },
  async saveDraft(payload) {
    return call('create', 'mail/draft', { resolver: () => ({ id: `em-${Date.now()}`, folder: 'drafts', savedAt: new Date().toISOString(), ...payload }) });
  },
  async remove(id) {
    return call('remove', `mail/${id}`, { resolver: () => ({ id, folder: 'trash', deleted: true }) });
  },
  async removeMany(ids = []) {
    return call('remove', 'mail', { resolver: () => ({ deleted: ids.length, ids }) });
  },
};

/* -------------------------------------------------------------------- chat */
export const chatAppService = {
  async list() {
    return call('list', 'chat/conversations', { resolver: () => conversations });
  },
  async get(id) {
    return call('get', `chat/conversations/${id}`, {
      resolver: () => {
        const found = conversations.find((c) => c.id === id) ?? conversations[0];
        return { ...found, pinned: found.pinned, online: found.online };
      },
    });
  },
  async send(id, text, attachments = []) {
    return call('create', `chat/conversations/${id}/messages`, {
      body: { text, attachments },
      resolver: () => ({
        id: `cm-${Date.now()}`,
        side: 'out',
        author: 'سارا محمدی',
        avatar: 'assets/img/avatars/avatar-08.svg',
        text,
        attachments,
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      }),
      latency: [220, 700],
    });
  },
  async react(id, messageId, emoji) {
    return call('patch', `chat/conversations/${id}/messages/${messageId}`, { resolver: () => ({ id: messageId, emoji, reactedAt: new Date().toISOString() }) });
  },
  async remove(id) {
    return call('remove', `chat/conversations/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
  async presence() {
    return call('list', 'chat/presence', { resolver: () => presence });
  },
};

/* ---------------------------------------------------------------- calendar */
export const calendarService = {
  categories: () => call('list', 'calendar/categories', { resolver: () => CALENDAR_CATEGORIES }),
  /**
   * @param {Object} options
   * @param {Date} options.from  range start (inclusive)
   * @param {Date} options.to    range end (inclusive)
   * @param {string[]} [options.categories]
   */
  async list({ from, to, categories = [] } = {}) {
    return call('list', 'calendar/events', {
      query: { from, to, categories },
      resolver: () => {
        const start = from ? new Date(from).getTime() : -Infinity;
        const end = to ? new Date(to).getTime() : Infinity;
        return calendarEvents.filter((event) => {
          const at = new Date(event.startAt).getTime();
          const inRange = at >= start && at <= end;
          const inCategory = categories.length === 0 || categories.includes(event.category);
          return inRange && inCategory;
        });
      },
    });
  },
  get: (id) => call('get', `calendar/events/${id}`, { resolver: () => calendarEvents.find((e) => e.id === id) }),
  async create(payload) {
    return call('create', 'calendar/events', {
      body: payload,
      resolver: () => ({ id: `ev-${Date.now()}`, createdAt: new Date().toISOString(), ...payload }),
    });
  },
  async update(id, payload) {
    return call('update', `calendar/events/${id}`, { body: payload, resolver: () => ({ id, updatedAt: new Date().toISOString(), ...payload }) });
  },
  /** Drag & drop rescheduling — returns the new start/end pair. */
  async move(id, startAt, durationMinutes) {
    const end = new Date(new Date(startAt).getTime() + (durationMinutes ?? 60) * 60000);
    return call('patch', `calendar/events/${id}/move`, {
      resolver: () => ({ id, startAt, endAt: end.toISOString(), movedAt: new Date().toISOString() }),
    });
  },
  async remove(id) {
    return call('remove', `calendar/events/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
  async upcoming(limit = 5) {
    return call('list', 'calendar/upcoming', {
      resolver: () =>
        [...calendarEvents]
          .filter((e) => new Date(e.startAt) >= new Date())
          .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
          .slice(0, limit),
    });
  },
};

/* ------------------------------------------------------------ file manager */
export const fileService = createResourceService({
  name: 'files',
  collection: () => fileSystem,
  idPrefix: 'f',
  searchFields: ['name', 'owner'],
  sortFields: ['name', 'size', 'at'],
  extend: (result) => ({
    summary: {
      folders: fileSystem.filter((f) => f.type === 'folder').length,
      files: fileSystem.filter((f) => f.type !== 'folder').length,
      shared: fileSystem.filter((f) => f.shared).length,
      storage,
      totalCount: result.total,
    },
  }),
});

export const fileActions = {
  async createFolder(name) {
    return call('create', 'files/folder', { resolver: () => ({ id: `f-${Date.now()}`, name, type: 'folder', items: 0, size: '—', owner: 'سارا محمدی', at: new Date().toISOString(), shared: false }) });
  },
  async rename(id, name) {
    return call('patch', `files/${id}`, { resolver: () => ({ id, name }) });
  },
  async toggleShare(id, shared) {
    return call('patch', `files/${id}/share`, { resolver: () => ({ id, shared, link: shared ? `https://novaadmin.dev/s/${Math.random().toString(36).slice(2, 8)}` : null }) });
  },
  async remove(id) {
    return call('remove', `files/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
  async removeMany(ids = []) {
    return call('remove', 'files', { resolver: () => ({ deleted: ids.length, ids }) });
  },
};

export const mediaService = createResourceService({
  name: 'media',
  collection: () => mediaLibrary,
  idPrefix: 'md',
  searchFields: ['name', 'uploadedBy'],
  sortFields: ['at', 'size', 'name'],
  extend: (result) => ({
    summary: { files: mediaLibrary.length, storage, totalCount: result.total },
  }),
});

export const mediaActions = {
  async upload(payload) {
    return call('create', 'media', {
      body: payload,
      resolver: () => ({
        id: `md-${Date.now()}`,
        name: payload?.name ?? 'upload.svg',
        type: 'image',
        size: payload?.size ?? '640 KB',
        dimensions: '1200×800',
        uploadedBy: 'سارا محمدی',
        at: new Date().toISOString(),
        tags: [],
      }),
      latency: [500, 1300],
    });
  },
  async remove(id) {
    return call('remove', `media/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
  async updateTags(id, tags) {
    return call('patch', `media/${id}`, { resolver: () => ({ id, tags }) });
  },
};

/* ------------------------------------------------------------------- notes */
export const noteService = createResourceService({
  name: 'notes',
  collection: () => notes,
  idPrefix: 'nt',
  searchFields: ['title', 'body'],
  sortFields: ['at', 'title'],
});

export const noteActions = {
  async togglePin(id, pinned) {
    return call('patch', `notes/${id}`, { resolver: () => ({ id, pinned }) });
  },
  async setColor(id, color) {
    return call('patch', `notes/${id}`, { resolver: () => ({ id, color }) });
  },
};

export default { mailService, chatAppService, calendarService, fileService, fileActions, mediaService, mediaActions, noteService, noteActions };
