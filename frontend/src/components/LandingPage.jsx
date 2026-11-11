import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  ArrowRight,
  Users,
  GraduationCap,
  CalendarCheck,
  Building2,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Clock3,
  IndianRupee,
  ClipboardList,
  School,
  Lock,
  Sparkles,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', href: '#overview' },
  { label: 'Features', href: '#features' },
  { label: 'Attendance', href: '#attendance' },
  { label: 'Academic & Faculty', href: '#faculty' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

const FEATURES = [
  {
    id: 'attendance',
    title: 'Smart Attendance Roll Call',
    description:
      'Daily classroom roll call strictly restricted to assigned Class Teachers, with same-day attendance editing and real-time status counts.',
    icon: CalendarCheck,
    color: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  },
  {
    id: 'students',
    title: 'Student Directory & Records',
    description:
      'Manage student profiles, class & section enrollments, roll numbers, and auto-generated unique admission numbers (STU-XXXX).',
    icon: Users,
    color: 'bg-blue-50 text-blue-600 border border-blue-200',
  },
  {
    id: 'faculty',
    title: 'Teacher & Staff Allocation',
    description:
      'Assign official Class Teachers, subject specializations, and staff roles (Finance, Reception, Library) with auto employee IDs.',
    icon: GraduationCap,
    color: 'bg-violet-50 text-violet-600 border border-violet-200',
  },
  {
    id: 'academic',
    title: 'Academic Structure & Units',
    description:
      'Hierarchical classes and sections mapped to operational academic years with strict data isolation and capacity management.',
    icon: Building2,
    color: 'bg-amber-50 text-amber-600 border border-amber-200',
  },
  {
    id: 'fees',
    title: 'Fee Collection & Finance',
    description:
      'Set up class-specific fee structures, track pending dues, generate payment receipts, and maintain immutable financial records.',
    icon: IndianRupee,
    color: 'bg-rose-50 text-rose-600 border border-rose-200',
  },
  {
    id: 'security',
    title: 'Multi-Tenant Database Security',
    description:
      'Enterprise database-level tenant isolation, HttpOnly JWT authentication, and strict 4-role RBAC for Admin, Teacher, Student, and Staff.',
    icon: ShieldCheck,
    color: 'bg-teal-50 text-teal-600 border border-teal-200',
  },
];

export const LandingPage = ({ onNavigateToLogin }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-800 selection:bg-[#FACC15] selection:text-slate-900">
      {/* Sticky Top Navigation */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-yellow-200/70 bg-white/95 backdrop-blur-md shadow-xs transition-all">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          {/* Brand Logo */}
          <a href="#overview" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FACC15] text-[#1E293B] shadow-sm">
              <School className="w-6 h-6" />
            </span>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Edu<span className="text-yellow-500">Flow</span>
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 -mt-0.5">
                ERP Management
              </p>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-semibold text-slate-600 transition hover:text-yellow-600"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden shrink-0 lg:flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] hover:bg-yellow-400 px-5 py-2.5 text-sm font-bold text-[#1E293B] shadow-xs transition hover:shadow-sm"
            >
              <span>Sign In to Portal</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg border border-slate-200 p-2 text-slate-700 lg:hidden hover:bg-slate-50"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {/* Mobile Navigation Drawer */}
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-5 py-4 lg:hidden shadow-lg">
            <div className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-yellow-50 hover:text-yellow-700"
                >
                  {item.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigateToLogin();
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FACC15] px-4 py-3 font-bold text-[#1E293B]"
              >
                <span>Sign In to Portal</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section
        id="overview"
        className="relative scroll-mt-24 overflow-hidden pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-yellow-50/40 via-white to-white"
      >
        <div className="pointer-events-none absolute -right-28 -top-20 h-96 w-96 rounded-full bg-yellow-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-28 top-40 h-80 w-80 rounded-full bg-amber-100/40 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            {/* Tagline Pill */}
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50/80 px-4 py-1.5 text-xs font-bold text-yellow-900 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-[#FACC15]" />
              One Unified Multi-Tenant ERP Platform
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Manage Your Institution with{' '}
              <span className="text-yellow-500">EduFlow ERP</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Empower administrators, class teachers, students, and institutional staff with isolated database security,
              instant daily roll call, automated IDs, fee tracking, and streamlined academic workflows.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] hover:bg-yellow-400 px-6 py-3.5 font-bold text-[#1E293B] shadow-md shadow-yellow-500/20 transition hover:-translate-y-0.5"
              >
                <span>Launch Portal</span>
                <ArrowRight size={18} />
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:border-[#FACC15] hover:text-slate-900"
              >
                Explore Modules
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#22C55E]" />
                Zero Cross-Tenant Data Leaks
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#22C55E]" />
                Class-Teacher Attendance Guard
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#22C55E]" />
                HttpOnly JWT Authentication
              </span>
            </div>
          </div>

          {/* Interactive Live-Look Dashboard Preview Card */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-4 rounded-3xl bg-yellow-200/50 blur-2xl opacity-50" />

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Institution Admin Overview</p>
                  <p className="text-xs text-slate-500">Live school operations dashboard</p>
                </div>
                <span className="rounded-lg bg-yellow-100 p-2 text-yellow-800">
                  <BarChart3 size={18} />
                </span>
              </div>

              {/* 3 Metric Mini Widgets */}
              <div className="grid grid-cols-3 gap-3 p-4">
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <span className="inline-flex rounded-lg p-1.5 text-blue-600 bg-blue-50">
                    <Users size={16} />
                  </span>
                  <p className="mt-2 text-xl font-bold text-slate-900">1,248</p>
                  <p className="text-[11px] text-slate-500 font-medium">Students</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <span className="inline-flex rounded-lg p-1.5 text-violet-600 bg-violet-50">
                    <GraduationCap size={16} />
                  </span>
                  <p className="mt-2 text-xl font-bold text-slate-900">48</p>
                  <p className="text-[11px] text-slate-500 font-medium">Teachers</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <span className="inline-flex rounded-lg p-1.5 text-amber-600 bg-amber-50">
                    <Building2 size={16} />
                  </span>
                  <p className="mt-2 text-xl font-bold text-slate-900">16</p>
                  <p className="text-[11px] text-slate-500 font-medium">Sections</p>
                </div>
              </div>

              {/* Weekly Attendance Summary Graphic */}
              <div className="px-4 pb-4">
                <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-800">Weekly Attendance Rate</p>
                      <p className="text-[10px] text-slate-500">Class 10 - Section A (Average: 94.2%)</p>
                    </div>
                    <CalendarCheck className="text-yellow-600" size={18} />
                  </div>

                  <div className="mt-4 flex h-24 items-end gap-2.5">
                    {[
                      { day: 'Mon', height: 95 },
                      { day: 'Tue', height: 92 },
                      { day: 'Wed', height: 97 },
                      { day: 'Thu', height: 88 },
                      { day: 'Fri', height: 94 },
                      { day: 'Sat', height: 96 },
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-1 flex-col items-center gap-1.5">
                        <div
                          className="w-full rounded-t-md bg-[#FACC15] hover:bg-yellow-400 transition-all"
                          style={{ height: `${item.height}%` }}
                          title={`${item.day}: ${item.height}%`}
                        />
                        <span className="text-[10px] font-semibold text-slate-500">{item.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Security Notice */}
              <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs">
                <span className="rounded-full bg-emerald-100 p-1 text-emerald-700">
                  <ShieldCheck size={15} />
                </span>
                <p className="text-slate-600 font-medium">
                  Protected with multi-tenant database routing & Argon2 hashing.
                </p>
              </div>
            </div>

            {/* Floating Operations Pill */}
            <div className="absolute -left-6 top-1/3 hidden items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-lg lg:flex">
              <span className="rounded-lg bg-yellow-50 p-2 text-yellow-700">
                <Clock3 size={18} />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-800">Real-time Synchronization</p>
                <p className="text-[10px] text-slate-500">Zero latency roll call records</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Metrics Strip */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 sm:grid-cols-4 sm:px-8 text-center">
          <div>
            <p className="text-3xl font-extrabold text-yellow-500">100%</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tenant Database Isolation
            </p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-yellow-500">4 Roles</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Admin · Teacher · Student · Staff
            </p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-yellow-500">24/7</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              HttpOnly Secure Access
            </p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-yellow-500">0 Flaws</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Strict RBAC Validation
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="scroll-mt-24 px-5 py-20 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-yellow-600">
            Enterprise Architecture
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Engineered for Comprehensive School Management
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Every module is crafted to eliminate manual spreadsheets, enforce proper access guards, and maintain
            institutional compliance.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.id}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-[#FACC15] hover:shadow-lg"
              >
                <div className={`inline-flex rounded-xl p-3 ${feat.color}`}>
                  <Icon size={22} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-yellow-600 transition-colors">
                  {feat.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {feat.description}
                </p>
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-yellow-600 hover:text-yellow-700"
                >
                  Access Module <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* In-Depth Attendance Feature Showcase */}
      <section id="attendance" className="scroll-mt-24 bg-slate-50 py-20 px-5 sm:px-8 border-y border-slate-100">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-yellow-600">
              Role-Governed Roll Call
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Attendance Verification Built on Real Teaching Roles
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Teachers can only mark and update classroom roll call for the specific class or section where they are
              officially assigned as the Class Teacher. Unauthorized attempts receive an immediate security denial.
            </p>

            <ul className="mt-6 space-y-3.5 text-sm text-slate-700">
              {[
                'Assigned Class Teacher authorization check on every roll call submission',
                'Same-day attendance corrections allowed; past dates locked to Admin only',
                'Live present, absent, late, and excused student count summaries',
                'Instant monthly percentage calculation and low-attendance alerts',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  <span className="text-xs font-medium text-slate-700">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] hover:bg-yellow-400 px-5 py-3 font-bold text-xs text-[#1E293B] shadow-xs"
              >
                <span>Test Attendance Flow</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Class 10 - Section A Roll Call</h3>
                <p className="text-xs text-slate-500">Official Class Teacher: Sarah Jenkins</p>
              </div>
              <span className="px-2 py-1 bg-green-50 text-green-700 text-[11px] font-bold rounded-md border border-green-200">
                Active Session
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {[
                { name: 'Aarav Sharma', roll: '01', status: 'Present', color: 'bg-green-100 text-green-800' },
                { name: 'Leo Miller', roll: '02', status: 'Present', color: 'bg-green-100 text-green-800' },
                { name: 'Priya Singh', roll: '03', status: 'Absent', color: 'bg-red-100 text-red-800' },
                { name: 'Rohan Patel', roll: '04', status: 'Late', color: 'bg-yellow-100 text-yellow-800' },
              ].map((std) => (
                <div key={std.roll} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-700">
                      {std.roll}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{std.name}</p>
                      <p className="text-[10px] text-slate-500">Roll No: {std.roll}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${std.color}`}>
                    {std.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Connected Operations Modules */}
      <section id="faculty" className="scroll-mt-24 px-5 py-20 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-yellow-600">
            Institutional Operations
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Cohesive Departmental Workflows
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            All institutional operations connect through synchronized user memberships and unified permission sets.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-6">
            <Users size={28} className="text-purple-600" />
            <h3 className="mt-4 text-base font-bold text-slate-900">Student Enrollment</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Auto-generate admission IDs (STU-1001), prevent duplicate roll numbers within sections, and handle class
              reassignments seamlessly.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6">
            <GraduationCap size={28} className="text-blue-600" />
            <h3 className="mt-4 text-base font-bold text-slate-900">Faculty Allocations</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Manage teacher subject assignments, academic qualifications, and class teacher designations with
              automatic employee IDs (T-1001).
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
            <Building2 size={28} className="text-amber-600" />
            <h3 className="mt-4 text-base font-bold text-slate-900">Staff & Operations</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Equip Finance, Reception, and Library staff with pre-seeded, audited permissions without leaking administrative
              control.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing / Institution Quote */}
      <section id="pricing" className="scroll-mt-24 bg-slate-50 py-20 px-5 sm:px-8 border-t border-slate-100">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-extrabold uppercase tracking-widest text-yellow-600">
            Transparent Pricing
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Flexible Institutional Deployment
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Tailored deployment models for schools, academies, colleges, and multi-branch school networks.
          </p>

          <div className="mt-10 max-w-md mx-auto rounded-2xl border border-yellow-300 bg-white p-8 shadow-lg text-left">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 bg-yellow-100 text-yellow-900 text-[10px] font-extrabold rounded-md uppercase tracking-wide">
                Institutional License
              </span>
              <span className="text-xs text-slate-500 font-semibold">Annual Cycle</span>
            </div>

            <h3 className="mt-4 text-2xl font-extrabold text-slate-900">EduFlow Enterprise</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Complete ERP with dedicated tenant database, unlimited student enrollments, and full RBAC.
            </p>

            <div className="mt-6 flex items-baseline gap-1">
              <IndianRupee size={22} className="text-yellow-600" />
              <span className="text-3xl font-extrabold text-slate-900">Custom Quote</span>
            </div>

            <ul className="mt-6 space-y-3 border-t border-slate-100 pt-6 text-xs text-slate-600">
              {[
                'Full multi-tenant database isolation (PostgreSQL / SQLite)',
                'Class Teacher daily attendance & student directory',
                'Fee structures, dues tracking, and payment receipts',
                'Academic classes, sections, and subject allocations',
                'Unified User Management with auto ID sequences',
                'Audit logging & 24/7 technical support',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#22C55E] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onNavigateToLogin}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FACC15] hover:bg-yellow-400 px-5 py-3.5 font-bold text-xs text-[#1E293B] shadow-xs transition"
            >
              <span>Sign In to Institutional Portal</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Lead Capture / Contact Section */}
      <section id="contact" className="scroll-mt-24 px-5 py-20 sm:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-yellow-600">
              Contact & Inquiry
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Ready to Upgrade Your Institution?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Connect with our team to discuss customized modules, on-premise or cloud hosting, and data migration
              for your school or institution.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-700">
                <span className="rounded-lg bg-yellow-50 p-2 text-yellow-700 border border-yellow-200">
                  <ClipboardList size={18} />
                </span>
                <span>Custom tailored setups for single schools or multi-branch networks.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-700">
                <span className="rounded-lg bg-green-50 p-2 text-green-700 border border-green-200">
                  <ShieldCheck size={18} />
                </span>
                <span>Complete data privacy with dedicated per-tenant database boundaries.</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleContactSubmit} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
            <h3 className="text-lg font-bold text-slate-900">Request Institutional Demo</h3>
            <p className="text-xs text-slate-500 mt-1">Enter your work email to register an inquiry.</p>

            <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 mt-6 mb-1.5">
              Work / Institution Email *
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSubmitted(false);
              }}
              placeholder="principal@school.edu"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
            />

            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FACC15] hover:bg-yellow-400 px-5 py-3 font-bold text-xs text-[#1E293B] shadow-xs transition"
            >
              <span>Submit Interest</span>
              <ArrowRight size={15} />
            </button>

            {submitted && (
              <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-3 text-xs text-green-800 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <span>Thank you! Your institutional inquiry has been recorded.</span>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Comprehensive Footer */}
      <footer className="bg-slate-900 text-white px-5 sm:px-8 py-14">
        <div className="max-w-7xl mx-auto grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FACC15] text-[#1E293B]">
                <School className="w-5 h-5" />
              </span>
              <span className="text-xl font-extrabold tracking-tight">
                EduFlow <span className="text-[#FACC15]">ERP</span>
              </span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Modern multi-institution school management ERP built with robust tenant isolation and strict role-based access.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Quick Links</h4>
            <div className="mt-4 flex flex-col gap-2.5 text-xs text-slate-400">
              <a href="#overview" className="hover:text-[#FACC15] transition-colors">Overview</a>
              <a href="#features" className="hover:text-[#FACC15] transition-colors">Features</a>
              <a href="#attendance" className="hover:text-[#FACC15] transition-colors">Attendance</a>
              <a href="#faculty" className="hover:text-[#FACC15] transition-colors">Faculty & Staff</a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Modules</h4>
            <div className="mt-4 flex flex-col gap-2.5 text-xs text-slate-400">
              <button type="button" onClick={onNavigateToLogin} className="text-left hover:text-[#FACC15] transition-colors">
                Admin Console
              </button>
              <button type="button" onClick={onNavigateToLogin} className="text-left hover:text-[#FACC15] transition-colors">
                Class Teacher Roll Call
              </button>
              <button type="button" onClick={onNavigateToLogin} className="text-left hover:text-[#FACC15] transition-colors">
                Student Directory
              </button>
              <button type="button" onClick={onNavigateToLogin} className="text-left hover:text-[#FACC15] transition-colors">
                Fee Collection & Receipts
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Access Portal</h4>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Ready to test pre-seeded institutional accounts for Admin, Teacher, Student, or Finance?
            </p>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#FACC15] hover:bg-yellow-400 px-4 py-2.5 font-bold text-xs text-[#1E293B] shadow-xs transition"
            >
              <span>Go to Login</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} EduFlow ERP. All rights reserved.</p>
          <p className="text-slate-400">Engineered with multi-tenant database isolation.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
