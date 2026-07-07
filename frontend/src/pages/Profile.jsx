import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Profile = () => {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email) {
      setError('Username and email are required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('email', email);
      if (password) {
        formData.append('password', password);
      }
      if (profilePic) {
        formData.append('profile_pic', profilePic);
      }

      const res = await axios.put('/api/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUser(res.data.user);
      setSuccess('Profile updated successfully!');
      setPassword('');
      setProfilePic(null);
      setProfilePicPreview(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="profile-grid">
        <div className="avatar-upload-area">
          {profilePicPreview ? (
            <img src={profilePicPreview} alt="preview" className="avatar-large" />
          ) : user?.profile_pic ? (
            <img src={`/api/uploads/${user.profile_pic}`} alt="avatar" className="avatar-large" />
          ) : (
            <div className="avatar-large">{getInitials(user?.username)}</div>
          )}

          <div className="file-input-wrapper">
            <button className="btn btn-secondary btn-block">Change Photo</button>
            <input type="file" accept="image/*" onChange={handlePicChange} disabled={loading} />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Max size 16MB. Formats: PNG, JPG, GIF
          </span>
        </div>

        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Account Settings
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password (leave empty to keep current)</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <LoadingSpinner size="small" color="white" inline={true} />
                  <span style={{ marginLeft: '8px' }}>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
