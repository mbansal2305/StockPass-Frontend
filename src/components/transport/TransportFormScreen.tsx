import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QuantityUnit, Transport, TransportRentType, TransportStatus, TransportItem } from '../../types';
import { TransportClientOption, transportsApi } from '../../api';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  Truck,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { formatQuantityWithUnit, formatCurrency } from '../../utils/formatters';

const isFlagEnabled = (value: boolean | string | undefined): boolean => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return Boolean(normalized && !['false', '0', 'no'].includes(normalized));
};

const getWeightUnitLabel = (unit: QuantityUnit): string => {
  if (unit === 'quintal') return 'Quintal';
  if (unit === 'kg') return 'Kilogram (KG)';
  return 'Metric Ton (MT)';
};

const getTodayDate = (): string => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

export const TransportFormScreen: React.FC = () => {
  const {
    transports,
    orders,
    commodities,
    clients,
    transporters,
    pageParams,
    navigate,
    refreshData,
    showToast,
    currentUser
  } = useApp();

  const editingTransportId = pageParams.transportId;
  const existingTransport = editingTransportId ? transports.find(t => t.id === editingTransportId) : null;

  // Context prefill from order if navigated via "Create Transport" button
  const prefillOrderId = pageParams.prefillOrderId;
  const prefillCommodityId = pageParams.prefillCommodityId;
  const prefillFromClientId = pageParams.prefillFromClientId;
  const prefillToClientId = pageParams.prefillToClientId;
  const remainingCapacity = pageParams.remainingCapacity || 24;

  const defaultBillingFirm = clients.find(c => c.type === 'MY_FIRM')?.id || clients[0]?.id || '';

  // Form State
  const [formData, setFormData] = useState({
    billNumber: '',
    loadingDate: getTodayDate(),
    billingFirmId: defaultBillingFirm,
    commodityId: prefillCommodityId || commodities[0]?.id || '',
    fromClientId: prefillFromClientId || clients[0]?.id || '',
    toClientId: prefillToClientId || clients[1]?.id || clients[0]?.id || '',
    vehicleNumber: '',
    transporterId: transporters[0]?.id || '',
    grossWeight: Math.min(26.5, remainingCapacity > 0 ? remainingCapacity : 24),
    grossWeightUnit: 'quintal' as QuantityUnit,
    bagNumbers: 500,
    bagWeight: 500,
    anugya: false,
    gatepass: false,
    rent: 0,
    rentType: 'per_unit' as TransportRentType,
    advanceByClient: 0,
    advanceByFirm: 0,
    finalPaid: 0,
    extraPaid: 0,
    shortage: 0,
    unloadDate: '',
    receivedWeight: 0,
    sourceWeightReceipt: '',
    destinationWeightReceipt: '',
    status: 'PENDING' as TransportStatus,
    notes: ''
  });

  // Transport Items (Order allocations)
  const [items, setItems] = useState<TransportItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sourceReceiptFile, setSourceReceiptFile] = useState<File | null>(null);
  const [destinationReceiptFile, setDestinationReceiptFile] = useState<File | null>(null);
  const [billingFirms, setBillingFirms] = useState<TransportClientOption[]>([]);
  const [locations, setLocations] = useState<TransportClientOption[]>([]);
  const [agencyOptions, setAgencyOptions] = useState(transporters);
  const [salesOrders, setSalesOrders] = useState(orders.filter(order => order.type === 'SALES ORDER'));
  const [purchaseOrders, setPurchaseOrders] = useState(orders.filter(order => order.type === 'PURCHASE ORDER'));
  const contractOrders = [...salesOrders, ...purchaseOrders];

  const sourceClientName = locations.find(location => location.id === formData.fromClientId)?.name || 'Selected origin';
  const destinationClientName = locations.find(location => location.id === formData.toClientId)?.name || 'Selected destination';

  useEffect(() => {
    let cancelled = false;
    const fallbackFirms = clients
      .filter(client => String(client.type).toLowerCase() === 'my_firm')
      .map(client => ({ id: client.id, name: client.name, city: client.city }));
    const fallbackLocations = clients.map(client => ({ id: client.id, name: client.name, city: client.city }));

    Promise.allSettled([
      transportsApi.selectBillingFirms(),
      transportsApi.selectLocations(),
      transportsApi.selectAgencyOptions(),
      transportsApi.selectSalesOrders({ clients, commodities }),
      transportsApi.selectPurchaseOrders({ clients, commodities })
    ]).then(([firmsResult, locationsResult, agenciesResult, salesResult, purchasesResult]) => {
      if (cancelled) return;
      const nextFirms = firmsResult.status === 'fulfilled' ? firmsResult.value : fallbackFirms;
      const nextLocations = locationsResult.status === 'fulfilled' ? locationsResult.value : fallbackLocations;
      const nextAgencies = agenciesResult.status === 'fulfilled' ? agenciesResult.value : transporters;
      const nextSalesOrders = salesResult.status === 'fulfilled'
        ? salesResult.value
        : orders.filter(order => order.type === 'SALES ORDER');
      const nextPurchaseOrders = purchasesResult.status === 'fulfilled'
        ? purchasesResult.value
        : orders.filter(order => order.type === 'PURCHASE ORDER');
      setBillingFirms(nextFirms);
      setLocations(nextLocations);
      setAgencyOptions(nextAgencies);
      setSalesOrders(nextSalesOrders);
      setPurchaseOrders(nextPurchaseOrders);
      setFormData(current => ({
        ...current,
        billingFirmId: current.billingFirmId || nextFirms[0]?.id || '',
        fromClientId: current.fromClientId || nextLocations[0]?.id || '',
        toClientId: current.toClientId || nextLocations[1]?.id || nextLocations[0]?.id || '',
        transporterId: current.transporterId || nextAgencies[0]?.id || ''
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [clients, orders, transporters]);

  useEffect(() => {
    if (existingTransport) {
      setFormData({
        billNumber: existingTransport.billNumber,
        loadingDate: existingTransport.loadingDate || getTodayDate(),
        billingFirmId: existingTransport.billingFirmId,
        commodityId: existingTransport.commodityId,
        fromClientId: existingTransport.fromClientId,
        toClientId: existingTransport.toClientId,
        vehicleNumber: existingTransport.vehicleNumber,
        transporterId: existingTransport.transporterId,
        grossWeight: existingTransport.grossWeight,
        grossWeightUnit: existingTransport.grossWeightUnit || 'quintal',
        bagNumbers: existingTransport.bagNumbers || 0,
        bagWeight: existingTransport.bagWeight ?? 500,
        anugya: isFlagEnabled(existingTransport.anugya),
        gatepass: isFlagEnabled(existingTransport.gatepass),
        rent: existingTransport.rent,
        rentType: existingTransport.rentType || 'per_unit',
        advanceByClient: existingTransport.advanceByClient || 0,
        advanceByFirm: existingTransport.advanceByFirm || 0,
        finalPaid: existingTransport.finalPaid || 0,
        extraPaid: existingTransport.extraPaid || 0,
        shortage: existingTransport.shortage || 0,
        unloadDate: existingTransport.unloadDate || '',
        receivedWeight: existingTransport.receivedWeight || 0,
        sourceWeightReceipt: existingTransport.sourceWeightReceipt || '',
        destinationWeightReceipt: existingTransport.destinationWeightReceipt || '',
        status: existingTransport.status,
        notes: existingTransport.notes || ''
      });
      setItems(existingTransport.items);
    } else {
      // Auto-generate Bill number
      const year = new Date().getFullYear();
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const randomBill = `BIL-${year}-${randNum}`;

      // Pick matching active order if not prefilled
      const matchingOrder = prefillOrderId 
        ? orders.find(o => o.id === prefillOrderId)
        : orders.find(o => o.status === 'PENDING') || orders[0];

      const initialCommodity = matchingOrder ? matchingOrder.commodityId : (commodities[0]?.id || '');
      const initialFrom = matchingOrder ? matchingOrder.fromClientId : (clients[0]?.id || '');
      const initialTo = matchingOrder ? matchingOrder.toClientId : (clients[1]?.id || '');

      setFormData(prev => ({
        ...prev,
        billNumber: randomBill,
        commodityId: initialCommodity,
        fromClientId: initialFrom,
        toClientId: initialTo,
        vehicleNumber: 'MP09HH' + Math.floor(1000 + Math.random() * 9000),
        anugya: false,
        gatepass: false
      }));

      setItems([]);
    }
  }, [existingTransport, prefillOrderId]);

  // When gross weight changes in normal 1-item mode, sync the single allocated quantity
  const handleGrossWeightChange = (newGross: number) => {
    setFormData(prev => ({ ...prev, grossWeight: newGross }));
    if (items.length === 1) {
      setItems([{ ...items[0], allocatedQuantity: newGross }]);
    }
  };

  const handleGrossWeightUnitChange = (unit: QuantityUnit) => {
    setFormData(prev => ({ ...prev, grossWeightUnit: unit }));
  };

  const handleAddItem = (orderType: 'SALES ORDER' | 'PURCHASE ORDER') => {
    const orderOptions = orderType === 'SALES ORDER' ? salesOrders : purchaseOrders;
    const unallocatedOrder = orderOptions.find(o => !items.some(i => i.orderId === o.id) && o.status === 'PENDING') || orderOptions[0];
    if (unallocatedOrder) {
      setItems([...items, { orderId: unallocatedOrder.id, allocatedQuantity: 0 }]);
      setErrors(previous => {
        const { items: _itemsError, ...remainingErrors } = previous;
        return remainingErrors;
      });
    } else {
      showToast(`No ${orderType.toLowerCase()} options available`, 'error');
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
    setErrors(previous => {
      const { items: _itemsError, ...remainingErrors } = previous;
      return remainingErrors;
    });
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    const next = [...items];
    next[index] = { ...next[index], allocatedQuantity: qty };
    setItems(next);
    setErrors(previous => {
      const { items: _itemsError, ...remainingErrors } = previous;
      return remainingErrors;
    });
  };

  const handleItemOrderChange = (index: number, orderId: string) => {
    const next = [...items];
    next[index] = { ...next[index], orderId };
    setItems(next);
    setErrors(previous => {
      const { items: _itemsError, ...remainingErrors } = previous;
      return remainingErrors;
    });
  };

  const orderTypeById = new Map(contractOrders.map(order => [order.id.trim(), order.type]));
  const getOrderType = (orderId: string): 'SALES ORDER' | 'PURCHASE ORDER' | undefined => {
    const normalizedId = String(orderId).trim();
    const directMatch = orderTypeById.get(normalizedId);
    if (directMatch) return directMatch;
    if (/^\d+$/.test(normalizedId)) {
      return contractOrders.find(order => /^\d+$/.test(order.id) && Number(order.id) === Number(normalizedId))?.type;
    }
    return undefined;
  };
  const salesAllocated = items.reduce((sum, item) => {
    return getOrderType(item.orderId) === 'SALES ORDER' ? sum + (Number(item.allocatedQuantity) || 0) : sum;
  }, 0);
  const purchaseAllocated = items.reduce((sum, item) => {
    return getOrderType(item.orderId) === 'PURCHASE ORDER' ? sum + (Number(item.allocatedQuantity) || 0) : sum;
  }, 0);
  const hasSalesItems = items.some(item => getOrderType(item.orderId) === 'SALES ORDER');
  const hasPurchaseItems = items.some(item => getOrderType(item.orderId) === 'PURCHASE ORDER');
  const renderAllocationGroup = (orderType: 'SALES ORDER' | 'PURCHASE ORDER') => {
    const orderOptions = orderType === 'SALES ORDER' ? salesOrders : purchaseOrders;
    const groupItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => getOrderType(item.orderId) === orderType);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-800">{orderType === 'SALES ORDER' ? 'Sales Orders' : 'Purchase Orders'}</h3>
          <button
            type="button"
            onClick={() => handleAddItem(orderType)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Order
          </button>
        </div>
        {groupItems.length === 0 ? (
          <p className="text-xs text-slate-500">No {orderType.toLowerCase()} allocated.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2 text-right min-w-[150px]">Allocated ({getWeightUnitLabel(formData.grossWeightUnit)})</th>
                  <th className="px-3 py-2 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupItems.map(({ item, index }) => (
                  <tr key={item.id ?? `${orderType}-${index}`}>
                    <td className="px-3 py-2">
                      <select
                        value={item.orderId}
                        onChange={(event) => handleItemOrderChange(index, event.target.value)}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-900"
                      >
                        {orderOptions.map(order => (
                          <option key={order.id} value={order.id}>{order.orderNumber}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.allocatedQuantity}
                        onChange={(event) => handleItemQuantityChange(index, parseFloat(event.target.value) || 0)}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 font-bold tabular-nums text-blue-700 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        aria-label={`Remove ${orderType.toLowerCase()} allocation`}
                        className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.billNumber.trim()) newErrors.billNumber = 'Bill / Bilty number is required';
    if (!formData.vehicleNumber.trim()) newErrors.vehicleNumber = 'Vehicle number is required';
    if (!formData.billingFirmId) newErrors.billingFirmId = 'Billing firm is required';
    if (!formData.commodityId) newErrors.commodityId = 'Commodity is required';
    if (!formData.transporterId) newErrors.transporterId = 'Transporter is required';
    if (!formData.fromClientId) newErrors.fromClientId = 'Dispatch origin is required';
    if (!formData.toClientId) newErrors.toClientId = 'Consignee destination is required';
    if (formData.fromClientId === formData.toClientId) {
      newErrors.toClientId = 'Origin and destination cannot be the same';
    }
    if (formData.grossWeight <= 0) newErrors.grossWeight = 'Gross weight must be greater than zero';
    if (formData.rent < 0) newErrors.rent = 'Freight rent cannot be negative';

    if (items.length === 0) {
      newErrors.items = 'Please allocate at least one order to this transport';
    } else if (hasSalesItems && hasPurchaseItems && (
      Math.abs(Number(formData.grossWeight) - salesAllocated) > 0.01 || Math.abs(Number(formData.grossWeight) - purchaseAllocated) > 0.01
    )) {
      newErrors.items = 'Sales and purchase allocation totals must each equal the gross loading weight';
    } else if (hasSalesItems && !hasPurchaseItems && Math.abs(Number(formData.grossWeight) - salesAllocated) > 0.01) {
      newErrors.items = 'Sales allocation total must equal the gross loading weight';
    } else if (hasPurchaseItems && !hasSalesItems && Math.abs(Number(formData.grossWeight) - purchaseAllocated) > 0.01) {
      newErrors.items = 'Purchase allocation total must equal the gross loading weight';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fix the errors in the form before saving', 'error');
      return;
    }

    // Ensure items are properly normalized
    const sanitizedItems = items.map(i => ({
      id: i.id,
      orderId: i.orderId,
      allocatedQuantity: Number(i.allocatedQuantity)
    }));

    try {
      const transportData = {
        id: existingTransport?.id,
        billNumber: formData.billNumber.trim(),
        loadingDate: formData.loadingDate,
        billingFirmId: formData.billingFirmId,
        commodityId: formData.commodityId,
        fromClientId: formData.fromClientId,
        toClientId: formData.toClientId,
        vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
        transporterId: formData.transporterId,
        grossWeight: Number(formData.grossWeight),
        grossWeightUnit: formData.grossWeightUnit,
        bagNumbers: formData.bagNumbers ? Number(formData.bagNumbers) : undefined,
        bagWeight: formData.bagWeight ? Number(formData.bagWeight) : undefined,
        anugya: formData.anugya,
        gatepass: formData.gatepass,
        rent: Number(formData.rent),
        rentType: formData.rentType,
        advanceByClient: Number(formData.advanceByClient),
        advanceByFirm: Number(formData.advanceByFirm),
        finalPaid: Number(formData.finalPaid),
        extraPaid: Number(formData.extraPaid),
        shortage: Number(formData.shortage),
        unloadDate: formData.unloadDate || undefined,
        receivedWeight: formData.receivedWeight ? Number(formData.receivedWeight) : undefined,
        sourceWeightReceipt: formData.sourceWeightReceipt.trim(),
        destinationWeightReceipt: formData.destinationWeightReceipt.trim(),
        status: formData.status,
        items: sanitizedItems,
        notes: formData.notes.trim(),
        createdBy: currentUser?.name || 'Operator'
      };

      const lookups = { clients, commodities, orders: contractOrders, transporters };
      const files = { source: sourceReceiptFile, destination: destinationReceiptFile };
      const saved = existingTransport
        ? await transportsApi.update({ ...transportData, id: existingTransport.id }, files, lookups)
        : await transportsApi.add(transportData, files, lookups);

      await refreshData();
      showToast(existingTransport ? 'Consignment updated' : 'Transport created successfully', 'success');
      navigate('transport-detail', { transportId: saved.id });
    } catch (err: any) {
      showToast(err.message || 'Failed to save transport', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(existingTransport ? 'transport-detail' : 'transport', { transportId: editingTransportId })}
          className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {existingTransport ? `Edit Transport: ${existingTransport.vehicleNumber}` : 'Record New Transport Consignment'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Truck loading weight, bilty details, waybill, and freight payments.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECTION 1: BASIC & VEHICLE INFORMATION */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Consignment & Vehicle Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Number *</label>
              <input
                type="text"
                required
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                placeholder="e.g. MP04AB1234"
                className={`w-full text-xs border rounded-lg px-3 py-2 font-mono font-bold uppercase text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none ${
                  errors.vehicleNumber ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {errors.vehicleNumber && (
                <p className="text-[10px] text-red-600 mt-1">{errors.vehicleNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bill / Bilty Number *</label>
              <input
                type="text"
                required
                value={formData.billNumber}
                onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                placeholder="BIL-2026-0000"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Transporter Agency *</label>
              <select
                value={formData.transporterId}
                onChange={(e) => setFormData({ ...formData, transporterId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
              >
                {agencyOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.city || 'Depot'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loading Date *</label>
              <input
                type="date"
                required
                value={formData.loadingDate}
                onChange={(event) => setFormData({ ...formData, loadingDate: event.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Billing Entity (My Firm) *</label>
              <select
                value={formData.billingFirmId}
                onChange={(e) => setFormData({ ...formData, billingFirmId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
              >
                {billingFirms.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.name} ({cli.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Commodity *</label>
              <select
                value={formData.commodityId}
                onChange={(e) => setFormData({ ...formData, commodityId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
              >
                {commodities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: ROUTE */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Origin & Destination Route
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loading Origin (From Client / Godown) *</label>
              <select
                value={formData.fromClientId}
                onChange={(e) => setFormData({ ...formData, fromClientId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                {locations.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.name} ({cli.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unloading Destination (To Consignee) *</label>
              <select
                value={formData.toClientId}
                onChange={(e) => setFormData({ ...formData, toClientId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                {locations.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.name} ({cli.city})
                  </option>
                ))}
              </select>
              {errors.toClientId && (
                <p className="text-[10px] text-red-600 mt-1">{errors.toClientId}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: WEIGHT & MANDI PASSES */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            3. Weight, Bags & Mandi Documentation
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gross Loading Weight *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={formData.grossWeight}
                onChange={(e) => handleGrossWeightChange(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-bold tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              <select
                aria-label="Gross loading weight unit"
                value={formData.grossWeightUnit}
                onChange={(e) => handleGrossWeightUnitChange(e.target.value as QuantityUnit)}
                className="mt-2 w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                <option value="mt">Metric Ton (MT)</option>
                <option value="quintal">Quintal</option>
                <option value="kg">Kilogram (KG)</option>
              </select>
              {errors.grossWeight && (
                <p className="text-[10px] text-red-600 mt-1">{errors.grossWeight}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bag Count</label>
              <input
                type="number"
                min="0"
                value={formData.bagNumbers}
                onChange={(e) => setFormData({ ...formData, bagNumbers: parseInt(e.target.value) || 0 })}
                placeholder="500 bags"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Weight of Each Bag (grams)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.bagWeight}
                onChange={(e) => setFormData({ ...formData, bagWeight: parseFloat(e.target.value) || 0 })}
                placeholder="50000 grams"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label htmlFor="transport-anugya" className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  id="transport-anugya"
                  type="checkbox"
                  checked={formData.anugya}
                  onChange={(e) => setFormData({ ...formData, anugya: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                Mandi Anugya / Permit Available
              </label>
            </div>

            <div>
              <label htmlFor="transport-gatepass" className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  id="transport-gatepass"
                  type="checkbox"
                  checked={formData.gatepass}
                  onChange={(e) => setFormData({ ...formData, gatepass: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                Gate Pass Available
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 4: SALES AND PURCHASE ORDER ALLOCATION */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Order Allocation</h2>
            <p className="text-[11px] text-slate-500 mt-1">When both order types are attached, each type&apos;s allocation total must equal gross weight.</p>
          </div>

          {renderAllocationGroup('SALES ORDER')}
          <div className="border-t border-slate-100" />
          {renderAllocationGroup('PURCHASE ORDER')}

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-slate-600">Sales allocation: <strong>{formatQuantityWithUnit(salesAllocated, formData.grossWeightUnit)}</strong></span>
              <span className="text-slate-600">Purchase allocation: <strong>{formatQuantityWithUnit(purchaseAllocated, formData.grossWeightUnit)}</strong></span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-2">
              <span className="text-slate-600">Gross weight: <strong>{formatQuantityWithUnit(Number(formData.grossWeight), formData.grossWeightUnit)}</strong></span>
              {hasSalesItems && <span className={Math.abs(Number(formData.grossWeight) - salesAllocated) <= 0.01 ? 'text-emerald-700' : 'text-amber-700'}>Sales vs gross: <strong>{formatQuantityWithUnit(salesAllocated, formData.grossWeightUnit)} / {formatQuantityWithUnit(Number(formData.grossWeight), formData.grossWeightUnit)}</strong></span>}
              {hasPurchaseItems && <span className={Math.abs(Number(formData.grossWeight) - purchaseAllocated) <= 0.01 ? 'text-emerald-700' : 'text-amber-700'}>Purchase vs gross: <strong>{formatQuantityWithUnit(purchaseAllocated, formData.grossWeightUnit)} / {formatQuantityWithUnit(Number(formData.grossWeight), formData.grossWeightUnit)}</strong></span>}
              {((hasSalesItems && Math.abs(Number(formData.grossWeight) - salesAllocated) <= 0.01) || !hasSalesItems) &&
                ((hasPurchaseItems && Math.abs(Number(formData.grossWeight) - purchaseAllocated) <= 0.01) || !hasPurchaseItems) && (
                  <span className="text-emerald-700 font-semibold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Reconciled</span>
                )}
            </div>
            {errors.items && <p className="text-red-600">{errors.items}</p>}
          </div>
        </div>

        {/* SECTION 5: FREIGHT & ACCOUNTING */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            5. Freight Rent & Payment Settlement
          </h2>

          <div className="space-y-4">
            <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                aria-pressed={formData.rentType === 'per_unit'}
                onClick={() => setFormData({ ...formData, rentType: 'per_unit' })}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${formData.rentType === 'per_unit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Per Unit
              </button>
              <button
                type="button"
                aria-pressed={formData.rentType === 'fix'}
                onClick={() => setFormData({ ...formData, rentType: 'fix' })}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${formData.rentType === 'fix' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Fixed Rent
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">
                {formData.rentType === 'per_unit'
                  ? `Rent per ${getWeightUnitLabel(formData.grossWeightUnit)} (₹) *`
                  : 'Fixed Rent (₹) *'}
              </label>
              <input
                type="number"
                step="100"
                min="0"
                required
                value={formData.rent}
                onChange={(e) => setFormData({ ...formData, rent: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Advance Paid by Firm (₹)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={formData.advanceByFirm}
                onChange={(e) => setFormData({ ...formData, advanceByFirm: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Advance Paid by Consignee (₹)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={formData.advanceByClient}
                onChange={(e) => setFormData({ ...formData, advanceByClient: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Extra (₹)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={formData.extraPaid}
                onChange={(e) => setFormData({ ...formData, extraPaid: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Shortage (₹)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={formData.shortage}
                onChange={(e) => setFormData({ ...formData, shortage: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Final Settled Paid (₹)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={formData.finalPaid}
                onChange={(e) => setFormData({ ...formData, finalPaid: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>
          </div>
        </div>

        {/* SECTION 6: WORKFLOW STAGE & DELIVERY */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            6. Consignment Status & Destination Unloading
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Workflow Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TransportStatus })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
              >
                <option value="PENDING">1. Pending / Loading</option>
                <option value="DELIVERY">2. In Delivery</option>
                <option value="FINANCE">3. Finance Audit (Unloaded)</option>
                <option value="PAID">4. Settled & Paid</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unload Date</label>
              <input
                type="date"
                value={formData.unloadDate}
                onChange={(e) => setFormData({ ...formData, unloadDate: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Received Weight (MT at Gate)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.receivedWeight}
                onChange={(e) => setFormData({ ...formData, receivedWeight: parseFloat(e.target.value) || 0 })}
                placeholder="Optional until unloaded"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes / Driver Details</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Driver name, mobile number, tare weighbridge details..."
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* SECTION 7: WEIGHT RECEIPTS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            7. Weight Receipts
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="source-weight-receipt" className="block text-xs font-medium text-slate-700 mb-1">
                Source Weight Receipt · {sourceClientName}
              </label>
              <input
                id="source-weight-receipt"
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => setSourceReceiptFile(event.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />
              {formData.sourceWeightReceipt && (
                <a
                  href={formData.sourceWeightReceipt}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-[11px] text-blue-700 hover:underline"
                >
                  View current source receipt
                </a>
              )}
            </div>

            <div>
              <label htmlFor="destination-weight-receipt" className="block text-xs font-medium text-slate-700 mb-1">
                Destination Weight Receipt · {destinationClientName}
              </label>
              <input
                id="destination-weight-receipt"
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => setDestinationReceiptFile(event.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />
              {formData.destinationWeightReceipt && (
                <a
                  href={formData.destinationWeightReceipt}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-[11px] text-blue-700 hover:underline"
                >
                  View current destination receipt
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(existingTransport ? 'transport-detail' : 'transport', { transportId: editingTransportId })}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {existingTransport ? 'Save Changes' : 'Save Transport Consignment'}
          </button>
        </div>
      </form>
    </div>
  );
};
