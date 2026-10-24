import {
  User,
  Commodity,
  BusinessClient,
  Broker,
  Transporter,
  Order,
  Transport,
  UserRole
} from '../types';

const STORAGE_KEYS = {
  USERS: 'vistar_users_v1',
  COMMODITIES: 'vistar_commodities_v1',
  CLIENTS: 'vistar_clients_v1',
  BROKERS: 'vistar_brokers_v1',
  TRANSPORTERS: 'vistar_transporters_v1',
  ORDERS: 'vistar_orders_v1',
  TRANSPORTS: 'vistar_transports_v1',
  CURRENT_USER: 'vistar_current_user_v1'
};

const LEGACY_DEMO_IDS: Record<string, string[]> = {
  [STORAGE_KEYS.USERS]: ['usr-1', 'usr-2', 'usr-3'],
  [STORAGE_KEYS.COMMODITIES]: ['com-1', 'com-2', 'com-3', 'com-4', 'com-5', 'com-6'],
  [STORAGE_KEYS.CLIENTS]: ['cli-1', 'cli-2', 'cli-3', 'cli-4', 'cli-5', 'cli-6', 'cli-7', 'cli-8'],
  [STORAGE_KEYS.BROKERS]: ['brk-1', 'brk-2', 'brk-3'],
  [STORAGE_KEYS.TRANSPORTERS]: ['trp-1', 'trp-2', 'trp-3', 'trp-4'],
  [STORAGE_KEYS.ORDERS]: ['ord-101', 'ord-102', 'ord-103', 'ord-104', 'ord-105'],
  [STORAGE_KEYS.TRANSPORTS]: ['trp-entry-1', 'trp-entry-2', 'trp-entry-3', 'trp-entry-4', 'trp-entry-5', 'trp-entry-6']
};

