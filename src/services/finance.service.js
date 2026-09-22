/**
 * NOVAADMIN — Finance services
 * (invoices, transactions, accounts, expenses, income, payments,
 *  subscriptions, payouts, cash flow, reporting)
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { accounts, invoices, transactions, expenses, income, payments, subscriptions, payouts, cashFlow, balanceSheet, INVOICE_STATUSES } from '../data/finance.js';

export const accountService = createResourceService({
  name: 'accounts',
  collection: () => accounts,
  idPrefix: 'acc',
  searchFields: ['name', 'bank', 'number', 'type'],
  sortFields: ['balance', 'name', 'change'],
  extend: (result) => ({
    summary: {
      total: accounts.length,
      balance: accounts.filter((a) => a.currency === 'IRR').reduce((s, a) => s + a.balance, 0),
      blocked: accounts.filter((a) => a.status === 'blocked').length,
      currencies: [...new Set(accounts.map((a) => a.currency))],
      totalCount: result.total,
    },
  }),
});

export const invoiceService = createResourceService({
  name: 'invoices',
  collection: () => invoices,
  idPrefix: 'in',
  searchFields: ['number', 'customer', 'contact', 'email', 'project'],
  sortFields: ['issuedAt', 'dueAt', 'total', 'status'],
  extend: (result) => ({
    summary: {
      total: invoices.length,
      paid: invoices.filter((i) => i.status === 'paid').length,
      unpaid: invoices.filter((i) => i.status === 'unpaid').length,
      overdue: invoices.filter((i) => i.status === 'overdue').length,
      draft: invoices.filter((i) => i.status === 'draft').length,
      revenue: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
      outstanding: invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + (i.total - i.paid), 0),
      statuses: INVOICE_STATUSES,
      totalCount: result.total,
    },
  }),
});

export const invoiceActions = {
  async send(id, { email, message } = {}) {
    return call('post', `invoices/${id}/send`, { resolver: () => ({ id, email, message, sentAt: new Date().toISOString(), status: 'unpaid' }) });
  },
  async markPaid(id, amount) {
    return call('patch', `invoices/${id}`, { resolver: () => ({ id, status: 'paid', statusLabel: 'پرداخت شده', paid: amount, paidAt: new Date().toISOString() }) });
  },
  async duplicate(id) {
    return call('post', `invoices/${id}/duplicate`, { resolver: () => ({ id: `in-${Date.now()}`, status: 'draft', statusLabel: 'پیش‌نویس', number: `INV-${Math.floor(Math.random() * 9000) + 1000}`, issuedAt: new Date().toISOString() }) });
  },
  async void(id) {
    return call('patch', `invoices/${id}`, { resolver: () => ({ id, status: 'void', statusLabel: 'باطل شده' }) });
  },
  async remove(id) {
    return call('remove', `invoices/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
};

export const transactionService = createResourceService({
  name: 'transactions',
  collection: () => transactions,
  idPrefix: 'tx',
  searchFields: ['reference', 'counterparty', 'account', 'method', 'orderRef'],
  sortFields: ['at', 'amount'],
  extend: (result) => ({
    summary: {
      total: transactions.length,
      inflow: transactions.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0),
      outflow: Math.abs(transactions.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0)),
      pending: transactions.filter((t) => t.status === 'pending').length,
      failed: transactions.filter((t) => t.status === 'failed').length,
      totalCount: result.total,
    },
  }),
});

export const expenseService = createResourceService({
  name: 'expenses',
  collection: () => expenses,
  idPrefix: 'ex',
  searchFields: ['title', 'category', 'vendor', 'owner'],
  sortFields: ['amount', 'at', 'title'],
  extend: (result) => ({
    summary: {
      total: expenses.length,
      amount: expenses.reduce((s, e) => s + e.amount, 0),
      paid: expenses.filter((e) => e.status === 'paid').reduce((s, e) => s + e.amount, 0),
      pending: expenses.filter((e) => e.status === 'pending').length,
      byCategory: Object.entries(
        expenses.reduce((acc, e) => {
          acc[e.category] = (acc[e.category] ?? 0) + e.amount;
          return acc;
        }, {}),
      ).map(([label, value]) => ({ label, value })),
      totalCount: result.total,
    },
  }),
});

export const incomeService = createResourceService({
  name: 'income',
  collection: () => income,
  idPrefix: 'inc',
  searchFields: ['source', 'customer', 'method'],
  sortFields: ['amount', 'at'],
});

export const paymentService = createResourceService({
  name: 'payments',
  collection: () => payments,
  idPrefix: 'pay',
  searchFields: ['invoice', 'customer', 'gateway', 'reference'],
  sortFields: ['at', 'amount'],
  extend: (result) => ({
    summary: {
      total: payments.length,
      successful: payments.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0),
      failed: payments.filter((p) => p.status === 'failed').length,
      refunded: payments.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0),
      totalCount: result.total,
    },
  }),
});

export const subscriptionService = createResourceService({
  name: 'subscriptions',
  collection: () => subscriptions,
  idPrefix: 'sub',
  searchFields: ['customer', 'plan', 'status'],
  sortFields: ['mrr', 'renewsAt', 'startedAt'],
  extend: (result) => ({
    summary: {
      total: subscriptions.length,
      mrr: subscriptions.filter((s) => s.status === 'active').reduce((s, sub) => s + (sub.interval === 'yearly' ? Math.round(sub.mrr / 12) : sub.mrr), 0),
      active: subscriptions.filter((s) => s.status === 'active').length,
      trialing: subscriptions.filter((s) => s.status === 'trialing').length,
      pastDue: subscriptions.filter((s) => s.status === 'past_due').length,
      churnRisk: subscriptions.filter((s) => s.churnRisk > 25).length,
      totalCount: result.total,
    },
  }),
});

export const payoutService = createResourceService({
  name: 'payouts',
  collection: () => payouts,
  idPrefix: 'po',
  searchFields: ['reference', 'vendor', 'method', 'iban'],
  sortFields: ['amount', 'at'],
  extend: (result) => ({
    summary: {
      total: payouts.length,
      paid: payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
      pending: payouts.filter((p) => p.status === 'pending').length,
      fees: payouts.reduce((s, p) => s + p.fee, 0),
      totalCount: result.total,
    },
  }),
});

export const financeReportsService = {
  async cashFlow() {
    return call('list', 'finance/cash-flow', {
      resolver: () => ({
        series: cashFlow,
        inflow: cashFlow.reduce((s, m) => s + m.inflow, 0),
        outflow: cashFlow.reduce((s, m) => s + m.outflow, 0),
        net: cashFlow.reduce((s, m) => s + (m.inflow - m.outflow), 0),
      }),
    });
  },
  async balanceSheet() {
    return call('list', 'finance/balance-sheet', {
      resolver: () => ({ rows: balanceSheet, total: balanceSheet.reduce((s, r) => s + r.value, 0) }),
    });
  },
  async profitAndLoss() {
    return call('list', 'finance/pnl', {
      resolver: () => {
        const revenue = income.reduce((s, i) => s + i.amount, 0);
        const cost = expenses.reduce((s, e) => s + e.amount, 0);
        return {
          revenue,
          cost,
          gross: Math.round(revenue * 0.62),
          operating: cost,
          net: revenue - cost,
          margin: Number((((revenue - cost) / revenue) * 100).toFixed(1)),
          lines: [
            { label: 'درآمد عملیاتی', value: revenue, tone: 'success' },
            { label: 'بهای تمام‌شده کالای فروش‌رفته', value: -Math.round(revenue * 0.38), tone: 'warning' },
            { label: 'هزینه‌های فروش و بازاریابی', value: -Math.round(cost * 0.34), tone: 'warning' },
            { label: 'هزینه‌های اداری و عمومی', value: -Math.round(cost * 0.42), tone: 'warning' },
            { label: 'استهلاک و مالیات', value: -Math.round(cost * 0.24), tone: 'danger' },
            { label: 'سود خالص', value: revenue - cost, tone: 'success' },
          ],
        };
      },
    });
  },
  async aging() {
    return call('list', 'finance/aging', {
      resolver: () => {
        const buckets = [
          { label: 'سررسید نشده', days: 0, from: -Infinity },
          { label: '۱ تا ۳۰ روز', days: 30, from: 0 },
          { label: '۳۱ تا ۶۰ روز', days: 60, from: 30 },
          { label: '۶۱ تا ۹۰ روز', days: 90, from: 60 },
          { label: 'بیش از ۹۰ روز', days: 999, from: 90 },
        ];
        const open = invoices.filter((i) => i.status !== 'paid');
        return buckets.map((bucket, index) => {
          const next = buckets[index + 1];
          const rows = open.filter((i) => {
            const age = Math.floor((Date.now() - new Date(i.issuedAt).getTime()) / 86400000);
            return age > bucket.from && (!next || age <= next.from);
          });
          return { ...bucket, count: rows.length, amount: rows.reduce((s, i) => s + (i.total - i.paid), 0) };
        });
      },
    });
  },
};

export default { accountService, invoiceService, invoiceActions, transactionService, expenseService, incomeService, paymentService, subscriptionService, payoutService, financeReportsService };
