import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { announcementService } from '../services/announcements';
import { academicsService } from '../services/academics';
import { Select } from './Select';
import {
  Megaphone,
  Plus,
  Share2,
  Calendar,
  User,
  Tag,
  Building,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
} from 'lucide-react';

export const AnnouncementsView = () => {
  const { user, hasPermission } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTarget, setFilterTarget] = useState('ALL');

  // Creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTargetRole, setFormTargetRole] = useState('ALL');
  const [formTargetUnit, setFormTargetUnit] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forwarding modal state
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [forwardAnnouncement, setForwardAnnouncement] = useState(null);
  const [forwardUnitId, setForwardUnitId] = useState('');
  const [forwarding, setForwarding] = useState(false);

  // Non-negotiable requirement: Only administrators can create or forward announcements; teachers and students can read only
  const isAdmin = user?.role === 'ADMIN' || user?.membership?.role === 'ADMIN' || hasPermission('announcements.create_global');
  const canCreateGlobal = isAdmin;
  const canCreateClass = isAdmin;
  const canForward = isAdmin;
  const canPost = isAdmin;

  useEffect(() => {
    loadAnnouncements();
    if (canPost || canForward) {
      loadUnits();
    }
  }, []);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await announcementService.listAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError(err.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  const loadUnits = async () => {
    try {
      const data = await academicsService.listUnits();
      setUnits(data || []);
    } catch (err) {
      console.error('Error loading units:', err);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: formTitle.trim(),
        content: formContent.trim(),
        target_role: formTargetRole,
        target_academic_unit_id: formTargetUnit || null,
      };

      await announcementService.createAnnouncement(payload);
      setIsCreateOpen(false);
      setFormTitle('');
      setFormContent('');
      setFormTargetRole('ALL');
      setFormTargetUnit('');
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to create announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForward = async (e) => {
    e.preventDefault();
    if (!forwardAnnouncement || !forwardUnitId) return;

    setForwarding(true);
    setError(null);
    try {
      await announcementService.forwardAnnouncement(forwardAnnouncement.id, forwardUnitId);
      setIsForwardOpen(false);
      setForwardAnnouncement(null);
      setForwardUnitId('');
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to forward announcement.');
    } finally {
      setForwarding(false);
    }
  };

  const filteredAnnouncements = announcements.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.author_name && item.author_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterTarget === 'ALL') return true;
    if (filterTarget === 'CLASS') return !!item.target_academic_unit;
    return item.target_role === filterTarget;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] dark:text-slate-100 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[#EAB308]" />
            Announcements & Notice Board
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400">
            School-wide announcements, role updates, and class notices.
          </p>
        </div>

        {canPost && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FACC15] hover:bg-yellow-400 text-[#1E293B] font-semibold text-sm rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Post Announcement
          </button>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg flex items-center justify-between text-sm text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-gray-400 dark:text-slate-400 shrink-0" />
          {[
            { id: 'ALL', label: 'All Notices' },
            { id: 'CLASS', label: 'Class Notices' },
            { id: 'STUDENT', label: 'Students' },
            { id: 'TEACHER', label: 'Teachers' },
            { id: 'STAFF', label: 'Staff' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterTarget(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterTarget === chip.id
                  ? 'bg-[#1E293B] dark:bg-[#FACC15] text-white dark:text-slate-900 shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Loading notices...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-200">No Announcements Found</h3>
          <p className="text-sm text-gray-400 dark:text-slate-400 mt-1">
            {searchQuery
              ? 'No announcements match your search query.'
              : 'There are currently no active announcements for your role or class.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnnouncements.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Badges row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.target_academic_unit_name ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                        <Building className="w-3 h-3" />
                        {item.target_academic_unit_name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        <Tag className="w-3 h-3" />
                        {item.target_role === 'ALL' ? 'All School' : item.target_role}
                      </span>
                    )}

                    {item.forwarded_from_title && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                        <Share2 className="w-3 h-3" />
                        Forwarded
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 dark:text-slate-400 flex items-center gap-1 shrink-0">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.published_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-2 leading-snug">
                  {item.title}
                </h3>

                <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-4">
                  {item.content}
                </p>
              </div>

              {/* Author & Action Footer */}
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 flex items-center justify-center font-bold text-[10px]">
                    {item.author_name ? item.author_name[0] : 'U'}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700 dark:text-slate-200">{item.author_name}</span>
                    <span className="text-gray-400 dark:text-slate-400 text-[11px] ml-1.5">({item.author_role})</span>
                  </div>
                </div>

                {canForward && (
                  <button
                    onClick={() => {
                      setForwardAnnouncement(item);
                      setIsForwardOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition"
                    title="Forward announcement to a class section"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Forward
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Announcement Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-yellow-500" />
                New Announcement
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End of Term Examination Schedule"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {canCreateGlobal && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Target Audience
                    </label>
                    <Select
                      value={formTargetRole}
                      onChange={(e) => {
                        setFormTargetRole(e.target.value);
                        if (e.target.value !== 'STUDENT') setFormTargetUnit('');
                      }}
                      options={[
                        { value: 'ALL', label: 'All School' },
                        { value: 'STUDENT', label: 'Students Only' },
                        { value: 'TEACHER', label: 'Teachers Only' },
                        { value: 'STAFF', label: 'Staff Only' },
                      ]}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Class Section (Optional)
                  </label>
                  <Select
                    value={formTargetUnit}
                    onChange={(e) => setFormTargetUnit(e.target.value)}
                    placeholder="None (School-wide)"
                    options={[
                      { value: '', label: 'None (School-wide)' },
                      ...units.map((u) => ({ value: u.id, label: u.name })),
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Announcement Details *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write message details clearly..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-[#1E293B] font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forward Announcement Modal */}
      {isForwardOpen && forwardAnnouncement && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Forward to Class
              </h3>
              <button
                onClick={() => setIsForwardOpen(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-slate-700/60 rounded-lg border border-gray-200 dark:border-slate-600 text-sm">
              <p className="font-semibold text-gray-800 dark:text-slate-100">{forwardAnnouncement.title}</p>
              <p className="text-gray-500 dark:text-slate-300 text-xs mt-1 line-clamp-2">
                {forwardAnnouncement.content}
              </p>
            </div>

            <form onSubmit={handleForward} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Target Academic Unit *
                </label>
                <Select
                  required
                  value={forwardUnitId}
                  onChange={(e) => setForwardUnitId(e.target.value)}
                  placeholder="Select target section..."
                  options={[
                    { value: '', label: 'Select target section...' },
                    ...units.map((u) => ({ value: u.id, label: u.name })),
                  ]}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsForwardOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forwarding || !forwardUnitId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {forwarding ? 'Forwarding...' : 'Confirm Forward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
