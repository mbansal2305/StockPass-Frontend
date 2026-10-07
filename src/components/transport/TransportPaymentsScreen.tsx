import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Transport, TransportRentType, QuantityUnit, TransportStatus } from '../../types';
import { apiClient, PaginatedTransportsResult, TransportClientOption, transportsApi } from '../../api';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { formatCurrency, formatDate, formatQuantityWithUnit } from '../../utils/formatters';
import { DecimalInput } from '../common/DecimalInput';
import { Edit2, FilterX, Printer, Search, X } from 'lucide-react';
import { getImageSource } from '../../utils/images';

interface PaymentDraft {
  status: TransportStatus;
  receivedWeight: number;
  unloadDate: string;
  rent: number;
  rentType: TransportRentType;
  advanceByClient: number;
  advanceByFirm: number;
  shortageAmount: number;
  extraAmount: number;
  finalPaid: number;
  notes: string;
}

type ExportPaymentMode = 'advance' | 'paid';

interface ExportPaymentDraft {
  amount: number;
  mode: ExportPaymentMode;
}

const effectivePaymentAmounts = (draft: PaymentDraft, exportPaymentDraft: ExportPaymentDraft) => ({
  advanceByFirm: draft.advanceByFirm + (exportPaymentDraft.mode === 'advance' ? exportPaymentDraft.amount : 0),
  finalPaid: exportPaymentDraft.mode === 'paid' ? exportPaymentDraft.amount : draft.finalPaid
});

const draftFromTransport = (transport: Transport): PaymentDraft => ({
  status: transport.status,
  receivedWeight: transport.receivedWeight || 0,
  unloadDate: transport.unloadDate || '',
  rent: transport.rent || 0,
  rentType: transport.rentType || 'per_unit',
  advanceByClient: transport.advanceByClient || 0,
  advanceByFirm: transport.advanceByFirm || 0,
  shortageAmount: transport.shortage || 0,
  extraAmount: transport.extraPaid || 0,
  finalPaid: transport.finalPaid || 0,
  notes: transport.notes || ''
});

const quantityToQuintals = (quantity: number, unit: QuantityUnit | undefined): number => {
  if (unit === 'mt') return quantity * 10;
  if (unit === 'kg') return quantity / 100;
  return quantity;
};

const unitName = (unit: QuantityUnit | undefined): string => {
  if (unit === 'mt') return 'MT';
  if (unit === 'kg') return 'KG';
  return 'Qtl';
};

