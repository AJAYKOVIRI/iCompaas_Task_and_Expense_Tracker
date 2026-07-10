import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requireOtp, setRequireOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/register', {
        username,
        email,
        password
      });
      setRequireOtp(true);
      setMessage(res.data.message || 'Verification OTP sent to your email. Check backend terminal for code.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/verify-registration-otp', {
        email,
        otp
      });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/resend-otp', { email });
      setMessage(res.data.message || 'Verification code resent successfully.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && (
        <div className="loading-overlay">
          <LoadingSpinner size="large" />
          <h2 style={{ marginTop: '1.5rem', color: '#ffffff', fontWeight: '600' }}>
            {requireOtp ? 'Verifying Code' : 'Registering Account'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {requireOtp ? 'Validating verification code...' : 'Please wait while we set up your workspace...'}
          </p>
        </div>
      )}
      <div className="auth-wrapper">
        <div className="auth-card">
          {requireOtp ? (
            <form onSubmit={handleVerifyOtp}>
              <div className="auth-header">
                <img src="/logo.png" alt="iCompaas Logo" style={{ height: '64px', marginBottom: '1rem', objectFit: 'contain' }} />
                <h1>Verify Email</h1>
                <p>We've simulated sending an OTP to <strong>{email}</strong></p>
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--warning)', background: 'var(--warning-bg, rgba(230, 162, 44, 0.1))', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(230, 162, 44, 0.2)' }}>
                  💡 <em>Note: Check the backend Python stdout console to find the OTP code.</em>
                </div>
              </div>

              {message && (
                <div style={{ background: 'rgba(10, 191, 110, 0.1)', color: '#0abf6e', border: '1px solid rgba(10, 191, 110, 0.2)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
                  {message}
                </div>
              )}

              {error && (
                <div className="error-message">
                  <span style={{ marginRight: '8px', fontSize: '1.25rem' }}>⚠️</span>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="otp">Verification Code (OTP)</label>
                <input
                  type="text"
                  id="otp"
                  className="form-control"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  disabled={loading}
                  required
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.2rem' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                Verify & Start
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', fontSize: '0.9rem' }}>
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={handleResendOtp}
                  disabled={loading}
                  style={{ padding: 0, textDecoration: 'none', background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer' }}
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => {
                    setRequireOtp(false);
                    setError('');
                    setMessage('');
                  }}
                  disabled={loading}
                  style={{ padding: 0, textDecoration: 'none', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Back to Register
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
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
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="confirmPassword"
                  className="form-control"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                Register & Start
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            Already have an account? <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
