/**
 * NOVAADMIN — eCommerce demo data
 * (products, categories, brands, orders, inventory, reviews, coupons)
 */
import { makeHelpers, productNames, categoryNames, brandNames, firstNames, lastNames, cities } from './rng.js';
import { customers } from './people.js';
import { config } from '../config/config.js';

const { int, float, pick, picks, bool, date } = makeHelpers(2002);

export const ORDER_STATUSES = [
  { id: 'pending', label: 'در انتظار پرداخت', tone: 'warning', step: 1 },
  { id: 'processing', label: 'در حال پردازش', tone: 'info', step: 2 },
  { id: 'completed', label: 'تکمیل شده', tone: 'success', step: 4 },
  { id: 'cancelled', label: 'لغو شده', tone: 'danger', step: 0 },
  { id: 'refunded', label: 'مرجوع شده', tone: 'neutral', step: 0 },
];

/** The tag vocabulary used by both the products and the «برچسب‌ها» page. */
export const TAG_NAMES = [
  'پرفروش', 'جدید', 'پیشنهاد ویژه', 'گارانتی', 'ارسال رایگان', 'اورجینال',
  'زمستانه', 'تابستانه', 'دست‌ساز', 'محدود',
];

export const PAYMENT_METHODS = [
  { id: 'card', label: 'کارت بانکی', icon: 'credit-card' },
  { id: 'wallet', label: 'کیف پول', icon: 'wallet2' },
  { id: 'transfer', label: 'انتقال بانکی', icon: 'bank' },
  { id: 'cash', label: 'پرداخت در محل', icon: 'cash-coin' },
];

/*
 * Curated catalogue tree. The RNG calls of the original generator are still
 * consumed (same order) so every dataset generated after this one stays
 * byte-identical; only the category meta is replaced with real values.
 */
const CATEGORY_META = {
  'لوازم جانبی کامپیوتر': { slug: 'pc-accessories', icon: 'mouse', parent: 'لپ‌تاپ و کامپیوتر', color: 'violet', description: 'ماوس، کیبورد، هاب و تجهیزات میز کار' },
  'صوتی و تصویری': { slug: 'audio-video', icon: 'headphones', parent: null, color: 'info', description: 'هدفون، اسپیکر، مانیتور و پروژکتور' },
  'لپ‌تاپ و کامپیوتر': { slug: 'laptops-computers', icon: 'laptop', parent: null, color: 'primary', description: 'لپ‌تاپ، کامپیوتر رومیزی و آل‌این‌وان' },
  'شبکه و اینترنت': { slug: 'networking', icon: 'router', parent: 'خانه هوشمند', color: 'success', description: 'مودم، روتر، سوییچ و اکسس‌پوینت' },
  'چاپ و اسکن': { slug: 'print-scan', icon: 'printer', parent: 'تجهیزات اداری', color: 'warning', description: 'پرینتر، اسکنر و مواد مصرفی' },
  'ذخیره‌سازی داده': { slug: 'storage', icon: 'device-hdd', parent: 'لپ‌تاپ و کامپیوتر', color: 'danger', description: 'هارد، SSD، فلش و NAS' },
  'تجهیزات اداری': { slug: 'office-equipment', icon: 'briefcase', parent: null, color: 'warning', description: 'ماشین‌های اداری، دستگاه حضور و غیاب و…' },
  'گیمینگ': { slug: 'gaming', icon: 'controller', parent: 'لپ‌تاپ و کامپیوتر', color: 'danger', description: 'کنسول، دسته بازی و تجهیزات گیمینگ' },
  'موبایل و تبلت': { slug: 'mobile-tablet', icon: 'phone', parent: null, color: 'info', description: 'گوشی هوشمند، تبلت و لوازم جانبی' },
  'خانه هوشمند': { slug: 'smart-home', icon: 'house-gear', parent: null, color: 'success', description: 'دوربین، دستیار صوتی، روشنایی و امنیت' },
};
export const categories = categoryNames.map((name, i) => {
  const base = {
    icon: pick(['bag', 'headphones', 'laptop', 'router', 'printer', 'hdd', 'printer-fill', 'controller', 'phone', 'house-gear']),
    products: int(4, 38),
    parent: i > 5 ? pick(categoryNames.slice(0, 5)) : null,
    revenue: int(220, 4200) * 1000000,
  };
  const meta = CATEGORY_META[name] ?? {};
  return {
    id: `cat-${i + 1}`,
    name,
    slug: meta.slug ?? `category-${i + 1}`,
    icon: meta.icon ?? base.icon,
    color: meta.color ?? 'primary',
    description: meta.description ?? '',
    products: base.products,
    parent: meta.parent !== undefined ? meta.parent : base.parent,
    status: name === 'گیمینگ' ? 'inactive' : 'active',
    featured: ['لپ‌تاپ و کامپیوتر', 'موبایل و تبلت', 'خانه هوشمند'].includes(name),
    order: i + 1,
    revenue: base.revenue,
  };
});

