/**
 * NOVAADMIN — number, currency & digit formatting
 * Persian-first by design: Persian digits, Rial/Toman grouping and readable
 * compact forms are the defaults; every helper accepts an explicit locale or
 * digit set so the same functions serve fa / en / ar.
 */
import { config } from '../../config/config.js';

export const DIGIT_SETS = {
  fa: ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
  ar: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'],
  en: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
};

export const CURRENCIES = {
  IRR: { label: 'ریال ایران', short: 'ریال', decimals: 0, prefix: '', suffix: ' ریال', locale: 'fa-IR' },
  IRT: { label: 'تومان', short: 'تومان', decimals: 0, prefix: '', suffix: ' تومان', locale: 'fa-IR' },
  USD: { label: 'دلار آمریکا', short: '$', decimals: 2, prefix: '$', suffix: '', locale: 'en-US' },
  EUR: { label: 'یورو', short: '€', decimals: 2, prefix: '€', suffix: '', locale: 'de-DE' },
  AED: { label: 'درهم امارات', short: 'AED', decimals: 2, prefix: '', suffix: ' د.إ', locale: 'ar-AE' },
};

let activeLanguage = config.defaultLanguage;

/** Called by the i18n module whenever the UI language changes. */
export function setNumberLanguage(lang) {
  activeLanguage = lang || config.defaultLanguage;
}

/** The language every formatter falls back to (used by dates, tables, charts). */
export const activeLang = () => activeLanguage;

/**
 * Localised vocabulary for the formatters below. Keeping it in one table means
 * `formatCompact(1_200_000)` reads «۱٫۲ میلیون» in Persian, «1.2M» in English
 * and «١٫٢ مليون» in Arabic — no call site has to care.
 */
const WORDS = {
  fa: {
    compact: ['هزار میلیارد', 'میلیارد', 'میلیون', 'هزار'],
    percent: '٪',
    bytes: ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'],
    hour: 'ساعت', minute: 'دقیقه', and: ' و ',
    currency: { IRR: { prefix: '', suffix: ' ریال' }, IRT: { prefix: '', suffix: ' تومان' }, USD: { prefix: '$', suffix: '' }, EUR: { prefix: '€', suffix: '' }, AED: { prefix: '', suffix: ' د.إ' } },
    locale: 'fa-IR',
  },
  ar: {
    compact: ['تريليون', 'مليار', 'مليون', 'ألف'],
    percent: '٪',
    bytes: ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت', 'تيرابايت'],
    hour: 'ساعة', minute: 'دقيقة', and: ' و ',
    currency: { IRR: { prefix: '', suffix: ' ريال' }, IRT: { prefix: '', suffix: ' تومان' }, USD: { prefix: '$', suffix: '' }, EUR: { prefix: '€', suffix: '' }, AED: { prefix: '', suffix: ' د.إ' } },
    locale: 'ar-AE',
  },
  en: {
    compact: ['T', 'B', 'M', 'K'],
    percent: '%',
    bytes: ['B', 'KB', 'MB', 'GB', 'TB'],
    hour: 'h', minute: 'min', and: ' ',
    currency: { IRR: { prefix: 'IRR ', suffix: '' }, IRT: { prefix: 'IRT ', suffix: '' }, USD: { prefix: '$', suffix: '' }, EUR: { prefix: '€', suffix: '' }, AED: { prefix: '', suffix: ' AED' } },
    locale: 'en-US',
  },
};

export const words = (lang = activeLanguage) => WORDS[lang] ?? WORDS.fa;

export const digitsOf = (lang = activeLanguage) => DIGIT_SETS[lang] ?? DIGIT_SETS.fa;

/** Converts Latin digits to the active (or given) digit set. */
export function toDigits(value, lang = activeLanguage) {
  const set = digitsOf(lang);
  return String(value).replace(/\d/g, (digit) => set[Number(digit)]);
}

/** Converts any digit set back to Latin — used before parsing user input. */
export function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Number with grouping, Persian/Arabic digits and locale-aware separators.
 * @param {number} value
 * @param {Object} [options] { lang, decimals, grouping }
 */
export function formatNumber(value, { lang = activeLanguage, decimals = 0, grouping = true } = {}) {
  const number = Number(toLatinDigits(value));
  if (!Number.isFinite(number)) return toDigits('۰', lang);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  }).format(number);
  return toDigits(formatted, lang);
}

