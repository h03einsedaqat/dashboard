/**
 * NOVAADMIN — Projects, tasks & kanban demo data
 */
import { makeHelpers, firstNames, lastNames } from './rng.js';
import { users, teams } from './people.js';

const { int, float, pick, picks, bool, date } = makeHelpers(5005);

export const TASK_STATUSES = [
  { id: 'backlog', label: 'بک‌لاگ', tone: 'neutral', icon: 'inbox' },
  { id: 'todo', label: 'برای انجام', tone: 'info', icon: 'circle' },
  { id: 'in-progress', label: 'در حال انجام', tone: 'primary', icon: 'hourglass-split' },
  { id: 'review', label: 'بازبینی', tone: 'warning', icon: 'eye' },
  { id: 'done', label: 'انجام شده', tone: 'success', icon: 'check2-circle' },
];

export const PRIORITIES = [
  { id: 'low', label: 'کم', tone: 'neutral' },
  { id: 'medium', label: 'متوسط', tone: 'info' },
  { id: 'high', label: 'زیاد', tone: 'warning' },
  { id: 'urgent', label: 'بحرانی', tone: 'danger' },
];

export const projects = Array.from({ length: 14 }).map((_, i) => {
  const progress = int(8, 100);
  const start = int(30, 260);
  return {
    id: `prj-${i + 1}`,
    name: pick([
      'مهاجرت ابری پلتفرم', 'بازطراحی فروشگاه سازمانی', 'پیاده‌سازی CRM فروش', 'اپلیکیشن موبایل مشتریان',
      'داشبورد هوش تجاری', 'یکپارچه‌سازی درگاه پرداخت', 'پورتال پشتیبانی', 'سامانه انبار هوشمند',
      'اتوماسیون بازاریابی', 'بازسازی وب‌سایت شرکتی', 'پروژه هوش مصنوعی مکاتبات', 'سامانه منابع انسانی',
      'اپلیکیشن انبارگردانی', 'پنل مدیریت محتوا',
    ]) + ` — فاز ${int(1, 3)}`,
    description: 'پروژه‌ای چندمرحله‌ای با تمرکز بر پایداری، تجربه کاربری و یکپارچه‌سازی با سامانه‌های موجود سازمان.',
    team: pick(teams).name,
    owner: pick(users).name,
    ownerAvatar: pick(users).avatar,
    members: picks(users, int(3, 7)).map((u) => ({ name: u.name, avatar: u.avatar })),
    status: progress === 100 ? 'completed' : pick(['active', 'active', 'active', 'planning', 'on-hold']),
    priority: pick(PRIORITIES).id,
    progress,
    tasksTotal: int(18, 140),
    tasksDone: 0,
    budget: int(180, 4200) * 1_000_000,
    spent: 0,
    startDate: date(start, 9, 0),
    dueDate: date(-int(5, 120), 18, 0),
    health: pick(['good', 'good', 'good', 'at-risk', 'critical']),
    tags: picks(['فرانت‌اند', 'بک‌اند', 'دیزاین', 'داده', 'زیرساخت', 'امنیت'], 3),
    client: pick(['داده‌پردازان پارس', 'فناوری آرکا', 'گروه صنعتی البرز', 'داخلی']),
  };
});
projects.forEach((p) => {
  p.tasksDone = Math.round((p.tasksTotal * p.progress) / 100);
  p.spent = Math.round((p.budget * int(35, 110)) / 100);
});

export const tasks = Array.from({ length: 68 }).map((_, i) => {
  const project = projects[i % projects.length];
  const status = pick(TASK_STATUSES);
  const priority = pick(PRIORITIES);
  const assignee = users[(i * 7) % users.length];
  const due = date(-int(-20, 45), int(9, 18));
  return {
    id: `tsk-${i + 1}`,
    title: pick([
      'طراحی صفحه فرود کمپین', 'پیاده‌سازی API گزارش‌ها', 'بازبینی کد ماژول پرداخت', 'نوشتن تست‌های یکپارچگی',
      'بهینه‌سازی کوئری‌های سنگین', 'تهیه مستندات فنی', 'آماده‌سازی محیط staging', 'بررسی امنیت فرم‌ها',
      'طراحی کامپوننت جدول داده', 'پیاده‌سازی تقویم شمسی', 'مهاجرت اسکیمای دیتابیس', 'راه‌اندازی مانیتورینگ',
    ]) + ` #${i + 1}`,
    project: project.name,
    projectId: project.id,
    status: status.id,
    statusLabel: status.label,
    priority: priority.id,
    priorityLabel: priority.label,
    assignee: assignee.name,
    assigneeAvatar: assignee.avatar,
    dueDate: due,
    overdue: new Date(due) < new Date() && status.id !== 'done',
    estimate: pick([2, 3, 5, 8, 13]),
    spent: pick([1, 2, 3, 5, 8, 13]),
    tags: picks(['فرانت‌اند', 'بک‌اند', 'باگ', 'ویژگی', 'مستندات', 'زیرساخت'], 2),
    comments: int(0, 18),
    attachments: int(0, 6),
    progress: status.id === 'done' ? 100 : int(5, 92),
    createdAt: date(int(2, 120), int(9, 18)),
  };
});

export const kanbanColumns = TASK_STATUSES.map((status, index) => ({
  ...status,
  order: index,
  tasks: tasks.filter((t) => t.status === status.id).slice(0, 9),
}));

export const dealPipeline = null; // CRM pipeline lives in `data/crm.js`

export const milestones = [
  { id: 'm-1', title: 'تحویل فاز اول', project: projects[0].name, dueDate: date(-6, 12, 0), status: 'done' },
  { id: 'm-2', title: 'آزمون پذیرش کاربر', project: projects[0].name, dueDate: date(-18, 12, 0), status: 'in-progress' },
  { id: 'm-3', title: 'انتشار نسخه ۲', project: projects[1].name, dueDate: date(-40, 12, 0), status: 'planned' },
  { id: 'm-4', title: 'آموزش تیم مشتری', project: projects[2].name, dueDate: date(-55, 12, 0), status: 'planned' },
];

export const projectActivity = Array.from({ length: 18 }).map((_, i) => ({
  id: `pa-${i + 1}`,
  type: pick(['task', 'comment', 'file', 'status', 'member']),
  text: pick([
    'وضعیت تسک «بازبینی کد» به «انجام شده» تغییر کرد',
    'فایل «طرح نهایی.fig» بارگذاری شد',
    'عضو جدید به پروژه اضافه شد',
    'زمان‌بندی فاز دوم به‌روزرسانی شد',
    'کامنت جدید روی تسک «طراحی داشبورد» ثبت شد',
    'ریسک تأخیر در تحویل گزارش شد',
  ]),
  actor: pick(users).name,
  avatar: pick(users).avatar,
  at: date(int(0, 20), int(8, 21), int(0, 59)),
}));

export const projectFiles = Array.from({ length: 12 }).map((_, i) => ({
  id: `pf-${i + 1}`,
  name: pick(['طرح-رابط-کاربری.fig', 'مستندات-فنی.pdf', 'گزارش-پیشرفت.xlsx', 'نقشه-معماری.png', 'قرارداد-نسخه۲.docx', 'ویدیو-دمو.mp4']),
  size: `${int(1, 48)}.${int(1, 9)} MB`,
  owner: pick(users).name,
  at: date(int(1, 60), int(9, 18)),
  type: pick(['figma', 'pdf', 'sheet', 'image', 'doc', 'video']),
}));

export default { projects, tasks, kanbanColumns, milestones, projectActivity, projectFiles, TASK_STATUSES, PRIORITIES };
