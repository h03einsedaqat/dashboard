/**
 * NOVAADMIN — AI Workspace service
 * ------------------------------------------------------------------
 * Powers every screen under `/ai/*`. In mock mode the answers are produced
 * locally from `src/data/ai.js`; the method signatures match a real
 * completion API so wiring a provider only means setting `config.api.useMocks`
 * to `false` (or `window.NOVA_ADMIN_API`) and pointing `baseUrl` at your proxy.
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import {
  aiModels, aiPrompts, aiConversations, aiChatSeed, aiWriterSample, aiSummarizerSeed,
  aiRepurposeFormats, aiImages, aiScheduledJobs, aiUsageDaily, aiCredit, PROMPT_CATEGORIES,
  aiModelUsage, aiFeatureUsage, aiHeatmap, aiTeamUsage, aiActivity, aiAlerts, aiConversationPreviews,
} from '../data/ai.js';

export const modelService = createResourceService({
  name: 'ai/models',
  collection: () => aiModels,
  idPrefix: 'mdl',
  searchFields: ['name', 'vendor'],
  sortFields: ['quality', 'latency', 'usage', 'priceIn'],
  extend: (result) => ({
    summary: {
      total: aiModels.length,
      active: aiModels.filter((m) => m.status === 'active').length,
      beta: aiModels.filter((m) => m.status === 'beta').length,
      requests: aiModels.reduce((s, m) => s + m.usage, 0),
      vendors: [...new Set(aiModels.map((m) => m.vendor))],
      totalCount: result.total,
    },
  }),
});

export const promptService = createResourceService({
  name: 'ai/prompts',
  collection: () => aiPrompts,
  idPrefix: 'pr',
  searchFields: ['title', 'text', 'categoryLabel'],
  sortFields: ['usage', 'updatedAt', 'title'],
  extend: (result) => ({
    summary: {
      total: aiPrompts.length,
      favorites: aiPrompts.filter((p) => p.favorite).length,
      categories: PROMPT_CATEGORIES,
      totalUsage: aiPrompts.reduce((s, p) => s + p.usage, 0),
      totalCount: result.total,
    },
  }),
});

export const promptActions = {
  async toggleFavorite(id, favorite) {
    return call('patch', `ai/prompts/${id}`, { resolver: () => ({ id, favorite }) });
  },
  async duplicate(id) {
    return call('post', `ai/prompts/${id}/duplicate`, { resolver: () => ({ id: `pr-${Date.now()}`, title: 'کپی پرامپت', favorite: false, usage: 0 }) });
  },
  async run(id, variables = {}) {
    return call('post', `ai/prompts/${id}/run`, {
      resolver: () => ({
        id,
        variables,
        output: 'خروجی نمونه بر اساس پرامپت انتخابی تولید شد. برای اتصال به مدل واقعی، مقدار api.useMocks را در فایل config غیرفعال کنید.',
        model: 'GPT-4o mini',
        tokens: 842,
        at: new Date().toISOString(),
      }),
    });
  },
};

export const conversationService = {
  async list() {
    return call('list', 'ai/conversations', { resolver: () => aiConversations.map((c, i) => ({ ...c, preview: aiConversationPreviews[i % aiConversationPreviews.length] })) });
  },
  async get(id) {
    return call('get', `ai/conversations/${id}`, {
      resolver: () => ({
        id,
        title: aiConversations.find((c) => c.id === id)?.title ?? 'گفتگو',
        model: aiChatSeed[1]?.model ?? 'GPT-4o mini',
        messages: aiChatSeed,
        tokens: aiChatSeed.reduce((s, m) => s + (m.tokens ?? 0), 0),
      }),
    });
  },
  async remove(id) {
    return call('remove', `ai/conversations/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
  async rename(id, title) {
    return call('patch', `ai/conversations/${id}`, { resolver: () => ({ id, title }) });
  },
};

export const chatService = {
  /** POST /ai/chat — sends the thread and returns the next assistant message. */
  async send({ message, model = 'GPT-4o mini', conversationId = null, temperature = 0.7, maxTokens = 1024 }) {
    return call('create', 'ai/chat', {
      body: { message, model, conversationId, temperature, maxTokens },
      resolver: () => ({
        id: `m-${Date.now()}`,
        side: 'assistant',
        model,
        temperature,
        tokens: Math.round(120 + Math.random() * 620),
        text: mockAnswer(message),
        at: new Date().toISOString(),
      }),
      latency: [420, 1400],
    });
  },
};

