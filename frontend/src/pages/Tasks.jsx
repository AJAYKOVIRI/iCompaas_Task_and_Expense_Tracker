import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Tasks = () => {
  const { workspaceId, workspaces } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Active Task for Editing
  const [activeTask, setActiveTask] = useState(null);

  // Form Fields State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [estimatedEndDate, setEstimatedEndDate] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [selectedWsId, setSelectedWsId] = useState('');

  // Filters State
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Get active workspace members
  let membersWsId = workspaceId;
  if (workspaceId === '0') {
    if (showEditModal && activeTask) {
      membersWsId = activeTask.workspace_id;
    } else if (showCreateModal) {
      membersWsId = selectedWsId;
    }
  }
  const currentWorkspace = workspaces.find(w => w.id === parseInt(membersWsId));
  const members = currentWorkspace?.members || [];

  const fetchTasks = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterPriority) params.priority = filterPriority;
      if (filterSearch) params.search = filterSearch;
      
      const res = await axios.get(`/api/workspaces/${workspaceId}/tasks`, { params });
      setTasks(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [workspaceId, filterPriority, filterSearch]);

  const openCreateModal = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setEstimatedEndDate('');
    setStatusNotes('');
    setAssignedTo('');
    setSelectedWsId('');
    setModalError('');
    setShowCreateModal(true);
  };

  const openEditModal = (task) => {
    setActiveTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    
    // format to YYYY-MM-DDTHH:MM for datetime-local picker
    if (task.estimated_end_date) {
      setEstimatedEndDate(task.estimated_end_date.slice(0, 16));
    } else {
      setEstimatedEndDate('');
    }
    
    setStatusNotes(task.status_notes || '');
    setAssignedTo(task.assigned_to || '');
    setModalError('');
    setShowEditModal(true);
  };

  const getMinDateTime = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now - tzOffset).toISOString().slice(0, 16);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setModalError('Title is required.');
      return;
    }

    if (!estimatedEndDate) {
      setModalError('Estimated end date is mandatory.');
      return;
    }

    const selectedDate = new Date(estimatedEndDate);
    const currentDate = new Date();
    if (selectedDate <= currentDate) {
      setModalError('Estimated end date must be in the future.');
      return;
    }

    const targetWorkspaceId = workspaceId === '0' ? selectedWsId : workspaceId;
    if (!targetWorkspaceId) {
      setModalError('Please select a workspace.');
      return;
    }

    setModalError('');
    setModalLoading(true);

    try {
      const payload = {
        title,
        description,
        status,
        priority,
        estimated_end_date: estimatedEndDate,
        status_notes: (status === 'blocked' || status === 'on_hold') ? statusNotes : '',
        assigned_to: assignedTo ? parseInt(assignedTo) : null
      };

      await axios.post(`/api/workspaces/${targetWorkspaceId}/tasks`, payload);
      setShowCreateModal(false);
      fetchTasks();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.message || 'Failed to create task.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setModalError('Title is required.');
      return;
    }

    if (!estimatedEndDate) {
      setModalError('Estimated end date is mandatory.');
      return;
    }

    // Only validate that it is in the future if the date has changed
    const originalDateStr = activeTask.estimated_end_date ? activeTask.estimated_end_date.slice(0, 16) : '';
    if (estimatedEndDate !== originalDateStr) {
      const selectedDate = new Date(estimatedEndDate);
      const currentDate = new Date();
      if (selectedDate <= currentDate) {
        setModalError('Estimated end date must be in the future.');
        return;
      }
    }

    setModalError('');
    setModalLoading(true);

    try {
      const payload = {
        title,
        description,
        status,
        priority,
        estimated_end_date: estimatedEndDate,
        status_notes: (status === 'blocked' || status === 'on_hold') ? statusNotes : '',
        assigned_to: assignedTo ? parseInt(assignedTo) : null
      };

      await axios.put(`/api/tasks/${activeTask.id}`, payload);
      setShowEditModal(false);
      fetchTasks();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.message || 'Failed to update task.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    setLoading(true);
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      fetchTasks();
    } catch (err) {
      console.error(err);
      setError('Failed to delete task.');
      setLoading(false);
    }
  };

  // Group tasks by status
  const statuses = [
    { key: 'todo', label: 'To Do', dot: 'todo' },
    { key: 'in_progress', label: 'In Progress', dot: 'in_progress' },
    { key: 'on_hold', label: 'On Hold', dot: 'on_hold' },
    { key: 'blocked', label: 'Blocked', dot: 'blocked' },
    { key: 'completed', label: 'Completed', dot: 'completed' }
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!workspaceId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <h2>No workspace selected.</h2>
        <p style={{ color: 'var(--text-muted)' }}>Select or create a workspace to view tasks.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="tasks-board-header">
        <div className="filters-wrapper">
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Search tasks..."
            style={{ width: '200px' }}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          <select
            className="form-control"
            style={{ width: '150px' }}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        <button className="btn btn-primary" onClick={openCreateModal}>
          ➕ Add Task
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <LoadingSpinner size="large" />
        </div>
      ) : (
        <div className="kanban-grid">
          {statuses.map(st => {
            const columnTasks = tasks.filter(t => t.status === st.key);
            return (
              <div key={st.key} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span className={`status-dot ${st.dot}`}></span>
                    {st.label}
                  </div>
                  <span className="kanban-column-count">{columnTasks.length}</span>
                </div>
                
                <div className="kanban-cards-list">
                  {columnTasks.map(task => (
                    <div
                      key={task.id}
                      className="task-card"
                      onClick={() => openEditModal(task)}
                    >
                      <span className={`task-card-priority priority-${task.priority}`}>
                        {task.priority}
                      </span>
                      
                      <h4 className="task-card-title">{task.title}</h4>
                      
                      {task.description && (
                        <p className="task-card-desc">{task.description}</p>
                      )}
                      
                      {task.status_notes && (
                        <div className="task-card-notes-indicator">
                          <span>📝</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.status_notes}
                          </span>
                        </div>
                      )}
                      
                      <div className="task-card-meta">
                        <span className="task-card-assignee">
                          👤 {task.assigned_user ? task.assigned_user.username : 'Unassigned'}
                        </span>
                        
                        {task.estimated_end_date && (
                          <span className="task-card-date">
                            📅 {formatDate(task.estimated_end_date)}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Created:</span>
                        <span>{formatDate(task.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Task</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>
            
            {modalError && <div className="error-message">{modalError}</div>}
            
            <form onSubmit={handleCreateTask}>
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

              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Design Dashboard Prototypes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={modalLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  placeholder="Provide task details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={modalLoading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-control"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={modalLoading}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    className="form-control"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    disabled={modalLoading}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estimated End Date (Calendar) *</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={estimatedEndDate}
                    onChange={(e) => setEstimatedEndDate(e.target.value)}
                    disabled={modalLoading}
                    min={getMinDateTime()}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Assign To</label>
                  <select
                    className="form-control"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    disabled={modalLoading}
                  >
                    <option value="">Select Member</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.username} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status explanation note (highly relevant if status is Blocked or On Hold) */}
              {(status === 'blocked' || status === 'on_hold') && (
                <div className="form-group">
                  <label>Status Notes (e.g., Why is it Blocked or On Hold?)</label>
                  <textarea
                    className="form-control"
                    placeholder="Enter reason or blockers..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    disabled={modalLoading}
                  />
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
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
                      <span style={{ marginLeft: '8px' }}>Saving...</span>
                    </>
                  ) : (
                    'Save Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT/MODIFY TASK MODAL */}
      {showEditModal && activeTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Modify Task</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                &times;
              </button>
            </div>
            
            {modalError && <div className="error-message">{modalError}</div>}
            
            <form onSubmit={handleEditTask}>
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={modalLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={modalLoading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-control"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={modalLoading}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    className="form-control"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    disabled={modalLoading}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estimated End Date (Calendar) *</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={estimatedEndDate}
                    onChange={(e) => setEstimatedEndDate(e.target.value)}
                    disabled={modalLoading}
                    min={getMinDateTime()}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Assign To</label>
                  <select
                    className="form-control"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    disabled={modalLoading}
                  >
                    <option value="">Select Member</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.username} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(status === 'blocked' || status === 'on_hold') && (
                <div className="form-group">
                  <label>Status Notes (Optional - Why is it Blocked or On Hold?)</label>
                  <textarea
                    className="form-control"
                    placeholder="Enter details..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    disabled={modalLoading}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setShowEditModal(false);
                    handleDeleteTask(activeTask.id);
                  }}
                  disabled={modalLoading}
                >
                  Delete Task
                </button>
                
                <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                      'Update Task'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
