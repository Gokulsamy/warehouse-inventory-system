import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import Allocation from './components/Allocation';
import RacksGrid from './components/RacksGrid';
import Inventory from './components/Inventory';
import Login from './components/Login';
import UsersManager from './components/UsersManager';
import { api } from './utils/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('invento_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Global States
  const [stats, setStats] = useState({
    total_products: 0,
    total_stock: 0,
    occupied_racks_count: 0,
    total_racks_count: 0,
    overall_volume_utilization: 0.0,
    overall_weight_utilization: 0.0,
    recent_movements: []
  });
  
  const [racks, setRacks] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Scanning States
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [scanQuantity, setScanQuantity] = useState(1);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const statsData = await api.getDashboardStats();
      const racksData = await api.getRacks();
      const productsData = await api.getProducts();
      
      setStats(statsData);
      setRacks(racksData);
      setProducts(productsData);
    } catch (err) {
      console.error("Error loading warehouse database:", err);
      setError(err.message || "Could not connect to warehouse API server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const handleLogin = (username, role) => {
    const user = { username, role };
    setCurrentUser(user);
    localStorage.setItem('invento_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('invento_user');
    setCurrentView('dashboard');
  };

  const handleProductScanned = (product, quantity) => {
    setSelectedProduct(product);
    setScanQuantity(quantity);
  };

  const handleAllocationSuccess = () => {
    showToast(`Successfully allocated ${scanQuantity} units of ${selectedProduct.name}!`);
    setSelectedProduct(null);
    setScanQuantity(1);
    loadData();
    setCurrentView('dashboard');
  };

  const handleBackToScanner = () => {
    setSelectedProduct(null);
    setScanQuantity(1);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!currentUser) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Header 
        currentView={currentView} 
        onViewChange={(view) => {
          // Clear active scan if navigating away
          setSelectedProduct(null);
          setCurrentView(view);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {loading && !stats.total_racks_count ? (
          <div style={styles.loadingWrapper}>
            <div style={styles.spinner} />
            <p style={{ marginTop: '16px', color: '#9ca3af' }}>Connecting to Invento-AI core systems...</p>
          </div>
        ) : error ? (
          <div className="glass-panel" style={styles.errorPanel}>
            <h3 style={{ color: '#ef4444' }}>API Connection Offline</h3>
            <p style={{ color: '#9ca3af', marginTop: '10px' }}>{error}</p>
            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
              Please verify that the FastAPI backend server is running on port 8000.
            </p>
            <button onClick={loadData} className="btn btn-primary" style={{ marginTop: '20px' }}>
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* View router */}
            {currentView === 'dashboard' && (
              <Dashboard stats={stats} onRefresh={loadData} />
            )}
            
            {currentView === 'scan' && (
              selectedProduct ? (
                <Allocation 
                  product={selectedProduct} 
                  quantity={scanQuantity} 
                  onBack={handleBackToScanner} 
                  onAllocationSuccess={handleAllocationSuccess}
                />
              ) : (
                <Scanner onProductScanned={handleProductScanned} userRole={currentUser.role} />
              )
            )}
            
            {currentView === 'racks' && (
              <RacksGrid racks={racks} onRefresh={loadData} userRole={currentUser.role} />
            )}
            
            {currentView === 'inventory' && (
              <Inventory products={products} onRefresh={loadData} userRole={currentUser.role} />
            )}
            
            {currentView === 'users' && (currentUser.role === 'admin' || currentUser.role === 'supervisor') && (
              <UsersManager currentUser={currentUser} />
            )}
          </>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={styles.toast}>
          <div style={styles.toastGlow} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  loadingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(99, 102, 241, 0.1)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorPanel: {
    textAlign: 'center',
    maxWidth: '500px',
    margin: '100px auto',
  },
  toast: {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    background: '#10b981',
    color: '#fff',
    padding: '14px 24px',
    borderRadius: '12px',
    fontWeight: '700',
    fontSize: '14px',
    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    animation: 'slideUp 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
  },
};
