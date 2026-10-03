import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Clock, Layers, Loader2, Plus, RefreshCw, Truck } from 'lucide-react';
import { dashboardApi, DashboardData, DashboardTimeRange } from '../../api/dashboard';
import { useApp } from '../../context/AppContext';
import { formatDate, formatQuantityWithUnit, getTransportStatusBadge } from '../../utils/formatters';

const dateRanges: { value: DashboardTimeRange; label: string }[] = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_week', label: 'This Week' }
];

const transportStages = [
  { status: 'PENDING', label: 'Pending / Loading', color: 'bg-amber-500' },
  { status: 'DELIVERY', label: 'In Transit / Delivery', color: 'bg-sky-600' },
  { status: 'FINANCE', label: 'Finance Audit', color: 'bg-purple-600' },
  { status: 'PAID', label: 'Settled & Paid', color: 'bg-emerald-600' }
];

export const DashboardScreen: React.FC = () => {
  const { navigate } = useApp();
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('all_time');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    dashboardApi.getSummary(timeRange)
      .then(data => {
        if (active) setDashboard(data);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard data.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [timeRange, retryKey]);

  const statusCount = (status: string) => {
    const counts = dashboard?.transport_status_counts ?? {};
    const match = Object.entries(counts).find(([key]) => key.toUpperCase() === status);
    return match?.[1] ?? 0;
  };
  const totalTransports = transportStages.reduce((total, stage) => total + statusCount(stage.status), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Operational Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live status of orders and vehicle movements.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-1 bg-slate-200/80 rounded-lg text-xs" role="group" aria-label="Dashboard time range">
            {dateRanges.map(range => (
              <button
                key={range.value}
                type="button"
                onClick={() => setTimeRange(range.value)}
                aria-pressed={timeRange === range.value}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  timeRange === range.value ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('order-form')}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Order
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRetryKey(key => key + 1)}
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold hover:text-rose-950"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {loading && !dashboard ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard...
        </div>
      ) : dashboard && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" aria-busy={loading}>
            <div onClick={() => navigate('orders', { statusFilter: 'PENDING' })} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Orders</span>
                <ClipboardList className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{dashboard.pending_orders_count}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Awaiting fulfillment</div>
            </div>

            <div onClick={() => navigate('orders', { statusFilter: 'DRAFT' })} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Draft Orders</span>
                <Layers className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">{dashboard.draft_orders_count}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Not yet confirmed</div>
            </div>

            <div onClick={() => navigate('transport', { statusFilter: 'DELIVERY' })} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Transit</span>
                <Truck className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-sky-800 tabular-nums">{dashboard.in_transit_count}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Active consignments</div>
            </div>

            <div onClick={() => navigate('transport', { statusFilter: 'FINANCE' })} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Finance Auditing</span>
                <Clock className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-purple-800 tabular-nums">{statusCount('FINANCE')}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Awaiting settlement</div>
            </div>

            <div onClick={() => navigate('transport')} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transport Fleet</span>
                <Truck className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{totalTransports}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Across all statuses</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Expiring Orders ({dashboard.expiring_orders.length})</h2>
                </div>
                <button onClick={() => navigate('orders')} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 cursor-pointer">
                  View Orders <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-80">
                {dashboard.expiring_orders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    No orders are approaching expiry.
                  </div>
                ) : dashboard.expiring_orders.map(order => (
                  <div key={order.id} onClick={() => navigate('order-detail', { orderId: String(order.id) })} className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{order.order_no}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">{order.commodity}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <span>{order.from_client || '-'}</span><ArrowRight className="w-2.5 h-2.5" /><span>{order.to_client || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">Expires {formatDate(order.expiry_date)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-amber-700 tabular-nums">
                          {formatQuantityWithUnit(Math.max(0, order.quantity - order.quantity_fulfilled), order.quantity_unit)}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {order.days_until_expiry < 0 ? (
                            <span className="text-red-600 font-bold">Expired</span>
                          ) : order.days_until_expiry === 0 ? (
                            <span className="text-amber-700 font-semibold">Expires today</span>
                          ) : (
                            <span className="text-amber-700 font-semibold">{order.days_until_expiry} days left</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-600" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Vehicles In Transit ({dashboard.in_transit_count})</h2>
                </div>
                <button onClick={() => navigate('transport')} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 cursor-pointer">
                  Transport Board <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-80">
                {dashboard.in_transit_transports.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    No vehicles are currently in transit.
                  </div>
                ) : dashboard.in_transit_transports.map(transport => {
                  const badge = getTransportStatusBadge(transport.status.toUpperCase());
                  return (
                    <div key={transport.id} onClick={() => navigate('transport-detail', { transportId: String(transport.id) })} className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{transport.vehicle_no}</span>
                            <span className="text-slate-400 font-mono text-[10px]">({transport.bill_no})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">Gross weight: {formatQuantityWithUnit(transport.gross_wt, transport.quantity_unit)}</div>
                          {transport.unload_date && <div className="text-[10px] text-slate-400 mt-1">Unload: {formatDate(transport.unload_date)}</div>}
                        </div>
                        <span className={`inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Transport Pipeline Stages</h3>
              <div className="space-y-3 text-xs">
                {transportStages.map(stage => {
                  const count = statusCount(stage.status);
                  const percentage = totalTransports ? (count / totalTransports) * 100 : 0;
                  return (
                    <div key={stage.status}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-600">{stage.label}</span>
                        <span className="font-bold text-slate-800 tabular-nums">{count} vehicles</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`${stage.color} h-full rounded-full`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Operational Actions</h3>
                <div className="space-y-2">
                  <button type="button" onClick={() => navigate('transport-form')} className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition-colors">
                    <span>Dispatch Single Truck</span><ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button type="button" onClick={() => navigate('bulk-transport')} className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition-colors">
                    <span>Bulk Fleet Dispatch</span><ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button type="button" onClick={() => navigate('master-data')} className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition-colors">
                    <span>Manage Clients & Godowns</span><ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            </section>

            <div className="bg-slate-900 rounded-xl p-5 text-white flex flex-col justify-between min-h-36">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Selected Period</div>
                <div className="mt-2 text-lg font-semibold">{dateRanges.find(range => range.value === timeRange)?.label}</div>
              </div>
              <div className="text-xs text-slate-300">Dashboard figures update for the selected time range.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};