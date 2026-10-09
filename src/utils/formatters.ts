export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatWeight(mt: number | undefined | null): string {
  if (mt === undefined || mt === null || isNaN(mt)) return '0.00 MT';
  return `${Number(mt).toFixed(2)} MT`;
}

export function formatQuantityWithUnit(qty: number | undefined | null, unit?: string): string {
  if (qty === undefined || qty === null || isNaN(qty)) return '0';
  const unitStr = unit === 'kg' ? 'KG' : unit === 'quintal' ? 'Qtl' : 'MT';
  return `${Number(qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unitStr}`;
}

export function getUnitLabel(unit?: string): string {
  if (unit === 'kg') return 'KG';
  if (unit === 'quintal') return 'Quintal';
  return 'MT';
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function getDaysRemaining(expiryDateStr: string): { days: number; isExpired: boolean; isUrgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = expiryDateStr.split('-');
  const expiry = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const diffTime = expiry.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    days,
    isExpired: days < 0,
    isUrgent: days >= 0 && days <= 5
  };
}

export function getClientTypeLabel(type: string): string {
  switch (type?.toUpperCase()) {
    case 'MY_FIRM': return 'My Firm';
    case 'MY_GODOWN': return 'My Godown';
    case 'OTHER_GODOWN': return 'Other Godown';
    case 'COMPANY': return 'Company';
    case 'LOCATION': return 'Mandi / Yard';
    default: return type || '-';
  }
}

export function getClientTypeBadge(type: string): { bg: string; text: string; border: string } {
  switch (type?.toUpperCase()) {
    case 'MY_FIRM':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'MY_GODOWN':
      return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
    case 'OTHER_GODOWN':
      return { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' };
    case 'COMPANY':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'LOCATION':
      return { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  }
}

export function getClientFlagBadge(flag: string): { label: string; bg: string; text: string; border: string } {
  switch (flag?.toUpperCase()) {
    case 'GOOD':
      return { label: 'Good Standing', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'NEUTRAL':
      return { label: 'Neutral', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
    case 'BAD':
      return { label: 'Caution', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'BLACKLISTED':
      return { label: 'Blacklisted', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' };
    case 'FRAUD':
      return { label: 'Fraud Risk', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' };
    case 'UNREASONABLE_CLAIMS':
      return { label: 'Excess Claims', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' };
    default:
      return { label: flag || '-', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  }
}

export function getTransportStatusBadge(status: string): { label: string; bg: string; text: string; border: string } {
  switch (status) {
    case 'PENDING':
      return { label: 'Loading / Pending', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'DELIVERY':
      return { label: 'In Transit / Delivery', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' };
    case 'FINANCE':
      return { label: 'Unloaded / Finance Audit', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' };
    case 'PAID':
      return { label: 'Settled & Paid', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
    default:
      return { label: status, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  }
}