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
    return call('list', 'ai/conversations', { resolver: () => aiConversations });
  },
  async get(id) {
    return call('get', `ai/conversations/${id}`, {
      resolver: () => ({
        id,
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

function mockAnswer(message = '') {
  const text = String(message);
  if (/خلاصه|summary/i.test(text)) {
    return 'خلاصه در سه بخش آماده شد:\n۱. وضعیت کلی و شاخص‌های کلیدی\n۲. روند تغییرات نسبت به دوره قبل\n۳. اقدامات پیشنهادی برای دوره بعد';
  }
  if (/کد|code|api/i.test(text)) {
    return 'ساختار پیشنهادی:\n```js\nconst res = await fetch("/api/reports", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ from, to }),\n});\n```\nخطاها را با try/catch مدیریت و وضعیت بارگذاری را به کاربر نشان دهید.';
  }
  if (/بازاریابی|کمپین|محتوا/i.test(text)) {
    return 'برای این هدف، تقویم محتوایی چهار هفته‌ای پیشنهاد می‌شود: هفته اول آموزشی، هفته دوم مقایسه‌ای، هفته سوم نمونه موردی و هفته چهارم پیشنهاد ویژه. هر هفته سه پست شبکه اجتماعی و یک خبرنامه.';
  }
  return `درخواست شما دریافت شد. بر اساس دستور «${text.slice(0, 60)}${text.length > 60 ? '…' : ''}» خروجی نمونه تولید شد. این پاسخ از داده‌های محلی ساخته می‌شود؛ با غیرفعال کردن حالت نمونه، همین متد به مدل واقعی متصل می‌شود.`;
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
      resolver: () => ({ paragraph, text: `${paragraph} در ادامه، سه نکته تکمیلی و یک مثال کاربردی برای روشن‌تر شدن موضوع ارائه می‌شود.` }),
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
        url: 'assets/img/products/product-01.svg',
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
  async overview() {
    return call('list', 'ai/usage', {
      resolver: () => ({
        daily: aiUsageDaily,
        credit: aiCredit,
        requests: aiUsageDaily.reduce((s, d) => s + d.requests, 0),
        tokens: aiUsageDaily.reduce((s, d) => s + d.tokens, 0),
        cost: aiUsageDaily.reduce((s, d) => s + d.cost, 0),
        errors: aiUsageDaily.reduce((s, d) => s + d.errors, 0),
        byModel: aiModels.map((m) => ({ label: m.name, requests: m.usage, tone: m.status === 'beta' ? 'warning' : 'primary' })),
      }),
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
