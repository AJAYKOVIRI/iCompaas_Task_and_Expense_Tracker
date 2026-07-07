import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const TopHeader = ({ onMenuToggle }) => {
  const { workspaces, workspaceId, user, fetchWorkspaces } = useAuth();
  const [loading, setLoading] = useState(false);

  const currentWs = workspaces.find(w => w.id === parseInt(workspaceId));

  // Access check: system admin or workspace owner/creator can delete workspaces
  const canDeleteWorkspace = currentWs && (user?.role === 'admin' || currentWs.created_by === user?.id);

  const handleDeleteWorkspace = async () => {
    if (!currentWs) return;
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete the workspace "${currentWs.name}"?\nAll associated tasks, expenses, and attachments will be deleted forever.`)) {
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`/api/workspaces/${workspaceId}`);
      await fetchWorkspaces();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="mobile-nav-toggle" onClick={onMenuToggle}>
          ☰
        </button>
        <div className="top-header-title">
          <h2>{workspaceId === '0' ? '💼 System-wide View (All Workspaces)' : (currentWs ? currentWs.name : 'No Workspace Selected')}</h2>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {canDeleteWorkspace && (
          <button
            onClick={handleDeleteWorkspace}
            className="btn btn-danger"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={loading}
          >
            🗑️ Delete Workspace
          </button>
        )}
      </div>
    </header>
  );
};

export default TopHeader;
