/**
 * NOVAADMIN — application pages
 * ------------------------------------------------------------------
 * Mail (folders, list, viewer, compose), team chat, calendar, file manager,
 * media library, notifications centre and the CMS screens (pages, posts,
 * categories, tags, media, comments, page builder).
 *
 * Everything runs on `src/services/app.service.js`; the markup contracts are
 * the ones defined in `src/scss/components/_mail|_chat|_files|_calendar.scss`.
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { storage, KEYS } from '../core/storage.js';
import { formatNumber, toDigits } from '../core/numbers.js';
import { formatDate, relativeTime } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import { initCalendar } from '../core/calendar.js';
import * as kit from './kit.js';

const { card, infoRows, timeline, paint, host, pageHeader, formMarkup, collectValues, openRecordForm, exportable, emptyState, statusBadge, toolButtons, statsFrom, chart, services } = kit;

/* ====================================================================== mail */

async function mailClient() {
  const node = host();
  const folders = await services.mailService.folders();
  const query = kit.queryParam('folder', 'inbox');
  const id = kit.queryParam('id');
  render(
    node,
    `<div class="mail-layout">
      <aside class="mail-nav">
        <button class="btn btn-primary w-100 mb-3" type="button" data-compose><i class="bi bi-pencil-square"></i> نامه جدید</button>
        <ul class="mail-nav__list" data-mail-folders>${folders
          .map(
            (folder) => `<li><a class="mail-nav__link ${folder.id === query ? 'is-active' : ''}" href="apps/email.html?folder=${escapeHtml(folder.id)}"><i class="bi bi-${escapeHtml(folder.icon ?? 'folder')}"></i><span>${escapeHtml(folder.label)}</span><span class="mail-nav__count">${toDigits(folder.count ?? 0)}</span></a></li>`,
          )
          .join('')}</ul>
        <p class="mail-nav__labels">برچسب‌ها</p>
        <ul class="mail-nav__list">${['کاری', 'شخصی', 'فاکتور', 'پشتیبانی'].map((label) => `<li><a class="mail-nav__link" href="#"><span class="status-dot status-dot--primary"></span><span>${escapeHtml(label)}</span></a></li>`).join('')}</ul>
      </aside>
      <section class="mail-panel">${id ? '' : `<div class="mail-list" data-mail-list>${kit.skeleton(6)}</div>`}</section>
    </div>`,
  );

  if (id) {
    await renderMailView(node, id);
  } else {
    await renderMailList(node, query);
  }

  on(node, 'click', async (event) => {
    if (event.target.closest('[data-compose]')) {
      openCompose();
      return;
    }
    const star = event.target.closest('[data-star]');
    if (star) {
      event.preventDefault();
      const result = await services.mailService.toggleStar(star.dataset.star);
      star.classList.toggle('is-starred', result.starred);
      return;
    }
    const item = event.target.closest('[data-mail-item]');
    if (item) {
      window.location.href = `apps/email.html?folder=${encodeURIComponent(query)}&id=${encodeURIComponent(item.dataset.mailItem)}`;
      return;
    }
    const remove = event.target.closest('[data-mail-delete]');
    if (remove) {
      const ok = await modal.confirm({ title: 'حذف نامه', text: 'نامه به سطل زباله منتقل می‌شود.', tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.mailService.remove(remove.dataset.mailDelete);
      toast.success('نامه حذف شد', 'می‌توانید آن را از سطل زباله بازگردانید.');
      window.location.href = `apps/email.html?folder=${encodeURIComponent(query)}`;
    }
  });
}

async function renderMailList(node, folder) {
  const host2 = $('[data-mail-list]', node);
  const result = await services.mailService.list({ folder, perPage: 20 });
  const items = result.items ?? result;
  if (!items.length) {
    render(host2, emptyState({ title: 'پوشه خالی است', text: 'نامه‌ای در این پوشه وجود ندارد.', icon: 'envelope-open' }));
    return;
  }
  render(
    host2,
    `${items
      .map(
        (mail) => `<article class="mail-item ${mail.read ? '' : 'is-unread'}" data-mail-item="${escapeHtml(mail.id)}" tabindex="0">
          <label class="mail-item__check"><input type="checkbox" class="form-check-input" aria-label="انتخاب نامه"></label>
          <button class="mail-item__star ${mail.starred ? 'is-starred' : ''}" type="button" data-star="${escapeHtml(mail.id)}" aria-label="ستاره"><i class="bi bi-star${mail.starred ? '-fill' : ''}"></i></button>
          <div class="mail-item__body">
            <div class="mail-item__from"><span class="avatar avatar--xs">${escapeHtml((mail.from ?? '؟').slice(0, 1))}</span>${escapeHtml(mail.from)}</div>
            <div class="mail-item__subject">${escapeHtml(mail.subject)}<span class="text-muted"> — ${escapeHtml((mail.preview ?? '').slice(0, 70))}</span></div>
            <div class="mail-item__meta">${mail.hasAttachment ? '<i class="bi bi-paperclip"></i>' : ''}<span>${relativeTime(mail.receivedAt)}</span></div>
          </div>
          ${mail.label ? `<span class="mail-item__label badge badge--soft-primary">${escapeHtml(mail.label)}</span>` : ''}
        </article>`,
      )
      .join('')}
    <div class="load-more"><button class="btn btn-light btn-sm" type="button" data-load-more>بارگذاری بیشتر</button></div>`,
  );
}

async function renderMailView(node, id) {
  const panel = $('.mail-panel', node);
  const mail = await services.mailService.get(id);
  await services.mailService.toggleRead(id, true);
  render(
    panel,
    `<article class="mail-view">
      <header class="mail-view__head">
        <div class="mail-toolbar">
          <a class="icon-btn" href="apps/email.html" aria-label="بازگشت"><i class="bi bi-arrow-right"></i></a>
          <button class="icon-btn" type="button" data-mail-reply aria-label="پاسخ"><i class="bi bi-reply"></i></button>
          <button class="icon-btn" type="button" data-mail-forward aria-label="هدایت"><i class="bi bi-forward"></i></button>
          <span class="mail-toolbar__spacer"></span>
          <button class="icon-btn icon-btn--danger" type="button" data-mail-delete="${escapeHtml(id)}" aria-label="حذف"><i class="bi bi-trash3"></i></button>
        </div>
        <h1 class="mail-view__subject">${escapeHtml(mail.subject)}</h1>
        <div class="mail-view__meta">
          <img class="avatar avatar--sm" src="assets/img/avatars/avatar-04.svg" alt="">
          <div><strong>${escapeHtml(mail.from)}</strong><span class="list-item__sub">${escapeHtml(mail.fromEmail ?? '')}</span></div>
          <span class="ms-auto text-muted fs-caption">${formatDate(mail.receivedAt, { format: 'long' })}</span>
        </div>
      </header>
      <div class="mail-view__body">${(mail.body ?? '').split('\n').map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>
      ${mail.hasAttachment ? `<div class="mail-view__attachments">${['گزارش-ماهانه.pdf', 'داده-فروش.xlsx'].map((file) => `<a class="mail-attachment" href="#" data-attachment="${escapeHtml(file)}"><i class="bi bi-file-earmark-text"></i><span><strong>${escapeHtml(file)}</strong><small>۲۴۰ کیلوبایت</small></span></a>`).join('')}</div>` : ''}
      <div class="mail-reply">
        <div class="mail-reply__body" contenteditable="true" data-reply-body><p>${escapeHtml(mail.from)} عزیز،</p><p>ممنون از پیام شما…</p></div>
        <div class="mail-reply__foot"><button class="btn btn-primary" type="button" data-send-reply><i class="bi bi-send"></i> ارسال پاسخ</button><button class="btn btn-light" type="button" data-canned>پاسخ آماده</button></div>
      </div>
    </article>`,
  );

  on($('[data-send-reply]', panel), 'click', async () => {
    const text = $('[data-reply-body]', panel).textContent.trim();
    await services.mailService.send({ to: mail.fromEmail ?? mail.from, subject: `Re: ${mail.subject}`, body: text });
    toast.success('پاسخ ارسال شد', 'نامه در پوشه ارسالی ثبت شد.');
  });
  on($('[data-canned]', panel), 'click', () => {
    $('[data-reply-body]', panel).innerHTML = '<p>سلام،</p><p>درخواست شما ثبت شد و تیم پشتیبانی تا پایان امروز پاسخ می‌دهد.</p><p>با احترام، تیم نووا</p>';
    toast.info('پاسخ آماده درج شد', 'متن قابل ویرایش است.');
  });
  on($('[data-attachment]', panel), 'click', (event) => {
    event.preventDefault();
    toast.info('دانلود پیوست', 'در نسخه نمایشی فایل واقعی دانلود نمی‌شود.');
  });
  on($('[data-mail-reply]', panel), 'click', () => $('[data-reply-body]', panel).focus());
  on($('[data-mail-forward]', panel), 'click', () => openCompose({ subject: `Fwd: ${mail.subject}`, body: mail.body }));
}

function openCompose(prefill = {}) {
  modal.open({
    title: 'نامه جدید',
    size: 'lg',
    content: `<form data-compose-form class="form-stack">
      ${formMarkup([
        { name: 'to', label: 'گیرنده', type: 'email', rule: 'email', required: true, placeholder: 'name@company.com' },
        { name: 'cc', label: 'رونوشت', type: 'email', rule: 'email' },
        { name: 'subject', label: 'موضوع', required: true, col: 2 },
      ], prefill)}
      <div class="form-field"><label class="form-label" for="compose-body">متن نامه</label>
        <div class="editor"><div class="editor-toolbar"><button class="icon-btn icon-btn--sm" type="button" aria-label="پررنگ"><i class="bi bi-type-bold"></i></button><button class="icon-btn icon-btn--sm" type="button" aria-label="فهرست"><i class="bi bi-list-ul"></i></button><button class="icon-btn icon-btn--sm" type="button" data-compose-emoji aria-label="ایموجی"><i class="bi bi-emoji-smile"></i></button><span class="editor-toolbar__divider"></span><button class="icon-btn icon-btn--sm" type="button" data-compose-attach aria-label="پیوست"><i class="bi bi-paperclip"></i></button></div>
          <div class="editor-body" contenteditable="true" id="compose-body" data-compose-body>${escapeHtml(prefill.body ?? '')}</div></div></div>
    </form>`,
    footer: '<button type="button" class="btn btn-light" data-modal-close>انصراف</button><button type="button" class="btn btn-light" data-save-draft><i class="bi bi-file-earmark"></i> پیش‌نویس</button><button type="button" class="btn btn-primary" data-send-mail><i class="bi bi-send"></i> ارسال</button>',
    onMount: (panel) => {
      on($('[data-send-mail]', panel), 'click', async () => {
        const form = $('[data-compose-form]', panel);
        const { validateForm } = await import('../core/form.js');
        if (!validateForm(form).valid) {
          toast.warning('فرم ناقص است', 'گیرنده و موضوع را وارد کنید.');
          return;
        }
        const values = collectValues(form);
        await services.mailService.send({ ...values, body: $('[data-compose-body]', panel).textContent.trim() });
        toast.success('نامه ارسال شد', 'در پوشه ارسالی قابل مشاهده است.');
        modal.closeTop();
      });
      on($('[data-save-draft]', panel), 'click', async () => {
        const form = $('[data-compose-form]', panel);
        await services.mailService.saveDraft({ ...collectValues(form), body: $('[data-compose-body]', panel).textContent.trim() });
        toast.info('پیش‌نویس ذخیره شد', 'می‌توانید بعداً آن را کامل کنید.');
      });
      on($('[data-compose-emoji]', panel), 'click', () => {
        $('[data-compose-body]', panel).insertAdjacentText('beforeend', ' 🙂 ');
      });
      on($('[data-compose-attach]', panel), 'click', () => toast.info('پیوست', 'انتخاب فایل در نسخه نمایشی غیرفعال است.'));
    },
  });
}

/* ====================================================================== chat */

async function chatApp() {
  const node = host();
  const conversations = await services.chatAppService.list();
  const presence = await services.chatAppService.presence();
  render(
    node,
    `<div class="chat-layout">
      <aside class="chat-sidebar">
        <div class="chat-sidebar__head">
          <div class="input-group input-group--icon"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجوی همکار" data-chat-filter></div>
          <div class="ai-chip-row">${presence
            .slice(0, 6)
            .map((person) => `<button type="button" class="ai-chip" data-presence="${escapeHtml(person.id)}" title="${escapeHtml(person.name)} — ${person.status}"><img class="avatar avatar--xs" src="${escapeHtml(person.avatar)}" alt=""><span class="avatar__status avatar__status--${person.status === 'online' ? 'online' : person.status === 'busy' ? 'busy' : person.status === 'away' ? 'away' : 'offline'}"></span></button>`)
            .join('')}</div>
        </div>
        <div class="chat-sidebar__list">${conversations
          .map(
            (conversation, index) => `<button type="button" class="chat-contact ${index === 0 ? 'is-active' : ''}" data-chat="${escapeHtml(conversation.id)}">
              <img class="avatar avatar--sm" src="${escapeHtml(conversation.avatar ?? 'assets/img/avatars/avatar-02.svg')}" alt="">
              <span class="chat-contact__top"><span class="chat-contact__name">${escapeHtml(conversation.name ?? conversation.title)}</span><span class="chat-contact__time">${relativeTime(conversation.updatedAt ?? conversation.createdAt)}</span></span>
              <span class="chat-contact__preview">${escapeHtml(conversation.preview ?? conversation.lastMessage ?? '')}</span>
              ${conversation.unread ? `<span class="chat-contact__unread">${toDigits(conversation.unread)}</span>` : ''}
            </button>`,
          )
          .join('')}</div>
      </aside>

      <section class="chat-panel">
        <header class="chat-panel__head">
          <div><h1 class="chat-panel__title" data-chat-name>${escapeHtml(conversations[0]?.name ?? 'گفتگو')}</h1><p class="chat-panel__sub" data-chat-status>آنلاین</p></div>
          <div class="chat-panel__actions"><button class="icon-btn" type="button" data-chat-call aria-label="تماس"><i class="bi bi-telephone"></i></button><button class="icon-btn" type="button" data-chat-video aria-label="تماس تصویری"><i class="bi bi-camera-video"></i></button><button class="icon-btn" type="button" data-chat-info aria-label="اطلاعات"><i class="bi bi-info-circle"></i></button></div>
        </header>
        <div class="chat-stream" data-chat-stream>${await chatStreamMarkup(conversations[0]?.id)}</div>
        <form class="chat-composer" data-chat-composer>
          <textarea class="chat-composer__input" rows="1" name="message" placeholder="پیام خود را بنویسید…" aria-label="متن پیام"></textarea>
          <div class="chat-composer__row">
            <div class="chat-composer__tools">
              <button class="icon-btn icon-btn--sm" type="button" data-chat-attach aria-label="پیوست"><i class="bi bi-paperclip"></i></button>
              <button class="icon-btn icon-btn--sm" type="button" data-chat-emoji aria-label="ایموجی"><i class="bi bi-emoji-smile"></i></button>
              <button class="icon-btn icon-btn--sm" type="button" data-chat-file aria-label="فایل"><i class="bi bi-file-earmark-arrow-up"></i></button>
            </div>
            <span class="chat-composer__hint">Enter برای ارسال</span>
            <button class="btn btn-primary btn-sm" type="submit"><i class="bi bi-send"></i> ارسال</button>
          </div>
        </form>
      </section>
    </div>`,
  );

  let active = conversations[0]?.id;
  const stream = $('[data-chat-stream]', node);
  const scroll = () => {
    stream.scrollTop = stream.scrollHeight;
  };
  scroll();

  on(node, 'click', async (event) => {
    const contact = event.target.closest('[data-chat]');
    if (contact) {
      active = contact.dataset.chat;
      $$('[data-chat]', node).forEach((item) => item.classList.toggle('is-active', item === contact));
      $('[data-chat-name]', node).textContent = $('.chat-contact__name', contact).textContent;
      render(stream, await chatStreamMarkup(active));
      scroll();
      return;
    }
    if (event.target.closest('[data-chat-emoji]')) {
      $('.chat-composer__input', node).value += ' 🙂';
      return;
    }
    if (event.target.closest('[data-chat-call]')) toast.info('تماس صوتی', 'در نسخه نمایشی تماس برقرار نمی‌شود.');
    if (event.target.closest('[data-chat-video]')) toast.info('تماس تصویری', 'این قابلیت به سرویس ویدیوکنفرانس متصل می‌شود.');
    if (event.target.closest('[data-chat-info]')) {
      const conversation = conversations.find((item) => item.id === active);
      modal.open({
        title: 'اطلاعات گفتگو',
        size: 'md',
        content: `<div class="text-center mb-3"><img class="avatar avatar--2xl" src="${escapeHtml(conversation?.avatar ?? 'assets/img/avatars/avatar-02.svg')}" alt=""><h3 class="mt-3">${escapeHtml(conversation?.name ?? '')}</h3><p class="text-muted">${escapeHtml(conversation?.role ?? '')}</p></div>
          ${infoRows([['شناسه', escapeHtml(active ?? '')], ['پیام‌ها', toDigits(conversation?.messages?.length ?? 0)], ['فایل‌های اشتراکی', toDigits(conversation?.files ?? 0)]])}`,
        footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button><button type="button" class="btn btn-soft-danger" data-clear-chat>پاک کردن تاریخچه</button>',
        onMount: (panel) =>
          on($('[data-clear-chat]', panel), 'click', async () => {
            const ok = await modal.confirm({ title: 'پاک کردن تاریخچه', text: 'همه پیام‌های این گفتگو حذف می‌شود.', tone: 'danger' });
            if (!ok) return;
            await services.chatAppService.remove(active);
            render(stream, emptyState({ title: 'تاریخچه پاک شد', text: 'می‌توانید گفتگو را از ابتدا شروع کنید.', icon: 'chat-square-dots' }));
            modal.closeTop();
          }),
      });
    }
  });

  on($('[data-chat-composer]', node), 'submit', async (event) => {
    event.preventDefault();
    const input = $('[name="message"]', event.currentTarget);
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    stream.insertAdjacentHTML('beforeend', `<article class="msg msg--out"><span class="msg__avatar"><img class="avatar avatar--sm" src="assets/img/avatars/avatar-08.svg" alt=""></span><div class="msg__body"><header class="msg__meta"><strong>شما</strong><time>همین حالا</time></header><div class="msg__bubble">${escapeHtml(text)}</div></div></article>`);
    scroll();
    await services.chatAppService.send(active, text);
    stream.insertAdjacentHTML('beforeend', `<div class="chat-typing" data-chat-typing><span></span><span></span><span></span></div>`);
    scroll();
    setTimeout(async () => {
      $('[data-chat-typing]', stream)?.remove();
      const reply = await services.chatAppService.list();
      const person = reply.find((item) => item.id === active);
      const text2 = person?.autoReply ?? 'دریافت شد، بررسی می‌کنم و به‌زودی پاسخ می‌دهم.';
      stream.insertAdjacentHTML('beforeend', `<article class="msg msg--in"><span class="msg__avatar"><img class="avatar avatar--sm" src="${escapeHtml(person?.avatar ?? 'assets/img/avatars/avatar-02.svg')}" alt=""></span><div class="msg__body"><header class="msg__meta"><strong>${escapeHtml(person?.name ?? 'همکار')}</strong><time>همین حالا</time></header><div class="msg__bubble">${escapeHtml(text2)}</div></div></article>`);
      scroll();
    }, 900);
  });

  on($('.chat-composer__input', node), 'keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      $('[data-chat-composer]', node).requestSubmit();
    }
  });
  on($('[data-chat-filter]', node), 'input', (event) => {
    const term = event.target.value.trim();
    $$('[data-chat]', node).forEach((item) => {
      item.hidden = term ? !item.textContent.includes(term) : false;
    });
  });
  on(node, 'click', (event) => {
    if (event.target.closest('[data-chat-attach]') || event.target.closest('[data-chat-file]')) toast.info('اشتراک فایل', 'انتخاب فایل در نسخه نمایشی غیرفعال است.');
  });
}

