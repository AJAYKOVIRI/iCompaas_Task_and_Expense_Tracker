import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = Request, 2 = Verify & Reset

  const navigate = useNavigate();

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setMessage(res.data.message || 'Verification reset code sent to your email.');
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/reset-password', {
        email,
        otp,
        password
      });
      setMessage(res.data.message || 'Password reset successfully.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to reset password. Please check the code and try again.');
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
      setMessage(res.data.message || 'Reset code resent successfully.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to resend code.');
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
            {step === 1 ? 'Sending Reset Code' : 'Resetting Password'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {step === 1 ? 'Verifying email and generating secure code...' : 'Updating password credentials...'}
          </p>
        </div>
      )}

      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in">
          {step === 1 ? (
            /* Step 1: Request Reset */
            <form onSubmit={handleRequestReset}>
              <div className="auth-header">
                <img src="/logo.png" alt="iCompaas Logo" style={{ height: '64px', marginBottom: '1rem', objectFit: 'contain' }} />
                <h1>Forgot Password</h1>
                <p>Enter your registered email address to receive a secure password reset code.</p>
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
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                Send Reset Code
              </button>
            </form>
          ) : (
            /* Step 2: Verify & Reset */
            <form onSubmit={handleVerifyAndReset}>
              <div className="auth-header">
                <img src="/logo.png" alt="iCompaas Logo" style={{ height: '64px', marginBottom: '1rem', objectFit: 'contain' }} />
                <h1>Reset Password</h1>
                <p>We've sent a 6-digit verification code to <strong>{email}</strong></p>
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
                <label htmlFor="otp">Verification Code</label>
                <input
                  type="text"
                  id="otp"
                  className="form-control"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  required
                  style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">New Password</label>
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
                <label htmlFor="confirmPassword">Confirm New Password</label>
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
                Reset Password
              </button>

              <button
                type="button"
                className="btn btn-block"
                onClick={handleResendOtp}
                disabled={loading}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-color)', marginTop: '0.75rem' }}
              >
                Resend Code
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link to="/login">Back to Sign In</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
