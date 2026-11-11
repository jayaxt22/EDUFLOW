import React, { useState, useEffect } from 'react';
import { academicsService } from '../services/academics';
import { userService } from '../services/users';
import { Select } from './Select';
import {
  Layers,
  Search,
  Loader2,
  AlertCircle,
  Building,
  UserCheck,
  UserX,
  BookOpen,
  Calendar,
  Plus,
  Users,
  Check,
  X,
  ChevronRight,
  UserPlus,
  Trash2,
  ArrowRightLeft,
  AlertTriangle
} from 'lucide-react';

export const AdminClassesView = () => {
  const [units, setUnits] = useState([]);
  const [years, setYears] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [selectedParentClass, setSelectedParentClass] = useState(null);
  const [selectedTargetSection, setSelectedTargetSection] = useState(null); // { cls, sec }

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    unit: null, // { id, name, unit_type, parent_name }
  });

  // Section Roster modal state
  const [rosterModal, setRosterModal] = useState({
    isOpen: false,
    cls: null,
    sec: null,
    students: [],
    loading: false,
  });

  // Move / Transfer student modal state
  const [transferModal, setTransferModal] = useState({
    isOpen: false,
    student: null,
    fromCls: null,
    fromSec: null,
    targetSectionId: '',
    newRollNumber: '',
    transferDate: new Date().toISOString().split('T')[0],
  });

  // Form states
  const [newClass, setNewClass] = useState({
    name: '',
    academic_year: '',
    initial_section_name: 'Section A',
  });
  const [newSection, setNewSection] = useState({
    name: '',
  });
  const [assignTeacherForm, setAssignTeacherForm] = useState({
    membership: '',
    is_class_teacher: true,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitsData, yearsData, usersData] = await Promise.all([
        academicsService.listUnits(),
        academicsService.listYears(),
        userService.listUsers().catch(() => []),
      ]);
      setUnits(unitsData || []);
      setYears(yearsData || []);
      setTeachers((usersData || []).filter((u) => u.role === 'TEACHER'));

      // Default academic year for modal
      const currentYear = (yearsData || []).find((y) => y.is_current) || (yearsData || [])[0];
      if (currentYear) {
        setNewClass((prev) => ({ ...prev, academic_year: currentYear.id }));
      }
    } catch (err) {
      console.error('Failed to load academic units:', err);
      if (err.status === 401) {
        setError('Your session has expired. Please log in again to continue.');
      } else {
        setError(err.message || 'Failed to load academic units.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter only top-level CLASS units for the main table
  const classUnits = units.filter((u) => u.unit_type === 'CLASS');
  const sectionUnits = units.filter((u) => u.unit_type === 'SECTION');

  // KPI Calculations
  const totalClasses = classUnits.length;
  const totalSections = sectionUnits.length;
  const totalAssignedTeachers = sectionUnits.filter((s) => Boolean(s.class_teacher_name)).length;
  const totalEnrolledStudents = classUnits.reduce((acc, c) => acc + (c.student_count || 0), 0);

  // Search filter
  const filteredClasses = classUnits.filter((c) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(q);
    const yearMatch = c.academic_year_name?.toLowerCase().includes(q);
    const childMatch = (c.children || []).some(
      (child) =>
        child.name?.toLowerCase().includes(q) ||
        child.class_teacher_name?.toLowerCase().includes(q)
    );
    return nameMatch || yearMatch || childMatch;
  });

  // Handler: Create Class with Initial Section
  const handleCreateClass = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await academicsService.createUnit({
        academic_year: newClass.academic_year,
        name: newClass.name.trim(),
        unit_type: 'CLASS',
        initial_section_name: newClass.initial_section_name.trim() || 'Section A',
      });
      setSuccess(`Class "${newClass.name}" and initial section created successfully.`);
      setIsCreateClassOpen(false);
      setNewClass((prev) => ({ ...prev, name: '', initial_section_name: 'Section A' }));
      await loadData();
    } catch (err) {
      if (err.status === 401) {
        setError('Your session has expired. Please log in again to create classes.');
      } else {
        setError(err.message || 'Failed to create class.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Add Section to Existing Class
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!selectedParentClass) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await academicsService.createUnit({
        academic_year: selectedParentClass.academic_year,
        name: newSection.name.trim(),
        unit_type: 'SECTION',
        parent: selectedParentClass.id,
      });
      setSuccess(`Section "${newSection.name}" added to "${selectedParentClass.name}".`);
      setIsAddSectionOpen(false);
      setNewSection({ name: '' });
      setSelectedParentClass(null);
      await loadData();
    } catch (err) {
      if (err.status === 401) {
        setError('Your session has expired. Please log in again to add sections.');
      } else {
        setError(err.message || 'Failed to add section.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openAddSectionModal = (cls) => {
    setSelectedParentClass(cls);
    // Suggest next section letter (e.g. if A exists, suggest "Section B")
    const existingCount = cls.children ? cls.children.length : 0;
    const nextLetter = String.fromCharCode(65 + existingCount); // 65 = 'A', 66 = 'B'
    setNewSection({ name: `Section ${nextLetter}` });
    setIsAddSectionOpen(true);
  };

  const openAssignTeacherModal = (cls, sec) => {
    setSelectedTargetSection({ cls, sec });
    setAssignTeacherForm({
      membership: '',
      is_class_teacher: true,
    });
    setIsAssignTeacherOpen(true);
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    if (!selectedTargetSection) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await academicsService.assignTeacher({
        membership: assignTeacherForm.membership,
        academic_unit: selectedTargetSection.sec.id,
        is_class_teacher: Boolean(assignTeacherForm.is_class_teacher),
        reassign_class_teacher: true,
      });
      setSuccess(`Teacher allocated to "${selectedTargetSection.cls.name} — ${selectedTargetSection.sec.name}" successfully.`);
      setIsAssignTeacherOpen(false);
      setSelectedTargetSection(null);
      await loadData();
    } catch (err) {
      if (err.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || 'Failed to assign teacher.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignTeacher = async () => {
    if (!selectedTargetSection) return;
    const currentName = selectedTargetSection.sec.class_teacher_name || 'the current teacher';
    if (!window.confirm(`Are you sure you want to unassign ${currentName} as Class Teacher for ${selectedTargetSection.cls.name} — ${selectedTargetSection.sec.name}?`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await academicsService.unassignClassTeacher({
        academic_unit: selectedTargetSection.sec.id,
      });
      setSuccess(`Class teacher unassigned from "${selectedTargetSection.cls.name} — ${selectedTargetSection.sec.name}".`);
      setIsAssignTeacherOpen(false);
      setSelectedTargetSection(null);
      await loadData();
    } catch (err) {
      if (err.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || 'Failed to unassign class teacher.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Class / Section Handler
  const confirmDeleteUnit = async () => {
    if (!deleteModal.unit) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await academicsService.deleteUnit(deleteModal.unit.id);
      setSuccess(`${deleteModal.unit.unit_type === 'CLASS' ? 'Class' : 'Section'} "${deleteModal.unit.name}" was deleted successfully.`);
      setDeleteModal({ isOpen: false, unit: null });
      await loadData();
    } catch (err) {
      if (err.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || 'Failed to delete academic unit.');
      }
      setDeleteModal({ isOpen: false, unit: null });
    } finally {
      setActionLoading(false);
    }
  };

  // Section Roster Modal Handler
  const openSectionRosterModal = async (cls, sec) => {
    setRosterModal({
      isOpen: true,
      cls,
      sec,
      students: [],
      loading: true,
    });
    try {
      const enrollments = await academicsService.listEnrollments({ academic_unit: sec.id });
      setRosterModal((prev) => ({
        ...prev,
        students: enrollments || [],
        loading: false,
      }));
    } catch (err) {
      console.error('Failed to load section roster:', err);
      setRosterModal((prev) => ({
        ...prev,
        students: [],
        loading: false,
      }));
    }
  };

  // Open Transfer Modal from Roster
  const openTransferModal = (student, fromCls, fromSec) => {
    setTransferModal({
      isOpen: true,
      student,
      fromCls,
      fromSec,
      targetSectionId: '',
      newRollNumber: student.roll_number || '',
      transferDate: new Date().toISOString().split('T')[0],
    });
  };

  // Submit Student Section Transfer
  const handleTransferStudent = async (e) => {
    e.preventDefault();
    if (!transferModal.student || !transferModal.targetSectionId) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await academicsService.transferStudent({
        student_membership_id: transferModal.student.membership,
        target_unit_id: transferModal.targetSectionId,
        new_roll_number: transferModal.newRollNumber.trim() || undefined,
        transfer_date: transferModal.transferDate,
      });
      setSuccess(`Student "${transferModal.student.student_name}" was successfully moved to new section.`);
      const currentSecId = rosterModal.sec?.id;
      setTransferModal({
        isOpen: false,
        student: null,
        fromCls: null,
        fromSec: null,
        targetSectionId: '',
        newRollNumber: '',
        transferDate: new Date().toISOString().split('T')[0],
      });
      await loadData();
      if (currentSecId) {
        const updated = await academicsService.listEnrollments({ academic_unit: currentSecId });
        setRosterModal((prev) => ({ ...prev, students: updated || [] }));
      }
    } catch (err) {
      if (err.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || 'Failed to move student.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-700 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FACC15] flex items-center justify-center text-slate-900">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1E293B] dark:text-slate-100">Classes & Sections</h1>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
              Academic classes, section allocations, and classroom teachers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-[#1E293B] dark:text-slate-200 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-600 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setIsCreateClassOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 text-xs font-bold rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Class</span>
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Total Classes</span>
            <Layers className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-[#1E293B] dark:text-slate-100 mt-2 font-mono">{totalClasses}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Active Sections</span>
            <BookOpen className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-[#1E293B] dark:text-slate-100 mt-2 font-mono">{totalSections}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Assigned Teachers</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-2 font-mono">{totalAssignedTeachers}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Enrolled Students</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-2 font-mono">{totalEnrolledStudents}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748B] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by class name, section, or teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-xs bg-gray-50/50 dark:bg-slate-800 text-[#1E293B] dark:text-slate-200 placeholder:text-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Refined Classes & Sections Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#64748B] dark:text-slate-400 text-xs gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#FACC15]" />
            <span>Loading academic classes & sections...</span>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-[#1E293B] dark:text-slate-100">No classes found</div>
            <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No classes match your search query.'
                : 'Get started by creating your first academic class and initial section.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsCreateClassOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition-colors mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Class</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-200">
              <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-6">Class / Grade</th>
                  <th className="py-3.5 px-6">Academic Year</th>
                  <th className="py-3.5 px-6">Sections Breakdown & Class Teachers</th>
                  <th className="py-3.5 px-6 text-center">Total Strength</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredClasses.map((cls) => {
                  const children = cls.children || [];
                  const classStudentCount = cls.student_count || 0;

                  return (
                    <tr key={cls.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors align-top">
                      {/* 1. Class Name */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-[#1E293B] dark:text-slate-100 flex items-center gap-2">
                            <span>{cls.name}</span>
                          </div>
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
                            {children.length} {children.length === 1 ? 'Section' : 'Sections'}
                          </span>
                        </div>
                      </td>

                      {/* 2. Academic Year */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
                          <span>{cls.academic_year_name || '—'}</span>
                        </div>
                      </td>

                      {/* 3. Refined Sections Breakdown */}
                      <td className="py-4 px-6">
                        <div className="space-y-2">
                          {children.length === 0 ? (
                            <span className="text-xs text-[#64748B] dark:text-slate-400 italic">No sections configured</span>
                          ) : (
                            children.map((sec) => (
                              <div
                                key={sec.id}
                                className="flex flex-wrap items-center gap-2.5 p-2 bg-gray-50/80 dark:bg-slate-800/90 rounded-lg border border-gray-100 dark:border-slate-700 text-xs"
                              >
                                <span className="font-bold text-[#1E293B] dark:text-slate-100 bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-600 shrink-0">
                                  {sec.name}
                                </span>

                                <span className="text-[#64748B] dark:text-slate-400 text-[11px]">Teacher:</span>
                                {sec.class_teacher_name ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-green-400 bg-emerald-50 dark:bg-green-900/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-green-800/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-green-400" />
                                    {sec.class_teacher_name}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-[#64748B] dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded font-medium">
                                    Not Assigned
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openAssignTeacherModal(cls, sec)}
                                  className="text-[10px] text-blue-600 dark:text-yellow-400 dark:hover:text-yellow-300 font-semibold underline cursor-pointer ml-1"
                                >
                                  {sec.class_teacher_name ? 'Change' : '+ Assign'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openSectionRosterModal(cls, sec)}
                                  className="ml-auto text-[11px] font-mono text-blue-600 dark:text-yellow-400 hover:underline flex items-center gap-1 cursor-pointer bg-blue-50/50 dark:bg-yellow-950/30 px-2 py-0.5 rounded border border-blue-100 dark:border-yellow-900/30 transition-colors"
                                  title="Click to view students and transfer sections"
                                >
                                  <Users className="w-3 h-3" />
                                  <span>{sec.student_count || 0} students</span>
                                  <ChevronRight className="w-2.5 h-2.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteModal({ isOpen: true, unit: { ...sec, parent_name: cls.name } })}
                                  className="p-1 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition-colors rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 ml-1"
                                  title={`Delete ${sec.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      {/* 4. Total Strength */}
                      <td className="py-4 px-6 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-mono text-xs font-bold border border-transparent dark:border-blue-800/40">
                          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{classStudentCount}</span>
                        </div>
                      </td>

                      {/* 5. Actions: Add Section & Delete Class */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openAddSectionModal(cls)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1E293B] dark:text-slate-200 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-600 transition-colors"
                            title="Increase sections for this class"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Section</span>
                          </button>
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, unit: cls })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-gray-200 dark:border-slate-700 transition-colors"
                            title={`Delete ${cls.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Create New Class (with Initial Section) */}
      {isCreateClassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FACC15] flex items-center justify-center text-slate-900">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">Create New Class</h3>
              </div>
              <button
                onClick={() => setIsCreateClassOpen(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#64748B] dark:text-slate-400">
              In EduFlow, a class cannot exist without a section. A class is created once, and its initial section is created atomically.
            </p>

            <form onSubmit={handleCreateClass} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  Class / Grade Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Class 10 or Grade 9"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  Academic Year *
                </label>
                <Select
                  value={newClass.academic_year}
                  onChange={(e) => setNewClass({ ...newClass, academic_year: e.target.value })}
                  placeholder="Select Academic Year"
                >
                  <option value="">Select Academic Year</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.is_current ? '(Current)' : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  Initial Section Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Section A or A"
                  value={newClass.initial_section_name}
                  onChange={(e) =>
                    setNewClass({ ...newClass, initial_section_name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-[#FACC15]"
                />
                <span className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 block">
                  Additional sections can be added anytime once the class is created.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateClassOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Class & Section</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Section to Existing Class */}
      {isAddSectionOpen && selectedParentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">
                  Add Section to {selectedParentClass.name}
                </h3>
              </div>
              <button
                onClick={() => setIsAddSectionOpen(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-slate-900/60 rounded-lg text-xs space-y-1 border border-transparent dark:border-slate-700">
              <span className="font-semibold text-[#64748B] dark:text-slate-400">Existing Sections:</span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {(selectedParentClass.children || []).map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[11px] font-medium text-slate-800 dark:text-slate-200"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddSection} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  New Section Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Section B or B"
                  value={newSection.name}
                  onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddSectionOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Section</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Assign Class Teacher */}
      {isAssignTeacherOpen && selectedTargetSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">
                    {selectedTargetSection.sec.class_teacher_name ? 'Change Class Teacher' : 'Assign Class Teacher'}
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    {selectedTargetSection.cls.name} — {selectedTargetSection.sec.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAssignTeacherOpen(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedTargetSection.sec.class_teacher_name && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold">Current Class Teacher: </span>
                  <span className="font-bold text-amber-950 dark:text-amber-100">{selectedTargetSection.sec.class_teacher_name}</span>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Assigning a new faculty member will replace the current Class Teacher.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUnassignTeacher}
                  disabled={actionLoading}
                  className="shrink-0 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 rounded text-[11px] font-semibold transition-colors disabled:opacity-50"
                  title="Remove Class Teacher without assigning a replacement"
                >
                  Unassign
                </button>
              </div>
            )}

            <form onSubmit={handleAssignTeacher} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  Select Teacher *
                </label>
                <Select
                  value={assignTeacherForm.membership}
                  onChange={(e) => setAssignTeacherForm({ ...assignTeacherForm, membership: e.target.value })}
                  placeholder="-- Choose Faculty Member --"
                >
                  <option value="">-- Choose Faculty Member --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.membership_id || t.id}>
                      {t.full_name} ({t.email})
                    </option>
                  ))}
                </Select>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#64748B] dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={assignTeacherForm.is_class_teacher}
                  onChange={(e) => setAssignTeacherForm({ ...assignTeacherForm, is_class_teacher: e.target.checked })}
                  className="rounded text-[#FACC15] focus:ring-[#FACC15]"
                />
                <span className="font-semibold text-[#1E293B] dark:text-slate-200">Assign as official Class Teacher</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAssignTeacherOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{selectedTargetSection.sec.class_teacher_name ? 'Confirm Reassignment' : 'Confirm Allocation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Confirmation */}
      {deleteModal.isOpen && deleteModal.unit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">
                  Delete {deleteModal.unit.unit_type === 'CLASS' ? 'Class' : 'Section'}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  {deleteModal.unit.unit_type === 'CLASS'
                    ? `Class: ${deleteModal.unit.name}`
                    : `Section: ${deleteModal.unit.name} (under ${deleteModal.unit.parent_name || 'Class'})`}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#64748B] dark:text-slate-300">
              {deleteModal.unit.unit_type === 'CLASS'
                ? `Are you sure you want to delete "${deleteModal.unit.name}"? If any child sections contain enrolled students, deletion will be blocked.`
                : `Are you sure you want to delete "${deleteModal.unit.name}"? If students are enrolled or this is the only section, deletion will be blocked.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, unit: null })}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUnit}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Section Student Roster */}
      {rosterModal.isOpen && rosterModal.sec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl border border-gray-100 dark:border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FACC15] flex items-center justify-center text-slate-900 font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">
                    {rosterModal.cls?.name} — {rosterModal.sec?.name} Roster
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    {rosterModal.students.length} Enrolled {rosterModal.students.length === 1 ? 'Student' : 'Students'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRosterModal({ isOpen: false, cls: null, sec: null, students: [], loading: false })}
                className="text-gray-400 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {rosterModal.loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FACC15]" />
                  <span>Loading enrolled students...</span>
                </div>
              ) : rosterModal.students.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                  No active students currently enrolled in this section.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {rosterModal.students.map((student) => (
                    <div
                      key={student.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {student.student_name ? student.student_name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-[#1E293B] dark:text-slate-100">
                            {student.student_name}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400">
                            <span>Roll: <strong className="text-slate-700 dark:text-slate-300">{student.roll_number || '—'}</strong></span>
                            <span>•</span>
                            <span>Adm: <strong className="text-slate-700 dark:text-slate-300">{student.admission_number || '—'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openTransferModal(student, rosterModal.cls, rosterModal.sec)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/40 dark:hover:bg-yellow-900/40 text-yellow-900 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Move to another section"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Move Section</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setRosterModal({ isOpen: false, cls: null, sec: null, students: [], loading: false })}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Move / Transfer Student to Another Section */}
      {transferModal.isOpen && transferModal.student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FACC15] flex items-center justify-center text-slate-900">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">
                  Move Student to Section
                </h3>
              </div>
              <button
                onClick={() => setTransferModal({ isOpen: false, student: null, fromCls: null, fromSec: null, targetSectionId: '', newRollNumber: '', transferDate: new Date().toISOString().split('T')[0] })}
                className="text-gray-400 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student details summary card */}
            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-xs space-y-1 border border-gray-200 dark:border-slate-600">
              <div className="font-bold text-[#1E293B] dark:text-slate-100">
                {transferModal.student.student_name}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-300">
                Current Class: <span className="font-semibold text-slate-800 dark:text-slate-200">{transferModal.fromCls?.name} — {transferModal.fromSec?.name}</span>
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-300">
                Current Roll No: <span className="font-semibold text-slate-800 dark:text-slate-200">{transferModal.student.roll_number || '—'}</span>
              </div>
            </div>

            <form onSubmit={handleTransferStudent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  Target Section *
                </label>
                <Select
                  value={transferModal.targetSectionId}
                  onChange={(e) => setTransferModal({ ...transferModal, targetSectionId: e.target.value })}
                  placeholder="-- Choose Target Section --"
                >
                  <option value="">-- Choose Target Section --</option>
                  {units
                    .filter((u) => u.unit_type === 'CLASS')
                    .map((parentCls) => {
                      const availableSecs = (parentCls.children || []).filter(
                        (sec) => sec.id !== transferModal.fromSec?.id
                      );
                      if (availableSecs.length === 0) return null;
                      return (
                        <optgroup key={parentCls.id} label={parentCls.name}>
                          {availableSecs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {parentCls.name} — {s.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  Roll Number in New Section
                </label>
                <input
                  type="text"
                  placeholder="e.g. 15 (leave blank to keep current roll)"
                  value={transferModal.newRollNumber}
                  onChange={(e) => setTransferModal({ ...transferModal, newRollNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">
                  Effective Transfer Date
                </label>
                <input
                  type="date"
                  value={transferModal.transferDate}
                  onChange={(e) => setTransferModal({ ...transferModal, transferDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-[#1E293B] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setTransferModal({ isOpen: false, student: null, fromCls: null, fromSec: null, targetSectionId: '', newRollNumber: '', transferDate: new Date().toISOString().split('T')[0] })}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Transfer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
