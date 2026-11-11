/**
 * Attendance service for EduFlow ERP.
 * Non-negotiable rule: All HTTP calls go through src/services/api.js.
 */

import { api } from './api';

export const attendanceService = {
  // Bulk mark class attendance
  async markClass(payload) {
    const res = await api.post('/attendance/mark-class/', payload);
    return res.data;
  },

  // Self check-in
  async markSelf(payload) {
    const res = await api.post('/attendance/mark-self/', payload);
    return res.data;
  },

  // Same-day correction
  async correctAttendance(recordId, payload) {
    const res = await api.patch(`/attendance/${recordId}/correct/`, payload);
    return res.data;
  },

  // Daily class summary
  async getSummary(academicUnitId, dateStr) {
    const url = `/attendance/summary/?academic_unit=${academicUnitId}&date=${dateStr}`;
    const res = await api.get(url);
    return res.data;
  },

  // List records
  async listRecords(params = {}) {
    const searchParams = new URLSearchParams(params).toString();
    const url = searchParams ? `/attendance/records/?${searchParams}` : '/attendance/records/';
    const res = await api.get(url);
    return res.data;
  },

  // Whole-school attendance analytics (Admin / Faculty)
  async getSchoolAnalytics(dateStr) {
    const url = dateStr ? `/attendance/analytics/?date=${dateStr}` : '/attendance/analytics/';
    const res = await api.get(url);
    return res.data;
  },

  // Today's self check-in status and personal history
  async getSelfStatus(dateStr) {
    const url = dateStr ? `/attendance/self-status/?date=${dateStr}` : '/attendance/self-status/';
    const res = await api.get(url);
    return res.data;
  }
};
