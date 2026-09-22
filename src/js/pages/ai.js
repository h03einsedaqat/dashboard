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
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { formatCurrency, formatNumber, toDigits } from '../core/numbers.js';
import { relativeTime, formatDate } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import * as kit from './kit.js';

const { card, statCard, infoRows, timeline, paint, host, tabs, pageHeader, formMarkup, collectValues, openRecordForm, chart, exportable, emptyState, statusBadge, toolButtons, statsFrom, services } = kit;

/* ------------------------------------------------------------------ helpers */

function composer({ placeholder = 'پیام خود را بنویسید…', hint = 'Enter برای ارسال • Shift+Enter خط جدید' } = {}) {
  return `<form class="ai-composer" data-ai-composer>
    <textarea class="ai-composer__input" rows="1" name="message" placeholder="${escapeHtml(placeholder)}" aria-label="متن پیام"></textarea>
    <div class="ai-composer__row">
      <div class="ai-composer__tools">
        <button class="icon-btn icon-btn--sm" type="button" data-ai-attach aria-label="پیوست فایل"><i class="bi bi-paperclip"></i></button>
        <button class="icon-btn icon-btn--sm" type="button" data-ai-mic aria-label="ورودی صوتی"><i class="bi bi-mic"></i></button>
        <select class="form-select form-select--sm" data-ai-model aria-label="انتخاب مدل"></select>
        <select class="form-select form-select--sm" data-ai-tone aria-label="لحن پاسخ"><option value="professional">رسمی</option><option value="friendly">دوستانه</option><option value="concise">خلاصه</option></select>
      </div>
      <span class="ai-composer__hint">${escapeHtml(hint)}</span>
      <button class="btn btn-primary" type="submit" data-ai-send><i class="bi bi-send"></i> ارسال</button>
    </div>
  </form>`;
}

function bubble({ role = 'assistant', text = '', at = null, meta = '' }) {
  return `<article class="msg ${role === 'user' ? 'msg--out' : 'msg--in'}" data-msg-role="${role}">
    <span class="msg__avatar"><img class="avatar avatar--sm" src="${role === 'user' ? 'assets/img/avatars/avatar-08.svg' : 'assets/img/avatars/avatar-02.svg'}" alt="" /></span>
    <div class="msg__body">
      <header class="msg__meta"><strong>${role === 'user' ? 'شما' : 'دستیار نووا'}</strong><time>${at ? relativeTime(at) : 'همین حالا'}</time>${meta ? `<span class="badge badge--soft-primary">${escapeHtml(meta)}</span>` : ''}</header>
      <div class="msg__bubble">${text}</div>
    </div>
  </article>`;
}

function typing() {
  return `<article class="msg msg--in" data-typing><span class="msg__avatar"><img class="avatar avatar--sm" src="assets/img/avatars/avatar-02.svg" alt=""></span>
    <div class="msg__body"><header class="msg__meta"><strong>دستیار نووا</strong></header>
    <div class="msg__bubble chat-typing"><span></span><span></span><span></span></div></div></article>`;
}

