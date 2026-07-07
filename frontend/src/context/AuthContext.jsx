import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [workspaceId, setWorkspaceId] = useState(localStorage.getItem('workspaceId') || null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // Set default axios authorization headers
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await axios.get('/api/auth/profile');
          setUser(res.data);
          // Fetch workspaces
          const wsRes = await axios.get('/api/workspaces');
          setWorkspaces(wsRes.data);
          
          // Verify selected workspace still exists
          if (res.data.role === 'admin') {
            if (workspaceId === '0' || !workspaceId) {
              setWorkspaceId('0');
              localStorage.setItem('workspaceId', '0');
            } else {
              const currentWs = wsRes.data.find(w => w.id === parseInt(workspaceId));
              if (currentWs) {
                setWorkspaceId(currentWs.id.toString());
              } else {
                setWorkspaceId('0');
                localStorage.setItem('workspaceId', '0');
              }
            }
          } else {
            const currentWs = wsRes.data.find(w => w.id === parseInt(workspaceId));
            if (currentWs) {
              setWorkspaceId(currentWs.id.toString());
            } else if (wsRes.data.length > 0) {
              setWorkspaceId(wsRes.data[0].id.toString());
              localStorage.setItem('workspaceId', wsRes.data[0].id.toString());
            } else {
              setWorkspaceId(null);
              localStorage.removeItem('workspaceId');
            }
          }
        } catch (err) {
          console.error('Session expired or invalid token', err);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    // Fetch workspaces immediately to set default workspace
    axios.get('/api/workspaces').then(res => {
      setWorkspaces(res.data);
      if (newUser.role === 'admin') {
        setWorkspaceId("0");
        localStorage.setItem('workspaceId', "0");
      } else if (res.data.length > 0) {
        setWorkspaceId(res.data[0].id.toString());
        localStorage.setItem('workspaceId', res.data[0].id.toString());
      }
    }).catch(err => console.error("Error fetching workspaces on login", err));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('workspaceId');
    setToken(null);
    setUser(null);
    setWorkspaceId(null);
    setWorkspaces([]);
    delete axios.defaults.headers.common['Authorization'];
  };

  const switchWorkspace = (id) => {
    setWorkspaceId(id.toString());
    localStorage.setItem('workspaceId', id.toString());
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await axios.get('/api/workspaces');
      setWorkspaces(res.data);
      if (user?.role === 'admin') {
        if (workspaceId !== '0') {
          const currentWs = res.data.find(w => w.id === parseInt(workspaceId));
          if (!currentWs) {
            setWorkspaceId('0');
            localStorage.setItem('workspaceId', '0');
          }
        }
      } else {
        // If workspace no longer exists, select the first one
        const currentWs = res.data.find(w => w.id === parseInt(workspaceId));
        if (!currentWs && res.data.length > 0) {
          switchWorkspace(res.data[0].id);
        } else if (res.data.length === 0) {
          setWorkspaceId(null);
          localStorage.removeItem('workspaceId');
        }
      }
      return res.data;
    } catch (err) {
      console.error("Error fetching workspaces", err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      workspaceId,
      workspaces,
      loading,
      login,
      logout,
      switchWorkspace,
      fetchWorkspaces,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
