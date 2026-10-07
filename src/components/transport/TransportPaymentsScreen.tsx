import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Transport, TransportRentType, QuantityUnit, TransportStatus } from '../../types';
import { apiClient, TransportClientOption, transportsApi } from '../../api';
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

const draftFromTransport = (transport: Transport): PaymentDraft => ({
  status: transport.status,
  receivedWeight: transport.receivedWeight || 0,
  unloadDate: transport.unloadDate || '',
  rent: transport.rent || 0,
  rentType: transport.rentType || 'per_unit',
  advanceByClient: transport.advanceByClient || 0,
  advanceByFirm: transport.advanceByFirm || 0,
  shortageAmount: transport.extraPaid || 0,
  extraAmount: transport.shortage || 0,
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
    transports,
    commodities,
    clients,
    transporters,
    refreshData,
    showToast,
    transportGet,
    navigate
  } = useApp();

  const [activeStatus, setActiveStatus] = useState('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('ALL');
  const [transporterFilter, setTransporterFilter] = useState('ALL');
  const [billingFirmFilter, setBillingFirmFilter] = useState('ALL');
  const [drafts, setDrafts] = useState<Record<string, PaymentDraft>>({});
  const [pendingSubmit, setPendingSubmit] = useState<Transport | null>(null);
  const [pendingEdit, setPendingEdit] = useState<Transport | null>(null);
  const [printTransport, setPrintTransport] = useState<Transport | null>(null);
  const [billingFirmOptions, setBillingFirmOptions] = useState<TransportClientOption[]>([]);
  const [logoSourceIndex, setLogoSourceIndex] = useState(0);
  const [resolvedLogoSource, setResolvedLogoSource] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

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
  const updateDraft = (transport: Transport, patch: Partial<PaymentDraft>) => {
    setDrafts(previous => ({
      ...previous,
      [transport.id]: { ...draftFromTransport(transport), ...previous[transport.id], ...patch }
    }));
  };

  const filteredTransports = useMemo(() => transports.filter(transport => {
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
    return matchesSearch &&
      (activeStatus === 'ALL' || transport.status === activeStatus) &&
      (commodityFilter === 'ALL' || transport.commodityId === commodityFilter) &&
      (transporterFilter === 'ALL' || transport.transporterId === transporterFilter) &&
      (billingFirmFilter === 'ALL' || transport.billingFirmId === billingFirmFilter);
  }), [transports, commodityMap, transporterMap, clientMap, searchTerm, activeStatus, commodityFilter, transporterFilter, billingFirmFilter]);

  const resetFilters = () => {
    setActiveStatus('PENDING');
    setSearchTerm('');
    setCommodityFilter('ALL');
    setTransporterFilter('ALL');
    setBillingFirmFilter('ALL');
  };

  const statusFilterItems = [
    { value: 'ALL', label: `All (${transports.length})`, active: 'bg-white text-slate-900 shadow-sm', idle: 'text-slate-600 hover:bg-white/60' },
    { value: 'PENDING', label: `Pending (${transports.filter(t => t.status === 'PENDING').length})`, active: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300', idle: 'text-amber-800 hover:bg-amber-50' },
    { value: 'DELIVERY', label: `In Delivery (${transports.filter(t => t.status === 'DELIVERY').length})`, active: 'bg-sky-100 text-sky-900 ring-1 ring-sky-300', idle: 'text-sky-800 hover:bg-sky-50' },
    { value: 'FINANCE', label: `Finance (${transports.filter(t => t.status === 'FINANCE').length})`, active: 'bg-purple-100 text-purple-900 ring-1 ring-purple-300', idle: 'text-purple-800 hover:bg-purple-50' },
    { value: 'PAID', label: `Paid (${transports.filter(t => t.status === 'PAID').length})`, active: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300', idle: 'text-emerald-800 hover:bg-emerald-50' }
  ];

  const savePayment = async () => {
    if (!pendingSubmit) return;
    const transport = pendingSubmit;
    const draft = getDraft(transport);
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
        advanceByFirm: draft.advanceByFirm,
        shortageAmount: draft.shortageAmount,
        extraAmount: draft.extraAmount,
        finalPaid: draft.finalPaid,
        notes: draft.notes
      });
      await refreshData();
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

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1">
        {statusFilterItems.map(item => (
          <button
            key={item.value}
            type="button"
            onClick={() => setActiveStatus(item.value)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${activeStatus === item.value ? item.active : item.idle}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search bill, vehicle, firm, route, transporter..."
            className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <select value={commodityFilter} onChange={event => setCommodityFilter(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <option value="ALL">All Commodities</option>
          {commodities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={transporterFilter} onChange={event => setTransporterFilter(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <option value="ALL">All Transporters</option>
          {transporters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={billingFirmFilter} onChange={event => setBillingFirmFilter(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <option value="ALL">All Billing Firms</option>
          {clients.filter(client => String(client.type).toUpperCase() === 'MY_FIRM').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {(searchTerm || commodityFilter !== 'ALL' || transporterFilter !== 'ALL' || billingFirmFilter !== 'ALL') && (
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <FilterX className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[2160px] table-fixed text-left text-[11px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="w-[62px] px-1 py-2"></th>
              <th className="w-[88px] px-2 py-2">Loading</th>
              <th className="w-[125px] px-2 py-2">Bill</th>
              <th className="w-[130px] px-2 py-2">Vehicle</th>
              <th className="w-[132px] px-2 py-2">Route</th>
              <th className="w-[82px] px-2 py-2 text-right">Gross Wt</th>
              <th className="w-[125px] px-2 py-2 text-right">Rcvd Wt</th>
              <th className="w-[112px] px-2 py-2">Unload Date</th>
              <th className="w-[190px] px-2 py-2">Agreed Rent</th>
              <th className="w-[105px] px-2 py-2 text-right">Total Rent</th>
              <th className="w-[105px] px-2 py-2 text-right">Adv. by Party</th>
              <th className="w-[95px] px-2 py-2 text-right">Adv. Paid</th>
              <th className="w-[88px] px-2 py-2 text-right">Shortage</th>
              <th className="w-[78px] px-2 py-2 text-right">Extra</th>
              <th className="w-[78px] px-2 py-2 text-right">Paid</th>
              <th className="w-[95px] px-2 py-2 text-right">Left</th>
              <th className="w-[145px] px-2 py-2">Notes</th>
              <th className="w-[100px] px-2 py-2">Status</th>
              <th className="w-[85px] px-2 py-2 text-center">Submit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransports.length === 0 ? (
              <tr><td colSpan={19} className="py-10 text-center text-xs text-slate-500">No transport payments match these filters.</td></tr>
            ) : filteredTransports.map(transport => {
              const draft = getDraft(transport);
              const gross = Number(transport.grossWeight) || 0;
              const received = Number(draft.receivedWeight) || 0;
              const differenceQtl = quantityToQuintals(received - gross, transport.grossWeightUnit);
              const billableQuantity = received > 0 ? Math.min(gross, received) : gross;
              const totalRent = Math.trunc(draft.rentType === 'per_unit' ? billableQuantity * draft.rent : draft.rent);
              const left = totalRent - draft.advanceByClient - draft.advanceByFirm - draft.shortageAmount - draft.finalPaid + draft.extraAmount;
              const party = clientMap.get(transport.billingFirmId) || '-';
              const carrier = transporterMap.get(transport.transporterId) || '-';
              const from = clientMap.get(transport.fromClientId) || '-';
              const to = clientMap.get(transport.toClientId) || '-';
              const rowColor = draft.status === 'PENDING'
                ? 'bg-amber-50/50 hover:bg-amber-100/60'
                : draft.status === 'DELIVERY'
                ? 'bg-sky-50/50 hover:bg-sky-100/60'
                : draft.status === 'FINANCE'
                ? 'bg-purple-50/50 hover:bg-purple-100/60'
                : 'bg-emerald-50/50 hover:bg-emerald-100/60';
              const statusSelectColor = draft.status === 'PENDING'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : draft.status === 'DELIVERY'
                ? 'border-sky-300 bg-sky-50 text-sky-900'
                : draft.status === 'FINANCE'
                ? 'border-purple-300 bg-purple-50 text-purple-900'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900';
              return (
                <tr key={transport.id} className={`align-top ${rowColor}`}>
                  <td className="px-1 py-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                    <button type="button" title="Edit transport" aria-label={`Edit transport ${transport.billNumber}`} onClick={() => setPendingEdit(transport)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Print payment bill" aria-label={`Print payment bill ${transport.billNumber}`} onClick={() => { setLogoSourceIndex(0); setPrintTransport(transport); }} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900">
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">{formatDate(transport.loadingDate)}</td>
                  <td className="px-2 py-2">
                    <div className="font-mono font-semibold text-slate-900">{transport.billNumber}</div>
                    <div className="truncate text-[10px] text-slate-500" title={party}>{party}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="truncate font-mono text-slate-800" title={transport.vehicleNumber}>{transport.vehicleNumber}</div>
                    <div className="truncate text-[10px] text-slate-500" title={carrier}>{carrier}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="truncate text-slate-700" title={from}>{from}</div>
                    <div className="truncate text-[10px] text-slate-500" title={to}>→ {to}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-slate-800">
                    {formatQuantityWithUnit(gross, transport.grossWeightUnit)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DecimalInput
                        value={draft.receivedWeight}
                        onChange={receivedWeight => updateDraft(transport, { receivedWeight })}
                        className="w-[72px] rounded border border-slate-300 px-1 py-1 text-right text-[11px] tabular-nums text-slate-900"
                      />
                      <span className="text-[9px] text-slate-500">{unitName(transport.grossWeightUnit)}</span>
                    </div>
                    <div className={`mt-1 whitespace-nowrap text-[10px] ${Math.abs(differenceQtl) < 1 ? 'text-emerald-700' : 'text-red-600'}`}>
                      Diff: {differenceQtl > 0 ? '+' : ''}{differenceQtl.toFixed(2)} Qtl
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input type="date" value={draft.unloadDate} onChange={event => updateDraft(transport, { unloadDate: event.target.value })} className="w-full min-w-[115px] rounded border border-slate-300 px-1.5 py-1 text-[11px] text-slate-900" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <div className="inline-flex shrink-0 rounded border border-slate-200 bg-slate-100 p-0.5">
                        <button type="button" aria-pressed={draft.rentType === 'per_unit'} onClick={() => updateDraft(transport, { rentType: 'per_unit' })} className={`rounded px-1.5 py-1 text-[9px] font-semibold ${draft.rentType === 'per_unit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Per {unitName(transport.grossWeightUnit)}</button>
                        <button type="button" aria-pressed={draft.rentType === 'fix'} onClick={() => updateDraft(transport, { rentType: 'fix' })} className={`rounded px-1.5 py-1 text-[9px] font-semibold ${draft.rentType === 'fix' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Fix</button>
                      </div>
                      <DecimalInput value={draft.rent} onChange={rent => updateDraft(transport, { rent })} className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900" />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-slate-800">{formatCurrency(totalRent)}</td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Advance by party" value={draft.advanceByClient} onChange={advanceByClient => updateDraft(transport, { advanceByClient })} className="w-full min-w-[82px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Advance paid" value={draft.advanceByFirm} onChange={advanceByFirm => updateDraft(transport, { advanceByFirm })} className="w-full min-w-[78px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Shortage" value={draft.shortageAmount} onChange={shortageAmount => updateDraft(transport, { shortageAmount })} className="w-full min-w-[74px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Extra" value={draft.extraAmount} onChange={extraAmount => updateDraft(transport, { extraAmount })} className="w-full min-w-[70px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900" /></td>
                  <td className="px-2 py-2"><DecimalInput aria-label="Paid" value={draft.finalPaid} onChange={finalPaid => updateDraft(transport, { finalPaid })} className="w-full min-w-[70px] rounded border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-900" /></td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums ${left < 100 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(left)}</td>
                  <td className="px-2 py-2"><input aria-label="Payment notes" value={draft.notes} onChange={event => updateDraft(transport, { notes: event.target.value })} className="w-full min-w-[150px] rounded border border-slate-300 px-1.5 py-1 text-[11px] text-slate-900" /></td>
                  <td className="px-2 py-2">
                    <select value={draft.status} onChange={event => updateDraft(transport, { status: event.target.value as TransportStatus })} className={`w-full rounded border px-1.5 py-1 text-[10px] font-semibold ${statusSelectColor}`}>
                      <option value="PENDING">Pending</option>
                      <option value="DELIVERY">Delivery</option>
                      <option value="FINANCE">Finance</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" disabled={savingId === transport.id} onClick={() => setPendingSubmit(transport)} className="w-full rounded bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                      {savingId === transport.id ? 'Saving...' : 'Submit'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
        const commodity = commodityMap.get(printTransport.commodityId)?.name || '-';
        const transporter = transporterMap.get(printTransport.transporterId) || '-';
        const from = clientMap.get(printTransport.fromClientId) || '-';
        const to = clientMap.get(printTransport.toClientId) || '-';
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

              <header className="flex items-center gap-4 border-b-2 border-slate-900 pb-5">
                <div aria-label="Firm logo" className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-slate-300 bg-slate-50 text-lg font-bold text-slate-500 print:border-0 print:bg-white">
                  {firmLogo ? <img key={firmLogo} src={firmLogo} alt={`${firm} logo`} onError={() => setLogoSourceIndex(index => Math.min(index + 1, logoSources.length))} className="h-full w-full object-contain" /> : initials || 'LOGO'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Transport settlement</p>
                  <h1 className="mt-1 break-words text-xl font-bold text-slate-950">{firm}</h1>
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

              <section className="grid grid-cols-2 gap-x-8 gap-y-4 border-b border-slate-200 py-5 sm:grid-cols-4">
                <div><p className="text-[10px] font-semibold uppercase text-slate-500">Transporter</p><p className="mt-1 text-sm font-semibold text-slate-900">{transporter}</p></div>
                <div><p className="text-[10px] font-semibold uppercase text-slate-500">Vehicle number</p><p className="mt-1 font-mono text-sm font-semibold text-slate-900">{printTransport.vehicleNumber}</p></div>
                <div><p className="text-[10px] font-semibold uppercase text-slate-500">Commodity</p><p className="mt-1 text-sm font-semibold text-slate-900">{commodity}</p></div>
                <div><p className="text-[10px] font-semibold uppercase text-slate-500">Route</p><p className="mt-1 text-sm font-semibold text-slate-900">{from} to {to}</p></div>
              </section>

              <section className="py-5">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Weight and freight</h2>
                <div className="overflow-hidden border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                      <tr><th className="px-3 py-2">Gross weight</th><th className="px-3 py-2">Received weight</th><th className="px-3 py-2 text-right">Difference</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Freight amount</th></tr>
                    </thead>
                    <tbody><tr className="font-semibold text-slate-900">
                      <td className="px-3 py-3">{formatQuantityWithUnit(gross, printTransport.grossWeightUnit)}</td>
                      <td className="px-3 py-3">{formatQuantityWithUnit(received, printTransport.grossWeightUnit)}</td>
                      <td className="px-3 py-3 text-right">{difference > 0 ? '+' : ''}{difference.toFixed(2)} Qtl</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(printDraft.rent)}{printDraft.rentType === 'per_unit' ? ` / ${unitName(printTransport.grossWeightUnit)}` : ' (fixed)'}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(totalRent)}</td>
                    </tr></tbody>
                  </table>
                </div>
              </section>

              <section className="ml-auto max-w-sm border-t border-slate-200 pt-4">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Settlement</h2>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Freight amount</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(totalRent)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Hamali (advance by party)</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.advanceByClient)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Advance paid by firm</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.advanceByFirm)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Shortage</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.shortageAmount)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Extra charges</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.extraAmount)}</dd></div>
                  <div className="flex justify-between gap-4 border-b border-slate-200 pb-2"><dt className="text-slate-600">Paid</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(printDraft.finalPaid)}</dd></div>
                  <div className="flex justify-between gap-4 pt-1 text-sm font-bold"><dt className="text-slate-900">Balance due</dt><dd className="font-mono text-slate-900">{formatCurrency(balance)}</dd></div>
                </dl>
              </section>

              {printDraft.notes && <p className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-600">Notes: {printDraft.notes}</p>}
              <footer className="mt-14 grid grid-cols-2 gap-12 text-center text-[10px] text-slate-500">
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