async function modelOptions(select) {
  if (!select) return;
  const models = await services.modelService.list({ perPage: 20 });
  select.innerHTML = (models.items ?? models).map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}</option>`).join('');
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
    case 'ai/keys.html':
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

async function aiChat() {
  const node = host();
  render(node, `<div class="dashboard-shell">${kit.skeleton(3, 'card')}</div>`);
  const [conversations, models, prompts] = await Promise.all([services.conversationService.list(), services.modelService.list({ perPage: 20 }), services.promptService.list({ perPage: 6 })]);

  render(
    node,
    `<div class="ai-layout">
      <aside class="ai-panel chat-sidebar">
        <div class="chat-sidebar__head">
          <button class="btn btn-primary w-100" type="button" data-new-chat><i class="bi bi-plus-lg"></i> گفتگوی جدید</button>
          <div class="input-group input-group--icon mt-3"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجو در گفتگوها" data-chat-search></div>
        </div>
        <div class="chat-sidebar__list" data-conversation-list>
          ${conversations
            .map(
              (conversation, index) => `<button type="button" class="chat-contact ${index === 0 ? 'is-active' : ''}" data-conversation="${escapeHtml(conversation.id)}">
                <span class="chat-contact__top"><span class="chat-contact__name">${escapeHtml(conversation.title)}</span><span class="chat-contact__time">${relativeTime(conversation.updatedAt ?? conversation.createdAt)}</span></span>
                <span class="chat-contact__preview">${escapeHtml(conversation.preview ?? conversation.summary ?? '')}</span>
              </button>`,
            )
            .join('')}
        </div>
      </aside>

      <section class="ai-panel chat-panel">
        <header class="chat-panel__head">
          <div><h1 class="chat-panel__title" data-chat-title>دستیار هوش مصنوعی</h1><p class="chat-panel__sub">${toDigits((models.items ?? models).length)} مدل فعال • پاسخ‌ها نمایشی هستند</p></div>
          <div class="chat-panel__actions">
            <button class="icon-btn" type="button" data-chat-export aria-label="خروجی گفتگو"><i class="bi bi-download"></i></button>
            <button class="icon-btn" type="button" data-chat-clear aria-label="پاک کردن گفتگو"><i class="bi bi-eraser"></i></button>
          </div>
        </header>
        <div class="chat-stream" data-chat-stream>
          ${bubble({ role: 'assistant', text: 'سلام! من دستیار هوش مصنوعی نووا هستم. می‌توانم در نوشتن محتوا، خلاصه‌سازی، تحلیل داده و طراحی ساختار اپلیکیشن کمکتان کنم. چه کاری انجام دهم؟' })}
        </div>
        ${composer()}
      </section>

      <aside class="ai-panel ai-side">
        <div class="ai-suggestions">
          <h3 class="card__title">پیشنهاد سریع</h3>
          ${(prompts.items ?? prompts)
            .slice(0, 5)
            .map((prompt) => `<button type="button" class="ai-suggestion" data-prompt="${escapeHtml(prompt.id)}"><strong>${escapeHtml(prompt.title)}</strong><span>${escapeHtml(prompt.categoryLabel ?? prompt.category ?? '')}</span></button>`)
            .join('')}
        </div>
        <div class="card mt-3"><div class="card__body">
          <h3 class="card__title">مصرف این نشست</h3>
          ${infoRows([
            ['پیام‌ها', '<span data-token-messages>۰</span>'],
            ['توکن مصرفی', '<span data-token-count>۰</span>'],
            ['هزینه تخمینی', '<span data-token-cost>۰</span>'],
          ])}
        </div></div>
      </aside>
    </div>`,
  );

  const stream = $('[data-chat-stream]', node);
  const modelSelect = $('[data-ai-model]', node);
  await modelOptions(modelSelect);
  let conversationId = conversations[0]?.id ?? null;
  let tokens = 0;
  let messages = 0;

  const pushTokens = (count) => {
    tokens += count;
    messages += 1;
    $('[data-token-messages]', node).textContent = toDigits(messages);
    $('[data-token-count]', node).textContent = formatNumber(tokens);
    $('[data-token-cost]', node).textContent = formatCurrency(tokens * 320, 'IRR', { compact: true });
  };

  const send = async (text) => {
    if (!text.trim()) return;
    stream.insertAdjacentHTML('beforeend', bubble({ role: 'user', text: escapeHtml(text) }));
    stream.insertAdjacentHTML('beforeend', typing());
    stream.scrollTop = stream.scrollHeight;
    const reply = await services.aiChat.send({ message: text, conversationId, model: modelSelect?.value });
    $('[data-typing]', stream)?.remove();
    stream.insertAdjacentHTML('beforeend', bubble({ role: 'assistant', text: '', at: new Date(), meta: reply.model ?? 'نووا' }));
    const last = stream.lastElementChild;
    reveal(last, reply.message ?? reply.text ?? 'پاسخ آماده شد.');
    stream.scrollTop = stream.scrollHeight;
    pushTokens(reply.tokens ?? 420);
    conversationId = reply.conversationId ?? conversationId;
  };

  on($('[data-ai-composer]', node), 'submit', (event) => {
    event.preventDefault();
    const input = $('[name="message"]', event.currentTarget);
    const text = input.value;
    input.value = '';
    send(text);
  });
  on($('.ai-composer__input', node), 'keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      $('[data-ai-composer]', node).requestSubmit();
    }
  });
  on(node, 'click', async (event) => {
    const conversation = event.target.closest('[data-conversation]');
    if (conversation) {
      $$('[data-conversation]', node).forEach((item) => item.classList.toggle('is-active', item === conversation));
      conversationId = conversation.dataset.conversation;
      const detail = await services.conversationService.get(conversationId);
      $('[data-chat-title]', node).textContent = detail.title ?? 'گفتگو';
      render(stream, (detail.messages ?? []).map((message) => bubble({ role: message.role === 'user' ? 'user' : 'assistant', text: escapeHtml(message.text), at: message.at })).join('') || bubble({ role: 'assistant', text: 'این گفتگو خالی است — اولین پیام را بنویسید.' }));
      return;
    }
    if (event.target.closest('[data-new-chat]')) {
      conversationId = null;
      render(stream, bubble({ role: 'assistant', text: 'گفتگوی جدید آغاز شد. چه می‌خواهید بسازیم؟' }));
      $('[data-chat-title]', node).textContent = 'گفتگوی جدید';
      return;
    }
    const prompt = event.target.closest('[data-prompt]');
    if (prompt) {
      const detail = await services.promptService.get(prompt.dataset.prompt);
      const input = $('.ai-composer__input', node);
      input.value = detail.template ?? detail.body ?? detail.title ?? '';
      input.focus();
      return;
    }
    if (event.target.closest('[data-chat-clear]')) {
      const ok = await modal.confirm({ title: 'پاک کردن گفتگو', text: 'همه پیام‌های این نشست از صفحه حذف می‌شود.', tone: 'warning', confirmText: 'پاک کن' });
      if (ok) {
        render(stream, bubble({ role: 'assistant', text: 'گفتگو پاک شد. سؤال جدیدتان را بپرسید.' }));
        tokens = 0;
        messages = 0;
        pushTokens(0);
      }
      return;
    }
    if (event.target.closest('[data-chat-export]')) {
      const text = $$('.msg__bubble', stream).map((item) => item.textContent.trim()).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'nova-chat.txt';
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('خروجی آماده شد', 'فایل متنی گفتگو دانلود شد.');
      return;
    }
    if (event.target.closest('[data-ai-attach]')) toast.info('پیوست فایل', 'در نسخه نمایشی، پیوست‌ها پردازش نمی‌شوند.');
    if (event.target.closest('[data-ai-mic]')) toast.info('ورودی صوتی', 'مرورگر شما به میکروفون دسترسی نداده است.');
  });
  on($('[data-chat-search]', node), 'input', (event) => {
    const term = event.target.value.trim();
    $$('[data-conversation]', node).forEach((item) => {
      item.hidden = term ? !item.textContent.includes(term) : false;
    });
  });
}

/* -------------------------------------------------------------- writer page */

async function aiWriter() {
  const node = host();
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'استودیو نویسندگی', subtitle: 'تولید متن بر اساس موضوع، لحن و طول مشخص', icon: 'pencil-square', badges: [] })}
      <div class="grid grid--sidebar">
        ${card({
          title: 'تنظیمات تولید',
          body: `<form class="form-stack" data-writer-form novalidate>
            ${formMarkup([
              { name: 'topic', label: 'موضوع', required: true, placeholder: 'مثلاً: معرفی قابلیت گزارش‌های هوشمند' },
              { name: 'tone', label: 'لحن', type: 'select', options: [{ value: 'professional', label: 'رسمی' }, { value: 'friendly', label: 'دوستانه' }, { value: 'persuasive', label: 'ترغیبی' }, { value: 'educational', label: 'آموزشی' }] },
              { name: 'length', label: 'طول متن', type: 'select', options: [{ value: 'short', label: 'کوتاه (۱۵۰ کلمه)' }, { value: 'medium', label: 'متوسط (۴۰۰ کلمه)' }, { value: 'long', label: 'بلند (۸۰۰ کلمه)' }] },
              { name: 'audience', label: 'مخاطب', placeholder: 'مدیران محصول' },
              { name: 'keywords', label: 'کلیدواژه‌ها', type: 'tags', hint: 'با کاما جدا کنید', col: 2 },
              { name: 'outline', label: 'ساختار دلخواه', type: 'textarea', rows: 3, col: 2, placeholder: 'هر خط یک سرفصل' },
            ])}
            <div class="form-actions form-actions--end"><button class="btn btn-light" type="reset">پاک کردن</button><button class="btn btn-primary" type="submit" data-generate><i class="bi bi-stars"></i> تولید متن</button></div>
          </form>`,
        })}
        <div class="stack">
          ${card({
            title: 'خروجی',
            actions: `<div class="d-flex gap-2"><button class="btn btn-light btn-sm" type="button" data-copy-output><i class="bi bi-clipboard"></i> کپی</button><button class="btn btn-light btn-sm" type="button" data-export-output><i class="bi bi-download"></i> دانلود</button></div>`,
            body: `<div class="editor" data-writer-output>
              <div class="editor-toolbar"><button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="bold" aria-label="پررنگ"><i class="bi bi-type-bold"></i></button>
                <button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="italic" aria-label="ایتالیک"><i class="bi bi-type-italic"></i></button>
                <button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="insertUnorderedList" aria-label="فهرست نقطه‌ای"><i class="bi bi-list-ul"></i></button>
                <button type="button" class="icon-btn icon-btn--sm" data-editor-cmd="formatBlock:h2" aria-label="سرتیتر"><i class="bi bi-type-h2"></i></button>
                <span class="editor-toolbar__divider"></span>
                <button type="button" class="icon-btn icon-btn--sm" type="button" data-expand aria-label="بلندتر کن"><i class="bi bi-arrows-angle-expand"></i></button>
                <button type="button" class="icon-btn icon-btn--sm" type="button" data-shorten aria-label="کوتاه‌تر کن"><i class="bi bi-arrows-angle-contract"></i></button>
              </div>
              <div class="editor-body" contenteditable="true" data-editor-body aria-label="متن تولیدشده"><p class="text-muted">متن تولیدشده اینجا نمایش داده می‌شود…</p></div>
            </div>
            ${infoRows([['کلمات', '<span data-word-count>۰</span>'], ['زمان مطالعه', '<span data-read-time>۰</span> دقیقه'], ['امتیاز خوانایی', '<span data-readability>—</span>']])}`,
          })}
          ${card({ title: 'تاریخچه تولید', body: `<div data-writer-history>${timeline([], { compact: true })}</div>` })}
        </div>
      </div>
    </div>`,
  );

  const form = $('[data-writer-form]', node);
  const body = $('[data-editor-body]', node);
  const history = [];

  const updateStats = () => {
    const words = body.textContent.trim().split(/\s+/).filter(Boolean).length;
    $('[data-word-count]', node).textContent = formatNumber(words);
    $('[data-read-time]', node).textContent = toDigits(Math.max(1, Math.round(words / 200)));
    $('[data-readability]', node).textContent = words > 40 ? 'خوب' : '—';
  };

  on(body, 'input', updateStats);
  on($('.editor-toolbar', node), 'click', async (event) => {
    const button = event.target.closest('[data-editor-cmd]');
    if (button) {
      const [command, argument] = String(button.dataset.editorCmd).split(':');
      document.execCommand(command, false, argument);
      body.focus();
      return;
    }
    if (event.target.closest('[data-expand]')) {
      const result = await services.writerService.expand(body.textContent.slice(0, 400));
      body.innerHTML += `<p>${escapeHtml(result.text ?? '')}</p>`;
      updateStats();
      toast.success('متن گسترش یافت', 'پاراگراف تکمیلی افزوده شد.');
      return;
    }
    if (event.target.closest('[data-shorten]')) {
      const result = await services.writerService.shorten(body.textContent);
      body.textContent = result.text ?? body.textContent;
      updateStats();
      toast.info('متن کوتاه شد', 'جمله‌های تکراری حذف شدند.');
    }
  });

  on(form, 'submit', async (event) => {
    event.preventDefault();
    const { validateForm } = await import('../core/form.js');
    if (!validateForm(form).valid) {
      toast.warning('موضوع را وارد کنید', 'برای تولید متن، موضوع الزامی است.');
      return;
    }
    const button = $('[data-generate]', form);
    button.classList.add('is-loading');
    button.disabled = true;
    body.innerHTML = '<p class="text-muted">در حال تولید متن…</p>';
    try {
      const payload = collectValues(form);
      const result = await services.writerService.generate(payload);
      body.innerHTML = (result.paragraphs ?? [result.text ?? '']).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
      updateStats();
      history.unshift({ title: payload.topic, text: `${toDigits(body.textContent.trim().split(/\s+/).length)} کلمه • لحن ${payload.tone}`, time: 'همین حالا', tone: 'success', icon: 'magic' });
      render($('[data-writer-history]', node), timeline(history.slice(0, 6), { compact: true }));
      toast.success('متن تولید شد', `${toDigits(result.tokens ?? 0)} توکن مصرف شد.`);
    } finally {
      button.classList.remove('is-loading');
      button.disabled = false;
    }
  });

  on($('[data-copy-output]', node), 'click', async () => {
    await navigator.clipboard?.writeText(body.textContent);
    toast.success('کپی شد', 'متن در حافظه موقت قرار گرفت.');
  });
  on($('[data-export-output]', node), 'click', () => {
    const blob = new Blob([`<article>${body.innerHTML}</article>`], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'nova-writer.html';
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

/* ---------------------------------------------------------- summarizer page */

async function aiSummarizer() {
  const node = host();
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'خلاصه‌ساز هوشمند', subtitle: 'متن، فایل یا نشانی صفحه را به خلاصه و نکات کلیدی تبدیل کنید', icon: 'file-earmark-text' })}
      <div class="grid grid--sidebar">
        ${card({
          title: 'ورودی',
          body: `<form class="form-stack" data-summary-form novalidate>
            <div class="file-drop" data-file-drop>
              <span class="file-drop__icon"><i class="bi bi-cloud-arrow-up"></i></span>
              <p class="file-drop__title">فایل را اینجا رها کنید یا انتخاب کنید</p>
              <p class="file-drop__hint">PDF، DOCX یا TXT تا ۱۰ مگابایت</p>
              <input type="file" hidden accept=".pdf,.docx,.txt" data-file-input />
            </div>
            ${formMarkup([
              { name: 'bullets', label: 'تعداد نکات کلیدی', type: 'select', options: ['3', '4', '5', '6'] },
              { name: 'language', label: 'زبان خروجی', type: 'select', options: [{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'انگلیسی' }, { value: 'ar', label: 'عربی' }] },
              { name: 'text', label: 'متن ورودی', type: 'textarea', rows: 8, col: 2, placeholder: 'متن خود را اینجا بچسبانید…', required: true },
            ])}
            <div class="form-actions form-actions--end"><button class="btn btn-light" type="reset">پاک کردن</button><button class="btn btn-primary" type="submit" data-summarize><i class="bi bi-magic"></i> خلاصه کن</button></div>
          </form>`,
        })}
        <div class="stack">
          ${card({ title: 'خلاصه', body: '<div data-summary-output class="text-muted">خروجی خلاصه اینجا نمایش داده می‌شود…</div>' })}
          ${card({ title: 'نکات کلیدی', body: '<ul class="checklist" data-keypoints><li class="text-muted">هنوز نکته‌ای استخراج نشده است.</li></ul>' })}
          ${card({ title: 'آمار متن', body: infoRows([['کلمات متن', '<span data-source-words>۰</span>'], ['کلمات خلاصه', '<span data-summary-words>۰</span>'], ['درجه فشرده‌سازی', '<span data-compression>—</span>']]) })}
        </div>
      </div>
    </div>`,
  );

  const form = $('[data-summary-form]', node);
  const textarea = $('[name="text"]', form);
  on(textarea, 'input', () => {
    $('[data-source-words]', node).textContent = formatNumber(textarea.value.trim().split(/\s+/).filter(Boolean).length);
  });
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
  on(form, 'submit', async (event) => {
    event.preventDefault();
    const button = $('[data-summarize]', form);
    button.classList.add('is-loading');
    button.disabled = true;
    try {
      const values = collectValues(form);
      const result = await services.summarizerService.summarize({ text: values.text, bullets: Number(values.bullets) });
      render($('[data-summary-output]', node), `<p>${escapeHtml(result.summary ?? result.text ?? '')}</p>`);
      render($('[data-keypoints]', node), (result.keyPoints ?? []).map((point) => `<li><i class="bi bi-check2-circle"></i> ${escapeHtml(point)}</li>`).join(''));
      const summaryWords = String(result.summary ?? '').trim().split(/\s+/).filter(Boolean).length;
      $('[data-summary-words]', node).textContent = formatNumber(summaryWords);
      $('[data-compression]', node).textContent = `${toDigits(Math.max(1, Math.round((1 - summaryWords / Math.max(1, values.text.trim().split(/\s+/).length)) * 100)))}٪`;
      toast.success('خلاصه آماده شد', 'نکات کلیدی استخراج شد.');
    } finally {
      button.classList.remove('is-loading');
      button.disabled = false;
    }
  });
}

/* ---------------------------------------------------------- repurposer page */

async function aiRepurposer() {
  const node = host();
  const formats = await services.repurposeService.formats();
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'بازتولید محتوا', subtitle: 'یک متن، چند قالب — شبکه‌های اجتماعی، ایمیل و خلاصه خبری', icon: 'arrow-repeat' })}
      <div class="grid grid--2">
        ${card({
          title: 'متن پایه',
          body: `<form class="form-stack" data-repurpose-form>
            <textarea class="form-control" rows="10" name="text" placeholder="متن منبع را بچسبانید…">${escapeHtml('فروشگاه‌های ایرانی با چالش مدیریت موجودی و هماهنگی کانال‌های فروش مواجه‌اند. یک پنل واحد که سفارش‌ها، انبار و گزارش‌ها را یکجا نشان دهد، زمان تصمیم‌گیری را کاهش می‌دهد.')}</textarea>
            <fieldset class="form-section"><legend class="form-section__title">قالب‌های خروجی</legend>
              <div class="chip-row">${formats
                .map((format) => `<label class="chip chip--filter"><input type="checkbox" name="format" value="${escapeHtml(format.id)}" ${format.default ? 'checked' : ''} hidden><span>${escapeHtml(format.label)}</span></label>`)
                .join('')}</div>
            </fieldset>
            <div class="form-actions form-actions--end"><button class="btn btn-primary" type="submit" data-convert><i class="bi bi-shuffle"></i> بازتولید کن</button></div>
          </form>`,
        })}
        ${card({ title: 'خروجی‌ها', flush: true, body: '<div data-repurpose-output><div class="empty-state"><span class="empty-state__icon"><i class="bi bi-shuffle"></i></span><p class="empty-state__title">هنوز خروجی‌ای ساخته نشده است</p><p class="empty-state__text">یک یا چند قالب را انتخاب و دکمه بازتولید را بزنید.</p></div></div>' })}
      </div>
    </div>`,
  );

  on($('[data-repurpose-form]', node), 'submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = $('[name="text"]', form).value.trim();
    const chosen = $$('input[name="format"]:checked', form).map((input) => input.value);
    if (!chosen.length) {
      toast.warning('قالبی انتخاب نشده', 'حداقل یک قالب خروجی انتخاب کنید.');
      return;
    }
    const button = $('[data-convert]', form);
    button.classList.add('is-loading');
    try {
      const results = await Promise.all(chosen.map((format) => services.repurposeService.convert({ text, format })));
      render(
        $('[data-repurpose-output]', node),
        `<ul class="list-group">${chosen
          .map(
            (format, index) => `<li class="list-item"><div class="w-100"><div class="d-flex align-items-center justify-content-between gap-2"><span class="badge badge--soft-primary">${escapeHtml(formats.find((f) => f.id === format)?.label ?? format)}</span>
              <button class="icon-btn icon-btn--sm" type="button" data-copy="${index}" aria-label="کپی"><i class="bi bi-clipboard"></i></button></div>
              <p class="mt-2 mb-0">${escapeHtml(results[index].text ?? '')}</p></div></li>`,
          )
          .join('')}</ul>`,
      );
      on($('[data-repurpose-output]', node), 'click', async (copyEvent) => {
        const copy = copyEvent.target.closest('[data-copy]');
        if (!copy) return;
        await navigator.clipboard?.writeText($$('.list-item p', node)[Number(copy.dataset.copy)].textContent);
        toast.success('کپی شد', 'خروجی در حافظه موقت قرار گرفت.');
      });
      toast.success('بازتولید انجام شد', `${toDigits(chosen.length)} قالب ساخته شد.`);
    } finally {
      button.classList.remove('is-loading');
    }
  });
}

