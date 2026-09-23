/**
 * NOVAADMIN — Jalali (Solar Hijri) calendar engine
 * ------------------------------------------------------------------
 * Wraps `jalaali-js` with the pieces the calendar, date-picker and finance
 * reports need: conversion, month grids, week starts (Saturday for Iran),
 * holiday detection and locale-aware labels. The selected calendar system is
 * a user preference (`nova:calendar` = `jalali` | `gregorian`).
 */
import * as jalaali from 'jalaali-js';
import { toDigits, activeLang } from './numbers.js';
import { storage, KEYS } from './storage.js';

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const GREGORIAN_MONTHS = [
  'ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن',
  'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر',
];

/** Saturday-first week — matches Iranian business calendars. */
export const WEEK_DAYS_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
export const WEEK_DAYS_SHORT_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const WEEK_DAYS_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** Latin + Arabic month / weekday names so every locale reads natively. */
export const GREGORIAN_MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const GREGORIAN_MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const JALALI_MONTHS_EN = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];
export const JALALI_MONTHS_AR = ['فَروَردين', 'أرديبهشت', 'خُرداد', 'تير', 'مُرداد', 'شهريور', 'مِهر', 'آبان', 'آذار', 'دي', 'بهمن', 'إسفند'];
export const WEEK_DAYS_LONG_EN = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const WEEK_DAYS_LONG_AR = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

/** Month names for the active language (falls back to Persian). */
export function monthNames(lang = activeLang()) {
  if (lang === 'en') return { jalali: JALALI_MONTHS_EN, gregorian: GREGORIAN_MONTHS_EN };
  if (lang === 'ar') return { jalali: JALALI_MONTHS_AR, gregorian: GREGORIAN_MONTHS_AR };
  return { jalali: JALALI_MONTHS, gregorian: GREGORIAN_MONTHS };
}

export const JALALI_HOLIDAYS = [
  '01/01', '01/02', '01/03', '01/04', '01/12', '01/13',
  '03/14', '03/15', '11/22', '12/29',
];

let calendarSystem = storage.get(KEYS.calendar, 'jalali');

export const calendar = {
  get system() {
    return calendarSystem;
  },
  set(value) {
    calendarSystem = value === 'gregorian' ? 'gregorian' : 'jalali';
    storage.set(KEYS.calendar, calendarSystem);
    document.documentElement.setAttribute('data-calendar', calendarSystem);
    return calendarSystem;
  },
  isJalali: () => calendarSystem === 'jalali',
};

const pad = (value) => String(value).padStart(2, '0');

/* --------------------------------------------------------------- conversions */

export function toJalali(date) {
  const d = new Date(date);
  const { jy, jm, jd } = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { year: jy, month: jm, day: jd, date: d };
}

export function toGregorian(jy, jm, jd) {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

export const jalaliMonthLength = (jy, jm) => jalaali.jalaaliMonthLength(jy, jm);
export const isLeapJalali = (jy) => jalaali.isLeapJalaaliYear(jy);

/* ------------------------------------------------------------------ reading */

export function parts(date = new Date()) {
  const d = new Date(date);
  if (calendarSystem === 'gregorian') {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), weekday: d.getDay(), date: d };
  }
  const j = toJalali(d);
  return { year: j.year, month: j.month, day: j.day, weekday: d.getDay(), date: d };
}

export function monthLabel(year, month, { short = false, lang = activeLang() } = {}) {
  const names = monthNames(lang);
  const name = (calendarSystem === 'gregorian' ? names.gregorian : names.jalali)[(month - 1 + 12) % 12];
  return short ? name.slice(0, 4) : name;
}

export function weekdayLabels({ short = true, lang = activeLang() } = {}) {
  if (calendarSystem === 'gregorian' || lang !== 'fa') {
    if (lang === 'ar') return short ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'] : WEEK_DAYS_LONG_AR;
    if (lang === 'en') return short ? WEEK_DAYS_EN : WEEK_DAYS_LONG_EN;
  }
  return short ? WEEK_DAYS_SHORT_FA : WEEK_DAYS_FA;
}

/** 0 = Saturday … 6 = Friday. */
export function weekDayIndex(date = new Date()) {
  return (new Date(date).getDay() + 1) % 7;
}

/* --------------------------------------------------------------- formatting */

/**
 * @param {Date|string} date
 * @param {Object} [options] { system, format: 'short'|'long'|'iso'|'time'|'datetime'|'month', lang }
 */
