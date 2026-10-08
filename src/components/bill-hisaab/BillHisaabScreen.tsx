import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Search, X } from 'lucide-react';
import { billsApi, BillHisaabSearchResult } from '../../api/bills';
import { masterApi, SelectionFirm } from '../../api/master';
import { useApp } from '../../context/AppContext';
import { SearchableOption, SearchableSelect } from '../common/SearchableSelect';

interface Deduction {
  id: string;
  label: string;
  amount: string;
  rate?: string;
}

interface BillHisaabForm {
  partyName: string;
  firmName: string;
  vehicleNumber: string;
  billNumber: string;
  billDate: string;
  brokerName: string;
  billType: string;
  weight: string;
  weightUnit: string;
  rate: string;
  deductions: Deduction[];
  extra: string;
  advanceDate: string;
  advanceAmount: string;
  gstAmount: string;
}

const deductionFields = [
  { id: 'cd', label: 'CD' },
  { id: 'kaata-farak', label: 'Kaata Farak' },
  { id: 'weight-difference', label: 'Weight Difference' },
  { id: 'rate-difference', label: 'Rate Difference' },
  { id: 'claim', label: 'Claim' },
  { id: 'gst-claim', label: 'GST Claim' },
  { id: 'dalali', label: 'Dalali', hasRate: true },
  { id: 'tds', label: 'TDS' },
  { id: 'round-off', label: 'Round Off' }
];

const today = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDate = (value: string): string => {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const numberValue = (value: string): number => value.trim() ? Number(value) || 0 : 0;
const displayNumber = (value: number): string =>
  value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const pdfFileName = (form: BillHisaabForm): string =>
  [form.billNumber, form.partyName, form.vehicleNumber]
    .map(value => value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('-') || 'Bill-Hisaab';

const makeInitialDeductions = (): Deduction[] =>
  deductionFields.map(field => ({
    id: field.id,
    label: field.label,
    amount: '',
    ...(field.hasRate ? { rate: '' } : {})
  }));

const decimalInputClass = 'w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

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
      if (/^-?\d*(?:\.\d*)?$/.test(next)) onChange(next);
    }}
    className={`${decimalInputClass} ${className}`}
  />
);

const getBillTotals = (form: BillHisaabForm) => {
  const amount = numberValue(form.weight) * numberValue(form.rate);
  const totalDeductions = form.deductions.reduce((sum, deduction) => sum + numberValue(deduction.amount), 0);
  const totalPayable = amount - totalDeductions + numberValue(form.extra);
  return {
    amount,
    totalDeductions,
    totalPayable,
    leftToBePaid: totalPayable - numberValue(form.advanceAmount)
  };
};

