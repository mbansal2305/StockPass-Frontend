/**
 * Orders API Service
 * Handles integration with:
 * - POST /orders/add/   -> Add order (OrderCreateSchema)
 * - PATCH /orders/upd/  -> Update order (OrderUpdateSchema)
 * - PATCH /orders/status/upd/ -> Update order status (OrderStatusUpdateSchema)
 * - GET /orders/get/    -> Get order (OrderGetDeleteSchema)
 * - DELETE /orders/del/ -> Delete order (OrderGetDeleteSchema)
 * - POST /orders/lst/   -> List orders (OrderListSchema)
 * - POST /orders/sel/   -> Select orders (OrderSelectSchema)
 */

import { apiClient } from './client';
import { roundToTwoDecimals } from '../utils/numbers';
import {
  Order,
  OrderTransport,
  OrderType,
  OrderStatus,
  QuantityUnit,
  OrderCreateSchema,
  OrderUpdateSchema,
  OrderGetDeleteSchema,
  OrderListSchema,
  OrderSelectSchema,
  BackendOrderType,
  BackendOrderStatus
} from '../types';

export interface PaginatedOrdersResult {
  results: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OrderStatusUpdateSchema {
  id: number;
  status: 'completed' | 'pending';
}

export interface OrderClientOption {
  id: string;
  name: string;
  city?: string;
  type?: string;
}

export interface OrderClientOptions {
  fromClient: OrderClientOption[];
  toClient: OrderClientOption[];
}

function normalizeOrderClientOptions(value: any): OrderClientOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((client: any) => {
    if (!client || typeof client !== 'object') return [];
    const id = client.id ?? client.pk ?? client._id ?? client.value;
    const name = client.name ?? client.label ?? client.client_name;
    if (id === undefined || id === null || !name) return [];

    return [{
      id: String(id),
      name: String(name),
      city: client.city ? String(client.city) : undefined,
      type: client.type || client.client_type ? String(client.type || client.client_type) : undefined
    }];
  });
}

/**
 * Transforms any backend order record format to the frontend Order format
 */
