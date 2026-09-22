/**
 * NOVAADMIN — HR demo data
 * (employees, attendance, leave, payroll, recruitment)
 */
import { makeHelpers, firstNames, lastNames, cities } from './rng.js';
import { departments, teams, users } from './people.js';

const { int, float, pick, picks, bool, date } = makeHelpers(7007);

const positions = [
  'مهندس نرم‌افزار ارشد', 'مهندس فرانت‌اند', 'مهندس بک‌اند', 'طراح محصول', 'طراح رابط کاربری',
  'کارشناس داده', 'مدیر محصول', 'کارشناس فروش', 'کارشناس پشتیبانی', 'کارشناس مالی',
  'کارشناس منابع انسانی', 'مدیر بازاریابی', 'مهندس DevOps', 'تحلیلگر کسب‌وکار', 'کارشناس تست نرم‌افزار',
];

export const employees = Array.from({ length: 38 }).map((_, i) => {
  const first = firstNames[(i * 4) % firstNames.length];
  const last = lastNames[(i * 3) % lastNames.length];
  const dept = departments[i % departments.length];
  const n = i + 1;
  return {
    id: `emp-${String(n).padStart(3, '0')}`,
    name: `${first} ${last}`,
    code: `EMP-${1000 + n}`,
    position: positions[i % positions.length],
    department: dept.name,
    team: pick(teams).name,
    manager: pick(users).name,
    email: `emp${n}@novaadmin.dev`,
    phone: `+98 91${int(10, 39)} ${int(100, 999)} ${int(1000, 9999)}`,
    city: pick(cities),
    avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
    type: pick(['تمام‌وقت', 'تمام‌وقت', 'تمام‌وقت', 'پاره‌وقت', 'پیمانکاری']),
    status: pick(['active', 'active', 'active', 'active', 'on-leave', 'terminated']),
    hiredAt: date(int(40, 2100), int(9, 17)),
    salary: int(160, 980) * 100_000,
    bonus: int(0, 12) * 1_000_000,
    performance: float(2.6, 5, 1),
    attendanceRate: float(78, 100, 1),
    leaveBalance: int(0, 26),
    remote: bool(0.45),
    skills: picks(['React', 'Node.js', 'SQL', 'Figma', 'Python', 'Docker', 'TypeScript', 'Kubernetes'], 3),
  };
});

export const attendanceToday = employees.slice(0, 24).map((e, i) => ({
  id: `att-${i + 1}`,
  employee: e.name,
  avatar: e.avatar,
  department: e.department,
  checkIn: `${String(int(7, 10)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}`,
  checkOut: i % 5 === 0 ? null : `${String(int(15, 19)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}`,
  workedHours: float(4, 9.5, 1),
  status: pick(['present', 'present', 'present', 'late', 'remote', 'absent']),
  location: e.remote ? 'دورکاری' : 'دفتر مرکزی',
}));

export const attendanceSeries = Array.from({ length: 30 }).map((_, i) => ({
  day: i,
  present: int(26, 38),
  remote: int(4, 16),
  late: int(0, 6),
  absent: int(0, 4),
}));

export const leaveRequests = Array.from({ length: 20 }).map((_, i) => {
  const emp = employees[(i * 5) % employees.length];
  return {
    id: `lv-${i + 1}`,
    employee: emp.name,
    avatar: emp.avatar,
    department: emp.department,
    type: pick(['استحقاقی', 'استعلاجی', 'بدون حقوق', 'زایمان', 'ساعتی']),
    from: date(int(1, 60), 0, 0),
    to: date(int(0, 40), 23, 59),
    days: int(1, 14),
    reason: pick(['سفر خانوادگی', 'امور درمانی', 'مراسم شخصی', 'دوره آموزشی', 'مرخصی زایمان']),
    status: pick(['approved', 'approved', 'pending', 'pending', 'rejected']),
    submittedAt: date(int(1, 40), int(9, 18)),
    approver: pick(users).name,
  };
});

export const payroll = employees.slice(0, 26).map((e, i) => {
  const base = e.salary;
  const allowance = Math.round(base * 0.18);
  const overtime = int(0, 12) * 500_000;
  const tax = Math.round((base + allowance) * 0.07);
  const insurance = Math.round(base * 0.07);
  return {
    id: `pay-${i + 1}`,
    employee: e.name,
    avatar: e.avatar,
    code: e.code,
    department: e.department,
    base,
    allowance,
    overtime,
    bonus: e.bonus,
    tax,
    insurance,
    deduction: tax + insurance,
    net: base + allowance + overtime + e.bonus - tax - insurance,
    period: 'مهر ۱۴۰۴',
    status: pick(['paid', 'paid', 'paid', 'pending', 'processing']),
    paidAt: date(int(1, 12), int(10, 14)),
  };
});

export const jobs = Array.from({ length: 10 }).map((_, i) => ({
  id: `job-${i + 1}`,
  title: positions[(i * 2) % positions.length],
  department: departments[i % departments.length].name,
  type: pick(['تمام‌وقت', 'پیمانکاری', 'کارآموزی']),
  location: pick(['تهران (حضوری)', 'دورکاری', 'اصفهان (حضوری)', 'هیبرید تهران']),
  status: pick(['open', 'open', 'open', 'closed', 'draft']),
  applicants: int(4, 180),
  shortlisted: int(1, 24),
  interviews: int(0, 12),
  hired: int(0, 3),
  publishedAt: date(int(3, 120), int(9, 18)),
  closesAt: date(-int(2, 60), 18, 0),
  salaryRange: `${int(180, 320)} — ${int(340, 780)} میلیون ریال`,
  description: 'به دنبال همکاری خلاق و مسئولیت‌پذیر برای توسعه محصولات سازمانی هستیم.',
}));

export const candidates = Array.from({ length: 18 }).map((_, i) => ({
  id: `cand-${i + 1}`,
  name: `${firstNames[(i * 6) % firstNames.length]} ${lastNames[(i * 4) % lastNames.length]}`,
  avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
  role: positions[(i * 3) % positions.length],
  stage: pick(['screening', 'screening', 'interview', 'test', 'offer', 'hired', 'rejected']),
  score: int(40, 98),
  experience: `${int(1, 14)} سال`,
  city: pick(cities),
  appliedAt: date(int(1, 60), int(9, 18)),
  source: pick(['وب‌سایت', 'لینکدین', 'معرفی همکار', 'آژانس استخدام']),
}));

export const hrKpis = {
  headcount: employees.length,
  openPositions: jobs.filter((j) => j.status === 'open').length,
  avgTenure: 3.4,
  turnover: 7.8,
  attendanceRate: 94.2,
  avgSalary: Math.round(employees.reduce((s, e) => s + e.salary, 0) / employees.length),
};

export default { employees, attendanceToday, attendanceSeries, leaveRequests, payroll, jobs, candidates, hrKpis };