async function chatStreamMarkup(conversationId) {
  if (!conversationId) return emptyState({ title: 'گفتگویی انتخاب نشده است', icon: 'chat-square' });
  const detail = await services.chatAppService.get(conversationId);
  const messages = detail?.messages ?? [];
  if (!messages.length) return emptyState({ title: 'اینجا ساکت است', text: 'اولین پیام را بفرستید.', icon: 'chat-square-dots' });
  return `${messages
    .map(
      (message, index) => `${index === 0 ? `<div class="chat-day-divider"><span>${formatDate(message.at, { format: 'medium' })}</span></div>` : ''}
      <article class="msg ${message.from === 'me' ? 'msg--out' : 'msg--in'}">
        <span class="msg__avatar"><img class="avatar avatar--sm" src="${escapeHtml(message.from === 'me' ? 'assets/img/avatars/avatar-08.svg' : detail.avatar ?? 'assets/img/avatars/avatar-02.svg')}" alt=""></span>
        <div class="msg__body"><header class="msg__meta"><strong>${message.from === 'me' ? 'شما' : escapeHtml(detail.name ?? 'همکار')}</strong><time>${relativeTime(message.at)}</time></header>
        <div class="msg__bubble">${escapeHtml(message.text)}</div></div>
      </article>`,
    )
    .join('')}`;
}

