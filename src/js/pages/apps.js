/**
 * NOVAADMIN — application pages PRO
 * Rewritten for professional UX: chat, mail, calendar, CMS
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { storage, KEYS } from '../core/storage.js';
import { formatNumber, toDigits, formatCurrency } from '../core/numbers.js';
import { formatDate, relativeTime } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import { initCalendar } from '../core/calendar.js';
import { goTo } from '../core/links.js';
import * as kit from './kit.js';

const { card, infoRows, host, pageHeader, formMarkup, openRecordForm, exportable, emptyState, statusBadge, toolButtons, chartBox, services } = kit;

/* ====================================================================== mail PRO */

async function mailClient() {
  const node = host();
  const folders = await services.mailService.folders().catch(() => ([
    { id: 'inbox', label: 'صندوق ورودی', icon: 'inbox', count: 24 },
    { id: 'starred', label: 'ستاره‌دار', icon: 'star', count: 5 },
    { id: 'sent', label: 'ارسال‌شده', icon: 'send', count: 18 },
    { id: 'drafts', label: 'پیش‌نویس', icon: 'file-earmark', count: 3 },
    { id: 'archive', label: 'بایگانی', icon: 'archive', count: 42 },
    { id: 'trash', label: 'سطل زباله', icon: 'trash3', count: 7 },
  ]));
  const query = kit.queryParam('folder', 'inbox');
  const id = kit.queryParam('id');

  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'ایمیل حرفه‌ای', subtitle: 'صندوق هوشمند با دسته‌بندی، جستجو و پیش‌نمایش سریع', icon: 'envelope', actions: toolButtons({ exportResource: 'mail' }) })}
      <div class="mail-layout">
        <aside class="mail-nav">
          <button class="btn btn-primary w-100" type="button" data-compose style="height:48px; border-radius:14px; font-weight:800;"><i class="bi bi-pencil-square"></i> نامه جدید</button>
          <ul class="mail-nav__list" data-mail-folders>${folders
            .map(
              (folder) => `<li><a class="mail-nav__link ${folder.id === query ? 'is-active' : ''}" href="apps/email.html?folder=${escapeHtml(folder.id)}"><i class="bi bi-${escapeHtml(folder.icon ?? 'folder')}"></i><span>${escapeHtml(folder.label)}</span><span class="mail-nav__count">${toDigits(folder.count ?? 0)}</span></a></li>`,
            )
            .join('')}</ul>
          <div style="height:1px; background:var(--nv-divider); margin:4px 0;"></div>
          <p class="mail-nav__labels" style="font-size:11px; font-weight:800; letter-spacing:0.06em; color:var(--nv-text-muted); margin:0 0 8px;">برچسب‌ها</p>
          <ul class="mail-nav__list">${[
            ['کاری', 'primary'],
            ['شخصی', 'success'],
            ['فاکتور', 'warning'],
            ['پشتیبانی', 'info'],
          ].map(([label, tone]) => `<li><a class="mail-nav__link" href="#"><span class="status-dot status-dot--${tone}"></span><span>${label}</span></a></li>`).join('')}</ul>
          <div class="card" style="margin-top:auto; background:var(--nv-surface); border-radius:14px; padding:14px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"><span class="tile tile--soft tile--icon tile--soft-primary"><i class="bi bi-hdd-stack"></i></span><div><div style="font-size:12px; font-weight:800;">فضای ذخیره</div><div style="font-size:11px; color:var(--nv-text-muted);">۷۸٪ پر شده</div></div></div>
            <div class="progress progress--sm" style="height:6px;"><div class="progress-bar" style="width:78%"></div></div>
          </div>
        </aside>
        <section class="mail-panel">
          <div class="mail-toolbar">
            <div class="mail-toolbar__search"><i class="bi bi-search"></i><input type="search" placeholder="جستجوی ایمیل، فرستنده، موضوع..." data-mail-search></div>
            <div style="display:flex; gap:6px; margin-inline-start:auto;">
              <button class="icon-btn" type="button" data-mail-action="refresh" aria-label="تازه‌سازی"><i class="bi bi-arrow-clockwise"></i></button>
              <button class="icon-btn" type="button" data-mail-action="more" aria-label="بیشتر"><i class="bi bi-three-dots-vertical"></i></button>
            </div>
          </div>
          <div data-mail-content>${id ? '' : `<div class="mail-list" data-mail-list>${kit.skeleton(8)}</div>`}</div>
        </section>
      </div>
    </div>`,
  );

  if (id) {
    await renderMailView(node, id);
  } else {
    await renderMailList(node, query);
  }

  on($('[data-mail-search]', node), 'input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    $$('.mail-item', node).forEach(el => {
      el.hidden = term ? !el.textContent.toLowerCase().includes(term) : false;
    });
  });

  on(node, 'click', async (event) => {
    if (event.target.closest('[data-compose]')) {
      openCompose();
      return;
    }
    if (event.target.closest('[data-mail-action="refresh"]')) {
      toast.info('به‌روزرسانی', 'صندوق ورودی تازه‌سازی شد');
      renderMailList(node, query);
      return;
    }
    const star = event.target.closest('[data-star]');
    if (star) {
      event.preventDefault();
      event.stopPropagation();
      const result = await services.mailService.toggleStar(star.dataset.star).catch(() => ({ starred: star.classList.contains('is-starred') ? false : true }));
      star.classList.toggle('is-starred', result.starred);
      star.innerHTML = `<i class="bi bi-star${result.starred ? '-fill' : ''}"></i>`;
      return;
    }
    const item = event.target.closest('[data-mail-item]');
    if (item) {
      goTo(`apps/email.html?folder=${encodeURIComponent(query)}&id=${encodeURIComponent(item.dataset.mailItem)}`);
      return;
    }
    const back = event.target.closest('[data-mail-back]');
    if (back) {
      goTo(`apps/email.html?folder=${encodeURIComponent(query)}`);
      return;
    }
    const remove = event.target.closest('[data-mail-delete]');
    if (remove) {
      const ok = await modal.confirm({ title: 'حذف نامه', text: 'نامه به سطل زباله منتقل می‌شود.', tone: 'danger', confirmText: 'حذف کن' });
      if (!ok) return;
      await services.mailService.remove(remove.dataset.mailDelete).catch(()=>null);
      toast.success('نامه حذف شد', 'می‌توانید آن را از سطل زباله بازگردانید.');
      goTo(`apps/email.html?folder=${encodeURIComponent(query)}`);
    }
  });
}

async function renderMailList(node, folder) {
  const host2 = $('[data-mail-list]', node) || $('[data-mail-content]', node);
  const result = await services.mailService.list({ folder, perPage: 24 }).catch(() => ({ items: [] }));
  const items = result.items ?? result;
  if (!items.length) {
    render(host2, emptyState({ title: 'پوشه خالی است', text: 'نامه‌ای در این پوشه وجود ندارد.', icon: 'envelope-open' }));
    return;
  }
  render(
    host2,
    `<div class="mail-list">${items
      .map((mail) => {
        const initials = (mail.from || '؟').trim().slice(0,1).toUpperCase();
        const isUnread = !mail.read;
        const hasAttach = mail.attachments && mail.attachments.length;
        return `<article class="mail-item ${isUnread ? 'is-unread' : ''}" data-mail-item="${escapeHtml(mail.id)}" tabindex="0">
          <button class="mail-item__star ${mail.starred ? 'is-starred' : ''}" type="button" data-star="${escapeHtml(mail.id)}" aria-label="ستاره"><i class="bi bi-star${mail.starred ? '-fill' : ''}"></i></button>
          <div class="mail-item__avatar">${escapeHtml(initials)}</div>
          <div class="mail-item__body">
            <div class="mail-item__from">${escapeHtml(mail.from)} ${isUnread ? '<span class="badge badge--soft-primary" style="font-size:9px;">جدید</span>' : ''}</div>
            <div class="mail-item__subject">${escapeHtml(mail.subject)} <span>— ${escapeHtml((mail.preview || mail.body || '').slice(0,90))}</span></div>
          </div>
          <div class="mail-item__meta">
            ${hasAttach ? '<i class="bi bi-paperclip"></i>' : ''}
            <time>${mail.at ? relativeTime(mail.at) : formatDate(mail.date, { format: 'short' }) || 'امروز'}</time>
          </div>
        </article>`;
      })
      .join('')}</div>`,
  );
}

async function renderMailView(node, id) {
  const container = $('[data-mail-content]', node);
  const mail = await services.mailService.get(id).catch(() => null);
  if (!mail) {
    render(container, emptyState({ title: 'نامه یافت نشد', text: 'این نامه حذف شده یا وجود ندارد.', icon: 'envelope-x' }));
    return;
  }
  const initials = (mail.from || '؟').slice(0,1);
  render(
    container,
    `<div class="mail-view">
      <div class="mail-view__head">
        <div style="display:flex; align-items:center; gap:12px;">
          <button class="btn btn-light btn-sm" data-mail-back><i class="bi bi-arrow-right"></i> بازگشت</button>
          <div style="margin-inline-start:auto; display:flex; gap:6px;">
            <button class="icon-btn" data-mail-archive><i class="bi bi-archive"></i></button>
            <button class="icon-btn" data-mail-delete="${escapeHtml(mail.id)}"><i class="bi bi-trash3"></i></button>
            <button class="icon-btn"><i class="bi bi-three-dots"></i></button>
          </div>
        </div>
        <h1 class="mail-view__subject">${escapeHtml(mail.subject)}</h1>
        <div class="mail-view__meta">
          <div class="mail-item__avatar">${escapeHtml(initials)}</div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><strong style="font-size:13px;">${escapeHtml(mail.from)}</strong><span style="font-size:11px; color:var(--nv-text-muted);">&lt;${escapeHtml(mail.fromEmail || 'no-reply@example.com')}&gt;</span><span class="badge badge--soft-success" style="font-size:10px;">امن</span></div>
            <div style="font-size:11px; color:var(--nv-text-muted);">به من • ${formatDate(mail.at || mail.date, { format: 'medium' })}</div>
          </div>
          <button class="btn btn-light btn-sm"><i class="bi bi-star"></i></button>
        </div>
      </div>
      <div class="mail-view__body">
        <p>${escapeHtml(mail.body || mail.preview || 'محتوای نامه در نسخه نمایشی خلاصه نمایش داده می‌شود.')}</p>
        <p>سلام وقت بخیر،</p>
        <p>این یک ایمیل نمونه با طراحی حرفه‌ای است. تمام اطلاعات حساب شما امن و محفوظ است. لطفاً در صورت داشتن سوال با پشتیبانی تماس بگیرید.</p>
        <p>با تشکر<br>تیم نواادمین</p>
      </div>
      ${mail.attachments?.length ? `<div class="mail-view__attachments">${mail.attachments.map(att => `<div class="mail-attachment"><span class="tile tile--soft tile--icon tile--soft-primary"><i class="bi bi-file-earmark"></i></span><div style="flex:1; min-width:0;"><div style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(att.name||'فایل.pdf')}</div><div style="font-size:11px; color:var(--nv-text-muted);">${escapeHtml(att.size||'1.2 MB')}</div></div><button class="btn btn-light btn-sm"><i class="bi bi-download"></i></button></div>`).join('')}</div>` : `<div class="mail-view__attachments"><div class="mail-attachment"><span class="tile tile--soft tile--icon tile--soft-primary"><i class="bi bi-file-earmark-pdf"></i></span><div style="flex:1;"><div style="font-size:12px; font-weight:700;">گزارش-مالی.pdf</div><div style="font-size:11px; color:var(--nv-text-muted);">2.4 MB</div></div><button class="btn btn-light btn-sm"><i class="bi bi-download"></i></button></div></div>`}
      <div class="mail-reply">
        <div class="mail-reply__body" contenteditable="true" data-mail-reply placeholder="پاسخ خود را بنویسید..."></div>
        <div class="mail-reply__foot"><button class="btn btn-light btn-sm" type="button"><i class="bi bi-paperclip"></i> پیوست</button><button class="btn btn-primary btn-sm" type="button" data-mail-send><i class="bi bi-send"></i> ارسال پاسخ</button></div>
      </div>
    </div>`,
  );
  on($('[data-mail-send]', container), 'click', () => {
    toast.success('پاسخ ارسال شد', 'ایمیل شما با موفقیت ارسال شد');
    $('[data-mail-reply]', container).textContent = '';
  });
}

function openCompose() {
  modal.open({
    title: 'نامه جدید',
    size: 'lg',
    content: `<form data-compose-form class="form-stack">
      <div class="form-grid">
        <div class="form-field" style="grid-column:1/-1;"><label class="form-label">به</label><input class="form-control" name="to" placeholder="ایمیل گیرنده"></div>
        <div class="form-field" style="grid-column:1/-1;"><label class="form-label">موضوع</label><input class="form-control" name="subject" placeholder="موضوع نامه"></div>
        <div class="form-field" style="grid-column:1/-1;"><label class="form-label">متن</label><textarea class="form-control" name="body" rows="6" placeholder="متن نامه..."></textarea></div>
      </div>
    </form>`,
    footer: '<button class="btn btn-light" data-modal-close>انصراف</button><button class="btn btn-primary" data-compose-send><i class="bi bi-send"></i> ارسال</button>',
    onMount: (panel) => {
      on($('[data-compose-send]', panel), 'click', async () => {
        const form = $('[data-compose-form]', panel);
        const { validateForm } = { validateForm: (f)=>({valid: f.to.value.trim().length>0}) };
        if (!form.to.value.trim()) { toast.warning('گیرنده الزامی است', 'ایمیل گیرنده را وارد کنید'); return; }
        toast.success('نامه ارسال شد', 'نامه شما در پوشه ارسال‌شده قرار گرفت');
        modal.closeTop();
      });
    },
  });
}

/* ====================================================================== chat PRO - fix gray circle */

async function chatApp() {
  const node = host();
  const conversations = await services.chatAppService.list().catch(()=>[]);
  const presence = await services.chatAppService.presence().catch(()=>[]);

  // Fallback data if empty
  const convList = conversations.length ? conversations : [
    { id: 'c1', name: 'سارا محمدی', avatar: 'assets/img/avatars/avatar-08.svg', role: 'مدیر محصول', preview: 'فایل طراحی جدید رو دیدی؟ عالی شده!', unread: 2, updatedAt: new Date().toISOString(), status: 'online' },
    { id: 'c2', name: 'تیم طراحی', avatar: 'assets/img/avatars/avatar-03.svg', role: 'گروه', preview: 'علی: جلسه فردا ساعت ۱۰', unread: 0, updatedAt: new Date(Date.now()-3600000).toISOString(), status: 'online' },
    { id: 'c3', name: 'رضا کریمی', avatar: 'assets/img/avatars/avatar-05.svg', role: 'توسعه‌دهنده ارشد', preview: 'مرج ریکوئست رو بررسی کردم', unread: 1, updatedAt: new Date(Date.now()-7200000).toISOString(), status: 'busy' },
    { id: 'c4', name: 'مریم حسینی', avatar: 'assets/img/avatars/avatar-12.svg', role: 'پشتیبانی', preview: 'تیکت جدید ثبت شد', unread: 0, updatedAt: new Date(Date.now()-86400000).toISOString(), status: 'away' },
  ];
  const presenceList = presence.length ? presence : convList.slice(0,6);

  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'گفتگوهای تیمی', subtitle: 'چت امن، سریع و حرفه‌ای با قابلیت ارسال فایل و تماس', icon: 'chat-dots', actions: '<button class="btn btn-light" data-chat-new><i class="bi bi-plus-lg"></i> گفتگوی جدید</button>' })}
      <div class="chat-layout">
        <aside class="chat-sidebar">
          <div class="chat-sidebar__head">
            <div class="chat-search"><i class="bi bi-search"></i><input type="search" placeholder="جستجوی مخاطب یا پیام..." data-chat-filter></div>
            <div style="margin-top:16px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;"><span style="font-size:11px; font-weight:800; letter-spacing:0.06em; color:var(--nv-text-muted);">آنلاین‌ها</span><span class="badge badge--soft-success" style="font-size:10px;">${toDigits(presenceList.filter(p=>p.status==='online').length)} فعال</span></div>
              <div class="chat-presence-row">${presenceList
                .slice(0, 8)
                .map((person) => `<button type="button" class="chat-presence ${person.status==='online'?'chat-presence--online': person.status==='busy'?'chat-presence--busy':''}" data-presence="${escapeHtml(person.id)}" title="${escapeHtml(person.name)}">
                  <img src="${escapeHtml(person.avatar)}" alt="">
                  <span class="chat-presence__dot chat-presence__dot--${person.status==='online'?'online': person.status==='busy'?'busy': person.status==='away'?'away':'offline'}"></span>
                </button>`)
                .join('')}</div>
            </div>
            <div style="display:flex; gap:6px; margin-top:16px;">
              ${['همه','خوانده‌نشده','گروه‌ها'].map((t,i)=>`<button class="chip chip--filter ${i===0?'is-active':''}" data-chat-tab="${t}" style="font-size:11px; padding:6px 12px; border-radius:999px;">${t}</button>`).join('')}
            </div>
          </div>
          <div class="chat-sidebar__list" style="padding:12px; display:flex; flex-direction:column; gap:6px; overflow:auto; max-height:560px;">${convList
            .map(
              (conversation, index) => `<button type="button" class="chat-contact ${index === 0 ? 'is-active' : ''}" data-chat="${escapeHtml(conversation.id)}">
                <img class="avatar" src="${escapeHtml(conversation.avatar ?? 'assets/img/avatars/avatar-02.svg')}" alt="" style="width:44px; height:44px; border-radius:14px; object-fit:cover;">
                <div class="chat-contact__body">
                  <div class="chat-contact__top"><span class="chat-contact__name">${escapeHtml(conversation.name)}</span><span class="chat-contact__time">${relativeTime(conversation.updatedAt)}</span></div>
                  <div class="chat-contact__preview"><i class="bi bi-check2-all" style="color:var(--nv-success);"></i> ${escapeHtml(conversation.preview ?? '')}</div>
                </div>
                ${conversation.unread ? `<span class="chat-contact__unread">${toDigits(conversation.unread)}</span>` : ''}
              </button>`,
            )
            .join('')}</div>
        </aside>

        <section class="chat-panel" style="display:flex; flex-direction:column;">
          <header class="chat-panel__head">
            <div class="chat-user">
              <div class="chat-user__avatar"><img src="${escapeHtml(convList[0]?.avatar)}" alt=""><span class="chat-user__avatar__status"></span></div>
              <div><div class="chat-user__name" data-chat-name>${escapeHtml(convList[0]?.name)}</div><div class="chat-user__sub"><span class="status-dot status-dot--online"></span> آنلاین • در حال تایپ...</div></div>
            </div>
            <div class="chat-panel__actions" style="display:flex; gap:6px;">
              <button class="icon-btn" type="button" data-chat-call><i class="bi bi-telephone"></i></button>
              <button class="icon-btn" type="button" data-chat-video><i class="bi bi-camera-video"></i></button>
              <button class="icon-btn" type="button" data-chat-info><i class="bi bi-three-dots-vertical"></i></button>
            </div>
          </header>
          <div class="chat-stream" data-chat-stream style="flex:1; overflow:auto;">${await chatStreamMarkup(convList[0]?.id, convList)}</div>
          <form class="chat-composer" data-chat-composer>
            <textarea class="chat-composer__input" rows="1" name="message" placeholder="پیام خود را بنویسید… (Enter برای ارسال)" aria-label="متن پیام"></textarea>
            <div class="chat-composer__row">
              <div class="chat-composer__tools">
                <button class="icon-btn icon-btn--sm" type="button" data-chat-attach><i class="bi bi-paperclip"></i></button>
                <button class="icon-btn icon-btn--sm" type="button" data-chat-emoji><i class="bi bi-emoji-smile"></i></button>
                <button class="icon-btn icon-btn--sm" type="button" data-chat-file><i class="bi bi-mic"></i></button>
              </div>
              <span class="chat-composer__hint">Shift + Enter برای خط جدید</span>
              <button class="btn btn-primary btn-sm" type="submit" style="border-radius:12px; padding-inline:18px;"><i class="bi bi-send-fill"></i> ارسال</button>
            </div>
          </form>
        </section>
      </div>
    </div>`,
  );

  let active = convList[0]?.id;
  const stream = $('[data-chat-stream]', node);
  const scroll = () => { stream.scrollTop = stream.scrollHeight; };
  scroll();

  on(node, 'click', async (event) => {
    const contact = event.target.closest('[data-chat]');
    if (contact) {
      active = contact.dataset.chat;
      $$('[data-chat]', node).forEach((item) => item.classList.toggle('is-active', item === contact));
      const conv = convList.find(c=>c.id===active);
      if (conv) {
        $('[data-chat-name]', node).textContent = conv.name;
        $('.chat-user__avatar img', node).src = conv.avatar;
      }
      render(stream, await chatStreamMarkup(active, convList));
      scroll();
      return;
    }
    if (event.target.closest('[data-chat-emoji]')) {
      const input = $('.chat-composer__input', node);
      input.value += ' 🙂';
      input.focus();
      return;
    }
    if (event.target.closest('[data-chat-call]')) toast.info('تماس صوتی', 'در نسخه نمایشی تماس برقرار نمی‌شود.');
    if (event.target.closest('[data-chat-video]')) toast.info('تماس تصویری', 'این قابلیت به سرویس ویدیوکنفرانس متصل می‌شود.');
    if (event.target.closest('[data-chat-info]')) {
      const conversation = convList.find((item) => item.id === active);
      modal.open({
        title: 'اطلاعات گفتگو',
        size: 'md',
        content: `<div style="text-align:center; padding:20px;"><img src="${escapeHtml(conversation?.avatar)}" style="width:88px; height:88px; border-radius:28px; margin:0 auto 16px; display:block; border:3px solid var(--nv-surface); box-shadow:var(--nv-shadow-lg);"><h3 style="margin:0 0 4px; font-weight:900;">${escapeHtml(conversation?.name ?? '')}</h3><p style="color:var(--nv-text-muted); font-size:12px; margin:0;">${escapeHtml(conversation?.role ?? '')}</p><div style="display:flex; gap:8px; justify-content:center; margin-top:16px;"><span class="badge badge--soft-success">آنلاین</span><span class="badge badge--soft-primary">${toDigits(128)} پیام</span></div></div>`,
        footer: '<button type="button" class="btn btn-light" data-modal-close>بستن</button>',
      });
    }
    if (event.target.closest('[data-chat-new]')) {
      toast.info('گفتگوی جدید', 'انتخاب مخاطب در نسخه نمایشی');
    }
  });

  on($('[data-chat-composer]', node), 'submit', async (event) => {
    event.preventDefault();
    const input = $('[name="message"]', event.currentTarget);
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    stream.insertAdjacentHTML('beforeend', `<article class="msg msg--out"><div class="msg__body"><div class="msg__bubble">${escapeHtml(text)}</div><div class="msg__meta"><time>همین حالا • ✓✓</time></div></div></article>`);
    scroll();
    try { await services.chatAppService.send(active, text); } catch {}
    stream.insertAdjacentHTML('beforeend', `<div class="chat-typing" data-chat-typing><span></span><span></span><span></span></div>`);
    scroll();
    setTimeout(async () => {
      $('[data-chat-typing]', stream)?.remove();
      const person = convList.find((item) => item.id === active);
      const text2 = person?.autoReply ?? 'دریافت شد، بررسی می‌کنم و به‌زودی پاسخ می‌دهم.';
      stream.insertAdjacentHTML('beforeend', `<article class="msg msg--in"><span class="msg__avatar"><img src="${escapeHtml(person?.avatar ?? 'assets/img/avatars/avatar-02.svg')}" alt="" style="width:32px; height:32px; border-radius:10px;"></span><div class="msg__body"><div class="msg__bubble">${escapeHtml(text2)}</div><div class="msg__meta"><time>همین حالا</time></div></div></article>`);
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
    const term = event.target.value.trim().toLowerCase();
    $$('[data-chat]', node).forEach((item) => {
      item.hidden = term ? !item.textContent.toLowerCase().includes(term) : false;
    });
  });
}

async function chatStreamMarkup(conversationId, fallbackList = []) {
  if (!conversationId) return emptyState({ title: 'گفتگویی انتخاب نشده', icon: 'chat-square' });
  let detail = null;
  try { detail = await services.chatAppService.get(conversationId); } catch {}
  const messages = detail?.messages ?? [
    { from: 'them', text: 'سلام! جلسه فردا ساعت ۱۰ تایید شد؟', at: new Date(Date.now()-3600000*3).toISOString() },
    { from: 'me', text: 'سلام، بله تایید شد. اسلایدها آماده‌ست.', at: new Date(Date.now()-3600000*2.5).toISOString() },
    { from: 'them', text: 'عالیه، فایل طراحی جدید رو دیدی؟', at: new Date(Date.now()-3600000*2).toISOString() },
    { from: 'me', text: 'آره دیدم، خیلی حرفه‌ای شده. فقط رنگ دکمه‌ها رو باید با برند جدید هماهنگ کنیم.', at: new Date(Date.now()-3600000*1).toISOString() },
    { from: 'them', text: 'دقیقا، منم همینو می‌خواستم بگم. تا عصر اصلاح می‌کنم.', at: new Date(Date.now()-1800000).toISOString() },
  ];
  const fallback = fallbackList.find(c=>c.id===conversationId);
  const name = detail?.name ?? fallback?.name ?? 'همکار';
  const avatar = detail?.avatar ?? fallback?.avatar ?? 'assets/img/avatars/avatar-02.svg';
  if (!messages.length) return emptyState({ title: 'اینجا ساکت است', text: 'اولین پیام را بفرستید.', icon: 'chat-square-dots' });
  return `<div class="chat-day-divider" style="text-align:center; margin:8px 0;"><span style="background:var(--nv-surface-2); padding:4px 12px; border-radius:999px; font-size:11px; color:var(--nv-text-muted);">امروز • ${formatDate(new Date(), { format: 'medium' })}</span></div>
    ${messages.map((message) => `
      <article class="msg ${message.from === 'me' ? 'msg--out' : 'msg--in'}">
        ${message.from !== 'me' ? `<span class="msg__avatar"><img src="${escapeHtml(avatar)}" alt=""></span>` : ''}
        <div class="msg__body">
          <div class="msg__bubble">${escapeHtml(message.text)}</div>
          <div class="msg__meta"><time>${relativeTime(message.at)} ${message.from==='me'?'• ✓✓':''}</time></div>
        </div>
      </article>`).join('')}`;
}

/* ================================================================== calendar PRO - single unified */

async function calendarApp() {
  const node = host();
  const [categories, upcoming] = await Promise.all([
    services.calendarService.categories().catch(()=>[
      { id:'work', label:'کاری', tone:'primary' },
      { id:'personal', label:'شخصی', tone:'success' },
      { id:'meeting', label:'جلسه', tone:'info' },
      { id:'deadline', label:'ددلاین', tone:'danger' },
    ]),
    services.calendarService.upcoming().catch(()=>[
      { title:'جلسه با تیم طراحی', startAt: new Date().toISOString(), time:'۱۰:۰۰', tone:'primary' },
      { title:'ارائه محصول', startAt: new Date(Date.now()+86400000).toISOString(), time:'۱۴:۳۰', tone:'success' },
      { title:'ددلاین اسپرینت', startAt: new Date(Date.now()+172800000).toISOString(), time:'۱۸:۰۰', tone:'danger' },
    ])
  ]);

  render(
    node,
    `<div class="calendar-pro">
      ${pageHeader({
        title: 'تقویم حرفه‌ای',
        subtitle: 'یک تقویم واحد، تمیز و قدرتمند — مدیریت رویدادها، جلسات و ددلاین‌ها',
        icon: 'calendar3',
        actions: '<button class="btn btn-primary" type="button" data-calendar-new style="border-radius:12px; height:44px; font-weight:800;"><i class="bi bi-plus-lg"></i> رویداد جدید</button>',
      })}
      <div class="calendar-shell" data-calendar data-calendar-view="month" data-calendar-resource="calendar">
        <div class="calendar-main">
          <div class="calendar__toolbar">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="display:flex; gap:6px;">
                <button class="icon-btn" type="button" data-calendar-prev aria-label="قبلی"><i class="bi bi-chevron-right"></i></button>
                <button class="icon-btn" type="button" data-calendar-next aria-label="بعدی"><i class="bi bi-chevron-left"></i></button>
              </div>
              <h2 class="calendar__title" data-calendar-title>—</h2>
              <button class="btn btn-light btn-sm" type="button" data-calendar-today style="border-radius:10px;">امروز</button>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="segmented" data-calendar-views style="background:var(--nv-surface-2); padding:4px; border-radius:12px;">
                <button type="button" class="segmented__item is-active" data-view="month" style="border-radius:10px; padding:8px 16px; font-size:12px; font-weight:700;">ماه</button>
              </div>
              <span class="badge badge--soft-primary" data-calendar-count style="border-radius:999px; padding:6px 12px;"></span>
            </div>
          </div>
          <div class="calendar__filters" data-calendar-categories style="padding:12px 20px; display:flex; gap:8px; flex-wrap:wrap; border-block-end:1px solid var(--nv-border); background:var(--nv-surface-2);">${categories.map(c=>`<button class="chip chip--filter is-active" data-cat="${c.id}" style="border-radius:999px; padding:6px 14px; font-size:11px; font-weight:700; background:var(--nv-surface); border:1px solid var(--nv-border);"><span class="status-dot status-dot--${c.tone||'primary'}"></span> ${escapeHtml(c.label)}</button>`).join('')}</div>
          <div data-calendar-grid class="calendar__grid" style="display:grid; grid-template-columns:repeat(7,1fr);"></div>
        </div>
        <aside class="calendar-side">
          <div data-calendar-mini class="calendar-mini"></div>
          <div class="card" style="border-radius:16px; border:1px solid var(--nv-border); overflow:hidden;">
            <div class="card__head" style="padding:16px; display:flex; align-items:center; justify-content:space-between;"><h3 style="margin:0; font-size:13px; font-weight:800;">رویدادهای پیش‌رو</h3><span class="badge badge--soft-primary" style="font-size:10px;">${toDigits(upcoming.length)}</span></div>
            <div class="card__body" style="padding:0;"><ul class="list-group" style="padding:8px; display:flex; flex-direction:column; gap:8px;">${upcoming.slice(0,6).map(event => `<li style="display:flex; gap:12px; padding:12px; border-radius:12px; border:1px solid var(--nv-border); background:var(--nv-surface);"><span class="status-dot status-dot--${event.tone ?? 'primary'}" style="margin-top:6px;"></span><div style="flex:1; min-width:0;"><div style="font-size:12px; font-weight:700; color:var(--nv-heading);">${escapeHtml(event.title)}</div><div style="font-size:11px; color:var(--nv-text-muted); margin-top:2px;">${formatDate(event.startAt, { format: 'medium' })} • ${escapeHtml(event.time ?? '')}</div></div></li>`).join('')}</ul></div>
          </div>
          <div class="card" style="border-radius:16px; background:linear-gradient(135deg, var(--nv-primary), #7c3aed); color:#fff; border:0; padding:20px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;"><span style="width:40px; height:40px; border-radius:12px; background:rgba(255,255,255,0.2); display:grid; place-items:center;"><i class="bi bi-lightning-charge"></i></span><div><div style="font-weight:800; font-size:13px;">بهره‌وری امروز</div><div style="font-size:11px; opacity:0.8;">۳ جلسه • ۲ ددلاین</div></div></div>
            <div class="progress" style="height:6px; background:rgba(255,255,255,0.2);"><div class="progress-bar" style="width:68%; background:#fff;"></div></div>
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:8px; opacity:0.9;"><span>۶۸٪ تکمیل</span><span>عالیه!</span></div>
          </div>
        </aside>
      </div>
    </div>`,
  );

  // Initialize unified calendar (month only)
  try {
    initCalendar($('[data-calendar]', node));
  } catch (e) {
    console.warn('calendar init failed', e);
  }

  on(node, 'click', (event) => {
    if (event.target.closest('[data-calendar-new]')) {
      const grid = $('[data-calendar-grid]', node);
      const slot = $('[data-calendar-slot]', grid);
      if (slot) slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      else toast.info('رویداد جدید', 'برای افزودن، روی یک روز کلیک کنید');
    }
    if (event.target.closest('[data-calendar-today]')) {
      bus.emit(EVENTS.calendarToday || 'calendar:today');
    }
  });

  initCharts(node);
}

/* ============================================================== file manager (kept) */

async function fileManager() {
  const node = host();
  const [files, storageInfo] = await Promise.all([services.fileService.list({ perPage: 20 }).catch(()=>({items:[]})), services.mediaService.list({ perPage: 1 }).catch(()=>({storage:{used:68,total:200}}))]);
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
          ].map(([label, icon, count], index) => `<li><a class="files-nav__link ${index === 0 ? 'is-active' : ''}" href="#"><i class="bi bi-${icon}"></i><span>${label}</span><span class="files-nav__meta">${toDigits(count)}</span></a></li>`).join('')}</ul>
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
            <div class="view-switch ms-auto" data-view-switch="files"><button class="view-switch__btn is-active" type="button" data-view="grid"><i class="bi bi-grid"></i></button><button class="view-switch__btn" type="button" data-view="list"><i class="bi bi-list-ul"></i></button></div>
          </div>
          <div class="files-grid" data-files-grid>${(items.length?items.slice(0,16):[]).map((file) => fileCard(file)).join('')}</div>
        </section>
      </div>
    </div>`,
  );
  on($('[data-file-search]', node), 'input', (event) => {
    const term = event.target.value.trim();
    $$('.file-card', node).forEach((item) => { item.hidden = term ? !item.textContent.includes(term) : false; });
  });
  on($('[data-new-folder]', node), 'click', async () => {
    const name = await modal.prompt({ title: 'پوشه جدید', label: 'نام پوشه', validate: (value) => (value?.trim() ? null : 'نام پوشه الزامی است') });
    if (!name) return;
    toast.success('پوشه ساخته شد', `پوشه «${name}» ایجاد شد.`);
  });
  on($('[data-files-grid]', node), 'click', async (event) => {
    const card2 = event.target.closest('.file-card');
    if (!card2) return;
    if (event.target.closest('[data-file-rename]')) {
      const name = await modal.prompt({ title: 'تغییر نام', label: 'نام جدید', value: card2.dataset.name });
      if (!name) return;
      card2.querySelector('.file-card__name').textContent = name;
      toast.success('نام تغییر کرد', 'نام جدید ذخیره شد.');
      return;
    }
    card2.classList.toggle('is-selected');
  });
  exportable(node, 'files');
}
const fileCard = (file) => `<figure class="file-card" data-id="${escapeHtml(file.id ?? file.name)}" data-name="${escapeHtml(file.name)}">
    <div class="file-card__thumb">${/image|png|jpg|svg/i.test(file.type ?? '') ? `<img src="${escapeHtml(file.url ?? 'assets/img/products/product-03.svg')}" alt="" loading="lazy">` : `<span class="file-card__icon"><i class="bi bi-file-earmark-text"></i></span>`}</div>
    <figcaption class="file-card__meta"><span class="file-card__name">${escapeHtml(file.name)}</span><span class="list-item__sub">${escapeHtml(file.size ?? '')}</span></figcaption>
    <div class="file-card__check"><button class="icon-btn icon-btn--sm" type="button" data-file-rename><i class="bi bi-pencil"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-file-delete><i class="bi bi-trash3"></i></button></div>
  </figure>`;

/* ============================================================== media + notifications (kept simple) */

async function mediaLibrary() {
  const node = host();
  const media = await services.mediaService.list({ perPage: 24 }).catch(()=>({items:[]}));
  const items = media.items ?? media;
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'کتابخانه رسانه', subtitle: 'تصاویر، ویدیو و اسناد', icon: 'images', actions: `<label class="btn btn-primary"><i class="bi bi-cloud-arrow-up"></i> بارگذاری<input type="file" hidden multiple accept="image/*" data-media-upload></label>` })}
      <div class="card"><div class="card__body"><div class="files-grid" data-media-grid>${items.map((item) => `<figure class="file-card"><div class="file-card__thumb"><img src="${escapeHtml(item.url ?? 'assets/img/products/product-05.svg')}" alt=""></div><figcaption class="file-card__meta"><span class="file-card__name">${escapeHtml(item.name ?? '')}</span></figcaption></figure>`).join('')}</div></div></div>
    </div>`,
  );
}

