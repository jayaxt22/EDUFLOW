/**
 * Authentication service for EduFlow ERP.
 * Communicates with /api/v1/auth/* endpoints.
 */

import { api, clearAuthTokens } from './api';

export const authService = {
  /**
   * Submits credentials and receives user profile in return.
   * JWT tokens are written directly to HttpOnly cookies by the server.
   */
  async login(username, password) {
    const res = await api.post('/auth/login/', { username, password });
    return res.data;
  },

  /**
   * Clears session cookies on the backend and in-memory tokens.
   */
  async logout() {
    try {
      return await api.post('/auth/logout/');
    } finally {
      clearAuthTokens();
    }
  },

  /**
   * Refreshes access token using the HttpOnly refresh token cookie.
   */
  async refreshToken() {
    const res = await api.post('/auth/refresh/');
    return res.data;
  },

  /**
   * Retrieves profile and evaluated permissions for the currently active cookie session.
   */
  async getMe() {
    const res = await api.get('/auth/me/');
    return res.data;
  }
};