/** The demo assistant answers in the active UI language (fa/ar share the Persian set). */
const englishUi = () => typeof document !== 'undefined' && document.documentElement?.getAttribute('lang') === 'en';

function mockAnswer(message = '') {
  if (englishUi()) return mockAnswerEn(message);
  const text = String(message);
  const topic = text.replace(/^[^:]{0,24}:\s*/, '').slice(0, 70);
  if (/ترجمه|translate/i.test(text)) {
    return `**English version:**\n\n\`\`\`text\n${topic ? 'Here is a clear, professional translation of your request.' : ''}\nWe analysed last quarter's sales and identified three practical growth levers:\n1. Improve checkout conversion\n2. Launch a loyalty programme\n3. Expand the best-selling categories\n\`\`\`\n\nاگر لحن رسمی‌تر یا بومی‌سازی برای بازار خاصی لازم است، بگویید.`;
  }
  if (/چک.?لیست|checklist/i.test(text)) {
    return `چک‌لیست اجرایی آماده شد:\n\n- تعیین هدف و شاخص موفقیت (KPI)\n- جمع‌آوری داده‌های پایه از داشبورد فروش\n- اولویت‌بندی اقدامات بر اساس اثر/هزینه\n- تعیین مسئول و موعد هر اقدام\n- بازبینی هفتگی نتایج و اصلاح مسیر\n\n**نکته:** هر مورد را در ماژول «پروژه‌ها» به یک وظیفه تبدیل کنید تا پیشرفت آن قابل پیگیری باشد.`;
  }
  if (/کوتاه|shorter/i.test(text)) {
    return `نسخه کوتاه‌شده:\n\n**سه اقدام کلیدی:** بهبود صفحه پرداخت، برنامه وفاداری و تمرکز بر دسته‌های پرفروش. نتیجه مورد انتظار: **۱۲ تا ۱۸٪ رشد** در فصل بعد.`;
  }
  if (/دوستانه|friendly/i.test(text)) {
    return `حتماً! 😊 نسخه صمیمی‌تر:\n\nسلام دوست خوب! یه نگاهی به فروش سه ماه اخیر انداختیم و خبرهای خوبی داریم. با چند تغییر کوچیک — مثل ساده‌تر کردن پرداخت و یه هدیه برای مشتری‌های وفادار — می‌تونیم حسابی رشد کنیم. پایه‌ای؟`;
  }
  if (/ایده|idea/i.test(text)) {
    return `ده ایده سریع:\n\n1. کمپین «خرید دوم با تخفیف ۱۵٪»\n2. جعبه‌های هدیه فصلی\n3. آموزش ویدیویی محصول در صفحه فرود\n4. برنامه معرفی دوستان با اعتبار هدیه\n5. پیشنهاد شخصی‌سازی‌شده در ایمیل\n6. ارسال رایگان بالای سقف مشخص\n7. نظرسنجی پس از خرید با کد تخفیف\n8. لایو معرفی محصولات جدید\n9. همکاری با اینفلوئنسرهای تخصصی\n10. باشگاه مشتریان سطح‌بندی‌شده`;
  }
  if (/خلاصه|summary|جلسه/i.test(text)) {
    return `**خلاصه جلسه در سه بخش:**\n\n**۱. تصمیم‌های کلیدی**\n- بودجه بازاریابی فصل بعد **۱۸٪** افزایش می‌یابد.\n- راه‌اندازی اپلیکیشن موبایل به ماه دوم منتقل شد.\n\n**۲. ریسک‌ها**\n- وابستگی به یک درگاه پرداخت\n- کمبود نیروی متخصص داده\n\n**۳. اقدامات بعدی**\n1. تهیه طرح درگاه دوم — مسئول: واحد مالی — موعد: ۲ هفته\n2. آگهی استخدام تحلیلگر داده — مسئول: منابع انسانی\n3. گزارش پیشرفت در جلسه بعد`;
  }
  if (/کد|code|api|جاوا|script/i.test(text)) {
    return `حتماً. این نمونه، گزارش‌ها را با صفحه‌بندی و مدیریت خطا دریافت می‌کند:\n\n\`\`\`js\nexport async function fetchReports({ from, to, page = 1 }) {\n  const res = await fetch(\`/api/reports?page=\${page}\`, {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      Authorization: \`Bearer \${import.meta.env.VITE_API_TOKEN}\`,\n    },\n    body: JSON.stringify({ from, to }),\n  });\n  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);\n  return res.json();\n}\n\`\`\`\n\n**نکات:**\n- توکن را هرگز در کد سمت کاربر قرار ندهید؛ از یک پراکسی استفاده کنید.\n- برای بازه‌های طولانی، \`page\` را افزایش دهید تا همه داده‌ها دریافت شود.`;
  }
  if (/بازاریابی|کمپین|محتوا|تقویم/i.test(text)) {
    return `**تقویم بازاریابی محتوا — ۴ هفته**\n\n1. **هفته اول — آموزش:** راهنمای انتخاب محصول + ۳ پست آموزشی در اینستاگرام\n2. **هفته دوم — مقایسه:** جدول مقایسه محصولات پرفروش و ویدیوی کوتاه\n3. **هفته سوم — داستان مشتری:** دو روایت موفق مشتری با تصویر واقعی\n4. **هفته چهارم — پیشنهاد ویژه:** کمپین تخفیف محدود با شمارش معکوس\n\n**کانال‌ها:** وبلاگ، اینستاگرام، خبرنامه ایمیلی\n**شاخص‌ها:** نرخ تعامل، کلیک ایمیل و نرخ تبدیل صفحه فرود`;
  }
  if (/فروش|تحلیل|داده|رشد/i.test(text)) {
    return `بر اساس داده‌های سه ماه اخیر، این تصویر به دست می‌آید:\n\n- درآمد کل **۲۲.۴ میلیارد ریال** با رشد **۱۴.۲٪** نسبت به فصل قبل\n- دسته «دیجیتال» با **۳۸٪** سهم، پرفروش‌ترین دسته است\n- نرخ رها کردن سبد خرید **۶۸٪** — بالاتر از میانگین صنعت\n\n**سه پیشنهاد عملی برای رشد:**\n1. **کاهش گام‌های پرداخت** از ۴ به ۲ گام؛ اثر تخمینی: +۷٪ تبدیل\n2. **برنامه وفاداری** برای مشتریان با بیش از دو خرید؛ افزایش خرید تکراری\n3. **تمرکز تبلیغات** روی دسته‌های پرحاشیه سود در ساعات اوج (۱۸ تا ۲۲)\n\nمی‌خواهید برای هر پیشنهاد یک برنامه اجرایی با زمان‌بندی بسازم؟`;
  }
  return `پرسش خوبی است. درباره «${topic}${text.length > 70 ? '…' : ''}» این جمع‌بندی را پیشنهاد می‌کنم:\n\n1. **تعریف دقیق هدف:** نتیجه‌ای که می‌خواهید قابل اندازه‌گیری باشد.\n2. **بررسی وضعیت فعلی:** داده‌های موجود در داشبورد را مرور کنید.\n3. **اقدامات سریع:** دو یا سه کار کم‌هزینه با اثر بالا را همین هفته اجرا کنید.\n4. **پایش:** نتیجه را هفتگی بسنجید و مسیر را اصلاح کنید.\n\nاگر جزئیات بیشتری بدهید (مخاطب، بودجه، زمان)، پاسخ دقیق‌تری آماده می‌کنم.`;
}

