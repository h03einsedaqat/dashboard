/**
 * NOVAADMIN — deterministic demo data helpers
 * ------------------------------------------------------------------
 * Demo content is generated from a fixed seed so screenshots, charts and
 * tables look identical on every reload (and in every language). Nothing here
 * touches the network: the whole dataset ships with the template.
 */

/** mulberry32 — tiny, fast, deterministic PRNG. */
export function createRng(seed = 20260922) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeHelpers(seed = 20260922) {
  const rng = createRng(seed);
  const int = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const float = (min, max, decimals = 1) => Number((rng() * (max - min) + min).toFixed(decimals));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const picks = (arr, count) => {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < count && copy.length; i += 1) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    return out;
  };
  const bool = (chance = 0.5) => rng() < chance;
  /** ISO date `daysAgo` in the past (timezone-safe, no external deps). */
  const date = (daysAgo = 0, hour = 9, minute = 30) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };
  const series = (length, min, max) => Array.from({ length }, () => int(min, max));
  return { rng, int, float, pick, picks, bool, date, series };
}

/* --------------------------------------------------------- shared vocabularies */

export const firstNames = [
  'سارا', 'علی', 'مریم', 'رضا', 'نگار', 'امیر', 'الهام', 'حسین', 'پریسا', 'محمد',
  'زهرا', 'کیان', 'نازنین', 'بابک', 'شیما', 'یاسر', 'آیدا', 'سینا', 'لیلا', 'آرش',
  'رها', 'بهنام', 'مینا', 'کاوه', 'شیرین', 'فرهاد', 'ترانه', 'نوید', 'سمیرا', 'پویا',
];

export const lastNames = [
  'محمدی', 'رضایی', 'کریمی', 'حسینی', 'احمدی', 'نوری', 'صادقی', 'موسوی', 'جعفری', 'قاسمی',
  'شریفی', 'امینی', 'طاهری', 'یزدانی', 'کاظمی', 'بهرامی', 'فروغی', 'سلطانی', 'زمانی', 'رستمی',
];

export const companyNames = [
  'داده‌پردازان پارس', 'فناوری آرکا', 'گروه صنعتی البرز', 'شرکت نوآوران کاسپین', 'همراه سیستم شرق',
  'پتروشیمی خلیج', 'بازرگانی آریانا', 'صنایع غذایی بهاران', 'فولاد سپاهان', 'خدمات ابری ویرا',
  'پخش سراسری رایان', 'شرکت ساختمانی بنا', 'لبنیات دامداران', 'داروسازی کارن', 'قطعات خودرو ایران‌کاوه',
  'مخابرات نوین', 'سرمایه‌گذاری آفتاب', 'حمل‌ونقل بارابان', 'معدن مس کوهبنان', 'پوشاک نیلوفر',
];

export const cities = [
  'تهران', 'اصفهان', 'مشهد', 'شیراز', 'تبریز', 'کرج', 'قم', 'اهواز', 'رشت', 'یزد',
  'کرمان', 'ارومیه', 'بندرعباس', 'زنجان', 'ساری',
];

export const productNames = [
  'هدفون بی‌سیم پرو', 'ماوس ارگونومیک MX', 'کیبورد مکانیکی ۸۷ کلید', 'مانیتور ۲۷ اینچ 4K',
  'لپ‌تاپ اولترابوک ۱۴', 'پایه نگهدارنده مانیتور', 'وب‌کم ۱۰۸۰p', 'هارد اکسترنال ۲ ترابایت',
  'SSD اینترنال NVMe', 'روتر بی‌سیم AX3000', 'پرینتر لیزری رنگی', 'اسکنر پرتابل',
  'اسپیکر بلوتوثی ضدآب', 'پاوربانک ۲۰۰۰۰', 'شارژر سریع ۶۵ وات', 'کابل Type-C بافته‌شده',
  'میکروفون استودیویی', 'صندلی اداری ارگونومیک', 'میز ایستاده برقی', 'لامپ رومیزی LED',
  'دوربین دیجیتال بدون آینه', 'گیمر پد حرفه‌ای', 'هدست گیمینگ ۷.۱', 'تبلت ۱۱ اینچ',
];

export const categoryNames = [
  'لوازم جانبی کامپیوتر', 'صوتی و تصویری', 'لپ‌تاپ و کامپیوتر', 'شبکه و اینترنت',
  'چاپ و اسکن', 'ذخیره‌سازی داده', 'تجهیزات اداری', 'گیمینگ', 'موبایل و تبلت', 'خانه هوشمند',
];

export const brandNames = ['نوواتک', 'پارس‌الکترونیک', 'آرکادیا', 'زیتک', 'مکس‌لاین', 'ویرا', 'ای‌تک', 'کاسپین'];

export const countries = ['ایران', 'امارات', 'ترکیه', 'آلمان', 'چین', 'فرانسه', 'عمان', 'قطر', 'روسیه', 'هند'];