export const brands = brandNames.map((name, i) => ({
  id: `brand-${i + 1}`,
  name,
  logo: `assets/img/brands/brand-${String(i + 1).padStart(2, '0')}.svg`,
  products: int(6, 42),
  country: pick(['ایران', 'آلمان', 'چین', 'ترکیه']),
  rating: float(3.6, 4.9, 1),
  status: i === 5 ? 'inactive' : 'active',
}));

export const products = Array.from({ length: 48 }).map((_, i) => {
  const name = `${productNames[i % productNames.length]}${i >= productNames.length ? ` ویرایش ${Math.floor(i / productNames.length) + 1}` : ''}`;
  const price = int(450, 98000) * 1000;
  const discount = pick([0, 0, 0, 5, 10, 15, 20, 25, 30]);
  const stock = int(0, 480);
  const n = i + 1;
  return {
    id: `p-${String(n).padStart(3, '0')}`,
    name,
    sku: `NV-${String(1000 + n)}`,
    category: pick(categories).name,
    brand: pick(brands).name,
    price,
    discount,
    finalPrice: Math.round(price * (1 - discount / 100)),
    tax: 9,
    stock,
    warehouse: pick(['انبار مرکزی تهران', 'انبار اصفهان', 'انبار مشهد']),
    status: stock === 0 ? 'out-of-stock' : pick(['published', 'published', 'published', 'draft', 'archived']),
    featured: bool(0.22),
    rating: float(3.2, 5, 1),
    reviews: int(0, 320),
    sold: int(4, 1450),
    views: int(400, 32000),
    image: `assets/img/products/product-${String((i % 24) + 1).padStart(2, '0')}.svg`,
    /* Four real views per product (cover first) so the details page can show the
       same carousel as the product studio. Derived positionally — no RNG draws,
       which keeps every dataset in this file byte-identical. */
    images: [0, 7, 13, 19].map((offset) => `assets/img/products/product-${String(((i + offset) % 24) + 1).padStart(2, '0')}.svg`),
    createdAt: date(int(5, 700), int(9, 18)),
    description:
      'محصولی با کیفیت ساخت بالا، مناسب استفاده حرفه‌ای روزمره. دارای گارانتی رسمی ۱۸ ماهه و پشتیبانی فنی سراسر کشور. طراحی ارگونومیک و متریال مقاوم، عمر مفید دستگاه را افزایش می‌دهد.',
    shortDescription: 'کیفیت ساخت بالا، گارانتی ۱۸ ماهه و ارسال سریع به سراسر کشور.',
    tags: picks(TAG_NAMES, 3),
    seoTitle: `${name} | خرید آنلاین`,
    seoDescription: `خرید ${name} با قیمت مناسب، ارسال سریع و ضمانت بازگشت کالا.`,
  };
});

export const inventory = products.map((p) => ({
  id: `inv-${p.id}`,
  product: p.name,
  sku: p.sku,
  image: p.image,
  warehouse: p.warehouse,
  stock: p.stock,
  reserved: int(0, 25),
  reorderLevel: 30,
  incoming: pick([0, 0, 40, 120, 250]),
  updatedAt: date(int(0, 14), int(9, 19)),
}));

