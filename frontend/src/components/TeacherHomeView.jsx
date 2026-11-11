import React from 'react';
import {
  Briefcase,
  CalendarCheck,
  Award,
  Megaphone,
  ArrowRight,
  GraduationCap
} from 'lucide-react';

export const TeacherHomeView = ({ onNavigateTab, user }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1E293B] to-[#334155] rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-yellow-300 text-xs font-semibold mb-2">
            Faculty Portal
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Access assigned classrooms, mark student attendance, record marks, and publish announcements.
          </p>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <Briefcase className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">My Class</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              View roster and attendance statistics for your assigned class section.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('my_class')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <span>Open Class</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Daily Attendance</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Conduct daily roll call and track student absence rates.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
          >
            <span>Mark Roll Call</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Examinations</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Enter exam marks, evaluate grades, and prepare score sheets.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('exams')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            <span>Enter Marks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <Megaphone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Announcements</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Publish class homework notices and view school-wide updates.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('announcements')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
          >
            <span>View Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
