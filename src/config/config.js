/**
 * NOVAADMIN — Global product configuration.
 * ------------------------------------------------------------------
 * Single source of truth for branding, defaults and feature flags.
 * This file is plain ES module JavaScript with **no imports** so that
 * it can be consumed both by the browser and by the Node build tools
 * (`tools/*.mjs`) at build time.
 *
 * 👉 Change your brand here and the whole template follows.
 */

export const config = {
  /* -------------------------------------------------- Branding ---- */
  appName: 'NOVAADMIN',
  appShortName: 'NOVA',
  tagline: 'Modern. Persian-First. Enterprise Ready.',
  version: '1.0.2',
  releaseDate: '2026-09-22',

  /** Logo files live in `public/assets/` (they are copied as-is). */
  logo: 'assets/logo.svg',
  logoMark: 'assets/logo-mark.svg',
  logoDark: 'assets/logo-dark.svg',
  favicon: 'assets/favicon.svg',

  /* -------------------------------------------------- Defaults ---- */
  defaultLanguage: 'fa', // fa | en | ar
  defaultDirection: 'rtl', // rtl | ltr  (auto derived from language, can be overridden)
  defaultTheme: 'light', // light | dark | system
  defaultLayout: 'sidebar', // sidebar | mini | collapse | horizontal | twocol | boxed
  defaultPrimary: 'indigo', // indigo | blue | emerald | violet | rose | orange
  defaultDensity: 'comfortable', // comfortable | compact
  defaultFontSize: 'md', // sm | md | lg
  defaultSidebarStyle: 'fixed', // fixed | floating | compact
  defaultCalendar: 'jalali', // jalali | gregorian

  /* -------------------------------------------------- Regional ---- */
  currency: 'IRR', // IRR | USD | EUR | AED
  currencyList: ['IRR', 'USD', 'EUR', 'AED'],
  timezone: 'Asia/Tehran',
  dateFormat: 'YYYY/MM/DD',

  /* -------------------------------------------------- Behaviour --- */
  /** Root URL of the deployed template. Use './' when serving from a sub-folder. */
  baseUrl: './',
  /** Persist user preferences in localStorage under this prefix. */
  storagePrefix: 'nova',
  /** Mock API latency (ms) — mimics a real backend for the demo. */
  mockLatency: [180, 420],
  /** Set to false to disable all random demo failures in the mock API. */
  mockErrors: false,
  /** Number of rows used by the demo tables. */
  defaultPageSize: 10,

  /* -------------------------------------------------- Links ------- */
  supportEmail: 'support@novaadmin.dev',
  website: 'https://novaadmin.dev',
  documentationUrl: 'docs/introduction.html',

  /* -------------------------------------------------- Features ---- */
  features: {
    commandPalette: true,
    globalSearch: true,
    themeCustomizer: true,
    demoSwitcher: true,
    notifications: true,
    shortcutsHelp: true,
    dashboardCustomizer: true,
    chat: true,
    aiWorkspace: true,
  },

  /** Demo dashboards shown by the demo switcher & landing page. */
  demos: [
    { id: 'analytics', label: { fa: 'آنالیتیکس', en: 'Analytics', ar: 'التحليلات' }, icon: 'graph-up-arrow', color: 'indigo' },
    { id: 'ecommerce', label: { fa: 'فروشگاهی', en: 'eCommerce', ar: 'التجارة' }, icon: 'bag', color: 'emerald' },
    { id: 'crm', label: { fa: 'مدیریت مشتری', en: 'CRM', ar: 'إدارة العملاء' }, icon: 'person-lines-fill', color: 'blue' },
    { id: 'saas', label: { fa: 'سرویس ابری', en: 'SaaS', ar: 'SaaS' }, icon: 'cloud', color: 'violet' },
    { id: 'finance', label: { fa: 'مالی', en: 'Finance', ar: 'المالية' }, icon: 'cash-stack', color: 'orange' },
    { id: 'projects', label: { fa: 'پروژه‌ها', en: 'Projects', ar: 'المشاريع' }, icon: 'kanban', color: 'rose' },
    { id: 'hr', label: { fa: 'منابع انسانی', en: 'HR', ar: 'الموارد البشرية' }, icon: 'people', color: 'blue' },
    { id: 'support', label: { fa: 'پشتیبانی', en: 'Support', ar: 'الدعم' }, icon: 'headset', color: 'emerald' },
    { id: 'ai', label: { fa: 'هوش مصنوعی', en: 'AI SaaS', ar: 'الذكاء الاصطناعي' }, icon: 'stars', color: 'violet' },
    { id: 'logistics', label: { fa: 'لجستیک', en: 'Logistics', ar: 'اللوجستيات' }, icon: 'truck', color: 'orange' },
  ],

  /** Optional: point the mock API layer to a real backend. */
  api: {
    baseUrl: '/api',
    timeout: 8000,
    /** When true, `services/*` resolve from local mock data instead of HTTP. */
    useMocks: true,
  },
};

export default config;
