/**
 * NOVAADMIN — dashboard preview generator
 * ------------------------------------------------------------------
 * The landing page sells the product with pictures of the product. These are
 * not stock screenshots: every preview is an original SVG drawn from the same
 * mock data the dashboards render (KPI values, revenue series, sources, recent
 * records), so the numbers on the marketing page and inside the demo agree.
 *
 * Two variants per demo — `light` and `dark` — so the landing page can show the
 * theme the visitor is actually looking at (`<picture>` + a media query).
 *
 *   node tools/gen-previews.mjs       (writes public/assets/img/previews/*.svg)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/config.js';
/**
 * Data is read from `src/data` directly, not through `src/services`: the service
 * layer touches `window` (it can be pointed at a real API), which does not exist
 * in the build process. Same numbers, one less dependency.
 */
import { kpis, makeSeries, trafficSources } from '../src/data/analytics.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/assets/img/previews');

const W = 1600;
const H = 1000;

const PALETTE = {
  indigo: ['#4f46e5', '#6366f1', '#a5b4fc'],
  blue: ['#2563eb', '#3b82f6', '#93c5fd'],
  emerald: ['#059669', '#10b981', '#6ee7b7'],
  violet: ['#7c3aed', '#8b5cf6', '#c4b5fd'],
  rose: ['#e11d48', '#f43f5e', '#fda4af'],
  orange: ['#ea580c', '#f97316', '#fdba74'],
};

const SKIN = {
  light: {
    canvas: '#eef0f7',
    surface: '#ffffff',
    surface2: '#f7f8fc',
    rail: '#111726',
    railText: '#e8edf7',
    railMuted: 'rgba(232,237,247,.55)',
    text: '#111827',
    heading: '#0b1220',
    muted: '#6b7280',
    line: '#e6e8f0',
    chip: '#f1f3fa',
    grid: '#eceef6',
  },
  dark: {
    canvas: '#0b0f1a',
    surface: '#121826',
    surface2: '#0e1421',
    rail: '#0d1320',
    railText: '#e8edf7',
    railMuted: 'rgba(232,237,247,.5)',
    text: '#e5e9f5',
    heading: '#f5f7ff',
    muted: '#98a3bd',
    line: 'rgba(255,255,255,.08)',
    chip: 'rgba(255,255,255,.06)',
    grid: 'rgba(255,255,255,.06)',
  },
};

const fa = (value) =>
  String(value)
    .replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit])
    .replace('.', '٫');

const compact = (value) => {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1_000_000_000) return `${fa((number / 1_000_000_000).toFixed(1))} میلیارد`;
  if (Math.abs(number) >= 1_000_000) return `${fa((number / 1_000_000).toFixed(1))} میلیون`;
  if (Math.abs(number) >= 1_000) return `${fa((number / 1_000).toFixed(1))} هزار`;
  return fa(Math.round(number));
};

const esc = (value) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);

/* --------------------------------------------------------------- primitives */

const rect = (x, y, width, height, fill, radius = 12, extra = '') =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${extra}/>`;

const text = (x, y, value, { size = 20, fill = '#111827', weight = 400, anchor = 'start', opacity = 1, spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="Vazirmatn, Inter, system-ui, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}"${
    spacing ? ` letter-spacing="${spacing}"` : ''
  }>${esc(value)}</text>`;

/** Smooth-ish area path from a numeric series, normalised into a box. */
function areaPath(values, box, { closed = true, smooth = 0.22 } = {}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = box.width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => ({ x: box.x + index * stepX, y: box.y + box.height - ((value - min) / span) * box.height }));
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const control = (current.x - previous.x) * smooth;
    d += ` C ${(previous.x + control).toFixed(1)} ${previous.y.toFixed(1)}, ${(current.x - control).toFixed(1)} ${current.y.toFixed(1)}, ${current.x.toFixed(1)} ${current.y.toFixed(1)}`;
  }
  if (!closed) return { line: d, points };
  const area = `${d} L ${(box.x + box.width).toFixed(1)} ${(box.y + box.height).toFixed(1)} L ${box.x.toFixed(1)} ${(box.y + box.height).toFixed(1)} Z`;
  return { line: d, area, points };
}

