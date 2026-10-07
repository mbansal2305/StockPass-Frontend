import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  User,
  UserCreatePayload,
  UserUpdatePayload,
  Commodity,
  BusinessClient,
  Broker,
  Transporter,
  Order,
  Transport,
  UserRole,
  MasterEntityType,
  OrderListSchema,
  OrderSelectSchema
} from '../types';
import { storage } from '../services/storage';
import {
  apiClient,
  authApi,
  usersApi,
  masterApi,
  ordersApi,
  transportsApi,
  PaginatedOrdersResult,
  toBackendCreateSchema,
  toBackendUpdateSchema
} from '../api';

export type NavigationPage = 
  | 'dashboard'
  | 'orders'
  | 'order-detail'
  | 'order-form'
  | 'transport'
  | 'transport-payments'
  | 'transport-detail'
  | 'transport-form'
  | 'bulk-transport-list'
  | 'bulk-transport'
  | 'master-data'
  | 'employees';

const TRANSPORT_PAGES: NavigationPage[] = [
  'transport',
  'transport-payments',
  'transport-detail',
  'transport-form',
  'bulk-transport-list',
  'bulk-transport'
];

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

type NamedEntity = { id: string; name: string };

const resolveOrderRelationId = (value: string, entities: NamedEntity[]): string => {
  if (!value) return '';
  const normalizedValue = value.trim().toLowerCase();
  const match = entities.find(entity => entity.id === value) ||
    entities.find(entity => entity.name.trim().toLowerCase() === normalizedValue);
  return match?.id || value;
};

const resolveOrderRelations = (
  order: Order,
  clients: NamedEntity[],
  commodities: NamedEntity[],
  brokers: NamedEntity[]
): Order => ({
  ...order,
  fromClientId: resolveOrderRelationId(order.fromClientId, clients),
  toClientId: resolveOrderRelationId(order.toClientId, clients),
  commodityId: resolveOrderRelationId(order.commodityId, commodities),
  brokerId: resolveOrderRelationId(order.brokerId, brokers)
});

