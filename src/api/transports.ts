import { BusinessClient, Commodity, Order, QuantityUnit, Transport, TransportBankDetails, TransportItem, TransportRentType, TransportStatus, Transporter } from '../types';
import { apiClient } from './client';
import { transformBackendOrderToFrontend } from './orders';
import { roundToTwoDecimals } from '../utils/numbers';

export interface TransportLookups {
  clients?: BusinessClient[];
  commodities?: Commodity[];
  orders?: Order[];
  transporters?: Transporter[];
}

export interface TransportReceiptFiles {
  source?: File | null;
  destination?: File | null;
}

export interface TransportClientOption {
  id: string;
  name: string;
  city?: string;
  clientType?: string;
  image?: string | null;
  imageUrl?: string | null;
}

export interface TransportListFilters {
  transporter?: string;
  status?: TransportStatus;
  commodity?: string;
  billingFirm?: string;
  page?: number;
  pageSize?: number;
}

export interface TransportListPayload {
  transporter?: (number | null)[];
  status?: Lowercase<TransportStatus>;
  commodity?: number[];
  billing_firm?: number[];
  party?: number[];
  broker?: (number | null)[];
  loading_start_date?: string;
  loading_end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedTransportsResult {
  results: Transport[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TransportPaymentUpdate {
  id: string;
  status: TransportStatus;
  receivedWeight: number;
  unloadDate: string;
  rent: number;
  rentType: 'fix' | 'per_unit';
  advanceByClient: number;
  advanceByFirm: number;
  shortageAmount: number;
  extraAmount: number;
  finalPaid: number;
  notes: string;
}

type TransportWrite = Omit<Partial<Transport>, 'transporterId'>
  & { transporterId?: string | null }
  & Pick<Transport, 'billingFirmId' | 'commodityId'>;

export type BulkTransportEntry = Partial<Transport> & { id?: string };

export interface BulkTransportCreatePayload {
  title: string;
  loadingDate?: string;
  unloadingDate?: string;
  billNumber?: string;
  totalReceivedWeight?: number;
  orderEntry?: number;
  orderId?: string;
  billingFirmId?: string;
  transporterId?: string;
  toClientId?: string;
  commodityId?: string;
  status?: TransportStatus;
  transports: BulkTransportEntry[];
}

export interface BulkTransportUpdatePayload {
  id: string;
  title?: string;
  loadingDate?: string;
  unloadingDate?: string;
  billNumber?: string;
  totalReceivedWeight?: number;
  orderEntry?: number;
  orderId?: string;
  billingFirmId?: string;
  transporterId?: string;
  toClientId?: string;
  commodityId?: string;
  status?: TransportStatus;
  transports?: BulkTransportEntry[];
}

export interface BulkTransportDetail {
  id: string;
  title: string;
  createdBy?: string;
  createdAt?: string;
  loadingDate?: string;
  unloadingDate?: string;
  billNumber?: string;
  totalReceivedWeight?: number;
  orderEntry?: number;
  orderId?: string;
  order?: Order;
  billingFirmId?: string;
  transporterId?: string;
  toClientId?: string;
  commodityId?: string;
  status?: TransportStatus;
  selectedSources: string[];
  transports: Transport[];
}

export interface BulkTransportListItem {
  id: string;
  loadingDate?: string;
  unloadingDate?: string;
  title: string;
  commodity?: string;
  commodityType?: string;
  billNumber?: string;
  order?: string;
  billingFirm?: string;
  destination?: string;
  fromClientCount: number;
  grossWeight: number;
  grossWeightUnit?: string;
  totalBagCount: number;
  transporter?: string;
  receivedWeight?: number;
  status: string;
  wagonAssignmentStatus: string | null;
  vehicleCount: number;
}

export interface BulkTransportListPage {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  results: BulkTransportListItem[];
}

const inFlightBulkRequests = new Map<string, Promise<BulkTransportDetail>>();

const numericId = (value: string | number | undefined): string => {
  if (value === undefined || value === '') return '';
  const id = String(value).match(/\d+/)?.[0];
  return id || '';
};

const relationId = (value: any, entities: Array<{ id: string; name: string }> = []): string => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'object'
    ? String(value.id ?? value.pk ?? value._id ?? value.name ?? '')
    : String(value);
  const normalized = raw.trim().toLowerCase();
  return entities.find(entity => entity.id === raw || entity.name.trim().toLowerCase() === normalized)?.id || raw;
};

const relationName = (value: any): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object') {
    const name = value.name ?? value.label;
    return name === undefined || name === null ? undefined : String(name);
  }
  return typeof value === 'string' ? value : undefined;
};

const normalizeStatus = (value: unknown): TransportStatus => {
  const status = String(value || '').toUpperCase();
  if (status === 'DRAFT' || status === 'DELIVERY' || status === 'FINANCE' || status === 'PAID' || status === 'REJECTED') return status;
  return 'PENDING';
};

const normalizeFlag = (value: unknown): boolean | string => {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim();
  const normalized = text.toLowerCase();
  if (!text || ['false', '0', 'no'].includes(normalized)) return false;
  if (['true', '1', 'yes'].includes(normalized)) return true;
  return text;
};

