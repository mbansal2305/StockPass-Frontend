import React from 'react';
import { formatQuantityWithUnit } from '../../utils/formatters';

interface OrderProgressBarProps {
  fulfilled: number;
  total: number;
  unit?: string;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const OrderProgressBar: React.FC<OrderProgressBarProps> = ({
  fulfilled,
  total,
  unit,
  showLabels = true,
  size = 'md'
}) => {
  const percentage = total > 0 ? Math.min(100, Math.round((fulfilled / total) * 100)) : 0;
  const isComplete = percentage >= 100;

  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className="w-full">
      {showLabels && (
        <div className="flex items-center justify-between text-xs mb-1 tabular-nums">
          <span className="text-slate-600 font-medium">
            {formatQuantityWithUnit(fulfilled, unit)} / {formatQuantityWithUnit(total, unit)}
          </span>
          <span className={`font-semibold ${isComplete ? 'text-emerald-700' : 'text-slate-700'}`}>
            {percentage}%
          </span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heightClass} border border-slate-200/60`}>
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isComplete ? 'bg-emerald-600' : percentage > 50 ? 'bg-blue-600' : 'bg-amber-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
