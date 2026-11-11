import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth';
import { setTenantSlug as setApiTenantSlug } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenantSlug, setTenantSlugState] = useState('horizon');
  const [loading, setLoading] = useState(true);

  const updateTenantSlug = (slug) => {
    setTenantSlugState(slug);
    setApiTenantSlug(slug);
  };

  useEffect(() => {
    // Attempt session rehydration via HttpOnly cookie
    const initAuth = async () => {
      try {
        const userData = await authService.getMe();
        setUser(userData);
      } catch (err) {
        // No active session or expired
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [tenantSlug]);

  useEffect(() => {
    // Reset user state when refresh fails or session expires
    const handleSessionExpired = () => {
      setUser(null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('eduflow:session_expired', handleSessionExpired);
      return () => window.removeEventListener('eduflow:session_expired', handleSessionExpired);
    }
  }, []);

  const login = async (username, password) => {
    const userData = await authService.login(username, password);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const hasPermission = (permissionString) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permissionString);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenantSlug,
        setTenantSlug: updateTenantSlug,
        loading,
        login,
        logout,
        hasPermission,
        refreshUser: async () => {
          const userData = await authService.getMe();
          setUser(userData);
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