export const reviews = Array.from({ length: 26 }).map((_, i) => {
  const p = products[(i * 3) % products.length];
  const rating = pick([5, 5, 5, 4, 4, 3, 2]);
  return {
    id: `rv-${i + 1}`,
    product: p.name,
    productId: p.id,
    image: p.image,
    author: `${firstNames[(i * 4) % firstNames.length]} ${lastNames[(i * 7) % lastNames.length]}`,
    avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
    rating,
    title: rating >= 4 ? 'کیفیت بالاتر از انتظار' : 'نیاز به بهبود دارد',
    text: pick([
      'بسته‌بندی بسیار خوب بود و سریع‌تر از موعد به دستم رسید. کیفیت ساخت واقعاً عالی است.',
      'از خرید راضی هستم؛ فقط راهنمای فارسی می‌توانست کامل‌تر باشد.',
      'عملکرد دقیقاً مطابق مشخصات اعلام‌شده است. پشتیبانی هم سریع پاسخ داد.',
      'قیمت نسبت به کیفیت مناسب است، اما انتظار داشتم لوازم جانبی بیشتری همراه داشته باشد.',
    ]),
    status: pick(['published', 'published', 'pending', 'rejected']),
    at: date(int(1, 180), int(10, 21)),
    helpful: int(0, 84),
    verified: bool(0.72),
  };
});

export const coupons = Array.from({ length: 12 }).map((_, i) => {
  const type = pick(['percent', 'fixed']);
  return {
    id: `cp-${i + 1}`,
    code: pick(['WELCOME', 'NOVA', 'SPRING', 'VIP', 'FLASH', 'TEHRAN', 'BLACK', 'NOWRUZ']).toUpperCase() + (100 + i),
    type,
    value: type === 'percent' ? pick([5, 10, 15, 20, 25, 30]) : int(200, 2500) * 1000,
    minOrder: int(1, 20) * 1000000,
    used: int(3, 480),
    limit: pick([100, 250, 500, 0]),
    status: pick(['active', 'active', 'active', 'scheduled', 'expired']),
    from: date(int(30, 200), 0, 0),
    to: date(-int(10, 120), 23, 59),
    description: type === 'percent' ? 'تخفیف درصدی روی کل سبد خرید' : 'تخفیف نقدی روی سفارش‌های بالای حد مشخص',
  };
});

export const tags = TAG_NAMES.map((name, i) => ({
  id: `tag-${i + 1}`,
  name,
  // The two draws below keep the shared RNG stream aligned with the datasets
  // that follow (orders); the real numbers are written in the metrics block.
  products: int(3, 42),
  color: pick(['primary', 'success', 'warning', 'info', 'violet']),
}));

/* ------------------------------------------------------------------- orders */
export const orders = Array.from({ length: 64 }).map((_, i) => {
  const customer = customers[(i * 5) % customers.length];
  const status = pick(ORDER_STATUSES);
  const items = int(1, 6);
  const itemsList = picks(products, items).map((p) => ({
    id: p.id,
    name: p.name,
    image: p.image,
    sku: p.sku,
    price: p.finalPrice,
    qty: int(1, 4),
  })).map((it) => ({ ...it, quantity: it.qty }));
  const subtotal = itemsList.reduce((sum, it) => sum + it.price * it.qty, 0);
  const discount = pick([0, 0, 0, Math.round(subtotal * 0.05), Math.round(subtotal * 0.1)]);
  const tax = Math.round((subtotal - discount) * 0.09);
  const shipping = subtotal > 20000000 ? 0 : 450000;
  const total = subtotal - discount + tax + shipping;
  const n = 12000 + i;
  return {
    id: `o-${n}`,
    number: `#${n}`,
    customerId: customer.id,
    customer: customer.contact,
    company: customer.company,
    avatar: customer.avatar,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    address: `${pick(cities)}، خیابان ${pick(['ولیعصر', 'آزادی', 'انقلاب', 'سعدی', 'شریعتی'])}، پلاک ${int(1, 240)}`,
    items: itemsList,
    itemsCount: itemsList.reduce((s, it) => s + it.qty, 0),
    subtotal,
    discount,
    tax,
    shipping,
    total,
    currency: config.currency,
    status: status.id,
    statusLabel: status.label,
    payment: pick(PAYMENT_METHODS).label,
    paymentStatus: status.id === 'pending' ? 'unpaid' : status.id === 'refunded' ? 'refunded' : 'paid',
    placedAt: date(int(0, 120), int(8, 22), int(0, 59)),
    shippingMethod: pick(['پست پیشتاز', 'تیپاکس', 'ارسال همان‌روز', 'پیک اختصاصی']),
    trackingCode: `NV${int(100000, 999999)}`,
    note: bool(0.3) ? 'لطفاً قبل از ارسال تماس گرفته شود.' : '',
    timeline: [
      { label: 'ثبت سفارش', at: date(int(1, 6), 10, 5), done: true },
      { label: 'تأیید پرداخت', at: date(int(1, 6), 10, 12), done: status.id !== 'pending' },
      { label: 'آماده‌سازی در انبار', at: date(int(0, 5), 11, 30), done: ['processing', 'completed', 'refunded'].includes(status.id) },
      { label: 'تحویل به شرکت حمل', at: date(int(0, 4), 15, 45), done: ['completed', 'refunded'].includes(status.id) },
      { label: 'تحویل به مشتری', at: date(int(0, 2), 17, 20), done: status.id === 'completed' },
    ],
  };
});

