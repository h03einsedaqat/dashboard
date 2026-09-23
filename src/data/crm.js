/**
 * NOVAADMIN — CRM demo data
 * (companies, contacts, leads, deals, pipeline, activities, calls, meetings,
 *  campaigns, forecasts)
 */
import { makeHelpers, companyNames, firstNames, lastNames, cities } from './rng.js';
import { users } from './people.js';

const { int, float, pick, picks, bool, date } = makeHelpers(4004);

export const PIPELINE_STAGES = [
  { id: 'new', label: 'سرنخ جدید', tone: 'info', color: 'var(--nv-info)' },
  { id: 'qualified', label: 'واجد شرایط', tone: 'primary', color: 'var(--nv-primary)' },
  { id: 'proposal', label: 'ارسال پیشنهاد', tone: 'violet', color: '#7c3aed' },
  { id: 'negotiation', label: 'مذاکره', tone: 'warning', color: 'var(--nv-warning)' },
  { id: 'won', label: 'برنده شد', tone: 'success', color: 'var(--nv-success)' },
  { id: 'lost', label: 'از دست رفت', tone: 'danger', color: 'var(--nv-danger)' },
];

export const LEAD_SOURCES = ['وب‌سایت', 'نمایشگاه', 'کمپین ایمیلی', 'تبلیغات گوگل', 'معرفی مشتری', 'لینکدین', 'تماس ورودی'];

export const companies = companyNames.map((name, i) => ({
  id: `co-${i + 1}`,
  name,
  industry: pick(['فناوری اطلاعات', 'تولیدی', 'خدمات مالی', 'بازرگانی', 'سلامت', 'حمل و نقل', 'انرژی']),
  size: pick(['۱-۱۰', '۱۱-۵۰', '۵۱-۲۰۰', '۲۰۱-۱۰۰۰', '+۱۰۰۰']),
  city: pick(cities),
  country: 'ایران',
  website: `www.company-${i + 1}.ir`,
  phone: `+98 21 ${int(8800, 8899)} ${int(1000, 9999)}`,
  revenue: int(2, 240) * 1_000_000_000,
  employees: int(8, 1800),
  deals: int(1, 12),
  openValue: int(40, 4200) * 1_000_000,
  owner: pick(users).name,
  status: pick(['active', 'active', 'active', 'prospect', 'inactive']),
  logo: `assets/img/brands/brand-${String((i % 8) + 1).padStart(2, '0')}.svg`,
  createdAt: date(int(20, 900), int(9, 18)),
}));

export const contacts = Array.from({ length: 32 }).map((_, i) => {
  const first = firstNames[(i * 3) % firstNames.length];
  const last = lastNames[(i * 6) % lastNames.length];
  const company = companies[i % companies.length];
  return {
    id: `ct-${i + 1}`,
    name: `${first} ${last}`,
    title: pick(['مدیرعامل', 'مدیر فناوری', 'مدیر بازاریابی', 'کارشناس خرید', 'مدیر مالی', 'مدیر عملیات']),
    company: company.name,
    companyId: company.id,
    email: `${first.toLowerCase().replace(/[^a-z]/g, 'x')}${i}@${company.website.replace('www.', '')}`,
    phone: `+98 91${int(10, 39)} ${int(100, 999)} ${int(1000, 9999)}`,
    city: company.city,
    avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
    owner: pick(users).name,
    status: pick(['active', 'active', 'lead', 'customer', 'inactive']),
    lastContact: date(int(0, 45), int(9, 19)),
    deals: int(0, 6),
    value: int(20, 1800) * 1_000_000,
    tags: picks(['تصمیم‌گیرنده', 'کلیدی', 'گرم', 'سرد', 'قرارداد سالانه'], 2),
  };
});

export const leads = Array.from({ length: 30 }).map((_, i) => ({
  id: `ld-${i + 1}`,
  name: `${firstNames[(i * 5) % firstNames.length]} ${lastNames[(i * 2) % lastNames.length]}`,
  company: pick(companyNames),
  email: `lead${i + 1}@prospect.ir`,
  phone: `+98 91${int(10, 39)} ${int(100, 999)} ${int(1000, 9999)}`,
  source: pick(LEAD_SOURCES),
  score: int(12, 98),
  status: pick(['new', 'new', 'contacted', 'qualified', 'unqualified']),
  owner: pick(users).name,
  city: pick(cities),
  estimatedValue: int(15, 950) * 1_000_000,
  receivedAt: date(int(0, 60), int(8, 21), int(0, 59)),
  interest: pick(['پلتفرم SaaS', 'فروشگاه سازمانی', 'CRM اختصاصی', 'هوش مصنوعی', 'یکپارچه‌سازی ERP']),
  notes: pick([
    'بودجه تأیید شده و در انتظار جلسه دمو هستند.',
    'به دنبال مهاجرت از سیستم فعلی در فصل آینده‌اند.',
    'نیاز به مستندات فارسی و آموزش تیمی دارند.',
    'رقابت با دو راهکار داخلی دیگر در جریان است.',
  ]),
}));

