import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const { workspaceId, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);

  const handleDeleteUser = async (userId, username) => {
    if (userId === user?.id) {
      alert("Cannot delete your own admin account.");
      return;
    }

    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete user "${username}"?\nAll workspaces, tasks, and expenses owned by this user will be deleted forever.`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/users/${userId}`);
      
      // Refresh user lists
      if (workspaceId) {
        try {
          const statsRes = await axios.get(`/api/workspaces/${workspaceId}/dashboard`);
          setStats(statsRes.data);
        } catch (err) {
          console.error("Failed to refresh dashboard stats after user deletion", err);
        }
      }
      
      const usersRes = await axios.get('/api/admin/users');
      setAdminUsers(usersRes.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete user.");
    }
  };

  const renderAdminUsersList = (usersList) => {
    if (!usersList || usersList.length === 0) return null;
    return (
      <div style={{ marginTop: '2rem' }}>
        <div className="chart-card" style={{ width: '100%', maxWidth: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>👥 System Management: Registered Users</h3>
            <span className="kanban-column-count" style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', background: 'var(--accent-glow)', color: '#ffffff', fontWeight: 'bold' }}>
              Total: {usersList.length}
            </span>
          </div>
          
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="expenses-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--panel-border)' }}>
                  <th style={{ padding: '0.75rem' }}>Username</th>
                  <th style={{ padding: '0.75rem' }}>Email Address</th>
                  <th style={{ padding: '0.75rem' }}>Role</th>
                  <th style={{ padding: '0.75rem' }}>Registered Date</th>
                  <th style={{ padding: '0.75rem', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                      👤 {u.username}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`expense-category-badge`} style={{
                        background: u.role === 'admin' ? 'var(--brand-orange-glow)' : 'rgba(9, 133, 254, 0.15)',
                        color: u.role === 'admin' ? 'var(--brand-orange)' : 'var(--accent-color)',
                        border: u.role === 'admin' ? '1px solid var(--brand-orange)' : '1px solid var(--accent-color)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="btn btn-danger"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px' }}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`/api/workspaces/${workspaceId}/dashboard`);
        setStats(res.data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [workspaceId]);

  useEffect(() => {
    const fetchAdminUsers = async () => {
      if (user?.role === 'admin') {
        try {
          const res = await axios.get('/api/admin/users');
          setAdminUsers(res.data);
        } catch (err) {
          console.error("Failed to fetch admin users", err);
        }
      }
    };
    fetchAdminUsers();
  }, [user]);

  if (!workspaceId) {
    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40vh', textAlign: 'center' }}>
          <h2>No workspace selected.</h2>
          <p style={{ color: 'var(--text-muted)' }}>Please select or create a workspace to view the dashboard metrics.</p>
        </div>
        {user?.role === 'admin' && adminUsers.length > 0 && renderAdminUsersList(adminUsers)}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const { tasks, expenses, users } = stats || { tasks: {}, expenses: {}, users: null };

  // Chart configuration
  const pieData = {
    labels: expenses.by_category?.map(item => item.category) || [],
    datasets: [
      {
        data: expenses.by_category?.map(item => item.amount) || [],
        backgroundColor: [
          '#0985fe', // accent
          '#10b981', // success
          '#f59e0b', // warning
          '#06b6d4', // info
          '#e83d10', // danger
          '#ec4899', // pink
          '#a855f7'  // purple
        ],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
      }
    ]
  };

  const barData = {
    labels: expenses.by_month?.map(item => item.month) || [],
    datasets: [
      {
        label: 'Expenses (₹)',
        data: expenses.by_month?.map(item => item.amount) || [],
        backgroundColor: 'rgba(9, 133, 254, 0.75)',
        borderColor: '#0985fe',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#f3f4f6',
          font: { family: 'Outfit' }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#f3f4f6',
          font: { family: 'Outfit' }
        }
      }
    }
  };

  return (
    <div>
      {/* Summary metrics */}
      <div className="summary-cards-grid">
        <div className="summary-card">
          <div className="summary-card-details">
            <div className="card-label">Total Tasks</div>
            <div className="card-value">{tasks.total || 0}</div>
          </div>
          <div className="card-icon-container blue">📋</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-details">
            <div className="card-label">Completed Tasks</div>
            <div className="card-value">{tasks.completed || 0}</div>
          </div>
          <div className="card-icon-container green">✅</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-details">
            <div className="card-label">Blocked / On Hold</div>
            <div className="card-value">{(tasks.blocked || 0) + (tasks.on_hold || 0)}</div>
          </div>
          <div className="card-icon-container orange">⚠️</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-details">
            <div className="card-label">Total Expenses</div>
            <div className="card-value">₹{expenses.total_amount || 0}</div>
          </div>
          <div className="card-icon-container purple">💸</div>
        </div>

        {users && (
          <div className="summary-card">
            <div className="summary-card-details">
              <div className="card-label">Total Users</div>
              <div className="card-value">{users.length}</div>
            </div>
            <div className="card-icon-container blue" style={{ background: 'var(--brand-orange-glow)', color: 'var(--brand-orange)' }}>👥</div>
          </div>
        )}
      </div>

      {/* Graphical Insights */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Expenses by Category</h3>
          <div style={{ height: '250px', position: 'relative' }}>
            {expenses.by_category?.length > 0 ? (
              <Pie data={pieData} options={pieOptions} />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No expenses logged yet.
              </div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>Monthly Spending Trends</h3>
          <div style={{ height: '250px', position: 'relative' }}>
            {expenses.by_month?.length > 0 ? (
              <Bar data={barData} options={chartOptions} />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No spending records found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Administrator Panel */}
      {users && renderAdminUsersList(users)}
    </div>
  );
};

export default Dashboard;
