import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, X, Layers, Weight, ArrowUpRight, CheckCircle, PackageOpen, Trash2 } from 'lucide-react';

export default function RacksGrid({ racks, onRefresh, userRole }) {
  const [selectedRack, setSelectedRack] = useState(null);
  const [rackContents, setRackContents] = useState([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [retrievalQty, setRetrievalQty] = useState({});
  const [showAddRack, setShowAddRack] = useState(false);
  
  // New Rack Form State
  const [newRack, setNewRack] = useState({
    code: '',
    height: 120,
    width: 120,
    length: 150,
    max_weight: 500,
    zone: 'Standard'
  });

  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleDeleteRack = async (e, rack) => {
    e.stopPropagation(); // prevent opening the drawer
    if (!window.confirm(`Delete rack "${rack.code}"? This cannot be undone.`)) return;
    setDeleteError(null);
    try {
      await api.deleteRack(rack.id);
      if (selectedRack?.id === rack.id) setSelectedRack(null);
      onRefresh();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete rack.');
      setTimeout(() => setDeleteError(null), 5000);
    }
  };

  useEffect(() => {
    if (selectedRack) {
      loadRackContents(selectedRack.id);
    }
  }, [selectedRack]);

  const loadRackContents = async (rackId) => {
    setLoadingContents(true);
    try {
      // Custom endpoint we added
      const res = await fetch(`http://localhost:8000/api/v1/racks/${rackId}/products`);
      if (res.ok) {
        const data = await res.json();
        setRackContents(data);
      }
    } catch (err) {
      console.error('Failed to load rack content details:', err);
    } finally {
      setLoadingContents(false);
    }
  };

  const handleRetrieve = async (productCode, quantity) => {
    const qty = parseInt(quantity) || 1;
    if (qty <= 0) return;
    
    try {
      await api.retrieveStock(productCode, selectedRack.code, qty);
      // Refresh local drawer contents
      await loadRackContents(selectedRack.id);
      // Refresh parent racks list
      onRefresh();
    } catch (err) {
      alert(err.message || 'Retrieval failed');
    }
  };

  const handleCreateRack = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    try {
      await api.createRack(newRack);
      setFormSuccess(true);
      setNewRack({
        code: '',
        height: 120,
        width: 120,
        length: 150,
        max_weight: 500,
        zone: 'Standard'
      });
      onRefresh();
      setTimeout(() => {
        setShowAddRack(false);
        setFormSuccess(false);
      }, 1500);
    } catch (err) {
      setFormError(err.message || 'Failed to create rack');
    }
  };

  const getRackCardBorder = (occPct) => {
    if (occPct > 85) return '1px solid rgba(239, 68, 68, 0.4)';
    if (occPct > 45) return '1px solid rgba(245, 158, 11, 0.4)';
    return '1px solid rgba(16, 185, 129, 0.4)';
  };

  const getRackGlow = (occPct) => {
    if (occPct > 85) return '0 0 15px rgba(239, 68, 68, 0.15)';
    if (occPct > 45) return '0 0 15px rgba(245, 158, 11, 0.15)';
    return '0 0 15px rgba(16, 185, 129, 0.15)';
  };

  return (
    <div style={styles.container}>
      {/* Delete error toast */}
      {deleteError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
          ❌ {deleteError}
        </div>
      )}
      {/* Top action row */}
      <div style={styles.actionsBar}>
        <div>
          <h2 style={styles.title}>Warehouse Racks Map</h2>
          <p style={styles.subtitle}>Click any rack storage bay to view contents or retrieve stock</p>
        </div>
        {userRole === 'admin' && (
          <button onClick={() => setShowAddRack(true)} className="btn btn-primary">
            <Plus size={18} />
            <span>Add New Rack</span>
          </button>
        )}
      </div>

      <div style={styles.layoutWrapper}>
        {/* Racks Grid Layout */}
        <div style={styles.racksGrid}>
          {racks.map((rack) => {
            const volOccPct = Math.min(100, Math.round((rack.occupied_volume / rack.total_volume) * 100));
            const wtOccPct = Math.min(100, Math.round((rack.current_weight / rack.max_weight) * 100));
            
            return (
              <div 
                key={rack.id} 
                className="glass-panel" 
                style={{
                  ...styles.rackCard,
                  border: getRackCardBorder(volOccPct),
                  boxShadow: getRackGlow(volOccPct),
                  ...(selectedRack?.id === rack.id ? styles.selectedRackCard : {})
                }}
                onClick={() => setSelectedRack(rack)}
              >
                <div style={styles.rackCardHeader}>
                  <h3 style={styles.rackCodeText}>{rack.code}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={styles.badgeStyle(rack.zone)}>{rack.zone}</span>
                    {userRole === 'admin' && (
                      <button
                        onClick={(e) => handleDeleteRack(e, rack)}
                        title="Delete Rack"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#f87171',
                          borderRadius: '6px',
                          padding: '3px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={styles.statMetricRow}>
                  <div style={styles.metricItem}>
                    <div style={styles.metricLabelRow}>
                      <Layers size={12} color="#9ca3af" />
                      <span>Volume: {volOccPct}%</span>
                    </div>
                    <div style={styles.progContainer}>
                      <div 
                        style={{ 
                          ...styles.progValue, 
                          width: `${volOccPct}%`, 
                          backgroundColor: volOccPct > 85 ? '#ef4444' : volOccPct > 45 ? '#f59e0b' : '#10b981' 
                        }} 
                      />
                    </div>
                  </div>

                  <div style={styles.metricItem}>
                    <div style={styles.metricLabelRow}>
                      <Weight size={12} color="#9ca3af" />
                      <span>Weight: {wtOccPct}%</span>
                    </div>
                    <div style={styles.progContainer}>
                      <div 
                        style={{ 
                          ...styles.progValue, 
                          width: `${wtOccPct}%`, 
                          backgroundColor: wtOccPct > 85 ? '#ef4444' : '#10b981' 
                        }} 
                      />
                    </div>
                  </div>
                </div>
                
                <div style={styles.rackFooter}>
                  <span>Click to Inspect</span>
                  <ArrowUpRight size={14} color="#6b7280" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Rack Side Contents Drawer */}
        {selectedRack && (
          <div style={styles.drawerOverlay} onClick={() => setSelectedRack(null)}>
            <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
              <div style={styles.drawerHeader}>
                <div>
                  <h3 style={styles.drawerTitle}>Inspection: {selectedRack.code}</h3>
                  <span style={styles.badgeStyle(selectedRack.zone)}>{selectedRack.zone} Zone</span>
                </div>
                <button onClick={() => setSelectedRack(null)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>
              <div style={styles.divider} />

              <div style={styles.drawerStatsGrid}>
                <div style={styles.drawerStatCard}>
                  <span style={styles.drawerStatLabel}>Total Volume Space</span>
                  <strong style={styles.drawerStatValue}>{Math.round(selectedRack.total_volume / 1000)}k cm³</strong>
                  <span style={styles.drawerStatSub}>Occupied: {Math.round(selectedRack.occupied_volume / 1000)}k cm³</span>
                </div>
                
                <div style={styles.drawerStatCard}>
                  <span style={styles.drawerStatLabel}>Weight Capacity</span>
                  <strong style={styles.drawerStatValue}>{selectedRack.max_weight} kg</strong>
                  <span style={styles.drawerStatSub}>Occupied: {selectedRack.current_weight.toFixed(1)} kg</span>
                </div>
              </div>

              <h4 style={styles.contentsHeading}>Rack Stored Inventory Items</h4>

              <div style={styles.contentsList}>
                {loadingContents ? (
                  <div style={styles.drawerLoading}>Scanning rack cargo bays...</div>
                ) : rackContents.length === 0 ? (
                  <div style={styles.drawerEmpty}>
                    <PackageOpen size={36} color="#6b7280" />
                    <p style={{ marginTop: '10px' }}>Rack is empty.</p>
                  </div>
                ) : (
                  rackContents.map((item) => (
                    <div key={item.product_id} style={styles.contentItem}>
                      <div style={styles.contentItemMain}>
                        <strong>{item.name}</strong>
                        <span style={styles.itemSku}>SKU: {item.product_code} ({item.category})</span>
                        <div style={styles.itemMeta}>
                          <span>Qty Stored: <strong>{item.quantity} units</strong></span>
                          <span>Volume: {Math.round(item.volume / 1000)}k cm³</span>
                        </div>
                      </div>

                      {userRole === 'admin' || userRole === 'supervisor' ? (
                        <div style={styles.retrievalControls}>
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={retrievalQty[item.product_id] || 1}
                            onChange={(e) => setRetrievalQty({
                              ...retrievalQty,
                              [item.product_id]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1))
                            })}
                            className="form-input"
                            style={styles.retrievalInput}
                          />
                          <button
                            onClick={() => handleRetrieve(item.product_code, retrievalQty[item.product_id] || 1)}
                            className="btn btn-danger"
                            style={styles.retrievalBtn}
                          >
                            Retrieve
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Read-Only Location
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Rack Dialog Modal */}
        {showAddRack && (
          <div style={styles.modalOverlay} onClick={() => setShowAddRack(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Add Warehouse Rack</h3>
                <button onClick={() => setShowAddRack(false)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>
              <div style={styles.divider} />

              {formSuccess ? (
                <div style={styles.successForm}>
                  <CheckCircle size={36} color="#10b981" />
                  <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Rack added successfully!</p>
                </div>
              ) : (
                <form onSubmit={handleCreateRack} style={styles.addRackForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Rack Code/Identifier</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., RACK-F1"
                      value={newRack.code}
                      onChange={(e) => setNewRack({ ...newRack, code: e.target.value.toUpperCase() })}
                      className="form-input"
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '12px' }}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Safety Storage Zone</label>
                      <select
                        value={newRack.zone}
                        onChange={(e) => setNewRack({ ...newRack, zone: e.target.value })}
                        className="form-input"
                      >
                        <option value="Standard">Standard (General)</option>
                        <option value="Heavy">Heavy (Heavy/Bottom Shelf)</option>
                        <option value="Fragile">Fragile (Fragile/Middle Shelf)</option>
                        <option value="Cold">Cold (Refrigerated)</option>
                        <option value="Upper">Upper (Lightweight/Top Shelf)</option>
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Max Weight Limit (kg)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newRack.max_weight}
                        onChange={(e) => setNewRack({ ...newRack, max_weight: parseFloat(e.target.value) || 1 })}
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
                        value={newRack.height}
                        onChange={(e) => setNewRack({ ...newRack, height: parseFloat(e.target.value) || 1 })}
                        className="form-input"
                      />
                      <input
                        type="number"
                        placeholder="Width"
                        min="1"
                        required
                        value={newRack.width}
                        onChange={(e) => setNewRack({ ...newRack, width: parseFloat(e.target.value) || 1 })}
                        className="form-input"
                      />
                      <input
                        type="number"
                        placeholder="Length"
                        min="1"
                        required
                        value={newRack.length}
                        onChange={(e) => setNewRack({ ...newRack, length: parseFloat(e.target.value) || 1 })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  {formError && <div style={styles.errorAlert}>{formError}</div>}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      Register Rack
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowAddRack(false)} 
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
  layoutWrapper: {
    position: 'relative',
  },
  racksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
  },
  rackCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    position: 'relative',
  },
  selectedRackCard: {
    borderColor: 'var(--primary) !important',
    boxShadow: '0 0 15px var(--primary-glow) !important',
  },
  rackCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  rackCodeText: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  badgeStyle: (zone) => {
    let color = '#a855f7';
    if (zone === 'Heavy') color = 'var(--zone-heavy)';
    if (zone === 'Fragile') color = 'var(--zone-fragile)';
    if (zone === 'Cold') color = 'var(--zone-cold)';
    if (zone === 'Standard') color = 'var(--zone-standard)';
    return {
      fontSize: '10px',
      fontWeight: '700',
      textTransform: 'uppercase',
      color,
      border: `1px solid ${color}40`,
      background: `${color}10`,
      padding: '2px 8px',
      borderRadius: '12px',
    };
  },
  statMetricRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metricLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  progContainer: {
    height: '6px',
    background: 'rgba(15, 23, 42, 0.06)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progValue: {
    height: '100%',
    borderRadius: '3px',
  },
  rackFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    paddingTop: '10px',
    fontSize: '11px',
    color: '#6b7280',
  },
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  drawer: {
    width: '100%',
    maxWidth: '450px',
    height: '100%',
    background: 'var(--gradient-card)',
    borderLeft: '1px solid var(--border-glass)',
    boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.1)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: '18px',
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
  drawerStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  drawerStatCard: {
    background: 'rgba(15, 23, 42, 0.02)',
    border: '1px solid var(--border-glass)',
    padding: '12px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
  },
  drawerStatLabel: {
    fontSize: '10px',
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  drawerStatValue: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginTop: '2px',
  },
  drawerStatSub: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginTop: '1px',
  },
  contentsHeading: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  contentsList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingRight: '4px',
  },
  contentItem: {
    background: 'rgba(15, 23, 42, 0.015)',
    border: '1px solid var(--border-glass)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  contentItemMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  itemSku: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
  },
  itemMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginTop: '6px',
  },
  retrievalControls: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    width: '90px',
  },
  retrievalInput: {
    padding: '4px 8px',
    textAlign: 'center',
    fontSize: '12px',
    borderRadius: '6px',
    width: '100%',
  },
  retrievalBtn: {
    padding: '4px 10px',
    fontSize: '11px',
    borderRadius: '6px',
    width: '100%',
  },
  drawerLoading: {
    textAlign: 'center',
    padding: '40px 0',
    color: 'var(--text-secondary)',
  },
  drawerEmpty: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#6b7280',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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
  addRackForm: {
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
