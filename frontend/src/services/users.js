/**
 * User management service for EduFlow ERP.
 * Communicates with /api/v1/users/* endpoints.
 */

import { api } from './api';

export const userService = {
  /**
   * Fetches users list (Admin view with users.read_all or directory view with students.read_directory).
   */
  async listUsers() {
    const res = await api.get('/users/');
    return res.data;
  },

  /**
   * Creates a user with role and profile in a single atomic transaction.
   */
  async createUser(payload) {
    const res = await api.post('/users/', payload);
    return res.data;
  },

  /**
   * Fetches the next auto-generated unique identifier for a role.
   */
  async getNextIdentifier(role) {
    const res = await api.get(`/users/next-identifier/?role=${role}`);
    return res.data;
  },

  /**
   * Fetches the current user's profile details (/api/v1/users/me/).
   */
  async getProfile() {
    const res = await api.get('/users/me/');
    return res.data;
  },

  /**
   * Updates the current user's personal details (/api/v1/users/me/).
   */
  async updateProfile(payload) {
    const res = await api.patch('/users/me/', payload);
    return res.data;
  },

  /**
   * Updates the current user's password securely (/api/v1/users/me/change-password/).
   */
  async changePassword(payload) {
    const res = await api.post('/users/me/change-password/', payload);
    return res.data;
  },

  /**
   * Updates an existing user by Admin (/api/v1/users/{id}/).
   */
  async updateUser(id, payload) {
    const res = await api.patch(`/users/${id}/`, payload);
    return res.data;
  },

  /**
   * Soft-deactivates a user by Admin (/api/v1/users/{id}/).
   */
  async deactivateUser(id) {
    const res = await api.delete(`/users/${id}/`);
    return res.data;
  }
};