const toBooleanFlag = (value: boolean | string | undefined): boolean => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return Boolean(normalized && !['false', '0', 'no'].includes(normalized));
};

export function transformBackendTransport(raw: any, lookups: TransportLookups = {}): Transport {
  const orders = lookups.orders || [];
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items: TransportItem[] = rawItems.map((item: any) => {
    const orderValue = item.order_id ?? item.orderId ?? item.order ?? '';
    const orderId = relationId(orderValue, orders.map(order => ({ id: order.id, name: order.orderNumber })));
    const orderSize = item.order_size ?? item.orderSize;
    const orderSizeRemaining = item.order_size_rem ?? item.orderSizeRemaining;
    return {
      id: item.id === undefined || item.id === null ? undefined : Number(item.id),
      orderId,
      allocatedQuantity: Number(item.quantity ?? item.allocated_quantity ?? item.allocatedQuantity ?? 0),
      orderEntryQuantity: Number(item.order_entry ?? item.orderEntryQuantity ?? 0),
      orderNumber: item.order === undefined || item.order === null ? undefined : String(item.order),
      orderType: item.order_type ?? item.orderType,
      orderSize: orderSize === undefined ? undefined : Number(orderSize),
      orderSizeUnit: item.order_size_unit ?? item.orderSizeUnit,
      orderSizeRemaining: orderSizeRemaining === undefined ? undefined : Number(orderSizeRemaining),
      orderCommodity: item.order_commodity ?? item.orderCommodity,
      orderCommodityType: item.order_commodity_type ?? item.orderCommodityType
    };
  });
  const rawTransporterBank = raw?.transporter_bank ?? raw?.transporterBank;
  const transporterBank: TransportBankDetails | null = rawTransporterBank && typeof rawTransporterBank === 'object'
    ? {
      transactionType: rawTransporterBank.transaction_type ?? rawTransporterBank.transactionType,
      accountNumber: rawTransporterBank.account_number ?? rawTransporterBank.accountNumber,
      accountName: rawTransporterBank.account_name ?? rawTransporterBank.accountName,
      ifscCode: rawTransporterBank.ifsc_code ?? rawTransporterBank.ifscCode,
      bank: rawTransporterBank.bank,
      branch: rawTransporterBank.branch,
      email: rawTransporterBank.email
    }
    : null;

  return {
    id: String(raw?.id ?? raw?.pk ?? ''),
    bulkTransport: toBooleanFlag(raw?.bulk_transport ?? raw?.bulkTransport),
    vehicleCount: Number(raw?.vehicle_nos ?? raw?.vehicleNos ?? 0),
    fromClientCount: Number(raw?.from_client_nos ?? raw?.fromClientNos ?? 0),
    billNumber: String(raw?.bill_no ?? raw?.bill_number ?? raw?.billNumber ?? ''),
    billingFirmId: relationId(raw?.billing_firm_id ?? raw?.billingFirmId ?? raw?.billing_firm, lookups.clients),
    billingFirmName: relationName(raw?.billing_firm) ?? raw?.billing_firm_name ?? raw?.billingFirmName ?? undefined,
    commodityId: relationId(raw?.commodity_id ?? raw?.commodityId ?? raw?.commodity, lookups.commodities),
    commodityName: relationName(raw?.commodity) ?? raw?.commodity_name ?? raw?.commodityName ?? undefined,
    commodityType: raw?.commodity_type ?? raw?.commodityType ?? undefined,
    fromClientId: relationId(raw?.from_client_id ?? raw?.fromClientId ?? raw?.from_client, lookups.clients),
    fromClientName: relationName(raw?.from_client) ?? raw?.from_client_name ?? raw?.fromClientName ?? undefined,
    toClientId: relationId(raw?.to_client_id ?? raw?.toClientId ?? raw?.to_client, lookups.clients),
    toClientName: relationName(raw?.to_client) ?? raw?.to_client_name ?? raw?.toClientName ?? undefined,
    vehicleNumber: String(raw?.vehicle_no ?? raw?.vehicle_number ?? raw?.vehicleNumber ?? ''),
    transporterId: relationId(
      raw?.transporter_id !== undefined
        ? raw.transporter_id
        : raw?.transporterId !== undefined
          ? raw.transporterId
          : raw?.transporter,
      lookups.transporters
    ),
    transporterName: relationName(raw?.transporter) ?? raw?.transporter_name ?? raw?.transporterName ?? undefined,
    transporterBank,
    grossWeight: Number(raw?.gross_wt ?? raw?.gross_weight ?? raw?.grossWeight ?? 0),
    grossWeightUnit: (raw?.gross_wt_unit ?? raw?.grossWeightUnit ?? 'mt') as QuantityUnit,
    bagNumbers: Number(raw?.bag_nos ?? raw?.bag_numbers ?? raw?.bagNumbers ?? 0),
    bagWeight: Number(raw?.bag_wt ?? raw?.bag_weight ?? raw?.bagWeight ?? 0),
    anugya: normalizeFlag(raw?.anugya),
    gatepass: normalizeFlag(raw?.gatepass),
    orderless: toBooleanFlag(raw?.orderless),
    rent: Number(raw?.rent ?? 0),
    rentType: raw?.rent_type === 'fix' ? 'fix' : 'per_unit',
    advanceByClient: Number(raw?.adv_by_client ?? raw?.advance_by_client ?? raw?.advanceByClient ?? 0),
    advanceByFirm: Number(raw?.adv_by_firm ?? raw?.advance_by_firm ?? raw?.advanceByFirm ?? 0),
    finalPaid: Number(raw?.final_paid ?? raw?.finalPaid ?? 0),
    extraPaid: Number(raw?.extra_paid ?? raw?.extraPaid ?? raw?.extra_Paid ?? 0),
    shortage: Number(raw?.shortage ?? 0),
    loadingDate: raw?.loading_date ?? raw?.loadingDate ?? undefined,
    unloadDate: raw?.unload_date ?? raw?.unloadDate ?? undefined,
    receivedWeight: Number(raw?.rcvd_wt ?? raw?.received_weight ?? raw?.receivedWeight ?? 0),
    sourceWeightReceipt: raw?.wt_rcpt_src ?? raw?.source_weight_receipt ?? raw?.sourceWeightReceipt ?? undefined,
    destinationWeightReceipt: raw?.wt_rcpt_dst ?? raw?.destination_weight_receipt ?? raw?.destinationWeightReceipt ?? undefined,
    status: normalizeStatus(raw?.status),
    items,
    notes: raw?.notes || '',
    createdBy: raw?.created_by ?? raw?.createdBy ?? raw?.c_by ?? undefined,
    createdAt: String(raw?.created_at ?? raw?.createdAt ?? raw?.c_at ?? new Date().toISOString().slice(0, 10)),
    updatedAt: raw?.updated_at ?? raw?.updatedAt ?? undefined
  };
}

