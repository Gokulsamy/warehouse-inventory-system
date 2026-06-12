import React, { useState } from 'react';
import { api } from '../utils/api';
import { Search, Filter, Plus, Package, Layers, X, CheckCircle, Trash2 } from 'lucide-react';

export default function Inventory({ products, onRefresh, userRole }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product? This will remove its definition and clear all of its stock from all racks!")) {
      return;
    }
    
    try {
      await api.deleteProduct(productId);
      onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };
  
  // Form state
  const [newProduct, setNewProduct] = useState({
    product_code: '',
    name: '',
    category: 'Electronics',
    height: 10,
    width: 10,
    length: 10,
    weight: 1.0,
    quantity: 0
  });

  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const categories = ['All', 'Electronics', 'Furniture', 'Apparel', 'Food', 'Chemicals', 'Other'];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.product_code.includes(searchQuery);
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    const barcodeTrimmed = newProduct.product_code.trim();
    const nameTrimmed = newProduct.name.trim();

    if (!barcodeTrimmed || barcodeTrimmed.length < 3) {
      setFormError('Barcode/SKU must be at least 3 characters long.');
      return;
    }

    if (!nameTrimmed || nameTrimmed.length < 3) {
      setFormError('Product name must be at least 3 characters long.');
      return;
    }

    // Check if barcode is unique
    const barcodeExists = products.some(
      p => p.product_code.toLowerCase() === barcodeTrimmed.toLowerCase()
    );
    if (barcodeExists) {
      setFormError(`Barcode '${barcodeTrimmed}' is already registered to another product template.`);
      return;
    }

    if (parseFloat(newProduct.weight) <= 0) {
      setFormError('Product weight must be greater than 0 kg.');
      return;
    }

    if (parseFloat(newProduct.height) <= 0 || parseFloat(newProduct.width) <= 0 || parseFloat(newProduct.length) <= 0) {
      setFormError('Dimensions (Height, Width, Length) must be greater than 0 cm.');
      return;
    }

    try {
      await api.createProduct({
        ...newProduct,
        product_code: barcodeTrimmed,
        name: nameTrimmed
      });
      setFormSuccess(true);
      setNewProduct({
        product_code: '',
        name: '',
        category: 'Electronics',
        height: 10,
        width: 10,
        length: 10,
        weight: 1.0,
        quantity: 0
      });
      onRefresh();
      setTimeout(() => {
        setShowAddForm(false);
        setFormSuccess(false);
      }, 1500);
    } catch (err) {
      setFormError(err.message || 'Failed to create product definition');
    }
  };

  const formatVol = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}m³`;
    return `${(val / 1000).toFixed(1)}k cm³`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.actionsBar}>
        <div>
          <h2 style={styles.title}>Product Catalog</h2>
          <p style={styles.subtitle}>View physical dimensions, weight records, and stock distributions</p>
        </div>
        {userRole !== 'user' && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
            <Plus size={18} />
            <span>New Product Template</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={styles.filterBar}>
        <div style={styles.searchContainer}>
          <Search size={18} color="#6b7280" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by product name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        <div style={styles.filterDropdowns}>
          <Filter size={16} color="#6b7280" />
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>Filter Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-input"
            style={{ width: '150px' }}
          >
            {categories.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="glass-panel" style={{ marginTop: '20px', padding: 0, overflow: 'hidden' }}>
        {filteredProducts.length === 0 ? (
          <div style={styles.emptyContainer}>
            <Package size={48} color="#6b7280" />
            <p style={{ marginTop: '14px', fontSize: '14px', color: '#9ca3af' }}>No products matching search filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Barcode / SKU</th>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Dimensions (H x W x L)</th>
                  <th>Volume</th>
                  <th>Weight</th>
                  <th>Stock Count</th>
                  {userRole !== 'user' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td style={styles.barcodeCell}>{p.product_code}</td>
                    <td>
                      <div style={styles.productDetailsCell}>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span style={styles.categoryBadge(p.category)}>{p.category}</span>
                    </td>
                    <td style={styles.dimCell}>{p.height} x {p.width} x {p.length} cm</td>
                    <td style={styles.volCell}>{formatVol(p.volume)}</td>
                    <td style={styles.weightCell}>{p.weight.toFixed(1)} kg</td>
                    <td style={styles.qtyCell}>
                      <span style={{ 
                        ...styles.qtyText, 
                        color: p.quantity === 0 ? '#ef4444' : p.quantity < 5 ? '#f59e0b' : '#10b981'
                      }}>
                        {p.quantity} units
                      </span>
                    </td>
                    {userRole !== 'user' && (
                      <td>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            transition: 'all 0.2s ease'
                          }}
                          title="Delete Product Template"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Dialog Modal */}
      {showAddForm && (
        <div style={styles.modalOverlay} onClick={() => setShowAddForm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Define Product Template</h3>
              <button onClick={() => setShowAddForm(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.divider} />

            {formSuccess ? (
              <div style={styles.successForm}>
                <CheckCircle size={36} color="#10b981" />
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Product template registered!</p>
              </div>
            ) : (
              <form onSubmit={handleCreateProduct} style={styles.addProductForm}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Barcode / QR Code String</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 880909"
                    value={newProduct.product_code}
                    onChange={(e) => setNewProduct({ ...newProduct, product_code: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Ergonomic Office Chair"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="grid-2" style={{ gap: '12px' }}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Category</label>
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="form-input"
                    >
                      <option value="Electronics">Electronics</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Apparel">Apparel</option>
                      <option value="Food">Food</option>
                      <option value="Chemicals">Chemicals</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={newProduct.weight}
                      onChange={(e) => setNewProduct({ ...newProduct, weight: parseFloat(e.target.value) || 0.1 })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Dimensions (Height x Width x Length in cm)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      placeholder="Height"
                      min="1"
                      required
                      value={newProduct.height}
                      onChange={(e) => setNewProduct({ ...newProduct, height: parseFloat(e.target.value) || 1 })}
                      className="form-input"
                    />
                    <input
                      type="number"
                      placeholder="Width"
                      min="1"
                      required
                      value={newProduct.width}
                      onChange={(e) => setNewProduct({ ...newProduct, width: parseFloat(e.target.value) || 1 })}
                      className="form-input"
                    />
                    <input
                      type="number"
                      placeholder="Length"
                      min="1"
                      required
                      value={newProduct.length}
                      onChange={(e) => setNewProduct({ ...newProduct, length: parseFloat(e.target.value) || 1 })}
                      className="form-input"
                    />
                  </div>
                </div>

                {formError && <div style={styles.errorAlert}>{formError}</div>}

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Register Product
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)} 
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
  filterBar: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
  },
  searchContainer: {
    position: 'relative',
    flex: 1,
    maxWidth: '500px',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 1,
  },
  filterDropdowns: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  barcodeCell: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '0.5px',
  },
  productDetailsCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  categoryBadge: (category) => {
    let color = '#a855f7';
    if (category === 'Furniture') color = 'var(--zone-heavy)';
    if (category === 'Electronics') color = 'var(--zone-fragile)';
    if (category === 'Chemicals') color = 'var(--zone-cold)';
    if (category === 'Food') color = 'var(--zone-standard)';
    return {
      fontSize: '11px',
      fontWeight: '600',
      color,
      background: `${color}15`,
      padding: '2px 8px',
      borderRadius: '10px',
      border: `1px solid ${color}30`,
    };
  },
  dimCell: {
    color: 'var(--text-primary)',
  },
  volCell: {
    color: 'var(--text-secondary)',
  },
  weightCell: {
    color: 'var(--text-secondary)',
  },
  qtyCell: {
    fontWeight: '700',
  },
  qtyText: {
    background: 'rgba(15, 23, 42, 0.015)',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    border: '1px solid var(--border-glass)',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280',
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
    maxWidth: '480px',
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
  divider: {
    height: '1px',
    background: 'var(--border-glass)',
    margin: '16px 0',
  },
  addProductForm: {
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
