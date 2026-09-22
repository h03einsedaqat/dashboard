/**
 * NOVAADMIN — CRM services
 * (companies, contacts, leads, deals, pipeline, activities, calls, meetings, campaigns)
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { companies, contacts, leads, deals, activitiesCrm, calls, meetings, campaigns, revenueForecast, customerAcquisition, PIPELINE_STAGES, LEAD_SOURCES } from '../data/crm.js';

export const companyService = createResourceService({
  name: 'companies',
  collection: () => companies,
  idPrefix: 'co',
  searchFields: ['name', 'industry', 'city', 'owner', 'website'],
  sortFields: ['name', 'revenue', 'employees', 'openValue', 'createdAt'],
  extend: (result) => ({
    summary: {
      total: companies.length,
      active: companies.filter((c) => c.status === 'active').length,
      prospects: companies.filter((c) => c.status === 'prospect').length,
      openValue: companies.reduce((s, c) => s + c.openValue, 0),
      employees: companies.reduce((s, c) => s + c.employees, 0),
      industries: [...new Set(companies.map((c) => c.industry))],
      totalCount: result.total,
    },
  }),
});

export const contactService = createResourceService({
  name: 'contacts',
  collection: () => contacts,
  idPrefix: 'ct',
  searchFields: ['name', 'email', 'phone', 'company', 'title', 'owner'],
  sortFields: ['name', 'value', 'lastContact'],
  extend: (result) => ({
    summary: {
      total: contacts.length,
      customers: contacts.filter((c) => c.status === 'customer').length,
      leads: contacts.filter((c) => c.status === 'lead').length,
      pipelineValue: contacts.reduce((s, c) => s + c.value, 0),
      totalCount: result.total,
    },
  }),
});

export const leadService = createResourceService({
  name: 'leads',
  collection: () => leads,
  idPrefix: 'ld',
  searchFields: ['name', 'company', 'email', 'source', 'owner', 'interest'],
  sortFields: ['score', 'estimatedValue', 'receivedAt'],
  extend: (result) => ({
    summary: {
      total: leads.length,
      hot: leads.filter((l) => l.score >= 70).length,
      newToday: leads.filter((l) => l.status === 'new').length,
      value: leads.reduce((s, l) => s + l.estimatedValue, 0),
      sources: LEAD_SOURCES,
      totalCount: result.total,
    },
  }),
});

export const dealService = createResourceService({
  name: 'deals',
  collection: () => deals,
  idPrefix: 'dl',
  searchFields: ['title', 'company', 'contact', 'owner', 'nextStep'],
  sortFields: ['value', 'probability', 'expectedClose', 'createdAt'],
  extend: (result) => ({
    summary: {
      total: deals.length,
      pipelineValue: deals.filter((d) => !['won', 'lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0),
      weightedValue: deals.reduce((s, d) => s + d.weighted, 0),
      won: deals.filter((d) => d.stage === 'won').length,
      lost: deals.filter((d) => d.stage === 'lost').length,
      winRate: Math.round((deals.filter((d) => d.stage === 'won').length / Math.max(1, deals.filter((d) => ['won', 'lost'].includes(d.stage)).length)) * 100),
      stages: PIPELINE_STAGES,
      totalCount: result.total,
    },
  }),
});

export const pipelineService = {
  /** Column-shaped payload for the drag & drop kanban. */
  async board() {
    return call('list', 'deals/pipeline', {
      resolver: () => ({
        stages: PIPELINE_STAGES.map((stage) => {
          const items = deals.filter((d) => d.stage === stage.id);
          return {
            ...stage,
            deals: items,
            count: items.length,
            sum: items.reduce((s, d) => s + d.value, 0),
          };
        }),
      }),
    });
  },
  async move(dealId, stageId, position = 0) {
    const stage = PIPELINE_STAGES.find((s) => s.id === stageId);
    return call('patch', `deals/${dealId}/stage`, {
      resolver: () => ({ id: dealId, stage: stageId, stageLabel: stage?.label, tone: stage?.tone, position, movedAt: new Date().toISOString() }),
    });
  },
};

export const crmActivityService = {
  async list({ limit = 12 } = {}) {
    return call('list', 'crm/activities', {
      resolver: () => ({ items: activitiesCrm.slice(0, limit), total: activitiesCrm.length }),
    });
  },
  async create(payload) {
    return call('create', 'crm/activities', {
      resolver: () => ({ id: `act-${Date.now()}`, at: new Date().toISOString(), outcome: 'در انتظار پاسخ', ...payload }),
    });
  },
};

export const callService = createResourceService({
  name: 'calls',
  collection: () => calls,
  idPrefix: 'call',
  searchFields: ['contact', 'company', 'owner', 'notes'],
  sortFields: ['at', 'duration'],
});

export const meetingService = createResourceService({
  name: 'meetings',
  collection: () => meetings,
  idPrefix: 'mt',
  searchFields: ['title', 'with', 'location'],
  sortFields: ['startsAt', 'title'],
});

export const campaignService = createResourceService({
  name: 'campaigns',
  collection: () => campaigns,
  idPrefix: 'cmp',
  searchFields: ['name', 'channel', 'owner'],
  sortFields: ['budget', 'revenue', 'leads', 'from'],
  extend: (result) => ({
    summary: {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === 'active').length,
      budget: campaigns.reduce((s, c) => s + c.budget, 0),
      spent: campaigns.reduce((s, c) => s + c.spent, 0),
      leads: campaigns.reduce((s, c) => s + c.leads, 0),
      revenue: campaigns.reduce((s, c) => s + c.revenue, 0),
      totalCount: result.total,
    },
  }),
});

export const salesForecastService = {
  async list() {
    return call('list', 'crm/forecast', {
      resolver: () => ({
        revenue: revenueForecast,
        acquisition: customerAcquisition,
        quota: revenueForecast.reduce((s, r) => s + r.target, 0),
        committed: revenueForecast.reduce((s, r) => s + (r.actual ?? 0), 0),
        forecast: revenueForecast.reduce((s, r) => s + r.forecast, 0),
      }),
    });
  },
  async leaderboard() {
    return call('list', 'crm/leaderboard', {
      resolver: () => {
        const grouped = new Map();
        deals.forEach((deal) => {
          const row = grouped.get(deal.owner) ?? { owner: deal.owner, avatar: deal.ownerAvatar, deals: 0, won: 0, value: 0, weighted: 0 };
          row.deals += 1;
          row.value += deal.value;
          row.weighted += deal.weighted;
          if (deal.stage === 'won') row.won += 1;
          grouped.set(deal.owner, row);
        });
        return [...grouped.values()].sort((a, b) => b.weighted - a.weighted);
      },
    });
  },
};

export default { companyService, contactService, leadService, dealService, pipelineService, crmActivityService, callService, meetingService, campaignService, salesForecastService };
