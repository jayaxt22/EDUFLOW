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
  CheckSquare
} from 'lucide-react';

export const MyClassView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await academicsService.getMyClassRoster();
      setData(res);
    } catch (err) {
      console.error('Error fetching class roster:', err);
      setError(
        err.data?.error?.message ||
        err.message ||
        'You are not currently assigned as a Class Teacher for any academic section.'
      );
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
    return nameMatch || rollMatch || admMatch;
  });

  const getInitials = (name) => {
    if (!name) return 'S';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#64748B] text-xs gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#FACC15]" />
        <span>Loading your assigned class roster...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1E293B]">Class Teacher Assignment Required</h2>
          <p className="text-xs text-[#64748B] mt-1">{error}</p>
        </div>
        <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
          Contact the institution administrator to assign your faculty profile as the designated Class Teacher.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner / Overview Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FACC15] flex items-center justify-center text-[#1E293B]">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#1E293B]">
                {data.unit?.parent_name ? `${data.unit.parent_name} — ` : ''}
                {data.unit?.name}
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800">
                Active Section
              </span>
            </div>
            <p className="text-xs text-[#64748B] flex items-center gap-2 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Academic Year: {data.unit?.academic_year}</span>
              <span>•</span>
              <Users className="w-3.5 h-3.5" />
              <span>{data.total_students} Enrolled Students</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAttendanceModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Mark Daily Attendance</span>
          </button>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Header Filter */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students by name, roll, or admission..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#1E293B] focus:ring-2 focus:ring-[#FACC15]"
            />
          </div>
          <div className="text-xs text-[#64748B]">
            Showing <span className="font-bold text-[#1E293B]">{filteredStudents.length}</span> students
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1E293B]">
            <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-[#64748B] border-b border-gray-100">
              <tr>
                <th className="py-3 px-6">Roll No</th>
                <th className="py-3 px-6">Student Name</th>
                <th className="py-3 px-6">Admission No</th>
                <th className="py-3 px-6">Enrolled Date</th>
                <th className="py-3 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-xs text-[#64748B]">
                    No students match your query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.enrollment_id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#1E293B]">
                      #{st.roll_number || '—'}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar user={st} size="sm" />
                        <span className="font-semibold text-xs text-[#1E293B]">{st.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-[#64748B]">
                      {st.admission_number || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-xs text-[#64748B]">
                      {st.enrolled_from || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-[#22C55E]">
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

      {data?.unit?.id && (
        <MarkAttendanceModal
          isOpen={isAttendanceModalOpen}
          onClose={() => setIsAttendanceModalOpen(false)}
          academicUnitId={data.unit.id}
          unitName={data.unit.name}
          onSaved={fetchRoster}
        />
      )}
    </div>
  );
};