export const orderStats = ORDER_STATUSES.map((s) => ({
  id: s.id,
  label: s.label,
  tone: s.tone,
  count: orders.filter((o) => o.status === s.id).length,
}));

export const topProducts = [...products]
  .sort((a, b) => b.sold * b.finalPrice - a.sold * a.finalPrice)
  .slice(0, 8)
  .map((p, i) => ({ ...p, rank: i + 1, revenue: p.sold * p.finalPrice }));

export const salesByCategory = categories.slice(0, 7).map((c) => ({
  label: c.name,
  value: c.revenue,
  share: 0,
}));
const catTotal = salesByCategory.reduce((s, c) => s + c.value, 0);
salesByCategory.forEach((c) => {
  c.share = Math.round((c.value / catTotal) * 1000) / 10;
});

/* ------------------------------------------------- brand & tag metrics ------ */
/*
 * Curated identity for every brand (country of origin, founding year, website,
 * positioning) plus metrics that are *derived* from the catalogue and the order
 * book — so «برندها» and «برچسب‌ها» show numbers that match the products,
 * orders and reviews pages instead of unrelated random values.
 *
 * The randomness needed for trend figures uses its own RNG stream, which leaves
 * the shared stream (and therefore every dataset above) untouched.
 */
const { float: brandFloat } = makeHelpers(7301);

