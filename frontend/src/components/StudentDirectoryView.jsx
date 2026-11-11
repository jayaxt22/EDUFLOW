import React, { useState, useEffect } from 'react';
import { userService } from '../services/users';
import { GraduationCap, Search, Loader2 } from 'lucide-react';
import { Avatar } from './Avatar';

export const StudentDirectoryView = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.listUsers();
      setStudents(data || []);
    } catch (err) {
      console.error('Failed to load student directory:', err);
      setError(err.message || 'Failed to load student directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = s.full_name?.toLowerCase().includes(q);
    const admMatch = s.admission_number?.toLowerCase().includes(q);
    const classMatch = s.class_name?.toLowerCase().includes(q);
    const secMatch = s.section_name?.toLowerCase().includes(q);
    const rollMatch = s.roll_number?.toLowerCase().includes(q);
    return nameMatch || admMatch || classMatch || secMatch || rollMatch;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B] dark:text-slate-100">Student Directory</h1>
        <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
          Institutional student directory (read-only per doc/rbac.md)
        </p>
      </div>

      {/* Directory Table Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Table Search */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, admission, or class..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-[#1E293B] dark:text-slate-200 placeholder:text-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
            />
          </div>
          <div className="text-xs text-[#64748B] dark:text-slate-400">
            Showing <span className="font-bold text-[#1E293B] dark:text-slate-200">{filteredStudents.length}</span> students
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-200">
            <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="py-3 px-6">Student</th>
                <th className="py-3 px-6">Admission No</th>
                <th className="py-3 px-6">Class & Section</th>
                <th className="py-3 px-6">Roll No</th>
                <th className="py-3 px-6 text-right">Directory Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#FACC15]" />
                      <span>Loading student directory...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-xs text-red-600 dark:text-red-400">
                    {error}
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar user={s} size="sm" />
                        <div>
                          <div className="font-semibold text-xs text-[#1E293B] dark:text-slate-100">{s.full_name}</div>
                          {s.email && <div className="text-[11px] text-[#64748B] dark:text-slate-400">{s.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-[#64748B] dark:text-slate-400">
                      {s.admission_number || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-xs text-[#1E293B] dark:text-slate-200">
                      {s.class_name ? `${s.class_name} - ${s.section_name || ''}` : 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs font-semibold text-[#1E293B] dark:text-slate-200">
                      {s.roll_number ? `#${s.roll_number}` : '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                        ENROLLED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
