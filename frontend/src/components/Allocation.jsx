import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Sparkles, Check, AlertTriangle, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function Allocation({ product, quantity, onBack, onAllocationSuccess }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmingRack, setConfirmingRack] = useState(null);

  useEffect(() => {
    async function fetchRecommendations() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getAllocationRecommendations(product.product_code, quantity);
        setRecommendations(result.recommendations);
      } catch (err) {
        setError(err.message || 'Failed to search rack recommendations');
      } finally {
        setLoading(false);
      }
    }
    if (product) {
      fetchRecommendations();
    }
  }, [product, quantity]);

  const handleConfirm = async (rackCode, source) => {
    setConfirmingRack(rackCode);
    try {
      await api.confirmAllocation(product.product_code, rackCode, quantity, source);
      onAllocationSuccess();
    } catch (err) {
      alert(err.message || 'Allocation failed');
    } finally {
      setConfirmingRack(null);
    }
  };

  const getZoneColor = (zone) => {
    if (zone === 'Heavy') return 'var(--zone-heavy)';
    if (zone === 'Fragile') return 'var(--zone-fragile)';
    if (zone === 'Cold') return 'var(--zone-cold)';
    if (zone === 'Standard') return 'var(--zone-standard)';
    return 'var(--zone-upper)';
  };

  const formatVol = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}m³`;
    return `${(val / 1000).toFixed(1)}k cm³`;
  };

  return (
    <div style={styles.container}>
      {/* Header Back Button */}
      <button onClick={onBack} style={styles.backBtn}>
        <ArrowLeft size={16} />
        <span>Back to Scanner</span>
      </button>

      <div className="grid-3" style={{ marginTop: '16px' }}>
        {/* Product Physical Summary */}
        <div className="glass-panel" style={styles.productCard}>
          <h4 style={styles.sectionTitle}>Product Spec Card</h4>
          <div style={styles.divider} />
          
          <h2 style={styles.productName}>{product.name}</h2>
          <span style={styles.productCode}>SKU: {product.product_code}</span>

          <div style={styles.specGrid}>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Category</span>
              <span style={styles.specVal}>{product.category}</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Single Unit Weight</span>
              <span style={styles.specVal}>{product.weight} kg</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Single Volume</span>
              <span style={styles.specVal}>{formatVol(product.volume)}</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Dimensions</span>
              <span style={styles.specVal}>{product.height}x{product.width}x{product.length} cm</span>
            </div>
          </div>

          <div style={styles.allocationSummary}>
            <div style={styles.sumRow}>
              <span>Quantity to Allocate:</span>
              <strong>{quantity} units</strong>
            </div>
            <div style={styles.sumRow}>
              <span>Total Volume Needed:</span>
              <strong>{formatVol(product.volume * quantity)}</strong>
            </div>
            <div style={styles.sumRow}>
              <span>Total Weight Load:</span>
              <strong>{round(product.weight * quantity, 2)} kg</strong>
            </div>
          </div>
        </div>

        {/* Rack Recommendations List */}
        <div className="glass-panel" style={{ ...styles.recommendationsCard, gridColumn: 'span 2' }}>
          <div style={styles.recHeader}>
            <div>
              <h4 style={styles.sectionTitle}>Intelligent Allocation Suggestions</h4>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>AI ranking prioritizing space optimization & safety zones</p>
            </div>
            <Sparkles size={20} color="#818cf8" />
          </div>
          <div style={styles.divider} />

          {loading ? (
            <div style={styles.loadingContainer}>Computing 3D geometry fit and training classifier...</div>
          ) : error ? (
            <div style={styles.errorContainer}>{error}</div>
          ) : recommendations.length === 0 ? (
            <div style={styles.emptyContainer}>No racks registered in database.</div>
          ) : (
            <div style={styles.recList}>
              {recommendations.map((rec, index) => {
                const zColor = getZoneColor(rec.rack_code.split('-')[0] === 'RACK' ? 'Standard' : 'Standard'); 
                // Let's decode zone based on rack_code zone prefix or custom retrieval, but let's read the zone string.
                // Wait! Let's display compatibility score and details
                
                const isBest = index === 0 && rec.fits;

                return (
                  <div 
                    key={rec.rack_id} 
                    style={{
                      ...styles.recItem,
                      ...(isBest ? styles.bestRecItem : {}),
                      ...(rec.fits ? {} : styles.disabledRecItem)
                    }}
                  >
                    {isBest && (
                      <div style={styles.bestBadge}>
                        <Sparkles size={12} color="#fff" />
                        <span>AI Recommended Placement</span>
                      </div>
                    )}

                    <div style={styles.recHeaderRow}>
                      <div style={styles.rackDetails}>
                        <h3 style={styles.rackCode}>{rec.rack_code}</h3>
                        <span style={styles.badgeZoneStyle(rec.fits ? '#3b82f6' : '#6b7280')}>
                          {rec.fits ? 'Space Available' : 'Incompatible'}
                        </span>
                      </div>

                      {rec.fits ? (
                        <div style={styles.scoreContainer}>
                          <span style={styles.scoreLabel}>Score</span>
                          <span style={{ 
                            ...styles.scoreValue, 
                            color: rec.score > 80 ? '#10b981' : rec.score > 60 ? '#f59e0b' : '#ef4444' 
                          }}>
                            {rec.score}%
                          </span>
                        </div>
                      ) : (
                        <div style={styles.fitStatusContainer}>
                          <ShieldAlert size={18} color="#ef4444" />
                          <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>FAILED</span>
                        </div>
                      )}
                    </div>

                    <div style={styles.recBody}>
                      {rec.fits ? (
                        <div style={styles.statsRow}>
                          <div style={styles.statMetric}>
                            <span>Volume Occupancy (New)</span>
                            <div style={styles.progBarContainer}>
                              <div style={{ ...styles.progBar, width: `${rec.utilization_percentage}%`, backgroundColor: '#3b82f6' }} />
                            </div>
                            <div style={styles.progLabels}>
                              <span>{rec.utilization_percentage}%</span>
                              <span>Max Capacity</span>
                            </div>
                          </div>
                          
                          <div style={styles.statMetric}>
                            <span>Weight Load (New)</span>
                            <div style={styles.progBarContainer}>
                              <div style={{ ...styles.progBar, width: `${(rec.weight_after_allocation / 2000.0) * 100}%`, backgroundColor: '#ef4444' }} />
                            </div>
                            <div style={styles.progLabels}>
                              <span>{rec.weight_after_allocation} kg</span>
                              <span>Max Capacity</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p style={styles.reasonText}>
                          <AlertTriangle size={14} color="#f59e0b" style={{ marginRight: '6px', display: 'inline' }} />
                          {rec.reason}
                        </p>
                      )}
                    </div>

                    {rec.fits && (
                      <div style={styles.recFooter}>
                        <div style={styles.sourceTag}>
                          Decision Engine: <strong>{rec.recommendation_source}</strong>
                        </div>
                        <button
                          disabled={confirmingRack !== null}
                          onClick={() => handleConfirm(rec.rack_code, rec.recommendation_source)}
                          style={{
                            ...styles.confirmBtn,
                            ...(isBest ? styles.bestConfirmBtn : {})
                          }}
                        >
                          {confirmingRack === rec.rack_code ? 'Allocating...' : 'Confirm Allocation'}
                          <Check size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple rounding helper
const round = (num, decimals) => {
  const t = Math.pow(10, decimals);
  return Math.round(num * t) / t;
};

const styles = {
  container: {
    animation: 'fadeIn 0.5s ease-in-out',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  productCard: {
    background: 'var(--gradient-card)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  divider: {
    height: '1px',
    background: 'var(--border-glass)',
    margin: '12px 0',
  },
  productName: {
    fontSize: '20px',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  productCode: {
    fontSize: '12px',
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  specGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    margin: '20px 0',
  },
  specItem: {
    background: 'rgba(15, 23, 42, 0.02)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
  },
  specLabel: {
    fontSize: '10px',
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  specVal: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginTop: '2px',
  },
  allocationSummary: {
    background: 'rgba(99, 102, 241, 0.05)',
    border: '1px solid rgba(99, 102, 241, 0.12)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sumRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#9ca3af',
  },
  recommendationsCard: {
    background: 'var(--gradient-card)',
  },
  recHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxHeight: '480px',
    overflowY: 'auto',
    paddingRight: '6px',
  },
  recItem: {
    background: 'rgba(15, 23, 42, 0.015)',
    border: '1px solid var(--border-glass)',
    borderRadius: '12px',
    padding: '16px',
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  disabledRecItem: {
    opacity: 0.55,
    background: 'rgba(0, 0, 0, 0.1)',
  },
  bestRecItem: {
    borderColor: 'var(--primary)',
    background: 'rgba(99, 102, 241, 0.03)',
    boxShadow: '0 0 15px rgba(99, 102, 241, 0.05)',
  },
  bestBadge: {
    position: 'absolute',
    top: '-10px',
    right: '20px',
    background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '800',
    padding: '3px 10px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
  },
  recHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rackDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  rackCode: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  badgeZoneStyle: (color) => ({
    fontSize: '11px',
    fontWeight: '600',
    color: color,
    background: `${color}15`,
    padding: '2px 8px',
    borderRadius: '10px',
  }),
  scoreContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: '10px',
    color: '#6b7280',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: '18px',
    fontWeight: '800',
  },
  recBody: {
    marginTop: '14px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
  },
  statMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '11px',
    color: '#9ca3af',
  },
  progBarContainer: {
    height: '6px',
    background: 'rgba(15, 23, 42, 0.06)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progBar: {
    height: '100%',
    borderRadius: '3px',
  },
  progLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: '#6b7280',
  },
  reasonText: {
    fontSize: '12px',
    color: '#f87171',
    lineHeight: '1.4',
  },
  recFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
    paddingTop: '12px',
  },
  sourceTag: {
    fontSize: '11px',
    color: '#6b7280',
  },
  confirmBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    border: '1px solid var(--border-glass)',
    background: 'rgba(15, 23, 42, 0.04)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  bestConfirmBtn: {
    background: 'var(--gradient-primary)',
    border: 'none',
    boxShadow: '0 4px 10px rgba(99,102,241,0.2)',
  },
  fitStatusContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(239, 68, 68, 0.1)',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '80px 20px',
    color: '#9ca3af',
  },
  errorContainer: {
    color: '#ef4444',
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
  },
};
