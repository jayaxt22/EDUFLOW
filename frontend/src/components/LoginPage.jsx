import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { School, Lock, User, AlertCircle, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';

const PRESET_ACCOUNTS = [
  { label: 'Admin', username: 'admin_horizon', password: 'HorizonPass123!', role: 'ADMIN', name: 'Dr. Alistair Vance' },
  { label: 'Teacher', username: 'teacher_horizon', password: 'HorizonPass123!', role: 'TEACHER', name: 'Sarah Jenkins' },
  { label: 'Student', username: 'student_horizon', password: 'HorizonPass123!', role: 'STUDENT', name: 'Leo Miller' },
  { label: 'Finance Staff', username: 'finance_horizon', password: 'HorizonPass123!', role: 'STAFF', name: 'Eleanor Rigby' },
];

export const LoginPage = ({ onBackToHome }) => {
  const { login, tenantSlug, setTenantSlug } = useAuth();
  const [username, setUsername] = useState('admin_horizon');
  const [password, setPassword] = useState('HorizonPass123!');
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectPreset = (preset) => {
    setSelectedRole(preset.role);
    setUsername(preset.username);
    setPassword(preset.password);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FACC15] text-[#1E293B] shadow-md mb-3">
          <School className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#1E293B] tracking-tight">EduFlow ERP</h1>
        <p className="text-[#64748B] text-sm mt-1">Multi-Institution School Management System</p>
      </div>

      {/* Centered Login Card per doc/design_system.md */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Public Homepage</span>
          </button>
        )}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#1E293B]">Institutional Login</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Select a demo role or enter credentials</p>
          </div>
          <span className="px-2.5 py-1 bg-yellow-50 text-yellow-800 text-[11px] font-bold rounded-full border border-yellow-200">
            Tenant: {tenantSlug}
          </span>
        </div>

        {/* Quick Role Switcher Chips */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
            One-Click Demo Roles
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_ACCOUNTS.map((preset) => (
              <button
                key={preset.username}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`py-2 px-3 text-xs font-bold rounded-lg border text-left transition-all ${
                  username === preset.username
                    ? 'bg-[#FACC15] text-[#1E293B] border-[#FACC15] shadow-xs'
                    : 'bg-gray-50 text-[#64748B] border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="font-semibold">{preset.label}</div>
                <div className="text-[10px] opacity-75 font-normal truncate">{preset.name}</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Institution Slug */}
          <div>
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Institution Slug
            </label>
            <input
              type="text"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              required
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
              placeholder="e.g. horizon"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                placeholder="e.g. admin_horizon (or admin)"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          {/* Yellow Log In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2.5 px-4 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Log In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-center text-[11px] text-[#64748B]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
          <span>HttpOnly JWT Cookie Session • Zero localStorage</span>
        </div>
      </div>
    </div>
  );
};