function appendValue(form: FormData, key: string, value: unknown): void {
  if (value !== undefined && value !== null && value !== '') {
    form.append(key, String(value));
  }
}

function toTransportFormData(
  transport: TransportWrite,
  files: TransportReceiptFiles = {},
  includeId = false,
  lookups: TransportLookups = {}
): FormData {
  const form = new FormData();
  const idFields: Array<[keyof TransportWrite, string]> = [
    ['billingFirmId', 'billing_firm'],
    ['commodityId', 'commodity'],
    ['fromClientId', 'from_client'],
    ['toClientId', 'to_client']
  ];
  const scalarFields: Array<[keyof TransportWrite, string]> = [
    ['billNumber', 'bill_no'],
    ['grossWeight', 'gross_wt'],
    ['bagNumbers', 'bag_nos'],
    ['bagWeight', 'bag_wt'],
    ['vehicleNumber', 'vehicle_no'],
    ['unloadDate', 'unload_date'],
    ['receivedWeight', 'rcvd_wt'],
    ['rent', 'rent'],
    ['advanceByClient', 'adv_by_client'],
    ['advanceByFirm', 'adv_by_firm'],
    ['finalPaid', 'final_paid'],
    ['extraPaid', 'extra_paid'],
    ['shortage', 'shortage'],
    ['loadingDate', 'loading_date']
  ];

  if (includeId && transport.id) appendValue(form, 'id', numericId(transport.id));
  idFields.forEach(([property, field]) => {
    const value = transport[property] as string | undefined;
    if (value !== undefined) appendValue(form, field, numericId(value));
  });
  if (transport.transporterId === null || transport.transporterId === '') {
    // Keep the nullable relation present so updates can clear an existing transporter.
    form.append('transporter', '');
  } else if (transport.transporterId !== undefined) {
    appendValue(form, 'transporter', numericId(transport.transporterId));
  }
  scalarFields.forEach(([property, field]) => {
    const value = transport[property];
    appendValue(form, field, typeof value === 'number' ? roundToTwoDecimals(value) : value);
  });

  if (transport.grossWeightUnit !== undefined) appendValue(form, 'gross_wt_unit', transport.grossWeightUnit);
  if (transport.anugya !== undefined) appendValue(form, 'anugya', toBooleanFlag(transport.anugya));
  if (transport.gatepass !== undefined) appendValue(form, 'gatepass', toBooleanFlag(transport.gatepass));
  if (transport.orderless !== undefined) appendValue(form, 'orderless', toBooleanFlag(transport.orderless));
  if (transport.status !== undefined) appendValue(form, 'status', transport.status.toLowerCase());
  if (transport.rentType !== undefined) appendValue(form, 'rent_type', transport.rentType);
  if (transport.notes !== undefined) form.append('notes', transport.notes);
  if (transport.items !== undefined) {
    const items = transport.items.map(item => {
      const orderReference = String(item.orderId).trim();
      const matchedOrder = lookups.orders?.find(order =>
        order.id === orderReference || order.orderNumber.trim().toLowerCase() === orderReference.toLowerCase()
      );
      const backendOrderId = matchedOrder?.id ?? (/^\d+$/.test(orderReference) ? orderReference : '');
      if (!backendOrderId || !/^\d+$/.test(backendOrderId)) {
        throw new Error(`Cannot resolve order "${orderReference}" to a backend order ID`);
      }
      return {
        ...(includeId && item.id !== undefined ? { id: item.id } : {}),
        order: Number(backendOrderId),
        quantity: roundToTwoDecimals(item.allocatedQuantity),
        order_entry: roundToTwoDecimals(item.orderEntryQuantity || 0)
      };
    });
    form.append('items', JSON.stringify(items));
  }
  if (files.source) form.append('wt_rcpt_src', files.source);
  if (files.destination) form.append('wt_rcpt_dst', files.destination);
  return form;
}

