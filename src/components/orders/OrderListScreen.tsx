import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Broker, Commodity, Order, OrderType, OrderStatus, OrderListSchema } from '../../types';
import {
  Search,
  Plus,
  ShoppingCart,
  ArrowRight,
  Truck,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  FilterX,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  MoreVertical,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { MultiSearchableSelect } from '../common/SearchableSelect';
import { formatCurrency, formatWeight, formatQuantityWithUnit, getUnitLabel, formatDate, getDaysRemaining } from '../../utils/formatters';
import { PaginatedOrdersResult } from '../../api/orders';
import { masterApi, SelectionClient, SelectionFirm } from '../../api/master';

const toNumericIds = (ids: string[]): number[] | undefined => {
  const numericIds = ids
    .map(id => Number(id))
    .filter(id => Number.isSafeInteger(id) && id > 0);
  return numericIds.length ? numericIds : undefined;
};

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDateByMonths = (date: Date, months: number): Date => {
  const shifted = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(date.getDate(), lastDay));
  return shifted;
};

type DatePreset = 'all' | 'month' | 'three-months' | 'six-months' | 'range';

export const OrderListScreen: React.FC = () => {
  const {
    orders,
    commodities,
    clients,
    brokers,
    currentUser,
    showToast,
    navigate,
    pageParams,
    orderDelete,
    orderGet,
    orderSetStatus,
    orderListPaginated
  } = useApp();

  const isOwner = currentUser?.role === 'OWNER';
  const isLabour = currentUser?.role === 'LABOUR';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<OrderType>('SALES ORDER');
  const [statusFilter, setStatusFilter] = useState<string>(pageParams.statusFilter || 'PENDING');
  const [contractDateFrom, setContractDateFrom] = useState('');
  const [contractDateTo, setContractDateTo] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [commodityFilter, setCommodityFilter] = useState<string[]>([]);
  const [firmFilter, setFirmFilter] = useState<string[]>([]);
  const [partyFilter, setPartyFilter] = useState<string[]>(() => {
    const partyId = pageParams.partyFilter || pageParams.clientFilter;
    return partyId ? [String(partyId)] : [];
  });
  const [brokerFilter, setBrokerFilter] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    firms: SelectionFirm[];
    clients: SelectionClient[];
    commodities: Commodity[];
    brokers: Broker[];
  }>({ firms: [], clients: [], commodities: [], brokers: [] });
  const [sortField, setSortField] = useState<'orderNumber' | 'startDate' | 'expiryDate' | 'quantity' | 'remaining'>('startDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const pageSize = 100;
  const [reloadSequence, setReloadSequence] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serverPage, setServerPage] = useState<PaginatedOrdersResult>({
    results: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1
  });

  // Modals & Action Menu
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<Order | null>(null);
  const [showTypeSelectModal, setShowTypeSelectModal] = useState<boolean>(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuOpensUp, setActionMenuOpensUp] = useState(false);
  const [actionMenuMaxHeight, setActionMenuMaxHeight] = useState<number>();
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  // Client and Commodity lookups
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
  const commodityMap = useMemo(() => new Map(commodities.map(c => [c.id, c])), [commodities]);
  const brokerMap = useMemo(() => new Map(brokers.map(b => [b.id, b.name])), [brokers]);

  useEffect(() => {
    let isCurrent = true;
    Promise.allSettled([
      masterApi.selectFirms(),
      masterApi.selectAllClients(),
      masterApi.selectCommodities(),
      masterApi.selectBrokers()
    ]).then(([firmsResult, clientsResult, commoditiesResult, brokersResult]) => {
      if (!isCurrent) return;
      setFilterOptions({
        firms: firmsResult.status === 'fulfilled' ? firmsResult.value : [],
        clients: clientsResult.status === 'fulfilled' ? clientsResult.value : [],
        commodities: commoditiesResult.status === 'fulfilled' ? commoditiesResult.value : commodities,
        brokers: brokersResult.status === 'fulfilled' ? brokersResult.value : brokers
      });
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    let isCurrent = true;
    const firmIds = toNumericIds(firmFilter);
    const partyIds = toNumericIds(partyFilter);
    const isSalesOrder = typeFilter === 'SALES ORDER';
    const filters: OrderListSchema = {
      page: currentPageNum,
      page_size: pageSize,
      status: statusFilter === 'ALL' ? undefined : statusFilter.toLowerCase() as OrderListSchema['status'],
      type: typeFilter === 'PURCHASE ORDER' ? 'purchase_order' : 'sales_order',
      contract_date_from: contractDateFrom || undefined,
      contract_date_to: contractDateTo || undefined,
      from_client: isSalesOrder ? firmIds : partyIds,
      to_client: isSalesOrder ? partyIds : firmIds,
      broker: toNumericIds(brokerFilter),
      commodity: toNumericIds(commodityFilter),
      search: debouncedSearchTerm || undefined
    };

    setIsLoading(true);
    setLoadError('');
    orderListPaginated(filters)
      .then(result => {
        if (isCurrent) setServerPage(result);
      })
      .catch((err: any) => {
        if (isCurrent) setLoadError(err.message || 'Failed to load orders');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    currentPageNum,
    pageSize,
    statusFilter,
    typeFilter,
    contractDateFrom,
    contractDateTo,
    firmFilter,
    partyFilter,
    brokerFilter,
    commodityFilter,
    debouncedSearchTerm,
    reloadSequence,
    orderListPaginated
  ]);

  // Sort the server-filtered page locally.
  const filteredOrders = useMemo(() => {
    return serverPage.results.slice().sort((a, b) => {
      let valA: any = a[sortField as keyof Order];
      let valB: any = b[sortField as keyof Order];

      if (sortField === 'remaining') {
        valA = a.quantity - a.quantityFulfilled;
        valB = b.quantity - b.quantityFulfilled;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [serverPage.results, sortField, sortAsc]);

  const totalPages = serverPage.totalPages || 1;
  const paginatedOrders = filteredOrders;

  useLayoutEffect(() => {
    if (!openActionMenuId || !actionMenuTriggerRef.current || !actionMenuRef.current) return;

    const triggerRect = actionMenuTriggerRef.current.getBoundingClientRect();
    const menuHeight = actionMenuRef.current.scrollHeight;
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const opensUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const availableSpace = opensUp ? spaceAbove : spaceBelow;

    setActionMenuOpensUp(opensUp);
    setActionMenuMaxHeight(Math.max(0, availableSpace - 8));
  }, [openActionMenuId]);

  const toggleSort = (field: 'orderNumber' | 'startDate' | 'expiryDate' | 'quantity' | 'remaining') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('SALES ORDER');
    setStatusFilter('ALL');
    setContractDateFrom('');
    setContractDateTo('');
    setDatePreset('all');
    setCommodityFilter([]);
    setFirmFilter([]);
    setPartyFilter([]);
    setBrokerFilter([]);
    setCurrentPageNum(1);
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setCurrentPageNum(1);

    if (preset === 'all' || preset === 'range') {
      setContractDateFrom('');
      setContractDateTo('');
      return;
    }

    const today = new Date();
    const fromDate = preset === 'month'
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : shiftDateByMonths(today, preset === 'three-months' ? -3 : -6);
    setContractDateFrom(toDateInputValue(fromDate));
    setContractDateTo(toDateInputValue(today));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteOrderTarget) return;
    try {
      await orderDelete(deleteOrderTarget.id);
      showToast(`Order ${deleteOrderTarget.orderNumber} deleted`, 'info');
      setReloadSequence(sequence => sequence + 1);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete order', 'error');
    } finally {
      setDeleteOrderTarget(null);
    }
  };

  const handleOrderStatusChange = async (order: Order, status: 'PENDING' | 'COMPLETED') => {
    setOpenActionMenuId(null);
    try {
      await orderSetStatus(order.id, status);
      showToast(`Order ${order.orderNumber} marked ${status.toLowerCase()}`, 'success');
      setReloadSequence(sequence => sequence + 1);
    } catch (err: any) {
      showToast(err.message || `Failed to mark order ${status.toLowerCase()}`, 'error');
    }
  };

  const handleOrderEdit = async (order: Order) => {
    setOpenActionMenuId(null);
    try {
      await orderGet(order.id);
      navigate('order-form', { orderId: order.id });
    } catch (err: any) {
      showToast(err.message || 'Failed to load order details', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 tracking-tight"><ShoppingCart className="h-5 w-5 text-blue-600" />Orders</h1>
            {/* <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              API Synced
            </span> */}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage sales and purchase commodity contracts, fulfillment rates, and dispatch quotas.
          </p>
        </div>

        {!isLabour && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowTypeSelectModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Order
              </button>
            </div>
          )}
        </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]">
          <div className="relative lg:col-start-1 lg:row-start-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPageNum(1); }}
              placeholder="Search orders by order #, client, or commodity..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-y border-slate-100 py-2 lg:col-span-2 lg:row-start-2" aria-label="Contract date filter">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Calendar className="h-3.5 w-3.5" />
              Contract date
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Contract date range">
              {([
                ['all', 'All time'],
                ['month', 'This month'],
                ['three-months', '3 months'],
                ['six-months', '6 months'],
                ['range', 'Date range']
              ] as [DatePreset, string][]).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  role="tab"
                  aria-selected={datePreset === preset}
                  onClick={() => handleDatePresetChange(preset)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    datePreset === preset
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {datePreset === 'range' && (
              <>
                <input
                  type="date"
                  aria-label="Contract date from"
                  value={contractDateFrom}
                  onChange={event => { setContractDateFrom(event.target.value); setCurrentPageNum(1); }}
                  className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  aria-label="Contract date to"
                  value={contractDateTo}
                  onChange={event => { setContractDateTo(event.target.value); setCurrentPageNum(1); }}
                  className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 pb-1 sm:pb-0 lg:col-start-2 lg:row-start-1">
            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0" role="tablist" aria-label="Order type">
              {(['PURCHASE ORDER', 'SALES ORDER'] as OrderType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === type}
                  onClick={() => { setTypeFilter(type); setCurrentPageNum(1); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    typeFilter === type
                      ? type === 'PURCHASE ORDER'
                        ? 'bg-emerald-100 text-emerald-800 shadow-xs'
                        : 'bg-blue-100 text-blue-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'PURCHASE ORDER' ? 'Purchase' : 'Sales'}
                </button>
              ))}
            </div>

            <MultiSearchableSelect
              id="orders-firm-filter"
              selectedIds={firmFilter}
              options={filterOptions.firms.map(firm => ({ id: firm.id, label: firm.name, searchText: `${firm.city} ${firm.address}` }))}
              placeholder="All Firms"
              onChange={(values: string[]) => { setFirmFilter(values); setCurrentPageNum(1); }}
            />
            <MultiSearchableSelect
              id="orders-party-filter"
              selectedIds={partyFilter}
              options={filterOptions.clients.map(client => ({ id: client.id, label: client.city ? `${client.name} (${client.city})` : client.name, searchText: `${client.city} ${client.type} ${client.maanNo}` }))}
              placeholder="All Parties"
              onChange={(values: string[]) => { setPartyFilter(values); setCurrentPageNum(1); }}
            />
            <MultiSearchableSelect
              id="orders-commodity-filter"
              selectedIds={commodityFilter}
              options={filterOptions.commodities.map(commodity => ({ id: commodity.id, label: commodity.type ? `${commodity.name} (${commodity.type})` : commodity.name, searchText: commodity.type }))}
              placeholder="All Commodities"
              onChange={(values: string[]) => { setCommodityFilter(values); setCurrentPageNum(1); }}
            />
            <MultiSearchableSelect
              id="orders-broker-filter"
              selectedIds={brokerFilter}
              options={filterOptions.brokers.map(broker => ({ id: broker.id, label: broker.city ? `${broker.name} (${broker.city})` : broker.name, searchText: broker.city }))}
              placeholder="All Brokers"
              onChange={(values: string[]) => { setBrokerFilter(values); setCurrentPageNum(1); }}
            />

            {(searchTerm || statusFilter !== 'ALL' || contractDateFrom || contractDateTo || commodityFilter.length > 0 || firmFilter.length > 0 || partyFilter.length > 0 || brokerFilter.length > 0) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg shrink-0"
                title="Clear all filters"
              >
                <FilterX className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Status Color Legend:</span>
          <span className="text-[11px] text-slate-400">Rows are color-coded by contract status</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400/30'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/60'
            }`}
            aria-pressed={statusFilter === 'ALL'}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'DRAFT'
                ? 'bg-slate-200 text-slate-900 border-slate-400 ring-2 ring-slate-400/30'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/60'
            }`}
            title="Filter by Draft"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-500"></span>
            <span>Draft</span>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/30'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/60'
            }`}
            title="Filter by Pending"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600"></span>
            <span>Pending (Active)</span>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-2 ring-emerald-400/30'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60'
            }`}
            title="Filter by Completed"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>
            <span>Completed</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">CONTRACT DATE</th>
                <th 
                  onClick={() => toggleSort('orderNumber')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    ORDER NO <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3">COMMODITY</th>
                <th className="px-4 py-3">ROUTE / PARTY</th>
                <th className="px-4 py-3">BILLING FIRM</th>
                <th className="px-4 py-3">BROKER</th>
                <th className="px-4 py-3 text-right">RATE</th>
                <th 
                  onClick={() => toggleSort('quantity')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    ORDER QTY <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('remaining')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900 text-left"
                >
                  <div className="flex items-center gap-1">
                    REM QTY <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3">START DATE</th>
                <th 
                  onClick={() => toggleSort('expiryDate')}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    VALIDITY <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading orders...</span>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center">
                    <p className="text-red-600 font-medium">{loadError}</p>
                    <button type="button" onClick={() => setReloadSequence(sequence => sequence + 1)} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center">
                    <p className="text-slate-500 font-medium">No orders found matching criteria</p>
                    <p className="text-slate-400 text-[11px] mt-1">Adjust filters or create a new order</p>
                    <button
                      type="button"
                      onClick={() => setShowTypeSelectModal(true)}
                      className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create First Order
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  const comm = commodityMap.get(order.commodityId);
                  const fromClient = clientMap.get(order.fromClientId) || '-';
                  const toClient = clientMap.get(order.toClientId) || '-';
                  const billingFirm = order.type === 'SALES ORDER' ? fromClient : toClient;
                  const remaining = Math.max(0, order.quantity - order.quantityFulfilled);
                  const daysMeta = getDaysRemaining(order.expiryDate);
                  const hasStarted = getDaysRemaining(order.startDate).days <= 0;
                  const isCompleted = order.status === 'COMPLETED';

                  // Row background & left border color by status
                  const rowBgClass = order.status === 'COMPLETED'
                    ? 'bg-emerald-50/40 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500'
                    : order.status === 'DRAFT'
                    ? 'bg-slate-100/60 hover:bg-slate-200/60 border-l-4 border-l-slate-400 text-slate-700'
                    : 'bg-amber-50/40 hover:bg-amber-100/60 border-l-4 border-l-amber-500';

                  return (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('button, a, input, select')) return;
                        navigate('order-detail', { orderId: order.id });
                      }}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate('order-detail', { orderId: order.id });
                        }
                      }}
                      aria-label={`View order ${order.orderNumber}`}
                      className={`${rowBgClass} cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600`}
                    >
                      {/* Contract Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">
                        {formatDate(order.contractDate)}
                      </td>

                      {/* Order Number */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => navigate('order-detail', { orderId: order.id })}
                          className="font-bold text-slate-900 hover:text-blue-600 text-left font-mono cursor-pointer"
                        >
                          <span className={`mr-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${
                            order.type === 'SALES ORDER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {order.type === 'SALES ORDER' ? 'SO' : 'PO'}
                          </span>
                          {order.orderNumber}
                        </button>
                      </td>

                      {/* Commodity */}
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {comm?.name || 'Unknown'}
                        <div className="text-[10px] text-slate-400">{comm?.type}</div>
                      </td>

                      {/* Route based on order type: Purchase -> From only, Sales -> To only */}
                      <td className="px-4 py-3 max-w-[200px]">
                        {order.type === 'PURCHASE ORDER' ? (
                          <div className="truncate" title={`From: ${fromClient}`}>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mr-1.5 inline-block">
                              From
                            </span>
                            <span className="text-slate-800 font-semibold">{fromClient}</span>
                          </div>
                        ) : (
                          <div className="truncate" title={`To: ${toClient}`}>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded mr-1.5 inline-block">
                              To
                            </span>
                            <span className="text-slate-800 font-semibold">{toClient}</span>
                          </div>
                        )}
                      </td>

                      {/* Billing Firm */}
                      <td className="px-4 py-3 max-w-[180px] truncate text-slate-700" title={billingFirm}>
                        {billingFirm}
                      </td>

                      {/* Broker */}
                      <td className="px-4 py-3 text-slate-700">
                        {brokerMap.get(order.brokerId) || 'Direct'}
                      </td>

                      {/* Rate */}
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-700">
                        {formatCurrency(order.rate)}
                        <span className="text-[10px] text-slate-400 block">/{getUnitLabel(order.unit)}</span>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3 font-semibold text-slate-900 tabular-nums">
                        {formatQuantityWithUnit(order.quantity, order.unit)}
                      </td>

                      {/* Remaining Quantity */}
                      <td className="px-4 py-3 text-left tabular-nums">
                        <span
                          className={`font-bold ${
                            remaining === 0
                              ? 'text-emerald-600'
                              : remaining > 50
                              ? 'text-amber-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {formatQuantityWithUnit(remaining, order.unit)}
                        </span>
                      </td>

                      {/* Start Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">
                        {formatDate(order.startDate)}
                        <div className={`mt-0.5 text-[10px] font-semibold ${hasStarted ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {hasStarted ? 'contract started' : 'upcoming'}
                        </div>
                      </td>

                      {/* Validity */}
                      <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(order.expiryDate)}</span>
                        </div>
                        {order.status === 'PENDING' && (
                          <div className="mt-0.5">
                            {daysMeta.isExpired ? (
                              <span className="text-[10px] font-semibold text-red-600 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Expired
                              </span>
                            ) : daysMeta.isUrgent ? (
                              <span className="text-[10px] font-semibold text-amber-600">
                                {daysMeta.days} days left
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                {daysMeta.days} days left
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions: Vertical Three Dots with Dropdown */}
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openActionMenuId === order.id) {
                                setOpenActionMenuId(null);
                              } else {
                                actionMenuTriggerRef.current = e.currentTarget;
                                setActionMenuOpensUp(false);
                                setActionMenuMaxHeight(undefined);
                                setOpenActionMenuId(order.id);
                              }
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg border border-slate-200/60 shadow-2xs transition-colors cursor-pointer"
                            title="Order Options"
                            aria-label="Order Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionMenuId === order.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={() => setOpenActionMenuId(null)}
                              />
                              <div
                                ref={actionMenuRef}
                                style={actionMenuMaxHeight === undefined ? undefined : { maxHeight: actionMenuMaxHeight }}
                                className={`absolute right-0 ${actionMenuOpensUp ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    navigate('order-detail', { orderId: order.id });
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View Order Details</span>
                                </button>

                                {order.status === 'PENDING' && !isLabour && (
                                  <button
                                    type="button"
                                    onClick={() => void handleOrderStatusChange(order, 'COMPLETED')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Mark Completed</span>
                                  </button>
                                )}

                                {order.status === 'COMPLETED' && !isLabour && (
                                  <button
                                    type="button"
                                    onClick={() => void handleOrderStatusChange(order, 'PENDING')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 cursor-pointer"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Mark Pending</span>
                                  </button>
                                )}

                                {!isLabour && (
                                  <button
                                    type="button"
                                    onClick={() => void handleOrderEdit(order)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Edit Order</span>
                                  </button>
                                )}

                                {isOwner && (
                                  <>
                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setDeleteOrderTarget(order);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      <span>Delete Order</span>
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

        {/* Pagination Footer */}
        {(serverPage.total > 0 || totalPages > 1) && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {serverPage.total === 0 ? 0 : (currentPageNum - 1) * pageSize + 1} to {Math.min(currentPageNum * pageSize, serverPage.total)} of {serverPage.total} orders
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPageNum === 1}
                onClick={() => setCurrentPageNum(p => p - 1)}
                className="px-2.5 py-1 border border-slate-200 rounded bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-medium">{currentPageNum} / {totalPages}</span>
              <button
                type="button"
                disabled={currentPageNum === totalPages}
                onClick={() => setCurrentPageNum(p => p + 1)}
                className="px-2.5 py-1 border border-slate-200 rounded bg-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteOrderTarget}
        title="Delete Order"
        message={`Are you sure you want to delete order ${deleteOrderTarget?.orderNumber}? If transports are allocated to this order, their fulfillment links will be affected.`}
        confirmLabel="Yes, Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteOrderTarget(null)}
      />

      {/* Select Order Type Modal (Purchase vs Sales) */}
      {showTypeSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Order Type</h3>
                <p className="text-xs text-slate-500 mt-0.5">Which type of commodity contract would you like to create?</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTypeSelectModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {/* Purchase Order Option */}
              <button
                type="button"
                onClick={() => {
                  setShowTypeSelectModal(false);
                  navigate('order-form', { initialType: 'PURCHASE ORDER' });
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-900">Purchase Order</span>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Inward</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Procurement / inward contract from farmers, mandis, or supplier clients into your godown or firm.
                  </p>
                </div>
              </button>

              {/* Sales Order Option */}
              <button
                type="button"
                onClick={() => {
                  setShowTypeSelectModal(false);
                  navigate('order-form', { initialType: 'SALES ORDER' });
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-blue-900">Sales Order</span>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">Outward</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Sales / outward contract to millers, food processors, or external commercial buyers.
                  </p>
                </div>
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTypeSelectModal(false)}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
