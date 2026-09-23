/**
 * NOVAADMIN — User, role, team & customer services
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { users, invitations, sessions, apiKeys, teams, departments, customers, activityLogs, notificationSeed, ROLES, MODULES, PERMISSIONS } from '../data/people.js';

export const userService = createResourceService({
  name: 'users',
  collection: () => users,
  idPrefix: 'u',
  searchFields: ['name', 'email', 'phone', 'roleLabel', 'team', 'department', 'city'],
  sortFields: ['name', 'joinedAt', 'lastActive', 'projects', 'tasksDone'],
  extend: (result) => ({
    facets: {
      status: ['active', 'invited', 'suspended'],
      role: ROLES.map((r) => r.id),
    },
    summary: {
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      invited: users.filter((u) => u.status === 'invited').length,
      suspended: users.filter((u) => u.status === 'suspended').length,
      twoFactor: users.filter((u) => u.twoFactor).length,
      totalCount: result.total,
    },
  }),
});

export const roleService = {
  async list() {
    return call('list', 'roles', { resolver: () => ROLES.map((role) => ({ ...role, users: users.filter((u) => u.role === role.id).length })) });
  },
  async matrix() {
    return call('list', 'roles/matrix', {
      resolver: () => ({
        modules: MODULES,
        permissions: PERMISSIONS,
        roles: ROLES.map((role) => ({
          ...role,
          grants: Object.fromEntries(
            MODULES.map((module) => [
              module,
              PERMISSIONS.filter((permission) => {
                if (role.id === 'super-admin') return true;
                if (role.id === 'admin') return permission !== 'delete' || module !== 'settings';
                if (role.level >= 70) return ['view', 'create', 'edit'].includes(permission) && module !== 'settings';
                if (role.id === 'editor') return permission === 'view' || (permission === 'edit' && ['products', 'reports'].includes(module));
                if (role.id === 'support') return ['view', 'create', 'edit'].includes(permission) && ['tickets', 'users'].includes(module);
                if (role.id === 'finance') return ['view', 'export'].includes(permission) || (permission === 'edit' && module === 'invoices');
                return permission === 'view' && ['reports', 'products'].includes(module);
              }),
            ]),
          ),
        })),
      }),
    });
  },
  async update(roleId, module, permission, enabled) {
    return call('patch', `roles/${roleId}`, {
      resolver: () => ({ roleId, module, permission, enabled, updatedAt: new Date().toISOString() }),
    });
  },
};

export const teamService = createResourceService({
  name: 'teams',
  collection: () => teams,
  searchFields: ['name', 'lead'],
  idPrefix: 't',
});

export const departmentService = createResourceService({
  name: 'departments',
  collection: () => departments,
  searchFields: ['name', 'head', 'location'],
  idPrefix: 'd',
});

export const customerService = createResourceService({
  name: 'customers',
  collection: () => customers,
  idPrefix: 'c',
  searchFields: ['company', 'contact', 'email', 'city', 'owner', 'plan'],
  sortFields: ['company', 'totalSpend', 'orders', 'since'],
  extend: (result) => ({
    summary: {
      total: customers.length,
      enterprise: customers.filter((c) => c.segment === 'enterprise').length,
      vip: customers.filter((c) => c.status === 'vip').length,
      lifetime: customers.reduce((sum, c) => sum + c.totalSpend, 0),
      avgSatisfaction: Number((customers.reduce((s, c) => s + c.satisfaction, 0) / customers.length).toFixed(2)),
      totalCount: result.total,
    },
  }),
});

export const invitationService = {
  list: () => call('list', 'invitations', { resolver: () => invitations }),
  async create(payload) {
    return call('create', 'invitations', { body: payload, resolver: () => ({ id: `inv-${Date.now()}`, status: 'pending', sentAt: new Date().toISOString(), expiresIn: 7, ...payload }) });
  },
  async remove(id) {
    return call('remove', `invitations/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
  async resend(id) {
    return call('post', `invitations/${id}/resend`, { resolver: () => ({ id, status: 'pending', sentAt: new Date().toISOString() }) });
  },
};

export const sessionService = {
  list: () => call('list', 'sessions', { resolver: () => sessions }),
  async revoke(id) {
    return call('remove', `sessions/${id}`, { resolver: () => ({ id, revoked: true }) });
  },
  async revokeAll(exceptId) {
    return call('remove', 'sessions', { resolver: () => ({ revoked: sessions.filter((s) => s.id !== exceptId).length }) });
  },
};

export const apiKeyService = {
  list: () => call('list', 'api-keys', { resolver: () => apiKeys }),
  async create(payload) {
    const token = `nv_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
    return call('create', 'api-keys', { body: payload, resolver: () => ({ id: `k-${Date.now()}`, createdAt: new Date().toISOString(), lastUsed: null, token, ...payload }) });
  },
  async rotate(id) {
    const token = `nv_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
    return call('patch', `api-keys/${id}`, { resolver: () => ({ id, token, rotatedAt: new Date().toISOString() }) });
  },
  async remove(id) {
    return call('remove', `api-keys/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
};

export const activityService = {
  /** GET /activities?limit=&resource= */
  async list({ limit = 10, page = 1 } = {}) {
    return call('list', 'activities', {
      resolver: () => {
        const start = (page - 1) * limit;
        return { items: activityLogs.slice(start, start + limit), total: activityLogs.length, page, perPage: limit, pages: Math.ceil(activityLogs.length / limit) };
      },
    });
  },
  async forResource(resource, id) {
    return call('list', `activities/${resource}/${id}`, {
      resolver: () => activityLogs.filter((log) => log.id && (!id || log.id.includes(String(id).slice(-3)))).slice(0, 8),
    });
  },
};

