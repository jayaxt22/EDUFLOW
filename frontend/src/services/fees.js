/**
 * Fees & Finance service for EduFlow ERP.
 * Non-negotiable rule: All HTTP calls go through src/services/api.js.
 */

import { api } from './api';

export const feesService = {
  // Structures
  async listStructures() {
    const res = await api.get('/fees/structures/');
    return res.data;
  },

  async createStructure(payload) {
    const res = await api.post('/fees/structures/', payload);
    return res.data;
  },

  // Invoices
  async listInvoices() {
    const res = await api.get('/fees/invoices/');
    return res.data;
  },

  async createInvoice(payload) {
    const res = await api.post('/fees/invoices/', payload);
    return res.data;
  },

  // Payments (with idempotency)
  async recordPayment(payload) {
    const res = await api.post('/fees/payments/', payload);
    return res.data;
  },

  async listPayments() {
    const res = await api.get('/fees/payments/');
    return res.data;
  },

  // Finance Metrics Overview
  async getMetrics() {
    const res = await api.get('/fees/metrics/');
    return res.data;
  }
};
