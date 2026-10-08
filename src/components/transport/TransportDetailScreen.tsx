import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Transport, TransportStatus } from '../../types';
import { transportsApi } from '../../api';
import {
  ArrowLeft,
  Truck,
  Building,
  Calendar,
  FileText,
  Printer,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { StatusStepper } from '../common/StatusStepper';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { TransportPaymentBill } from './TransportPaymentBill';
import {
  formatCurrency,
  formatQuantityWithUnit,
  formatDate,
  getTransportStatusBadge
} from '../../utils/formatters';

const convertWeightUnit = (quantity: number, fromUnit: string, toUnit: string): number => {
  const metricTons = fromUnit === 'kg' ? quantity / 1000 : fromUnit === 'quintal' ? quantity / 10 : quantity;
  if (toUnit === 'kg') return metricTons * 1000;
  if (toUnit === 'quintal') return metricTons * 10;
  return metricTons;
};

const getShortUnitLabel = (unit?: string): string =>
  unit === 'quintal' ? 'Qtl' : unit === 'kg' ? 'Kg' : 'Mt';

const formatShortUnitQuantity = (quantity: number, unit?: string): string =>
  `${Number(quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${getShortUnitLabel(unit)}`;

const getOrderTypeLabel = (type?: string): string => {
  if (type?.toLowerCase() === 'sales_order') return 'Sales Order';
  if (type?.toLowerCase() === 'purchase_order') return 'Purchase Order';
  return type || 'Direct';
};

const displayFlag = (value: boolean | string | undefined): string => {
  if (typeof value === 'boolean') return value ? 'Available' : 'No';
  return value || 'No';
};

export const TransportDetailScreen: React.FC = () => {
  const {
    transports,
    orders,
    commodities,
    clients,
    transporters,
    pageParams,
    navigate,
    currentUser,
    refreshData,
    showToast,
    transportGet
  } = useApp();

  const isOwner = currentUser?.role === 'OWNER';
  const isLabour = currentUser?.role === 'LABOUR';
  const isAccountant = currentUser?.role === 'ACCOUNTANT';

  const transportId = pageParams.transportId;
  const transport = transports.find(t => t.id === transportId);

  // Status Change Confirmation
  const [pendingStatusTarget, setPendingStatusTarget] = useState<TransportStatus | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [paymentBillOpen, setPaymentBillOpen] = useState(false);

  // Lookups
  const commodityMap = useMemo(() => new Map(commodities.map(c => [c.id, c])), [commodities]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const transporterMap = useMemo(() => new Map(transporters.map(t => [t.id, t.name])), [transporters]);
  const orderMap = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);

  if (!transport) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
        <p className="text-slate-600 font-medium">Transport consignment not found.</p>
        <button
          onClick={() => navigate('transport')}
          className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          Return to Transport List
        </button>
      </div>
    );
  }

  const isPaidTransport = transport.status === 'PAID';
  const comm = commodityMap.get(transport.commodityId);
  const transpName = transporterMap.get(transport.transporterId) || '-';
  const fromClient = clientMap.get(transport.fromClientId);
  const toClient = clientMap.get(transport.toClientId);
  const billingFirm = clientMap.get(transport.billingFirmId);
  const badge = getTransportStatusBadge(transport.status);

  // Calculations
  const grossWeight = transport.grossWeight || 0;
  const receivedWeight = transport.receivedWeight || 0;
  const weightDifference = grossWeight - receivedWeight;
  const weightDifferenceInQuintals = convertWeightUnit(
    Math.abs(weightDifference),
    transport.grossWeightUnit || 'mt',
    'quintal'
  );
  const bhartiKg = transport.bagNumbers
    ? (
      convertWeightUnit(grossWeight, transport.grossWeightUnit || 'mt', 'kg')
      - transport.bagNumbers * ((transport.bagWeight || 0) / 1000)
    ) / transport.bagNumbers
    : null;
  const rentableWeight = receivedWeight > 0 ? Math.min(grossWeight, receivedWeight) : grossWeight;
  const calculatedRent = transport.rentType === 'fix'
    ? transport.rent
    : rentableWeight * transport.rent;
  const dues = calculatedRent
    - (transport.advanceByFirm || 0)
    - (transport.advanceByClient || 0)
    - (transport.shortage || 0)
    + (transport.extraPaid || 0)
    - (transport.finalPaid || 0);

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusTarget) return;
    if (transport.status === 'PAID' && !isOwner) {
      setPendingStatusTarget(null);
      return;
    }
    try {
      await transportsApi.updateStatus(transport.id, pendingStatusTarget);
      await transportGet(transport.id);
      showToast(`Status updated to ${pendingStatusTarget}`, 'success');
      setPendingStatusTarget(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to update transport status', 'error');
    }
  };

  const handleEdit = async () => {
    if (transport.status === 'PAID' && !isOwner) return;
    try {
      await transportGet(transport.id);
      navigate('transport-form', { transportId: transport.id });
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Failed to load transport details', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await transportsApi.delete(transport.id);
      await refreshData();
      setDeleteConfirmationOpen(false);
      showToast(`Transport consignment ${transport.billNumber} removed`, 'info');
      navigate('transport');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete transport', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('transport')}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-slate-900">{transport.vehicleNumber}</span>
              <span className="font-mono text-sm text-slate-500 font-medium">({transport.billNumber})</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {formatDate(transport.createdAt)} · Carrier: {transpName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPaymentBillOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            Print Bill
          </button>

          {(!isPaidTransport || isOwner) && (
            <button
              type="button"
              onClick={() => void handleEdit()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => setDeleteConfirmationOpen(true)}
              className="p-1.5 bg-white border border-slate-200 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs transition-colors cursor-pointer"
              title="Delete Consignment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* WORKFLOW STEPPER CARD */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Consignment Lifecycle Workflow
          </span>
          <span className="text-xs text-slate-500">
            Click step to change status (Requires permission)
          </span>
        </div>

        <StatusStepper
          currentStatus={transport.status}
          canChangeStatus={(!isPaidTransport || isOwner) && (!isLabour || transport.status === 'PENDING' || transport.status === 'DELIVERY')}
          onStatusClick={(nextStatus) => {
            if (nextStatus !== transport.status && (!isPaidTransport || isOwner)) {
              setPendingStatusTarget(nextStatus);
            }
          }}
        />

        {/* Quick Progression Prompt */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-600">
            Current stage: <strong className="text-slate-900">{transport.status}</strong>
            {transport.status === 'PENDING' && ' — Truck is loading at godown/mandi.'}
            {transport.status === 'DELIVERY' && ' — Truck is in transit to buyer/destination.'}
            {transport.status === 'FINANCE' && ' — Unloaded at destination; waiting for tare audit & payment.'}
            {transport.status === 'PAID' && ' — Freight settled in full.'}
          </div>

          <div className="flex items-center gap-2">
            {transport.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => setPendingStatusTarget('DELIVERY')}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                Mark In Delivery →
              </button>
            )}
            {transport.status === 'DELIVERY' && (
              <button
                type="button"
                onClick={() => setPendingStatusTarget('FINANCE')}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                Confirm Unload & Send to Finance →
              </button>
            )}
            {transport.status === 'FINANCE' && !isLabour && (
              <button
                type="button"
                onClick={() => setPendingStatusTarget('PAID')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                Approve Payment & Close →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Logistics & Route */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Truck className="w-4 h-4 text-blue-600" />
            Route & Dispatch Details
          </h3>

          <div className="text-xs space-y-2.5">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Origin (From)</span>
              <div className="font-semibold text-slate-800 text-sm">{fromClient?.name || '-'}</div>
              <div className="text-slate-500 text-[11px]">{fromClient?.city}</div>
            </div>

            <div className="pt-1">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Destination (To)</span>
              <div className="font-semibold text-slate-800 text-sm">{toClient?.name || '-'}</div>
              <div className="text-slate-500 text-[11px]">{toClient?.city}</div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Billing Firm</span>
              <div className="font-medium text-slate-800">{billingFirm?.name || '-'}</div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Commodity Spec</span>
              <div className="font-medium text-slate-800">{comm?.name || '-'} ({comm?.type})</div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Loading Date</span>
              <div className="font-medium text-slate-800">{formatDate(transport.loadingDate)}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Weights & Quantities */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Weights & Bag Count
          </h3>

          <div className="text-xs space-y-2.5">
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Gross Loading Weight:</span>
              <span className="font-bold text-slate-900 tabular-nums text-sm">
                {formatQuantityWithUnit(transport.grossWeight, transport.grossWeightUnit)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Bags / Packing:</span>
              <span className="font-medium text-slate-800 tabular-nums">
                {transport.bagNumbers ? `${transport.bagNumbers} bags` : '-'}
                {transport.bagWeight ? ` (@${transport.bagWeight} grams per bag)` : ''}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Bharti (kg):</span>
              <span className="font-medium text-slate-800 tabular-nums">
                {bhartiKg === null ? '-' : `${bhartiKg.toFixed(2)} kg`}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Received Weight (Unloading):</span>
              <span className="font-bold text-slate-900 tabular-nums text-sm">
                {receivedWeight ? formatQuantityWithUnit(receivedWeight, transport.grossWeightUnit) : 'Pending unload'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Difference (Gross - Received):</span>
              <span
                className={`font-semibold tabular-nums ${
                  weightDifferenceInQuintals > 1
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                {formatQuantityWithUnit(weightDifference, transport.grossWeightUnit)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>Unload Date:</span>
              <span className="font-medium text-slate-800">
                {transport.unloadDate ? formatDate(transport.unloadDate) : 'Yet to unload'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Freight & Finance Settlements */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Freight & Account Settlement
          </h3>

          <div className="text-xs space-y-2.5">
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Agreed Rent:</span>
              <span className="font-bold font-mono text-slate-900 tabular-nums text-sm">
                {formatCurrency(transport.rent)}
                {transport.rentType === 'fix' ? ' (fixed)' : ` / ${getShortUnitLabel(transport.grossWeightUnit)}`}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Total Rent:</span>
              <span className="font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(calculatedRent)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Advance Paid by Firm:</span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatCurrency(transport.advanceByFirm)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Advance by Client / Consignee:</span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatCurrency(transport.advanceByClient)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Shortage:</span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatCurrency(transport.shortage)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Extra:</span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatCurrency(transport.extraPaid)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Final Freight Paid:</span>
              <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                {formatCurrency(transport.finalPaid)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 bg-slate-50 px-2 rounded-lg">
              <span className="text-slate-600 font-semibold">Dues:</span>
              <span className={`font-mono font-bold tabular-nums ${dues <= 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(dues)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mandi Documents & Receipt Numbers */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Permits, Weighbridge Slips & Mandi Challans
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Mandi Anugya / Permit</span>
            <div className="font-mono font-semibold text-slate-800 text-sm mt-0.5">
              {displayFlag(transport.anugya)}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Gate Pass No</span>
            <div className="font-mono font-semibold text-slate-800 text-sm mt-0.5">
              {displayFlag(transport.gatepass)}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Source Weighbridge Slip</span>
            {transport.sourceWeightReceipt ? (
              <a
                href={transport.sourceWeightReceipt}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-block text-xs font-semibold text-blue-700 hover:underline"
              >
                View source receipt
              </a>
            ) : (
              <div className="mt-0.5 text-xs text-slate-500">Not attached</div>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Destination Unload Slip</span>
            {transport.destinationWeightReceipt ? (
              <a
                href={transport.destinationWeightReceipt}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-block text-xs font-semibold text-blue-700 hover:underline"
              >
                View destination receipt
              </a>
            ) : (
              <div className="mt-0.5 text-xs text-slate-500">Not attached</div>
            )}
          </div>
        </div>

        {transport.notes && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <strong>Consignment Notes:</strong> {transport.notes}
          </div>
        )}
      </div>

      {/* TRANSPORT ITEMS: ALLOCATED ORDERS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Order Allocations In This Transport ({transport.items.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Orders fulfilled by this vehicle consignment. Quantities are shown in {getShortUnitLabel(transport.grossWeightUnit)}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('transport-form', { transportId: transport.id, openItemAllocation: true })}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Manage Allocations
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Order No.</th>
                <th className="px-4 py-3">Order Type</th>
                <th className="px-4 py-3">Commodity</th>
                <th className="px-4 py-3 text-right">Order Qty</th>
                <th className="px-4 py-3 text-right">Order Rem</th>
                <th className="px-4 py-3 text-right">Alloc in this Truck</th>
                <th className="px-4 py-3 text-right">Order Entry</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transport.items.map((item, idx) => {
                const ord = orderMap.get(item.orderId);
                const itemCommodityName = item.orderCommodity || (ord ? commodityMap.get(ord.commodityId)?.name : comm?.name);
                const itemCommodityType = item.orderCommodityType || (ord ? commodityMap.get(ord.commodityId)?.type : comm?.type);
                const orderUnit = item.orderSizeUnit || ord?.unit || 'mt';
                const orderQuantity = item.orderSize === undefined
                  ? ord ? convertWeightUnit(ord.quantity, ord.unit || 'mt', transport.grossWeightUnit || 'mt') : undefined
                  : convertWeightUnit(item.orderSize, orderUnit, transport.grossWeightUnit || 'mt');
                const remainingQuantity = item.orderSizeRemaining === undefined
                  ? undefined
                  : convertWeightUnit(item.orderSizeRemaining, orderUnit, transport.grossWeightUnit || 'mt');
                const orderNumber = item.orderNumber || ord?.orderNumber || item.orderId;
                return (
                  <tr key={item.id ?? idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {item.orderId ? (
                        <button
                          type="button"
                          onClick={() => navigate('order-detail', { orderId: item.orderId })}
                          className="hover:text-blue-600 cursor-pointer"
                        >
                          {orderNumber}
                        </button>
                      ) : (
                        orderNumber
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {getOrderTypeLabel(item.orderType || ord?.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <div>{itemCommodityName || '-'}</div>
                      {itemCommodityType && <div className="text-[10px] text-slate-500">{itemCommodityType}</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {orderQuantity === undefined ? '-' : formatShortUnitQuantity(orderQuantity, transport.grossWeightUnit)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {remainingQuantity === undefined ? '-' : formatShortUnitQuantity(remainingQuantity, transport.grossWeightUnit)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700 tabular-nums">
                      {formatShortUnitQuantity(item.allocatedQuantity, transport.grossWeightUnit)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatShortUnitQuantity(item.orderEntryQuantity || 0, transport.grossWeightUnit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.orderId && (
                        <button
                          type="button"
                          onClick={() => navigate('order-detail', { orderId: item.orderId })}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="View Order"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {paymentBillOpen && (
        <TransportPaymentBill
          transport={transport}
          draft={{
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
          }}
          clients={clients}
          transporters={transporters}
          currentUser={currentUser}
          onClose={() => setPaymentBillOpen(false)}
        />
      )}

      {/* Advance Stage Modal */}
      <ConfirmationModal
        isOpen={!!pendingStatusTarget}
        title="Update Consignment Status"
        message={`Are you sure you want to transition vehicle ${transport.vehicleNumber} to "${pendingStatusTarget}"?`}
        confirmLabel="Confirm Status"
        variant="primary"
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setPendingStatusTarget(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={deleteConfirmationOpen}
        title="Delete Consignment"
        message={`Are you sure you want to delete transport ${transport.billNumber}? Allocated order quantities will be updated accordingly.`}
        confirmLabel="Yes, Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmationOpen(false)}
      />
    </div>
  );
};