export const deals = Array.from({ length: 34 }).map((_, i) => {
  const stage = pick(PIPELINE_STAGES);
  const company = companies[(i * 3) % companies.length];
  const value = int(35, 3800) * 1_000_000;
  return {
    id: `dl-${i + 1}`,
    title: `${pick(['قرارداد', 'طرح', 'پروژه', 'اشتراک'])} ${pick(['پلتفرم', 'استقرار', 'پشتیبانی', 'توسعه'])} — ${company.name}`,
    company: company.name,
    companyId: company.id,
    contact: pick(contacts).name,
    value,
    weighted: Math.round(value * (int(30, 95) / 100)),
    stage: stage.id,
    stageLabel: stage.label,
    tone: stage.tone,
    probability: int(15, 95),
    owner: pick(users).name,
    ownerAvatar: pick(users).avatar,
    source: pick(LEAD_SOURCES),
    createdAt: date(int(10, 220), int(9, 18)),
    expectedClose: date(-int(3, 90), int(9, 18)),
    lastActivity: date(int(0, 18), int(9, 20)),
    products: picks(['اشتراک سالانه', 'پشتیبانی طلایی', 'آموزش', 'توسعه اختصاصی', 'استقرار'], 2),
    nextStep: pick(['ارسال پیشنهاد نهایی', 'جلسه با مدیر مالی', 'تست پایلوت', 'امضای قرارداد']),
  };
});

export const activitiesCrm = Array.from({ length: 24 }).map((_, i) => ({
  id: `act-${i + 1}`,
  type: pick(['call', 'email', 'meeting', 'note', 'task']),
  subject: pick(['تماس پیگیری پیشنهاد', 'ارسال قرارداد', 'جلسه دمو محصول', 'یادداشت جلسه', 'پیگیری پرداخت', 'معرفی تیم فنی']),
  related: pick([...companies.map((c) => c.name), ...deals.map((d) => d.title)]),
  owner: pick(users).name,
  at: date(int(0, 30), int(8, 21), int(0, 59)),
  duration: pick([15, 30, 45, 60, 90]),
  outcome: pick(['موفق', 'در انتظار پاسخ', 'نیازمند پیگیری', 'بی‌نتیجه']),
}));

export const calls = Array.from({ length: 18 }).map((_, i) => ({
  id: `call-${i + 1}`,
  contact: pick(contacts).name,
  company: pick(companies).name,
  direction: pick(['out', 'in']),
  duration: `${int(1, 48)}:${String(int(0, 59)).padStart(2, '0')}`,
  at: date(int(0, 21), int(9, 19), int(0, 59)),
  status: pick(['answered', 'answered', 'missed', 'voicemail']),
  owner: pick(users).name,
  recording: bool(0.5),
  notes: pick(['مشتری خواستار پیشنهاد کتبی است.', 'پیگیری هفته آینده.', 'اعتراض به قیمت، نیاز به تخفیف حجمی.', 'تأیید جلسه حضوری.']),
}));

export const meetings = Array.from({ length: 14 }).map((_, i) => ({
  id: `mt-${i + 1}`,
  title: pick(['دمو محصول', 'جلسه مذاکره قرارداد', 'بازبینی فصلی', 'کارگاه آموزش تیم', 'جلسه تخنیکی یکپارچه‌سازی']),
  with: pick(companies).name,
  attendees: picks(contacts, 3).map((c) => ({ name: c.name, avatar: c.avatar })),
  startsAt: date(-int(0, 12), int(9, 17), int(0, 1) === 0 ? 30 : 0),
  duration: pick([30, 45, 60, 90]),
  location: pick(['آنلاین — Google Meet', 'دفتر مرکزی، اتاق ۳', 'دفتر مشتری', 'آنلاین — Zoom']),
  status: pick(['confirmed', 'confirmed', 'tentative', 'cancelled']),
  agenda: 'بررسی نیازها، ارائه راهکار پیشنهادی و تعیین گام بعدی.',
}));

export const campaigns = Array.from({ length: 12 }).map((_, i) => ({
  id: `cmp-${i + 1}`,
  name: pick(['کمپین بهاره', 'معرفی نسخه جدید', 'تخفیف پایان فصل', 'وبینار تخصصی', 'کمپین وفاداری', 'معرفی به دوستان']),
  channel: pick(['ایمیل', 'پیامک', 'شبکه‌های اجتماعی', 'گوگل ادز', 'لینکدین']),
  status: pick(['active', 'scheduled', 'completed', 'paused', 'draft']),
  budget: int(30, 900) * 1_000_000,
  spent: int(10, 800) * 1_000_000,
  leads: int(12, 980),
  conversions: int(2, 240),
  revenue: int(40, 3200) * 1_000_000,
  from: date(int(40, 200), 0, 0),
  to: date(-int(0, 90), 23, 59),
  owner: pick(users).name,
}));

export const revenueForecast = Array.from({ length: 12 }).map((_, i) => ({
  month: i,
  actual: i < 7 ? int(1800, 4200) * 1_000_000 : null,
  forecast: int(2000, 5400) * 1_000_000,
  target: int(2400, 4600) * 1_000_000,
}));

export const customerAcquisition = Array.from({ length: 12 }).map((_, i) => ({
  month: i,
  newCustomers: int(18, 96),
  churned: int(2, 14),
  cac: int(2, 9) * 1_000_000,
  ltv: int(40, 220) * 1_000_000,
}));

export default {
  companies,
  contacts,
  leads,
  deals,
  activitiesCrm,
  calls,
  meetings,
  campaigns,
  revenueForecast,
  customerAcquisition,
  PIPELINE_STAGES,
  LEAD_SOURCES,
};
