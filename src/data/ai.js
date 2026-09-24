/**
 * NOVAADMIN — AI Workspace demo data
 * (models, prompts, conversations, usage, generated assets, scheduled jobs)
 */
import { makeHelpers } from './rng.js';
import { users } from './people.js';

const { int, float, pick, picks, bool, date } = makeHelpers(11011);

export const PROMPT_CATEGORIES = [
  { id: 'marketing', label: 'بازاریابی', icon: 'megaphone', tone: 'primary' },
  { id: 'programming', label: 'برنامه‌نویسی', icon: 'code-slash', tone: 'info' },
  { id: 'seo', label: 'سئو', icon: 'search', tone: 'success' },
  { id: 'business', label: 'کسب‌وکار', icon: 'briefcase', tone: 'warning' },
  { id: 'writing', label: 'نویسندگی', icon: 'pencil-square', tone: 'violet' },
  { id: 'sales', label: 'فروش', icon: 'graph-up-arrow', tone: 'success' },
  { id: 'support', label: 'پشتیبانی مشتری', icon: 'headset', tone: 'info' },
];

export const aiModels = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', vendor: 'OpenAI', context: '128K', priceIn: 150, priceOut: 600, latency: 620, status: 'active', quality: 82, usage: 48_240, popular: true, capabilities: ['چت', 'خلاصه‌سازی', 'کد'] },
  { id: 'gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', context: '128K', priceIn: 2_500, priceOut: 10_000, latency: 1_180, status: 'active', quality: 96, usage: 26_180, popular: true, capabilities: ['استدلال', 'تصویر', 'کد'] },
  { id: 'claude-sonnet', name: 'Claude 3.5 Sonnet', vendor: 'Anthropic', context: '200K', priceIn: 3_000, priceOut: 15_000, latency: 1_040, status: 'active', quality: 95, usage: 18_640, popular: true, capabilities: ['متن بلند', 'تحلیل', 'کد'] },
  { id: 'gemini-pro', name: 'Gemini 1.5 Pro', vendor: 'Google', context: '1M', priceIn: 1_250, priceOut: 5_000, latency: 980, status: 'active', quality: 91, usage: 14_280, popular: false, capabilities: ['متن بلند', 'چندرسانه‌ای'] },
  { id: 'llama-70b', name: 'Llama 3.1 70B', vendor: 'Meta', context: '128K', priceIn: 520, priceOut: 750, latency: 740, status: 'active', quality: 84, usage: 12_460, popular: false, capabilities: ['متن‌باز', 'استقرار محلی'] },
  { id: 'nova-fa', name: 'مدل فارسی نووا', vendor: 'NOVAADMIN', context: '32K', priceIn: 100, priceOut: 250, latency: 480, status: 'beta', quality: 78, usage: 8_660, popular: false, capabilities: ['فارسی', 'خلاصه‌سازی'] },
  { id: 'whisper-v3', name: 'Whisper v3', vendor: 'OpenAI', context: '—', priceIn: 100, priceOut: 0, latency: 1_400, status: 'active', quality: 90, usage: 4_280, popular: false, capabilities: ['تبدیل گفتار'] },
  { id: 'embed-3', name: 'Embedding v3 Large', vendor: 'OpenAI', context: '8K', priceIn: 130, priceOut: 0, latency: 210, status: 'active', quality: 88, usage: 21_400, popular: false, capabilities: ['جستجوی معنایی'] },
];