export function formatDate(date, { system = calendarSystem, format = 'short', lang = activeLang() } = {}) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const names = monthNames(lang);
  const weekdays = weekdayLabels({ short: false, lang });
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (format === 'time') return toDigits(time, lang);
  if (format === 'datetime') return `${formatDate(d, { system, format: 'short', lang })} — ${toDigits(time, lang)}`;

  /** English and Arabic read the Gregorian calendar by default. */
  const useGregorian = system === 'gregorian' || (lang !== 'fa' && system !== 'jalali');
  if (useGregorian) {
    const label = lang === 'en'
      ? `${names.gregorian[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
      : `${d.getDate()} ${names.gregorian[d.getMonth()]} ${d.getFullYear()}`;
    return format === 'long' ? `${weekdays[weekDayIndex(d)]}، ${label}` : toDigits(label, lang);
  }

  const { jy, jm, jd } = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  if (format === 'month') return `${names.jalali[jm - 1]} ${toDigits(jy, lang)}`;
  const label = `${toDigits(jd, lang)} ${names.jalali[jm - 1]} ${toDigits(jy, lang)}`;
  return format === 'long' ? `${weekdays[weekDayIndex(d)]}، ${label}` : label;
}

/** Machine-usable ISO date that keeps the *current* calendar system's numbers. */
export function formatIso(date = new Date()) {
  const d = new Date(date);
  if (calendarSystem === 'gregorian') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const { jy, jm, jd } = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

export function relativeTime(date, { lang = activeLang() } = {}) {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.round((then - Date.now()) / 1000);
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  const locale = lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-AE' : 'en-US';
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const [unit, seconds] = units.find(([, size]) => Math.abs(diff) >= size) ?? ['second', 1];
  const value = Math.round(diff / seconds);
  return toDigits(formatter.format(value, unit), lang);
}

/* ------------------------------------------------------------------- grids */

/**
 * Month grid for the calendar component.
 * @param {number} year  current calendar year
 * @param {number} month 1-based month
 * @returns {Array<{ date: Date, day: number, inMonth: boolean, today: boolean, holiday: boolean, weekend: boolean, key: string }>}
 */
export function monthGrid(year, month) {
  const first = calendarSystem === 'gregorian' ? new Date(year, month - 1, 1) : toGregorian(year, month, 1);
  const offset = weekDayIndex(first); // cells before the 1st
  const length = calendarSystem === 'gregorian'
    ? new Date(year, month, 0).getDate()
    : jalaliMonthLength(year, month);

  const leading = calendarSystem === 'gregorian'
    ? new Date(year, month - 1, 1 - offset)
    : new Date(first.getTime() - offset * 86400000);
  const total = Math.ceil((offset + length) / 7) * 7;

  return Array.from({ length: total }).map((_, index) => {
    const date = new Date(leading.getTime() + index * 86400000);
    const p = parts(date);
    const inMonth = index >= offset && index < offset + length;
    const wd = weekDayIndex(date);
    return {
      date,
      day: p.day,
      month: p.month,
      year: p.year,
      inMonth,
      today: isSameDay(date, new Date()),
      weekend: wd === 6,
      holiday: inMonth && calendarSystem === 'jalali' && JALALI_HOLIDAYS.includes(`${pad(p.month)}/${pad(p.day)}`),
      key: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    };
  });
}

export function isSameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export function addMonths(date, amount) {
  const d = new Date(date);
  if (calendarSystem === 'jalali') {
    const { jy, jm, jd } = toJalali(d);
    let month = jm + amount;
    let year = jy;
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    const day = Math.min(jd, jalaliMonthLength(year, month));
    return toGregorian(year, month, day);
  }
  d.setMonth(d.getMonth() + amount);
  return d;
}

export function startOfWeek(date = new Date()) {
  return addDays(startOfDay(date), -weekDayIndex(date));
}

export function weekDays(date = new Date()) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Inclusive day count between two dates. */
export const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

export function monthRange(date = new Date()) {
  const p = parts(date);
  const first = calendarSystem === 'gregorian' ? new Date(p.year, p.month - 1, 1) : toGregorian(p.year, p.month, 1);
  const last = addDays(addMonths(first, 1), -1);
  return { from: startOfDay(first), to: new Date(startOfDay(last).getTime() + 86399999) };
}

export default {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  WEEK_DAYS_FA,
  WEEK_DAYS_SHORT_FA,
  calendar,
  toJalali,
  toGregorian,
  parts,
  monthLabel,
  weekdayLabels,
  weekDayIndex,
  formatDate,
  formatIso,
  relativeTime,
  monthGrid,
  monthRange,
  weekDays,
  startOfWeek,
  startOfDay,
  addDays,
  addMonths,
  isSameDay,
  dayDiff,
  isLeapJalali,
  jalaliMonthLength,
};
