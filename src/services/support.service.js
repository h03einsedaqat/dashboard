/**
 * NOVAADMIN — Support desk service
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { tickets, agents, knowledgeBase, kbArticles, ticketStats, satisfactionSeries, TICKET_STATUSES, TICKET_PRIORITIES } from '../data/support.js';

export const ticketService = createResourceService({
  name: 'tickets',
  collection: () => tickets,
  idPrefix: 'tk',
  searchFields: ['number', 'subject', 'customer', 'requester', 'agent', 'category'],
  sortFields: ['createdAt', 'updatedAt', 'priority', 'status'],
  extend: (result) => ({
    summary: {
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      unassigned: tickets.filter((t) => !t.agent).length,
      breached: tickets.filter((t) => t.slaBreach).length,
      csat: 94.6,
      avgFirstResponse: '۱۸ دقیقه',
      statuses: TICKET_STATUSES,
      priorities: TICKET_PRIORITIES,
      stats: ticketStats,
      totalCount: result.total,
    },
  }),
});

export const ticketActions = {
  async reply(id, text, attachments = []) {
    return call('post', `tickets/${id}/reply`, {
      resolver: () => ({
        id,
        message: { id: `tm-${Date.now()}`, author: 'سارا محمدی', side: 'agent', text, attachments, at: new Date().toISOString() },
      }),
    });
  },
  async setStatus(id, status) {
    const meta = TICKET_STATUSES.find((s) => s.id === status) ?? TICKET_STATUSES[0];
    return call('patch', `tickets/${id}`, { resolver: () => ({ id, status: meta.id, statusLabel: meta.label, tone: meta.tone, updatedAt: new Date().toISOString() }) });
  },
  async assign(id, agent) {
    return call('patch', `tickets/${id}/assign`, { resolver: () => ({ id, agent: agent.name, agentAvatar: agent.avatar, assignedAt: new Date().toISOString() }) });
  },
  async escalate(id) {
    return call('patch', `tickets/${id}/priority`, { resolver: () => ({ id, priority: 'critical', priorityLabel: 'بحرانی' }) });
  },
  async close(id, rating) {
    return call('patch', `tickets/${id}`, { resolver: () => ({ id, status: 'closed', statusLabel: 'بسته شده', satisfaction: rating, closedAt: new Date().toISOString() }) });
  },
  async merge(ids) {
    return call('post', 'tickets/merge', { resolver: () => ({ merged: ids.length, ids }) });
  },
};

export const agentService = {
  async list() {
    return call('list', 'agents', { resolver: () => agents });
  },
  async workload() {
    return call('list', 'agents/workload', {
      resolver: () =>
        agents.map((agent) => ({
          ...agent,
          open: tickets.filter((t) => t.agent === agent.name && !['closed', 'resolved'].includes(t.status)).length,
          breached: tickets.filter((t) => t.agent === agent.name && t.slaBreach).length,
        })),
    });
  },
};

export const knowledgeBaseService = {
  async articles() {
    return call('list', 'kb/articles', { resolver: () => kbArticles });
  },
  async list() {
    return call('list', 'kb', { resolver: () => knowledgeBase });
  },
  async search(term) {
    return call('list', 'kb/search', {
      resolver: () => kbArticles.filter((k) => `${k.title} ${k.excerpt}`.includes(term ?? '')),
    });
  },
};

export const supportStatsService = {
  async satisfaction() {
    return call('list', 'support/satisfaction', {
      resolver: () => ({
        series: satisfactionSeries,
        csat: Number((satisfactionSeries.reduce((s, r) => s + r.csat, 0) / satisfactionSeries.length).toFixed(1)),
        volume: satisfactionSeries.reduce((s, r) => s + r.volume, 0),
        reopened: satisfactionSeries.reduce((s, r) => s + r.reopened, 0),
      }),
    });
  },
  async sla() {
    return call('list', 'support/sla', {
      resolver: () => {
        const buckets = ['زیر ۱ ساعت', '۱ تا ۴ ساعت', '۴ تا ۸ ساعت', 'بیش از ۸ ساعت'];
        return buckets.map((label, index) => ({
          label,
          count: tickets.filter((t) => {
            const minutes = parseInt(t.firstResponse, 10) || 0;
            const ranges = [[0, 60], [60, 240], [240, 480], [480, Infinity]];
            return minutes >= ranges[index][0] && minutes < ranges[index][1];
          }).length,
        }));
      },
    });
  },
};

export default { ticketService, ticketActions, agentService, knowledgeBaseService, supportStatsService };