export const aiPrompts = Array.from({ length: 24 }).map((_, i) => {
  const category = pick(PROMPT_CATEGORIES);
  return {
    id: `pr-${i + 1}`,
    title: pick([
      'تحلیل رقبا و ارائه خلاصه اجرایی', 'بازنویسی متن تبلیغاتی', 'تولید تقویم محتوایی ماهانه',
      'بررسی کد و پیشنهاد بهبود', 'نوشتن شرح محصول فروشگاهی', 'خلاصه‌سازی جلسه و استخراج اقدامات',
      'تولید متغیرهای تست A/B', 'بهینه‌سازی متن سئو برای صفحه فرود', 'ایجاد پرسونای مشتری',
      'طراحی ساختار ایمیل خوش‌آمدگویی', 'تبدیل مقاله به رشته توییت', 'پاسخ حرفه‌ای به تیکت ناراضی',
      'استخراج نیازمندی‌های نرم‌افزاری از متن', 'نوشتن تست واحد برای تابع پایتون',
      'ایده‌پردازی کمپین فروش فصلی', 'تحلیل احساسات نظرات مشتریان', 'تولید سؤالات مصاحبه فنی',
      'نوشتن چکیده مقاله علمی', 'طراحی اسکریپت ویدیوی محصول', 'ساخت جدول مقایسه رقبا',
    ]),
    category: category.id,
    categoryLabel: category.label,
    icon: category.icon,
    tone: category.tone,
    text: 'به عنوان یک {نقش} حرفه‌ای، درباره {موضوع} تحلیل کن و خروجی را در قالب {قالب} ارائه بده. لحن {لحن} باشد و به مخاطب {مخاطب} توجه کن.',
    usage: int(12, 480),
    favorite: bool(0.28),
    author: pick(users).name,
    updatedAt: date(int(0, 60), int(9, 18)),
    tags: picks(['تحلیل', 'محتوا', 'فروش', 'فنی', 'سئو'], 2),
  };
});

export const aiConversations = Array.from({ length: 12 }).map((_, i) => ({
  id: `aic-${i + 1}`,
  title: pick([
    'تحلیل داده‌های فروش سه‌ماهه', 'نوشتن طرح بازاریابی محتوا', 'بهینه‌سازی کوئری سنگین SQL',
    'خلاصه گزارش جلسه هیئت مدیره', 'ایده‌های کمپین نوروزی', 'بازنویسی صفحه درباره ما',
    'طراحی ساختار API گزارش‌ها', 'تحلیل شکایات مشتریان',
  ]) + (i > 7 ? ` (${i - 6})` : ''),
  model: pick(aiModels).name,
  messages: int(4, 26),
  tokens: int(1_200, 48_000),
  pinned: i < 2,
  updatedAt: date(int(0, 12), int(8, 22), int(0, 59)),
  folder: pick(['امروز', 'دیروز', 'هفته گذشته', 'ماه گذشته']),
}));

export const aiChatSeed = [
  { id: 'm1', side: 'user', text: 'برای افزایش نرخ تبدیل صفحه فرود فروشگاه، چه اقداماتی را در اولویت پیشنهاد می‌کنی؟' },
  {
    id: 'm2',
    side: 'assistant',
    model: 'GPT-4o mini',
    tokens: 486,
    text: `بر اساس الگوهای رایج فروشگاه‌های ایرانی، این چهار اقدام بیشترین اثر را دارند:
۱. **شفاف‌سازی ارزش پیشنهادی** در همان اسکرول اول (سرفصل + یک جمله + تصویر محصول).
۲. **کاهش گام‌های پرداخت**: هر گام اضافی حدود ۷٪ ریزش ایجاد می‌کند.
۳. **افزودن نشانه‌های اعتماد**: درگاه امن، ضمانت بازگشت، نظرات تأییدشده.
۴. **نمایش موجودی و زمان ارسال** روی کارت محصول؛ در دسته‌های حساس مثل دیجیتال، اثر آن دو برابر است.`,
  },
  { id: 'm3', side: 'user', text: 'برای اندازه‌گیری نتیجه، کدام شاخص‌ها را رصد کنم؟' },
  {
    id: 'm4',
    side: 'assistant',
    model: 'GPT-4o mini',
    tokens: 312,
    text: 'این چهار شاخص کافی است: نرخ تبدیل کلی، نرخ ریزش در هر گام پرداخت، میانگین زمان تا اولین خرید و نرخ بازگشت مشتری در ۳۰ روز. اگر نرخ ریزش گام پرداخت بیش از ۲۵٪ بود، ابتدا فرم را ساده‌سازی کنید.',
  },
];

export const aiWriterTones = ['رسمی', 'دوستانه', 'تبلیغاتی', 'آموزشی', 'خبری', 'خلاقانه'];
export const aiLanguages = ['فارسی', 'English', 'العربية'];

