import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import { School } from 'lucide-react';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [view, setView] = useState('landing'); // 'landing' | 'login'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-center items-center">
        <div className="w-12 h-12 rounded-xl bg-[#FACC15] flex items-center justify-center text-[#1E293B] shadow-sm animate-pulse mb-3">
          <School className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-[#64748B]">Initializing EduFlow...</p>
      </div>
    );
  }

  if (user) {
    return <AdminDashboard />;
  }

  return view === 'login' ? (
    <LoginPage onBackToHome={() => setView('landing')} />
  ) : (
    <LandingPage onNavigateToLogin={() => setView('login')} />
  );
};

export const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
