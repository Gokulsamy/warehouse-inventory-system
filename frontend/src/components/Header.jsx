import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ScanLine, Grid, Box, Clock, LogOut, Users } from 'lucide-react';

export default function Header({ currentView, onViewChange, currentUser, onLogout }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scan', label: 'Scan & Allocate', icon: ScanLine },
    { id: 'racks', label: 'Racks Map', icon: Grid },
    { id: 'inventory', label: 'Inventory', icon: Box },
  ];

  if (currentUser && currentUser.role === 'admin') {
    navItems.push({ id: 'users', label: 'Users', icon: Users });
  } else if (currentUser && currentUser.role === 'supervisor') {
    navItems.push({ id: 'users', label: 'Operator Directory', icon: Users });
  }

  return (
    <header style={styles.header}>
      <div style={styles.branding}>
        <div style={styles.logoCircle}>AI</div>
        <div>
          <h1 style={styles.title}>INVENTO-AI</h1>
          <p style={styles.subtitle}>Warehouse Rack & Space Optimizer</p>
        </div>
      </div>

      <nav style={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              style={{
                ...styles.navBtn,
                ...(isActive ? styles.navBtnActive : {}),
              }}
            >
              <Icon size={18} color={isActive ? '#a855f7' : '#9ca3af'} />
              <span>{item.label}</span>
              {isActive && <div style={styles.activeIndicator} />}
            </button>
          );
        })}
      </nav>

      <div style={styles.rightContainer}>
        <div style={styles.clockContainer}>
          <Clock size={16} color="#6366f1" />
          <span style={styles.clockText}>{formatTime(time)}</span>
        </div>

        {currentUser && (
          <div style={styles.userContainer}>
            <div style={styles.userBadge(currentUser.role)}>
              <span style={styles.roleLabel}>{currentUser.role}</span>
              <span style={styles.usernameText}>@{currentUser.username}</span>
            </div>
            <button onClick={onLogout} style={styles.logoutBtn} title="Logout">
              <LogOut size={16} color="#ef4444" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const styles = {
  header: {
    background: 'var(--bg-secondary)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-glass)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 5%',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  branding: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '18px',
    color: '#fff',
    boxShadow: '0 0 15px rgba(79, 70, 229, 0.25)',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.2',
  },
  subtitle: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  nav: {
    display: 'flex',
    gap: '8px',
    background: 'rgba(15, 23, 42, 0.04)',
    padding: '4px',
    borderRadius: '12px',
    border: '1px solid var(--border-glass)',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  navBtnActive: {
    color: 'var(--primary)',
    background: 'rgba(79, 70, 229, 0.08)',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: '-4px',
    left: '10%',
    width: '80%',
    height: '2px',
    background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
    borderRadius: '2px',
  },
  clockContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(79, 70, 229, 0.06)',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(79, 70, 229, 0.15)',
  },
  clockText: {
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: 'monospace',
    color: 'var(--text-primary)',
    letterSpacing: '0.5px',
  },
  rightContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userBadge: (role) => {
    let bg = 'rgba(239, 68, 68, 0.1)';
    let color = '#ef4444';
    if (role === 'supervisor') {
      bg = 'rgba(245, 158, 11, 0.1)';
      color = '#f59e0b';
    } else if (role === 'user') {
      bg = 'rgba(37, 99, 235, 0.1)';
      color = '#2563eb';
    }
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      borderRadius: '8px',
      border: `1px solid ${color}30`,
      background: bg,
      color: color,
      fontSize: '12px',
      fontWeight: '600',
    };
  },
  roleLabel: {
    textTransform: 'uppercase',
    fontSize: '9px',
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.5px',
  },
  usernameText: {
    fontWeight: '700',
  },
  logoutBtn: {
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
};


