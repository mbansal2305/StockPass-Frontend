import {
  User,
  Commodity,
  BusinessClient,
  Broker,
  Transporter,
  Order,
  Transport,
  TransportItem,
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

const SEED_USERS: User[] = [
  {
    id: 'usr-1',
    username: 'owner',
    name: 'Rajesh Sharma',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: '2026-01-15'
  },
  {
    id: 'usr-2',
    username: 'accountant',
    name: 'Amit Verma',
    role: 'ACCOUNTANT',
    status: 'ACTIVE',
    createdAt: '2026-02-01'
  },
  {
    id: 'usr-3',
    username: 'labour',
    name: 'Suresh Yadav',
    role: 'LABOUR',
    status: 'ACTIVE',
    createdAt: '2026-02-10'
  }
];

// Plaintext pass simulation for the simple internal tool
const USER_PASSWORDS: Record<string, string> = {
  'usr-1': 'owner123',
  'usr-2': 'acc123',
  'usr-3': 'labour123'
};

const SEED_COMMODITIES: Commodity[] = [
  { id: 'com-1', name: 'Sharbati Wheat', type: 'Grain', createdAt: '2026-01-10' },
  { id: 'com-2', name: 'Yellow Soybean', type: 'Oilseed', createdAt: '2026-01-10' },
  { id: 'com-3', name: 'Basmati Rice (1121)', type: 'Grain', createdAt: '2026-01-12' },
  { id: 'com-4', name: 'Desi Chana (Gram)', type: 'Pulse', createdAt: '2026-01-14' },
  { id: 'com-5', name: 'Yellow Maize', type: 'Grain', createdAt: '2026-01-20' },
  { id: 'com-6', name: 'Mustard Seeds', type: 'Oilseed', createdAt: '2026-02-05' }
];

const SEED_CLIENTS: BusinessClient[] = [
  {
    id: 'cli-1',
    name: 'Om Agro Commodities Pvt Ltd',
    address: 'Plot 42, Sanwer Road Industrial Area',
    city: 'Indore',
    pincode: '452015',
    type: 'MY_FIRM',
    flag: 'GOOD',
    phone: '+91 98260 11223',
    gstin: '23AAFCO1234F1Z5',
    createdAt: '2026-01-01'
  },
  {
    id: 'cli-2',
    name: 'Indore Central Godown #4',
    address: 'Laxmibai Nagar Mandi Complex',
    city: 'Indore',
    pincode: '452006',
    type: 'MY_GODOWN',
    flag: 'GOOD',
    phone: '+91 98261 44556',
    createdAt: '2026-01-05'
  },
  {
    id: 'cli-3',
    name: 'Bhopal Mandi Silo Facility',
    address: 'Karond Mandi By-Pass',
    city: 'Bhopal',
    pincode: '462038',
    type: 'MY_GODOWN',
    flag: 'GOOD',
    phone: '+91 75529 88990',
    createdAt: '2026-01-08'
  },
  {
    id: 'cli-4',
    name: 'ITC Choupal Sagar Hub',
    address: 'NH-86 Agra-Bombay Road',
    city: 'Sehore',
    pincode: '466001',
    type: 'COMPANY',
    flag: 'GOOD',
    phone: '+91 75622 33445',
    gstin: '23AAACI1681G1ZM',
    createdAt: '2026-01-12'
  },
  {
    id: 'cli-5',
    name: 'Adani Wilmar Processing Plant',
    address: 'Sagar Road Industrial Area',
    city: 'Vidisha',
    pincode: '464001',
    type: 'COMPANY',
    flag: 'GOOD',
    phone: '+91 75924 55667',
    gstin: '23AABCA2211C1ZX',
    createdAt: '2026-01-15'
  },
  {
    id: 'cli-6',
    name: 'Dewas Krishi Mandi Yard #2',
    address: 'Station Road Krishi Upaj Mandi',
    city: 'Dewas',
    pincode: '455001',
    type: 'LOCATION',
    flag: 'GOOD',
    phone: '+91 72722 77889',
    createdAt: '2026-01-18'
  },
  {
    id: 'cli-7',
    name: 'Vidisha Regional Agro Warehouse',
    address: 'Warehouse No 12, Puranpura',
    city: 'Vidisha',
    pincode: '464001',
    type: 'OTHER_GODOWN',
    flag: 'UNREASONABLE_CLAIMS',
    phone: '+91 75922 99001',
    createdAt: '2026-01-22'
  },
  {
    id: 'cli-8',
    name: 'Shree Balaji Traders',
    address: 'Mandi Gate, Ganj Basoda',
    city: 'Ganj Basoda',
    pincode: '464221',
    type: 'COMPANY',
    flag: 'NEUTRAL',
    phone: '+91 94250 88991',
    createdAt: '2026-02-01'
  }
];

const SEED_BROKERS: Broker[] = [
  { id: 'brk-1', name: 'Suresh Bhai Brokerage', phone_number: '+91 98260 55441', phone: '+91 98260 55441', city: 'Indore', notes: 'Top wheat broker in Malwa region', createdAt: '2026-01-10' },
  { id: 'brk-2', name: 'Jagdish Sharma Dalal', phone_number: '+91 94250 66772', phone: '+91 94250 66772', city: 'Bhopal', notes: 'Pulse & Soybean specialist', createdAt: '2026-01-12' },
  { id: 'brk-3', name: 'Rameshwar & Sons Dalali', phone_number: '+91 98270 33221', phone: '+91 98270 33221', city: 'Dewas', notes: 'Mandi direct auctions', createdAt: '2026-01-15' }
];

const SEED_TRANSPORTERS: Transporter[] = [
  { id: 'trp-1', name: 'Mahesh Sharma', agency: 'Sharma Goods Transport Co.', phone_number: '+91 98261 99001', phone: '+91 98261 99001', city: 'Indore', contactPerson: 'Mahesh Sharma', notes: 'Own fleet of 25 10-wheeler trucks', createdAt: '2026-01-10' },
  { id: 'trp-2', name: 'Bhim Singh Rajput', agency: 'Rajput Roadways Logistics', phone_number: '+91 94251 44332', phone: '+91 94251 44332', city: 'Bhopal', contactPerson: 'Bhim Singh Rajput', notes: 'Prompt delivery with GPS tracking', createdAt: '2026-01-12' },
  { id: 'trp-3', name: 'Dinesh Patel', agency: 'Malwa Freight Carrier', phone_number: '+91 98264 12345', phone: '+91 98264 12345', city: 'Ujjain', contactPerson: 'Dinesh Patel', notes: 'Trailer & bulk trucks available', createdAt: '2026-01-15' },
  { id: 'trp-4', name: 'Govind Patel', agency: 'Patel Roadways', phone_number: '+91 98270 99887', phone: '+91 98270 99887', city: 'Dewas', contactPerson: 'Govind Patel', notes: 'Reliable local mandi feeder', createdAt: '2026-01-20' }
];

const SEED_ORDERS: Order[] = [
  {
    id: 'ord-101',
    type: 'SALES ORDER',
    orderNumber: 'SO-2026-088',
    fromClientId: 'cli-2', // Indore Central Godown #4
    toClientId: 'cli-4', // ITC Choupal Sagar Hub
    commodityId: 'com-1', // Sharbati Wheat
    rate: 28500, // ₹28,500 / MT
    quantity: 120, // 120 MT
    startDate: '2026-09-10',
    expiryDate: '2026-10-05',
    quantityFulfilled: 74,
    brokerId: 'brk-1',
    status: 'PENDING',
    notes: 'Premium grade Sharbati wheat, max moisture 11.5%. Inspection at gate.',
    createdAt: '2026-09-10'
  },
  {
    id: 'ord-102',
    type: 'PURCHASE ORDER',
    orderNumber: 'PO-2026-054',
    fromClientId: 'cli-6', // Dewas Krishi Mandi Yard #2
    toClientId: 'cli-1', // Om Agro Commodities Pvt Ltd (My Firm)
    commodityId: 'com-2', // Yellow Soybean
    rate: 46200, // ₹46,200 / MT
    quantity: 80, // 80 MT
    startDate: '2026-09-15',
    expiryDate: '2026-09-28', // Nearing expiry!
    quantityFulfilled: 80,
    brokerId: 'brk-2',
    status: 'COMPLETED',
    notes: 'Direct Mandi auction purchase, prompt lifting required.',
    createdAt: '2026-09-15'
  },
  {
    id: 'ord-103',
    type: 'SALES ORDER',
    orderNumber: 'SO-2026-092',
    fromClientId: 'cli-3', // Bhopal Mandi Silo
    toClientId: 'cli-5', // Adani Wilmar
    commodityId: 'com-2', // Yellow Soybean
    rate: 47800, // ₹47,800 / MT
    quantity: 150, // 150 MT
    startDate: '2026-09-18',
    expiryDate: '2026-09-30', // Nearing expiry!
    quantityFulfilled: 48,
    brokerId: 'brk-2',
    status: 'PENDING',
    notes: 'High oil content lot. Delivery to Vidisha processing plant.',
    createdAt: '2026-09-18'
  },
  {
    id: 'ord-104',
    type: 'SALES ORDER',
    orderNumber: 'SO-2026-095',
    fromClientId: 'cli-2', // Indore Central Godown
    toClientId: 'cli-8', // Shree Balaji Traders
    commodityId: 'com-4', // Desi Chana
    rate: 59000,
    quantity: 60,
    startDate: '2026-09-20',
    expiryDate: '2026-10-15',
    quantityFulfilled: 0,
    brokerId: 'brk-3',
    status: 'PENDING',
    notes: 'Payment within 7 days of delivery confirmation.',
    createdAt: '2026-09-20'
  },
  {
    id: 'ord-105',
    type: 'PURCHASE ORDER',
    orderNumber: 'PO-2026-061',
    fromClientId: 'cli-6',
    toClientId: 'cli-2',
    commodityId: 'com-3', // Basmati Rice
    rate: 68000,
    quantity: 100,
    startDate: '2026-09-22',
    expiryDate: '2026-10-20',
    quantityFulfilled: 25,
    brokerId: 'brk-1',
    status: 'PENDING',
    notes: 'Aged basmati, fumigation certificate attached.',
    createdAt: '2026-09-22'
  }
];

const SEED_TRANSPORTS: Transport[] = [
  {
    id: 'trp-entry-1',
    billNumber: 'BIL-2026-0341',
    billingFirmId: 'cli-1',
    commodityId: 'com-1', // Sharbati Wheat
    fromClientId: 'cli-2',
    toClientId: 'cli-4',
    vehicleNumber: 'MP09HH4521',
    transporterId: 'trp-1',
    grossWeight: 26.5,
    bagNumbers: 530,
    bagWeight: 50,
    anugya: 'AG-99214',
    gatepass: 'GP-8812',
    rent: 28500,
    advanceByClient: 0,
    advanceByFirm: 15000,
    finalPaid: 13500,
    unloadDate: '2026-09-12',
    receivedWeight: 26.48,
    sourceWeightReceipt: 'RCPT-WB-09-4521',
    destinationWeightReceipt: 'ITC-WB-6712',
    status: 'PAID',
    items: [{ orderId: 'ord-101', allocatedQuantity: 26.5 }],
    notes: 'Smooth delivery, weight variance negligible (20 kg).',
    createdBy: 'Rajesh Sharma',
    createdAt: '2026-09-11'
  },
  {
    id: 'trp-entry-2',
    billNumber: 'BIL-2026-0348',
    billingFirmId: 'cli-1',
    commodityId: 'com-1', // Sharbati Wheat
    fromClientId: 'cli-2',
    toClientId: 'cli-4',
    vehicleNumber: 'MP04K7812',
    transporterId: 'trp-2',
    grossWeight: 24.0,
    bagNumbers: 480,
    bagWeight: 50,
    anugya: 'AG-99304',
    gatepass: 'GP-8850',
    rent: 26000,
    advanceByClient: 0,
    advanceByFirm: 16000,
    finalPaid: 9900,
    unloadDate: '2026-09-15',
    receivedWeight: 23.95,
    sourceWeightReceipt: 'RCPT-WB-04-7812',
    destinationWeightReceipt: 'ITC-WB-6789',
    status: 'PAID',
    items: [{ orderId: 'ord-101', allocatedQuantity: 24.0 }],
    notes: 'Settled minus 100 Rs tare deduction.',
    createdBy: 'Amit Verma',
    createdAt: '2026-09-14'
  },
  {
    id: 'trp-entry-3',
    billNumber: 'BIL-2026-0360',
    billingFirmId: 'cli-1',
    commodityId: 'com-1', // Sharbati Wheat
    fromClientId: 'cli-2',
    toClientId: 'cli-4',
    vehicleNumber: 'MP09GF3319',
    transporterId: 'trp-1',
    grossWeight: 23.5,
    bagNumbers: 470,
    bagWeight: 50,
    anugya: 'AG-99411',
    gatepass: 'GP-8902',
    rent: 25500,
    advanceByClient: 0,
    advanceByFirm: 15000,
    finalPaid: 0,
    unloadDate: '2026-09-24',
    receivedWeight: 23.42,
    sourceWeightReceipt: 'RCPT-WB-09-3319',
    destinationWeightReceipt: 'ITC-WB-6890',
    status: 'FINANCE',
    items: [{ orderId: 'ord-101', allocatedQuantity: 23.5 }],
    notes: 'Unloaded yesterday. Awaiting final freight balance approval.',
    createdBy: 'Suresh Yadav',
    createdAt: '2026-09-23'
  },
  {
    id: 'trp-entry-4',
    billNumber: 'BIL-2026-0365',
    billingFirmId: 'cli-1',
    commodityId: 'com-2', // Yellow Soybean
    fromClientId: 'cli-3',
    toClientId: 'cli-5',
    vehicleNumber: 'MP13ZB9012',
    transporterId: 'trp-3',
    grossWeight: 25.0,
    bagNumbers: 500,
    bagWeight: 50,
    anugya: 'AG-99480',
    gatepass: 'GP-8940',
    rent: 22000,
    advanceByClient: 0,
    advanceByFirm: 12000,
    finalPaid: 0,
    status: 'DELIVERY',
    items: [{ orderId: 'ord-103', allocatedQuantity: 25.0 }],
    notes: 'Dispatched 2026-09-24. In transit to Vidisha plant.',
    createdBy: 'Suresh Yadav',
    createdAt: '2026-09-24'
  },
  {
    id: 'trp-entry-5',
    billNumber: 'BIL-2026-0369',
    billingFirmId: 'cli-1',
    commodityId: 'com-2', // Yellow Soybean
    fromClientId: 'cli-3',
    toClientId: 'cli-5',
    vehicleNumber: 'MP04L2288',
    transporterId: 'trp-2',
    grossWeight: 23.0,
    bagNumbers: 460,
    bagWeight: 50,
    anugya: 'AG-99501',
    gatepass: 'GP-8965',
    rent: 21500,
    advanceByClient: 0,
    advanceByFirm: 10000,
    finalPaid: 0,
    status: 'PENDING',
    items: [{ orderId: 'ord-103', allocatedQuantity: 23.0 }],
    notes: 'Loading currently underway at Bhopal Silo.',
    createdBy: 'Suresh Yadav',
    createdAt: '2026-09-25'
  },
  {
    id: 'trp-entry-6',
    billNumber: 'BIL-2026-0371',
    billingFirmId: 'cli-1',
    commodityId: 'com-3', // Basmati Rice
    fromClientId: 'cli-6',
    toClientId: 'cli-2',
    vehicleNumber: 'MP09CX7765',
    transporterId: 'trp-4',
    grossWeight: 25.0,
    bagNumbers: 500,
    bagWeight: 50,
    anugya: 'AG-99522',
    gatepass: 'GP-8991',
    rent: 18000,
    advanceByClient: 0,
    advanceByFirm: 10000,
    finalPaid: 0,
    status: 'DELIVERY',
    items: [{ orderId: 'ord-105', allocatedQuantity: 25.0 }],
    notes: 'Moving from Dewas mandi yard to Indore godown.',
    createdBy: 'Suresh Yadav',
    createdAt: '2026-09-25'
  }
];

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
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      this.set(STORAGE_KEYS.USERS, SEED_USERS);
      localStorage.setItem('vistar_passwords', JSON.stringify(USER_PASSWORDS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.COMMODITIES)) {
      this.set(STORAGE_KEYS.COMMODITIES, SEED_COMMODITIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
      this.set(STORAGE_KEYS.CLIENTS, SEED_CLIENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.BROKERS)) {
      this.set(STORAGE_KEYS.BROKERS, SEED_BROKERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSPORTERS)) {
      this.set(STORAGE_KEYS.TRANSPORTERS, SEED_TRANSPORTERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      this.set(STORAGE_KEYS.ORDERS, SEED_ORDERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSPORTS)) {
      this.set(STORAGE_KEYS.TRANSPORTS, SEED_TRANSPORTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      this.set(STORAGE_KEYS.CURRENT_USER, SEED_USERS[0]); // default owner
    }
  }

  public resetToDefault() {
    this.set(STORAGE_KEYS.USERS, SEED_USERS);
    localStorage.setItem('vistar_passwords', JSON.stringify(USER_PASSWORDS));
    this.set(STORAGE_KEYS.COMMODITIES, SEED_COMMODITIES);
    this.set(STORAGE_KEYS.CLIENTS, SEED_CLIENTS);
    this.set(STORAGE_KEYS.BROKERS, SEED_BROKERS);
    this.set(STORAGE_KEYS.TRANSPORTERS, SEED_TRANSPORTERS);
    this.set(STORAGE_KEYS.ORDERS, SEED_ORDERS);
    this.set(STORAGE_KEYS.TRANSPORTS, SEED_TRANSPORTS);
    this.set(STORAGE_KEYS.CURRENT_USER, SEED_USERS[0]);
  }

  // --- Auth & Users ---
  public getCurrentUser(): User {
    this.init();
    return this.get<User>(STORAGE_KEYS.CURRENT_USER, SEED_USERS[0]);
  }

  public setCurrentUser(user: User): void {
    this.set(STORAGE_KEYS.CURRENT_USER, user);
  }

  public authenticate(username: string, password: string): { user: User | null; error?: string } {
    this.init();
    const users = this.get<User[]>(STORAGE_KEYS.USERS, SEED_USERS);
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
    return this.get<User[]>(STORAGE_KEYS.USERS, SEED_USERS);
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
    if (cur.id === id) {
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
    return this.get<Commodity[]>(STORAGE_KEYS.COMMODITIES, SEED_COMMODITIES);
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
    return this.get<BusinessClient[]>(STORAGE_KEYS.CLIENTS, SEED_CLIENTS);
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
    return this.get<Broker[]>(STORAGE_KEYS.BROKERS, SEED_BROKERS);
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
    return this.get<Transporter[]>(STORAGE_KEYS.TRANSPORTERS, SEED_TRANSPORTERS);
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
    return this.get<Order[]>(STORAGE_KEYS.ORDERS, SEED_ORDERS);
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
    return this.get<Transport[]>(STORAGE_KEYS.TRANSPORTS, SEED_TRANSPORTS);
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
