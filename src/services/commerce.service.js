/**
 * NOVAADMIN — eCommerce services
 * (products, categories, brands, tags, inventory, reviews, coupons, orders)
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { products, categories, brands, tags, inventory, reviews, coupons, orders, orderStats, topProducts, salesByCategory, ORDER_STATUSES, PAYMENT_METHODS } from '../data/commerce.js';
import { customers } from '../data/people.js';

export const productService = createResourceService({
  name: 'products',
  collection: () => products,
  idPrefix: 'p',
  searchFields: ['name', 'sku', 'category', 'brand', 'warehouse'],
  sortFields: ['name', 'finalPrice', 'stock', 'sold', 'rating', 'createdAt'],
  extend: (result) => ({
    summary: {
      total: products.length,
      published: products.filter((p) => p.status === 'published').length,
      draft: products.filter((p) => p.status === 'draft').length,
      outOfStock: products.filter((p) => p.stock === 0).length,
      lowStock: products.filter((p) => p.stock > 0 && p.stock < 30).length,
      inventoryValue: products.reduce((sum, p) => sum + p.finalPrice * p.stock, 0),
      categories: categories.map((c) => c.name),
      brands: brands.map((b) => b.name),
      totalCount: result.total,
    },
  }),
});

export const categoryService = createResourceService({
  name: 'categories',
  collection: () => categories,
  idPrefix: 'cat',
  searchFields: ['name', 'parent'],
  sortFields: ['name', 'products', 'revenue'],
});

export const brandService = createResourceService({
  name: 'brands',
  collection: () => brands,
  idPrefix: 'brand',
  searchFields: ['name', 'country'],
  sortFields: ['name', 'products', 'rating'],
});

export const tagService = createResourceService({
  name: 'tags',
  collection: () => tags,
  idPrefix: 'tag',
  searchFields: ['name'],
  sortFields: ['name', 'products'],
});

export const inventoryService = createResourceService({
  name: 'inventory',
  collection: () => inventory,
  idPrefix: 'inv',
  searchFields: ['product', 'sku', 'warehouse'],
  sortFields: ['stock', 'product', 'updatedAt'],
  extend: (result) => ({
    summary: {
      skus: inventory.length,
      low: inventory.filter((i) => i.stock > 0 && i.stock <= i.reorderLevel).length,
      out: inventory.filter((i) => i.stock === 0).length,
      incoming: inventory.reduce((s, i) => s + i.incoming, 0),
      reserved: inventory.reduce((s, i) => s + i.reserved, 0),
      totalCount: result.total,
    },
  }),
});

export const reviewService = createResourceService({
  name: 'reviews',
  collection: () => reviews,
  idPrefix: 'rv',
  searchFields: ['product', 'author', 'title', 'text'],
  sortFields: ['at', 'rating', 'helpful'],
  extend: (result) => ({
    summary: {
      total: reviews.length,
      pending: reviews.filter((r) => r.status === 'pending').length,
      average: Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)),
      five: reviews.filter((r) => r.rating === 5).length,
      totalCount: result.total,
    },
  }),
});

export const couponService = createResourceService({
  name: 'coupons',
  collection: () => coupons,
  idPrefix: 'cp',
  searchFields: ['code', 'description'],
  sortFields: ['code', 'used', 'to'],
  extend: (result) => ({
    summary: {
      total: coupons.length,
      active: coupons.filter((c) => c.status === 'active').length,
      expired: coupons.filter((c) => c.status === 'expired').length,
      redemptions: coupons.reduce((s, c) => s + c.used, 0),
      totalCount: result.total,
    },
  }),
});

export const orderService = createResourceService({
  name: 'orders',
  collection: () => orders,
  idPrefix: 'o',
  searchFields: ['number', 'customer', 'company', 'email', 'trackingCode', 'city'],
  sortFields: ['placedAt', 'total', 'itemsCount', 'status'],
  extend: (result) => ({
    stats: orderStats,
    summary: {
      total: orders.length,
      revenue: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
      pending: orders.filter((o) => o.status === 'pending').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      averageOrder: Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length),
      totalCount: result.total,
      statuses: ORDER_STATUSES,
    },
  }),
});

export const orderActions = {
  async updateStatus(id, status) {
    const meta = ORDER_STATUSES.find((s) => s.id === status) ?? ORDER_STATUSES[0];
    return call('patch', `orders/${id}`, { resolver: () => ({ id, status: meta.id, statusLabel: meta.label, updatedAt: new Date().toISOString() }) });
  },
  async refund(id) {
    return call('post', `orders/${id}/refund`, { resolver: () => ({ id, status: 'refunded', statusLabel: 'مرجوع شده', refundedAt: new Date().toISOString() }) });
  },
  async ship(id, trackingCode) {
    return call('post', `orders/${id}/ship`, { resolver: () => ({ id, status: 'processing', trackingCode, shippedAt: new Date().toISOString() }) });
  },
  async remove(id) {
    return call('remove', `orders/${id}`, { resolver: () => ({ id, deleted: true }) });
  },
};

export const catalogService = {
  /** Snapshot used by dashboard widgets and report pages. */
  async overview() {
    return call('list', 'catalog/overview', {
      resolver: () => ({
        stats: {
          products: products.length,
          orders: orders.length,
          customers: customers.length,
          revenue: orders.reduce((s, o) => s + o.total, 0),
          conversion: 3.84,
          averageOrder: Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length),
          returns: orders.filter((o) => o.status === 'refunded').length,
          lowStock: products.filter((p) => p.stock < 30).length,
        },
        topProducts: topProducts.slice(0, 5),
        byCategory: salesByCategory,
        paymentMethods: PAYMENT_METHODS,
      }),
    });
  },
  async byStatus() {
    return call('list', 'catalog/status', { resolver: () => orderStats });
  },
};

export default { productService, categoryService, brandService, tagService, inventoryService, reviewService, couponService, orderService, orderActions, catalogService };