export const aiWriterSample = {
  title: 'راهنمای کامل راه‌اندازی فروشگاه اینترنتی در ۱۴۰۴',
  intro: 'راه‌اندازی فروشگاه اینترنتی تنها یک وب‌سایت نیست؛ ساخت یک فرایند فروش قابل اتکا است. در این راهنما گام‌به‌گام بررسی می‌کنیم که از انتخاب پلتفرم تا اولین سفارش موفق چه کاری لازم است.',
  sections: [
    { heading: '۱. انتخاب پلتفرم مناسب', text: 'معیارهای انتخاب شامل مقیاس‌پذیری، هزینه نگهداری، پشتیبانی از درگاه‌های پرداخت داخلی و امکان توسعه ماژول اختصاصی است.' },
    { heading: '۲. طراحی تجربه خرید', text: 'ساختار دسته‌بندی، جستجوی محصول و صفحه محصول، سه ستون تجربه خرید شما هستند. هر ثانیه تأخیر بارگذاری حدود ۷٪ از نرخ تبدیل را کم می‌کند.' },
    { heading: '۳. عملیات و لجستیک', text: 'اتصال سامانه انبار به فروشگاه باعث کاهش خطای موجودی و شفافیت زمان ارسال برای مشتری می‌شود.' },
  ],
};

export const aiSummarizerSeed = {
  fileName: 'گزارش-عملکرد-فصل-سوم.pdf',
  words: 12_480,
  readingTime: '۵۴ دقیقه',
  summary: [
    'درآمد فصل سوم با ۱۴.۲٪ رشد نسبت به فصل قبل به ۲۲.۴ میلیارد ریال رسید.',
    'هزینه‌های عملیاتی ۴.۶٪ افزایش داشت که عمدتاً ناشی از توسعه تیم پشتیبانی بود.',
    'نرخ ریزش مشتریان سازمانی از ۳.۱٪ به ۲.۴٪ کاهش یافت.',
    'سه ریسک اصلی شناسایی شد: تأخیر در تأمین سرور، وابستگی به یک درگاه پرداخت، کمبود نیروی متخصص داده.',
  ],
  keywords: ['رشد درآمد', 'نرخ ریزش', 'هزینه عملیاتی', 'ریسک تأمین', 'تیم داده'],
};

export const aiRepurposeFormats = [
  { id: 'linkedin', label: 'پست لینکدین', icon: 'linkedin', length: '۳۰۰ کلمه' },
  { id: 'twitter', label: 'رشته توییت', icon: 'twitter-x', length: '۶ توییت' },
  { id: 'newsletter', label: 'خبرنامه ایمیلی', icon: 'envelope-paper', length: '۴۰۰ کلمه' },
  { id: 'instagram', label: 'کپشن اینستاگرام', icon: 'instagram', length: '۱۵۰ کلمه' },
  { id: 'script', label: 'اسکریپت ویدیو', icon: 'camera-video', length: '۹۰ ثانیه' },
  { id: 'faq', label: 'بخش پرسش‌های متداول', icon: 'question-circle', length: '۸ پرسش' },
];

const AI_IMAGE_PROMPTS = [
  ['هدفون بی‌سیم روی پایه یاسی با نور نرم استودیو', 'عکاسی'],
  ['اشکال شیشه‌ای سه‌بعدی شناور با گرادیان بنفش و فیروزه‌ای', 'سه‌بعدی'],
  ['آیکون سه‌بعدی سکه و نمودار رشد برای اپلیکیشن مالی', 'سه‌بعدی'],
  ['شیشه محصول مراقبت پوست روی سنگ تراورتن با نور صبحگاهی', 'عکاسی'],
  ['مغز شبکه عصبی از ذرات نور، مفهوم هوش مصنوعی', 'تصویرسازی'],
  ['کفش ورزشی معلق با پاشش رنگ نارنجی و فیروزه‌ای', 'تبلیغاتی'],
  ['دفتر کار خانگی مینیمال با لپ‌تاپ و داشبورد تحلیلی', 'عکاسی'],
  ['پوستر نقوش هندسی ایرانی با رنگ نیلی و طلایی', 'تصویرسازی'],
];

export const aiImages = Array.from({ length: 12 }).map((_, i) => {
  const [prompt, style] = AI_IMAGE_PROMPTS[i % AI_IMAGE_PROMPTS.length];
  return {
    id: `img-${i + 1}`,
    prompt,
    style,
    url: `assets/img/ai/gen-${String((i % 8) + 1).padStart(2, '0')}.jpg`,
    model: pick(['GPT-4o', 'DALL·E 3', 'Stable Diffusion XL', 'Midjourney v6']),
    size: pick(['1024×1024', '1792×1024', '1024×1792']),
    at: date(int(0, 30), int(9, 21)),
    favorite: bool(0.3),
    likes: int(2, 64),
  };
});

