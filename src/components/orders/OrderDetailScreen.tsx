import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import {
  ArrowLeft,
  Truck,
  ArrowRight,
  Calendar,
  Edit,
  Building,
  User,
  ExternalLink,
  Clock,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { OrderProgressBar } from '../common/OrderProgressBar';
import { formatCurrency, formatQuantityWithUnit, getUnitLabel, formatDate, getDaysRemaining, getTransportStatusBadge } from '../../utils/formatters';

export const OrderDetailScreen: React.FC = () => {
  const {
    commodities,
    clients,
    brokers,
    transporters,
    transports,
    pageParams,
    navigate,
    currentUser,
    orderGet,
    showToast
  } = useApp();

  const isLabour = currentUser?.role === 'LABOUR';
  const orderId = pageParams.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retrySequence, setRetrySequence] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoadError('Order ID is missing.');
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setOrder(null);
    setIsLoading(true);
    setLoadError('');

    orderGet(orderId)
      .then(fetchedOrder => {
        if (isCurrent) setOrder(fetchedOrder);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load order');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [orderGet, orderId, retrySequence]);

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
  const commodityMap = useMemo(() => new Map(commodities.map(c => [c.id, c])), [commodities]);
  const brokerMap = useMemo(() => new Map(brokers.map(b => [b.id, b.name])), [brokers]);
  const transporterMap = useMemo(() => new Map(transporters.map(t => [t.id, t.name])), [transporters]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-slate-200 text-slate-500">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading order details...
        </span>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
        <p className="text-slate-600 font-medium">{loadError || 'Order not found or has been removed.'}</p>
        <div className="mt-3 flex justify-center gap-2">
          {orderId && (
            <button
              type="button"
              onClick={() => setRetrySequence(sequence => sequence + 1)}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('orders')}
            className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Return to Orders
          </button>
        </div>
      </div>
    );
  }

  const comm = commodityMap.get(order.commodityId);
  const fromClient = clientMap.get(order.fromClientId) || order.fromClientId || 'Unknown Source';
  const toClient = clientMap.get(order.toClientId) || order.toClientId || 'Unknown Destination';
  const brokerName = brokerMap.get(order.brokerId) || order.brokerId || 'Direct (No Broker)';
  const remaining = Math.max(0, order.quantity - order.quantityFulfilled);
  const totalValue = order.quantity * order.rate;
  const daysMeta = getDaysRemaining(order.expiryDate);

  const relatedTransports = order.orderTransports ?? transports
    .filter(t => t.items.some(item => item.orderId === order.id))
    .map(t => ({
      id: t.id,
      billNumber: t.billNumber,
      loadingDate: t.loadingDate,
      unloadDate: t.unloadDate,
      vehicleNumber: t.vehicleNumber,
      transporterName: transporterMap.get(t.transporterId) || '-',
      grossWeightUnit: t.grossWeightUnit || 'mt',
      grossWeight: t.grossWeight,
      orderEntryQuantity: t.items.find(item => item.orderId === order.id)?.orderEntryQuantity
        ?? t.items.find(item => item.orderId === order.id)?.allocatedQuantity
        ?? 0,
      status: t.status
    }));

  const convertTransportWeightToOrderUnit = (quantity: number, fromUnit: string): number => {
    const metricTons = fromUnit === 'kg' ? quantity / 1000 : fromUnit === 'quintal' ? quantity / 10 : quantity;
    if (order.unit === 'kg') return metricTons * 1000;
    if (order.unit === 'quintal') return metricTons * 10;
    return metricTons;
  };
  const totalDispatchedQuantity = relatedTransports.reduce(
    (sum, transport) => sum + convertTransportWeightToOrderUnit(transport.grossWeight, transport.grossWeightUnit),
    0
  );

  const handleEditOrder = async () => {
    setIsLoadingEdit(true);
    try {
      await orderGet(order.id);
      navigate('order-form', { orderId: order.id });
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Failed to load order details', 'error');
    } finally {
      setIsLoadingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Back button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('orders')}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-slate-900">{order.orderNumber}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                  order.type === 'SALES ORDER'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {order.type}
              </span>
              <span
               className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                  order.status === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : order.status === 'DRAFT'
                    ? 'bg-slate-100 text-slate-700 border border-slate-300'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {order.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Contract Date: {formatDate(order.contractDate || order.startDate)} · Valid until: {formatDate(order.expiryDate)}
            </p>
          </div>
        </div>

        {!isLabour && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => void handleEditOrder()}
              disabled={isLoadingEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
            >
              {isLoadingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit className="w-3.5 h-3.5" />}
              {isLoadingEdit ? 'Loading...' : 'Edit Order'}
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract Quantity</span>
          <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
            {formatQuantityWithUnit(order.quantity, order.unit)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Agreed volume ({getUnitLabel(order.unit)})</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fulfilled Quantity</span>
          <div className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">
            {formatQuantityWithUnit(order.quantityFulfilled, order.unit)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {Math.round((order.quantityFulfilled / order.quantity) * 100)}% completed
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Unfulfilled</span>
          <div className={`mt-1 text-lg font-bold tabular-nums ${remaining > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {formatQuantityWithUnit(remaining, order.unit)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Balance required</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract Rate</span>
          <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums font-mono">
            {formatCurrency(order.rate)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Per {getUnitLabel(order.unit)}</div>
        </div>


      </div>

      {/* Progress & Route Information Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Details & Route */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Lifting & Fulfillment Progress
            </h3>
            <OrderProgressBar
              fulfilled={order.quantityFulfilled}
              total={order.quantity}
              unit={order.unit}
              size="lg"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px] block mb-1">
                Dispatch Origin (From Client)
              </span>
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <span className="font-semibold text-slate-800 text-sm">{fromClient}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px] block mb-1">
                Destination Consignee (To Client)
              </span>
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <span className="font-semibold text-slate-800 text-sm">{toClient}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-semibold text-[10px] uppercase block">Commodity Spec</span>
              <div className="font-medium text-slate-900 mt-0.5">{comm?.name || order.commodityName || 'Standard'}</div>
              <div className="text-[11px] text-slate-500">{comm?.type || order.commodityType || '-'}</div>
            </div>

            <div>
              <span className="text-slate-400 font-semibold text-[10px] uppercase block">Broker / Dalal</span>
              <div className="font-medium text-slate-900 mt-0.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {brokerName}
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-semibold text-[10px] uppercase block">Validity Horizon</span>
              <div className="font-medium text-slate-900 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(order.expiryDate)}
              </div>
              <div className="text-[11px]">
                {daysMeta.isExpired ? (
                  <span className="text-red-600 font-medium">Expired</span>
                ) : (
                  <span className="text-amber-700 font-medium">{daysMeta.days} days remaining</span>
                )}
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 font-semibold text-[10px] uppercase block mb-1">
                Contract Terms & Notes
              </span>
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                "{order.notes}"
              </p>
            </div>
          )}
        </div>

        {/* Right Col: Logistics Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-blue-600" />
              Fleet Deployment Summary
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Trucks Dispatched:</span>
                <span className="font-bold text-slate-900 tabular-nums">{relatedTransports.length} vehicles</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Gross Weight Dispatched:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatQuantityWithUnit(totalDispatchedQuantity, order.unit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: TRANSPORTS FOR THIS ORDER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Transports Dispatched For This Order ({relatedTransports.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Individual truck consignments fulfilling this contract allocation.
            </p>
          </div>

        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-2 py-2">Loading Date</th>
                <th className="px-2 py-2">Bill No</th>
                <th className="px-2 py-2">Vehicle Number</th>
                <th className="px-2 py-2 pr-0">Transporter</th>
                <th className="px-2 py-2 pl-0 text-right">Gross Wt ({order.unit === 'quintal' ? 'QTL' : order.unit === 'kg' ? 'KG' : 'MT'})</th>
                <th className="px-2 py-2 pr-4 text-right">Order Entry ({order.unit === 'quintal' ? 'QTL' : order.unit === 'kg' ? 'KG' : 'MT'})</th>
                <th className="px-2 py-2 pl-4">Unload Date</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relatedTransports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No transport entries have been allocated to this order yet.
                  </td>
                </tr>
              ) : (
                relatedTransports.map((t) => {
                  const badge = getTransportStatusBadge(t.status.toUpperCase());
                  const transporterName = t.transporterName || '-';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-2 py-2 text-slate-600 tabular-nums">
                        {formatDate(t.loadingDate)}
                      </td>
                      <td className="px-2 py-2 font-mono font-medium text-slate-900">
                        {t.billNumber}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-mono font-bold text-slate-900">{t.vehicleNumber}</div>
                      </td>
                      <td className="px-2 py-2 pr-0 text-slate-700" title={transporterName}>
                        {transporterName.length > 16 ? `${transporterName.slice(0, 16)}...` : transporterName}
                      </td>
                      <td className="px-2 py-2 pl-0 text-right font-semibold text-blue-700 tabular-nums">
                        {formatQuantityWithUnit(convertTransportWeightToOrderUnit(t.grossWeight, t.grossWeightUnit), order.unit)}
                      </td>
                      <td className="px-2 py-2 pr-4 text-right tabular-nums text-slate-700">
                        {formatQuantityWithUnit(convertTransportWeightToOrderUnit(t.orderEntryQuantity, t.grossWeightUnit), order.unit)}
                      </td>
                      <td className="px-2 py-2 pl-4 text-slate-600 tabular-nums">
                        {formatDate(t.unloadDate)}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => navigate('transport-detail', { transportId: t.id })}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="View Consignment"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
