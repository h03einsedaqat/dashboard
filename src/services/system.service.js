/**
 * NOVAADMIN — System service
 * (global search, command palette, settings, content pages, docs, shortcuts)
 */
import { call } from './client.js';
import { buildSearchIndex, commands, shortcuts, changelog, faq, pricingPlans, statusServices, statusIncidents, statusUptimeBars, helpTopics, helpArticles, contactChannels, legalSections, testimonials, productHighlights, techStack, counters } from '../data/system.js';
import { config } from '../config/config.js';
import { docsOrder, pageTitles, pageMeta } from '../locales/generated.js';

/** Cached index — building it is cheap but pointless on every keystroke. */
let indexCache = null;

export const searchService = {
  async search(term, { limit = 8, lang = 'fa' } = {}) {
    return call('list', 'search', {
      query: { term, limit, lang },
      resolver: () => {
        indexCache = indexCache ?? buildSearchIndex(lang);
        const needle = String(term ?? '').trim().toLowerCase();
        if (!needle) return { items: [], total: 0 };
        const scored = indexCache
          .map((entry) => {
            const haystack = `${entry.title} ${entry.description} ${entry.url}`.toLowerCase();
            const at = haystack.indexOf(needle);
            if (at === -1) return null;
            return { ...entry, score: at === 0 ? 0 : at };
          })
          .filter(Boolean)
          .sort((a, b) => a.score - b.score);
        return { items: scored.slice(0, limit), total: scored.length };
      },
      latency: [60, 180],
    });
  },
  buildIndex: (lang = 'fa') => buildSearchIndex(lang),
};

export const commandService = {
  async list() {
    return call('list', 'commands', { resolver: () => commands });
  },
  async filter(term) {
    return call('list', 'commands', {
      resolver: () => {
        const needle = String(term ?? '').toLowerCase();
        return commands
          .map((group) => ({ ...group, items: group.items.filter((item) => !needle || `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(needle)) }))
          .filter((group) => group.items.length);
      },
      latency: [40, 120],
    });
  },
  shortcuts: () => shortcuts,
};

export const settingsService = {
  async get() {
    return call('get', 'settings', {
      resolver: () => ({
        general: { appName: config.appName, version: config.version, timezone: config.timezone, dateFormat: config.dateFormat, language: config.defaultLanguage, direction: config.defaultDirection },
        appearance: { theme: config.defaultTheme, primary: config.defaultPrimary, layout: config.defaultLayout, sidebarStyle: config.defaultSidebarStyle, density: config.defaultDensity, fontSize: config.defaultFontSize },
        localization: { currency: config.currency, currencies: config.currencyList, calendar: 'jalali', digits: 'fa' },
        notifications: { email: true, browser: false, digest: 'daily', mentions: true, marketing: false },
        security: { twoFactor: true, sessionTimeout: 30, ipAllowlist: [], passwordPolicy: 'strong' },
        integrations: { models: true, storage: true, payments: true, email: true },
        features: config.features,
      }),
    });
  },
  async update(section, values) {
    return call('update', `settings/${section}`, { body: values, resolver: () => ({ section, values, savedAt: new Date().toISOString() }) });
  },
};

export const contentService = {
  changelog: () => call('list', 'content/changelog', { resolver: () => changelog }),
  faq: () => call('list', 'content/faq', { resolver: () => faq }),
  pricing: () => call('list', 'content/pricing', { resolver: () => pricingPlans }),
  testimonials: () => call('list', 'content/testimonials', { resolver: () => testimonials }),
  highlights: () => call('list', 'content/highlights', { resolver: () => productHighlights }),
  techStack: () => call('list', 'content/tech', { resolver: () => techStack }),
  counters: () => call('list', 'content/counters', { resolver: () => counters }),
  contact: () => call('list', 'content/contact', { resolver: () => contactChannels }),
  legal: (kind = 'terms') => call('get', `content/legal/${kind}`, { resolver: () => legalSections[kind] ?? legalSections.terms }),
  async submitContact(payload) {
    return call('create', 'content/contact', {
      body: payload,
      resolver: () => ({ id: `msg-${Date.now()}`, receivedAt: new Date().toISOString(), status: 'received' }),
      latency: [500, 1300],
    });
  },
  async subscribe(email) {
    return call('create', 'content/subscribe', { resolver: () => ({ email, subscribedAt: new Date().toISOString(), status: 'active' }) });
  },
};

export const statusService = {
  async overview() {
    return call('list', 'status', {
      resolver: () => ({
        services: statusServices,
        incidents: statusIncidents,
        uptimeBars: statusUptimeBars,
        overall: statusServices.every((s) => s.state === 'operational') ? 'operational' : 'degraded',
        uptime: Number((statusServices.reduce((s, x) => s + x.uptime, 0) / statusServices.length).toFixed(2)),
      }),
    });
  },
};

export const helpService = {
  async topics() {
    return call('list', 'help/topics', { resolver: () => helpTopics });
  },
  async articles(term = '') {
    return call('list', 'help/articles', {
      resolver: () => helpArticles.filter((a) => !term || `${a.title} ${a.topic}`.toLowerCase().includes(term.toLowerCase())),
    });
  },
  async rate(articleId, helpful) {
    return call('patch', `help/articles/${articleId}`, { resolver: () => ({ articleId, helpful, at: new Date().toISOString() }) });
  },
};

export const docsService = {
  /** Docs navigation is derived from the generated order so it can never drift. */
  async nav(lang = 'fa') {
    return call('list', 'docs/nav', {
      resolver: () => {
        const titles = pageTitles[lang] ?? pageTitles.fa;
        const groups = new Map();
        docsOrder.forEach((url) => {
          const meta = pageMeta[url] ?? {};
          const group = meta.parents?.[0]?.id ?? 'docs';
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group).push({ url, title: titles[url] ?? url, active: false });
        });
        return [...groups.entries()].map(([id, items]) => ({ id, title: id === 'docs' ? 'مستندات' : titles[`docs/${id}.html`] ?? id, items }));
      },
      latency: [40, 120],
    });
  },
  async page(url) {
    return call('get', `docs/${url}`, {
      resolver: () => {
        const meta = pageMeta[url] ?? {};
        const index = docsOrder.indexOf(url);
        return {
          url,
          title: pageTitles.fa?.[url] ?? url,
          kind: meta.kind ?? 'doc',
          prev: index > 0 ? docsOrder[index - 1] : null,
          next: index >= 0 && index < docsOrder.length - 1 ? docsOrder[index + 1] : null,
        };
      },
    });
  },
};

export const demoService = {
  demos: () => config.demos,
  async switcher() {
    return call('list', 'demos', {
      resolver: () => config.demos.map((demo) => ({ ...demo, url: `dashboards/${demo.id}.html` })),
    });
  },
};

export default { searchService, commandService, settingsService, contentService, statusService, helpService, docsService, demoService };