export const notificationService = {
  async list() {
    return call('list', 'notifications', { resolver: () => notificationSeed });
  },
  async markRead(id) {
    return call('patch', `notifications/${id}`, { resolver: () => ({ id, read: true }) });
  },
  async markAllRead() {
    return call('patch', 'notifications', { resolver: () => ({ updated: notificationSeed.length }) });
  },
  async remove(id) {
    return call('remove', `notifications/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
};

/**
 * Authentication service.
 *
 * The template ships without a backend, so every call resolves against a mock
 * account: the demo credentials on the sign-in page work out of the box and the
 * REST shape (`POST /auth/login`, …) matches what a real endpoint would return.
 * Point `config.api` at your own server and the same calls hit it unchanged.
 */
export const authService = {
  async login({ email, password }) {
    return call('create', 'auth/login', {
      body: { email, password },
      resolver: () => {
        const account = users.find((user) => user.email === email) ?? users[0];
        const demo = email === 'demo@novaadmin.dev' || Boolean(account);
        return {
          token: `demo-${Date.now().toString(36)}`,
          expiresIn: 3600,
          user: {
            id: account?.id ?? 'u-1',
            name: account?.name ?? 'کاربر مهمان',
            email: email || 'demo@novaadmin.dev',
            role: account?.roleLabel ?? 'مدیر',
            avatar: account?.avatar ?? 'assets/img/avatars/avatar-04.svg',
          },
          demo,
        };
      },
      latency: [420, 900],
    });
  },
  async register(payload) {
    return call('create', 'auth/register', {
      body: payload,
      resolver: () => ({ id: `u-${Date.now().toString(36)}`, ...payload, status: 'invited', verificationSent: true }),
      latency: [500, 1100],
    });
  },
  async requestReset(email) {
    return call('create', 'auth/forgot', { body: { email }, resolver: () => ({ email, sentAt: new Date().toISOString(), expiresIn: 600 }) });
  },
  async resetPassword(token, password) {
    return call('update', 'auth/reset', { body: { token, password }, resolver: () => ({ token, updated: true, sessionsClosed: 3 }) });
  },
  async verifyCode(code) {
    return call('create', 'auth/verify', { body: { code }, resolver: () => ({ code, verified: String(code).length === 6 }) });
  },
  async logout() {
    return call('create', 'auth/logout', { resolver: () => ({ loggedOutAt: new Date().toISOString() }) });
  },
  async sessions() {
    return call('list', 'auth/sessions', { resolver: () => sessions });
  },
};

export default { authService, userService, roleService, teamService, departmentService, customerService, invitationService, sessionService, apiKeyService, activityService, notificationService };
