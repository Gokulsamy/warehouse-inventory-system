const API_BASE_URL = 'http://localhost:8000/api/v1';

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export const api = {
  // Fetch overall statistics
  async getDashboardStats() {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats`);
    return handleResponse(res);
  },

  // Fetch list of racks
  async getRacks() {
    const res = await fetch(`${API_BASE_URL}/racks`);
    return handleResponse(res);
  },

  // Add a new rack layout
  async createRack(rackData) {
    const res = await fetch(`${API_BASE_URL}/racks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rackData)
    });
    return handleResponse(res);
  },

  // Fetch product list
  async getProducts() {
    const res = await fetch(`${API_BASE_URL}/products`);
    return handleResponse(res);
  },

  // Create or add stock of product
  async createProduct(productData) {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return handleResponse(res);
  },

  // Scan product barcode
  async scanProduct(barcode) {
    const res = await fetch(`${API_BASE_URL}/products/scan/${barcode}`);
    return handleResponse(res);
  },

  // Get ranked rack recommendations (heuristics + ML zone)
  async getAllocationRecommendations(productCode, quantity) {
    const res = await fetch(`${API_BASE_URL}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_code: productCode, quantity: parseInt(quantity) })
    });
    return handleResponse(res);
  },

  // Confirm product allocation into rack
  async confirmAllocation(productCode, rackCode, quantity, recommendedBy) {
    const res = await fetch(`${API_BASE_URL}/allocate/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_code: productCode,
        rack_code: rackCode,
        quantity: parseInt(quantity),
        recommended_by: recommendedBy
      })
    });
    return handleResponse(res);
  },

  // Retrieve/extract stock from rack
  async retrieveStock(productCode, rackCode, quantity) {
    const res = await fetch(`${API_BASE_URL}/inventory/retrieve?product_code=${productCode}&rack_code=${rack_code}&quantity=${parseInt(quantity)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return handleResponse(res);
  },

  // Fetch ML 7-day space utilization projections
  async getFutureUtilization(days = 7) {
    const res = await fetch(`${API_BASE_URL}/analytics/future-utilization?days=${days}`);
    return handleResponse(res);
  }
};
