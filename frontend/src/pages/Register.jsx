import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('user'); // Default to 'user'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        role
      });
      // The API returns token, user info and default workspace ID.
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/logo.png" alt="iCompaas Logo" style={{ height: '64px', marginBottom: '1rem', objectFit: 'contain' }} />
          <h1>Join iCompaas</h1>
          <p>Create an account to collaborate with your team</p>
        </div>

        {error && (
          <div className="error-message">
            <span style={{ marginRight: '8px', fontSize: '1.25rem' }}>⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              className="form-control"
              placeholder="e.g. johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="form-control"
              placeholder="e.g. john@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                id="show-password"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="show-password" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>Show Password</label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="role">Role (Testing Feature)</label>
            <select
              id="role"
              className="form-control"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="user">Regular User (Member)</option>
              <option value="admin">System Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" color="white" inline={true} />
                <span style={{ marginLeft: '8px' }}>Registering...</span>
              </>
            ) : (
              'Register & Start'
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
