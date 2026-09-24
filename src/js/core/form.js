/**
 * NOVAADMIN — form behaviours & validation
 * ------------------------------------------------------------------
 * Implements the form states required by the design system (default, focus,
 * filled, disabled, readonly, error, success, loading) plus the input widgets
 * used across the template: live validation with Persian messages, file drop
 * zones, tag inputs, password strength, dependent selects, OTP boxes, steppers
 * and submit buttons that show a real loading state.
 *
 * Validation rules are declarative:
 *   <input class="form-control" name="email" required data-rule="email" />
 *   <input class="form-control" name="phone" required data-rule="phone" />
 *   <input class="form-control" name="password" required data-rule="password" data-min="8" />
 *   <input class="form-control" name="confirm" data-match="password" />
 */
import { $, $$, on, once, create, ready, escapeHtml } from './dom.js';
import { toast } from './toast.js';
import { formatNumber, parseNumber, toDigits, toLatinDigits } from './numbers.js';
import { storage, KEYS } from './storage.js';

const MESSAGES = {
  required: 'این فیلد الزامی است',
  email: 'قالب ایمیل صحیح نیست',
  phone: 'شماره تماس باید ۱۱ رقم باشد',
  url: 'نشانی وارد شده معتبر نیست',
  number: 'فقط عدد وارد کنید',
  nationalId: 'کد ملی وارد شده معتبر نیست',
  postal: 'کد پستی باید ۱۰ رقم باشد',
  iban: 'شماره شبا وارد شده معتبر نیست',
  min: 'مقدار وارد شده کوتاه است',
  max: 'مقدار وارد شده طولانی است',
  match: 'تکرار مقدار مطابقت ندارد',
  terms: 'پذیرش قوانین الزامی است',
  pattern: 'قالب ورودی صحیح نیست',
};

const VALIDATORS = {
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value),
  phone: (value) => /^0?9\d{9}$/.test(toLatinDigits(value).replace(/[\s-]/g, '')),
  url: (value) => /^https?:\/\/[^\s.]+\.\S{2,}$/.test(value),
  number: (value) => /^-?\d+(\.\d+)?$/.test(toLatinDigits(value).replace(/,/g, '')),
  nationalId: (value) => {
    const code = toLatinDigits(value).replace(/\D/g, '');
    if (!/^\d{10}$/.test(code)) return false;
    const check = Number(code[9]);
    const sum = code.slice(0, 9).split('').reduce((total, digit, index) => total + Number(digit) * (10 - index), 0) % 11;
    return sum < 2 ? check === sum : check === 11 - sum;
  },
  postal: (value) => /^\d{10}$/.test(toLatinDigits(value).replace(/\D/g, '')),
  iban: (value) => /^IR\d{24}$/i.test(toLatinDigits(value).replace(/\s/g, '')),
  password: (value) => value.length >= 8,
};

function feedbackFor(field) {
  let node = field.parentElement?.querySelector('.field-feedback');
  if (!node) {
    node = create('p', { class: 'field-feedback', hidden: '' });
    field.insertAdjacentElement('afterend', node);
  }
  return node;
}

/** Validates a single field, updating its state classes and feedback text. */
export function validateField(field) {
  if (!field || field.disabled || field.readOnly) return true;
  const rules = (field.dataset.rule ?? '').split('|').filter(Boolean);
  const value = (field.value ?? '').trim();
  const feedback = feedbackFor(field);
  const setState = (state, message) => {
    field.classList.toggle('is-invalid', state === 'invalid');
    field.classList.toggle('is-valid', state === 'valid');
    field.setAttribute('aria-invalid', String(state === 'invalid'));
    feedback.textContent = state === 'idle' ? '' : message;
    feedback.hidden = state === 'idle';
    feedback.classList.toggle('field-feedback--error', state === 'invalid');
    feedback.classList.toggle('field-feedback--success', state === 'valid');
  };

  if (field.required && !value) {
    setState('invalid', field.dataset.requiredMessage ?? MESSAGES.required);
    return false;
  }
  if (!value) {
    setState('idle');
    return true;
  }
  for (const rule of rules) {
    const validator = VALIDATORS[rule];
    if (validator && !validator(value)) {
      setState('invalid', MESSAGES[rule]);
      return false;
    }
  }
  if (field.dataset.min && value.length < Number(field.dataset.min)) {
    setState('invalid', MESSAGES.min);
    return false;
  }
  if (field.dataset.max && value.length > Number(field.dataset.max)) {
    setState('invalid', MESSAGES.max);
    return false;
  }
  if (field.dataset.match) {
    const other = field.form?.querySelector(`[name="${field.dataset.match}"]`);
    if (other && other.value !== field.value) {
      setState('invalid', MESSAGES.match);
      return false;
    }
  }
  if (field.dataset.validMessage) {
    setState('valid', field.dataset.validMessage);
    return true;
  }
  setState('idle');
  return true;
}

