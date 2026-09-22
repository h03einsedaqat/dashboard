/**
 * NOVAADMIN — HR services (employees, attendance, leave, payroll, recruitment)
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { employees, attendanceToday, attendanceSeries, leaveRequests, payroll, jobs, candidates, hrKpis } from '../data/hr.js';

export const employeeService = createResourceService({
  name: 'employees',
  collection: () => employees,
  idPrefix: 'emp',
  searchFields: ['name', 'code', 'position', 'department', 'team', 'email'],
  sortFields: ['name', 'salary', 'performance', 'hiredAt'],
  extend: (result) => ({
    summary: {
      ...hrKpis,
      active: employees.filter((e) => e.status === 'active').length,
      onLeave: employees.filter((e) => e.status === 'on-leave').length,
      remote: employees.filter((e) => e.remote).length,
      departments: [...new Set(employees.map((e) => e.department))],
      totalCount: result.total,
      payroll: employees.reduce((s, e) => s + e.salary, 0),
    },
  }),
});

export const attendanceService = {
  async today() {
    return call('list', 'hr/attendance/today', {
      resolver: () => ({
        rows: attendanceToday,
        summary: {
          present: attendanceToday.filter((a) => a.status === 'present').length,
          remote: attendanceToday.filter((a) => a.status === 'remote').length,
          late: attendanceToday.filter((a) => a.status === 'late').length,
          absent: attendanceToday.filter((a) => a.status === 'absent').length,
          averageHours: Number((attendanceToday.reduce((s, a) => s + a.workedHours, 0) / attendanceToday.length).toFixed(1)),
        },
      }),
    });
  },
  async monthly() {
    return call('list', 'hr/attendance/monthly', {
      resolver: () => ({
        series: attendanceSeries,
        rate: hrKpis.attendanceRate,
        overtime: attendanceSeries.reduce((s, d) => s + d.present, 0),
      }),
    });
  },
  async checkIn(employeeId) {
    return call('create', 'hr/attendance/check-in', { resolver: () => ({ employeeId, at: new Date().toISOString(), status: 'present' }) });
  },
  async checkOut(employeeId) {
    return call('create', 'hr/attendance/check-out', { resolver: () => ({ employeeId, at: new Date().toISOString(), hours: 8.2 }) });
  },
};

export const leaveService = createResourceService({
  name: 'hr/leave',
  collection: () => leaveRequests,
  idPrefix: 'lv',
  searchFields: ['employee', 'department', 'type', 'reason'],
  sortFields: ['from', 'days', 'submittedAt'],
  extend: (result) => ({
    summary: {
      total: leaveRequests.length,
      pending: leaveRequests.filter((l) => l.status === 'pending').length,
      approved: leaveRequests.filter((l) => l.status === 'approved').length,
      rejected: leaveRequests.filter((l) => l.status === 'rejected').length,
      days: leaveRequests.reduce((s, l) => s + l.days, 0),
      totalCount: result.total,
    },
  }),
});

export const leaveActions = {
  async approve(id) {
    return call('patch', `hr/leave/${id}`, { resolver: () => ({ id, status: 'approved', decidedAt: new Date().toISOString() }) });
  },
  async reject(id, reason = '') {
    return call('patch', `hr/leave/${id}`, { resolver: () => ({ id, status: 'rejected', reason, decidedAt: new Date().toISOString() }) });
  },
};

export const payrollService = {
  async list() {
    return call('list', 'hr/payroll', {
      resolver: () => ({
        rows: payroll,
        summary: {
          gross: payroll.reduce((s, p) => s + p.base + p.allowance + p.overtime + p.bonus, 0),
          deductions: payroll.reduce((s, p) => s + p.deduction, 0),
          net: payroll.reduce((s, p) => s + p.net, 0),
          paid: payroll.filter((p) => p.status === 'paid').length,
          pending: payroll.filter((p) => p.status !== 'paid').length,
          period: payroll[0]?.period ?? '',
        },
      }),
    });
  },
  async pay(id) {
    return call('patch', `hr/payroll/${id}`, { resolver: () => ({ id, status: 'paid', paidAt: new Date().toISOString() }) });
  },
  async payslip(id) {
    return call('get', `hr/payroll/${id}/payslip`, {
      resolver: () => {
        const row = payroll.find((p) => p.id === id) ?? payroll[0];
        return { ...row, issuedAt: new Date().toISOString(), reference: `PAY-${Math.floor(Math.random() * 900000) + 100000}` };
      },
    });
  },
};

export const recruitmentService = {
  async jobs() {
    return call('list', 'hr/jobs', {
      resolver: () => ({
        rows: jobs,
        summary: {
          open: jobs.filter((j) => j.status === 'open').length,
          closed: jobs.filter((j) => j.status === 'closed').length,
          applicants: jobs.reduce((s, j) => s + j.applicants, 0),
          hires: jobs.reduce((s, j) => s + j.hired, 0),
        },
      }),
    });
  },
  async candidates() {
    return call('list', 'hr/candidates', {
      resolver: () => ({
        rows: candidates,
        stages: ['screening', 'interview', 'test', 'offer', 'hired', 'rejected'],
        byStage: ['screening', 'interview', 'test', 'offer', 'hired', 'rejected'].map((stage) => ({
          stage,
          count: candidates.filter((c) => c.stage === stage).length,
        })),
      }),
    });
  },
  async advance(id) {
    const order = ['screening', 'interview', 'test', 'offer', 'hired'];
    const row = candidates.find((c) => c.id === id);
    const next = order[Math.min(order.indexOf(row?.stage) + 1, order.length - 1)];
    return call('patch', `hr/candidates/${id}`, { resolver: () => ({ id, stage: next, updatedAt: new Date().toISOString() }) });
  },
};

export const hrOverviewService = {
  async summary() {
    return call('list', 'hr/overview', {
      resolver: () => ({
        kpis: hrKpis,
        headcountByDepartment: [...new Set(employees.map((e) => e.department))].map((department) => ({
          label: department,
          value: employees.filter((e) => e.department === department).length,
        })),
        tenure: employees.map((e) => ({ name: e.name, avatar: e.avatar, hiredAt: e.hiredAt, performance: e.performance })),
      }),
    });
  },
};

export default { employeeService, attendanceService, leaveService, leaveActions, payrollService, recruitmentService, hrOverviewService };