function mockAnswerEn(message = '') {
  const text = String(message);
  const topic = text.replace(/^[^:]{0,24}:\s*/, '').slice(0, 70);
  if (/ترجمه|translat/i.test(text)) {
    return `**Persian version:**\n\n\`\`\`text\nفروش فصل گذشته را تحلیل کردیم و سه اهرم رشد عملی شناسایی شد:\n۱. بهبود نرخ تبدیل صفحه پرداخت\n۲. راه‌اندازی برنامه وفاداری\n۳. گسترش دسته‌های پرفروش\n\`\`\`\n\nIf you need a more formal tone or localisation for a specific market, just say so.`;
  }
  if (/چک.?لیست|checklist/i.test(text)) {
    return `Here's an actionable checklist:\n\n- Define the goal and success metric (KPI)\n- Collect baseline data from the sales dashboard\n- Prioritise actions by impact/effort\n- Assign an owner and a due date to each action\n- Review results weekly and adjust course\n\n**Tip:** turn each item into a task in the Projects module so its progress can be tracked.`;
  }
  if (/کوتاه|short/i.test(text)) {
    return `Shorter version:\n\n**Three key actions:** improve the checkout page, launch a loyalty programme and focus on best-selling categories. Expected result: **12–18% growth** next quarter.`;
  }
  if (/دوستانه|friendl/i.test(text)) {
    return `Sure! 😊 A friendlier version:\n\nHey there! We took a look at the last three months of sales and there's good news. With a few small tweaks — like a simpler checkout and a little gift for loyal customers — we can grow a lot. Are you in?`;
  }
  if (/ایده|idea/i.test(text)) {
    return `Ten quick ideas:\n\n1. “15% off your second purchase” campaign\n2. Seasonal gift boxes\n3. Product video tutorials on the landing page\n4. Refer-a-friend programme with gift credit\n5. Personalised offers by email\n6. Free shipping above a set threshold\n7. Post-purchase survey with a discount code\n8. Live launch streams for new products\n9. Partnerships with niche influencers\n10. A tiered customer club`;
  }
  if (/خلاصه|summar|جلسه|meeting/i.test(text)) {
    return `**Meeting summary in three parts:**\n\n**1. Key decisions**\n- Next quarter's marketing budget increases by **18%**.\n- The mobile app launch moved to month two.\n\n**2. Risks**\n- Dependence on a single payment gateway\n- Shortage of data specialists\n\n**3. Next steps**\n1. Draft a second-gateway plan — owner: Finance — due: 2 weeks\n2. Post a data analyst job ad — owner: HR\n3. Progress report at the next meeting`;
  }
  if (/کد|code|api|جاوا|script/i.test(text)) {
    return `Sure. This example fetches reports with pagination and error handling:\n\n\`\`\`js\nexport async function fetchReports({ from, to, page = 1 }) {\n  const res = await fetch(\`/api/reports?page=\${page}\`, {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      Authorization: \`Bearer \${import.meta.env.VITE_API_TOKEN}\`,\n    },\n    body: JSON.stringify({ from, to }),\n  });\n  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);\n  return res.json();\n}\n\`\`\`\n\n**Notes:**\n- Never put the token in client-side code; use a proxy.\n- For long ranges, increase \`page\` until all data is fetched.`;
  }
  if (/بازاریابی|کمپین|محتوا|تقویم|marketing|campaign|content|calendar/i.test(text)) {
    return `**Content marketing calendar — 4 weeks**\n\n1. **Week 1 — Education:** product selection guide + 3 educational Instagram posts\n2. **Week 2 — Comparison:** best-seller comparison table and a short video\n3. **Week 3 — Customer story:** two customer success stories with real photos\n4. **Week 4 — Special offer:** limited discount campaign with a countdown\n\n**Channels:** blog, Instagram, email newsletter\n**Metrics:** engagement rate, email clicks and landing page conversion`;
  }
  if (/فروش|تحلیل|داده|رشد|sales|analy|data|growth/i.test(text)) {
    return `Based on the last three months of data, here's the picture:\n\n- Total revenue **IRR 22.4 billion**, up **14.2%** on the previous quarter\n- The “Digital” category is the best seller with a **38%** share\n- Cart abandonment is **68%** — above the industry average\n\n**Three practical growth ideas:**\n1. **Cut checkout steps** from 4 to 2; estimated impact: +7% conversion\n2. **Loyalty programme** for customers with more than two purchases; more repeat orders\n3. **Focus ads** on high-margin categories at peak hours (18–22)\n\nWould you like a scheduled action plan for each idea?`;
  }
  return `Good question. On “${topic}${text.length > 70 ? '…' : ''}”, here's my suggested approach:\n\n1. **Define the goal precisely:** the result you want should be measurable.\n2. **Review the current state:** go over the data available in the dashboard.\n3. **Quick wins:** run two or three low-cost, high-impact actions this week.\n4. **Monitor:** measure results weekly and adjust course.\n\nIf you share more details (audience, budget, timeline), I can prepare a more precise answer.`;
}

