import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Trash2, X } from 'lucide-react';
import { masterApi, SelectionClient, SelectionFirm } from '../../api/master';
import { transportsApi } from '../../api/transports';
import { Transporter } from '../../types';
import { SearchableSelect, SearchableOption } from '../common/SearchableSelect';
import { useApp } from '../../context/AppContext';

interface ExpenseItem {
  id: number;
  date: string;
  commodityId: string;
  bags: string;
  netWeight: string;
  rate: string;
}

interface ExpenseAddition {
  id: string;
  type: string;
  rate: string;
  total: string;
  totalEdited?: boolean;
  custom?: boolean;
}

interface ExpenseBill {
  firmId: string;
  includeFirmAddress: boolean;
  billNumber: string;
  clientId: string;
  transporterId: string;
  driverContact: string;
  date: string;
  vehicleNumber: string;
  grossWeight: string;
  bardanWeight: string;
  items: ExpenseItem[];
  additions: ExpenseAddition[];
}

const additionTypes = [
  '(+) Dhami',
  '(+) Mandi Tax Amt',
  '(+) Hammali',
  '(+) Bardan',
  '(+) Freight Cost',
  '(+) Dalali',
  '(+) Insurance',
  '(+) Commission Amt'
];

const commissionType = '(+) Commission Amt';
const mandiTaxType = '(+) Mandi Tax Amt';
const freightType = '(+) Freight Cost';
const dalaliType = '(+) Dalali';

const localDateString = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatBillDate = (value: string): string => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const numericValue = (value: string): number => value.trim() ? Number(value) || 0 : 0;
const roundedInteger = (value: number): number => Math.round(value);
const displayNumber = (value: number, fractionDigits = 2): string =>
  value.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits });

const calculateBillTotals = (items: ExpenseItem[], additions: ExpenseAddition[]) => {
  const totalBags = items.reduce((sum, item) => sum + numericValue(item.bags), 0);
  const totalNetWeight = items.reduce((sum, item) => sum + numericValue(item.netWeight), 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + roundedInteger(numericValue(item.netWeight) * numericValue(item.rate)),
    0
  );
  const getAdditionTotal = (addition: ExpenseAddition, subtotal: number): number => {
    const rate = numericValue(addition.rate);
    if (!addition.custom && [commissionType, mandiTaxType, freightType, dalaliType].includes(addition.type)) {
      if (addition.totalEdited || !addition.rate) return numericValue(addition.total);
      if (addition.type === commissionType) return roundedInteger(subtotal * rate / 100);
      if (addition.type === mandiTaxType) return totalAmount * rate / 100;
      return roundedInteger(rate * totalNetWeight);
    }
    return numericValue(addition.total);
  };
  const subtotal = totalAmount + additions
    .filter(item => item.custom || item.type !== commissionType)
    .reduce((sum, item) => sum + getAdditionTotal(item, 0), 0);
  const commission = additions.find(item => !item.custom && item.type === commissionType);
  const grandTotal = roundedInteger(subtotal + (commission ? getAdditionTotal(commission, subtotal) : 0));
  return {
    totalBags,
    totalNetWeight,
    totalAmount,
    subtotal,
    grandTotal,
    getAdditionTotal
  };
};

const createInitialBill = (): ExpenseBill => {
  const today = localDateString();
  return {
    firmId: '',
    includeFirmAddress: false,
    billNumber: '',
    clientId: '',
    transporterId: '',
    driverContact: '',
    date: today,
    vehicleNumber: '',
    grossWeight: '',
    bardanWeight: '',
    items: [{ id: 1, date: today, commodityId: '', bags: '', netWeight: '', rate: '' }],
    additions: additionTypes.map((type, index) => ({ id: `fixed-${index}`, type, rate: '', total: '' }))
  };
};

const decimalFieldClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const DecimalField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ label, value, onChange, className = '' }) => (
  <input
    type="text"
    inputMode="decimal"
    aria-label={label}
    value={value}
    onChange={event => {
      const next = event.target.value;
      if (/^\d*(?:\.\d*)?$/.test(next)) onChange(next);
    }}
    className={`${decimalFieldClass} ${className}`}
  />
);

const ExpenseBillPreview: React.FC<{
  bill: ExpenseBill;
  firms: SelectionFirm[];
  clients: SelectionClient[];
  transporters: Transporter[];
  commodities: Array<{ id: string; name: string; type: string }>;
  onClose: () => void;
}> = ({ bill, firms, clients, transporters, commodities, onClose }) => {
  const firm = firms.find(item => item.id === bill.firmId);
  const client = clients.find(item => item.id === bill.clientId);
  const transporter = transporters.find(item => item.id === bill.transporterId);
  const { totalBags, totalNetWeight, totalAmount, subtotal, grandTotal, getAdditionTotal } =
    calculateBillTotals(bill.items, bill.additions);
  const additions = bill.additions.filter(item => item.custom || item.type !== commissionType);
  const commission = bill.additions.find(item => !item.custom && item.type === commissionType);
  const ratePerQuintal = totalNetWeight ? grandTotal / totalNetWeight : 0;
  const netWeight = bill.grossWeight || bill.bardanWeight
    ? numericValue(bill.grossWeight) - numericValue(bill.bardanWeight)
    : null;

  return (
    <div className="expense-bill-print-root fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
      <article className="expense-bill-paper mx-auto max-w-5xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="no-print mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Expense bill preview</h2>
            <p className="mt-1 text-xs text-slate-500">Use Save PDF and choose a destination in the print dialog.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
              <Printer className="h-4 w-4" /> Save PDF
            </button>
            <button type="button" title="Close preview" aria-label="Close bill preview" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <header className="mb-5 flex flex-col items-center justify-center border-b-2 border-slate-900 pb-4">
          <div className="flex max-w-full items-center justify-center gap-3">
            {firm?.profilePicture && (
              <img src={firm.profilePicture} alt={`${firm.name} logo`} className="h-8 w-8 shrink-0 object-contain" />
            )}
            <h1 className="break-words text-center text-2xl font-bold text-slate-950">{firm?.name}</h1>
          </div>
          {bill.includeFirmAddress && firm && (
            <p className="mt-2 text-center text-sm text-slate-700">
              {[firm.address, firm.city, firm.pincode].filter(Boolean).join(', ')}
            </p>
          )}
        </header>

        <section className="mb-5 grid w-full grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="w-full space-y-2 border border-slate-300 p-3">
            <p className="flex justify-between gap-3"><span className="font-semibold">Date:</span><span className="text-right">{formatBillDate(bill.date)}</span></p>
            <p className="flex justify-between gap-3"><span className="font-semibold">Bill No:</span><span className="text-right">{bill.billNumber || '-'}</span></p>
            <p className="flex justify-between gap-3"><span className="font-semibold">Party/Client:</span><span className="text-right">{client?.name || '-'}</span></p>
          </div>
          <div className="w-full space-y-2 border border-slate-300 p-3">
            <p className="flex justify-between gap-3"><span className="font-semibold">Vehicle No:</span><span className="text-right">{bill.vehicleNumber || '-'}</span></p>
            <p className="flex justify-between gap-3"><span className="font-semibold">Transporter:</span><span className="text-right">{transporter?.name || '-'}</span></p>
            <p className="flex justify-between gap-3"><span className="font-semibold">Driver Contact:</span><span className="text-right">{bill.driverContact || '-'}</span></p>
          </div>
          <div className="w-full space-y-2 border border-slate-300 p-3">
            <p className="flex justify-between gap-3"><span className="font-semibold">Gross weight:</span><span className="text-right">{bill.grossWeight || '-'}</span></p>
            <p className="flex justify-between gap-3"><span className="font-semibold">Bardan weight:</span><span className="text-right">{bill.bardanWeight || '-'}</span></p>
            <p className="flex justify-between gap-3"><span className="font-semibold">Net weight:</span><span className="text-right">{netWeight === null ? '-' : displayNumber(netWeight)}</span></p>
          </div>
        </section>

        <table className="mb-2 w-full table-fixed border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-left">
              {['Date', 'Product / Description', 'Bags', 'Net Wt', 'Rate', 'Amount'].map(label => (
                <th key={label} className="border border-slate-700 px-2 py-2 font-bold">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bill.items.map(item => {
              const commodity = commodities.find(option => option.id === item.commodityId);
              const amount = roundedInteger(numericValue(item.netWeight) * numericValue(item.rate));
              return (
                <tr key={item.id}>
                  <td className="border border-slate-400 px-2 py-2">{formatBillDate(item.date)}</td>
                  <td className="break-words border border-slate-400 px-2 py-2">{commodity ? `${commodity.name}${commodity.type ? ` (${commodity.type})` : ''}` : '-'}</td>
                  <td className="border border-slate-400 px-2 py-2 text-right">{item.bags || '-'}</td>
                  <td className="border border-slate-400 px-2 py-2 text-right">{item.netWeight || '-'}</td>
                  <td className="border border-slate-400 px-2 py-2 text-right">{item.rate || '-'}</td>
                  <td className="border border-slate-400 px-2 py-2 text-right">{item.netWeight && item.rate ? displayNumber(amount, 0) : '-'}</td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className="border border-slate-700 px-2 py-2" colSpan={2}>Total</td>
              <td className="border border-slate-700 px-2 py-2 text-right">{displayNumber(totalBags, 0)}</td>
              <td className="border border-slate-700 px-2 py-2 text-right">{displayNumber(totalNetWeight)}</td>
              <td className="border border-slate-700 px-2 py-2">Total Amount:</td>
              <td className="border border-slate-700 px-2 py-2 text-right">{displayNumber(totalAmount, 0)}</td>
            </tr>
          </tbody>
        </table>

        <section className="ml-auto mt-5 w-full max-w-md text-sm">
          <h2 className="mb-2 font-bold uppercase tracking-wide">Additions</h2>
          <table className="w-full border-collapse">
            <thead><tr><th className="border border-slate-500 px-2 py-1 text-left">Type</th><th className="border border-slate-500 px-2 py-1 text-right">Rate</th><th className="border border-slate-500 px-2 py-1 text-right">Total</th></tr></thead>
            <tbody>
              {additions.map(item => (
                <tr key={item.type}>
                  <td className="border border-slate-400 px-2 py-1 font-semibold">
                    {item.type ? `${item.custom ? '(+) ' : ''}${item.type}` : '-'}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-right">{item.rate || '-'}</td>
                  <td className="border border-slate-400 px-2 py-1 text-right">
                    {item.rate || item.totalEdited || item.total
                      ? displayNumber(getAdditionTotal(item, subtotal))
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 space-y-1 text-right">
            <p>Subtotal: <strong>{displayNumber(subtotal)}</strong></p>
            {commission && (
              <p className="flex justify-between gap-4 border-t border-slate-300 pt-1 text-left">
                <span className="font-semibold">{commission.type}</span>
                <span>{commission.rate ? `${commission.rate}%` : '-'} <strong className="ml-3">{commission.rate || commission.totalEdited || commission.total ? displayNumber(getAdditionTotal(commission, subtotal)) : '-'}</strong></span>
              </p>
            )}
            <p className="border-t border-slate-400 pt-1 text-base font-bold">Grand Total: {displayNumber(grandTotal)}</p>
            <p className="font-semibold">Rate: {displayNumber(ratePerQuintal)}</p>
          </div>
        </section>
      </article>
    </div>
  );
};

export const ExpenseBillScreen: React.FC = () => {
  const { showToast } = useApp();
  const [bill, setBill] = useState<ExpenseBill>(createInitialBill);
  const [firms, setFirms] = useState<SelectionFirm[]>([]);
  const [clients, setClients] = useState<SelectionClient[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [commodities, setCommodities] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadSelectors = async () => {
      const results = await Promise.allSettled([
        masterApi.selectFirms(),
        masterApi.selectAllClients(),
        transportsApi.selectAgencyOptions(),
        masterApi.selectCommodities()
      ]);
      if (cancelled) return;
      const [firmResult, clientResult, transporterResult, commodityResult] = results;
      if (firmResult.status === 'fulfilled') setFirms(firmResult.value);
      else showToast(`Failed to load firms: ${firmResult.reason instanceof Error ? firmResult.reason.message : 'Unknown error'}`, 'error');
      if (clientResult.status === 'fulfilled') setClients(clientResult.value);
      else showToast(`Failed to load parties: ${clientResult.reason instanceof Error ? clientResult.reason.message : 'Unknown error'}`, 'error');
      if (transporterResult.status === 'fulfilled') setTransporters(transporterResult.value);
      else showToast(`Failed to load transporters: ${transporterResult.reason instanceof Error ? transporterResult.reason.message : 'Unknown error'}`, 'error');
      if (commodityResult.status === 'fulfilled') setCommodities(commodityResult.value);
      else showToast(`Failed to load products: ${commodityResult.reason instanceof Error ? commodityResult.reason.message : 'Unknown error'}`, 'error');
    };
    void loadSelectors();
    return () => { cancelled = true; };
  }, []);

  const firmOptions: SearchableOption[] = useMemo(
    () => firms.map(firm => ({ id: firm.id, label: firm.name })),
    [firms]
  );
  const clientOptions: SearchableOption[] = useMemo(
    () => clients.map(client => ({
      id: client.id,
      label: [client.name, client.type, client.maanNo, client.city].filter(Boolean).join(' · '),
      searchText: `${client.name} ${client.type} ${client.maanNo} ${client.city}`
    })),
    [clients]
  );
  const transporterOptions: SearchableOption[] = useMemo(
    () => transporters.map(item => ({
      id: item.id,
      label: [item.name, item.agency, item.city].filter(Boolean).join(' · '),
      searchText: `${item.name} ${item.agency ?? ''} ${item.city ?? ''}`
    })),
    [transporters]
  );
  const commodityOptions: SearchableOption[] = useMemo(
    () => commodities.map(item => ({
      id: item.id,
      label: item.type ? `${item.name} · ${item.type}` : item.name,
      searchText: `${item.name} ${item.type}`
    })),
    [commodities]
  );

  const updateItem = (id: number, field: keyof ExpenseItem, value: string) => {
    setBill(current => ({
      ...current,
      items: current.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };
  const updateAddition = (id: string, field: 'type' | 'rate' | 'total', value: string) => {
    setBill(current => ({
      ...current,
      additions: current.additions.map(item => {
        if (item.id !== id) return item;
        if (field === 'rate') return { ...item, rate: value, totalEdited: false };
        if (field === 'total') return { ...item, total: value, totalEdited: true };
        return { ...item, type: value };
      })
    }));
  };

  const { totalBags, totalNetWeight, totalAmount, subtotal, grandTotal, getAdditionTotal } =
    calculateBillTotals(bill.items, bill.additions);
  const commission = bill.additions.find(item => !item.custom && item.type === commissionType);
  const netWeight = bill.grossWeight || bill.bardanWeight
    ? numericValue(bill.grossWeight) - numericValue(bill.bardanWeight)
    : null;
  const selectedFirm = firms.find(item => item.id === bill.firmId);

  const resetForm = () => {
    const hasEnteredData = Boolean(
      bill.firmId ||
      bill.includeFirmAddress ||
      bill.billNumber ||
      bill.clientId ||
      bill.transporterId ||
      bill.driverContact ||
      bill.vehicleNumber ||
      bill.grossWeight ||
      bill.bardanWeight ||
      bill.date !== localDateString() ||
      bill.items.length > 1 ||
      bill.additions.length > additionTypes.length ||
      bill.items.some(item =>
        item.commodityId ||
        item.bags ||
        item.netWeight ||
        item.rate ||
        item.date !== localDateString()
      ) ||
      bill.additions.some(item => item.rate || item.total || item.totalEdited)
    );
    if (hasEnteredData && !window.confirm('Discard the entered expense bill details and reset the form?')) return;
    setBill(createInitialBill());
    setShowPreview(false);
  };

  const openPreview = () => {
    if (!bill.firmId) {
      showToast('Select a firm before previewing the expense bill', 'error');
      return;
    }
    setShowPreview(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expense Bill</h1>
          <p className="mt-1 text-sm text-slate-500">Enter transport and item details, then preview or save the bill as a PDF.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Reset form
          </button>
          <button type="button" onClick={openPreview} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
            <Printer className="h-4 w-4" /> Print PDF
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <label className="block max-w-xl text-sm font-semibold text-slate-700">
          Select Firm
          <div className="mt-1.5">
            <SearchableSelect id="expense-firm" value={bill.firmId} options={firmOptions} placeholder="Search and select a firm" onChange={value => setBill(current => ({ ...current, firmId: value }))} />
          </div>
        </label>
        {selectedFirm && (
          <>
            <div className="mt-4 flex min-h-12 items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
              {selectedFirm.profilePicture && <img src={selectedFirm.profilePicture} alt={`${selectedFirm.name} logo`} className="h-7 w-7 shrink-0 object-contain" />}
              <h2 className="text-center text-lg font-bold text-slate-900">{selectedFirm.name}</h2>
            </div>
            {bill.includeFirmAddress && (
              <p className="mt-2 text-center text-sm text-slate-600">
                {[selectedFirm.address, selectedFirm.city, selectedFirm.pincode].filter(Boolean).join(', ')}
              </p>
            )}
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={bill.includeFirmAddress}
                onChange={event => setBill(current => ({ ...current, includeFirmAddress: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              Include firm address, city, and pincode below the PDF header
            </label>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-700">Transport details</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-600">Date
              <input type="date" value={bill.date} onChange={event => setBill(current => ({ ...current, date: event.target.value }))} className={`${decimalFieldClass} mt-1.5`} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Bill Number
              <input type="text" value={bill.billNumber} onChange={event => setBill(current => ({ ...current, billNumber: event.target.value }))} className={`${decimalFieldClass} mt-1.5`} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Party/Client
              <div className="mt-1.5"><SearchableSelect id="expense-party" value={bill.clientId} options={clientOptions} placeholder="Search parties" onChange={value => setBill(current => ({ ...current, clientId: value }))} /></div>
            </label>
          </div>
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-600">Vehicle Number
              <input type="text" value={bill.vehicleNumber} onChange={event => setBill(current => ({ ...current, vehicleNumber: event.target.value }))} className={`${decimalFieldClass} mt-1.5`} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Transporter
              <div className="mt-1.5"><SearchableSelect id="expense-transporter" value={bill.transporterId} options={transporterOptions} placeholder="Search transporters" onChange={value => setBill(current => ({ ...current, transporterId: value }))} /></div>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Driver Contact
              <input type="text" inputMode="numeric" maxLength={13} value={bill.driverContact} onChange={event => {
                const next = event.target.value;
                if (/^\d{0,13}$/.test(next)) setBill(current => ({ ...current, driverContact: next }));
              }} className={`${decimalFieldClass} mt-1.5`} />
            </label>
          </div>
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-600">Gross Weight
              <DecimalField label="Gross weight" value={bill.grossWeight} onChange={value => setBill(current => ({ ...current, grossWeight: value }))} className="mt-1.5" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Bardan Weight
              <DecimalField label="Bardan weight" value={bill.bardanWeight} onChange={value => setBill(current => ({ ...current, bardanWeight: value }))} className="mt-1.5" />
            </label>
            <div className="text-xs font-semibold text-slate-600">Net Weight
              <div className="mt-1.5 flex h-[38px] items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-800">{netWeight === null ? '' : displayNumber(netWeight)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Items</h2>
            <p className="mt-1 text-xs text-slate-500">Amount is calculated as net weight × rate and rounded to a whole number.</p>
          </div>
          <button type="button" onClick={() => setBill(current => ({
            ...current,
            items: [...current.items, {
              id: Math.max(0, ...current.items.map(item => item.id)) + 1,
              date: localDateString(),
              commodityId: '',
              bags: '',
              netWeight: '',
              rate: ''
            }]
          }))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead><tr className="bg-slate-50 text-left text-slate-600">
              <th className="border border-slate-200 px-2 py-2">Date</th>
              <th className="border border-slate-200 px-2 py-2">Product</th>
              <th className="border border-slate-200 px-2 py-2">Bags</th>
              <th className="border border-slate-200 px-2 py-2">Net Wt</th>
              <th className="border border-slate-200 px-2 py-2">Rate</th>
              <th className="border border-slate-200 px-2 py-2 text-right">Amount</th>
              <th className="border border-slate-200 px-2 py-2"><span className="sr-only">Remove</span></th>
            </tr></thead>
            <tbody>
              {bill.items.map(item => {
                const amount = roundedInteger(numericValue(item.netWeight) * numericValue(item.rate));
                return (
                  <tr key={item.id}>
                    <td className="border border-slate-200 p-1.5"><input aria-label="Item date" type="date" value={item.date} onChange={event => updateItem(item.id, 'date', event.target.value)} className="w-full min-w-32 rounded border border-slate-300 px-2 py-2" /></td>
                    <td className="border border-slate-200 p-1.5"><SearchableSelect id={`expense-product-${item.id}`} value={item.commodityId} options={commodityOptions} placeholder="Search products" onChange={value => updateItem(item.id, 'commodityId', value)} /></td>
                    <td className="border border-slate-200 p-1.5"><input aria-label="Bags" type="text" inputMode="numeric" value={item.bags} onChange={event => {
                      if (/^\d*$/.test(event.target.value)) updateItem(item.id, 'bags', event.target.value);
                    }} className="w-full min-w-20 rounded border border-slate-300 px-2 py-2 text-right" /></td>
                    <td className="border border-slate-200 p-1.5"><DecimalField label="Item net weight" value={item.netWeight} onChange={value => updateItem(item.id, 'netWeight', value)} className="min-w-24 text-right" /></td>
                    <td className="border border-slate-200 p-1.5"><DecimalField label="Item rate" value={item.rate} onChange={value => updateItem(item.id, 'rate', value)} className="min-w-24 text-right" /></td>
                    <td className="border border-slate-200 px-2 py-2 text-right font-semibold">{item.netWeight && item.rate ? displayNumber(amount, 0) : ''}</td>
                    <td className="border border-slate-200 p-1.5 text-center">
                      {bill.items.length > 1 && <button type="button" aria-label="Remove item row" onClick={() => setBill(current => ({ ...current, items: current.items.filter(row => row.id !== item.id) }))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-bold text-slate-800">
                <td className="border border-slate-200 px-2 py-2" colSpan={2}>Total</td>
                <td className="border border-slate-200 px-2 py-2 text-right">{displayNumber(totalBags, 0)}</td>
                <td className="border border-slate-200 px-2 py-2 text-right">{displayNumber(totalNetWeight)}</td>
                <td className="border border-slate-200 px-2 py-2">Total Amount</td>
                <td className="border border-slate-200 px-2 py-2 text-right">{displayNumber(totalAmount, 0)}</td>
                <td className="border border-slate-200" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Additions</h2>
          <button type="button" onClick={() => setBill(current => ({
            ...current,
            additions: [...current.additions, {
              id: `custom-${crypto.randomUUID()}`,
              type: '',
              rate: '',
              total: '',
              custom: true
            }]
          }))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add type
          </button>
        </div>
        <div className="ml-auto max-w-2xl">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)] gap-x-3 border-b border-slate-200 pb-2 text-xs font-bold uppercase text-slate-500">
            <span>Type</span><span>Rate</span><span>Total</span>
          </div>
          <div className="divide-y divide-slate-100">
            {bill.additions.filter(item => item.custom || item.type !== commissionType).map(item => {
              const isMandiTax = !item.custom && item.type === mandiTaxType;
              const isQuantityRate = !item.custom && (item.type === freightType || item.type === dalaliType);
              const isRateCalculated = !item.custom && [mandiTaxType, freightType, dalaliType].includes(item.type);
              const calculatedTotal = getAdditionTotal(item, subtotal);
              const totalValue = isRateCalculated
                ? (item.totalEdited ? item.total : item.rate ? String(calculatedTotal) : item.total)
                : item.total;
              return (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)] items-center gap-x-3 py-2">
                {!item.custom ? (
                  <span className="text-sm font-medium text-slate-700">{item.type}</span>
                ) : (
                  <div className="flex min-w-0 items-center gap-1">
                    <span aria-hidden="true" className="shrink-0 text-sm font-semibold text-slate-700">(+) </span>
                    <input
                      type="text"
                      aria-label="Custom addition type"
                      placeholder="Enter type"
                      value={item.type}
                      onChange={event => updateAddition(item.id, 'type', event.target.value)}
                      className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 text-sm"
                    />
                    <button type="button" aria-label="Remove addition" onClick={() => setBill(current => ({
                      ...current,
                      additions: current.additions.filter(addition => addition.id !== item.id)
                    }))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <DecimalField
                    label={`${item.type || 'Custom addition'} rate`}
                    value={item.rate}
                    onChange={value => updateAddition(item.id, 'rate', value)}
                  />
                  {isMandiTax && <span className="text-xs text-slate-500">%</span>}
                </div>
                {isQuantityRate ? (
                  <DecimalField
                    label={`${item.type} total`}
                    value={totalValue}
                    onChange={value => updateAddition(item.id, 'total', value)}
                    className="text-right"
                  />
                ) : (
                  <DecimalField
                    label={`${item.type || 'Custom addition'} total`}
                    value={totalValue}
                    onChange={value => updateAddition(item.id, 'total', value)}
                  />
                )}
              </div>
            );})}
          </div>
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-right text-sm">
            <p className="text-slate-600">Subtotal <strong className="ml-6 text-slate-900">{displayNumber(subtotal)}</strong></p>
            {commission && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)] items-center gap-x-3 border-t border-slate-200 pt-2 text-left">
                <span className="text-sm font-semibold text-slate-700">{commission.type}</span>
                <div className="flex items-center gap-1">
                  <DecimalField label={`${commission.type} rate`} value={commission.rate} onChange={value => updateAddition(commission.id, 'rate', value)} />
                  <span className="text-xs text-slate-500">%</span>
                </div>
                <DecimalField
                  label={`${commission.type} total`}
                  value={commission.totalEdited ? commission.total : commission.rate ? String(getAdditionTotal(commission, subtotal)) : commission.total}
                  onChange={value => updateAddition(commission.id, 'total', value)}
                  className="text-right"
                />
              </div>
            )}
            <p className="text-base font-bold text-slate-900">Grand Total <strong className="ml-4">{displayNumber(grandTotal)}</strong></p>
            <p className="font-semibold text-slate-700">Rate<strong className="ml-4 text-slate-900">{displayNumber(totalNetWeight ? grandTotal / totalNetWeight : 0)}</strong></p>
          </div>
        </div>
      </section>

      {showPreview && (
        <ExpenseBillPreview
          bill={bill}
          firms={firms}
          clients={clients}
          transporters={transporters}
          commodities={commodities}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
