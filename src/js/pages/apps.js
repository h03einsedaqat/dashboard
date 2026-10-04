/**
 * NOVAADMIN — application pages PRO
 * Rewritten for professional UX: chat, mail, calendar, CMS
 */
import { $, $$, on, render, escapeHtml } from '../core/dom.js';
import { phrase } from '../core/translate.js';
import { bus, EVENTS } from '../core/bus.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { storage, KEYS } from '../core/storage.js';
import { formatNumber, toDigits, formatCurrency } from '../core/numbers.js';
import { formatDate, relativeTime } from '../core/jalali.js';
import { initCharts } from '../core/charts.js';
import { createDataTable } from '../core/datatable.js';
import { initCalendar, newCalendarEvent } from '../core/calendar.js';
import { goTo, url } from '../core/links.js';
import * as kit from './kit.js';
import { initRails } from '../core/rail.js';

const { card, statCard, infoRows, host, pageHeader, formMarkup, openRecordForm, exportable, emptyState, statusBadge, toolButtons, chartBox, services } = kit;

const safeAvatar = (i = 1) => {
  const n = ((Math.abs(Number(i) || 1) - 1) % 24) + 1;
  return url(`assets/img/avatars/avatar-${String(n).padStart(2, '0')}.svg`);
};

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
      <div class="mail-layout${id ? ' is-reading' : ''}">
        <aside class="mail-nav">
          <button class="btn btn-primary w-100" type="button" data-compose style="height:48px; border-radius:14px; font-weight:800;"><i class="bi bi-pencil-square"></i> نامه جدید</button>
          <ul class="mail-nav__list" data-mail-folders>${folders
            .map(
              (folder) => `<li><a class="mail-nav__link ${folder.id === query ? 'is-active' : ''}" href="apps/email.html?folder=${escapeHtml(folder.id)}"><i class="bi bi-${escapeHtml(folder.icon ?? 'folder')}"></i><span>${escapeHtml(folder.label)}</span><span class="mail-nav__count">${toDigits(folder.count ?? 0)}</span></a></li>`,
            )
            .join('')}</ul>
          <div class="mail-nav__divider" style="height:1px; background:var(--nv-divider); margin:4px 0;"></div>
          <p class="mail-nav__labels" style="font-size:11px; font-weight:800; letter-spacing:0.06em; color:var(--nv-text-muted); margin:0 0 8px;">برچسب‌ها</p>
          <ul class="mail-nav__list mail-nav__list--labels">${[
            ['کاری', 'primary'],
            ['شخصی', 'success'],
            ['فاکتور', 'warning'],
            ['پشتیبانی', 'info'],
          ].map(([label, tone]) => `<li><a class="mail-nav__link" href="#"><span class="status-dot status-dot--${tone}"></span><span>${label}</span></a></li>`).join('')}</ul>
          <div class="card mail-nav__storage" style="margin-top:auto; background:var(--nv-surface); border-radius:14px; padding:14px;">
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
            <div class="mail-item__subject">${escapeHtml(mail.subject)} <span>— ${escapeHtml(phrase(mail.preview || mail.body || '').slice(0,90))}</span></div>
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
        ${(() => {
          const paragraphs = (Array.isArray(mail.body) ? mail.body : String(mail.body || mail.preview || '').split(/\n+/)).map((line) => String(line).trim()).filter(Boolean);
          return (paragraphs.length ? paragraphs : ['محتوای این نامه خالی است.']).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
        })()}
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
    { id: 'c1', name: 'سارا محمدی', avatar: safeAvatar(8), role: 'مدیر محصول', preview: 'فایل طراحی جدید رو دیدی؟ عالی شده!', unread: 2, updatedAt: new Date().toISOString(), status: 'online' },
    { id: 'c2', name: 'تیم طراحی', avatar: safeAvatar(3), role: 'گروه', preview: 'علی: جلسه فردا ساعت ۱۰', unread: 0, updatedAt: new Date(Date.now()-3600000).toISOString(), status: 'online' },
    { id: 'c3', name: 'رضا کریمی', avatar: safeAvatar(5), role: 'توسعه‌دهنده ارشد', preview: 'مرج ریکوئست رو بررسی کردم', unread: 1, updatedAt: new Date(Date.now()-7200000).toISOString(), status: 'busy' },
    { id: 'c4', name: 'مریم حسینی', avatar: safeAvatar(12), role: 'پشتیبانی', preview: 'تیکت جدید ثبت شد', unread: 0, updatedAt: new Date(Date.now()-86400000).toISOString(), status: 'away' },
  ];
  const presenceList = presence.length ? presence : convList.slice(0,6);

  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({ title: 'گفتگوهای تیمی', subtitle: 'چت امن، سریع و حرفه‌ای با قابلیت ارسال فایل و تماس', icon: 'chat-dots', actions: '<button class="btn btn-light" data-chat-new><i class="bi bi-plus-lg"></i> گفتگوی جدید</button>' })}
      <div class="chat-layout is-list" data-chat-layout>
        <aside class="chat-sidebar">
          <div class="chat-sidebar__head">
            <div class="chat-search"><i class="bi bi-search"></i><input type="search" placeholder="جستجوی مخاطب یا پیام..." data-chat-filter></div>
            <div style="margin-top:16px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;"><span style="font-size:11px; font-weight:800; letter-spacing:0.06em; color:var(--nv-text-muted);">آنلاین‌ها</span><span class="badge badge--soft-success" style="font-size:10px;">${toDigits(presenceList.filter(p=>p.status==='online').length)} فعال</span></div>
              <div class="chat-presence-row">${presenceList
                .slice(0, 8)
                .map((person) => `<button type="button" class="chat-presence ${person.status==='online'?'chat-presence--online': person.status==='busy'?'chat-presence--busy':''}" data-presence="${escapeHtml(person.id)}" title="${escapeHtml(person.name)}">
                  <img src="${url(person.avatar)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
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
                <img class="avatar" src="${url(conversation.avatar ?? safeAvatar(2))}" alt="" style="width:44px; height:44px; border-radius:14px; object-fit:cover; flex-shrink:0;">
                <div class="chat-contact__body">
                  <div class="chat-contact__top"><span class="chat-contact__name">${escapeHtml(conversation.name)}</span><span class="chat-contact__time">${conversation.updatedAt ? relativeTime(conversation.updatedAt) : toDigits(conversation.messages?.at(-1)?.time ?? '')}</span></div>
                  <div class="chat-contact__preview"><i class="bi bi-check2-all" style="color:var(--nv-success);"></i> ${escapeHtml(conversation.preview ?? conversation.messages?.at(-1)?.text ?? '')}</div>
                </div>
                ${conversation.unread ? `<span class="chat-contact__unread">${toDigits(conversation.unread)}</span>` : ''}
              </button>`,
            )
            .join('')}</div>
        </aside>

        <section class="chat-panel" style="display:flex; flex-direction:column;">
          <header class="chat-panel__head">
            <button class="icon-btn chat-back" type="button" data-chat-back aria-label="بازگشت به فهرست گفتگوها"><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
            <div class="chat-user">
              <div class="chat-user__avatar"><img src="${url(convList[0]?.avatar)}" alt="" style="width:44px;height:44px;border-radius:14px;object-fit:cover;"><span class="chat-user__avatar__status"></span></div>
              <div><div class="chat-user__name" data-chat-name>${escapeHtml(convList[0]?.name)}</div><div class="chat-user__sub"><span class="status-dot status-dot--online"></span> آنلاین</div></div>
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
        const avatarImg = $('.chat-user__avatar img', node);
        if (avatarImg) avatarImg.src = url(conv.avatar);
      }
      contact.querySelector('.chat-contact__unread')?.remove();
      render(stream, await chatStreamMarkup(active, convList));
      $('[data-chat-layout]', node)?.classList.remove('is-list');
      scroll();
      return;
    }
    if (event.target.closest('[data-chat-back]')) {
      $('[data-chat-layout]', node)?.classList.add('is-list');
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
        content: `<div style="text-align:center; padding:20px;"><img src="${url(conversation?.avatar)}" style="width:88px; height:88px; border-radius:28px; margin:0 auto 16px; display:block; border:3px solid var(--nv-surface); box-shadow:var(--nv-shadow-lg); object-fit:cover;"><h3 style="margin:0 0 4px; font-weight:900;">${escapeHtml(conversation?.name ?? '')}</h3><p style="color:var(--nv-text-muted); font-size:12px; margin:0;">${escapeHtml(conversation?.role ?? '')}</p><div style="display:flex; gap:8px; justify-content:center; margin-top:16px;"><span class="badge badge--soft-success">آنلاین</span><span class="badge badge--soft-primary">${toDigits(128)} پیام</span></div></div>`,
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
      stream.insertAdjacentHTML('beforeend', `<article class="msg msg--in"><span class="msg__avatar"><img src="${url(person?.avatar ?? safeAvatar(2))}" alt="" style="width:32px; height:32px; border-radius:10px; object-fit:cover;"></span><div class="msg__body"><div class="msg__bubble">${escapeHtml(text2)}</div><div class="msg__meta"><time>همین حالا</time></div></div></article>`);
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
  const raw = detail?.messages ?? [
    { from: 'them', text: 'سلام! جلسه فردا ساعت ۱۰ تایید شد؟', at: new Date(Date.now()-3600000*3).toISOString() },
    { from: 'me', text: 'سلام، بله تایید شد. اسلایدها آماده‌ست.', at: new Date(Date.now()-3600000*2.5).toISOString() },
    { from: 'them', text: 'عالیه، فایل طراحی جدید رو دیدی؟', at: new Date(Date.now()-3600000*2).toISOString() },
    { from: 'me', text: 'آره دیدم، خیلی حرفه‌ای شده. فقط رنگ دکمه‌ها رو باید با برند جدید هماهنگ کنیم.', at: new Date(Date.now()-3600000*1).toISOString() },
    { from: 'them', text: 'دقیقا، منم همینو می‌خواستم بگم. تا عصر اصلاح می‌کنم.', at: new Date(Date.now()-1800000).toISOString() },
  ];
  /* Service messages use `side` + `time`; the fallback uses `from` + `at`. */
  const messages = raw.map((m) => ({
    ...m,
    mine: m.side ? m.side === 'out' : m.from === 'me',
    stamp: m.time ? toDigits(m.time) : m.at ? relativeTime(m.at) : '',
  }));
  const fallback = fallbackList.find(c=>c.id===conversationId);
  const name = detail?.name ?? fallback?.name ?? 'همکار';
  const avatar = detail?.avatar ?? fallback?.avatar ?? safeAvatar(2);
  if (!messages.length) return emptyState({ title: 'اینجا ساکت است', text: 'اولین پیام را بفرستید.', icon: 'chat-square-dots' });
  return `<div class="chat-day-divider" style="text-align:center; margin:8px 0;"><span style="background:var(--nv-surface-2); padding:4px 12px; border-radius:999px; font-size:11px; color:var(--nv-text-muted);">امروز • ${formatDate(new Date(), { format: 'medium' })}</span></div>
    ${messages.map((message) => `
      <article class="msg ${message.mine ? 'msg--out' : 'msg--in'}">
        ${!message.mine ? `<span class="msg__avatar"><img src="${url(avatar)}" alt="" style="width:36px; height:36px; border-radius:12px; object-fit:cover; display:block;"></span>` : ''}
        <div class="msg__body">
          <div class="msg__bubble">${escapeHtml(message.text)}${(message.attachments ?? []).map((file) => `<span class="msg__file"><i class="bi bi-file-earmark-arrow-down" aria-hidden="true"></i><span dir="ltr">${escapeHtml(file.name)}</span><small>${escapeHtml(file.size ?? '')}</small></span>`).join('')}</div>
          <div class="msg__meta">${message.reactions?.length ? `<span class="msg__reactions">${message.reactions.join(' ')}</span>` : ''}<time>${message.stamp}${message.mine ? ' • ✓✓' : ''}</time></div>
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
      if (!newCalendarEvent($('[data-calendar]', node))) toast.info('رویداد جدید', 'تقویم هنوز در حال بارگذاری است؛ لحظه‌ای بعد دوباره امتحان کنید.');
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
  const defaultFiles = [
    { id: 'f1', name: 'صورت‌های مالی و ترازنامه ۱۴۰۳.pdf', type: 'pdf', size: '۴٫۲ MB', updatedAt: 'امروز، ۱۰:۳۰' },
    { id: 'f2', name: 'دیزاین سیستم و کتابخانه کامپوننت نواادمین.fig', type: 'fig', size: '۲۸٫۵ MB', updatedAt: 'دیروز، ۱۶:۱۵' },
    { id: 'f3', name: 'کاتالوگ جامع محصولات سازمانی نسخه پاییز.pdf', type: 'pdf', size: '۱۲٫۱ MB', updatedAt: '۳ روز پیش' },
    { id: 'f4', name: 'پایگاه داده مشتریان و بخش‌بندی RFM.xlsx', type: 'xlsx', size: '۱٫۸ MB', updatedAt: '۴ روز پیش' },
    { id: 'f5', name: 'ویدیو موشن معرفی داشبورد و راهنمای کاربری.mp4', type: 'mp4', size: '۸۴٫۰ MB', updatedAt: 'هفته گذشته' },
    { id: 'f6', name: 'سورس کامل قالب پنل مدیریت نواادمین نسخه ۱.۰.۲.zip', type: 'zip', size: '۱۵٫۶ MB', updatedAt: 'هفته گذشته' },
    { id: 'f7', name: 'قرارداد رسمی همکاری و پیمانکاری شرکت.docx', type: 'docx', size: '۵۲۰ KB', updatedAt: '۲ هفته پیش' },
    { id: 'f8', name: 'لوگوتایپ و هویت بصری برند نوا.svg', type: 'svg', size: '۱۸۰ KB', updatedAt: '۳ هفته پیش' },
    { id: 'f9', name: 'فایل صوتی جلسه هیئت مدیره و تصمیمات اسپرینت.m4a', type: 'audio', size: '۲۲٫۴ MB', updatedAt: '۳ هفته پیش' },
    { id: 'f10', name: 'تیزر تبلیغاتی رونمایی تابستانه محصولات.mp4', type: 'mp4', size: '۱۱۰٫۵ MB', updatedAt: 'یک ماه پیش' },
    { id: 'f11', name: 'گزارش تحلیل شاخص رضایت مشتریان NPS.pdf', type: 'pdf', size: '۳٫۶ MB', updatedAt: 'یک ماه پیش' },
    { id: 'f12', name: 'مستندات راهنمای فنی API و وب‌هوک‌ها.pdf', type: 'pdf', size: '۵٫۴ MB', updatedAt: 'دو ماه پیش' },
  ];
  const items = files.items?.length ? files.items : defaultFiles;
  render(
    node,
    `<div class="dashboard-shell">
      ${pageHeader({
        title: 'مدیریت فایل و اسناد',
        subtitle: 'مدیریت متمرکز، اشتراک‌گذاری، پیش‌نمایش و فضای ابری سازمانی',
        icon: 'folder2-open',
        actions: toolButtons({ extra: '<button class="btn btn-light" type="button" data-new-folder><i class="bi bi-folder-plus"></i> پوشه جدید</button><label class="btn btn-primary"><i class="bi bi-cloud-arrow-up"></i> بارگذاری فایل<input type="file" hidden data-upload></label>' }),
      })}
      <div class="files-layout">
        <aside class="files-nav">
          <ul class="files-nav__list">${[
            ['همه فایل‌ها', 'folder2-open', items.length],
            ['اسناد مالی و قراردادها', 'file-earmark-text', 4],
            ['رسانه‌ها و ویدیوها', 'camera-video', 3],
            ['آرشیو و فشرده', 'archive', 2],
            ['مورد علاقه', 'star', 6],
            ['اشتراک‌گذاشته‌شده', 'share', 3],
            ['سطل زباله', 'trash3', 2],
          ].map(([label, icon, count], index) => `<li><a class="files-nav__link ${index === 0 ? 'is-active' : ''}" href="#"><i class="bi bi-${icon}"></i><span>${label}</span><span class="files-nav__meta">${toDigits(count)}</span></a></li>`).join('')}</ul>
          <div class="files-storage">
            <p class="files-storage__title">فضای ابری سازمانی</p>
            <div class="progress progress--sm mb-2"><div class="progress-bar" style="width:${Math.min(100, storageInfo.storage?.used ?? 68)}%"></div></div>
            <p class="files-storage__text" style="font-size:11px; margin:0; display:flex; justify-content:space-between;">
              <span>مصرف‌شده: <strong>${toDigits(storageInfo.storage?.used ?? 68)} GB</strong></span>
              <span>کل فضا: <strong>${toDigits(storageInfo.storage?.total ?? 200)} GB</strong></span>
            </p>
          </div>
        </aside>
        <section class="files-panel">
          <div class="files-breadcrumb"><a href="#">خانه</a><i class="bi bi-chevron-left"></i><a href="#">اسناد سازمانی</a><i class="bi bi-chevron-left"></i><span>۱۴۰۳</span></div>
          <div class="d-flex align-items-center gap-2 mb-3">
            <div class="input-group input-group--icon" style="max-width:24rem"><i class="bi bi-search"></i><input class="form-control form-control--sm" type="search" placeholder="جستجوی نام یا پسوند فایل..." data-file-search></div>
            <div class="view-switch ms-auto" data-view-switch="files"><button class="view-switch__btn is-active" type="button" data-view="grid"><i class="bi bi-grid"></i></button><button class="view-switch__btn" type="button" data-view="list"><i class="bi bi-list-ul"></i></button></div>
          </div>
          <div class="files-grid" data-files-grid>${items.map((file) => fileCard(file)).join('')}</div>
        </section>
      </div>
    </div>`,
  );
  on($('[data-file-search]', node), 'input', (event) => {
    const term = event.target.value.trim().toLowerCase();
    $$('.file-card', node).forEach((item) => { item.hidden = term ? !item.textContent.toLowerCase().includes(term) : false; });
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
      const name = await modal.prompt({ title: 'تغییر نام فایل', label: 'نام جدید', value: card2.dataset.name });
      if (!name) return;
      card2.querySelector('.file-card__name').textContent = name;
      card2.dataset.name = name;
      toast.success('نام تغییر کرد', 'نام جدید ذخیره شد.');
      return;
    }
    if (event.target.closest('[data-file-delete]')) {
      const ok = await modal.confirm({ title: 'حذف فایل', text: `آیا از انتقال «${card2.dataset.name}» به سطل زباله اطمینان دارید؟`, tone: 'danger', confirmText: 'حذف فایل' });
      if (ok) {
        card2.remove();
        toast.success('فایل حذف شد', 'فایل به سطل زباله منتقل گردید.');
      }
      return;
    }
    card2.classList.toggle('is-selected');
  });
  exportable(node, 'files');
}
const fileCard = (file) => {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  let iconClass = 'bi-file-earmark-text text-primary';
  if (['pdf'].includes(ext)) iconClass = 'bi-file-earmark-pdf-fill text-danger';
  else if (['fig', 'zip', 'rar', '7z', 'tar'].includes(ext)) iconClass = 'bi-file-earmark-zip-fill text-warning';
  else if (['xlsx', 'xls', 'csv'].includes(ext)) iconClass = 'bi-file-earmark-excel-fill text-success';
  else if (['doc', 'docx'].includes(ext)) iconClass = 'bi-file-earmark-word-fill text-info';
  else if (['mp4', 'mkv', 'mov'].includes(ext)) iconClass = 'bi-file-earmark-play-fill text-danger';
  else if (['mp3', 'm4a', 'wav'].includes(ext)) iconClass = 'bi-file-earmark-music-fill text-violet';
  else if (['svg', 'png', 'jpg', 'webp'].includes(ext)) iconClass = 'bi-file-earmark-image-fill text-success';

  return `<figure class="file-card" data-id="${escapeHtml(file.id ?? file.name)}" data-name="${escapeHtml(file.name)}">
    <div class="file-card__thumb"><span class="file-card__icon"><i class="bi ${iconClass}" style="font-size:2rem;"></i></span></div>
    <figcaption class="file-card__meta"><span class="file-card__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span><span class="list-item__sub">${escapeHtml(file.size ?? '')} • ${escapeHtml(file.updatedAt ?? 'امروز')}</span></figcaption>
    <div class="file-card__check"><button class="icon-btn icon-btn--sm" type="button" data-file-rename title="تغییر نام"><i class="bi bi-pencil"></i></button><button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-file-delete title="حذف"><i class="bi bi-trash3"></i></button></div>
  </figure>`;
};

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
  let notifications = [
    { id: 'notif-1', category: 'finance', priority: 'high', type: 'success', icon: 'credit-card-2-front-fill', title: 'پرداخت موفق سفارش #ORD-۱۰۸۴', text: 'مبلغ ۶۸,۵۰۰,۰۰۰ ریال از طریق درگاه پرداخت با موفقیت تسویه و به حساب متصل شد.', time: '۵ دقیقه پیش', read: false, action: { label: 'مشاهده سفارش', url: 'ecommerce/orders.html' } },
    { id: 'notif-2', category: 'security', priority: 'urgent', type: 'danger', icon: 'shield-exclamation', title: 'هشدار امنیتی: تلاش برای ورود ناموفق', text: '۳ تلاش ناموفق برای ورود به حساب مدیر ارشد از نشانی IP: 185.220.101.5 (فرانکفورت، آلمان) ثبت شد.', time: '۲۲ دقیقه پیش', read: false, action: { label: 'بررسی امنیت', url: 'profile/security.html' } },
    { id: 'notif-3', category: 'system', priority: 'normal', type: 'info', icon: 'cpu-fill', title: 'تکمیل پشتیبان‌گیری خودکار دیتابیس', text: 'پشتیبان هفتگی پایگاه داده با حجم ۱٫۴ گیگابایت با موفقیت در فضای ابری ذخیره شد.', time: '۱ ساعت پیش', read: false, action: { label: 'تنظیمات سیستم', url: 'settings/system.html' } },
    { id: 'notif-4', category: 'orders', priority: 'normal', type: 'primary', icon: 'box-seam-fill', title: 'سفارش جدید نیازمند آماده‌سازی', text: 'مشتری «شرکت داده‌پردازان پارس» پیش‌فاکتور شماره INV-۲۳۸۱ را تأیید کرد.', time: '۲ ساعت پیش', read: false, action: { label: 'مشاهده فاکتور', url: 'finance/invoices.html' } },
    { id: 'notif-5', category: 'ai', priority: 'normal', type: 'warning', icon: 'stars', title: 'مصرف ۷۵٪ از سهمیه توکن ماهانه هوش مصنوعی', text: 'در ۳۰ روز گذشته بیش از ۷۵۰ هزار توکن مصرف شده است. برای جلوگیری از وقفه پلن خود را ارتقا دهید.', time: '۳ ساعت پیش', read: false, action: { label: 'کارگاه هوش مصنوعی', url: 'ai/dashboard.html' } },
    { id: 'notif-6', category: 'orders', priority: 'high', type: 'primary', icon: 'truck', title: 'محموله NVX-101 وارد محدوده تحویل شد', text: 'کامیون حامل تجهیزات سرور به انبار مرکزی اصفهان رسید و در صف تخلیه قرار گرفت.', time: '۵ ساعت پیش', read: false, action: { label: 'ردیابی زنده', url: 'logistics/tracking.html' } },
    { id: 'notif-7', category: 'finance', priority: 'normal', type: 'success', icon: 'cash-stack', title: 'واریز پورسانت همکاران فروش', text: 'تسویه حساب ماهانه برای ۱۲ نماینده فروش با موفقیت پردازش و حواله شد.', time: 'دیروز', read: true, action: { label: 'گزارش مالی', url: 'finance/overview.html' } },
    { id: 'notif-8', category: 'security', priority: 'normal', type: 'info', icon: 'key-fill', title: 'ایجاد کلید جدید API با دسترسی نوشتن', text: 'کلید Production-Mobile توسط کاربر «سارا محمدی» با موفقیت صادر شد.', time: 'دیروز', read: true, action: { label: 'کلیدهای API', url: 'profile/api-keys.html' } },
    { id: 'notif-9', category: 'system', priority: 'normal', type: 'info', icon: 'patch-check-fill', title: 'انتشار نسخه جدید NOVAADMIN ۱٫۱٫۰', text: 'ورود و نشست پایدار، مودال‌ها و جدول‌های کاملاً ریسپانسیو، کانبان روان و استودیو تصاویر محصول.', time: '۲ روز پیش', read: true, action: { label: 'تغییرات نسخه', url: 'system/changelog.html' } },
    { id: 'notif-10', category: 'orders', priority: 'normal', type: 'success', icon: 'chat-left-heart-fill', title: 'ثبت دیدگاه ۵ ستاره جدید برای محصول', text: 'کاربر رضا نوری برای «قالب داشبورد نواادمین» امتیاز کامل ثبت کرد.', time: '۳ روز پیش', read: true, action: { label: 'دیدگاه‌ها', url: 'cms/comments.html' } },
  ];

  let currentCategory = 'all';

  const CATEGORIES = [
    { id: 'all', label: 'همه' },
    { id: 'unread', label: 'خوانده‌نشده' },
    { id: 'finance', label: 'مالی' },
    { id: 'security', label: 'امنیت' },
    { id: 'orders', label: 'سفارش‌ها و لجستیک' },
    { id: 'ai', label: 'هوش مصنوعی' },
    { id: 'system', label: 'سیستم' },
  ];
  const CATEGORY_TONE = {
    finance: 'success',
    security: 'danger',
    orders: 'primary',
    system: 'info',
    ai: 'warning',
  };
  const PRIORITY = {
    urgent: { label: 'فوری', tone: 'danger' },
    high: { label: 'مهم', tone: 'warning' },
    normal: { label: null, tone: 'neutral' },
  };
  const isPhone = () => window.matchMedia('(max-width: 767.98px)').matches;

  const itemMarkup = (item) => {
    const priority = PRIORITY[item.priority] ?? PRIORITY.normal;
    const tone = item.type ?? CATEGORY_TONE[item.category] ?? 'primary';
    return `<details class="feed-item${item.read ? '' : ' is-unread'}" data-id="${escapeHtml(item.id)}" open>
      <summary class="feed-item__head">
        <span class="feed-item__icon feed-item__icon--${escapeHtml(tone)}"><i class="bi bi-${escapeHtml(item.icon)}" aria-hidden="true"></i></span>
        <span class="feed-item__headline">
          <span class="feed-item__title">${escapeHtml(item.title)}</span>
          <span class="feed-item__meta">
            ${item.read ? '' : '<span class="feed-item__unread">خوانده‌نشده</span>'}
            ${priority.label ? statusBadge(priority.label, priority.tone) : ''}
            <span class="feed-item__time"><i class="bi bi-clock" aria-hidden="true"></i> ${escapeHtml(item.time)}</span>
          </span>
        </span>
        <i class="bi bi-chevron-down feed-item__caret" aria-hidden="true"></i>
      </summary>
      <div class="feed-item__body">
        <p class="feed-item__text">${escapeHtml(item.text)}</p>
        <div class="feed-item__actions">
          ${item.action ? `<a class="btn btn-primary btn-sm" href="${escapeHtml(item.action.url)}">${escapeHtml(item.action.label)} <i class="bi bi-arrow-left" aria-hidden="true"></i></a>` : ''}
          <button class="btn btn-light btn-sm" type="button" data-toggle-read="${escapeHtml(item.id)}">${item.read ? 'علامت خوانده‌نشده' : 'علامت خوانده‌شد'}</button>
          <button class="btn btn-light btn-sm text-danger" type="button" data-delete-notif="${escapeHtml(item.id)}" aria-label="حذف اعلان"><i class="bi bi-trash3" aria-hidden="true"></i></button>
        </div>
      </div>
    </details>`;
  };

  const renderContent = () => {
    const unreadCount = notifications.filter((item) => !item.read).length;
    const filtered = notifications.filter((item) => {
      if (currentCategory === 'all') return true;
      if (currentCategory === 'unread') return !item.read;
      return item.category === currentCategory;
    });
    const countOf = (id) => (id === 'all' ? notifications.length : id === 'unread' ? unreadCount : notifications.filter((item) => item.category === id).length);

    render(
      node,
      `<div class="dashboard-shell feed">
        ${pageHeader({
          title: 'مرکز اعلان‌ها و رخدادهای سیستم',
          subtitle: 'هشدارهای امنیتی، مالی، انبار و محصول — دسته‌بندی‌شده و قابل پیگیری',
          icon: 'bell-fill',
          badges: [statusBadge(`${toDigits(unreadCount)} خوانده‌نشده`, unreadCount ? 'warning' : 'success'), statusBadge(`${toDigits(notifications.length)} اعلان`, 'neutral')],
          actions: '<button class="btn btn-light" type="button" data-mark-all-read><i class="bi bi-check2-all"></i> خواندن همه</button><button class="btn btn-light" type="button" data-clear-read><i class="bi bi-trash3"></i> پاک‌سازی خوانده‌شده‌ها</button><a class="btn btn-light" href="settings/notifications.html"><i class="bi bi-gear"></i> تنظیمات</a>',
        })}

        <div class="kpi-row grid grid--4 mb-4">
          ${kit.statCard({ label: 'کل اعلان‌ها', value: toDigits(notifications.length), meta: 'در ۳۰ روز گذشته', tone: 'primary', icon: 'bell', id: 'feed-total' })}
          ${kit.statCard({ label: 'خوانده‌نشده', value: toDigits(unreadCount), meta: unreadCount ? 'نیازمند بررسی شما' : 'همه موارد بررسی شد', tone: unreadCount ? 'warning' : 'success', icon: 'envelope-open', id: 'feed-unread' })}
          ${kit.statCard({ label: 'هشدارهای امنیتی', value: toDigits(notifications.filter((item) => item.category === 'security').length), meta: 'نیازمند تأیید هویت', tone: 'danger', icon: 'shield-exclamation', id: 'feed-security' })}
          ${kit.statCard({ label: 'رخدادهای مالی', value: toDigits(notifications.filter((item) => item.category === 'finance').length), meta: 'تسویه و پرداخت موفق', tone: 'success', icon: 'cash-stack', id: 'feed-finance' })}
        </div>

        <section class="card feed-board">
          <header class="card__head feed-board__head">
            <span class="card__icon"><i class="bi bi-inbox" aria-hidden="true"></i></span>
            <div>
              <h2 class="card__title">اعلان‌ها</h2>
              <p class="card__subtitle">نمایش ${toDigits(filtered.length)} از ${toDigits(notifications.length)} مورد${isPhone() ? ' — روی هر عنوان بزنید تا جزئیات باز شود' : ''}</p>
            </div>
            <div class="card__actions feed-filters" role="group" aria-label="فیلتر دسته‌بندی" data-rail>
              ${CATEGORIES.map(
                (category) => `<button type="button" class="feed-filter${currentCategory === category.id ? ' is-active' : ''}" data-cat="${category.id}">${escapeHtml(category.label)}<span class="numeric">${toDigits(countOf(category.id))}</span></button>`,
              ).join('')}
            </div>
          </header>
          <div class="card__body card__body--flush">
            <div class="feed-list" data-notif-list>
              ${filtered.length ? filtered.map(itemMarkup).join('') : kit.emptyState({ title: 'اعلانی در این دسته نیست', text: 'دسته دیگری را انتخاب کنید یا فیلتر را روی «همه» بگذارید.', icon: 'bell-slash' })}
            </div>
          </div>
        </section>
      </div>`,
    );

    /* Phones get a collapsed drawer per item: the summary is the notification,
       tapping expands it to the full text + actions. */
    if (isPhone()) {
      const items = $$('.feed-item', node);
      const firstUnread = items.find((item) => item.classList.contains('is-unread'));
      items.forEach((item) => {
        item.open = item === firstUnread;
      });
    }
    initRails(node);
  };

  renderContent();

  /* Re-collapse/expand when the viewport crosses the phone breakpoint. */
  const phoneQuery = window.matchMedia('(max-width: 767.98px)');
  const onBreakpoint = () => renderContent();
  if (phoneQuery.addEventListener) phoneQuery.addEventListener('change', onBreakpoint);
  else phoneQuery.addListener(onBreakpoint);

  on(node, 'click', async (event) => {
    const catBtn = event.target.closest('[data-cat]');
    if (catBtn) {
      currentCategory = catBtn.dataset.cat;
      renderContent();
      return;
    }
    const toggleBtn = event.target.closest('[data-toggle-read]');
    if (toggleBtn) {
      const target = notifications.find((item) => item.id === toggleBtn.dataset.toggleRead);
      if (target) {
        target.read = !target.read;
        renderContent();
      }
      return;
    }
    const deleteBtn = event.target.closest('[data-delete-notif]');
    if (deleteBtn) {
      notifications = notifications.filter((item) => item.id !== deleteBtn.dataset.deleteNotif);
      toast.info('اعلان حذف شد', 'این مورد از فهرست شما برداشته شد.');
      renderContent();
      return;
    }
    if (event.target.closest('[data-mark-all-read]')) {
      notifications.forEach((item) => (item.read = true));
      toast.success('همه اعلان‌ها خوانده شدند', `${toDigits(notifications.length)} مورد علامت‌گذاری شد.`);
      renderContent();
      return;
    }
    if (event.target.closest('[data-clear-read]')) {
      const removed = notifications.filter((item) => item.read).length;
      notifications = notifications.filter((item) => !item.read);
      toast.info('اعلان‌های خوانده‌شده پاک شدند', `${toDigits(removed)} مورد حذف شد.`);
      renderContent();
    }
  });
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
          subtitle: 'بلوک‌ها را بکشید یا لمس کنید — ترتیب را با دکمه‌های هر بخش تغییر دهید',
          icon: 'layout-text-window-reverse',
          actions: '<button class="btn btn-light" type="button" data-preview-page><i class="bi bi-eye"></i> پیش‌نمایش</button><button class="btn btn-primary" type="button" data-publish-page><i class="bi bi-cloud-upload"></i> انتشار</button>',
        })}
        <div class="cms-builder">
          <aside class="cms-builder__blocks" aria-label="بلوک‌ها">
            <div class="cms-builder__blocks-head"><h3>بلوک‌ها</h3><small>برای افزودن، بکشید یا لمس کنید</small></div>
            <div class="cms-builder__palette" data-block-source role="list">${Object.entries(BUILDER_BLOCKS)
              .map(([type, block]) => `<button type="button" class="cms-block" draggable="true" data-block="${type}" role="listitem" aria-label="افزودن بلوک ${escapeHtml(block.label)}"><i class="bi bi-${block.icon}" aria-hidden="true"></i><span>${escapeHtml(block.label)}</span><i class="bi bi-plus-lg cms-block__add" aria-hidden="true"></i></button>`)
              .join('')}</div>
          </aside>
          <section class="cms-builder__canvas" data-builder-canvas aria-label="بوم صفحه">
            ${['hero', 'features', 'stats'].map((type, i) => sectionMarkup(type, i === 0)).join('')}
            <div class="cms-builder__empty" data-builder-empty hidden><i class="bi bi-plus-square-dotted" aria-hidden="true"></i><strong>صفحه خالی است</strong><span>یک بلوک از فهرست بلوک‌ها انتخاب کنید.</span></div>
          </section>
          <aside class="cms-builder__inspector" aria-label="تنظیمات بخش">
            <h3>تنظیمات بخش</h3>
            <div data-inspector-body class="cms-builder__inspector-body"></div>
            <div class="form-field"><label class="form-label" for="pb-spacing">فاصله عمودی <b class="numeric" data-spacing-value></b></label><input id="pb-spacing" type="range" class="form-range" min="8" max="64" step="4" value="20" data-spacing></div>
            <div class="form-field"><span class="form-label">پس‌زمینه</span>
              <div class="cms-builder__bgs" role="group" aria-label="پس‌زمینه بخش">
                <button type="button" class="cms-bg is-active" data-bg="surface" aria-label="سفید" style="--bg:var(--nv-surface)"></button>
                <button type="button" class="cms-bg" data-bg="muted" aria-label="خاکستری" style="--bg:var(--nv-surface-2)"></button>
                <button type="button" class="cms-bg" data-bg="brand" aria-label="رنگ برند" style="--bg:linear-gradient(135deg, var(--nv-primary), #8b5cf6)"></button>
              </div>
            </div>
          </aside>
        </div>
      </div>`,
    );
    const canvas = $('[data-builder-canvas]', node);
    const inspector = $('[data-inspector-body]', node);
    const spacing = $('[data-spacing]', node);
    const sections = () => $$('[data-pb-section]', canvas);
    const selected = () => $('[data-pb-section].is-selected', canvas);

    const refresh = () => {
      const list = sections();
      list.forEach((section, index) => {
        $('[data-move-up]', section).disabled = index === 0;
        $('[data-move-down]', section).disabled = index === list.length - 1;
      });
      $('[data-builder-empty]', canvas).hidden = list.length > 0;
      const current = selected();
      if (!current) {
        render(inspector, '<p class="cms-builder__hint">یک بخش را انتخاب کنید تا تنظیمات آن را ویرایش کنید.</p>');
        return;
      }
      const block = BUILDER_BLOCKS[current.dataset.pbSection] ?? { label: current.dataset.pbSection };
      render(inspector, infoRows([['بخش', escapeHtml(block.label)], ['ترتیب', `${toDigits(list.indexOf(current) + 1)} از ${toDigits(list.length)}`]]));
      const pad = parseInt(current.style.getPropertyValue('--pb-pad') || '20', 10);
      spacing.value = String(pad);
      $('[data-spacing-value]', node).textContent = toDigits(pad);
      $$('[data-bg]', node).forEach((b) => b.classList.toggle('is-active', b.dataset.bg === (current.dataset.bg || 'surface')));
    };
    const select = (section) => {
      sections().forEach((item) => item.classList.toggle('is-selected', item === section));
      refresh();
    };
    /* Smooth reorder: measure → move → animate from the old position (FLIP). */
    const animateMove = (mutate) => {
      const before = new Map(sections().map((el) => [el, el.getBoundingClientRect().top]));
      mutate();
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
      sections().forEach((el) => {
        const delta = (before.get(el) ?? 0) - el.getBoundingClientRect().top;
        if (!delta) return;
        el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    };
    const addBlock = (type, before = null) => {
      if (!BUILDER_BLOCKS[type]) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = sectionMarkup(type);
      const section = wrap.firstElementChild;
      canvas.insertBefore(section, before ?? $('[data-builder-empty]', canvas));
      select(section);
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      section.classList.add('is-new');
      setTimeout(() => section.classList.remove('is-new'), 700);
      toast.success('بلوک افزوده شد', `بخش «${BUILDER_BLOCKS[type].label}» اضافه شد.`);
    };

    const palette = $('[data-block-source]', node);
    on(palette, 'click', (event) => {
      const block = event.target.closest('[data-block]');
      if (block) addBlock(block.dataset.block);
    });
    on(palette, 'dragstart', (event) => {
      const block = event.target.closest('[data-block]');
      if (!block) return;
      event.dataTransfer.setData('text/plain', block.dataset.block);
      event.dataTransfer.effectAllowed = 'copy';
      canvas.classList.add('is-drop-target');
    });
    on(palette, 'dragend', () => {
      canvas.classList.remove('is-drop-target');
      $$('.is-drop-before', canvas).forEach((el) => el.classList.remove('is-drop-before'));
    });
    const dropBefore = (y) => sections().find((el) => {
      const r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    }) ?? null;
    on(canvas, 'dragover', (event) => {
      event.preventDefault();
      const target = dropBefore(event.clientY);
      sections().forEach((el) => el.classList.toggle('is-drop-before', el === target));
    });
    on(canvas, 'drop', (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('text/plain');
      const target = dropBefore(event.clientY);
      canvas.classList.remove('is-drop-target');
      sections().forEach((el) => el.classList.remove('is-drop-before'));
      addBlock(type, target);
    });

    on(canvas, 'click', async (event) => {
      const section = event.target.closest('[data-pb-section]');
      if (!section) return;
      if (event.target.closest('[data-remove-section]')) {
        const label = BUILDER_BLOCKS[section.dataset.pbSection]?.label ?? '';
        const ok = await modal.confirm({ title: 'حذف بخش', text: `بخش «${label}» از صفحه حذف شود؟`, tone: 'danger', confirmText: 'حذف' });
        if (!ok) return;
        const wasSelected = section.classList.contains('is-selected');
        section.remove();
        if (wasSelected) select(sections()[0] ?? null);
        else refresh();
        toast.info('بخش حذف شد');
        return;
      }
      if (event.target.closest('[data-move-up]')) {
        const prev = section.previousElementSibling;
        if (prev?.matches('[data-pb-section]')) animateMove(() => canvas.insertBefore(section, prev));
        select(section);
        event.target.closest('button').focus();
        return;
      }
      if (event.target.closest('[data-move-down]')) {
        const next = section.nextElementSibling;
        if (next?.matches('[data-pb-section]')) animateMove(() => canvas.insertBefore(next, section));
        select(section);
        event.target.closest('button').focus();
        return;
      }
      if (event.target.closest('[data-duplicate-section]')) {
        const copy = section.cloneNode(true);
        copy.classList.remove('is-selected');
        section.after(copy);
        select(copy);
        toast.success('بخش تکثیر شد');
        return;
      }
      select(section);
    });
    on(spacing, 'input', () => {
      const current = selected();
      $('[data-spacing-value]', node).textContent = toDigits(spacing.value);
      if (current) current.style.setProperty('--pb-pad', `${spacing.value}px`);
    });
    on(node, 'click', (event) => {
      const bg = event.target.closest('[data-bg]');
      if (!bg) return;
      const current = selected();
      if (!current) return;
      current.dataset.bg = bg.dataset.bg;
      $$('[data-bg]', node).forEach((b) => b.classList.toggle('is-active', b === bg));
    });
    refresh();

    on($('[data-preview-page]', node), 'click', () => {
      const clone = canvas.cloneNode(true);
      $$('.cms-builder__section-bar, [data-builder-empty]', clone).forEach((el) => el.remove());
      modal.open({ title: 'پیش‌نمایش صفحه', size: 'lg', content: `<div class="cms-preview">${clone.innerHTML}</div>`, footer: '<button class="btn btn-light" data-modal-close>بستن</button>' });
    });
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

  // CMS datasets & bespoke views
  const cmsData = {
    posts: [
      { id: 'p-1', title: 'راهنمای جامع سئو و بهینه‌سازی وب در سال ۲۰۲۶', category: 'سئو و بازاریابی', author: 'سارا محمدی', avatar: 'assets/img/avatars/avatar-01.svg', views: 4250, comments: 18, date: '۴ مهر ۱۴۰۳', status: 'published', tags: ['سئو', 'تولید محتوا'] },
      { id: 'p-2', title: 'معماری میکروسرویس‌ها و مقیاس‌پذیری با کوبرنتیز', category: 'فناوری و توسعه', author: 'امیر طاهری', avatar: 'assets/img/avatars/avatar-02.svg', views: 3180, comments: 12, date: '۱ مهر ۱۴۰۳', status: 'published', tags: ['دوآپس', 'کلود'] },
      { id: 'p-3', title: 'استراتژی هوش مصنوعی برای مدیران ارشد کسب‌وکار', category: 'هوش مصنوعی', author: 'سارا محمدی', avatar: 'assets/img/avatars/avatar-01.svg', views: 5900, comments: 34, date: '۲۸ شهریور ۱۴۰۳', status: 'published', tags: ['هوش مصنوعی', 'مدیریت'] },
      { id: 'p-4', title: 'اصول طراحی تجربه کاربری (UI/UX) در اپلیکیشن‌های مالی', category: 'طراحی محصول', author: 'نگار کریمی', avatar: 'assets/img/avatars/avatar-06.svg', views: 2640, comments: 9, date: '۲۴ شهریور ۱۴۰۳', status: 'published', tags: ['دیزاین سیستم', 'UI/UX'] },
      { id: 'p-5', title: 'آموزش پیاده‌سازی احراز هویت دوعاملی (2FA) در وب', category: 'امنیت سایبری', author: 'رضا نوری', avatar: 'assets/img/avatars/avatar-03.svg', views: 1850, comments: 8, date: '۲۰ شهریور ۱۴۰۳', status: 'published', tags: ['امنیت وب', 'احراز هویت'] },
      { id: 'p-6', title: 'بررسی روندهای بازاریابی محتوایی در شبکه‌های اجتماعی', category: 'سئو و بازاریابی', author: 'الهام رستمی', avatar: 'assets/img/avatars/avatar-08.svg', views: 820, comments: 3, date: '۱۸ شهریور ۱۴۰۳', status: 'draft', tags: ['مارکتینگ', 'سوشال'] },
      { id: 'p-7', title: 'معرفی قابلیت‌های جدید نسخه ۱٫۰٫۲ قالب نواادمین', category: 'اطلاعیه‌ها', author: 'سارا محمدی', avatar: 'assets/img/avatars/avatar-01.svg', views: 9400, comments: 52, date: '۱۵ شهریور ۱۴۰۳', status: 'published', tags: ['نواادمین', 'آپدیت'] },
      { id: 'p-8', title: 'راهنمای اتصال پایگاه‌های داده توزیع‌شده با تأخیر کم', category: 'فناوری و توسعه', author: 'امیر طاهری', avatar: 'assets/img/avatars/avatar-02.svg', views: 1200, comments: 4, date: '۱۲ شهریور ۱۴۰۳', status: 'review', tags: ['دیتابیس', 'سرعت'] },
    ],
    pages: [
      { id: 'pg-1', title: 'صفحه اصلی (Landing Page)', slug: '/', template: 'لندینگ پیشرفته', updated: 'امروز', status: 'published' },
      { id: 'pg-2', title: 'درباره ما و داستان شرکت', slug: '/about-us', template: 'برگه شرکتی', updated: '۵ روز پیش', status: 'published' },
      { id: 'pg-3', title: 'تماس با ما و شعبات', slug: '/contact', template: 'فرم تماس + نقشه', updated: '۲ هفته پیش', status: 'published' },
      { id: 'pg-4', title: 'قوانین و شرایط استفاده از خدمات', slug: '/terms', template: 'متنی حقوقی', updated: '۱ ماه پیش', status: 'published' },
      { id: 'pg-5', title: 'سیاست حفظ حریم خصوصی کاربران', slug: '/privacy', template: 'متنی حقوقی', updated: '۱ ماه پیش', status: 'published' },
      { id: 'pg-6', title: 'تعرفه‌ها و مقایسه پلن‌ها', slug: '/pricing', template: 'جدول تعرفه', updated: '۳ روز پیش', status: 'published' },
      { id: 'pg-7', title: 'فرصت‌های همکاری و جذب نیرو', slug: '/careers', template: 'لیست فرصت‌ها', updated: 'دیروز', status: 'draft' },
    ],
    categories: [
      { id: 'cat-1', name: 'فناوری و مهندسی وب', slug: 'tech', parent: '—', count: 24, icon: 'code-slash', color: 'primary' },
      { id: 'cat-2', name: 'هوش مصنوعی و داده', slug: 'ai', parent: '—', count: 18, icon: 'stars', color: 'violet' },
      { id: 'cat-3', name: 'سئو و دیجیتال مارکتینگ', slug: 'marketing', parent: '—', count: 15, icon: 'graph-up-arrow', color: 'success' },
      { id: 'cat-4', name: 'طراحی محصول و تجربه کاربری', slug: 'ui-ux', parent: '—', count: 12, icon: 'palette', color: 'warning' },
      { id: 'cat-5', name: 'امنیت سایبری و شبکه', slug: 'security', parent: '—', count: 9, icon: 'shield-check', color: 'danger' },
      { id: 'cat-6', name: 'آموزش‌ها و راهنمای کاربری', slug: 'tutorials', parent: '—', count: 31, icon: 'book', color: 'info' },
    ],
    tags: [
      { id: 'tag-1', name: 'سئو (SEO)', slug: 'seo', count: 18, views: '۱۲٫۴k', color: 'primary' },
      { id: 'tag-2', name: 'هوش مصنوعی', slug: 'ai', count: 22, views: '۲۴٫۱k', color: 'violet' },
      { id: 'tag-3', name: 'ری‌اکت (React)', slug: 'react', count: 14, views: '۹٫۸k', color: 'info' },
      { id: 'tag-4', name: 'دیزاین سیستم', slug: 'design-system', count: 11, views: '۷٫۲k', color: 'success' },
      { id: 'tag-5', name: 'بوت‌استرپ ۵', slug: 'bootstrap-5', count: 9, views: '۵٫۶k', color: 'warning' },
      { id: 'tag-6', name: 'داکر و دوآپس', slug: 'devops', count: 8, views: '۴٫۹k', color: 'danger' },
      { id: 'tag-7', name: 'امنیت وب', slug: 'web-security', count: 13, views: '۸٫۱k', color: 'primary' },
      { id: 'tag-8', name: 'نواادمین', slug: 'novaadmin', count: 25, views: '۳۲٫۰k', color: 'success' },
    ],
    comments: [
      { id: 'com-1', author: 'مهدی رضایی', avatar: 'assets/img/avatars/avatar-11.svg', post: 'راهنمای جامع سئو و بهینه‌سازی وب در سال ۲۰۲۶', text: 'قالب فوق‌العاده زیبا و سریعی هست، مخصوصاً تقویم شمسی و نمودارها خیلی تمیز کار شدن.', date: '۱۰ دقیقه پیش', status: 'approved' },
      { id: 'com-2', author: 'علی سلیمانی', avatar: 'assets/img/avatars/avatar-04.svg', post: 'بررسی روندهای بازاریابی محتوایی', text: 'آیا امکان اضافه کردن اتصال به درگاه پرداخت بانکی هم وجود دارد؟', date: '۴۲ دقیقه پیش', status: 'approved' },
      { id: 'com-3', author: 'شیما کریمی', avatar: 'assets/img/avatars/avatar-06.svg', post: 'استراتژی هوش مصنوعی برای مدیران ارشد', text: 'خسته نباشید به تیم توسعه، این بهترین داشبورد فارسی هست که دیدم.', date: '۲ ساعت پیش', status: 'approved' },
      { id: 'com-4', author: 'حسین طاهری', avatar: 'assets/img/avatars/avatar-03.svg', post: 'معماری میکروسرویس‌ها و مقیاس‌پذیری', text: 'لینک دانلود فایل سورس در انتهای مقاله باز نمی‌شود، لطفاً بررسی کنید.', date: '۵ ساعت پیش', status: 'pending' },
      { id: 'com-5', author: 'پگاه افشار', avatar: 'assets/img/avatars/avatar-08.svg', post: 'اصول طراحی تجربه کاربری (UI/UX)', text: 'ممنون از مقاله خوب و کاربردیتون، منتظر قسمت دوم هستیم.', date: '۱ روز پیش', status: 'approved' },
      { id: 'com-6', author: 'کاربر ناشناس', avatar: 'assets/img/avatars/avatar-12.svg', post: 'آموزش احراز هویت دوعاملی', text: 'Buy cheap crypto fast now visit spam-link.xyz for details...', date: '۲ روز پیش', status: 'spam' },
    ],
    media: [
      { id: 'm-1', name: 'hero-banner-dark.jpg', type: 'image', size: '۴۲۰ KB', res: '۱۹۲۰ × ۱۰۸۰', date: 'امروز', url: 'assets/img/shots/analytics-dark.jpg' },
      { id: 'm-2', name: 'ai-studio-cover.jpg', type: 'image', size: '۳۸۰ KB', res: '۱۴۴۰ × ۹۰۰', date: 'دیروز', url: 'assets/img/shots/ai-studio-dark.jpg' },
      { id: 'm-3', name: 'product-catalog.svg', type: 'image', size: '۶۵ KB', res: '۸۰۰ × ۸۰۰', date: '۳ روز پیش', url: 'assets/img/products/product-01.svg' },
      { id: 'm-4', name: 'company-profile.pdf', type: 'doc', size: '۲٫۴ MB', res: 'سند PDF', date: '۵ روز پیش', url: 'assets/logo-mark.svg' },
      { id: 'm-5', name: 'brand-mark-logo.svg', type: 'image', size: '۱۸ KB', res: '۵۱۲ × ۵۱۲', date: '۱ هفته پیش', url: 'assets/logo-mark.svg' },
      { id: 'm-6', name: 'analytics-light.svg', type: 'image', size: '۱۴۰ KB', res: '۱۲۰۰ × ۷۵۰', date: '۲ هفته پیش', url: 'assets/img/previews/analytics-light.svg' },
    ],
  };

  if (page === 'cms/posts.html') {
    let posts = [...cmsData.posts];
    const renderPosts = () => {
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'نوشته‌ها و مقالات وبلاگ',
            subtitle: 'مدیریت مقالات، بررسی وضعیت سئو، دسته‌بندی و تعداد بازدیدها',
            icon: 'journal-text',
            actions: '<a class="btn btn-primary" href="cms/post-create.html"><i class="bi bi-plus-lg"></i> نوشته جدید</a>',
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'کل مقالات', value: toDigits(posts.length), hint: 'محتواهای تولیدشده', tone: 'primary', icon: 'journal-text' })}
            ${statCard({ label: 'منتشرشده', value: toDigits(posts.filter(p=>p.status==='published').length), hint: 'نمایش در وب‌سایت', tone: 'success', icon: 'check-circle' })}
            ${statCard({ label: 'پیش‌نویس و بازبینی', value: toDigits(posts.filter(p=>p.status!=='published').length), hint: 'در انتظار انتشار', tone: 'warning', icon: 'file-earmark' })}
            ${statCard({ label: 'کل بازدیدها', value: '۲۹٫۲k', hint: 'در ۳۰ روز گذشته', tone: 'info', icon: 'eye' })}
          </div>

          <div class="card" style="border-radius:18px;">
            <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">فهرست مطالب</h3>
              <div class="input-group input-group--icon" style="max-width:240px;">
                <i class="bi bi-search"></i>
                <input class="form-control form-control--sm" type="search" placeholder="جستجو در مقالات..." data-post-search>
              </div>
            </div>
            <div class="card__body" style="padding:0;">
              <div class="table-responsive">
                <table class="table table--hover">
                  <thead>
                    <tr>
                      <th>عنوان نوشته</th>
                      <th>نویسنده</th>
                      <th>دسته‌بندی</th>
                      <th>بازدید</th>
                      <th>دیدگاه‌ها</th>
                      <th>تاریخ</th>
                      <th>وضعیت</th>
                      <th class="text-end">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${posts.map(p => `
                      <tr>
                        <td style="font-weight:700; max-width:280px;">${escapeHtml(p.title)}</td>
                        <td>
                          <div style="display:flex; align-items:center; gap:8px;">
                            <img src="${p.avatar}" style="width:28px;height:28px;border-radius:50%;">
                            <span style="font-size:12px;">${p.author}</span>
                          </div>
                        </td>
                        <td><span class="badge badge--soft-primary">${p.category}</span></td>
                        <td class="numeric">${toDigits(p.views)}</td>
                        <td class="numeric">${toDigits(p.comments)}</td>
                        <td style="font-size:12px; color:var(--nv-text-muted);">${p.date}</td>
                        <td><span class="badge badge--soft-${p.status==='published'?'success':p.status==='draft'?'warning':'info'}">${p.status==='published'?'منتشرشده':p.status==='draft'?'پیش‌نویس':'بازبینی'}</span></td>
                        <td class="text-end">
                          <div class="d-inline-flex gap-1">
                            <a class="btn btn-sm btn-light" href="cms/post-create.html" title="ویرایش"><i class="bi bi-pencil"></i></a>
                            <button class="btn btn-sm btn-ghost text-danger" type="button" data-del-post="${p.id}" title="حذف"><i class="bi bi-trash3"></i></button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>`,
      );
    };
    renderPosts();
    on(node, 'click', (e) => {
      const del = e.target.closest('[data-del-post]');
      if (del) {
        posts = posts.filter(p => p.id !== del.dataset.delPost);
        toast.info('نوشته حذف شد');
        renderPosts();
      }
    });
    on(node, 'input', (e) => {
      if (e.target.matches('[data-post-search]')) {
        const q = e.target.value.toLowerCase().trim();
        $$('tbody tr', node).forEach(tr => {
          tr.hidden = q ? !tr.textContent.toLowerCase().includes(q) : false;
        });
      }
    });
    exportable(node, 'posts');
    return;
  }

  if (page === 'cms/pages.html') {
    let pages = [...cmsData.pages];
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'مدیریت برگه‌ها (صفحات سایت)',
          subtitle: 'طراحی، ویرایش و انتشار صفحات ایستا و فرود وب‌سایت',
          icon: 'file-earmark-text-fill',
          actions: '<a class="btn btn-primary" href="cms/page-builder.html"><i class="bi bi-layout-text-window-reverse"></i> صفحه‌ساز زنده</a>',
        })}

        <div class="kpi-row grid grid--4 mb-4">
          ${statCard({ label: 'کل برگه‌ها', value: toDigits(pages.length), hint: 'صفحات فعال وب‌سایت', tone: 'primary', icon: 'file-earmark-text' })}
          ${statCard({ label: 'منتشرشده', value: toDigits(pages.filter(p=>p.status==='published').length), hint: 'قابل مشاهده کاربران', tone: 'success', icon: 'check-circle' })}
          ${statCard({ label: 'پیش‌نویس', value: toDigits(pages.filter(p=>p.status==='draft').length), hint: 'صفحات در حال ساخت', tone: 'warning', icon: 'file-earmark' })}
          ${statCard({ label: 'صفحه‌ساز زنده', value: 'فعال', hint: 'کشیدن و رها کردن بلوک‌ها', tone: 'info', icon: 'stars' })}
        </div>

        <div class="card" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
            <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">فهرست برگه‌ها</h3>
            <span class="badge badge--soft-primary">${toDigits(pages.length)} برگه</span>
          </div>
          <div class="card__body" style="padding:0;">
            <div class="table-responsive">
              <table class="table table--hover">
                <thead>
                  <tr>
                    <th>عنوان برگه</th>
                    <th>نامک (URL)</th>
                    <th>قالب برگه</th>
                    <th>آخرین تغییر</th>
                    <th>وضعیت</th>
                    <th class="text-end">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  ${pages.map(pg => `
                    <tr>
                      <td style="font-weight:700;">${escapeHtml(pg.title)}</td>
                      <td><code style="font-size:12px; direction:ltr;">${pg.slug}</code></td>
                      <td><span class="badge badge--soft-primary">${pg.template}</span></td>
                      <td style="font-size:12px; color:var(--nv-text-muted);">${pg.updated}</td>
                      <td><span class="badge badge--soft-${pg.status==='published'?'success':'warning'}">${pg.status==='published'?'منتشرشده':'پیش‌نویس'}</span></td>
                      <td class="text-end">
                        <div class="d-inline-flex gap-1">
                          <a class="btn btn-sm btn-primary" href="cms/page-builder.html" title="ویرایش با صفحه‌ساز"><i class="bi bi-magic"></i> صفحه‌ساز</a>
                          <button class="btn btn-sm btn-light" type="button" title="پیش‌نمایش"><i class="bi bi-eye"></i></button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`,
    );
    exportable(node, 'pages');
    return;
  }

  if (page === 'cms/categories.html') {
    let cats = [...cmsData.categories];
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'دسته‌بندی‌های محتوا',
          subtitle: 'ساختاردهی مقالات، اخبار و اسناد با دسته‌بندی‌های سلسله‌مراتبی',
          icon: 'folder2-open',
          actions: '<button class="btn btn-primary" type="button" data-create-cat><i class="bi bi-plus-lg"></i> دسته جدید</button>',
        })}

        <div class="grid grid--3 mb-4" style="gap:16px;">
          ${cats.map(c => `
            <div class="card" style="border-radius:16px; border:1px solid var(--nv-border); background:var(--nv-surface);">
              <div class="card__body" style="padding:18px; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="tile tile--soft tile--icon tile--soft-${c.color || 'primary'}" style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;">
                    <i class="bi bi-${c.icon}" style="font-size:1.2rem;"></i>
                  </span>
                  <div>
                    <h4 style="margin:0; font-size:14px; font-weight:800; color:var(--nv-heading);">${escapeHtml(c.name)}</h4>
                    <span style="font-size:11px; color:var(--nv-text-muted);">نامک: <code>${c.slug}</code></span>
                  </div>
                </div>
                <div style="text-align:end;">
                  <span class="badge badge--soft-${c.color} rounded-pill">${toDigits(c.count)} نوشته</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`,
    );
    on(node, 'click', (e) => {
      if (e.target.closest('[data-create-cat]')) {
        toast.info('افزودن دسته', 'فرم دسته جدید باز شد.');
      }
    });
    exportable(node, 'categories');
    return;
  }

  if (page === 'cms/tags.html') {
    let tags = [...cmsData.tags];
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'برچسب‌ها (Tags)',
          subtitle: 'مدیریت کلمات کلیدی، برچسب‌های پرطرفدار و پایش بازدید تگ‌ها',
          icon: 'tags-fill',
          actions: '<button class="btn btn-primary" type="button" data-create-tag><i class="bi bi-plus-lg"></i> برچسب جدید</button>',
        })}

        <div class="card" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
            <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">ابر برچسب‌ها و آمار استفاده</h3>
            <span class="badge badge--soft-primary">${toDigits(tags.length)} برچسب فعال</span>
          </div>
          <div class="card__body" style="padding:20px;">
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:24px;">
              ${tags.map(t => `
                <span class="badge badge--soft-${t.color}" style="font-size:13px; padding:8px 14px; border-radius:999px; display:inline-flex; align-items:center; gap:8px;">
                  <i class="bi bi-tag-fill"></i> ${escapeHtml(t.name)}
                  <small style="opacity:0.8; font-weight:800;">${toDigits(t.count)}</small>
                </span>
              `).join('')}
            </div>

            <div class="table-responsive">
              <table class="table table--hover">
                <thead>
                  <tr>
                    <th>نام برچسب</th>
                    <th>نامک (Slug)</th>
                    <th>تعداد مقالات</th>
                    <th>کل بازدیدهای مرتبط</th>
                    <th class="text-end">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  ${tags.map(t => `
                    <tr>
                      <td style="font-weight:700;"><i class="bi bi-tag text-${t.color} me-1"></i> ${escapeHtml(t.name)}</td>
                      <td><code>${t.slug}</code></td>
                      <td class="numeric">${toDigits(t.count)} مقاله</td>
                      <td class="numeric">${t.views}</td>
                      <td class="text-end">
                        <button class="btn btn-sm btn-light" type="button" title="ویرایش"><i class="bi bi-pencil"></i></button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`,
    );
    exportable(node, 'tags');
    return;
  }

  if (page === 'cms/comments.html') {
    let comments = [...cmsData.comments];
    const renderComments = () => {
      render(
        node,
        `<div class="dashboard-shell">
          ${pageHeader({
            title: 'دیدگاه‌ها و نظرات کاربران',
            subtitle: 'بررسی نظرات مقالات، تأیید، پاسخگویی و غربالگری اسپم‌ها',
            icon: 'chat-left-text-fill',
            actions: '<button class="btn btn-outline-danger btn-sm" type="button" data-clear-spam><i class="bi bi-trash3"></i> پاک‌سازی اسپم‌ها</button>',
          })}

          <div class="kpi-row grid grid--4 mb-4">
            ${statCard({ label: 'کل دیدگاه‌ها', value: toDigits(comments.length), hint: 'دیدگاه‌های دریافتی', tone: 'primary', icon: 'chat-left-text' })}
            ${statCard({ label: 'تأییدشده', value: toDigits(comments.filter(c=>c.status==='approved').length), hint: 'نمایش در سایت', tone: 'success', icon: 'check-circle' })}
            ${statCard({ label: 'در انتظار بازبینی', value: toDigits(comments.filter(c=>c.status==='pending').length), hint: 'نیازمند بررسی', tone: 'warning', icon: 'clock-history' })}
            ${statCard({ label: 'اسپم مسدودشده', value: toDigits(comments.filter(c=>c.status==='spam').length), hint: 'شناسایی با فیلتر هوشمند', tone: 'danger', icon: 'shield-x' })}
          </div>

          <div class="card" style="border-radius:18px;">
            <div class="card__body" style="padding:16px; display:flex; flex-direction:column; gap:12px;">
              ${comments.map(c => `
                <div class="comment-card" style="padding:16px; border-radius:14px; border:1px solid ${c.status==='pending'?'var(--nv-warning)':c.status==='spam'?'var(--nv-danger)':'var(--nv-border)'}; background:${c.status==='pending'?'var(--nv-surface-2)':'var(--nv-surface)'}; display:flex; align-items:start; gap:14px;">
                  <img src="${c.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--nv-border);flex-shrink:0;">
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:8px;">
                      <div>
                        <strong style="font-size:13px; color:var(--nv-heading);">${escapeHtml(c.author)}</strong>
                        <span style="font-size:11px; color:var(--nv-text-muted); margin-inline-start:8px;">روی مقاله: <em style="color:var(--nv-primary);">${escapeHtml(c.post)}</em></span>
                      </div>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge badge--soft-${c.status==='approved'?'success':c.status==='pending'?'warning':'danger'}" style="font-size:10px;">${c.status==='approved'?'تأیید شده':c.status==='pending'?'در انتظار':'اسپم'}</span>
                        <small style="font-size:11px; color:var(--nv-text-muted);">${c.date}</small>
                      </div>
                    </div>
                    <p style="margin:0 0 10px; font-size:12px; line-height:1.7; color:var(--nv-text);">${escapeHtml(c.text)}</p>
                    <div style="display:flex; gap:8px;">
                      ${c.status !== 'approved' ? `<button class="btn btn-sm btn-soft-success" type="button" data-approve="${c.id}" style="font-size:11px; padding:3px 10px;"><i class="bi bi-check2"></i> تأیید نظر</button>` : ''}
                      <button class="btn btn-sm btn-light" type="button" data-reply="${c.id}" style="font-size:11px; padding:3px 10px;"><i class="bi bi-reply"></i> پاسخ</button>
                      <button class="btn btn-sm btn-ghost text-danger" type="button" data-del-com="${c.id}" style="font-size:11px; padding:3px 8px;"><i class="bi bi-trash3"></i></button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>`,
      );
    };
    renderComments();
    on(node, 'click', (e) => {
      const appBtn = e.target.closest('[data-approve]');
      if (appBtn) {
        const item = comments.find(c => c.id === appBtn.dataset.approve);
        if (item) item.status = 'approved';
        toast.success('دیدگاه تأیید شد');
        renderComments();
        return;
      }
      const replyBtn = e.target.closest('[data-reply]');
      if (replyBtn) {
        toast.info('پاسخ به دیدگاه', 'کادر ارسال پاسخ فعال شد.');
        return;
      }
      const delBtn = e.target.closest('[data-del-com]');
      if (delBtn) {
        comments = comments.filter(c => c.id !== delBtn.dataset.delCom);
        toast.info('دیدگاه حذف شد');
        renderComments();
        return;
      }
      if (e.target.closest('[data-clear-spam]')) {
        comments = comments.filter(c => c.status !== 'spam');
        toast.success('دیدگاه‌های اسپم پاک‌سازی شدند');
        renderComments();
      }
    });
    exportable(node, 'comments');
    return;
  }

  if (page === 'cms/media.html') {
    let mediaItems = [...cmsData.media];
    render(
      node,
      `<div class="dashboard-shell">
        ${pageHeader({
          title: 'کتابخانه رسانه و اسناد',
          subtitle: 'مدیریت فایل‌ها، تصاویر شاخص، اسناد سازمانی و پیش‌نمایش فایل‌ها',
          icon: 'images',
          actions: '<label class="btn btn-primary"><i class="bi bi-cloud-arrow-up"></i> بارگذاری فایل جدید<input type="file" hidden multiple accept="image/*,application/pdf" data-media-upload></label>',
        })}

        <div class="kpi-row grid grid--4 mb-4">
          ${statCard({ label: 'کل فایل‌ها', value: toDigits(mediaItems.length), hint: 'در کتابخانه ابری', tone: 'primary', icon: 'images' })}
          ${statCard({ label: 'تصاویر', value: toDigits(mediaItems.filter(m=>m.type==='image').length), hint: 'JPG, SVG, WebP', tone: 'info', icon: 'file-image' })}
          ${statCard({ label: 'اسناد و PDF', value: toDigits(mediaItems.filter(m=>m.type==='doc').length), hint: 'فایل‌های پیوست', tone: 'warning', icon: 'file-earmark-pdf' })}
          ${statCard({ label: 'فضای مصرفی', value: '۳٫۴ MB', hint: 'از ۵۰ GB مجاز', tone: 'success', icon: 'hdd-network' })}
        </div>

        <div class="card" style="border-radius:18px;">
          <div class="card__head" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
            <h3 class="card__title" style="margin:0; font-size:14px; font-weight:800;">گالری پرونده‌های چندرسانه‌ای</h3>
            <span class="badge badge--soft-primary">${toDigits(mediaItems.length)} فایل</span>
          </div>
          <div class="card__body" style="padding:20px;">
            <div class="grid grid--3" style="gap:16px;">
              ${mediaItems.map(m => `
                <div class="card" style="border-radius:14px; border:1px solid var(--nv-border); overflow:hidden; background:var(--nv-surface-2);">
                  <div style="height:150px; background:var(--nv-surface-3); display:grid; place-items:center; overflow:hidden;">
                    ${m.type === 'image' ? `<img src="${m.url}" style="max-height:100%; max-width:100%; object-fit:contain;" alt="">` : `<i class="bi bi-file-earmark-pdf" style="font-size:3rem; color:var(--nv-danger);"></i>`}
                  </div>
                  <div style="padding:12px;">
                    <strong style="font-size:12px; color:var(--nv-heading); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.name)}</strong>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--nv-text-muted); margin-top:4px;">
                      <span>${m.size}</span>
                      <span>${m.res}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid var(--nv-divider); padding-top:8px;">
                      <span style="font-size:10px; color:var(--nv-text-muted);">${m.date}</span>
                      <div class="d-inline-flex gap-1">
                        <button class="btn btn-sm btn-light" type="button" data-copy-media-url="${m.url}" title="کپی آدرس فایل" style="font-size:10px; padding:2px 6px;"><i class="bi bi-link-45deg"></i></button>
                        <a class="btn btn-sm btn-light" href="${m.url}" download title="دانلود" style="font-size:10px; padding:2px 6px;"><i class="bi bi-download"></i></a>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>`,
    );
    on(node, 'click', async (e) => {
      const copyBtn = e.target.closest('[data-copy-media-url]');
      if (copyBtn) {
        await navigator.clipboard?.writeText(copyBtn.dataset.copyMediaUrl).catch(()=>null);
        toast.success('آدرس فایل کپی شد');
      }
    });
    on(node, 'change', (e) => {
      if (e.target.matches('[data-media-upload]')) {
        toast.success('فایل‌ها با موفقیت بارگذاری شدند');
      }
    });
    exportable(node, 'media');
    return;
  }
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

/* Page-builder blocks: label, icon and realistic sample content. */
const BUILDER_BLOCKS = {
  hero: { label: 'هیرو', icon: 'layout-text-window', body: () => `<div class="cms-sample cms-sample--hero"><span class="badge badge--soft-primary">جدید</span><h2>سریع‌تر، هوشمندتر، حرفه‌ای‌تر</h2><p>صفحه‌ساز نواادمین با رابط کشیدن و رها کردن، به شما اجازه می‌دهد بدون کدنویسی صفحات خیره‌کننده بسازید.</p><span class="btn btn-primary btn-sm">شروع کنید</span></div>` },
  features: { label: 'ویژگی‌ها', icon: 'grid-3x3-gap', body: () => `<div class="cms-sample cms-sample--grid">${[['lightning-charge', 'سریع', 'بارگذاری زیر یک ثانیه'], ['shield-lock', 'امن', 'رمزنگاری و نقش‌های دسترسی'], ['graph-up-arrow', 'مقیاس‌پذیر', 'از ۱۰ تا ۱۰ هزار کاربر']].map(([i, t, d]) => `<div class="cms-sample__tile"><i class="bi bi-${i}" aria-hidden="true"></i><strong>${t}</strong><small>${d}</small></div>`).join('')}</div>` },
  media: { label: 'تصویر و متن', icon: 'card-image', body: () => `<div class="cms-sample cms-sample--media"><div class="cms-sample__img" aria-hidden="true"><i class="bi bi-image"></i></div><div><strong>داستان محصول شما</strong><p>یک تصویر شاخص در کنار متن توضیحی؛ در موبایل زیر هم قرار می‌گیرند.</p></div></div>` },
  pricing: { label: 'جدول قیمت', icon: 'tags', body: () => `<div class="cms-sample cms-sample--grid">${[['پایه', '۴۹۰ هزار'], ['حرفه‌ای', '۹۹۰ هزار'], ['سازمانی', 'تماس']].map(([t, p], i) => `<div class="cms-sample__tile${i === 1 ? ' is-featured' : ''}"><strong>${t}</strong><b>${p}</b><small>تومان / ماه</small></div>`).join('')}</div>` },
  testimonials: { label: 'نظرات مشتریان', icon: 'chat-quote', body: () => `<div class="cms-sample cms-sample--quote"><p>«راه‌اندازی پنل ما از دو هفته به دو روز رسید.»</p><small>— مهدی رضایی، مدیر فنی</small></div>` },
  faq: { label: 'پرسش‌های متداول', icon: 'patch-question', body: () => `<div class="cms-sample cms-sample--faq">${['آیا نسخه آزمایشی دارید؟', 'پشتیبانی چگونه است؟'].map((q) => `<div><strong>${q}</strong><i class="bi bi-chevron-down" aria-hidden="true"></i></div>`).join('')}</div>` },
  cta: { label: 'فراخوان عمل', icon: 'megaphone', body: () => `<div class="cms-sample cms-sample--cta"><strong>همین امروز شروع کنید</strong><span class="btn btn-light btn-sm">ثبت‌نام رایگان</span></div>` },
  stats: { label: 'آمار', icon: 'graph-up', body: () => `<div class="cms-stat-row">${[{ label: 'کاربران فعال', value: '۱۲٫۴ هزار', icon: 'people', tone: 'primary' }, { label: 'نرخ تبدیل', value: '۳٫۲٪', icon: 'graph-up', tone: 'success' }, { label: 'رضایت', value: '۴٫۹ از ۵', icon: 'star', tone: 'warning' }].map((st) => `<div class="cms-stat"><div class="cms-stat__icon cms-stat__icon--${st.tone}"><i class="bi bi-${st.icon}"></i></div><div><div class="cms-stat__value">${st.value}</div><div class="cms-stat__label">${st.label}</div></div></div>`).join('')}</div>` },
  team: { label: 'تیم', icon: 'people', body: () => `<div class="cms-sample cms-sample--grid">${[['سارا محمدی', 'مدیرعامل', '01'], ['علی رضایی', 'مدیر فنی', '04'], ['نگین شریفی', 'طراح محصول', '06']].map(([n, r, a]) => `<div class="cms-sample__tile"><img src="assets/img/avatars/avatar-${a}.svg" alt="" width="44" height="44"><strong>${n}</strong><small>${r}</small></div>`).join('')}</div>` },
};

const sectionMarkup = (type, selected = false) => {
  const block = BUILDER_BLOCKS[type] ?? { label: type, icon: 'square', body: () => '' };
  return `<div class="cms-builder__section${selected ? ' is-selected' : ''}" data-pb-section="${escapeHtml(type)}">
  <div class="cms-builder__section-bar">
    <span class="cms-builder__section-label"><i class="bi bi-${block.icon}" aria-hidden="true"></i>${escapeHtml(block.label)}</span>
    <div class="cms-builder__section-tools" role="toolbar" aria-label="ابزار بخش ${escapeHtml(block.label)}">
      <button class="icon-btn icon-btn--sm" type="button" data-move-up aria-label="انتقال به بالا" title="انتقال به بالا"><i class="bi bi-arrow-up" aria-hidden="true"></i></button>
      <button class="icon-btn icon-btn--sm" type="button" data-move-down aria-label="انتقال به پایین" title="انتقال به پایین"><i class="bi bi-arrow-down" aria-hidden="true"></i></button>
      <button class="icon-btn icon-btn--sm" type="button" data-duplicate-section aria-label="تکثیر" title="تکثیر"><i class="bi bi-copy" aria-hidden="true"></i></button>
      <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-remove-section aria-label="حذف" title="حذف"><i class="bi bi-trash3" aria-hidden="true"></i></button>
    </div>
  </div>
  <div class="cms-builder__section-body">${block.body()}</div>
</div>`;
};

export default { initApp, initCms };