export const writerService = {
  async generate(options = {}) {
    return call('create', 'ai/writer', {
      body: options,
      resolver: () => ({ ...aiWriterSample, meta: { ...options, tokens: 1_284, at: new Date().toISOString() } }),
      latency: [600, 1600],
    });
  },
  async expand(paragraph) {
    return call('create', 'ai/writer/expand', {
      resolver: () => ({ paragraph, text: englishUi() ? `${paragraph} Below are three additional points and a practical example to clarify the topic.` : `${paragraph} در ادامه، سه نکته تکمیلی و یک مثال کاربردی برای روشن‌تر شدن موضوع ارائه می‌شود.` }),
    });
  },
  async shorten(text) {
    return call('create', 'ai/writer/shorten', {
      resolver: () => ({ text: String(text ?? '').split(' ').slice(0, 22).join(' ') + '…' }),
    });
  },
  tones: aiWriterSample ? ['رسمی', 'دوستانه', 'تبلیغاتی', 'آموزشی', 'خبری', 'خلاقانه'] : [],
};

export const summarizerService = {
  async summarize({ text = '', fileName = aiSummarizerSeed.fileName, bullets = 4 } = {}) {
    return call('create', 'ai/summarize', {
      body: { text, fileName, bullets },
      resolver: () => ({ ...aiSummarizerSeed, fileName, bullets: aiSummarizerSeed.summary.slice(0, bullets), textLength: text.length }),
      latency: [500, 1500],
    });
  },
  async keyPoints(text) {
    return call('create', 'ai/summarize/keypoints', {
      resolver: () => ({ points: aiSummarizerSeed.keywords, source: String(text ?? '').slice(0, 40) }),
    });
  },
};

