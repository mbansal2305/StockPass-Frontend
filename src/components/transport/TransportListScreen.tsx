import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Transport, TransportStatus, Transporter } from '../../types';
import { PaginatedTransportsResult, transportsApi } from '../../api';
import {
  Search,
  Plus,
  Truck,
  Layers,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  ArrowRight,
  FilterX,
  Calendar,
  FileSpreadsheet,
  MoreVertical
} from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { MultiSearchableSelect } from '../common/SearchableSelect';
import { formatDate, formatQuantityWithUnit, getTransportStatusBadge } from '../../utils/formatters';

const toNumericIds = (ids: string[]): number[] | undefined => {
  const numericIds = ids
    .map(id => Number(id))
    .filter(id => Number.isSafeInteger(id) && id > 0);
  return numericIds.length ? numericIds : undefined;
};

type DatePreset = 'all' | 'month' | 'three-months' | 'six-months' | 'range';

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

export const TransportListScreen: React.FC = () => {
  const {
    commodities,
    clients,
    transporters,
    orders,
    currentUser,
    refreshData,
    showToast,
    transportGet,
    navigate,
    pageParams
  } = useApp();

  const isOwner = currentUser?.role === 'OWNER';
  const isLabour = currentUser?.role === 'LABOUR';
  const isAccountant = currentUser?.role === 'ACCOUNTANT';

  // Filters & Tabs
  const validStatuses: TransportStatus[] = ['DRAFT', 'PENDING', 'DELIVERY', 'FINANCE', 'PAID'];
  const initialStatus = String(pageParams.statusFilter || 'PENDING').toUpperCase() as TransportStatus;
  const [activeTab, setActiveTab] = useState<TransportStatus | 'ALL'>(
    validStatuses.includes(initialStatus) ? initialStatus : 'PENDING'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState<string[]>([]);
  const [transporterFilter, setTransporterFilter] = useState<string[]>([]);
  const [billingFirmFilter, setBillingFirmFilter] = useState<string[]>([]);
  const [partyFilter, setPartyFilter] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [loadingDateFrom, setLoadingDateFrom] = useState('');
  const [loadingDateTo, setLoadingDateTo] = useState('');
  const [transporterOptions, setTransporterOptions] = useState<Transporter[]>([]);

  // Pagination
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const pageSize = 100;
  const [reloadSequence, setReloadSequence] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serverPage, setServerPage] = useState<PaginatedTransportsResult>({
    results: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1
  });

  // Confirm delete, status change & Action menu
  const [deleteTarget, setDeleteTarget] = useState<Transport | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    transport: Transport;
    nextStatus: TransportStatus;
  } | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const isPaidTab = activeTab === 'PAID';

  // Lookups
  const commodityMap = useMemo(() => new Map(commodities.map(c => [c.id, c])), [commodities]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
  const transporterMap = useMemo(() => new Map(transporters.map(t => [t.id, t.name])), [transporters]);

  useEffect(() => {
    let isCurrent = true;
    transportsApi.selectAgencyOptions()
      .then(options => {
        if (isCurrent) setTransporterOptions(options);
      })
      .catch(() => {
        if (isCurrent) setTransporterOptions(transporters);
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
    setIsLoading(true);
    setLoadError('');
    transportsApi.listPaginated({
      status: activeTab === 'ALL' ? undefined : activeTab.toLowerCase() as Lowercase<TransportStatus>,
      commodity: toNumericIds(commodityFilter),
      transporter: toNumericIds(transporterFilter),
      billing_firm: toNumericIds(billingFirmFilter),
      party: toNumericIds(partyFilter),
      loading_start_date: loadingDateFrom || undefined,
      loading_end_date: loadingDateTo || undefined,
      search: debouncedSearchTerm || undefined,
      page: currentPageNum,
      page_size: pageSize
    }, { clients, commodities, orders, transporters })
      .then(result => {
        if (isCurrent) setServerPage(result);
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoadError(error instanceof Error ? error.message : 'Failed to load transports');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    activeTab,
    commodityFilter,
    transporterFilter,
    billingFirmFilter,
    partyFilter,
    loadingDateFrom,
    loadingDateTo,
    debouncedSearchTerm,
    currentPageNum,
    pageSize,
    reloadSequence,
    clients,
    commodities,
    orders,
    transporters
  ]);

  const openTransport = async (transportId: string, destination: 'transport-detail' | 'transport-form') => {
    try {
      await transportGet(transportId);
      navigate(destination, { transportId });
    } catch (error: any) {
      showToast(error.message || 'Failed to load transport details', 'error');
    }
  };

  const totalPages = serverPage.totalPages || 1;
  const paginatedTransports = serverPage.results;

  const getNextStatus = (current: TransportStatus): TransportStatus | null => {
    if (current === 'PENDING') return 'DELIVERY';
    if (current === 'DELIVERY') return 'FINANCE';
    if (current === 'FINANCE') return 'PAID';
    return null;
  };

  const handleAdvanceStatus = async () => {
    if (!statusChangeTarget) return;
    const { transport, nextStatus } = statusChangeTarget;
    try {
      await transportsApi.updateStatus(transport.id, nextStatus);
      await refreshData();
      setReloadSequence(sequence => sequence + 1);
      setStatusChangeTarget(null);
      showToast(`Vehicle ${transport.vehicleNumber} moved to ${nextStatus}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update transport status', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await transportsApi.delete(deleteTarget.id);
      await refreshData();
      setReloadSequence(sequence => sequence + 1);
      setDeleteTarget(null);
      showToast(`Transport consignment ${deleteTarget.billNumber} deleted`, 'info');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete transport', 'error');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCommodityFilter([]);
    setTransporterFilter([]);
    setBillingFirmFilter([]);
    setPartyFilter([]);
    setDatePreset('all');
    setLoadingDateFrom('');
    setLoadingDateTo('');
    setCurrentPageNum(1);
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setCurrentPageNum(1);

    if (preset === 'all' || preset === 'range') {
      setLoadingDateFrom('');
      setLoadingDateTo('');
      return;
    }

    const today = new Date();
    const fromDate = preset === 'month'
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : shiftDateByMonths(today, preset === 'three-months' ? -3 : -6);
    setLoadingDateFrom(toDateInputValue(fromDate));
    setLoadingDateTo(toDateInputValue(today));
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 tracking-tight"><Truck className="h-5 w-5 text-blue-600" />Transport Logistics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor truck consignments, gross & received weights, waybills, and freight disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isLabour && (
            <button
              type="button"
              onClick={() => navigate('bulk-transport-list')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Bulk Transport
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('transport-form')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Transport
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]">
          <div className="relative lg:col-start-1 lg:row-start-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPageNum(1); }}
              placeholder="Search vehicle #, bill/bilty #, mandi anugya, transporter..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:col-start-2 lg:row-start-1">
            <MultiSearchableSelect
              id="transport-party-filter"
              selectedIds={partyFilter}
              options={clients.map(client => ({ id: client.id, label: client.city ? `${client.name} (${client.city})` : client.name, searchText: `${client.type} ${client.city || ''}` }))}
              placeholder="All Parties"
              onChange={values => { setPartyFilter(values); setCurrentPageNum(1); }}
            />
            <MultiSearchableSelect
              id="transport-commodity-filter"
              selectedIds={commodityFilter}
              options={commodities.map(commodity => ({ id: commodity.id, label: commodity.type ? `${commodity.name} (${commodity.type})` : commodity.name, searchText: commodity.type }))}
              placeholder="All Commodities"
              onChange={values => { setCommodityFilter(values); setCurrentPageNum(1); }}
            />
            <MultiSearchableSelect
              id="transport-transporter-filter"
              selectedIds={transporterFilter}
              options={transporterOptions.map(transporter => ({ id: transporter.id, label: transporter.city ? `${transporter.name} (${transporter.city})` : transporter.name, searchText: transporter.city }))}
              placeholder="All Transporters"
              onChange={values => { setTransporterFilter(values); setCurrentPageNum(1); }}
            />
            <MultiSearchableSelect
              id="transport-billing-firm-filter"
              selectedIds={billingFirmFilter}
              options={clients
                .filter(client => String(client.type).toUpperCase() === 'MY_FIRM')
                .map(client => ({ id: client.id, label: client.city ? `${client.name} (${client.city})` : client.name, searchText: client.city || '' }))}
              placeholder="All Billing Firms"
              onChange={values => { setBillingFirmFilter(values); setCurrentPageNum(1); }}
            />
            {(searchTerm || commodityFilter.length > 0 || transporterFilter.length > 0 || billingFirmFilter.length > 0 || partyFilter.length > 0 || loadingDateFrom || loadingDateTo) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                <FilterX className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-y border-slate-100 py-2 lg:col-span-2 lg:row-start-2" aria-label="Loading date filter">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Calendar className="h-3.5 w-3.5" />
              Loading date
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Loading date range">
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
                    datePreset === preset ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
                  aria-label="Loading date from"
                  value={loadingDateFrom}
                  onChange={event => { setLoadingDateFrom(event.target.value); setCurrentPageNum(1); }}
                  className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  aria-label="Loading date to"
                  value={loadingDateTo}
                  onChange={event => { setLoadingDateTo(event.target.value); setCurrentPageNum(1); }}
                  className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Status Color Legend:</span>
          <span className="text-[11px] text-slate-400">Rows are color-coded by shipment lifecycle</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('ALL'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 border-slate-400 ring-2 ring-slate-400/30'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/60'
            }`}
            aria-pressed={activeTab === 'ALL'}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('DRAFT'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'DRAFT'
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
            onClick={() => { setActiveTab('PENDING'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'PENDING'
                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/30'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/60'
            }`}
            title="Filter by Pending"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600"></span>
            <span>Pending</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('DELIVERY'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'DELIVERY'
                ? 'bg-blue-100 text-blue-900 border-blue-300 ring-2 ring-blue-400/30'
                : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100/60'
            }`}
            title="Filter by Delivery"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-600"></span>
            <span>Delivery</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('FINANCE'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'FINANCE'
                ? 'bg-purple-100 text-purple-900 border-purple-300 ring-2 ring-purple-400/30'
                : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100/60'
            }`}
            title="Filter by Finance"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-purple-600"></span>
            <span>Finance</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('PAID'); setCurrentPageNum(1); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'PAID'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-2 ring-emerald-400/30'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60'
            }`}
            title="Filter by Paid"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>
            <span>Paid</span>
          </button>
        </div>
      </div>

      {/* Transport Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Loading Date</th>
                <th className="px-4 py-3">Bill / Bilty</th>
                <th className="px-4 py-3">Vehicle No</th>
                <th className="px-4 py-3">Commodity</th>
                <th className="px-4 py-3">Route (From → To)</th>
                <th className="px-4 py-3 text-right">Gross Weight</th>
                <th className="px-4 py-3 text-right">Bharti (Kg)</th>
                <th className="px-4 py-3 text-right">Received Weight</th>
                <th className="px-4 py-3">Unload Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">Loading transports...</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <p className="text-red-600 font-medium">{loadError}</p>
                    <button
                      type="button"
                      onClick={() => setReloadSequence(sequence => sequence + 1)}
                      className="mt-3 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : paginatedTransports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <p className="text-slate-500 font-medium">No transport entries found matching criteria</p>
                    <button
                      type="button"
                      onClick={() => navigate('transport-form')}
                      className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Transport
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedTransports.map((t) => {
                  const comm = commodityMap.get(t.commodityId);
                  const transp = transporterMap.get(t.transporterId) || '-';
                  const fromClient = clientMap.get(t.fromClientId) || '-';
                  const toClient = clientMap.get(t.toClientId) || '-';
                  const nextStatus = getNextStatus(t.status);
                  const grossWeightKg = t.grossWeightUnit === 'mt'
                    ? t.grossWeight * 1000
                    : t.grossWeightUnit === 'quintal'
                    ? t.grossWeight * 100
                    : t.grossWeight;
                  const bagTareKg = ((t.bagNumbers || 0) * (t.bagWeight || 0)) / 1000;
                  const bhartiKg = t.bagNumbers
                    ? (grossWeightKg - bagTareKg) / t.bagNumbers
                    : null;

                  // Color row background & left border by status
                  const rowBgClass =
                    t.status === 'DRAFT'
                      ? 'bg-slate-50/70 hover:bg-slate-100/70 border-l-4 border-l-slate-400'
                      : t.status === 'PENDING'
                      ? 'bg-amber-50/50 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                      : t.status === 'DELIVERY'
                      ? 'bg-blue-50/50 hover:bg-blue-100/60 border-l-4 border-l-blue-500'
                      : t.status === 'FINANCE'
                      ? 'bg-purple-50/50 hover:bg-purple-100/60 border-l-4 border-l-purple-500'
                      : 'bg-emerald-50/50 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500';

                  return (
                    <tr
                      key={t.id}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('button, a, input, select')) return;
                        void openTransport(t.id, 'transport-detail');
                      }}
                      className={`${rowBgClass} transition-colors cursor-pointer`}
                    >
                      {/* Loading Date */}
                      <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDate(t.loadingDate)}
                      </td>

                      {/* Bill Number */}
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">
                        <button
                          type="button"
                          onClick={() => void openTransport(t.id, 'transport-detail')}
                          className="hover:text-blue-600 text-left cursor-pointer"
                        >
                          {t.billNumber}
                        </button>
                        <div className="text-[10px] text-slate-500 truncate" title={clientMap.get(t.billingFirmId) || '-'}>
                          {clientMap.get(t.billingFirmId) || '-'}
                        </div>
                      </td>

                      {/* Vehicle Number */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => void openTransport(t.id, 'transport-detail')}
                          className="hover:text-blue-600 cursor-pointer"
                        >
                          {t.vehicleNumber}
                        </button>
                        <div className="text-[10px] font-sans font-normal text-slate-500 truncate" title={transp}>
                          {transp}
                        </div>
                      </td>

                      {/* Commodity */}
                      <td className="px-4 py-3 text-slate-800 font-medium">
                        {comm?.name || '-'}
                        {comm?.type && <span className="text-slate-500 font-normal"> ({comm.type})</span>}
                        {t.bagNumbers && (
                          <span className="text-[10px] text-slate-400 block tabular-nums">
                            {t.bagNumbers} bags
                          </span>
                        )}
                      </td>

                      {/* Route */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <div className="text-slate-800 font-medium truncate" title={fromClient}>
                          {fromClient}
                        </div>
                        <div className="text-slate-400 text-[10px] flex items-center gap-0.5 truncate" title={toClient}>
                          <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                          {toClient}
                        </div>
                      </td>

                      {/* Gross Weight */}
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                        {formatQuantityWithUnit(t.grossWeight, t.grossWeightUnit)}
                      </td>

                      {/* Bharti */}
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {bhartiKg !== null && Number.isFinite(bhartiKg)
                          ? bhartiKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                          : '-'}
                      </td>

                      {/* Received Weight */}
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {t.receivedWeight ? formatQuantityWithUnit(t.receivedWeight, t.grossWeightUnit) : '-'}
                      </td>

                      {/* Unload Date */}
                      <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDate(t.unloadDate)}
                      </td>

                      {/* Actions: Vertical Three Dots with Dropdown */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === t.id ? null : t.id);
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg border border-slate-200/60 shadow-2xs transition-colors cursor-pointer"
                            title="Transport Options"
                            aria-label="Transport Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionMenuId === t.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenActionMenuId(null);
                                }}
                              />
                              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    void openTransport(t.id, 'transport-detail');
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View Consignment</span>
                                </button>

                                {nextStatus && (!isLabour || nextStatus === 'DELIVERY' || nextStatus === 'FINANCE') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setStatusChangeTarget({ transport: t, nextStatus });
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Advance to {nextStatus}</span>
                                  </button>
                                )}

                                {(!isPaidTab || isOwner) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      void openTransport(t.id, 'transport-form');
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Edit Consignment</span>
                                  </button>
                                )}

                                {isOwner && (
                                  <>
                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setDeleteTarget(t);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      <span>Delete Transport</span>
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
              Showing {serverPage.total === 0 ? 0 : (currentPageNum - 1) * pageSize + 1} to {Math.min(currentPageNum * pageSize, serverPage.total)} of {serverPage.total} transports
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

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={!!statusChangeTarget}
        title="Advance Transport Stage"
        message={`Move vehicle consignment ${statusChangeTarget?.transport.vehicleNumber} (${statusChangeTarget?.transport.billNumber}) from ${statusChangeTarget?.transport.status} to stage "${statusChangeTarget?.nextStatus}"?`}
        confirmLabel="Confirm Transition"
        variant="primary"
        onConfirm={handleAdvanceStatus}
        onCancel={() => setStatusChangeTarget(null)}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete Transport Consignment"
        message={`Are you sure you want to remove consignment ${deleteTarget?.billNumber} (${deleteTarget?.vehicleNumber})? This will deduct the allocated quantities from its associated orders.`}
        confirmLabel="Yes, Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
