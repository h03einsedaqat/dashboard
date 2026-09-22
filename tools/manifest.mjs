/**
 * NOVAADMIN — Application map (single source of truth)
 * ------------------------------------------------------------------
 * This manifest drives:
 *   • page generation          (tools/build-pages.mjs)
 *   • the sidebar navigation   (rendered as markup + runtime template)
 *   • header mega-menu / demo switcher links
 *   • link QA                  (tools/qa-links.mjs)
 *
 * Item shape:
 *   { id, label, icon, url?, badge?, children?[], kind?, resource?, flags? }
 *
 *   label   → localized string  (fa is the primary language)
 *   kind    → 'dashboard' | 'list' | 'detail' | 'form' | 'app' | 'doc' | 'ui' | 'system'
 *   resource→ which data resource the generic page renderer should use
 */

const L = (fa, en, ar) => ({ fa, en, ar });

export const sidebar = [
  /* ============================================ MAIN / DASHBOARDS */
  {
    label: L('اصلی', 'Main', 'الرئيسية'),
    items: [
      {
        id: 'dashboards',
        label: L('داشبوردها', 'Dashboards', 'لوحات التحكم'),
        icon: 'grid-1x2-fill',
        url: 'dashboards/analytics.html',
        badge: { text: '10', variant: 'primary' },
        kind: 'dashboard',
        children: [
          { id: 'dash-analytics', label: L('آنالیتیکس', 'Analytics', 'التحليلات'), icon: 'graph-up-arrow', url: 'dashboards/analytics.html', resource: 'analytics', kind: 'dashboard' },
          { id: 'dash-ecommerce', label: L('فروشگاهی', 'eCommerce', 'التجارة الإلكترونية'), icon: 'bag', url: 'dashboards/ecommerce.html', resource: 'ecommerce', kind: 'dashboard' },
          { id: 'dash-crm', label: L('مدیریت مشتریان', 'CRM', 'إدارة العملاء'), icon: 'person-lines-fill', url: 'dashboards/crm.html', resource: 'crm', kind: 'dashboard' },
          { id: 'dash-saas', label: L('سرویس ابری', 'SaaS', 'البرمجيات كخدمة'), icon: 'cloud', url: 'dashboards/saas.html', resource: 'saas', kind: 'dashboard' },
          { id: 'dash-finance', label: L('مالی', 'Finance', 'المالية'), icon: 'cash-stack', url: 'dashboards/finance.html', resource: 'finance', kind: 'dashboard' },
          { id: 'dash-projects', label: L('مدیریت پروژه', 'Projects', 'إدارة المشاريع'), icon: 'kanban', url: 'dashboards/projects.html', resource: 'projects', kind: 'dashboard' },
          { id: 'dash-hr', label: L('منابع انسانی', 'HR', 'الموارد البشرية'), icon: 'people', url: 'dashboards/hr.html', resource: 'hr', kind: 'dashboard' },
          { id: 'dash-support', label: L('پشتیبانی', 'Support', 'الدعم'), icon: 'headset', url: 'dashboards/support.html', resource: 'support', kind: 'dashboard' },
          { id: 'dash-ai', label: L('هوش مصنوعی', 'AI SaaS', 'الذكاء الاصطناعي'), icon: 'stars', url: 'dashboards/ai.html', resource: 'ai', kind: 'dashboard' },
          { id: 'dash-logistics', label: L('لجستیک', 'Logistics', 'اللوجستيات'), icon: 'truck', url: 'dashboards/logistics.html', resource: 'logistics', kind: 'dashboard' },
        ],
      },
      { id: 'widgets', label: L('ابزارک‌ها', 'Widgets', 'الودجات'), icon: 'boxes', url: 'widgets.html', kind: 'app', badge: { text: 'New', variant: 'success' } },
    ],
  },

  /* ================================================ APPLICATIONS */
  {
    label: L('اپلیکیشن‌ها', 'Applications', 'التطبيقات'),
    items: [
      {
        id: 'ai',
        label: L('کارگاه هوش مصنوعی', 'AI Workspace', 'مساحة الذكاء'),
        icon: 'stars',
        url: 'ai/dashboard.html',
        badge: { text: 'AI', variant: 'violet' },
        kind: 'dashboard',
        children: [
          { id: 'ai-dashboard', label: L('داشبورد AI', 'AI Dashboard', 'لوحة الذكاء'), icon: 'speedometer2', url: 'ai/dashboard.html', kind: 'app' },
          { id: 'ai-chat', label: L('گفتگوی هوشمند', 'AI Chat', 'المحادثة الذكية'), icon: 'chat-square-dots', url: 'ai/chat.html', kind: 'app' },
          { id: 'ai-writer', label: L('نویسنده هوشمند', 'AI Writer', 'الكاتب الذكي'), icon: 'pencil-square', url: 'ai/writer.html', kind: 'app' },
          { id: 'ai-summarizer', label: L('خلاصه‌ساز', 'AI Summarizer', 'الملخّص'), icon: 'file-earmark-text', url: 'ai/summarizer.html', kind: 'app' },
          { id: 'ai-repurposer', label: L('بازتولید محتوا', 'Content Repurposer', 'إعادة صياغة المحتوى'), icon: 'recycle', url: 'ai/repurposer.html', kind: 'app' },
          { id: 'ai-prompts', label: L('کتابخانه پرامپت', 'Prompt Library', 'مكتبة الأوامر'), icon: 'collection', url: 'ai/prompts.html', kind: 'app' },
          { id: 'ai-scheduler', label: L('زمان‌بند AI', 'AI Scheduler', 'مجدول الذكاء'), icon: 'calendar-check', url: 'ai/scheduler.html', kind: 'app' },
          { id: 'ai-images', label: L('استودیو تصویر', 'AI Image Studio', 'استوديو الصور'), icon: 'image', url: 'ai/images.html', kind: 'app' },
          { id: 'ai-usage', label: L('مصرف و هزینه', 'AI Usage', 'الاستهلاك'), icon: 'bar-chart-line', url: 'ai/usage.html', kind: 'app' },
          { id: 'ai-models', label: L('مدل‌ها', 'Models', 'النماذج'), icon: 'cpu', url: 'ai/models.html', kind: 'list' },
          { id: 'ai-keys', label: L('کلیدهای API', 'API Keys', 'مفاتيح API'), icon: 'key', url: 'ai/api-keys.html', kind: 'app' },
          { id: 'ai-history', label: L('تاریخچه AI', 'AI History', 'سجل الذكاء'), icon: 'clock-history', url: 'ai/history.html', kind: 'list' },
        ],
      },
      {
        id: 'ecommerce',
        label: L('فروشگاه', 'eCommerce', 'التجارة'),
        icon: 'bag',
        url: 'ecommerce/products.html',
        kind: 'list',
        children: [
          { id: 'ec-products', label: L('محصولات', 'Products', 'المنتجات'), icon: 'box-seam', url: 'ecommerce/products.html', resource: 'products', kind: 'list' },
          { id: 'ec-grid', label: L('نمایش شبکه‌ای', 'Product Grid', 'شبكة المنتجات'), icon: 'grid-3x3-gap', url: 'ecommerce/product-grid.html', resource: 'products', kind: 'app' },
          { id: 'ec-details', label: L('جزئیات محصول', 'Product Details', 'تفاصيل المنتج'), icon: 'info-square', url: 'ecommerce/product-details.html', resource: 'products', kind: 'app' },
          { id: 'ec-create', label: L('افزودن محصول', 'Create Product', 'إضافة منتج'), icon: 'plus-square', url: 'ecommerce/product-create.html', resource: 'products', kind: 'app' },
          { id: 'ec-categories', label: L('دسته‌بندی‌ها', 'Categories', 'الفئات'), icon: 'diagram-3', url: 'ecommerce/categories.html', resource: 'categories', kind: 'list' },
          { id: 'ec-brands', label: L('برندها', 'Brands', 'العلامات'), icon: 'award', url: 'ecommerce/brands.html', resource: 'brands', kind: 'list' },
          { id: 'ec-tags', label: L('برچسب‌ها', 'Tags', 'الوسوم'), icon: 'tags', url: 'ecommerce/tags.html', resource: 'tags', kind: 'list' },
          { id: 'ec-inventory', label: L('موجودی انبار', 'Inventory', 'المخزون'), icon: 'boxes', url: 'ecommerce/inventory.html', resource: 'inventory', kind: 'list' },
          { id: 'ec-reviews', label: L('دیدگاه‌ها', 'Reviews', 'التقييمات'), icon: 'star-half', url: 'ecommerce/reviews.html', resource: 'reviews', kind: 'list' },
          { id: 'ec-coupons', label: L('کدهای تخفیف', 'Coupons', 'الكوبونات'), icon: 'ticket-perforated', url: 'ecommerce/coupons.html', resource: 'coupons', kind: 'app' },
          { id: 'ec-orders', label: L('سفارش‌ها', 'Orders', 'الطلبات'), icon: 'receipt', url: 'ecommerce/orders.html', resource: 'orders', kind: 'list' },
          { id: 'ec-order-details', label: L('جزئیات سفارش', 'Order Details', 'تفاصيل الطلب'), icon: 'file-earmark-ruled', url: 'ecommerce/order-details.html', resource: 'orders', kind: 'app' },
        ],
      },
      {
        id: 'crm',
        label: L('CRM', 'CRM', 'إدارة العملاء'),
        icon: 'person-lines-fill',
        url: 'crm/pipeline.html',
        kind: 'app',
        children: [
          { id: 'crm-pipeline', label: L('قیف فروش', 'Deal Pipeline', 'قمع الصفقات'), icon: 'kanban-fill', url: 'crm/pipeline.html', kind: 'app' },
          { id: 'crm-contacts', label: L('مخاطبین', 'Contacts', 'جهات الاتصال'), icon: 'person-rolodex', url: 'crm/contacts.html', resource: 'contacts', kind: 'list' },
          { id: 'crm-companies', label: L('شرکت‌ها', 'Companies', 'الشركات'), icon: 'building', url: 'crm/companies.html', resource: 'companies', kind: 'list' },
          { id: 'crm-leads', label: L('سرنخ‌ها', 'Leads', 'العملاء المحتملون'), icon: 'funnel', url: 'crm/leads.html', resource: 'leads', kind: 'list' },
          { id: 'crm-deals', label: L('معاملات', 'Deals', 'الصفقات'), icon: 'briefcase', url: 'crm/deals.html', resource: 'deals', kind: 'list' },
          { id: 'crm-activities', label: L('فعالیت‌ها', 'Activities', 'الأنشطة'), icon: 'activity', url: 'crm/activities.html', resource: 'activities', kind: 'app' },
          { id: 'crm-contact-details', label: L('جزئیات مخاطب', 'Contact Details', 'تفاصيل جهة الاتصال'), icon: 'person-vcard', url: 'crm/contact-details.html', resource: 'contacts', kind: 'app' },
          { id: 'crm-company-details', label: L('جزئیات شرکت', 'Company Details', 'تفاصيل الشركة'), icon: 'building-gear', url: 'crm/company-details.html', resource: 'companies', kind: 'app' },
          { id: 'crm-deal-details', label: L('جزئیات معامله', 'Deal Details', 'تفاصيل الصفقة'), icon: 'briefcase', url: 'crm/deal-details.html', resource: 'deals', kind: 'app' },
          { id: 'crm-calls', label: L('تماس‌ها', 'Calls', 'المكالمات'), icon: 'telephone', url: 'crm/calls.html', resource: 'calls', kind: 'list' },
          { id: 'crm-meetings', label: L('جلسات', 'Meetings', 'الاجتماعات'), icon: 'camera-video', url: 'crm/meetings.html', resource: 'meetings', kind: 'list' },
          { id: 'crm-campaigns', label: L('کمپین‌ها', 'Campaigns', 'الحملات'), icon: 'megaphone', url: 'crm/campaigns.html', resource: 'campaigns', kind: 'list' },
        ],
      },
      {
        id: 'finance',
        label: L('مالی', 'Finance', 'المالية'),
        icon: 'cash-stack',
        url: 'finance/overview.html',
        kind: 'dashboard',
        children: [
          { id: 'fin-overview', label: L('نمای کلی', 'Overview', 'نظرة عامة'), icon: 'pie-chart', url: 'finance/overview.html', kind: 'app' },
          { id: 'fin-transactions', label: L('تراکنش‌ها', 'Transactions', 'الحركات'), icon: 'arrow-left-right', url: 'finance/transactions.html', resource: 'transactions', kind: 'list' },
          { id: 'fin-accounts', label: L('حساب‌ها', 'Accounts', 'الحسابات'), icon: 'wallet2', url: 'finance/accounts.html', resource: 'accounts', kind: 'list' },
          { id: 'fin-expenses', label: L('هزینه‌ها', 'Expenses', 'المصروفات'), icon: 'cash-coin', url: 'finance/expenses.html', resource: 'expenses', kind: 'list' },
          { id: 'fin-income', label: L('درآمدها', 'Income', 'الإيرادات'), icon: 'graph-up', url: 'finance/income.html', resource: 'income', kind: 'list' },
          { id: 'fin-payments', label: L('پرداخت‌ها', 'Payments', 'المدفوعات'), icon: 'credit-card', url: 'finance/payments.html', resource: 'payments', kind: 'list' },
          { id: 'fin-invoices', label: L('فاکتورها', 'Invoices', 'الفواتير'), icon: 'file-earmark-spreadsheet', url: 'finance/invoices.html', resource: 'invoices', kind: 'app' },
          { id: 'fin-invoice-details', label: L('جزئیات فاکتور', 'Invoice Details', 'تفاصيل الفاتورة'), icon: 'file-earmark-text', url: 'finance/invoice-details.html', resource: 'invoices', kind: 'app' },
          { id: 'fin-subscriptions', label: L('اشتراک‌ها', 'Subscriptions', 'الاشتراكات'), icon: 'arrow-repeat', url: 'finance/subscriptions.html', resource: 'subscriptions', kind: 'list' },
          { id: 'fin-payouts', label: L('تسویه‌ها', 'Payouts', 'المدفوعات الصادرة'), icon: 'send-check', url: 'finance/payouts.html', resource: 'payouts', kind: 'list' },
        ],
      },
      {
        id: 'projects',
        label: L('پروژه‌ها', 'Projects', 'المشاريع'),
        icon: 'kanban',
        url: 'projects/list.html',
        kind: 'app',
        children: [
          { id: 'prj-list', label: L('لیست پروژه‌ها', 'Projects', 'قائمة المشاريع'), icon: 'list-task', url: 'projects/list.html', resource: 'projects', kind: 'app' },
          { id: 'prj-details', label: L('جزئیات پروژه', 'Project Details', 'تفاصيل المشروع'), icon: 'window-sidebar', url: 'projects/details.html', resource: 'projects', kind: 'app' },
          { id: 'prj-tasks', label: L('وظایف', 'Tasks', 'المهام'), icon: 'check2-square', url: 'projects/tasks.html', resource: 'tasks', kind: 'list' },
          { id: 'prj-kanban', label: L('کانبان', 'Kanban Board', 'لوحة كانبان'), icon: 'kanban-fill', url: 'projects/kanban.html', kind: 'app' },
          { id: 'prj-timeline', label: L('خط زمان', 'Timeline', 'الجدول الزمني'), icon: 'calendar-range', url: 'projects/timeline.html', resource: 'projects', kind: 'app' },
        ],
      },
      {
        id: 'support',
        label: L('پشتیبانی', 'Support', 'الدعم'),
        icon: 'headset',
        url: 'support/tickets.html',
        kind: 'list',
        children: [
          { id: 'sup-tickets', label: L('تیکت‌ها', 'Tickets', 'التذاكر'), icon: 'ticket-detailed', url: 'support/tickets.html', resource: 'tickets', kind: 'list' },
          { id: 'sup-details', label: L('جزئیات تیکت', 'Ticket Details', 'تفاصيل التذكرة'), icon: 'chat-left-text', url: 'support/ticket-details.html', resource: 'tickets', kind: 'app' },
          { id: 'sup-agents', label: L('کارشناسان', 'Agents', 'الوكلاء'), icon: 'person-badge', url: 'support/agents.html', resource: 'agents', kind: 'list' },
          { id: 'sup-kb', label: L('پایگاه دانش', 'Knowledge Base', 'قاعدة المعرفة'), icon: 'book', url: 'support/knowledge-base.html', kind: 'app' },
        ],
      },
      {
        id: 'hr',
        label: L('منابع انسانی', 'HR', 'الموارد البشرية'),
        icon: 'people',
        url: 'hr/employees.html',
        kind: 'list',
        children: [
          { id: 'hr-employees', label: L('کارکنان', 'Employees', 'الموظفون'), icon: 'person-vcard', url: 'hr/employees.html', resource: 'employees', kind: 'list' },
          { id: 'hr-profile', label: L('پروفایل کارمند', 'Employee Profile', 'ملف الموظف'), icon: 'person-square', url: 'hr/employee-profile.html', resource: 'employees', kind: 'app' },
          { id: 'hr-attendance', label: L('حضور و غیاب', 'Attendance', 'الحضور'), icon: 'clipboard-check', url: 'hr/attendance.html', kind: 'app' },
          { id: 'hr-leave', label: L('مرخصی‌ها', 'Leave Requests', 'الإجازات'), icon: 'calendar-x', url: 'hr/leave.html', resource: 'leave', kind: 'list' },
          { id: 'hr-payroll', label: L('حقوق و دستمزد', 'Payroll', 'الرواتب'), icon: 'cash-stack', url: 'hr/payroll.html', resource: 'payroll', kind: 'list' },
          { id: 'hr-departments', label: L('دپارتمان‌ها', 'Departments', 'الأقسام'), icon: 'diagram-3', url: 'hr/departments.html', resource: 'departments', kind: 'list' },
          { id: 'hr-recruitment', label: L('استخدام', 'Recruitment', 'التوظيف'), icon: 'person-plus', url: 'hr/recruitment.html', resource: 'jobs', kind: 'app' },
        ],
      },
      {
        id: 'logistics',
        label: L('لجستیک', 'Logistics', 'اللوجستيات'),
        icon: 'truck',
        url: 'logistics/shipments.html',
        kind: 'list',
        children: [
          { id: 'log-shipments', label: L('محموله‌ها', 'Shipments', 'الشحنات'), icon: 'box-seam', url: 'logistics/shipments.html', resource: 'shipments', kind: 'list' },
          { id: 'log-tracking', label: L('رهگیری زنده', 'Live Tracking', 'التتبع المباشر'), icon: 'geo-alt', url: 'logistics/tracking.html', kind: 'app' },
          { id: 'log-drivers', label: L('رانندگان', 'Drivers', 'السائقون'), icon: 'person-badge', url: 'logistics/drivers.html', resource: 'drivers', kind: 'list' },
          { id: 'log-warehouses', label: L('انبارها', 'Warehouses', 'المستودعات'), icon: 'building-gear', url: 'logistics/warehouses.html', resource: 'warehouses', kind: 'list' },
        ],
      },
      {
        id: 'communication',
        label: L('ارتباطات', 'Communication', 'الاتصالات'),
        icon: 'chat-dots',
        url: 'apps/chat.html',
        kind: 'app',
        children: [
          { id: 'chat', label: L('گفتگو', 'Chat', 'المحادثة'), icon: 'chat-dots', url: 'apps/chat.html', kind: 'app' },
          { id: 'email', label: L('ایمیل', 'Email', 'البريد'), icon: 'envelope', url: 'apps/email.html', badge: { text: '12', variant: 'danger' }, kind: 'app' },
          { id: 'calendar', label: L('تقویم', 'Calendar', 'التقويم'), icon: 'calendar3', url: 'apps/calendar.html', kind: 'app' },
          { id: 'files', label: L('مدیریت فایل', 'File Manager', 'إدارة الملفات'), icon: 'folder2-open', url: 'apps/file-manager.html', kind: 'app' },
          { id: 'media', label: L('کتابخانه رسانه', 'Media Library', 'مكتبة الوسائط'), icon: 'images', url: 'apps/media-library.html', kind: 'app' },
          { id: 'notifications', label: L('اعلان‌ها', 'Notifications', 'الإشعارات'), icon: 'bell', url: 'apps/notifications.html', kind: 'app' },
        ],
      },
    ],
  },

  /* ======================================================== USERS */
  {
    label: L('کاربران و دسترسی', 'Users & Access', 'المستخدمون والصلاحيات'),
    items: [
      {
        id: 'users',
        label: L('مدیریت کاربران', 'User Management', 'إدارة المستخدمين'),
        icon: 'people-fill',
        url: 'users/list.html',
        kind: 'list',
        children: [
          { id: 'users-list', label: L('لیست کاربران', 'Users List', 'قائمة المستخدمين'), icon: 'list-ul', url: 'users/list.html', resource: 'users', kind: 'list' },
          { id: 'users-grid', label: L('نمایش شبکه‌ای', 'Users Grid', 'شبكة المستخدمين'), icon: 'grid-3x3-gap', url: 'users/grid.html', resource: 'users', kind: 'app' },
          { id: 'users-create', label: L('افزودن کاربر', 'Create User', 'إضافة مستخدم'), icon: 'person-plus', url: 'users/create.html', resource: 'users', kind: 'app' },
          { id: 'users-details', label: L('پروفایل کاربر', 'User Details', 'تفاصيل المستخدم'), icon: 'person-badge', url: 'users/details.html', resource: 'users', kind: 'app' },
          { id: 'users-roles', label: L('نقش‌ها', 'Roles', 'الأدوار'), icon: 'shield-check', url: 'users/roles.html', kind: 'app' },
          { id: 'users-permissions', label: L('مجوزها', 'Permissions', 'الأذونات'), icon: 'sliders', url: 'users/permissions.html', kind: 'app' },
          { id: 'users-teams', label: L('تیم‌ها', 'Teams', 'الفرق'), icon: 'people', url: 'users/teams.html', resource: 'teams', kind: 'app' },
          { id: 'users-departments', label: L('دپارتمان‌ها', 'Departments', 'الأقسام'), icon: 'diagram-3', url: 'users/departments.html', resource: 'departments', kind: 'list' },
          { id: 'users-invitations', label: L('دعوت‌نامه‌ها', 'Invitations', 'الدعوات'), icon: 'envelope-paper', url: 'users/invitations.html', resource: 'invitations', kind: 'list' },
          { id: 'users-activity', label: L('فعالیت کاربران', 'Activity Log', 'سجل النشاط'), icon: 'activity', url: 'users/activity.html', resource: 'activities', kind: 'app' },
          { id: 'users-sessions', label: L('نشست‌ها', 'Sessions', 'الجلسات'), icon: 'pc-display', url: 'users/sessions.html', resource: 'sessions', kind: 'list' },
        ],
      },
      {
        id: 'customers',
        label: L('مشتریان', 'Customers', 'العملاء'),
        icon: 'person-hearts',
        url: 'customers/list.html',
        kind: 'list',
        children: [
          { id: 'cust-list', label: L('لیست مشتریان', 'Customer List', 'قائمة العملاء'), icon: 'list-ul', url: 'customers/list.html', resource: 'customers', kind: 'list' },
          { id: 'cust-details', label: L('پروفایل مشتری', 'Customer Details', 'تفاصيل العميل'), icon: 'person-vcard', url: 'customers/details.html', resource: 'customers', kind: 'app' },
          { id: 'cust-orders', label: L('سفارش‌های مشتری', 'Customer Orders', 'طلبات العميل'), icon: 'receipt', url: 'customers/orders.html', resource: 'orders', kind: 'list' },
          { id: 'cust-segments', label: L('بخش‌بندی', 'Segments', 'الشرائح'), icon: 'pie-chart-fill', url: 'customers/segments.html', resource: 'segments', kind: 'app' },
        ],
      },
    ],
  },

  /* ====================================================== REPORTS */
  {
    label: L('گزارش‌ها و محتوا', 'Reports & Content', 'التقارير والمحتوى'),
    items: [
      {
        id: 'reports',
        label: L('گزارش‌ها', 'Reports', 'التقارير'),
        icon: 'file-bar-graph',
        url: 'reports/sales.html',
        kind: 'app',
        children: [
          { id: 'rep-sales', label: L('فروش', 'Sales Report', 'تقرير المبيعات'), icon: 'graph-up-arrow', url: 'reports/sales.html', resource: 'sales', kind: 'app' },
          { id: 'rep-revenue', label: L('درآمد', 'Revenue Report', 'تقرير الإيرادات'), icon: 'currency-dollar', url: 'reports/revenue.html', resource: 'revenue', kind: 'app' },
          { id: 'rep-customers', label: L('مشتریان', 'Customers Report', 'تقرير العملاء'), icon: 'people', url: 'reports/customers.html', resource: 'customers', kind: 'app' },
          { id: 'rep-products', label: L('محصولات', 'Products Report', 'تقرير المنتجات'), icon: 'box-seam', url: 'reports/products.html', resource: 'products', kind: 'app' },
          { id: 'rep-finance', label: L('مالی', 'Finance Report', 'التقرير المالي'), icon: 'cash-stack', url: 'reports/finance.html', resource: 'finance', kind: 'app' },
          { id: 'rep-performance', label: L('عملکرد', 'Performance', 'الأداء'), icon: 'speedometer2', url: 'reports/performance.html', resource: 'performance', kind: 'app' },
          { id: 'rep-traffic', label: L('ترافیک', 'Traffic', 'الزيارات'), icon: 'globe2', url: 'reports/traffic.html', resource: 'traffic', kind: 'app' },
          { id: 'rep-support', label: L('پشتیبانی', 'Support Report', 'تقرير الدعم'), icon: 'headset', url: 'reports/support.html', resource: 'support', kind: 'app' },
        ],
      },
      {
        id: 'cms',
        label: L('مدیریت محتوا', 'Content (CMS)', 'إدارة المحتوى'),
        icon: 'journal-richtext',
        url: 'cms/pages.html',
        kind: 'list',
        children: [
          { id: 'cms-pages', label: L('صفحات', 'Pages', 'الصفحات'), icon: 'file-earmark-richtext', url: 'cms/pages.html', resource: 'pages', kind: 'list' },
          { id: 'cms-builder', label: L('صفحه‌ساز', 'Page Builder', 'منشئ الصفحات'), icon: 'layout-text-window-reverse', url: 'cms/page-builder.html', kind: 'app' },
          { id: 'cms-posts', label: L('نوشته‌ها', 'Blog Posts', 'المقالات'), icon: 'postcard', url: 'cms/posts.html', resource: 'posts', kind: 'list' },
          { id: 'cms-post-create', label: L('نوشته جدید', 'New Post', 'مقال جديد'), icon: 'pencil-square', url: 'cms/post-create.html', kind: 'app' },
          { id: 'cms-categories', label: L('دسته‌ها', 'Categories', 'التصنيفات'), icon: 'diagram-3', url: 'cms/categories.html', resource: 'categories', kind: 'list' },
          { id: 'cms-tags', label: L('برچسب‌ها', 'Tags', 'الوسوم'), icon: 'tags', url: 'cms/tags.html', resource: 'tags', kind: 'list' },
          { id: 'cms-comments', label: L('دیدگاه‌ها', 'Comments', 'التعليقات'), icon: 'chat-left-quote', url: 'cms/comments.html', resource: 'comments', kind: 'list' },
          { id: 'cms-media', label: L('رسانه', 'Media', 'الوسائط'), icon: 'images', url: 'cms/media.html', kind: 'app' },
        ],
      },
    ],
  },

  /* ======================================================= ACCOUNT */
  {
    label: L('حساب و تنظیمات', 'Account & Settings', 'الحساب والإعدادات'),
    items: [
      {
        id: 'profile',
        label: L('پروفایل', 'Profile', 'الملف الشخصي'),
        icon: 'person-circle',
        url: 'profile/overview.html',
        kind: 'app',
        children: [
          { id: 'profile-overview', label: L('نمای کلی', 'Overview', 'نظرة عامة'), icon: 'person', url: 'profile/overview.html', kind: 'app' },
          { id: 'profile-activity', label: L('فعالیت‌ها', 'Activity', 'النشاط'), icon: 'activity', url: 'profile/activity.html', resource: 'activities', kind: 'app' },
          { id: 'profile-projects', label: L('پروژه‌ها', 'Projects', 'المشاريع'), icon: 'kanban', url: 'profile/projects.html', resource: 'projects', kind: 'list' },
          { id: 'profile-invoices', label: L('فاکتورها', 'Invoices', 'الفواتير'), icon: 'receipt', url: 'profile/invoices.html', resource: 'invoices', kind: 'list' },
          { id: 'profile-documents', label: L('اسناد', 'Documents', 'المستندات'), icon: 'folder2', url: 'profile/documents.html', kind: 'app' },
          { id: 'profile-security', label: L('امنیت', 'Security', 'الأمان'), icon: 'shield-lock', url: 'profile/security.html', kind: 'app' },
          { id: 'profile-sessions', label: L('نشست‌های فعال', 'Active Sessions', 'الجلسات النشطة'), icon: 'pc-display', url: 'profile/sessions.html', resource: 'sessions', kind: 'list' },
          { id: 'profile-keys', label: L('کلیدهای API', 'API Keys', 'مفاتيح API'), icon: 'key', url: 'profile/api-keys.html', kind: 'app' },
          { id: 'profile-notifications', label: L('اعلان‌ها', 'Notifications', 'الإشعارات'), icon: 'bell', url: 'profile/notifications.html', kind: 'app' },
        ],
      },
      {
        id: 'settings',
        label: L('تنظیمات', 'Settings', 'الإعدادات'),
        icon: 'gear',
        url: 'settings/general.html',
        kind: 'app',
        children: [
          { id: 'set-general', label: L('عمومی', 'General', 'عام'), icon: 'sliders', url: 'settings/general.html', kind: 'app' },
          { id: 'set-appearance', label: L('ظاهر', 'Appearance', 'المظهر'), icon: 'palette', url: 'settings/appearance.html', kind: 'app' },
          { id: 'set-layout', label: L('چیدمان', 'Layout', 'التخطيط'), icon: 'layout-three-columns', url: 'settings/layout.html', kind: 'app' },
          { id: 'set-localization', label: L('بومی‌سازی', 'Localization', 'التوطين'), icon: 'translate', url: 'settings/localization.html', kind: 'app' },
          { id: 'set-security', label: L('امنیت', 'Security', 'الأمان'), icon: 'shield-lock', url: 'settings/security.html', kind: 'app' },
          { id: 'set-notifications', label: L('اعلان‌ها', 'Notifications', 'الإشعارات'), icon: 'bell', url: 'settings/notifications.html', kind: 'app' },
          { id: 'set-email', label: L('ایمیل', 'Email', 'البريد'), icon: 'envelope-at', url: 'settings/email.html', kind: 'app' },
          { id: 'set-integrations', label: L('یکپارچه‌سازی', 'Integrations', 'التكاملات'), icon: 'plugin', url: 'settings/integrations.html', kind: 'app' },
          { id: 'set-api', label: L('API و وب‌هوک', 'API & Webhooks', 'API والخطافات'), icon: 'code-slash', url: 'settings/api.html', kind: 'app' },
          { id: 'set-billing', label: L('صورتحساب', 'Billing', 'الفوترة'), icon: 'credit-card-2-front', url: 'settings/billing.html', kind: 'app' },
          { id: 'set-system', label: L('سیستم', 'System', 'النظام'), icon: 'hdd-stack', url: 'settings/system.html', kind: 'app' },
        ],
      },
    ],
  },

  /* ==================================================== DEVELOPERS */
  {
    label: L('توسعه‌دهندگان', 'Developers', 'المطورون'),
    items: [
      {
        id: 'ui',
        label: L('کیت رابط کاربری', 'UI Kit', 'مجموعة الواجهة'),
        icon: 'palette2',
        url: 'ui/buttons.html',
        badge: { text: '40+', variant: 'info' },
        kind: 'ui',
        children: [
          { id: 'ui-buttons', label: L('دکمه‌ها', 'Buttons', 'الأزرار'), icon: 'hand-index-thumb', url: 'ui/buttons.html', kind: 'ui' },
          { id: 'ui-forms', label: L('فرم‌ها', 'Forms', 'النماذج'), icon: 'input-cursor-text', url: 'ui/forms.html', kind: 'ui' },
          { id: 'ui-inputs', label: L('ورودی‌های پیشرفته', 'Advanced Inputs', 'إدخالات متقدمة'), icon: 'sliders2', url: 'ui/inputs.html', kind: 'ui' },
          { id: 'ui-cards', label: L('کارت‌ها', 'Cards', 'البطاقات'), icon: 'card-text', url: 'ui/cards.html', kind: 'ui' },
          { id: 'ui-tables', label: L('جدول‌ها', 'Tables', 'الجداول'), icon: 'table', url: 'ui/tables.html', kind: 'ui' },
          { id: 'ui-badges', label: L('نشان‌ها', 'Badges & Pills', 'الشارات'), icon: 'bookmark-star', url: 'ui/badges.html', kind: 'ui' },
          { id: 'ui-alerts', label: L('هشدارها', 'Alerts', 'التنبيهات'), icon: 'exclamation-triangle', url: 'ui/alerts.html', kind: 'ui' },
          { id: 'ui-toasts', label: L('توست‌ها', 'Toasts', 'الإشعارات المنبثقة'), icon: 'bell-fill', url: 'ui/toasts.html', kind: 'ui' },
          { id: 'ui-modals', label: L('مودال و دراور', 'Modals & Drawers', 'النوافذ الجانبية'), icon: 'app-indicator', url: 'ui/modals.html', kind: 'ui' },
          { id: 'ui-dropdowns', label: L('منوهای بازشو', 'Dropdowns', 'القوائم'), icon: 'menu-button-wide', url: 'ui/dropdowns.html', kind: 'ui' },
          { id: 'ui-tooltips', label: L('تولتیپ و پاپ‌اور', 'Tooltips & Popovers', 'التلميحات'), icon: 'chat-square-quote', url: 'ui/tooltips.html', kind: 'ui' },
          { id: 'ui-tabs', label: L('تب و آکاردئون', 'Tabs & Accordion', 'التبويب والأكورديون'), icon: 'segmented-nav', url: 'ui/tabs.html', kind: 'ui' },
          { id: 'ui-progress', label: L('پیشرفت و اسپینر', 'Progress & Spinners', 'التقدم والمؤشرات'), icon: 'hourglass-split', url: 'ui/progress.html', kind: 'ui' },
          { id: 'ui-timeline', label: L('خط زمان', 'Timeline & Steps', 'الخط الزمني'), icon: 'signpost-2', url: 'ui/timeline.html', kind: 'ui' },
          { id: 'ui-avatars', label: L('آواتار', 'Avatars', 'الصور الرمزية'), icon: 'person-circle', url: 'ui/avatars.html', kind: 'ui' },
          { id: 'ui-charts', label: L('نمودارها', 'Charts', 'الرسوم البيانية'), icon: 'bar-chart-fill', url: 'ui/charts.html', kind: 'ui' },
          { id: 'ui-typography', label: L('تایپوگرافی', 'Typography', 'الطباعة'), icon: 'fonts', url: 'ui/typography.html', kind: 'ui' },
          { id: 'ui-colors', label: L('رنگ‌ها', 'Colors', 'الألوان'), icon: 'droplet-half', url: 'ui/colors.html', kind: 'ui' },
          { id: 'ui-icons', label: L('آیکون‌ها', 'Icons', 'الأيقونات'), icon: 'emoji-smile', url: 'ui/icons.html', kind: 'ui' },
          { id: 'ui-grid', label: L('شبکه و فاصله', 'Grid & Spacing', 'الشبكة والمسافات'), icon: 'grid-3x2', url: 'ui/grid.html', kind: 'ui' },
          { id: 'ui-states', label: L('حالت‌های صفحه', 'States', 'الحالات'), icon: 'shield-exclamation', url: 'ui/states.html', kind: 'ui' },
        ],
      },
      {
        id: 'docs',
        label: L('مستندات', 'Documentation', 'التوثيق'),
        icon: 'book-half',
        url: 'docs/introduction.html',
        kind: 'doc',
        children: [
          { id: 'doc-intro', label: L('معرفی', 'Introduction', 'مقدمة'), icon: 'info-circle', url: 'docs/introduction.html', kind: 'doc' },
          { id: 'doc-install', label: L('نصب', 'Installation', 'التثبيت'), icon: 'download', url: 'docs/installation.html', kind: 'doc' },
          { id: 'doc-dev', label: L('محیط توسعه', 'Development', 'التطوير'), icon: 'terminal', url: 'docs/development.html', kind: 'doc' },
          { id: 'doc-build', label: L('ساخت و انتشار', 'Build & Deploy', 'البناء والنشر'), icon: 'cloud-upload', url: 'docs/build-deploy.html', kind: 'doc' },
          { id: 'doc-structure', label: L('ساختار پروژه', 'Folder Structure', 'هيكل المجلدات'), icon: 'folder-symlink', url: 'docs/folder-structure.html', kind: 'doc' },
          { id: 'doc-config', label: L('تنظیمات', 'Configuration', 'الإعدادات'), icon: 'sliders', url: 'docs/configuration.html', kind: 'doc' },
          { id: 'doc-theme', label: L('شخصی‌سازی تم', 'Theme Customization', 'تخصيص المظهر'), icon: 'palette2', url: 'docs/theme-customization.html', kind: 'doc' },
          { id: 'doc-rtl', label: L('RTL و LTR', 'RTL & LTR', 'الاتجاه'), icon: 'arrow-left-right', url: 'docs/rtl-ltr.html', kind: 'doc' },
          { id: 'doc-i18n', label: L('چندزبانه', 'Localization', 'التوطين'), icon: 'translate', url: 'docs/localization.html', kind: 'doc' },
          { id: 'doc-jalali', label: L('تقویم شمسی', 'Jalali Calendar', 'التقويم الهجري الشمسي'), icon: 'calendar3', url: 'docs/jalali-calendar.html', kind: 'doc' },
          { id: 'doc-components', label: L('کامپوننت‌ها', 'Components', 'المكوّنات'), icon: 'puzzle', url: 'docs/components.html', kind: 'doc' },
          { id: 'doc-tables', label: L('جدول داده', 'Data Tables', 'جداول البيانات'), icon: 'table', url: 'docs/data-tables.html', kind: 'doc' },
          { id: 'doc-forms', label: L('فرم و اعتبارسنجی', 'Forms & Validation', 'النماذج والتحقق'), icon: 'ui-checks', url: 'docs/forms.html', kind: 'doc' },
          { id: 'doc-charts', label: L('نمودارها', 'Charts', 'الرسوم'), icon: 'bar-chart-line', url: 'docs/charts.html', kind: 'doc' },
          { id: 'doc-adding', label: L('افزودن صفحه جدید', 'Adding a Page', 'إضافة صفحة'), icon: 'file-plus', url: 'docs/adding-pages.html', kind: 'doc' },
          { id: 'doc-api', label: L('اتصال به API', 'API Integration', 'تكامل API'), icon: 'code-slash', url: 'docs/api-integration.html', kind: 'doc' },
          { id: 'doc-auth', label: L('احراز هویت', 'Authentication', 'المصادقة'), icon: 'shield-check', url: 'docs/authentication.html', kind: 'doc' },
          { id: 'doc-laravel', label: L('تبدیل به Laravel', 'Convert to Laravel', 'التحويل إلى Laravel'), icon: 'box', url: 'docs/laravel.html', kind: 'doc' },
          { id: 'doc-deploy', label: L('استقرار در هاست', 'Deployment', 'النشر على الاستضافة'), icon: 'server', url: 'docs/deployment.html', kind: 'doc' },
          { id: 'doc-faq', label: L('پرسش‌های متداول', 'FAQ & Support', 'الأسئلة الشائعة'), icon: 'question-circle', url: 'docs/faq.html', kind: 'doc' },
          { id: 'doc-troubleshoot', label: L('رفع اشکال', 'Troubleshooting', 'حل المشاكل'), icon: 'wrench-adjustable', url: 'docs/troubleshooting.html', kind: 'doc' },
          { id: 'doc-migration', label: L('مهاجرت و به‌روزرسانی', 'Migration & Updates', 'الترقية والتحديث'), icon: 'arrow-up-circle', url: 'docs/migration.html', kind: 'doc' },
          { id: 'doc-credits', label: L('اعتبارها و مجوزها', 'Credits & Licenses', 'الحقوق والتراخيص'), icon: 'award', url: 'docs/credits.html', kind: 'doc' },
        ],
      },
      {
        id: 'system',
        label: L('صفحات سیستمی', 'System Pages', 'صفحات النظام'),
        icon: 'exclamation-octagon',
        url: 'system/404.html',
        kind: 'system',
        children: [
          { id: 'sys-404', label: L('۴۰۴ یافت نشد', '404 Not Found', '404'), icon: 'file-x', url: 'system/404.html', kind: 'system' },
          { id: 'sys-403', label: L('۴۰۳ دسترسی', '403 Forbidden', '403'), icon: 'shield-x', url: 'system/403.html', kind: 'system' },
          { id: 'sys-500', label: L('۵۰۰ خطای سرور', '500 Server Error', '500'), icon: 'server', url: 'system/500.html', kind: 'system' },
          { id: 'sys-maintenance', label: L('در حال تعمیر', 'Maintenance', 'الصيانة'), icon: 'tools', url: 'system/maintenance.html', kind: 'system' },
          { id: 'sys-coming', label: L('به‌زودی', 'Coming Soon', 'قريباً'), icon: 'hourglass', url: 'system/coming-soon.html', kind: 'system' },
          { id: 'sys-offline', label: L('آفلاین', 'Offline', 'غير متصل'), icon: 'wifi-off', url: 'system/offline.html', kind: 'system' },
          { id: 'sys-blank', label: L('صفحه خالی', 'Blank Page', 'صفحة فارغة'), icon: 'file-earmark', url: 'system/blank.html', kind: 'system' },
          { id: 'sys-search', label: L('نتایج جستجو', 'Search Results', 'نتائج البحث'), icon: 'search', url: 'system/search-results.html', kind: 'system' },
          { id: 'sys-pricing', label: L('تعرفه‌ها', 'Pricing', 'الأسعار'), icon: 'tags', url: 'system/pricing.html', kind: 'system' },
          { id: 'sys-faq', label: L('پرسش‌های متداول', 'FAQ', 'الأسئلة'), icon: 'question-circle', url: 'system/faq.html', kind: 'system' },
          { id: 'sys-help', label: L('مرکز راهنما', 'Help Center', 'مركز المساعدة'), icon: 'life-preserver', url: 'system/help-center.html', kind: 'system' },
          { id: 'sys-contact', label: L('تماس با ما', 'Contact', 'اتصل بنا'), icon: 'envelope-at', url: 'system/contact.html', kind: 'system' },
          { id: 'sys-status', label: L('وضعیت سرویس', 'Status Page', 'حالة الخدمة'), icon: 'activity', url: 'system/status.html', kind: 'system' },
          { id: 'sys-changelog', label: L('تغییرات نسخه', 'Changelog', 'سجل التغييرات'), icon: 'clock-history', url: 'system/changelog.html', kind: 'system' },
          { id: 'sys-terms', label: L('قوانین', 'Terms', 'الشروط'), icon: 'file-text', url: 'system/terms.html', kind: 'system' },
          { id: 'sys-privacy', label: L('حریم خصوصی', 'Privacy', 'الخصوصية'), icon: 'shield-lock', url: 'system/privacy.html', kind: 'system' },
        ],
      },
      {
        id: 'auth',
        label: L('احراز هویت', 'Authentication', 'المصادقة'),
        icon: 'shield-lock',
        url: 'auth/login.html',
        kind: 'system',
        children: [
          { id: 'auth-login', label: L('ورود', 'Login', 'تسجيل الدخول'), icon: 'box-arrow-in-right', url: 'auth/login.html', kind: 'auth' },
          { id: 'auth-login-split', label: L('ورود دو ستونی', 'Login Split', 'دخول بعمودين'), icon: 'layout-split', url: 'auth/login-split.html', kind: 'auth' },
          { id: 'auth-login-minimal', label: L('ورود مینیمال', 'Login Minimal', 'دخول مبسط'), icon: 'square', url: 'auth/login-minimal.html', kind: 'auth' },
          { id: 'auth-register', label: L('ثبت‌نام', 'Register', 'التسجيل'), icon: 'person-plus', url: 'auth/register.html', kind: 'auth' },
          { id: 'auth-forgot', label: L('فراموشی رمز', 'Forgot Password', 'نسيت كلمة المرور'), icon: 'question-circle', url: 'auth/forgot-password.html', kind: 'auth' },
          { id: 'auth-reset', label: L('بازیابی رمز', 'Reset Password', 'استعادة كلمة المرور'), icon: 'key', url: 'auth/reset-password.html', kind: 'auth' },
          { id: 'auth-verify', label: L('تأیید ایمیل', 'Verify Email', 'تحقق البريد'), icon: 'envelope-check', url: 'auth/verify-email.html', kind: 'auth' },
          { id: 'auth-2fa', label: L('ورود دو مرحله‌ای', 'Two-Factor', 'التحقق بخطوتين'), icon: 'shield-check', url: 'auth/two-factor.html', kind: 'auth' },
          { id: 'auth-lock', label: L('قفل صفحه', 'Lock Screen', 'شاشة القفل'), icon: 'lock', url: 'auth/lock-screen.html', kind: 'auth' },
          { id: 'auth-logout', label: L('خروج', 'Logout', 'خروج'), icon: 'box-arrow-right', url: 'auth/logout.html', kind: 'auth' },
        ],
      },
    ],
  },
];

/** Pages that are generated but intentionally kept out of the sidebar. */
export const extraPages = [
  { url: 'preview.html', label: L('پیش‌نمایش محصول', 'Product Preview', 'معاينة المنتج'), kind: 'app', noLayout: true },
  { url: 'auth/error.html', label: L('خطای ورود', 'Auth Error', 'خطأ الدخول'), kind: 'auth' },
  /* Detail screens reached from the CRM list tables (kept out of the sidebar
     because they are drill-downs of `contacts`, `companies` and `deals`). */
  { url: 'crm/contact-details.html', label: L('جزئیات مخاطب', 'Contact Details', 'تفاصيل جهة الاتصال'), kind: 'app', resource: 'contacts' },
  { url: 'crm/company-details.html', label: L('جزئیات شرکت', 'Company Details', 'تفاصيل الشركة'), kind: 'app', resource: 'companies' },
  { url: 'crm/deal-details.html', label: L('جزئیات معامله', 'Deal Details', 'تفاصيل الصفقة'), kind: 'app', resource: 'deals' },
];

/** Dashboards get an extra "demo switcher" strip on top of the content. */
export const demoPages = sidebar[0].items[0].children.map((d) => d.url);
