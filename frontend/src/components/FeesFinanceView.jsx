import React, { useState, useEffect } from 'react';
import { feesService } from '../services/fees';
import { userService } from '../services/users';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign,
  CreditCard,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Search,
  Plus,
  Loader2,
  X,
  ShieldCheck,
  TrendingUp,
  Clock
} from 'lucide-react';

export const FeesFinanceView = () => {
  const { hasPermission } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Payment modal state
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [txRef, setTxRef] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // New Invoice modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [newInvoice, setNewInvoice] = useState({
    student_membership: '',
    fee_structure: '',
    total_amount: '',
    due_date: new Date().toISOString().split('T')[0],
  });
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  useEffect(() => {
    loadAllFinanceData();
  }, []);

  const loadAllFinanceData = async () => {
    setLoading(true);
    try {
      const [metricsData, invoicesData, structuresData, usersData] = await Promise.all([
        feesService.getMetrics().catch(() => null),
        feesService.listInvoices().catch(() => []),
        feesService.listStructures().catch(() => []),
        userService.listUsers().catch(() => []),
      ]);

      setMetrics(metricsData);
      setInvoices(invoicesData || []);
      setStructures(structuresData || []);

      const studentList = (usersData || []).filter((u) => u.role === 'STUDENT');
      setStudents(studentList);
      if (studentList.length > 0) {
        setNewInvoice((prev) => ({ ...prev, student_membership: studentList[0].id }));
      }
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = (inv) => {
    setPayingInvoice(inv);
    setPaymentAmount(inv.balance_due);
    setPaymentMethod('CASH');
    setTxRef('');
    setPaymentError(null);
  };

  const handleExecutePayment = async (e) => {
    e.preventDefault();
    if (!payingInvoice) return;
    setSubmittingPayment(true);
    setPaymentError(null);

    try {
      // DoD: Block duplicate payments by generating a unique idempotency key
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random()}`;

      await feesService.recordPayment({
        invoice_id: payingInvoice.id,
        amount: parseFloat(paymentAmount),
        idempotency_key: idempotencyKey,
        payment_method: paymentMethod,
        transaction_reference: txRef,
      });

      setPayingInvoice(null);
      loadAllFinanceData();
    } catch (err) {
      console.error('Payment error:', err);
      setPaymentError(err.data?.error?.message || err.message || 'Payment submission failed.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCreateInvoiceSubmit = async (e) => {
    e.preventDefault();
    setCreatingInvoice(true);
    try {
      await feesService.createInvoice({
        student_membership: newInvoice.student_membership,
        fee_structure: newInvoice.fee_structure || null,
        total_amount: parseFloat(newInvoice.total_amount),
        due_date: newInvoice.due_date,
      });
      setIsInvoiceModalOpen(false);
      setNewInvoice({
        student_membership: students[0]?.id || '',
        fee_structure: '',
        total_amount: '',
        due_date: new Date().toISOString().split('T')[0],
      });
      loadAllFinanceData();
    } catch (err) {
      alert(err.data?.error?.message || err.message || 'Failed to issue invoice.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.student_name?.toLowerCase().includes(q) ||
      inv.admission_number?.toLowerCase().includes(q) ||
      inv.status?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] dark:text-slate-100">Finance & Student Billing</h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            Manage tuition structures, student invoices, receipts, and idempotent payment processing
          </p>
        </div>

        {hasPermission('fees.invoices_crud') && (
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Invoice</span>
          </button>
        )}
      </div>

      {/* Finance Metrics Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Total Invoiced</span>
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-black text-[#1E293B] dark:text-slate-100 mt-2">
            ${parseFloat(metrics?.total_invoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Total Collected</span>
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-black text-green-700 dark:text-green-400 mt-2">
            ${parseFloat(metrics?.total_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-green-800 dark:text-green-300 font-semibold mt-0.5 inline-block">
            {metrics?.collection_rate || 0}% collection rate
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Outstanding Due</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-2">
            ${parseFloat(metrics?.total_outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Total Refunds</span>
            <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-2">
            ${parseFloat(metrics?.total_refunded || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Table Search */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice #, student, admission..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#FACC15]"
            />
          </div>
          <span className="text-xs text-[#64748B] dark:text-slate-400">
            Showing <strong className="text-[#1E293B] dark:text-slate-100">{filteredInvoices.length}</strong> invoices
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1E293B] dark:text-slate-100">
            <thead className="bg-gray-50/80 dark:bg-slate-800/90 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="py-3 px-6">Invoice #</th>
                <th className="py-3 px-6">Student</th>
                <th className="py-3 px-6">Total Bill</th>
                <th className="py-3 px-6">Paid Amount</th>
                <th className="py-3 px-6">Balance Due</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#FACC15]" />
                      <span>Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400">
                    No invoices recorded.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#1E293B] dark:text-slate-100">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-6">
                      <p className="font-semibold text-xs text-[#1E293B] dark:text-slate-100">{inv.student_name}</p>
                      <p className="text-[10px] text-[#64748B] dark:text-slate-400">Adm: {inv.admission_number || '—'}</p>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                      ${parseFloat(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-green-700 dark:text-green-400">
                      ${parseFloat(inv.paid_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs font-bold text-[#1E293B] dark:text-slate-100">
                      ${parseFloat(inv.balance_due).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          inv.status === 'PAID'
                            ? 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/40'
                            : inv.status === 'PARTIAL'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/40'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {parseFloat(inv.balance_due) > 0 && hasPermission('fees.payments_crud') && (
                        <button
                          onClick={() => handleOpenPayment(inv)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/60 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50 font-bold text-xs rounded-lg transition-colors"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Collect</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-950/60 flex items-center justify-center text-green-800 dark:text-green-300">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">Record Payment Receipt</h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">{payingInvoice.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => setPayingInvoice(null)}
                className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="p-6 space-y-4">
              {paymentError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-xs text-red-800 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-slate-700/60 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#64748B] dark:text-slate-400">Student:</span>
                <span className="font-bold text-[#1E293B] dark:text-slate-100">{payingInvoice.student_name}</span>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/60 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#64748B] dark:text-slate-400">Current Balance Due:</span>
                <span className="font-bold text-red-600 dark:text-red-400 font-mono">${parseFloat(payingInvoice.balance_due).toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Payment Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parseFloat(payingInvoice.balance_due)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-mono font-bold text-[#1E293B] dark:text-slate-100 focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit/Debit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="ONLINE">Online Portal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Transaction Reference</label>
                <input
                  type="text"
                  placeholder="Receipt #, Cheque #, or Bank Ref"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder-slate-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <span>Idempotency-protected transaction</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPayingInvoice(null)}
                    className="px-3.5 py-1.5 text-xs text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment || !paymentAmount}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                  >
                    {submittingPayment ? 'Processing...' : 'Confirm Payment'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-sm text-[#1E293B] dark:text-slate-100">Generate Student Invoice</h3>
              <button onClick={() => setIsInvoiceModalOpen(false)}>
                <X className="w-5 h-5 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Student *</label>
                <select
                  value={newInvoice.student_membership}
                  onChange={(e) => setNewInvoice({ ...newInvoice, student_membership: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.email || s.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Fee Template (Optional)</label>
                <select
                  value={newInvoice.fee_structure}
                  onChange={(e) => {
                    const struct = structures.find((st) => st.id === e.target.value);
                    setNewInvoice({
                      ...newInvoice,
                      fee_structure: e.target.value,
                      total_amount: struct ? struct.amount : newInvoice.total_amount,
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100"
                >
                  <option value="">Custom Invoice</option>
                  {structures.map((st) => (
                    <option key={st.id} value={st.id}>{st.name} (${st.amount})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newInvoice.total_amount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, total_amount: e.target.value })}
                  required
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-mono font-bold text-[#1E293B] dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-slate-200 mb-1">Due Date *</label>
                <input
                  type="date"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-[#1E293B] dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#64748B] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingInvoice}
                  className="px-4 py-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#1E293B] font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  {creatingInvoice ? 'Generating...' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