export function transformBackendOrderToFrontend(raw: any): Order {
  if (!raw) {
    return {
      id: `ord-${Date.now()}`,
      type: 'SALES ORDER',
      orderNumber: '',
      fromClientId: '',
      toClientId: '',
      commodityId: '',
      rate: 0,
      quantity: 0,
      unit: 'quintal',
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date().toISOString().split('T')[0],
      quantityFulfilled: 0,
      brokerId: '',
      status: 'DRAFT',
      createdAt: new Date().toISOString().split('T')[0]
    };
  }

  // ID parsing
  const id = String(raw.id || raw.order_id || raw.pk || `ord-${Date.now()}`);

  // Type normalization
  let type: OrderType = 'SALES ORDER';
  const rawType = String(raw.type || '').toLowerCase();
  if (rawType.includes('purchase')) {
    type = 'PURCHASE ORDER';
  } else if (rawType.includes('sales')) {
    type = 'SALES ORDER';
  }

  // Order Number
  const orderNumber = String(raw.order_no || raw.order_number || raw.orderNumber || raw.orderNo || `ORD-${id}`);

  // Relations: support either integer IDs, strings, or nested objects
  const getRelationId = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return String(val.id || val.pk || val._id || '');
    return String(val);
  };

  const fromClientId = getRelationId(raw.from_client_id ?? raw.fromClientId ?? raw.from_client);
  const toClientId = getRelationId(raw.to_client_id ?? raw.toClientId ?? raw.to_client);
  const commodityId = getRelationId(raw.commodity_id ?? raw.commodityId ?? raw.commodity);
  const brokerId = getRelationId(raw.broker_id ?? raw.brokerId ?? raw.broker);
  const orderTransports: OrderTransport[] | undefined = Array.isArray(raw.order_transports)
    ? raw.order_transports.map((transport: any) => {
      const rawGrossWeightUnit = String(transport.gross_wt_unit || 'mt').toLowerCase();
      const grossWeightUnit: QuantityUnit = rawGrossWeightUnit === 'kg' || rawGrossWeightUnit === 'kilogram'
        ? 'kg'
        : rawGrossWeightUnit === 'quintal' || rawGrossWeightUnit === 'qtl'
        ? 'quintal'
        : 'mt';
      return {
        id: String(transport.id),
        billNumber: String(transport.bill_no || ''),
        billingFirmName: transport.billing_firm ? String(transport.billing_firm) : undefined,
        loadingDate: transport.loading_date ?? null,
        unloadDate: transport.unload_date ?? null,
        vehicleNumber: String(transport.vehicle_no || ''),
        transporterName: String(transport.transporter || ''),
        grossWeightUnit,
        grossWeight: Number(transport.quantity) || 0,
        orderEntryQuantity: Number(transport.order_entry) || 0,
        status: String(transport.status || '')
      };
    })
    : undefined;

  // Quantities & Rates
  const rate = Number(raw.rate) || 0;
  const quantity = Number(raw.quantity) || 0;
  const quantityFulfilled = Number(raw.quantity_fulfilled ?? raw.quantityFulfilled ?? 0);

  // Unit
  const rawUnit = String(raw.quantity_unit || raw.unit || 'quintal').toLowerCase();
  let unit: QuantityUnit = 'quintal';
  if (rawUnit === 'mt' || rawUnit === 'metric_ton') unit = 'mt';
  else if (rawUnit === 'kg' || rawUnit === 'kilogram') unit = 'kg';

  // Dates
  const startDate = String(raw.start_date || raw.startDate || raw.contract_date || raw.contractDate || new Date().toISOString().split('T')[0]);
  const contractDate = String(raw.contract_date || raw.contractDate || startDate);
  const expiryDate = String(raw.expiry_date || raw.expiryDate || startDate);

  // Status
  const rawStatus = String(raw.status || '').toLowerCase();
  let status: OrderStatus = 'DRAFT';
  if (rawStatus === 'completed') status = 'COMPLETED';
  else if (rawStatus === 'pending') status = 'PENDING';
  else if (rawStatus === 'draft') status = 'DRAFT';
  else {
    status = quantityFulfilled >= quantity && quantity > 0 ? 'COMPLETED' : 'PENDING';
  }

  const notes = raw.notes || '';
  const createdAt = String(raw.created_at || raw.createdAt || raw.contract_date || startDate);
  const updatedAt = raw.updated_at || raw.updatedAt ? String(raw.updated_at || raw.updatedAt) : undefined;

  return {
    id,
    type,
    orderNumber,
    fromClientId,
    fromClientName: typeof raw.from_client === 'string' ? raw.from_client : raw.from_client_name,
    toClientId,
    toClientName: typeof raw.to_client === 'string' ? raw.to_client : raw.to_client_name,
    commodityId,
    commodityName: typeof raw.commodity === 'string' ? raw.commodity : raw.commodityName,
    commodityType: raw.commodity_type ? String(raw.commodity_type) : raw.commodityType,
    brokerName: typeof raw.broker === 'string' ? raw.broker : raw.broker_name,
    orderTransports,
    rate,
    quantity,
    unit,
    contractDate,
    startDate,
    expiryDate,
    quantityFulfilled,
    brokerId,
    status,
    notes,
    createdAt,
    updatedAt
  };
}

/**
 * Converts frontend Order data into backend OrderCreateSchema
 */
