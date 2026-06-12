import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Layers, Weight, Database, MoveUpRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api } from '../utils/api';

export default function Dashboard({ stats, onRefresh }) {
  const [predictions, setPredictions] = useState([]);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [loadingML, setLoadingML] = useState(true);

  useEffect(() => {
    async function loadMLData() {
      try {
        setLoadingML(true);
        const data = await api.getFutureUtilization(7);
        setPredictions(data.predictions);
        setTotalCapacity(data.total_volume_capacity);
      } catch (err) {
        console.error('Failed to load ML projections:', err);
      } finally {
        setLoadingML(false);
      }
    }
    loadMLData();
  }, [stats]);

  const cards = [
    { title: 'Total Stock Quantity', value: stats.total_stock, sub: 'Units in racks', icon: Package, color: '#6366f1' },
    { title: 'Registered Products', value: stats.total_products, sub: 'Unique items catalog', icon: Layers, color: '#a855f7' },
    { title: 'Active Storage Racks', value: `${stats.occupied_racks_count} / ${stats.total_racks_count}`, sub: 'Occupied vs Total', icon: Database, color: '#10b981' },
    { title: 'Volume Space Utilization', value: `${stats.overall_volume_utilization}%`, sub: 'Warehouse capacity used', icon: Layers, color: '#3b82f6' },
    { title: 'Weight Load Utilization', value: `${stats.overall_weight_utilization}%`, sub: 'Structural weight limit used', icon: Weight, color: '#ef4444' },
  ];

  // Helper to format large numbers to friendly sizes (e.g. 1.2M cm³)
  const formatVol = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M cm³`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k cm³`;
    return `${val} cm³`;
  };

  const chartData = predictions.map(p => ({
    name: p.date,
    utilization: p.predicted_utilization_percentage,
    volume: p.predicted_occupied_volume
  }));

  return (
    <div style={styles.container}>
      {/* 1. Statistics Cards Row */}
      <div style={styles.cardRow}>
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="glass-panel" style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>{card.title}</span>
                <div style={{ ...styles.iconContainer, backgroundColor: `${card.color}15` }}>
                  <Icon size={20} color={card.color} />
                </div>
              </div>
              <h2 style={{ ...styles.cardValue, color: card.color }}>{card.value}</h2>
              <span style={styles.cardSub}>{card.sub}</span>
            </div>
          );
        })}
      </div>

      {/* 2. Main Analytics Row */}
      <div className="grid-2" style={{ marginTop: '24px' }}>
        {/* ML Utilization Projection Chart */}
        <div className="glass-panel" style={styles.chartPanel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>AI Predictive Capacity Utilization</h3>
              <p style={styles.panelSubtitle}>7-Day forecasting using Linear Regression ML model</p>
            </div>
            <div style={styles.badgeML}>ML Forecasting Active</div>
          </div>
          
          {loadingML ? (
            <div style={styles.loadingContainer}>Training forecasting model...</div>
          ) : (
            <div style={{ height: '300px', marginTop: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis unit="%" stroke="#6b7280" domain={[0, 100]} style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value, name) => {
                      if (name === 'utilization') return [`${value}%`, 'Util %'];
                      return [formatVol(value), 'Volume'];
                    }}
                  />
                  <Area type="monotone" dataKey="utilization" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorUtil)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Audit Logs / Recent Stock Movements */}
        <div className="glass-panel" style={styles.logPanel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Stock Movement Audit Log</h3>
              <p style={styles.panelSubtitle}>Real-time transactions and rack allocations</p>
            </div>
          </div>

          <div style={styles.logList}>
            {stats.recent_movements.length === 0 ? (
              <div style={styles.emptyLogs}>No stock movements logged yet. Scan products to get started.</div>
            ) : (
              stats.recent_movements.map((mov) => {
                const isIncoming = mov.type === 'IN';
                return (
                  <div key={mov.id} style={styles.logItem}>
                    <div style={{
                      ...styles.directionCircle,
                      backgroundColor: isIncoming ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      borderColor: isIncoming ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                    }}>
                      {isIncoming ? (
                        <ArrowDownLeft size={16} color="#10b981" />
                      ) : (
                        <ArrowUpRight size={16} color="#ef4444" />
                      )}
                    </div>
                    
                    <div style={styles.logContent}>
                      <div style={styles.logRow}>
                        <span style={styles.logText}>
                          <strong>{mov.quantity} units</strong> {isIncoming ? 'arrived' : 'retrieved'} (ID: {mov.product_id})
                        </span>
                        <span style={styles.logTime}>
                          {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={styles.logNotes}>
                        {mov.notes || `Stock movement processed.`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    animation: 'fadeIn 0.5s ease-in-out',
  },
  cardRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '20px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  iconContainer: {
    padding: '8px',
    borderRadius: '8px',
  },
  cardValue: {
    fontSize: '28px',
    fontWeight: '800',
    margin: '12px 0 4px 0',
  },
  cardSub: {
    fontSize: '11px',
    color: '#6b7280',
  },
  chartPanel: {
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '16px',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  panelSubtitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  badgeML: {
    background: 'rgba(99, 102, 241, 0.1)',
    color: '#818cf8',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: '700',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '250px',
    color: '#9ca3af',
    fontSize: '14px',
  },
  logPanel: {
    display: 'flex',
    flexDirection: 'column',
  },
  logList: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '320px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  logItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    borderRadius: '10px',
    background: 'rgba(15, 23, 42, 0.015)',
    border: '1px solid var(--border-glass)',
  },
  directionCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: '1px',
    borderStyle: 'solid',
    flexShrink: 0,
  },
  logContent: {
    flex: 1,
  },
  logRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  logTime: {
    fontSize: '11px',
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  logNotes: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  emptyLogs: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
    fontSize: '13px',
  },
};