export const aiScheduledJobs = Array.from({ length: 8 }).map((_, i) => ({
  id: `sch-${i + 1}`,
  name: pick([
    'خلاصه روزانه ایمیل‌های ورودی', 'گزارش هفتگی عملکرد فروش', 'بازتولید محتوای وبلاگ',
    'پاسخ خودکار تیکت‌های ساده', 'تحلیل احساسات نظرات', 'به‌روزرسانی پایگاه دانش',
  ]),
  cron: pick(['هر روز ۰۸:۰۰', 'هر شنبه ۰۹:۳۰', 'هر ماه اول ۱۰:۰۰', 'هر ۶ ساعت']),
  model: pick(aiModels).name,
  status: pick(['active', 'active', 'paused', 'active']),
  lastRun: date(int(0, 6), int(7, 20), int(0, 59)),
  runs: int(4, 180),
  tokensPerRun: int(800, 24_000),
}));

export const aiUsageDaily = Array.from({ length: 30 }).map((_, i) => ({
  day: i,
  requests: int(1_200, 9_800),
  tokens: int(480_000, 3_600_000),
  cost: int(18, 140) * 1_000_000,
  errors: int(0, 24),
}));

export const aiCredit = { used: 1_284_000_000, limit: 2_500_000_000, currency: 'IRR', resetIn: 12 };


/* ---------------------------------------------------------------- insights
 * Extra, deterministic demo data for the AI dashboard / usage / history
 * screens: per-model split, feature split, hourly heatmap, team usage,
 * activity feed, alerts and conversation previews.
 */
const MODEL_TONES = ['primary', 'info', 'violet', 'success', 'warning', 'danger', 'neutral', 'info'];

export const aiModelUsage = aiModels.map((m, i) => {
  const requests = m.usage;
  const tokens = Math.round(requests * int(420, 1_400));
  const cost = Math.round(((tokens * 0.6 * m.priceIn + tokens * 0.4 * m.priceOut) / 1_000_000) * 42_000);
  return {
    id: m.id,
    label: m.name,
    vendor: m.vendor,
    requests,
    tokens,
    cost,
    latency: m.latency,
    errors: float(0.1, 2.4, 2),
    satisfaction: int(82, 98),
    tone: MODEL_TONES[i % MODEL_TONES.length],
    trend: float(-12, 28, 1),
  };
});

export const aiFeatureUsage = [
  { id: 'chat', label: 'گفتگوی هوشمند', icon: 'chat-square-dots', href: 'ai/chat.html', requests: 64_820, tokens: 48_600_000, tone: 'primary' },
  { id: 'writer', label: 'نویسنده هوشمند', icon: 'pencil-square', href: 'ai/writer.html', requests: 21_340, tokens: 26_400_000, tone: 'violet' },
  { id: 'summarizer', label: 'خلاصه‌ساز', icon: 'file-earmark-text', href: 'ai/summarizer.html', requests: 14_920, tokens: 31_200_000, tone: 'info' },
  { id: 'repurposer', label: 'بازتولید محتوا', icon: 'recycle', href: 'ai/repurposer.html', requests: 8_760, tokens: 9_800_000, tone: 'success' },
  { id: 'images', label: 'استودیو تصویر', icon: 'image', href: 'ai/images.html', requests: 5_480, tokens: 4_100_000, tone: 'warning' },
  { id: 'scheduler', label: 'کارهای خودکار', icon: 'clock-history', href: 'ai/scheduler.html', requests: 3_220, tokens: 12_700_000, tone: 'danger' },
];

export const AI_WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
/** 7 × 12 grid (two-hour buckets) of relative load, 0–100. */
export const aiHeatmap = AI_WEEK_DAYS.map((day, d) => ({
  name: day,
  data: Array.from({ length: 12 }).map((__, h) => {
    const office = h >= 4 && h <= 9 ? 45 : 8;
    const weekend = d >= 5 ? -22 : 0;
    return { x: `${String(h * 2).padStart(2, '0')}:۰۰`, y: Math.max(2, Math.min(100, office + weekend + int(0, 48))) };
  }),
}));