function toBulkTransportSchema(transport: BulkTransportEntry, lookups: TransportLookups, includeId = false): Record<string, unknown> {
  const orderItems = transport.items?.map(item => {
    const orderReference = String(item.orderId).trim();
    const matchedOrder = lookups.orders?.find(order =>
      order.id === orderReference || order.orderNumber.trim().toLowerCase() === orderReference.toLowerCase()
    );
    const backendOrderId = matchedOrder?.id ?? (/^\d+$/.test(orderReference) ? orderReference : '');
    if (!backendOrderId || !/^\d+$/.test(backendOrderId)) {
      throw new Error(`Cannot resolve order "${orderReference}" to a backend order ID`);
    }
    return {
      ...(includeId && item.id !== undefined ? { id: item.id } : {}),
      order: Number(backendOrderId),
      quantity: roundToTwoDecimals(item.allocatedQuantity)
    };
  });

  return {
    ...(includeId && transport.id ? { id: Number(numericId(transport.id)) } : {}),
    bill_no: transport.billNumber,
    ...(transport.billingFirmId ? { billing_firm: Number(numericId(transport.billingFirmId)) } : {}),
    ...(transport.commodityId ? { commodity: Number(numericId(transport.commodityId)) } : {}),
    ...(transport.fromClientId ? { from_client: Number(numericId(transport.fromClientId)) } : {}),
    ...(transport.toClientId ? { to_client: Number(numericId(transport.toClientId)) } : {}),
    vehicle_no: transport.vehicleNumber,
    ...(transport.transporterId === 'none'
      ? { transporter: 'none' }
      : transport.transporterId
        ? { transporter: Number(numericId(transport.transporterId)) }
        : {}),
    gross_wt: transport.grossWeight === undefined ? undefined : roundToTwoDecimals(transport.grossWeight),
    gross_wt_unit: transport.grossWeightUnit,
    bag_nos: transport.bagNumbers,
    bag_wt: transport.bagWeight,
    anugya: transport.anugya === undefined ? undefined : toBooleanFlag(transport.anugya),
    gatepass: transport.gatepass === undefined ? undefined : toBooleanFlag(transport.gatepass),
    rent: transport.rent === undefined ? undefined : roundToTwoDecimals(transport.rent),
    rent_type: transport.rentType,
    adv_by_client: transport.advanceByClient === undefined ? undefined : roundToTwoDecimals(transport.advanceByClient),
    adv_by_firm: transport.advanceByFirm === undefined ? undefined : roundToTwoDecimals(transport.advanceByFirm),
    final_paid: transport.finalPaid === undefined ? undefined : roundToTwoDecimals(transport.finalPaid),
    extra_paid: transport.extraPaid === undefined ? undefined : roundToTwoDecimals(transport.extraPaid),
    shortage: transport.shortage === undefined ? undefined : roundToTwoDecimals(transport.shortage),
    loading_date: transport.loadingDate,
    unload_date: transport.unloadDate,
    rcvd_wt: transport.receivedWeight === undefined ? undefined : roundToTwoDecimals(transport.receivedWeight),
    status: transport.status?.toLowerCase(),
    items: orderItems,
    notes: transport.notes,
    created_by: transport.createdBy
  };
}

function toBulkTransportFormData(
  payload: {
    title?: string;
    loadingDate?: string;
    unloadingDate?: string;
    billNumber?: string;
    totalReceivedWeight?: number;
    orderEntry?: number;
    orderId?: string;
    billingFirmId?: string;
    transporterId?: string;
    toClientId?: string;
    commodityId?: string;
    status?: TransportStatus;
    transports?: BulkTransportEntry[];
  },
  lookups: TransportLookups,
  id?: string
): FormData {
  const form = new FormData();
  if (id) appendValue(form, 'id', numericId(id));
  if (payload.title !== undefined) form.append('title', payload.title);
  appendValue(form, 'loading_date', payload.loadingDate);
  appendValue(form, 'unloading_date', payload.unloadingDate);
  appendValue(form, 'bill_no', payload.billNumber);
  appendValue(form, 'total_rcvd_wt', payload.totalReceivedWeight === undefined ? undefined : roundToTwoDecimals(payload.totalReceivedWeight));
  appendValue(form, 'order_entry', payload.orderEntry === undefined ? undefined : roundToTwoDecimals(payload.orderEntry));
  appendValue(form, 'order', payload.orderId ? numericId(payload.orderId) : undefined);
  appendValue(form, 'billing_firm', payload.billingFirmId ? numericId(payload.billingFirmId) : undefined);
  appendValue(form, 'transporter', payload.transporterId === 'none'
    ? 'none'
    : payload.transporterId ? numericId(payload.transporterId) : undefined);
  appendValue(form, 'to_client', payload.toClientId ? numericId(payload.toClientId) : undefined);
  appendValue(form, 'commodity', payload.commodityId ? numericId(payload.commodityId) : undefined);
  appendValue(form, 'status', payload.status?.toLowerCase());
  if (payload.transports !== undefined) {
    form.append('transports', JSON.stringify(payload.transports.map(transport =>
      toBulkTransportSchema(transport, lookups, Boolean(id))
    )));
  }
  return form;
}