/* ================================================================== calendar */

async function calendarApp() {
  const node = host();
  const [categories, upcoming] = await Promise.all([services.calendarService.categories(), services.calendarService.upcoming()]);
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: 'تقویم',
        subtitle: 'نمای ماه، هفته، روز و فهرست — با پشتیبانی شمسی و میلادی و جابجایی رویدادها',
        icon: 'calendar3',
        actions: `<div class="segmented" data-calendar-views><button type="button" class="segmented__item is-active" data-view="month">ماه</button><button type="button" class="segmented__item" data-view="week">هفته</button><button type="button" class="segmented__item" data-view="day">روز</button><button type="button" class="segmented__item" data-view="agenda">فهرست</button></div>
          <button class="btn btn-primary" type="button" data-calendar-new><i class="bi bi-plus-lg"></i> رویداد جدید</button>`,
      })}
      <div class="calendar-shell" data-calendar data-calendar-view="month" data-calendar-resource="calendar">
        <div class="calendar__toolbar">
          <div class="calendar__nav">
            <button class="icon-btn" type="button" data-calendar-prev aria-label="قبلی"><i class="bi bi-chevron-right"></i></button>
            <button class="icon-btn" type="button" data-calendar-next aria-label="بعدی"><i class="bi bi-chevron-left"></i></button>
            <button class="btn btn-light btn-sm" type="button" data-calendar-today>امروز</button>
          </div>
          <h2 class="calendar__title" data-calendar-title></h2>
          <div class="calendar__actions"><span class="badge badge--soft-primary" data-calendar-count></span><button class="btn btn-light btn-sm" type="button" data-calendar-export><i class="bi bi-download"></i> خروجی</button></div>
        </div>
        <div class="calendar__filters" data-calendar-categories></div>
        <div class="calendar-grid-shell">
          <div data-calendar-grid class="calendar"></div>
          <aside class="calendar-side">
            <div data-calendar-mini class="calendar-mini"></div>
            ${card({ title: 'رویدادهای پیش‌رو', flush: true, body: `<ul class="list-group">${(upcoming ?? [])
              .slice(0, 6)
              .map((event) => `<li class="list-item"><span class="status-dot status-dot--${event.tone ?? 'primary'}"></span><span class="list-item__title">${escapeHtml(event.title)}<span class="list-item__sub">${formatDate(event.startAt, { format: 'medium' })} • ${escapeHtml(event.time ?? '')}</span></span></li>`)
              .join('')}</ul>` })}
          </aside>
        </div>
      </div>
    </div>`,
  );

  initCalendar($('[data-calendar]', node));
  on(node, 'click', (event) => {
    if (!event.target.closest('[data-calendar-new]')) return;
    const grid = $('[data-calendar-grid]', node);
    const slot = $('[data-calendar-slot]', grid);
    slot?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  initCharts(node);
}

/* ============================================================== file manager */

async function fileManager() {
  const node = host();
  const [files, storageInfo] = await Promise.all([services.fileService.list({ perPage: 20 }), services.mediaService.list({ perPage: 1 })]);
  const items = files.items ?? files;
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: 'مدیریت فایل',
        subtitle: 'نمای شبکه‌ای و فهرستی با اشتراک‌گذاری، تغییر نام و حذف گروهی',
        icon: 'folder2-open',
        actions: toolButtons({ extra: '<button class="btn btn-light" type="button" data-new-folder><i class="bi bi-folder-plus"></i> پوشه جدید</button><label class="btn btn-primary"><i class="bi bi-cloud-arrow-up"></i> بارگذاری<input type="file" hidden data-upload></label>' }),
      })}
      <div class="files-layout">
        <aside class="files-nav">
          <ul class="files-nav__list">${[
            ['همه فایل‌ها', 'folder2-open', items.length],
            ['مورد علاقه', 'star', 6],
            ['اشتراک‌گذاشته‌شده', 'share', 3],
            ['سطل زباله', 'trash3', 2],
          ]
            .map(([label, icon, count], index) => `<li><a class="files-nav__link ${index === 0 ? 'is-active' : ''}" href="#"><i class="bi bi-${icon}"></i><span>${label}</span><span class="files-nav__meta">${toDigits(count)}</span></a></li>`)
            .join('')}</ul>
          <div class="files-storage">
            <p class="files-storage__title">فضای ذخیره‌سازی</p>
            <div class="progress progress--sm"><div class="progress-bar" style="width:${Math.min(100, storageInfo.storage?.used ?? 68)}%"></div></div>
            <p class="files-storage__text">${toDigits(storageInfo.storage?.used ?? 68)}٪ از ${toDigits(storageInfo.storage?.total ?? 200)} گیگابایت</p>
          </div>
        </aside>
        <section class="files-panel">
          <div class="files-breadcrumb"><a href="#">خانه</a><i class="bi bi-chevron-left"></i><a href="#">اسناد</a><i class="bi bi-chevron-left"></i><span>۱۴۰۵</span></div>
          <div class="d-flex align-items-center gap-2 mb-3">
            <div class="input-group input-group--icon" style="max-width:22rem"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجوی فایل" data-file-search></div>
            <div class="view-switch ms-auto" data-view-switch="files"><button class="view-switch__btn is-active" type="button" data-view="grid" aria-label="نمای شبکه‌ای"><i class="bi bi-grid"></i></button><button class="view-switch__btn" type="button" data-view="list" aria-label="نمای فهرستی"><i class="bi bi-list-ul"></i></button></div>
          </div>
          <div class="files-grid" data-files-grid>${items
            .slice(0, 16)
            .map((file) => fileCard(file))
            .join('')}</div>
        </section>
      </div>
    </div>`,
  );

  on($('[data-file-search]', node), 'input', (event) => {
    const term = event.target.value.trim();
    $$('.file-card', node).forEach((item) => {
      item.hidden = term ? !item.textContent.includes(term) : false;
    });
  });
  on($('[data-new-folder]', node), 'click', async () => {
    const name = await modal.prompt({ title: 'پوشه جدید', label: 'نام پوشه', validate: (value) => (value?.trim() ? null : 'نام پوشه الزامی است') });
    if (!name) return;
    await services.fileActions.createFolder(name, null);
    toast.success('پوشه ساخته شد', `پوشه «${name}» ایجاد شد.`);
  });
  on($('[data-upload]', node), 'change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await services.fileService.create({ name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, type: file.type || 'file' });
    toast.success('بارگذاری انجام شد', `${file.name} به فهرست افزوده شد.`);
    $('[data-files-grid]', node).insertAdjacentHTML('afterbegin', fileCard({ name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, type: file.type, at: new Date().toISOString() }));
  });
  on($('[data-files-grid]', node), 'click', async (event) => {
    const card2 = event.target.closest('.file-card');
    if (!card2) return;
    if (event.target.closest('[data-file-rename]')) {
      const name = await modal.prompt({ title: 'تغییر نام', label: 'نام جدید', value: card2.dataset.name });
      if (!name) return;
      await services.fileActions.rename(card2.dataset.id, name);
      card2.querySelector('.file-card__name').textContent = name;
      toast.success('نام تغییر کرد', 'نام جدید ذخیره شد.');
      return;
    }
    if (event.target.closest('[data-file-share]')) {
      await services.fileActions.toggleShare(card2.dataset.id);
      toast.success('اشتراک‌گذاری به‌روزرسانی شد', 'پیوند اشتراک کپی شد.');
      return;
    }
    if (event.target.closest('[data-file-delete]')) {
      const ok = await modal.confirm({ title: 'حذف فایل', text: 'فایل به سطل زباله منتقل می‌شود.', tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.fileActions.remove(card2.dataset.id);
      card2.remove();
      toast.success('فایل حذف شد', 'فایل به سطل زباله منتقل شد.');
      return;
    }
    card2.classList.toggle('is-selected');
  });
  exportable(node, 'files');
}

const fileCard = (file) => `<figure class="file-card" data-id="${escapeHtml(file.id ?? file.name)}" data-name="${escapeHtml(file.name)}">
    <div class="file-card__thumb">${/image|png|jpg|svg/i.test(file.type ?? '') ? `<img src="${escapeHtml(file.url ?? 'assets/img/products/product-03.svg')}" alt="" loading="lazy">` : `<span class="file-card__icon file-card__icon--${/pdf/i.test(file.type ?? '') ? 'pdf' : /sheet|xls|csv/i.test(file.type ?? '') ? 'sheet' : 'folder'}"><i class="bi bi-${/image/i.test(file.type ?? '') ? 'file-earmark-image' : /pdf/i.test(file.type ?? '') ? 'file-earmark-pdf' : 'file-earmark-text'}"></i></span>`}</div>
    <figcaption class="file-card__meta"><span class="file-card__name">${escapeHtml(file.name)}</span><span class="list-item__sub">${escapeHtml(file.size ?? '')} • ${file.at ? relativeTime(file.at) : ''}</span></figcaption>
    <div class="file-card__check"><button class="icon-btn icon-btn--sm" type="button" data-file-share aria-label="اشتراک‌گذاری"><i class="bi bi-share"></i></button><button class="icon-btn icon-btn--sm" type="button" data-file-rename aria-label="تغییر نام"><i class="bi bi-pencil"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-file-delete aria-label="حذف"><i class="bi bi-trash3"></i></button></div>
  </figure>`;

/* ============================================================== media library */

async function mediaLibrary() {
  const node = host();
  const media = await services.mediaService.list({ perPage: 24 });
  const items = media.items ?? media;
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: 'کتابخانه رسانه',
        subtitle: 'تصاویر، ویدیو و اسناد با برچسب‌گذاری و انتخاب گروهی',
        icon: 'images',
        actions: `<button class="btn btn-soft-danger" type="button" data-media-delete-selected disabled><i class="bi bi-trash3"></i> حذف انتخاب‌شده‌ها</button><label class="btn btn-primary"><i class="bi bi-cloud-arrow-up"></i> بارگذاری<input type="file" hidden multiple accept="image/*" data-media-upload></label>`,
      })}
      <div class="card"><div class="card__body">
        <div class="filter-bar">
          <div class="input-group input-group--icon"><i class="bi bi-search"></i><input class="form-control" type="search" placeholder="جستجوی فایل رسانه" data-media-search></div>
          <div class="chip-row">${['همه', 'تصویر', 'ویدیو', 'سند', 'صوت'].map((type, index) => `<button class="chip chip--filter ${index === 0 ? 'is-active' : ''}" type="button" data-media-type="${type}">${type}</button>`).join('')}</div>
        </div>
        <div class="files-grid" data-media-grid>${items.map((item) => mediaCard(item)).join('')}</div>
      </div></div>
    </div>`,
  );

  const updateSelectionButtons = () => {
    const count = $$('.file-card.is-selected', node).length;
    const button = $('[data-media-delete-selected]', node);
    button.disabled = count === 0;
    button.innerHTML = `<i class="bi bi-trash3"></i> حذف ${toDigits(count)} مورد`;
  };
  on($('[data-media-grid]', node), 'click', (event) => {
    const card2 = event.target.closest('.file-card');
    if (!card2) return;
    card2.classList.toggle('is-selected');
    updateSelectionButtons();
  });
  on($('[data-media-search]', node), 'input', (event) => {
    const term = event.target.value.trim();
    $$('.file-card', node).forEach((item) => {
      item.hidden = term ? !item.textContent.includes(term) : false;
    });
  });
  on(node, 'click', async (event) => {
    const type = event.target.closest('[data-media-type]');
    if (type) {
      $$('[data-media-type]', node).forEach((item) => item.classList.toggle('is-active', item === type));
      const label = type.dataset.mediaType;
      $$('.file-card', node).forEach((card2) => {
        card2.hidden = label !== 'همه' && !card2.dataset.type?.includes(label);
      });
      return;
    }
    if (event.target.closest('[data-media-delete-selected]')) {
      const selected = $$('.file-card.is-selected', node);
      if (!selected.length) return;
      const ok = await modal.confirm({ title: 'حذف موارد انتخاب‌شده', text: `${toDigits(selected.length)} فایل حذف می‌شود.`, tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.mediaActions.remove(selected.map((item) => item.dataset.id));
      selected.forEach((item) => item.remove());
      updateSelectionButtons();
      toast.success('حذف انجام شد', 'موارد انتخاب‌شده از کتابخانه حذف شدند.');
    }
  });
  on($('[data-media-upload]', node), 'change', async (event) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const results = await Promise.all(files.map((file) => services.mediaActions.upload({ name: file.name, size: `${Math.round(file.size / 1024)} KB`, type: file.type })));
    results.forEach((result) => $('[data-media-grid]', node).insertAdjacentHTML('afterbegin', mediaCard(result)));
    toast.success('بارگذاری انجام شد', `${toDigits(files.length)} فایل افزوده شد.`);
  });
}

const mediaCard = (item) => `<figure class="file-card" data-id="${escapeHtml(item.id ?? item.name)}" data-type="${escapeHtml(String(item.type ?? ''))}">
    <div class="file-card__thumb"><img src="${escapeHtml(item.url ?? 'assets/img/products/product-05.svg')}" alt="${escapeHtml(item.name ?? '')}" loading="lazy"></div>
    <figcaption class="file-card__meta"><span class="file-card__name">${escapeHtml(item.name ?? '')}</span><span class="list-item__sub">${escapeHtml(item.size ?? '')} • ${escapeHtml(item.dimensions ?? '')}</span></figcaption>
  </figure>`;

/* ============================================================ notifications */

async function notificationsPage() {
  const node = host();
  const items = await services.notificationService.list();
  const read = storage.get(KEYS.notificationsRead, []) ?? [];
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: 'مرکز اعلان‌ها',
        subtitle: 'همه رویدادهای سیستم، قابل فیلتر و علامت‌گذاری',
        icon: 'bell',
        actions: '<button class="btn btn-light" type="button" data-mark-all><i class="bi bi-check2-all"></i> همه خوانده شد</button><button class="btn btn-soft-danger" type="button" data-clear-all><i class="bi bi-trash3"></i> پاک کردن همه</button>',
      })}
      <div class="filter-bar">${['همه', 'خوانده‌نشده', 'سیستم', 'مالی', 'پروژه'].map((group, index) => `<button class="chip chip--filter ${index === 0 ? 'is-active' : ''}" type="button" data-notif-filter="${group}">${group}</button>`).join('')}</div>
      <div class="card"><div class="card__body" data-notif-list>${items
        .map(
          (item) => `<div class="list-item ${read.includes(item.id) ? '' : 'list-item--interactive'}" data-notif="${escapeHtml(item.id)}" data-group="${escapeHtml(item.type)}">
            <span class="notification-item__icon notification-item__icon--${escapeHtml(item.type)}"><i class="bi bi-${item.type === 'success' ? 'check2-circle' : item.type === 'warning' ? 'exclamation-triangle' : item.type === 'danger' ? 'x-octagon' : 'info-circle'}"></i></span>
            <span class="list-item__title">${escapeHtml(item.title)}<span class="list-item__sub">${escapeHtml(item.text)}</span></span>
            <span class="list-item__meta">${item.at ? relativeTime(item.at) : 'همین حالا'}${read.includes(item.id) ? '' : '<span class="badge badge--soft-primary">جدید</span>'}</span>
          </div>`,
        )
        .join('')}</div></div>
    </div>`,
  );

  on(node, 'click', async (event) => {
    const filter = event.target.closest('[data-notif-filter]');
    if (filter) {
      $$('[data-notif-filter]', node).forEach((item) => item.classList.toggle('is-active', item === filter));
      const group = filter.dataset.notifFilter;
      $$('[data-notif]', node).forEach((item) => {
        item.hidden = group === 'خوانده‌نشده' ? !item.classList.contains('list-item--interactive') : group !== 'همه' && item.dataset.group !== group;
      });
      return;
    }
    if (event.target.closest('[data-mark-all]')) {
      storage.set(KEYS.notificationsRead, items.map((item) => item.id));
      $$('[data-notif]', node).forEach((item) => {
        item.classList.remove('list-item--interactive');
        item.querySelector('.badge')?.remove();
      });
      await services.notificationService.markAllRead();
      toast.success('همه اعلان‌ها خوانده شد', 'نشانگر هدر به‌روزرسانی شد.');
      bus.emit(EVENTS.notifications, { readAll: true });
      return;
    }
    if (event.target.closest('[data-clear-all]')) {
      const ok = await modal.confirm({ title: 'پاک کردن اعلان‌ها', text: 'همه اعلان‌ها از فهرست حذف می‌شوند.', tone: 'danger', confirmText: 'پاک کن' });
      if (!ok) return;
      await Promise.all(items.map((item) => services.notificationService.remove(item.id)));
      render($('[data-notif-list]', node), emptyState({ title: 'اعلانی وجود ندارد', text: 'هر رویداد جدید اینجا نمایش داده می‌شود.', icon: 'bell-slash' }));
      bus.emit(EVENTS.notifications, { cleared: true });
      toast.success('فهرست پاک شد', 'اعلان‌ها حذف شدند.');
      return;
    }
    const row = event.target.closest('[data-notif]');
    if (row) {
      row.classList.remove('list-item--interactive');
      row.querySelector('.badge')?.remove();
      const current = storage.get(KEYS.notificationsRead, []) ?? [];
      storage.set(KEYS.notificationsRead, [...new Set([...current, row.dataset.notif])]);
      await services.notificationService.markRead(row.dataset.notif);
    }
  });
}

