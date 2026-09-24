/**
 * NOVAADMIN — AI Workspace controllers
 * ------------------------------------------------------------------
 * The AI workspace is the flagship section of the template: a chat console, a
 * writing studio, a summarizer, a repurposing tool, a prompt library, an image
 * studio, a scheduler, usage analytics, model settings and API key management.
 *
 * Everything is wired to `src/services/ai.service.js`, which returns realistic
 * mock responses after a short latency — the UI is production-shaped (typing
 * indicator, token accounting, streaming-like reveal) without a real backend.
 *
 * Studio screens (dashboard, chat, usage, models, keys, history, scheduler,
 * prompts) share the `.ais-*` / `.aic-*` design language from
 * `scss/pages/_ai-studio.scss`.
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { formatCurrency, formatNumber, formatCompact, toDigits } from '../core/numbers.js';
import { relativeTime, formatDate } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import * as kit from './kit.js';

const { card, statCard, infoRows, timeline, paint, host, tabs, pageHeader, formMarkup, collectValues, openRecordForm, chart, exportable, emptyState, statusBadge, toolButtons, statsFrom, services } = kit;

/* ------------------------------------------------------------------ helpers */

const rows = (payload) => (Array.isArray(payload) ? payload : payload?.items ?? payload?.data ?? []);
const compact = (value) => formatCompact(Number(value) || 0);
const money = (value) => formatCurrency(Number(value) || 0, 'IRR', { compact: true });
const pct = (value, decimals = 1) => `${formatNumber(Number(value) || 0, { decimals })}٪`;

/** Chart placeholder owned by this controller (boot pass skips it). */
const slot = (key, height = 300) => `<div class="chart" data-chart-owner="controller" data-ai-chart="${key}" style="min-height:${height}px"></div>`;

/** Draws every `[data-ai-chart]` in `root` from a `{ key: options }` map. */
function drawCharts(root, specs) {
  return Promise.all(
    Object.entries(specs).map(([key, options]) => {
      const node = root.querySelector(`[data-ai-chart="${key}"]`);
      return node ? chart(node, options).catch(() => null) : null;
    }),
  );
}

function trend(value) {
  const n = Number(value) || 0;
  const down = n < 0;
  return `<span class="ais-trend ${down ? 'ais-trend--down' : ''}"><i class="bi bi-arrow-${down ? 'down' : 'up'}-short"></i>${pct(Math.abs(n))}</span>`;
}

function kpi({ label, value, icon, tone = 'primary', delta = null, meta = '', spark = null }) {
  return `<article class="ais-kpi ais-kpi--${tone}" data-reveal>
    <div class="ais-kpi__head"><span class="ais-kpi__icon"><i class="bi bi-${icon}"></i></span><span class="ais-kpi__label">${escapeHtml(label)}</span></div>
    <p class="ais-kpi__value">${value}</p>
    <div class="ais-kpi__meta">${delta !== null ? trend(delta) : ''}<span>${meta}</span></div>
    ${spark ? `<div class="ais-kpi__spark">${slot(spark, 46)}</div>` : '<div style="height:10px"></div>'}
  </article>`;
}

const sparkOptions = (data, color) => ({ type: 'sparkline', height: 46, series: [{ name: '', data }], colors: [color] });

function vendorMark(name = '') {
  const clean = String(name).replace(/[^A-Za-z\u0600-\u06FF ]/g, '').trim();
  return escapeHtml(clean.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AI');
}

/** Tiny, safe markdown: code fences, lists, **bold**, `code`, paragraphs. */
export function md(source = '') {
  const blocks = [];
  let text = String(source ?? '').replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre data-lang="${escapeHtml(lang || 'code')}"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  text = escapeHtml(text);
  const inline = (line) => line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  const flush = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  text.split('\n').forEach((raw) => {
    const line = raw.trim();
    const code = line.match(/^\u0000(\d+)\u0000$/);
    const ordered = line.match(/^(?:[0-9۰-۹]+)[.)]\s*(.*)$/);
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    if (code) { flush(); out.push(blocks[Number(code[1])]); return; }
    if (ordered) { if (list?.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] }; } list.items.push(ordered[1]); return; }
    if (bullet) { if (list?.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] }; } list.items.push(bullet[1]); return; }
    flush();
    if (line) out.push(`<p>${inline(line).replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)])}</p>`);
  });
  flush();
  return out.join('');
}

/** Legacy bubble helpers — still used by the writer/summarizer screens. */
function bubble({ role = 'assistant', text = '', at = null, meta = '' }) {
  return `<article class="msg ${role === 'user' ? 'msg--out' : 'msg--in'}" data-msg-role="${role}">
    <span class="msg__avatar"><img class="avatar avatar--sm" src="${role === 'user' ? 'assets/img/avatars/avatar-08.svg' : 'assets/img/avatars/avatar-02.svg'}" alt="" /></span>
    <div class="msg__body">
      <header class="msg__meta"><strong>${role === 'user' ? 'شما' : 'دستیار نووا'}</strong><time>${at ? relativeTime(at) : 'همین حالا'}</time>${meta ? `<span class="badge badge--soft-primary">${escapeHtml(meta)}</span>` : ''}</header>
      <div class="msg__bubble">${text}</div>
    </div>
  </article>`;
}

async function modelOptions(select) {
  if (!select) return;
  const models = await services.modelService.list({ perPage: 20 });
  select.innerHTML = rows(models).map((model) => `<option value="${escapeHtml(model.name)}">${escapeHtml(model.name)}</option>`).join('');
}

/** Progressive reveal so long answers feel streamed instead of dumped. */
function reveal(node, text, { speed = 12 } = {}) {
  const target = node.querySelector('.msg__bubble');
  if (!target) return;
  let index = 0;
  const step = Math.max(1, Math.round(text.length / 220));
  const timer = setInterval(() => {
    index += step;
    target.textContent = text.slice(0, index);
    if (index >= text.length) clearInterval(timer);
  }, speed);
}

/* ------------------------------------------------------------------- pages */

export async function initAiWorkspace() {
  const page = kit.pageId();
  switch (page) {
    case 'ai/chat.html':
      return aiChat();
    case 'ai/writer.html':
      return aiWriter();
    case 'ai/summarizer.html':
      return aiSummarizer();
    case 'ai/repurposer.html':
      return aiRepurposer();
    case 'ai/images.html':
      return aiImages();
    case 'ai/usage.html':
      return aiUsage();
    case 'ai/scheduler.html':
      return aiScheduler();
    case 'ai/models.html':
      return aiModels();
    case 'ai/api-keys.html':
      return aiKeys();
    case 'ai/history.html':
      return aiHistory();
    case 'ai/dashboard.html':
      return aiDashboard();
    case 'ai/prompts.html':
      return aiPrompts();
    default:
      return;
  }
}

/* ---------------------------------------------------------------- chat page */

const STARTERS = [
  { icon: 'graph-up-arrow', tone: 'primary', title: 'تحلیل فروش سه‌ماهه', text: 'روند فروش را تحلیل کن و سه پیشنهاد برای رشد بده', prompt: 'داده‌های فروش سه‌ماهه اخیر را تحلیل کن و سه پیشنهاد عملی برای رشد ارائه بده.' },
  { icon: 'megaphone', tone: 'violet', title: 'کمپین بازاریابی محتوا', text: 'تقویم محتوایی یک‌ماهه برای فروشگاه اینترنتی', prompt: 'یک تقویم بازاریابی محتوا برای یک ماه آینده فروشگاه اینترنتی طراحی کن.' },
  { icon: 'code-slash', tone: 'info', title: 'نوشتن کد API', text: 'نمونه کد فراخوانی API گزارش‌ها با جاوااسکریپت', prompt: 'یک نمونه کد جاوااسکریپت برای فراخوانی API گزارش‌ها بنویس.' },
  { icon: 'file-earmark-text', tone: 'success', title: 'خلاصه‌سازی جلسه', text: 'خلاصه جلسه و استخراج اقدامات کلیدی', prompt: 'خلاصه جلسه هیئت مدیره را در سه بخش با اقدامات کلیدی آماده کن.' },
];

const QUICK_ACTIONS = [
  ['lightbulb', 'ایده‌پردازی'],
  ['translate', 'ترجمه به انگلیسی'],
  ['list-check', 'تبدیل به چک‌لیست'],
  ['arrows-angle-contract', 'کوتاه‌تر کن'],
  ['emoji-smile', 'لحن دوستانه‌تر'],
];

function chatMessage({ role = 'ai', text = '', html = null, model = '', tokens = null, at = null, id = '' }) {
  const user = role === 'user';
  return `<article class="aic-msg aic-msg--${user ? 'user' : 'ai'}" ${id ? `data-msg-id="${escapeHtml(id)}"` : ''}>
    <span class="aic-msg__avatar">${user ? '<img src="assets/img/avatars/avatar-08.svg" alt="">' : '<span class="aic-orb aic-orb--sm"><i class="bi bi-stars"></i></span>'}</span>
    <div class="aic-msg__body">
      <header class="aic-msg__meta"><strong>${user ? 'شما' : 'دستیار نووا'}</strong>${model ? `<span class="badge badge--soft-primary">${escapeHtml(model)}</span>` : ''}<time>${at ? relativeTime(at) : 'همین حالا'}</time>${tokens ? `<span>• ${toDigits(tokens)} توکن</span>` : ''}</header>
      <div class="aic-msg__text">${html ?? (user ? escapeHtml(text).replace(/\n/g, '<br>') : md(text))}</div>
      ${user ? '' : `<div class="aic-msg__actions">
        <button type="button" data-msg-copy title="کپی"><i class="bi bi-clipboard"></i></button>
        <button type="button" data-msg-regen title="تولید دوباره"><i class="bi bi-arrow-repeat"></i></button>
        <button type="button" data-msg-like title="پاسخ مفید بود"><i class="bi bi-hand-thumbs-up"></i></button>
        <button type="button" data-msg-dislike title="پاسخ مفید نبود"><i class="bi bi-hand-thumbs-down"></i></button>
        <button type="button" data-msg-speak title="خواندن متن"><i class="bi bi-volume-up"></i></button>
      </div>`}
    </div>
  </article>`;
}

function welcome() {
  return `<div class="aic-welcome" data-welcome>
    <span class="aic-orb"><i class="bi bi-stars"></i></span>
    <h2>امروز چه چیزی بسازیم؟</h2>
    <p>از تحلیل داده تا نوشتن کد و محتوا — یک پیشنهاد را انتخاب کنید یا سؤال خودتان را بنویسید.</p>
    <div class="aic-starters">${STARTERS.map((item, i) => `<button type="button" class="aic-starter aic-starter--${item.tone}" data-starter="${i}"><i class="bi bi-${item.icon}"></i><div><strong>${item.title}</strong><span>${item.text}</span></div></button>`).join('')}</div>
  </div>`;
}

