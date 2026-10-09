import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Layers, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { transportsApi, BulkTransportListItem, BulkTransportListPage } from '../../api';
import { useApp } from '../../context/AppContext';
import { formatDate, getTransportStatusBadge } from '../../utils/formatters';
import { ConfirmationModal } from '../common/ConfirmationModal';

const PAGE_SIZE = 10;

export const BulkTransportListScreen: React.FC = () => {
  const { navigate, showToast } = useApp();
  const [pageNumber, setPageNumber] = useState(1);
  const [pageData, setPageData] = useState<BulkTransportListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<BulkTransportListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    transportsApi.listBulk(pageNumber, PAGE_SIZE)
      .then(result => {
        if (!cancelled) setPageData(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Unable to load bulk transports');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [pageNumber, reloadKey]);

  const results = pageData?.results || [];
  const totalPages = Math.max(1, pageData?.totalPages || 1);

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await transportsApi.deleteBulk(deleteTarget.id);
      showToast(`Deleted bulk transport ${deleteTarget.title}`, 'success');
      setDeleteTarget(null);
      if (results.length === 1 && pageNumber > 1) setPageNumber(current => current - 1);
      else setReloadKey(key => key + 1);
    } catch (deleteError: unknown) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Failed to delete bulk transport', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Layers className="h-5 w-5 text-blue-600" />Bulk Transports</h1>
          <p className="mt-0.5 text-xs text-slate-500">Review bulk dispatch batches and vehicle counts.</p>
        </div>
        <button type="button" onClick={() => navigate('bulk-transport', { returnTo: 'bulk-transport-list' })} className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 sm:self-auto">
          <Plus className="h-3.5 w-3.5" />Add bulk transport
        </button>
      </header>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Dispatch batches</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{pageData ? `${pageData.total} total` : 'Loading records'}</p>
          </div>
          {error && <button type="button" onClick={() => setReloadKey(key => key + 1)} aria-label="Retry loading bulk transports" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><RefreshCw className="h-4 w-4" /></button>}
        </div>

        {error ? (
          <div role="alert" className="m-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Loading date</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Commodity</th>
                  <th className="px-3 py-2.5">Bill no.</th>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Billing firm</th>
                  <th className="px-3 py-2.5">Destination</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Vehicles</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Loading bulk transports...</td></tr>
                ) : results.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No bulk transport batches found.</td></tr>
                ) : results.map(item => {
                  const badge = getTransportStatusBadge(item.status.toUpperCase());
                  return (
                    <tr key={item.id} className="align-middle hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(item.loadingDate)}</td>
                      <td className="max-w-[260px] px-3 py-3 font-semibold text-slate-900"><span className="block truncate" title={item.title}>{item.title || '-'}</span></td>
                      <td className="px-3 py-3 text-slate-700">{item.commodity || '-'}</td>
                      <td className="px-3 py-3 font-mono text-slate-700">{item.billNumber || '-'}</td>
                      <td className="px-3 py-3 text-slate-700">{item.order || '-'}</td>
                      <td className="px-3 py-3 text-slate-700">{item.billingFirm || '-'}</td>
                      <td className="px-3 py-3 text-slate-700">{item.destination || '-'}</td>
                      <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-[10px] font-semibold ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span></td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{item.vehicleCount}</td>
                      <td className="px-3 py-3 text-center"><div className="flex items-center justify-center gap-1"><button type="button" title="Edit bulk transport" aria-label={`Edit ${item.title}`} onClick={() => navigate('bulk-transport', { bulkTransportId: item.id, returnTo: 'bulk-transport-list' })} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Edit2 className="h-4 w-4" /></button><button type="button" title="Delete bulk transport" aria-label={`Delete ${item.title}`} onClick={() => setDeleteTarget(item)} className="rounded p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500">Page {pageData?.page || pageNumber} of {totalPages}</p>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button type="button" disabled={loading || pageNumber <= 1} onClick={() => setPageNumber(current => Math.max(1, current - 1))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Previous</button>
            <button type="button" disabled={loading || pageNumber >= totalPages} onClick={() => setPageNumber(current => Math.min(totalPages, current + 1))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </footer>
      </section>
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Delete bulk transport batch?"
        message={`This permanently deletes ${deleteTarget?.title || 'this batch'} and its linked transports. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete batch'}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
};