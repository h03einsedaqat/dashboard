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

export const PAYMENT_METHODS = [
  { id: 'card', label: 'کارت بانکی', icon: 'credit-card' },
  { id: 'wallet', label: 'کیف پول', icon: 'wallet2' },
  { id: 'transfer', label: 'انتقال بانکی', icon: 'bank' },
  { id: 'cash', label: 'پرداخت در محل', icon: 'cash-coin' },
];

export const categories = categoryNames.map((name, i) => ({
  id: `cat-${i + 1}`,
  name,
  slug: name.replace(/\s+/g, '-'),
  icon: pick(['bag', 'headphones', 'laptop', 'router', 'printer', 'hdd', 'printer-fill', 'controller', 'phone', 'house-gear']),
  products: int(4, 38),
  parent: i > 5 ? pick(categoryNames.slice(0, 5)) : null,
  status: i === 7 ? 'inactive' : 'active',
  revenue: int(220, 4200) * 1000000,
}));

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
    createdAt: date(int(5, 700), int(9, 18)),
    description:
      'محصولی با کیفیت ساخت بالا، مناسب استفاده حرفه‌ای روزمره. دارای گارانتی رسمی ۱۸ ماهه و پشتیبانی فنی سراسر کشور. طراحی ارگونومیک و متریال مقاوم، عمر مفید دستگاه را افزایش می‌دهد.',
    shortDescription: 'کیفیت ساخت بالا، گارانتی ۱۸ ماهه و ارسال سریع به سراسر کشور.',
    tags: picks(['پرفروش', 'جدید', 'پیشنهاد ویژه', 'گارانتی', 'ارسال رایگان', 'اورجینال'], 3),
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

export const tags = ['پرفروش', 'جدید', 'پیشنهاد ویژه', 'گارانتی', 'ارسال رایگان', 'اورجینال', 'زمستانه', 'تابستانه', 'دست‌ساز', 'محدود'].map(
  (name, i) => ({ id: `tag-${i + 1}`, name, products: int(3, 42), color: pick(['primary', 'success', 'warning', 'info', 'violet']) }),
);

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
  }));
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

export default {
  products,
  categories,
  brands,
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