export const aiTeamUsage = users.slice(0, 7).map((u, i) => ({
  id: u.id,
  name: u.name,
  avatar: u.avatar,
  role: u.roleLabel ?? u.title ?? 'عضو تیم',
  requests: int(420, 6_800),
  tokens: int(180_000, 4_800_000),
  favourite: pick(['گفتگوی هوشمند', 'نویسنده هوشمند', 'خلاصه‌ساز', 'بازتولید محتوا']),
  quota: int(18, 96),
})).sort((a, b) => b.tokens - a.tokens);

export const aiActivity = [
  { icon: 'stars', tone: 'primary', title: 'گزارش هفتگی فروش به‌صورت خودکار تولید شد', meta: 'زمان‌بند • GPT-4o', at: date(0, 9, 12) },
  { icon: 'key', tone: 'warning', title: 'کلید API «Mobile app» بازتولید شد', meta: 'امنیت • سارا محمدی', at: date(0, 8, 40) },
  { icon: 'cpu', tone: 'info', title: 'مدل Gemini 1.5 Pro به فهرست مدل‌ها افزوده شد', meta: 'مدل‌ها • مدیر سیستم', at: date(1, 16, 5) },
  { icon: 'exclamation-triangle', tone: 'danger', title: '۱۸ درخواست با خطای محدودیت نرخ مواجه شد', meta: 'پایش • Claude 3.5 Sonnet', at: date(1, 11, 22) },
  { icon: 'file-earmark-text', tone: 'success', title: '۴۲ سند در پایگاه دانش خلاصه‌سازی شد', meta: 'خلاصه‌ساز • تیم پشتیبانی', at: date(2, 14, 50) },
  { icon: 'image', tone: 'violet', title: '۱۲ تصویر محصول در استودیو تولید شد', meta: 'استودیو تصویر • تیم بازاریابی', at: date(3, 10, 15) },
  { icon: 'bookmark-star', tone: 'primary', title: 'پرامپت «پاسخ حرفه‌ای به تیکت ناراضی» محبوب هفته شد', meta: 'کتابخانه پرامپت', at: date(4, 12, 0) },
];

export const aiAlerts = [
  { tone: 'warning', icon: 'speedometer', title: '۵۱٪ از اعتبار ماهانه مصرف شده است', text: 'با روند فعلی، سهمیه تا ۱۶ روز دیگر کافی است.' },
  { tone: 'info', icon: 'lightning-charge', title: 'پیشنهاد صرفه‌جویی', text: 'انتقال خلاصه‌سازی‌ها به GPT-4o mini ماهانه حدود ۲۲٪ هزینه را کاهش می‌دهد.' },
  { tone: 'success', icon: 'shield-check', title: 'همه کلیدهای API سالم هستند', text: 'هیچ استفاده مشکوکی در ۷ روز گذشته ثبت نشده است.' },
];

export const aiConversationPreviews = [
  'سه سناریوی رشد با فرض‌های محافظه‌کارانه و خوش‌بینانه آماده شد…',
  'تقویم محتوایی چهار هفته‌ای با تمرکز بر آموزش و مقایسه…',
  'ایندکس ترکیبی روی ستون‌های تاریخ و وضعیت، زمان اجرا را ۸۴٪ کم کرد…',
  'تصمیم‌های کلیدی جلسه در پنج بند و مسئول هر اقدام…',
  'ده ایده کمپین با شعار، کانال و بودجه پیشنهادی…',
  'نسخه جدید متن با لحن صمیمی‌تر و ساختار داستانی…',
  'ساختار REST با نسخه‌بندی و صفحه‌بندی مبتنی بر مکان‌نما…',
  'دسته‌بندی شکایات: ارسال ۴۱٪، کیفیت ۲۶٪، پشتیبانی ۱۸٪…',
];

export default {
  aiModels,
  aiModelUsage,
  aiFeatureUsage,
  aiHeatmap,
  aiTeamUsage,
  aiActivity,
  aiAlerts,
  aiPrompts,
  aiConversations,
  aiChatSeed,
  aiWriterTones,
  aiLanguages,
  aiWriterSample,
  aiSummarizerSeed,
  aiRepurposeFormats,
  aiImages,
  aiScheduledJobs,
  aiUsageDaily,
  aiCredit,
  PROMPT_CATEGORIES,
};
