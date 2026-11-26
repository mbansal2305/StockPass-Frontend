import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QuantityUnit, Transport, TransportRentType, TransportStatus, TransportItem } from '../../types';
import { masterApi, TransportClientOption, transportsApi } from '../../api';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Truck,
  Building,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { formatQuantityWithUnit, formatCurrency } from '../../utils/formatters';
import { DecimalInput } from '../common/DecimalInput';
import { SearchableSelect } from '../common/SearchableSelect';

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

const getRateUnitLabel = (unit?: QuantityUnit): string => {
  if (unit === 'quintal') return 'Qtl';
  if (unit === 'kg') return 'Kg';
  return 'Mt';
};

const getTodayDate = (): string => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

const convertQuantityUnit = (quantity: number, fromUnit: QuantityUnit, toUnit: QuantityUnit): number => {
  const metricTons = fromUnit === 'mt' ? quantity : fromUnit === 'quintal' ? quantity / 10 : quantity / 1000;
  if (toUnit === 'mt') return metricTons;
  if (toUnit === 'quintal') return metricTons * 10;
  return metricTons * 1000;
};

const sameId = (left: string, right: string): boolean => {
  const leftId = String(left).trim();
  const rightId = String(right).trim();
  if (leftId === rightId) return true;
  return /^\d+$/.test(leftId) && /^\d+$/.test(rightId) && Number(leftId) === Number(rightId);
};

interface TransportDateInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

