export type UserRole = 'OWNER' | 'ACCOUNTANT' | 'LABOUR';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
  id: string;
  username: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone_number?: string | null;
  gender_code?: string | null;
  profile_picture?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
}

export interface UserCreatePayload {
  username: string;
  password: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone_number?: string | null;
  gender_code?: string | null;
  profile_picture?: string | null;
}

export interface UserUpdatePayload {
  role?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone_number?: string | null;
  gender_code?: string | null;
  profile_picture?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type MasterEntityType = 'broker' | 'businessclient' | 'commodity' | 'transporter';

export interface Commodity {
  id: string;
  name: string;
  type: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ClientType =
  | 'my_firm'
  | 'my_godown'
  | 'other_godown'
  | 'company'
  | 'location'
  | 'MY_FIRM'
  | 'MY_GODOWN'
  | 'OTHER_GODOWN'
  | 'COMPANY'
  | 'LOCATION';

export type ClientFlag =
  | 'good'
  | 'neutral'
  | 'bad'
  | 'blacklisted'
  | 'fraud'
  | 'unreasonable_claims'
  | 'GOOD'
  | 'NEUTRAL'
  | 'BAD'
  | 'BLACKLISTED'
  | 'FRAUD'
  | 'UNREASONABLE_CLAIMS';

export interface BusinessClient {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  maan_no?: string;
  type: ClientType;
  flag: ClientFlag;
  location_url?: string;
  notes?: string;
  image?: string | null;
  imageUrl?: string | null;
  profile_picture?: string | null;
  phone?: string;
  gstin?: string;
  createdAt?: string;
}

export interface Broker {
  id: string;
  name: string;
  phone_number: string;
  phone?: string;
  city?: string;
  notes?: string;
  createdAt?: string;
}

export interface Transporter {
  id: string;
  name: string;
  agency?: string;
  phone_number: string;
  phone?: string;
  city?: string;
  contactPerson?: string;
  transaction_type?: string;
  account_number?: string;
  account_name?: string;
  bank?: string;
  branch?: string;
  ifsc_code?: string;
  email?: string;
  notes?: string;
  createdAt?: string;
}

export interface MasterListResponse<T = any> {
  results?: T[];
  items?: T[];
  data?: T[];
  count?: number;
  total?: number;
}

export type QuantityUnit = 'mt' | 'quintal' | 'kg';
export type OrderType = 'SALES ORDER' | 'PURCHASE ORDER';
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'DRAFT';

export type BackendOrderType = 'sales_order' | 'purchase_order';
export type BackendOrderStatus = 'pending' | 'completed' | 'draft';
export type BackendQuantityUnit = 'mt' | 'quintal' | 'kg';

export interface OrderCreateSchema {
  type: BackendOrderType;
  order_no?: string | null;
  from_client?: number | null;
  to_client?: number | null;
  commodity: number;
  rate?: number | string;
  quantity?: number | string;
  quantity_unit?: BackendQuantityUnit;
  start_date?: string | null;
  expiry_date?: string | null;
  contract_date?: string | null;
  quantity_fulfilled?: number | string;
  broker?: number | null;
  status?: BackendOrderStatus;
  notes?: string | null;
}

export interface OrderUpdateSchema {
  id: number;
  type?: BackendOrderType | null;
  order_no?: string | null;
  from_client?: number | null;
  to_client?: number | null;
  commodity?: number | null;
  rate?: number | string | null;
  quantity?: number | string | null;
  quantity_unit?: BackendQuantityUnit | null;
  start_date?: string | null;
  expiry_date?: string | null;
  contract_date?: string | null;
  quantity_fulfilled?: number | string | null;
  broker?: number | null;
  status?: BackendOrderStatus | null;
  notes?: string | null;
}

export interface OrderGetDeleteSchema {
  id: number;
}

export interface OrderListSchema {
  status?: BackendOrderStatus | null;
  contract_date_from?: string | null;
  contract_date_to?: string | null;
  from_client?: number | null;
  to_client?: number | null;
  type?: BackendOrderType | null;
  broker?: number | null;
  page?: number;
  page_size?: number;
}

export interface OrderSelectSchema {
  status?: BackendOrderStatus | null;
  from_client?: number | null;
  to_client?: number | null;
  type?: BackendOrderType | null;
}

export interface Order {
  id: string;
  type: OrderType;
  orderNumber: string;
  fromClientId: string;
  toClientId: string;
  commodityId: string;
  commodityName?: string;
  commodityType?: string;
  orderTransports?: OrderTransport[];
  rate: number; // in ₹ per selected unit
  quantity: number; // in selected unit
  unit?: QuantityUnit; // 'mt' | 'quintal' | 'kg'
  contractDate?: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  quantityFulfilled: number; // in selected unit
  remQuantity?: number;
  remQuantityUnit?: QuantityUnit;
  selectorClientName?: string;
  brokerId: string;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderTransport {
  id: string;
  billNumber: string;
  billingFirmName?: string;
  loadingDate?: string | null;
  unloadDate?: string | null;
  vehicleNumber: string;
  transporterName: string;
  grossWeightUnit: QuantityUnit;
  grossWeight: number;
  orderEntryQuantity: number;
  status: string;
}

export interface TransportItem {
  id?: number;
  orderId: string;
  allocatedQuantity: number; // In the transport gross-weight unit
  orderEntryQuantity?: number; // In the transport gross-weight unit
}

export type TransportStatus = 'DRAFT' | 'PENDING' | 'DELIVERY' | 'FINANCE' | 'PAID';
export type TransportRentType = 'fix' | 'per_unit';

export interface TransportBankDetails {
  transactionType?: string;
  accountNumber?: string;
  accountName?: string;
  ifscCode?: string;
  bank?: string;
  branch?: string;
  email?: string;
}

export interface Transport {
  id: string;
  billNumber: string;
  billingFirmId: string;
  billingFirmName?: string;
  commodityId: string;
  fromClientId: string;
  toClientId: string;
  vehicleNumber: string;
  transporterId: string;
  transporterBank?: TransportBankDetails | null;
  grossWeight: number; // Value in grossWeightUnit
  grossWeightUnit?: QuantityUnit;
  bagNumbers?: number;
  bagWeight?: number; // grams per bag
  anugya?: boolean | string; // Mandi permit availability; string supports legacy records
  gatepass?: boolean | string;
  rent: number; // ₹ freight
  rentType?: TransportRentType;
  advanceByClient: number; // ₹
  advanceByFirm: number; // ₹
  finalPaid: number; // ₹
  extraPaid?: number; // ₹ additional charges
  shortage?: number; // ₹ extra amount posted as payment API shortage
  loadingDate?: string; // YYYY-MM-DD
  unloadDate?: string; // YYYY-MM-DD
  receivedWeight?: number; // MT at destination
  sourceWeightReceipt?: string;
  destinationWeightReceipt?: string;
  status: TransportStatus;
  items: TransportItem[];
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}
