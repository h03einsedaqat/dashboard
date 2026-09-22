/**
 * NOVAADMIN — Project, task & kanban services
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { projects, tasks, milestones, projectActivity, projectFiles, TASK_STATUSES, PRIORITIES } from '../data/projects.js';

export const projectService = createResourceService({
  name: 'projects',
  collection: () => projects,
  idPrefix: 'prj',
  searchFields: ['name', 'team', 'owner', 'client'],
  sortFields: ['name', 'progress', 'budget', 'dueDate'],
  extend: (result) => ({
    summary: {
      total: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
      completed: projects.filter((p) => p.status === 'completed').length,
      atRisk: projects.filter((p) => p.health === 'at-risk').length,
      critical: projects.filter((p) => p.health === 'critical').length,
      avgProgress: Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length),
      budget: projects.reduce((s, p) => s + p.budget, 0),
      spent: projects.reduce((s, p) => s + p.spent, 0),
      totalCount: result.total,
    },
  }),
});

export const taskService = createResourceService({
  name: 'tasks',
  collection: () => tasks,
  idPrefix: 'tsk',
  searchFields: ['title', 'project', 'assignee', 'priorityLabel'],
  sortFields: ['dueDate', 'priority', 'progress', 'createdAt'],
  extend: (result) => ({
    summary: {
      total: tasks.length,
      open: tasks.filter((t) => t.status !== 'done').length,
      done: tasks.filter((t) => t.status === 'done').length,
      overdue: tasks.filter((t) => t.overdue).length,
      urgent: tasks.filter((t) => t.priority === 'urgent').length,
      statuses: TASK_STATUSES,
      priorities: PRIORITIES,
      totalCount: result.total,
    },
  }),
});

export const kanbanService = {
  /** Column payload for any board: `?resource=tasks|projects|deals` */
  async board(resource = 'tasks') {
    return call('list', `${resource}/board`, {
      resolver: () =>
        TASK_STATUSES.map((status) => {
          const items = tasks.filter((t) => t.status === status.id);
          return { ...status, cards: items, count: items.length };
        }),
    });
  },
  async move(taskId, statusId, position = 0) {
    const status = TASK_STATUSES.find((s) => s.id === statusId);
    return call('patch', `tasks/${taskId}/status`, {
      resolver: () => ({
        id: taskId,
        status: statusId,
        statusLabel: status?.label,
        progress: statusId === 'done' ? 100 : undefined,
        position,
        movedAt: new Date().toISOString(),
      }),
    });
  },
  async reorder(columnId, orderedIds = []) {
    return call('patch', `tasks/reorder`, {
      resolver: () => ({ columnId, orderedIds, total: orderedIds.length, savedAt: new Date().toISOString() }),
    });
  },
};

export const backlogService = {
  async list() {
    return call('list', 'tasks/backlog', {
      resolver: () => ({
        items: [...tasks].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        total: tasks.length,
      }),
    });
  },
};

export const milestoneService = {
  async list() {
    return call('list', 'projects/milestones', { resolver: () => milestones });
  },
};

export const projectFeedService = {
  async activity(projectId) {
    return call('list', `projects/${projectId ?? 'all'}/activity`, { resolver: () => projectActivity });
  },
  async files(projectId) {
    return call('list', `projects/${projectId ?? 'all'}/files`, { resolver: () => projectFiles });
  },
  async members(projectId) {
    return call('list', `projects/${projectId ?? 'all'}/members`, {
      resolver: () => {
        const project = projects.find((p) => p.id === projectId) ?? projects[0];
        return project.members;
      },
    });
  },
  async workload() {
    return call('list', 'projects/workload', {
      resolver: () => {
        const grouped = new Map();
        tasks.forEach((task) => {
          const row = grouped.get(task.assignee) ?? { assignee: task.assignee, avatar: task.assigneeAvatar, open: 0, done: 0, points: 0 };
          if (task.status === 'done') row.done += 1;
          else {
            row.open += 1;
            row.points += task.estimate;
          }
          grouped.set(task.assignee, row);
        });
        return [...grouped.values()].sort((a, b) => b.open - a.open);
      },
    });
  },
};

export const timeTrackingService = {
  async list() {
    return call('list', 'projects/time', {
      resolver: () => ({
        series: Array.from({ length: 14 }, (_, i) => ({ day: i, logged: 6 + ((i * 7) % 5), billable: 4 + ((i * 3) % 4) })),
        total: tasks.reduce((s, t) => s + t.spent, 0),
        estimate: tasks.reduce((s, t) => s + t.estimate, 0),
      }),
    });
  },
};

export default { projectService, taskService, kanbanService, backlogService, milestoneService, projectFeedService, timeTrackingService };
