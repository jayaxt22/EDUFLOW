import React from 'react';
import {
  GraduationCap,
  Briefcase,
  Users,
  UserPlus,
  ArrowRight,
  Building,
  DollarSign,
  Megaphone,
  CheckCircle2,
  Calendar,
  ShieldCheck
} from 'lucide-react';

export const AdminHomeView = ({
  users = [],
  onNavigateToUsers,
  onOpenCreateUser,
  onNavigateTab
}) => {
  const studentsCount = users.filter((u) => u.role === 'STUDENT').length;
  const teachersCount = users.filter((u) => u.role === 'TEACHER').length;
  const staffCount = users.filter((u) => u.role === 'STAFF').length;

  const financeStaffCount = users.filter(
    (u) => u.role === 'STAFF' && u.profile?.staff_type === 'FINANCE'
  ).length;

  const cards = [
    {
      id: 'students',
      title: 'Student Management',
      count: studentsCount,
      role: 'STUDENT',
      icon: GraduationCap,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      badgeColor: 'bg-blue-100 text-blue-800',
      description: 'Manage admissions, enrollments, classroom rosters, and guardian information.',
      actionLabel: 'View All Students',
    },
    {
      id: 'teachers',
      title: 'Teacher Management',
      count: teachersCount,
      role: 'TEACHER',
      icon: Briefcase,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      badgeColor: 'bg-purple-100 text-purple-800',
      description: 'Faculty profiles, subject allocations, and class teacher assignments.',
      actionLabel: 'View All Teachers',
    },
    {
      id: 'staff',
      title: 'Staff Management',
      count: staffCount,
      role: 'STAFF',
      icon: Users,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      badgeColor: 'bg-amber-100 text-amber-800',
      description: `Administrative staff, accounts (${financeStaffCount} Finance), and front-desk reception.`,
      actionLabel: 'View All Staff',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1E293B] to-[#334155] rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-yellow-300 text-xs font-semibold backdrop-blur-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Institution Overview Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Institutional Dashboard
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            Central administration hub for Horizon International Academy. Monitor student counts,
            teacher allocations, staff operations, and institutional workflows.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenCreateUser}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-sm rounded-xl shadow transition"
          >
            <UserPlus className="w-4 h-4" />
            + Add New User
          </button>
        </div>
      </div>

      {/* 3 Core Management Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1E293B] dark:text-slate-100">
            Management Portals
          </h2>
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
            Total Institution Users: {users.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${card.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${card.badgeColor}`}>
                      {card.count} {card.count === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[#1E293B] dark:text-slate-100 mb-1">
                    {card.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={() => onNavigateToUsers(card.role)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-700 hover:bg-[#1E293B] dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-gray-200 dark:border-slate-600 hover:border-[#1E293B] transition group"
                  >
                    <span>{card.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Access & Setup Shortcuts */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#1E293B] dark:text-slate-100 mb-4">
          Quick Setup & Module Navigation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigateTab('setup')}
            className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-400 hover:bg-yellow-50/40 dark:hover:bg-slate-700/60 text-left transition flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Academic Setup</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Classes, Sections & Subjects</p>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('fees')}
            className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-400 hover:bg-yellow-50/40 dark:hover:bg-slate-700/60 text-left transition flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Finance & Fees</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Invoices, Receipts & Dues</p>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('announcements')}
            className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-400 hover:bg-yellow-50/40 dark:hover:bg-slate-700/60 text-left transition flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Announcements</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Broadcast notices school-wide</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
