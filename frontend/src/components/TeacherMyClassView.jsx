import React, { useState, useEffect } from 'react';
import { academicsService } from '../services/academics';
import { MarkAttendanceModal } from './MarkAttendanceModal';
import { Avatar } from './Avatar';
import {
  GraduationCap,
  Users,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  CheckSquare,
  Mail,
  Hash
} from 'lucide-react';

export const TeacherMyClassView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      // Call primary endpoint GET /api/v1/teacher/my-class-roster/
      const res = await academicsService.getTeacherMyClassRoster();
      setData(res);
    } catch (err) {
      console.warn('Teacher roster fetch warning:', err);
      // Fallback or explicit 403 handling
      const msg =
        err.data?.error?.message ||
        err.message ||
        'You are not currently assigned as a class teacher.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const students = data?.students || [];
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = s.full_name?.toLowerCase().includes(q);
    const rollMatch = s.roll_number?.toLowerCase().includes(q);
    const admMatch = s.admission_number?.toLowerCase().includes(q);
    const emailMatch = s.email?.toLowerCase().includes(q);
    return nameMatch || rollMatch || admMatch || emailMatch;
  });

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#64748B] text-xs gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#FACC15]" />
        <span>Loading your assigned class roster...</span>
      </div>
    );
  }

  // Not assigned or forbidden empty state
  if (error || !data || !data.unit) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-12 max-w-xl mx-auto my-12 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1E293B] dark:text-slate-100">
            You are not currently assigned as a class teacher.
          </h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1.5 max-w-md mx-auto">
            {error || 'This dashboard section is only accessible to designated Class Teachers.'}
          </p>
        </div>
        <div className="pt-2 text-[11px] text-[#64748B] dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-700 max-w-sm mx-auto">
          Please contact your school administrator to assign you as the Class Teacher for your designated grade or section.
        </div>
      </div>
    );
  }

  const { unit, total_students } = data;

  return (
    <div className="space-y-6">
      {/* Banner / Overview Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FACC15] flex items-center justify-center text-slate-900">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#1E293B] dark:text-slate-100">
                {unit?.parent_name ? `${unit.parent_name} — ` : ''}
                {unit?.name}
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
                CLASS TEACHER
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-[#64748B] dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {unit?.academic_year}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-[#1E293B] dark:text-slate-200">
                <Users className="w-3.5 h-3.5" />
                {total_students} Students Enrolled
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAttendanceModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all"
        >
          <CheckSquare className="w-4 h-4 text-slate-900" />
          <span>Mark Class Attendance</span>
        </button>
      </div>

      {/* Roster Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748B] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search students by name, roll number, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-xs bg-gray-50/50 dark:bg-slate-800 text-[#1E293B] dark:text-slate-200 placeholder:text-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="font-bold text-xs uppercase tracking-wider text-[#64748B] dark:text-slate-400">
            Class Student Roster
          </div>
          <span className="text-xs text-[#64748B] dark:text-slate-400 font-mono">
            Showing {filteredStudents.length} of {total_students} students
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-200">
            <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="py-3 px-6">Roll No</th>
                <th className="py-3 px-6">Student</th>
                <th className="py-3 px-6">Email</th>
                <th className="py-3 px-6">Admission No</th>
                <th className="py-3 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                    No students match your query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.enrollment_id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#1E293B] dark:text-slate-100">
                      <div className="flex items-center gap-1">
                        <Hash className="w-3 h-3 text-[#64748B] dark:text-slate-400" />
                        <span>{st.roll_number || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar user={st} size="sm" />
                        <div>
                          <div className="font-semibold text-xs text-[#1E293B] dark:text-slate-100">{st.full_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-xs text-[#64748B] dark:text-slate-400">
                      {st.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
                          <span className="font-mono text-[11px]">{st.email}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-[#64748B] dark:text-slate-400">
                      {st.admission_number || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Modal */}
      {isAttendanceModalOpen && (
        <MarkAttendanceModal
          isOpen={isAttendanceModalOpen}
          academicUnitId={unit.id}
          unitId={unit.id}
          unitName={`${unit.parent_name ? unit.parent_name + ' - ' : ''}${unit.name}`}
          students={students}
          onClose={() => setIsAttendanceModalOpen(false)}
          onSaved={fetchRoster}
        />
      )}
    </div>
  );
};
