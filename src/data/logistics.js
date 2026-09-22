/**
 * NOVAADMIN — Logistics demo data
 * (shipments, drivers, warehouses, live tracking, route status)
 */
import { makeHelpers, cities, firstNames, lastNames } from './rng.js';
import { orders } from './commerce.js';

const { int, float, pick, picks, bool, date } = makeHelpers(8008);

export const SHIPMENT_STATUSES = [
  { id: 'preparing', label: 'در حال آماده‌سازی', tone: 'neutral' },
  { id: 'in-transit', label: 'در مسیر', tone: 'info' },
  { id: 'out-for-delivery', label: 'خارج برای تحویل', tone: 'primary' },
  { id: 'delivered', label: 'تحویل شده', tone: 'success' },
  { id: 'delayed', label: 'تأخیر', tone: 'warning' },
  { id: 'returned', label: 'مرجوع شده', tone: 'danger' },
];

export const carriers = ['پست پیشتاز', 'تیپاکس', 'بارابان', 'چاپار', 'هماک' /* internal courier */, 'پیک اختصاصی'];

export const warehouses = [
  { id: 'wh-1', name: 'انبار مرکزی تهران', city: 'تهران', capacity: 12000, used: 8640, shipments: 128, staff: 34, temp: '۱۸°C', status: 'active' },
  { id: 'wh-2', name: 'انبار اصفهان', city: 'اصفهان', capacity: 8000, used: 5120, shipments: 76, staff: 21, temp: '۱۹°C', status: 'active' },
  { id: 'wh-3', name: 'انبار مشهد', city: 'مشهد', capacity: 6000, used: 4890, shipments: 64, staff: 18, temp: '۲۰°C', status: 'near-capacity' },
  { id: 'wh-4', name: 'انبار شیراز', city: 'شیراز', capacity: 4500, used: 1980, shipments: 42, staff: 12, temp: '۲۱°C', status: 'active' },
  { id: 'wh-5', name: 'انبار بندرعباس', city: 'بندرعباس', capacity: 7000, used: 2310, shipments: 28, staff: 9, temp: '۲۴°C', status: 'maintenance' },
];

export const drivers = Array.from({ length: 16 }).map((_, i) => ({
  id: `dr-${i + 1}`,
  name: `${firstNames[(i * 3) % firstNames.length]} ${lastNames[(i * 5) % lastNames.length]}`,
  avatar: `assets/img/avatars/avatar-${String((i % 24) + 1).padStart(2, '0')}.svg`,
  phone: `+98 91${int(10, 39)} ${int(100, 999)} ${int(1000, 9999)}`,
  vehicle: pick(['ون کامیونت ایسوزو', 'کامیونت خاور', 'پیک ون', 'موتور باربری', 'کشنده تریلی']),
  plate: `${int(11, 99)} ${pick(['الف', 'ب', 'ج', 'د'])} ${int(100, 999)} ایران ${int(10, 99)}`,
  status: pick(['available', 'on-route', 'on-route', 'on-break', 'off-duty']),
  rating: float(3.6, 5, 1),
  deliveries: int(40, 680),
  currentCity: pick(cities),
  zone: pick(['شمال تهران', 'مرکز', 'غرب', 'شرق', 'جنوب', 'بین‌شهری']),
  onTimeRate: float(82, 99.8, 1),
}));

export const shipments = Array.from({ length: 40 }).map((_, i) => {
  const status = pick(SHIPMENT_STATUSES);
  const origin = pick(warehouses);
  const destination = pick(cities);
  const driver = drivers[i % drivers.length];
  const n = 78000 + i;
  return {
    id: `sh-${n}`,
    tracking: `NVX-${int(100000, 999999)}`,
    order: orders[i % orders.length].number,
    customer: orders[i % orders.length].customer,
    origin: origin.name,
    destination,
    carrier: pick(carriers),
    driver: driver.name,
    driverAvatar: driver.avatar,
    status: status.id,
    statusLabel: status.label,
    tone: status.tone,
    weight: `${int(1, 260)} کیلوگرم`,
    packages: int(1, 42),
    cost: int(2, 180) * 100_000,
    distance: `${int(12, 1180)} کیلومتر`,
    eta: date(-int(0, 6), int(9, 20)),
    shippedAt: date(int(0, 24), int(8, 18)),
    progress: status.id === 'delivered' ? 100 : status.id === 'returned' ? 40 : int(10, 92),
    events: [
      { label: 'ثبت بارنامه', at: date(int(2, 12), 8, 30), done: true },
      { label: 'خروج از انبار', at: date(int(1, 10), 11, 15), done: true },
      { label: 'در مرکز سورتینگ', at: date(int(1, 8), 19, 40), done: status.id !== 'preparing' },
      { label: 'در مسیر مقصد', at: date(int(0, 6), 6, 20), done: ['in-transit', 'out-for-delivery', 'delivered', 'delayed'].includes(status.id) },
      { label: 'تحویل به مشتری', at: date(int(0, 2), 16, 5), done: status.id === 'delivered' },
    ],
  };
});

export const routes = [
  { id: 'r-1', name: 'تهران → اصفهان', distance: 448, duration: '۵:۱۰', shipments: 12, cost: 18_400_000, status: 'active' },
  { id: 'r-2', name: 'تهران → مشهد', distance: 895, duration: '۹:۴۰', shipments: 8, cost: 32_600_000, status: 'active' },
  { id: 'r-3', name: 'تهران → تبریز', distance: 628, duration: '۷:۲۰', shipments: 6, cost: 24_100_000, status: 'planned' },
  { id: 'r-4', name: 'اصفهان → شیراز', distance: 486, duration: '۵:۳۰', shipments: 9, cost: 19_800_000, status: 'active' },
  { id: 'r-5', name: 'مشهد → بندرعباس', distance: 1420, duration: '۱۶:۰۰', shipments: 4, cost: 58_200_000, status: 'delayed' },
];

export const logisticsKpis = {
  activeShipments: shipments.filter((s) => ['in-transit', 'out-for-delivery'].includes(s.status)).length,
  deliveredToday: int(48, 120),
  delayed: shipments.filter((s) => s.status === 'delayed').length,
  onTimeRate: 94.6,
  avgDeliveryTime: '۲.۴ روز',
  fleetUtilization: 78.4,
  costPerKm: 42_800,
};

export const deliverySeries = Array.from({ length: 14 }).map((_, i) => ({
  day: i,
  delivered: int(40, 140),
  delayed: int(2, 26),
  returned: int(1, 12),
  distance: int(1200, 6400),
}));

export const mapMarkers = [
  { id: 'mm-1', label: 'تهران', lat: 35.6892, lng: 51.389, value: 128, tone: 'primary' },
  { id: 'mm-2', label: 'اصفهان', lat: 32.6546, lng: 51.668, value: 76, tone: 'info' },
  { id: 'mm-3', label: 'مشهد', lat: 36.2605, lng: 59.6168, value: 64, tone: 'success' },
  { id: 'mm-4', label: 'شیراز', lat: 29.5918, lng: 52.5837, value: 42, tone: 'warning' },
  { id: 'mm-5', label: 'تبریز', lat: 38.0962, lng: 46.2738, value: 38, tone: 'primary' },
  { id: 'mm-6', label: 'بندرعباس', lat: 27.1865, lng: 56.2808, value: 28, tone: 'danger' },
];

export default { shipments, drivers, warehouses, routes, logisticsKpis, deliverySeries, mapMarkers, SHIPMENT_STATUSES, carriers };