/* -------------------------------------------------------------- image studio */

async function aiImages() {
  const node = host();
  const [history, models] = await Promise.all([services.imageStudioService.list(), services.modelService.list({ perPage: 20 })]);
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'استودیو تصویر', subtitle: 'تولید تصویر بر اساس توضیح متنی — خروجی‌ها در گالری ذخیره می‌شوند', icon: 'image', badges: [statusBadge(`${toDigits(history.length)} تصویر`, 'primary')] })}
      <div class="grid grid--sidebar">
        ${card({
          title: 'تنظیمات تولید تصویر',
          body: `<form class="form-stack" data-image-form novalidate>
            ${formMarkup([
              { name: 'prompt', label: 'توضیح تصویر', type: 'textarea', rows: 4, col: 2, required: true, placeholder: 'مثلاً: داشبورد تحلیلی مدرن با نمودارهای مینیمال، رنگ نیلی' },
              { name: 'size', label: 'ابعاد', type: 'select', options: ['512×512', '1024×1024', '1024×1792', '1792×1024'] },
              { name: 'style', label: 'سبک', type: 'select', options: ['عکاسی', 'تصویرسازی', 'سه‌بعدی', 'خطی', 'مینیمال'] },
              { name: 'model', label: 'مدل', type: 'select', options: (models.items ?? models).map((model) => ({ value: model.id, label: model.name })) },
              { name: 'count', label: 'تعداد', type: 'select', options: ['1', '2', '4'] },
            ])}
            <div class="form-actions form-actions--end"><button class="btn btn-primary" type="submit" data-generate-image><i class="bi bi-magic"></i> تولید تصویر</button></div>
          </form>`,
        })}
        <div class="stack">
          ${card({ title: 'گالری', flush: true, body: `<div class="files-grid" data-image-gallery>${history
            .slice(0, 8)
            .map(
              (image) => `<figure class="file-card"><div class="file-card__thumb"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.prompt ?? '')}" loading="lazy"></div>
                <figcaption class="file-card__meta"><span class="file-card__name">${escapeHtml((image.prompt ?? '').slice(0, 28))}…</span><span class="list-item__sub">${toDigits(image.size ?? '')}</span></figcaption>
                <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-delete-image="${escapeHtml(image.id)}" aria-label="حذف"><i class="bi bi-trash3"></i></button></figure>`,
            )
            .join('')}</div>` })}
        </div>
      </div>
    </div>`,
  );

  on($('[data-image-form]', node), 'submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('[data-generate-image]', form);
    button.classList.add('is-loading');
    try {
      const values = collectValues(form);
      const gallery = $('[data-image-gallery]', node);
      gallery.insertAdjacentHTML('afterbegin', `<figure class="file-card is-loading"><div class="skeleton skeleton--card"></div></figure>`);
      const results = await Promise.all(Array.from({ length: Number(values.count ?? 1) }, () => services.imageStudioService.generate({ prompt: values.prompt, size: values.size })));
      $('.file-card.is-loading', gallery)?.remove();
      gallery.insertAdjacentHTML(
        'afterbegin',
        results
          .map(
            (image) => `<figure class="file-card"><div class="file-card__thumb"><img src="${escapeHtml(image.url ?? 'assets/img/products/product-01.svg')}" alt="${escapeHtml(values.prompt)}"></div>
              <figcaption class="file-card__meta"><span class="file-card__name">${escapeHtml(values.prompt.slice(0, 28))}…</span><span class="list-item__sub">${escapeHtml(values.size)} • ${escapeHtml(values.style ?? '')}</span></figcaption>
              <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-delete-image="${escapeHtml(image.id)}" aria-label="حذف"><i class="bi bi-trash3"></i></button></figure>`,
          )
          .join(''),
      );
      toast.success('تصویر تولید شد', `${toDigits(results.length)} تصویر به گالری افزوده شد.`);
    } finally {
      button.classList.remove('is-loading');
    }
  });
  on(node, 'click', async (event) => {
    const remove = event.target.closest('[data-delete-image]');
    if (!remove) return;
    const ok = await modal.confirm({ title: 'حذف تصویر', text: 'تصویر از گالری حذف می‌شود.', tone: 'danger', confirmText: 'حذف کن' });
    if (!ok) return;
    await services.imageStudioService.remove(remove.dataset.deleteImage);
    remove.closest('figure').remove();
    toast.success('حذف شد', 'تصویر از گالری برداشته شد.');
  });
}

/* -------------------------------------------------------------- usage & meta */

async function aiUsage() {
  const node = host();
  const usage = await services.usageService.overview();
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'مصرف و هزینه', subtitle: 'توکن‌های مصرفی، هزینه به تفکیک مدل و سهمیه ماهانه', icon: 'speedometer2', actions: toolButtons({ exportResource: 'usage' }) })}
      ${statsFrom({ tokens: usage.tokens?.total ?? usage.totalTokens ?? 0, cost: usage.cost?.total ?? 0, requests: usage.requests ?? 0, quota: usage.quotaUsed ?? 0 }, [
        ['tokens', 'کل توکن', 'number', 'primary', 'hash'],
        ['cost', 'هزینه ماه', 'currency', 'warning', 'cash-coin'],
        ['requests', 'درخواست‌ها', 'number', 'info', 'arrow-repeat'],
        ['quota', 'سهمیه مصرف‌شده', 'percent', 'violet', 'pie-chart'],
      ])}
      <div class="widget-grid">
        ${card({ title: 'روند مصرف توکن', body: `<div class="chart" data-chart="area" data-chart-height="320" data-chart-series='${JSON.stringify([{ name: 'توکن', data: usage.series ?? usage.tokens?.data ?? [] }])}' data-chart-labels='${JSON.stringify(usage.labels ?? usage.tokens?.labels ?? [])}'></div>` })}
        ${card({ title: 'سهم مدل‌ها', body: `<div class="chart" data-chart="donut" data-chart-height="320" data-chart-series='${JSON.stringify((usage.byModel ?? []).map((model) => model.tokens ?? model.value ?? 0))}' data-chart-labels='${JSON.stringify((usage.byModel ?? []).map((model) => model.label ?? model.name ?? ''))}'></div>` })}
      </div>
      ${card({ title: 'تفکیک مصرف', flush: true, body: `<table class="table table--hover"><thead><tr><th>مدل</th><th>درخواست</th><th>توکن</th><th>هزینه</th><th>سهم</th></tr></thead><tbody>${(usage.byModel ?? [])
        .map((model) => {
          const share = Math.round(((model.tokens ?? model.value ?? 0) / Math.max(1, usage.tokens?.total ?? usage.totalTokens ?? 1)) * 100);
          return `<tr><td>${escapeHtml(model.label ?? model.name ?? '')}</td><td class="numeric">${formatNumber(model.requests ?? 0)}</td><td class="numeric">${formatNumber(model.tokens ?? 0)}</td><td class="numeric">${formatCurrency(model.cost ?? 0, 'IRR', { compact: true })}</td><td><div class="progress progress--sm"><div class="progress-bar" style="width:${share}%"></div></div></td></tr>`;
        })
        .join('')}</tbody></table>` })}
    </div>`,
  );
  initCharts(node);
  exportable(node, 'usage');
}