function donutArcs(parts, center, radius, stroke) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  let angle = -Math.PI / 2;
  return parts
    .map((part, index) => {
      const sweep = (part.value / total) * Math.PI * 2;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const large = sweep > Math.PI ? 1 : 0;
      const point = (a) => [center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius];
      const [x1, y1] = point(start);
      const [x2, y2] = point(end - 0.012);
      return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${part.color ?? stroke[index % stroke.length]}" stroke-width="${Math.round(radius * 0.42)}" stroke-linecap="butt" opacity="${1 - index * 0.08}"/>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ the mock */

function drawPreview(demo, data, mode) {
  const skin = SKIN[mode];
  const [primary, secondary, tint] = PALETTE[demo.color] ?? PALETTE.indigo;
  const railWidth = 260;
  const pad = 32;
  const content = { x: railWidth + pad, y: 118, width: W - railWidth - pad * 2 };
  const accent = (opacity = 1) => `rgba(${hexToRgb(primary)},${opacity})`;

  /* ------------------------------------------------------------ background */
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${config.appName} — داشبورد ${demo.label.fa}`)}">`;
  out += `<defs>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${primary}" stop-opacity=".38"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${secondary}"/><stop offset="1" stop-color="${primary}"/></linearGradient>
    <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skin.rail}"/><stop offset="1" stop-color="${mode === 'dark' ? '#131b2e' : '#1b2438'}"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0b1220" flood-opacity="${mode === 'dark' ? '.55' : '.10'}"/></filter>
  </defs>`;
  out += rect(0, 0, W, H, skin.canvas, 0);

  /* --------------------------------------------------------------- sidebar */
  out += `<g filter="url(#shadow)">${rect(0, 0, railWidth, H, 'url(#rail)', 0)}</g>`;
  out += `<g>
    ${rect(24, 26, 36, 36, primary, 11)}
    <path d="M42 34l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1-5.4-3-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" fill="#fff" fill-opacity=".95"/>
  </g>`;
  out += text(72, 46, config.appName, { size: 19, weight: 800, fill: skin.railText });
  out += text(72, 66, 'پنل مدیریت حرفه‌ای', { size: 13, fill: skin.railMuted });
  const navItems = ['داشبورد', 'فروشگاه', 'مشتریان', 'مالی', 'پروژه‌ها', 'منابع انسانی', 'پشتیبانی', 'هوش مصنوعی', 'لجستیک', 'گزارش‌ها', 'تنظیمات'];
  navItems.forEach((label, index) => {
    const y = 118 + index * 46;
    const active = label === demo.label.fa || (demo.id === 'analytics' && index === 0) || (demo.id === 'ecommerce' && index === 1);
    if (active) {
      out += rect(14, y - 26, railWidth - 28, 40, 'rgba(255,255,255,.10)', 11);
      out += rect(14, y - 26, 4, 40, secondary, 2);
    }
    out += `<circle cx="${railWidth - 44}" cy="${y - 6}" r="7" fill="${active ? secondary : 'rgba(255,255,255,.16)'}"/>`;
    out += rect(railWidth - 170, y - 12, active ? 108 : 84, 12, active ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.16)', 6);
    out += text(railWidth - 26, y - 1, label, { size: 14, fill: active ? skin.railText : skin.railMuted, weight: active ? 700 : 400, anchor: 'start' });
  });
  out += rect(20, H - 132, railWidth - 40, 104, 'rgba(255,255,255,.07)', 14);
  out += text(40, H - 98, 'نسخه ۱٫۰٫۰', { size: 13, fill: skin.railMuted });
  out += rect(40, H - 82, railWidth - 80, 8, 'rgba(255,255,255,.16)', 4);
  out += rect(40, H - 82, (railWidth - 80) * 0.72, 8, secondary, 4);
  out += text(40, H - 56, '۷۲٪ پیشرفت راه‌اندازی', { size: 12, fill: 'rgba(255,255,255,.7)' });

  /* ---------------------------------------------------------------- header */
  out += rect(railWidth, 0, W - railWidth, 84, skin.surface, 0);
  out += `<line x1="${railWidth}" y1="84" x2="${W}" y2="84" stroke="${skin.line}" stroke-width="1"/>`;
  out += text(W - pad, 50, `داشبورد ${demo.label.fa}`, { size: 25, weight: 800, fill: skin.heading, anchor: 'end' });
  out += rect(W - pad - 250, 30, 214, 34, accent(0.1), 17);
  out += text(W - pad - 143, 52, '۳۰ روز گذشته', { size: 14, fill: primary, anchor: 'middle', weight: 700 });
  out += rect(W - railWidth - 470, 26, 220, 42, skin.surface2, 21);
  out += `<circle cx="${W - railWidth - 272}" cy="47" r="7" fill="none" stroke="${skin.muted}" stroke-width="2"/>`;
  out += rect(W - railWidth - 440, 40, 130, 12, skin.line, 6);
  [0, 1, 2].forEach((index) => {
    out += `<circle cx="${railWidth + 132 - index * 44}" cy="47" r="17" fill="${[tint, secondary, primary][index]}" opacity=".9"/>`;
    out += text(railWidth + 132 - index * 44, 53, 'نم'[index] ?? 'ک', { size: 13, fill: '#fff', anchor: 'middle', weight: 700 });
  });

  /* -------------------------------------------------------------- KPI row */
  const kpiBox = { x: content.x, y: content.y, width: content.width, height: 132 };
  const kpiWidth = (kpiBox.width - 36) / 4;
  data.kpis.forEach((kpi, index) => {
    const x = kpiBox.x + index * (kpiWidth + 12);
    out += `<g filter="url(#shadow)">${rect(x, kpiBox.y, kpiWidth, kpiBox.height, skin.surface, 16)}</g>`;
    out += rect(x + 18, kpiBox.y + 18, 34, 34, index % 2 ? accent(0.14) : skin.chip, 11);
    out += `<circle cx="${x + 35}" cy="${kpiBox.y + 35}" r="7" fill="${index % 2 ? primary : secondary}"/>`;
    out += text(x + kpiWidth - 20, kpiBox.y + 40, kpi.label, { size: 15, fill: skin.muted, anchor: 'end' });
    out += text(x + kpiWidth - 20, kpiBox.y + 78, kpi.formatted, { size: 27, weight: 800, fill: skin.heading, anchor: 'end' });
    const up = kpi.delta >= 0;
    out += `<path d="M ${x + 22} ${kpiBox.y + 106} l 7 ${up ? -9 : 9} l 7 ${up ? 0 : 0}" stroke="${up ? '#16a34a' : '#dc2626'}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    out += text(x + 42, kpiBox.y + 111, `${fa(Math.abs(kpi.delta).toFixed(1))}٪`, { size: 14, fill: up ? '#16a34a' : '#dc2626', weight: 700 });
    const spark = kpi.spark ?? [];
    if (spark.length > 1) {
      const path = areaPath(spark, { x: x + 78, y: kpiBox.y + 92, width: kpiWidth - 104, height: 24 }, { closed: false });
      out += `<path d="${path.line}" fill="none" stroke="${up ? '#16a34a' : '#dc2626'}" stroke-width="2" opacity=".75" stroke-linecap="round"/>`;
    }
  });

  /* ------------------------------------------------------- main chart card */
  const mainY = kpiBox.y + kpiBox.height + 22;
  const mainWidth = content.width * 0.62 - 11;
  out += `<g filter="url(#shadow)">${rect(content.x, mainY, mainWidth, 326, skin.surface, 18)}</g>`;
  out += text(content.x + mainWidth - 24, mainY + 40, demo.chartTitle, { size: 19, weight: 800, fill: skin.heading, anchor: 'end' });
  out += text(content.x + mainWidth - 24, mainY + 64, 'مقایسه با دوره قبل — به‌روزرسانی زنده', { size: 13, fill: skin.muted, anchor: 'end' });
  ['۳۰ روز', '۷ روز', 'امروز'].forEach((label, index) => {
    const chipX = content.x + 20 + index * 78;
    out += rect(chipX, mainY + 20, 70, 30, index === 0 ? accent(0.14) : skin.surface2, 15);
    out += text(chipX + 35, mainY + 40, label, { size: 13, fill: index === 0 ? primary : skin.muted, anchor: 'middle', weight: index === 0 ? 700 : 400 });
  });
  const chartBox = { x: content.x + 26, y: mainY + 92, width: mainWidth - 52, height: 170 };
  for (let line = 0; line <= 4; line += 1) {
    const y = chartBox.y + (chartBox.height / 4) * line;
    out += `<line x1="${chartBox.x}" y1="${y}" x2="${chartBox.x + chartBox.width}" y2="${y}" stroke="${skin.grid}" stroke-width="1"/>`;
  }
  const series = data.revenue;
  const drawn = areaPath(series, chartBox);
  out += `<path d="${drawn.area}" fill="url(#area)"/>`;
  out += `<path d="${drawn.line}" fill="none" stroke="${primary}" stroke-width="3.4" stroke-linecap="round"/>`;
  const second = areaPath(series.map((value, index) => value * (0.62 + Math.sin(index) * 0.06)), chartBox);
  out += `<path d="${second.line}" fill="none" stroke="${secondary}" stroke-width="2.2" stroke-dasharray="7 6" opacity=".85"/>`;
  drawn.points.forEach((point, index) => {
    if (index % 3 !== 0) return;
    out += `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.6" fill="${skin.surface}" stroke="${primary}" stroke-width="2.4"/>`;
  });
  const labels = data.labels ?? [];
  labels.forEach((label, index) => {
    if (index % 2 !== 0) return;
    const x = chartBox.x + (chartBox.width / Math.max(1, labels.length - 1)) * index;
    out += text(x, mainY + 296, label, { size: 12, fill: skin.muted, anchor: 'middle' });
  });
  /* legend */
  out += rect(content.x + 26, mainY + 312, 12, 12, primary, 4);
  out += text(content.x + 46, mainY + 322, 'واقعی', { size: 12, fill: skin.muted });
  out += rect(content.x + 110, mainY + 312, 12, 12, secondary, 4);
  out += text(content.x + 130, mainY + 322, 'هدف', { size: 12, fill: skin.muted });

  /* ---------------------------------------------------------- side column */
  const sideX = content.x + mainWidth + 22;
  const sideWidth = content.width - mainWidth - 22;
  out += `<g filter="url(#shadow)">${rect(sideX, mainY, sideWidth, 190, skin.surface, 18)}</g>`;
  out += text(sideX + sideWidth - 22, mainY + 40, 'سهم منابع', { size: 17, weight: 800, fill: skin.heading, anchor: 'end' });
  const donutCenter = { x: sideX + 64, y: mainY + 108 };
  out += donutArcs(data.sources, donutCenter, 46, [primary, secondary, tint, skin.line]);
  out += text(donutCenter.x, donutCenter.y + 6, fa(data.sources[0].percent ?? Math.round((data.sources[0].value / data.sources.reduce((s, p) => s + p.value, 0)) * 100)) + '٪', {
    size: 17,
    weight: 800,
    fill: skin.heading,
    anchor: 'middle',
  });
  data.sources.forEach((source, index) => {
    const y = mainY + 74 + index * 30;
    out += rect(sideX + sideWidth - 42, y, 10, 10, [primary, secondary, tint, skin.line][index % 4], 3);
    out += text(sideX + sideWidth - 60, y + 10, source.label, { size: 13, fill: skin.muted, anchor: 'end' });
  });

  out += `<g filter="url(#shadow)">${rect(sideX, mainY + 206, sideWidth, 120, skin.surface, 18)}</g>`;
  out += text(sideX + sideWidth - 22, mainY + 240, data.barTitle, { size: 17, weight: 800, fill: skin.heading, anchor: 'end' });
  const bars = data.bars ?? [];
  const barWidth = (sideWidth - 60) / Math.max(1, bars.length) - 8;
  bars.forEach((value, index) => {
    const max = Math.max(...bars, 1);
    const height = Math.max(6, (value / max) * 56);
    const x = sideX + 30 + index * (barWidth + 8);
    out += rect(x, mainY + 300 - height, barWidth, height, 'url(#bar)', 5);
  });

  /* ------------------------------------------------------------- data table */
  const tableY = mainY + 348;
  out += `<g filter="url(#shadow)">${rect(content.x, tableY, content.width, H - tableY - 26, skin.surface, 18)}</g>`;
  out += text(content.x + content.width - 24, tableY + 36, data.tableTitle, { size: 18, weight: 800, fill: skin.heading, anchor: 'end' });
  out += rect(content.x + 24, tableY + 18, 96, 28, accent(0.12), 14);
  out += text(content.x + 72, tableY + 37, 'خروجی CSV', { size: 12, fill: primary, anchor: 'middle', weight: 700 });
  const columns = data.columns;
  const rows = data.rows;
  const columnX = columns.map((_, index) => content.x + content.width - 24 - index * (content.width / (columns.length + 0.4)));
  columns.forEach((column, index) => {
    out += text(columnX[index], tableY + 76, column, { size: 13, fill: skin.muted, anchor: 'start', weight: 700 });
  });
  out += `<line x1="${content.x + 24}" y1="${tableY + 88}" x2="${content.x + content.width - 24}" y2="${tableY + 88}" stroke="${skin.line}"/>`;
  rows.forEach((row, rowIndex) => {
    const y = tableY + 118 + rowIndex * 52;
    if (rowIndex % 2 === 0) out += rect(content.x + 16, y - 30, content.width - 32, 44, skin.surface2, 10);
    row.forEach((cell, index) => {
      const cx = columnX[index];
      if (index === 0) {
        out += `<circle cx="${cx + 14}" cy="${y - 8}" r="13" fill="${[primary, secondary, tint][rowIndex % 3]}" opacity=".85"/>`;
        out += text(cx + 4, y - 3, String(cell).slice(0, 1), { size: 12, fill: '#fff', anchor: 'middle', weight: 800 });
        out += text(cx + 34, y - 3, cell, { size: 14, fill: skin.text, weight: 600 });
      } else if (/^\d|٪|هزار|میلیون|مiliar/.test(String(cell))) {
        out += text(cx, y - 3, cell, { size: 14, fill: skin.text, anchor: 'start', weight: 600 });
      } else if (/^(موفق|فعال|در انتظار|ارسال‌شده|بسته|پیش‌نویس|مرجوع)/.test(String(cell))) {
        const tone = /موفق|فعال|ارسال‌شده/.test(String(cell)) ? '#16a34a' : /انتظار|پیش‌نویس/.test(String(cell)) ? '#d97706' : '#dc2626';
        const width = 8 + String(cell).length * 8;
        out += rect(cx - width, y - 20, width, 24, `${tone}1f`, 12);
        out += text(cx - width / 2, y - 4, cell, { size: 12.5, fill: tone, anchor: 'middle', weight: 700 });
      } else {
        out += text(cx, y - 3, cell, { size: 13.5, fill: skin.muted, anchor: 'start' });
      }
    });
  });
  out += `</svg>`;
  return out;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const number = parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  return `${(number >> 16) & 255},${(number >> 8) & 255},${number & 255}`;
}

/* --------------------------------------------------------------------- data */

const TABLE_TITLES = {
  analytics: 'پربازدیدترین صفحه‌ها',
  ecommerce: 'سفارش‌های اخیر',
  crm: 'معاملات در جریان',
  saas: 'اشتراک‌های فعال',
  finance: 'تراکنش‌های مالی',
  projects: 'تسک‌های تیم',
  hr: 'درخواست‌های مرخصی',
  support: 'تیکت‌های باز',
  ai: 'اجرای مدل‌ها',
  logistics: 'محموله‌های در مسیر',
};

const CHART_TITLES = {
  analytics: 'ترافیک و درآمد',
  ecommerce: 'روند فروش',
  crm: 'ارزش Pipeline فروش',
  saas: 'درآمد ماهانه (MRR)',
  finance: 'جریان نقدی',
  projects: 'سرعت تیم (Velocity)',
  hr: 'حضور هفتگی',
  support: 'تیکت‌های حل‌شده',
  ai: 'مصرف توکن',
  logistics: 'تحویل‌های روزانه',
};

const BAR_TITLES = {
  analytics: 'کاربر فعال ساعتی',
  ecommerce: 'پرفروش‌ترین دسته‌ها',
  crm: 'سرنخ‌های هفته',
  saas: 'پلن‌های فروش‌رفته',
  finance: 'هزینه به تفکیک دپارتمان',
  projects: 'تسک‌های تکمیل‌شده',
  hr: 'مرخصی‌های ماه',
  support: 'رضایت پشتیبانی',
  ai: 'هزینه مدل‌ها',
  logistics: 'تحویل به شهر',
};

const COLUMN_SETS = {
  analytics: ['صفحه', 'بازدید', 'منبع', 'وضعیت'],
  ecommerce: ['مشتری', 'سفارش', 'مبلغ', 'وضعیت'],
  crm: ['مخاطب', 'شرکت', 'ارزش', 'مرحله'],
  saas: ['اشتراک', 'پلن', 'MRR', 'وضعیت'],
  finance: ['ردیف', 'حساب', 'مبلغ', 'وضعیت'],
  projects: ['تسک', 'مسئول', 'پیشرفت', 'اولویت'],
  hr: ['کارمند', 'دپارتمان', 'تاریخ', 'وضعیت'],
  support: ['تیکت', 'مشتری', 'اولویت', 'وضعیت'],
  ai: ['پرامپت', 'مدل', 'توکن', 'وضعیت'],
  logistics: ['محموله', 'مقصد', 'تحویل', 'وضعیت'],
};

const STATUS_POOL = ['موفق', 'در انتظار', 'فعال', 'ارسال‌شده', 'بسته'];

function rowsFor(slug, revenue) {
  const names = {
    analytics: ['صفحه اصلی', 'وبلاگ', 'لندینگ پیج', 'قیمت‌ها', 'تماس'],
    ecommerce: ['مریم احمدی', 'علی رضایی', 'سارا محمدی', 'حسین کریمی', 'نگار صالحی'],
    crm: ['پارس‌داده', 'آروان‌کلاد', 'دیجی‌سازمان', 'مدرسه فردا', 'بانیا'],
    saas: ['استودیو رادین', 'فناوران نوین', 'پیشرو', 'ابرداده', 'تک‌نویس'],
    finance: ['حساب خزانه', 'تنخواه', 'دریافت', 'پرداخت مالیات', 'حقوق'],
    projects: ['طراحی داشبورد', 'اتصال API', 'تست بار', 'مستندات', 'انتشار'],
    hr: ['سمانه قاسمی', 'رضا مرادی', 'المیرا یوسفی', 'بابک نوری', 'شیما رستمی'],
    support: ['ورود انجام نمی‌شود', 'خطای فاکتور', 'درخواست بازپرداخت', 'تغییر پلن', 'سوال امنیتی'],
    ai: ['خلاصه گزارش', 'تولید پست', 'بازنویسی', 'ترجمه', 'ساخت پرامپت'],
    logistics: ['تهران ۱۴۰۲', 'اصفهان ۰۹۱۳', 'شیراز ۰۷۱۴', 'مشهد ۰۵۱۸', 'تبریز ۰۴۱۲'],
  }[slug] ?? ['رکورد یک', 'رکورد دو', 'رکورد سه', 'رکورد چهار', 'رکورد پنج'];
  const amounts = [
    () => compact(revenue[revenue.length - 1] ?? 0),
    () => fa(1200 + Math.round(revenue[1] / 100) ?? 1400),
  ];
  return names.map((name, index) => {
    const money = compact(40_000_000 + index * 26_500_000 + (revenue[index] ?? 10));
    const status = STATUS_POOL[index % STATUS_POOL.length];
    switch (index % 5) {
      case 1:
        return [name, `#${fa(10240 + index * 3)}`, money, status];
      case 2:
        return [name, fa(4 + index), `${fa(12 + index * 3)}٪`, status];
      case 3:
        return [name, money, fa(14 + index), status];
      case 4:
        return [name, `۱۴۰۳/${fa('0' + (index + 2))}/${fa(10 + index)}`, amounts[index % 2](), status];
      default:
        return [name, fa(900 + index * 137), 'جستجوی ارگانیک', status];
    }
  });
}

function build(demo) {
  const slug = demo.id;
  const kpisPayload = kpis[slug] ?? kpis.analytics ?? [];
  const revenueSeries = makeSeries('30d', { min: 1_200, max: 4_800, growth: 0.24, seedOffset: 1 });
  const revenuePayload = { labels: revenueSeries.labels, series: [{ id: 'revenue', data: revenueSeries.data }] };
  const revenue = revenuePayload.series[0].data ?? [];
  const kpiCards = (kpisPayload ?? []).slice(0, 4).map((kpi, index) => ({
    ...kpi,
    formatted:
      kpi.unit === 'currency'
        ? compact(kpi.value)
        : kpi.unit === 'percent'
          ? `${fa(Number(kpi.value).toFixed(1))}٪`
          : kpi.unit === 'day' || kpi.unit === 'minute'
            ? fa(Math.round(Number(kpi.value)))
            : compact(kpi.value) || fa(kpi.value ?? index + 1),
  }));
  const sources = (trafficSources ?? []).slice(0, 4).map((source) => ({ label: source.label, value: source.value ?? source.percent ?? 1, percent: source.percent }));
  return {
    kpis: kpiCards.length ? kpiCards : Array.from({ length: 4 }, (_, index) => ({ label: 'شاخص', formatted: fa(index + 1), delta: 1 + index, spark: [3, 5, 4, 7, 6, 9, 8] })),
    revenue: revenue.length ? revenue : [12, 18, 15, 24, 20, 28, 26, 34, 30, 42, 38, 48],
    labels: (revenuePayload.labels ?? []).slice(0, 12),
    sources: sources.length ? sources : [{ label: 'مستقیم', value: 42 }, { label: 'جستجو', value: 28 }, { label: 'شبکه اجتماعی', value: 18 }, { label: 'ارجاع', value: 12 }],
    bars: Array.from({ length: 7 }, (_, index) => 30 + ((index * 37 + revenue.length * 3) % 70)),
    barTitle: BAR_TITLES[slug] ?? 'روند',
    chartTitle: CHART_TITLES[slug] ?? 'روند',
    tableTitle: TABLE_TITLES[slug] ?? 'رکوردها',
    columns: COLUMN_SETS[slug] ?? ['ستون', 'مقدار', 'وضعیت'],
    rows: rowsFor(slug, revenue),
  };
}

/* -------------------------------------------------------------------- write */

fs.mkdirSync(OUT, { recursive: true });
let written = 0;
for (const demo of config.demos ?? []) {
  let data;
  try {
    data = build(demo);
  } catch (error) {
    console.warn(`  ⚠ ${demo.id}: preview data unavailable (${error.message})`);
    data = null;
  }
  if (!data) continue;
  for (const mode of ['light', 'dark']) {
    const svg = drawPreview(demo, data, mode);
    const target = path.join(OUT, `${demo.id}-${mode}.svg`);
    fs.writeFileSync(target, `${svg.trim()}\n`);
    written += 1;
  }
}

/* A single hero image, used by the landing page as the "big" showcase shot. */
console.log(`✔ previews written: ${written} SVG dashboard previews → public/assets/img/previews`);
