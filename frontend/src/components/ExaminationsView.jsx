import React, { useState, useEffect } from 'react';
import { examinationsService } from '../services/examinations';
import { academicsService } from '../services/academics';
import { useAuth } from '../context/AuthContext';
import { Select } from './Select';
import {
  Award,
  BookOpen,
  Calendar,
  Lock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Save,
  Loader2,
  FileCheck,
  ChevronRight
} from 'lucide-react';

export const ExaminationsView = () => {
  const { hasPermission } = useAuth();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examSubjects, setExamSubjects] = useState([]);
  const [selectedSubjectPaperId, setSelectedSubjectPaperId] = useState('');
  const [marksGrid, setMarksGrid] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [submittingMarks, setSubmittingMarks] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Marks local edit state: { membership_id: { marks: '85.00', is_absent: false, remarks: '' } }
  const [localMarks, setLocalMarks] = useState({});
  const [bannerMsg, setBannerMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // New exam form state
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [years, setYears] = useState([]);
  const [newExam, setNewExam] = useState({ academic_year: '', name: '', start_date: '', end_date: '' });

  // New subject paper form state
  const [isAddingPaper, setIsAddingPaper] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [newPaper, setNewPaper] = useState({
    academic_unit: '',
    subject: '',
    max_marks: '100.00',
    passing_marks: '40.00',
    exam_date: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [examsData, yearsData, subjectsData, unitsData] = await Promise.all([
        examinationsService.listExams(),
        academicsService.listYears(),
        academicsService.listSubjects().catch(() => []),
        academicsService.listUnits().catch(() => []),
      ]);
      setExams(examsData || []);
      setYears(yearsData || []);
      setAvailableSubjects(subjectsData || []);
      const secs = (unitsData || []).filter((u) => u.unit_type === 'SECTION');
      setAvailableSections(secs);

      if (secs.length > 0 && subjectsData.length > 0) {
        setNewPaper((prev) => ({
          ...prev,
          academic_unit: secs[0].id,
          subject: subjectsData[0].id,
        }));
      }

      if (yearsData && yearsData.length > 0) {
        setNewExam((prev) => ({ ...prev, academic_year: yearsData[0].id }));
      }
      if (examsData && examsData.length > 0) {
        setSelectedExamId(examsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load exams:', err);
      setErrorMsg('Failed to load examination sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      loadExamPapers(selectedExamId);
    }
  }, [selectedExamId]);

  const loadExamPapers = async (examId) => {
    try {
      const papers = await examinationsService.listExamSubjects({ exam: examId });
      setExamSubjects(papers || []);
      if (papers && papers.length > 0) {
        setSelectedSubjectPaperId(papers[0].id);
      } else {
        setSelectedSubjectPaperId('');
        setMarksGrid(null);
      }
    } catch (err) {
      console.error('Failed to load exam subjects:', err);
    }
  };

  useEffect(() => {
    if (selectedSubjectPaperId) {
      loadGrid(selectedSubjectPaperId);
    }
  }, [selectedSubjectPaperId]);

  const loadGrid = async (paperId) => {
    setLoadingGrid(true);
    try {
      const data = await examinationsService.getMarksGrid(paperId);
      setMarksGrid(data);

      const markMap = {};
      (data.students || []).forEach((st) => {
        markMap[st.membership_id] = {
          marks: st.marks_obtained !== null ? st.marks_obtained : '',
          is_absent: st.is_absent || false,
          remarks: st.remarks || '',
        };
      });
      setLocalMarks(markMap);
    } catch (err) {
      console.error('Failed to load marks grid:', err);
    } finally {
      setLoadingGrid(false);
    }
  };

  const handleMarksChange = (membershipId, val) => {
    setLocalMarks((prev) => ({
      ...prev,
      [membershipId]: {
        ...(prev[membershipId] || {}),
        marks: val,
      },
    }));
  };

  const handleAbsentToggle = (membershipId, isAbsent) => {
    setLocalMarks((prev) => ({
      ...prev,
      [membershipId]: {
        ...(prev[membershipId] || {}),
        is_absent: isAbsent,
        marks: isAbsent ? '0.00' : (prev[membershipId]?.marks || ''),
      },
    }));
  };

  const handleSaveMarks = async () => {
    if (!marksGrid || !selectedSubjectPaperId) return;
    setSubmittingMarks(true);
    setBannerMsg(null);
    setErrorMsg(null);

    try {
      const entries = marksGrid.students.map((st) => {
        const item = localMarks[st.membership_id] || {};
        return {
          student_membership_id: st.membership_id,
          marks_obtained: item.is_absent ? 0 : (item.marks === '' ? 0 : parseFloat(item.marks)),
          is_absent: Boolean(item.is_absent),
          remarks: item.remarks || '',
        };
      });

      const res = await examinationsService.submitMarks({
        exam_subject_id: selectedSubjectPaperId,
        entries,
      });

      setBannerMsg(`Successfully recorded ${res.total_recorded} student marks and snapshotted grade tiers.`);
      loadGrid(selectedSubjectPaperId);
    } catch (err) {
      console.error('Failed to save marks:', err);
      setErrorMsg(err.data?.error?.message || err.message || 'Failed to save marks.');
    } finally {
      setSubmittingMarks(false);
    }
  };

  const handlePublishExam = async () => {
    if (!selectedExamId) return;
    const confirmPub = window.confirm(
      'Are you sure you want to publish these exam results? Once published, results are locked and CANNOT be edited (DoD Immutability).'
    );
    if (!confirmPub) return;

    setPublishing(true);
    setErrorMsg(null);
    try {
      await examinationsService.publishExam(selectedExamId);
      setBannerMsg('Examination published! Results are now permanently locked.');
      loadInitialData();
      if (selectedSubjectPaperId) loadGrid(selectedSubjectPaperId);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to publish exam results.');
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateExamSubmit = async (e) => {
    e.preventDefault();
    try {
      await examinationsService.createExam(newExam);
      setIsCreatingExam(false);
      setNewExam({ academic_year: years[0]?.id || '', name: '', start_date: '', end_date: '' });
      loadInitialData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create exam.');
    }
  };

  const handleCreatePaperSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExamId) return;
    try {
      await examinationsService.createExamSubject({
        exam: selectedExamId,
        academic_unit: newPaper.academic_unit,
        subject: newPaper.subject,
        max_marks: parseFloat(newPaper.max_marks),
        passing_marks: parseFloat(newPaper.passing_marks),
        exam_date: newPaper.exam_date || null,
      });
      setIsAddingPaper(false);
      loadExamPapers(selectedExamId);
    } catch (err) {
      setErrorMsg(err.data?.error?.message || err.message || 'Failed to add exam subject paper.');
    }
  };

  const activeExam = exams.find((e) => e.id === selectedExamId);
  const isExamPublished = activeExam?.is_published;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] dark:text-slate-100">Examinations & Grading</h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            Enter marks, snapshot grade policies, and publish immutable report cards
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('examinations.manage') && !isExamPublished && activeExam && (
            <button
              onClick={handlePublishExam}
              disabled={publishing}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>{publishing ? 'Publishing...' : 'Publish Exam Results'}</span>
            </button>
          )}

          {hasPermission('examinations.manage') && (
            <button
              onClick={() => setIsCreatingExam(!isCreatingExam)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Exam Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {bannerMsg && (
        <div className="flex items-center gap-2 p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 rounded-xl text-xs text-green-800 dark:text-green-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
          <span>{bannerMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* New Exam Form */}
      {isCreatingExam && (
        <form onSubmit={handleCreateExamSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#1E293B] dark:text-slate-100">Create Examination Term</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Exam Name (e.g. Mid-Term 2026)"
              value={newExam.name}
              onChange={(e) => setNewExam({ ...newExam, name: e.target.value })}
              required
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400"
            />
            <Select
              value={newExam.academic_year}
              onChange={(e) => setNewExam({ ...newExam, academic_year: e.target.value })}
              required
              options={years.map((y) => ({ value: y.id, label: y.name }))}
            />
            <input
              type="date"
              value={newExam.start_date}
              onChange={(e) => setNewExam({ ...newExam, start_date: e.target.value })}
              required
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100"
            />
            <input
              type="date"
              value={newExam.end_date}
              onChange={(e) => setNewExam({ ...newExam, end_date: e.target.value })}
              required
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingExam(false)}
              className="px-3 py-1.5 text-xs text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold"
            >
              Create Exam
            </button>
          </div>
        </form>
      )}

      {/* Main Grid: Exam Sessions + Papers + Marks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Exam & Subject Selector */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Select Exam</h3>
            <div className="space-y-1.5">
              {exams.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-slate-400">No exams found.</p>
              ) : (
                exams.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => setSelectedExamId(ex.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      selectedExamId === ex.id
                        ? 'bg-[#FACC15] text-slate-900 font-bold'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700/60 text-[#64748B] dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate">{ex.name}</span>
                    {ex.is_published && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-bold shrink-0">
                        <Lock className="w-2.5 h-2.5" />
                        <span>LOCKED</span>
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Subject Papers</h3>
              {hasPermission('examinations.manage') && !isExamPublished && (
                <button
                  type="button"
                  onClick={() => setIsAddingPaper(!isAddingPaper)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {isAddingPaper ? 'Cancel' : '+ Add Paper'}
                </button>
              )}
            </div>

            {isAddingPaper && (
              <form onSubmit={handleCreatePaperSubmit} className="p-3 bg-gray-50 dark:bg-slate-700/60 rounded-lg space-y-2 border border-gray-200 dark:border-slate-600">
                <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-slate-400">New Paper</span>
                <Select
                  value={newPaper.subject}
                  onChange={(e) => setNewPaper({ ...newPaper, subject: e.target.value })}
                  required
                  options={availableSubjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                />

                <Select
                  value={newPaper.academic_unit}
                  onChange={(e) => setNewPaper({ ...newPaper, academic_unit: e.target.value })}
                  required
                  options={availableSections.map((sec) => ({
                    value: sec.id,
                    label: sec.parent_name ? `${sec.parent_name} - ${sec.name}` : sec.name,
                  }))}
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    placeholder="Max"
                    value={newPaper.max_marks}
                    onChange={(e) => setNewPaper({ ...newPaper, max_marks: e.target.value })}
                    required
                    className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded"
                  />
                  <input
                    type="number"
                    placeholder="Pass"
                    value={newPaper.passing_marks}
                    onChange={(e) => setNewPaper({ ...newPaper, passing_marks: e.target.value })}
                    required
                    className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-1 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 text-[11px] font-bold rounded"
                >
                  Add Paper
                </button>
              </form>
            )}

            <div className="space-y-1.5">
              {examSubjects.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-slate-400">No subject papers added to this exam.</p>
              ) : (
                examSubjects.map((es) => (
                  <button
                    key={es.id}
                    onClick={() => setSelectedSubjectPaperId(es.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      selectedSubjectPaperId === es.id
                        ? 'bg-[#1E293B] dark:bg-slate-700 text-white font-bold'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700/40 text-[#64748B] dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <p className="truncate">{es.subject_name}</p>
                      <p className={`text-[10px] ${selectedSubjectPaperId === es.id ? 'text-gray-300 dark:text-slate-300' : 'text-[#64748B] dark:text-slate-400'}`}>
                        {es.unit_name}
                      </p>
                    </div>
                    <span className={`text-[10px] font-mono ${selectedSubjectPaperId === es.id ? 'text-yellow-300' : 'text-gray-400 dark:text-slate-400'}`}>
                      Max: {parseFloat(es.max_marks)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Marks Entry Grid */}
        <div className="lg:col-span-3 space-y-4">
          {loadingGrid ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-16 flex flex-col items-center justify-center text-xs text-[#64748B] dark:text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#FACC15]" />
              <span>Loading student marks grid...</span>
            </div>
          ) : !marksGrid ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-16 text-center text-xs text-[#64748B] dark:text-slate-400">
              Select an exam session and a subject paper to view or record student marks.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              {/* Paper Header */}
              <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-800/80">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#1E293B] dark:text-slate-100">
                      {marksGrid.subject?.name} ({marksGrid.subject?.code})
                    </h2>
                    <span className="text-xs text-[#64748B] dark:text-slate-400">— {marksGrid.unit?.name}</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    Max Marks: {parseFloat(marksGrid.max_marks)} • Passing: {parseFloat(marksGrid.passing_marks)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isExamPublished ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800/40">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Results Published & Immutable</span>
                    </div>
                  ) : (
                    hasPermission('examinations.enter_marks') && (
                      <button
                        onClick={handleSaveMarks}
                        disabled={submittingMarks}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{submittingMarks ? 'Saving...' : 'Save & Evaluate Grades'}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Grid Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-100">
                  <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-6">Roll No</th>
                      <th className="py-3 px-6">Student Name</th>
                      <th className="py-3 px-6">Admission No</th>
                      <th className="py-3 px-6">Marks Obtained</th>
                      <th className="py-3 px-6">Absent</th>
                      <th className="py-3 px-6 text-right">Snapshotted Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {marksGrid.students.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                          No students enrolled in this academic unit.
                        </td>
                      </tr>
                    ) : (
                      marksGrid.students.map((st) => {
                        const local = localMarks[st.membership_id] || {};
                        return (
                          <tr key={st.membership_id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#64748B] dark:text-slate-400">
                              #{st.roll_number || '—'}
                            </td>
                            <td className="py-3.5 px-6 font-semibold text-xs text-[#1E293B] dark:text-slate-100">
                              {st.full_name}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-xs text-[#64748B] dark:text-slate-400">
                              {st.admission_number || '—'}
                            </td>
                            <td className="py-3.5 px-6">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={parseFloat(marksGrid.max_marks)}
                                disabled={isExamPublished || local.is_absent}
                                value={local.marks ?? ''}
                                onChange={(e) => handleMarksChange(st.membership_id, e.target.value)}
                                placeholder="0.00"
                                className="w-24 px-2.5 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-[#FACC15] disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:text-gray-400"
                              />
                            </td>
                            <td className="py-3.5 px-6">
                              <label className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-slate-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={isExamPublished}
                                  checked={Boolean(local.is_absent)}
                                  onChange={(e) => handleAbsentToggle(st.membership_id, e.target.checked)}
                                  className="rounded text-[#FACC15] focus:ring-[#FACC15]"
                                />
                                <span>Absent</span>
                              </label>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              {st.grade_snapshot ? (
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded text-xs font-black font-mono ${
                                    st.grade_snapshot === 'A+' || st.grade_snapshot === 'A'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                      : st.grade_snapshot === 'B' || st.grade_snapshot === 'C'
                                      ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                                      : st.grade_snapshot === 'D'
                                      ? 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300'
                                      : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                                  }`}
                                >
                                  {st.grade_snapshot}
                                </span>
                              ) : (
                                <span className="text-xs text-[#64748B] dark:text-slate-400 italic">Not Evaluated</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