async function aiScheduler() {
  const node = host();
  const jobs = await services.schedulerService.list({ perPage: 20 });
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'زمان‌بندی کارها', subtitle: 'اجرای خودکار پرامپت‌ها در بازه‌های مشخص', icon: 'clock-history', actions: toolButtons({ create: 'کار زمان‌بندی‌شده' }) })}
      <div class="card"><div class="card__head"><div><h2 class="card__title">کارهای فعال</h2><p class="card__subtitle">اجرای دستی و توقف کارها با یک کلیک</p></div></div>
        <div class="card__body" data-scheduler-list>${(jobs.items ?? jobs)
          .map(
            (job) => `<div class="list-item" data-job="${escapeHtml(job.id)}">
              <span class="tile tile--soft tile--icon"><i class="bi bi-clock-history"></i></span>
              <span class="list-item__title">${escapeHtml(job.name)}<span class="list-item__sub">${escapeHtml(job.cron ?? '')} • مدل ${escapeHtml(job.model ?? '')}</span></span>
              <span class="list-item__meta">${toDigits(job.runs ?? 0)} اجرا • ${job.lastRun ? relativeTime(job.lastRun) : 'بدون اجرا'}</span>
              <span class="badge badge--soft-${job.status === 'paused' ? 'warning' : 'success'}">${job.status === 'paused' ? 'متوقف' : 'فعال'}</span>
              <span class="list-item__meta"><button class="btn btn-light btn-sm" type="button" data-run-job>اجرا</button><button class="btn btn-ghost btn-sm" type="button" data-toggle-job>${job.status === 'paused' ? 'فعال‌سازی' : 'توقف'}</button></span>
            </div>`,
          )
          .join('')}</div></div>
    </div>`,
  );
  on(node, 'click', async (event) => {
    const row = event.target.closest('[data-job]');
    if (!row) return;
    if (event.target.closest('[data-run-job]')) {
      const result = await services.schedulerActions.runNow(row.dataset.job);
      toast.success('کار اجرا شد', `خروجی: ${result.status ?? 'با موفقیت انجام شد'}`);
    }
    if (event.target.closest('[data-toggle-job]')) {
      const result = await services.schedulerActions.toggle(row.dataset.job, row.querySelector('.badge').textContent.includes('فعال') ? 'paused' : 'active');
      toast.info('وضعیت کار تغییر کرد', `وضعیت جدید: ${result.status === 'paused' ? 'متوقف' : 'فعال'}`);
      const badge = row.querySelector('.badge');
      badge.textContent = result.status === 'paused' ? 'متوقف' : 'فعال';
      badge.className = `badge badge--soft-${result.status === 'paused' ? 'warning' : 'success'}`;
    }
  });
  on($('[data-create]', node), 'click', () =>
    openRecordForm({
      resource: 'scheduler',
      title: 'کار زمان‌بندی‌شده جدید',
      fields: [
        { name: 'name', label: 'نام کار', required: true },
        { name: 'cron', label: 'زمان‌بندی', placeholder: '۰ ۹ * * ۱', hint: 'قالب cron' },
        { name: 'model', label: 'مدل', type: 'select', options: ['GPT-4o mini', 'نووا فلش', 'نووا پرو'] },
        { name: 'prompt', label: 'پرامپت', type: 'textarea', col: 2, rows: 3 },
      ],
      onSaved: () => window.location.reload(),
    }),
  );
}

async function aiModels() {
  const node = host();
  const models = await services.modelService.list({ perPage: 20 });
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'مدل‌ها', subtitle: 'مدل‌های متصل و تنظیمات پیش‌فرض', icon: 'cpu', actions: toolButtons({ create: 'افزودن مدل' }) })}
      <div class="grid grid--cards">${(models.items ?? models)
        .map(
          (model) => `<article class="card card--interactive">
            <div class="card__body">
              <div class="d-flex align-items-center gap-3"><span class="tile tile--soft tile--primary tile--icon"><i class="bi bi-cpu"></i></span>
                <div><h3 class="card__title">${escapeHtml(model.name)}</h3><p class="card__subtitle">${escapeHtml(model.provider ?? '')}</p></div>
                <span class="badge badge--soft-${model.status === 'active' ? 'success' : 'neutral'} ms-auto">${model.status === 'active' ? 'فعال' : 'غیرفعال'}</span></div>
              ${infoRows([
                ['پنجره زمینه', `${formatNumber(model.contextWindow ?? 0)} توکن`],
                ['هزینه ورودی', formatCurrency(model.inputPrice ?? 0, 'IRR', { compact: true })],
                ['هزینه خروجی', formatCurrency(model.outputPrice ?? 0, 'IRR', { compact: true })],
                ['پشتیبانی تصویر', model.vision ? 'دارد' : 'ندارد'],
              ])}
              <div class="form-actions form-actions--end mt-3"><button class="btn btn-light btn-sm" type="button" data-model-test="${escapeHtml(model.id)}">تست اتصال</button><button class="btn btn-soft-primary btn-sm" type="button" data-model-default="${escapeHtml(model.id)}">پیش‌فرض کن</button></div>
            </div></article>`,
        )
        .join('')}</div>
    </div>`,
  );
  on(node, 'click', async (event) => {
    const test = event.target.closest('[data-model-test]');
    if (test) {
      const result = await services.aiChat.send({ message: 'تست اتصال' });
      toast.success('اتصال برقرار است', `پاسخ مدل در ${toDigits(result.latency ?? 480)} میلی‌ثانیه دریافت شد.`);
    }
    const def = event.target.closest('[data-model-default]');
    if (def) {
      await services.modelService.patch(def.dataset.modelDefault, { isDefault: true });
      toast.success('مدل پیش‌فرض تغییر کرد', 'همه بخش‌های کارگاه از این مدل استفاده می‌کنند.');
    }
  });
  on($('[data-create]', node), 'click', () =>
    openRecordForm({
      resource: 'models',
      title: 'افزودن مدل',
      fields: [
        { name: 'name', label: 'نام مدل', required: true },
        { name: 'provider', label: 'ارائه‌دهنده', required: true },
        { name: 'contextWindow', label: 'پنجره زمینه', type: 'number', inputMode: 'numeric' },
        { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
      ],
      onSaved: () => window.location.reload(),
    }),
  );
}

