from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

# Product Schemas
class ProductBase(BaseModel):
    product_code: str
    name: str
    category: str
    height: float
    width: float
    length: float
    weight: float
    quantity: int

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    volume: float

    model_config = ConfigDict(from_attributes=True)

# Rack Schemas
class RackBase(BaseModel):
    code: str
    height: float
    width: float
    length: float
    max_weight: float
    zone: str

class RackCreate(RackBase):
    pass

class RackResponse(RackBase):
    id: int
    current_weight: float
    total_volume: float
    occupied_volume: float

    model_config = ConfigDict(from_attributes=True)

# Allocation Schemas
class AllocationRequest(BaseModel):
    product_code: str
    quantity: int

class RackRecommendation(BaseModel):
    rack_id: int
    rack_code: str
    fits: bool
    reason: str
    max_quantity_fit: int
    utilization_percentage: float
    weight_after_allocation: float
    volume_after_allocation: float
    score: float  # Compatibility score (higher is better)
    recommendation_source: str  # "HEURISTIC" or "ML"

class AllocationResult(BaseModel):
    product: ProductResponse
    recommendations: List[RackRecommendation]

class ConfirmAllocationRequest(BaseModel):
    product_code: str
    rack_code: str
    quantity: int
    recommended_by: str  # "HEURISTIC" or "ML"

# Stock Movement Schemas
class StockMovementBase(BaseModel):
    product_id: int
    rack_id: Optional[int] = None
    quantity: int
    type: str  # "IN", "OUT", "TRANSFER"
    notes: Optional[str] = None

class StockMovementResponse(StockMovementBase):
    id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

# Dashboard & Analytics Schemas
class DashboardStats(BaseModel):
    total_products: int
    total_stock: int
    occupied_racks_count: int
    total_racks_count: int
    overall_volume_utilization: float  # Percentage
    overall_weight_utilization: float  # Percentage
    recent_movements: List[StockMovementResponse]
