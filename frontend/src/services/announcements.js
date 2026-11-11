/**
 * Announcements & School Communications API Service.
 * Follows AGENTS.md rule: all HTTP requests strictly in src/services/*.
 */

import { request } from './api';

export const announcementService = {
  /**
   * Fetches announcements visible to the currently authenticated user.
   */
  async listAnnouncements() {
    const res = await request('/announcements/', {
      method: 'GET',
    });
    return res.data || [];
  },

  /**
   * Creates a new global or class-targeted announcement.
   */
  async createAnnouncement(data) {
    const res = await request('/announcements/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  /**
   * Forwards an existing announcement to a specific academic unit.
   */
  async forwardAnnouncement(announcementId, targetAcademicUnitId) {
    const res = await request(`/announcements/${announcementId}/forward/`, {
      method: 'POST',
      body: JSON.stringify({ target_academic_unit_id: targetAcademicUnitId }),
    });
    return res.data;
  },
};
