import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userService } from '../services/users';
import { UserForm } from './UserForm';
import { ClassSetupView } from './ClassSetupView';
import { AdminClassesView } from './AdminClassesView';
import { TeacherMyClassView } from './TeacherMyClassView';
import { StudentDirectoryView } from './StudentDirectoryView';
import { AttendanceView } from './AttendanceView';
import { ExaminationsView } from './ExaminationsView';
import { FeesFinanceView } from './FeesFinanceView';
import { AvailableSoonView } from './AvailableSoonView';
import { AnnouncementsView } from './AnnouncementsView';
import { DashboardView } from './DashboardView';
import { ProfilePage } from './ProfilePage';
import { Avatar } from './Avatar';
import {
  Users,
  GraduationCap,
  Briefcase,
  DollarSign,
  CalendarCheck,
  Building,
  LogOut,
  UserPlus,
  Search,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Clock,
  Award,
  Megaphone,
  LayoutDashboard,
  UserCircle,
  Edit3,
  UserX,
  UserCheck,
  Bell,
  Sun,
  Moon
} from 'lucide-react';

export const AdminDashboard = () => {
  const { user, logout, hasPermission, tenantSlug } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('role') || 'ALL';
    }
    return 'ALL';
  });

  const handleSelectRole = (role) => {
    setSelectedRoleFilter(role);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      if (role !== 'ALL') {
        url.searchParams.set('role', role);
      } else {
        url.searchParams.delete('role');
      }
      window.history.replaceState({}, '', url);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (targetUser) => {
    setEditingUser(targetUser);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (targetUser) => {
    const willDeactivate = targetUser.is_active !== false;
    const confirmMsg = willDeactivate
      ? `Are you sure you want to deactivate ${targetUser.full_name}? They will be prevented from logging in.`
      : `Reactivate account for ${targetUser.full_name}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (willDeactivate) {
        await userService.deactivateUser(targetUser.id);
      } else {
        await userService.updateUser(targetUser.id, { is_active: true });
      }
      await fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const isStudent = user?.role === 'STUDENT';
  const isStaff = user?.role === 'STAFF';

  // Dynamic RBAC navigation items
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: UserCircle,
      show: true,
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      show: hasPermission('users.read_all'),
    },
    {
      id: 'directory',
      label: 'Student Directory',
      icon: GraduationCap,
      show: hasPermission('students.read_directory') && !hasPermission('users.read_all'),
    },
    {
      id: 'classes',
      label: 'Classes',
      icon: Briefcase,
      show: user?.role === 'ADMIN' || hasPermission('academic_units.crud'),
    },
    {
      id: 'my_class',
      label: 'My Class',
      icon: Briefcase,
      show: hasPermission('teacher.my_class.view') && user?.role !== 'ADMIN',
    },
    {
      id: 'setup',
      label: 'Academic Setup',
      icon: Building,
      show: hasPermission('academic_units.crud'),
    },
    {
      id: 'attendance',
      label: isStudent || isStaff ? 'My Attendance' : 'Attendance',
      icon: CalendarCheck,
      show: hasPermission('attendance.read_class') || hasPermission('attendance.read_own'),
    },
    {
      id: 'exams',
      label: 'Examinations',
      icon: Award,
      badge: 'Soon',
      show: !isStudent,
    },
    {
      id: 'fees',
      label: isStudent ? 'My Fees' : 'Finance & Fees',
      icon: DollarSign,
      badge: 'Soon',
      show: true,
    },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: Megaphone,
      show: hasPermission('announcements.read'),
    },
  ].filter((item) => item.show);

  const [activeTab, setActiveTab] = useState(() => {
    return navItems[0]?.id || 'dashboard';
  });

  useEffect(() => {
    // Whitelist 'profile' so clicking My Profile does not get overwritten!
    if (activeTab === 'profile') return;
    if (navItems.length > 0 && !navItems.some((n) => n.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [navItems, activeTab]);

  const fetchUsers = async () => {
    if (!hasPermission('users.read_all')) return;
    setLoadingUsers(true);
    try {
      const data = await userService.listUsers();
      setUsersList(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const filteredUsers = usersList.filter((u) => {
    if (selectedRoleFilter !== 'ALL' && u.role !== selectedRoleFilter) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    const nameMatch = u.full_name?.toLowerCase().includes(q);
    const emailMatch = u.email?.toLowerCase().includes(q);
    const roleMatch = u.role?.toLowerCase().includes(q);
    const admMatch = u.admission_number?.toLowerCase().includes(q);
    return nameMatch || emailMatch || roleMatch || admMatch;
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-slate-900 text-[#1E293B] dark:text-slate-100 flex">
      {/* Fixed Left Sidebar per doc/design_system.md */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 flex flex-col justify-between shrink-0 shadow-sm fixed inset-y-0 left-0 z-30">
        <div>
          {/* Institution Header */}
          <div className="h-16 px-6 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FACC15] flex items-center justify-center text-[#1E293B] font-bold text-sm">
              EF
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#1E293B] dark:text-slate-100 leading-tight">EduFlow ERP</h2>
              <span className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium tracking-wide uppercase">
                Tenant: {tenantSlug}
              </span>
            </div>
          </div>

          {/* Dynamic RBAC Navigation */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-[#FACC15] text-slate-900 font-bold shadow-xs'
                      : 'text-[#64748B] dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isActive
                          ? 'bg-slate-900/15 text-slate-900 font-extrabold'
                          : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/60">
          <p className="text-[11px] text-[#64748B] dark:text-slate-400 font-semibold text-center">
            EduFlow ERP
          </p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center mt-0.5">
            Institutional Portal
          </p>
        </div>
      </aside>

      {/* Main Content Area (offset by sidebar width) */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen bg-[#F3F4F6] dark:bg-slate-900">
        {/* Top Navbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 text-sm text-[#64748B] dark:text-slate-400">
            <span className="font-semibold text-[#1E293B] dark:text-slate-100">Dashboard</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="capitalize font-medium text-slate-800 dark:text-slate-200">{activeTab.replace('_', ' ')}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 text-[11px] font-bold rounded-full border border-yellow-200 dark:border-yellow-800/40">
              Tenant: {tenantSlug}
            </span>

            {/* Dark Mode Toggle Button beside Notification Bell */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme mode"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#FACC15]" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              )}
            </button>

            <div
              onClick={() => setActiveTab('announcements')}
              className="relative p-2 rounded-xl text-gray-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Announcements & Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FACC15] ring-2 ring-white dark:ring-slate-900" />
            </div>

            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-950/40 text-[#22C55E] dark:text-green-400 text-xs font-bold rounded-full border border-green-200 dark:border-green-800/40">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Session Authenticated</span>
            </div>

            <div className="h-5 w-px bg-gray-200 dark:bg-slate-700" />

            {/* User Profile & Sign Out Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all cursor-pointer text-left"
                aria-expanded={profileDropdownOpen}
              >
                <Avatar user={user} size="sm" />
                <div className="hidden sm:block text-left text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[130px]">
                    {user?.full_name || user?.username}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{user?.role?.toLowerCase()}</p>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                    profileDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Floating Dropdown Card */}
              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 py-2 z-40">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {user?.full_name || user?.username}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {user?.email || user?.username}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/50">
                          {user?.role}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Tenant: {tenantSlug}
                        </span>
                      </div>
                    </div>

                    <div className="p-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('profile');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-yellow-50 dark:hover:bg-slate-700 hover:text-yellow-900 dark:hover:text-yellow-300 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <UserCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span>My Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* View Container */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* View 0: Dynamic Role-based Dashboard Landing */}
            {activeTab === 'dashboard' && (
              <DashboardView
                users={usersList}
                onNavigateToUsers={(role) => {
                  handleSelectRole(role);
                  setActiveTab('users');
                }}
                onOpenCreateUser={handleCreateUser}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {/* View 1: User Management (Admin) */}
            {activeTab === 'users' && (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[#1E293B] dark:text-slate-100">
                      Institutional User Management
                    </h1>
                    <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
                      Manage students, faculty, and administrative staff accounts
                    </p>
                  </div>

                  {hasPermission('users.create') && (
                    <button
                      onClick={handleCreateUser}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FACC15] hover:bg-[#EAB308] text-slate-900 font-bold text-sm rounded-xl shadow-xs transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Create User</span>
                    </button>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                      <div className="relative w-full sm:w-72">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-slate-400">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by name, email, or roll..."
                          className="w-full pl-9 pr-3.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-[#1E293B] dark:text-slate-200 placeholder:text-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                        />
                      </div>

                      {/* Role Filter Pills */}
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-900/80 p-1 rounded-lg border border-transparent dark:border-slate-700">
                        {[
                          { id: 'ALL', label: 'All' },
                          { id: 'STUDENT', label: 'Students' },
                          { id: 'TEACHER', label: 'Teachers' },
                          { id: 'STAFF', label: 'Staff' },
                        ].map((pill) => (
                          <button
                            key={pill.id}
                            onClick={() => handleSelectRole(pill.id)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                              selectedRoleFilter === pill.id
                                ? 'bg-white dark:bg-slate-700 text-[#1E293B] dark:text-slate-100 shadow-xs'
                                : 'text-gray-500 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200'
                            }`}
                          >
                            {pill.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-[#64748B] dark:text-slate-400">
                      Showing <span className="font-bold text-[#1E293B] dark:text-slate-200">{filteredUsers.length}</span> members
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-200">
                      <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                        <tr>
                          <th className="py-3 px-6">Member</th>
                          <th className="py-3 px-6">Role</th>
                          <th className="py-3 px-6">Profile Identifier</th>
                          <th className="py-3 px-6">Contact Phone</th>
                          <th className="py-3 px-6">Status</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {loadingUsers ? (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-xs text-[#64748B] dark:text-slate-400">
                              Loading institutional members...
                            </td>
                          </tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-xs text-[#64748B] dark:text-slate-400">
                              No records found.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((item, idx) => {
                            const isActive = item.is_active !== false;
                            return (
                              <tr
                                key={item.id || idx}
                                className={`hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors ${
                                  !isActive ? 'opacity-60 bg-gray-50/30 dark:bg-slate-800/40' : ''
                                }`}
                              >
                                <td className="py-3.5 px-6">
                                  <div className="flex items-center gap-3">
                                    <Avatar user={item} size="sm" />
                                    <div>
                                      <div className="font-semibold text-xs text-[#1E293B] dark:text-slate-100">{item.full_name}</div>
                                      {item.email && <div className="text-[11px] text-[#64748B] dark:text-slate-400">{item.email}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-6">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      item.role === 'ADMIN'
                                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50'
                                        : item.role === 'TEACHER'
                                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50'
                                        : item.role === 'STUDENT'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50'
                                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50'
                                    }`}
                                  >
                                    {item.role}
                                  </span>
                                </td>
                                <td className="py-3.5 px-6 text-xs text-[#64748B] dark:text-slate-400 font-mono">
                                  {item.profile?.admission_number ||
                                    item.profile?.employee_id ||
                                    item.profile?.admin_id ||
                                    (item.role === 'ADMIN' ? item.username : '—')}
                                </td>
                                <td className="py-3.5 px-6 text-xs text-[#64748B] dark:text-slate-400">
                                  {item.phone || '—'}
                                </td>
                                <td className="py-3.5 px-6">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                      isActive
                                        ? 'bg-green-50 dark:bg-green-950/40 text-[#22C55E] dark:text-green-400 border border-green-200/50 dark:border-green-800/50'
                                        : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/50'
                                    }`}
                                  >
                                    {isActive ? 'ACTIVE' : 'DEACTIVATED'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {hasPermission('users.update_others') && (
                                      <button
                                        onClick={() => handleEditUser(item)}
                                        title="Edit Member"
                                        className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                    )}
                                    {hasPermission('users.deactivate') && (
                                      <button
                                        onClick={() => handleToggleActive(item)}
                                        title={isActive ? 'Deactivate Member' : 'Reactivate Member'}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                          isActive
                                            ? 'text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                                            : 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/30'
                                        }`}
                                      >
                                        {isActive ? (
                                          <UserX className="w-4 h-4" />
                                        ) : (
                                          <UserCheck className="w-4 h-4" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* View 2: Classes (Admin) */}
            {activeTab === 'classes' && <AdminClassesView />}

            {/* View 3: Student Directory */}
            {activeTab === 'directory' && <StudentDirectoryView />}

            {/* View 4: My Class (Teacher) */}
            {activeTab === 'my_class' && <TeacherMyClassView />}

            {/* View 5: Academic Setup (Admin) */}
            {activeTab === 'setup' && <ClassSetupView />}

            {/* View 5: Attendance (Phase 4) */}
            {activeTab === 'attendance' && (
              <AttendanceView user={user} onNavigateTab={setActiveTab} />
            )}

            {/* View 6: Examinations (Phase 5 - Available Soon) */}
            {activeTab === 'exams' && (
              <AvailableSoonView
                moduleName="Examinations & Grading"
                description="The centralized examinations management, marks matrix entry, and student report card generation system is currently being finalized for your institution and will be available soon."
                icon={Award}
                features={[
                  "Multi-subject examination schedules and timetables",
                  "Direct student marks matrix entry per section",
                  "Customizable 10-point & letter grade scales",
                  "Automated student report cards & score rankings"
                ]}
              />
            )}

            {/* View 7: Fees & Finance (Phase 6 - Available Soon) */}
            {activeTab === 'fees' && (
              <AvailableSoonView
                moduleName="Finance & Fee Management"
                description="The institutional fee structure configuration, student invoice billing, and payment collection module is currently being prepared and will be activated soon."
                icon={DollarSign}
                features={[
                  "Annual and term-based fee structure configuration",
                  "Automated student invoice generation and balance tracking",
                  "Partial & full payment collection recording",
                  "Institutional revenue, dues, and payment breakdown reports"
                ]}
              />
            )}

            {/* View 8: Announcements (Phase 7) */}
            {activeTab === 'announcements' && <AnnouncementsView />}

            {/* View 9: My Profile (All Roles) */}
            {activeTab === 'profile' && <ProfilePage />}
          </div>
        </main>
      </div>

      {/* Unified User Creation / Edit Modal */}
      <UserForm
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onUserCreated={fetchUsers}
        initialData={editingUser}
      />
    </div>
  );
};