async function aiChat() {
  const node = host();
  render(node, `<div class="dashboard-shell">${kit.skeleton(3, 'card')}</div>`);
  const [conversationsRaw, models, prompts, usage] = await Promise.all([
    services.conversationService.list(),
    services.modelService.list({ perPage: 20 }),
    services.promptService.list({ perPage: 8 }),
    services.usageService.overview(),
  ]);
  const conversations = rows(conversationsRaw);
  const modelList = rows(models);
  const groups = ['امروز', 'دیروز', 'هفته گذشته', 'ماه گذشته'];

  render(
    node,
    `<div class="aic">
      <aside class="aic-side">
        <div class="aic-side__head">
          <button class="aic-new" type="button" data-new-chat><i class="bi bi-plus-lg"></i> گفتگوی جدید</button>
          <label class="aic-search"><i class="bi bi-search"></i><input type="search" placeholder="جستجو در گفتگوها…" data-chat-search aria-label="جستجو در گفتگوها"></label>
        </div>
        <div class="aic-list" data-conversation-list>
          ${conversations.some((c) => c.pinned) ? `<div class="aic-group"><i class="bi bi-pin-angle-fill"></i> سنجاق‌شده</div>${conversations.filter((c) => c.pinned).map((c) => convItem(c)).join('')}` : ''}
          ${groups
            .map((group) => {
              const items = conversations.filter((c) => !c.pinned && c.folder === group);
              return items.length ? `<div class="aic-group">${group}</div>${items.map((c) => convItem(c)).join('')}` : '';
            })
            .join('')}
        </div>
        <div class="aic-side__foot">
          <div class="d-flex justify-content-between"><span>اعتبار ماهانه</span><strong>${pct(usage.credit.percent, 0)}</strong></div>
          <div class="ais-bar"><span style="width:${usage.credit.percent}%"></span></div>
          <div class="mt-1">${money(usage.credit.used)} از ${money(usage.credit.limit)}</div>
        </div>
      </aside>

      <section class="aic-main">
        <header class="aic-head">
          <span class="aic-orb"><i class="bi bi-stars"></i></span>
          <div style="min-width:0">
            <h2 class="aic-head__title" data-chat-title>گفتگوی جدید</h2>
            <span class="aic-head__sub"><span class="ais-dot"></span> آنلاین • ${toDigits(modelList.length)} مدل در دسترس</span>
          </div>
          <div class="aic-head__actions">
            <select class="form-select form-select--sm aic-model-select" data-ai-model aria-label="انتخاب مدل">${modelList.map((m) => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}</select>
            <button class="icon-btn" type="button" data-context-toggle title="تنظیمات مدل"><i class="bi bi-sliders"></i></button>
            <button class="icon-btn" type="button" data-chat-share title="اشتراک‌گذاری"><i class="bi bi-share"></i></button>
            <button class="icon-btn" type="button" data-chat-export title="خروجی گفتگو"><i class="bi bi-download"></i></button>
            <button class="icon-btn" type="button" data-chat-clear title="پاک کردن گفتگو"><i class="bi bi-trash3"></i></button>
          </div>
        </header>
        <div class="aic-stream" data-chat-stream>${welcome()}</div>
        <div class="aic-compose-wrap">
          <div class="aic-quick">${QUICK_ACTIONS.map(([icon, label]) => `<button type="button" class="ais-chip" data-quick="${label}"><i class="bi bi-${icon}"></i> ${label}</button>`).join('')}</div>
          <form class="aic-compose" data-ai-composer>
            <textarea rows="1" name="message" placeholder="پیام خود را بنویسید… (مثلاً: یک ایمیل پیگیری برای مشتری بنویس)" aria-label="متن پیام"></textarea>
            <div class="aic-compose__row">
              <button class="icon-btn icon-btn--sm" type="button" data-ai-attach title="پیوست فایل"><i class="bi bi-paperclip"></i></button>
              <button class="icon-btn icon-btn--sm" type="button" data-ai-image title="افزودن تصویر"><i class="bi bi-image"></i></button>
              <button class="icon-btn icon-btn--sm" type="button" data-ai-mic title="ورودی صوتی"><i class="bi bi-mic"></i></button>
              <button class="icon-btn icon-btn--sm" type="button" data-ai-web title="جستجوی وب"><i class="bi bi-globe2"></i></button>
              <span class="aic-compose__hint"><span data-char-count>۰</span> نویسه • Enter ارسال • Shift+Enter خط جدید</span>
              <button class="aic-send" type="submit" data-ai-send aria-label="ارسال"><i class="bi bi-send-fill"></i></button>
            </div>
          </form>
          <p class="aic-disclaimer">پاسخ‌ها در نسخه نمایشی از داده‌های نمونه تولید می‌شوند و ممکن است دقیق نباشند.</p>
        </div>
      </section>

      <aside class="aic-context">
        <div class="aic-block">
          <h3 class="aic-block__title"><i class="bi bi-sliders"></i> تنظیمات مدل</h3>
          <label class="aic-range"><span class="aic-range__row"><span>خلاقیت (Temperature)</span><b data-temp-out>۰٫۷</b></span><input type="range" min="0" max="1" step="0.1" value="0.7" data-temp></label>
          <label class="aic-range"><span class="aic-range__row"><span>حداکثر طول پاسخ</span><b data-max-out>۱۰۲۴</b></span><input type="range" min="256" max="4096" step="256" value="1024" data-max></label>
          <div class="aic-toggle-row"><span>لحن پاسخ</span><select class="form-select form-select--sm" style="width:auto" data-ai-tone><option>رسمی</option><option>دوستانه</option><option>خلاصه</option><option>آموزشی</option></select></div>
          <div class="aic-toggle-row"><span>حافظه گفتگو</span><label class="ais-switch"><input type="checkbox" checked data-memory><span></span></label></div>
          <div class="aic-toggle-row"><span>جستجوی وب</span><label class="ais-switch"><input type="checkbox" data-web><span></span></label></div>
        </div>
        <div class="aic-block">
          <h3 class="aic-block__title"><i class="bi bi-activity"></i> مصرف این نشست</h3>
          <div class="aic-stats">
            <div><small>پیام‌ها</small><strong data-token-messages>۰</strong></div>
            <div><small>توکن</small><strong data-token-count>۰</strong></div>
            <div><small>هزینه تخمینی</small><strong data-token-cost>۰</strong></div>
            <div><small>میانگین پاسخ</small><strong data-token-latency>—</strong></div>
          </div>
        </div>
        <div class="aic-block">
          <h3 class="aic-block__title"><i class="bi bi-bookmark-star"></i> پرامپت‌های پیشنهادی</h3>
          ${rows(prompts)
            .slice(0, 6)
            .map((p) => `<button type="button" class="aic-prompt-btn" data-prompt="${escapeHtml(p.id)}"><i class="bi bi-${escapeHtml(p.icon ?? 'lightning')}"></i><span>${escapeHtml(p.title)}</span></button>`)
            .join('')}
          <a class="btn btn-light btn-sm w-100 mt-2" href="ai/prompts.html"><i class="bi bi-grid"></i> کتابخانه کامل</a>
        </div>
      </aside>
    </div>`,
  );

  const stream = $('[data-chat-stream]', node);
  const input = $('textarea[name="message"]', node);
  const modelSelect = $('[data-ai-model]', node);
  const sendBtn = $('[data-ai-send]', node);
  let conversationId = null;
  let tokens = 0;
  let messages = 0;
  let latencyTotal = 0;
  let busy = false;
  let lastPrompt = '';

  const scroll = () => { stream.scrollTop = stream.scrollHeight; };
  const stats = (count, latency = 0) => {
    tokens += count;
    messages += count ? 1 : 0;
    latencyTotal += latency;
    $('[data-token-messages]', node).textContent = toDigits(messages);
    $('[data-token-count]', node).textContent = formatNumber(tokens);
    $('[data-token-cost]', node).textContent = money(tokens * 320);
    $('[data-token-latency]', node).textContent = messages ? `${toDigits(Math.round(latencyTotal / messages))}ms` : '—';
  };
  const reset = () => { tokens = 0; messages = 0; latencyTotal = 0; stats(0); };

  const streamInto = (article, text) =>
    new Promise((resolve) => {
      const target = $('.aic-msg__text', article);
      const words = text.split(/(\s+)/);
      let i = 0;
      const timer = setInterval(() => {
        i += 3;
        target.innerHTML = md(words.slice(0, i).join('')) || '<span class="aic-typing"><span></span><span></span><span></span></span>';
        scroll();
        if (i >= words.length) { clearInterval(timer); target.innerHTML = md(text); resolve(); }
      }, 28);
    });

  const send = async (text) => {
    const message = String(text ?? '').trim();
    if (!message || busy) return;
    busy = true;
    sendBtn.disabled = true;
    lastPrompt = message;
    $('[data-welcome]', stream)?.remove();
    if ($('[data-chat-title]', node).textContent === 'گفتگوی جدید') $('[data-chat-title]', node).textContent = message.slice(0, 48) + (message.length > 48 ? '…' : '');
    stream.insertAdjacentHTML('beforeend', chatMessage({ role: 'user', text: message }));
    stream.insertAdjacentHTML('beforeend', `<article class="aic-msg aic-msg--ai" data-typing><span class="aic-msg__avatar"><span class="aic-orb aic-orb--sm"><i class="bi bi-stars"></i></span></span><div class="aic-msg__body"><header class="aic-msg__meta"><strong>دستیار نووا</strong><span>در حال فکر کردن…</span></header><div class="aic-msg__text aic-typing"><span></span><span></span><span></span></div></div></article>`);
    scroll();
    const started = performance.now();
    try {
      const reply = await services.aiChat.send({ message, conversationId, model: modelSelect?.value, temperature: Number($('[data-temp]', node).value), maxTokens: Number($('[data-max]', node).value) });
      const latency = Math.round(performance.now() - started);
      $('[data-typing]', stream)?.remove();
      stream.insertAdjacentHTML('beforeend', chatMessage({ role: 'ai', html: '', model: reply.model ?? modelSelect?.value, tokens: reply.tokens, at: new Date() }));
      await streamInto(stream.lastElementChild, reply.message ?? reply.text ?? 'پاسخ آماده شد.');
      stats(reply.tokens ?? 420, latency);
      conversationId = reply.conversationId ?? conversationId;
    } catch {
      $('[data-typing]', stream)?.remove();
      toast.error('خطا در دریافت پاسخ', 'اتصال به مدل برقرار نشد. دوباره تلاش کنید.');
    } finally {
      busy = false;
      sendBtn.disabled = false;
    }
  };

  const autosize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(180, input.scrollHeight)}px`;
    $('[data-char-count]', node).textContent = toDigits(input.value.length);
  };

  on($('[data-ai-composer]', node), 'submit', (event) => {
    event.preventDefault();
    const text = input.value;
    input.value = '';
    autosize();
    send(text);
  });
  on(input, 'input', autosize);
  on(input, 'keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      $('[data-ai-composer]', node).requestSubmit();
    }
  });
  on($('[data-temp]', node), 'input', (event) => { $('[data-temp-out]', node).textContent = toDigits(event.target.value).replace('.', '٫'); });
  on($('[data-max]', node), 'input', (event) => { $('[data-max-out]', node).textContent = toDigits(event.target.value); });

  on(node, 'click', async (event) => {
    const t = event.target;
    if (t.closest('[data-context-toggle]')) { $('.aic', node).classList.toggle('is-context'); return; }
    const conversation = t.closest('[data-conversation]');
    if (conversation) {
      $$('[data-conversation]', node).forEach((item) => item.classList.toggle('is-active', item === conversation));
      conversationId = conversation.dataset.conversation;
      const summary = conversations.find((c) => c.id === conversationId);
      $('[data-chat-title]', node).textContent = summary?.title ?? 'گفتگو';
      render(stream, `<div class="aic-msg aic-msg--ai"><div class="aic-msg__text aic-typing"><span></span><span></span><span></span></div></div>`);
      const detail = await services.conversationService.get(conversationId);
      reset();
      render(
        stream,
        (detail.messages ?? [])
          .map((m) => chatMessage({ role: (m.side ?? m.role) === 'user' ? 'user' : 'ai', text: m.text, model: m.model, tokens: m.tokens, at: summary?.updatedAt }))
          .join('') || welcome(),
      );
      (detail.messages ?? []).forEach((m) => m.tokens && stats(m.tokens, 640));
      scroll();
      return;
    }
    if (t.closest('[data-new-chat]')) {
      conversationId = null;
      $$('[data-conversation]', node).forEach((item) => item.classList.remove('is-active'));
      render(stream, welcome());
      $('[data-chat-title]', node).textContent = 'گفتگوی جدید';
      reset();
      input.focus();
      return;
    }
    const starter = t.closest('[data-starter]');
    if (starter) return send(STARTERS[Number(starter.dataset.starter)].prompt);
    const quick = t.closest('[data-quick]');
    if (quick) {
      if (lastPrompt) return send(`${quick.dataset.quick}: ${lastPrompt}`);
      input.value = `${quick.dataset.quick}: `;
      input.focus();
      return;
    }
    const prompt = t.closest('[data-prompt]');
    if (prompt) {
      const detail = await services.promptService.get(prompt.dataset.prompt);
      input.value = detail.text ?? detail.template ?? detail.title ?? '';
      autosize();
      input.focus();
      return;
    }
    const msg = t.closest('.aic-msg');
    if (t.closest('[data-msg-copy]') && msg) {
      await navigator.clipboard?.writeText($('.aic-msg__text', msg).textContent.trim()).catch(() => {});
      toast.success('کپی شد', 'متن پاسخ در حافظه موقت قرار گرفت.');
      return;
    }
    if (t.closest('[data-msg-regen]')) return lastPrompt ? send(lastPrompt) : toast.info('تولید دوباره', 'ابتدا یک پیام ارسال کنید.');
    const vote = t.closest('[data-msg-like], [data-msg-dislike]');
    if (vote) {
      $$('[data-msg-like], [data-msg-dislike]', msg).forEach((b) => b.classList.remove('is-on'));
      vote.classList.add('is-on');
      vote.querySelector('i').className = vote.hasAttribute('data-msg-like') ? 'bi bi-hand-thumbs-up-fill' : 'bi bi-hand-thumbs-down-fill';
      toast.success('ممنون از بازخورد شما', 'از این بازخورد برای بهبود پاسخ‌ها استفاده می‌شود.');
      return;
    }
    if (t.closest('[data-msg-speak]') && msg) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance($('.aic-msg__text', msg).textContent);
        u.lang = 'fa-IR';
        window.speechSynthesis.speak(u);
      }
      toast.info('خواندن متن', 'پخش صوتی پاسخ آغاز شد.');
      return;
    }
    if (t.closest('[data-chat-clear]')) {
      const ok = await modal.confirm({ title: 'پاک کردن گفتگو', text: 'همه پیام‌های این نشست از صفحه حذف می‌شود.', tone: 'warning', confirmText: 'پاک کن' });
      if (ok) { render(stream, welcome()); reset(); }
      return;
    }
    if (t.closest('[data-chat-export]')) {
      const text = $$('.aic-msg', stream).map((item) => `${item.classList.contains('aic-msg--user') ? 'شما' : 'دستیار'}: ${$('.aic-msg__text', item).textContent.trim()}`).join('\n\n');
      const blob = new Blob([text || 'گفتگو خالی است.'], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'nova-chat.txt';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 500);
      toast.success('خروجی آماده شد', 'فایل متنی گفتگو دانلود شد.');
      return;
    }
    if (t.closest('[data-chat-share]')) {
      await navigator.clipboard?.writeText(`${location.origin}${location.pathname}?share=${conversationId ?? 'new'}`).catch(() => {});
      toast.success('پیوند اشتراک کپی شد', 'هر کسی با این پیوند می‌تواند گفتگو را فقط بخواند.');
      return;
    }
    if (t.closest('[data-ai-attach]')) toast.info('پیوست فایل', 'در نسخه نمایشی، پیوست‌ها پردازش نمی‌شوند.');
    if (t.closest('[data-ai-image]')) toast.info('افزودن تصویر', 'مدل‌های دارای قابلیت تصویر (GPT-4o) تصویر را تحلیل می‌کنند.');
    if (t.closest('[data-ai-mic]')) toast.info('ورودی صوتی', 'برای استفاده، دسترسی میکروفون را در مرورگر فعال کنید.');
    if (t.closest('[data-ai-web]')) {
      const box = $('[data-web]', node);
      box.checked = !box.checked;
      toast.info('جستجوی وب', box.checked ? 'پاسخ‌ها با نتایج وب تکمیل می‌شوند.' : 'جستجوی وب غیرفعال شد.');
    }
  });
  on($('[data-chat-search]', node), 'input', (event) => {
    const term = event.target.value.trim();
    $$('[data-conversation]', node).forEach((item) => { item.hidden = term ? !item.textContent.includes(term) : false; });
  });
}

function convItem(c) {
  return `<button type="button" class="aic-conv" data-conversation="${escapeHtml(c.id)}">
    <span class="aic-conv__icon"><i class="bi bi-chat-square-text"></i></span>
    <span class="aic-conv__body"><span class="aic-conv__title">${c.pinned ? '<i class="bi bi-pin-fill aic-conv__pin"></i> ' : ''}${escapeHtml(c.title)}</span><span class="aic-conv__preview">${escapeHtml(c.preview ?? '')}</span></span>
  </button>`;
}

/* -------------------------------------------------------------- writer page */

const WRITER_TEMPLATES = [
  ['journal-richtext', 'مقاله وبلاگ', 'primary'],
  ['bag', 'توضیح محصول', 'success'],
  ['envelope', 'ایمیل بازاریابی', 'info'],
  ['megaphone', 'متن تبلیغ', 'warning'],
  ['instagram', 'پست اجتماعی', 'danger'],
  ['newspaper', 'خبر رسمی', 'violet'],
];

function articleHtml(result) {
  return `<h2>${escapeHtml(result.title ?? '')}</h2><p>${escapeHtml(result.intro ?? '')}</p>${(result.sections ?? [])
    .map((section) => `<h3>${escapeHtml(section.heading)}</h3><p>${escapeHtml(section.text)}</p>`)
    .join('')}<h3>جمع‌بندی</h3><p>با انتخاب درست پلتفرم، طراحی تجربه خرید روان و اتصال عملیات انبار، فروشگاه شما آماده رشد پایدار خواهد بود. گام بعدی، سنجش مداوم شاخص‌ها و بهبود تدریجی است.</p>`;
}

async function aiWriter() {
  const node = host();
  const sample = await services.writerService.generate({ topic: 'راه‌اندازی فروشگاه اینترنتی', tone: 'professional' });
  render(
    node,
    `<div class="ais">
      <div class="ais-grid">
        <section data-col="5" class="card">
          <header class="card__head"><span class="card__icon"><i class="bi bi-sliders"></i></span><div><h2 class="card__title">تنظیمات تولید</h2><p class="card__subtitle">قالب، موضوع و لحن متن را مشخص کنید</p></div></header>
          <form class="card__body" data-writer-form novalidate>
            <label class="form-label">قالب محتوا</label>
            <div class="ais-style-grid" data-template-pick>${WRITER_TEMPLATES.map(([icon, label, tone], i) => `<button type="button" class="ais-style ais-tone--${tone} ${i === 0 ? 'is-active' : ''}" data-template="${label}"><i class="bi bi-${icon}"></i><span>${label}</span></button>`).join('')}</div>
            <label class="form-label mt-3">موضوع <span class="text-danger">*</span></label>
            <input class="form-control" name="topic" required value="راهنمای کامل راه‌اندازی فروشگاه اینترنتی" placeholder="مثلاً: معرفی قابلیت گزارش‌های هوشمند">
            <div class="row g-2 mt-1">
              <div class="col-6"><label class="form-label">لحن</label><select class="form-select form-select--sm" name="tone"><option value="رسمی">رسمی</option><option value="دوستانه">دوستانه</option><option value="ترغیبی">ترغیبی</option><option value="آموزشی">آموزشی</option><option value="خلاقانه">خلاقانه</option></select></div>
              <div class="col-6"><label class="form-label">زبان</label><select class="form-select form-select--sm" name="language"><option>فارسی</option><option>English</option><option>العربية</option></select></div>
              <div class="col-6"><label class="form-label">مخاطب</label><input class="form-control form-control--sm" name="audience" value="صاحبان کسب‌وکار کوچک"></div>
              <div class="col-6"><label class="form-label">مدل</label><select class="form-select form-select--sm" name="model"><option>GPT-4o</option><option>Claude 3.5 Sonnet</option><option>مدل فارسی نووا</option></select></div>
            </div>
            <label class="form-label mt-3">طول متن</label>
            <div class="ais-chips" data-length-pick><button type="button" class="ais-chip" data-len="۱۵۰">کوتاه</button><button type="button" class="ais-chip is-active" data-len="۴۰۰">متوسط</button><button type="button" class="ais-chip" data-len="۸۰۰">بلند</button></div>
            <label class="form-label mt-3">کلیدواژه‌های سئو</label>
            <input class="form-control form-control--sm" name="keywords" value="فروشگاه اینترنتی، درگاه پرداخت، تجربه کاربری">
            <label class="form-label mt-3">ساختار دلخواه</label>
            <textarea class="form-control form-control--sm" name="outline" rows="3" placeholder="هر خط یک سرفصل">انتخاب پلتفرم\nتجربه خرید\nعملیات و لجستیک</textarea>
            <div class="d-flex gap-2 mt-3"><button class="btn btn-light" type="reset">پاک کردن</button><button class="aic-new" style="flex:1" type="submit" data-generate><i class="bi bi-stars"></i> تولید متن</button></div>
          </form>
        </section>
        <div data-col="7" class="d-flex flex-column" style="gap:var(--nv-card-gap,1.25rem)">
          <section class="card">
            <header class="card__head"><span class="card__icon"><i class="bi bi-file-richtext"></i></span><div><h2 class="card__title">خروجی</h2><p class="card__subtitle" data-output-meta>نمونه تولیدشده • ${toDigits(sample.meta?.tokens ?? 0)} توکن</p></div>
              <div class="card__actions"><button class="btn btn-light btn-sm" type="button" data-copy-output><i class="bi bi-clipboard"></i> کپی</button><button class="btn btn-light btn-sm" type="button" data-export-output><i class="bi bi-download"></i> دانلود</button></div></header>
            <div class="card__body">
              <div class="ais-editor">
                <div class="ais-editor__bar">
                  <button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="bold" title="پررنگ"><i class="bi bi-type-bold"></i></button>
                  <button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="italic" title="ایتالیک"><i class="bi bi-type-italic"></i></button>
                  <button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="formatBlock:h3" title="سرتیتر"><i class="bi bi-type-h3"></i></button>
                  <button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="insertUnorderedList" title="فهرست"><i class="bi bi-list-ul"></i></button>
                  <span class="ais-editor__sep"></span>
                  <button type="button" class="ais-chip" data-expand><i class="bi bi-arrows-angle-expand"></i> بلندتر</button>
                  <button type="button" class="ais-chip" data-shorten><i class="bi bi-arrows-angle-contract"></i> کوتاه‌تر</button>
                  <button type="button" class="ais-chip" data-rephrase><i class="bi bi-magic"></i> بازنویسی</button>
                </div>
                <div class="ais-editor__body" contenteditable="true" data-editor-body>${articleHtml(sample)}</div>
              </div>
            </div>
          </section>
          <div class="ais-kpis">
            ${kpi({ label: 'تعداد کلمات', value: '<span data-word-count>۰</span>', icon: 'fonts', tone: 'primary', meta: 'متن فعلی' })}
            ${kpi({ label: 'زمان مطالعه', value: '<span data-read-time>۰</span> دقیقه', icon: 'clock', tone: 'info', meta: '۲۰۰ کلمه در دقیقه' })}
            ${kpi({ label: 'امتیاز سئو', value: '<span data-seo>۸۶</span>/۱۰۰', icon: 'search', tone: 'success', meta: 'کلیدواژه‌ها پوشش داده شد' })}
          </div>
          ${card({ title: 'تاریخچه تولید', icon: 'clock-history', body: `<ul class="ais-feed" data-writer-history>${[
            ['راهنمای کامل راه‌اندازی فروشگاه اینترنتی', 'مقاله وبلاگ • ۴۲۰ کلمه', '۲ ساعت پیش'],
            ['ایمیل خوش‌آمدگویی مشتریان جدید', 'ایمیل بازاریابی • ۱۸۰ کلمه', 'دیروز'],
            ['توضیح محصول هدفون بی‌سیم X2', 'توضیح محصول • ۱۲۰ کلمه', '۳ روز پیش'],
          ].map(([title, meta, time]) => `<li class="is-violet"><span class="ais-feed__icon"><i class="bi bi-magic"></i></span><div><div class="ais-feed__title">${title}</div><div class="ais-feed__meta">${meta} • ${time}</div></div></li>`).join('')}</ul>` })}
        </div>
      </div>
    </div>`,
  );

  const form = $('[data-writer-form]', node);
  const body = $('[data-editor-body]', node);
  const updateStats = () => {
    const words = body.textContent.trim().split(/\s+/).filter(Boolean).length;
    $('[data-word-count]', node).textContent = formatNumber(words);
    $('[data-read-time]', node).textContent = toDigits(Math.max(1, Math.round(words / 200)));
    $('[data-seo]', node).textContent = toDigits(Math.min(98, 60 + Math.round(words / 12)));
  };
  updateStats();
  on(body, 'input', updateStats);

  on(node, 'click', async (event) => {
    const t = event.target;
    const choose = t.closest('[data-template-pick] [data-template], [data-length-pick] [data-len]');
    if (choose) { $$('button', choose.parentElement).forEach((b) => b.classList.toggle('is-active', b === choose)); return; }
    const cmd = t.closest('[data-editor-cmd]');
    if (cmd) {
      const [command, argument] = String(cmd.dataset.editorCmd).split(':');
      body.focus();
      document.execCommand(command, false, argument);
      return;
    }
    if (t.closest('[data-expand]')) {
      const result = await services.writerService.expand(body.textContent.slice(-300));
      body.insertAdjacentHTML('beforeend', `<p>${escapeHtml(result.text ?? '')}</p>`);
      updateStats();
      return toast.success('متن گسترش یافت', 'پاراگراف تکمیلی افزوده شد.');
    }
    if (t.closest('[data-shorten]')) {
      const paragraphs = $$('p', body);
      paragraphs.forEach((p) => { const words = p.textContent.split(' '); if (words.length > 22) p.textContent = `${words.slice(0, 22).join(' ')}…`; });
      updateStats();
      return toast.info('متن کوتاه شد', 'پاراگراف‌ها خلاصه شدند.');
    }
    if (t.closest('[data-rephrase]')) {
      body.classList.add('is-busy');
      await services.writerService.generate(collectValues(form));
      body.classList.remove('is-busy');
      return toast.success('بازنویسی انجام شد', 'متن با لحن انتخابی بازنویسی شد.');
    }
    if (t.closest('[data-copy-output]')) {
      await navigator.clipboard?.writeText(body.innerText).catch(() => {});
      return toast.success('کپی شد', 'متن در حافظه موقت قرار گرفت.');
    }
    if (t.closest('[data-export-output]')) {
      const blob = new Blob([`<article dir="rtl">${body.innerHTML}</article>`], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'nova-writer.html';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 500);
    }
  });

  on(form, 'submit', async (event) => {
    event.preventDefault();
    const topic = form.topic.value.trim();
    if (!topic) {
      form.topic.classList.add('is-invalid');
      return toast.warning('موضوع را وارد کنید', 'برای تولید متن، موضوع الزامی است.');
    }
    form.topic.classList.remove('is-invalid');
    const button = $('[data-generate]', form);
    button.disabled = true;
    body.classList.add('is-busy');
    try {
      const payload = collectValues(form);
      const result = await services.writerService.generate(payload);
      body.innerHTML = articleHtml({ ...result, title: topic });
      updateStats();
      const template = $('[data-template-pick] .is-active', node)?.dataset.template ?? '';
      $('[data-output-meta]', node).textContent = `${template} • لحن ${payload.tone} • ${toDigits(result.meta?.tokens ?? 0)} توکن`;
      $('[data-writer-history]', node).insertAdjacentHTML('afterbegin', `<li class="is-success"><span class="ais-feed__icon"><i class="bi bi-stars"></i></span><div><div class="ais-feed__title">${escapeHtml(topic)}</div><div class="ais-feed__meta">${escapeHtml(template)} • همین حالا</div></div></li>`);
      toast.success('متن تولید شد', `${toDigits(result.meta?.tokens ?? 0)} توکن مصرف شد.`);
    } finally {
      button.disabled = false;
      body.classList.remove('is-busy');
    }
  });
}

/* ---------------------------------------------------------- summarizer page */

const SUMMARY_SOURCE = `گزارش عملکرد فصل سوم شرکت نشان می‌دهد درآمد کل با رشد ۱۴.۲ درصدی نسبت به فصل قبل به ۲۲.۴ میلیارد ریال رسیده است. بیشترین سهم رشد مربوط به فروش آنلاین و مشتریان سازمانی بوده است. در همین دوره هزینه‌های عملیاتی ۴.۶ درصد افزایش یافت که عمدتاً ناشی از توسعه تیم پشتیبانی و راه‌اندازی مرکز تماس جدید بود. نرخ ریزش مشتریان سازمانی از ۳.۱ درصد به ۲.۴ درصد کاهش یافت و رضایت مشتریان در نظرسنجی فصلی به ۸۷ درصد رسید. با این حال سه ریسک اصلی شناسایی شده است: تأخیر در تأمین سرورهای جدید، وابستگی به یک درگاه پرداخت و کمبود نیروی متخصص داده. هیئت مدیره پیشنهاد کرده است بودجه فصل آینده با تمرکز بر تنوع درگاه‌های پرداخت و جذب تحلیلگر داده بازنگری شود.`;

async function aiSummarizer() {
  const node = host();
  const seed = await services.summarizerService.summarize({ text: SUMMARY_SOURCE, bullets: 4 });
  const words = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
  const summaryHtml = (result) => `<ol class="ais-summary">${(result.bullets ?? result.summary ?? []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol>`;
  render(
    node,
    `<div class="ais">
      <div class="ais-grid">
        <section data-col="6" class="card">
          <header class="card__head"><span class="card__icon"><i class="bi bi-file-earmark-arrow-up"></i></span><div><h2 class="card__title">ورودی</h2><p class="card__subtitle">فایل، متن یا نشانی صفحه وب</p></div></header>
          <form class="card__body" data-summary-form novalidate>
            <div class="ais-chips mb-3" data-source-pick><button type="button" class="ais-chip is-active"><i class="bi bi-textarea-t"></i> متن</button><button type="button" class="ais-chip"><i class="bi bi-file-earmark-pdf"></i> فایل</button><button type="button" class="ais-chip"><i class="bi bi-link-45deg"></i> نشانی وب</button><button type="button" class="ais-chip"><i class="bi bi-youtube"></i> ویدیو</button></div>
            <div class="ais-drop" data-file-drop><i class="bi bi-cloud-arrow-up"></i><div><strong>فایل را اینجا رها کنید یا کلیک کنید</strong><small>PDF، DOCX یا TXT تا ۱۰ مگابایت</small></div><input type="file" hidden accept=".pdf,.docx,.txt" data-file-input></div>
            <div class="ais-file mt-2"><i class="bi bi-file-earmark-pdf-fill"></i><div><strong>${escapeHtml(seed.fileName)}</strong><small>${formatNumber(seed.words)} کلمه • ${escapeHtml(seed.readingTime)} مطالعه</small></div><span class="badge badge--soft-success ms-auto">پردازش شد</span></div>
            <label class="form-label mt-3">متن ورودی</label>
            <textarea class="form-control" name="text" rows="9" placeholder="متن خود را اینجا بچسبانید…">${escapeHtml(SUMMARY_SOURCE)}</textarea>
            <div class="row g-2 mt-1">
              <div class="col-4"><label class="form-label">تعداد نکات</label><select class="form-select form-select--sm" name="bullets"><option>3</option><option selected>4</option></select></div>
              <div class="col-4"><label class="form-label">سبک</label><select class="form-select form-select--sm" name="style"><option>فهرست نکات</option><option>پاراگراف</option><option>خلاصه اجرایی</option></select></div>
              <div class="col-4"><label class="form-label">زبان</label><select class="form-select form-select--sm" name="language"><option>فارسی</option><option>English</option></select></div>
            </div>
            <div class="d-flex gap-2 mt-3"><button class="btn btn-light" type="reset">پاک کردن</button><button class="aic-new" style="flex:1" type="submit" data-summarize><i class="bi bi-magic"></i> خلاصه کن</button></div>
          </form>
        </section>
        <div data-col="6" class="d-flex flex-column" style="gap:var(--nv-card-gap,1.25rem)">
          ${card({ title: 'خلاصه هوشمند', subtitle: 'تولیدشده با GPT-4o mini', icon: 'stars', actions: '<button class="btn btn-light btn-sm" type="button" data-copy-summary><i class="bi bi-clipboard"></i> کپی</button>', body: `<div data-summary-output>${summaryHtml(seed)}</div>` })}
          ${card({ title: 'کلیدواژه‌ها و موضوعات', icon: 'tags', body: `<div class="ais-chips" data-keypoints>${seed.keywords.map((k) => `<span class="ais-chip"><i class="bi bi-hash"></i>${escapeHtml(k)}</span>`).join('')}</div>
            <div class="mt-3">${[['مثبت', 62, 'success'], ['خنثی', 27, 'info'], ['منفی', 11, 'danger']].map(([label, value, tone]) => `<div class="ais-model__meter ais-tone--${tone} mb-2"><span style="width:48px">${label}</span><div class="ais-bar"><span style="width:${value}%"></span></div><strong>${pct(value, 0)}</strong></div>`).join('')}</div>` })}
          <div class="ais-kpis">
            ${kpi({ label: 'کلمات متن', value: `<span data-source-words>${formatNumber(words(SUMMARY_SOURCE))}</span>`, icon: 'file-text', tone: 'primary' })}
            ${kpi({ label: 'کلمات خلاصه', value: `<span data-summary-words>${formatNumber(words((seed.bullets ?? []).join(' ')))}</span>`, icon: 'text-paragraph', tone: 'violet' })}
            ${kpi({ label: 'فشرده‌سازی', value: `<span data-compression>${pct(Math.round((1 - words((seed.bullets ?? []).join(' ')) / words(SUMMARY_SOURCE)) * 100), 0)}</span>`, icon: 'arrows-angle-contract', tone: 'success' })}
          </div>
        </div>
      </div>
    </div>`,
  );

  const form = $('[data-summary-form]', node);
  const textarea = $('[name="text"]', form);
  on(textarea, 'input', () => { $('[data-source-words]', node).textContent = formatNumber(words(textarea.value)); });
  on($('[data-file-drop]', node), 'click', () => $('[data-file-input]', node).click());
  on($('[data-file-input]', node), 'change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = String(reader.result).slice(0, 8000);
      textarea.dispatchEvent(new Event('input'));
      toast.success('فایل بارگذاری شد', `${file.name} آماده خلاصه‌سازی است.`);
    };
    reader.readAsText(file);
  });
  on(node, 'click', async (event) => {
    const chip = event.target.closest('[data-source-pick] .ais-chip');
    if (chip) { $$('.ais-chip', chip.parentElement).forEach((c) => c.classList.toggle('is-active', c === chip)); return; }
    if (event.target.closest('[data-copy-summary]')) {
      await navigator.clipboard?.writeText($('[data-summary-output]', node).innerText).catch(() => {});
      toast.success('کپی شد', 'خلاصه در حافظه موقت قرار گرفت.');
    }
  });
  on(form, 'submit', async (event) => {
    event.preventDefault();
    if (!textarea.value.trim()) return toast.warning('متن خالی است', 'ابتدا متن یا فایلی برای خلاصه‌سازی وارد کنید.');
    const button = $('[data-summarize]', form);
    button.disabled = true;
    $('[data-summary-output]', node).innerHTML = '<div class="aic-typing"><span></span><span></span><span></span></div>';
    try {
      const values = collectValues(form);
      const result = await services.summarizerService.summarize({ text: values.text, bullets: Number(values.bullets) });
      render($('[data-summary-output]', node), summaryHtml(result));
      const summaryWords = words((result.bullets ?? []).join(' '));
      $('[data-summary-words]', node).textContent = formatNumber(summaryWords);
      $('[data-compression]', node).textContent = pct(Math.max(1, Math.round((1 - summaryWords / Math.max(1, words(values.text))) * 100)), 0);
      toast.success('خلاصه آماده شد', 'نکات کلیدی استخراج شد.');
    } finally {
      button.disabled = false;
    }
  });
}

/* ---------------------------------------------------------- repurposer page */

const REPURPOSE_SOURCE = 'فروشگاه‌های ایرانی با چالش مدیریت موجودی و هماهنگی کانال‌های فروش مواجه‌اند. یک پنل واحد که سفارش‌ها، انبار و گزارش‌ها را یکجا نشان دهد، زمان تصمیم‌گیری را تا ۴۰ درصد کاهش می‌دهد و خطای موجودی را تقریباً به صفر می‌رساند. نووا ادمین با داشبوردهای آماده، گزارش لحظه‌ای و دستیار هوش مصنوعی این مسیر را برای تیم‌ها ساده می‌کند.';

const REPURPOSE_TEXT = {
  linkedin: '🚀 مدیریت چندکاناله فروش دیگر نباید کابوس باشد.\n\nبیشتر فروشگاه‌های ایرانی هنوز موجودی را در چند فایل اکسل و چند پنل جداگانه دنبال می‌کنند. نتیجه؟ سفارش‌هایی که موجود نیستند و تصمیم‌هایی که دیر گرفته می‌شوند.\n\nبا یک پنل واحد:\n✅ زمان تصمیم‌گیری تا ۴۰٪ کمتر\n✅ خطای موجودی نزدیک به صفر\n✅ گزارش لحظه‌ای برای کل تیم\n\nشما چطور موجودی را مدیریت می‌کنید؟ 👇\n#تجارت_الکترونیک #مدیریت_موجودی',
  twitter: '۱/ فروشگاه اینترنتی دارید و موجودی را در ۳ جای مختلف چک می‌کنید؟ این رشته برای شماست 🧵\n\n۲/ مشکل اصلی: داده پراکنده = تصمیم دیر\n\n۳/ راه‌حل: یک داشبورد واحد برای سفارش، انبار و گزارش\n\n۴/ نتیجه: ۴۰٪ تصمیم‌گیری سریع‌تر و خطای موجودی ≈ صفر',
  newsletter: 'موضوع: راز فروشگاه‌هایی که هیچ‌وقت «ناموجود» نمی‌فروشند\n\nسلام دوست عزیز،\nاین هفته سراغ یکی از پرتکرارترین دردهای فروشگاه‌های آنلاین رفتیم: هماهنگی موجودی بین کانال‌ها. در ادامه سه قدم ساده برای یکپارچه‌سازی داده‌ها و کاهش ۴۰ درصدی زمان تصمیم‌گیری را می‌خوانید…',
  instagram: 'دیگه لازم نیست بین ۵ تا پنل جابه‌جا بشی 😮‍💨\nسفارش‌ها، انبار و گزارش‌ها همه یه‌جا 📊\n⏱ ۴۰٪ تصمیم سریع‌تر\n📦 خطای موجودی ≈ صفر\nلینک دمو در بیو 💜\n#فروشگاه_اینترنتی #کسب_و_کار',
  script: '[صحنه ۱ — ۰ تا ۵ ثانیه] نمای نزدیک از چند پنجره شلوغ اکسل. صداگذار: «هنوز موجودی رو دستی چک می‌کنی؟»\n[صحنه ۲ — ۵ تا ۲۰ ثانیه] انتقال به داشبورد نووا با نمودارهای زنده.\n[صحنه ۳ — ۲۰ تا ۴۰ ثانیه] نمایش هشدار موجودی و گزارش لحظه‌ای.\n[پایان] «نووا ادمین — همه‌چیز در یک نگاه.»',
  faq: 'پرسش: چرا به یک پنل واحد نیاز داریم؟\nپاسخ: چون داده پراکنده سرعت تصمیم را کم و خطای موجودی را زیاد می‌کند.\n\nپرسش: چقدر در زمان صرفه‌جویی می‌شود؟\nپاسخ: به‌طور میانگین ۴۰ درصد در زمان تصمیم‌گیری.\n\nپرسش: آیا دستیار هوش مصنوعی هم دارد؟\nپاسخ: بله، برای تحلیل و گزارش‌گیری خودکار.',
};

async function aiRepurposer() {
  const node = host();
  const formats = rows(await services.repurposeService.formats());
  const tones = { linkedin: 'info', twitter: 'neutral', newsletter: 'primary', instagram: 'danger', script: 'warning', faq: 'success' };
  const outputCard = (f) => `<article class="ais-out ais-tone--${tones[f.id] ?? 'primary'}" data-out="${escapeHtml(f.id)}">
    <header><span class="ais-name__icon"><i class="bi bi-${escapeHtml(f.icon)}"></i></span><div><strong>${escapeHtml(f.label)}</strong><small>${escapeHtml(f.length)} • ${toDigits(Math.round((REPURPOSE_TEXT[f.id] ?? '').length / 4))} توکن</small></div>
      <div class="ms-auto d-flex gap-1"><button class="icon-btn icon-btn--sm" type="button" data-copy-out title="کپی"><i class="bi bi-clipboard"></i></button><button class="icon-btn icon-btn--sm" type="button" data-regen-out title="تولید دوباره"><i class="bi bi-arrow-repeat"></i></button></div></header>
    <div class="ais-out__text">${escapeHtml(REPURPOSE_TEXT[f.id] ?? '').replace(/\n/g, '<br>')}</div>
  </article>`;
  const initial = formats.filter((f) => ['linkedin', 'instagram', 'twitter'].includes(f.id));
  render(
    node,
    `<div class="ais">
      <div class="ais-grid">
        <section data-col="5" class="card">
          <header class="card__head"><span class="card__icon"><i class="bi bi-file-text"></i></span><div><h2 class="card__title">متن پایه</h2><p class="card__subtitle">یک بار بنویسید، در همه کانال‌ها منتشر کنید</p></div></header>
          <form class="card__body" data-repurpose-form>
            <textarea class="form-control" rows="8" name="text" placeholder="متن منبع را بچسبانید…">${escapeHtml(REPURPOSE_SOURCE)}</textarea>
            <label class="form-label mt-3">قالب‌های خروجی</label>
            <div class="ais-style-grid" data-format-pick>${formats.map((f) => `<button type="button" class="ais-style ais-tone--${tones[f.id] ?? 'primary'} ${initial.includes(f) ? 'is-active' : ''}" data-format="${escapeHtml(f.id)}"><i class="bi bi-${escapeHtml(f.icon)}"></i><span>${escapeHtml(f.label)}</span></button>`).join('')}</div>
            <div class="row g-2 mt-2"><div class="col-6"><label class="form-label">لحن</label><select class="form-select form-select--sm"><option>متناسب با کانال</option><option>رسمی</option><option>صمیمی</option></select></div><div class="col-6"><label class="form-label">ایموجی</label><select class="form-select form-select--sm"><option>متعادل</option><option>زیاد</option><option>بدون ایموجی</option></select></div></div>
            <button class="aic-new mt-3" type="submit" data-convert><i class="bi bi-shuffle"></i> بازتولید در <span data-format-count>${toDigits(initial.length)}</span> قالب</button>
          </form>
        </section>
        <section data-col="7" class="card">
          <header class="card__head"><span class="card__icon"><i class="bi bi-collection"></i></span><div><h2 class="card__title">خروجی‌ها</h2><p class="card__subtitle">آماده انتشار — قابل ویرایش و کپی</p></div></header>
          <div class="card__body"><div class="ais-outs" data-repurpose-output>${initial.map(outputCard).join('')}</div></div>
        </section>
      </div>
    </div>`,
  );
  const selected = () => $$('[data-format-pick] .is-active', node).map((b) => b.dataset.format);
  on(node, 'click', async (event) => {
    const t = event.target;
    const fmt = t.closest('[data-format]');
    if (fmt) {
      fmt.classList.toggle('is-active');
      $('[data-format-count]', node).textContent = toDigits(selected().length);
      return;
    }
    const out = t.closest('[data-out]');
    if (out && t.closest('[data-copy-out]')) {
      await navigator.clipboard?.writeText($('.ais-out__text', out).innerText).catch(() => {});
      return toast.success('کپی شد', 'خروجی در حافظه موقت قرار گرفت.');
    }
    if (out && t.closest('[data-regen-out]')) {
      out.classList.add('is-busy');
      await services.repurposeService.convert({ text: '', format: out.dataset.out });
      out.classList.remove('is-busy');
      return toast.success('نسخه جدید آماده شد', 'خروجی بازتولید شد.');
    }
  });
  on($('[data-repurpose-form]', node), 'submit', async (event) => {
    event.preventDefault();
    const chosen = selected();
    if (!chosen.length) return toast.warning('قالبی انتخاب نشده', 'حداقل یک قالب خروجی انتخاب کنید.');
    const button = $('[data-convert]', node);
    button.disabled = true;
    const output = $('[data-repurpose-output]', node);
    output.innerHTML = chosen.map(() => '<div class="ais-out is-busy" style="min-height:120px"></div>').join('');
    try {
      await Promise.all(chosen.map((format) => services.repurposeService.convert({ text: event.currentTarget?.text?.value ?? '', format })));
      output.innerHTML = formats.filter((f) => chosen.includes(f.id)).map(outputCard).join('');
      toast.success('بازتولید انجام شد', `${toDigits(chosen.length)} قالب ساخته شد.`);
    } finally {
      button.disabled = false;
    }
  });
}

/* -------------------------------------------------------------- image studio */

const IMAGE_STYLES = [
  ['camera', 'عکاسی', 'primary'],
  ['box', 'سه‌بعدی', 'violet'],
  ['brush', 'تصویرسازی', 'danger'],
  ['megaphone', 'تبلیغاتی', 'warning'],
  ['vector-pen', 'خطی', 'info'],
  ['square', 'مینیمال', 'success'],
];
const RATIOS = [['1024×1024', '۱:۱', 'square'], ['1792×1024', '۱۶:۹', 'rectangle'], ['1024×1792', '۹:۱۶', 'phone']];

function imageTile(image) {
  return `<figure class="ais-shot" data-image="${escapeHtml(image.id)}" data-style="${escapeHtml(image.style ?? '')}">
    <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.prompt ?? '')}" loading="lazy">
    <div class="ais-shot__top"><span class="ais-shot__badge">${escapeHtml(image.style ?? 'AI')}</span><button type="button" class="ais-shot__fav" data-fav-image aria-label="علاقه‌مندی"><i class="bi bi-heart${image.favorite ? '-fill' : ''}"></i></button></div>
    <figcaption class="ais-shot__cap">
      <p>${escapeHtml(image.prompt ?? '')}</p>
      <div class="ais-shot__meta"><span>${escapeHtml(image.model ?? '')} • ${toDigits(image.size ?? '')}</span>
        <span class="ais-shot__actions">
          <button type="button" data-view-image title="نمایش"><i class="bi bi-arrows-fullscreen"></i></button>
          <a href="${escapeHtml(image.url)}" download title="دانلود"><i class="bi bi-download"></i></a>
          <button type="button" data-variation title="نسخه مشابه"><i class="bi bi-shuffle"></i></button>
          <button type="button" data-delete-image="${escapeHtml(image.id)}" title="حذف"><i class="bi bi-trash3"></i></button>
        </span></div>
    </figcaption>
  </figure>`;
}

async function aiImages() {
  const node = host();
  const history = rows(await services.imageStudioService.list());
  const images = [...history];
  render(
    node,
    `<div class="ais">
      <div class="ais-grid">
        <section data-col="4" class="card ais-studio-form">
          <header class="card__head"><span class="card__icon"><i class="bi bi-magic"></i></span><div><h2 class="card__title">ساخت تصویر جدید</h2><p class="card__subtitle">ایده‌تان را توصیف کنید؛ هوش مصنوعی آن را می‌سازد</p></div></header>
          <form class="card__body" data-image-form novalidate>
            <label class="form-label">توضیح تصویر</label>
            <textarea class="form-control" name="prompt" rows="4" required placeholder="مثلاً: عکس محصول ساعت هوشمند روی سنگ مرمر با نور طلایی غروب"></textarea>
            <div class="ais-chips mt-2" data-prompt-ideas>${['بنر حراج نوروزی', 'آیکون سه‌بعدی سبد خرید', 'پس‌زمینه انتزاعی بنفش'].map((t) => `<button type="button" class="ais-chip" data-idea="${t}"><i class="bi bi-lightbulb"></i> ${t}</button>`).join('')}</div>
            <label class="form-label mt-3">سبک</label>
            <div class="ais-style-grid" data-style-pick>${IMAGE_STYLES.map(([icon, label, tone], i) => `<button type="button" class="ais-style ais-tone--${tone} ${i === 0 ? 'is-active' : ''}" data-style="${label}"><i class="bi bi-${icon}"></i><span>${label}</span></button>`).join('')}</div>
            <label class="form-label mt-3">نسبت تصویر</label>
            <div class="ais-chips" data-ratio-pick>${RATIOS.map(([value, label, icon], i) => `<button type="button" class="ais-chip ${i === 0 ? 'is-active' : ''}" data-ratio="${value}"><i class="bi bi-${icon}"></i> ${label}</button>`).join('')}</div>
            <div class="row g-2 mt-2">
              <div class="col-7"><label class="form-label">مدل</label><select class="form-select form-select--sm" name="model"><option>GPT-4o</option><option>DALL·E 3</option><option>Stable Diffusion XL</option><option>Midjourney v6</option></select></div>
              <div class="col-5"><label class="form-label">تعداد</label><select class="form-select form-select--sm" name="count"><option>1</option><option selected>2</option><option>4</option></select></div>
            </div>
            <label class="aic-range mt-3"><span class="aic-range__row"><span>کیفیت / جزئیات</span><b data-q-out>۷۵</b></span><input type="range" min="10" max="100" value="75" name="quality" data-q></label>
            <button class="aic-new mt-2" type="submit" data-generate-image><i class="bi bi-stars"></i> تولید تصویر <small style="opacity:.8">(~۴۰ اعتبار)</small></button>
          </form>
        </section>
        <section data-col="8" class="card">
          <header class="card__head"><span class="card__icon"><i class="bi bi-images"></i></span><div><h2 class="card__title">گالری من</h2><p class="card__subtitle"><span data-image-count>${toDigits(images.length)}</span> تصویر تولیدشده</p></div>
            <div class="card__actions ais-chips" data-gallery-filter><button type="button" class="ais-chip is-active" data-gf="">همه</button>${[...new Set(images.map((i) => i.style))].map((st) => `<button type="button" class="ais-chip" data-gf="${escapeHtml(st)}">${escapeHtml(st)}</button>`).join('')}</div></header>
          <div class="card__body"><div class="ais-gallery" data-image-gallery>${images.map(imageTile).join('')}</div></div>
        </section>
      </div>
    </div>`,
  );

  const form = $('[data-image-form]', node);
  const gallery = $('[data-image-gallery]', node);
  const pick = (group, attr) => $(`[${group}] .is-active`, node)?.dataset[attr];
  const count = () => { $('[data-image-count]', node).textContent = toDigits($$('[data-image]', gallery).length); };

  on($('[data-q]', node), 'input', (e) => { $('[data-q-out]', node).textContent = toDigits(e.target.value); });
  on(form, 'submit', async (event) => {
    event.preventDefault();
    const prompt = form.prompt.value.trim();
    if (!prompt) {
      form.prompt.classList.add('is-invalid');
      form.prompt.focus();
      return toast.warning?.('توضیح تصویر لازم است', 'ابتدا تصویری که می‌خواهید را توصیف کنید.') ?? toast.info('توضیح تصویر لازم است', 'ابتدا تصویر را توصیف کنید.');
    }
    form.prompt.classList.remove('is-invalid');
    const button = $('[data-generate-image]', form);
    button.disabled = true;
    const n = Number(form.count.value || 1);
    gallery.insertAdjacentHTML('afterbegin', Array.from({ length: n }, () => '<figure class="ais-shot is-loading"><div class="ais-shot__loader"><span class="aic-orb"><i class="bi bi-stars"></i></span><small>در حال ساخت…</small></div></figure>').join(''));
    try {
      const style = pick('data-style-pick', 'style');
      const size = pick('data-ratio-pick', 'ratio');
      const results = await Promise.all(Array.from({ length: n }, () => services.imageStudioService.generate({ prompt, size })));
      $$('.ais-shot.is-loading', gallery).forEach((el) => el.remove());
      gallery.insertAdjacentHTML('afterbegin', results.map((image) => imageTile({ ...image, style, model: form.model.value, size })).join(''));
      images.unshift(...results.map((image) => ({ ...image, style, size })));
      count();
      toast.success('تصویر تولید شد', `${toDigits(results.length)} تصویر به گالری افزوده شد.`);
    } finally {
      button.disabled = false;
    }
  });

  on(node, 'click', async (event) => {
    const t = event.target;
    const idea = t.closest('[data-idea]');
    if (idea) { form.prompt.value = idea.dataset.idea; form.prompt.focus(); return; }
    const choose = t.closest('[data-style-pick] [data-style], [data-ratio-pick] [data-ratio]');
    if (choose) { $$('button', choose.parentElement).forEach((b) => b.classList.toggle('is-active', b === choose)); return; }
    const gf = t.closest('[data-gf]');
    if (gf) {
      $$('[data-gf]', node).forEach((b) => b.classList.toggle('is-active', b === gf));
      $$('[data-image]', gallery).forEach((el) => { el.hidden = gf.dataset.gf ? el.dataset.style !== gf.dataset.gf : false; });
      return;
    }
    const tile = t.closest('[data-image]');
    if (!tile) return;
    if (t.closest('[data-fav-image]')) {
      const icon = $('[data-fav-image] i', tile);
      const next = !icon.classList.contains('bi-heart-fill');
      icon.className = `bi bi-heart${next ? '-fill' : ''}`;
      return toast.success(next ? 'به علاقه‌مندی‌ها افزوده شد' : 'از علاقه‌مندی‌ها حذف شد', 'گالری به‌روزرسانی شد.');
    }
    if (t.closest('[data-variation]')) {
      form.prompt.value = $('p', tile).textContent;
      return form.requestSubmit();
    }
    if (t.closest('[data-delete-image]')) {
      const ok = await modal.confirm({ title: 'حذف تصویر', text: 'تصویر از گالری حذف می‌شود.', tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.imageStudioService.remove(t.closest('[data-delete-image]').dataset.deleteImage);
      tile.remove();
      count();
      return toast.success('حذف شد', 'تصویر از گالری برداشته شد.');
    }
    if (t.closest('[data-view-image]') || t.tagName === 'IMG') {
      const src = $('img', tile).getAttribute('src');
      modal.open({
        title: 'نمایش تصویر',
        subtitle: $('p', tile).textContent,
        size: 'lg',
        content: `<img src="${escapeHtml(src)}" alt="" style="width:100%;border-radius:1rem;display:block">`,
        footer: `<button type="button" class="btn btn-light" data-modal-close>بستن</button><a class="btn btn-primary" href="${escapeHtml(src)}" download><i class="bi bi-download"></i> دانلود</a>`,
      });
    }
  });
}

/* ------------------------------------------------------------- AI dashboard */

async function aiDashboard() {
  const node = host();
  render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);
  const [usage, conversationsRaw, jobsRaw] = await Promise.all([
    services.usageService.overview(),
    services.conversationService.list(),
    services.schedulerService.list({ perPage: 8 }),
  ]);
  const conversations = rows(conversationsRaw);
  const jobs = rows(jobsRaw);
  const s = usage.series;
  const last14 = (arr) => arr.slice(-14);
  const featureMax = Math.max(...usage.byFeature.map((f) => f.requests));
  const models = [...usage.byModel].sort((a, b) => b.requests - a.requests);

  render(
    node,
    `<div class="ais">
      <section class="ais-hero">
        <div>
          <span class="ais-hero__eyebrow"><i class="bi bi-stars"></i> کارگاه هوش مصنوعی نووا</span>
          <h2 class="ais-hero__title">سلام سارا 👋 دستیارهای هوشمند امروز ${formatNumber(usage.daily.at(-1).requests)} درخواست را پاسخ دادند</h2>
          <p class="ais-hero__text">این ماه هوش مصنوعی حدود <strong>${toDigits(usage.savedHours)}</strong> ساعت از کار تیم را خودکار کرده است. رضایت کاربران از پاسخ‌ها ${pct(usage.satisfaction)} و میانگین زمان پاسخ ${toDigits(usage.avgLatency)} میلی‌ثانیه بوده است.</p>
          <div class="ais-hero__actions">
            <a class="btn-hero btn-hero--solid" href="ai/chat.html"><i class="bi bi-chat-square-dots"></i> گفتگوی جدید</a>
            <a class="btn-hero" href="ai/writer.html"><i class="bi bi-pencil-square"></i> نوشتن محتوا</a>
            <a class="btn-hero" href="ai/images.html"><i class="bi bi-image"></i> تولید تصویر</a>
          </div>
        </div>
        <div class="ais-hero__meter">
          <div class="ais-hero__meter-head"><span>اعتبار مصرف‌شده این دوره</span><span>تمدید تا ${toDigits(usage.credit.resetIn)} روز دیگر</span></div>
          <div class="ais-hero__meter-value">${money(usage.credit.used)} <small style="font-size:.8rem;opacity:.75">از ${money(usage.credit.limit)}</small></div>
          <div class="ais-hero__bar"><span style="width:${usage.credit.percent}%"></span></div>
          <div class="ais-hero__mini">
            <div><small>درخواست‌ها</small><strong>${compact(usage.requests)}</strong></div>
            <div><small>توکن‌ها</small><strong>${compact(usage.tokens)}</strong></div>
            <div><small>نرخ خطا</small><strong>${pct(usage.errorRate, 2)}</strong></div>
          </div>
        </div>
      </section>

      <div class="ais-kpis">
        ${kpi({ label: 'درخواست‌های ۳۰ روز', value: compact(usage.requests), icon: 'lightning-charge', tone: 'primary', delta: usage.growth.requests, meta: 'نسبت به دوره قبل', spark: 'k1' })}
        ${kpi({ label: 'توکن مصرفی', value: compact(usage.tokens), icon: 'cpu', tone: 'violet', delta: usage.growth.tokens, meta: 'ورودی + خروجی', spark: 'k2' })}
        ${kpi({ label: 'هزینه ماه', value: money(usage.cost), icon: 'wallet2', tone: 'warning', delta: usage.growth.cost, meta: 'ریال', spark: 'k3' })}
        ${kpi({ label: 'گفتگوهای فعال', value: toDigits(conversations.length), icon: 'chat-dots', tone: 'info', delta: 12.4, meta: `${toDigits(conversations.filter((c) => c.pinned).length)} سنجاق‌شده`, spark: 'k4' })}
        ${kpi({ label: 'رضایت کاربران', value: pct(usage.satisfaction), icon: 'emoji-smile', tone: 'success', delta: 2.1, meta: 'بر اساس بازخوردها', spark: 'k5' })}
      </div>

      <div class="ais-grid">
        ${card({ title: 'روند درخواست و توکن', subtitle: '۳۰ روز اخیر — توکن به هزار', icon: 'graph-up-arrow', body: slot('trend', 330), actions: '<a class="btn btn-light btn-sm" href="ai/usage.html">گزارش کامل</a>' }).replace('<section class="card', '<section data-col="8" class="card')}
        ${card({ title: 'سهم مدل‌ها', subtitle: 'بر اساس تعداد درخواست', icon: 'pie-chart', body: slot('models', 330) }).replace('<section class="card', '<section data-col="4" class="card')}
      </div>

      <div class="ais-grid">
        ${card({
          title: 'ابزارهای پرکاربرد',
          subtitle: 'تعداد درخواست هر ابزار',
          icon: 'grid-1x2',
          body: usage.byFeature
            .map(
              (f) => `<a class="ais-feature ais-feature--${f.tone}" href="${f.href}"><span class="ais-feature__icon"><i class="bi bi-${f.icon}"></i></span>
                <span class="ais-feature__body"><span class="ais-feature__row"><span class="ais-feature__name">${f.label}</span><span class="ais-feature__num">${formatNumber(f.requests)} درخواست</span></span>
                <span class="ais-bar"><span style="width:${Math.round((f.requests / featureMax) * 100)}%"></span></span></span></a>`,
            )
            .join(''),
        }).replace('<section class="card', '<section data-col="4" class="card')}
        ${card({ title: 'ساعات اوج استفاده', subtitle: 'بار نسبی در روزهای هفته', icon: 'calendar3-week', body: slot('heat', 300) }).replace('<section class="card', '<section data-col="5" class="card')}
        ${card({ title: 'هشدارها و پیشنهادها', icon: 'bell', body: usage.alerts.map((a) => `<div class="ais-alert ais-alert--${a.tone}"><i class="bi bi-${a.icon}"></i><div><strong>${a.title}</strong><p>${a.text}</p></div></div>`).join('') }).replace('<section class="card', '<section data-col="3" class="card')}
      </div>

      <div class="ais-grid">
        ${card({
          title: 'عملکرد مدل‌ها',
          subtitle: 'درخواست، هزینه، تأخیر و رضایت',
          icon: 'cpu',
          flush: true,
          actions: '<a class="btn btn-light btn-sm" href="ai/models.html">مدیریت مدل‌ها</a>',
          body: `<div class="ais-table-wrap"><table class="ais-table"><thead><tr><th>مدل</th><th>درخواست</th><th>هزینه</th><th>تأخیر</th><th>رضایت</th><th>روند</th></tr></thead><tbody>${models
            .slice(0, 6)
            .map(
              (m) => `<tr><td><div class="ais-name ais-tone--${m.tone}"><span class="ais-name__icon"><i class="bi bi-cpu"></i></span><div><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.vendor)}</small></div></div></td>
              <td class="num">${formatNumber(m.requests)}</td><td class="num">${money(m.cost)}</td><td class="num">${toDigits(m.latency)}ms</td>
              <td><div class="d-flex align-items-center gap-2"><div class="ais-bar ais-tone--success" style="width:70px;margin:0"><span style="width:${m.satisfaction}%"></span></div><span class="num">${pct(m.satisfaction, 0)}</span></div></td>
              <td>${trend(m.trend)}</td></tr>`,
            )
            .join('')}</tbody></table></div>`,
        }).replace('<section class="card', '<section data-col="8" class="card')}
        ${card({ title: 'فعالیت‌های اخیر', icon: 'activity', body: `<ul class="ais-feed">${usage.activity.map((a) => `<li class="is-${a.tone}"><span class="ais-feed__icon"><i class="bi bi-${a.icon}"></i></span><div><div class="ais-feed__title">${a.title}</div><div class="ais-feed__meta">${a.meta} • ${relativeTime(a.at)}</div></div></li>`).join('')}</ul>` }).replace('<section class="card', '<section data-col="4" class="card')}
      </div>

      <div class="ais-grid">
        ${card({
          title: 'گفتگوهای اخیر',
          icon: 'chat-square-text',
          actions: '<a class="btn btn-light btn-sm" href="ai/history.html">همه</a>',
          body: conversations
            .slice(0, 5)
            .map((c) => `<a class="ais-person" href="ai/chat.html" style="text-decoration:none;color:inherit"><span class="ais-name__icon"><i class="bi bi-chat-square-text"></i></span><span class="ais-person__body"><span class="ais-person__name d-block">${escapeHtml(c.title)}</span><span class="ais-person__sub d-block">${escapeHtml(c.model)} • ${toDigits(c.messages)} پیام • ${relativeTime(c.updatedAt)}</span></span><span class="ais-person__num">${compact(c.tokens)}</span></a>`)
            .join(''),
        }).replace('<section class="card', '<section data-col="4" class="card')}
        ${card({
          title: 'پرمصرف‌ترین اعضای تیم',
          icon: 'people',
          body: usage.team
            .slice(0, 5)
            .map((p) => `<div class="ais-person"><img src="${escapeHtml(p.avatar)}" alt=""><span class="ais-person__body"><span class="ais-person__name d-block">${escapeHtml(p.name)}</span><span class="ais-person__sub d-block">${escapeHtml(p.favourite)} • ${formatNumber(p.requests)} درخواست</span></span><span class="ais-person__num">${compact(p.tokens)}</span></div>`)
            .join(''),
        }).replace('<section class="card', '<section data-col="4" class="card')}
        ${card({
          title: 'کارهای خودکار',
          icon: 'clock-history',
          actions: '<a class="btn btn-light btn-sm" href="ai/scheduler.html">زمان‌بند</a>',
          body: jobs
            .slice(0, 5)
            .map((j) => `<div class="ais-person"><span class="ais-name__icon ais-tone--${j.status === 'paused' ? 'warning' : 'success'}"><i class="bi bi-${j.status === 'paused' ? 'pause-circle' : 'play-circle'}"></i></span><span class="ais-person__body"><span class="ais-person__name d-block">${escapeHtml(j.name)}</span><span class="ais-person__sub d-block">${escapeHtml(j.cron)} • ${escapeHtml(j.model)}</span></span><span class="badge badge--soft-${j.status === 'paused' ? 'warning' : 'success'}">${j.status === 'paused' ? 'متوقف' : 'فعال'}</span></div>`)
            .join(''),
        }).replace('<section class="card', '<section data-col="4" class="card')}
      </div>
    </div>`,
  );

  await drawCharts(node, {
    k1: sparkOptions(last14(s.requests), '#6366f1'),
    k2: sparkOptions(last14(s.tokens), '#8b5cf6'),
    k3: sparkOptions(last14(s.cost), '#f59e0b'),
    k4: sparkOptions([4, 6, 5, 8, 7, 9, 8, 11, 10, 12, 11, 13, 12, 14], '#0ea5e9'),
    k5: sparkOptions([91, 92, 92, 93, 92, 94, 93, 94, 95, 94, 95, 94, 95, 95], '#10b981'),
    trend: {
      type: 'area',
      height: 330,
      mixed: true,
      labels: usage.labels,
      series: [
        { name: 'درخواست‌ها', type: 'column', data: s.requests },
        { name: 'توکن (هزار)', type: 'area', data: s.tokens.map((v) => Math.round(v / 1000)) },
      ],
      colors: ['#c7d2fe', '#7c3aed'],
    },
    models: { type: 'donut', height: 330, series: models.map((m) => m.requests), labels: models.map((m) => m.label) },
    heat: { type: 'heatmap', height: 300, series: usage.heatmap },
  });
  exportable(node, 'usage');
}

/* -------------------------------------------------------------- usage page */

async function aiUsage() {
  const node = host();
  render(node, `<div class="dashboard-shell">${kit.skeleton(4, 'card')}</div>`);
  const usage = await services.usageService.overview();
  const s = usage.series;
  const models = [...usage.byModel].sort((a, b) => b.tokens - a.tokens);
  const totalModelTokens = models.reduce((sum, m) => sum + m.tokens, 0);
  const totalModelCost = models.reduce((sum, m) => sum + m.cost, 0);

  render(
    node,
    `<div class="ais">
      <div class="ais-toolbar">
        <div class="ais-chips" data-range>${['۷ روز', '۳۰ روز', '۹۰ روز', 'امسال'].map((label, i) => `<button type="button" class="ais-chip ${i === 1 ? 'is-active' : ''}">${label}</button>`).join('')}</div>
        <select class="form-select form-select--sm" style="width:auto"><option>همه مدل‌ها</option>${models.map((m) => `<option>${escapeHtml(m.label)}</option>`).join('')}</select>
        <select class="form-select form-select--sm" style="width:auto"><option>همه پروژه‌ها</option><option>فروشگاه</option><option>پشتیبانی</option><option>بازاریابی</option></select>
        <div class="ms-auto d-flex gap-2">${toolButtons({ exportResource: 'usage' })}</div>
      </div>

      <div class="ais-kpis">
        ${kpi({ label: 'کل توکن', value: compact(usage.tokens), icon: 'hash', tone: 'primary', delta: usage.growth.tokens, meta: 'در ۳۰ روز', spark: 'u1' })}
        ${kpi({ label: 'هزینه ماه', value: money(usage.cost), icon: 'cash-coin', tone: 'warning', delta: usage.growth.cost, meta: 'پیش‌بینی پایان ماه: ' + money(usage.cost * 1.18), spark: 'u2' })}
        ${kpi({ label: 'درخواست‌ها', value: compact(usage.requests), icon: 'arrow-repeat', tone: 'info', delta: usage.growth.requests, meta: 'میانگین روزانه ' + compact(usage.requests / 30), spark: 'u3' })}
        ${kpi({ label: 'نرخ خطا', value: pct(usage.errorRate, 2), icon: 'exclamation-octagon', tone: 'danger', delta: usage.growth.errors, meta: toDigits(usage.errors) + ' خطا', spark: 'u4' })}
      </div>

      <div class="ais-grid">
        ${card({ title: 'روند مصرف توکن', subtitle: 'توکن روزانه (هزار) و هزینه (میلیون ریال)', icon: 'graph-up', body: slot('tokens', 340) }).replace('<section class="card', '<section data-col="8" class="card')}
        ${card({
          title: 'سهمیه ماهانه',
          icon: 'speedometer2',
          body: `${slot('quota', 250)}${infoRows([
            ['مصرف‌شده', money(usage.credit.used)],
            ['سقف دوره', money(usage.credit.limit)],
            ['باقی‌مانده', money(usage.credit.limit - usage.credit.used)],
            ['تمدید', `${toDigits(usage.credit.resetIn)} روز دیگر`],
          ])}`,
        }).replace('<section class="card', '<section data-col="4" class="card')}
      </div>

      <div class="ais-grid">
        ${card({ title: 'هزینه به تفکیک مدل', subtitle: 'میلیون ریال', icon: 'bar-chart', body: slot('costModel', 320) }).replace('<section class="card', '<section data-col="6" class="card')}
        ${card({ title: 'تأخیر پاسخ و خطا', subtitle: 'میلی‌ثانیه / تعداد خطا', icon: 'stopwatch', body: slot('latency', 320) }).replace('<section class="card', '<section data-col="6" class="card')}
      </div>

      ${card({
        title: 'تفکیک مصرف مدل‌ها',
        subtitle: `${toDigits(models.length)} مدل • مجموع ${compact(totalModelTokens)} توکن`,
        icon: 'table',
        flush: true,
        body: `<div class="ais-table-wrap"><table class="ais-table"><thead><tr><th>مدل</th><th>درخواست</th><th>توکن</th><th>هزینه</th><th>تأخیر میانگین</th><th>نرخ خطا</th><th style="min-width:160px">سهم از هزینه</th></tr></thead><tbody>${models
          .map((m) => {
            const share = Math.round((m.cost / Math.max(1, totalModelCost)) * 100);
            return `<tr><td><div class="ais-name ais-tone--${m.tone}"><span class="ais-name__icon"><i class="bi bi-cpu"></i></span><div><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.vendor)}</small></div></div></td>
              <td class="num">${formatNumber(m.requests)}</td><td class="num">${compact(m.tokens)}</td><td class="num">${money(m.cost)}</td><td class="num">${toDigits(m.latency)}ms</td>
              <td><span class="badge badge--soft-${m.errors > 1.5 ? 'danger' : m.errors > 0.8 ? 'warning' : 'success'}">${pct(m.errors, 2)}</span></td>
              <td><div class="d-flex align-items-center gap-2"><div class="ais-bar ais-tone--${m.tone}" style="flex:1;margin:0"><span style="width:${share}%"></span></div><span class="num">${pct(share, 0)}</span></div></td></tr>`;
          })
          .join('')}</tbody></table></div>`,
      })}

      <div class="ais-grid">
        ${card({
          title: 'مصرف اعضای تیم',
          icon: 'people',
          flush: true,
          body: `<div class="ais-table-wrap"><table class="ais-table"><thead><tr><th>عضو</th><th>ابزار محبوب</th><th>درخواست</th><th>توکن</th><th style="min-width:140px">سهمیه شخصی</th></tr></thead><tbody>${usage.team
            .map((p) => `<tr><td><div class="ais-person" style="padding:0"><img src="${escapeHtml(p.avatar)}" alt=""><span class="ais-person__body"><span class="ais-person__name d-block">${escapeHtml(p.name)}</span><span class="ais-person__sub d-block">${escapeHtml(p.role)}</span></span></div></td><td>${escapeHtml(p.favourite)}</td><td class="num">${formatNumber(p.requests)}</td><td class="num">${compact(p.tokens)}</td>
              <td><div class="d-flex align-items-center gap-2"><div class="ais-bar ais-tone--${p.quota > 85 ? 'danger' : p.quota > 60 ? 'warning' : 'success'}" style="flex:1;margin:0"><span style="width:${p.quota}%"></span></div><span class="num">${pct(p.quota, 0)}</span></div></td></tr>`)
            .join('')}</tbody></table></div>`,
        }).replace('<section class="card', '<section data-col="7" class="card')}
        ${card({ title: 'مصرف ابزارها', subtitle: 'توکن (میلیون)', icon: 'grid-1x2', body: slot('features', 330) }).replace('<section class="card', '<section data-col="5" class="card')}
      </div>
    </div>`,
  );

  const spark = (arr) => arr.slice(-14);
  await drawCharts(node, {
    u1: sparkOptions(spark(s.tokens), '#6366f1'),
    u2: sparkOptions(spark(s.cost), '#f59e0b'),
    u3: sparkOptions(spark(s.requests), '#0ea5e9'),
    u4: sparkOptions(spark(s.errors), '#ef4444'),
    tokens: {
      type: 'area',
      height: 340,
      mixed: true,
      labels: usage.labels,
      series: [
        { name: 'توکن (هزار)', type: 'area', data: s.tokens.map((v) => Math.round(v / 1000)) },
        { name: 'هزینه (میلیون ریال)', type: 'line', data: s.cost },
      ],
      colors: ['#6366f1', '#f59e0b'],
    },
    quota: { type: 'radialBar', height: 250, series: [usage.credit.percent], labels: ['مصرف اعتبار'], colors: ['#8b5cf6'] },
    costModel: { type: 'bar', height: 320, series: [{ name: 'هزینه (میلیون ریال)', data: models.map((m) => Math.round(m.cost / 1_000_000)) }], labels: models.map((m) => m.label), colors: ['#8b5cf6'] },
    latency: {
      type: 'line',
      height: 320,
      mixed: true,
      labels: usage.labels,
      series: [
        { name: 'تأخیر (ms)', type: 'line', data: s.latency },
        { name: 'خطا', type: 'column', data: s.errors },
      ],
      colors: ['#0ea5e9', '#fca5a5'],
    },
    features: { type: 'donut', height: 330, series: usage.byFeature.map((f) => Math.round(f.tokens / 1_000_000)), labels: usage.byFeature.map((f) => f.label) },
  });
  on($('[data-range]', node), 'click', (event) => {
    const chip = event.target.closest('.ais-chip');
    if (!chip) return;
    $$('.ais-chip', chip.parentElement).forEach((c) => c.classList.toggle('is-active', c === chip));
    toast.info('بازه گزارش', `داده‌ها برای «${chip.textContent.trim()}» نمایش داده می‌شود.`);
  });
  exportable(node, 'usage');
}

/* ---------------------------------------------------------------- scheduler */

function jobCard(job) {
  const paused = job.status === 'paused';
  return `<article class="ais-job ${paused ? 'is-paused' : ''}" data-job="${escapeHtml(job.id)}">
    <span class="ais-job__icon"><i class="bi bi-${paused ? 'pause-fill' : 'lightning-charge-fill'}"></i></span>
    <div style="min-width:0">
      <div class="ais-job__title">${escapeHtml(job.name)}</div>
      <div class="ais-job__meta">
        <span><i class="bi bi-calendar-event"></i>${escapeHtml(job.cron ?? '')}</span>
        <span><i class="bi bi-cpu"></i>${escapeHtml(job.model ?? '')}</span>
        <span><i class="bi bi-arrow-repeat"></i>${toDigits(job.runs ?? 0)} اجرا</span>
        <span><i class="bi bi-hash"></i>${compact(job.tokensPerRun ?? 0)} توکن در هر اجرا</span>
        <span><i class="bi bi-clock"></i>آخرین اجرا ${job.lastRun ? relativeTime(job.lastRun) : '—'}</span>
      </div>
    </div>
    <div class="ais-job__actions">
      <span class="badge badge--soft-${paused ? 'warning' : 'success'}" data-job-badge>${paused ? 'متوقف' : 'فعال'}</span>
      <label class="ais-switch" title="فعال / متوقف"><input type="checkbox" data-toggle-job ${paused ? '' : 'checked'}><span></span></label>
      <button class="btn btn-soft-primary btn-sm" type="button" data-run-job><i class="bi bi-play-fill"></i> اجرا</button>
      <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove-job title="حذف"><i class="bi bi-trash3"></i></button>
    </div>
  </article>`;
}

async function aiScheduler() {
  const node = host();
  const jobs = rows(await services.schedulerService.list({ perPage: 20 }));
  const active = jobs.filter((j) => j.status !== 'paused');
  const runs = jobs.reduce((s, j) => s + (j.runs ?? 0), 0);
  const tokens = jobs.reduce((s, j) => s + (j.runs ?? 0) * (j.tokensPerRun ?? 0), 0);
  const upcoming = active.slice(0, 5).map((j, i) => ({ ...j, next: ['۱۵ دقیقه دیگر', '۱ ساعت دیگر', 'امروز ۱۸:۰۰', 'فردا ۰۸:۰۰', 'شنبه ۰۹:۳۰'][i] }));

  render(
    node,
    `<div class="ais">
      <div class="ais-kpis">
        ${kpi({ label: 'کارهای تعریف‌شده', value: toDigits(jobs.length), icon: 'collection', tone: 'primary', meta: `${toDigits(active.length)} فعال • ${toDigits(jobs.length - active.length)} متوقف` })}
        ${kpi({ label: 'اجرای موفق', value: formatNumber(runs), icon: 'check2-circle', tone: 'success', delta: 8.6, meta: 'از ابتدای ماه' })}
        ${kpi({ label: 'توکن مصرفی کارها', value: compact(tokens), icon: 'cpu', tone: 'violet', meta: 'مجموع اجراها' })}
        ${kpi({ label: 'زمان صرفه‌جویی‌شده', value: `${toDigits(Math.round(runs * 0.35))} ساعت`, icon: 'hourglass-split', tone: 'info', meta: 'تخمین کار دستی' })}
      </div>
      <div class="ais-grid">
        <section data-col="8" class="card"><header class="card__head"><span class="card__icon"><i class="bi bi-clock-history"></i></span><div><h2 class="card__title">کارهای زمان‌بندی‌شده</h2><p class="card__subtitle">اجرای دستی، توقف و حذف با یک کلیک</p></div>
          <div class="card__actions"><button type="button" class="btn btn-primary btn-sm" data-create><i class="bi bi-plus-lg"></i> کار جدید</button></div></header>
          <div class="card__body">
            <div class="ais-chips mb-3" data-job-filter><button type="button" class="ais-chip is-active" data-f="all">همه <span class="count">${toDigits(jobs.length)}</span></button><button type="button" class="ais-chip" data-f="active">فعال <span class="count">${toDigits(active.length)}</span></button><button type="button" class="ais-chip" data-f="paused">متوقف <span class="count">${toDigits(jobs.length - active.length)}</span></button></div>
            <div data-scheduler-list>${jobs.map(jobCard).join('')}</div>
          </div></section>
        <div data-col="4" class="d-flex flex-column" style="gap:var(--nv-card-gap,1.25rem)">
          ${card({ title: 'اجراهای بعدی', icon: 'calendar-check', body: `<ul class="ais-feed">${upcoming.map((j) => `<li class="is-success"><span class="ais-feed__icon"><i class="bi bi-alarm"></i></span><div><div class="ais-feed__title">${escapeHtml(j.name)}</div><div class="ais-feed__meta">${j.next} • ${escapeHtml(j.model)}</div></div></li>`).join('')}</ul>` })}
          ${card({ title: 'اجرای ۱۴ روز اخیر', icon: 'bar-chart', body: slot('runs', 220) })}
        </div>
      </div>
    </div>`,
  );
  await drawCharts(node, { runs: { type: 'column', height: 220, series: [{ name: 'اجرا', data: [18, 22, 19, 25, 24, 12, 9, 21, 26, 23, 28, 27, 14, 11] }, { name: 'ناموفق', data: [0, 1, 0, 2, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0] }], labels: Array.from({ length: 14 }, (_, i) => toDigits(i + 1)), colors: ['#6366f1', '#f87171'] } });

  on(node, 'click', async (event) => {
    const filter = event.target.closest('[data-f]');
    if (filter) {
      $$('[data-f]', node).forEach((c) => c.classList.toggle('is-active', c === filter));
      $$('[data-job]', node).forEach((row) => { row.hidden = filter.dataset.f === 'all' ? false : filter.dataset.f === 'paused' ? !row.classList.contains('is-paused') : row.classList.contains('is-paused'); });
      return;
    }
    const row = event.target.closest('[data-job]');
    if (!row) return;
    if (event.target.closest('[data-run-job]')) {
      const btn = event.target.closest('[data-run-job]');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> در حال اجرا';
      const result = await services.schedulerActions.runNow(row.dataset.job);
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-play-fill"></i> اجرا';
      toast.success('کار با موفقیت اجرا شد', `${formatNumber(result.tokens ?? 0)} توکن مصرف شد.`);
    }
    if (event.target.closest('[data-remove-job]')) {
      const ok = await modal.confirm({ title: 'حذف کار زمان‌بندی‌شده', text: 'این کار دیگر اجرا نخواهد شد.', tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.schedulerActions.remove(row.dataset.job);
      row.remove();
      toast.success('حذف شد', 'کار از زمان‌بند برداشته شد.');
    }
  });
  on(node, 'change', async (event) => {
    const box = event.target.closest('[data-toggle-job]');
    if (!box) return;
    const row = box.closest('[data-job]');
    const result = await services.schedulerActions.toggle(row.dataset.job, box.checked ? 'active' : 'paused');
    const paused = result.status === 'paused';
    row.classList.toggle('is-paused', paused);
    const badge = $('[data-job-badge]', row);
    badge.textContent = paused ? 'متوقف' : 'فعال';
    badge.className = `badge badge--soft-${paused ? 'warning' : 'success'}`;
    $('.ais-job__icon i', row).className = `bi bi-${paused ? 'pause-fill' : 'lightning-charge-fill'}`;
    toast.info('وضعیت کار تغییر کرد', `وضعیت جدید: ${paused ? 'متوقف' : 'فعال'}`);
  });
  on($('[data-create]', node), 'click', () =>
    openRecordForm({
      resource: 'scheduler',
      title: 'کار زمان‌بندی‌شده جدید',
      fields: [
        { name: 'name', label: 'نام کار', required: true },
        { name: 'cron', label: 'زمان‌بندی', type: 'select', options: ['هر روز ۰۸:۰۰', 'هر شنبه ۰۹:۳۰', 'هر ماه اول ۱۰:۰۰', 'هر ۶ ساعت'] },
        { name: 'model', label: 'مدل', type: 'select', options: ['GPT-4o mini', 'GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro', 'مدل فارسی نووا'] },
        { name: 'prompt', label: 'پرامپت', type: 'textarea', col: 2, rows: 3 },
      ],
      onSaved: (saved) => {
        $('[data-scheduler-list]', node).insertAdjacentHTML('afterbegin', jobCard({ id: saved?.id ?? `sch-${Date.now()}`, name: saved?.name ?? 'کار جدید', cron: saved?.cron, model: saved?.model, status: 'active', runs: 0, tokensPerRun: 0 }));
      },
    }),
  );
}

/* ------------------------------------------------------------------- models */

async function aiModels() {
  const node = host();
  const [modelsRaw, usage] = await Promise.all([services.modelService.list({ perPage: 20 }), services.usageService.overview()]);
  const models = rows(modelsRaw);
  const usageOf = (id) => usage.byModel.find((m) => m.id === id) ?? {};
  const vendors = [...new Set(models.map((m) => m.vendor))];
  let defaultId = models[0]?.id;

  const modelCard = (m) => {
    const u = usageOf(m.id);
    return `<article class="ais-model ais-model--${u.tone ?? 'primary'} ${m.id === defaultId ? 'is-default' : ''}" data-model="${escapeHtml(m.id)}" data-vendor="${escapeHtml(m.vendor)}" data-status="${escapeHtml(m.status)}">
      <div class="ais-model__head">
        <span class="ais-model__logo">${vendorMark(m.vendor)}</span>
        <div style="min-width:0;flex:1"><div class="ais-model__name">${escapeHtml(m.name)}</div><div class="ais-model__vendor">${escapeHtml(m.vendor)} • زمینه ${escapeHtml(m.context)}</div></div>
        <div class="d-flex flex-column align-items-end gap-1">
          <span class="badge badge--soft-${m.status === 'active' ? 'success' : 'warning'}">${m.status === 'active' ? 'فعال' : 'بتا'}</span>
          ${m.id === defaultId ? '<span class="badge badge--soft-primary" data-default-badge>پیش‌فرض</span>' : m.popular ? '<span class="badge badge--soft-violet">محبوب</span>' : ''}
        </div>
      </div>
      <div class="ais-model__stats">
        <div><small>ورودی / ۱M</small><strong>$${toDigits((m.priceIn / 1000).toFixed(2))}</strong></div>
        <div><small>خروجی / ۱M</small><strong>$${toDigits((m.priceOut / 1000).toFixed(2))}</strong></div>
        <div><small>تأخیر</small><strong>${toDigits(m.latency)}ms</strong></div>
      </div>
      <div class="ais-model__meter"><span>کیفیت</span><div class="ais-bar"><span style="width:${m.quality}%"></span></div><strong>${toDigits(m.quality)}</strong></div>
      <div class="ais-model__meter"><span>مصرف ماه</span><div class="ais-bar"><span style="width:${Math.round((m.usage / 50_000) * 100)}%"></span></div><strong>${compact(m.usage)}</strong></div>
      <div class="ais-model__caps">${(m.capabilities ?? []).map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div>
      <div class="ais-model__foot">
        <button class="btn btn-light btn-sm" type="button" data-model-test><i class="bi bi-plug"></i> تست اتصال</button>
        <button class="btn btn-soft-primary btn-sm" type="button" data-model-default ${m.id === defaultId ? 'disabled' : ''}><i class="bi bi-check2-circle"></i> ${m.id === defaultId ? 'پیش‌فرض فعلی' : 'پیش‌فرض کن'}</button>
      </div>
    </article>`;
  };

  render(
    node,
    `<div class="ais">
      <div class="ais-kpis">
        ${kpi({ label: 'مدل‌های متصل', value: toDigits(models.length), icon: 'cpu', tone: 'primary', meta: `${toDigits(vendors.length)} ارائه‌دهنده` })}
        ${kpi({ label: 'مدل‌های فعال', value: toDigits(models.filter((m) => m.status === 'active').length), icon: 'check2-circle', tone: 'success', meta: `${toDigits(models.filter((m) => m.status === 'beta').length)} مدل بتا` })}
        ${kpi({ label: 'میانگین تأخیر', value: `${toDigits(usage.avgLatency)}ms`, icon: 'stopwatch', tone: 'info', delta: -6.2, meta: 'وزنی بر اساس درخواست' })}
        ${kpi({ label: 'درخواست ماه', value: compact(models.reduce((s, m) => s + m.usage, 0)), icon: 'lightning-charge', tone: 'violet', delta: usage.growth.requests, meta: 'همه مدل‌ها' })}
      </div>
      <div class="ais-toolbar">
        <label class="ais-search"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجوی مدل…" data-model-search></label>
        <div class="ais-chips" data-vendor-filter><button type="button" class="ais-chip is-active" data-v="">همه</button>${vendors.map((v) => `<button type="button" class="ais-chip" data-v="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('')}</div>
        <button type="button" class="btn btn-primary btn-sm ms-auto" data-create><i class="bi bi-plus-lg"></i> افزودن مدل</button>
      </div>
      <div class="ais-cards" data-model-grid>${models.map(modelCard).join('')}</div>
      <div class="ais-grid">
        ${card({ title: 'مقایسه کیفیت و تأخیر', subtitle: 'کیفیت (از ۱۰۰) در برابر تأخیر (ده‌ها میلی‌ثانیه)', icon: 'bar-chart-steps', body: slot('compare', 320) }).replace('<section class="card', '<section data-col="7" class="card')}
        ${card({ title: 'قیمت هر یک میلیون توکن', subtitle: 'دلار — ورودی و خروجی', icon: 'currency-dollar', body: slot('price', 320) }).replace('<section class="card', '<section data-col="5" class="card')}
      </div>
    </div>`,
  );

  await drawCharts(node, {
    compare: { type: 'column', height: 320, labels: models.map((m) => m.name), series: [{ name: 'کیفیت', data: models.map((m) => m.quality) }, { name: 'تأخیر (×۱۰ms)', data: models.map((m) => Math.round(m.latency / 10)) }], colors: ['#6366f1', '#22d3ee'] },
    price: { type: 'bar', height: 320, labels: models.map((m) => m.name), series: [{ name: 'ورودی', data: models.map((m) => m.priceIn / 1000) }, { name: 'خروجی', data: models.map((m) => m.priceOut / 1000) }], colors: ['#a78bfa', '#f472b6'] },
  });

  const applyFilter = () => {
    const term = $('[data-model-search]', node).value.trim().toLowerCase();
    const vendor = $('[data-vendor-filter] .is-active', node)?.dataset.v ?? '';
    $$('[data-model]', node).forEach((el) => {
      el.hidden = (vendor && el.dataset.vendor !== vendor) || (term && !el.textContent.toLowerCase().includes(term));
    });
  };
  on($('[data-model-search]', node), 'input', applyFilter);
  on(node, 'click', async (event) => {
    const chip = event.target.closest('[data-v]');
    if (chip) {
      $$('[data-v]', node).forEach((c) => c.classList.toggle('is-active', c === chip));
      return applyFilter();
    }
    const cardNode = event.target.closest('[data-model]');
    if (!cardNode) return;
    const model = models.find((m) => m.id === cardNode.dataset.model);
    const test = event.target.closest('[data-model-test]');
    if (test) {
      test.disabled = true;
      test.innerHTML = '<span class="spinner-border spinner-border-sm"></span> در حال تست';
      const started = performance.now();
      await services.aiChat.send({ message: 'تست اتصال', model: model?.name });
      test.disabled = false;
      test.innerHTML = '<i class="bi bi-plug"></i> تست اتصال';
      toast.success('اتصال برقرار است', `${model?.name} در ${toDigits(Math.round(performance.now() - started))} میلی‌ثانیه پاسخ داد.`);
    }
    if (event.target.closest('[data-model-default]')) {
      await Promise.resolve(services.modelService.update?.(cardNode.dataset.model, { isDefault: true })).catch(() => null);
      defaultId = cardNode.dataset.model;
      render($('[data-model-grid]', node), models.map(modelCard).join(''));
      applyFilter();
      toast.success('مدل پیش‌فرض تغییر کرد', `همه بخش‌های کارگاه از ${model?.name} استفاده می‌کنند.`);
    }
  });
  on($('[data-create]', node), 'click', () =>
    openRecordForm({
      resource: 'models',
      title: 'افزودن مدل',
      fields: [
        { name: 'name', label: 'نام مدل', required: true },
        { name: 'vendor', label: 'ارائه‌دهنده', required: true },
        { name: 'context', label: 'پنجره زمینه', placeholder: '128K' },
        { name: 'endpoint', label: 'آدرس Endpoint', placeholder: 'https://api.example.com/v1' },
        { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
      ],
      onSaved: () => toast.success('مدل افزوده شد', 'مدل جدید پس از تأیید اتصال در فهرست نمایش داده می‌شود.'),
    }),
  );
}

/* ----------------------------------------------------------------- API keys */

const SNIPPETS = {
  curl: `<span class="c"># ارسال پیام به دستیار نووا</span>
curl -X POST https://api.novaadmin.dev/v1/chat \\
  -H <span class="s">"Authorization: Bearer $NOVA_API_KEY"</span> \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"model":"gpt-4o-mini","messages":[{"role":"user","content":"سلام"}]}'</span>`,
  js: `<span class="k">const</span> res = <span class="k">await</span> <span class="f">fetch</span>(<span class="s">'https://api.novaadmin.dev/v1/chat'</span>, {
  method: <span class="s">'POST'</span>,
  headers: {
    Authorization: <span class="s">\`Bearer \${process.env.NOVA_API_KEY}\`</span>,
    <span class="s">'Content-Type'</span>: <span class="s">'application/json'</span>,
  },
  body: JSON.<span class="f">stringify</span>({ model: <span class="s">'gpt-4o-mini'</span>, messages }),
});
<span class="k">const</span> data = <span class="k">await</span> res.<span class="f">json</span>();`,
  python: `<span class="k">import</span> os, requests

res = requests.<span class="f">post</span>(
    <span class="s">"https://api.novaadmin.dev/v1/chat"</span>,
    headers={<span class="s">"Authorization"</span>: <span class="s">f"Bearer {os.environ['NOVA_API_KEY']}"</span>},
    json={<span class="s">"model"</span>: <span class="s">"gpt-4o-mini"</span>, <span class="s">"messages"</span>: messages},
)
<span class="f">print</span>(res.<span class="f">json</span>())`,
};

async function aiKeys() {
  const node = host();
  const keys = rows(await services.apiKeys.list());
  const mask = (token = '') => `${String(token).slice(0, 8)}••••••••${String(token).slice(-4)}`;
  const env = (token = '') => (String(token).includes('_live_') ? ['success', 'Live'] : ['warning', 'Test']);
  const keyRow = (key) => {
    const [tone, label] = env(key.token);
    const calls = 1200 + ((key.id.charCodeAt(key.id.length - 1) * 7919) % 48_000);
    return `<tr class="ais-key-row" data-key="${escapeHtml(key.id)}">
      <td><div class="ais-name ais-tone--${tone}"><span class="ais-name__icon"><i class="bi bi-key"></i></span><div><strong>${escapeHtml(key.name)}</strong><small>ساخته‌شده ${key.createdAt ? relativeTime(key.createdAt) : 'همین حالا'}</small></div></div></td>
      <td><code data-key-token="${escapeHtml(key.token ?? '')}">${escapeHtml(mask(key.token))}</code></td>
      <td><span class="badge badge--soft-${tone}">${label}</span></td>
      <td>${(key.scopes ?? ['read']).map((scope) => `<span class="badge badge--soft-${scope === 'write' ? 'violet' : 'info'}">${scope === 'write' ? 'نوشتن' : 'خواندن'}</span>`).join(' ')}</td>
      <td class="num">${formatNumber(calls)}</td>
      <td>${key.lastUsed ? relativeTime(key.lastUsed) : 'استفاده نشده'}</td>
      <td><div class="d-flex gap-1 justify-content-end">
        <button class="icon-btn icon-btn--sm" type="button" data-reveal-key title="نمایش"><i class="bi bi-eye"></i></button>
        <button class="icon-btn icon-btn--sm" type="button" data-copy-key title="کپی"><i class="bi bi-clipboard"></i></button>
        <button class="icon-btn icon-btn--sm" type="button" data-rotate-key title="بازتولید"><i class="bi bi-arrow-repeat"></i></button>
        <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-revoke-key title="ابطال"><i class="bi bi-trash3"></i></button>
      </div></td></tr>`;
  };

  render(
    node,
    `<div class="ais">
      <div class="ais-kpis">
        ${kpi({ label: 'کلیدهای فعال', value: toDigits(keys.length), icon: 'key', tone: 'primary', meta: `${toDigits(keys.filter((k) => String(k.token).includes('_live_')).length)} کلید Live` })}
        ${kpi({ label: 'فراخوانی ۷ روز', value: compact(184_620), icon: 'arrow-left-right', tone: 'info', delta: 14.2, meta: 'همه کلیدها', spark: 'calls' })}
        ${kpi({ label: 'میانگین پاسخ API', value: '۲۱۸ms', icon: 'stopwatch', tone: 'success', delta: -4.1, meta: 'p95: ۶۴۰ms' })}
        ${kpi({ label: 'درخواست رد‌شده', value: toDigits(37), icon: 'shield-exclamation', tone: 'danger', delta: -22.5, meta: 'محدودیت نرخ / کلید نامعتبر' })}
      </div>
      ${card({
        title: 'کلیدهای API',
        subtitle: 'کلید کامل فقط یک بار پس از ساخت نمایش داده می‌شود — آن را در جای امن نگه دارید',
        icon: 'key',
        flush: true,
        actions: '<button class="btn btn-primary btn-sm" type="button" data-create-key><i class="bi bi-plus-lg"></i> کلید جدید</button>',
        body: `<div class="ais-table-wrap"><table class="ais-table"><thead><tr><th>نام</th><th>کلید</th><th>محیط</th><th>دسترسی</th><th>فراخوانی</th><th>آخرین استفاده</th><th></th></tr></thead><tbody data-key-list>${keys.map(keyRow).join('')}</tbody></table></div>`,
      })}
      <div class="ais-grid">
        ${card({
          title: 'شروع سریع',
          subtitle: 'اولین درخواست خود را در کمتر از یک دقیقه ارسال کنید',
          icon: 'terminal',
          body: `<div class="ais-code-tabs ais-chips" data-snippet-tabs><button type="button" class="ais-chip is-active" data-snippet="curl">cURL</button><button type="button" class="ais-chip" data-snippet="js">JavaScript</button><button type="button" class="ais-chip" data-snippet="python">Python</button><button type="button" class="btn btn-light btn-sm ms-auto" data-copy-snippet><i class="bi bi-clipboard"></i> کپی</button></div><pre class="ais-code" data-snippet-body>${SNIPPETS.curl}</pre>`,
        }).replace('<section class="card', '<section data-col="7" class="card')}
        ${card({
          title: 'امنیت و محدودیت‌ها',
          icon: 'shield-lock',
          body: `${infoRows([
            ['محدودیت نرخ', '۶۰۰ درخواست در دقیقه'],
            ['سقف روزانه', '۲ میلیون توکن'],
            ['IPهای مجاز', '<code style="direction:ltr">185.12.*.* , 10.0.0.0/8</code>'],
            ['چرخش خودکار کلید', 'هر ۹۰ روز'],
          ])}
          <div class="ais-alert ais-alert--warning mt-3"><i class="bi bi-exclamation-triangle"></i><div><strong>هرگز کلید را در کد سمت کاربر قرار ندهید</strong><p>درخواست‌ها را از طریق سرور یا یک پراکسی امن ارسال کنید.</p></div></div>`,
        }).replace('<section class="card', '<section data-col="5" class="card')}
      </div>
    </div>`,
  );
  await drawCharts(node, { calls: sparkOptions([22, 26, 24, 31, 28, 19, 34, 29, 33, 36, 30, 38, 35, 41], '#0ea5e9') });

  on(node, 'click', async (event) => {
    const tab = event.target.closest('[data-snippet]');
    if (tab) {
      $$('[data-snippet]', node).forEach((c) => c.classList.toggle('is-active', c === tab));
      $('[data-snippet-body]', node).innerHTML = SNIPPETS[tab.dataset.snippet];
      return;
    }
    if (event.target.closest('[data-copy-snippet]')) {
      await navigator.clipboard?.writeText($('[data-snippet-body]', node).textContent).catch(() => {});
      return toast.success('کپی شد', 'نمونه کد در حافظه موقت قرار گرفت.');
    }
    if (event.target.closest('[data-create-key]')) return createKey();
    const row = event.target.closest('[data-key]');
    if (!row) return;
    const code = $('code', row);
    if (event.target.closest('[data-reveal-key]')) {
      const shown = code.dataset.shown === '1';
      code.textContent = shown ? mask(code.dataset.keyToken) : code.dataset.keyToken;
      code.dataset.shown = shown ? '0' : '1';
      $('[data-reveal-key] i', row).className = `bi bi-eye${shown ? '' : '-slash'}`;
    }
    if (event.target.closest('[data-copy-key]')) {
      await navigator.clipboard?.writeText(code.dataset.keyToken).catch(() => {});
      toast.success('کلید کپی شد', 'کلید در حافظه موقت قرار گرفت.');
    }
    if (event.target.closest('[data-rotate-key]')) {
      const ok = await modal.confirm({ title: 'بازتولید کلید', text: 'کلید فعلی بلافاصله از کار می‌افتد و کلید جدید ساخته می‌شود.', tone: 'warning', confirmText: 'بازتولید' });
      if (!ok) return;
      const token = `${code.dataset.keyToken.split('_').slice(0, 2).join('_')}_${Math.random().toString(16).slice(2, 14)}`;
      code.dataset.keyToken = token;
      code.textContent = mask(token);
      toast.success('کلید بازتولید شد', 'برنامه‌های متصل را با کلید جدید به‌روز کنید.');
    }
    if (event.target.closest('[data-revoke-key]')) {
      const ok = await modal.confirm({ title: 'ابطال کلید', text: 'همه درخواست‌هایی که با این کلید ارسال شوند رد خواهند شد.', tone: 'danger', confirmText: 'ابطال کن' });
      if (!ok) return;
      await Promise.resolve(services.apiKeys.remove?.(row.dataset.key)).catch(() => null);
      row.remove();
      toast.success('کلید باطل شد', 'کلید از فهرست حذف شد.');
    }
  });

  async function createKey() {
    const name = await modal.prompt({ title: 'کلید API جدید', label: 'نام کلید', placeholder: 'مثلاً: سرور تولید', validate: (value) => (value?.trim() ? null : 'نام کلید الزامی است') });
    if (!name) return;
    const token = `nv_live_${Math.random().toString(16).slice(2, 14)}`;
    const key = { id: `k-${Date.now()}`, name, scopes: ['read', 'write'], createdAt: new Date().toISOString(), token };
    $('[data-key-list]', node).insertAdjacentHTML('afterbegin', keyRow(key));
    modal.alert({ title: 'کلید ساخته شد', text: `کلید «${name}»: ${token} — این کلید دیگر به‌طور کامل نمایش داده نمی‌شود.`, tone: 'success' });
  }
}

/* ------------------------------------------------------------------ history */

async function aiHistory() {
  const node = host();
  const [conversationsRaw, usage] = await Promise.all([services.conversationService.list(), services.usageService.overview()]);
  const conversations = rows(conversationsRaw);
  const totalTokens = conversations.reduce((s, c) => s + (c.tokens ?? 0), 0);
  const totalMessages = conversations.reduce((s, c) => s + (c.messages ?? 0), 0);
  const byModel = conversations.reduce((acc, c) => ({ ...acc, [c.model]: (acc[c.model] ?? 0) + 1 }), {});
  const modelNames = [...new Set(conversations.map((c) => c.model))];

  render(
    node,
    `<div class="ais">
      <div class="ais-kpis">
        ${kpi({ label: 'کل گفتگوها', value: toDigits(conversations.length), icon: 'chat-square-text', tone: 'primary', meta: `${toDigits(conversations.filter((c) => c.pinned).length)} سنجاق‌شده` })}
        ${kpi({ label: 'پیام‌ها', value: formatNumber(totalMessages), icon: 'chat-dots', tone: 'info', meta: `میانگین ${toDigits(Math.round(totalMessages / Math.max(1, conversations.length)))} پیام در هر گفتگو` })}
        ${kpi({ label: 'توکن گفتگوها', value: compact(totalTokens), icon: 'hash', tone: 'violet', meta: `از ${compact(usage.tokens)} کل مصرف` })}
        ${kpi({ label: 'هزینه تخمینی', value: money(totalTokens * 320), icon: 'wallet2', tone: 'warning', meta: 'بر اساس نرخ میانگین' })}
      </div>
      <div class="ais-grid">
        <section data-col="8" class="card">
          <header class="card__head"><span class="card__icon"><i class="bi bi-clock-history"></i></span><div><h2 class="card__title">تاریخچه گفتگوها</h2><p class="card__subtitle">جستجو، تغییر نام، ادامه یا حذف گفتگو</p></div><div class="card__actions">${toolButtons({ exportResource: 'conversations' })}</div></header>
          <div class="card__body" style="padding-bottom:.5rem">
            <div class="ais-toolbar" style="border:0;padding:0;background:none">
              <label class="ais-search"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجو در عنوان و محتوا…" data-history-search></label>
              <select class="form-select form-select--sm" style="width:auto" data-history-model><option value="">همه مدل‌ها</option>${modelNames.map((m) => `<option>${escapeHtml(m)}</option>`).join('')}</select>
            </div>
          </div>
          <div class="card__body card__body--flush"><div class="ais-table-wrap"><table class="ais-table"><thead><tr><th>گفتگو</th><th>مدل</th><th>پیام</th><th>توکن</th><th>آخرین فعالیت</th><th></th></tr></thead><tbody>${conversations
            .map(
              (c) => `<tr data-conversation="${escapeHtml(c.id)}" data-model="${escapeHtml(c.model)}"><td><div class="ais-name"><span class="ais-name__icon"><i class="bi bi-${c.pinned ? 'pin-angle-fill' : 'chat-square-text'}"></i></span><div><strong data-title>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.preview ?? '')}</small></div></div></td>
              <td><span class="badge badge--soft-primary">${escapeHtml(c.model)}</span></td>
              <td class="num">${toDigits(c.messages ?? 0)}</td>
              <td class="num">${compact(c.tokens ?? 0)}</td>
              <td>${relativeTime(c.updatedAt)}</td>
              <td><div class="d-flex gap-1 justify-content-end"><a class="icon-btn icon-btn--sm" href="ai/chat.html" title="ادامه گفتگو"><i class="bi bi-box-arrow-up-left"></i></a><button class="icon-btn icon-btn--sm" type="button" data-rename title="تغییر نام"><i class="bi bi-pencil"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-delete title="حذف"><i class="bi bi-trash3"></i></button></div></td></tr>`,
            )
            .join('')}</tbody></table></div></div>
        </section>
        <div data-col="4" class="d-flex flex-column" style="gap:var(--nv-card-gap,1.25rem)">
          ${card({ title: 'گفتگو به تفکیک مدل', icon: 'pie-chart', body: slot('byModel', 280) })}
          ${card({ title: 'فعالیت ۱۴ روز اخیر', icon: 'bar-chart', body: slot('daily', 200) })}
        </div>
      </div>
    </div>`,
  );
  await drawCharts(node, {
    byModel: { type: 'donut', height: 280, series: Object.values(byModel), labels: Object.keys(byModel) },
    daily: { type: 'column', height: 200, series: [{ name: 'گفتگو', data: [3, 5, 4, 6, 8, 2, 1, 5, 7, 6, 9, 8, 3, 4] }], labels: Array.from({ length: 14 }, (_, i) => toDigits(i + 1)), colors: ['#8b5cf6'] },
  });

  const filter = () => {
    const term = $('[data-history-search]', node).value.trim();
    const model = $('[data-history-model]', node).value;
    $$('tr[data-conversation]', node).forEach((row) => { row.hidden = (term && !row.textContent.includes(term)) || (model && row.dataset.model !== model); });
  };
  on($('[data-history-search]', node), 'input', filter);
  on($('[data-history-model]', node), 'change', filter);
  on(node, 'click', async (event) => {
    const row = event.target.closest('tr[data-conversation]');
    if (!row) return;
    if (event.target.closest('[data-rename]')) {
      const name = await modal.prompt({ title: 'تغییر نام گفتگو', label: 'عنوان جدید', value: $('[data-title]', row).textContent });
      if (!name) return;
      await services.conversationService.rename(row.dataset.conversation, name);
      $('[data-title]', row).textContent = name;
      toast.success('نام تغییر کرد', 'عنوان جدید ذخیره شد.');
    }
    if (event.target.closest('[data-delete]')) {
      const ok = await modal.confirm({ title: 'حذف گفتگو', text: 'این گفتگو و پیام‌های آن حذف می‌شود.', tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.conversationService.remove(row.dataset.conversation);
      row.remove();
      toast.success('حذف شد', 'گفتگو از تاریخچه برداشته شد.');
    }
  });
}

/* ------------------------------------------------------------------ prompts */

async function aiPrompts() {
  const node = host();
  const result = await services.promptService.list({ perPage: 48 });
  const prompts = rows(result);
  const categories = result.summary?.categories ?? [];
  const highlight = (text = '') => escapeHtml(text).replace(/\{([^}]+)\}/g, '<b>{$1}</b>');
  const promptCard = (p) => `<article class="ais-prompt ais-prompt--${escapeHtml(p.tone ?? 'primary')}" data-prompt-card="${escapeHtml(p.id)}" data-category="${escapeHtml(p.category)}" data-fav="${p.favorite ? '1' : '0'}">
    <div class="ais-prompt__head"><span class="ais-prompt__cat"><i class="bi bi-${escapeHtml(p.icon ?? 'tag')}"></i>${escapeHtml(p.categoryLabel ?? 'عمومی')}</span>
      <button class="icon-btn icon-btn--sm ais-fav ms-auto" type="button" data-favorite aria-label="علاقه‌مندی"><i class="bi bi-star${p.favorite ? '-fill' : ''}"></i></button></div>
    <h3 class="ais-prompt__title">${escapeHtml(p.title)}</h3>
    <p class="ais-prompt__text">${highlight(p.text ?? '')}</p>
    <div class="ais-prompt__meta"><i class="bi bi-person-circle"></i>${escapeHtml(p.author ?? 'تیم نووا')}<span class="ms-auto"><i class="bi bi-play-circle"></i> ${toDigits(p.usage ?? 0)} اجرا</span></div>
    <div class="ais-prompt__foot"><button class="btn btn-light btn-sm" type="button" data-duplicate-prompt><i class="bi bi-files"></i> کپی</button><a class="btn btn-light btn-sm" href="ai/chat.html" title="استفاده در گفتگو"><i class="bi bi-chat-square-dots"></i></a><button class="btn btn-primary btn-sm" type="button" data-run-prompt><i class="bi bi-play-fill"></i> اجرا</button></div>
  </article>`;

  render(
    node,
    `<div class="ais">
      <div class="ais-kpis">
        ${kpi({ label: 'پرامپت‌ها', value: toDigits(prompts.length), icon: 'bookmark-star', tone: 'primary', meta: `${toDigits(categories.length)} دسته‌بندی` })}
        ${kpi({ label: 'علاقه‌مندی‌ها', value: toDigits(prompts.filter((p) => p.favorite).length), icon: 'star', tone: 'warning', meta: 'نشان‌شده توسط شما' })}
        ${kpi({ label: 'کل اجراها', value: formatNumber(prompts.reduce((s, p) => s + (p.usage ?? 0), 0)), icon: 'play-circle', tone: 'success', delta: 18.4, meta: 'در ۶۰ روز' })}
        ${kpi({ label: 'محبوب‌ترین', value: escapeHtml([...prompts].sort((a, b) => b.usage - a.usage)[0]?.title.slice(0, 18) ?? '—') + '…', icon: 'fire', tone: 'danger', meta: 'بیشترین اجرا' })}
      </div>
      <div class="ais-toolbar">
        <label class="ais-search"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجوی پرامپت…" data-prompt-search></label>
        <button type="button" class="btn btn-primary btn-sm" data-create><i class="bi bi-plus-lg"></i> پرامپت جدید</button>
        <div class="ais-chips w-100" data-cat-filter>
          <button type="button" class="ais-chip is-active" data-cat="">همه <span class="count">${toDigits(prompts.length)}</span></button>
          <button type="button" class="ais-chip" data-cat="__fav"><i class="bi bi-star-fill" style="color:#f59e0b"></i> علاقه‌مندی‌ها</button>
          ${categories.map((c) => `<button type="button" class="ais-chip" data-cat="${escapeHtml(c.id)}"><i class="bi bi-${escapeHtml(c.icon)}"></i> ${escapeHtml(c.label)} <span class="count">${toDigits(prompts.filter((p) => p.category === c.id).length)}</span></button>`).join('')}
        </div>
      </div>
      <div class="ais-cards" data-prompt-grid>${prompts.map(promptCard).join('')}</div>
    </div>`,
  );

  const applyFilter = () => {
    const term = $('[data-prompt-search]', node).value.trim();
    const cat = $('[data-cat-filter] .is-active', node)?.dataset.cat ?? '';
    $$('[data-prompt-card]', node).forEach((el) => {
      const catOk = !cat || (cat === '__fav' ? el.dataset.fav === '1' : el.dataset.category === cat);
      el.hidden = !catOk || (term && !el.textContent.includes(term));
    });
  };
  on($('[data-prompt-search]', node), 'input', applyFilter);
  on(node, 'click', async (event) => {
    const chip = event.target.closest('[data-cat]');
    if (chip) {
      $$('[data-cat]', node).forEach((c) => c.classList.toggle('is-active', c === chip));
      return applyFilter();
    }
    const cardNode = event.target.closest('[data-prompt-card]');
    if (!cardNode) return;
    const id = cardNode.dataset.promptCard;
    if (event.target.closest('[data-favorite]')) {
      const icon = $('[data-favorite] i', cardNode);
      const next = !icon.classList.contains('bi-star-fill');
      await services.promptActions.toggleFavorite(id, next);
      icon.className = `bi bi-star${next ? '-fill' : ''}`;
      cardNode.dataset.fav = next ? '1' : '0';
      toast.success(next ? 'به علاقه‌مندی‌ها افزوده شد' : 'از علاقه‌مندی‌ها حذف شد', 'کتابخانه پرامپت به‌روزرسانی شد.');
      return;
    }
    if (event.target.closest('[data-duplicate-prompt]')) {
      await services.promptActions.duplicate(id);
      const source = prompts.find((p) => p.id === id);
      $('[data-prompt-grid]', node).insertAdjacentHTML('afterbegin', promptCard({ ...source, id: `pr-${Date.now()}`, title: `${source.title} (کپی)`, usage: 0, favorite: false }));
      toast.success('پرامپت کپی شد', 'نسخه کپی در ابتدای فهرست قرار گرفت.');
      return;
    }
    if (event.target.closest('[data-run-prompt]')) {
      const detail = await services.promptService.get(id);
      const vars = [...new Set(String(detail.text ?? '').match(/\{([^}]+)\}/g) ?? [])].map((v) => v.slice(1, -1));
      modal.open({
        title: 'اجرای پرامپت',
        subtitle: detail.title,
        size: 'lg',
        content: `<form data-run-form><p class="fs-caption text-muted mb-2">متغیرهای پرامپت را تکمیل کنید:</p>
          <div class="row g-2">${vars.map((v) => `<div class="col-md-6"><label class="form-label">${escapeHtml(v)}</label><input class="form-control form-control--sm" name="${escapeHtml(v)}" placeholder="${escapeHtml(v)}…"></div>`).join('')}</div>
          <p class="ais-prompt__text mt-3" style="-webkit-line-clamp:unset">${highlight(detail.text ?? '')}</p>
          <div data-run-output class="mt-3"></div></form>`,
        footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button><button type="button" class="btn btn-primary" data-run-now><i class="bi bi-play-fill"></i> اجرا</button>',
        onMount: (panel) => {
          on($('[data-run-now]', panel), 'click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> در حال اجرا';
            const values = Object.fromEntries(new FormData($('[data-run-form]', panel)));
            const out = await services.promptActions.run(id, values);
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> اجرای دوباره';
            $('[data-run-output]', panel).innerHTML = `<div class="ais-alert ais-alert--success"><i class="bi bi-stars"></i><div><strong>خروجی — ${escapeHtml(out.model)} • ${toDigits(out.tokens)} توکن</strong><p>${escapeHtml(out.output ?? '')}</p></div></div>`;
          });
        },
      });
    }
  });
  on($('[data-create]', node), 'click', () =>
    openRecordForm({
      resource: 'prompts',
      title: 'پرامپت جدید',
      fields: [
        { name: 'title', label: 'عنوان', required: true },
        { name: 'category', label: 'دسته‌بندی', type: 'select', options: categories.map((c) => c.label) },
        { name: 'text', label: 'متن پرامپت', type: 'textarea', col: 2, rows: 4, hint: 'متغیرها را داخل {آکولاد} بنویسید' },
      ],
      onSaved: (saved) => {
        const cat = categories.find((c) => c.label === saved?.category) ?? categories[0] ?? {};
        $('[data-prompt-grid]', node).insertAdjacentHTML('afterbegin', promptCard({ id: saved?.id ?? `pr-${Date.now()}`, title: saved?.title ?? 'پرامپت جدید', text: saved?.text ?? '', category: cat.id, categoryLabel: cat.label, icon: cat.icon, tone: cat.tone, usage: 0, author: 'شما' }));
      },
    }),
  );
}

export const aiControllers = { initAiWorkspace };
export default aiControllers;
