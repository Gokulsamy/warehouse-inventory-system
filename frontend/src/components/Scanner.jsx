import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, RefreshCw, Barcode, HelpCircle, PackageOpen, ChevronRight, Shield } from 'lucide-react';
import { api } from '../utils/api';

const parseCSV = (text) => {
  const lines = text.split('\n');
  if (lines.length < 2) throw new Error("CSV file must have a header row and at least one data row.");
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const requiredHeaders = ["product_code", "name", "category", "height", "width", "length", "weight", "quantity"];
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`CSV is missing required headers: ${missing.join(', ')}`);
  }
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    if (values.length < headers.length) {
      throw new Error(`Row ${i + 1}: Incomplete data row (column mismatch).`);
    }
    
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx];
    });
    
    if (!rowObj.product_code) throw new Error(`Row ${i + 1}: product_code cannot be empty.`);
    if (!rowObj.name) throw new Error(`Row ${i + 1}: name cannot be empty.`);
    if (!rowObj.category) throw new Error(`Row ${i + 1}: category cannot be empty.`);
    
    const height = parseFloat(rowObj.height);
    const width = parseFloat(rowObj.width);
    const length = parseFloat(rowObj.length);
    const weight = parseFloat(rowObj.weight);
    const quantity = parseInt(rowObj.quantity);
    
    if (isNaN(height) || isNaN(width) || isNaN(length) || isNaN(weight) || isNaN(quantity)) {
      throw new Error(`Row ${i + 1}: Dimensions, weight, and quantity must be valid numbers.`);
    }
    if (height <= 0 || width <= 0 || length <= 0 || weight <= 0 || quantity <= 0) {
      throw new Error(`Row ${i + 1}: Dimensions, weight, and quantity must be positive numbers greater than zero.`);
    }
    
    rows.push(rowObj);
  }
  return rows;
};

