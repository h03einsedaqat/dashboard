/**
 * NOVAADMIN — service registry
 * ------------------------------------------------------------------
 * Single import surface for application code:
 *
 *   import { orderService, analyticsService } from '../services/index.js';
 *
 * Every service exposes the same REST-shaped contract (list / get / create /
 * update / patch / remove) so swapping the mock layer for a real backend only
 * requires flipping `config.api.useMocks` — no component changes.
 */
export { ApiError, apiConfig, http, mock, call } from './client.js';
export { createResourceService, runQuery } from './resource.js';

export { authService, userService, roleService, teamService, departmentService, customerService, invitationService, sessionService, apiKeyService, activityService, notificationService } from './user.service.js';
export { productService, categoryService, brandService, tagService, inventoryService, reviewService, couponService, orderService, orderActions, catalogService } from './commerce.service.js';
export { companyService, contactService, leadService, dealService, pipelineService, crmActivityService, callService, meetingService, campaignService, salesForecastService } from './crm.service.js';
export { projectService, taskService, kanbanService, backlogService, milestoneService, projectFeedService, timeTrackingService } from './project.service.js';
export { invoiceService, invoiceActions, transactionService, accountService, expenseService, incomeService, paymentService, subscriptionService, payoutService, financeReportsService } from './finance.service.js';
export { ticketService, ticketActions, agentService, knowledgeBaseService, supportStatsService } from './support.service.js';
export { employeeService, attendanceService, leaveService, leaveActions, payrollService, recruitmentService, hrOverviewService } from './hr.service.js';
export { shipmentService, shipmentActions, driverService, warehouseService, routeService, trackingService } from './logistics.service.js';
export { mailService, chatAppService, calendarService, fileService, fileActions, mediaService, mediaActions, noteService, noteActions } from './app.service.js';
export { modelService, promptService, promptActions, conversationService, chatService, writerService, summarizerService, repurposeService, imageStudioService, schedulerService, schedulerActions, usageService } from './ai.service.js';
export { analyticsService } from './analytics.service.js';
export { searchService, commandService, settingsService, contentService, statusService, helpService, docsService, demoService } from './system.service.js';

import { authService, userService, roleService, teamService, departmentService, customerService, invitationService, sessionService, apiKeyService, activityService, notificationService } from './user.service.js';
import { productService, categoryService, brandService, tagService, inventoryService, reviewService, couponService, orderService, orderActions, catalogService } from './commerce.service.js';
import { companyService, contactService, leadService, dealService, pipelineService, crmActivityService, callService, meetingService, campaignService, salesForecastService } from './crm.service.js';
import { projectService, taskService, kanbanService, backlogService, milestoneService, projectFeedService, timeTrackingService } from './project.service.js';
import { invoiceService, invoiceActions, transactionService, accountService, expenseService, incomeService, paymentService, subscriptionService, payoutService, financeReportsService } from './finance.service.js';
import { ticketService, ticketActions, agentService, knowledgeBaseService, supportStatsService } from './support.service.js';
import { employeeService, attendanceService, leaveService, leaveActions, payrollService, recruitmentService, hrOverviewService } from './hr.service.js';
import { shipmentService, shipmentActions, driverService, warehouseService, routeService, trackingService } from './logistics.service.js';
import { mailService, chatAppService, calendarService, fileService, fileActions, mediaService, mediaActions, noteService, noteActions } from './app.service.js';
import { modelService, promptService, promptActions, conversationService, chatService, writerService, summarizerService, repurposeService, imageStudioService, schedulerService, schedulerActions, usageService } from './ai.service.js';
import { analyticsService } from './analytics.service.js';
import { searchService, commandService, settingsService, contentService, statusService, helpService, docsService, demoService } from './system.service.js';

export default {
  auth: authService,
  users: userService, roles: roleService, teams: teamService, departments: departmentService, customers: customerService,
  invitations: invitationService, sessions: sessionService, apiKeys: apiKeyService, activity: activityService, notifications: notificationService,
  products: productService, categories: categoryService, brands: brandService, tags: tagService, inventory: inventoryService,
  reviews: reviewService, coupons: couponService, orders: orderService, orderActions, catalog: catalogService,
  companies: companyService, contacts: contactService, leads: leadService, deals: dealService, pipeline: pipelineService,
  crmActivity: crmActivityService, calls: callService, meetings: meetingService, campaigns: campaignService, forecast: salesForecastService,
  projects: projectService, tasks: taskService, kanban: kanbanService, backlog: backlogService, milestones: milestoneService,
  projectFeed: projectFeedService, timeTracking: timeTrackingService,
  invoices: invoiceService, invoiceActions, transactions: transactionService, accounts: accountService, expenses: expenseService,
  income: incomeService, payments: paymentService, subscriptions: subscriptionService, payouts: payoutService, financeReports: financeReportsService,
  tickets: ticketService, ticketActions, agents: agentService, kb: knowledgeBaseService, supportStats: supportStatsService,
  employees: employeeService, attendance: attendanceService, leave: leaveService, leaveActions, payroll: payrollService, recruitment: recruitmentService, hr: hrOverviewService,
  shipments: shipmentService, shipmentActions, drivers: driverService, warehouses: warehouseService, routes: routeService, tracking: trackingService,
  mail: mailService, chat: chatAppService, calendar: calendarService, files: fileService, fileActions, media: mediaService, mediaActions, notes: noteService, noteActions,
  models: modelService, prompts: promptService, promptActions, conversations: conversationService, aiChat: chatService, writer: writerService,
  summarizer: summarizerService, repurpose: repurposeService, images: imageStudioService, scheduler: schedulerService, schedulerActions, usage: usageService,
  analytics: analyticsService,
  search: searchService, commands: commandService, settings: settingsService, content: contentService, status: statusService, help: helpService, docs: docsService, demos: demoService,
};