/* ====================================================================== CMS */

export async function initCms() {
  const page = kit.pageId();
  const node = host();
  if (!node) return;

  if (page === 'cms/page-builder.html') {
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'صفحه‌ساز',
          subtitle: 'بلوک‌ها را بکشید و رها کنید — خروجی HTML قابل انتشار است',
          icon: 'layout-text-window-reverse',
          actions: '<button class="btn btn-light" type="button" data-preview-page><i class="bi bi-eye"></i> پیش‌نمایش</button><button class="btn btn-primary" type="button" data-publish-page><i class="bi bi-cloud-upload"></i> انتشار</button>',
        })}
        <div class="builder-layout">
          <aside class="builder-blocks">
            <h3 class="card__title">بلوک‌ها</h3>
            <div class="builder-wire" data-block-source>${[
              ['هیرو', 'bi-layout-text-window', 'hero'],
              ['ویژگی‌ها', 'bi-grid-3x3-gap', 'features'],
              ['تصویر و متن', 'bi-card-image', 'media'],
              ['جدول قیمت', 'bi-tags', 'pricing'],
              ['نظرات', 'bi-chat-quote', 'testimonials'],
              ['پرسش‌های متداول', 'bi-patch-question', 'faq'],
              ['فراخوان عمل', 'bi-megaphone', 'cta'],
              ['پانویس', 'bi-layout-text-window', 'footer'],
            ]
              .map(([label, icon, type]) => `<div class="builder-block" draggable="true" data-block="${type}"><i class="bi ${icon}"></i><span>${label}</span></div>`)
              .join('')}</div>
          </aside>
          <section class="builder-canvas" data-builder-canvas>
            <div class="builder-section" data-section="hero"><span class="builder-section__label">هیرو</span><div class="builder-section__tools"><button class="icon-btn icon-btn--sm" type="button" data-move-up aria-label="بالا"><i class="bi bi-arrow-up"></i></button><button class="icon-btn icon-btn--sm" type="button" data-move-down aria-label="پایین"><i class="bi bi-arrow-down"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove-section aria-label="حذف"><i class="bi bi-trash3"></i></button></div>
              <p class="fs-h3 mb-1">عنوان بخش هیرو</p><p class="text-muted mb-0">توضیح نمونه برای این بخش — قابل ویرایش در نسخه نهایی.</p></div>
            <div class="builder-section" data-section="features"><span class="builder-section__label">ویژگی‌ها</span><div class="builder-section__tools"><button class="icon-btn icon-btn--sm" type="button" data-move-up aria-label="بالا"><i class="bi bi-arrow-up"></i></button><button class="icon-btn icon-btn--sm" type="button" data-move-down aria-label="پایین"><i class="bi bi-arrow-down"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove-section aria-label="حذف"><i class="bi bi-trash3"></i></button></div>
              <div class="grid grid--3">${['سریع', 'امن', 'مقیاس‌پذیر'].map((item) => `<div class="card"><div class="card__body"><strong>${item}</strong><p class="text-muted mb-0">توضیح کوتاه ویژگی</p></div></div>`).join('')}</div></div>
          </section>
          <aside class="builder-inspector">
            <h3 class="card__title">تنظیمات بخش</h3>
            <div data-inspector-body class="text-muted fs-caption">برای ویرایش، یک بخش را انتخاب کنید.</div>
          </aside>
        </div>
      </div>`,
    );

    const canvas = $('[data-builder-canvas]', node);
    on($('[data-block-source]', node), 'dragstart', (event) => {
      const block = event.target.closest('[data-block]');
      if (block) event.dataTransfer.setData('text/plain', block.dataset.block);
    });
    on(canvas, 'dragover', (event) => event.preventDefault());
    on(canvas, 'drop', (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('text/plain') || 'section';
      canvas.insertAdjacentHTML('beforeend', sectionMarkup(type));
      toast.success('بلوک افزوده شد', `بخش «${type}» به صفحه اضافه شد.`);
    });
    on(canvas, 'click', (event) => {
      const section = event.target.closest('[data-section]');
      if (!section) return;
      if (event.target.closest('[data-remove-section]')) {
        section.remove();
        toast.info('بخش حذف شد', 'تغییرات در پیش‌نمایش اعمال می‌شود.');
        return;
      }
      if (event.target.closest('[data-move-up]')) {
        const previous = section.previousElementSibling;
        if (previous) canvas.insertBefore(section, previous);
        return;
      }
      if (event.target.closest('[data-move-down]')) {
        const next = section.nextElementSibling;
        if (next) canvas.insertBefore(next, section);
        return;
      }
      $$('[data-section]', canvas).forEach((item) => item.classList.toggle('is-selected', item === section));
      render(
        $('[data-inspector-body]', node),
        infoRows([
          ['شناسه بخش', escapeHtml(section.dataset.section)],
          ['ترتیب', toDigits([...canvas.children].indexOf(section) + 1)],
          ['نوع', escapeHtml(section.dataset.section === 'hero' ? 'تمام‌عرض' : 'شبکه‌ای')],
        ]),
      );
    });
    on($('[data-preview-page]', node), 'click', () =>
      modal.open({
        title: 'پیش‌نمایش صفحه',
        size: 'lg',
        content: `<div class="card"><div class="card__body">${canvas.innerHTML.replace(/<span class="builder-section__label">.*?<\/span>/g, '').replace(/<div class="builder-section__tools">.*?<\/div>/g, '')}</div></div>`,
        footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button>',
      }),
    );
    on($('[data-publish-page]', node), 'click', async () => {
      const ok = await modal.confirm({ title: 'انتشار صفحه', text: 'نسخه فعلی به عنوان صفحه عمومی منتشر می‌شود.', tone: 'primary', confirmText: 'انتشار' });
      if (!ok) return;
      await services.content?.create?.({ sections: $$('[data-section]', canvas).map((item) => item.dataset.section), status: 'published' }).catch(() => null);
      toast.success('صفحه منتشر شد', 'نسخه جدید روی سایت قرار گرفت.');
    });
    return;
  }

  // Posts / pages / categories / tags / comments → DataTable + create dialog
  const resourceMap = {
    'cms/posts.html': 'posts',
    'cms/pages.html': 'pages',
    'cms/post-create.html': 'posts',
    'cms/categories.html': 'categories',
    'cms/tags.html': 'tags',
    'cms/comments.html': 'comments',
    'cms/media.html': 'media',
  };
  const resource = resourceMap[page];
  if (!resource) return;

  const fields = {
    posts: [
      { name: 'title', label: 'عنوان نوشته', required: true, col: 2 },
      { name: 'category', label: 'دسته', type: 'select', options: ['اخبار', 'آموزش', 'محصول', 'بازار'] },
      { name: 'author', label: 'نویسنده' },
      { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'published', label: 'منتشرشده' }, { value: 'draft', label: 'پیش‌نویس' }, { value: 'scheduled', label: 'زمان‌بندی‌شده' }] },
      { name: 'publishAt', label: 'تاریخ انتشار', type: 'date' },
      { name: 'tags', label: 'برچسب‌ها', type: 'tags' },
      { name: 'excerpt', label: 'خلاصه', type: 'textarea', col: 2, rows: 3 },
      { name: 'body', label: 'متن کامل', type: 'textarea', col: 2, rows: 8 },
    ],
    pages: [
      { name: 'title', label: 'عنوان صفحه', required: true },
      { name: 'slug', label: 'نشانی (slug)', required: true },
      { name: 'template', label: 'قالب', type: 'select', options: ['پیش‌فرض', 'تمام‌عرض', 'فرود', 'مستندات'] },
      { name: 'status', label: 'وضعیت', type: 'select', options: ['published', 'draft'] },
    ],
    categories: [
      { name: 'name', label: 'نام دسته', required: true },
      { name: 'parent', label: 'دسته والد', type: 'select', options: ['—', 'اخبار', 'آموزش', 'محصول'] },
      { name: 'description', label: 'توضیحات', type: 'textarea', col: 2, rows: 3 },
    ],
    tags: [
      { name: 'name', label: 'برچسب', required: true },
      { name: 'slug', label: 'نشانی', required: true },
    ],
    comments: [
      { name: 'author', label: 'نویسنده', required: true },
      { name: 'post', label: 'نوشته', required: true },
      { name: 'status', label: 'وضعیت', type: 'select', options: [{ value: 'approved', label: 'تأییدشده' }, { value: 'pending', label: 'در انتظار' }, { value: 'spam', label: 'اسپم' }] },
      { name: 'body', label: 'متن نظر', type: 'textarea', col: 2, rows: 4, required: true },
    ],
    media: [
      { name: 'name', label: 'نام فایل', required: true },
      { name: 'alt', label: 'متن جایگزین' },
      { name: 'tags', label: 'برچسب‌ها', type: 'tags' },
    ],
  };

  if (page === 'cms/post-create.html') {
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({ title: 'نوشته جدید', subtitle: 'محتوای خود را بنویسید و منتشر کنید', icon: 'pencil-square', actions: '<button class="btn btn-light" type="button" data-save-draft><i class="bi bi-file-earmark"></i> ذخیره پیش‌نویس</button><button class="btn btn-primary" type="button" data-publish><i class="bi bi-send"></i> انتشار</button>' })}
        <div class="grid grid--sidebar">
          ${card({ body: `<form data-post-form class="form-stack">
            ${formMarkup(fields.posts.slice(0, 1))}
            <div class="editor"><div class="editor-toolbar"><button class="icon-btn icon-btn--sm" type="button" data-cmd="bold"><i class="bi bi-type-bold"></i></button><button class="icon-btn icon-btn--sm" type="button" data-cmd="italic"><i class="bi bi-type-italic"></i></button><button class="icon-btn icon-btn--sm" type="button" data-cmd="insertOrderedList"><i class="bi bi-list-ol"></i></button><button class="icon-btn icon-btn--sm" type="button" data-cmd="formatBlock:blockquote"><i class="bi bi-quote"></i></button><span class="editor-toolbar__divider"></span><button class="icon-btn icon-btn--sm" type="button" data-insert-image><i class="bi bi-image"></i></button></div>
              <div class="editor-body" contenteditable="true" data-post-body aria-label="متن نوشته"><h2>مقدمه</h2><p>متن خود را اینجا بنویسید…</p></div></div>
            ${infoRows([['کلمات', '<span data-post-words>۰</span>'], ['زمان مطالعه', '<span data-post-read>۰</span> دقیقه']])}
          </form>` })}
          <div class="stack">
            ${card({ title: 'تنظیمات انتشار', body: formMarkup(fields.posts.slice(1), {}) })}
            ${card({ title: 'دسته و برچسب', body: formMarkup([{ name: 'tags2', label: 'برچسب‌ها', type: 'tags' }]) })}
          </div>
        </div>
      </div>`,
    );
    const body = $('[data-post-body]', node);
    const stats = () => {
      const words = body.textContent.trim().split(/\s+/).filter(Boolean).length;
      $('[data-post-words]', node).textContent = formatNumber(words);
      $('[data-post-read]', node).textContent = toDigits(Math.max(1, Math.round(words / 200)));
    };
    on(body, 'input', stats);
    on($('.editor-toolbar', node), 'click', (event) => {
      const button = event.target.closest('[data-cmd]');
      if (button) {
        const [command, argument] = String(button.dataset.cmd).split(':');
        document.execCommand(command, false, argument);
        return;
      }
      if (event.target.closest('[data-insert-image]')) {
        body.insertAdjacentHTML('beforeend', '<figure><img src="assets/img/products/product-02.svg" alt=""><figcaption>توضیح تصویر</figcaption></figure>');
      }
    });
    on($('[data-publish]', node), 'click', async () => {
      const form = $('[data-post-form]', node);
      const { validateForm } = await import('../core/form.js');
      if (!validateForm(form).valid) {
        toast.warning('عنوان الزامی است', 'برای انتشار، عنوان نوشته را وارد کنید.');
        return;
      }
      await services.media.create?.({}).catch?.(() => null);
      toast.success('نوشته منتشر شد', 'نوشته در فهرست مطالب قابل مشاهده است.');
      setTimeout(() => window.location.assign('cms/posts.html'), 900);
    });
    on($('[data-save-draft]', node), 'click', () => toast.info('پیش‌نویس ذخیره شد', 'می‌توانید بعداً آن را منتشر کنید.'));
    return;
  }

  // generic CMS list pages
  const titleText = $('[data-app]')?.dataset.title ?? 'محتوا';
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: titleText, subtitle: 'مدیریت محتوا با جستجو، فیلتر و خروجی', icon: 'journal-text', actions: toolButtons({ create: 'افزودن مورد جدید' }) })}
      <div class="card"><div class="card__body" data-datatable data-resource="${escapeHtml(resource)}"><div class="table-wrap"><table class="table table--hover"><thead><tr></tr></thead><tbody data-datatable-body></tbody></table></div><div class="datatable__foot" data-datatable-foot></div></div></div>
    </div>`,
  );
  const table = createDataTable($('[data-datatable]', node), { resource });
  on($('[data-create]', node), 'click', () => openRecordForm({ resource, title: `افزودن ${titleText}`, fields: fields[resource] ?? fields.posts, onSaved: () => table.reload() }));
  exportable(node, resource);
}

/* ================================================================== entry */

export async function initApp() {
  const page = kit.pageId();
  switch (page) {
    case 'apps/email.html':
      return mailClient();
    case 'apps/chat.html':
      return chatApp();
    case 'apps/calendar.html':
      return calendarApp();
    case 'apps/file-manager.html':
      return fileManager();
    case 'apps/media-library.html':
      return mediaLibrary();
    case 'apps/notifications.html':
      return notificationsPage();
    default:
      return;
  }
}

const sectionMarkup = (type) => `<div class="builder-section" data-section="${escapeHtml(type)}">
  <span class="builder-section__label">${escapeHtml(type)}</span>
  <div class="builder-section__tools"><button class="icon-btn icon-btn--sm" type="button" data-move-up aria-label="بالا"><i class="bi bi-arrow-up"></i></button><button class="icon-btn icon-btn--sm" type="button" data-move-down aria-label="پایین"><i class="bi bi-arrow-down"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove-section aria-label="حذف"><i class="bi bi-trash3"></i></button></div>
  <div class="grid grid--2">${Array.from({ length: 2 }, () => '<div class="card"><div class="card__body"><p class="text-muted mb-0">محتوای نمونه این بخش — در نسخه نهایی قابل ویرایش است.</p></div></div>').join('')}</div>
</div>`;

export default { initApp, initCms };
