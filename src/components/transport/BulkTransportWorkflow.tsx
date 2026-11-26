import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, QuantityUnit, Transport, TransportStatus } from '../../types';
import { BulkTransportDetail, TransportClientOption, transportsApi } from '../../api';
import { ArrowLeft, CheckCircle, ChevronDown, Layers, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { formatQuantityWithUnit, formatCurrency, getClientTypeLabel } from '../../utils/formatters';
import { calculateBulkOrderProgress } from '../../utils/bulkOrderProgress';
import { DateInput } from '../common/DateInput';
import { DecimalInput } from '../common/DecimalInput';
import { handleFormEnterKeyDown } from '../common/formKeyboard';
import { SearchableSelect, scrollActiveOptionIntoView } from '../common/SearchableSelect';

interface TruckRow {
  id: string;
  transportId?: string;
  originalTransport?: Transport;
  vehicleNumber: string;
  grossWeight: number;
  receivedWeight: number;
  bagNumbers: number;
  bagWeight: number;
  anugya: boolean;
  gatepass: boolean;
}

const DIRECT_TRANSPORT = 'none';

const today = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getShortUnitLabel = (unit: QuantityUnit): string =>
  unit === 'quintal' ? 'Qtl' : unit === 'kg' ? 'Kg' : 'MT';

const getRateUnitLabel = (unit?: QuantityUnit): string =>
  unit === 'quintal' ? 'Qtl' : unit === 'kg' ? 'Kg' : 'Mt';

const convertQuantityUnit = (quantity: number, fromUnit: QuantityUnit, toUnit: QuantityUnit): number => {
  const metricTons = fromUnit === 'mt' ? quantity : fromUnit === 'quintal' ? quantity / 10 : quantity / 1000;
  if (toUnit === 'mt') return metricTons;
  if (toUnit === 'quintal') return metricTons * 10;
  return metricTons * 1000;
};

const newTruck = (): TruckRow => ({
  id: `truck-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  vehicleNumber: '', grossWeight: 0, receivedWeight: 0, bagNumbers: 0, bagWeight: 500, anugya: false, gatepass: false
});

export const BulkTransportWorkflow: React.FC = () => {
  const { orders, commodities, clients, transporters, pageParams, navigate, refreshData, showToast } = useApp();
  const returnPage = pageParams.returnTo === 'bulk-transport-list' ? 'bulk-transport-list' : 'transport';
  const editingBulkId = pageParams.bulkTransportId ? String(pageParams.bulkTransportId) : '';
  const [loadingDate, setLoadingDate] = useState(today());
  const [unloadingDate, setUnloadingDate] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [totalReceivedWeight, setTotalReceivedWeight] = useState(0);
  const [totalOrderEntry, setTotalOrderEntry] = useState(0);
  const [originalBulkEntry, setOriginalBulkEntry] = useState<{ orderId: string; quantity: number; unit: QuantityUnit } | null>(null);
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [billingFirmId, setBillingFirmId] = useState('');
  const [transporterId, setTransporterId] = useState(DIRECT_TRANSPORT);
  const [destinationId, setDestinationId] = useState('');
  const [status, setStatus] = useState<TransportStatus>('PENDING');
  const [orderOptions, setOrderOptions] = useState<Order[]>(orders);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [billingFirms, setBillingFirms] = useState<TransportClientOption[]>([]);
  const [locations, setLocations] = useState<TransportClientOption[]>([]);
  const [agencyOptions, setAgencyOptions] = useState(transporters);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [activeSourceId, setActiveSourceId] = useState('');
  const [trucks, setTrucks] = useState<Record<string, TruckRow[]>>({});
  const [locationSearch, setLocationSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState(0);
  const locationPickerRef = useRef<HTMLDivElement>(null);
  const locationOptionsRef = useRef<HTMLDivElement>(null);
  const sourceTabsRef = useRef<HTMLDivElement>(null);
  const [lookupsReady, setLookupsReady] = useState(false);
  const [loadingBulk, setLoadingBulk] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!locationPickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [pickerOpen]);

  useEffect(() => {
    let cancelled = false;
    const fallbackFirms = clients.filter(client => String(client.type).toLowerCase() === 'my_firm').map(client => ({
      id: client.id, name: client.name, city: client.city, clientType: String(client.type)
    }));
    const fallbackLocations = clients.map(client => ({
      id: client.id, name: client.name, city: client.city, clientType: String(client.type)
    }));
    Promise.allSettled([
      transportsApi.selectBillingFirms(), transportsApi.selectLocations(), transportsApi.selectAgencyOptions(),
      transportsApi.selectBulkOrders({ clients, commodities })
    ]).then(([firms, locationResult, agencies, bulkOrders]) => {
      if (cancelled) return;
      const nextFirms = firms.status === 'fulfilled' ? firms.value : fallbackFirms;
      const nextLocations = locationResult.status === 'fulfilled' ? locationResult.value : fallbackLocations;
      const nextAgencies = agencies.status === 'fulfilled' ? agencies.value : transporters;
      const nextOrders = bulkOrders.status === 'fulfilled' ? bulkOrders.value : orders;
      setBillingFirms(nextFirms);
      setLocations(nextLocations);
      setAgencyOptions(nextAgencies);
      setOrderOptions(nextOrders);
      setLookupsReady(true);
    });
    return () => { cancelled = true; };
  }, [clients, commodities, orders, transporters]);

  useEffect(() => {
    if (!editingBulkId || !lookupsReady) return;
    let cancelled = false;
    setLoadingBulk(true);
    transportsApi.getBulk(editingBulkId, { clients, commodities, orders: orderOptions, transporters: agencyOptions })
      .then((bulk: BulkTransportDetail) => {
        if (cancelled) return;
        const sources = [...new Set([
          ...bulk.selectedSources,
          ...bulk.transports.map(transport => transport.fromClientId).filter(Boolean)
        ])];
        const bulkOrderId = bulk.orderId || bulk.transports[0]?.items[0]?.orderId || '';
        const bulkOrder = bulk.order
          || orderOptions.find(order => order.id === bulkOrderId)
          || orders.find(order => order.id === bulkOrderId);
        if (bulkOrder) {
          setDetailOrder(bulkOrder);
          setOrderOptions(current => [
            bulkOrder,
            ...current.filter(order => order.id !== bulkOrder.id)
          ]);
        } else {
          setDetailOrder(null);
        }
        const bulkOrderUnit = bulkOrder?.unit || 'mt';
        const nextTrucks: Record<string, TruckRow[]> = {};
        sources.forEach(sourceId => { nextTrucks[sourceId] = []; });
        bulk.transports.forEach(transport => {
          const sourceId = transport.fromClientId || sources[0] || '';
          if (!sourceId) return;
          if (!nextTrucks[sourceId]) nextTrucks[sourceId] = [];
          const isEnabled = (value: boolean | string | undefined) => value === true || (typeof value === 'string' && !['', 'false', '0', 'no'].includes(value.trim().toLowerCase()));
          nextTrucks[sourceId].push({
            id: `transport-${transport.id}`,
            transportId: transport.id,
            originalTransport: transport,
            vehicleNumber: transport.vehicleNumber,
            grossWeight: convertQuantityUnit(transport.grossWeight, transport.grossWeightUnit || 'mt', bulkOrderUnit),
            receivedWeight: convertQuantityUnit(transport.receivedWeight || 0, transport.grossWeightUnit || 'mt', bulkOrderUnit),
            bagNumbers: transport.bagNumbers || 0,
            bagWeight: transport.bagWeight ?? 500,
            anugya: isEnabled(transport.anugya),
            gatepass: isEnabled(transport.gatepass)
          });
        });
        const firstTransport = bulk.transports[0];
        setLoadingDate(bulk.loadingDate || firstTransport?.loadingDate || today());
        setUnloadingDate(bulk.unloadingDate || firstTransport?.unloadDate || '');
        setBillNumber(bulk.billNumber || firstTransport?.billNumber || '');
        setTotalReceivedWeight(bulk.totalReceivedWeight || 0);
        setTotalOrderEntry(bulk.orderEntry || 0);
        setOriginalBulkEntry({ orderId: bulkOrderId, quantity: bulk.orderEntry || 0, unit: bulkOrderUnit });
        setTitle(bulk.title);
        setTitleEdited(true);
        setOrderId(bulkOrderId);
        setBillingFirmId(bulk.billingFirmId || firstTransport?.billingFirmId || '');
        setTransporterId(bulk.transporterId || firstTransport?.transporterId || DIRECT_TRANSPORT);
        setDestinationId(bulk.toClientId || firstTransport?.toClientId || '');
        setStatus(bulk.status || firstTransport?.status || 'PENDING');
        setSourceIds(sources);
        setActiveSourceId(sources[0] || '');
        setTrucks(nextTrucks);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : 'Unable to load bulk transport', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBulk(false);
      });
    return () => { cancelled = true; };
  }, [editingBulkId, lookupsReady]);

  const selectedOrder = useMemo(
    () => orderOptions.find(order => order.id === orderId)
      || (detailOrder?.id === orderId ? detailOrder : undefined)
      || orders.find(order => order.id === orderId),
    [orderOptions, detailOrder, orders, orderId]
  );
  const commodity = commodities.find(item => item.id === selectedOrder?.commodityId);
  const selectedUnit = selectedOrder?.unit || 'mt';
  const contractQuantity = selectedOrder?.quantity || 0;
  const originalOrderEntry = originalBulkEntry?.orderId === orderId
    ? convertQuantityUnit(originalBulkEntry.quantity, originalBulkEntry.unit, selectedUnit)
    : 0;
  const orderProgress = calculateBulkOrderProgress(
    contractQuantity,
    selectedOrder?.quantityFulfilled || 0,
    selectedOrder ? totalOrderEntry : 0,
    originalOrderEntry
  );
  useEffect(() => {
    if (!titleEdited) setTitle(`${billNumber} : Bulk Dispatch - ${selectedOrder?.orderNumber || ''}`.trim());
  }, [billNumber, selectedOrder?.orderNumber, titleEdited]);

  const selectedLocations = sourceIds.map(id => locations.find(location => location.id === id)).filter((item): item is TransportClientOption => Boolean(item));
  const allTrucks = sourceIds.flatMap(sourceId => (trucks[sourceId] || []).map(row => ({ ...row, sourceId })));
  const grossTotal = allTrucks.reduce((total, row) => total + row.grossWeight, 0);
  const totalBags = allTrucks.reduce((total, row) => total + (row.bagNumbers || 0), 0);
  const receivedWeightDiff = grossTotal - totalReceivedWeight;
  const formatSelectedQuantity = (value: number) =>
    formatQuantityWithUnit(value, selectedUnit).replace(/ KG$/, ' Kg');
  const calculateBharti = (row: TruckRow): number | null => {
    if (!row.bagNumbers) return null;
    const grossInKg = convertQuantityUnit(row.grossWeight, selectedUnit, 'kg');
    const bagWeightInKg = row.bagWeight / 1000;
    return (grossInKg - row.bagNumbers * bagWeightInKg) / row.bagNumbers;
  };
  const filteredLocations = locations.filter(location => `${location.name} ${location.clientType || ''} ${location.city || ''}`.toLowerCase().includes(locationSearch.toLowerCase().trim()));
  const activeLocation = filteredLocations.length ? Math.min(activeLocationIndex, filteredLocations.length - 1) : -1;
  useLayoutEffect(() => {
    if (pickerOpen && activeLocation >= 0) scrollActiveOptionIntoView(locationOptionsRef.current, activeLocation);
  }, [pickerOpen, activeLocation, locationSearch, filteredLocations.length]);
  const locationSummary = selectedLocations.map(location => {
    const rows = trucks[location.id] || [];
    return {
      location,
      rows,
      gross: rows.reduce((sum, row) => sum + row.grossWeight, 0),
      bags: rows.reduce((sum, row) => sum + (row.bagNumbers || 0), 0)
    };
  });

  const updateTruck = (sourceId: string, rowId: string, field: keyof TruckRow, value: string | number | boolean) => {
    setTrucks(current => ({ ...current, [sourceId]: (current[sourceId] || []).map(row => row.id === rowId ? { ...row, [field]: value } : row) }));
  };

  const changeOrder = (nextOrderId: string) => {
    const nextOrder = orderOptions.find(order => order.id === nextOrderId) || orders.find(order => order.id === nextOrderId);
    const nextUnit = nextOrder?.unit || 'mt';
    setDetailOrder(nextOrder || null);
    if (nextUnit !== selectedUnit) {
      setTotalReceivedWeight(current => convertQuantityUnit(current, selectedUnit, nextUnit));
      setTotalOrderEntry(current => convertQuantityUnit(current, selectedUnit, nextUnit));
      setTrucks(current => Object.fromEntries(
        Object.entries(current).map(([sourceId, rows]) => [
          sourceId,
          rows.map(row => ({
            ...row,
            grossWeight: convertQuantityUnit(row.grossWeight, selectedUnit, nextUnit),
            receivedWeight: convertQuantityUnit(row.receivedWeight, selectedUnit, nextUnit)
          }))
        ])
      ));
    }
    setOrderId(nextOrderId);
  };

  const toggleSource = (sourceId: string) => {
    if (sourceIds.includes(sourceId)) {
      const count = trucks[sourceId]?.length || 0;
      if (count && !window.confirm(`Discard ${count} truck${count === 1 ? '' : 's'} from this source location?`)) return;
      const remaining = sourceIds.filter(id => id !== sourceId);
      setSourceIds(remaining);
      setTrucks(current => { const next = { ...current }; delete next[sourceId]; return next; });
      if (activeSourceId === sourceId) setActiveSourceId(remaining[0] || '');
    } else {
      setSourceIds(current => [...current, sourceId]);
      setTrucks(current => ({ ...current, [sourceId]: [] }));
      setActiveSourceId(sourceId);
    }
  };

  const handleSave = async () => {
    if (!selectedOrder) return showToast('Please select an order', 'error');
    if (!billingFirmId || !destinationId) return showToast('Select a billing firm and destination location', 'error');
    if (!title.trim()) return showToast('Please enter a bulk transport title', 'error');
    if (!allTrucks.length) return showToast('Add at least one truck before saving', 'error');
    if (allTrucks.some(row => !row.vehicleNumber.trim())) return showToast('Enter a vehicle number for every truck', 'error');

    const transports = allTrucks.map(row => ({
      ...row.originalTransport,
      id: row.transportId || row.originalTransport?.id,
      billNumber: billNumber.trim(), billingFirmId, commodityId: selectedOrder.commodityId, fromClientId: row.sourceId,
      toClientId: destinationId, vehicleNumber: row.vehicleNumber.trim().toUpperCase(),
      transporterId: transporterId === DIRECT_TRANSPORT ? DIRECT_TRANSPORT : transporterId,
      grossWeight: row.grossWeight, grossWeightUnit: selectedUnit, receivedWeight: row.receivedWeight, bagNumbers: row.bagNumbers,
      bagWeight: row.bagWeight, anugya: row.anugya, gatepass: row.gatepass, loadingDate, status,
      items: [{
        ...row.originalTransport?.items.find(item => item.orderId === selectedOrder.id) || row.originalTransport?.items[0],
        orderId: selectedOrder.id,
        allocatedQuantity: row.grossWeight
      }]
    }));
    try {
      const payload = {
        title: title.trim(), loadingDate, unloadingDate, billNumber: billNumber.trim(), totalReceivedWeight, orderEntry: totalOrderEntry, orderId: selectedOrder.id, billingFirmId,
        transporterId, toClientId: destinationId, commodityId: selectedOrder.commodityId, status, transports
      };
      if (editingBulkId) {
        await transportsApi.updateBulk({ ...payload, id: editingBulkId }, { clients, commodities, orders: orderOptions, transporters: agencyOptions });
      } else {
        await transportsApi.addBulk(payload, { clients, commodities, orders: orderOptions, transporters: agencyOptions });
      }
      await refreshData();
      showToast(`${editingBulkId ? 'Updated' : 'Created'} ${transports.length} transport${transports.length === 1 ? '' : 's'}`, 'success');
      navigate(returnPage);
    } catch (error: any) {
      showToast(error.message || 'Bulk transport save failed.', 'error');
    }
  };

  const numericField = (label: string, value: number, onChange: (next: number) => void, width = 'w-full') => (
    <DecimalInput aria-label={label} value={value} onChange={onChange} className={`${width} text-xs border border-slate-300 rounded px-2 py-1.5 text-right text-slate-900 tabular-nums`} />
  );

  return <div className="max-w-6xl mx-auto space-y-4 pb-8">
    <header className="flex items-center gap-3">
      <button type="button" onClick={() => navigate(returnPage)} aria-label="Back to transports" className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
      <div><h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-600" />{editingBulkId ? 'Edit Bulk Transport' : 'Bulk Transport Add'}</h1><p className="text-xs text-slate-500 mt-0.5">{editingBulkId ? 'Update this dispatch batch and its vehicles.' : 'Create dispatches across multiple loading locations.'}</p></div>
    </header>

    {loadingBulk && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">Loading bulk transport details...</div>}

    <form className="space-y-4" onKeyDown={handleFormEnterKeyDown} onSubmit={event => { event.preventDefault(); void handleSave(); }}>
    <section className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
      <h2 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2">Step 1 · Common transport details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="block text-xs font-medium text-slate-700">Title<input value={title} onChange={event => { setTitle(event.target.value); setTitleEdited(true); }} className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-3 py-2" /></label>
        <label className="block text-xs font-medium text-slate-700">Bill number<input autoFocus={!editingBulkId} value={billNumber} onChange={event => setBillNumber(event.target.value)} className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-3 py-2" /></label>
        <div><label htmlFor="bulk-loading-date" className="mb-1 block text-xs font-medium text-slate-700">Loading date</label><DateInput id="bulk-loading-date" value={loadingDate} onChange={setLoadingDate} required /></div>
        <div><label htmlFor="bulk-billing-firm" className="mb-1 block text-xs font-medium text-slate-700">Billing firm</label><SearchableSelect id="bulk-billing-firm" value={billingFirmId} onChange={setBillingFirmId} placeholder="Select or search billing firm" highlightFirstMatch selectOnTab options={billingFirms.map(firm => ({ id: firm.id, label: `${firm.name}${firm.city ? ` (${firm.city})` : ''}`, searchText: firm.city }))} /></div>
        <div><label htmlFor="bulk-order" className="mb-1 block text-xs font-medium text-slate-700">Order</label><SearchableSelect id="bulk-order" value={orderId} onChange={changeOrder} placeholder="Select or search order" options={orderOptions.map(order => {
          const commodityName = order.commodityName || commodities.find(item => item.id === order.commodityId)?.name || 'Commodity';
          return {
            id: order.id,
            label: `${order.orderNumber}${order.selectorClientName ? ` (${order.selectorClientName})` : ''} · ${formatQuantityWithUnit(order.quantity, order.remQuantityUnit || order.unit)} · ${formatCurrency(order.rate)} / ${getRateUnitLabel(order.remQuantityUnit || order.unit)} · ${order.brokerName || 'Direct'}`,
            highlightText: order.orderNumber,
            searchText: `${order.orderNumber} ${order.type} ${commodityName} ${order.selectorClientName || ''} ${order.brokerName || 'Direct'}`
          };
        })} highlightFirstMatch selectOnTab wrapOptions portalOptions /></div>
        <div><label htmlFor="bulk-destination" className="mb-1 block text-xs font-medium text-slate-700">Destination location</label><SearchableSelect id="bulk-destination" value={destinationId} onChange={setDestinationId} placeholder="Select or search destination" highlightFirstMatch selectOnTab options={locations.map(item => ({ id: item.id, label: `${item.name}${item.city ? ` (${item.city})` : ''}`, searchText: `${item.city || ''} ${item.clientType || ''}` }))} /></div>
        <div><label htmlFor="bulk-transporter" className="mb-1 block text-xs font-medium text-slate-700">Transporter</label><SearchableSelect id="bulk-transporter" value={transporterId} onChange={setTransporterId} placeholder="Select or search transporter" highlightFirstMatch selectOnTab options={[{ id: DIRECT_TRANSPORT, label: 'Direct Transport' }, ...agencyOptions.map(item => ({
          id: item.id,
          label: `${item.name}${item.agency && item.agency !== item.name ? ` (${item.agency})` : ''}`,
          searchText: `${item.agency || ''} ${item.city || ''} ${item.phone || item.phone_number || ''}`
        }))]} /></div>
        <label className="block text-xs font-medium text-slate-700">Status<select value={status} onChange={event => setStatus(event.target.value as TransportStatus)} className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"><option value="PENDING">Loading / Pending</option><option value="DELIVERY">In Transit / Delivery</option><option value="FINANCE">Unloaded / Finance</option><option value="PAID">Settled / Paid</option></select></label>
        <div><label htmlFor="bulk-unloading-date" className="mb-1 block text-xs font-medium text-slate-700">Unload date</label><DateInput id="bulk-unloading-date" value={unloadingDate} onChange={setUnloadingDate} /></div>
        <label className="block text-xs font-medium text-slate-700">Total received weight ({getShortUnitLabel(selectedUnit)})<DecimalInput aria-label={`Total received weight in ${getShortUnitLabel(selectedUnit)}`} value={totalReceivedWeight} onChange={value => { setTotalReceivedWeight(value); setTotalOrderEntry(value); }} className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none" /></label>
        <label className="block text-xs font-medium text-slate-700">Total Order Entry ({getShortUnitLabel(selectedUnit)})<DecimalInput aria-label={`Total order entry in ${getShortUnitLabel(selectedUnit)}`} value={totalOrderEntry} onChange={setTotalOrderEntry} className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none" /></label>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Commodity', commodity?.name || selectedOrder?.commodityName || 'Select an order', 'text-slate-900'],
          ['Contract size', formatQuantityWithUnit(contractQuantity, selectedUnit), 'text-slate-900'],
          ['Already fulfilled', formatQuantityWithUnit(orderProgress.fulfilled, selectedUnit), 'text-emerald-700'],
          ['Remaining', formatQuantityWithUnit(orderProgress.remaining, selectedUnit), orderProgress.remaining <= 0 ? 'text-emerald-700' : 'text-orange-600']
        ].map(([label, value, color]) => <div key={label} className="p-3 rounded-lg bg-slate-50 border border-slate-100"><span className="text-[10px] text-slate-500 uppercase font-semibold">{label}</span><p className={`mt-1 text-sm font-bold tabular-nums ${color}`}>{value}</p>{label === 'Commodity' && <p className="mt-1 text-xs text-slate-500">{commodity?.type || selectedOrder?.commodityType || '—'}</p>}</div>)}
      </div>
    </section>

    <section className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
      <h2 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2">Step 2 · Source locations</h2>
      <div ref={locationPickerRef} className="relative max-w-xl" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPickerOpen(false); }}>
        <div className="flex items-center border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-600">
          <Search className="ml-3 w-4 h-4 text-slate-400" />
          <input
            aria-label="Search source locations"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={pickerOpen}
            aria-controls="bulk-source-options"
            aria-activedescendant={pickerOpen && activeLocation >= 0 ? `bulk-source-option-${activeLocation}` : undefined}
            aria-description="Use Up and Down to navigate, Tab to toggle an option, Enter to exit, and Shift+Tab to go back."
            value={locationSearch}
            onFocus={() => { setActiveLocationIndex(0); setPickerOpen(true); }}
            onClick={() => setPickerOpen(true)}
            onChange={event => { setLocationSearch(event.target.value); setActiveLocationIndex(0); setPickerOpen(true); }}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
              if (event.key === 'Escape') {
                setPickerOpen(false);
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!pickerOpen) {
                  setActiveLocationIndex(0);
                  setPickerOpen(true);
                } else if (filteredLocations.length) {
                  setActiveLocationIndex(index => event.key === 'ArrowDown'
                    ? Math.min(index + 1, filteredLocations.length - 1)
                    : Math.max(index - 1, 0));
                }
              } else if (pickerOpen && event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                setPickerOpen(false);
                sourceTabsRef.current?.querySelector<HTMLButtonElement>('[role="tab"]')?.focus();
              } else if (pickerOpen && event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault();
                if (!event.repeat && activeLocation >= 0) {
                  toggleSource(filteredLocations[activeLocation].id);
                  setActiveLocationIndex(Math.min(activeLocation + 1, filteredLocations.length - 1));
                }
              }
            }}
            placeholder="Search by location or client type"
            className="w-full px-2 py-2 text-xs outline-none"
          />
          <button type="button" tabIndex={-1} aria-label="Toggle source locations" onClick={() => { setActiveLocationIndex(0); setPickerOpen(open => !open); }} className="p-2 text-slate-500 cursor-pointer"><ChevronDown className="w-4 h-4" /></button>
        </div>
        {pickerOpen && <div ref={locationOptionsRef} id="bulk-source-options" role="listbox" aria-label="Source locations" aria-multiselectable="true" tabIndex={-1} className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">{filteredLocations.length ? filteredLocations.map((location, index) => <label key={location.id} id={`bulk-source-option-${index}`} role="option" aria-selected={sourceIds.includes(location.id)} onMouseEnter={() => setActiveLocationIndex(index)} className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer ${index === activeLocation ? 'bg-blue-50' : ''}`}><input type="checkbox" tabIndex={-1} checked={sourceIds.includes(location.id)} onChange={() => toggleSource(location.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="min-w-0 flex-1 text-slate-800">{location.name} <span className="text-slate-500">({getClientTypeLabel(location.clientType || 'Location')})</span></span>{location.city && <span className="text-slate-400">{location.city}</span>}</label>) : <p className="px-3 py-3 text-xs text-slate-500">No matching locations</p>}</div>}
      </div>
      {selectedLocations.length > 0 && <div ref={sourceTabsRef} className="flex flex-wrap items-center gap-2 border-b border-slate-100" role="tablist" aria-label="Source location truck lists">{selectedLocations.map(location => <div key={location.id} className={`inline-flex items-center border-b-2 ${activeSourceId === location.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'}`}><button type="button" role="tab" aria-selected={activeSourceId === location.id} onClick={() => setActiveSourceId(location.id)} className="px-3 py-2 text-xs font-semibold cursor-pointer">{location.name} <span className="text-slate-400">({trucks[location.id]?.length || 0})</span></button><button type="button" aria-label={`Discard ${location.name}`} title="Discard source location" onClick={() => toggleSource(location.id)} className="p-1 mr-1 text-slate-400 hover:text-red-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button></div>)}</div>}
    </section>

    <section className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><div><h2 className="text-xs font-bold text-slate-900 uppercase">Step 3 · Truck data</h2><p className="text-[11px] text-slate-500 mt-1">{selectedLocations.find(item => item.id === activeSourceId)?.name || 'Select a source location to add trucks'}</p></div><button type="button" disabled={!activeSourceId} onClick={() => setTrucks(current => ({ ...current, [activeSourceId]: [...(current[activeSourceId] || []), newTruck()] }))} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer"><Plus className="w-3.5 h-3.5" />Add truck</button></div>
      {!activeSourceId ? <p className="text-xs text-slate-500 py-4">Choose one or more source locations above.</p> : !(trucks[activeSourceId] || []).length ? <p className="text-xs text-slate-500 py-4">No trucks in this location yet.</p> : <div className="overflow-x-auto border border-slate-200 rounded-lg"><table className="w-full min-w-[1080px] table-fixed text-left text-xs"><colgroup><col className="w-[220px]" /><col className="w-[140px]" /><col className="w-[80px]" /><col className="w-[120px]" /><col className="w-[80px]" /><col className="w-[140px]" /><col className="w-[100px]" /><col className="w-[100px]" /><col className="w-[80px]" /></colgroup><thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold"><tr><th className="px-3 py-2.5">Vehicle Number</th><th className="px-3 py-2.5 text-right">Gross Wt ({getShortUnitLabel(selectedUnit)})</th><th className="px-3 py-2.5 text-right">Bags</th><th className="px-3 py-2.5 text-right">Bag Wt (g)</th><th className="px-3 py-2.5 text-right">Bharti (Kg)</th><th className="px-3 py-2.5 text-right">Rcvd Wt ({getShortUnitLabel(selectedUnit)})</th><th className="px-3 py-2.5 text-center">Anugya</th><th className="px-3 py-2.5 text-center">Gate Pass</th><th className="px-3 py-2.5 text-center">Delete</th></tr></thead><tbody className="divide-y divide-slate-100">{(trucks[activeSourceId] || []).map(row => { const bharti = calculateBharti(row); return <tr key={row.id} className="hover:bg-slate-50/50"><td className="px-3 py-2"><input value={row.vehicleNumber} onChange={event => updateTruck(activeSourceId, row.id, 'vehicleNumber', event.target.value.toUpperCase())} placeholder="Vehicle registration" className="w-full text-xs font-mono border border-slate-300 rounded px-2 py-1.5 uppercase" /></td><td className="px-3 py-2 text-right">{numericField(`Gross weight in ${getShortUnitLabel(selectedUnit)}`, row.grossWeight, value => updateTruck(activeSourceId, row.id, 'grossWeight', value))}</td><td className="px-3 py-2 text-right">{numericField('Bag count', row.bagNumbers, value => updateTruck(activeSourceId, row.id, 'bagNumbers', value))}</td><td className="px-3 py-2 text-right">{numericField('Bag weight in grams', row.bagWeight, value => updateTruck(activeSourceId, row.id, 'bagWeight', value))}</td><td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${bharti !== null && bharti < 0 ? 'text-red-600 font-semibold' : 'text-slate-900'}`}>{bharti === null ? '—' : bharti.toFixed(2)}</td><td className="px-3 py-2 text-right">{numericField(`Received weight in ${getShortUnitLabel(selectedUnit)}`, row.receivedWeight, value => updateTruck(activeSourceId, row.id, 'receivedWeight', value))}</td><td className="px-3 py-2 text-center"><input type="checkbox" checked={row.anugya} onChange={event => updateTruck(activeSourceId, row.id, 'anugya', event.target.checked)} aria-label="Anugya" className="h-4 w-4 rounded border-slate-300 text-blue-600" /></td><td className="px-3 py-2 text-center"><input type="checkbox" checked={row.gatepass} onChange={event => updateTruck(activeSourceId, row.id, 'gatepass', event.target.checked)} aria-label="Gate pass" className="h-4 w-4 rounded border-slate-300 text-blue-600" /></td><td className="px-3 py-2 text-center"><button type="button" onClick={() => setTrucks(current => ({ ...current, [activeSourceId]: current[activeSourceId].filter(item => item.id !== row.id) }))} aria-label="Delete truck" className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="w-4 h-4" /></button></td></tr>; })}</tbody></table></div>}
    </section>

    <section className="bg-slate-900 text-white p-5 rounded-lg space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-200"><Truck className="w-4 h-4 text-blue-300" />Dispatch summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4"><div><span className="block text-[10px] uppercase text-slate-400">Total trucks</span><strong className="text-lg tabular-nums">{allTrucks.length}</strong></div><div><span className="block text-[10px] uppercase text-slate-400">Total gross allocation</span><strong className={`text-lg tabular-nums ${Math.abs(grossTotal - orderProgress.available) < 0.01 ? 'text-emerald-400' : 'text-amber-300'}`}>{formatSelectedQuantity(grossTotal)}</strong></div><div><span className="block text-[10px] uppercase text-slate-400">Total bags</span><strong className="text-lg tabular-nums">{totalBags}</strong></div><div><span className="block text-[10px] uppercase text-slate-400">Total received weight</span><strong className="text-lg tabular-nums">{formatSelectedQuantity(totalReceivedWeight)}</strong></div><div><span className="block text-[10px] uppercase text-slate-400">Diff (Gross - Received)</span><strong className="text-lg tabular-nums text-red-400">{formatSelectedQuantity(receivedWeightDiff)}</strong></div></div>
      {totalOrderEntry > orderProgress.available + 0.01 && <p className="rounded-md bg-amber-400/10 border border-amber-400/30 px-3 py-2 text-xs text-amber-200">Order entry is above the remaining order quantity. You can still save this dispatch.</p>}
      {locationSummary.length > 0 && <div className="overflow-x-auto border border-slate-700 rounded-lg"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-slate-800 text-slate-300"><tr><th className="px-3 py-2">Source location</th><th className="px-3 py-2 text-right">Trucks</th><th className="px-3 py-2 text-right">Gross ({getShortUnitLabel(selectedUnit)})</th><th className="px-3 py-2 text-right">Bags</th></tr></thead><tbody className="divide-y divide-slate-700">{locationSummary.map(item => <tr key={item.location.id}><td className="px-3 py-2">{item.location.name}</td><td className="px-3 py-2 text-right tabular-nums">{item.rows.length}</td><td className="px-3 py-2 text-right tabular-nums">{formatSelectedQuantity(item.gross)}</td><td className="px-3 py-2 text-right tabular-nums">{item.bags}</td></tr>)}</tbody></table></div>}
      <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-700"><button type="button" onClick={() => navigate(returnPage)} className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg cursor-pointer">Cancel</button><button type="submit" disabled={!allTrucks.length} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"><CheckCircle className="w-4 h-4" />Save {allTrucks.length} transport{allTrucks.length === 1 ? '' : 's'}</button></div>
    </section>
    </form>
  </div>;
};