const slugify = (value) =>
  value
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** `https://novatek.example.com` → `novatek` (slugs stay ASCII for pretty URLs). */
const slugFromSite = (site = '') => slugify(String(site).replace(/^https?:\/\//, '').split('.')[0]);

const BRAND_META = {
  نوواتک: { country: 'ایران', city: 'تهران', since: 1392, tier: 'برتر', color: 'primary', website: 'https://novatek.example.com', description: 'تولیدکننده داخلی تجهیزات شبکه و لوازم جانبی کامپیوتر با گارانتی سه‌ساله.' },
  پارس‌الکترونیک: { country: 'ایران', city: 'اصفهان', since: 1385, tier: 'برتر', color: 'info', website: 'https://parselectronic.example.com', description: 'پخش سراسری لپ‌تاپ، مانیتور و تجهیزات اداری با شبکه ۱۴ نمایندگی.' },
  آرکادیا: { country: 'آلمان', city: 'مونیخ', since: 1378, tier: 'حرفه‌ای', color: 'violet', website: 'https://arkadia.example.de', description: 'برند آلمانی تجهیزات صوتی و تصویری حرفه‌ای؛ واردات رسمی با استاندارد CE.' },
  زیتک: { country: 'چین', city: 'شنژن', since: 1390, tier: 'اقتصادی', color: 'warning', website: 'https://zitech.example.cn', description: 'تولیدکننده انبوه لوازم جانبی موبایل و ذخیره‌سازی داده با قیمت رقابتی.' },
  'مکس‌لاین': { country: 'امارات', city: 'دبی', since: 1396, tier: 'حرفه‌ای', color: 'success', website: 'https://maxline.example.ae', description: 'هاب توزیع منطقه‌ای گیمینگ و لوازم جانبی رده بالا در خاورمیانه.' },
  ویرا: { country: 'ایران', city: 'شیراز', since: 1398, tier: 'برتر', color: 'primary', website: 'https://vira.example.com', description: 'استارتاپ ایرانی خانه هوشمند و تجهیزات شبکه؛ تمرکز روی پشتیبانی محلی.' },
  'ای‌تک': { country: 'ترکیه', city: 'استانبول', since: 1393, tier: 'اقتصادی', color: 'info', website: 'https://etech.example.tr', description: 'تولید تجهیزات اداری و چاپگر با نمایندگی رسمی در ایران.' },
  کاسپین: { country: 'ایران', city: 'رشت', since: 1389, tier: 'حرفه‌ای', color: 'success', website: 'https://caspian.example.com', description: 'مونتاژ و توزیع مانیتور و تجهیزات ذخیره‌سازی در شمال کشور.' },
  تکنوسان: { country: 'ترکیه', city: 'آنکارا', since: 1391, tier: 'اقتصادی', color: 'warning', website: 'https://teknosan.example.tr', description: 'لوازم جانبی کامپیوتر و ماوس/کیبورد ارگونومیک برای بازار خاورمیانه.' },
  هایپرلینک: { country: 'چین', city: 'هانگژو', since: 1395, tier: 'حرفه‌ای', color: 'violet', website: 'https://hyperlinq.example.cn', description: 'تجهیزات شبکه پرسرعت، روتر و ماژول‌های فیبر نوری نسل جدید.' },
  مگاتک: { country: 'امارات', city: 'شارجه', since: 1399, tier: 'جدید', color: 'danger', website: 'https://megatech.example.ae', description: 'تأمین‌کننده نوظهور استوریج و لوازم گیمینگ؛ رشد سریع سهم بازار.' },
  نوردیکس: { country: 'آلمان', city: 'هامبورگ', since: 1383, tier: 'برتر', color: 'primary', website: 'https://nordix.example.de', description: 'برند پیشرو تجهیزات صنعتی و اداری با استاندارد TÜV آلمان.' },
};

const productByBrand = new Map();
products.forEach((product) => {
  if (!productByBrand.has(product.brand)) productByBrand.set(product.brand, []);
  productByBrand.get(product.brand).push(product);
});

const revenueByBrand = new Map();
orders.forEach((order) => {
  order.items.forEach((item) => {
    const owner = products.find((p) => p.name === item.name);
    const brand = owner?.brand ?? 'نامشخص';
    revenueByBrand.set(brand, (revenueByBrand.get(brand) ?? 0) + item.price * item.qty);
  });
});

const brandRevenueTotal = [...revenueByBrand.values()].reduce((sum, value) => sum + value, 0) || 1;
const brandRatingPeak = Math.max(...brands.map((b) => b.rating), 1);

brands.forEach((brand) => {
  const meta = BRAND_META[brand.name] ?? {};
  const list = productByBrand.get(brand.name) ?? [];
  const revenue = revenueByBrand.get(brand.name) ?? 0;
  brand.country = meta.country ?? brand.country;
  brand.city = meta.city ?? '';
  brand.since = meta.since ?? 1390;
  brand.tier = meta.tier ?? 'حرفه‌ای';
  brand.color = meta.color ?? 'primary';
  brand.website = meta.website ?? '';
  brand.description = meta.description ?? '';
  brand.slug = slugFromSite(brand.website) || slugify(brand.name) || brand.id;
  brand.products = list.length;
  brand.catalogShare = brand.products / Math.max(1, products.length);
  brand.rating = Math.round((list.reduce((sum, p) => sum + p.rating, 0) / Math.max(1, list.length)) * 10) / 10 || brand.rating;
  brand.reviews = list.reduce((sum, p) => sum + p.reviews, 0);
  brand.sold = list.reduce((sum, p) => sum + p.sold, 0);
  brand.stock = list.reduce((sum, p) => sum + p.stock, 0);
  brand.lowStock = list.filter((p) => p.stock > 0 && p.stock < 30).length;
  brand.outOfStock = list.filter((p) => p.stock === 0).length;
  brand.revenue = revenue;
  brand.share = Math.round((revenue / brandRevenueTotal) * 1000) / 10;
  brand.ratingScore = Math.round((brand.rating / brandRatingPeak) * 100);
  brand.growth = brandFloat(-6, 34, 1);
  brand.featured = brand.tier === 'برتر' || (brand.rating >= 4.6 && brand.products >= 4);
  brand.categories = [...new Set(list.map((p) => p.category))];
  brand.status = list.length && brand.status !== 'inactive' ? 'active' : brand.status;
});

/* — tags — */
const TAG_META = {
  'پرفروش': { slug: 'bestseller', kind: 'auto', color: 'success', description: 'به‌صورت خودکار به کالاهایی با بیش از ۲۰۰ فروش در ۳۰ روز گذشته می‌چسبد.' },
  'جدید': { slug: 'new', kind: 'auto', color: 'info', description: 'هر محصول تازه‌منتشرشده تا ۳۰ روز پس از انتشار این برچسب را می‌گیرد.' },
  'پیشنهاد ویژه': { slug: 'featured', kind: 'manual', color: 'warning', description: 'انتخاب دستی تیم بازاریابی برای ویترین صفحه اصلی و ارسال پیامک.' },
  'گارانتی': { slug: 'warranty', kind: 'auto', color: 'primary', description: 'محصولات دارای گارانتی رسمی شرکتی با پشتیبانی سراسری ۱۸ ماهه.' },
  'ارسال رایگان': { slug: 'free-shipping', kind: 'auto', color: 'success', description: 'کالاهای مشمول ارسال رایگان برای سفارش‌های بالای ۲۰ میلیون ریال.' },
  'اورجینال': { slug: 'original', kind: 'auto', color: 'violet', description: 'اصالت کالا تأییدشده؛ موجود در همه انبارهای رسمی سازمان.' },
  'زمستانه': { slug: 'winter', kind: 'manual', color: 'info', description: 'کمپین فصلی زمستان — تخفیف‌های ویژه دسامبر تا اسفند.' },
  'تابستانه': { slug: 'summer', kind: 'manual', color: 'warning', description: 'کمپین فصلی تابستان با تمرکز روی تجهیزات سرمایشی و سفر.' },
  'دست‌ساز': { slug: 'handmade', kind: 'manual', color: 'danger', description: 'محصولات کارگاه‌های کوچک با تولید محدود و کیفیت ساخت بالا.' },
  'محدود': { slug: 'limited', kind: 'manual', color: 'neutral', description: 'موجودی کمتر از ۱۰ عدد در کل شبکه انبارها؛ نمایش شمارنده فروش.' },
};

const tagUsage = new Map(TAG_NAMES.map((name) => [name, 0]));
products.forEach((product) => product.tags.forEach((tag) => tagUsage.set(tag, (tagUsage.get(tag) ?? 0) + 1)));

const tagPeak = Math.max(...tagUsage.values(), 1);
tags.forEach((tag, index) => {
  const meta = TAG_META[tag.name] ?? {};
  const list = products.filter((product) => product.tags.includes(tag.name));
  tag.color = meta.color ?? tag.color;
  tag.kind = meta.kind ?? 'manual';
  tag.description = meta.description ?? '';
  tag.slug = meta.slug ?? slugify(tag.name) ?? tag.id;
  tag.products = list.length;
  tag.usageShare = Math.round((list.length / Math.max(1, products.length)) * 1000) / 10;
  tag.popularity = Math.round((list.length / tagPeak) * 100);
  tag.views = list.reduce((sum, p) => sum + p.views, 0);
  tag.conversion = brandFloat(1.4, 8.6, 1);
  tag.revenue = list.reduce((sum, p) => sum + p.sold * p.finalPrice, 0);
  tag.growth = brandFloat(-8, 42, 1);
  // Out-of-season and retired tags stay visible for reporting but are hidden
  // from the storefront suggestion list.
  tag.status = ['زمستانه', 'دست‌ساز'].includes(tag.name) ? 'archived' : 'active';
  tag.featured = ['پرفروش', 'پیشنهاد ویژه', 'اورجینال'].includes(tag.name);
  tag.createdAt = date(120 + index * 26, 9, 15);
});

export default {
  products,
  categories,
  brands,
  TAG_NAMES,
  tags,
  orders,
  orderStats,
  inventory,
  reviews,
  coupons,
  topProducts,
  salesByCategory,
  ORDER_STATUSES,
  PAYMENT_METHODS,
};