function unwrapBulkTransport(value: any, lookups: TransportLookups): BulkTransportDetail {
  const bulkTransport = value?.data ?? value;
  const rawOrder = bulkTransport?.order && typeof bulkTransport.order === 'object'
    ? bulkTransport.order
    : null;
  const selectedOrder = rawOrder
    ? normalizeOrderOptions([rawOrder], lookups)[0]
    : undefined;
  return {
    id: String(bulkTransport?.id ?? ''),
    title: String(bulkTransport?.title ?? ''),
    createdBy: bulkTransport?.c_by ?? bulkTransport?.created_by ?? bulkTransport?.createdBy ?? undefined,
    createdAt: String(bulkTransport?.c_at ?? bulkTransport?.created_at ?? bulkTransport?.createdAt ?? ''),
    loadingDate: bulkTransport?.loading_date ?? bulkTransport?.loadingDate ?? undefined,
    unloadingDate: bulkTransport?.unloading_date ?? bulkTransport?.unloadingDate ?? undefined,
    billNumber: bulkTransport?.bill_no ?? bulkTransport?.billNumber ?? undefined,
    totalReceivedWeight: bulkTransport?.total_rcvd_wt == null && bulkTransport?.totalReceivedWeight == null
      ? undefined
      : Number(bulkTransport.total_rcvd_wt ?? bulkTransport.totalReceivedWeight),
    orderEntry: bulkTransport?.order_entry == null && bulkTransport?.orderEntry == null
      ? undefined
      : Number(bulkTransport.order_entry ?? bulkTransport.orderEntry),
    orderId: relationId(bulkTransport?.order, (lookups.orders || []).map(order => ({ id: order.id, name: order.orderNumber })),),
    order: selectedOrder,
    billingFirmId: relationId(bulkTransport?.billing_firm, lookups.clients),
    transporterId: relationId(bulkTransport?.transporter, lookups.transporters),
    toClientId: relationId(bulkTransport?.to_client, lookups.clients),
    commodityId: relationId(bulkTransport?.commodity, lookups.commodities),
    status: normalizeStatus(bulkTransport?.status),
    selectedSources: Array.isArray(bulkTransport?.selected_sources) ? bulkTransport.selected_sources.map((source: unknown) => String(source)) : [],
    transports: Array.isArray(bulkTransport?.transports)
      ? bulkTransport.transports.map((transport: any) => transformBackendTransport(transport, lookups))
      : []
  };
}

function unwrapTransport(value: any, lookups: TransportLookups): Transport {
  return transformBackendTransport(value?.data ?? value, lookups);
}

function unwrapPage(value: any): { results: any[]; total: number; page: number; pageSize: number; totalPages: number } {
  const data = value?.data ?? value;
  const page = data?.data && !Array.isArray(data.data) ? data.data : data;
  const results = Array.isArray(page?.results) ? page.results
    : Array.isArray(page?.items) ? page.items
    : Array.isArray(data) ? data
    : [];
  const pageSize = Number(page?.page_size ?? page?.pageSize) || results.length || 100;
  const total = Number(page?.total) || results.length;
  return {
    results,
    total,
    page: Number(page?.page) || 1,
    pageSize,
    totalPages: Number(page?.total_pages ?? page?.totalPages) || Math.ceil(total / pageSize) || 1
  };
}

async function listPaginatedFromEndpoint(
  endpoint: string,
  filters: TransportListFilters,
  lookups: TransportLookups
): Promise<PaginatedTransportsResult> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 100;
  const form = new FormData();
  appendValue(form, 'transporter', filters.transporter ? numericId(filters.transporter) : undefined);
  appendValue(form, 'status', filters.status?.toLowerCase());
  appendValue(form, 'commodity', filters.commodity ? numericId(filters.commodity) : undefined);
  appendValue(form, 'billing_firm', filters.billingFirm ? numericId(filters.billingFirm) : undefined);
  appendValue(form, 'page', page);
  appendValue(form, 'page_size', pageSize);
  const response = await apiClient.postForm<any>(endpoint, form);
  const parsed = unwrapPage(response);
  return {
    ...parsed,
    results: parsed.results.map(transport => transformBackendTransport(transport, lookups))
  };
}