interface AppContextType {
  currentUser: User | null;
  login: (u: string, p: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  
  // Navigation
  currentPage: NavigationPage;
  pageParams: Record<string, any>;
  navigate: (page: NavigationPage, params?: Record<string, any>) => void;

  // Master Data Tabs
  masterDataTab: 'commodities' | 'clients' | 'brokers' | 'transporters';
  setMasterDataTab: (tab: 'commodities' | 'clients' | 'brokers' | 'transporters') => void;

  // Data Collections
  users: User[];
  commodities: Commodity[];
  clients: BusinessClient[];
  brokers: Broker[];
  transporters: Transporter[];
  orders: Order[];
  transports: Transport[];
  
  // User Actions (API integrated)
  createUserAccount: (payload: UserCreatePayload) => Promise<User>;
  updateUserAccount: (userId: string, payload: UserUpdatePayload) => Promise<User>;
  changeUserPassword: (userId: string, newPassword: string) => Promise<void>;

  // Master Data API Operations (/master/add/, /master/upd/, /master/del/, /master/lst/, /master/search/)
  masterAdd: (entity: MasterEntityType, content: Record<string, any>) => Promise<any>;
  masterUpdate: (entity: MasterEntityType, id: string | number, content: Record<string, any>) => Promise<any>;
  masterDelete: (entity: MasterEntityType, id: string | number) => Promise<void>;
  masterSearch: (entity: MasterEntityType, search: string, filters?: Record<string, any>) => Promise<any[]>;
  masterList: (entity: MasterEntityType, filters?: Record<string, any>, page?: number, pageSize?: number) => Promise<any[]>;

  // Orders API Operations (/orders/add/, /orders/upd/, /orders/del/, /orders/get/, /orders/lst/, /orders/sel/)
  orderAdd: (orderData: Partial<Order>) => Promise<Order>;
  orderUpdate: (id: string | number, orderData: Partial<Order>) => Promise<Order>;
  orderDelete: (id: string | number) => Promise<void>;
  orderGet: (id: string | number) => Promise<Order>;
  orderListPaginated: (filters?: OrderListSchema) => Promise<PaginatedOrdersResult>;
  orderSelect: (filters?: OrderSelectSchema) => Promise<any[]>;
  transportGet: (id: string) => Promise<Transport>;

  // Refresher
  refreshData: () => Promise<void>;
  resetAllDemoData: () => void;

  // Toasts
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  // Mobile navigation drawer
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isBackendConnected: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getCurrentUser());
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [pageParams, setPageParams] = useState<Record<string, any>>({});
  const [masterDataTab, setMasterDataTab] = useState<'commodities' | 'clients' | 'brokers' | 'transporters'>('commodities');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  
  // Cached collections
  const [users, setUsers] = useState<User[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [orders, setOrders] = useState<Order[]>(() => storage.getOrders());
  const [transports, setTransports] = useState<Transport[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshData = async () => {
    storage.syncOrderFulfillments();
    const localTransports = storage.getTransports();
    setTransports(localTransports);
    setOrders(storage.getOrders());
    let refreshedCommodities = storage.getCommodities();
    let refreshedClients = storage.getClients();
    let refreshedBrokers = storage.getBrokers();
    let refreshedTransporters = storage.getTransporters();

    // Fetch master data from backend API with fallback to storage
    try {
      const [apiComms, apiClients, apiBrokers, apiTransps] = await Promise.allSettled([
        masterApi.list('commodity'),
        masterApi.list('businessclient'),
        masterApi.list('broker'),
        masterApi.list('transporter')
      ]);

      if (apiComms.status === 'fulfilled' && Array.isArray(apiComms.value) && apiComms.value.length > 0) {
        refreshedCommodities = apiComms.value.map(c => ({
          ...c,
          id: String(c.id || c._id || `com-${Date.now()}`),
          name: c.name || '',
          type: c.type || 'Grain',
          notes: c.notes || ''
        }));
      }
      setCommodities(refreshedCommodities);

      if (apiClients.status === 'fulfilled' && Array.isArray(apiClients.value) && apiClients.value.length > 0) {
        refreshedClients = apiClients.value.map(cl => ({
          ...cl,
          id: String(cl.id || cl._id || `cli-${Date.now()}`),
          name: cl.name || '',
          address: cl.address || '',
          city: cl.city || '',
          pincode: cl.pincode || '',
          type: cl.type || 'COMPANY',
          flag: cl.flag || 'GOOD',
          location_url: cl.location_url || '',
          image: cl.image || cl.profile_picture || null,
          imageUrl: cl.image_url || cl.imageUrl || null,
          profile_picture: cl.profile_picture || cl.image || null,
          notes: cl.notes || ''
        }));
      }
      setClients(refreshedClients);

      if (apiBrokers.status === 'fulfilled' && Array.isArray(apiBrokers.value) && apiBrokers.value.length > 0) {
        refreshedBrokers = apiBrokers.value.map(b => ({
          ...b,
          id: String(b.id || b._id || `brk-${Date.now()}`),
          name: b.name || '',
          phone_number: b.phone_number || b.phone || '',
          phone: b.phone_number || b.phone || '',
          city: b.city || '',
          notes: b.notes || ''
        }));
      }
      setBrokers(refreshedBrokers);

      if (apiTransps.status === 'fulfilled' && Array.isArray(apiTransps.value) && apiTransps.value.length > 0) {
        refreshedTransporters = apiTransps.value.map(t => ({
          ...t,
          id: String(t.id || t._id || `trp-${Date.now()}`),
          name: t.name || '',
          agency: t.agency || t.name || '',
          phone_number: t.phone_number || t.phone || '',
          phone: t.phone_number || t.phone || '',
          city: t.city || '',
          contactPerson: t.name || '',
          notes: t.notes || ''
        }));
      }
      setTransporters(refreshedTransporters);
    } catch (err) {
      console.warn('Master data API list failed, using local storage:', err);
      refreshedCommodities = storage.getCommodities();
      refreshedClients = storage.getClients();
      refreshedBrokers = storage.getBrokers();
      refreshedTransporters = storage.getTransporters();
      setCommodities(refreshedCommodities);
      setClients(refreshedClients);
      setBrokers(refreshedBrokers);
      setTransporters(refreshedTransporters);
    }

    if (TRANSPORT_PAGES.includes(currentPage)) {
      try {
        const apiTransports = await transportsApi.list({}, {
          clients: refreshedClients,
          commodities: refreshedCommodities,
          orders: storage.getOrders(),
          transporters: refreshedTransporters
        });
        setTransports(apiTransports);
      } catch (err) {
        console.warn('Transport API list failed, using local storage:', err);
        setTransports(localTransports);
      }
    }

    // Fetch users from backend API
    try {
      const apiUsers = await usersApi.getUsers();
      if (Array.isArray(apiUsers) && apiUsers.length > 0) {
        setUsers(apiUsers);
        setIsBackendConnected(true);
      } else {
        setUsers(storage.getUsers());
      }
    } catch (err) {
      console.warn('Backend users fetch failed (using local store):', err);
      setUsers(storage.getUsers());
      setIsBackendConnected(false);
    }
  };

  // Listen for auth expiration events dispatched by apiClient
  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      showToast('Session expired. Please log in again.', 'error');
    };
    window.addEventListener('api:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('api:auth_expired', handleAuthExpired);
  }, []);

