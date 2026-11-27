import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpDown, Building2, ChevronLeft, ChevronRight, Edit2, Eye, Layers, MoreVertical, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { transportsApi, BulkTransportListItem, BulkTransportListPage } from '../../api';
import { useApp } from '../../context/AppContext';
import { formatDate, formatQuantityWithUnit } from '../../utils/formatters';
import { sortOptionalStrings } from '../../utils/sortOptionalStrings';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { shouldIgnoreShortcut } from '../common/keyboardShortcuts';

const PAGE_SIZE = 10;
type SortField = 'loadingDate' | 'billNumber' | 'unloadingDate';

const formatTransportListDate = (date: string | null | undefined): string =>
  formatDate(date).replace(/ (\d{4})$/, (_, year: string) => `'${year.slice(-2)}`);

export const BulkTransportListScreen: React.FC = () => {
  const { navigate, showToast, mobileMenuOpen } = useApp();
  const [pageNumber, setPageNumber] = useState(1);
  const [pageData, setPageData] = useState<BulkTransportListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<BulkTransportListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ field: SortField; ascending: boolean } | null>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcut(event) || deleteTarget || openActionMenuId || mobileMenuOpen
        || event.key.toLowerCase() !== 'n') return;
      event.preventDefault();
      navigate('bulk-transport', { returnTo: 'bulk-transport-list' });
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [deleteTarget, openActionMenuId, mobileMenuOpen, navigate]);

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

  const results = useMemo(() => {
    const items = pageData?.results || [];
    return sort ? sortOptionalStrings(items, item => item[sort.field], sort.ascending) : items;
  }, [pageData, sort]);
  const total = pageData?.total || 0;
  const totalPages = Math.max(1, pageData?.totalPages || 1);

  const toggleSort = (field: SortField) => {
    setSort(current => ({
      field,
      ascending: current?.field === field ? !current.ascending : true
    }));
  };

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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Layers className="h-5 w-5 text-blue-600" />Bulk Transports</h1>
          <p className="mt-0.5 text-xs text-slate-500">Review bulk dispatch batches.</p>
        </div>
        <button type="button" onClick={() => navigate('bulk-transport', { returnTo: 'bulk-transport-list' })} className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 sm:self-auto">
          <Plus className="h-3.5 w-3.5" />Add bulk transport
        </button>
      </header>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Dispatch batches</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{pageData ? `${pageData.total} total` : 'Loading records'}</p>
          </div>
          {error && <button type="button" onClick={() => setReloadKey(key => key + 1)} aria-label="Retry loading bulk transports" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><RefreshCw className="h-4 w-4" /></button>}
        </div>

        {error ? (
          <div role="alert" className="m-4 min-h-0 flex-1 overflow-auto rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{error}</div>
        ) : (
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th
                    aria-sort={sort?.field === 'loadingDate' ? (sort.ascending ? 'ascending' : 'descending') : undefined}
                    className="sticky top-0 z-10 bg-slate-50 px-4 py-3"
                  >
                    <button type="button" onClick={() => toggleSort('loadingDate')} className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
                      Loading Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th
                    aria-sort={sort?.field === 'billNumber' ? (sort.ascending ? 'ascending' : 'descending') : undefined}
                    className="sticky top-0 z-10 bg-slate-50 px-4 py-3"
                  >
                    <button type="button" onClick={() => toggleSort('billNumber')} className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
                      Bill <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="sticky top-0 z-10 bg-slate-50 w-[140px] max-w-[140px] px-4 py-3">Vehicle No</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3">Commodity</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3">Route (To / From)</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Gross Weight</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Received Weight</th>
                  <th
                    aria-sort={sort?.field === 'unloadingDate' ? (sort.ascending ? 'ascending' : 'descending') : undefined}
                    className="sticky top-0 z-10 bg-slate-50 px-4 py-3"
                  >
                    <button type="button" onClick={() => toggleSort('unloadingDate')} className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
                      Unload Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-500">Loading bulk transports...</td></tr>
                ) : results.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-500">No bulk transport batches found.</td></tr>
                ) : results.map(item => {
                  const status = item.status.toUpperCase();
                  const rowBgClass = status === 'DRAFT'
                    ? 'bg-slate-50/70 hover:bg-slate-100/70 border-l-4 border-l-slate-400'
                    : status === 'PENDING'
                    ? 'bg-amber-50/50 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                    : status === 'DELIVERY'
                    ? 'bg-blue-50/50 hover:bg-blue-100/60 border-l-4 border-l-blue-500'
                    : status === 'FINANCE'
                    ? 'bg-purple-50/50 hover:bg-purple-100/60 border-l-4 border-l-purple-500'
                    : 'bg-emerald-50/50 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500';
                  return (
                    <tr
                      key={item.id}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('button, a, input, select')) return;
                        navigate('bulk-transport', { bulkTransportId: item.id, returnTo: 'bulk-transport-list' });
                      }}
                      className={`${rowBgClass} cursor-pointer transition-colors`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatTransportListDate(item.loadingDate)}</td>
                      <td className="max-w-[260px] px-4 py-3 font-mono font-medium text-slate-900">
                        <button
                          type="button"
                          onClick={() => navigate('bulk-transport-detail', { bulkTransportId: item.id })}
                          className="block max-w-full truncate text-left font-bold hover:text-blue-600"
                          title={item.billNumber || ''}
                        >
                          {item.billNumber || '-'}
                        </button>
                        {item.billingFirm && (
                          <div className="mt-1 flex items-center gap-1 truncate font-sans text-[10px] font-semibold text-violet-700" title={`Billing firm: ${item.billingFirm}`}>
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.billingFirm}</span>
                          </div>
                        )}
                      </td>
                      <td className="w-[140px] max-w-[140px] px-4 py-3 font-mono font-bold text-slate-900">
                        {item.vehicleCount} Vehicles
                        <div className="break-words whitespace-normal font-sans text-[10px] font-normal text-slate-500" title={item.transporter || ''}>
                          {item.transporter || 'Direct Transport'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.commodity || '-'}
                        {item.commodityType && <span className="font-normal text-slate-500"> ({item.commodityType})</span>}
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <div className="flex min-w-0 items-center gap-1.5" title={item.destination || ''}>
                          <ArrowRight className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden="true" />
                          <span className="truncate font-semibold text-slate-900">{item.destination || '-'}</span>
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5" title={`${item.fromClientCount} Locations`}>
                          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">From</span>
                          <span className="truncate text-[10px] font-semibold text-slate-400">{item.fromClientCount} Locations</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                        {formatQuantityWithUnit(item.grossWeight, item.grossWeightUnit)}
                        {item.totalBagCount > 0 && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {item.totalBagCount} bags
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {item.receivedWeight === undefined
                          ? '-'
                          : formatQuantityWithUnit(item.receivedWeight, item.grossWeightUnit)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatTransportListDate(item.unloadingDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === item.id ? null : item.id);
                            }}
                            className="cursor-pointer rounded-lg border border-slate-200/60 p-1.5 text-slate-600 shadow-2xs transition-colors hover:bg-white/80 hover:text-slate-900"
                            title="Bulk Transport Options"
                            aria-label={`Actions for ${item.title}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openActionMenuId === item.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenActionMenuId(null);
                                }}
                              />
                              <div className="absolute right-0 top-full z-30 mt-1 w-52 animate-in rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl fade-in zoom-in-95 duration-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    navigate('bulk-transport-detail', { bulkTransportId: item.id });
                                  }}
                                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                                >
                                  <Eye className="h-3.5 w-3.5 text-slate-400" />
                                  <span>View Bulk Transport</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    navigate('bulk-transport', { bulkTransportId: item.id, returnTo: 'bulk-transport-list' });
                                  }}
                                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Edit Bulk Transport</span>
                                </button>
                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setDeleteTarget(item);
                                  }}
                                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  <span>Delete Bulk Transport</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="shrink-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          <span>
            Showing {total === 0 ? 0 : (pageNumber - 1) * PAGE_SIZE + 1} to {Math.min(pageNumber * PAGE_SIZE, total)} of {total} bulk transports
          </span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={loading || pageNumber <= 1} onClick={() => setPageNumber(current => Math.max(1, current - 1))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Previous</button>
            <button type="button" disabled={loading || pageNumber >= totalPages} onClick={() => setPageNumber(current => Math.min(totalPages, current + 1))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight className="h-3.5 w-3.5" /></button>
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