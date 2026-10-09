import React, { useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { apiClient, TransportClientOption } from '../../api';
import { BusinessClient, Transport, Transporter, User } from '../../types';
import { formatCurrency, formatDate, formatQuantityWithUnit } from '../../utils/formatters';
import { getImageSource } from '../../utils/images';

export interface TransportPaymentBillDraft {
  receivedWeight: number;
  unloadDate: string;
  rent: number;
  rentType: 'per_unit' | 'fix';
  advanceByClient: number;
  advanceByFirm: number;
  shortageAmount: number;
  extraAmount: number;
  finalPaid: number;
  notes: string;
}

interface TransportPaymentBillProps {
  transport: Transport;
  draft: TransportPaymentBillDraft;
  clients: BusinessClient[];
  transporters: Transporter[];
  billingFirmOptions?: TransportClientOption[];
  currentUser: User | null;
  onClose: () => void;
}

const quantityToQuintals = (quantity: number, unit: Transport['grossWeightUnit']): number => {
  if (unit === 'mt') return quantity * 10;
  if (unit === 'kg') return quantity / 100;
  return quantity;
};

const unitName = (unit: Transport['grossWeightUnit']): string => {
  if (unit === 'mt') return 'MT';
  if (unit === 'kg') return 'KG';
  return 'Qtl';
};

export const TransportPaymentBill: React.FC<TransportPaymentBillProps> = ({
  transport,
  draft,
  clients,
  transporters,
  billingFirmOptions = [],
  currentUser,
  onClose
}) => {
  const [logoSourceIndex, setLogoSourceIndex] = useState(0);
  const [resolvedLogoSource, setResolvedLogoSource] = useState('');

  const firmDetails = clients.find(client => client.id === transport.billingFirmId);
  const logoFirmOption = billingFirmOptions.find(client => client.id === transport.billingFirmId);
  const logoSources = useMemo(() => [
    firmDetails?.imageUrl,
    logoFirmOption?.imageUrl,
    firmDetails?.image,
    firmDetails?.profile_picture,
    logoFirmOption?.image
  ].map(getImageSource).filter((source, index, sources) => source && sources.indexOf(source) === index), [
    firmDetails,
    logoFirmOption
  ]);
  const activeLogoSource = logoSources[logoSourceIndex] || '';

  useEffect(() => {
    if (!activeLogoSource) {
      setResolvedLogoSource('');
      return;
    }
    if (!/^https?:\/\//i.test(activeLogoSource)) {
      setResolvedLogoSource(activeLogoSource);
      return;
    }

    let cancelled = false;
    let objectUrl = '';
    setResolvedLogoSource('');
    const headers = new Headers({ 'ngrok-skip-browser-warning': 'true' });
    const accessToken = apiClient.getAccessToken();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    fetch(activeLogoSource, { headers })
      .then(async response => {
        if (!response.ok) throw new Error(`Logo request failed (${response.status})`);
        const imageBlob = await response.blob();
        if (imageBlob.type.includes('text/html')) throw new Error('Logo request returned an HTML page');
        const contentType = imageBlob.type.startsWith('image/') ? imageBlob.type : 'image/jpeg';
        return new Blob([imageBlob], { type: contentType });
      })
      .then(imageBlob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(imageBlob);
        setResolvedLogoSource(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLogoSourceIndex(index => index + 1);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeLogoSource]);

  const gross = Number(transport.grossWeight) || 0;
  const received = Number(draft.receivedWeight) || 0;
  const difference = quantityToQuintals(received - gross, transport.grossWeightUnit);
  const billableQuantity = received > 0 ? Math.min(gross, received) : gross;
  const totalRent = Math.trunc(draft.rentType === 'per_unit' ? billableQuantity * draft.rent : draft.rent);
  const balance = totalRent - draft.advanceByClient - draft.advanceByFirm - draft.shortageAmount - draft.finalPaid + draft.extraAmount;
  const firm = firmDetails?.name || 'Billing Firm';
  const transporter = transporters.find(item => item.id === transport.transporterId)?.name || '-';
  const initials = firm.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const today = new Date();
  const billDate = formatDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);

  return (
    <div className="payment-bill-print-root fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
      <article className="payment-bill-paper mx-auto max-w-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-10">
        <div className="no-print mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-sm font-semibold text-slate-900">Payment bill preview</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
            <button type="button" title="Close preview" aria-label="Close bill preview" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <header className="flex items-center gap-4 border-b-2 border-slate-900 pb-5 print:gap-3 print:pb-2">
          <div aria-label="Firm logo" className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-slate-300 bg-slate-50 text-lg font-bold text-slate-500 print:h-12 print:w-12 print:border-0 print:bg-white">
            {resolvedLogoSource
              ? <img key={resolvedLogoSource} src={resolvedLogoSource} alt={`${firm} logo`} onError={() => setLogoSourceIndex(index => Math.min(index + 1, logoSources.length))} className="h-full w-full object-contain" />
              : initials || 'LOGO'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Transport settlement</p>
            <h1 className="mt-1 break-words text-xl font-bold text-slate-950 print:text-lg">{firm}</h1>
            {firmDetails && <p className="mt-1 text-xs text-slate-600">{[firmDetails.address, firmDetails.city, firmDetails.pincode].filter(Boolean).join(', ')}</p>}
            {firmDetails?.phone && <p className="mt-0.5 text-xs text-slate-600">Phone: {firmDetails.phone}</p>}
            {firmDetails?.gstin && <p className="mt-0.5 text-xs text-slate-600">GSTIN: {firmDetails.gstin}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bill no.</p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-900">{transport.billNumber}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bill Date</p>
            <p className="mt-1 text-xs font-medium text-slate-800">{billDate}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Unloading Date</p>
            <p className="mt-1 text-xs font-medium text-slate-800">{formatDate(draft.unloadDate)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-8 gap-y-4 border-b border-slate-200 py-5 print:gap-y-2 print:py-2 sm:grid-cols-2">
          <div><p className="text-[10px] font-semibold uppercase text-slate-500">Transporter</p><p className="mt-1 text-sm font-semibold text-slate-900">{transporter}</p></div>
          <div><p className="text-[10px] font-semibold uppercase text-slate-500">Vehicle number</p><p className="mt-1 font-mono text-sm font-semibold text-slate-900">{transport.vehicleNumber}</p></div>
        </section>

        <section className="py-5 print:py-2">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 print:mb-1">Weight and freight</h2>
          <div className="overflow-hidden border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr><th className="px-3 py-2 print:py-1">Gross weight</th><th className="px-3 py-2 print:py-1">Received weight</th><th className="px-3 py-2 text-right print:py-1">Difference</th><th className="px-3 py-2 text-right print:py-1">Rate</th><th className="px-3 py-2 text-right print:py-1">Freight amount</th></tr>
              </thead>
              <tbody><tr className="font-semibold text-slate-900">
                <td className="px-3 py-3 print:py-1">{formatQuantityWithUnit(gross, transport.grossWeightUnit)}</td>
                <td className="px-3 py-3 print:py-1">{formatQuantityWithUnit(received, transport.grossWeightUnit)}</td>
                <td className="px-3 py-3 text-right print:py-1">{difference > 0 ? '+' : ''}{difference.toFixed(2)} Qtl</td>
                <td className="px-3 py-3 text-right print:py-1">{formatCurrency(draft.rent)}{draft.rentType === 'per_unit' ? ` / ${unitName(transport.grossWeightUnit)}` : ' (fixed)'}</td>
                <td className="px-3 py-3 text-right print:py-1">{formatCurrency(totalRent)}</td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section className="ml-auto max-w-sm border-t border-slate-200 pt-4 print:pt-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 print:mb-1">Settlement</h2>
          <dl className="space-y-2 text-xs print:space-y-1">
            <div className="flex justify-between gap-4"><dt className="text-slate-600">Freight amount</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(totalRent)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-600">Hamali (advance by party)</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(draft.advanceByClient)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-600">Advance paid by firm</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(draft.advanceByFirm)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-600">Shortage</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(draft.shortageAmount)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-600">Extra charges</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(draft.extraAmount)}</dd></div>
            <div className="flex justify-between gap-4 border-b border-slate-200 pb-2"><dt className="text-slate-600">Paid</dt><dd className="font-mono font-medium text-slate-900">{formatCurrency(draft.finalPaid)}</dd></div>
            <div className="flex justify-between gap-4 pt-1 text-sm font-bold"><dt className="text-slate-900">Balance due</dt><dd className="font-mono text-slate-900">{formatCurrency(balance)}</dd></div>
          </dl>
        </section>

        {draft.notes && <p className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-600 print:mt-3 print:pt-2">Notes: {draft.notes}</p>}
        <p className="mt-4 text-xs text-slate-600 print:mt-2">Bill Generated by: <span className="font-semibold text-slate-900">{currentUser?.name || 'Operator'}</span></p>
        <footer className="mt-14 grid grid-cols-2 gap-12 text-center text-[10px] text-slate-500 print:mt-8 print:gap-8">
          <div className="border-t border-slate-300 pt-2">Transporter signature</div>
          <div className="border-t border-slate-300 pt-2">Authorised signatory</div>
        </footer>
      </article>
    </div>
  );
};