export function toBackendCreateSchema(order: Partial<Order>): OrderCreateSchema {
  const isPurchase = order.type === 'PURCHASE ORDER' || String(order.type).toLowerCase().includes('purchase');
  const type: BackendOrderType = isPurchase ? 'purchase_order' : 'sales_order';

  const parseNumId = (val: any): number | null => {
    if (!val) return null;
    const digits = String(val).replace(/\D/g, '');
    const parsed = parseInt(digits, 10);
    return isNaN(parsed) ? null : parsed;
  };

  const statusMap: Record<string, BackendOrderStatus> = {
    'COMPLETED': 'completed',
    'PENDING': 'pending',
    'DRAFT': 'draft'
  };
  const status: BackendOrderStatus = (order.status ? statusMap[order.status] : 'draft') || 'draft';

  return {
    type,
    order_no: order.orderNumber ? order.orderNumber.trim() : null,
    from_client: parseNumId(order.fromClientId),
    to_client: parseNumId(order.toClientId),
    commodity: parseNumId(order.commodityId) || 1,
    rate: order.rate !== undefined ? roundToTwoDecimals(Number(order.rate)) : 0,
    quantity: order.quantity !== undefined ? roundToTwoDecimals(Number(order.quantity)) : 0,
    quantity_unit: order.unit || 'quintal',
    start_date: order.startDate || null,
    expiry_date: order.expiryDate || null,
    contract_date: order.contractDate || order.startDate || null,
    quantity_fulfilled: order.quantityFulfilled !== undefined ? roundToTwoDecimals(Number(order.quantityFulfilled)) : 0,
    broker: parseNumId(order.brokerId),
    status,
    notes: order.notes ? order.notes.trim() : null
  };
}

/**
 * Converts frontend Order data into backend OrderUpdateSchema
 */
export function toBackendUpdateSchema(id: number | string, order: Partial<Order>): OrderUpdateSchema {
  const numericId = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, ''), 10) || Number(id);

  const parseNumId = (val: any): number | null => {
    if (!val) return null;
    const digits = String(val).replace(/\D/g, '');
    const parsed = parseInt(digits, 10);
    return isNaN(parsed) ? null : parsed;
  };

  const statusMap: Record<string, BackendOrderStatus> = {
    'COMPLETED': 'completed',
    'PENDING': 'pending',
    'DRAFT': 'draft'
  };

  const payload: OrderUpdateSchema = {
    id: numericId
  };

  if (order.type) {
    payload.type = (order.type === 'PURCHASE ORDER' || String(order.type).toLowerCase().includes('purchase'))
      ? 'purchase_order'
      : 'sales_order';
  }
  if (order.orderNumber !== undefined) payload.order_no = order.orderNumber;
  if (order.fromClientId !== undefined) payload.from_client = parseNumId(order.fromClientId);
  if (order.toClientId !== undefined) payload.to_client = parseNumId(order.toClientId);
  if (order.commodityId !== undefined) payload.commodity = parseNumId(order.commodityId) || 1;
  if (order.rate !== undefined) payload.rate = roundToTwoDecimals(Number(order.rate));
  if (order.quantity !== undefined) payload.quantity = roundToTwoDecimals(Number(order.quantity));
  if (order.unit !== undefined) payload.quantity_unit = order.unit;
  if (order.startDate !== undefined) payload.start_date = order.startDate;
  if (order.expiryDate !== undefined) payload.expiry_date = order.expiryDate;
  if (order.contractDate !== undefined) payload.contract_date = order.contractDate;
  if (order.quantityFulfilled !== undefined) payload.quantity_fulfilled = roundToTwoDecimals(Number(order.quantityFulfilled));
  if (order.brokerId !== undefined) payload.broker = parseNumId(order.brokerId);
  if (order.status) payload.status = statusMap[order.status] || 'pending';
  if (order.notes !== undefined) payload.notes = order.notes;

  return payload;
}

