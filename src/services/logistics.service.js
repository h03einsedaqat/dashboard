/**
 * NOVAADMIN — Logistics services (shipments, drivers, warehouses, routes, tracking)
 */
import { createResourceService } from './resource.js';
import { call } from './client.js';
import { shipments, drivers, warehouses, routes, logisticsKpis, deliverySeries, mapMarkers, SHIPMENT_STATUSES, carriers } from '../data/logistics.js';

export const shipmentService = createResourceService({
  name: 'shipments',
  collection: () => shipments,
  idPrefix: 'sh',
  searchFields: ['tracking', 'order', 'customer', 'destination', 'carrier', 'driver'],
  sortFields: ['shippedAt', 'eta', 'cost', 'progress'],
  extend: (result) => ({
    summary: {
      ...logisticsKpis,
      total: shipments.length,
      inTransit: shipments.filter((s) => s.status === 'in-transit').length,
      delivered: shipments.filter((s) => s.status === 'delivered').length,
      returned: shipments.filter((s) => s.status === 'returned').length,
      statuses: SHIPMENT_STATUSES,
      carriers,
      totalCount: result.total,
    },
  }),
});

export const shipmentActions = {
  async advance(id) {
    const order = SHIPMENT_STATUSES.map((s) => s.id);
    const row = shipments.find((s) => s.id === id);
    const next = order[Math.min(order.indexOf(row?.status) + 1, order.length - 1)];
    return call('patch', `shipments/${id}`, { resolver: () => ({ id, status: next, statusLabel: SHIPMENT_STATUSES.find((s) => s.id === next)?.label, updatedAt: new Date().toISOString() }) });
  },
  async assignDriver(id, driver) {
    return call('patch', `shipments/${id}/driver`, { resolver: () => ({ id, driver: driver.name, driverAvatar: driver.avatar }) });
  },
  async setEta(id, eta) {
    return call('patch', `shipments/${id}/eta`, { resolver: () => ({ id, eta }) });
  },
  async cancel(id) {
    return call('patch', `shipments/${id}`, { resolver: () => ({ id, status: 'returned', statusLabel: 'مرجوع شده' }) });
  },
  async track(tracking) {
    return call('get', `shipments/track/${tracking}`, {
      resolver: () => {
        const row = shipments.find((s) => s.tracking === tracking) ?? shipments[0];
        return { ...row, timeline: row.events };
      },
    });
  },
};

export const driverService = createResourceService({
  name: 'drivers',
  collection: () => drivers,
  idPrefix: 'dr',
  searchFields: ['name', 'vehicle', 'plate', 'currentCity', 'zone'],
  sortFields: ['name', 'deliveries', 'rating', 'onTimeRate'],
  extend: (result) => ({
    summary: {
      total: drivers.length,
      available: drivers.filter((d) => d.status === 'available').length,
      onRoute: drivers.filter((d) => d.status === 'on-route').length,
      offDuty: drivers.filter((d) => d.status === 'off-duty').length,
      avgRating: Number((drivers.reduce((s, d) => s + d.rating, 0) / drivers.length).toFixed(2)),
      totalCount: result.total,
    },
  }),
});

export const warehouseService = createResourceService({
  name: 'warehouses',
  collection: () => warehouses,
  idPrefix: 'wh',
  searchFields: ['name', 'city', 'status'],
  sortFields: ['used', 'capacity', 'shipments'],
  extend: (result) => ({
    summary: {
      total: warehouses.length,
      capacity: warehouses.reduce((s, w) => s + w.capacity, 0),
      used: warehouses.reduce((s, w) => s + w.used, 0),
      utilisation: Math.round((warehouses.reduce((s, w) => s + w.used, 0) / warehouses.reduce((s, w) => s + w.capacity, 0)) * 100),
      nearCapacity: warehouses.filter((w) => w.status === 'near-capacity').length,
      totalCount: result.total,
    },
  }),
});

export const routeService = {
  async list() {
    return call('list', 'routes', {
      resolver: () => ({
        rows: routes,
        summary: {
          total: routes.length,
          active: routes.filter((r) => r.status === 'active').length,
          distance: routes.reduce((s, r) => s + r.distance, 0),
          cost: routes.reduce((s, r) => s + r.cost, 0),
        },
      }),
    });
  },
  async optimise() {
    return call('post', 'routes/optimise', {
      resolver: () => ({
        saved: `${Math.round(8 + Math.random() * 14)}٪`,
        distance: Math.round(240 + Math.random() * 400),
        cost: Math.round(12_000_000 + Math.random() * 18_000_000),
        at: new Date().toISOString(),
      }),
      latency: [700, 1600],
    });
  },
};

export const trackingService = {
  async map() {
    return call('list', 'logistics/map', {
      resolver: () => ({
        markers: mapMarkers,
        active: shipments.filter((s) => ['in-transit', 'out-for-delivery'].includes(s.status)).length,
      }),
    });
  },
  async performance() {
    return call('list', 'logistics/performance', {
      resolver: () => ({
        series: deliverySeries,
        onTime: logisticsKpis.onTimeRate,
        avgTime: logisticsKpis.avgDeliveryTime,
        utilisation: logisticsKpis.fleetUtilization,
        costPerKm: logisticsKpis.costPerKm,
      }),
    });
  },
};

export default { shipmentService, shipmentActions, driverService, warehouseService, routeService, trackingService };