/** Validates every field inside a form; returns `{ valid, fields }`. */
export function validateForm(form) {
  const fields = $$('input, select, textarea', form).filter((field) => field.type !== 'hidden' && !field.closest('[data-no-validate]'));
  const results = fields.map((field) => ({ field, valid: validateField(field) }));
  const invalid = results.filter((item) => !item.valid);
  if (invalid.length) {
    invalid[0].field.focus({ preventScroll: true });
    invalid[0].field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return { valid: invalid.length === 0, fields: results };
}

/** Live validation wiring for every form marked `data-validate`. */
function initValidation(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:Validation', root)) return;
  $$('form[data-validate]', root).forEach((form) => {
    if (form.dataset.validateReady === '1') return;
    form.dataset.validateReady = '1';
    on(form, 'blur', (event) => {
      if (event.target.matches('input, select, textarea')) validateField(event.target);
    }, true);
    on(form, 'input', (event) => {
      const field = event.target;
      if (!field.matches('input, select, textarea')) return;
      if (field.classList.contains('is-invalid') || field.dataset.validateLive === 'true') validateField(field);
      if (field.dataset.match) {
        const other = form.querySelector(`[name="${field.dataset.match}"]`);
        if (other) validateField(other);
      }
    });
    on(form, 'submit', (event) => {
      const { valid } = validateForm(form);
      if (!valid) {
        event.preventDefault();
        event.stopPropagation();
        toast.warning('فرم کامل نیست', 'لطفاً خطاهای مشخص‌شده را برطرف کنید.');
        return;
      }
      if (form.dataset.ajax === 'false') return;
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.classList.add('is-loading');
      setTimeout(() => {
        submit?.classList.remove('is-loading');
        form.dispatchEvent(new CustomEvent('nova:submitted', { bubbles: true }));
        toast.success(form.dataset.successTitle ?? 'ذخیره شد', form.dataset.successText ?? 'اطلاعات شما با موفقیت ثبت شد.');
      }, 900);
    });
  });
}

/* --------------------------------------------------------------- file drops */
function initFileDrops(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:FileDrops', root)) return;
  $$('[data-file-drop]', root).forEach((zone) => {
    if (zone.dataset.dropReady === '1') return;
    zone.dataset.dropReady = '1';
    const input = $('input[type="file"]', zone);
    const list = $('[data-file-list]', zone) || create('div', { class: 'file-drop__list', dataset: { fileList: '' } });
    if (!list.isConnected) zone.append(list);

    ['dragenter', 'dragover'].forEach((type) =>
      zone.addEventListener(type, (event) => {
        event.preventDefault();
        zone.classList.add('is-dragover');
      }),
    );
    ['dragleave', 'drop'].forEach((type) =>
      zone.addEventListener(type, (event) => {
        event.preventDefault();
        zone.classList.remove('is-dragover');
      }),
    );
    zone.addEventListener('drop', (event) => {
      const files = [...(event.dataTransfer?.files ?? [])];
      handleFiles(files);
    });
    input?.addEventListener('change', () => handleFiles([...input.files]));

    function handleFiles(files) {
      const maxMb = Number(zone.dataset.maxMb ?? 10);
      const accepted = (zone.dataset.accept ?? '').split(',').map((value) => value.trim()).filter(Boolean);
      files.forEach((file) => {
        const tooBig = file.size > maxMb * 1024 * 1024;
        const wrongType = accepted.length > 0 && !accepted.some((type) => file.name.toLowerCase().endsWith(type));
        if (tooBig || wrongType) {
          toast.danger('فایل پذیرفته نشد', tooBig ? `${file.name} بزرگ‌تر از ${toDigits(maxMb)} مگابایت است.` : `${file.name} از نوع پشتیبانی‌شده نیست.`);
          return;
        }
        const item = create('div', {
          class: 'file-drop__item',
          html: `<span class="file-drop__icon"><i class="bi bi-file-earmark"></i></span>
            <span class="file-drop__name">${escapeHtml(file.name)}</span>
            <span class="file-drop__size">${formatNumber(file.size / 1024, { decimals: 0 })} کیلوبایت</span>
            <button type="button" class="icon-btn icon-btn--sm" data-file-remove aria-label="حذف فایل"><i class="bi bi-x-lg"></i></button>`,
        });
        list.append(item);
        on($('[data-file-remove]', item), 'click', () => {
          item.remove();
          toast.info('فایل حذف شد', file.name);
        });
      });
      if (files.length) toast.success('فایل افزوده شد', `${toDigits(files.length)} فایل آماده بارگذاری است.`);
    }
  });
}

/* -------------------------------------------------------------- tag inputs */
function initTagInputs(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:TagInputs', root)) return;
  $$('[data-tag-input]', root).forEach((host) => {
    if (host.dataset.tagsReady === '1') return;
    host.dataset.tagsReady = '1';
    const input = $('input', host);
    const hidden = $('input[type="hidden"]', host);
    const tags = [...(host.dataset.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)];

    const paint = () => {
      $$('[data-tag]', host).forEach((node) => node.remove());
      tags.forEach((tag) => {
        const chip = create('span', {
          class: 'tag tag--removable',
          html: `${escapeHtml(tag)}<button type="button" class="tag__remove" aria-label="حذف ${escapeHtml(tag)}"><i class="bi bi-x"></i></button>`,
        });
        input.before(chip);
        on($('.tag__remove', chip), 'click', () => {
          tags.splice(tags.indexOf(tag), 1);
          if (hidden) hidden.value = tags.join(',');
          paint();
        });
      });
    };

    const add = (value) => {
      const clean = value.trim().replace(/,$/, '');
      if (!clean || tags.includes(clean)) return;
      tags.push(clean);
      if (hidden) hidden.value = tags.join(',');
      paint();
    };

    on(input, 'keydown', (event) => {
      if (['Enter', ','].includes(event.key)) {
        event.preventDefault();
        add(input.value);
        input.value = '';
      } else if (event.key === 'Backspace' && !input.value && tags.length) {
        tags.pop();
        if (hidden) hidden.value = tags.join(',');
        paint();
      }
    });
    on(input, 'blur', () => {
      add(input.value);
      input.value = '';
    });
    paint();
  });
}

/* -------------------------------------------------------- password strength */
function scorePassword(value) {
  const text = String(value ?? '');
  let score = 0;
  if (text.length >= 8) score += 1;
  if (text.length >= 12) score += 1;
  if (/[A-Z]/.test(text)) score += 1;
  if (/[a-z]/.test(text)) score += 1;
  if (/\d/.test(text)) score += 1;
  if (/[^A-Za-z0-9]/.test(text)) score += 1;
  return Math.min(4, Math.floor(score / 1.6));
}

/**
 * The strength meter is delegated for the same reason the reveal button is (see
 * below): the register screen, the security panel and every password modal are
 * painted after boot, so a per-node binding never reaches them.
 */
function initPasswordMeters(root = document) {
  /* The delegated listeners below live on `document`, so they are guarded
     globally; the initial sweep still runs per root so a form painted into a
     container shows its meter filled in. */
  const bindGlobal = once('init:passwordMeters', document);
  const LABELS = ['ضعیف', 'ضعیف', 'متوسط', 'خوب', 'قوی'];
  const meterFor = (input) =>
    (input.dataset.passwordField ? document.querySelector(input.dataset.passwordField) : null) ??
    input.closest('.form-field, .form-grid, .stack, form')?.querySelector('.password-strength, .password-meter') ??
    null;
  const update = (input) => {
    const meter = meterFor(input);
    if (!meter) return;
    const score = input.value ? scorePassword(input.value) : 0;
    meter.dataset.score = String(score);
    const label = $('[data-password-label]', meter);
    if (label) label.textContent = input.value ? (LABELS[score] ?? '') : '';
    const bars = $$('[data-password-bar]', meter);
    if (bars.length) bars.forEach((bar, index) => bar.classList.toggle('is-filled', Boolean(input.value) && index < score));
  };
  $$('[data-password-field]', root).forEach((input) => update(input));
  if (!bindGlobal) return;
  on(document, 'input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== 'password' && input.dataset.revealed !== '1') return;
    update(input);
  });
  on(document, 'focusin', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === 'password') update(input);
  });

  /**
   * Password reveal is delegated, not bound per button.
   *
   * `initForms()` runs once during boot — long before the auth controllers and
   * every record modal paint their markup — so a `$$('[data-password-toggle]')`
   * binding at that moment never reaches the real inputs and the eye button
   * silently does nothing. A delegated listener on the document covers markup
   * that arrives later, including forms opened from a table row.
   */
  on(document, 'click', (event) => {
    const button = event.target.closest('[data-password-toggle]');
    if (!button) return;
    const input = resolvePasswordInput(button);
    if (!input) return;
    togglePasswordReveal(button, input);
  });
}

