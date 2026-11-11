/**
 * Examinations service for EduFlow ERP.
 * Non-negotiable rule: All HTTP calls go through src/services/api.js.
 */

import { api } from './api';

export const examinationsService = {
  // Exams
  async listExams() {
    const res = await api.get('/examinations/exams/');
    return res.data;
  },

  async createExam(payload) {
    const res = await api.post('/examinations/exams/', payload);
    return res.data;
  },

  // Exam Subject papers
  async listExamSubjects(params = {}) {
    const searchParams = new URLSearchParams(params).toString();
    const url = searchParams ? `/examinations/exam-subjects/?${searchParams}` : '/examinations/exam-subjects/';
    const res = await api.get(url);
    return res.data;
  },

  async createExamSubject(payload) {
    const res = await api.post('/examinations/exam-subjects/', payload);
    return res.data;
  },

  // Marks Grid
  async getMarksGrid(examSubjectId) {
    const res = await api.get(`/examinations/marks-grid/?exam_subject=${examSubjectId}`);
    return res.data;
  },

  // Bulk marks submission
  async submitMarks(payload) {
    const res = await api.post('/examinations/marks/', payload);
    return res.data;
  },

  // Publish exam (immutability lock)
  async publishExam(examId) {
    const res = await api.post(`/examinations/exams/${examId}/publish/`);
    return res.data;
  }
};