const formatTransportDate = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]} / ${match[2]} / ${match[1]}` : '';
};

const TransportDateInput: React.FC<TransportDateInputProps> = ({ id, value, onChange, required }) => (
  <div className="relative">
    <button
      id={id}
      type="button"
      aria-label={`Choose ${id.replace(/^transport-/, '').replace(/-/g, ' ')} date`}
      aria-required={required}
      onClick={event => {
        const dateInput = event.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[type="date"]');
        if (dateInput?.showPicker) dateInput.showPicker();
        else dateInput?.click();
      }}
      className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-left text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      <span>{formatTransportDate(value) || 'DD / MM / YYYY'}</span>
      <Calendar className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
    </button>
    <input
      type="date"
      aria-hidden="true"
      tabIndex={-1}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
    />
  </div>
);

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
    transportGet,
    showToast,
    currentUser
  } = useApp();

  const editingTransportId = pageParams.transportId;
  const existingTransport = editingTransportId ? transports.find(t => sameId(t.id, editingTransportId)) : null;
  const returnPage = pageParams.returnTo === 'transport-detail' || pageParams.returnTo === 'transport-payments'
    ? pageParams.returnTo
    : 'transport';

  // Context prefill from order if navigated via "Create Transport" button
  const prefillCommodityId = pageParams.prefillCommodityId;
  const prefillFromClientId = pageParams.prefillFromClientId;
  const prefillToClientId = pageParams.prefillToClientId;

  // Form State
  const [formData, setFormData] = useState({
    billNumber: '',
    loadingDate: getTodayDate(),
    billingFirmId: '',
    commodityId: prefillCommodityId || '',
    fromClientId: prefillFromClientId || '',
    toClientId: prefillToClientId || '',
    vehicleNumber: '',
    transporterId: '',
    grossWeight: 0,
    grossWeightUnit: 'quintal' as QuantityUnit,
    bagNumbers: 0,
    bagWeight: 0,
    anugya: false,
    gatepass: false,
    orderless: false,
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
  const [selectionCommodities, setSelectionCommodities] = useState(commodities);
  const [agencyOptions, setAgencyOptions] = useState(transporters);
  const [salesOrders, setSalesOrders] = useState(orders.filter(order => order.type === 'SALES ORDER'));
  const [purchaseOrders, setPurchaseOrders] = useState(orders.filter(order => order.type === 'PURCHASE ORDER'));
  const contractOrders = [...salesOrders, ...purchaseOrders];
  const getFallbackOption = (id: string, name?: string, city?: string): TransportClientOption[] =>
    id && !locations.some(location => sameId(location.id, id)) && name
      ? [{ id, name, city }]
      : [];
  const billingFirmOptions = [
    ...billingFirms,
    ...(existingTransport?.billingFirmId && existingTransport.billingFirmName
      && !billingFirms.some(firm => sameId(firm.id, existingTransport.billingFirmId))
      ? [{ id: existingTransport.billingFirmId, name: existingTransport.billingFirmName }]
      : [])
  ];
  const commodityOptions = [
    ...selectionCommodities,
    ...(existingTransport?.commodityId && existingTransport.commodityName
      && !selectionCommodities.some(commodity => sameId(commodity.id, existingTransport.commodityId))
      ? [{
        id: existingTransport.commodityId,
        name: existingTransport.commodityName,
        type: existingTransport.commodityType || ''
      }]
      : [])
  ];
  const locationOptions = [
    ...locations,
    ...getFallbackOption(existingTransport?.fromClientId || '', existingTransport?.fromClientName),
    ...getFallbackOption(existingTransport?.toClientId || '', existingTransport?.toClientName)
  ];
  const agencyOptionsWithFallback = [
    ...agencyOptions,
    ...(existingTransport?.transporterId && existingTransport.transporterName
      && !agencyOptions.some(agency => sameId(agency.id, existingTransport.transporterId))
      ? [{
        id: existingTransport.transporterId,
        name: existingTransport.transporterName,
        agency: existingTransport.transporterName,
        phone_number: '',
        phone: ''
      }]
      : [])
  ];

  const sourceClientName = locations.find(location => location.id === formData.fromClientId)?.name || 'Selected origin';
  const destinationClientName = locations.find(location => location.id === formData.toClientId)?.name || 'Selected destination';
  const salesOrdersForCommodity = salesOrders.filter(order => sameId(order.commodityId, formData.commodityId));
  const purchaseOrdersForCommodity = purchaseOrders.filter(order => sameId(order.commodityId, formData.commodityId));
  const contractOrdersForCommodity = [...salesOrdersForCommodity, ...purchaseOrdersForCommodity];

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
      transportsApi.selectPurchaseOrders({ clients, commodities }),
      masterApi.selectCommodities()
    ]).then(([firmsResult, locationsResult, agenciesResult, salesResult, purchasesResult, commoditiesResult]) => {
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
      const nextCommodities = commoditiesResult.status === 'fulfilled' ? commoditiesResult.value : commodities;
      setBillingFirms(nextFirms);
      setLocations(nextLocations);
      setAgencyOptions(nextAgencies);
      setSalesOrders(nextSalesOrders);
      setPurchaseOrders(nextPurchaseOrders);
      setSelectionCommodities(nextCommodities);
    });

    return () => {
      cancelled = true;
    };
  }, [clients, commodities, orders, transporters]);

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
        transporterId: existingTransport.transporterId || '',
        grossWeight: existingTransport.grossWeight,
        grossWeightUnit: existingTransport.grossWeightUnit || 'quintal',
        bagNumbers: existingTransport.bagNumbers || 0,
        bagWeight: existingTransport.bagWeight ?? 500,
        anugya: isFlagEnabled(existingTransport.anugya),
        gatepass: isFlagEnabled(existingTransport.gatepass),
        orderless: isFlagEnabled(existingTransport.orderless),
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
      setFormData(prev => ({
        ...prev,
        anugya: false,
        gatepass: false
      }));

      setItems([]);
    }
  }, [existingTransport]);

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
    if (formData.orderless) return;
    const orderOptions = orderType === 'SALES ORDER' ? salesOrdersForCommodity : purchaseOrdersForCommodity;
    const unallocatedOrder = orderOptions.find(o =>
      o.status === 'PENDING' && !items.some(item => sameId(item.orderId, o.id))
    ) || orderOptions.find(o => !items.some(item => sameId(item.orderId, o.id)));
    if (unallocatedOrder) {
      setItems([...items, { orderId: unallocatedOrder.id, allocatedQuantity: 0, orderEntryQuantity: 0 }]);
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
    if (items.some((item, itemIndex) => itemIndex !== index && sameId(item.orderId, orderId))) {
      showToast('This order is already attached to this transport', 'error');
      return;
    }
    const next = [...items];
    next[index] = { ...next[index], orderId, orderEntryQuantity: 0 };
    setItems(next);
    setErrors(previous => {
      const { items: _itemsError, ...remainingErrors } = previous;
      delete remainingErrors[`orderEntry-${index}`];
      return remainingErrors;
    });
  };

  const handleCommodityChange = (commodityId: string) => {
    setFormData(previous => ({ ...previous, commodityId }));
    const matchingOrderIds = contractOrders
      .filter(order => sameId(order.commodityId, commodityId))
      .map(order => order.id);
    setItems(previous => previous.filter(item => matchingOrderIds.some(id => sameId(id, item.orderId))));
    setErrors({});
  };

  const handleOrderEntryChange = (index: number, orderEntryQuantity: number) => {
    const next = [...items];
    next[index] = { ...next[index], orderEntryQuantity };
    setItems(next);
    setErrors(previous => {
      const remainingErrors = { ...previous };
      delete remainingErrors[`orderEntry-${index}`];
      delete remainingErrors.items;
      return remainingErrors;
    });
  };

  const getItemOrderType = (item: TransportItem): 'SALES ORDER' | 'PURCHASE ORDER' | undefined => {
    const apiType = item.orderType?.toLowerCase();
    if (apiType?.includes('sales')) return 'SALES ORDER';
    if (apiType?.includes('purchase')) return 'PURCHASE ORDER';
    return undefined;
  };
  const orderTypeById = new Map(contractOrdersForCommodity.map(order => [order.id.trim(), order.type]));
  const findOrderForItem = (orderId: string) => contractOrdersForCommodity.find(order => sameId(order.id, orderId));
  const getRemaining = (item: TransportItem, order?: typeof contractOrdersForCommodity[number]) => {
    const originalItem = existingTransport?.items.find(original => sameId(original.orderId, item.orderId));
    const itemWasChanged = item.id !== undefined && existingTransport?.items.some(original =>
      original.id === item.id && !sameId(original.orderId, item.orderId)
    );
    const remaining = order?.remQuantity !== undefined
      ? convertQuantityUnit(order.remQuantity, order.remQuantityUnit || 'mt', formData.grossWeightUnit)
      : item.orderSizeRemaining === undefined || itemWasChanged
      ? undefined
      : convertQuantityUnit(
        item.orderSizeRemaining,
        item.orderSizeUnit || 'mt',
        formData.grossWeightUnit
      );
    if (remaining === undefined) return undefined;

    const originalEntry = originalItem
      ? convertQuantityUnit(
        Number(originalItem.orderEntryQuantity) || 0,
        existingTransport?.grossWeightUnit || 'quintal',
        formData.grossWeightUnit
      )
      : 0;
    return remaining + (originalEntry - (Number(item.orderEntryQuantity) || 0));
  };
  const getOrderType = (item: TransportItem): 'SALES ORDER' | 'PURCHASE ORDER' | undefined => {
    const normalizedId = String(item.orderId).trim();
    const directMatch = orderTypeById.get(normalizedId);
    if (directMatch) return directMatch;
    const lookedUpType = findOrderForItem(item.orderId)?.type;
    return lookedUpType === 'SALES ORDER' || lookedUpType === 'PURCHASE ORDER'
      ? lookedUpType
      : getItemOrderType(item);
  };
  const salesAllocated = items.reduce((sum, item) => {
    return getOrderType(item) === 'SALES ORDER' ? sum + (Number(item.allocatedQuantity) || 0) : sum;
  }, 0);
  const purchaseAllocated = items.reduce((sum, item) => {
    return getOrderType(item) === 'PURCHASE ORDER' ? sum + (Number(item.allocatedQuantity) || 0) : sum;
  }, 0);
  const hasSalesItems = items.some(item => getOrderType(item) === 'SALES ORDER');
  const hasPurchaseItems = items.some(item => getOrderType(item) === 'PURCHASE ORDER');
  const renderAllocationGroup = (orderType: 'SALES ORDER' | 'PURCHASE ORDER') => {
    const orderOptions = orderType === 'SALES ORDER' ? salesOrdersForCommodity : purchaseOrdersForCommodity;
    const groupItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => getOrderType(item) === orderType);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-800">{orderType === 'SALES ORDER' ? 'Sales Orders' : 'Purchase Orders'}</h3>
          <button
            type="button"
            disabled={formData.orderless}
            onClick={() => handleAddItem(orderType)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
                  <th className="min-w-[360px] px-3 py-2">Order</th>
                  <th className="px-3 py-2 text-right">Remaining ({getWeightUnitLabel(formData.grossWeightUnit)})</th>
                  <th className="px-3 py-2 text-right">Allocated</th>
                  <th className="px-3 py-2 text-right min-w-[130px]">Order Entry ({getWeightUnitLabel(formData.grossWeightUnit)})</th>
                  <th className="px-3 py-2 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupItems.map(({ item, index }) => {
                  const order = findOrderForItem(item.orderId);
                  const remaining = getRemaining(item, order);
                  const getFullOrderLabel = (selectedOrder: typeof order) => selectedOrder
                    ? `${selectedOrder.orderNumber}${selectedOrder.selectorClientName ? ` (${selectedOrder.selectorClientName})` : ''} · ${formatQuantityWithUnit(selectedOrder.quantity, selectedOrder.remQuantityUnit || selectedOrder.unit)} · ${formatCurrency(selectedOrder.rate)} / ${getRateUnitLabel(selectedOrder.remQuantityUnit || selectedOrder.unit)} · ${selectedOrder.brokerName || 'Direct'}`
                    : item.orderNumber || item.orderId;
                  return (
                  <tr key={item.id ?? `${orderType}-${index}`}>
                    <td className="min-w-[360px] px-3 py-2">
                      {formData.orderless ? (
                        <span className="text-xs text-slate-700">{getFullOrderLabel(order)}</span>
                      ) : (
                        <SearchableSelect
                        id={`transport-${orderType === 'SALES ORDER' ? 'sales' : 'purchase'}-order-${index}`}
                        value={item.orderId}
                        onChange={(orderId) => handleItemOrderChange(index, orderId)}
                        placeholder="Select order"
                        wrapOptions
                        portalOptions
                        options={[
                          ...(!orderOptions.some(option => sameId(option.id, item.orderId))
                            ? [{
                              id: item.orderId,
                              label: item.orderNumber || item.orderId,
                              highlightText: item.orderNumber || item.orderId
                            }]
                            : []),
                          ...orderOptions.map(option => ({
                            id: option.id,
                            label: getFullOrderLabel(option),
                            highlightText: option.orderNumber,
                            searchText: `${option.orderNumber} ${option.selectorClientName || ''} ${option.brokerName || 'Direct'}`
                          })).filter(option =>
                            sameId(option.id, item.orderId)
                            || !items.some((otherItem, otherIndex) =>
                              otherIndex !== index && sameId(otherItem.orderId, option.id)
                            )
                          )
                        ]}
                        />
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${remaining === undefined ? 'text-slate-600' : remaining <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {remaining === undefined ? '-' : formatQuantityWithUnit(remaining, formData.grossWeightUnit)}
                    </td>
                    <td className="px-3 py-2">
                      <DecimalInput
                        value={item.allocatedQuantity}
                        onChange={(quantity) => handleItemQuantityChange(index, quantity)}
                        className="w-[76px] text-xs border border-slate-300 rounded px-2 py-1.5 font-bold tabular-nums text-blue-700 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DecimalInput
                        value={item.orderEntryQuantity || 0}
                        onChange={(quantity) => handleOrderEntryChange(index, quantity)}
                        className="w-[110px] text-xs border border-slate-300 rounded px-2 py-1.5 tabular-nums text-slate-900 text-right"
                      />
                      {errors[`orderEntry-${index}`] && <p className="mt-1 text-left text-[10px] text-red-600">{errors[`orderEntry-${index}`]}</p>}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.billNumber.trim()) newErrors.billNumber = 'Bill number is required';
    if (!formData.vehicleNumber.trim()) newErrors.vehicleNumber = 'Vehicle number is required';
    if (!formData.loadingDate) newErrors.loadingDate = 'Loading date is required';
    if (!formData.billingFirmId) newErrors.billingFirmId = 'Billing firm is required';
    if (!formData.commodityId) newErrors.commodityId = 'Commodity is required';
    if (!formData.fromClientId) newErrors.fromClientId = 'Dispatch origin is required';
    if (!formData.toClientId) newErrors.toClientId = 'Consignee destination is required';
    if (formData.fromClientId === formData.toClientId) {
      newErrors.toClientId = 'Origin and destination cannot be the same';
    }
    if (formData.grossWeight <= 0) newErrors.grossWeight = 'Gross weight must be greater than zero';
    if (formData.rent < 0) newErrors.rent = 'Freight rent cannot be negative';

    if (items.length === 0 && !formData.orderless) {
      newErrors.items = 'Please allocate at least one order to this transport';
    } else if (items.length > 0 && hasSalesItems && hasPurchaseItems && (
      Math.abs(Number(formData.grossWeight) - salesAllocated) > 0.01 || Math.abs(Number(formData.grossWeight) - purchaseAllocated) > 0.01
    )) {
      newErrors.items = 'Sales and purchase allocation totals must each equal the gross loading weight';
    } else if (items.length > 0 && hasSalesItems && !hasPurchaseItems && Math.abs(Number(formData.grossWeight) - salesAllocated) > 0.01) {
      newErrors.items = 'Sales allocation total must equal the gross loading weight';
    } else if (items.length > 0 && hasPurchaseItems && !hasSalesItems && Math.abs(Number(formData.grossWeight) - purchaseAllocated) > 0.01) {
      newErrors.items = 'Purchase allocation total must equal the gross loading weight';
    }

    const duplicateOrder = items.find((item, index) =>
      items.some((otherItem, otherIndex) =>
        otherIndex !== index && sameId(otherItem.orderId, item.orderId)
      )
    );
    if (duplicateOrder) {
      newErrors.items = 'Each order can only be attached once to a transport.';
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
      allocatedQuantity: Number(i.allocatedQuantity),
      orderEntryQuantity: Number(i.orderEntryQuantity) || 0
    }));

    let saveCompleted = false;
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
        transporterId: formData.transporterId || null,
        grossWeight: Number(formData.grossWeight),
        grossWeightUnit: formData.grossWeightUnit,
        bagNumbers: Number(formData.bagNumbers),
        bagWeight: Number(formData.bagWeight),
        anugya: formData.anugya,
        gatepass: formData.gatepass,
        orderless: formData.orderless,
        rent: Number(formData.rent),
        rentType: formData.rentType,
        advanceByClient: Number(formData.advanceByClient),
        advanceByFirm: Number(formData.advanceByFirm),
        finalPaid: Number(formData.finalPaid),
        extraPaid: Number(formData.extraPaid),
        shortage: Number(formData.shortage),
        unloadDate: formData.unloadDate || undefined,
        receivedWeight: Number(formData.receivedWeight),
        sourceWeightReceipt: formData.sourceWeightReceipt.trim(),
        destinationWeightReceipt: formData.destinationWeightReceipt.trim(),
        status: formData.status,
        items: sanitizedItems,
        notes: formData.notes.trim(),
        createdBy: currentUser?.name || ''
      };

      const lookups = { clients, commodities, orders: contractOrders, transporters };
      const files = { source: sourceReceiptFile, destination: destinationReceiptFile };
      const saved = existingTransport
        ? await transportsApi.update({ ...transportData, id: existingTransport.id }, files, lookups)
        : await transportsApi.add(transportData, files, lookups);

      saveCompleted = true;
      await refreshData();
      const savedTransport = await transportGet(saved.id);
      showToast(existingTransport ? 'Consignment updated' : 'Transport created successfully', 'success');
      navigate('transport-detail', { transportId: savedTransport.id });
    } catch (err: any) {
      showToast(
        saveCompleted
          ? `Transport saved, but failed to open its details: ${err.message || 'Please try again'}`
          : err.message || 'Failed to save transport',
        'error'
      );
    }
  };

  const bagCount = Number(formData.bagNumbers) || 0;
  const grossWeightKg = convertQuantityUnit(
    Number(formData.grossWeight) || 0,
    formData.grossWeightUnit,
    'kg'
  );
  const netWeightKg = grossWeightKg - (bagCount * (Number(formData.bagWeight) || 0)) / 1000;
  const netWeight = convertQuantityUnit(netWeightKg, 'kg', formData.grossWeightUnit);
  const bhartiKg = bagCount !== 0 ? netWeightKg / bagCount : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(returnPage, { transportId: editingTransportId })}
          className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {existingTransport ? `Edit Transport: ${existingTransport.vehicleNumber}` : 'Record New Transport Consignment'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Truck loading weight, bill details, waybill, and freight payments.
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
                placeholder="Enter vehicle number"
                className={`w-full text-xs border rounded-lg px-3 py-2 font-mono font-bold uppercase placeholder:normal-case text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none ${
                  errors.vehicleNumber ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {errors.vehicleNumber && (
                <p className="text-[10px] text-red-600 mt-1">{errors.vehicleNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bill Number *</label>
              <input
                type="text"
                required
                value={formData.billNumber}
                onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                placeholder="Enter bill number"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="transport-agency" className="block text-xs font-medium text-slate-700 mb-1">Transporter Agency</label>
              <SearchableSelect
                id="transport-agency"
                value={formData.transporterId}
                onChange={transporterId => setFormData({ ...formData, transporterId })}
                placeholder="Select or search transporter agency"
                highlightFirstMatch
                options={[
                  { id: '', label: 'Direct Transport' },
                  ...agencyOptionsWithFallback.map(agency => ({
                    id: agency.id,
                    label: `${agency.name}${agency.agency && agency.agency !== agency.name ? ` (${agency.agency})` : ''}`,
                    searchText: `${agency.agency || ''} ${agency.city || ''} ${agency.phone || agency.phone_number || ''}`
                  }))
                ]}
              />
            </div>

            <div>
              <label htmlFor="transport-loading-date" className="block text-xs font-medium text-slate-700 mb-1">Loading Date *</label>
              <TransportDateInput
                id="transport-loading-date"
                value={formData.loadingDate}
                onChange={loadingDate => setFormData({ ...formData, loadingDate })}
                required
              />
              {errors.loadingDate && (
                <p className="text-[10px] text-red-600 mt-1">{errors.loadingDate}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label htmlFor="transport-billing-firm" className="block text-xs font-medium text-slate-700 mb-1">Billing Entity (My Firm) *</label>
              <SearchableSelect
                id="transport-billing-firm"
                value={formData.billingFirmId}
                onChange={(billingFirmId) => setFormData({ ...formData, billingFirmId })}
                placeholder="Select or search billing firm"
                highlightFirstMatch
                options={billingFirmOptions.map(firm => ({
                  id: firm.id,
                  label: `${firm.name}${firm.city ? ` (${firm.city})` : ''}`,
                  searchText: firm.city
                }))}
              />
            </div>

            <div>
              <label htmlFor="transport-commodity" className="block text-xs font-medium text-slate-700 mb-1">Commodity *</label>
              <SearchableSelect
                id="transport-commodity"
                value={formData.commodityId}
                onChange={handleCommodityChange}
                placeholder="Select or search commodity"
                highlightFirstMatch
                options={commodityOptions.map(commodity => ({
                  id: commodity.id,
                  label: `${commodity.name} (${commodity.type})`,
                  searchText: commodity.type
                }))}
              />
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
              <label htmlFor="transport-loading-origin" className="block text-xs font-medium text-slate-700 mb-1">Loading Origin (From Client / Godown) *</label>
              <SearchableSelect
                id="transport-loading-origin"
                value={formData.fromClientId}
                onChange={(fromClientId) => setFormData({ ...formData, fromClientId })}
                placeholder="Select or search loading origin"
                highlightFirstMatch
                options={locationOptions.map(location => ({
                  id: location.id,
                  label: `${location.name}${location.city ? ` (${location.city})` : ''}`,
                  searchText: `${location.city || ''} ${location.clientType || ''}`
                }))}
              />
            </div>

            <div>
              <label htmlFor="transport-unloading-destination" className="block text-xs font-medium text-slate-700 mb-1">Unloading Destination (To Consignee) *</label>
              <SearchableSelect
                id="transport-unloading-destination"
                value={formData.toClientId}
                onChange={(toClientId) => setFormData({ ...formData, toClientId })}
                placeholder="Select or search unloading destination"
                highlightFirstMatch
                options={locationOptions.map(location => ({
                  id: location.id,
                  label: `${location.name}${location.city ? ` (${location.city})` : ''}`,
                  searchText: `${location.city || ''} ${location.clientType || ''}`
                }))}
              />
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
              <DecimalInput
                required
                value={formData.grossWeight}
                onChange={handleGrossWeightChange}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-bold tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              {errors.grossWeight && (
                <p className="text-[10px] text-red-600 mt-1">{errors.grossWeight}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bag Count</label>
              <DecimalInput
                value={formData.bagNumbers}
                onChange={(bagNumbers) => setFormData({ ...formData, bagNumbers })}
                placeholder="500 bags"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Weight of Each Bag (grams)</label>
              <DecimalInput
                value={formData.bagWeight}
                onChange={(bagWeight) => setFormData({ ...formData, bagWeight })}
                placeholder="50000 grams"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <select
                aria-label="Gross loading weight unit"
                value={formData.grossWeightUnit}
                onChange={(e) => handleGrossWeightUnitChange(e.target.value as QuantityUnit)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              >
                <option value="mt">Metric Ton (MT)</option>
                <option value="quintal">Quintal</option>
                <option value="kg">Kilogram (KG)</option>
              </select>
            </div>

            <div>
              <input
                type="text"
                readOnly
                aria-label="Net Weight"
                value={`Net Weight: ${formatQuantityWithUnit(netWeight, formData.grossWeightUnit)}`}
                className={`w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums bg-slate-50 ${
                  netWeight < 0 ? 'text-red-600' : 'text-slate-700'
                }`}
              />
            </div>

            <div>
              <input
                type="text"
                readOnly
                aria-label="Bharti"
                value={`Bharti: ${bhartiKg !== null && Number.isFinite(bhartiKg)
                  ? `${bhartiKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Kg`
                  : '-'}`}
                className={`w-full text-xs border border-slate-300 rounded-lg px-3 py-2 tabular-nums bg-slate-50 ${
                  bhartiKg !== null && bhartiKg < 0 ? 'text-red-600' : 'text-slate-700'
                }`}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Order Allocation</h2>
              <p className="text-[11px] text-slate-500 mt-1">
                {formData.orderless
                  ? 'Adding or changing orders is disabled. Existing allocations can still be removed.'
                  : "When both order types are attached, each type's allocation total must equal gross weight."}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <span>Orderless Transport</span>
              <input
                type="checkbox"
                role="switch"
                checked={formData.orderless}
                onChange={event => {
                  setFormData(previous => ({ ...previous, orderless: event.target.checked }));
                  setErrors(previous => {
                    const { items: _itemsError, ...remainingErrors } = previous;
                    return remainingErrors;
                  });
                }}
                className="peer sr-only"
              />
              <span aria-hidden="true" className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2">
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${formData.orderless ? 'translate-x-5' : ''}`} />
              </span>
            </label>
          </div>

          <div className={`space-y-5 ${formData.orderless ? 'rounded-lg border border-slate-200 bg-slate-100 p-3' : ''}`}>
            {renderAllocationGroup('SALES ORDER')}
            <div className="border-t border-slate-200" />
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
              <DecimalInput
                required
                value={formData.rent}
                onChange={(rent) => setFormData({ ...formData, rent })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Advance Paid by Firm (₹)</label>
              <DecimalInput
                value={formData.advanceByFirm}
                onChange={(advanceByFirm) => setFormData({ ...formData, advanceByFirm })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Advance Paid by Party / Hammali (₹)</label>
              <DecimalInput
                value={formData.advanceByClient}
                onChange={(advanceByClient) => setFormData({ ...formData, advanceByClient })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Extra (₹)</label>
              <DecimalInput
                value={formData.extraPaid}
                onChange={(extraPaid) => setFormData({ ...formData, extraPaid })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Shortage (₹)</label>
              <DecimalInput
                value={formData.shortage}
                onChange={(shortage) => setFormData({ ...formData, shortage })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono tabular-nums text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block min-h-8 text-xs font-medium text-slate-700 mb-1">Final Settled Paid (₹)</label>
              <DecimalInput
                value={formData.finalPaid}
                onChange={(finalPaid) => setFormData({ ...formData, finalPaid })}
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
              <label htmlFor="transport-unload-date" className="block text-xs font-medium text-slate-700 mb-1">Unload Date</label>
              <TransportDateInput
                id="transport-unload-date"
                value={formData.unloadDate}
                onChange={unloadDate => setFormData({ ...formData, unloadDate })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Received Weight (MT at Gate)</label>
              <DecimalInput
                value={formData.receivedWeight}
                onChange={(receivedWeight) => setFormData({ ...formData, receivedWeight })}
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
            onClick={() => navigate(returnPage, { transportId: editingTransportId })}
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