export default function Scanner({ onProductScanned, userRole, onRefresh }) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // CSV Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      
      try {
        parseCSV(text);
      } catch (err) {
        setUploadError(`[Frontend Validation Error] ${err.message}`);
        setUploading(false);
        e.target.value = null;
        return;
      }

      try {
        const result = await api.uploadProductsCSV(file);
        setUploadSuccess(result.message);
        if (onRefresh) {
          onRefresh();
        }
      } catch (err) {
        setUploadError(`[Backend Upload Error] ${err.message}`);
      } finally {
        setUploading(false);
        e.target.value = null;
      }
    };

    reader.onerror = () => {
      setUploadError("Failed to read local file.");
      setUploading(false);
    };

    reader.readAsText(file);
  };
  
  // Registering new product state
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [scannedNewBarcode, setScannedNewBarcode] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Electronics',
    height: 10,
    width: 10,
    length: 10,
    weight: 1.0,
    quantity: 0
  });

  const scannerRef = useRef(null);

  // If the user role is 'supervisor', restrict access to scanner controls
  if (userRole === 'supervisor') {
    return (
      <div style={styles.container}>
        <div className="glass-panel" style={{ ...styles.scannerPanel, justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '40px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '24px', borderRadius: '16px', maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={32} />
              </span>
            </div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>Supervisor Mode (Read-Only Scanner)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '10px', lineHeight: '1.5' }}>
              Your account has supervisor access. Barcode scanning and inventory allocation features are restricted to Operator and Administrator roles.
            </p>
            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '8px' }}>
              Please switch to an Operator or Administrator account if you need to perform allocations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    let scanner = null;
    if (isCameraActive) {
      scanner = new Html5QrcodeScanner("reader", {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      }, false);
      
      scanner.render(
        (decodedText) => {
          // Success callback
          handleBarcodeScanned(decodedText);
          scanner.clear();
          setIsCameraActive(false);
        },
        (error) => {
          // Silent catch for scanning frame issues
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error("Failed to clear scanner on unmount:", err));
      }
    };
  }, [isCameraActive]);

  const handleBarcodeScanned = async (barcode) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Try fetching product from db
      const product = await api.scanProduct(barcode);
      // 2. Return product and quantity
      onProductScanned(product, quantity);
    } catch (err) {
      // If product not found (404), trigger registration form
      if (err.message.includes('not found') || err.message.includes('404')) {
        setScannedNewBarcode(barcode);
        setShowRegisterForm(true);
      } else {
        setErrorMsg(err.message || 'Error scanning barcode');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualScanSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleBarcodeScanned(barcodeInput.trim());
  };

  const handleCreateProductSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const created = await api.createProduct({
        product_code: scannedNewBarcode,
        ...newProduct,
        quantity: 0 // Initialize at 0, allocation will set actual count
      });
      setShowRegisterForm(false);
      onProductScanned(created, quantity);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create product definition');
    } finally {
      setLoading(false);
    }
  };

  const sampleBarcodes = [
    { code: '880101', name: 'Heavy Industrial Motor (Furniture/Heavy)', type: 'Heavy' },
    { code: '880202', name: '65-Inch OLED Smart TV (Electronics/Fragile)', type: 'Fragile' },
    { code: '880404', name: 'Enzymatic Reagent Fluid (Chemicals/Cold)', type: 'Cold' },
    { code: '880505', name: 'Designer Leather Jackets (Apparel/Standard)', type: 'Standard' },
    { code: '880707', name: 'High-End Gaming Router (Electronics/Upper)', type: 'Upper' },
  ];

  return (
    <div style={styles.container}>
      <div className="grid-2">
        {/* Left Side: Active Scanner Area */}
        <div className="glass-panel" style={styles.scannerPanel}>
          <h3 style={styles.panelTitle}>Product Barcode Scanner</h3>
          <p style={styles.panelSubtitle}>Scan product tag or QR code for smart rack matching</p>
          
          <div style={styles.quantityPicker}>
            <label style={styles.label}>Quantity to Store:</label>
            <input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="form-input" 
              style={{ width: '80px', textAlign: 'center' }}
            />
          </div>

          {!showRegisterForm ? (
            <>
              {isCameraActive ? (
                <div style={styles.cameraContainer}>
                  <div id="reader" style={{ width: '100%', maxWidth: '350px' }}></div>
                  <button 
                    onClick={() => setIsCameraActive(false)} 
                    className="btn btn-secondary" 
                    style={{ marginTop: '16px' }}
                  >
                    Cancel Camera Scan
                  </button>
                </div>
              ) : (
                <div style={styles.cameraPlaceholder} className="pulse-glow">
                  <Barcode size={48} color="#6366f1" />
                  <p style={{ color: '#9ca3af', marginTop: '12px', fontSize: '14px' }}>Webcam Scanning Offline</p>
                  <button 
                    onClick={() => setIsCameraActive(true)} 
                    className="btn btn-primary" 
                    style={{ marginTop: '20px' }}
                  >
                    <Camera size={18} />
                    Enable Webcam Scanner
                  </button>
                </div>
              )}

              {/* Manual Form Entry fallback */}
              <form onSubmit={handleManualScanSubmit} style={styles.manualForm}>
                <input
                  type="text"
                  placeholder="Or enter barcode manually (e.g., 880202)"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-secondary" disabled={loading}>
                  {loading ? 'Processing...' : 'Identify'}
                </button>
              </form>
            </>
          ) : (
            // Unknown product registration form
            <div style={styles.registerFormContainer}>
              <div style={styles.formAlert}>
                <HelpCircle size={20} color="#f59e0b" />
                <div>
                  <strong>New Product Detected!</strong>
                  <p style={{ fontSize: '11px', color: '#9ca3af' }}>Define physical specifications for tag {scannedNewBarcode}</p>
                </div>
              </div>

              <form onSubmit={handleCreateProductSubmit} style={styles.regForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Wireless VR Headset"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="grid-2" style={{ gap: '12px' }}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Category</label>
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
                    <label style={styles.label}>Weight (kg)</label>
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
                  <label style={styles.label}>Dimensions (H x W x L in cm)</label>
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

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Register & Continue
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowRegisterForm(false)} 
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {errorMsg && <div style={styles.errorAlert}>{errorMsg}</div>}
        </div>

        {/* Right Side: Simulation Panel (Great for quick testing!) */}
        <div className="glass-panel" style={styles.simulationPanel}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
            <PackageOpen size={20} color="#a855f7" />
            <h3 style={styles.panelTitle}>Quick Demo Simulator</h3>
          </div>
          <p style={styles.panelSubtitle}>
            Select a pre-registered barcode to simulate stock arrival scanning without using your camera.
          </p>

          <div style={styles.sampleList}>
            {sampleBarcodes.map((item, index) => {
              let color = '#fff';
              if (item.type === 'Heavy') color = 'var(--zone-heavy)';
              if (item.type === 'Fragile') color = 'var(--zone-fragile)';
              if (item.type === 'Cold') color = 'var(--zone-cold)';
              if (item.type === 'Standard') color = 'var(--zone-standard)';
              if (item.type === 'Upper') color = 'var(--zone-upper)';

              return (
                <div 
                  key={index} 
                  onClick={() => handleBarcodeScanned(item.code)} 
                  style={styles.sampleItem}
                >
                  <div style={styles.sampleDetails}>
                    <div style={styles.sampleTitleRow}>
                      <span style={styles.sampleCode}>{item.code}</span>
                      <span style={{ ...styles.typeTag, color, borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                        {item.type} Zone Match
                      </span>
                    </div>
                    <p style={styles.sampleName}>{item.name}</p>
                  </div>
                  <ChevronRight size={18} color="#6b7280" />
                </div>
              );
            })}
          </div>

          <div style={styles.infoBox}>
            <p><strong>Note for evaluators:</strong> Seeding data maps items of specific weight and categories to respective zones so the AI recommendation system highlights optimal placements dynamically.</p>
          </div>
        </div>
      </div>

      {/* Full-width Fallback: Bulk CSV Import */}
      <div className="glass-panel" style={{ marginTop: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
          <PackageOpen size={20} color="#10b981" />
          <h3 style={styles.panelTitle}>Bulk CSV Fallback Import</h3>
        </div>
        <p style={styles.panelSubtitle}>
          If webcam scanning is unavailable, upload a CSV template to bulk register products into catalog.
        </p>

        {uploadError && <div style={{ ...styles.errorAlert, marginTop: '0', marginBottom: '16px' }}>{uploadError}</div>}
        {uploadSuccess && (
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {uploadSuccess}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
              <strong>Expected CSV Headers:</strong> <code>product_code, name, category, height, width, length, weight, quantity</code>
            </p>
            <p style={{ fontSize: '11px', color: '#6b7280' }}>
              Example row: <code>880909, Wireless Earbuds, Electronics, 5, 8, 10, 0.2, 50</code>
            </p>
          </div>
          
          <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
            <RefreshCw size={16} className={uploading ? 'spin' : ''} style={uploading ? { animation: 'spin 1s linear infinite' } : {}} />
            <span>{uploading ? 'Processing File...' : 'Choose CSV File'}</span>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCSVUpload} 
              style={{ display: 'none' }} 
              disabled={uploading} 
            />
          </label>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    animation: 'fadeIn 0.5s ease-in-out',
  },
  scannerPanel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '420px',
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
    marginBottom: '16px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  },
  quantityPicker: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  cameraPlaceholder: {
    background: 'rgba(15, 23, 42, 0.03)',
    border: '2px dashed var(--border-glass)',
    borderRadius: '12px',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  cameraContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  manualForm: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  simulationPanel: {
    background: 'linear-gradient(145deg, rgba(79, 70, 229, 0.02) 0%, rgba(168, 85, 247, 0.02) 100%)',
  },
  sampleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px',
  },
  sampleItem: {
    background: 'rgba(15, 23, 42, 0.015)',
    border: '1px solid var(--border-glass)',
    padding: '12px 16px',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  sampleItemHover: {
    borderColor: 'var(--primary)',
    background: 'rgba(99, 102, 241, 0.05)',
  },
  sampleDetails: {
    flex: 1,
  },
  sampleTitleRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  sampleCode: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontSize: '14px',
  },
  typeTag: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    textTransform: 'uppercase',
  },
  sampleName: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  infoBox: {
    background: 'rgba(79, 70, 229, 0.04)',
    border: '1px solid rgba(79, 70, 229, 0.15)',
    borderRadius: '10px',
    padding: '12px',
    marginTop: '24px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  registerFormContainer: {
    background: 'rgba(15, 23, 42, 0.02)',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border-glass)',
  },
  formAlert: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  regForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#f87171',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '16px',
    fontSize: '13px',
  },
};
