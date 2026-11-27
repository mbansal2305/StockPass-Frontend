import React from 'react';
import { TransportStatus } from '../../types';
import { Check, Clock, Truck, Calculator, CheckCircle2, XCircle } from 'lucide-react';

interface StatusStepperProps {
  currentStatus: TransportStatus;
  onStatusClick?: (status: TransportStatus) => void;
  canChangeStatus?: boolean;
}

const STAGES: { key: TransportStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'PENDING', label: '1. Pending / Loading', icon: Clock },
  { key: 'DELIVERY', label: '2. In Delivery', icon: Truck },
  { key: 'FINANCE', label: '3. Finance Audit', icon: Calculator },
  { key: 'PAID', label: '4. Settled & Paid', icon: CheckCircle2 }
];

export const StatusStepper: React.FC<StatusStepperProps> = ({
  currentStatus,
  onStatusClick,
  canChangeStatus = false
}) => {
  const currentIndex = STAGES.findIndex(s => s.key === currentStatus);
  const isRejected = currentStatus === 'REJECTED';

  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
        <div 
          className="absolute top-1/2 left-4 -translate-y-1/2 h-0.5 bg-emerald-600 transition-all duration-300 -z-0" 
          style={{ width: `${(Math.max(0, currentIndex) / (STAGES.length - 1)) * 100}%` }}
        />

        {STAGES.map((stage, idx) => {
          const isPassed = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isUpcoming = idx > currentIndex;
          const Icon = stage.icon;

          return (
            <button
              key={stage.key}
              disabled={!canChangeStatus}
              onClick={() => canChangeStatus && onStatusClick && onStatusClick(stage.key)}
              title={canChangeStatus ? `Set status to ${stage.label}` : stage.label}
              className={`relative z-10 flex flex-col items-center group ${
                canChangeStatus ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 shadow-xs ${
                  isPassed
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 ring-offset-1'
                    : 'bg-white border-2 border-slate-300 text-slate-400 group-hover:border-slate-400'
                }`}
              >
                {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isCurrent
                    ? 'text-blue-700 font-semibold'
                    : isPassed
                    ? 'text-emerald-700'
                    : 'text-slate-500'
                }`}
              >
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        {isRejected ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
            <XCircle className="h-3.5 w-3.5" />
            Rejected
          </span>
        ) : (
          canChangeStatus && (
            <button
              type="button"
              onClick={() => onStatusClick?.('REJECTED')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100"
            >
              <XCircle className="h-3.5 w-3.5" />
              Mark as Rejected
            </button>
          )
        )}
      </div>
    </div>
  );
};