/** `[data-password-toggle]` accepts a selector, an id or nothing at all. */
function resolvePasswordInput(button) {
  const ref = button.dataset.passwordToggle || '';
  if (ref) {
    try {
      const found = document.querySelector(ref) ?? document.getElementById(ref.replace(/^#/, ''));
      if (found) return found;
    } catch {
      /* An invalid selector is a markup bug, not a runtime error. */
    }
  }
  return button.closest('.input-group, .form-field, form')?.querySelector('input[type="password"], input[type="text"]') ?? null;
}

function togglePasswordReveal(button, input) {
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  input.dataset.revealed = showing ? '' : '1';
  input.classList.toggle('is-revealed', !showing);
  button.classList.toggle('is-active', !showing);
  button.setAttribute('aria-pressed', String(!showing));
  /* The glyph is part of the affordance: eye → eye-slash. Bootstrap's codepoints
     are not compiled into this template's SCSS, so the class is swapped instead
     of re-declaring `content` in CSS. */
  const glyph = button.querySelector('i');
  if (glyph) glyph.className = `bi bi-${showing ? 'eye' : 'eye-slash'}`;
  button.setAttribute('aria-label', showing ? 'نمایش رمز عبور' : 'پنهان کردن رمز عبور');
  button.setAttribute('title', showing ? 'نمایش رمز عبور' : 'پنهان کردن رمز عبور');
  const icon = button.querySelector('i');
  if (icon) icon.className = `bi bi-${showing ? 'eye-slash' : 'eye-fill'}`;
  /** Keep the filled/invalid styling and the strength meter in step. */
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus({ preventScroll: true });
}


/* ---------------------------------------------------------------------- OTP */
function initOtp(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:Otp', root)) return;
  $$('[data-otp]', root).forEach((host) => {
    const boxes = $$('input', host);
    boxes.forEach((box, index) => {
      box.setAttribute('inputmode', 'numeric');
      box.setAttribute('maxlength', '1');
      on(box, 'input', () => {
        box.value = toLatinDigits(box.value).replace(/\D/g, '').slice(0, 1);
        box.classList.toggle('is-filled', Boolean(box.value));
        if (box.value && boxes[index + 1]) boxes[index + 1].focus();
        const code = boxes.map((node) => node.value).join('');
        host.dataset.value = code;
        if (code.length === boxes.length) host.dispatchEvent(new CustomEvent('nova:otp-complete', { bubbles: true, detail: { code } }));
      });
      on(box, 'keydown', (event) => {
        if (event.key === 'Backspace' && !box.value && boxes[index - 1]) {
          boxes[index - 1].focus();
          boxes[index - 1].value = '';
          boxes[index - 1].classList.remove('is-filled');
        }
        if (event.key === 'ArrowLeft' && boxes[index - 1]) boxes[index - 1].focus();
        if (event.key === 'ArrowRight' && boxes[index + 1]) boxes[index + 1].focus();
      });
      on(box, 'paste', (event) => {
        const text = toLatinDigits(event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
        if (!text) return;
        event.preventDefault();
        text.split('').forEach((digit, offset) => {
          const target = boxes[index + offset];
          if (target) {
            target.value = digit;
            target.classList.add('is-filled');
          }
        });
        host.dispatchEvent(new CustomEvent('nova:otp-complete', { bubbles: true, detail: { code: boxes.map((node) => node.value).join('') } }));
      });
    });
  });
}

/* ------------------------------------------------------------------ steppers */
function initSteppers(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:Steppers', root)) return;
  on(root, 'click', (event) => {
    const button = event.target.closest('[data-step-up], [data-step-down]');
    if (!button) return;
    const host = button.closest('[data-stepper]');
    const input = $('input', host);
    if (!input) return;
    const step = Number(input.step || host.dataset.step || 1);
    const min = input.min !== '' ? Number(input.min) : -Infinity;
    const max = input.max !== '' ? Number(input.max) : Infinity;
    const current = parseNumber(input.value);
    const next = Math.min(max, Math.max(min, current + (button.hasAttribute('data-step-up') ? step : -step)));
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/* --------------------------------------------------------- dependent selects */
function initDependentSelects(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:DependentSelects', root)) return;
  on(root, 'change', (event) => {
    const select = event.target.closest('[data-depends-on]');
    if (!select) return;
    const source = document.querySelector(select.dataset.dependsOn);
    const map = JSON.parse(select.dataset.dependsMap ?? '{}');
    const options = map[source?.value] ?? [];
    select.innerHTML = `<option value="">${select.dataset.placeholder ?? 'انتخاب کنید…'}</option>${options
      .map((option) => `<option value="${escapeHtml(option.value ?? option)}">${escapeHtml(option.label ?? option)}</option>`)
      .join('')}`;
    select.disabled = options.length === 0;
  });
}

/* -------------------------------------------------------------- form widgets */
function initCurrencyInputs(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:CurrencyInputs', root)) return;
  $$('[data-currency-input]', root).forEach((input) => {
    on(input, 'input', () => {
      const digits = toLatinDigits(input.value).replace(/\D/g, '');
      const formatted = digits ? formatNumber(Number(digits)) : '';
      if (input.value !== formatted) {
        const atEnd = input.selectionStart === input.value.length;
        input.value = formatted;
        if (atEnd) input.setSelectionRange(formatted.length, formatted.length);
      }
    });
  });
}

function initDraftSaving(root = document) {
  /* Bound once per root: see `once()` in core/dom.js. */
  if (!once('init:DraftSaving', root)) return;
  $$('[data-draft]', root).forEach((form) => {
    const key = `draft:${form.dataset.draft}`;
    const saved = storage.get(key, null);
    if (saved && !form.dataset.draftIgnore) {
      Object.entries(saved).forEach(([name, value]) => {
        const field = form.elements[name];
        if (field && field.value === '') field.value = value;
      });
    }
    on(form, 'input', () => {
      const data = Object.fromEntries(new FormData(form).entries());
      storage.set(key, data);
    });
    on(form, 'submit', () => storage.remove(key));
  });
}

export function initForms(root = document) {
  if (!once('forms', root)) return false;
  initValidation(root);
  initFileDrops(root);
  initTagInputs(root);
  initPasswordMeters(root);
  initOtp(root);
  initSteppers(root);
  initDependentSelects(root);
  initCurrencyInputs(root);
  initDraftSaving(root);
  return true;
}

ready(() => initForms());

export const form = { init: initForms, validateForm, validateField, scorePassword, MESSAGES };
export default form;
