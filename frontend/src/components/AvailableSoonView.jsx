import React from 'react';
import { Sparkles, CheckCircle2, Clock } from 'lucide-react';

/**
 * AvailableSoonView component matching the EduFlow brand design system.
 * Displays a clean, premium placeholder for modules currently under development.
 */
export const AvailableSoonView = ({
  moduleName,
  description,
  icon: Icon,
  features = [],
  estimatedRelease = 'Upcoming Release',
}) => {
  return (
    <div className="py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 sm:p-12 text-center transition-all">
        {/* Module Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-center mx-auto mb-5 shadow-xs">
          {Icon ? <Icon className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
        </div>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/50 mb-4">
          <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
          <span>Available Soon</span>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] dark:text-slate-100 tracking-tight mb-3">
          {moduleName}
        </h2>

        {/* Description */}
        <p className="text-sm text-[#64748B] dark:text-slate-400 max-w-lg mx-auto leading-relaxed mb-8">
          {description}
        </p>

        {/* Features / Capabilities Preview */}
        {features.length > 0 && (
          <div className="border-t border-gray-100 dark:border-slate-700/80 pt-6 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 text-center">
              Planned Capabilities
            </p>
            <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <span>Target Availability:</span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">{estimatedRelease}</span>
        </div>
      </div>
    </div>
  );
};