function parsePaginatedOrderResponse(res: any): PaginatedOrdersResult {
  if (!res) {
    return { results: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
  }

  // Format 1: { success: true, data: { page, page_size, total, total_pages, results: [...] } }
  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    const d = res.data;
    const rawList: any[] = Array.isArray(d.results)
      ? d.results
      : Array.isArray(d.items)
      ? d.items
      : Array.isArray(d.data)
      ? d.data
      : [];
    const results = rawList.map(transformBackendOrderToFrontend);

    return {
      results,
      total: typeof d.total === 'number' ? d.total : results.length,
      page: typeof d.page === 'number' ? d.page : 1,
      pageSize: typeof d.page_size === 'number' ? d.page_size : (results.length || 10),
      totalPages: typeof d.total_pages === 'number' ? d.total_pages : Math.ceil((d.total || results.length) / (d.page_size || 10)) || 1
    };
  }

  // Format 2: Direct results array in data: { success: true, data: [...] }
  if (Array.isArray(res.data)) {
    const results = res.data.map(transformBackendOrderToFrontend);
    return {
      results,
      total: res.total || res.count || results.length,
      page: res.page || 1,
      pageSize: res.page_size || res.pageSize || 10,
      totalPages: res.total_pages || Math.ceil((res.total || results.length) / 10) || 1
    };
  }

  // Format 3: Root results array: { results: [...] }
  if (Array.isArray(res.results)) {
    const results = res.results.map(transformBackendOrderToFrontend);
    return {
      results,
      total: res.total || res.count || results.length,
      page: res.page || 1,
      pageSize: res.page_size || res.pageSize || 10,
      totalPages: res.total_pages || Math.ceil((res.total || results.length) / 10) || 1
    };
  }

  // Format 4: Bare array: [...]
  if (Array.isArray(res)) {
    const results = res.map(transformBackendOrderToFrontend);
    return {
      results,
      total: results.length,
      page: 1,
      pageSize: results.length || 10,
      totalPages: 1
    };
  }

  return { results: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
}

export const ordersApi = {
  async getPurchaseOrderNumber(): Promise<string> {
    const res = await apiClient.get<any>('/orders/ordernum/po/');
    const data = res?.data?.data ?? res?.data ?? res;
    const orderNumber = typeof data === 'string'
      ? data
      : data?.order_no ?? data?.order_number ?? data?.orderNumber ?? data?.number;

    if (typeof orderNumber !== 'string' || !orderNumber.trim()) {
      throw new Error('The API did not return a Purchase Order number');
    }

    return orderNumber.trim();
  },

  /**
   * Loads eligible route clients for a sales or purchase order.
   */
  async selectClients(type: OrderType): Promise<OrderClientOptions> {
    const endpoint = type === 'SALES ORDER'
      ? '/orders/so/clients/sel/'
      : '/orders/po/clients/sel/';

    let res: any;
    try {
      res = await apiClient.get<any>(endpoint);
    } catch (err: any) {
      if (err.status !== 405) throw err;
      
    }

    const data = res?.data && typeof res.data === 'object' ? res.data : res;
    return {
      fromClient: normalizeOrderClientOptions(data?.from_client),
      toClient: normalizeOrderClientOptions(data?.to_client)
    };
  },

  /**
   * POST /orders/add/
   * Adds a new order
   */
  async add(payload: OrderCreateSchema): Promise<Order> {
    const res = await apiClient.post<any>('/orders/add/', payload);
    const item = res?.data ?? res;
    return transformBackendOrderToFrontend(item);
  },

  /**
   * PATCH /orders/upd/
   * Updates an existing order. Falls back to POST /orders/upd/ if PATCH returns 405.
   */
  async update(payload: OrderUpdateSchema): Promise<Order> {
    try {
      const res = await apiClient.patch<any>('/orders/upd/', payload);
      const item = res?.data ?? res;
      return transformBackendOrderToFrontend(item);
    } catch (err: any) {
      if (err.status === 405) {
        const res = await apiClient.post<any>('/orders/upd/', payload);
        const item = res?.data ?? res;
        return transformBackendOrderToFrontend(item);
      }
      throw err;
    }
  },

  /**
   * PATCH /orders/status/upd/
   * Updates an existing order's status.
   */
  async updateStatus(payload: OrderStatusUpdateSchema): Promise<void> {
    try {
      await apiClient.patch<any>('/orders/status/upd/', payload);
    } catch (err: any) {
      if (err.status !== 405) throw err;
      await apiClient.post<any>('/orders/status/upd/', payload);
    }
  },

  /**
   * GET /orders/get/
   * Retrieves single order by ID.
   * Handles query param ?id=... and body fallback if needed.
   */
  async get(id: number | string): Promise<Order> {
    const numericId = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, ''), 10) || Number(id);

    try {
      // First attempt standard GET with query param: ?id=
      const res = await apiClient.get<any>(`/orders/get/?id=${encodeURIComponent(String(numericId))}`);
      const item = res?.data ?? res;
      return transformBackendOrderToFrontend(item);
    } catch (err: any) {
      // If 405 or 422 (body required by Django Ninja schema), attempt POST /orders/get/ or body fetch
      if (err.status === 405 || err.status === 422) {
        try {
          const res = await apiClient.post<any>('/orders/get/', { id: numericId });
          const item = res?.data ?? res;
          return transformBackendOrderToFrontend(item);
        } catch {
          // If still failing, rethrow initial error
        }
      }
      throw err;
    }
  },

  /**
   * DELETE /orders/del/
   * Deletes order by ID.
   * Handles DELETE method with body and query param, plus POST fallback.
   */
  async delete(id: number | string): Promise<{ success: boolean; id: number }> {
    const numericId = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, ''), 10) || Number(id);

    try {
      const res = await apiClient.delete<any>(`/orders/del/?id=${encodeURIComponent(String(numericId))}`, {
        body: JSON.stringify({ id: numericId }) as any
      });
      return res?.data ?? res ?? { success: true, id: numericId };
    } catch (err: any) {
      if (err.status === 405) {
        const res = await apiClient.post<any>('/orders/del/', { id: numericId });
        return res?.data ?? res ?? { success: true, id: numericId };
      }
      throw err;
    }
  },

  /**
   * POST /orders/lst/
   * Returns paginated list of orders matching filter criteria
   */
  async listPaginated(filter: OrderListSchema = {}): Promise<PaginatedOrdersResult> {
    const cleanFilter: Record<string, any> = {
      page: filter.page || 1,
      page_size: filter.page_size || 10
    };

    if (filter.status) cleanFilter.status = filter.status;
    if (filter.contract_date_from) cleanFilter.contract_date_from = filter.contract_date_from;
    if (filter.contract_date_to) cleanFilter.contract_date_to = filter.contract_date_to;
    if (filter.from_client) cleanFilter.from_client = filter.from_client;
    if (filter.to_client) cleanFilter.to_client = filter.to_client;
    if (filter.type) cleanFilter.type = filter.type;
    if (filter.broker) cleanFilter.broker = filter.broker;

    try {
      const res = await apiClient.post<any>('/orders/lst/', cleanFilter);
      return parsePaginatedOrderResponse(res);
    } catch (err: any) {
      if (err.status === 405) {
        // Fallback to GET /orders/lst/ with query params
        const q = new URLSearchParams();
        Object.entries(cleanFilter).forEach(([k, v]) => {
          if (v !== undefined && v !== null) q.append(k, String(v));
        });
        const res = await apiClient.get<any>(`/orders/lst/?${q.toString()}`);
        return parsePaginatedOrderResponse(res);
      }
      throw err;
    }
  },

  /**
   * POST /orders/lst/
   * List all orders (returns flat array)
   */
  async list(filter: OrderListSchema = {}): Promise<Order[]> {
    const paginated = await this.listPaginated(filter);
    return paginated.results;
  },

  /**
   * POST /orders/sel/
   * Select orders for dropdowns / modal selectors
   */
  async select(filter: OrderSelectSchema = {}): Promise<any[]> {
    const cleanFilter: Record<string, any> = {};
    if (filter.status) cleanFilter.status = filter.status;
    if (filter.from_client) cleanFilter.from_client = filter.from_client;
    if (filter.to_client) cleanFilter.to_client = filter.to_client;
    if (filter.type) cleanFilter.type = filter.type;

    try {
      const res = await apiClient.post<any>('/orders/sel/', cleanFilter);
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.results)) return res.results;
      if (Array.isArray(res)) return res;
      return [];
    } catch (err: any) {
      if (err.status === 405) {
        const q = new URLSearchParams();
        Object.entries(cleanFilter).forEach(([k, v]) => {
          if (v !== undefined && v !== null) q.append(k, String(v));
        });
        const res = await apiClient.get<any>(`/orders/sel/?${q.toString()}`);
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.results)) return res.results;
        if (Array.isArray(res)) return res;
      }
      throw err;
    }
  }
};