export const TransportPaymentsScreen: React.FC = () => {
  const {
    commodities,
    clients,
    transporters,
    orders,
    currentUser,
    refreshData,
    showToast,
    transportGet,
    navigate
  } = useApp();

  const [activeStatus, setActiveStatus] = useState<TransportStatus>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('ALL');
  const [transporterFilter, setTransporterFilter] = useState('ALL');
  const [billingFirmFilter, setBillingFirmFilter] = useState('ALL');
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
  const [drafts, setDrafts] = useState<Record<string, PaymentDraft>>({});
  const [exportPaymentDrafts, setExportPaymentDrafts] = useState<Record<string, ExportPaymentDraft>>({});
  const [pendingSubmit, setPendingSubmit] = useState<Transport | null>(null);
  const [pendingEdit, setPendingEdit] = useState<Transport | null>(null);
  const [printTransport, setPrintTransport] = useState<Transport | null>(null);
  const [billingFirmOptions, setBillingFirmOptions] = useState<TransportClientOption[]>([]);
  const [logoSourceIndex, setLogoSourceIndex] = useState(0);
  const [resolvedLogoSource, setResolvedLogoSource] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError('');
    transportsApi.listPaginated({
      status: activeStatus,
      commodity: commodityFilter === 'ALL' ? undefined : commodityFilter,
      transporter: transporterFilter === 'ALL' ? undefined : transporterFilter,
      billingFirm: billingFirmFilter === 'ALL' ? undefined : billingFirmFilter,
      page: currentPageNum,
      pageSize
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
    activeStatus,
    commodityFilter,
    transporterFilter,
    billingFirmFilter,
    currentPageNum,
    pageSize,
    reloadSequence,
    clients,
    commodities,
    orders,
    transporters
  ]);

  useEffect(() => {
    let cancelled = false;
    transportsApi.selectBillingFirms().then(firms => {
      if (!cancelled) setBillingFirmOptions(firms);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const commodityMap = useMemo(() => new Map(commodities.map(item => [item.id, item])), [commodities]);
  const clientMap = useMemo(() => new Map(clients.map(item => [item.id, item.name])), [clients]);
  const transporterMap = useMemo(() => new Map(transporters.map(item => [item.id, item.name])), [transporters]);
  const logoClient = printTransport ? clients.find(client => client.id === printTransport.billingFirmId) : undefined;
  const logoFirmOption = printTransport ? billingFirmOptions.find(client => client.id === printTransport.billingFirmId) : undefined;
  const logoSources = [logoClient?.imageUrl, logoFirmOption?.imageUrl, logoClient?.image, logoClient?.profile_picture, logoFirmOption?.image]
    .map(getImageSource)
    .filter((source, index, sources) => source && sources.indexOf(source) === index);
  const activeLogoSource = logoSources[logoSourceIndex] || '';

  useEffect(() => {
    if (!activeLogoSource) {
      setResolvedLogoSource('');
      return;
    }
    if (!/^https?:\/\//i.test(activeLogoSource)) {
      setResolvedLogoSource(activeLogoSource);
      return;
    }

    let cancelled = false;
    let objectUrl = '';
    setResolvedLogoSource('');
    const headers = new Headers({ 'ngrok-skip-browser-warning': 'true' });
    const accessToken = apiClient.getAccessToken();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    fetch(activeLogoSource, { headers })
      .then(async response => {
        if (!response.ok) throw new Error(`Logo request failed (${response.status})`);
        const imageBlob = await response.blob();
        if (imageBlob.type.includes('text/html')) throw new Error('Logo request returned an HTML page');
        const contentType = imageBlob.type.startsWith('image/') ? imageBlob.type : 'image/jpeg';
        return new Blob([imageBlob], { type: contentType });
      })
      .then(imageBlob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(imageBlob);
        setResolvedLogoSource(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLogoSourceIndex(index => index + 1);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeLogoSource]);

  const getDraft = (transport: Transport): PaymentDraft => drafts[transport.id] || draftFromTransport(transport);
  const getExportPaymentDraft = (transport: Transport): ExportPaymentDraft =>
    exportPaymentDrafts[transport.id] || { amount: 0, mode: 'advance' };
  const updateDraft = (transport: Transport, patch: Partial<PaymentDraft>) => {
    setDrafts(previous => ({
      ...previous,
      [transport.id]: { ...draftFromTransport(transport), ...previous[transport.id], ...patch }
    }));
  };
  const updateExportPaymentDraft = (transport: Transport, patch: Partial<ExportPaymentDraft>) => {
    setExportPaymentDrafts(previous => {
      const current = previous[transport.id] || { amount: 0, mode: 'advance' };
      return {
        ...previous,
        [transport.id]: { ...current, ...patch }
      };
    });
  };

  const filteredTransports = useMemo(() => serverPage.results.filter(transport => {
    const commodityName = commodityMap.get(transport.commodityId)?.name || '';
    const transporterName = transporterMap.get(transport.transporterId) || '';
    const billingFirmName = clientMap.get(transport.billingFirmId) || '';
    const fromName = clientMap.get(transport.fromClientId) || '';
    const toName = clientMap.get(transport.toClientId) || '';
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch = [
      transport.billNumber,
      transport.vehicleNumber,
      commodityName,
      transporterName,
      billingFirmName,
      fromName,
      toName
    ].some(value => value.toLowerCase().includes(lowerSearch));
    return matchesSearch;
  }), [serverPage.results, commodityMap, transporterMap, clientMap, searchTerm]);

  const resetFilters = () => {
    setActiveStatus('PENDING');
    setSearchTerm('');
    setCommodityFilter('ALL');
    setTransporterFilter('ALL');
    setBillingFirmFilter('ALL');
    setCurrentPageNum(1);
  };

  const totalPages = serverPage.totalPages || 1;
  const isPendingTab = activeStatus === 'PENDING';
  const statusFilterItems = [
    { value: 'DRAFT' as const, label: 'Draft', active: 'bg-slate-200 text-slate-900 border-slate-400 ring-2 ring-slate-400/30', idle: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/60', dot: 'bg-slate-400 border-slate-500' },
    { value: 'PENDING' as const, label: 'Pending', active: 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/30', idle: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/60', dot: 'bg-amber-500 border-amber-600' },
    { value: 'DELIVERY' as const, label: 'Delivery', active: 'bg-blue-100 text-blue-900 border-blue-300 ring-2 ring-blue-400/30', idle: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100/60', dot: 'bg-blue-500 border-blue-600' },
    { value: 'FINANCE' as const, label: 'Finance', active: 'bg-purple-100 text-purple-900 border-purple-300 ring-2 ring-purple-400/30', idle: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100/60', dot: 'bg-purple-500 border-purple-600' },
    { value: 'PAID' as const, label: 'Paid', active: 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-2 ring-emerald-400/30', idle: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60', dot: 'bg-emerald-500 border-emerald-600' }
  ];

  const savePayment = async () => {
    if (!pendingSubmit) return;
    const transport = pendingSubmit;
    const currentDraft = getDraft(transport);
    const draft = isPendingTab
      ? currentDraft
      : { ...draftFromTransport(transport), status: currentDraft.status };
    const exportPaymentDraft = isPendingTab
      ? getExportPaymentDraft(transport)
      : { amount: 0, mode: 'advance' as const };
    const paymentAmounts = effectivePaymentAmounts(draft, exportPaymentDraft);
    setSavingId(transport.id);
    try {
      await transportsApi.updatePayments({
        id: transport.id,
        status: draft.status,
        receivedWeight: draft.receivedWeight,
        unloadDate: draft.unloadDate,
        rent: draft.rent,
        rentType: draft.rentType,
        advanceByClient: draft.advanceByClient,
        advanceByFirm: paymentAmounts.advanceByFirm,
        shortageAmount: draft.shortageAmount,
        extraAmount: draft.extraAmount,
        finalPaid: paymentAmounts.finalPaid,
        notes: draft.notes
      });
      setDrafts(previous => ({
        ...previous,
        [transport.id]: { ...draft, ...paymentAmounts }
      }));
      setExportPaymentDrafts(previous => {
        const next = { ...previous };
        delete next[transport.id];
        return next;
      });
      await refreshData();
      setReloadSequence(sequence => sequence + 1);
      setPendingSubmit(null);
      showToast(`Payment saved for ${transport.billNumber}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to save transport payment', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const editTransport = async () => {
    if (!pendingEdit) return;
    const transportId = pendingEdit.id;
    setPendingEdit(null);
    try {
      await transportGet(transportId);
      navigate('transport-form', { transportId });
    } catch (error: any) {
      showToast(error.message || 'Failed to load transport details', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Transport Payments</h1>
        <p className="mt-0.5 text-xs text-slate-500">Review receipts, settle freight, and close consignments.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={event => {
              setSearchTerm(event.target.value);
              setCurrentPageNum(1);
            }}
            placeholder="Search bill, vehicle, firm, route, transporter..."
            className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <select value={commodityFilter} onChange={event => { setCommodityFilter(event.target.value); setCurrentPageNum(1); }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <option value="ALL">All Commodities</option>
          {commodities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={transporterFilter} onChange={event => { setTransporterFilter(event.target.value); setCurrentPageNum(1); }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <option value="ALL">All Transporters</option>
          {transporters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={billingFirmFilter} onChange={event => { setBillingFirmFilter(event.target.value); setCurrentPageNum(1); }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <option value="ALL">All Billing Firms</option>
          {clients.filter(client => String(client.type).toUpperCase() === 'MY_FIRM').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {(searchTerm || commodityFilter !== 'ALL' || transporterFilter !== 'ALL' || billingFirmFilter !== 'ALL') && (
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <FilterX className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Status Color Legend:</span>
          <span className="text-[11px] text-slate-400">Rows are color-coded by shipment lifecycle</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusFilterItems.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setActiveStatus(item.value);
                setCurrentPageNum(1);
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                activeStatus === item.value ? item.active : item.idle
              }`}
              title={`Filter by ${item.label}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full border ${item.dot}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-t-lg border-x border-t border-slate-200 bg-white">
        <table className="w-full min-w-[2160px] table-fixed text-left text-[11px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 w-[62px] bg-slate-50 px-1 py-2"></th>
              <th className="sticky left-[62px] z-20 w-[45px] bg-slate-50 px-2 py-2">Date</th>
              <th className="sticky left-[107px] z-20 w-[95px] bg-slate-50 px-1 py-2">Bill</th>
              <th className="sticky left-[202px] z-20 w-[80px] bg-slate-50 px-1 py-2">Vehicle</th>
              <th className="sticky left-[282px] z-20 w-[90px] bg-slate-50 px-1 py-2">Route</th>
              <th className="sticky left-[372px] z-20 w-[50px] bg-slate-50 px-1 py-2 text-right">Gross Wt</th>
              <th className="w-[90px] px-2 py-2 text-right">Rcvd Wt</th>
              <th className="w-[100px] px-2 py-2">Unload Date</th>
              <th className="w-[120px] px-2 py-2">Agreed Rent</th>
              <th className="w-[80px] px-2 py-2 text-right">Total Rent</th>
              <th className="w-[80px] px-2 py-2 text-right">Adv. by Party</th>
              <th className="w-[80px] px-2 py-2 text-right">Adv. Paid</th>
              <th className="w-[80px] px-2 py-2 text-right">Shortage</th>
              <th className="w-[80px] px-2 py-2 text-right">Extra</th>
              <th className="w-[80px] px-2 py-2 text-right">Paid</th>
              <th className="w-[75px] px-2 py-2 text-right">Left</th>
              {isPendingTab && <th className="w-[120px] px-1 py-2">Export Amtount</th>}
              <th className="w-[145px] px-2 py-2">Notes</th>
              <th className="w-[82px] px-1 py-2">Status</th>
              <th className="w-[68px] px-1 py-2 text-center">Submit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={isPendingTab ? 20 : 19} className="py-10 text-center text-xs text-slate-500">Loading transports...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={isPendingTab ? 20 : 19} className="py-10 text-center text-xs text-red-600">{loadError}</td></tr>
            ) : filteredTransports.length === 0 ? (
              <tr><td colSpan={isPendingTab ? 20 : 19} className="py-10 text-center text-xs text-slate-500">No transport payments match these filters.</td></tr>
            ) : filteredTransports.map(transport => {
              const draft = getDraft(transport);
              const gross = Number(transport.grossWeight) || 0;
              const received = Number(draft.receivedWeight) || 0;
              const differenceQtl = quantityToQuintals(received - gross, transport.grossWeightUnit);
              const billableQuantity = received > 0 ? Math.min(gross, received) : gross;
              const totalRent = Math.trunc(draft.rentType === 'per_unit' ? billableQuantity * draft.rent : draft.rent);
              const exportPaymentDraft = getExportPaymentDraft(transport);
              const paymentAmounts = effectivePaymentAmounts(draft, exportPaymentDraft);
              const left = totalRent - draft.advanceByClient - paymentAmounts.advanceByFirm - draft.shortageAmount - paymentAmounts.finalPaid + draft.extraAmount;
              const party = clientMap.get(transport.billingFirmId) || '-';
              const carrier = transporterMap.get(transport.transporterId) || '-';
              const displayedParty = party.length > 15 ? `${party.slice(0, 15)}...` : party;
              const displayedCarrier = carrier.length > 12 ? `${carrier.slice(0, 12)}...` : carrier;
              const formattedLoadingDate = formatDate(transport.loadingDate);
              const loadingYear = formattedLoadingDate.match(/\b\d{4}\b$/)?.[0];
              const loadingDateLabel = loadingYear
                ? formattedLoadingDate.slice(0, -loadingYear.length).trim()
                : formattedLoadingDate;
              const from = clientMap.get(transport.fromClientId) || '-';
              const to = clientMap.get(transport.toClientId) || '-';
              const rowColor = draft.status === 'PENDING'
                ? 'bg-amber-50/50 hover:bg-amber-100/60'
                : draft.status === 'DRAFT'
                ? 'bg-slate-50 hover:bg-slate-100'
                : draft.status === 'DELIVERY'
                ? 'bg-blue-50/50 hover:bg-blue-100/60'
                : draft.status === 'FINANCE'
                ? 'bg-purple-50/50 hover:bg-purple-100/60'
                : 'bg-emerald-50/50 hover:bg-emerald-100/60';
              const stickyRowColor = draft.status === 'PENDING'
                ? 'bg-amber-50'
                : draft.status === 'DRAFT'
                ? 'bg-slate-50'
                : draft.status === 'DELIVERY'
                ? 'bg-blue-50'
                : draft.status === 'FINANCE'
                ? 'bg-purple-50'
                : 'bg-emerald-50';
              const statusSelectColor = draft.status === 'PENDING'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : draft.status === 'DRAFT'
                ? 'border-slate-300 bg-slate-50 text-slate-900'
                : draft.status === 'DELIVERY'
                ? 'border-blue-300 bg-blue-50 text-blue-900'
                : draft.status === 'FINANCE'
                ? 'border-purple-300 bg-purple-50 text-purple-900'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900';
              return (
                <tr key={transport.id} className={`align-top ${rowColor}`}>
                  <td className={`sticky left-0 z-10 px-1 py-2 text-center ${stickyRowColor}`}>
                    <div className="flex items-center justify-center gap-0.5">
                    <button type="button" title="Edit transport" aria-label={`Edit transport ${transport.billNumber}`} onClick={() => setPendingEdit(transport)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Print payment bill" aria-label={`Print payment bill ${transport.billNumber}`} onClick={() => { setLogoSourceIndex(0); setPrintTransport(transport); }} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900">
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    </div>
                  </td>
                  <td className={`sticky left-[62px] z-10 whitespace-nowrap px-2 py-2 text-slate-600 ${stickyRowColor}`} title={formattedLoadingDate}>
                    <div className="w-full">{loadingDateLabel}</div>
                    {loadingYear && <div className="w-full">{loadingYear}</div>}
                  </td>
                  <td className={`sticky left-[107px] z-10 px-1 py-2 ${stickyRowColor}`}>
                    <div className="font-mono font-semibold text-slate-900">{transport.billNumber}</div>
                    <div className="truncate text-[10px] text-slate-500" title={party}>{displayedParty}</div>
                  </td>
                  <td className={`sticky left-[202px] z-10 px-1 py-2 ${stickyRowColor}`}>
                    <div className="truncate font-mono text-slate-800" title={transport.vehicleNumber}>{transport.vehicleNumber}</div>
                    <div className="truncate text-[10px] text-slate-500" title={carrier}>{displayedCarrier}</div>
                  </td>
                  <td className={`sticky left-[282px] z-10 px-1 py-2 ${stickyRowColor}`}>
                    <div className="truncate text-slate-700" title={from}>{from}</div>
                    <div className="truncate text-[10px] text-slate-500" title={to}>→ {to}</div>
                  </td>
                  <td className={`sticky left-[372px] z-10 whitespace-nowrap px-1 py-2 text-right font-semibold tabular-nums text-slate-800 ${stickyRowColor}`}>
                    {formatQuantityWithUnit(gross, transport.grossWeightUnit)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DecimalInput
                        value={draft.receivedWeight}
                        onChange={receivedWeight => updateDraft(transport, { receivedWeight })}
                        disabled={!isPendingTab}
                        className="w-[72px] rounded border border-slate-300 px-1 py-1 text-right text-[11px] tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                      <span className="text-[9px] text-slate-500">{unitName(transport.grossWeightUnit)}</span>
                    </div>
                    <div className={`mt-1 whitespace-nowrap text-[10px] ${Math.abs(differenceQtl) < 1 ? 'text-emerald-700' : 'text-red-600'}`}>
                      Diff: {differenceQtl > 0 ? '+' : ''}{differenceQtl.toFixed(2)} Qtl
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input type="date" value={draft.unloadDate} onChange={event => updateDraft(transport, { unloadDate: event.target.value })} disabled={!isPendingTab} className="w-full min-w-[115px] rounded border border-slate-300 px-1.5 py-1 text-[11px] text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <div className="inline-flex shrink-0 rounded border border-slate-200 bg-slate-100 p-0.5">
                        <button type="button" disabled={!isPendingTab} aria-pressed={draft.rentType === 'per_unit'} onClick={() => updateDraft(transport, { rentType: 'per_unit' })} className={`rounded px-1.5 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${draft.rentType === 'per_unit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Per {unitName(transport.grossWeightUnit)}</button>
                        <button type="button" disabled={!isPendingTab} aria-pressed={draft.rentType === 'fix'} onClick={() => updateDraft(transport, { rentType: 'fix' })} className={`rounded px-1.5 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${draft.rentType === 'fix' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Fix</button>
                      </div>
                      <DecimalInput value={draft.rent} onChange={rent => updateDraft(transport, { rent })} disabled={!isPendingTab} className="w-[85px] shrink-0 rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-slate-800">{formatCurrency(totalRent)}</td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Advance by party" value={draft.advanceByClient} onChange={advanceByClient => updateDraft(transport, { advanceByClient })} disabled={!isPendingTab} className="ml-auto block w-[85px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Advance paid" value={paymentAmounts.advanceByFirm} onChange={advanceByFirm => updateDraft(transport, { advanceByFirm: Math.max(0, advanceByFirm - (exportPaymentDraft.mode === 'advance' ? exportPaymentDraft.amount : 0)) })} disabled={!isPendingTab} className="ml-auto block w-[85px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Shortage" value={draft.shortageAmount} onChange={shortageAmount => updateDraft(transport, { shortageAmount })} disabled={!isPendingTab} className="ml-auto block w-[85px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Extra" value={draft.extraAmount} onChange={extraAmount => updateDraft(transport, { extraAmount })} disabled={!isPendingTab} className="ml-auto block w-[85px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Paid" value={paymentAmounts.finalPaid} onChange={finalPaid => exportPaymentDraft.mode === 'paid' ? updateExportPaymentDraft(transport, { amount: finalPaid }) : updateDraft(transport, { finalPaid })} disabled={!isPendingTab} className="ml-auto block w-[85px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" /></td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums ${left < 100 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(left)}</td>
                  {isPendingTab && <td className="px-1 py-2">
                    <div className="flex items-center gap-1">
                      <div className="inline-flex shrink-0 rounded border border-slate-200 bg-slate-100 p-0.5">
                        <button type="button" aria-pressed={exportPaymentDraft.mode === 'advance'} onClick={() => updateExportPaymentDraft(transport, { mode: 'advance' })} className={`rounded px-1.5 py-1 text-[9px] font-semibold ${exportPaymentDraft.mode === 'advance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Adv</button>
                        <button type="button" aria-pressed={exportPaymentDraft.mode === 'paid'} onClick={() => updateExportPaymentDraft(transport, { mode: 'paid' })} className={`rounded px-1.5 py-1 text-[9px] font-semibold ${exportPaymentDraft.mode === 'paid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Paid</button>
                      </div>
                      <DecimalInput aria-label="Export amount" value={exportPaymentDraft.amount} onChange={amount => updateExportPaymentDraft(transport, { amount })} className={`w-[72px] shrink-0 rounded px-1 py-1 text-right text-[11px] tabular-nums text-slate-900 ${exportPaymentDraft.amount > 0 ? 'border-2 border-green-600' : 'border border-slate-300'}`} />
                    </div>
                  </td>}
                  <td className="px-2 py-2"><input aria-label="Payment notes" value={draft.notes} onChange={event => updateDraft(transport, { notes: event.target.value })} disabled={!isPendingTab} className="w-full min-w-[150px] rounded border border-slate-300 px-1.5 py-1 text-[11px] text-slate-900 disabled:cursor-not-allowed disabled:opacity-70" /></td>
                  <td className="px-1 py-2">
                    <select value={draft.status} onChange={event => updateDraft(transport, { status: event.target.value as TransportStatus })} className={`w-full rounded border px-1 py-1 text-[10px] font-semibold ${statusSelectColor}`}>
                      <option value="DRAFT">Draft</option>
                      <option value="PENDING">Pending</option>
                      <option value="DELIVERY">Delivery</option>
                      <option value="FINANCE">Finance</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </td>
                  <td className="px-1 py-2">
                    <button type="button" disabled={savingId === transport.id} onClick={() => setPendingSubmit(transport)} className="w-full rounded bg-slate-900 px-1 py-1.5 text-[9px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                      {savingId === transport.id ? 'Saving...' : 'Submit'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(serverPage.total > 0 || totalPages > 1) && (
        <div className="flex items-center justify-between rounded-b-lg border-x border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          <span>
            Showing {serverPage.total === 0 ? 0 : (currentPageNum - 1) * pageSize + 1} to {Math.min(currentPageNum * pageSize, serverPage.total)} of {serverPage.total} transports
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPageNum === 1}
              onClick={() => setCurrentPageNum(page => page - 1)}
              className="rounded border border-slate-200 bg-white px-2.5 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-medium">{currentPageNum} / {totalPages}</span>
            <button
              type="button"
              disabled={currentPageNum === totalPages}
              onClick={() => setCurrentPageNum(page => page + 1)}
              className="rounded border border-slate-200 bg-white px-2.5 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {printTransport && (() => {
        const printDraft = getDraft(printTransport);
        const gross = Number(printTransport.grossWeight) || 0;
        const received = Number(printDraft.receivedWeight) || 0;
        const difference = quantityToQuintals(received - gross, printTransport.grossWeightUnit);
        const billableQuantity = received > 0 ? Math.min(gross, received) : gross;
        const totalRent = Math.trunc(printDraft.rentType === 'per_unit' ? billableQuantity * printDraft.rent : printDraft.rent);
        const balance = totalRent - printDraft.advanceByClient - printDraft.advanceByFirm - printDraft.shortageAmount - printDraft.finalPaid + printDraft.extraAmount;
        const firm = clientMap.get(printTransport.billingFirmId) || 'Billing Firm';
        const firmDetails = logoClient;
        const firmLogo = resolvedLogoSource;
        const transporter = transporterMap.get(printTransport.transporterId) || '-';
        const initials = firm.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
        const today = new Date();
        const billDate = formatDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);

        return (
          <div className="payment-bill-print-root fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
            <article className="payment-bill-paper mx-auto max-w-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-10">
              <div className="no-print mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="text-sm font-semibold text-slate-900">Payment bill preview</h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                    <Printer className="h-4 w-4" /> Print / Save PDF
                  </button>
                  <button type="button" title="Close preview" aria-label="Close bill preview" onClick={() => setPrintTransport(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <header className="flex items-center gap-4 border-b-2 border-slate-900 pb-5 print:gap-3 print:pb-2">
                <div aria-label="Firm logo" className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-slate-300 bg-slate-50 text-lg font-bold text-slate-500 print:h-12 print:w-12 print:border-0 print:bg-white">
                  {firmLogo ? <img key={firmLogo} src={firmLogo} alt={`${firm} logo`} onError={() => setLogoSourceIndex(index => Math.min(index + 1, logoSources.length))} className="h-full w-full object-contain" /> : initials || 'LOGO'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Transport settlement</p>
                  <h1 className="mt-1 break-words text-xl font-bold text-slate-950 print:text-lg">{firm}</h1>
                  {firmDetails && <p className="mt-1 text-xs text-slate-600">{[firmDetails.address, firmDetails.city, firmDetails.pincode].filter(Boolean).join(', ')}</p>}
                  {firmDetails?.phone && <p className="mt-0.5 text-xs text-slate-600">Phone: {firmDetails.phone}</p>}
                  {firmDetails?.gstin && <p className="mt-0.5 text-xs text-slate-600">GSTIN: {firmDetails.gstin}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bill no.</p>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900">{printTransport.billNumber}</p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bill Date</p>
                  <p className="mt-1 text-xs font-medium text-slate-800">{billDate}</p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Unloading Date</p>
                  <p className="mt-1 text-xs font-medium text-slate-800">{formatDate(printDraft.unloadDate)}</p>
                </div>
              </header>

              <section className="grid grid-cols-2 gap-x-8 gap-y-4 border-b border-slate-200 py-5 print:gap-y-2 print:py-2 sm:grid-cols-2">
                <div><p className="text-[10px] font-semibold uppercase text-slate-500">Transporter</p><p className="mt-1 text-sm font-semibold text-slate-900">{transporter}</p></div>
                <div><p className="text-[10px] font-semibold uppercase text-slate-500">Vehicle number</p><p className="mt-1 font-mono text-sm font-semibold text-slate-900">{printTransport.vehicleNumber}</p></div>
              </section>

              <section className="py-5 print:py-2">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 print:mb-1">Weight and freight</h2>
                <div className="overflow-hidden border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                      <tr><th className="px-3 py-2 print:py-1">Gross weight</th><th className="px-3 py-2 print:py-1">Received weight</th><th className="px-3 py-2 text-right print:py-1">Difference</th><th className="px-3 py-2 text-right print:py-1">Rate</th><th className="px-3 py-2 text-right print:py-1">Freight amount</th></tr>
                    </thead>
                    <tbody><tr className="font-semibold text-slate-900">
                      <td className="px-3 py-3 print:py-1">{formatQuantityWithUnit(gross, printTransport.grossWeightUnit)}</td>
                      <td className="px-3 py-3 print:py-1">{formatQuantityWithUnit(received, printTransport.grossWeightUnit)}</td>
                      <td className="px-3 py-3 text-right print:py-1">{difference > 0 ? '+' : ''}{difference.toFixed(2)} Qtl</td>
                      <td className="px-3 py-3 text-right print:py-1">{formatCurrency(printDraft.rent)}{printDraft.rentType === 'per_unit' ? ` / ${unitName(printTransport.grossWeightUnit)}` : ' (fixed)'}</td>
                      <td className="px-3 py-3 text-right print:py-1">{formatCurrency(totalRent)}</td>
                    </tr></tbody>
                  </table>
                </div>
              </section>

              <section className="ml-auto max-w-sm border-t border-slate-200 pt-4 print:pt-2">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 print:mb-1">Settlement</h2>
                <dl className="space-y-2 text-xs print:space-y-1">
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Freight amount</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(totalRent)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Hamali (advance by party)</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.advanceByClient)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Advance paid by firm</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.advanceByFirm)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Shortage</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.shortageAmount)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Extra charges</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.extraAmount)}</dd></div>
                  <div className="flex justify-between gap-4 border-b border-slate-200 pb-2"><dt className="text-slate-600">Paid</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.finalPaid)}</dd></div>
                  <div className="flex justify-between gap-4 pt-1 text-sm font-bold"><dt className="text-slate-900">Balance due</dt><dd className="font-mono text-slate-900">{formatCurrency(balance)}</dd></div>
                </dl>
              </section>

              {printDraft.notes && <p className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-600 print:mt-3 print:pt-2">Notes: {printDraft.notes}</p>}
              <p className="mt-4 text-xs text-slate-600 print:mt-2">Bill Generated by: <span className="font-semibold text-slate-900">{currentUser?.name || 'Operator'}</span></p>
              <footer className="mt-14 grid grid-cols-2 gap-12 text-center text-[10px] text-slate-500 print:mt-8 print:gap-8">
                <div className="border-t border-slate-300 pt-2">Transporter signature</div>
                <div className="border-t border-slate-300 pt-2">Authorised signatory</div>
              </footer>
            </article>
          </div>
        );
      })()}

      <ConfirmationModal
        isOpen={Boolean(pendingSubmit)}
        title="Submit transport payment changes?"
        message={`This saves payment details for ${pendingSubmit?.billNumber || 'this consignment'} with the selected status.`}
        confirmLabel="Submit Changes"
        variant="primary"
        onConfirm={() => void savePayment()}
        onCancel={() => setPendingSubmit(null)}
      />
      <ConfirmationModal
        isOpen={Boolean(pendingEdit)}
        title="Leave payments and edit transport?"
        message="Unsaved changes in this payment row will be discarded. Continue to the transport edit screen?"
        confirmLabel="Edit Transport"
        variant="warning"
        onConfirm={() => void editTransport()}
        onCancel={() => setPendingEdit(null)}
      />
    </div>
  );
};