function normalizeClientOptions(response: any): TransportClientOption[] {
  const data = response?.data ?? response;
  const possibleLists = [
    data,
    data?.results,
    data?.items,
    data?.firms,
    data?.locations,
    data?.clients,
    data?.data
  ];
  const list = possibleLists.find(Array.isArray);
  if (!list) return [];

  return list.flatMap((client: any) => {
    if (!client || typeof client !== 'object') return [];
    const id = client.id ?? client.pk ?? client._id ?? client.value;
    const name = client.name ?? client.label ?? client.client_name;
    if (id === undefined || id === null || !name) return [];
    return [{
      id: String(id),
      name: String(name),
      city: client.city ? String(client.city) : undefined,
      clientType: String(client.client_type ?? client.clientType ?? client.type ?? '') || undefined,
      image: client.image ?? client.profile_picture ?? null,
      imageUrl: client.image_url ?? client.imageUrl ?? null
    }];
  });
}

function getSelectionRows(response: any): any[] {
  const data = response?.data ?? response;
  const candidates = [
    data,
    data?.results,
    data?.items,
    data?.orders,
    data?.transporters,
    data?.data
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeTransporterOptions(response: any): Transporter[] {
  return getSelectionRows(response).flatMap((raw: any) => {
    if (!raw || typeof raw !== 'object') return [];
    const id = raw.id ?? raw.pk ?? raw._id ?? raw.value;
    const name = raw.name ?? raw.label ?? raw.transporter_name ?? raw.agency;
    if (id === undefined || id === null || !name) return [];
    return [{
      id: String(id),
      name: String(name),
      agency: raw.agency ? String(raw.agency) : undefined,
      phone_number: String(raw.phone_number ?? raw.phone ?? ''),
      phone: String(raw.phone_number ?? raw.phone ?? ''),
      city: raw.city ? String(raw.city) : undefined,
      contactPerson: raw.contact_person ? String(raw.contact_person) : undefined,
      notes: raw.notes ? String(raw.notes) : undefined
    }];
  });
}

function normalizeQuantityUnit(value: unknown, fallback: QuantityUnit = 'mt'): QuantityUnit {
  const unit = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (unit === 'kg' || unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') return 'kg';
  if (unit === 'qtl' || unit === 'quintal' || unit === 'quintals') return 'quintal';
  if (unit === 'mt' || unit === 'metric_ton' || unit === 'metric_tons') return 'mt';
  return fallback;
}

function normalizeOrderOptions(
  response: any,
  lookups: Pick<TransportLookups, 'clients' | 'commodities'> = {}
): Order[] {
  return getSelectionRows(response)
    .filter((raw: any) => raw && typeof raw === 'object')
    .map((raw: any) => {
      const orderType = String(raw.type ?? raw.order_type ?? '').toLowerCase();
      const counterpartyName = orderType.includes('purchase') ? raw.from_client : raw.to_client;
      const quantity = Number(raw.quantity ?? raw.order_qty ?? 0);
      const remainingQuantity = raw.rem_qty ?? raw.remaining_quantity;
      const fulfilledQuantity = raw.quantity_fulfilled ?? raw.quantityFulfilled ?? (
        remainingQuantity === undefined || remainingQuantity === null
          ? 0
          : quantity - Number(remainingQuantity)
      );
      const remainingUnit = normalizeQuantityUnit(
        raw.rem_qty_unit ?? raw.remaining_quantity_unit ?? raw.quantity_unit ?? raw.qty_unit ?? raw.unit
      );
      const order = transformBackendOrderToFrontend({
        ...raw,
        type: raw.type ?? raw.order_type,
        order_no: raw.order_no ?? raw.order_number,
        quantity,
        quantity_fulfilled: fulfilledQuantity,
        quantity_unit: raw.quantity_unit ?? raw.qty_unit ?? raw.unit ?? remainingUnit,
        from_client: relationId(raw.from_client, lookups.clients),
        to_client: relationId(raw.to_client, lookups.clients),
        commodity: raw.commodity_id ?? relationId(raw.commodity, lookups.commodities)
      });
      return {
        ...order,
        remQuantity: Number(remainingQuantity ?? quantity - Number(fulfilledQuantity)),
        remQuantityUnit: remainingUnit,
        commodityName: typeof raw.commodity === 'string' ? raw.commodity : raw.commodity?.name,
        commodityType: raw.commodity_type ?? raw.commodityType,
        selectorClientName: String(counterpartyName ?? '')
      };
    });
}

export const transportsApi = {
  async listBulk(page = 1, pageSize = 10): Promise<BulkTransportListPage> {
    const form = new FormData();
    appendValue(form, 'page', page);
    appendValue(form, 'page_size', pageSize);
    const response = await apiClient.postForm<any>('/bulk-transports/lst', form);
    const data = response?.data?.data ?? response?.data ?? response;
    const results = Array.isArray(data?.results) ? data.results : [];

    return {
      page: Number(data?.page) || page,
      pageSize: Number(data?.page_size ?? data?.pageSize) || pageSize,
      total: Number(data?.total) || 0,
      totalPages: Number(data?.total_pages ?? data?.totalPages) || 1,
      results: results.map((item: any) => ({
        id: String(item.id ?? ''),
        loadingDate: item.loading_date ?? item.loadingDate ?? undefined,
        unloadingDate: item.unloading_date ?? item.unloadingDate ?? undefined,
        title: String(item.title ?? ''),
        commodity: item.commodity == null ? undefined : String(item.commodity),
        commodityType: item.commodity_type ?? item.commodityType ?? undefined,
        billNumber: item.bill_no == null ? undefined : String(item.bill_no),
        order: item.order == null ? undefined : String(item.order),
        billingFirm: item.billing_firm == null ? undefined : String(item.billing_firm),
        destination: item.to_client == null ? undefined : String(item.to_client),
        fromClientCount: Number(item.from_client_nos ?? item.fromClientNos) || 0,
        grossWeight: Number(item.gross_wt ?? item.grossWeight) || 0,
        grossWeightUnit: item.gross_wt_unit ?? item.grossWeightUnit ?? undefined,
        totalBagCount: Number(item.total_bag_nos ?? item.totalBagNos) || 0,
        transporter: item.transporter == null ? undefined : String(item.transporter),
        receivedWeight: item.total_rcvd_wt == null && item.totalReceivedWeight == null
          ? undefined
          : Number(item.total_rcvd_wt ?? item.totalReceivedWeight),
        status: String(item.status ?? 'pending'),
        wagonAssignmentStatus: item.wagon_assignment_status == null ? null : String(item.wagon_assignment_status),
        vehicleCount: Number(item.num_vehicles ?? item.vehicle_nos ?? item.numVehicles) || 0
      }))
    };
  },

  async addBulk(payload: BulkTransportCreatePayload, lookups: TransportLookups = {}): Promise<BulkTransportDetail> {
    const response = await apiClient.postForm<any>(
      '/bulk-transports/add',
      toBulkTransportFormData(payload, lookups)
    );
    return unwrapBulkTransport(response, lookups);
  },

  async updateBulk(payload: BulkTransportUpdatePayload, lookups: TransportLookups = {}): Promise<BulkTransportDetail> {
    const response = await apiClient.patchForm<any>(
      '/bulk-transports/upd',
      toBulkTransportFormData(payload, lookups, payload.id)
    );
    return unwrapBulkTransport(response, lookups);
  },

  getBulk(id: string, lookups: TransportLookups = {}): Promise<BulkTransportDetail> {
    const requestId = numericId(id);
    const existingRequest = inFlightBulkRequests.get(requestId);
    if (existingRequest) return existingRequest;

    const request = apiClient.get<any>(`/bulk-transports/get?id=${encodeURIComponent(requestId)}`)
      .then(response => unwrapBulkTransport(response, lookups));
    inFlightBulkRequests.set(requestId, request);
    const clearRequest = () => {
      if (inFlightBulkRequests.get(requestId) === request) inFlightBulkRequests.delete(requestId);
    };
    request.then(clearRequest, clearRequest);
    return request;
  },

  async selectBillingFirms(): Promise<TransportClientOption[]> {
    const response = await apiClient.get<any>('/transports/clients/firms/sel/');
    return normalizeClientOptions(response);
  },

  async selectLocations(): Promise<TransportClientOption[]> {
    const response = await apiClient.get<any>('/transports/clients/locations/sel/');
    return normalizeClientOptions(response);
  },

  async selectAgencyOptions(): Promise<Transporter[]> {
    const response = await apiClient.get<any>('/transports/transporters/sel/');
    return normalizeTransporterOptions(response);
  },

  async selectSalesOrders(lookups: Pick<TransportLookups, 'clients' | 'commodities'> = {}): Promise<Order[]> {
    const response = await apiClient.get<any>('/transports/orders/so/sel/');
    return normalizeOrderOptions(response, lookups);
  },

  async selectPurchaseOrders(lookups: Pick<TransportLookups, 'clients' | 'commodities'> = {}): Promise<Order[]> {
    const response = await apiClient.get<any>('/transports/orders/po/sel/');
    return normalizeOrderOptions(response, lookups);
  },

  async selectBulkOrders(lookups: Pick<TransportLookups, 'clients' | 'commodities'> = {}): Promise<Order[]> {
    const response = await apiClient.get<any>('/bulk-transports/orders/sel/');
    return normalizeOrderOptions(response, lookups);
  },

  async add(transport: TransportWrite, files: TransportReceiptFiles = {}, lookups: TransportLookups = {}): Promise<Transport> {
    const response = await apiClient.postForm<any>('/transports/add', toTransportFormData(transport, files, false, lookups));
    return unwrapTransport(response, lookups);
  },

  async update(transport: TransportWrite & { id: string }, files: TransportReceiptFiles = {}, lookups: TransportLookups = {}): Promise<Transport> {
    const response = await apiClient.patchForm<any>('/transports/upd', toTransportFormData(transport, files, true, lookups));
    return unwrapTransport(response, lookups);
  },

  async updatePayments(payment: TransportPaymentUpdate): Promise<void> {
    const form = new FormData();
    appendValue(form, 'id', numericId(payment.id));
    appendValue(form, 'rcvd_wt', roundToTwoDecimals(payment.receivedWeight));
    appendValue(form, 'unload_date', payment.unloadDate);
    appendValue(form, 'rent', roundToTwoDecimals(payment.rent));
    appendValue(form, 'rent_type', payment.rentType);
    appendValue(form, 'adv_by_client', roundToTwoDecimals(payment.advanceByClient));
    appendValue(form, 'adv_by_firm', roundToTwoDecimals(payment.advanceByFirm));
    appendValue(form, 'shortage', roundToTwoDecimals(payment.shortageAmount));
    appendValue(form, 'extra_paid', roundToTwoDecimals(payment.extraAmount));
    appendValue(form, 'final_paid', roundToTwoDecimals(payment.finalPaid));
    appendValue(form, 'status', payment.status.toLowerCase());
    form.append('notes', payment.notes);
    await apiClient.patchForm<any>('/transports/upd', form);
  },

  async updateStatus(id: string, status: TransportStatus): Promise<Transport> {
    const form = new FormData();
    appendValue(form, 'id', numericId(id));
    appendValue(form, 'status', status.toLowerCase());
    const response = await apiClient.patchForm<any>('/transports/status/upd', form);
    return unwrapTransport(response, {});
  },

  async get(id: string, lookups: TransportLookups = {}): Promise<Transport> {
    const response = await apiClient.get<any>(`/transports/get?id=${encodeURIComponent(numericId(id))}`);
    return unwrapTransport(response, lookups);
  },

  async list(filters: TransportListFilters = {}, lookups: TransportLookups = {}): Promise<Transport[]> {
    const firstPage = filters.page || 1;
    const pageSize = filters.pageSize || 100;
    const results: Transport[] = [];
    let totalPages = firstPage;

    for (let page = firstPage; page <= totalPages; page += 1) {
      const parsed = await listPaginatedFromEndpoint('/transports/lst', { ...filters, page, pageSize }, lookups);
      results.push(...parsed.results);
      totalPages = parsed.totalPages;
    }

    return results;
  },

  async listPaginated(filters: TransportListPayload = {}, lookups: TransportLookups = {}): Promise<PaginatedTransportsResult> {
    const payload: TransportListPayload = {
      page: filters.page || 1,
      page_size: filters.page_size || 100,
      ...(filters.transporter?.length ? { transporter: filters.transporter } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.commodity?.length ? { commodity: filters.commodity } : {}),
      ...(filters.billing_firm?.length ? { billing_firm: filters.billing_firm } : {}),
      ...(filters.party?.length ? { party: filters.party } : {}),
      ...(filters.broker?.length ? { broker: filters.broker } : {}),
      ...(filters.loading_start_date ? { loading_start_date: filters.loading_start_date } : {}),
      ...(filters.loading_end_date ? { loading_end_date: filters.loading_end_date } : {}),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {})
    };
    const response = await apiClient.post<any>('/transports/lst', payload);
    const parsed = unwrapPage(response);
    return {
      ...parsed,
      results: parsed.results.map(transport => transformBackendTransport(transport, lookups))
    };
  },

  async listPaymentsPaginated(filters: TransportListPayload = {}, lookups: TransportLookups = {}): Promise<PaginatedTransportsResult> {
    const payload: TransportListPayload = {
      page: filters.page || 1,
      page_size: filters.page_size || 100,
      ...(filters.transporter?.length ? { transporter: filters.transporter } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.commodity?.length ? { commodity: filters.commodity } : {}),
      ...(filters.billing_firm?.length ? { billing_firm: filters.billing_firm } : {}),
      ...(filters.party?.length ? { party: filters.party } : {}),
      ...(filters.broker?.length ? { broker: filters.broker } : {}),
      ...(filters.loading_start_date ? { loading_start_date: filters.loading_start_date } : {}),
      ...(filters.loading_end_date ? { loading_end_date: filters.loading_end_date } : {}),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {})
    };
    const response = await apiClient.post<any>('/transports/payments/lst', payload);
    const parsed = unwrapPage(response);
    return {
      ...parsed,
      results: parsed.results.map(transport => transformBackendTransport(transport, lookups))
    };
  },

  async search(keyword: string, lookups: TransportLookups = {}): Promise<Transport[]> {
    const form = new FormData();
    form.append('keyword', keyword);
    const response = await apiClient.postForm<any>('/transports/search', form);
    const parsed = unwrapPage(response);
    return parsed.results.map(transport => transformBackendTransport(transport, lookups));
  },

  async deleteBulk(id: string): Promise<void> {
    await apiClient.delete<any>('/bulk-transports/del', {
      body: JSON.stringify({ id: Number(numericId(id)) })
    });
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete<any>('/transports/del/', {
      body: JSON.stringify({ id: Number(numericId(id)) })
    });
  }
};