import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requireOtp, setRequireOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [otpType, setOtpType] = useState('login'); // 'login' or 'register'

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/login', { email, password });
      
      if (res.data.two_factor_required) {
        setOtpType('login');
        setRequireOtp(true);
        setMessage(res.data.message || '2FA OTP verification code sent to your email. Check backend terminal.');
      } else if (res.data.require_registration_verification) {
        setOtpType('register');
        setRequireOtp(true);
        setMessage(res.data.message || 'Your email is unverified. Verification OTP code sent to your email. Check backend terminal.');
      } else {
        // Direct login if 2FA was not triggered for some reason (should be triggered, but fallback)
        login(res.data.token, res.data.user);
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
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

    const verifyUrl = otpType === 'register' 
      ? '/api/auth/verify-registration-otp' 
      : '/api/auth/verify-login-otp';

    try {
      const res = await axios.post(verifyUrl, {
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
            {requireOtp ? 'Verifying OTP' : 'Signing In'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {requireOtp ? 'Verifying 2-Factor Authentication code...' : 'Verifying credentials...'}
          </p>
        </div>
      )}
      <div className="auth-wrapper">
        <div className="auth-card">
          {requireOtp ? (
            <form onSubmit={handleVerifyOtp}>
              <div className="auth-header">
                <img src="/logo.png" alt="iCompaas Logo" style={{ height: '64px', marginBottom: '1rem', objectFit: 'contain' }} />
                <h1>{otpType === 'register' ? 'Verify Email' : 'Two-Factor Authentication'}</h1>
                <p>We've sent a verification code to <strong>{email}</strong></p>
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
                Verify & Sign In
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
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="auth-header">
                <img src="/logo.png" alt="iCompaas Logo" style={{ height: '64px', marginBottom: '1rem', objectFit: 'contain' }} />
                <h1>iCompaas</h1>
                <p>Task & Expense Management for Teams</p>
              </div>

              {error && (
                <div className="error-message">
                  <span style={{ marginRight: '8px', fontSize: '1.25rem' }}>⚠️</span>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  className="form-control"
                  placeholder="e.g. name@company.com"
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      id="show-password"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="show-password" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>Show Password</label>
                  </div>
                  <Link to="/forgot-password" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '500' }}>
                    Forgot Password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                Sign In
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            Don't have an account? <Link to="/register">Register Here</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
