import React, { useState, useEffect } from 'react';
import { attendanceService } from '../services/attendance';
import { academicsService } from '../services/academics';
import { useAuth } from '../context/AuthContext';
import { MarkAttendanceModal } from './MarkAttendanceModal';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Loader2,
  UserCheck,
  Calendar,
  Layers,
  Edit2,
  TrendingUp,
  Check,
  X,
  ArrowRight,
  BarChart3,
  Users,
  Briefcase,
  RefreshCw,
  Award,
  AlertCircle
} from 'lucide-react';

export const AttendanceView = ({ user: propUser, onNavigateTab }) => {
  const { user: authUser, hasPermission } = useAuth();
  const user = propUser || authUser;

  const isAdmin = user?.role === 'ADMIN' || hasPermission('academic_units.crud');
  const isTeacher = user?.role === 'TEACHER';
  const isStaff = user?.role === 'STAFF';
  const isStudent = user?.role === 'STUDENT';

  // Determine initial active sub-tab based on role
  const getInitialTab = () => {
    if (isAdmin) return 'analytics';
    if (isTeacher) return 'classroom';
    if (isStaff) return 'self';
    if (isStudent) return 'student_history';
    return 'classroom';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Sync initial tab when role is resolved
  useEffect(() => {
    if (user?.role) {
      if (user.role === 'ADMIN' || hasPermission('academic_units.crud')) {
        setActiveTab((prev) => (prev && prev !== 'classroom' ? prev : 'analytics'));
      } else if (user.role === 'TEACHER') {
        setActiveTab((prev) => (prev ? prev : 'classroom'));
      } else if (user.role === 'STAFF') {
        setActiveTab((prev) => (prev ? prev : 'self'));
      } else if (user.role === 'STUDENT') {
        setActiveTab('student_history');
      }
    }
  }, [user?.role]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Classroom Roll-call State
  const [sections, setSections] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [classroomSearch, setClassroomSearch] = useState('');
  const [correctingRecord, setCorrectingRecord] = useState(null);
  const [correctSubmitting, setCorrectSubmitting] = useState(false);

  // Admin School Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsSearch, setAnalyticsSearch] = useState('');

  // Self Check-in State
  const [selfStatus, setSelfStatus] = useState(null);
  const [loadingSelf, setLoadingSelf] = useState(false);
  const [selfSubmitting, setSelfSubmitting] = useState(false);
  const [selfForm, setSelfForm] = useState({
    status: 'PRESENT',
    remarks: '',
  });
  const [selfSuccessMsg, setSelfSuccessMsg] = useState('');
  const [isEditingSelf, setIsEditingSelf] = useState(false);

  // Student History State
  const [studentRecords, setStudentRecords] = useState([]);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Generic notifications
  const [errorMsg, setErrorMsg] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // 1. Initial Load: Sections for teachers/admins
  useEffect(() => {
    if (isAdmin || isTeacher) {
      loadSections();
    }
  }, [isAdmin, isTeacher]);

  const loadSections = async () => {
    try {
      const units = await academicsService.listUnits();
      let secList = (units || []).filter((u) => u.unit_type === 'SECTION');

      // Teachers who are not Admins can ONLY see and mark attendance for sections where they are the assigned Class Teacher
      if (isTeacher && !isAdmin) {
        secList = secList.filter((s) => {
          const matchMemId = user?.membership_id && String(s.class_teacher_id) === String(user.membership_id);
          const matchUserId = user?.id && String(s.class_teacher_id) === String(user.id);
          const matchName = user?.full_name && s.class_teacher_name?.trim().toLowerCase() === user.full_name?.trim().toLowerCase();
          return Boolean(matchMemId || matchUserId || matchName);
        });
      }

      setSections(secList);
      if (secList.length > 0) {
        setSelectedUnitId(secList[0].id);
      } else {
        setSelectedUnitId('');
      }
    } catch (err) {
      console.error('Failed to load sections:', err);
    }
  };

  // 2. Fetch Data according to Active Sub-tab
  useEffect(() => {
    if (activeTab === 'analytics' && (isAdmin || hasPermission('attendance.read_class'))) {
      fetchAnalytics();
    } else if (activeTab === 'classroom' && selectedUnitId) {
      fetchClassroomSummary();
    } else if (activeTab === 'self' && hasPermission('attendance.mark_self')) {
      fetchSelfStatus();
    } else if (activeTab === 'student_history' || isStudent) {
      fetchStudentRecords();
    }
  }, [activeTab, selectedDate, selectedUnitId]);

  // Fetch School Analytics
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    setErrorMsg(null);
    try {
      const data = await attendanceService.getSchoolAnalytics(selectedDate);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load school analytics:', err);
      setErrorMsg(err.message || 'Failed to load school analytics.');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Fetch Classroom Summary
  const fetchClassroomSummary = async () => {
    if (!selectedUnitId) return;
    setLoadingSummary(true);
    setErrorMsg(null);
    try {
      const data = await attendanceService.getSummary(selectedUnitId, selectedDate);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load classroom attendance summary:', err);
      setSummary(null);
      setErrorMsg(err.message || 'Failed to load classroom attendance.');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fetch Self Check-in Status
  const fetchSelfStatus = async () => {
    setLoadingSelf(true);
    try {
      const data = await attendanceService.getSelfStatus(selectedDate);
      setSelfStatus(data);
      if (data?.current_record) {
        setSelfForm({
          status: data.current_record.status || 'PRESENT',
          remarks: data.current_record.remarks || '',
        });
      }
    } catch (err) {
      console.error('Failed to load self check-in status:', err);
    } finally {
      setLoadingSelf(false);
    }
  };

  // Fetch Student Personal Records
  const fetchStudentRecords = async () => {
    setLoadingStudent(true);
    try {
      const data = await attendanceService.listRecords();
      setStudentRecords(data || []);
    } catch (err) {
      console.error('Failed to load student attendance:', err);
    } finally {
      setLoadingStudent(false);
    }
  };

  // Submit Self Check-in
  const handleExecuteSelfCheckIn = async (e) => {
    e.preventDefault();
    setSelfSubmitting(true);
    setSelfSuccessMsg('');
    try {
      await attendanceService.markSelf({
        date: selectedDate,
        status: selfForm.status,
        remarks: selfForm.remarks.trim(),
      });
      setSelfSuccessMsg(`Check-in recorded as ${selfForm.status} successfully.`);
      setIsEditingSelf(false);
      await fetchSelfStatus();
      if (isAdmin) {
        fetchAnalytics();
      }
    } catch (err) {
      alert(err.message || 'Failed to record self check-in.');
    } finally {
      setSelfSubmitting(false);
    }
  };

  // Submit Same-Day Roll Call Correction
  const handleExecuteCorrection = async (e) => {
    e.preventDefault();
    if (!correctingRecord) return;
    setCorrectSubmitting(true);
    try {
      await attendanceService.correctAttendance(correctingRecord.id, {
        status: correctingRecord.status,
        remarks: correctingRecord.remarks || '',
      });
      setCorrectingRecord(null);
      setSuccessBanner('Attendance record corrected successfully.');
      fetchClassroomSummary();
    } catch (err) {
      alert(err.data?.error?.message || err.message || 'Failed to correct attendance.');
    } finally {
      setCorrectSubmitting(false);
    }
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const currentUnit = sections.find((s) => s.id === selectedUnitId);

  // Student Roster Filter
  const classroomRoster = summary?.roster || [];
  const filteredClassroomRoster = classroomRoster.filter((s) => {
    const q = classroomSearch.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.roll_number?.toLowerCase().includes(q) ||
      s.admission_number?.toLowerCase().includes(q)
    );
  });

  // Analytics Sections Filter
  const analyticsSections = analytics?.section_breakdown || [];
  const filteredAnalyticsSections = analyticsSections.filter((sec) => {
    const q = analyticsSearch.toLowerCase();
    return (
      sec.class_name?.toLowerCase().includes(q) ||
      sec.section_name?.toLowerCase().includes(q) ||
      sec.class_teacher_name?.toLowerCase().includes(q)
    );
  });

  // Student metrics
  const studentTotal = studentRecords.length;
  const studentPresent = studentRecords.filter((r) => r.status === 'PRESENT').length;
  const studentAbsent = studentRecords.filter((r) => r.status === 'ABSENT').length;
  const studentLate = studentRecords.filter((r) => r.status === 'LATE').length;
  const studentRate = studentTotal > 0 ? roundOne((studentPresent / studentTotal) * 100) : 0;

  function roundOne(num) {
    return Math.round(num * 10) / 10;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] dark:text-slate-100">
            {isStudent ? 'My Attendance' : 'Attendance & Roll Call'}
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            {isStudent
              ? 'Track your daily attendance percentage, presence logs, and leave status'
              : isAdmin
              ? 'Institutional whole-school analytics, section-wise roll calls, and staff presence'
              : isTeacher
              ? 'Conduct daily classroom roll calls, perform same-day corrections, and check in'
              : 'Record your daily staff check-in and view personal attendance history'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Date Selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs">
            <Calendar className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-[#1E293B] dark:text-slate-100 bg-transparent outline-none cursor-pointer"
            />
          </div>

          {/* Quick Roll Call Action for Authorized Users */}
          {(isAdmin || isTeacher) && hasPermission('attendance.mark_class') && selectedUnitId && (
            <button
              onClick={() => setIsMarkModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Mark Roll Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Role-based Sub Navigation Tabs */}
      {!isStudent && (
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-700 pb-2">
          {isAdmin && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-[#1E293B] dark:bg-[#FACC15] text-white dark:text-slate-900 shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>School Analytics</span>
            </button>
          )}

          {(isAdmin || isTeacher) && hasPermission('attendance.read_class') && (
            <button
              onClick={() => setActiveTab('classroom')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'classroom'
                  ? 'bg-[#1E293B] dark:bg-[#FACC15] text-white dark:text-slate-900 shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Classroom Roll Call</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'staff'
                  ? 'bg-[#1E293B] dark:bg-[#FACC15] text-white dark:text-slate-900 shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Presence Log</span>
            </button>
          )}

          {hasPermission('attendance.mark_self') && (
            <button
              onClick={() => setActiveTab('self')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'self'
                  ? 'bg-[#1E293B] dark:bg-[#FACC15] text-white dark:text-slate-900 shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>My Self Check-in</span>
            </button>
          )}
        </div>
      )}

      {/* Notifications / Alerts */}
      {successBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-700 dark:text-emerald-400 hover:text-black dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-700 dark:text-red-400 hover:text-black dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 1: ADMIN SCHOOL ANALYTICS                           */}
      {/* ======================================================== */}
      {activeTab === 'analytics' && (isAdmin || hasPermission('attendance.read_class')) && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-12 border border-gray-100 dark:border-slate-700 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#FACC15] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">Aggregating whole-school attendance...</p>
            </div>
          ) : !analytics ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-12 border border-gray-100 dark:border-slate-700 text-center text-sm text-gray-500 dark:text-slate-400">
              No analytics data available for {selectedDate}.
            </div>
          ) : (
            <>
              {/* 5 Core School KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">School Attendance</p>
                    <span className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-2xl font-black text-[#1E293B] dark:text-slate-100 mt-1.5">
                    {analytics.summary?.overall_attendance_rate ?? 0}%
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    {analytics.summary?.present_count ?? 0} of {analytics.summary?.total_enrolled ?? 0} students
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Students Present</p>
                    <span className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-2xl font-black text-green-700 dark:text-green-400 mt-1.5">
                    {analytics.summary?.present_count ?? 0}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    On campus today
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Students Absent</p>
                    <span className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                      <XCircle className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-1.5">
                    {analytics.summary?.absent_count ?? 0}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    Unexcused or missing
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Late / Excused</p>
                    <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                      <Clock className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1.5">
                    {(analytics.summary?.late_count ?? 0) + (analytics.summary?.excused_count ?? 0)}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    {analytics.summary?.late_count ?? 0} late, {analytics.summary?.excused_count ?? 0} excused
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4 col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Staff Checked-in</p>
                    <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                      <UserCheck className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1.5">
                    {analytics.staff_summary?.checked_in_count ?? 0} / {analytics.staff_summary?.total_staff ?? 0}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    {analytics.staff_summary?.attendance_rate ?? 0}% staff presence
                  </p>
                </div>
              </div>

              {/* 7-Day Trend Visualizer & Roll Call Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7-Day Trend Bars */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">7-Day Attendance Trend</h3>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">Daily student attendance rate over the last 7 calendar days</p>
                    </div>
                    <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-200 bg-gray-50 dark:bg-slate-700 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600">
                      Past Week
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-2 pt-2 items-end h-40">
                    {(analytics.trend || []).map((t) => {
                      const isSelected = t.date === selectedDate;
                      return (
                        <div key={t.date} className="flex flex-col items-center h-full justify-end group">
                          <span className="text-[10px] font-bold text-[#1E293B] dark:text-slate-200 mb-1">
                            {t.rate}%
                          </span>
                          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-t-lg h-28 flex items-end p-1">
                            <div
                              style={{ height: `${Math.max(10, Math.min(100, t.rate))}%` }}
                              className={`w-full rounded-md transition-all duration-500 ${
                                isSelected
                                  ? 'bg-[#FACC15]'
                                  : t.rate >= 90
                                  ? 'bg-emerald-500'
                                  : t.rate >= 75
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                              }`}
                            />
                          </div>
                          <span className={`text-[10px] font-semibold mt-1.5 ${isSelected ? 'text-black dark:text-yellow-400 font-bold' : 'text-[#64748B] dark:text-slate-400'}`}>
                            {t.day}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section Roll-Call Status Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">Roll Call Completion</h3>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Classroom submission status for today</p>

                    <div className="mt-6 flex items-center justify-center">
                      <div className="relative w-32 h-32 rounded-full border-8 border-gray-100 dark:border-slate-700 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-2xl font-black text-[#1E293B] dark:text-slate-100">
                            {analytics.summary?.sections_marked ?? 0}
                          </p>
                          <p className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400">
                            of {analytics.summary?.sections_total ?? 0} Marked
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="text-[#64748B] dark:text-slate-400">Pending Sections:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                      {analytics.summary?.sections_pending ?? 0} Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Section-by-Section Comparative Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">Class & Section Performance Breakdown</h3>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Comparison of student attendance strength and presence per section</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400 dark:text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search section or teacher..."
                      value={analyticsSearch}
                      onChange={(e) => setAnalyticsSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-100">
                    <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-5">Class & Section</th>
                        <th className="py-3 px-5">Assigned Class Teacher</th>
                        <th className="py-3 px-5">Strength</th>
                        <th className="py-3 px-5">Present / Absent</th>
                        <th className="py-3 px-5">Attendance Rate</th>
                        <th className="py-3 px-5">Roll Call Status</th>
                        <th className="py-3 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {filteredAnalyticsSections.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-xs text-[#64748B] dark:text-slate-400">
                            No sections found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredAnalyticsSections.map((sec) => (
                          <tr key={sec.section_id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="py-3 px-5 font-bold text-xs text-[#1E293B] dark:text-slate-100">
                              {sec.class_name} — {sec.section_name}
                            </td>
                            <td className="py-3 px-5 text-xs text-[#64748B] dark:text-slate-400">
                              {sec.class_teacher_name}
                            </td>
                            <td className="py-3 px-5 text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                              {sec.total_enrolled}
                            </td>
                            <td className="py-3 px-5 text-xs font-mono">
                              <span className="text-green-700 dark:text-green-400 font-bold">{sec.present_count}</span>
                              <span className="text-gray-400 dark:text-slate-500 mx-1">/</span>
                              <span className="text-red-700 dark:text-red-400 font-bold">{sec.absent_count}</span>
                            </td>
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#1E293B] dark:text-slate-100 w-10">
                                  {sec.attendance_rate}%
                                </span>
                                <div className="w-24 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                                  <div
                                    style={{ width: `${Math.min(100, sec.attendance_rate)}%` }}
                                    className={`h-2 rounded-full ${
                                      sec.attendance_rate >= 90
                                        ? 'bg-green-500'
                                        : sec.attendance_rate >= 75
                                        ? 'bg-amber-400'
                                        : 'bg-red-400'
                                    }`}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  sec.status === 'COMPLETED'
                                    ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                                }`}
                              >
                                {sec.status === 'COMPLETED' ? (
                                  <>
                                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    <span>Completed</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    <span>Pending</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedUnitId(sec.section_id);
                                  setActiveTab('classroom');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 dark:bg-slate-700 hover:bg-[#FACC15] dark:hover:bg-[#FACC15] hover:text-[#1E293B] dark:hover:text-[#1E293B] text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg border border-gray-200 dark:border-slate-600 transition-colors"
                              >
                                <span>Open Section</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: CLASSROOM ROLL CALL                              */}
      {/* ======================================================== */}
      {activeTab === 'classroom' && (
        <div className="space-y-6">
          {sections.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#1E293B] dark:text-slate-100 text-sm">
                {isTeacher && !isAdmin
                  ? 'Classroom Roll Call Restricted'
                  : 'No Sections Available'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-md mx-auto">
                {isTeacher && !isAdmin
                  ? 'You are currently not assigned as the official Class Teacher for any academic section. Classroom attendance can only be taken by the assigned Class Teacher or a School Administrator.'
                  : 'There are currently no academic sections configured in this academic year.'}
              </p>
            </div>
          ) : (
            <>
              {/* Section Filter & Search Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
                <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-200">Class / Section:</span>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.parent_name ? `${s.parent_name} - ${s.name}` : s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
                <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-200">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search student..."
                value={classroomSearch}
                onChange={(e) => setClassroomSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
              />
            </div>
          </div>

          {/* Section Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Attendance Rate</p>
              <p className="text-2xl font-black text-[#1E293B] dark:text-slate-100 mt-1">
                {summary?.attendance_rate ?? 0}%
              </p>
              <span className="text-[10px] text-[#64748B] dark:text-slate-400">
                {summary?.present_count ?? 0} of {summary?.total_students ?? 0} present
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Present</p>
              </div>
              <p className="text-2xl font-black text-green-700 dark:text-green-400 mt-1">
                {summary?.present_count ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Absent</p>
              </div>
              <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-1">
                {summary?.absent_count ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Late</p>
              </div>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
                {summary?.late_count ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-500" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Unmarked / Excused</p>
              </div>
              <p className="text-2xl font-black text-[#1E293B] dark:text-slate-100 mt-1">
                {(summary?.excused_count ?? 0) + (summary?.unmarked_count ?? 0)}
              </p>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-100">
                <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-6">Roll No</th>
                    <th className="py-3 px-6">Student</th>
                    <th className="py-3 px-6">Admission No</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Remarks</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {loadingSummary ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-[#FACC15]" />
                          <span>Loading classroom roster...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredClassroomRoster.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                        No student records found for this unit and date.
                      </td>
                    </tr>
                  ) : (
                    filteredClassroomRoster.map((st) => (
                      <tr key={st.membership_id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#1E293B] dark:text-slate-100">
                          #{st.roll_number || '—'}
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-xs text-[#1E293B] dark:text-slate-100">
                          {st.full_name}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs text-[#64748B] dark:text-slate-400">
                          {st.admission_number || '—'}
                        </td>
                        <td className="py-3.5 px-6">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                              st.status === 'PRESENT'
                                ? 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/40'
                                : st.status === 'ABSENT'
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/40'
                                : st.status === 'LATE'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                                : st.status === 'EXCUSED'
                                ? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300 border border-gray-200 dark:border-slate-600'
                                : 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40'
                            }`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-xs text-[#64748B] dark:text-slate-400">
                          {st.remarks || '—'}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {st.attendance_record_id && isToday && hasPermission('attendance.correct') && (
                            <button
                              onClick={() =>
                                setCorrectingRecord({
                                  id: st.attendance_record_id,
                                  name: st.full_name,
                                  status: st.status,
                                  remarks: st.remarks,
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Correct</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: STAFF & FACULTY PRESENCE LOG (Admin)             */}
      {/* ======================================================== */}
      {activeTab === 'staff' && (isAdmin || hasPermission('attendance.read_class')) && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">Staff & Faculty Presence Roster</h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  Daily check-in logs for teachers, administrative staff, and operations on {selectedDate}
                </p>
              </div>
              <div className="text-xs font-semibold bg-gray-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                Total Staff: {analytics?.staff_summary?.total_staff ?? 0} | Checked In:{' '}
                <span className="text-green-700 dark:text-green-400 font-bold">{analytics?.staff_summary?.checked_in_count ?? 0}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-100">
                <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-5">Staff Member</th>
                    <th className="py-3 px-5">Role / Department</th>
                    <th className="py-3 px-5">Employee ID</th>
                    <th className="py-3 px-5">Today's Check-in Status</th>
                    <th className="py-3 px-5">Remarks / Shift Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {(analytics?.staff_summary?.roster || []).map((staff) => (
                    <tr key={staff.membership_id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3 px-5 font-semibold text-xs text-[#1E293B] dark:text-slate-100">
                        {staff.full_name}
                        <span className="block text-[10px] text-[#64748B] dark:text-slate-400 font-normal">{staff.email}</span>
                      </td>
                      <td className="py-3 px-5 text-xs text-[#64748B] dark:text-slate-400">
                        {staff.role === 'TEACHER' ? 'Faculty / Teacher' : `Staff (${staff.staff_type || 'Operations'})`}
                      </td>
                      <td className="py-3 px-5 font-mono text-xs text-[#64748B] dark:text-slate-400">
                        {staff.employee_id || '—'}
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            staff.status === 'PRESENT'
                              ? 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/40'
                              : staff.status === 'LATE'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                              : staff.status === 'EXCUSED'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                              : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40'
                          }`}
                        >
                          {staff.status === 'NOT_CHECKED_IN' ? 'Not Checked In' : staff.status}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-xs text-[#64748B] dark:text-slate-400">
                        {staff.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 4: MY SELF CHECK-IN (Teachers, Staff, Admin)        */}
      {/* ======================================================== */}
      {activeTab === 'self' && hasPermission('attendance.mark_self') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Check-in Action Card */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                <Clock className="w-4 h-4" />
                <span>Daily Self Check-in</span>
              </div>
              <h2 className="text-lg font-bold text-[#1E293B] dark:text-slate-100">Mark Your Presence</h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Check in to record your daily attendance for {selectedDate}.
              </p>
            </div>

            {loadingSelf ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#FACC15] mx-auto mb-2" />
                <span className="text-xs text-[#64748B] dark:text-slate-400">Loading your check-in status...</span>
              </div>
            ) : selfStatus?.has_checked_in && !isEditingSelf ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>You are checked in for today</span>
                </div>
                <div className="space-y-1 text-xs text-emerald-900 dark:text-emerald-200">
                  <p>
                    <span className="font-semibold">Status:</span>{' '}
                    <span className="font-mono uppercase font-bold">{selfStatus.current_record?.status}</span>
                  </p>
                  {selfStatus.current_record?.remarks && (
                    <p>
                      <span className="font-semibold">Note:</span> {selfStatus.current_record?.remarks}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsEditingSelf(true)}
                  className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 underline"
                >
                  Update status or remarks
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecuteSelfCheckIn} className="space-y-4">
                {selfSuccessMsg && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg">
                    {selfSuccessMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1.5">
                    Check-in Status
                  </label>
                  <select
                    value={selfForm.status}
                    onChange={(e) => setSelfForm({ ...selfForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-[#1E293B] dark:text-slate-100"
                  >
                    <option value="PRESENT">PRESENT (On Campus)</option>
                    <option value="LATE">LATE (Delayed Arrival)</option>
                    <option value="EXCUSED">EXCUSED (Official Duty / Leave)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1.5">
                    Shift Remarks / Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={selfForm.remarks}
                    onChange={(e) => setSelfForm({ ...selfForm, remarks: e.target.value })}
                    placeholder="e.g. Regular shift, field supervision..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {isEditingSelf && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSelf(false)}
                      className="px-3 py-2 text-xs text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={selfSubmitting}
                    className="flex-1 py-2.5 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {selfSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    <span>{isEditingSelf ? 'Save Changes' : 'Check In for Today'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Personal Check-in History */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">My Recent Check-in History</h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">Personal presence logs for the last 30 entries</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-100">
                <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {loadingSelf ? (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-xs text-[#64748B] dark:text-slate-400">
                        Loading check-in logs...
                      </td>
                    </tr>
                  ) : (selfStatus?.history || []).length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-xs text-[#64748B] dark:text-slate-400">
                        No prior self check-in entries recorded.
                      </td>
                    </tr>
                  ) : (
                    (selfStatus?.history || []).map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                          {h.date}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              h.status === 'PRESENT'
                                ? 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/40'
                                : h.status === 'LATE'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300 border border-gray-200 dark:border-slate-600'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-[#64748B] dark:text-slate-400">
                          {h.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 5: STUDENT PERSONAL ATTENDANCE LEDGER               */}
      {/* ======================================================== */}
      {(isStudent || activeTab === 'student_history') && (
        <div className="space-y-6">
          {/* Student Overview Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">My Attendance Rate</p>
              <p className="text-3xl font-black text-[#1E293B] dark:text-slate-100 mt-1">{studentRate}%</p>
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                {studentPresent} of {studentTotal} sessions
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Days Present</p>
              <p className="text-3xl font-black text-green-700 dark:text-green-400 mt-1">{studentPresent}</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Days Absent</p>
              <p className="text-3xl font-black text-red-700 dark:text-red-400 mt-1">{studentAbsent}</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Late / Excused</p>
              <p className="text-3xl font-black text-amber-700 dark:text-amber-400 mt-1">{studentLate}</p>
            </div>
          </div>

          {/* Student Attendance Ledger */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">Recorded Attendance Ledger</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-100">
                <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Academic Class</th>
                    <th className="py-3 px-5">Teacher Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {loadingStudent ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin text-[#FACC15] mx-auto mb-2" />
                        <span>Loading your attendance ledger...</span>
                      </td>
                    </tr>
                  ) : studentRecords.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                        No attendance records logged for your profile yet.
                      </td>
                    </tr>
                  ) : (
                    studentRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="py-3 px-5 font-mono text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                          {r.date}
                        </td>
                        <td className="py-3 px-5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                              r.status === 'PRESENT'
                                ? 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/40'
                                : r.status === 'ABSENT'
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/40'
                                : r.status === 'LATE'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300 border border-gray-200 dark:border-slate-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-xs text-[#64748B] dark:text-slate-400">
                          {r.academic_unit_name || 'Classroom Roll Call'}
                        </td>
                        <td className="py-3 px-5 text-xs text-[#64748B] dark:text-slate-400">
                          {r.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Mark Roll Call Modal */}
      {selectedUnitId && (
        <MarkAttendanceModal
          isOpen={isMarkModalOpen}
          onClose={() => setIsMarkModalOpen(false)}
          academicUnitId={selectedUnitId}
          unitName={currentUnit ? (currentUnit.parent_name ? `${currentUnit.parent_name} - ${currentUnit.name}` : currentUnit.name) : ''}
          initialDate={selectedDate}
          onSaved={() => {
            fetchClassroomSummary();
            if (isAdmin) fetchAnalytics();
          }}
        />
      )}

      {/* Same-Day Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 dark:border-slate-700">
            <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">
              Correct Attendance: {correctingRecord.name}
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400">
              Same-day correction rule per doc/rbac.md.
            </p>
            <form onSubmit={handleExecuteCorrection} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">New Status</label>
                <select
                  value={correctingRecord.status}
                  onChange={(e) =>
                    setCorrectingRecord({ ...correctingRecord, status: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LATE">LATE</option>
                  <option value="EXCUSED">EXCUSED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Remarks</label>
                <input
                  type="text"
                  value={correctingRecord.remarks || ''}
                  onChange={(e) =>
                    setCorrectingRecord({ ...correctingRecord, remarks: e.target.value })
                  }
                  placeholder="Reason for correction..."
                  className="w-full px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-3 py-1.5 text-xs text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctSubmitting}
                  className="px-4 py-1.5 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-lg transition-colors"
                >
                  {correctSubmitting ? 'Saving...' : 'Apply Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