  // Initial load
  useEffect(() => {
    storage.init();
    
    // Check if tokens exist in storage and restore session
    const initSession = async () => {
      const hasToken = apiClient.getAccessToken();
      if (hasToken) {
        try {
          const me = await authApi.getMe(storage.getCurrentUser());
          setCurrentUser(me);
          storage.setCurrentUser(me);
          setIsBackendConnected(true);
        } catch (e) {
          console.warn('Failed to verify token with backend me endpoint:', e);
        }
      }
      await refreshData();
    };

    initSession();
  }, []);

  useEffect(() => {
    if (currentPage !== 'transport' && currentPage !== 'transport-payments') return;

    let cancelled = false;
    const localTransports = storage.getTransports();
    transportsApi.list({}, { clients, commodities, orders, transporters })
      .then(apiTransports => {
        if (!cancelled) setTransports(apiTransports);
      })
      .catch(err => {
        console.warn('Transport API list failed, using local storage:', err);
        if (!cancelled) setTransports(localTransports);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  const navigate = (page: NavigationPage, params: Record<string, any> = {}) => {
    // Role-based route guard
    if (page === 'employees' && currentUser?.role !== 'OWNER') {
      showToast('Only owners can manage employees', 'error');
      return;
    }
    setCurrentPage(page);
    setPageParams(params);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const login = async (username: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Primary: Try real backend authentication
      const res = await authApi.login(username, pass);
      if (res.user) {
        storage.setCurrentUser(res.user);
        setCurrentUser(res.user);
        setIsBackendConnected(true);
        await refreshData();
        showToast(`Welcome back, ${res.user.name}!`, 'success');
        return { success: true };
      }
      return { success: false, error: 'Authentication failed' };
    } catch (apiErr: any) {
      console.warn('Backend API login error:', apiErr);

      // Check if it's a network error (e.g. ngrok offline / unreachable) vs invalid credentials
      const isNetworkError = !apiErr.status || apiErr.message?.includes('Failed to fetch') || apiErr.status >= 500;

      if (isNetworkError) {
        // Fallback to local authentication so user can still test/use app offline
        const localRes = storage.authenticate(username, pass);
        if (localRes.user) {
          setCurrentUser(localRes.user);
          setIsBackendConnected(false);
          await refreshData();
          showToast(`Logged in as ${localRes.user.name} (Offline fallback mode)`, 'info');
          return { success: true };
        }
        return { success: false, error: `Backend unavailable and ${localRes.error || 'user not found'}` };
      }

      // If backend responded with 400 or 401
      return { success: false, error: apiErr.message || 'Invalid username or password' };
    }
  };

  const logout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    showToast('Logged out successfully', 'info');
  };

  const createUserAccount = async (payload: UserCreatePayload): Promise<User> => {
    try {
      // Primary: API
      const newUser = await usersApi.createUser(payload);
      showToast(`Employee "${newUser.name}" created via API`, 'success');
      await refreshData();
      return newUser;
    } catch (err: any) {
      console.warn('Backend user creation failed, attempting local fallback:', err);
      // Fallback
      const fallback = storage.createUser({
        username: payload.username,
        name: [payload.first_name, payload.last_name].filter(Boolean).join(' ') || payload.username,
        role: (payload.role as UserRole) || 'LABOUR',
        password: payload.password
      });
      showToast(`Employee saved (Offline mode): ${err.message || ''}`, 'info');
      await refreshData();
      return fallback;
    }
  };

  const updateUserAccount = async (userId: string, payload: UserUpdatePayload): Promise<User> => {
    try {
      const updated = await usersApi.updateUser(userId, payload);
      showToast('Employee updated via API', 'success');
      await refreshData();
      return updated;
    } catch (err: any) {
      console.warn('Backend user update failed, using local update:', err);
      const updated = storage.updateUser(userId, {
        name: [payload.first_name, payload.last_name].filter(Boolean).join(' '),
        role: payload.role as UserRole
      });
      showToast('Employee updated in local storage', 'info');
      await refreshData();
      return updated;
    }
  };

  const changeUserPassword = async (userId: string, newPassword: string): Promise<void> => {
    try {
      await usersApi.changePassword(userId, newPassword);
      storage.changeUserPassword(userId, newPassword);
      showToast('Password updated successfully via API', 'success');
    } catch (err: any) {
      console.warn('Backend password change failed, falling back to local storage:', err);
      storage.changeUserPassword(userId, newPassword);
      showToast(`Password updated in local storage (${err.message || 'API error'})`, 'info');
    }
  };

  // Master Data API operations
  const masterAdd = async (entity: MasterEntityType, content: Record<string, any>) => {
    try {
      const payloadContent = { ...content };
      if (entity === 'businessclient') {
        if (payloadContent.type) payloadContent.type = String(payloadContent.type).toLowerCase();
        if (payloadContent.flag) payloadContent.flag = String(payloadContent.flag).toLowerCase();
      }
      const res = await masterApi.add(entity, payloadContent);
      showToast(`${entity} added via API`, 'success');
      await refreshData();
      return res;
    } catch (err: any) {
      console.warn(`Backend master add for ${entity} failed, saving to local store:`, err);
      let localSaved: any;
      if (entity === 'commodity') {
        localSaved = storage.saveCommodity({ name: content.name, type: content.type, notes: content.notes });
      } else if (entity === 'businessclient') {
        localSaved = storage.saveClient(content as any);
      } else if (entity === 'broker') {
        localSaved = storage.saveBroker({ name: content.name, phone_number: content.phone_number, phone: content.phone_number, city: content.city, notes: content.notes });
      } else if (entity === 'transporter') {
        localSaved = storage.saveTransporter({ name: content.name, agency: content.agency, phone_number: content.phone_number, phone: content.phone_number, city: content.city, notes: content.notes });
      }
      showToast(`${entity} saved in local storage (${err.message || 'Offline'})`, 'info');
      await refreshData();
      return localSaved;
    }
  };

  const masterUpdate = async (entity: MasterEntityType, id: string | number, content: Record<string, any>) => {
    try {
      const payloadContent = { ...content };
      if (entity === 'businessclient') {
        if (payloadContent.type) payloadContent.type = String(payloadContent.type).toLowerCase();
        if (payloadContent.flag) payloadContent.flag = String(payloadContent.flag).toLowerCase();
      }
      const res = await masterApi.update(entity, id, payloadContent);
      showToast(`${entity} updated via API`, 'success');
      await refreshData();
      return res;
    } catch (err: any) {
      console.warn(`Backend master update for ${entity} failed, saving locally:`, err);
      const strId = String(id);
      if (entity === 'commodity') {
        storage.saveCommodity({ id: strId, name: content.name, type: content.type, notes: content.notes });
      } else if (entity === 'businessclient') {
        storage.saveClient({ id: strId, ...content } as any);
      } else if (entity === 'broker') {
        storage.saveBroker({ id: strId, name: content.name, phone_number: content.phone_number, phone: content.phone_number, city: content.city, notes: content.notes });
      } else if (entity === 'transporter') {
        storage.saveTransporter({ id: strId, name: content.name, agency: content.agency, phone_number: content.phone_number, phone: content.phone_number, city: content.city, notes: content.notes });
      }
      showToast(`${entity} updated in local storage (${err.message || 'Offline'})`, 'info');
      await refreshData();
      return content;
    }
  };

  const masterDelete = async (entity: MasterEntityType, id: string | number) => {
    try {
      await masterApi.delete(entity, id);
      showToast(`${entity} removed via API`, 'success');
    } catch (err: any) {
      console.warn(`Backend master delete for ${entity} failed:`, err);
      showToast(`Removed in local state (${err.message || 'Offline'})`, 'info');
    }
    const strId = String(id);
    if (entity === 'commodity') storage.deleteCommodity(strId);
    if (entity === 'businessclient') storage.deleteClient(strId);
    if (entity === 'broker') storage.deleteBroker(strId);
    if (entity === 'transporter') storage.deleteTransporter(strId);
    await refreshData();
  };

  const masterSearch = async (entity: MasterEntityType, search: string, filters: Record<string, any> = {}) => {
    try {
      return await masterApi.search(entity, search, filters);
    } catch (err) {
      console.warn(`Backend master search for ${entity} failed:`, err);
      return [];
    }
  };

  const masterList = async (entity: MasterEntityType, filters: Record<string, any> = {}, page = 1, pageSize = 50) => {
    try {
      return await masterApi.list(entity, filters, page, pageSize);
    } catch (err) {
      console.warn(`Backend master list for ${entity} failed:`, err);
      return [];
    }
  };

  // Orders API Operations
  const orderAdd = async (orderData: Partial<Order>): Promise<Order> => {
    try {
      const payload = toBackendCreateSchema(orderData);
      const apiOrder = await ordersApi.add(payload);
      storage.saveOrder(apiOrder as any);
      await refreshData();
      return apiOrder;
    } catch (err: any) {
      console.warn('Backend order add failed, using local storage:', err);
      const localSaved = storage.saveOrder(orderData as any);
      await refreshData();
      return localSaved;
    }
  };

  const orderUpdate = async (id: string | number, orderData: Partial<Order>): Promise<Order> => {
    try {
      const payload = toBackendUpdateSchema(id, orderData);
      const apiOrder = await ordersApi.update(payload);
      storage.saveOrder(apiOrder as any);
      await refreshData();
      return apiOrder;
    } catch (err: any) {
      console.warn('Backend order update failed, using local storage:', err);
      const localUpdated = storage.saveOrder({ ...orderData, id: String(id) } as any);
      await refreshData();
      return localUpdated;
    }
  };

  const orderDelete = async (id: string | number): Promise<void> => {
    try {
      await ordersApi.delete(id);
    } catch (err) {
      console.warn('Backend order delete failed:', err);
    } finally {
      storage.deleteOrder(String(id));
      await refreshData();
    }
  };

  const orderGet = async (id: string | number): Promise<Order> => {
    try {
      return await ordersApi.get(id);
    } catch (err) {
      console.warn(`Backend order get for ${id} failed, using local store:`, err);
      const local = storage.getOrders().find(o => o.id === String(id));
      if (!local) throw err;
      return local;
    }
  };

  const transportGet = async (id: string): Promise<Transport> => {
    const transport = await transportsApi.get(id, { clients, commodities, orders, transporters });
    setTransports(previous => [transport, ...previous.filter(item => item.id !== transport.id)]);
    return transport;
  };

  const orderListPaginated = useCallback(async (filters: OrderListSchema = {}): Promise<PaginatedOrdersResult> => {
    const result = await ordersApi.listPaginated(filters);
    const normalizedResults = result.results.map(order =>
      resolveOrderRelations(order, clients, commodities, brokers)
    );

    setOrders(previousOrders => {
      const ordersById = new Map(previousOrders.map(order => [order.id, order]));
      normalizedResults.forEach(order => ordersById.set(order.id, order));
      const updatedOrders = Array.from(ordersById.values());
      storage.setOrders(updatedOrders);
      return updatedOrders;
    });

    return { ...result, results: normalizedResults };
  }, [clients, commodities, brokers]);

  const orderSelect = async (filters: OrderSelectSchema = {}): Promise<any[]> => {
    try {
      return await ordersApi.select(filters);
    } catch (err) {
      console.warn('Backend order select failed, using local storage:', err);
      return storage.getOrders().map(o => ({
        id: o.id,
        order_no: o.orderNumber,
        type: o.type === 'PURCHASE ORDER' ? 'purchase_order' : 'sales_order',
        status: o.status.toLowerCase()
      }));
    }
  };

  const resetAllDemoData = () => {
    storage.resetToDefault();
    setCurrentUser(storage.getCurrentUser());
    refreshData();
    showToast('Reset all demo data to default successfully', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        currentPage,
        pageParams,
        navigate,
        masterDataTab,
        setMasterDataTab,
        users,
        commodities,
        clients,
        brokers,
        transporters,
        orders,
        transports,
        createUserAccount,
        updateUserAccount,
        changeUserPassword,
        masterAdd,
        masterUpdate,
        masterDelete,
        masterSearch,
        masterList,
        orderAdd,
        orderUpdate,
        orderDelete,
        orderGet,
        orderListPaginated,
        orderSelect,
        transportGet,
        refreshData,
        resetAllDemoData,
        toasts,
        showToast,
        dismissToast,
        mobileMenuOpen,
        setMobileMenuOpen,
        isBackendConnected
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
