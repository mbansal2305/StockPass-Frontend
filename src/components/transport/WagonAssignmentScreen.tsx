import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Pencil, Plus, Search, TrainFront, Trash2, Truck, X } from 'lucide-react';
import { WagonAssignmentStatus, WagonVehicle, wagonAssignmentsApi } from '../../api';
import { useApp } from '../../context/AppContext';
import { getShortUnitLabel } from '../../utils/formatters';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { scrollActiveOptionIntoView } from '../common/SearchableSelect';
import { AssignmentPopover } from './AssignmentPopover';
import { displayQuantity, displayRemainingQuantity, EditorState, fromApi, hasVehicleAssignment, newEntry, newTrain, newWagon, remaining, remainingAfterEntry, toApi, trainName, Train, validateEntry, VehicleEntry, vehicleAssignmentSummary, vehicleEntryChanged, vehicleSummaryTotals, Wagon } from './wagonAssignmentModel';

const inputClass = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const vehicleBadgeClass = 'inline-flex max-w-full items-center rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono text-xs font-bold text-sky-800';
const remainingColor = (value: number | null): string =>
  value === 0 ? 'font-semibold text-emerald-700' : value !== null && value < 0 ? 'font-semibold text-red-600' : 'font-semibold text-slate-700';
const summaryRemainingColor = (value: number | null): string =>
  value === 0 ? 'font-semibold text-emerald-300' : value === null || value < 0 ? 'font-semibold text-red-300' : 'font-semibold text-white';
const summaryDifferenceColor = (value: number | null): string =>
  value === 0 ? 'text-emerald-400' : value === null || value < 0 ? 'text-red-400' : 'text-amber-300';

interface VehicleEditor {
  trainKey: string;
  wagonKey: string;
  entry: VehicleEntry;
  original: VehicleEntry;
  isNew: boolean;
}

type RemovalTarget =
  | { kind: 'train'; trainKey: string; label: string }
  | { kind: 'wagon'; trainKey: string; wagonKey: string; label: string }
  | { kind: 'vehicle'; trainKey: string; wagonKey: string; entryKey: string; label: string; wagonNumber: string };

