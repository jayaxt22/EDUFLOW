import React, { useState, useEffect } from 'react';
import { academicsService } from '../services/academics';
import { userService } from '../services/users';
import { PromotionModal } from './PromotionModal';
import { Select } from './Select';
import {
  Calendar,
  Layers,
  BookOpen,
  UserCheck,
  Plus,
  ArrowUpRight,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';

export const ClassSetupView = () => {
  const [years, setYears] = useState([]);
  const [units, setUnits] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isPromotionOpen, setIsPromotionOpen] = useState(false);

  // Form states
  const [newYear, setNewYear] = useState({ name: '', start_date: '', end_date: '', is_current: false });
  const [newUnit, setNewUnit] = useState({ academic_year: '', name: '', unit_type: 'CLASS', parent: '' });
  const [unitMode, setUnitMode] = useState('CREATE_CLASS'); // 'CREATE_CLASS' | 'ADD_SECTION'
  const [newClassInitialSection, setNewClassInitialSection] = useState('Section A');
  const [newSubject, setNewSubject] = useState({ name: '', code: '' });
  const [newAssignment, setNewAssignment] = useState({ membership: '', academic_unit: '', subject: '', is_class_teacher: false });
  const [selectedClassIdForTeacher, setSelectedClassIdForTeacher] = useState('');

  const loadAllAcademics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [yearsData, unitsData, subjectsData, assignmentsData, usersData] = await Promise.all([
        academicsService.listYears(),
        academicsService.listUnits(),
        academicsService.listSubjects(),
        academicsService.listAssignments(),
        userService.listUsers().catch(() => []),
      ]);

      setYears(yearsData || []);
      setUnits(unitsData || []);
      setSubjects(subjectsData || []);
      setAssignments(assignmentsData || []);

      // Auto-preselect first class & section for Teacher Allocation form
      if (unitsData && unitsData.length > 0) {
        const classesList = unitsData.filter(u => u.unit_type === 'CLASS');
        if (classesList.length > 0 && !selectedClassIdForTeacher) {
          const firstClass = classesList[0];
          setSelectedClassIdForTeacher(firstClass.id);
          const childSecs = unitsData.filter(u => u.unit_type === 'SECTION' && (u.parent === firstClass.id || u.parent_id === firstClass.id));
          if (childSecs.length > 0) {
            setNewAssignment(prev => ({ ...prev, academic_unit: childSecs[0].id }));
          }
        }
      }

      // Filter teachers from users
      const teacherList = (usersData || []).filter(u => u.role === 'TEACHER');
      setTeachers(teacherList);

      // Set default academic year for unit form
      const currentYr = (yearsData || []).find(y => y.is_current) || (yearsData || [])[0];
      if (currentYr) {
        setNewUnit(prev => ({ ...prev, academic_year: currentYr.id }));
      }
    } catch (err) {
      console.error('Error loading academics setup data:', err);
      setError('Failed to load academic setup information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAcademics();
  }, []);

  const handleCreateYear = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await academicsService.createYear(newYear);
      setSuccess('Academic Year created successfully.');
      setNewYear({ name: '', start_date: '', end_date: '', is_current: false });
      loadAllAcademics();
    } catch (err) {
      setError(err.message || 'Failed to create academic year.');
    }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (unitMode === 'CREATE_CLASS') {
        const payload = {
          academic_year: newUnit.academic_year,
          name: newUnit.name.trim(),
          unit_type: 'CLASS',
          initial_section_name: newClassInitialSection.trim() || 'Section A',
        };
        await academicsService.createUnit(payload);
        setSuccess(`Class "${newUnit.name}" and initial section created successfully.`);
        setNewUnit(prev => ({ ...prev, name: '', parent: '' }));
      } else {
        const parentClass = classes.find(c => c.id === newUnit.parent);
        const payload = {
          academic_year: parentClass?.academic_year || newUnit.academic_year,
          name: newUnit.name.trim(),
          unit_type: 'SECTION',
          parent: newUnit.parent,
        };
        await academicsService.createUnit(payload);
        setSuccess(`Section "${newUnit.name}" added to "${parentClass?.name || 'Class'}".`);
        setNewUnit(prev => ({ ...prev, name: '' }));
      }
      loadAllAcademics();
    } catch (err) {
      setError(err.message || 'Failed to create academic unit.');
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await academicsService.createSubject(newSubject);
      setSuccess('Subject created successfully.');
      setNewSubject({ name: '', code: '' });
      loadAllAcademics();
    } catch (err) {
      setError(err.message || 'Failed to create subject.');
    }
  };

  const handleTeacherClassChange = (classId) => {
    setSelectedClassIdForTeacher(classId);
    const childSections = units.filter(u => u.unit_type === 'SECTION' && (u.parent === classId || u.parent_id === classId));
    setNewAssignment(prev => ({
      ...prev,
      academic_unit: childSections.length > 0 ? childSections[0].id : ''
    }));
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!newAssignment.academic_unit) {
      setError('Please select a valid Class and Section for allocation.');
      return;
    }
    try {
      const payload = {
        membership: newAssignment.membership,
        academic_unit: newAssignment.academic_unit,
        subject: newAssignment.subject || null,
        is_class_teacher: Boolean(newAssignment.is_class_teacher),
        reassign_class_teacher: Boolean(newAssignment.is_class_teacher),
      };
      await academicsService.assignTeacher(payload);
      setSuccess('Teacher assigned successfully.');
      setNewAssignment(prev => ({ ...prev, membership: '', subject: '', is_class_teacher: false }));
      loadAllAcademics();
    } catch (err) {
      setSuccess(null);
      setError(err.message || 'Failed to assign teacher.');
    }
  };

  // Group units by Class
  const classes = units.filter(u => u.unit_type === 'CLASS');
  const sections = units.filter(u => u.unit_type === 'SECTION');

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] dark:text-slate-100">Academic Structure & Allocations</h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            Configure Academic Years, Classes, Sections, Subjects, and Faculty Allocations
          </p>
        </div>

        <button
          onClick={() => setIsPromotionOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FACC15] hover:bg-[#EAB308] text-slate-900 font-bold text-sm rounded-xl shadow-xs transition-colors shrink-0"
        >
          <ArrowUpRight className="w-4 h-4 font-bold" />
          <span>Promote Students</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 rounded-xl text-xs text-green-800 dark:text-green-300">
          <Check className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-[#64748B] dark:text-slate-400 text-xs gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FACC15]" />
          <span>Loading academic records...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Academic Years */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E293B] dark:text-slate-100">Academic Years</h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">School calendar cycles</p>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              {years.map(yr => (
                <div key={yr.id} className="p-3 bg-gray-50 dark:bg-slate-900/60 border border-transparent dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#1E293B] dark:text-slate-100">{yr.name}</span>
                    <span className="text-[11px] text-[#64748B] dark:text-slate-400 ml-2">
                      ({yr.start_date} to {yr.end_date})
                    </span>
                  </div>
                  {yr.is_current && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-transparent dark:border-green-800/40">
                      CURRENT
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleCreateYear} className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                New Academic Year
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="e.g. 2027-2028"
                  value={newYear.name}
                  onChange={e => setNewYear({ ...newYear, name: e.target.value })}
                  required
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-1 focus:ring-[#FACC15]"
                />
                <input
                  type="date"
                  value={newYear.start_date}
                  onChange={e => setNewYear({ ...newYear, start_date: e.target.value })}
                  required
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 focus:ring-1 focus:ring-[#FACC15]"
                />
                <input
                  type="date"
                  value={newYear.end_date}
                  onChange={e => setNewYear({ ...newYear, end_date: e.target.value })}
                  required
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newYear.is_current}
                    onChange={e => setNewYear({ ...newYear, is_current: e.target.checked })}
                    className="rounded text-[#FACC15] focus:ring-[#FACC15]"
                  />
                  <span>Set as current year</span>
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Year</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Academic Units (Classes & Sections) */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E293B] dark:text-slate-100">Classes & Sections</h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">Grade hierarchy & classrooms</p>
              </div>
            </div>

            {/* List Hierarchy */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {classes.length === 0 ? (
                <div className="text-xs text-[#64748B] dark:text-slate-400 text-center py-4">No classes configured.</div>
              ) : (
                classes.map(cls => {
                  const childSections = sections.filter(s => s.parent === cls.id);
                  return (
                    <div key={cls.id} className="p-3 bg-gray-50 dark:bg-slate-900/60 border border-transparent dark:border-slate-700 rounded-lg space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-bold text-[#1E293B] dark:text-slate-100">
                        <span>{cls.name}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setUnitMode('ADD_SECTION');
                              setNewUnit(prev => ({ ...prev, parent: cls.id, name: '' }));
                            }}
                            className="px-2 py-0.5 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-[#1E293B] dark:text-slate-200 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-semibold"
                            title="Add section to this class"
                          >
                            + Section
                          </button>
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded">CLASS</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {childSections.length === 0 ? (
                          <span className="text-[11px] text-[#64748B] dark:text-slate-400 italic">No sections</span>
                        ) : (
                          childSections.map(sec => (
                            <span
                              key={sec.id}
                              className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[11px] text-[#1E293B] dark:text-slate-200 font-medium"
                            >
                              {sec.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUnit} className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnitMode('CREATE_CLASS')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    unitMode === 'CREATE_CLASS'
                      ? 'bg-[#FACC15] text-slate-900'
                      : 'bg-gray-100 dark:bg-slate-700 text-[#64748B] dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Create Class
                </button>
                <button
                  type="button"
                  onClick={() => setUnitMode('ADD_SECTION')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    unitMode === 'ADD_SECTION'
                      ? 'bg-[#FACC15] text-slate-900'
                      : 'bg-gray-100 dark:bg-slate-700 text-[#64748B] dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Increase Section
                </button>
              </div>

              {unitMode === 'CREATE_CLASS' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Class Name (e.g. Class 11)"
                    value={newUnit.name}
                    onChange={e => setNewUnit({ ...newUnit, name: e.target.value })}
                    required
                    className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-1 focus:ring-[#FACC15]"
                  />
                  <Select
                    value={newUnit.academic_year}
                    onChange={e => setNewUnit({ ...newUnit, academic_year: e.target.value })}
                    placeholder="Select Year"
                  >
                    <option value="">Select Year</option>
                    {years.map(y => (
                      <option key={y.id} value={y.id}>{y.name} {y.is_current ? '(Current)' : ''}</option>
                    ))}
                  </Select>
                  <input
                    type="text"
                    placeholder="Initial Section (e.g. Section A)"
                    value={newClassInitialSection}
                    onChange={e => setNewClassInitialSection(e.target.value)}
                    required
                    className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    value={newUnit.parent}
                    onChange={e => setNewUnit({ ...newUnit, parent: e.target.value })}
                    placeholder="Select Target Class"
                  >
                    <option value="">Select Target Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                  <input
                    type="text"
                    placeholder="New Section Name (e.g. Section B)"
                    value={newUnit.name}
                    onChange={e => setNewUnit({ ...newUnit, name: e.target.value })}
                    required
                    className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                  {unitMode === 'CREATE_CLASS'
                    ? 'A class is created once with its initial section.'
                    : 'Add more sections to any existing class.'}
                </span>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{unitMode === 'CREATE_CLASS' ? 'Create Class & Section' : 'Add Section'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 3: Subjects */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E293B] dark:text-slate-100">Course Subjects</h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">Curriculum subjects & course codes</p>
              </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {subjects.map(s => (
                <div key={s.id} className="p-2.5 bg-gray-50 dark:bg-slate-900/60 border border-transparent dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1E293B] dark:text-slate-100 truncate">{s.name}</span>
                  <span className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded shrink-0 border border-transparent dark:border-emerald-800/40">
                    {s.code}
                  </span>
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubject} className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                New Subject
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Subject Name (e.g. Physics)"
                  value={newSubject.name}
                  onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                  required
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-1 focus:ring-[#FACC15]"
                />
                <input
                  type="text"
                  placeholder="Code (e.g. PHY-10)"
                  value={newSubject.code}
                  onChange={e => setNewSubject({ ...newSubject, code: e.target.value })}
                  required
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Subject</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 4: Teacher Allocations */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E293B] dark:text-slate-100">Teacher Allocations</h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">Class teachers & subject teachers</p>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {assignments.map(a => (
                <div key={a.id} className="p-2.5 bg-gray-50 dark:bg-slate-900/60 border border-transparent dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#1E293B] dark:text-slate-100">{a.teacher_name}</span>
                    <span className="text-[11px] text-[#64748B] dark:text-slate-400 ml-2">
                      → {a.academic_unit_name || a.unit_name} {a.subject_name ? `(${a.subject_name})` : ''}
                    </span>
                  </div>
                  {a.is_class_teacher && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0 border border-transparent dark:border-amber-800/40">
                      CLASS TEACHER
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAssignment} className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                New Allocation
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-[#64748B] dark:text-slate-400 mb-0.5">Faculty / Teacher *</label>
                  <Select
                    value={newAssignment.membership}
                    onChange={e => setNewAssignment({ ...newAssignment, membership: e.target.value })}
                    placeholder="Select Teacher"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.membership_id || t.id}>{t.full_name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#64748B] dark:text-slate-400 mb-0.5">Class / Grade *</label>
                  <Select
                    value={selectedClassIdForTeacher}
                    onChange={e => handleTeacherClassChange(e.target.value)}
                    placeholder="Select Class"
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#64748B] dark:text-slate-400 mb-0.5">Section *</label>
                  <Select
                    value={newAssignment.academic_unit}
                    onChange={e => setNewAssignment({ ...newAssignment, academic_unit: e.target.value })}
                    placeholder={
                      !selectedClassIdForTeacher
                        ? 'Select Class first'
                        : units.filter(u => u.unit_type === 'SECTION' && (u.parent === selectedClassIdForTeacher || u.parent_id === selectedClassIdForTeacher)).length === 0
                        ? 'No sections found'
                        : 'Select Section'
                    }
                  >
                    <option value="">
                      {!selectedClassIdForTeacher
                        ? 'Select Class first'
                        : units.filter(u => u.unit_type === 'SECTION' && (u.parent === selectedClassIdForTeacher || u.parent_id === selectedClassIdForTeacher)).length === 0
                        ? 'No sections found'
                        : 'Select Section'}
                    </option>
                    {units
                      .filter(u => u.unit_type === 'SECTION' && (u.parent === selectedClassIdForTeacher || u.parent_id === selectedClassIdForTeacher))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#64748B] dark:text-slate-400 mb-0.5">Subject (Optional)</label>
                  <Select
                    value={newAssignment.subject}
                    onChange={e => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                    placeholder="Subject (Optional)"
                  >
                    <option value="">Subject (Optional)</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAssignment.is_class_teacher}
                      onChange={e => setNewAssignment({ ...newAssignment, is_class_teacher: e.target.checked })}
                      className="rounded text-[#FACC15] focus:ring-[#FACC15]"
                    />
                    <span>Assign as Class Teacher</span>
                  </label>
                  {newAssignment.is_class_teacher && (() => {
                    const sec = units.find(u => u.id === newAssignment.academic_unit);
                    return sec?.class_teacher_name ? (
                      <span className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                        Will replace {sec.class_teacher_name}
                      </span>
                    ) : null;
                  })()}
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promotion Modal */}
      <PromotionModal
        isOpen={isPromotionOpen}
        onClose={() => setIsPromotionOpen(false)}
        onPromoted={loadAllAcademics}
      />
    </div>
  );
};