async function notificationsPage() {
  const node = host();
  const items = await services.notificationService.list().catch(()=>[]);
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'مرکز اعلان‌ها', subtitle: 'همه رویدادهای سیستم', icon: 'bell' })}
      <div class="card"><div class="card__body" data-notif-list>${items.map((item) => `<div class="list-item"><span class="notification-item__icon notification-item__icon--${escapeHtml(item.type)}"><i class="bi bi-info-circle"></i></span><span class="list-item__title">${escapeHtml(item.title)}<span class="list-item__sub">${escapeHtml(item.text)}</span></span></div>`).join('')}</div></div>
    </div>`,
  );
}

/* ====================================================================== CMS PRO */

export async function initCms() {
  const page = kit.pageId();
  const node = host();
  if (!node) return;

  if (page === 'cms/page-builder.html') {
    render(
      node,
      `<div class="cms-pro">
        ${pageHeader({
          title: 'صفحه‌ساز حرفه‌ای',
          subtitle: 'بلوک‌ها را بکشید و رها کنید — طراحی زنده با پیش‌نمایش آنی',
          icon: 'layout-text-window-reverse',
          actions: '<button class="btn btn-light" type="button" data-preview-page><i class="bi bi-eye"></i> پیش‌نمایش</button><button class="btn btn-primary" type="button" data-publish-page><i class="bi bi-cloud-upload"></i> انتشار</button>',
        })}
        <div class="cms-builder">
          <aside class="cms-builder__blocks">
            <h3>بلوک‌ها</h3>
            <div class="builder-wire" data-block-source style="display:flex; flex-direction:column; gap:8px;">${[
              ['هیرو', 'layout-text-window', 'hero'],
              ['ویژگی‌ها', 'grid-3x3-gap', 'features'],
              ['تصویر و متن', 'card-image', 'media'],
              ['جدول قیمت', 'tags', 'pricing'],
              ['نظرات مشتریان', 'chat-quote', 'testimonials'],
              ['پرسش‌های متداول', 'patch-question', 'faq'],
              ['فراخوان عمل', 'megaphone', 'cta'],
              ['آمار', 'graph-up', 'stats'],
              ['تیم', 'people', 'team'],
            ].map(([label, icon, type]) => `<div class="cms-block" draggable="true" data-block="${type}"><i class="bi bi-${icon}"></i><span>${label}</span></div>`).join('')}</div>
            <div style="margin-top:auto; padding:14px; background:var(--nv-surface); border-radius:12px; border:1px dashed var(--nv-border); font-size:11px; color:var(--nv-text-muted);">بلوک‌ها را به ناحیه میانی بکشید و ترتیب را با دکمه‌ها تغییر دهید.</div>
          </aside>
          <section class="cms-builder__canvas" data-builder-canvas>
            <div class="cms-builder__section is-selected" data-section="hero"><span class="cms-builder__section__label">هیرو</span><div class="cms-builder__section__tools"><button class="icon-btn icon-btn--sm" data-move-up><i class="bi bi-arrow-up"></i></button><button class="icon-btn icon-btn--sm" data-move-down><i class="bi bi-arrow-down"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" data-remove-section><i class="bi bi-trash3"></i></button></div>
              <div style="text-align:center; padding:24px;"><span class="badge badge--soft-primary">جدید</span><h2 style="font-size:24px; font-weight:900; margin:12px 0;">سریع‌تر، هوشمندتر، حرفه‌ای‌تر</h2><p style="color:var(--nv-text-muted); max-width:36rem; margin:0 auto 16px;">صفحه‌ساز نواادمین با رابط کاربری کشیدن و رها کردن، به شما اجازه می‌دهد بدون کدنویسی صفحات خیره‌کننده بسازید.</p><button class="btn btn-primary">شروع کنید</button></div></div>
            <div class="cms-builder__section" data-section="features"><span class="cms-builder__section__label">ویژگی‌ها</span><div class="cms-builder__section__tools"><button class="icon-btn icon-btn--sm" data-move-up><i class="bi bi-arrow-up"></i></button><button class="icon-btn icon-btn--sm" data-move-down><i class="bi bi-arrow-down"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" data-remove-section><i class="bi bi-trash3"></i></button></div>
              <div class="grid grid--3">${['⚡ سریع', '🔒 امن', '📈 مقیاس‌پذیر'].map((item) => `<div class="card"><div class="card__body" style="text-align:center;"><strong>${item}</strong><p class="text-muted mb-0" style="font-size:12px; margin-top:6px;">توضیح کوتاه ویژگی با طراحی حرفه‌ای</p></div></div>`).join('')}</div></div>
            <div class="cms-builder__section" data-section="stats"><span class="cms-builder__section__label">آمار</span><div class="cms-builder__section__tools"><button class="icon-btn icon-btn--sm" data-move-up><i class="bi bi-arrow-up"></i></button><button class="icon-btn icon-btn--sm" data-move-down><i class="bi bi-arrow-down"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" data-remove-section><i class="bi bi-trash3"></i></button></div>
              <div class="cms-stat-row">${[
                { label:'کاربران فعال', value:'۱۲.۴k', icon:'people', tone:'primary' },
                { label:'نرخ تبدیل', value:'۳.۲٪', icon:'graph-up', tone:'success' },
                { label:'رضایت', value:'۴.۹/۵', icon:'star', tone:'warning' },
              ].map(s=>`<div class="cms-stat"><div class="cms-stat__icon cms-stat__icon--${s.tone}"><i class="bi bi-${s.icon}"></i></div><div><div class="cms-stat__value">${s.value}</div><div class="cms-stat__label">${s.label}</div></div></div>`).join('')}</div>
            </div>
          </section>
          <aside class="cms-builder__inspector">
            <h3 style="font-size:13px; font-weight:800; margin:0;">تنظیمات بخش</h3>
            <div data-inspector-body style="font-size:12px; color:var(--nv-text-muted);">یک بخش را انتخاب کنید تا تنظیمات آن را ویرایش کنید.</div>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <div class="form-field"><label class="form-label">فاصله عمودی</label><input type="range" class="form-range" min="0" max="100" value="32"></div>
              <div class="form-field"><label class="form-label">پس‌زمینه</label><div style="display:flex; gap:6px;"><span style="width:28px; height:28px; border-radius:8px; background:var(--nv-surface); border:2px solid var(--nv-primary);"></span><span style="width:28px; height:28px; border-radius:8px; background:var(--nv-surface-2); border:1px solid var(--nv-border);"></span><span style="width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg, var(--nv-primary), #8b5cf6);"></span></div></div>
            </div>
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
      toast.success('بلوک افزوده شد', `بخش «${type}» اضافه شد.`);
    });
    on(canvas, 'click', (event) => {
      const section = event.target.closest('[data-section]');
      if (!section) return;
      if (event.target.closest('[data-remove-section]')) { section.remove(); toast.info('بخش حذف شد'); return; }
      if (event.target.closest('[data-move-up]')) { const prev = section.previousElementSibling; if (prev) canvas.insertBefore(section, prev); return; }
      if (event.target.closest('[data-move-down]')) { const next = section.nextElementSibling; if (next) canvas.insertBefore(next, section); return; }
      $$('[data-section]', canvas).forEach((item) => item.classList.toggle('is-selected', item === section));
      render($('[data-inspector-body]', node), infoRows([['شناسه', escapeHtml(section.dataset.section)], ['ترتیب', toDigits([...canvas.children].indexOf(section)+1)]]));
    });
    on($('[data-preview-page]', node), 'click', () => modal.open({ title: 'پیش‌نمایش', size: 'lg', content: `<div class="card"><div class="card__body">${canvas.innerHTML.replace(/<span class="cms-builder__section__label">.*?<\/span>/g,'').replace(/<div class="cms-builder__section__tools">.*?<\/div>/g,'')}</div></div>`, footer: '<button class="btn btn-light" data-modal-close>بستن</button>' }));
    on($('[data-publish-page]', node), 'click', async () => { const ok = await modal.confirm({ title: 'انتشار صفحه', text: 'نسخه فعلی منتشر می‌شود.', tone: 'primary', confirmText: 'انتشار' }); if (!ok) return; toast.success('صفحه منتشر شد', 'نسخه جدید روی سایت قرار گرفت.'); });
    return;
  }

  // CMS data tables with rich UI
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

  if (page === 'cms/post-create.html') {
    render(
      node,
      `<div class="cms-pro">
        ${pageHeader({ title: 'نوشته جدید — ویرایشگر حرفه‌ای', subtitle: 'محتوای جذاب با سئو، دسته‌بندی و زمان‌بندی انتشار', icon: 'pencil-square', actions: '<button class="btn btn-light" type="button" data-save-draft><i class="bi bi-file-earmark"></i> پیش‌نویس</button><button class="btn btn-primary" type="button" data-publish><i class="bi bi-send"></i> انتشار</button>' })}
        <div class="cms-editor">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="card" style="border-radius:20px;"><div class="card__body">
              <form data-post-form class="form-stack">
                <div class="form-field"><label class="form-label">عنوان نوشته *</label><input class="form-control" name="title" placeholder="عنوان جذاب و سئو شده..." style="font-size:18px; font-weight:800; height:56px;"></div>
                <div class="editor" style="border:1px solid var(--nv-border); border-radius:16px; overflow:hidden; margin-top:16px;">
                  <div class="editor-toolbar" style="padding:12px 16px; background:var(--nv-surface-2); border-block-end:1px solid var(--nv-border); display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="icon-btn icon-btn--sm" type="button" data-cmd="bold"><i class="bi bi-type-bold"></i></button><button class="icon-btn icon-btn--sm" type="button" data-cmd="italic"><i class="bi bi-type-italic"></i></button><button class="icon-btn icon-btn--sm" type="button" data-cmd="insertUnorderedList"><i class="bi bi-list-ul"></i></button><button class="icon-btn icon-btn--sm" type="button" data-cmd="insertOrderedList"><i class="bi bi-list-ol"></i></button><span style="width:1px; background:var(--nv-divider); margin-inline:6px;"></span><button class="icon-btn icon-btn--sm" type="button" data-insert-image><i class="bi bi-image"></i></button><button class="icon-btn icon-btn--sm" type="button" data-insert-quote><i class="bi bi-quote"></i></button>
                    <div style="margin-inline-start:auto; display:flex; align-items:center; gap:8px; font-size:11px; color:var(--nv-text-muted);"><span data-post-words>۰</span> کلمه • <span data-post-read>۰</span> دقیقه مطالعه</div>
                  </div>
                  <div class="editor-body" contenteditable="true" data-post-body style="min-height:380px; padding:24px; font-size:14px; line-height:2; outline:none;"><h2>مقدمه جذاب</h2><p>متن خود را اینجا بنویسید… با انتخاب متن، ابزارهای قالب‌بندی ظاهر می‌شود.</p><blockquote style="border-inline-start:3px solid var(--nv-primary); padding:12px 16px; background:var(--nv-primary-soft); border-radius:12px; margin:16px 0;">نقل قول الهام‌بخش برای جلب توجه خواننده</blockquote></div>
                </div>
              </form>
            </div></div>
            <div class="card" style="border-radius:20px;"><div class="card__head" style="padding:16px 20px;"><h3 style="margin:0; font-size:13px; font-weight:800;">سئو و پیش‌نمایش گوگل</h3></div><div class="card__body" style="padding:20px; background:var(--nv-surface-2); border-radius:0 0 20px 20px;">
              <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:12px; padding:16px;"><div style="font-size:14px; color:#1a0dab; font-weight:500;">عنوان نوشته شما در نتایج گوگل — نواادمین</div><div style="font-size:12px; color:#006621;">https://novaadmin.ir/blog/your-post</div><div style="font-size:12px; color:var(--nv-text-muted); margin-top:4px;">توضیح متا جذاب که کاربر را به کلیک ترغیب می‌کند. این بخش به سئو کمک زیادی می‌کند...</div></div>
              <div class="form-grid" style="margin-top:16px; grid-template-columns:1fr 1fr;"><div class="form-field"><label class="form-label">عنوان سئو</label><input class="form-control form-control--sm"></div><div class="form-field"><label class="form-label">توضیح متا</label><input class="form-control form-control--sm"></div></div>
            </div></div>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px;">
            ${card({ title: 'تنظیمات انتشار', body: `<div class="form-stack">
              <div class="form-field"><label class="form-label">وضعیت</label><select class="form-select"><option>پیش‌نویس</option><option selected>منتشرشده</option><option>زمان‌بندی</option></select></div>
              <div class="form-field"><label class="form-label">دسته</label><select class="form-select"><option>آموزش</option><option>اخبار</option><option>محصول</option></select></div>
              <div class="form-field"><label class="form-label">برچسب‌ها</label><div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">${['سئو','طراحی','نواادمین'].map(t=>`<span class="badge badge--soft-primary" style="border-radius:999px;">${t} <i class="bi bi-x" style="cursor:pointer;"></i></span>`).join('')}</div><input class="form-control form-control--sm" placeholder="افزودن برچسب + Enter"></div>
              <div class="form-field"><label class="form-label">تصویر شاخص</label><div style="border:2px dashed var(--nv-border); border-radius:12px; padding:24px; text-align:center; background:var(--nv-surface-2);"><i class="bi bi-image" style="font-size:24px; color:var(--nv-text-muted);"></i><div style="font-size:12px; margin-top:8px;">بکشید و رها کنید یا کلیک کنید</div></div></div>
            </div>` })}
            ${card({ title: 'آمار', body: `<div class="cms-stat-row" style="grid-template-columns:1fr 1fr;"><div class="cms-stat" style="padding:12px;"><div class="cms-stat__icon cms-stat__icon--primary" style="width:36px; height:36px;"><i class="bi bi-eye"></i></div><div><div class="cms-stat__value" style="font-size:16px;">1.2k</div><div class="cms-stat__label">بازدید</div></div></div><div class="cms-stat" style="padding:12px;"><div class="cms-stat__icon cms-stat__icon--success" style="width:36px; height:36px;"><i class="bi bi-heart"></i></div><div><div class="cms-stat__value" style="font-size:16px;">84</div><div class="cms-stat__label">لایک</div></div></div></div>` })}
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
    on(body, 'input', stats); stats();
    on($('.editor-toolbar', node), 'click', (event) => {
      const button = event.target.closest('[data-cmd]');
      if (button) { const [command, argument] = String(button.dataset.cmd).split(':'); document.execCommand(command, false, argument); return; }
      if (event.target.closest('[data-insert-image]')) { body.insertAdjacentHTML('beforeend', '<figure style="margin:16px 0; text-align:center;"><img src="assets/img/products/product-02.svg" alt="" style="max-width:100%; border-radius:12px;"><figcaption style="font-size:11px; color:var(--nv-text-muted); margin-top:6px;">توضیح تصویر</figcaption></figure>'); }
      if (event.target.closest('[data-insert-quote]')) { document.execCommand('formatBlock', false, 'blockquote'); }
    });
    on($('[data-publish]', node), 'click', () => { toast.success('نوشته منتشر شد', 'در فهرست مطالب قابل مشاهده است.'); setTimeout(() => goTo('cms/posts.html'), 900); });
    on($('[data-save-draft]', node), 'click', () => toast.info('پیش‌نویس ذخیره شد', 'بعداً منتشر کنید.'));
    return;
  }

  // generic CMS list pages - PRO tables
  const titles = {
    'cms/posts.html': { title: 'نوشته‌ها', icon: 'journal-text', subtitle: 'مدیریت مقالات با ویرایشگر حرفه‌ای و سئو' },
    'cms/pages.html': { title: 'برگه‌ها', icon: 'file-earmark-text', subtitle: 'صفحات ایستا با صفحه‌ساز کشیدن و رها کردن' },
    'cms/categories.html': { title: 'دسته‌بندی‌ها', icon: 'folder2', subtitle: 'ساختاردهی محتوا با سلسله مراتب' },
    'cms/tags.html': { title: 'برچسب‌ها', icon: 'tags', subtitle: 'برچسب‌گذاری هوشمند برای سئو' },
    'cms/comments.html': { title: 'دیدگاه‌ها', icon: 'chat-left-text', subtitle: 'مدیریت نظرات با تشخیص اسپم' },
    'cms/media.html': { title: 'رسانه', icon: 'images', subtitle: 'کتابخانه تصاویر و فایل‌ها' },
  };
  const meta = titles[page] || { title: 'محتوا', icon: 'journal-text', subtitle: 'مدیریت محتوا' };

  const stats = {
    'cms/posts.html': [
      { label: 'کل نوشته‌ها', value: '۲۴۸', icon: 'journal-text', tone: 'primary' },
      { label: 'منتشر شده', value: '۱۸۶', icon: 'check-circle', tone: 'success' },
      { label: 'پیش‌نویس', value: '۳۲', icon: 'file-earmark', tone: 'warning' },
      { label: 'بازدید امروز', value: '۴.۲k', icon: 'eye', tone: 'info' },
    ],
    'cms/pages.html': [
      { label: 'کل برگه‌ها', value: '۳۴', icon: 'file-earmark-text', tone: 'primary' },
      { label: 'منتشر شده', value: '۲۸', icon: 'check-circle', tone: 'success' },
      { label: 'پیش‌نویس', value: '۶', icon: 'file-earmark', tone: 'warning' },
    ],
    'cms/categories.html': [
      { label: 'دسته‌ها', value: '۱۲', icon: 'folder2', tone: 'primary' },
      { label: 'نوشته‌ها', value: '۲۴۸', icon: 'journal-text', tone: 'info' },
    ],
    'cms/tags.html': [
      { label: 'برچسب‌ها', value: '۸۴', icon: 'tags', tone: 'primary' },
      { label: 'محبوب‌ترین', value: 'سئو', icon: 'star', tone: 'warning' },
    ],
    'cms/comments.html': [
      { label: 'کل دیدگاه', value: '۱.۲k', icon: 'chat-left-text', tone: 'primary' },
      { label: 'تأیید شده', value: '۹۸۴', icon: 'check-circle', tone: 'success' },
      { label: 'در انتظار', value: '۴۲', icon: 'clock', tone: 'warning' },
      { label: 'اسپم', value: '۱۸', icon: 'shield-exclamation', tone: 'danger' },
    ],
  };

  render(
    node,
    `<div class="cms-pro">
      ${pageHeader({ title: meta.title, subtitle: meta.subtitle, icon: meta.icon, actions: toolButtons({ create: 'افزودن جدید', exportResource: resource }) })}
      ${stats[page] ? `<div class="cms-stat-row">${stats[page].map(s=>`<div class="cms-stat"><div class="cms-stat__icon cms-stat__icon--${s.tone}"><i class="bi bi-${s.icon}"></i></div><div><div class="cms-stat__value">${s.value}</div><div class="cms-stat__label">${s.label}</div></div></div>`).join('')}</div>` : ''}
      <div class="card cms-table-card"><div class="card__head" style="display:flex; align-items:center; justify-content:space-between;"><h3 style="margin:0; font-size:14px; font-weight:800;">فهرست ${meta.title}</h3><div style="display:flex; gap:8px;"><div class="input-group input-group--icon" style="max-width:220px;"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجو..." data-cms-search></div><button class="btn btn-light btn-sm" data-cms-filter><i class="bi bi-funnel"></i> فیلتر</button></div></div><div class="card__body" style="padding:0;" data-datatable data-resource="${escapeHtml(resource)}"><div class="table-wrap"><table class="table table--hover"><thead><tr></tr></thead><tbody data-datatable-body></tbody></table></div><div class="datatable__foot" data-datatable-foot></div></div></div>
    </div>`,
  );
  const table = createDataTable($('[data-datatable]', node), { resource });
  on($('[data-create]', node), 'click', () => {
    const fields = {
      posts: [{ name: 'title', label: 'عنوان', required: true, col: 2 }, { name: 'category', label: 'دسته' }, { name: 'status', label: 'وضعیت', type: 'select', options: ['published','draft'] }],
      pages: [{ name: 'title', label: 'عنوان', required: true }, { name: 'slug', label: 'نامک' }],
      categories: [{ name: 'name', label: 'نام دسته', required: true }, { name: 'parent', label: 'والد' }],
      tags: [{ name: 'name', label: 'برچسب', required: true }, { name: 'slug', label: 'نامک' }],
      comments: [{ name: 'author', label: 'نویسنده' }, { name: 'body', label: 'متن', type: 'textarea', col: 2 }],
    };
    openRecordForm({ resource, title: `افزودن ${meta.title}`, fields: fields[resource] ?? fields.posts, onSaved: () => table.reload() });
  });
  on($('[data-cms-search]', node), 'input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    $$('tbody tr', node).forEach(tr => { tr.hidden = term ? !tr.textContent.toLowerCase().includes(term) : false; });
  });
  exportable(node, resource);
}

export async function initApp() {
  const page = kit.pageId();
  switch (page) {
    case 'apps/email.html': return mailClient();
    case 'apps/chat.html': return chatApp();
    case 'apps/calendar.html': return calendarApp();
    case 'apps/file-manager.html': return fileManager();
    case 'apps/media-library.html': return mediaLibrary();
    case 'apps/notifications.html': return notificationsPage();
    default: return;
  }
}

const sectionMarkup = (type) => `<div class="cms-builder__section" data-section="${escapeHtml(type)}">
  <span class="cms-builder__section__label">${escapeHtml(type)}</span>
  <div class="cms-builder__section__tools"><button class="icon-btn icon-btn--sm" type="button" data-move-up><i class="bi bi-arrow-up"></i></button><button class="icon-btn icon-btn--sm" type="button" data-move-down><i class="bi bi-arrow-down"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove-section><i class="bi bi-trash3"></i></button></div>
  <div class="card"><div class="card__body"><p class="text-muted mb-0" style="font-size:12px;">بلوک ${escapeHtml(type)} — محتوای نمونه قابل ویرایش</p></div></div>
</div>`;

export default { initApp, initCms };
