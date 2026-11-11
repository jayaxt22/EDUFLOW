import React, { useState, useEffect } from 'react';
import { academicsService } from '../services/academics';
import { X, ArrowUpRight, AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react';

export const PromotionModal = ({ isOpen, onClose, onPromoted }) => {
  const [units, setUnits] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [sourceUnitId, setSourceUnitId] = useState('');
  const [targetUnitId, setTargetUnitId] = useState('');
  const [promotionDate, setPromotionDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStudents, setSelectedStudents] = useState({}); // { membership_id: roll_number }

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg('');
    try {
      const [unitsData, enrollmentsData] = await Promise.all([
        academicsService.listUnits(),
        academicsService.listEnrollments(),
      ]);
      setUnits(unitsData || []);
      setEnrollments(enrollmentsData || []);

      // Pre-select first section as source if available
      const sections = (unitsData || []).filter(u => u.unit_type === 'SECTION');
      if (sections.length > 0) {
        setSourceUnitId(sections[0].id);
        if (sections.length > 1) {
          setTargetUnitId(sections[1].id);
        }
      }
    } catch (err) {
      console.error('Failed to load promotion data:', err);
      setError('Could not load academic units or enrollments. Please check permissions.');
    } finally {
      setLoading(false);
    }
  };

  // Filter students enrolled in the selected source unit
  const eligibleStudents = enrollments.filter(
    (enr) => !sourceUnitId || enr.academic_unit === sourceUnitId
  );

  // Toggle selection
  const handleToggleStudent = (membershipId, currentRoll) => {
    setSelectedStudents((prev) => {
      const updated = { ...prev };
      if (updated[membershipId] !== undefined) {
        delete updated[membershipId];
      } else {
        // Default new roll to current roll or sequential
        updated[membershipId] = currentRoll || '';
      }
      return updated;
    });
  };

  // Toggle select all
  const handleSelectAll = () => {
    if (Object.keys(selectedStudents).length === eligibleStudents.length) {
      setSelectedStudents({});
    } else {
      const all = {};
      eligibleStudents.forEach((enr, idx) => {
        all[enr.membership] = enr.roll_number || `${idx + 1}`;
      });
      setSelectedStudents(all);
    }
  };

  const handleRollChange = (membershipId, val) => {
    setSelectedStudents((prev) => ({
      ...prev,
      [membershipId]: val,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg('');

    if (!targetUnitId) {
      setError('Please select a target academic section for promotion.');
      return;
    }
    if (sourceUnitId && sourceUnitId === targetUnitId) {
      setError('Target section must be different from source section.');
      return;
    }

    const promotionList = Object.entries(selectedStudents).map(([memId, roll]) => ({
      student_membership_id: memId,
      roll_number: roll.trim(),
    }));

    if (promotionList.length === 0) {
      setError('Please select at least one student to promote.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        target_unit_id: targetUnitId,
        promotion_date: promotionDate,
        promotions: promotionList,
      };

      const result = await academicsService.promoteStudents(payload);
      setSuccessMsg(`Successfully promoted ${result.promoted_count} students atomically!`);
      setTimeout(() => {
        if (onPromoted) onPromoted();
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Promotion error:', err);
      const msg = err.data?.error?.message || err.message || 'Promotion failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-950/60 flex items-center justify-center text-[#1E293B]">
              <ArrowUpRight className="w-4 h-4 text-yellow-700 dark:text-yellow-400 font-bold" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B] dark:text-slate-100">Promote Students</h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">Batch atomic promotion per doc/planning.md</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="font-semibold">Promotion Failed</p>
                <p className="mt-0.5 text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 rounded-xl text-xs text-green-800 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#64748B] dark:text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#FACC15]" />
              <span>Loading academic units and rosters...</span>
            </div>
          ) : (
            <>
              {/* Unit Selectors & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                    Current Section
                  </label>
                  <select
                    value={sourceUnitId}
                    onChange={(e) => {
                      setSourceUnitId(e.target.value);
                      setSelectedStudents({});
                    }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                  >
                    <option value="">All Active Sections</option>
                    {units
                      .filter((u) => u.unit_type === 'SECTION')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.parent_name ? `${u.parent_name} - ${u.name}` : u.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                    Target Section *
                  </label>
                  <select
                    value={targetUnitId}
                    onChange={(e) => setTargetUnitId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                  >
                    <option value="">Select Target Unit</option>
                    {units
                      .filter((u) => u.unit_type === 'SECTION')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.parent_name ? `${u.parent_name} - ${u.name}` : u.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                    Promotion Date *
                  </label>
                  <input
                    type="date"
                    value={promotionDate}
                    onChange={(e) => setPromotionDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              {/* Student Selection Table */}
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-gray-50 dark:bg-slate-900/60 px-4 py-2.5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={
                        eligibleStudents.length > 0 &&
                        Object.keys(selectedStudents).length === eligibleStudents.length
                      }
                      onChange={handleSelectAll}
                      className="rounded text-[#FACC15] focus:ring-[#FACC15]"
                    />
                    <label htmlFor="select-all" className="font-semibold text-[#1E293B] dark:text-slate-200 cursor-pointer">
                      Select Students ({Object.keys(selectedStudents).length}/{eligibleStudents.length})
                    </label>
                  </div>
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400">Assign target roll numbers</span>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
                  {eligibleStudents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#64748B] dark:text-slate-400">
                      No active student enrollments found in this unit.
                    </div>
                  ) : (
                    eligibleStudents.map((enr) => {
                      const isSelected = selectedStudents[enr.membership] !== undefined;
                      return (
                        <div
                          key={enr.id}
                          className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                            isSelected ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : 'hover:bg-gray-50/70 dark:hover:bg-slate-700/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStudent(enr.membership, enr.roll_number)}
                              className="rounded text-[#FACC15] focus:ring-[#FACC15]"
                            />
                            <div>
                              <p className="font-semibold text-[#1E293B] dark:text-slate-100">{enr.student_name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400">
                                <span>Adm: {enr.admission_number || '—'}</span>
                                <span>•</span>
                                <span>Current Roll: #{enr.roll_number || '—'}</span>
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#64748B] dark:text-slate-400">New Roll:</span>
                              <input
                                type="text"
                                value={selectedStudents[enr.membership] || ''}
                                onChange={(e) => handleRollChange(enr.membership, e.target.value)}
                                placeholder="Roll #"
                                className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-xs font-mono text-center text-[#1E293B] dark:text-slate-100 focus:ring-1 focus:ring-[#FACC15]"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Notice */}
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 italic">
                * Note: Promotion runs in an atomic database transaction. Existing active enrollments will be closed
                on the specified date, and new enrollments in the target section created. Any collision rolls back the entire batch.
              </p>
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading || Object.keys(selectedStudents).length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Promoting...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5 font-bold" />
                  <span>Execute Promotion ({Object.keys(selectedStudents).length})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
