import React, { useState, useEffect } from 'react';
import { attendanceService } from '../services/attendance';
import { academicsService } from '../services/academics';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarCheck,
  Check,
  Clock
} from 'lucide-react';

export const MarkAttendanceModal = ({
  isOpen,
  onClose,
  academicUnitId,
  unitName,
  onSaved,
  initialDate
}) => {
  const [selectedDate, setSelectedDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({}); // { membership_id: { status: 'PRESENT', remarks: '' } }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen && academicUnitId) {
      loadRoster();
    }
  }, [isOpen, academicUnitId, selectedDate]);

  const loadRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch current summary for this date to pre-populate any existing marks
      const summary = await attendanceService.getSummary(academicUnitId, selectedDate);
      const rosterList = summary.roster || [];
      setStudents(rosterList);

      const initialStatusMap = {};
      rosterList.forEach((s) => {
        initialStatusMap[s.membership_id] = {
          status: s.status === 'UNMARKED' ? 'PRESENT' : s.status,
          remarks: s.remarks || '',
        };
      });
      setStatuses(initialStatusMap);
    } catch (err) {
      console.error('Failed to load roster:', err);
      // Fallback: load directly from enrollments
      try {
        const enrollments = await academicsService.listEnrollments();
        const filtered = enrollments.filter((e) => e.academic_unit === academicUnitId);
        setStudents(
          filtered.map((e) => ({
            membership_id: e.membership,
            full_name: e.student_name,
            roll_number: e.roll_number,
            admission_number: e.admission_number,
          }))
        );
        const map = {};
        filtered.forEach((e) => {
          map[e.membership] = { status: 'PRESENT', remarks: '' };
        });
        setStatuses(map);
      } catch (e2) {
        setError('Could not load student roster for this section.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAll = (statusToSet) => {
    const updated = {};
    students.forEach((s) => {
      updated[s.membership_id] = {
        ...(statuses[s.membership_id] || {}),
        status: statusToSet,
      };
    });
    setStatuses(updated);
  };

  const handleStatusChange = (membershipId, newStatus) => {
    setStatuses((prev) => ({
      ...prev,
      [membershipId]: {
        ...(prev[membershipId] || {}),
        status: newStatus,
      },
    }));
  };

  const handleRemarksChange = (membershipId, remarks) => {
    setStatuses((prev) => ({
      ...prev,
      [membershipId]: {
        ...(prev[membershipId] || { status: 'PRESENT' }),
        remarks,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const records = students.map((s) => ({
        student_membership_id: s.membership_id,
        status: statuses[s.membership_id]?.status || 'PRESENT',
        remarks: statuses[s.membership_id]?.remarks || '',
      }));

      const payload = {
        academic_unit_id: academicUnitId,
        date: selectedDate,
        records,
      };

      const res = await attendanceService.markClass(payload);
      setSuccessMsg(`Successfully recorded attendance for ${res.total_marked} students.`);
      setTimeout(() => {
        if (onSaved) onSaved();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to mark attendance:', err);
      setError(err.data?.error?.message || err.message || 'Failed to submit attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-950/60 flex items-center justify-center text-[#1E293B]">
              <CalendarCheck className="w-4 h-4 text-yellow-800 dark:text-yellow-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B] dark:text-slate-100">
                Roll Call — {unitName || 'Classroom Section'}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">Daily attendance registration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 rounded-xl text-xs text-green-800 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Date & Bulk Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-transparent dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-200">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
                className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 focus:ring-1 focus:ring-[#FACC15]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 mr-1">Quick Mark:</span>
              <button
                type="button"
                onClick={() => handleMarkAll('PRESENT')}
                className="px-2.5 py-1 rounded bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900 text-[11px] font-bold transition-colors border border-transparent dark:border-green-800/40"
              >
                All Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('ABSENT')}
                className="px-2.5 py-1 rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 text-[11px] font-bold transition-colors border border-transparent dark:border-red-800/40"
              >
                All Absent
              </button>
            </div>
          </div>

          {/* Roster List */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#64748B] dark:text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#FACC15]" />
              <span>Loading classroom roster...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
              No active students enrolled in this section.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700 border border-gray-100 dark:border-slate-700 rounded-xl">
              {students.map((st) => {
                const currentStatus = statuses[st.membership_id]?.status || 'PRESENT';
                const currentRemarks = statuses[st.membership_id]?.remarks || '';

                return (
                  <div
                    key={st.membership_id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-[#64748B] dark:text-slate-400 w-8">
                        #{st.roll_number || '—'}
                      </span>
                      <div>
                        <p className="font-semibold text-xs text-[#1E293B] dark:text-slate-100">{st.full_name}</p>
                        <p className="text-[10px] text-[#64748B] dark:text-slate-400">Adm: {st.admission_number || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Toggle Buttons */}
                      <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-600 p-0.5 bg-gray-50 dark:bg-slate-900/60 text-[11px] font-semibold">
                        {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((opt) => {
                          const active = currentStatus === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleStatusChange(st.membership_id, opt)}
                              className={`px-2.5 py-1 rounded-md transition-all ${
                                active
                                  ? opt === 'PRESENT'
                                    ? 'bg-green-600 text-white shadow-xs'
                                    : opt === 'ABSENT'
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : opt === 'LATE'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-gray-600 text-white shadow-xs'
                                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {/* Remarks Input */}
                      <input
                        type="text"
                        placeholder="Remarks..."
                        value={currentRemarks}
                        onChange={(e) => handleRemarksChange(st.membership_id, e.target.value)}
                        className="w-24 sm:w-32 px-2 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[11px] text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-1 focus:ring-[#FACC15]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
            <span className="text-[11px] text-[#64748B] dark:text-slate-400">
              * Note: Re-marking the same day updates records safely in place.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loading || students.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Attendance ({students.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
