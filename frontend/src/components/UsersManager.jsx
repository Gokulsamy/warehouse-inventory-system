import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, Trash2, Shield, UserPlus, X, CheckCircle } from 'lucide-react';

export default function UsersManager({ currentUser }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New User Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers(currentUser.role);
      setUsersList(data);
    } catch (err) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    const cleanUsername = username.trim().toLowerCase();
    
    // Username validation
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setFormError('Username must be between 3 and 20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setFormError('Username can only contain letters, numbers, and underscores.');
      return;
    }

    // Password validation
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    // Email validation (optional but validated if provided)
    const cleanEmail = email.trim();
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setFormError('Please enter a valid email address.');
        return;
      }
    }

    // Phone / Contact validation (optional but validated if provided)
    const cleanContact = contact.trim();
    if (cleanContact) {
      const phoneRegex = /^\+?[\d\s\-()]+$/;
      if (!phoneRegex.test(cleanContact)) {
        setFormError('Phone number can only contain digits, spaces, hyphens, parentheses, and an optional leading +.');
        return;
      }
      const digitsOnly = cleanContact.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        setFormError('Phone number must contain between 7 and 15 digits.');
        return;
      }
    }

    try {
      await api.createUser({
        username: cleanUsername,
        password,
        role,
        email: cleanEmail || null,
        contact: cleanContact || null
      }, currentUser.role);

      setFormSuccess(true);
      setUsername('');
      setPassword('');
      setRole('user');
      setEmail('');
      setContact('');
      loadUsers();

      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess(false);
      }, 1500);
    } catch (err) {
      setFormError(err.message || 'Failed to register new user account.');
    }
  };

  const handleDeleteUser = async (userObj) => {
    if (userObj.username === currentUser.username) {
      alert("You cannot delete your own active administrator session!");
      return;
    }
    if (userObj.username === 'admin') {
      alert("Cannot delete the primary built-in admin account!");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user account '${userObj.username}'?`)) {
      return;
    }

    try {
      await api.deleteUser(userObj.id, currentUser.role);
      loadUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const getRoleBadgeStyle = (roleName) => {
    let bg = 'rgba(239, 68, 68, 0.1)';
    let color = '#ef4444';
    if (roleName === 'supervisor') {
      bg = 'rgba(245, 158, 11, 0.1)';
      color = '#f59e0b';
    } else if (roleName === 'user') {
      bg = 'rgba(37, 99, 235, 0.1)';
      color = '#2563eb';
    }
    return {
      fontSize: '11px',
      fontWeight: '600',
      color,
      background: bg,
      padding: '2px 8px',
      borderRadius: '10px',
      border: `1px solid ${color}30`,
      textTransform: 'uppercase',
      display: 'inline-block'
    };
  };

  return (
    <div style={styles.container}>
      <div style={styles.actionsBar}>
        <div>
          <h2 style={styles.title}>
            {currentUser.role === 'admin' ? 'System Access Management' : 'Operator Contact Directory'}
          </h2>
          <p style={styles.subtitle}>
            {currentUser.role === 'admin' 
              ? 'Register new Supervisor or Operator credentials and manage user accounts' 
              : 'Contact numbers and email addresses for active warehouse operators'}
          </p>
        </div>
        {currentUser.role === 'admin' && (
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <UserPlus size={18} />
            <span>Add New Account</span>
          </button>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={styles.emptyContainer}>Loading system user database...</div>
        ) : error ? (
          <div style={{ ...styles.emptyContainer, color: '#ef4444' }}>{error}</div>
        ) : usersList.length === 0 ? (
          <div style={styles.emptyContainer}>No user accounts registered.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>User ID</th>
                  <th>Username</th>
                  <th>Active Role Privilege</th>
                  <th>Email Address</th>
                  <th>Contact Number</th>
                  {currentUser.role === 'admin' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {usersList.map((user) => (
                  <tr key={user.id}>
                    <td style={{ paddingLeft: '24px', color: '#6b7280', fontFamily: 'monospace' }}>#{user.id}</td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>@{user.username}</strong>
                    </td>
                    <td>
                      <span style={getRoleBadgeStyle(user.role)}>{user.role}</span>
                    </td>
                    <td>
                      <span style={{ color: user.email ? 'var(--text-primary)' : 'var(--text-secondary)', fontStyle: user.email ? 'normal' : 'italic', fontSize: '13px' }}>
                        {user.email || 'Not registered'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: user.contact ? 'var(--text-primary)' : 'var(--text-secondary)', fontStyle: user.contact ? 'normal' : 'italic', fontSize: '13px' }}>
                        {user.contact || 'Not registered'}
                      </span>
                    </td>
                    {currentUser.role === 'admin' && (
                      <td>
                        {user.username !== 'admin' && user.username !== currentUser.username ? (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            style={styles.deleteBtn}
                            title="Revoke Credentials"
                          >
                            <Trash2 size={12} />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>Protected System Account</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal Dialog */}
      {showAddModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Register User Credentials</h3>
              <button onClick={() => setShowAddModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.divider} />

            {formSuccess ? (
              <div style={styles.successForm}>
                <CheckCircle size={36} color="#10b981" />
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Credentials registered successfully!</p>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Username</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter username (e.g., johndoe)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter email (e.g., johndoe@invento.ai)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Contact Number</label>
                  <input
                    type="text"
                    placeholder="Enter phone number (e.g., +1-555-0199)"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Assign Access Role Privilege</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="form-input"
                  >
                    <option value="supervisor">Supervisor (View + Retrieve + Manage Catalogs)</option>
                    <option value="user">Operator (View + Barcode Allocations)</option>
                  </select>
                </div>

                {formError && <div style={styles.errorAlert}>{formError}</div>}

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Register Account
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)} 
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    animation: 'fadeIn 0.5s ease-in-out',
  },
  actionsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '20px',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280',
    fontSize: '14px'
  },
  deleteBtn: {
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    transition: 'all 0.2s ease'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: '440px',
    background: 'var(--gradient-card)',
    border: '1px solid var(--border-glass)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 40px rgba(15, 23, 42, 0.1)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
  },
  divider: {
    height: '1px',
    background: 'var(--border-glass)',
    margin: '16px 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  formLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  successForm: {
    textAlign: 'center',
    padding: '30px 0',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#f87171',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '12px',
  },
};