class StorageService {
  private get<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (err) {
      console.error(`Error reading ${key} from storage:`, err);
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Error writing ${key} to storage:`, err);
    }
  }

  public init() {
    if (localStorage.getItem('vistar_demo_data_removed_v1') === 'true') return;

    for (const [key, demoIds] of Object.entries(LEGACY_DEMO_IDS)) {
      const records = this.get<Array<{ id: string }>>(key, []);
      this.set(key, records.filter(record => !demoIds.includes(record.id)));
    }

    const currentUser = this.get<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (currentUser && LEGACY_DEMO_IDS[STORAGE_KEYS.USERS].includes(currentUser.id)) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }

    const passwords = this.get<Record<string, string>>('vistar_passwords', {});
    LEGACY_DEMO_IDS[STORAGE_KEYS.USERS].forEach(id => delete passwords[id]);
    this.set('vistar_passwords', passwords);
    localStorage.setItem('vistar_demo_data_removed_v1', 'true');
  }

  // --- Auth & Users ---
  public getCurrentUser(): User | null {
    this.init();
    return this.get<User | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  public setCurrentUser(user: User): void {
    this.set(STORAGE_KEYS.CURRENT_USER, user);
  }

  public authenticate(username: string, password: string): { user: User | null; error?: string } {
    this.init();
    const users = this.get<User[]>(STORAGE_KEYS.USERS, []);
    const passwords = JSON.parse(localStorage.getItem('vistar_passwords') || '{}');
    
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user) {
      return { user: null, error: 'User does not exist' };
    }
    if (user.status === 'DISABLED') {
      return { user: null, error: 'This user account has been disabled. Contact owner.' };
    }
    if (passwords[user.id] !== password) {
      return { user: null, error: 'Invalid password' };
    }
    this.setCurrentUser(user);
    return { user };
  }

  public getUsers(): User[] {
    this.init();
    return this.get<User[]>(STORAGE_KEYS.USERS, []);
  }

  public createUser(userData: { username: string; name: string; role: UserRole; password: string }): User {
    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
      throw new Error(`Username "${userData.username}" is already taken.`);
    }
    const newUser: User = {
      id: `usr-${Date.now()}`,
      username: userData.username.trim(),
      name: userData.name.trim(),
      role: userData.role,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0]
    };
    users.push(newUser);
    this.set(STORAGE_KEYS.USERS, users);

    const passwords = JSON.parse(localStorage.getItem('vistar_passwords') || '{}');
    passwords[newUser.id] = userData.password;
    localStorage.setItem('vistar_passwords', JSON.stringify(passwords));

    return newUser;
  }

  public updateUser(id: string, updates: Partial<Pick<User, 'name' | 'role' | 'status'>>): User {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    users[index] = { ...users[index], ...updates };
    this.set(STORAGE_KEYS.USERS, users);

    // If updating current user
    const cur = this.getCurrentUser();
    if (cur?.id === id) {
      this.setCurrentUser(users[index]);
    }
    return users[index];
  }

  public changeUserPassword(id: string, newPass: string): void {
    const passwords = JSON.parse(localStorage.getItem('vistar_passwords') || '{}');
    passwords[id] = newPass;
    localStorage.setItem('vistar_passwords', JSON.stringify(passwords));
  }

  // --- Master Data: Commodities ---
  public getCommodities(): Commodity[] {
    this.init();
    return this.get<Commodity[]>(STORAGE_KEYS.COMMODITIES, []);
  }

  public saveCommodity(commodity: Omit<Commodity, 'id' | 'createdAt'> & { id?: string }): Commodity {
    const items = this.getCommodities();
    if (commodity.id) {
      const idx = items.findIndex(i => i.id === commodity.id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...commodity, updatedAt: new Date().toISOString().split('T')[0] };
        this.set(STORAGE_KEYS.COMMODITIES, items);
        return items[idx];
      }
    }
    const newItem: Commodity = {
      id: `com-${Date.now()}`,
      name: commodity.name.trim(),
      type: commodity.type.trim(),
      notes: commodity.notes?.trim() || '',
      createdAt: new Date().toISOString().split('T')[0]
    };
    items.push(newItem);
    this.set(STORAGE_KEYS.COMMODITIES, items);
    return newItem;
  }

  public deleteCommodity(id: string): void {
    const items = this.getCommodities().filter(i => i.id !== id);
    this.set(STORAGE_KEYS.COMMODITIES, items);
  }

  // --- Master Data: Clients ---
  public getClients(): BusinessClient[] {
    this.init();
    return this.get<BusinessClient[]>(STORAGE_KEYS.CLIENTS, []);
  }

  public saveClient(client: Omit<BusinessClient, 'id' | 'createdAt'> & { id?: string }): BusinessClient {
    const items = this.getClients();
    if (client.id) {
      const idx = items.findIndex(i => i.id === client.id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...client };
        this.set(STORAGE_KEYS.CLIENTS, items);
        return items[idx];
      }
    }
    const newItem: BusinessClient = {
      id: `cli-${Date.now()}`,
      ...client,
      createdAt: new Date().toISOString().split('T')[0]
    };
    items.push(newItem);
    this.set(STORAGE_KEYS.CLIENTS, items);
    return newItem;
  }

  public deleteClient(id: string): void {
    const items = this.getClients().filter(i => i.id !== id);
    this.set(STORAGE_KEYS.CLIENTS, items);
  }

  // --- Master Data: Brokers ---
  public getBrokers(): Broker[] {
    this.init();
    return this.get<Broker[]>(STORAGE_KEYS.BROKERS, []);
  }

  public saveBroker(broker: Omit<Broker, 'id' | 'createdAt'> & { id?: string }): Broker {
    const items = this.getBrokers();
    if (broker.id) {
      const idx = items.findIndex(i => i.id === broker.id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...broker };
        this.set(STORAGE_KEYS.BROKERS, items);
        return items[idx];
      }
    }
    const newItem: Broker = {
      id: `brk-${Date.now()}`,
      ...broker,
      createdAt: new Date().toISOString().split('T')[0]
    };
    items.push(newItem);
    this.set(STORAGE_KEYS.BROKERS, items);
    return newItem;
  }

  public deleteBroker(id: string): void {
    const items = this.getBrokers().filter(i => i.id !== id);
    this.set(STORAGE_KEYS.BROKERS, items);
  }

  // --- Master Data: Transporters ---
  public getTransporters(): Transporter[] {
    this.init();
    return this.get<Transporter[]>(STORAGE_KEYS.TRANSPORTERS, []);
  }

  public saveTransporter(transporter: Omit<Transporter, 'id' | 'createdAt'> & { id?: string }): Transporter {
    const items = this.getTransporters();
    if (transporter.id) {
      const idx = items.findIndex(i => i.id === transporter.id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...transporter };
        this.set(STORAGE_KEYS.TRANSPORTERS, items);
        return items[idx];
      }
    }
    const newItem: Transporter = {
      id: `trp-${Date.now()}`,
      ...transporter,
      createdAt: new Date().toISOString().split('T')[0]
    };
    items.push(newItem);
    this.set(STORAGE_KEYS.TRANSPORTERS, items);
    return newItem;
  }

  public deleteTransporter(id: string): void {
    const items = this.getTransporters().filter(i => i.id !== id);
    this.set(STORAGE_KEYS.TRANSPORTERS, items);
  }

  // --- Orders ---
  public getOrders(): Order[] {
    this.init();
    return this.get<Order[]>(STORAGE_KEYS.ORDERS, []);
  }

  public getOrderById(id: string): Order | undefined {
    return this.getOrders().find(o => o.id === id);
  }

  public setOrders(orders: Order[]): void {
    this.set(STORAGE_KEYS.ORDERS, orders);
  }

  public saveOrder(order: Omit<Order, 'id' | 'createdAt' | 'quantityFulfilled'> & { id?: string; quantityFulfilled?: number }): Order {
    const orders = this.getOrders();
    if (order.id) {
      const idx = orders.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        const existing = orders[idx];
        const updated: Order = {
          ...existing,
          ...order,
          quantityFulfilled: order.quantityFulfilled !== undefined ? order.quantityFulfilled : existing.quantityFulfilled,
          status: (order.quantityFulfilled !== undefined ? order.quantityFulfilled : existing.quantityFulfilled) >= order.quantity ? 'COMPLETED' : order.status,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        orders[idx] = updated;
        this.set(STORAGE_KEYS.ORDERS, orders);
        return updated;
      }
    }

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      ...order,
      quantityFulfilled: order.quantityFulfilled || 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    orders.unshift(newOrder);
    this.set(STORAGE_KEYS.ORDERS, orders);
    return newOrder;
  }

  public deleteOrder(id: string): void {
    const orders = this.getOrders().filter(o => o.id !== id);
    this.set(STORAGE_KEYS.ORDERS, orders);
  }

  // Recalculates fulfillment of orders based on all registered transport items
  public syncOrderFulfillments(): void {
    const orders = this.getOrders();
    const transports = this.getTransports();

    // Map orderId to total allocated quantity
    const fulfillmentMap: Record<string, number> = {};
    for (const t of transports) {
      for (const item of t.items) {
        if (!fulfillmentMap[item.orderId]) fulfillmentMap[item.orderId] = 0;
        fulfillmentMap[item.orderId] += Number(item.allocatedQuantity || 0);
      }
    }

    let modified = false;
    for (const o of orders) {
      const fulfilled = Math.round((fulfillmentMap[o.id] || 0) * 100) / 100;
      if (o.quantityFulfilled !== fulfilled) {
        o.quantityFulfilled = fulfilled;
        o.status = fulfilled >= o.quantity ? 'COMPLETED' : 'PENDING';
        modified = true;
      }
    }

    if (modified) {
      this.set(STORAGE_KEYS.ORDERS, orders);
    }
  }

  // --- Transport ---
  public getTransports(): Transport[] {
    this.init();
    return this.get<Transport[]>(STORAGE_KEYS.TRANSPORTS, []);
  }

  public getTransportById(id: string): Transport | undefined {
    return this.getTransports().find(t => t.id === id);
  }

  public getTransportsByOrderId(orderId: string): Transport[] {
    return this.getTransports().filter(t => t.items.some(i => i.orderId === orderId));
  }

  public saveTransport(transportData: Omit<Transport, 'id' | 'createdAt'> & { id?: string }): Transport {
    const transports = this.getTransports();
    let saved: Transport;

    if (transportData.id) {
      const idx = transports.findIndex(t => t.id === transportData.id);
      if (idx !== -1) {
        saved = {
          ...transports[idx],
          ...transportData,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        transports[idx] = saved;
      } else {
        throw new Error('Transport not found');
      }
    } else {
      saved = {
        id: `trp-entry-${Date.now()}`,
        ...transportData,
        createdAt: new Date().toISOString().split('T')[0]
      };
      transports.unshift(saved);
    }

    this.set(STORAGE_KEYS.TRANSPORTS, transports);
    this.syncOrderFulfillments();
    return saved;
  }

  public createBulkTransports(transportsList: Array<Omit<Transport, 'id' | 'createdAt'>>): Transport[] {
    const transports = this.getTransports();
    const created: Transport[] = [];
    const today = new Date().toISOString().split('T')[0];

    transportsList.forEach((item, index) => {
      const newTrp: Transport = {
        id: `trp-entry-${Date.now()}-${index}`,
        ...item,
        createdAt: today
      };
      created.push(newTrp);
      transports.unshift(newTrp);
    });

    this.set(STORAGE_KEYS.TRANSPORTS, transports);
    this.syncOrderFulfillments();
    return created;
  }

  public updateTransportStatus(id: string, newStatus: Transport['status']): Transport {
    const transports = this.getTransports();
    const idx = transports.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transport not found');
    
    transports[idx].status = newStatus;
    transports[idx].updatedAt = new Date().toISOString().split('T')[0];
    this.set(STORAGE_KEYS.TRANSPORTS, transports);
    return transports[idx];
  }

  public deleteTransport(id: string): void {
    const transports = this.getTransports().filter(t => t.id !== id);
    this.set(STORAGE_KEYS.TRANSPORTS, transports);
    this.syncOrderFulfillments();
  }
}

export const storage = new StorageService();