/** Short readable form: ۱۲٫۴ میلیون / ۱٫۸ میلیارد — used by KPI cards. */
export function formatCompact(value, { lang = activeLanguage, decimals = 1 } = {}) {
  const number = Number(toLatinDigits(value)) || 0;
  const abs = Math.abs(number);
  const [trillion, billion, million, thousand] = words(lang).compact;
  const units = [
    { limit: 1e12, suffix: trillion },
    { limit: 1e9, suffix: billion },
    { limit: 1e6, suffix: million },
    { limit: 1e3, suffix: thousand },
  ];
  const unit = units.find((u) => abs >= u.limit);
  if (!unit) return formatNumber(number, { lang });
  const scaled = number / unit.limit;
  const body = formatNumber(scaled, { lang, decimals: Math.abs(scaled) >= 100 ? 0 : decimals });
  /** Latin suffixes stick to the number (`12.4M`); Persian ones need a space. */
  return /^[A-Za-z]+$/.test(unit.suffix) ? `${body}${unit.suffix}` : `${body} ${unit.suffix}`;
}

/**
 * Currency formatting.
 * @param {number} value
 * @param {string} [currency] IRR | IRT | USD | EUR | AED
 * @param {Object} [options] { lang, decimals, compact }
 */
export function formatCurrency(value, currency = config.currency, { lang = activeLanguage, decimals, compact = false, showCode = false } = {}) {
  const meta = CURRENCIES[currency] ?? CURRENCIES[config.currency] ?? CURRENCIES.IRR;
  /** Currency wording follows the active language (ریال / ريال / IRR). */
  const localised = words(lang).currency[currency] ?? { prefix: meta.prefix, suffix: meta.suffix };
  const number = Number(toLatinDigits(value)) || 0;
  const body = compact
    ? formatCompact(Math.abs(number), { lang })
    : formatNumber(Math.abs(number), { lang, decimals: decimals ?? meta.decimals });
  const code = showCode && lang === 'en' ? '' : showCode ? ` ${currency}` : '';
  return `${number < 0 ? '−' : ''}${localised.prefix}${body}${localised.suffix}${code}`;
}

export function formatPercent(value, { lang = activeLanguage, decimals = 1, sign = false } = {}) {
  const number = Number(toLatinDigits(value)) || 0;
  const body = formatNumber(Math.abs(number), { lang, decimals });
  const mark = words(lang).percent;
  /** In RTL the sign sits before the digits, in LTR `+12.4%` — both read right. */
  const prefix = sign && number > 0 ? '+' : number < 0 ? '−' : '';
  return lang === 'en' ? `${prefix}${body}${mark}` : `${prefix}${body}${mark}`;
}

export function formatBytes(bytes, { lang = activeLanguage, decimals = 1 } = {}) {
  const size = Number(toLatinDigits(bytes)) || 0;
  const units = words(lang).bytes;
  const index = size === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const value = size / 1024 ** index;
  return `${formatNumber(value, { lang, decimals: index === 0 ? 0 : decimals })} ${units[index]}`;
}

export function formatDuration(minutes, { lang = activeLanguage } = {}) {
  const total = Math.max(0, Math.round(Number(toLatinDigits(minutes)) || 0));
  const { hour, minute, and } = words(lang);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${formatNumber(hours, { lang })} ${hour}${and}${formatNumber(mins, { lang })} ${minute}`;
  if (hours) return `${formatNumber(hours, { lang })} ${hour}`;
  return `${formatNumber(mins, { lang })} ${minute}`;
}

/** Parses user input in any digit set into a plain number. */
export function parseNumber(input) {
  const clean = toLatinDigits(input).replace(/[^\d.\-]/g, '');
  const number = Number.parseFloat(clean);
  return Number.isFinite(number) ? number : 0;
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function trendOf(delta) {
  const value = Number(delta) || 0;
  if (value > 0.4) return 'up';
  if (value < -0.4) return 'down';
  return 'flat';
}

export default {
  toDigits,
  toLatinDigits,
  activeLang,
  formatNumber,
  formatCompact,
  formatCurrency,
  formatPercent,
  formatBytes,
  formatDuration,
  parseNumber,
  setNumberLanguage,
  CURRENCIES,
  DIGIT_SETS,
  trendOf,
  clamp,
};
