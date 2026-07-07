import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import LoadingSpinner from './LoadingSpinner';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, workspaces, workspaceId, switchWorkspace, fetchWorkspaces, logout } = useAuth();
  const [showWsModal, setShowWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [wsLoading, setWsLoading] = useState(false);
  const [wsError, setWsError] = useState('');
  const navigate = useNavigate();

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) {
      setWsError('Workspace name is required');
      return;
    }

    setWsError('');
    setWsLoading(true);

    try {
      const res = await axios.post('/api/workspaces', {
        name: newWsName,
        description: newWsDesc
      });
      await fetchWorkspaces();
      switchWorkspace(res.data.workspace.id);
      setNewWsName('');
      setNewWsDesc('');
      setShowWsModal(false);
    } catch (err) {
      console.error(err);
      setWsError(err.response?.data?.message || 'Failed to create workspace.');
    } finally {
      setWsLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  const activeStyle = ({ isActive }) => `nav-item ${isActive ? 'active' : ''}`;

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo">
          <img src="/logo.png" alt="iCompaas Logo" />
          <h2>iCompaas</h2>
        </div>

        {/* Workspace Dropdown or Create button if empty */}
        {workspaces.length === 0 ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setShowWsModal(true)}
              className="btn btn-primary btn-block"
              style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              ➕ Create Workspace
            </button>
          </div>
        ) : (
          <div className="workspace-selector">
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Current Workspace
            </label>
            <select
              className="form-control"
              value={workspaceId || ''}
              onChange={(e) => {
                if (e.target.value === 'new') {
                  setShowWsModal(true);
                  e.target.value = workspaceId || '';
                } else {
                  switchWorkspace(e.target.value);
                }
              }}
            >
              {user?.role === 'admin' && (
                <option value="0">💼 All Workspaces (System Admin)</option>
              )}
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id.toString()}>
                  {ws.name}
                </option>
              ))}
              <option value="new">+ Create Workspace</option>
            </select>
          </div>
        )}

        {/* Navigation Menu */}
        <nav style={{ flexGrow: 1 }}>
          <ul className="nav-menu">
            <li>
              <NavLink to="/" className={activeStyle} onClick={toggleSidebar}>
                <span>📊</span> Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/tasks" className={activeStyle} onClick={toggleSidebar}>
                <span>✅</span> Tasks Board
              </NavLink>
            </li>
            <li>
              <NavLink to="/expenses" className={activeStyle} onClick={toggleSidebar}>
                <span>💸</span> Expenses Sheet
              </NavLink>
            </li>
            <li>
              <NavLink to="/profile" className={activeStyle} onClick={toggleSidebar}>
                <span>👤</span> My Profile
              </NavLink>
            </li>
          </ul>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="sidebar-footer">
          {user && (
            <div className="user-profile-summary">
              {user.profile_pic ? (
                <img
                  src={`/api/uploads/${user.profile_pic}`}
                  alt="avatar"
                  className="avatar"
                />
              ) : (
                <div className="avatar">{getInitials(user.username)}</div>
              )}
              <div className="user-info">
                <span className="username">{user.username}</span>
                <span className="userrole">{user.role}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="btn btn-secondary btn-block"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Workspace Creation Modal */}
      {showWsModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Workspace</h3>
              <button className="modal-close" onClick={() => setShowWsModal(false)}>
                &times;
              </button>
            </div>
            {wsError && <div className="error-message">{wsError}</div>}
            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label>Workspace Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Design Team or Q3 Marketing"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  disabled={wsLoading}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  placeholder="What is this workspace about?"
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  disabled={wsLoading}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowWsModal(false)}
                  disabled={wsLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={wsLoading}
                >
                  {wsLoading ? (
                    <>
                      <LoadingSpinner size="small" color="white" inline={true} />
                      <span style={{ marginLeft: '8px' }}>Creating...</span>
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
