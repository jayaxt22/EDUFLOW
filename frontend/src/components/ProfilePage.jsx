import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/users';
import { Avatar } from './Avatar';
import { Select } from './Select';
import {
  UserCircle,
  KeyRound,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Lock,
  User,
  GraduationCap,
  Briefcase,
  Building,
  Info,
  Calendar,
  Globe,
  Upload,
  Camera,
  Pencil,
  X,
  Loader2,
  HeartHandshake
} from 'lucide-react';

export const ProfilePage = () => {
  const { user: authUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // View vs Edit Mode State
  const [isEditing, setIsEditing] = useState(false);

  // Avatar upload state
  const fileInputRef = useRef(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(null);
  const [avatarError, setAvatarError] = useState(null);

  // Form state for personal details
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [phone, setPhone] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [gender, setGender] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const isStudent = profileData?.role === 'STUDENT';

  useEffect(() => {
    loadProfile();
  }, []);

  const populateFormFields = (data) => {
    setFullName(data.full_name || '');
    setDob(data.dob || data.profile?.dob || '');
    setNationality(data.nationality || '');
    setDateOfJoining(data.date_of_joining || '');
    setPhone(data.phone || '');
    setCurrentAddress(data.current_address || '');
    setGender(data.gender || 'MALE');
    setEmergencyName(data.emergency_contact_name || '');
    setEmergencyPhone(data.emergency_contact_phone || '');
    setEmergencyRelation(data.emergency_contact_relation || '');
  };

  const loadProfile = async () => {
    setLoading(true);
    setProfileError(null);
    try {
      const data = await userService.getProfile();
      setProfileData(data);
      populateFormFields(data);
    } catch (err) {
      setProfileError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (profileData) {
      populateFormFields(profileData);
    }
    setProfileError(null);
    setIsEditing(false);
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarSuccess(null);

    // File size check (< 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Avatar image file size must be less than 2MB.');
      return;
    }

    // Extension check
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      setAvatarError('Only .jpg, .jpeg, and .png image files are allowed.');
      return;
    }

    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const updated = await userService.updateProfile(formData);
      setProfileData(updated);
      setAvatarSuccess('Profile picture updated successfully!');
      setAvatarFile(null);
      setAvatarPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCancelAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      const payload = {
        phone: phone.trim(),
        current_address: currentAddress.trim(),
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: emergencyPhone.trim(),
        emergency_contact_relation: emergencyRelation.trim(),
        nationality: nationality.trim() || null,
      };

      // Only non-students can update full_name, dob, and gender
      if (!isStudent) {
        payload.full_name = fullName.trim();
        if (gender) payload.gender = gender;
        if (dob) payload.dob = dob;
      }

      const updated = await userService.updateProfile(payload);
      setProfileData(updated);
      populateFormFields(updated);
      setProfileMessage('Profile information updated successfully.');
      setIsEditing(false);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await userService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMessage('Password changed successfully! Next login will require your new password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordMessage(null);
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
        <div className="w-8 h-8 border-4 border-[#FACC15] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Loading your profile...</p>
      </div>
    );
  }

  const roleBadgeStyles = {
    ADMIN: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
    TEACHER: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
    STUDENT: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
    STAFF: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
  };

  const effectiveAvatarUser = avatarPreview
    ? { ...profileData, avatar: avatarPreview, avatar_url: avatarPreview }
    : profileData;

  const displayGender = profileData?.gender === 'MALE'
    ? 'Male'
    : profileData?.gender === 'FEMALE'
    ? 'Female'
    : profileData?.gender === 'OTHER'
    ? 'Other'
    : '—';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Alerts */}
      {profileMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{profileMessage}</span>
          </div>
          <button onClick={() => setProfileMessage(null)} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {profileError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{profileError}</span>
          </div>
          <button onClick={() => setProfileError(null)} className="text-red-600 hover:text-red-800 dark:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Profile Summary Card with Avatar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <Avatar
                user={effectiveAvatarUser}
                size="xl"
                className="rounded-2xl border-2 border-gray-100 dark:border-slate-700 shadow-sm"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                title="Change Profile Photo"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#1E293B] dark:text-slate-100">
                  {profileData?.full_name || 'User Profile'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${roleBadgeStyles[profileData?.role] || 'bg-gray-100 text-gray-800'}`}>
                  {profileData?.role}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {profileData?.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ID: {profileData?.id ? profileData.id.slice(0, 8) + '...' : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Role specific quick stats/details */}
          <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-slate-700 pt-4 sm:pt-0 sm:pl-6 text-xs text-gray-500 dark:text-slate-400">
            {profileData?.role === 'STUDENT' && (
              <>
                <p className="font-bold text-gray-800 dark:text-slate-200">Admission No: {profileData?.profile?.admission_number}</p>
                <p className="mt-0.5 text-gray-600 dark:text-slate-400">Guardian: {profileData?.profile?.guardian_name || 'Not Provided'}</p>
                {profileData?.profile?.guardian_phone && (
                  <p className="mt-0.5 text-gray-500 dark:text-slate-400">Guardian Phone: {profileData?.profile?.guardian_phone}</p>
                )}
              </>
            )}
            {profileData?.role === 'TEACHER' && (
              <>
                <p className="font-bold text-gray-800 dark:text-slate-200">Employee ID: {profileData?.profile?.employee_id}</p>
                <p className="mt-0.5 text-gray-600 dark:text-slate-400">{profileData?.profile?.qualification || 'Faculty Member'}</p>
                {profileData?.date_of_joining && (
                  <p className="mt-0.5 text-gray-500 dark:text-slate-400">Joined: {profileData.date_of_joining}</p>
                )}
              </>
            )}
            {profileData?.role === 'STAFF' && (
              <>
                <p className="font-bold text-gray-800 dark:text-slate-200">Staff ID: {profileData?.profile?.employee_id}</p>
                <p className="mt-0.5 text-gray-600 dark:text-slate-400">Type: {profileData?.profile?.staff_type} ({profileData?.profile?.department || 'Operations'})</p>
                {profileData?.date_of_joining && (
                  <p className="mt-0.5 text-gray-500 dark:text-slate-400">Joined: {profileData.date_of_joining}</p>
                )}
              </>
            )}
            {profileData?.role === 'ADMIN' && (
              <>
                <p className="font-bold text-gray-800 dark:text-slate-200">Institutional Head</p>
                <p className="mt-0.5 text-gray-600 dark:text-slate-400">Primary Administrator</p>
              </>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={handleAvatarFileChange}
          className="hidden"
        />

        {/* Avatar Upload Confirmation Banner (if photo chosen) */}
        {avatarFile && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Upload className="w-4 h-4 text-amber-600 shrink-0" />
              <span>New photo selected: <strong>{avatarFile.name}</strong></span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancelAvatar}
                disabled={uploadingAvatar}
                className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-gray-100 text-gray-700 dark:text-slate-300 font-semibold rounded-lg border border-gray-200 dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadAvatar}
                disabled={uploadingAvatar}
                className="px-3 py-1 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold rounded-lg transition disabled:opacity-50"
              >
                {uploadingAvatar ? 'Uploading...' : 'Save Photo'}
              </button>
            </div>
          </div>
        )}

        {avatarSuccess && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-semibold">
            {avatarSuccess}
          </p>
        )}
        {avatarError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-semibold">
            {avatarError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Details Card (Left 2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
          {/* Card Header with View/Edit Toggle */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
            <div>
              <h2 className="text-base font-bold text-[#1E293B] dark:text-slate-100 flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-yellow-500" />
                Personal & Contact Details
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {isEditing
                  ? 'Update your personal details and save changes.'
                  : 'Your verified institutional profile and contact information.'}
              </p>
            </div>

            {/* Action Buttons in Header */}
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition-colors shadow-sm"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingProfile}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateProfile}
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {savingProfile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>

          {/* VIEW MODE: Clean text display cards */}
          {!isEditing ? (
            <div className="space-y-5">
              {/* Primary Personal Attributes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Full Name
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">
                    {profileData?.full_name || '—'}
                  </span>
                  {isStudent && (
                    <span className="block text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                      (Institutional Name Locked)
                    </span>
                  )}
                </div>

                <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone Number
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">
                    {profileData?.phone || 'Not Provided'}
                  </span>
                </div>

                <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date of Birth
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">
                    {profileData?.dob || profileData?.profile?.dob || '—'}
                  </span>
                </div>

                <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
                    Gender
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">
                    {displayGender}
                  </span>
                </div>

                <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Nationality
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">
                    {profileData?.nationality || 'Not Provided'}
                  </span>
                </div>

                <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Building className="w-3 h-3" /> Date of Joining
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">
                    {profileData?.date_of_joining || '—'}
                  </span>
                </div>
              </div>

              {/* Address */}
              <div className="p-3.5 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Current Residential Address
                </span>
                <span className="text-xs text-[#1E293B] dark:text-slate-200">
                  {profileData?.current_address || 'No residential address on file.'}
                </span>
              </div>

              {/* Emergency Contact */}
              <div className="pt-2">
                <h3 className="text-xs font-bold text-[#1E293B] dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-rose-500" />
                  Emergency Contact Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
                      Contact Name
                    </span>
                    <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                      {profileData?.emergency_contact_name || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
                      Relationship
                    </span>
                    <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                      {profileData?.emergency_contact_relation || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
                      Emergency Phone
                    </span>
                    <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                      {profileData?.emergency_contact_phone || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* EDIT MODE: Interactive Form Inputs */
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Full Name {isStudent ? '(Read-only)' : '*'}
                  </label>
                  <input
                    type="text"
                    required={!isStudent}
                    disabled={isStudent}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none ${
                      isStudent
                        ? 'bg-gray-100 dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-[#FACC15]'
                    }`}
                  />
                  {isStudent && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Official student name locked by institution.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+1-555-0100"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Date of Birth {isStudent ? '(Locked)' : ''}
                  </label>
                  <input
                    type="date"
                    disabled={isStudent}
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none ${
                      isStudent
                        ? 'bg-gray-100 dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-[#FACC15]'
                    }`}
                  />
                  {isStudent && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Official date of birth locked by institution.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <Select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={isStudent}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. American, Canadian, Indian"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    disabled
                    value={dateOfJoining}
                    className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Current Residential Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street address, city, postal code..."
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              {/* Emergency Contacts in Edit Mode */}
              <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
                <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                  Emergency Contact Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mary Miller"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mother / Spouse"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+1-555-9999"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingProfile}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition disabled:opacity-50"
                >
                  {savingProfile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security & Credentials Card (Right col) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
            <div className="border-b border-gray-100 dark:border-slate-700 pb-3">
              <h2 className="text-base font-bold text-[#1E293B] dark:text-slate-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Security & Password
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Authentication credentials protected with Argon2 password hashing.
              </p>
            </div>

            <div className="p-3 bg-gray-50/70 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/60 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Password Status:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active & Protected
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                Last changed through institutional credentials manager.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPasswordError(null);
                setPasswordMessage(null);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setIsPasswordModalOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-yellow-400" />
              <span>Change Password</span>
            </button>
          </div>

          {/* Institutional Account Info Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-[#1E293B] dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Institutional Identity
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-700/50">
                <span className="text-gray-500 dark:text-slate-400">Username</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{profileData?.username}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-700/50">
                <span className="text-gray-500 dark:text-slate-400">Account Role</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{profileData?.role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-700/50">
                <span className="text-gray-500 dark:text-slate-400">Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-slate-400">Tenant DB</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">Isolated</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">
                    Change Password
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Set a secure password of at least 8 characters
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {passwordMessage}
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  New Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={changingPassword}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {changingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{changingPassword ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