async function aiKeys() {
  const node = host();
  const keys = await services.apiKeys.list();
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'کلیدهای API', subtitle: 'کلیدها فقط یک بار نمایش داده می‌شوند — در جای امن نگه دارید', icon: 'key', actions: '<button class="btn btn-primary" type="button" data-create-key><i class="bi bi-plus-lg"></i> کلید جدید</button>' })}
      ${card({
        title: 'کلیدهای فعال',
        flush: true,
        body: `<table class="table table--hover"><thead><tr><th>نام</th><th>کلید</th><th>دسترسی</th><th>آخرین استفاده</th><th></th></tr></thead><tbody>${(keys.items ?? keys)
          .map(
            (key) => `<tr data-key="${escapeHtml(key.id)}"><td>${escapeHtml(key.name)}</td><td class="numeric"><code>${escapeHtml(key.masked ?? `${String(key.token ?? '').slice(0, 8)}••••`)}</code></td>
              <td>${(key.scopes ?? ['read']).map((scope) => `<span class="badge badge--soft-info">${escapeHtml(scope)}</span>`).join(' ')}</td>
              <td>${key.lastUsed ? relativeTime(key.lastUsed) : 'استفاده نشده'}</td>
              <td><button class="icon-btn icon-btn--sm" type="button" data-copy-key title="کپی"><i class="bi bi-clipboard"></i></button><button class="icon-btn icon-btn--sm" type="button" data-rotate-key title="بازتولید"><i class="bi bi-arrow-repeat"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-revoke-key title="حذف"><i class="bi bi-trash3"></i></button></td></tr>`,
          )
          .join('')}</tbody></table>`,
      })}
      ${card({ title: 'نمونه درخواست', body: `<div class="code-block code-block--dark"><div class="code-block__head"><span class="code-block__dots"></span><span>curl</span></div>
        <pre><code>curl -X POST https://api.novaadmin.dev/v1/chat \\
  -H "Authorization: Bearer $NOVA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"nova-flash","messages":[{"role":"user","content":"سلام!"}]}'</code></pre></div>` })}
    </div>`,
  );
  on(node, 'click', async (event) => {
    const copy = event.target.closest('[data-copy-key]');
    if (copy) {
      await navigator.clipboard?.writeText(copy.closest('tr').querySelector('code').textContent);
      toast.success('کپی شد', 'کلید در حافظه موقت قرار گرفت.');
      return;
    }
    const rotate = event.target.closest('[data-rotate-key]');
    if (rotate) {
      const result = await services.apiKeys.rotate(rotate.closest('tr').dataset.key);
      toast.success('کلید بازتولید شد', 'کلید قبلی بلافاصله باطل می‌شود.');
      if (result?.token) {
        modal.alert({ title: 'کلید جدید', text: `این کلید فقط یک بار نمایش داده می‌شود: ${result.token}`, tone: 'primary' });
      }
      return;
    }
    const revoke = event.target.closest('[data-revoke-key]');
    if (revoke) {
      const ok = await modal.confirm({ title: 'حذف کلید', text: 'هر سرویسی که از این کلید استفاده می‌کند از کار می‌افتد.', tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.apiKeys.remove(revoke.closest('tr').dataset.key);
      revoke.closest('tr').remove();
      toast.success('کلید حذف شد', 'دسترسی این کلید بسته شد.');
    }
  });
  on($('[data-create-key]', node), 'click', () =>
    modal
      .prompt({ title: 'کلید API جدید', label: 'نام کلید', placeholder: 'مثلاً: سرور تولید', validate: (value) => (value?.trim() ? null : 'نام کلید الزامی است') })
      .then(async (name) => {
        if (!name) return;
        const created = await services.apiKeys.create({ name, scopes: ['read', 'write'] });
        modal.alert({ title: 'کلید ساخته شد', text: `کلید «${name}» ساخته شد: ${created.token ?? created.masked ?? '—'}`, tone: 'success' });
        toast.success('کلید ایجاد شد', 'کلید جدید در فهرست قابل مشاهده است.');
        setTimeout(() => window.location.reload(), 600);
      }),
  );
}

async function aiHistory() {
  const node = host();
  const [conversations, usage] = await Promise.all([services.conversationService.list(), services.usageService.overview()]);
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'تاریخچه گفتگوها', subtitle: 'همه تعاملات با مدل‌ها، قابل جستجو و حذف', icon: 'clock-history', actions: toolButtons({ exportResource: 'usage' }) })}
      ${card({
        flush: true,
        body: `<table class="table table--hover"><thead><tr><th>عنوان</th><th>پیام‌ها</th><th>مدل</th><th>آخرین به‌روزرسانی</th><th></th></tr></thead><tbody>${conversations
          .map(
            (conversation) => `<tr data-conversation="${escapeHtml(conversation.id)}"><td><div class="table__primary"><i class="bi bi-chat-square-text"></i><div class="table__primary-text"><span class="table__primary-title">${escapeHtml(conversation.title)}</span><span class="table__primary-sub">${escapeHtml(conversation.preview ?? '')}</span></div></div></td>
              <td class="numeric">${toDigits(conversation.messagesCount ?? conversation.messages?.length ?? 0)}</td>
              <td>${escapeHtml(conversation.model ?? 'نووا')}</td>
              <td>${relativeTime(conversation.updatedAt ?? conversation.createdAt)}</td>
              <td class="table__actions"><a class="icon-btn icon-btn--sm" href="ai/chat.html" title="ادامه گفتگو"><i class="bi bi-box-arrow-up-left"></i></a><button class="icon-btn icon-btn--sm" type="button" data-rename><i class="bi bi-pencil"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-delete><i class="bi bi-trash3"></i></button></td></tr>`,
          )
          .join('')}</tbody></table>`,
      })}
      ${card({ body: infoRows([['کل گفتگوها', toDigits(conversations.length)], ['توکن مصرفی کل', formatNumber(usage.tokens?.total ?? 0)], ['هزینه تخمینی', formatCurrency(usage.cost?.total ?? 0, 'IRR')]]) })}
    </div>`,
  );
  on(node, 'click', async (event) => {
    const row = event.target.closest('[data-conversation]');
    if (!row) return;
    if (event.target.closest('[data-rename]')) {
      const name = await modal.prompt({ title: 'تغییر نام گفتگو', label: 'عنوان جدید', value: row.querySelector('.table__primary-title').textContent });
      if (!name) return;
      await services.conversationService.rename(row.dataset.conversation, name);
      row.querySelector('.table__primary-title').textContent = name;
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

async function aiDashboard() {
  const node = host();
  const [usage, conversations, models, jobs] = await Promise.all([
    services.usageService.overview(),
    services.conversationService.list(),
    services.modelService.list({ perPage: 6 }),
    services.schedulerService.list({ perPage: 6 }),
  ]);
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'داشبورد هوش مصنوعی', subtitle: 'تصویر کلی مصرف، مدل‌ها و کارهای خودکار', icon: 'stars', actions: toolButtons({ exportResource: 'usage' }) })}
      ${statsFrom({ tokens: usage.tokens?.total ?? 0, cost: usage.cost?.total ?? 0, conversations: conversations.length, jobs: (jobs.items ?? jobs).length }, [
        ['tokens', 'توکن ماه', 'number', 'primary', 'hash'],
        ['cost', 'هزینه ماه', 'currency', 'warning', 'cash-coin'],
        ['conversations', 'گفتگوها', 'number', 'info', 'chat-dots'],
        ['jobs', 'کارهای زمان‌بندی‌شده', 'number', 'success', 'clock-history'],
      ])}
      <div class="widget-grid">
        ${card({ title: 'روند مصرف', body: `<div class="chart" data-chart="area" data-chart-height="320" data-chart-series='${JSON.stringify([{ name: 'توکن', data: usage.series ?? [] }])}' data-chart-labels='${JSON.stringify(usage.labels ?? [])}'></div>` })}
        ${card({ title: 'توزیع مدل‌ها', body: `<div class="chart" data-chart="donut" data-chart-height="320" data-chart-series='${JSON.stringify((usage.byModel ?? []).map((model) => model.tokens ?? 0))}' data-chart-labels='${JSON.stringify((usage.byModel ?? []).map((model) => model.label ?? ''))}'></div>` })}
      </div>
      <div class="grid grid--2">
        ${card({ title: 'گفتگوهای اخیر', flush: true, body: `<ul class="list-group">${conversations
          .slice(0, 5)
          .map((conversation) => `<li class="list-item"><span class="tile tile--soft tile--icon"><i class="bi bi-chat-square-text"></i></span><span class="list-item__title">${escapeHtml(conversation.title)}<span class="list-item__sub">${relativeTime(conversation.updatedAt ?? conversation.createdAt)}</span></span><span class="list-item__meta"><a class="btn btn-ghost btn-sm" href="ai/chat.html">ادامه</a></span></li>`)
          .join('')}</ul>` })}
        ${card({ title: 'مدل‌های متصل', flush: true, body: `<ul class="list-group">${(models.items ?? models)
          .map((model) => `<li class="list-item"><span class="status-dot status-dot--${model.status === 'active' ? 'online' : 'offline'}"></span><span class="list-item__title">${escapeHtml(model.name)}<span class="list-item__sub">${escapeHtml(model.provider ?? '')}</span></span><span class="list-item__meta">${formatNumber(model.contextWindow ?? 0)} توکن</span></li>`)
          .join('')}</ul>` })}
      </div>
    </div>`,
  );
  initCharts(node);
  exportable(node, 'usage');
}

async function aiPrompts() {
  const node = host();
  const prompts = await services.promptService.list({ perPage: 24 });
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'کتابخانه پرامپت', subtitle: 'پرامپت‌های آماده با متغیرهای قابل جایگذاری', icon: 'bookmark-star', actions: toolButtons({ create: 'پرامپت جدید' }) })}
      <div class="grid grid--cards">${(prompts.items ?? prompts)
        .map(
          (prompt) => `<article class="card card--interactive" data-prompt-card="${escapeHtml(prompt.id)}">
            <div class="card__body">
              <div class="d-flex align-items-center gap-2"><span class="badge badge--soft-primary">${escapeHtml(prompt.categoryLabel ?? prompt.category ?? 'عمومی')}</span>
                <button class="icon-btn icon-btn--sm ms-auto" type="button" data-favorite aria-label="افزودن به علاقه‌مندی‌ها"><i class="bi bi-star${prompt.favorite ? '-fill' : ''}"></i></button></div>
              <h3 class="card__title mt-2">${escapeHtml(prompt.title)}</h3>
              <p class="card__subtitle">${escapeHtml(prompt.description ?? '')}</p>
              <code class="d-block fs-caption text-muted">${escapeHtml((prompt.template ?? prompt.body ?? '').slice(0, 90))}…</code>
              ${infoRows([['استفاده', toDigits(prompt.usage ?? 0)], ['سازنده', escapeHtml(prompt.author ?? 'تیم نووا')]])}
              <div class="form-actions form-actions--end mt-3"><button class="btn btn-light btn-sm" type="button" data-duplicate-prompt><i class="bi bi-files"></i> کپی</button><button class="btn btn-primary btn-sm" type="button" data-run-prompt><i class="bi bi-play"></i> اجرا</button></div>
            </div></article>`,
        )
        .join('')}</div>
    </div>`,
  );
  on(node, 'click', async (event) => {
    const cardNode = event.target.closest('[data-prompt-card]');
    if (!cardNode) return;
    const id = cardNode.dataset.promptCard;
    if (event.target.closest('[data-favorite]')) {
      const icon = $('[data-favorite] i', cardNode);
      const next = !icon.classList.contains('bi-star-fill');
      await services.promptActions.toggleFavorite(id, next);
      icon.className = `bi bi-star${next ? '-fill' : ''}`;
      toast.success(next ? 'به علاقه‌مندی‌ها افزوده شد' : 'از علاقه‌مندی‌ها حذف شد', 'کتابخانه پرامپت به‌روزرسانی شد.');
      return;
    }
    if (event.target.closest('[data-duplicate-prompt]')) {
      await services.promptActions.duplicate(id);
      toast.success('پرامپت کپی شد', 'نسخه کپی در انتهای فهرست قرار گرفت.');
      return;
    }
    if (event.target.closest('[data-run-prompt]')) {
      const detail = await services.promptService.get(id);
      const result = await services.promptActions.run(id, {});
      modal.open({
        title: 'اجرای پرامپت',
        subtitle: detail.title,
        content: `<div class="card"><div class="card__body"><p class="fs-caption text-muted mb-2">پرامپت:</p><code>${escapeHtml(detail.template ?? detail.body ?? '')}</code><hr><p class="mt-3">${escapeHtml(result.output ?? result.text ?? 'خروجی آماده است.')}</p></div></div>`,
        footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button><button type="button" class="btn btn-primary" data-copy-prompt-output>کپی خروجی</button>',
        onMount: (panel) =>
          on($('[data-copy-prompt-output]', panel), 'click', async () => {
            await navigator.clipboard?.writeText(result.output ?? result.text ?? '');
            toast.success('کپی شد', 'خروجی پرامپت در حافظه موقت قرار گرفت.');
          }),
      });
    }
  });
}

export const aiControllers = { initAiWorkspace };
export default aiControllers;
