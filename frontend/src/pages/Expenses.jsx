import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Expenses = () => {
  const { workspaceId, workspaces } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form Fields State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Travel');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedWsId, setSelectedWsId] = useState('');
  const [attachment, setAttachment] = useState(null);

  // Active Expense for Edit
  const [activeExpense, setActiveExpense] = useState(null);

  // Filters State
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState(''); // YYYY-MM

  const categories = ['Travel', 'Meals', 'Software', 'Office Supplies', 'Hardware', 'Marketing', 'Miscellaneous'];

  const fetchExpenses = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterMonth) params.month = filterMonth;

      const res = await axios.get(`/api/workspaces/${workspaceId}/expenses`, { params });
      setExpenses(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [workspaceId, filterCategory, filterMonth]);

  const openAddModal = () => {
    setAmount('');
    setCategory('Travel');
    // Set default date to today in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setNotes('');
    setSelectedWsId('');
    setAttachment(null);
    setModalError('');
    setShowAddModal(true);
  };

  const openEditModal = (exp) => {
    setActiveExpense(exp);
    setAmount(exp.amount.toString());
    setCategory(exp.category);
    setDate(exp.date ? exp.date.split('T')[0] : '');
    setNotes(exp.notes || '');
    setAttachment(null);
    setModalError('');
    setShowEditModal(true);
  };

  const validateExpenseForm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      return { valid: false, msg: 'Amount must be greater than zero.' };
    }
    if (!date) {
      return { valid: false, msg: 'Date is mandatory.' };
    }
    const selectedDate = new Date(date);
    const today = new Date();
    // Reset hours for comparison
    today.setHours(23, 59, 59, 999);
    
    if (selectedDate > today) {
      return { valid: false, msg: 'Expense date cannot be in the future.' };
    }
    return { valid: true };
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const val = validateExpenseForm();
    if (!val.valid) {
      setModalError(val.msg);
      return;
    }

    setModalError('');
    setModalLoading(true);

    const targetWorkspaceId = workspaceId === '0' ? selectedWsId : workspaceId;
    if (!targetWorkspaceId) {
      setModalError('Please select a workspace.');
      setModalLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('category', category);
      formData.append('date', date);
      formData.append('notes', notes);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      await axios.post(`/api/workspaces/${targetWorkspaceId}/expenses`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowAddModal(false);
      fetchExpenses();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.message || 'Failed to log expense.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditExpense = async (e) => {
    e.preventDefault();
    const val = validateExpenseForm();
    if (!val.valid) {
      setModalError(val.msg);
      return;
    }

    setModalError('');
    setModalLoading(true);

    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('category', category);
      formData.append('date', date);
      formData.append('notes', notes);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      await axios.put(`/api/expenses/${activeExpense.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowEditModal(false);
      fetchExpenses();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.message || 'Failed to update expense.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    
    setLoading(true);
    try {
      await axios.delete(`/api/expenses/${expId}`);
      fetchExpenses();
    } catch (err) {
      console.error(err);
      setError('Failed to delete expense.');
      setLoading(false);
    }
  };

  const formatSimpleDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (!workspaceId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <h2>No workspace selected.</h2>
        <p style={{ color: 'var(--text-muted)' }}>Select or create a workspace to view expenses.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="tasks-board-header">
        <div className="filters-wrapper">
          <select
            className="form-control"
            style={{ width: '170px' }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <input
            type="month"
            className="form-control"
            style={{ width: '170px' }}
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          💸 Log Expense
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <LoadingSpinner size="large" />
        </div>
      ) : (
        <div className="expenses-table-card">
          <div className="table-responsive">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Created At</th>
                  <th>Logged By</th>
                  <th>Notes</th>
                  <th>Receipt</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length > 0 ? (
                  expenses.map(exp => (
                    <tr key={exp.id}>
                      <td>
                        <span className="expense-category-badge">{exp.category}</span>
                      </td>
                      <td className="expense-amount">₹{exp.amount.toFixed(2)}</td>
                      <td>{formatSimpleDate(exp.date)}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {exp.created_at ? new Date(exp.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td>👤 {exp.user ? exp.user.username : 'Unknown'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.notes || '—'}
                      </td>
                      <td>
                        {exp.attachment_url ? (
                          <a
                            href={`/api/uploads/${exp.attachment_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="attachment-link"
                          >
                            📎 View Receipt
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => openEditModal(exp)}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No expenses logged for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOG EXPENSE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Log New Expense</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                &times;
              </button>
            </div>

            {modalError && <div className="error-message">{modalError}</div>}

             <form onSubmit={handleAddExpense}>
              {workspaceId === '0' && (
                <div className="form-group">
                  <label>Workspace *</label>
                  <select
                    className="form-control"
                    value={selectedWsId}
                    onChange={(e) => setSelectedWsId(e.target.value)}
                    disabled={modalLoading}
                    required
                  >
                    <option value="">Select Workspace</option>
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={modalLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    className="form-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={modalLoading}
                    required
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expense Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={modalLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Receipt Attachment</label>
                  <div className="file-input-wrapper">
                    <button type="button" className="btn btn-secondary btn-block" style={{ fontSize: '0.85rem' }}>
                      {attachment ? `📎 ${attachment.name.slice(0, 15)}...` : '📁 Choose File'}
                    </button>
                    <input
                      type="file"
                      onChange={(e) => setAttachment(e.target.files[0])}
                      disabled={modalLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Description</label>
                <textarea
                  className="form-control"
                  placeholder="Describe what the expense was for..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={modalLoading}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                >
                  {modalLoading ? (
                    <>
                      <LoadingSpinner size="small" color="white" inline={true} />
                      <span style={{ marginLeft: '8px' }}>Logging...</span>
                    </>
                  ) : (
                    'Log Expense'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EXPENSE MODAL */}
      {showEditModal && activeExpense && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Expense</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                &times;
              </button>
            </div>

            {modalError && <div className="error-message">{modalError}</div>}

            <form onSubmit={handleEditExpense}>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={modalLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    className="form-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={modalLoading}
                    required
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expense Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={modalLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Receipt Attachment</label>
                  <div className="file-input-wrapper">
                    <button type="button" className="btn btn-secondary btn-block" style={{ fontSize: '0.85rem' }}>
                      {attachment ? `📎 ${attachment.name.slice(0, 15)}...` : 'Change Receipt File'}
                    </button>
                    <input
                      type="file"
                      onChange={(e) => setAttachment(e.target.files[0])}
                      disabled={modalLoading}
                    />
                  </div>
                  {activeExpense.attachment_url && !attachment && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--info)', marginTop: '0.25rem' }}>
                      Current: {activeExpense.attachment_url.split('_').slice(2).join('_') || 'Attached file'}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Description</label>
                <textarea
                  className="form-control"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={modalLoading}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                >
                  {modalLoading ? (
                    <>
                      <LoadingSpinner size="small" color="white" inline={true} />
                      <span style={{ marginLeft: '8px' }}>Updating...</span>
                    </>
                  ) : (
                    'Update Expense'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
