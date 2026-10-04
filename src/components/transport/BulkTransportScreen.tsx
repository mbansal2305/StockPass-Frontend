import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, Transport, Transporter } from '../../types';
import { transportsApi } from '../../api';
import {
  ArrowLeft,
  Truck,
  Plus,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react';
import { formatWeight, formatCurrency } from '../../utils/formatters';

interface BulkTruckRow {
  id: string;
  vehicleNumber: string;
  transporterId: string;
  grossWeight: number;
  bagNumbers: number;
  rent: number;
  anugya: string;
  errors?: string[];
}

export const BulkTransportScreen: React.FC = () => {
  const {
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

  const preselectOrderId = pageParams.preselectOrderId;
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    preselectOrderId || orders.find(o => o.status === 'PENDING')?.id || orders[0]?.id || ''
  );

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);
  const commodityMap = useMemo(() => new Map(commodities.map(c => [c.id, c])), [commodities]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

  // Mode: 'manual' or 'upload'
  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual');

  // Manual rows
  const [rows, setRows] = useState<BulkTruckRow[]>([
    {
      id: 'row-1',
      vehicleNumber: 'MP04AB' + Math.floor(1000 + Math.random() * 9000),
      transporterId: transporters[0]?.id || '',
      grossWeight: 24,
      bagNumbers: 480,
      rent: 22000,
      anugya: 'AG-' + Math.floor(10000 + Math.random() * 90000)
    },
    {
      id: 'row-2',
      vehicleNumber: 'MP09CD' + Math.floor(1000 + Math.random() * 9000),
      transporterId: transporters[0]?.id || '',
      grossWeight: 24,
      bagNumbers: 480,
      rent: 22000,
      anugya: 'AG-' + Math.floor(10000 + Math.random() * 90000)
    }
  ]);

  // Upload Preview state
  const [uploadedRows, setUploadedRows] = useState<BulkTruckRow[]>([]);
  const [uploadErrors, setUploadErrors] = useState<{ row: number; field: string; error: string }[]>([]);
  const [fileUploadedName, setFileUploadedName] = useState<string | null>(null);

  // Remaining available calculation
  const remainingNeeded = selectedOrder ? Math.max(0, selectedOrder.quantity - selectedOrder.quantityFulfilled) : 0;
  
  const activeRows = entryMode === 'manual' ? rows : uploadedRows;
  const totalAllocatedBatch = activeRows.reduce((sum, r) => sum + (Number(r.grossWeight) || 0), 0);

  // Manual Row Handlers
  const handleAddManualRow = () => {
    const nextNum = rows.length + 1;
    setRows([
      ...rows,
      {
        id: `row-${Date.now()}-${nextNum}`,
        vehicleNumber: 'MP04EF' + Math.floor(1000 + Math.random() * 9000),
        transporterId: transporters[0]?.id || '',
        grossWeight: 24,
        bagNumbers: 480,
        rent: 22000,
        anugya: 'AG-' + Math.floor(10000 + Math.random() * 90000)
      }
    ]);
  };

  const handleRemoveManualRow = (id: string) => {
    if (rows.length <= 1) {
      showToast('At least one truck row must be present', 'error');
      return;
    }
    setRows(rows.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof BulkTruckRow, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // CSV Template Generator & Downloader
  const handleDownloadTemplate = () => {
    const headers = ['VehicleNumber', 'TransporterName', 'GrossWeightMT', 'Bags', 'RentINR', 'AnugyaPass'];
    const sampleRows = [
      ['MP04AB1234', transporters[0]?.name || 'Sharma Goods Transport Co.', '24.00', '480', '22000', 'AG-98214'],
      ['MP09CD5678', transporters[1]?.name || 'Rajput Roadways Logistics', '25.50', '510', '23500', 'AG-98215'],
      ['MP04EF9012', transporters[0]?.name || 'Sharma Goods Transport Co.', '22.00', '440', '21000', 'AG-98216']
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'bulk_transport_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Template downloaded: bulk_transport_template.csv', 'info');
  };

  // CSV File Parser & Validator
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploadedName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      if (lines.length <= 1) {
        showToast('The uploaded CSV file is empty or missing data rows', 'error');
        return;
      }

      const parsed: BulkTruckRow[] = [];
      const validationErrors: { row: number; field: string; error: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const rowNum = i + 1;

        const vehicleNo = cols[0] || '';
        const transpName = cols[1] || '';
        const grossWeight = parseFloat(cols[2]) || 0;
        const bagNumbers = parseInt(cols[3]) || 0;
        const rent = parseFloat(cols[4]) || 0;
        const anugya = cols[5] || '';

        // Match transporter
        const matchedTrp = transporters.find(
          t => t.name.toLowerCase() === transpName.toLowerCase() ||
               t.name.toLowerCase().includes(transpName.toLowerCase())
        ) || transporters[0];

        // Validations
        if (!vehicleNo) {
          validationErrors.push({ row: rowNum, field: 'VehicleNumber', error: 'Missing vehicle number' });
        }
        if (grossWeight <= 0) {
          validationErrors.push({ row: rowNum, field: 'GrossWeightMT', error: 'Weight must be > 0 MT' });
        }
        if (rent < 0) {
          validationErrors.push({ row: rowNum, field: 'RentINR', error: 'Rent cannot be negative' });
        }

        parsed.push({
          id: `uploaded-${i}`,
          vehicleNumber: vehicleNo.toUpperCase(),
          transporterId: matchedTrp.id,
          grossWeight,
          bagNumbers,
          rent,
          anugya
        });
      }

      setUploadedRows(parsed);
      setUploadErrors(validationErrors);

      if (validationErrors.length === 0) {
        showToast(`Successfully parsed ${parsed.length} truck consignments`, 'success');
      } else {
        showToast(`Found ${validationErrors.length} validation errors in CSV`, 'error');
      }
    };

    reader.readAsText(file);
  };

  // Execution: Confirm & Create Transports in Storage
  const handleConfirmCreation = async () => {
    if (!selectedOrder) {
      showToast('Please select a valid order', 'error');
      return;
    }

    const rowsToProcess = entryMode === 'manual' ? rows : uploadedRows;

    if (rowsToProcess.length === 0) {
      showToast('No truck rows to dispatch', 'error');
      return;
    }

    // Check manual errors
    for (const r of rowsToProcess) {
      if (!r.vehicleNumber.trim()) {
        showToast('All vehicles must have a valid vehicle registration number', 'error');
        return;
      }
      if (r.grossWeight <= 0) {
        showToast('All gross weights must be greater than zero MT', 'error');
        return;
      }
    }

    const defaultFirm = clients.find(c => c.type === 'MY_FIRM')?.id || clients[0]?.id;
    if (!defaultFirm) {
      showToast('A billing firm is required before dispatching transports', 'error');
      return;
    }
    const year = new Date().getFullYear();

    const createdList = rowsToProcess.map((r, idx) => {
      const billNum = `BIL-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        billNumber: billNum,
        billingFirmId: defaultFirm,
        commodityId: selectedOrder.commodityId,
        fromClientId: selectedOrder.fromClientId,
        toClientId: selectedOrder.toClientId,
        vehicleNumber: r.vehicleNumber.trim().toUpperCase(),
        transporterId: r.transporterId,
        grossWeight: Number(r.grossWeight),
        bagNumbers: Number(r.bagNumbers) || undefined,
        bagWeight: 50000,
        anugya: r.anugya.trim(),
        rent: Number(r.rent) || 0,
        rentType: 'fix' as const,
        advanceByClient: 0,
        advanceByFirm: Math.round((Number(r.rent) || 0) * 0.5),
        finalPaid: 0,
        status: 'PENDING' as const,
        items: [
          {
            orderId: selectedOrder.id,
            allocatedQuantity: Number(r.grossWeight)
          }
        ],
        notes: `Bulk dispatched under order ${selectedOrder.orderNumber}`,
        createdBy: currentUser?.name || 'Logistics Incharge'
      };
    });

    let createdCount = 0;
    try {
      for (const transport of createdList) {
        await transportsApi.add(transport, {}, { clients, commodities, orders, transporters });
        createdCount += 1;
      }
      await refreshData();
      showToast(`Successfully created ${createdCount} transport consignments!`, 'success');
      navigate('transport');
    } catch (error: any) {
      await refreshData();
      showToast(`Created ${createdCount} of ${createdList.length} transports. ${error.message || 'Bulk dispatch stopped.'}`, 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('transport')}
          className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Bulk Transport Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dispatch multiple vehicles and generate bill entries in a single operation for large contracts.
          </p>
        </div>
      </div>

      {/* STEP 1: SELECT ORDER */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Step 1: Select Contract Order
          </h2>
          <span className="text-[11px] text-slate-500">
            Choose the sales or purchase order for which trucks are being dispatched.
          </span>
        </div>

        <div>
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
          >
            {orders.map((ord) => {
              const comm = commodityMap.get(ord.commodityId)?.name || 'Commodity';
              const rem = Math.max(0, ord.quantity - ord.quantityFulfilled);
              return (
                <option key={ord.id} value={ord.id}>
                  {ord.orderNumber} — {ord.type} · {comm} · Remaining: {formatWeight(rem)} ({ord.status})
                </option>
              );
            })}
          </select>
        </div>

        {selectedOrder && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Contract Route</span>
              <div className="font-semibold text-slate-800 text-[11px] mt-0.5 truncate" title={clientMap.get(selectedOrder.fromClientId)}>
                {clientMap.get(selectedOrder.fromClientId)}
              </div>
              <div className="text-slate-500 text-[10px] flex items-center gap-0.5 mt-0.5 truncate" title={clientMap.get(selectedOrder.toClientId)}>
                <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                {clientMap.get(selectedOrder.toClientId)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Total Contract Size</span>
              <div className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">
                {formatWeight(selectedOrder.quantity)}
              </div>
              <div className="text-[10px] text-slate-400">{commodityMap.get(selectedOrder.commodityId)?.name}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Already Fulfilled</span>
              <div className="font-bold text-emerald-700 text-sm mt-0.5 tabular-nums">
                {formatWeight(selectedOrder.quantityFulfilled)}
              </div>
              <div className="text-[10px] text-slate-400">{Math.round((selectedOrder.quantityFulfilled / selectedOrder.quantity) * 100)}% lifted</div>
            </div>

            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <span className="text-blue-800 text-[10px] uppercase font-semibold block">Remaining Needed</span>
              <div className="font-bold text-blue-900 text-sm mt-0.5 tabular-nums">
                {formatWeight(remainingNeeded)}
              </div>
              <div className="text-[10px] text-blue-600">Balance capacity</div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: ENTER TRUCK INFORMATION */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Step 2: Enter Truck Consignments
            </h2>
            <p className="text-[11px] text-slate-500">
              Choose manual entry or upload a CSV file with vehicle dispatch details.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setEntryMode('manual')}
              className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                entryMode === 'manual' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Manual Grid Entry
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('upload')}
              className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                entryMode === 'upload' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulk CSV / Spreadsheet Upload
            </button>
          </div>
        </div>

        {/* OPTION A: MANUAL GRID ENTRY */}
        {entryMode === 'manual' && (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Vehicle Number *</th>
                    <th className="px-3 py-2.5">Transporter Agency *</th>
                    <th className="px-3 py-2.5 text-right">Gross Weight (MT) *</th>
                    <th className="px-3 py-2.5 text-right">Bags</th>
                    <th className="px-3 py-2.5 text-right">Rent (₹)</th>
                    <th className="px-3 py-2.5">Mandi Anugya</th>
                    <th className="px-3 py-2.5 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={row.vehicleNumber}
                          onChange={(e) => handleUpdateRow(row.id, 'vehicleNumber', e.target.value.toUpperCase())}
                          placeholder="e.g. MP04AB1234"
                          className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-2 py-1 uppercase text-slate-900"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <select
                          value={row.transporterId}
                          onChange={(e) => handleUpdateRow(row.id, 'transporterId', e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white"
                        >
                          {transporters.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                      
                          required
                          value={row.grossWeight}
                          onChange={(e) => handleUpdateRow(row.id, 'grossWeight', parseFloat(e.target.value) || 0)}
                          className="w-24 text-xs font-bold border border-slate-300 rounded px-2 py-1 text-right text-slate-900 tabular-nums"
                        />
                      </td>

                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          value={row.bagNumbers}
                          onChange={(e) => handleUpdateRow(row.id, 'bagNumbers', parseInt(e.target.value) || 0)}
                          className="w-20 text-xs border border-slate-300 rounded px-2 py-1 text-right text-slate-700 tabular-nums"
                        />
                      </td>

                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          
                          value={row.rent}
                          onChange={(e) => handleUpdateRow(row.id, 'rent', parseFloat(e.target.value) || 0)}
                          className="w-24 text-xs font-mono border border-slate-300 rounded px-2 py-1 text-right text-slate-700 tabular-nums"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.anugya}
                          onChange={(e) => handleUpdateRow(row.id, 'anugya', e.target.value)}
                          placeholder="AG-00000"
                          className="w-28 text-xs font-mono border border-slate-300 rounded px-2 py-1 text-slate-700"
                        />
                      </td>

                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveManualRow(row.id)}
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

            <button
              type="button"
              onClick={handleAddManualRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Truck Row
            </button>
          </div>
        )}

        {/* OPTION B: BULK CSV UPLOAD */}
        {entryMode === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Download Excel / CSV Template</h4>
                <p className="text-[11px] text-slate-500">
                  Pre-formatted template with vehicle number, transporter, gross weight, bags, rent, and anugya headers.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Download Template (.CSV)
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800">
                {fileUploadedName ? fileUploadedName : 'Click to select or drag & drop filled CSV file'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Comma-separated values (.csv)</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-3 block w-full max-w-xs mx-auto text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
              />
            </div>

            {/* Validation Errors Box if any */}
            {uploadErrors.length > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5">
                <div className="font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Validation Issues Detected in Uploaded File:
                </div>
                <div className="space-y-1 mt-1 max-h-32 overflow-y-auto">
                  {uploadErrors.map((err, idx) => (
                    <div key={idx} className="text-rose-700">
                      • <strong>Row {err.row} ({err.field})</strong>: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Uploaded Preview Table */}
            {uploadedRows.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-900">
                  Preview of Uploaded Consignments ({uploadedRows.length} vehicles)
                </span>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3 py-2">Vehicle No</th>
                        <th className="px-3 py-2">Transporter Agency</th>
                        <th className="px-3 py-2 text-right">Gross MT</th>
                        <th className="px-3 py-2 text-right">Bags</th>
                        <th className="px-3 py-2 text-right">Rent</th>
                        <th className="px-3 py-2">Mandi Anugya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {uploadedRows.map((r) => {
                        const trp = transporters.find(t => t.id === r.transporterId);
                        return (
                          <tr key={r.id}>
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{r.vehicleNumber}</td>
                            <td className="px-3 py-2 text-slate-700">{trp?.name || '-'}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900 tabular-nums">{formatWeight(r.grossWeight)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.bagNumbers}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">{formatCurrency(r.rent)}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{r.anugya || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SUMMARY BEFORE CREATION & ACTION BAR */}
      <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
              Pre-Dispatch Reconciliation Summary
            </span>
            <h3 className="text-sm font-bold text-white">
              Ready to Dispatch {activeRows.length} Vehicles for Order {selectedOrder?.orderNumber}
            </h3>
          </div>

          <div className="text-right text-xs">
            <span className="text-slate-400">Total Batch Freight: </span>
            <span className="font-mono font-bold text-white tabular-nums">
              {formatCurrency(activeRows.reduce((sum, r) => sum + (Number(r.rent) || 0), 0))}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Order Size</span>
            <strong className="text-sm tabular-nums text-white">{formatWeight(selectedOrder?.quantity)}</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Already Fulfilled</span>
            <strong className="text-sm tabular-nums text-emerald-400">{formatWeight(selectedOrder?.quantityFulfilled)}</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Remaining Balance</span>
            <strong className="text-sm tabular-nums text-amber-300">{formatWeight(remainingNeeded)}</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">New Transports</span>
            <strong className="text-sm tabular-nums text-white">{activeRows.length} trucks</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Batch Allocated MT</span>
            <strong className="text-sm tabular-nums text-blue-300">{formatWeight(totalAllocatedBatch)}</strong>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => navigate('transport')}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={activeRows.length === 0 || uploadErrors.length > 0}
            onClick={handleConfirmCreation}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm & Dispatch {activeRows.length} Transports
          </button>
        </div>
      </div>
    </div>
  );
};