export const repurposeService = {
  formats: () => call('list', 'ai/repurpose/formats', { resolver: () => aiRepurposeFormats }),
  async convert({ text = '', format = 'linkedin' } = {}) {
    return call('create', 'ai/repurpose', {
      body: { text, format },
      resolver: () => ({
        format,
        label: aiRepurposeFormats.find((f) => f.id === format)?.label ?? format,
        outputs: aiRepurposeFormats.filter((f) => f.id === format).map((f) => ({ ...f, text: `نسخه ${f.label}:\n${String(text || aiWriterSample.intro).slice(0, 320)}…` })),
        tokens: 968,
      }),
    });
  },
};

export const imageStudioService = {
  async list() {
    return call('list', 'ai/images', { resolver: () => aiImages });
  },
  async generate({ prompt, size = '1024×1024' } = {}) {
    return call('create', 'ai/images', {
      body: { prompt, size },
      resolver: () => ({
        id: `img-${Date.now()}`,
        prompt,
        size,
        url: `assets/img/ai/gen-0${1 + Math.floor(Math.random() * 8)}.jpg`,
        model: 'GPT-4o',
        at: new Date().toISOString(),
        mock: true,
      }),
      latency: [900, 2000],
    });
  },
  async remove(id) {
    return call('remove', `ai/images/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
};

export const schedulerService = createResourceService({
  name: 'ai/scheduler',
  collection: () => aiScheduledJobs,
  idPrefix: 'sch',
  searchFields: ['name', 'model', 'cron'],
  sortFields: ['runs', 'lastRun'],
});

export const schedulerActions = {
  async toggle(id, status) {
    return call('patch', `ai/scheduler/${id}`, { resolver: () => ({ id, status: status ?? 'paused' }) });
  },
  async runNow(id) {
    return call('post', `ai/scheduler/${id}/run`, { resolver: () => ({ id, ranAt: new Date().toISOString(), tokens: Math.round(800 + Math.random() * 4000) }) });
  },
  async remove(id) {
    return call('remove', `ai/scheduler/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
};

export const usageService = {
  /**
   * One payload for the dashboard, usage and history screens.
   * Totals are plain numbers; `series`/`labels` are ready for charts.
   */
  async overview() {
    return call('list', 'ai/usage', {
      resolver: () => {
        const sum = (key) => aiUsageDaily.reduce((s, d) => s + d[key], 0);
        const now = Date.now();
        const dayLabel = (i) => {
          const d = new Date(now - (aiUsageDaily.length - 1 - i) * 86_400_000);
          try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'short' }).format(d); } catch { return String(i + 1); }
        };
        const labels = aiUsageDaily.map((_, i) => dayLabel(i));
        const tokens = sum('tokens');
        const requests = sum('requests');
        const cost = sum('cost');
        const errors = sum('errors');
        const half = Math.floor(aiUsageDaily.length / 2);
        const growth = (key) => {
          const a = aiUsageDaily.slice(0, half).reduce((s, d) => s + d[key], 0);
          const b = aiUsageDaily.slice(half).reduce((s, d) => s + d[key], 0);
          return a ? Number((((b - a) / a) * 100).toFixed(1)) : 0;
        };
        return {
          daily: aiUsageDaily,
          labels,
          series: {
            tokens: aiUsageDaily.map((d) => d.tokens),
            requests: aiUsageDaily.map((d) => d.requests),
            cost: aiUsageDaily.map((d) => Math.round(d.cost / 1_000_000)),
            errors: aiUsageDaily.map((d) => d.errors),
            latency: aiUsageDaily.map((d, i) => 540 + ((d.requests * 7 + i * 131) % 520)),
          },
          credit: { ...aiCredit, percent: Math.round((aiCredit.used / aiCredit.limit) * 100) },
          requests,
          tokens,
          cost,
          errors,
          errorRate: Number(((errors / Math.max(1, requests)) * 100).toFixed(2)),
          avgLatency: Math.round(aiModelUsage.reduce((s, m) => s + m.latency * m.requests, 0) / Math.max(1, aiModelUsage.reduce((s, m) => s + m.requests, 0))),
          satisfaction: 94.6,
          savedHours: Math.round(requests / 42),
          growth: { tokens: growth('tokens'), requests: growth('requests'), cost: growth('cost'), errors: growth('errors') },
          byModel: aiModelUsage,
          byFeature: aiFeatureUsage,
          heatmap: aiHeatmap,
          team: aiTeamUsage,
          activity: aiActivity,
          alerts: aiAlerts,
        };
      },
    });
  },
};

export const apiKeyServiceAi = {
  async list() {
    const { default: services } = await import('./user.service.js');
    return services.apiKeyService.list();
  },
};

export default {
  modelService,
  promptService,
  promptActions,
  conversationService,
  chatService,
  writerService,
  summarizerService,
  repurposeService,
  imageStudioService,
  schedulerService,
  schedulerActions,
  usageService,
};