const BillHisaabPreview: React.FC<{
  form: BillHisaabForm;
  logo?: string | null;
  onClose: () => void;
}> = ({ form, logo, onClose }) => {
  const totals = getBillTotals(form);
  const { showToast } = useApp();
  const filename = `${pdfFileName(form)}.pdf`;
  useEffect(() => {
    const previousTitle = document.title;
    document.title = pdfFileName(form);
    return () => {
      document.title = previousTitle;
    };
  }, []);
  const copyFilename = async () => {
    try {
      await navigator.clipboard.writeText(filename);
      showToast('PDF filename copied', 'success');
    } catch (error) {
      showToast(error instanceof Error ? `Could not copy filename: ${error.message}` : 'Could not copy filename', 'error');
    }
  };
  return (
    <div className="bill-hisaab-print-root fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
      <article className="bill-hisaab-paper mx-auto max-w-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="no-print mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Bill Hisaab Preview</h2>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
              <span className="break-all font-mono">{filename}</span>
              <button
                type="button"
                onClick={copyFilename}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-sans font-semibold text-slate-700 hover:bg-slate-100"
              >
                Copy Filename
              </button>
            </div>
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

        <header className="mb-4 flex items-center justify-center gap-3 border border-slate-900 px-3 py-2">
          {logo && <img src={logo} alt={`${form.firmName} logo`} className="h-9 w-9 object-contain" />}
          <h1 className="text-center text-xl font-bold">{form.firmName}</h1>
        </header>

        <table className="w-full border-collapse text-sm">
          <tbody>
            <InfoRow label="Party Name" value={form.partyName} />
            <InfoRow label="Firm Name" value={form.firmName} />
            <InfoRow label="Broker Name" value={form.brokerName} />
            <InfoRow label="Vehicle No." value={form.vehicleNumber} />
            <InfoRow label="Bill No." value={form.billNumber} />
            <InfoRow label="Bill Date" value={formatDate(form.billDate)} />
            <InfoRow label="Type" value={form.billType} />
            <tr>
              <th className="w-2/5 border border-slate-900 px-2 py-2 text-left">Weight ({form.weightUnit})</th>
              <th className="border border-slate-900 px-2 py-2 text-right">Rate</th>
              <th className="border border-slate-900 px-2 py-2 text-right">Amount</th>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-2 text-right">{form.weight || '-'}</td>
              <td className="border border-slate-900 px-2 py-2 text-right">{form.rate || '-'}</td>
              <td className="border border-slate-900 px-2 py-2 text-right font-semibold">{displayNumber(totals.amount)}</td>
            </tr>
            <tr><th colSpan={3} className="border border-slate-900 bg-slate-100 px-2 py-2 text-left">Deductions</th></tr>
            {form.deductions.map(deduction => (
              <tr key={deduction.id}>
                <td className="border border-slate-900 px-2 py-2 font-medium">{deduction.label}</td>
                <td className="border border-slate-900 px-2 py-2 text-right">{deduction.rate || ''}</td>
                <td className="border border-slate-900 px-2 py-2 text-right">{deduction.amount || ''}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="border border-slate-900 px-2 py-2">Total Deductions</td>
              <td className="border border-slate-900 px-2 py-2" />
              <td className="border border-slate-900 px-2 py-2 text-right">{displayNumber(totals.totalDeductions)}</td>
            </tr>
            <InfoRow label="Extra" value={form.extra} />
            <tr className="font-bold">
              <td className="border border-slate-900 px-2 py-2">Total Payable</td>
              <td className="border border-slate-900 px-2 py-2" />
              <td className="border border-slate-900 px-2 py-2 text-right">{displayNumber(totals.totalPayable)}</td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-2" />
              <th className="border border-slate-900 px-2 py-2 text-left">Date</th>
              <th className="border border-slate-900 px-2 py-2 text-right">Amount</th>
            </tr>
            <tr>
              <th className="border border-slate-900 px-2 py-2 text-left">Advance Paid</th>
              <td className="border border-slate-900 px-2 py-2 text-left">{formatDate(form.advanceDate)}</td>
              <td className="border border-slate-900 px-2 py-2 text-right">{form.advanceAmount || ''}</td>
            </tr>
            <tr className="font-bold">
              <td colSpan={2} className="border border-slate-900 px-2 py-2">Left to be Paid</td>
              <td className="border border-slate-900 px-2 py-2 text-right">{displayNumber(totals.leftToBePaid)}</td>
            </tr>
            <InfoRow label="GST Amount" value={form.gstAmount} />
          </tbody>
        </table>
      </article>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <tr>
    <th className="w-2/5 border border-slate-900 px-2 py-2 text-left">{label}</th>
    <td colSpan={2} className="border border-slate-900 px-2 py-2">{value || ''}</td>
  </tr>
);

export const BillHisaabScreen: React.FC = () => {
  const { showToast } = useApp();
  const [firms, setFirms] = useState<SelectionFirm[]>([]);
  const [firmId, setFirmId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [form, setForm] = useState<BillHisaabForm | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    masterApi.selectFirms()
      .then(options => { if (!cancelled) setFirms(options); })
      .catch(error => {
        if (!cancelled) showToast(`Failed to load firms: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      });
    return () => { cancelled = true; };
  }, []);

  const firmOptions: SearchableOption[] = useMemo(
    () => firms.map(firm => ({ id: firm.id, label: firm.name })),
    [firms]
  );
  const selectedFirm = firms.find(firm => firm.id === firmId);

  const searchBill = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firmId) {
      showToast('Select a firm before searching for a bill', 'error');
      return;
    }
    if (!billNumber.trim()) {
      showToast('Enter a bill number before searching', 'error');
      return;
    }

    setIsSearching(true);
    setForm(null);
    setShowPreview(false);
    try {
      const result: BillHisaabSearchResult = await billsApi.search(firmId, billNumber.trim());
      setForm({
        partyName: result.from_client ?? '',
        firmName: result.billing_firm || selectedFirm?.name || '',
        vehicleNumber: result.vehicle_no ?? '',
        billNumber: result.bill_no || billNumber.trim(),
        billDate: today(),
        brokerName: '',
        billType: '',
        weight: String(result.gross_wt ?? ''),
        weightUnit: result.gross_wt_unit || '',
        rate: String(result.rent ?? ''),
        deductions: makeInitialDeductions(),
        extra: '',
        advanceDate: '',
        advanceAmount: '',
        gstAmount: ''
      });
    } catch (error) {
      const status = (error as { status?: number })?.status;
      showToast(
        status === 404
          ? 'No transport was found for this firm and bill number'
          : error instanceof Error ? error.message : 'Failed to search for the bill',
        'error'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const updateForm = <K extends keyof BillHisaabForm>(key: K, value: BillHisaabForm[K]) => {
    setForm(current => current ? { ...current, [key]: value } : current);
  };
  const updateDeduction = (id: string, key: 'rate' | 'amount', value: string) => {
    setForm(current => current ? {
      ...current,
      deductions: current.deductions.map(item => item.id === id ? { ...item, [key]: value } : item)
    } : current);
  };
  const totals = form ? getBillTotals(form) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bill Hisaab</h1>
          <p className="mt-1 text-sm text-slate-500">Search for a transport bill, enter settlement details, then save the bill as a PDF.</p>
        </div>
        {form && (
          <button type="button" onClick={() => setShowPreview(true)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
            <Printer className="h-4 w-4" /> Print PDF
          </button>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={searchBill} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_auto] sm:items-end">
          <label className="block text-sm font-semibold text-slate-700">Select Firm
            <div className="mt-1.5">
              <SearchableSelect id="bill-hisaab-firm" value={firmId} options={firmOptions} placeholder="Search and select a firm" onChange={value => {
                setFirmId(value);
                setForm(null);
              }} />
            </div>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Bill Number
            <input type="text" value={billNumber} onChange={event => setBillNumber(event.target.value)} className={`${decimalInputClass} mt-1.5`} />
          </label>
          <button type="submit" disabled={isSearching} className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60">
            <Search className="h-4 w-4" /> {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </section>

      {form && totals && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-center gap-3 border-b-2 border-slate-900 pb-3">
            {selectedFirm?.profilePicture && <img src={selectedFirm.profilePicture} alt={`${form.firmName} logo`} className="h-8 w-8 object-contain" />}
            <h2 className="text-center text-lg font-bold text-slate-900">{form.firmName}</h2>
          </div>

          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <ReadOnlyValue label="Party Name" value={form.partyName} />
            <ReadOnlyValue label="Firm Name" value={form.firmName} />
            <EditableText label="Broker Name" value={form.brokerName} onChange={value => updateForm('brokerName', value)} />
            <ReadOnlyValue label="Vehicle No." value={form.vehicleNumber} />
            <ReadOnlyValue label="Bill No." value={form.billNumber} />
            <EditableDate label="Bill Date" value={form.billDate} onChange={value => updateForm('billDate', value)} />
            <EditableText label="Type" value={form.billType} onChange={value => updateForm('billType', value)} />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead><tr className="bg-slate-50">
                <th className="border border-slate-300 px-3 py-2 text-left">Weight ({form.weightUnit || 'unit'})</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Rate</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Amount</th>
              </tr></thead>
              <tbody><tr>
                <td className="border border-slate-300 p-1.5"><DecimalField label="Weight" value={form.weight} onChange={value => updateForm('weight', value)} /></td>
                <td className="border border-slate-300 p-1.5"><DecimalField label="Rate" value={form.rate} onChange={value => updateForm('rate', value)} className="text-right" /></td>
                <td className="border border-slate-300 px-3 py-2 text-right font-semibold">{displayNumber(totals.amount)}</td>
              </tr></tbody>
            </table>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Deductions</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead><tr className="bg-slate-50">
                  <th className="border border-slate-300 px-3 py-2 text-left">Deduction</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">Rate</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">Amount</th>
                </tr></thead>
                <tbody>
                  {form.deductions.map(item => (
                    <tr key={item.id}>
                      <th className="border border-slate-300 px-3 py-2 text-left font-medium">{item.label}</th>
                      <td className="border border-slate-300 p-1.5">
                        {item.rate !== undefined && <DecimalField label={`${item.label} rate`} value={item.rate} onChange={value => updateDeduction(item.id, 'rate', value)} className="text-right" />}
                      </td>
                      <td className="border border-slate-300 p-1.5"><DecimalField label={`${item.label} amount`} value={item.amount} onChange={value => updateDeduction(item.id, 'amount', value)} className="text-right" /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <th colSpan={2} className="border border-slate-300 px-3 py-2 text-left">Total Deductions</th>
                    <td className="border border-slate-300 px-3 py-2 text-right">{displayNumber(totals.totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="ml-auto mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Extra
              <DecimalField label="Extra" value={form.extra} onChange={value => updateForm('extra', value)} className="mt-1.5" />
            </label>
            <ReadOnlyValue label="Total Payable" value={displayNumber(totals.totalPayable)} />
            <label className="text-sm font-semibold text-slate-700">Advance Paid
              <DecimalField label="Advance paid" value={form.advanceAmount} onChange={value => updateForm('advanceAmount', value)} className="mt-1.5" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Advance Date
              <input type="date" value={form.advanceDate} onChange={event => updateForm('advanceDate', event.target.value)} className={`${decimalInputClass} mt-1.5`} />
            </label>
            <ReadOnlyValue label="Left to be Paid" value={displayNumber(totals.leftToBePaid)} />
            <label className="text-sm font-semibold text-slate-700">GST Amount
              <DecimalField label="GST amount" value={form.gstAmount} onChange={value => updateForm('gstAmount', value)} className="mt-1.5" />
            </label>
          </div>
        </section>
      )}

      {showPreview && form && (
        <BillHisaabPreview form={form} logo={selectedFirm?.profilePicture} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
};

const ReadOnlyValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-sm font-semibold text-slate-700">
    {label}
    <div className="mt-1.5 min-h-[38px] rounded border border-slate-200 bg-slate-50 px-2.5 py-2 font-normal text-slate-800">{value}</div>
  </div>
);

const EditableText: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="text-sm font-semibold text-slate-700">{label}
    <input type="text" value={value} onChange={event => onChange(event.target.value)} className={`${decimalInputClass} mt-1.5`} />
  </label>
);

const EditableDate: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="text-sm font-semibold text-slate-700">{label}
    <input type="date" value={value} onChange={event => onChange(event.target.value)} className={`${decimalInputClass} mt-1.5`} />
  </label>
);
