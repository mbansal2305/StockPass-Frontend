import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building2, Calendar, Edit2, Layers, Loader2, Trash2, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BulkTransportDetail, transportsApi } from '../../api';
import { formatDate, formatQuantityWithUnit, getTransportStatusBadge } from '../../utils/formatters';
import { StatusStepper } from '../common/StatusStepper';
import { ConfirmationModal } from '../common/ConfirmationModal';

export const BulkTransportDetailScreen: React.FC = () => {
  const { pageParams, navigate, clients, commodities, orders, transporters, refreshData, showToast } = useApp();
  const lookupsRef = useRef({ clients, commodities, orders, transporters });
  lookupsRef.current = { clients, commodities, orders, transporters };
  const bulkTransportId = pageParams.bulkTransportId ? String(pageParams.bulkTransportId) : '';
  const [bulk, setBulk] = useState<BulkTransportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeSourceId, setActiveSourceId] = useState('');

  useEffect(() => {
    if (!bulkTransportId) {
      setError('Bulk transport not found.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    transportsApi.getBulk(bulkTransportId, lookupsRef.current)
      .then(result => {
        if (!cancelled) {
          setBulk(result);
          const sources = [...new Set([
            ...result.selectedSources,
            ...result.transports.map(transport => transport.fromClientId).filter(Boolean)
          ])];
          setActiveSourceId(sources[0] || '');
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Unable to load bulk transport');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [bulkTransportId]);

  const clientMap = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients]);
  const commodityMap = useMemo(() => new Map(commodities.map(commodity => [commodity.id, commodity])), [commodities]);
  const transporterMap = useMemo(() => new Map(transporters.map(transporter => [transporter.id, transporter])), [transporters]);

  const confirmDelete = async () => {
    if (!bulk || deleting) return;
    setDeleting(true);
    try {
      await transportsApi.deleteBulk(bulk.id);
      await refreshData();
      showToast(`Deleted bulk transport ${bulk.title}`, 'success');
      navigate('bulk-transport-list');
    } catch (deleteError: unknown) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Failed to delete bulk transport', 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading bulk transport...
      </div>
    );
  }

  if (error || !bulk) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-medium text-slate-600">{error || 'Bulk transport not found.'}</p>
        <button type="button" onClick={() => navigate('bulk-transport-list')} className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          Return to Bulk Transport List
        </button>
      </div>
    );
  }

  const firstTransport = bulk.transports[0];
  const unit = firstTransport?.grossWeightUnit || 'mt';
  const destination = clientMap.get(bulk.toClientId || firstTransport?.toClientId || '');
  const billingFirm = clientMap.get(bulk.billingFirmId || firstTransport?.billingFirmId || '');
  const transporter = transporterMap.get(bulk.transporterId || firstTransport?.transporterId || '');
  const commodity = commodityMap.get(bulk.commodityId || firstTransport?.commodityId || '');
  const order = orders.find(item => item.id === bulk.orderId);
  const grossTotal = bulk.transports.reduce((total, transport) => total + (transport.grossWeight || 0), 0);
  const receivedTotal = bulk.totalReceivedWeight ?? bulk.transports.reduce((total, transport) => total + (transport.receivedWeight || 0), 0);
  const bagTotal = bulk.transports.reduce((total, transport) => total + (transport.bagNumbers || 0), 0);
  const receivedWeightDiff = grossTotal - receivedTotal;
  const badge = getTransportStatusBadge(bulk.status || firstTransport?.status || 'PENDING');
  const sourceIds = [...new Set([
    ...bulk.selectedSources,
    ...bulk.transports.map(transport => transport.fromClientId).filter(Boolean)
  ])];
  const sourceLocations = sourceIds.map(sourceId => ({
    id: sourceId,
    name: clientMap.get(sourceId)?.name || bulk.transports.find(transport => transport.fromClientId === sourceId)?.fromClientName || sourceId,
    transports: bulk.transports.filter(transport => transport.fromClientId === sourceId)
  }));
  const activeTransports = sourceLocations.find(source => source.id === activeSourceId)?.transports || [];
  const commodityType = commodity?.type || firstTransport?.commodityType;
  const commodityName = commodity?.name || firstTransport?.commodityName;
  const createdBy = bulk.createdBy || firstTransport?.createdBy;
  const createdAt = bulk.createdAt || firstTransport?.createdAt;
  const createdDate = createdAt?.includes('T') ? createdAt.slice(0, 10) : createdAt;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate('bulk-transport-list')} aria-label="Back to bulk transports" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-slate-900">{bulk.billNumber || 'Bulk Transport'}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-teal-800">
                <Layers className="h-2.5 w-2.5" aria-hidden="true" />
                Bulk
              </span>
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Created by <span className="font-medium text-slate-700">{createdBy || '-'}</span>
              {' '}on {formatDate(createdDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button type="button" onClick={() => navigate('bulk-transport', { bulkTransportId: bulk.id, returnTo: 'bulk-transport-list' })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={() => setDeleteOpen(true)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700" title="Delete bulk transport">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bulk Dispatch Lifecycle</span>
          <span className="text-xs text-slate-500">{bulk.transports.length} vehicles</span>
        </div>
        <StatusStepper currentStatus={bulk.status || firstTransport?.status || 'PENDING'} canChangeStatus={false} onStatusClick={() => undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-3.5 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-900">
            <Truck className="h-4 w-4 text-blue-600" /> Route & Dispatch
          </h2>
          <div className="space-y-2.5 text-xs">
            <div><span className="block text-[10px] font-semibold uppercase text-emerald-700">Destination</span><div className="mt-0.5 text-sm font-bold text-slate-900">{destination?.name || firstTransport?.toClientName || '-'}</div>{destination?.city && <div className="text-[11px] text-slate-500">{destination.city}</div>}</div>
            <div className="border-t border-slate-100 pt-2"><span className="block text-[10px] font-semibold uppercase text-slate-400">Billing Firm</span><span className="mt-0.5 inline-flex items-center gap-1 font-semibold text-violet-700"><Building2 className="h-3 w-3" />{billingFirm?.name || firstTransport?.billingFirmName || '-'}</span></div>
            <div className="border-t border-slate-100 pt-2"><span className="block text-[10px] font-semibold uppercase text-slate-400">Transporter</span><span className="mt-0.5 inline-flex items-center gap-1 font-semibold text-blue-700"><Truck className="h-3 w-3" />{transporter?.name || firstTransport?.transporterName || 'Direct Transport'}</span></div>
            <div className="border-t border-slate-100 pt-2"><span className="block text-[10px] font-semibold uppercase text-slate-400">Commodity</span><div className="font-medium text-slate-800">{commodityName || '-'}{commodityType ? ` (${commodityType})` : ''}</div></div>
          </div>
        </div>

        <div className="space-y-3.5 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-900">
            <Calendar className="h-4 w-4 text-blue-600" /> Schedule & Batch
          </h2>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Loading Date</span><span className="font-medium text-slate-800">{formatDate(bulk.loadingDate || firstTransport?.loadingDate)}</span></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Unload Date</span><span className="font-medium text-slate-800">{formatDate(bulk.unloadingDate || firstTransport?.unloadDate)}</span></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Bill Number</span><span className="font-mono font-semibold text-slate-800">{bulk.billNumber || '-'}</span></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Order</span><button type="button" onClick={() => bulk.orderId && navigate('order-detail', { orderId: bulk.orderId })} className="font-semibold text-blue-700 hover:underline">{order?.orderNumber || bulk.orderId || '-'}</button></div>
          </div>
        </div>

        <div className="space-y-3.5 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-900">
            <Layers className="h-4 w-4 text-blue-600" /> Weights & Vehicles
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Vehicles</span><span className="font-bold tabular-nums text-slate-900">{bulk.transports.length}</span></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Gross Loading Weight</span><span className="font-bold tabular-nums text-slate-900">{formatQuantityWithUnit(grossTotal, unit)}</span></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Received Weight</span><span className="font-bold tabular-nums text-slate-900">{formatQuantityWithUnit(receivedTotal, unit)}</span></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Total Bags</span><span className="font-medium tabular-nums text-slate-800">{bagTotal || '-'}</span></div>
          </div>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold uppercase text-slate-900">Vehicles in this Bulk Transport ({bulk.transports.length})</h2>
        </div>
        {sourceLocations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100" role="tablist" aria-label="Source location vehicle lists">
            {sourceLocations.map(source => (
              <button
                key={source.id}
                type="button"
                role="tab"
                aria-selected={activeSourceId === source.id}
                onClick={() => setActiveSourceId(source.id)}
                className={`border-b-2 px-3 py-2 text-xs font-semibold cursor-pointer ${activeSourceId === source.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
              >
                {source.name} <span className="text-slate-400">({source.transports.length})</span>
              </button>
            ))}
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Origin</th>
                <th className="px-4 py-3 text-right">Gross Weight</th>
                <th className="px-4 py-3 text-right">Bags</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTransports.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No vehicles found in this source location.</td></tr>
              ) : activeTransports.map(transport => {
                const origin = clientMap.get(transport.fromClientId);
                const vehicleBadge = getTransportStatusBadge(transport.status);
                return (
                  <tr key={transport.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono font-bold text-sky-800">
                        {transport.vehicleNumber || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{origin?.name || transport.fromClientName || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatQuantityWithUnit(transport.grossWeight, transport.grossWeightUnit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{transport.bagNumbers || '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{transport.receivedWeight ? formatQuantityWithUnit(transport.receivedWeight, transport.grossWeightUnit) : 'Pending'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded border px-2 py-1 text-[10px] font-semibold ${vehicleBadge.bg} ${vehicleBadge.text} ${vehicleBadge.border}`}>{vehicleBadge.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-lg bg-slate-900 p-5 text-white">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-200"><Truck className="h-4 w-4 text-blue-300" />Dispatch Summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div><span className="block text-[10px] uppercase text-slate-400">Total vehicles</span><strong className="text-lg tabular-nums">{bulk.transports.length}</strong></div>
          <div><span className="block text-[10px] uppercase text-slate-400">Total gross allocation</span><strong className="text-lg tabular-nums">{formatQuantityWithUnit(grossTotal, unit)}</strong></div>
          <div><span className="block text-[10px] uppercase text-slate-400">Total bags</span><strong className="text-lg tabular-nums">{bagTotal}</strong></div>
          <div><span className="block text-[10px] uppercase text-slate-400">Total received weight</span><strong className="text-lg tabular-nums">{formatQuantityWithUnit(receivedTotal, unit)}</strong></div>
          <div><span className="block text-[10px] uppercase text-slate-400">Gross - Received</span><strong className="text-lg tabular-nums text-red-300">{formatQuantityWithUnit(receivedWeightDiff, unit)}</strong></div>
        </div>
        {sourceLocations.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="bg-slate-800 text-slate-300"><tr><th className="px-3 py-2">Source location</th><th className="px-3 py-2 text-right">Vehicles</th><th className="px-3 py-2 text-right">Gross</th><th className="px-3 py-2 text-right">Bags</th></tr></thead>
              <tbody className="divide-y divide-slate-700">
                {sourceLocations.map(source => (
                  <tr key={source.id}>
                    <td className="px-3 py-2">{source.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{source.transports.length}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatQuantityWithUnit(source.transports.reduce((sum, transport) => sum + (transport.grossWeight || 0), 0), unit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{source.transports.reduce((sum, transport) => sum + (transport.bagNumbers || 0), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmationModal isOpen={deleteOpen} title="Delete Bulk Transport" message={`Delete ${bulk.title} and all ${bulk.transports.length} associated vehicle transports?`} confirmLabel={deleting ? 'Deleting...' : 'Delete'} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteOpen(false)} />
    </div>
  );
};
