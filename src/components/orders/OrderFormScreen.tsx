import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, OrderType, OrderStatus, QuantityUnit } from '../../types';
import { ordersApi, OrderClientOption } from '../../api/orders';
import { storage } from '../../services/storage';
import { getUnitLabel } from '../../utils/formatters';
import { DecimalInput } from '../common/DecimalInput';
import { ArrowLeft, Save, AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react';

export const OrderFormScreen: React.FC = () => {
  const {
    orders,
    commodities,
    clients,
    brokers,
    pageParams,
    navigate,
    refreshData,
    showToast,
    orderAdd,
    orderUpdate
  } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const editingOrderId = pageParams.orderId;
  const existingOrder = editingOrderId ? orders.find(o => o.id === editingOrderId) : null;
  const requestedType = pageParams.initialType as OrderType | undefined;

  // Track if user has explicitly confirmed/selected order type in create mode
  const [selectedTypeConfirmed, setSelectedTypeConfirmed] = useState<boolean>(
    Boolean(existingOrder || requestedType)
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysLaterStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Form state
  const [formData, setFormData] = useState({
    type: (existingOrder?.type || requestedType || 'SALES ORDER') as OrderType,
    orderNumber: '',
    commodityId: '',
    fromClientId: '',
    toClientId: '',
    unit: (existingOrder?.unit || 'quintal') as QuantityUnit,
    quantity: 0,
    rate: 0,
    contractDate: todayStr,
    startDate: todayStr,
    expiryDate: thirtyDaysLaterStr,
    brokerId: '',
    status: 'PENDING' as OrderStatus,
    notes: '',
    quantityFulfilled: 0
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingPurchaseOrderNumber, setIsLoadingPurchaseOrderNumber] = useState(false);
  const [purchaseOrderNumberError, setPurchaseOrderNumberError] = useState('');
  const [routeClients, setRouteClients] = useState<{
    fromClient: OrderClientOption[];
    toClient: OrderClientOption[];
  }>({ fromClient: [], toClient: [] });

  useEffect(() => {
    if (!selectedTypeConfirmed) return;

    let isCurrent = true;

    const loadRouteClients = async () => {
      try {
        const options = await ordersApi.selectClients(formData.type);
        if (!isCurrent) return;

        const fromClient = [...options.fromClient];
        const toClient = [...options.toClient];

        setRouteClients({ fromClient, toClient });
        setFormData(prev => ({
          ...prev,
          fromClientId: fromClient.some(client => client.id === prev.fromClientId)
            ? prev.fromClientId
            : fromClient[0]?.id || '',
          toClientId: toClient.some(client => client.id === prev.toClientId)
            ? prev.toClientId
            : toClient[0]?.id || ''
        }));
      } catch (err) {
        if (!isCurrent) return;

        console.warn('Order route client selection failed, using all clients:', err);
        const fallbackClients = clients.map(client => ({
          id: client.id,
          name: client.name,
          city: client.city
        }));
        setRouteClients({ fromClient: fallbackClients, toClient: fallbackClients });
      }
    };

    loadRouteClients();
    return () => {
      isCurrent = false;
    };
  }, [formData.type, existingOrder, clients, selectedTypeConfirmed]);

  useEffect(() => {
    if (existingOrder || !selectedTypeConfirmed || formData.type !== 'PURCHASE ORDER') {
      setIsLoadingPurchaseOrderNumber(false);
      setPurchaseOrderNumberError('');
      return;
    }

    let isCurrent = true;
    setIsLoadingPurchaseOrderNumber(true);
    setPurchaseOrderNumberError('');
    setFormData(prev => ({ ...prev, orderNumber: '' }));

    ordersApi.getPurchaseOrderNumber()
      .then(orderNumber => {
        if (isCurrent) setFormData(prev => ({ ...prev, orderNumber }));
      })
      .catch((err: any) => {
        if (isCurrent) setPurchaseOrderNumberError(err.message || 'Could not generate Purchase Order number');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingPurchaseOrderNumber(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [existingOrder, formData.type, selectedTypeConfirmed]);

  useEffect(() => {
    if (existingOrder) {
      setFormData({
        type: existingOrder.type,
        orderNumber: existingOrder.orderNumber,
        commodityId: existingOrder.commodityId,
        fromClientId: existingOrder.fromClientId,
        toClientId: existingOrder.toClientId,
        unit: existingOrder.unit || 'quintal',
        quantity: existingOrder.quantity,
        rate: existingOrder.rate,
        contractDate: existingOrder.contractDate || existingOrder.startDate || todayStr,
        startDate: existingOrder.startDate || todayStr,
        expiryDate: existingOrder.expiryDate || thirtyDaysLaterStr,
        brokerId: existingOrder.brokerId || '',
        status: existingOrder.status,
        notes: existingOrder.notes || '',
        quantityFulfilled: existingOrder.quantityFulfilled || 0
      });
      setSelectedTypeConfirmed(true);
    } else {
      const chosenType = requestedType || formData.type;
      const prefix = chosenType === 'SALES ORDER' ? 'SO' : 'PO';
      const year = new Date().getFullYear();
      const randomNum = Math.floor(100 + Math.random() * 900);

      setFormData(prev => ({
        ...prev,
        type: chosenType,
        orderNumber: chosenType === 'PURCHASE ORDER'
          ? (prev.type === chosenType ? prev.orderNumber : '')
          : (prev.type === chosenType && prev.orderNumber ? prev.orderNumber : `${prefix}-${year}-${randomNum}`),
        commodityId: commodities[0]?.id || '',
        fromClientId: clients[0]?.id || '',
        toClientId: clients[1]?.id || clients[0]?.id || '',
        brokerId: brokers[0]?.id || '',
        contractDate: todayStr,
        startDate: todayStr,
        expiryDate: thirtyDaysLaterStr
      }));

      if (requestedType) {
        setSelectedTypeConfirmed(true);
      }
    }
  }, [existingOrder, requestedType, commodities, clients, brokers]);

  // Update order number prefix if type changes in new mode
  const handleTypeChange = (newType: OrderType) => {
    if (!existingOrder) {
      const prefix = 'SO';
      const year = new Date().getFullYear();
      const currentNumberSuffix = formData.orderNumber.split('-')[2] || Math.floor(100 + Math.random() * 900);
      setFormData(prev => ({
        ...prev,
        type: newType,
        orderNumber: newType === 'PURCHASE ORDER'
          ? ''
          : `${prefix}-${year}-${currentNumberSuffix}`
      }));
    } else {
      setFormData(prev => ({ ...prev, type: newType }));
    }
    setSelectedTypeConfirmed(true);
  };

  const handleUnitChange = (newUnit: QuantityUnit) => {
    setFormData(prev => ({
      ...prev,
      unit: newUnit
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.orderNumber.trim()) newErrors.orderNumber = 'Order number is required';
    if (!formData.commodityId) newErrors.commodityId = 'Commodity is required';
    if (!formData.fromClientId) newErrors.fromClientId = 'Source client/godown is required';
    if (!formData.toClientId) newErrors.toClientId = 'Destination client is required';
    if (formData.fromClientId === formData.toClientId) {
      newErrors.toClientId = 'Origin and destination cannot be identical';
    }
    if (formData.quantity <= 0) newErrors.quantity = `Quantity must be greater than zero ${getUnitLabel(formData.unit)}`;
    if (formData.rate <= 0) newErrors.rate = `Rate must be greater than zero ₹ per ${getUnitLabel(formData.unit)}`;
    if (!formData.contractDate) newErrors.contractDate = 'Contract date is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (formData.expiryDate < formData.startDate) {
      newErrors.expiryDate = 'Expiry date cannot precede contract start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fix the validation errors in the form', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload: Partial<Order> = {
        type: formData.type,
        orderNumber: formData.orderNumber.trim(),
        commodityId: formData.commodityId,
        fromClientId: formData.fromClientId,
        toClientId: formData.toClientId,
        rate: Number(formData.rate),
        quantity: Number(formData.quantity),
        unit: formData.unit,
        contractDate: formData.contractDate,
        startDate: formData.startDate,
        expiryDate: formData.expiryDate,
        quantityFulfilled: existingOrder ? formData.quantityFulfilled : 0,
        brokerId: formData.brokerId,
        status: formData.status,
        notes: formData.notes.trim()
      };

      let saved: Order;
      if (existingOrder) {
        saved = await orderUpdate(existingOrder.id, orderPayload);
        showToast('Order updated successfully', 'success');
      } else {
        saved = await orderAdd(orderPayload);
        showToast('New order created successfully', 'success');
      }

      navigate('order-detail', { orderId: saved.id });
    } catch (err: any) {
      showToast(err.message || 'Failed to save order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If new order and user hasn't selected a type yet, show selection step first
  if (!existingOrder && !selectedTypeConfirmed) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 py-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('orders')}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create New Commodity Order</h1>
            <p className="text-xs text-slate-500 mt-0.5">Please choose which order type you want to create to proceed.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Select Order Category</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Purchase Order Card */}
            <button
              type="button"
              onClick={() => handleTypeChange('PURCHASE ORDER')}
              className="p-5 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-900">Purchase Order</h3>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Inward</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Procure commodity from mandis, farmers, or vendors into your firm or warehouse.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                Continue as Purchase Order &rarr;
              </div>
            </button>

            {/* Sales Order Card */}
            <button
              type="button"
              onClick={() => handleTypeChange('SALES ORDER')}
              className="p-5 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-900">Sales Order</h3>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">Outward</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Sell and ship commodity to millers, food companies, or institutional buyers.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-700 flex items-center gap-1">
                Continue as Sales Order &rarr;
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(existingOrder ? 'order-detail' : 'orders', { orderId: editingOrderId })}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {existingOrder ? `Edit Order: ${existingOrder.orderNumber}` : 'Create New Commodity Order'}
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                  formData.type === 'SALES ORDER'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {formData.type === 'SALES ORDER' ? 'Sales (Outward)' : 'Purchase (Inward)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill in commercial specifications, quantity in {getUnitLabel(formData.unit)}, and dates.
            </p>
          </div>
        </div>

        {!existingOrder && (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeChange('PURCHASE ORDER')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                formData.type === 'PURCHASE ORDER'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Purchase
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('SALES ORDER')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                formData.type === 'SALES ORDER'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sales
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECTION 1: ORDER INFORMATION */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Order Identification & Commodity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Order Type *</label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as OrderType)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
              >
                <option value="SALES ORDER">Sales Order (Outward Contract)</option>
                <option value="PURCHASE ORDER">Purchase Order (Inward Contract)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Order Number *</label>
              <input
                type="text"
                required
                readOnly={formData.type === 'PURCHASE ORDER'}
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                placeholder={isLoadingPurchaseOrderNumber ? 'Generating order number...' : 'e.g. SO-2026-101'}
                className={`w-full text-xs border rounded-lg px-3 py-2 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none ${
                  errors.orderNumber || purchaseOrderNumberError
                    ? 'border-red-400 bg-red-50/30'
                    : formData.type === 'PURCHASE ORDER'
                    ? 'border-slate-300 bg-slate-50 text-slate-600 cursor-not-allowed'
                    : 'border-slate-300'
                }`}
              />
              {(errors.orderNumber || purchaseOrderNumberError) && (
                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> {purchaseOrderNumberError || errors.orderNumber}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Commodity *</label>
              <select
                value={formData.commodityId}
                onChange={(e) => setFormData({ ...formData, commodityId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                <option value="">Select Commodity</option>
                {commodities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
              {errors.commodityId && (
                <p className="text-[10px] text-red-600 mt-1">{errors.commodityId}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: ROUTE */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Logistics Route ({formData.type === 'PURCHASE ORDER' ? 'Source / Mandi Origin' : 'Destination / Consignee'})
            </h2>
            <span className="text-[11px] text-slate-400">
              {formData.type === 'PURCHASE ORDER' ? 'Inward from supplier' : 'Outward to customer'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dispatch Origin (From Client / Godown) *
                {formData.type === 'PURCHASE ORDER' && (
                  <span className="ml-1 text-[10px] text-emerald-600 font-normal">(Primary Supplier / Mandi)</span>
                )}
              </label>
              <select
                value={formData.fromClientId}
                onChange={(e) => setFormData({ ...formData, fromClientId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                <option value="">Select Origin Location / Client</option>
                {routeClients.fromClient.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.name} ({cli.city})
                  </option>
                ))}
              </select>
              {errors.fromClientId && (
                <p className="text-[10px] text-red-600 mt-1">{errors.fromClientId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Destination Consignee (To Client / Godown) *
                {formData.type === 'SALES ORDER' && (
                  <span className="ml-1 text-[10px] text-blue-600 font-normal">(Primary Buyer / Mill)</span>
                )}
              </label>
              <select
                value={formData.toClientId}
                onChange={(e) => setFormData({ ...formData, toClientId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                <option value="">Select Destination Consignee</option>
                {routeClients.toClient.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.name} ({cli.city})
                  </option>
                ))}
              </select>
              {errors.toClientId && (
                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> {errors.toClientId}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: QUANTITY & PRICING */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Quantity & Pricing
            </h2>
            <span className="text-[11px] text-slate-400">Unit: {getUnitLabel(formData.unit)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Quantity Type Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantity Type (Unit) *
              </label>
              <select
                value={formData.unit}
                onChange={(e) => handleUnitChange(e.target.value as QuantityUnit)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
              >
                <option value="mt">Metric Ton (MT)</option>
                <option value="quintal">Quintal (Qtl)</option>
                <option value="kg">Kilogram (KG)</option>
              </select>
            </div>

            {/* Contract Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contract Quantity ({getUnitLabel(formData.unit)}) *
              </label>
              <DecimalInput
                required
                value={formData.quantity}
                onChange={(quantity) => setFormData({ ...formData, quantity })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              {errors.quantity && (
                <p className="text-[10px] text-red-600 mt-1">{errors.quantity}</p>
              )}
            </div>

            {/* Rate based on selected unit */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rate (₹ per {getUnitLabel(formData.unit)}) *
              </label>
              <DecimalInput
                required
                value={formData.rate}
                onChange={(rate) => setFormData({ ...formData, rate })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              {errors.rate && (
                <p className="text-[10px] text-red-600 mt-1">{errors.rate}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: DATES & COMMERCIAL */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            4. Dates & Commercial Terms
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Contract Date - default today date */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contract Date *</label>
              <input
                type="date"
                required
                value={formData.contractDate}
                onChange={(e) => setFormData({ ...formData, contractDate: e.target.value })}
                className={`w-full text-xs border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none ${
                  errors.contractDate ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {errors.contractDate && (
                <p className="text-[10px] text-red-600 mt-1">{errors.contractDate}</p>
              )}
            </div>

            {/* Contract Start Date */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              {errors.startDate && (
                <p className="text-[10px] text-red-600 mt-1">{errors.startDate}</p>
              )}
            </div>

            {/* Contract Expiry Date */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              {errors.expiryDate && (
                <p className="text-[10px] text-red-600 mt-1">{errors.expiryDate}</p>
              )}
            </div>

            {/* Broker */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Broker / Dalal</label>
              <select
                value={formData.brokerId}
                onChange={(e) => setFormData({ ...formData, brokerId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                <option value="">Direct Deal (No Broker)</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city || 'Mandi'})
                  </option>
                ))}
              </select>
            </div>

            {/* Order Status */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Order Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as OrderStatus })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
              >
                <option value="DRAFT">Draft (Under Review)</option>
                <option value="PENDING">Pending (Active)</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Quality Specs & Operational Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Moisture limit 12%, payment within 10 days of delivery receipt, tare weight checking."
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => navigate(existingOrder ? 'order-detail' : 'orders', { orderId: editingOrderId })}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoadingPurchaseOrderNumber || (formData.type === 'PURCHASE ORDER' && !formData.orderNumber)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{existingOrder ? 'Saving via API...' : 'Creating via API...'}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{existingOrder ? 'Save Changes' : 'Create Order'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
