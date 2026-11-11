import React from 'react';
import {
  GraduationCap,
  CalendarCheck,
  DollarSign,
  Megaphone,
  ArrowRight,
  Award
} from 'lucide-react';

export const StudentHomeView = ({ onNavigateTab, user }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1E293B] to-[#334155] rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-yellow-300 text-xs font-semibold mb-2">
            Student & Guardian Portal
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Check your daily attendance records, view fee invoices, examine grades, and read school notices.
          </p>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">My Attendance</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Track your attendance percentage and review present/absent logs.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-700 hover:bg-[#1E293B] dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-gray-200 dark:border-slate-600 hover:border-[#1E293B] transition"
          >
            <span>View Attendance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50">
                Soon
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Fee Invoices & Dues</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              View your tuition bills, payment receipts, and balance breakdown.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('fees')}
            className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-700 hover:bg-[#1E293B] dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-gray-200 dark:border-slate-600 hover:border-[#1E293B] transition"
          >
            <span>View Fee Status</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <Megaphone className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">School Notices</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Stay updated with academic bulletins, exam dates, and class announcements.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('announcements')}
            className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-700 hover:bg-[#1E293B] dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-gray-200 dark:border-slate-600 hover:border-[#1E293B] transition"
          >
            <span>Open Notice Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
