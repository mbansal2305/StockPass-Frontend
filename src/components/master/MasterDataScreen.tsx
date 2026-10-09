import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Commodity, BusinessClient, Broker, Transporter, ClientType, ClientFlag, MasterEntityType } from '../../types';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  ExternalLink,
  Package,
  Building2,
  Users2,
  Truck,
  X,
  MapPin,
  FileText,
  Filter,
  RotateCcw,
  Loader2,
  Phone,
  Info,
  Globe,
  RefreshCw,
  MoreVertical,
  Database
} from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { getClientFlagBadge, getClientTypeLabel } from '../../utils/formatters';
import { getImageSource } from '../../utils/images';

export const MasterDataScreen: React.FC = () => {
  const {
    currentUser,
    masterDataTab,
    setMasterDataTab,
    commodities,
    clients,
    brokers,
    transporters,
    orders,
    transports,
    refreshData,
    showToast,
    navigate,
    masterAdd,
    masterUpdate,
    masterDelete,
    masterSearch,
    masterList,
    isBackendConnected
  } = useApp();

  const isOwner = currentUser?.role === 'OWNER';
  const isLabour = currentUser?.role === 'LABOUR';

  // Global search input for current active tab
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Exact FILTER_FIELDS per entity specification:
  // broker: name, city
  const [brokerFilters, setBrokerFilters] = useState({ name: '', city: '' });

  // businessclient: name, address, city, pincode, type, flag
  const [clientFilters, setClientFilters] = useState({
    name: '',
    address: '',
    city: '',
    pincode: '',
    type: 'ALL',
    flag: 'ALL'
  });

  // commodity: name, type
  const [commodityFilters, setCommodityFilters] = useState({ name: '', type: '' });

  // transporter: name, agency, city
  const [transporterFilters, setTransporterFilters] = useState({ name: '', agency: '', city: '' });

  // Server-fetched datasets for live search/list query
  const [serverData, setServerData] = useState<{
    commodities?: Commodity[] | null;
    clients?: BusinessClient[] | null;
    brokers?: Broker[] | null;
    transporters?: Transporter[] | null;
  }>({});

  // Modals state
  const [commodityModalOpen, setCommodityModalOpen] = useState(false);
  const [editingCommodity, setEditingCommodity] = useState<Commodity | null>(null);
  const [commodityForm, setCommodityForm] = useState<{
    name: string;
    type: string;
    notes: string;
  }>({ name: '', type: 'Grain', notes: '' });

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<BusinessClient | null>(null);
  const [clientForm, setClientForm] = useState<{
    name: string;
    address: string;
    city: string;
    pincode: string;
    maan_no: string;
    type: ClientType;
    flag: ClientFlag;
    location_url: string;
    notes: string;
    profile_picture: string;
  }>({
    name: '',
    address: '',
    city: '',
    pincode: '',
    maan_no: '',
    type: 'company' as ClientType,
    flag: 'good' as ClientFlag,
    location_url: '',
    notes: '',
    profile_picture: ''
  });

  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [brokerForm, setBrokerForm] = useState<{
    name: string;
    phone_number: string;
    city: string;
    notes: string;
  }>({ name: '', phone_number: '', city: '', notes: '' });

  const [transporterModalOpen, setTransporterModalOpen] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<Transporter | null>(null);
  const [transporterForm, setTransporterForm] = useState<{
    name: string;
    agency: string;
    phone_number: string;
    city: string;
    transaction_type: string;
    account_number: string;
    account_name: string;
    bank: string;
    branch: string;
    ifsc_code: string;
    email: string;
    notes: string;
  }>({
    name: '',
    agency: '',
    phone_number: '',
    city: '',
    transaction_type: 'N',
    account_number: '',
    account_name: '',
    bank: '',
    branch: '',
    ifsc_code: '',
    email: '',
    notes: ''
  });

  // View Client Details Drawer
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<BusinessClient | null>(null);

  // Deletion Confirmation
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    entity: MasterEntityType;
    id: string;
    name: string;
  } | null>(null);

  // Fetch from server using /master/search/ or /master/lst/ with debounce
  const fetchCurrentEntityData = useCallback(async () => {
    setIsLoadingApi(true);
    try {
      if (masterDataTab === 'commodities') {
        const filters: Record<string, any> = {};
        if (commodityFilters.name) filters.name = commodityFilters.name;
        if (commodityFilters.type && commodityFilters.type !== 'ALL') filters.type = commodityFilters.type;

        let results: Commodity[];
        if (searchTerm.trim()) {
          results = await masterSearch('commodity', searchTerm, filters);
        } else {
          results = await masterList('commodity', filters);
        }
        if (Array.isArray(results) && results.length > 0) {
          setServerData(prev => ({
            ...prev,
            commodities: results.map(c => ({
              ...c,
              id: String(c.id || (c as any)._id),
              name: c.name || '',
              type: c.type || '',
              notes: c.notes || ''
            }))
          }));
        } else if (searchTerm.trim() || Object.keys(filters).length > 0) {
          // If query returned empty from server, keep empty array
          setServerData(prev => ({ ...prev, commodities: [] }));
        } else {
          // Initial or empty query: fallback to context cache
          setServerData(prev => ({ ...prev, commodities: null }));
        }
      } else if (masterDataTab === 'clients') {
        const filters: Record<string, any> = {};
        if (clientFilters.name) filters.name = clientFilters.name;
        if (clientFilters.address) filters.address = clientFilters.address;
        if (clientFilters.city) filters.city = clientFilters.city;
        if (clientFilters.pincode) filters.pincode = clientFilters.pincode;
        if (clientFilters.type && clientFilters.type.toUpperCase() !== 'ALL') filters.type = clientFilters.type.toLowerCase();
        if (clientFilters.flag && clientFilters.flag.toUpperCase() !== 'ALL') filters.flag = clientFilters.flag.toLowerCase();

        let results: BusinessClient[];
        if (searchTerm.trim()) {
          results = await masterSearch('businessclient', searchTerm, filters);
        } else {
          results = await masterList('businessclient', filters);
        }
        if (Array.isArray(results) && results.length > 0) {
          setServerData(prev => ({
            ...prev,
            clients: results.map(c => ({
              ...c,
              id: String(c.id || (c as any)._id),
              name: c.name || '',
              address: c.address || '',
              city: c.city || '',
              pincode: c.pincode || '',
              maan_no: c.maan_no || '',
              type: c.type || 'COMPANY',
              flag: c.flag || 'GOOD',
              location_url: c.location_url || '',
              profile_picture: c.profile_picture || c.image || null,
              notes: c.notes || ''
            }))
          }));
        } else if (searchTerm.trim() || Object.keys(filters).length > 0) {
          setServerData(prev => ({ ...prev, clients: [] }));
        } else {
          setServerData(prev => ({ ...prev, clients: null }));
        }
      } else if (masterDataTab === 'brokers') {
        const filters: Record<string, any> = {};
        if (brokerFilters.name) filters.name = brokerFilters.name;
        if (brokerFilters.city) filters.city = brokerFilters.city;

        let results: Broker[];
        if (searchTerm.trim()) {
          results = await masterSearch('broker', searchTerm, filters);
        } else {
          results = await masterList('broker', filters);
        }
        if (Array.isArray(results) && results.length > 0) {
          setServerData(prev => ({
            ...prev,
            brokers: results.map(b => ({
              ...b,
              id: String(b.id || (b as any)._id),
              name: b.name || '',
              phone_number: b.phone_number || (b as any).phone || '',
              phone: b.phone_number || (b as any).phone || '',
              city: b.city || '',
              notes: b.notes || ''
            }))
          }));
        } else if (searchTerm.trim() || Object.keys(filters).length > 0) {
          setServerData(prev => ({ ...prev, brokers: [] }));
        } else {
          setServerData(prev => ({ ...prev, brokers: null }));
        }
      } else if (masterDataTab === 'transporters') {
        const filters: Record<string, any> = {};
        if (transporterFilters.name) filters.name = transporterFilters.name;
        if (transporterFilters.agency) filters.agency = transporterFilters.agency;
        if (transporterFilters.city) filters.city = transporterFilters.city;

        let results: Transporter[];
        if (searchTerm.trim()) {
          results = await masterSearch('transporter', searchTerm, filters);
        } else {
          results = await masterList('transporter', filters);
        }
        if (Array.isArray(results) && results.length > 0) {
          setServerData(prev => ({
            ...prev,
            transporters: results.map(t => ({
              ...t,
              id: String(t.id || (t as any)._id),
              name: t.name || '',
              agency: t.agency || '',
              phone_number: t.phone_number || (t as any).phone || '',
              phone: t.phone_number || (t as any).phone || '',
              city: t.city || '',
              notes: t.notes || ''
            }))
          }));
        } else if (searchTerm.trim() || Object.keys(filters).length > 0) {
          setServerData(prev => ({ ...prev, transporters: [] }));
        } else {
          setServerData(prev => ({ ...prev, transporters: null }));
        }
      }
    } catch (err) {
      console.warn('Failed querying master API, falling back to local dataset:', err);
    } finally {
      setIsLoadingApi(false);
    }
  }, [
    masterDataTab,
    searchTerm,
    brokerFilters,
    clientFilters,
    commodityFilters,
    transporterFilters,
    masterSearch,
    masterList
  ]);

  // Trigger search/filter with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCurrentEntityData();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCurrentEntityData]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (masterDataTab === 'commodities') {
      if (commodityFilters.name) count++;
      if (commodityFilters.type && commodityFilters.type !== 'ALL') count++;
    } else if (masterDataTab === 'clients') {
      if (clientFilters.name) count++;
      if (clientFilters.address) count++;
      if (clientFilters.city) count++;
      if (clientFilters.pincode) count++;
      if (clientFilters.type && clientFilters.type !== 'ALL') count++;
      if (clientFilters.flag && clientFilters.flag !== 'ALL') count++;
    } else if (masterDataTab === 'brokers') {
      if (brokerFilters.name) count++;
      if (brokerFilters.city) count++;
    } else if (masterDataTab === 'transporters') {
      if (transporterFilters.name) count++;
      if (transporterFilters.agency) count++;
      if (transporterFilters.city) count++;
    }
    return count;
  }, [masterDataTab, commodityFilters, clientFilters, brokerFilters, transporterFilters]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setCommodityFilters({ name: '', type: '' });
    setClientFilters({ name: '', address: '', city: '', pincode: '', type: 'ALL', flag: 'ALL' });
    setBrokerFilters({ name: '', city: '' });
    setTransporterFilters({ name: '', agency: '', city: '' });
    setServerData({});
  };

  // --- Filtered Datasets with Fallback to local context store ---
  const displayedCommodities = useMemo(() => {
    if (serverData.commodities !== undefined && serverData.commodities !== null) {
      return serverData.commodities;
    }
    return commodities.filter(c => {
      const matchSearch = !searchTerm ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchName = !commodityFilters.name ||
        c.name.toLowerCase().includes(commodityFilters.name.toLowerCase());
      const matchType = !commodityFilters.type || commodityFilters.type === 'ALL' ||
        c.type.toLowerCase() === commodityFilters.type.toLowerCase();
      return matchSearch && matchName && matchType;
    });
  }, [commodities, serverData.commodities, searchTerm, commodityFilters]);

  const displayedClients = useMemo(() => {
    if (serverData.clients !== undefined && serverData.clients !== null) {
      return serverData.clients;
    }
    return clients.filter(c => {
      const matchSearch = !searchTerm ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchName = !clientFilters.name || c.name.toLowerCase().includes(clientFilters.name.toLowerCase());
      const matchAddress = !clientFilters.address || c.address.toLowerCase().includes(clientFilters.address.toLowerCase());
      const matchCity = !clientFilters.city || c.city.toLowerCase().includes(clientFilters.city.toLowerCase());
      const matchPincode = !clientFilters.pincode || c.pincode.includes(clientFilters.pincode);
      const matchType = !clientFilters.type || clientFilters.type.toUpperCase() === 'ALL' || c.type?.toLowerCase() === clientFilters.type.toLowerCase();
      const matchFlag = !clientFilters.flag || clientFilters.flag.toUpperCase() === 'ALL' || c.flag?.toLowerCase() === clientFilters.flag.toLowerCase();
      return matchSearch && matchName && matchAddress && matchCity && matchPincode && matchType && matchFlag;
    });
  }, [clients, serverData.clients, searchTerm, clientFilters]);

  const displayedBrokers = useMemo(() => {
    if (serverData.brokers !== undefined && serverData.brokers !== null) {
      return serverData.brokers;
    }
    return brokers.filter(b => {
      const phoneVal = b.phone_number || (b as any).phone || '';
      const matchSearch = !searchTerm ||
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.city && b.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        phoneVal.includes(searchTerm);
      const matchName = !brokerFilters.name || b.name.toLowerCase().includes(brokerFilters.name.toLowerCase());
      const matchCity = !brokerFilters.city || (b.city && b.city.toLowerCase().includes(brokerFilters.city.toLowerCase()));
      return matchSearch && matchName && matchCity;
    });
  }, [brokers, serverData.brokers, searchTerm, brokerFilters]);

  const displayedTransporters = useMemo(() => {
    if (serverData.transporters !== undefined && serverData.transporters !== null) {
      return serverData.transporters;
    }
    return transporters.filter(t => {
      const phoneVal = t.phone_number || (t as any).phone || '';
      const agencyVal = t.agency || '';
      const matchSearch = !searchTerm ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agencyVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.city && t.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        phoneVal.includes(searchTerm);
      const matchName = !transporterFilters.name || t.name.toLowerCase().includes(transporterFilters.name.toLowerCase());
      const matchAgency = !transporterFilters.agency || agencyVal.toLowerCase().includes(transporterFilters.agency.toLowerCase());
      const matchCity = !transporterFilters.city || (t.city && t.city.toLowerCase().includes(transporterFilters.city.toLowerCase()));
      return matchSearch && matchName && matchAgency && matchCity;
    });
  }, [transporters, serverData.transporters, searchTerm, transporterFilters]);

  // --- Handlers for Commodities ---
  const handleOpenCommodityModal = (item?: Commodity) => {
    if (item) {
      setEditingCommodity(item);
      setCommodityForm({
        name: item.name,
        type: item.type,
        notes: item.notes || ''
      });
    } else {
      setEditingCommodity(null);
      setCommodityForm({ name: '', type: 'Grain', notes: '' });
    }
    setCommodityModalOpen(true);
  };

  const handleSaveCommodity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commodityForm.name.trim() || !commodityForm.type.trim()) {
      showToast('Commodity name and type are required', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const content = {
        name: commodityForm.name.trim(),
        type: commodityForm.type.trim(),
        notes: commodityForm.notes.trim()
      };
      if (editingCommodity) {
        await masterUpdate('commodity', editingCommodity.id, content);
      } else {
        await masterAdd('commodity', content);
      }
      setCommodityModalOpen(false);
      fetchCurrentEntityData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save commodity', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers for Business Clients ---
  const handleOpenClientModal = (item?: BusinessClient) => {
    if (item) {
      setEditingClient(item);
      setClientForm({
        name: item.name,
        address: item.address,
        city: item.city,
        pincode: item.pincode,
        maan_no: item.maan_no || '',
        type: (item.type || 'company').toLowerCase() as ClientType,
        flag: (item.flag || 'good').toLowerCase() as ClientFlag,
        location_url: item.location_url || '',
        notes: item.notes || '',
        profile_picture: item.profile_picture || item.image || ''
      });
    } else {
      setEditingClient(null);
      setClientForm({
        name: '',
        address: '',
        city: '',
        pincode: '',
        maan_no: '',
        type: 'company' as ClientType,
        flag: 'good' as ClientFlag,
        location_url: '',
        notes: '',
        profile_picture: ''
      });
    }
    setClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim() || !clientForm.city.trim() || !clientForm.address.trim()) {
      showToast('Client name, address, and city are required', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const content = {
        name: clientForm.name.trim(),
        address: clientForm.address.trim(),
        city: clientForm.city.trim(),
        pincode: clientForm.pincode.trim(),
        maan_no: clientForm.maan_no.trim(),
        type: String(clientForm.type || 'company').toLowerCase() as ClientType,
        flag: String(clientForm.flag || 'good').toLowerCase() as ClientFlag,
        location_url: clientForm.location_url.trim(),
        notes: clientForm.notes.trim(),
        ...(String(clientForm.type).toLowerCase() === 'my_firm'
          ? { profile_picture: clientForm.profile_picture || null }
          : {})
      };
      if (editingClient) {
        await masterUpdate('businessclient', editingClient.id, content);
      } else {
        await masterAdd('businessclient', content);
      }
      setClientModalOpen(false);
      fetchCurrentEntityData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save client', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers for Brokers ---
  const handleOpenBrokerModal = (item?: Broker) => {
    if (item) {
      setEditingBroker(item);
      setBrokerForm({
        name: item.name,
        phone_number: item.phone_number || (item as any).phone || '',
        city: item.city || '',
        notes: item.notes || ''
      });
    } else {
      setEditingBroker(null);
      setBrokerForm({ name: '', phone_number: '', city: '', notes: '' });
    }
    setBrokerModalOpen(true);
  };

  const handleSaveBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerForm.name.trim() || !brokerForm.phone_number.trim()) {
      showToast('Broker name and phone number are required', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      // Exactly matching ENTITY_FIELDS: name, phone_number, city, notes
      const content = {
        name: brokerForm.name.trim(),
        phone_number: brokerForm.phone_number.trim(),
        city: brokerForm.city.trim(),
        notes: brokerForm.notes.trim()
      };
      if (editingBroker) {
        await masterUpdate('broker', editingBroker.id, content);
      } else {
        await masterAdd('broker', content);
      }
      setBrokerModalOpen(false);
      fetchCurrentEntityData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save broker', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers for Transporters ---
  const handleOpenTransporterModal = (item?: Transporter) => {
    if (item) {
      setEditingTransporter(item);
      setTransporterForm({
        name: item.name,
        agency: item.agency || '',
        phone_number: item.phone_number || (item as any).phone || '',
        city: item.city || '',
        transaction_type: item.transaction_type || 'N',
        account_number: item.account_number || '',
        account_name: item.account_name || '',
        bank: item.bank || '',
        branch: item.branch || '',
        ifsc_code: item.ifsc_code || '',
        email: item.email || '',
        notes: item.notes || ''
      });
    } else {
      setEditingTransporter(null);
      setTransporterForm({
        name: '',
        agency: '',
        phone_number: '',
        city: '',
        transaction_type: 'N',
        account_number: '',
        account_name: '',
        bank: '',
        branch: '',
        ifsc_code: '',
        email: '',
        notes: ''
      });
    }
    setTransporterModalOpen(true);
  };

  const handleSaveTransporter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transporterForm.name.trim() || !transporterForm.phone_number.trim()) {
      showToast('Transporter name and phone number are required', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const content = {
        name: transporterForm.name.trim(),
        agency: transporterForm.agency.trim(),
        phone_number: transporterForm.phone_number.trim(),
        city: transporterForm.city.trim(),
        transaction_type: transporterForm.transaction_type.trim() || 'N',
        account_number: transporterForm.account_number.trim(),
        account_name: transporterForm.account_name.trim(),
        bank: transporterForm.bank.trim(),
        branch: transporterForm.branch.trim(),
        ifsc_code: transporterForm.ifsc_code.trim(),
        email: transporterForm.email.trim(),
        notes: transporterForm.notes.trim()
      };
      if (editingTransporter) {
        await masterUpdate('transporter', editingTransporter.id, content);
      } else {
        await masterAdd('transporter', content);
      }
      setTransporterModalOpen(false);
      fetchCurrentEntityData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save transporter', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete confirmation execution ---
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { entity, id } = deleteConfirmation;
    try {
      await masterDelete(entity, id);
      setDeleteConfirmation(null);
      fetchCurrentEntityData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete record', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Master Data Segmented Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 tracking-tight"><Database className="h-5 w-5 text-blue-600" />Master Data</h1>
            {/* <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              API Synced
            </span> */}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain commodities, commercial clients, godowns, brokers, and logistics partners.
          </p>
        </div>

        {/* Tab Switcher Segmented Control */}
        <div className="inline-flex p-1 bg-slate-200/80 rounded-xl shadow-2xs self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => { setMasterDataTab('commodities'); handleResetFilters(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              masterDataTab === 'commodities'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Commodities ({displayedCommodities.length})
          </button>
          <button
            type="button"
            onClick={() => { setMasterDataTab('clients'); handleResetFilters(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              masterDataTab === 'clients'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Clients & Godowns ({displayedClients.length})
          </button>
          <button
            type="button"
            onClick={() => { setMasterDataTab('brokers'); handleResetFilters(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              masterDataTab === 'brokers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users2 className="w-3.5 h-3.5" />
            Brokers ({displayedBrokers.length})
          </button>
          <button
            type="button"
            onClick={() => { setMasterDataTab('transporters'); handleResetFilters(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              masterDataTab === 'transporters'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Transporters ({displayedTransporters.length})
          </button>
        </div>
      </div>

      {/* Main Action Bar: Search, Advanced Filter Toggle, Refresh, Add Record */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Quick search input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${masterDataTab} (queries /master/search/)...`}
                className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
              />
              {isLoadingApi && (
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Reset Filters */}
            {(activeFiltersCount > 0 || searchTerm) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Clear all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => { fetchCurrentEntityData(); refreshData(); }}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingApi ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Action button */}
          {!isLabour && (
            <div className="shrink-0">
              {masterDataTab === 'commodities' && (
                <button
                  type="button"
                  onClick={() => handleOpenCommodityModal()}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Commodity
                </button>
              )}
              {masterDataTab === 'clients' && (
                <button
                  type="button"
                  onClick={() => handleOpenClientModal()}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Client / Godown
                </button>
              )}
              {masterDataTab === 'brokers' && (
                <button
                  type="button"
                  onClick={() => handleOpenBrokerModal()}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Broker
                </button>
              )}
              {masterDataTab === 'transporters' && (
                <button
                  type="button"
                  onClick={() => handleOpenTransporterModal()}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Transporter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dedicated Advanced Filter Form Bar (strictly matching FILTER_FIELDS) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 bg-slate-50/70 p-3 rounded-lg">
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Filter {masterDataTab} ({activeFiltersCount} active)</span>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Close
              </button>
            </div>

            {/* FILTER FIELDS FOR COMMODITY: name, type */}
            {masterDataTab === 'commodities' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={commodityFilters.name}
                    onChange={(e) => setCommodityFilters({ ...commodityFilters, name: e.target.value })}
                    placeholder="Filter by name..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Type / Category</label>
                  <input
                    type="text"
                    value={commodityFilters.type}
                    onChange={(e) => setCommodityFilters({ ...commodityFilters, type: e.target.value })}
                    placeholder="e.g. Grain, Pulse, Oilseed..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* FILTER FIELDS FOR BUSINESS CLIENT: name, address, city, pincode, type, flag */}
            {masterDataTab === 'clients' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={clientFilters.name}
                    onChange={(e) => setClientFilters({ ...clientFilters, name: e.target.value })}
                    placeholder="Firm / Client..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={clientFilters.address}
                    onChange={(e) => setClientFilters({ ...clientFilters, address: e.target.value })}
                    placeholder="Address street/area..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    value={clientFilters.city}
                    onChange={(e) => setClientFilters({ ...clientFilters, city: e.target.value })}
                    placeholder="City name..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={clientFilters.pincode}
                    onChange={(e) => setClientFilters({ ...clientFilters, pincode: e.target.value })}
                    placeholder="Pincode..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Type</label>
                  <select
                    value={clientFilters.type.toLowerCase()}
                    onChange={(e) => setClientFilters({ ...clientFilters, type: e.target.value.toLowerCase() })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="my_firm">My Firm</option>
                    <option value="my_godown">My Godown</option>
                    <option value="other_godown">Other Godown</option>
                    <option value="company">Company</option>
                    <option value="location">Mandi / Yard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Standing Flag</label>
                  <select
                    value={clientFilters.flag.toLowerCase()}
                    onChange={(e) => setClientFilters({ ...clientFilters, flag: e.target.value.toLowerCase() })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="all">All Flags</option>
                    <option value="good">Good Standing</option>
                    <option value="neutral">Neutral</option>
                    <option value="bad">Caution</option>
                    <option value="unreasonable_claims">Excess Claims</option>
                    <option value="fraud">Fraud</option>
                    <option value="blacklisted">Blacklisted</option>
                  </select>
                </div>
              </div>
            )}

            {/* FILTER FIELDS FOR BROKER: name, city */}
            {masterDataTab === 'brokers' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={brokerFilters.name}
                    onChange={(e) => setBrokerFilters({ ...brokerFilters, name: e.target.value })}
                    placeholder="Broker name..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    value={brokerFilters.city}
                    onChange={(e) => setBrokerFilters({ ...brokerFilters, city: e.target.value })}
                    placeholder="City / Mandi..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* FILTER FIELDS FOR TRANSPORTER: name, agency, city */}
            {masterDataTab === 'transporters' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Name (Transporter/Contact)</label>
                  <input
                    type="text"
                    value={transporterFilters.name}
                    onChange={(e) => setTransporterFilters({ ...transporterFilters, name: e.target.value })}
                    placeholder="Transporter name..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Agency Name</label>
                  <input
                    type="text"
                    value={transporterFilters.agency}
                    onChange={(e) => setTransporterFilters({ ...transporterFilters, agency: e.target.value })}
                    placeholder="Agency / Logistics firm..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    value={transporterFilters.city}
                    onChange={(e) => setTransporterFilters({ ...transporterFilters, city: e.target.value })}
                    placeholder="Headquarters city..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: COMMODITIES TABLE */}
      {masterDataTab === 'commodities' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Commodity Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Active Orders</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCommodities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      {isLoadingApi ? (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching commodities...
                        </div>
                      ) : (
                        'No commodities found matching criteria.'
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedCommodities.map((item) => {
                    const activeOrdersCount = orders.filter(o => o.commodityId === item.id).length;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                          {item.notes || '-'}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {activeOrdersCount} {activeOrdersCount === 1 ? 'order' : 'orders'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === `com-${item.id}` ? null : `com-${item.id}`);
                              }}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg border border-slate-200/60 shadow-2xs transition-colors cursor-pointer"
                              title="Commodity Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openActionMenuId === `com-${item.id}` && (
                              <>
                                <div
                                  className="fixed inset-0 z-20 cursor-default"
                                  onClick={() => setOpenActionMenuId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                  {!isLabour && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleOpenCommodityModal(item);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Edit Commodity</span>
                                    </button>
                                  )}
                                  {isOwner && (
                                    <>
                                      {!isLabour && <div className="my-1 border-t border-slate-100" />}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setDeleteConfirmation({ entity: 'commodity', id: item.id, name: item.name });
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        <span>Delete Commodity</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CLIENTS TABLE */}
      {masterDataTab === 'clients' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client / Godown</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Standing Flag</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">City & Pincode</th>
                  <th className="px-4 py-3">Maan No.</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      {isLoadingApi ? (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching clients...
                        </div>
                      ) : (
                        'No clients found matching filters.'
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedClients.map((client) => {
                    const badge = getClientFlagBadge(client.flag);
                    return (
                      <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedClientForDetails(client)}
                            className="font-semibold text-slate-900 hover:text-blue-600 text-left cursor-pointer"
                          >
                            {client.name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {getClientTypeLabel(client.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {client.address}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {client.city} {client.pincode && `· ${client.pincode}`}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{client.maan_no || '-'}</td>
                        <td className="px-4 py-3">
                          {client.location_url ? (
                            <a
                              href={client.location_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open location for ${client.name}`}
                              title="Open location"
                              className="inline-flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">
                          {client.notes || '-'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === `cli-${client.id}` ? null : `cli-${client.id}`);
                              }}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg border border-slate-200/60 shadow-2xs transition-colors cursor-pointer"
                              title="Client Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openActionMenuId === `cli-${client.id}` && (
                              <>
                                <div
                                  className="fixed inset-0 z-20 cursor-default"
                                  onClick={() => setOpenActionMenuId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setSelectedClientForDetails(client);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                    <span>View Details</span>
                                  </button>

                                  {!isLabour && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleOpenClientModal(client);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Edit Client</span>
                                    </button>
                                  )}

                                  {isOwner && (
                                    <>
                                      <div className="my-1 border-t border-slate-100" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setDeleteConfirmation({ entity: 'businessclient', id: client.id, name: client.name });
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        <span>Delete Client</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BROKERS TABLE (Strictly: name, phone_number, city, notes) */}
      {masterDataTab === 'brokers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Broker Name</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">City / Market</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Associated Orders</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedBrokers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      {isLoadingApi ? (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching brokers...
                        </div>
                      ) : (
                        'No brokers found.'
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedBrokers.map((broker) => {
                    const brokerOrdersCount = orders.filter(o => o.brokerId === broker.id).length;
                    const phone = broker.phone_number || (broker as any).phone || '-';
                    return (
                      <tr key={broker.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{broker.name}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{phone}</td>
                        <td className="px-4 py-3 text-slate-600">{broker.city || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                          {broker.notes || '-'}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {brokerOrdersCount} {brokerOrdersCount === 1 ? 'order' : 'orders'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === `brk-${broker.id}` ? null : `brk-${broker.id}`);
                              }}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg border border-slate-200/60 shadow-2xs transition-colors cursor-pointer"
                              title="Broker Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openActionMenuId === `brk-${broker.id}` && (
                              <>
                                <div
                                  className="fixed inset-0 z-20 cursor-default"
                                  onClick={() => setOpenActionMenuId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                  {!isLabour && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleOpenBrokerModal(broker);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Edit Broker</span>
                                    </button>
                                  )}

                                  {isOwner && (
                                    <>
                                      {!isLabour && <div className="my-1 border-t border-slate-100" />}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setDeleteConfirmation({ entity: 'broker', id: broker.id, name: broker.name });
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        <span>Delete Broker</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSPORTERS TABLE (Strictly: name, agency, phone_number, city, notes) */}
      {masterDataTab === 'transporters' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Transporter Name</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Dispatched Transports</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTransporters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      {isLoadingApi ? (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching transporters...
                        </div>
                      ) : (
                        'No transporters found.'
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedTransporters.map((trp) => {
                    const transportCount = transports.filter(t => t.transporterId === trp.id).length;
                    const phone = trp.phone_number || (trp as any).phone || '-';
                    return (
                      <tr key={trp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{trp.name}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{trp.agency || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{phone}</td>
                        <td className="px-4 py-3 text-slate-600">{trp.city || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{trp.notes || '-'}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {transportCount} {transportCount === 1 ? 'consignment' : 'consignments'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === `trp-${trp.id}` ? null : `trp-${trp.id}`);
                              }}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg border border-slate-200/60 shadow-2xs transition-colors cursor-pointer"
                              title="Transporter Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openActionMenuId === `trp-${trp.id}` && (
                              <>
                                <div
                                  className="fixed inset-0 z-20 cursor-default"
                                  onClick={() => setOpenActionMenuId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                  {!isLabour && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleOpenTransporterModal(trp);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Edit Transporter</span>
                                    </button>
                                  )}

                                  {isOwner && (
                                    <>
                                      {!isLabour && <div className="my-1 border-t border-slate-100" />}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setDeleteConfirmation({ entity: 'transporter', id: trp.id, name: trp.name });
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        <span>Delete Transporter</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLIENT DETAILS DRAWER (Strictly client fields: name, type, flag, address, city, pincode, location_url, notes) */}
      {selectedClientForDetails && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">{selectedClientForDetails.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                    {getClientTypeLabel(selectedClientForDetails.type)}
                  </span>
                  {(() => {
                    const badge = getClientFlagBadge(selectedClientForDetails.flag);
                    return (
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClientForDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Location & Address Information */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <span>{selectedClientForDetails.address}, {selectedClientForDetails.city} - {selectedClientForDetails.pincode}</span>
                </div>
                {selectedClientForDetails.location_url && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a
                      href={selectedClientForDetails.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      Open Google Maps Location <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {selectedClientForDetails.notes && (
                  <div className="pt-2 border-t border-slate-200/60 text-slate-600">
                    <span className="font-semibold text-slate-700 block mb-0.5">Notes:</span>
                    <p className="italic text-slate-500">{selectedClientForDetails.notes}</p>
                  </div>
                )}
              </div>

              {/* Contextual Orders involving this client */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Associated Orders ({orders.filter(o => o.fromClientId === selectedClientForDetails.id || o.toClientId === selectedClientForDetails.id).length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientForDetails(null);
                      navigate('orders', { clientFilter: selectedClientForDetails.id });
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    View All Orders <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {orders
                    .filter(o => o.fromClientId === selectedClientForDetails.id || o.toClientId === selectedClientForDetails.id)
                    .slice(0, 4)
                    .map((ord) => (
                      <div
                        key={ord.id}
                        onClick={() => {
                          setSelectedClientForDetails(null);
                          navigate('order-detail', { orderId: ord.id });
                        }}
                        className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs cursor-pointer shadow-2xs hover:bg-slate-50/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{ord.orderNumber}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {ord.type}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-500 text-[11px]">
                          Qty: {ord.quantity} MT · Fulfilled: {ord.quantityFulfilled} MT
                        </div>
                      </div>
                    ))}
                  {orders.filter(o => o.fromClientId === selectedClientForDetails.id || o.toClientId === selectedClientForDetails.id).length === 0 && (
                    <p className="text-xs text-slate-400 italic">No orders involving this client yet.</p>
                  )}
                </div>
              </div>

              {/* Contextual Transports involving this client */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Associated Transports ({transports.filter(t => t.fromClientId === selectedClientForDetails.id || t.toClientId === selectedClientForDetails.id || t.billingFirmId === selectedClientForDetails.id).length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientForDetails(null);
                      navigate('transport');
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    View All Transport <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {transports
                    .filter(t => t.fromClientId === selectedClientForDetails.id || t.toClientId === selectedClientForDetails.id || t.billingFirmId === selectedClientForDetails.id)
                    .slice(0, 4)
                    .map((trp) => (
                      <div
                        key={trp.id}
                        onClick={() => {
                          setSelectedClientForDetails(null);
                          navigate('transport-detail', { transportId: trp.id });
                        }}
                        className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs cursor-pointer shadow-2xs hover:bg-slate-50/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{trp.vehicleNumber}</span>
                          <span className="text-[10px] font-mono text-slate-500">{trp.billNumber}</span>
                        </div>
                        <div className="mt-1 text-slate-500 text-[11px] flex justify-between">
                          <span>Gross: {trp.grossWeight} MT</span>
                          <span className="font-medium text-slate-700">{trp.status}</span>
                        </div>
                      </div>
                    ))}
                  {transports.filter(t => t.fromClientId === selectedClientForDetails.id || t.toClientId === selectedClientForDetails.id || t.billingFirmId === selectedClientForDetails.id).length === 0 && (
                    <p className="text-xs text-slate-400 italic">No transports recorded for this client yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMMODITY FORM MODAL (Strictly: name, type, notes) */}
      {commodityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingCommodity ? 'Edit Commodity' : 'Add New Commodity'}
            </h3>
            <form onSubmit={handleSaveCommodity} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={commodityForm.name}
                  onChange={(e) => setCommodityForm({ ...commodityForm, name: e.target.value })}
                  placeholder="e.g. Sharbati Wheat, Yellow Soybean"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type *</label>
                <input
                  type="text"
                  required
                  value={commodityForm.type}
                  onChange={(e) => setCommodityForm({ ...commodityForm, type: e.target.value })}
                  placeholder="e.g. Grain, Oilseed, Pulse, Spice"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={commodityForm.notes}
                  onChange={(e) => setCommodityForm({ ...commodityForm, notes: e.target.value })}
                  placeholder="Specifications, moisture standard, grade notes..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCommodityModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingCommodity ? 'Update Commodity' : 'Save Commodity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT FORM MODAL */}
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingClient ? 'Edit Business Client / Godown' : 'Add Business Client / Godown'}
            </h3>
            <form onSubmit={handleSaveClient} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="e.g. Om Agro Pvt Ltd, Central Godown #1"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type *</label>
                  <select
                    value={clientForm.type.toLowerCase()}
                    onChange={(e) => setClientForm({ ...clientForm, type: e.target.value.toLowerCase() as ClientType })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    <option value="my_firm">MY_FIRM (Billing Entity)</option>
                    <option value="my_godown">MY_GODOWN (Own Storage)</option>
                    <option value="other_godown">OTHER_GODOWN (Third-party Godown)</option>
                    <option value="company">COMPANY (Corporate Buyer/Supplier)</option>
                    <option value="location">LOCATION (Mandi Yard / Plant)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Flag *</label>
                  <select
                    value={clientForm.flag.toLowerCase()}
                    onChange={(e) => setClientForm({ ...clientForm, flag: e.target.value.toLowerCase() as ClientFlag })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    <option value="good">GOOD (Good Standing)</option>
                    <option value="neutral">NEUTRAL (Neutral/Unrated)</option>
                    <option value="bad">BAD (Slow Payer / Caution)</option>
                    <option value="unreasonable_claims">UNREASONABLE_CLAIMS (Weight Disputes)</option>
                    <option value="fraud">FRAUD (Payment Default / Risk)</option>
                    <option value="blacklisted">BLACKLISTED (Do Not Transact)</option>
                  </select>
                </div>
              </div>

              {String(clientForm.type).toLowerCase() === 'my_firm' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Firm Logo</label>
                  {clientForm.profile_picture && (
                    <img
                      src={getImageSource(clientForm.profile_picture)}
                      alt="Firm logo preview"
                      className="mb-2 h-14 w-14 rounded-md border border-slate-200 object-contain"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setClientForm((current) => ({ ...current, profile_picture: reader.result as string }));
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Address *</label>
                <input
                  type="text"
                  required
                  value={clientForm.address}
                  onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                  placeholder="Street / Industrial Area / Mandi Gate"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.city}
                    onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                    placeholder="e.g. Indore, Bhopal, Dewas"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={clientForm.pincode}
                    onChange={(e) => setClientForm({ ...clientForm, pincode: e.target.value })}
                    placeholder="e.g. 452001"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">MAAN No.</label>
                <input
                  type="text"
                  value={clientForm.maan_no}
                  onChange={(e) => setClientForm({ ...clientForm, maan_no: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Location URL</label>
                <input
                  type="url"
                  value={clientForm.location_url}
                  onChange={(e) => setClientForm({ ...clientForm, location_url: e.target.value })}
                  placeholder="https://maps.google.com/..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  placeholder="Commercial terms, contact details, gate timings..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClientModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingClient ? 'Update Client' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BROKER FORM MODAL (Strictly: name, phone_number, city, notes) */}
      {brokerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingBroker ? 'Edit Broker' : 'Add New Broker'}
            </h3>
            <form onSubmit={handleSaveBroker} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={brokerForm.name}
                  onChange={(e) => setBrokerForm({ ...brokerForm, name: e.target.value })}
                  placeholder="e.g. Suresh Bhai Dalal"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={brokerForm.phone_number}
                  onChange={(e) => setBrokerForm({ ...brokerForm, phone_number: e.target.value })}
                  placeholder="+91 98260 00000"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={brokerForm.city}
                  onChange={(e) => setBrokerForm({ ...brokerForm, city: e.target.value })}
                  placeholder="e.g. Indore Mandi"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={brokerForm.notes}
                  onChange={(e) => setBrokerForm({ ...brokerForm, notes: e.target.value })}
                  placeholder="e.g. Wheat & Soybean specialist, brokerage 0.5%"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBrokerModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingBroker ? 'Update Broker' : 'Save Broker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSPORTER FORM MODAL */}
      {transporterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingTransporter ? 'Edit Transporter' : 'Add New Transporter'}
            </h3>
            <form onSubmit={handleSaveTransporter} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name (Transporter/Contact) *</label>
                <input
                  type="text"
                  required
                  value={transporterForm.name}
                  onChange={(e) => setTransporterForm({ ...transporterForm, name: e.target.value })}
                  placeholder="e.g. Mahesh Sharma"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Agency</label>
                <input
                  type="text"
                  value={transporterForm.agency}
                  onChange={(e) => setTransporterForm({ ...transporterForm, agency: e.target.value })}
                  placeholder="e.g. Sharma Goods Transport Co."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={transporterForm.phone_number}
                  onChange={(e) => setTransporterForm({ ...transporterForm, phone_number: e.target.value })}
                  placeholder="+91 98260 00000"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={transporterForm.city}
                  onChange={(e) => setTransporterForm({ ...transporterForm, city: e.target.value })}
                  placeholder="e.g. Indore"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-700">Bank Details (Optional)</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Type</label>
                    <input
                      type="text"
                      value={transporterForm.transaction_type}
                      onChange={(e) => setTransporterForm({ ...transporterForm, transaction_type: e.target.value })}
                      placeholder="N"
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={transporterForm.account_number}
                      onChange={(e) => setTransporterForm({ ...transporterForm, account_number: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Account Name</label>
                    <input
                      type="text"
                      value={transporterForm.account_name}
                      onChange={(e) => setTransporterForm({ ...transporterForm, account_name: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Bank</label>
                    <input
                      type="text"
                      value={transporterForm.bank}
                      onChange={(e) => setTransporterForm({ ...transporterForm, bank: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Branch</label>
                    <input
                      type="text"
                      value={transporterForm.branch}
                      onChange={(e) => setTransporterForm({ ...transporterForm, branch: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={transporterForm.ifsc_code}
                      onChange={(e) => setTransporterForm({ ...transporterForm, ifsc_code: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={transporterForm.email}
                      onChange={(e) => setTransporterForm({ ...transporterForm, email: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </fieldset>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={transporterForm.notes}
                  onChange={(e) => setTransporterForm({ ...transporterForm, notes: e.target.value })}
                  placeholder="e.g. Own fleet of 20 trucks, GPS tracked..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransporterModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingTransporter ? 'Update Transporter' : 'Save Transporter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmationModal
        isOpen={!!deleteConfirmation}
        title="Delete Record"
        message={`Are you sure you want to remove "${deleteConfirmation?.name}"? This action will invoke DELETE /master/del/.`}
        confirmLabel="Yes, Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation(null)}
      />
    </div>
  );
};