export const WagonAssignmentScreen: React.FC = () => {
  const { pageParams, navigate, showToast, setNavigationGuard } = useApp();
  const bulkId = String(pageParams.bulkTransportId || '');
  const fetchExisting = useRef(pageParams.wagonAssignmentStatus != null);
  const popoverAnchor = useRef<HTMLElement | null>(null);
  const pickerOptionsRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<WagonVehicle[]>([]);
  const [state, setState] = useState<EditorState>({ status: 'draft', trains: [] });
  const [baseline, setBaseline] = useState('');
  const [exists, setExists] = useState(pageParams.wagonAssignmentStatus != null);
  const [activeTrainKey, setActiveTrainKey] = useState('');
  const [collapsedWagons, setCollapsedWagons] = useState<Set<string>>(() => new Set());
  const [picker, setPicker] = useState<{ trainKey: string; wagonKey: string } | null>(null);
  const [search, setSearch] = useState('');
  const [activeOption, setActiveOption] = useState(0);
  const [editor, setEditor] = useState<VehicleEditor | null>(null);
  const [editorError, setEditorError] = useState('');
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const dirty = baseline !== '' && JSON.stringify(state) !== baseline;
  const editorDirty = editor !== null && vehicleEntryChanged(editor.original, editor.entry);

  useEffect(() => {
    let cancelled = false;
    if (!bulkId) {
      setError('Bulk transport not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      wagonAssignmentsApi.vehicles(bulkId),
      fetchExisting.current ? wagonAssignmentsApi.get(bulkId) : Promise.resolve(null)
    ]).then(([options, saved]) => {
      if (cancelled) return;
      if (saved && String(saved.bulk_transport) !== bulkId) throw new Error('Wagon assignments belong to a different bulk transport.');
      const initial = saved ? fromApi(saved) : { status: 'draft' as const, trains: [] };
      setVehicles(options);
      setState(initial);
      setCollapsedWagons(new Set());
      setActiveTrainKey(initial.trains[0]?.key || '');
      setBaseline(JSON.stringify(initial));
      setExists(saved !== null);
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load wagon assignments.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [bulkId, pageParams.wagonAssignmentStatus, reload]);

  useEffect(() => {
    if (!dirty && !saving && !editorDirty) return;
    setNavigationGuard(() => !saving && window.confirm('Discard unsaved wagon assignment changes?'));
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      setNavigationGuard(null);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [dirty, saving, editorDirty, setNavigationGuard]);

  const vehicleBalances = useMemo(() => vehicles.map(vehicle => ({ vehicle, balance: remaining(state, vehicle) })), [state, vehicles]);
  const vehicleSummaries = useMemo(() => vehicles.map(vehicle => ({
    vehicle, summary: vehicleAssignmentSummary(state, vehicle, editor?.entry)
  })), [state, vehicles, editor]);
  const summaryTotals = useMemo(() => vehicleSummaryTotals(state, vehicleSummaries, editor?.entry), [state, vehicleSummaries, editor]);
  const formatSummaryQuantity = (field: 'vehicles' | 'assigned'): string => {
    if (field === 'assigned' && summaryTotals.unavailableAssignment) return 'Unavailable (vehicle missing)';
    if (!summaryTotals.quantities.length) return '0';
    return summaryTotals.quantities.map(({ unit, ...totals }) => {
      const quantity = totals[field];
      return quantity === null ? `Invalid quantity (${unit || 'unit unavailable'})` : `${displayQuantity(quantity)} ${unit}`;
    }).join(' · ');
  };
  const assignedQuantityColor = summaryTotals.unavailableAssignment || summaryTotals.quantities.some(total => total.difference === null)
    ? 'text-red-400'
    : summaryTotals.quantities.every(total => total.difference === 0) ? 'text-emerald-400' : 'text-amber-300';
  const available = vehicleBalances.filter(({ balance }) => balance.quantity > 0 || balance.bags > 0);
  const summaryAvailable = vehicleSummaries.filter(({ summary }) =>
    (summary.remaining.quantity !== null && summary.remaining.quantity > 0)
    || (summary.remaining.bags !== null && summary.remaining.bags > 0)
  );
  const pickerWagon = state.trains.find(train => train.key === picker?.trainKey)?.wagons.find(wagon => wagon.key === picker?.wagonKey);
  const filteredVehicles = vehicleBalances.filter(({ vehicle }) =>
    (!pickerWagon || !hasVehicleAssignment(pickerWagon, String(vehicle.id)))
    && vehicle.vehicle_no.toLowerCase().includes(search.trim().toLowerCase())
  );
  const activeTrain = state.trains.find(train => train.key === activeTrainKey);
  const allWagonsCollapsed = activeTrain !== undefined && activeTrain.wagons.length > 0
    && activeTrain.wagons.every(wagon => collapsedWagons.has(wagon.key));

  useLayoutEffect(() => {
    if (picker) scrollActiveOptionIntoView(pickerOptionsRef.current, activeOption);
  }, [picker, activeOption, search, filteredVehicles.length]);

  const updateTrain = (trainKey: string, change: (train: Train) => Train) =>
    setState(current => ({ ...current, trains: current.trains.map(train => train.key === trainKey ? change(train) : train) }));
  const updateWagon = (trainKey: string, wagonKey: string, change: (wagon: Wagon) => Wagon) =>
    updateTrain(trainKey, train => ({ ...train, wagons: train.wagons.map(wagon => wagon.key === wagonKey ? change(wagon) : wagon) }));

  const setWagonsCollapsed = (wagonKeys: string[], collapsed: boolean) => {
    if (collapsed && editor && wagonKeys.includes(editor.wagonKey)) {
      if (editorDirty && !window.confirm('Discard the vehicle entry being edited?')) return;
      setEditor(null);
      setEditorError('');
    }
    if (collapsed && picker && wagonKeys.includes(picker.wagonKey)) setPicker(null);
    setCollapsedWagons(current => {
      const next = new Set(current);
      wagonKeys.forEach(wagonKey => collapsed ? next.add(wagonKey) : next.delete(wagonKey));
      return next;
    });
  };

  const removeTrain = (trainKey: string) => {
    const remainingTrains = state.trains.filter(train => train.key !== trainKey);
    const removedWagons = state.trains.find(train => train.key === trainKey)?.wagons ?? [];
    setCollapsedWagons(current => {
      const next = new Set(current);
      removedWagons.forEach(wagon => next.delete(wagon.key));
      return next;
    });
    setState(current => ({ ...current, trains: current.trains.filter(train => train.key !== trainKey) }));
    setActiveTrainKey(remainingTrains[0]?.key || '');
    if (editor?.trainKey === trainKey) setEditor(null);
    setPicker(null);
  };

  const removeWagon = (trainKey: string, wagonKey: string) => {
    updateTrain(trainKey, train => ({ ...train, wagons: train.wagons.filter(wagon => wagon.key !== wagonKey) }));
    setCollapsedWagons(current => {
      const next = new Set(current);
      next.delete(wagonKey);
      return next;
    });
    if (editor?.trainKey === trainKey && editor.wagonKey === wagonKey) setEditor(null);
    if (picker?.trainKey === trainKey && picker.wagonKey === wagonKey) setPicker(null);
  };

  const confirmRemoval = () => {
    if (!removalTarget) return;
    if (removalTarget.kind === 'train') {
      removeTrain(removalTarget.trainKey);
    } else if (removalTarget.kind === 'wagon') {
      removeWagon(removalTarget.trainKey, removalTarget.wagonKey);
    } else {
      const { trainKey, wagonKey, entryKey } = removalTarget;
      updateWagon(trainKey, wagonKey, wagon => ({ ...wagon, entries: wagon.entries.filter(entry => entry.key !== entryKey) }));
      if (editor?.trainKey === trainKey && editor.wagonKey === wagonKey && editor.entry.key === entryKey) setEditor(null);
    }
    setRemovalTarget(null);
  };

  const openPicker = (trainKey: string, wagonKey: string, anchor: HTMLElement) => {
    if (editorDirty && !window.confirm('Discard the vehicle entry being edited?')) return;
    popoverAnchor.current = anchor;
    setEditor(null);
    setEditorError('');
    setSearch('');
    setActiveOption(0);
    setPicker({ trainKey, wagonKey });
  };

  const selectVehicle = (vehicle: WagonVehicle) => {
    if (!picker) return;
    const entry = { ...newEntry(), transport: String(vehicle.id) };
    setEditor({ ...picker, entry, original: { ...entry }, isNew: true });
    setEditorError('');
    setPicker(null);
  };

  const editVehicle = (trainKey: string, wagonKey: string, entry: VehicleEntry, anchor: HTMLElement) => {
    if (editorDirty && !window.confirm('Discard the vehicle entry being edited?')) return;
    popoverAnchor.current = anchor;
    setPicker(null);
    setEditorError('');
    setEditor({ trainKey, wagonKey, entry: { ...entry }, original: { ...entry }, isNew: false });
  };

  const dismissPopover = () => {
    if (editorDirty && !window.confirm('Discard the vehicle entry being edited?')) return;
    setPicker(null);
    setEditor(null);
    setEditorError('');
  };

  const commitVehicle = () => {
    if (!editor) return;
    const vehicle = vehicles.find(item => String(item.id) === editor.entry.transport);
    if (!vehicle) {
      setEditorError('This vehicle is no longer available. Remove or replace it before saving.');
      return;
    }
    const wagon = state.trains.find(train => train.key === editor.trainKey)?.wagons.find(item => item.key === editor.wagonKey);
    if (editor.isNew && wagon && hasVehicleAssignment(wagon, editor.entry.transport)) {
      setEditorError(`${vehicle.vehicle_no} is already assigned to this wagon. Edit the existing assignment instead.`);
      return;
    }
    const validationError = validateEntry(editor.entry, vehicle);
    if (validationError) {
      setEditorError(validationError);
      return;
    }
    updateWagon(editor.trainKey, editor.wagonKey, wagon => ({
      ...wagon,
      entries: editor.isNew
        ? [...wagon.entries, editor.entry]
        : wagon.entries.map(entry => entry.key === editor.entry.key ? editor.entry : entry)
    }));
    setEditor(null);
    setEditorError('');
  };

  const save = async () => {
    if (saving || editor) return;
    try {
      const payload = toApi(state, Number(bulkId), vehicles);
      setSaving(true);
      const saved = await wagonAssignmentsApi.save(payload, exists);
      setExists(true);
      fetchExisting.current = true;
      let updated: EditorState;
      try {
        if (String(saved.bulk_transport) !== bulkId) throw new Error('Unexpected bulk transport ID');
        updated = fromApi(saved);
      } catch {
        setError('Assignments were saved, but the response could not be read. Retry to load the latest state before editing.');
        return;
      }
      const activeIndex = state.trains.findIndex(train => train.key === activeTrainKey);
      setCollapsedWagons(current => {
        const next = new Set<string>();
        state.trains.forEach((train, trainIndex) => train.wagons.forEach((wagon, wagonIndex) => {
          const savedWagon = updated.trains[trainIndex]?.wagons[wagonIndex];
          if (savedWagon && current.has(wagon.key)) next.add(savedWagon.key);
        }));
        return next;
      });
      setState(updated);
      setActiveTrainKey(updated.trains[activeIndex]?.key || updated.trains[0]?.key || '');
      setBaseline(JSON.stringify(updated));
      setPicker(null);
      showToast('Wagon assignments saved.', 'success');
    } catch (saveError: unknown) {
      showToast(saveError instanceof Error ? saveError.message : 'Unable to save wagon assignments.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div role="status" className="p-6 text-sm text-slate-500">Loading wagon assignments...</div>;
  if (error) return (
    <div role="alert" className="space-y-4 rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700">
      <p>{error}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setReload(value => value + 1)} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Retry</button>
        <button type="button" onClick={() => navigate('bulk-transport-list')} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Back to bulk transports</button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 pb-6">
      <header className="flex items-start gap-3">
        <button type="button" onClick={() => navigate('bulk-transport-list')} aria-label="Back to bulk transports" className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><TrainFront className="h-5 w-5 shrink-0 text-blue-600" />Manage Wagons</h1>
          <p className="mt-1 text-sm text-slate-500">{pageParams.bulkTitle || `Bulk transport ${bulkId}`}</p>
        </div>
      </header>

      <fieldset disabled={saving} className="space-y-3">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Trains &amp; wagons</h2>
              <p className="mt-0.5 text-xs text-slate-500">{available.length} vehicle{available.length === 1 ? '' : 's'} with quantity or bags remaining</p>
            </div>
            <button type="button" onClick={() => {
              let index = 0;
              while (state.trains.some(train => train.name.trim().toLowerCase() === trainName(index).toLowerCase())) index++;
              const train = newTrain(trainName(index));
              setState(current => ({ ...current, trains: [...current.trains, train] }));
              setActiveTrainKey(train.key);
              setPicker(null);
            }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add train</button>
          </div>

          {state.trains.length > 0 && (
            <div role="tablist" aria-label="Trains" className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-3 sm:px-4">
              {state.trains.map((train, index) => (
                <button key={train.key} type="button" role="tab" id={`tab-${train.key}`} aria-controls="active-train-panel" aria-selected={train.key === activeTrainKey} tabIndex={train.key === activeTrainKey ? 0 : -1}
                  onClick={() => { setActiveTrainKey(train.key); setPicker(null); }}
                  onKeyDown={event => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                    event.preventDefault();
                    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + state.trains.length) % state.trains.length;
                    setActiveTrainKey(state.trains[nextIndex].key);
                    setPicker(null);
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
                  }}
                  className={`flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${train.key === activeTrainKey ? 'border-blue-600 bg-white text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
                  <TrainFront className="h-4 w-4" />{train.name || 'Unnamed train'} <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">{train.wagons.length}</span>
                </button>
              ))}
            </div>
          )}

          {!activeTrain ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600"><TrainFront className="h-6 w-6" /></div>
              <p className="mt-3 text-sm font-semibold text-slate-800">Start with a train</p>
              <p className="mt-1 text-xs text-slate-500">Add a train, then create wagons and assign vehicles.</p>
            </div>
          ) : (
            <div id="active-train-panel" role="tabpanel" aria-labelledby={`tab-${activeTrain.key}`} className="space-y-2.5 p-3 sm:p-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 max-w-48 flex-1 text-xs font-semibold text-slate-700">Train name
                  <input aria-label="Train name" className={`${inputClass} mt-0.5`} value={activeTrain.name} onChange={event => updateTrain(activeTrain.key, train => ({ ...train, name: event.target.value }))} />
                </label>
                <button type="button" aria-label={`Remove ${activeTrain.name || 'train'}`} onClick={() => {
                  if (activeTrain.wagons.length > 0) setRemovalTarget({ kind: 'train', trainKey: activeTrain.key, label: activeTrain.name || 'this train' });
                  else removeTrain(activeTrain.key);
                }} className="flex min-h-10 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"><Trash2 className="h-4 w-4" />Remove</button>
                {activeTrain.wagons.length > 0 && (
                  <button type="button" onClick={() => setWagonsCollapsed(activeTrain.wagons.map(wagon => wagon.key), !allWagonsCollapsed)}
                    className="ml-auto flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    {allWagonsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    {allWagonsCollapsed ? 'Expand all' : 'Collapse all'}
                  </button>
                )}
              </div>

              {activeTrain.wagons.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">No wagons yet. Add a wagon to start assigning vehicles.</div>
              ) : (
                <div className="space-y-2">
                  {activeTrain.wagons.map((wagon, wagonIndex) => {
                    const collapsed = collapsedWagons.has(wagon.key);
                    const pickerOpen = picker?.trainKey === activeTrain.key && picker.wagonKey === wagon.key;
                    const wagonEditor = editor?.trainKey === activeTrain.key && editor.wagonKey === wagon.key ? editor : null;
                    const editingVehicle = wagonEditor && vehicles.find(vehicle => String(vehicle.id) === wagonEditor.entry.transport);
                    const editorBalance = editingVehicle && wagonEditor ? remaining(state, editingVehicle, wagonEditor.entry.key) : null;
                    const currentBalance = editorBalance && wagonEditor ? remainingAfterEntry(editorBalance, wagonEditor.entry) : null;
                    const editorPanel = wagonEditor && (
                      <div className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-600">{wagonEditor.isNew ? 'Assign vehicle' : 'Edit assignment'}</p>
                            <span className={`${vehicleBadgeClass} mt-1`}>{editingVehicle?.vehicle_no || `Vehicle #${wagonEditor.entry.transport}`}</span>
                          </div>
                          <button type="button" onClick={() => { setEditor(null); setEditorError(''); }} aria-label="Cancel vehicle entry" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                        </div>
                        {editingVehicle && currentBalance ? (
                          <p className="text-xs text-slate-500">
                            Remaining:{' '}
                            <span className={remainingColor(currentBalance.quantity)}>
                              {currentBalance.quantity === null ? 'Invalid quantity' : `${displayRemainingQuantity(currentBalance.quantity)} ${getShortUnitLabel(editingVehicle.quantity_unit)}`}
                            </span>
                            {' · '}
                            <span className={remainingColor(currentBalance.bags)}>
                              {currentBalance.bags === null ? 'Invalid bags' : `${currentBalance.bags} bags`}
                            </span>
                          </p>
                        ) : <p role="alert" className="text-xs text-red-700">This vehicle is no longer available. Remove or replace it before saving.</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-semibold text-slate-600">Quantity {editingVehicle?.quantity_unit && `(${getShortUnitLabel(editingVehicle.quantity_unit)})`}
                            <input className={`${inputClass} mt-1`} type="text" inputMode="decimal" value={wagonEditor.entry.quantity} onChange={event => { setEditor({ ...wagonEditor, entry: { ...wagonEditor.entry, quantity: event.target.value } }); setEditorError(''); }} />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">Bags
                            <input className={`${inputClass} mt-1`} type="text" inputMode="numeric" value={wagonEditor.entry.bags} onChange={event => { setEditor({ ...wagonEditor, entry: { ...wagonEditor.entry, bags: event.target.value } }); setEditorError(''); }} />
                          </label>
                        </div>
                        {editorError && <p role="alert" className="text-xs text-red-700">{editorError}</p>}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={!editorBalance || (editorBalance.quantity <= 0 && editorBalance.bags <= 0)} onClick={() => {
                            if (editorBalance) {
                              setEditor({ ...wagonEditor, entry: { ...wagonEditor.entry, quantity: displayQuantity(Math.max(0, editorBalance.quantity)), bags: String(Math.max(0, editorBalance.bags)) } });
                              setEditorError('');
                            }
                          }} className="min-h-10 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40">Assign all remaining</button>
                          <button type="button" onClick={commitVehicle} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"><Check className="h-4 w-4" />{wagonEditor.isNew ? 'Add to wagon' : 'Update vehicle'}</button>
                          <button type="button" onClick={() => { setEditor(null); setEditorError(''); }} className="min-h-10 px-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
                        </div>
                      </div>
                    );
                    const pickerPanel = pickerOpen && (
                      <div className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                            <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
                            <input role="combobox" aria-label="Search vehicles" aria-autocomplete="list" aria-expanded="true" aria-controls={`options-${wagon.key}`} aria-activedescendant={filteredVehicles[activeOption] ? `option-${wagon.key}-${activeOption}` : undefined}
                              value={search} onChange={event => { setSearch(event.target.value); setActiveOption(0); }}
                              onKeyDown={event => {
                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                  event.preventDefault();
                                  setActiveOption(index => Math.max(0, Math.min(filteredVehicles.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
                                } else if (event.key === 'Enter' && filteredVehicles[activeOption]) {
                                  event.preventDefault();
                                  selectVehicle(filteredVehicles[activeOption].vehicle);
                                }
                              }}
                              placeholder="Search vehicle number" className="w-full min-w-0 bg-transparent px-2 py-1.5 text-base outline-none" />
                            <ChevronDown className="mr-3 h-4 w-4 shrink-0 text-slate-400" />
                          </div>
                          <button type="button" onClick={() => setPicker(null)} aria-label="Close vehicle search" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                        </div>
                        <div ref={pickerOptionsRef} id={`options-${wagon.key}`} role="listbox" aria-label="Vehicles" className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-100">
                          {filteredVehicles.length ? filteredVehicles.map(({ vehicle, balance }, index) => (
                            <button key={vehicle.id} type="button" role="option" id={`option-${wagon.key}-${index}`} aria-selected={index === activeOption} onMouseEnter={() => setActiveOption(index)} onClick={() => selectVehicle(vehicle)} className={`flex min-h-10 w-full flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5 text-left last:border-0 ${index === activeOption ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                              <span className={vehicleBadgeClass}>{vehicle.vehicle_no}</span>
                              <span className="text-xs text-slate-500">
                                <span className={remainingColor(balance.quantity)}>
                                  {balance.quantity < 0
                                    ? `${displayRemainingQuantity(-balance.quantity)} ${getShortUnitLabel(vehicle.quantity_unit)} over-assigned`
                                    : `${displayRemainingQuantity(balance.quantity)} ${getShortUnitLabel(vehicle.quantity_unit)} left`}
                                </span>
                                {' · '}
                                <span className={remainingColor(balance.bags)}>
                                  {balance.bags < 0 ? `${-balance.bags} bags over-assigned` : `${balance.bags} bags left`}
                                </span>
                              </span>
                            </button>
                          )) : <p className="px-3 py-4 text-xs text-slate-500">No unassigned vehicles match your search.</p>}
                        </div>
                      </div>
                    );
                    return (
                      <article key={wagon.key} className="rounded-lg border border-gray-200 bg-blue-50/60">
                        <div className="flex flex-wrap items-center gap-1 border-b border-blue-200 bg-blue-100 px-2 py-0.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-200 text-xs font-bold text-blue-800">{wagonIndex + 1}</span>
                          <label className="flex min-w-0 flex-1 items-center gap-1 text-sm font-bold text-blue-800">
                            Wagon
                            <input aria-label={`Wagon ${wagonIndex + 1} number`} value={wagon.number} onChange={event => updateWagon(activeTrain.key, wagon.key, item => ({ ...item, number: event.target.value }))} className="w-20 min-w-0 rounded-md border border-white/80 bg-white/80 px-1.5 py-0 text-base font-semibold text-slate-800 focus:border-blue-500 focus:outline-none sm:w-28" />
                            <Pencil className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                          </label>
                          <span className="text-xs font-medium text-slate-600">{wagon.entries.length} vehicle{wagon.entries.length === 1 ? '' : 's'}</span>
                          <button type="button" aria-label={`Remove wagon ${wagon.number}`} onClick={() => {
                            if (wagon.entries.length > 0) setRemovalTarget({ kind: 'wagon', trainKey: activeTrain.key, wagonKey: wagon.key, label: wagon.number || String(wagonIndex + 1) });
                            else removeWagon(activeTrain.key, wagon.key);
                          }} className="flex h-7 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          <button type="button" aria-label={`${collapsed ? 'Expand' : 'Collapse'} wagon ${wagon.number || wagonIndex + 1}`}
                            aria-expanded={!collapsed} aria-controls={`wagon-content-${wagon.key}`}
                            onClick={() => setWagonsCollapsed([wagon.key], !collapsed)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-200">
                            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </button>
                        </div>

                        <div id={`wagon-content-${wagon.key}`} className={collapsed ? 'hidden' : 'flex flex-wrap items-start gap-1.5 p-2'}>
                          {wagon.entries.map(entry => {
                            const vehicle = vehicles.find(item => String(item.id) === entry.transport);
                            const editingThisEntry = wagonEditor && !wagonEditor.isNew && wagonEditor.entry.key === entry.key;
                            return (
                              <div key={entry.key} className="min-w-0 max-w-full">
                                <div className="flex min-w-0 overflow-hidden rounded-md border border-sky-200 bg-white shadow-sm">
                                  <button type="button" onClick={event => editVehicle(activeTrain.key, wagon.key, entry, event.currentTarget)} aria-label={`Edit ${vehicle?.vehicle_no || `vehicle ${entry.transport}`}`} aria-haspopup="dialog" aria-controls={editingThisEntry ? 'wagon-assignment-dialog' : undefined} aria-expanded={Boolean(editingThisEntry)} className="min-h-16 min-w-0 flex-1 py-1 pl-2 pr-2 text-left hover:bg-sky-50">
                                    <span className={vehicleBadgeClass}>{vehicle?.vehicle_no || `Vehicle #${entry.transport}`}</span>
                                    {vehicle ? (
                                      <span className="mt-0.5 block text-xs leading-4">
                                        <strong className="block font-bold text-blue-700">{entry.quantity || '0'} {getShortUnitLabel(vehicle.quantity_unit)}</strong>
                                        <span className="block font-medium text-gray-700">{entry.bags || '0'} bags</span>
                                      </span>
                                    ) : <span className="mt-0.5 block text-xs text-red-700">Vehicle unavailable</span>}
                                  </button>
                                  <button type="button" aria-label={`Remove ${vehicle?.vehicle_no || `vehicle ${entry.transport}`}`} onClick={() => {
                                    setRemovalTarget({
                                      kind: 'vehicle', trainKey: activeTrain.key, wagonKey: wagon.key, entryKey: entry.key,
                                      label: vehicle?.vehicle_no || `vehicle #${entry.transport}`, wagonNumber: wagon.number
                                    });
                                  }} className="flex w-6 shrink-0 items-center justify-center border-l border-red-100 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700"><X className="h-3.5 w-3.5" /></button>
                                </div>
                                {editingThisEntry && editorPanel && popoverAnchor.current && (
                                  <AssignmentPopover anchor={popoverAnchor.current} mode="editor" onDismiss={dismissPopover}>{editorPanel}</AssignmentPopover>
                                )}
                              </div>
                            );
                          })}
                          <div className="min-w-0 max-w-full">
                            <button type="button" onClick={event => pickerOpen ? setPicker(null) : openPicker(activeTrain.key, wagon.key, event.currentTarget)} disabled={!vehicles.length} aria-haspopup="dialog" aria-controls={pickerOpen || wagonEditor?.isNew ? 'wagon-assignment-dialog' : undefined} aria-expanded={pickerOpen || Boolean(wagonEditor?.isNew)} aria-label={`Add vehicle to wagon ${wagon.number}`} className="flex min-h-16 min-w-20 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-blue-400 bg-blue-50/80 px-2 text-xs font-semibold text-blue-700 hover:border-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
                              <Plus className="h-4 w-4" />Add vehicle
                            </button>
                            {(pickerOpen || wagonEditor?.isNew) && popoverAnchor.current && (
                              <AssignmentPopover anchor={popoverAnchor.current} mode={pickerOpen ? 'picker' : 'editor'} onDismiss={dismissPopover}>
                                {pickerOpen ? pickerPanel : editorPanel}
                              </AssignmentPopover>
                            )}
                          </div>
                        </div>
                        {!collapsed && !vehicles.length && !wagon.entries.length && <p className="px-2 pb-2 text-xs text-slate-500">No vehicles available for this bulk transport.</p>}
                      </article>
                    );
                  })}
                </div>
              )}

              <button type="button" onClick={() => {
                let number = 1;
                while (activeTrain.wagons.some(wagon => wagon.number.trim() === String(number))) number++;
                updateTrain(activeTrain.key, train => ({ ...train, wagons: [...train.wagons, newWagon(String(number))] }));
              }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Plus className="h-4 w-4" />Add wagon</button>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-slate-900 p-3 text-white sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200"><Truck className="h-4 w-4 text-blue-300" />Assignment summary</h2>
              <p className="mt-1 text-xs text-slate-400">{state.trains.length} trains · {state.trains.reduce((total, train) => total + train.wagons.length, 0)} wagons · {summaryAvailable.length} vehicles remaining</p>
            </div>
            {dirty && <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold text-amber-300">Unsaved changes</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700 pt-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-slate-400">Quantity in vehicles</p>
              <p className="mt-1 break-words text-sm font-semibold tabular-nums sm:text-lg">{formatSummaryQuantity('vehicles')}</p>
              <p className="mt-1 text-xs text-slate-400">{summaryTotals.vehicleBags === null ? 'Invalid bags' : `${summaryTotals.vehicleBags} bags`}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-slate-400">Total assigned</p>
              <p className={`mt-1 break-words text-sm font-semibold tabular-nums sm:text-lg ${assignedQuantityColor}`}>{formatSummaryQuantity('assigned')}</p>
              <p className={`mt-1 text-xs ${summaryDifferenceColor(summaryTotals.differenceBags)}`}>{summaryTotals.unavailableAssignment ? 'Bags unavailable (vehicle missing)' : summaryTotals.assignedBags === null ? 'Invalid bags' : `${summaryTotals.assignedBags} bags`}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-slate-400">Diff (vehicles - assigned)</p>
              <p className="mt-1 break-words text-sm font-semibold tabular-nums sm:text-lg">
                {summaryTotals.unavailableAssignment ? <span className="text-red-400">Unavailable (vehicle missing)</span>
                  : !summaryTotals.quantities.length ? <span className="text-emerald-400">0</span>
                    : summaryTotals.quantities.map(({ unit, difference }, index) => (
                      <React.Fragment key={unit}>
                        {index > 0 && ' · '}
                        <span className={summaryDifferenceColor(difference)}>{difference === null ? `Invalid quantity (${unit || 'unit unavailable'})` : `${displayRemainingQuantity(difference)} ${unit}`}</span>
                      </React.Fragment>
                    ))}
              </p>
              <p className={`mt-1 text-xs ${summaryDifferenceColor(summaryTotals.differenceBags)}`}>
                {summaryTotals.unavailableAssignment ? 'Bags unavailable (vehicle missing)' : summaryTotals.differenceBags === null ? 'Invalid bags' : `${summaryTotals.differenceBags} bags`}
              </p>
            </div>
          </div>
          {editor && <p className="mt-2 text-xs text-slate-400">Vehicle totals include the entry being edited.</p>}
          {vehicleSummaries.length ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th scope="col" className="px-3 py-2">Vehicle</th>
                    {/* <th scope="col" className="px-3 py-2 text-right">Assigned quantity</th>
                    <th scope="col" className="px-3 py-2 text-right">Assigned bags</th> */}
                    <th scope="col" className="px-3 py-2 text-right">Remaining quantity</th>
                    <th scope="col" className="px-3 py-2 text-right">Remaining bags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {vehicleSummaries.map(({ vehicle, summary }) => (
                    <tr key={vehicle.id}>
                      <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-mono font-semibold">{vehicle.vehicle_no}</th>
                      {/* <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{summary.assigned.quantity === null ? 'Invalid quantity' : `${displayQuantity(summary.assigned.quantity)} ${getShortUnitLabel(vehicle.quantity_unit)}`}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{summary.assigned.bags === null ? 'Invalid bags' : summary.assigned.bags}</td> */}
                      <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${summaryRemainingColor(summary.remaining.quantity)}`}>{summary.remaining.quantity === null ? 'Invalid quantity' : `${displayRemainingQuantity(summary.remaining.quantity)} ${getShortUnitLabel(vehicle.quantity_unit)}`}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${summaryRemainingColor(summary.remaining.bags)}`}>{summary.remaining.bags === null ? 'Invalid bags' : summary.remaining.bags}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-3 text-xs text-slate-400">No vehicles available for this bulk transport.</p>}
          {editor && <p className="mt-3 text-xs text-amber-200">Finish or cancel the open vehicle entry before saving. {editor.trainKey !== activeTrainKey && <button type="button" onClick={() => setActiveTrainKey(editor.trainKey)} className="underline">Return to entry</button>}</p>}
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3 sm:flex-row sm:items-end sm:justify-end">
            <label className="text-xs font-semibold text-slate-300 sm:w-44">Assignment status
              <select className={`${inputClass} mt-1`} value={state.status} onChange={event => setState(current => ({ ...current, status: event.target.value as WagonAssignmentStatus }))}>
                <option value="draft">Draft</option><option value="pending">Pending</option><option value="submitted">Submitted</option>
              </select>
            </label>
            <button type="button" onClick={() => void save()} disabled={Boolean(editor)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" />{saving ? 'Saving...' : 'Save assignments'}</button>
          </div>
        </section>
      </fieldset>
      {removalTarget && (
        <ConfirmationModal
          isOpen
          title={removalTarget.kind === 'train' ? 'Remove train?' : removalTarget.kind === 'wagon' ? 'Remove wagon?' : 'Remove vehicle?'}
          message={removalTarget.kind === 'train'
            ? `Remove ${removalTarget.label} and all its wagons and vehicle assignments? Save assignments to apply this change.`
            : removalTarget.kind === 'wagon'
              ? `Remove wagon ${removalTarget.label} and its vehicle assignments? Save assignments to apply this change.`
              : `Remove ${removalTarget.label} from wagon ${removalTarget.wagonNumber}? Save assignments to apply this change.`}
          confirmLabel="Remove"
          onConfirm={confirmRemoval}
          onCancel={() => setRemovalTarget(null)}
        />
      )}
    </div>
  );
};
