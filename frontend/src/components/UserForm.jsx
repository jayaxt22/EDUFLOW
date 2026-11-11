import React, { useState, useEffect, useRef } from 'react';
import { userService } from '../services/users';
import { academicsService } from '../services/academics';
import { Avatar } from './Avatar';
import { Select } from './Select';
import { X, UserPlus, UserCheck, AlertCircle, CheckCircle, Upload } from 'lucide-react';

export const UserForm = ({ isOpen, onClose, onUserCreated, initialData = null }) => {
  const isEditMode = !!initialData;
  const fileInputRef = useRef(null);
  const [role, setRole] = useState('STUDENT');
  const [units, setUnits] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [fetchingId, setFetchingId] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    dob: '',
    nationality: '',
    date_of_joining: '',
    phone: '',
    gender: 'MALE',
    password: '',
    admission_number: '',
    academic_unit_id: '',
    roll_number: '',
    guardian_name: '',
    guardian_phone: '',
    employee_id: '',
    qualification: '',
    staff_type: 'FINANCE',
    department: '',
    designation: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch academic units for student class assignment
  useEffect(() => {
    if (isOpen) {
      academicsService.listUnits()
        .then((data) => setUnits(data || []))
        .catch((err) => console.error('Failed to load academic units:', err));
    }
  }, [isOpen]);

  const getDefaultIdentifier = (r) => {
    switch (r) {
      case 'STUDENT': return 'STU-1001';
      case 'TEACHER': return 'T-1001';
      case 'STAFF': return 'EMP-1001';
      case 'ADMIN': return 'ADM-1001';
      default: return '';
    }
  };

  const fetchNextIdentifier = async (targetRole) => {
    try {
      setFetchingId(true);
      const res = await userService.getNextIdentifier(targetRole);
      if (res?.data?.identifier) {
        const autoId = res.data.identifier;
        setFormData((prev) => {
          const updated = { ...prev };
          if (targetRole === 'STUDENT') updated.admission_number = autoId;
          else if (targetRole === 'TEACHER' || targetRole === 'STAFF') updated.employee_id = autoId;
          else if (targetRole === 'ADMIN') updated.username = autoId;
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to fetch next identifier:', err);
    } finally {
      setFetchingId(false);
    }
  };

  // Synchronize form initialization when modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) return;

    setAvatarFile(null);
    setAvatarPreview(null);
    setError('');
    setSuccess('');

    if (initialData) {
      const r = initialData.role || 'STUDENT';
      setRole(r);
      const parentUnitId = initialData.profile?.parent_unit_id || '';
      setSelectedClassId(parentUnitId);

      setFormData({
        email: initialData.email || '',
        username: initialData.username || '',
        full_name: initialData.full_name || '',
        dob: initialData.dob || initialData.profile?.dob || '',
        nationality: initialData.nationality || '',
        date_of_joining: initialData.date_of_joining || '',
        phone: initialData.phone || '',
        gender: initialData.gender || 'MALE',
        password: '',
        admission_number: initialData.profile?.admission_number || '',
        academic_unit_id: initialData.profile?.academic_unit_id || '',
        roll_number: initialData.profile?.roll_number || initialData.roll_number || '',
        guardian_name: initialData.profile?.guardian_name || '',
        guardian_phone: initialData.profile?.guardian_phone || '',
        employee_id: initialData.profile?.employee_id || '',
        qualification: initialData.profile?.qualification || '',
        staff_type: initialData.profile?.staff_type || 'FINANCE',
        department: initialData.profile?.department || '',
        designation: initialData.profile?.designation || '',
      });
    } else {
      const defaultRole = 'STUDENT';
      setRole(defaultRole);
      setSelectedClassId('');
      const defaultId = getDefaultIdentifier(defaultRole);

      setFormData({
        email: '',
        username: '',
        full_name: '',
        dob: '',
        nationality: '',
        date_of_joining: '',
        phone: '',
        gender: 'MALE',
        password: '',
        admission_number: defaultId,
        academic_unit_id: '',
        roll_number: '',
        guardian_name: '',
        guardian_phone: '',
        employee_id: '',
        qualification: '',
        staff_type: 'FINANCE',
        department: '',
        designation: '',
      });

      // Immediately fetch official next identifier sequence from backend
      fetchNextIdentifier(defaultRole);
    }
  }, [initialData, isOpen]);

  // Sync selectedClassId once units load if not already set
  useEffect(() => {
    if (formData.academic_unit_id && !selectedClassId && units.length > 0) {
      const u = units.find((x) => x.id === formData.academic_unit_id);
      if (u) {
        const pId = typeof u.parent === 'object' ? u.parent?.id : u.parent;
        if (pId) setSelectedClassId(pId);
      }
    }
  }, [formData.academic_unit_id, selectedClassId, units]);

  const handleRoleSelect = (newRole) => {
    if (isEditMode || newRole === role) return;
    setRole(newRole);
    const defaultId = getDefaultIdentifier(newRole);
    setFormData((prev) => {
      const updated = { ...prev };
      if (newRole === 'STUDENT') updated.admission_number = defaultId;
      else if (newRole === 'TEACHER' || newRole === 'STAFF') updated.employee_id = defaultId;
      else if (newRole === 'ADMIN') updated.username = defaultId;
      return updated;
    });
    fetchNextIdentifier(newRole);
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar image file size must be less than 2MB.');
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      setError('Only .jpg, .jpeg, and .png image files are allowed.');
      return;
    }

    setError('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Derive classes and sections
  const classUnits = units.filter((u) => u.unit_type === 'CLASS');
  const sectionUnits = units.filter((u) => {
    if (u.unit_type !== 'SECTION') return false;
    if (!selectedClassId) return true;
    const parentId = typeof u.parent === 'object' ? u.parent?.id : u.parent;
    return parentId === selectedClassId;
  });

  const handleClassChange = (e) => {
    const clsId = e.target.value;
    setSelectedClassId(clsId);
    setFormData((prev) => ({ ...prev, academic_unit_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('full_name', formData.full_name);
      if (formData.phone) fd.append('phone', formData.phone);
      if (formData.gender) fd.append('gender', formData.gender);
      if (formData.dob) fd.append('dob', formData.dob);
      if (formData.nationality) fd.append('nationality', formData.nationality);
      if (formData.date_of_joining) fd.append('date_of_joining', formData.date_of_joining);
      if (avatarFile) fd.append('avatar', avatarFile);

      if (isEditMode) {
        if (role === 'STUDENT') {
          if (formData.admission_number) fd.append('admission_number', formData.admission_number);
          if (formData.guardian_name) fd.append('guardian_name', formData.guardian_name);
          if (formData.guardian_phone) fd.append('guardian_phone', formData.guardian_phone);
          if (formData.academic_unit_id) {
            fd.append('academic_unit_id', formData.academic_unit_id);
            if (formData.roll_number) {
              fd.append('roll_number', formData.roll_number);
            }
          }
        } else if (role === 'TEACHER') {
          if (formData.employee_id) fd.append('employee_id', formData.employee_id);
          if (formData.qualification) fd.append('qualification', formData.qualification);
        } else if (role === 'STAFF') {
          if (formData.employee_id) fd.append('employee_id', formData.employee_id);
          if (formData.staff_type) fd.append('staff_type', formData.staff_type);
          if (formData.department) fd.append('department', formData.department);
          if (formData.designation) fd.append('designation', formData.designation);
        }

        await userService.updateUser(initialData.id, fd);
        setSuccess(`User ${formData.full_name} updated successfully!`);
      } else {
        fd.append('role', role);
        fd.append('email', formData.email);
        fd.append('username', formData.username);
        fd.append('password', formData.password);

        if (role === 'STUDENT') {
          fd.append('admission_number', formData.admission_number);
          if (formData.guardian_name) fd.append('guardian_name', formData.guardian_name);
          if (formData.guardian_phone) fd.append('guardian_phone', formData.guardian_phone);

          if (formData.academic_unit_id) {
            fd.append('academic_unit_id', formData.academic_unit_id);
            fd.append('roll_number', formData.roll_number);
          }
        } else if (role === 'TEACHER') {
          fd.append('employee_id', formData.employee_id);
          if (formData.qualification) fd.append('qualification', formData.qualification);
        } else if (role === 'STAFF') {
          fd.append('employee_id', formData.employee_id);
          fd.append('staff_type', formData.staff_type);
          if (formData.department) fd.append('department', formData.department);
          if (formData.designation) fd.append('designation', formData.designation);
        }

        await userService.createUser(fd);
        setSuccess(`User successfully created as ${role}!`);
      }

      setTimeout(() => {
        if (onUserCreated) onUserCreated();
        onClose();
      }, 800);
    } catch (err) {
      setError(err.message || 'Failed to submit user details. Please review input fields.');
    } finally {
      setLoading(false);
    }
  };

  const previewUser = avatarPreview
    ? { full_name: formData.full_name || 'User', avatar: avatarPreview }
    : { full_name: formData.full_name || 'User', avatar: initialData?.avatar || initialData?.avatar_url };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 text-slate-800 dark:text-slate-100">
        <div className="flex justify-between items-center pb-4 mb-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FACC15] flex items-center justify-center text-slate-900">
              {isEditMode ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-slate-100">
                {isEditMode ? `Edit User: ${initialData.full_name}` : 'Create Institutional User'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                {isEditMode
                  ? 'Update user contact details and domain profile'
                  : 'Atomic creation of user, membership, and domain profile'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-[#EF4444] dark:text-red-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 text-[#22C55E] dark:text-green-300 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection (Locked in Edit Mode) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                Institutional Role
              </label>
              {isEditMode && (
                <span className="text-[11px] text-gray-400 dark:text-slate-500 italic">Role cannot be changed</span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['ADMIN', 'TEACHER', 'STUDENT', 'STAFF'].map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={isEditMode}
                  onClick={() => handleRoleSelect(r)}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                    role === r
                      ? 'bg-[#FACC15] text-slate-900 border-[#FACC15] shadow-xs'
                      : isEditMode
                      ? 'bg-gray-50 dark:bg-slate-900/40 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-700 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-700 text-[#64748B] dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Common Identity Information */}
          <div>
            <h4 className="text-xs font-bold text-[#1E293B] dark:text-slate-200 uppercase tracking-wider mb-3">Identity Information</h4>
            
            {/* Avatar Photo Selection with Preview */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-700 mb-4">
              <Avatar user={previewUser} size="lg" className="rounded-xl border border-gray-200 dark:border-slate-600 shadow-xs" />
              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1">
                  Profile Picture
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-[#1E293B] dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-600 shadow-xs transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                    <span>{avatarFile ? avatarFile.name : 'Choose Photo (JPG/PNG < 2MB)'}</span>
                  </button>
                  {avatarFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-500 dark:text-red-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isEditMode}
                  placeholder="john@school.edu"
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    isEditMode
                      ? 'bg-gray-50 dark:bg-slate-900/40 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-700 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400">
                    {role === 'ADMIN' ? 'Admin ID / Username *' : 'Username *'}
                  </label>
                  {!isEditMode && role === 'ADMIN' && (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                      {fetchingId ? 'Generating...' : 'Auto-generated'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  disabled={isEditMode}
                  placeholder={role === 'ADMIN' ? 'ADM-1001' : 'john_doe'}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    isEditMode
                      ? 'bg-gray-50 dark:bg-slate-900/40 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-700 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]'
                  }`}
                />
              </div>

              {!isEditMode && (
                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Nationality</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  placeholder="e.g. American, Canadian, Indian"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Date of Joining</label>
                <input
                  type="date"
                  name="date_of_joining"
                  value={formData.date_of_joining}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1-555-0199"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Gender</label>
                <Select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Section: Student Profile & Class Assignment */}
          {role === 'STUDENT' && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-[#1E293B] dark:text-slate-200 uppercase tracking-wider mb-3">Student Profile & Academic Enrollment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400">Admission Number / Student ID *</label>
                    {!isEditMode && (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                        {fetchingId ? 'Generating...' : 'Auto-generated'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    name="admission_number"
                    value={formData.admission_number}
                    onChange={handleChange}
                    required
                    placeholder="STU-1001"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Assign Class / Grade</label>
                  <Select
                    value={selectedClassId}
                    onChange={handleClassChange}
                    placeholder="-- Select Class --"
                  >
                    <option value="">-- Select Class --</option>
                    {classUnits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Assign Section</label>
                  <Select
                    name="academic_unit_id"
                    value={formData.academic_unit_id}
                    onChange={handleChange}
                    placeholder="-- Select Section --"
                  >
                    <option value="">-- Select Section --</option>
                    {sectionUnits.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.parent_name ? `${s.parent_name} - ${s.name}` : s.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Roll Number</label>
                  <input
                    type="text"
                    name="roll_number"
                    value={formData.roll_number}
                    onChange={handleChange}
                    placeholder="e.g. 01, 15, A-22"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    name="guardian_name"
                    value={formData.guardian_name}
                    onChange={handleChange}
                    placeholder="Parent / Guardian"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Guardian Phone</label>
                  <input
                    type="text"
                    name="guardian_phone"
                    value={formData.guardian_phone}
                    onChange={handleChange}
                    placeholder="+1-555-0188"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section: Teacher Profile Fields */}
          {role === 'TEACHER' && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-[#1E293B] dark:text-slate-200 uppercase tracking-wider mb-3">Teacher Profile Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400">Teacher Employee ID *</label>
                    {!isEditMode && (
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/40">
                        {fetchingId ? 'Generating...' : 'Auto-generated'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleChange}
                    required
                    placeholder="T-1001"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Highest Qualification</label>
                  <input
                    type="text"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    placeholder="e.g. M.Sc. Mathematics, B.Ed."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section: Staff Profile Fields */}
          {role === 'STAFF' && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-[#1E293B] dark:text-slate-200 uppercase tracking-wider mb-3">Staff Profile Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400">Staff Employee ID *</label>
                    {!isEditMode && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                        {fetchingId ? 'Generating...' : 'Auto-generated'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleChange}
                    required
                    placeholder="EMP-1001"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Staff Type *</label>
                  <Select
                    name="staff_type"
                    value={formData.staff_type}
                    onChange={handleChange}
                  >
                    <option value="FINANCE">Finance / Accounts</option>
                    <option value="RECEPTION">Reception / Front Desk</option>
                    <option value="LIBRARY">Library</option>
                    <option value="OTHER">General / Other</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="e.g. Accounts & Billing"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">Designation</label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g. Accountant"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[#64748B] dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#FACC15] hover:bg-[#EAB308] text-slate-900 font-bold text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : `Create ${role}`)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
