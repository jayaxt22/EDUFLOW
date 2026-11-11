/**
 * Academics service for EduFlow ERP.
 * Non-negotiable rule: All HTTP calls go through src/services/api.js.
 */

import { api } from './api';

export const academicsService = {
  // Academic Years
  async listYears() {
    const res = await api.get('/academics/years/');
    return res.data;
  },

  async createYear(data) {
    const res = await api.post('/academics/years/', data);
    return res.data;
  },

  // Academic Units (Classes & Sections)
  async listUnits() {
    const res = await api.get('/academics/units/');
    return res.data;
  },

  async createUnit(data) {
    const res = await api.post('/academics/units/', data);
    return res.data;
  },

  async deleteUnit(unitId) {
    const res = await api.delete(`/academics/units/${unitId}/`);
    return res.data;
  },

  // Subjects
  async listSubjects() {
    const res = await api.get('/academics/subjects/');
    return res.data;
  },

  async createSubject(data) {
    const res = await api.post('/academics/subjects/', data);
    return res.data;
  },

  // Teaching Assignments / Allocations
  async listAssignments() {
    const res = await api.get('/academics/assignments/');
    return res.data;
  },

  async assignTeacher(data) {
    const res = await api.post('/academics/assignments/', data);
    return res.data;
  },

  async unassignClassTeacher(data) {
    const res = await api.post('/academics/assignments/unassign-class-teacher/', data);
    return res.data;
  },

  // Student Enrollments
  async listEnrollments(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/academics/enrollments/?${query}` : '/academics/enrollments/';
    const res = await api.get(endpoint);
    return res.data;
  },

  async transferStudent(data) {
    const res = await api.post('/academics/enrollments/transfer/', data);
    return res.data;
  },

  async enrollStudent(data) {
    const res = await api.post('/academics/enrollments/', data);
    return res.data;
  },

  // Atomic Student Promotion Batch
  async promoteStudents(payload) {
    const res = await api.post('/academics/promote/', payload);
    return res.data;
  },

  // Teacher Class Roster (GET /api/v1/teacher/my-class-roster/)
  async getTeacherMyClassRoster() {
    const res = await api.get('/teacher/my-class-roster/');
    return res.data;
  },

  // Legacy / fallback Teacher Class Roster
  async getMyClassRoster() {
    const res = await api.get('/academics/my-class/');
    return res.data;
  }
};
