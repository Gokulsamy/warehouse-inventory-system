import re
from pydantic import BaseModel, ConfigDict, field_validator
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

# User Schemas
class UserLoginRequest(BaseModel):
    username: str
    password: str

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str
    email: Optional[str] = None
    contact: Optional[str] = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        username = v.strip()
        if len(username) < 3 or len(username) > 20:
            raise ValueError("Username must be between 3 and 20 characters.")
        if not re.match(r"^[a-zA-Z0-9_]+$", username):
            raise ValueError("Username can only contain letters, numbers, and underscores.")
        return username

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters long.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if not v or v.strip() == "":
            return None
        email = v.strip()
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
            raise ValueError("Please enter a valid email address.")
        return email

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, v: Optional[str]) -> Optional[str]:
        if not v or v.strip() == "":
            return None
        contact = v.strip()
        if not re.match(r"^\+?[\d\s\-()]+$", contact):
            raise ValueError("Phone number can only contain digits, spaces, hyphens, parentheses, and an optional leading +.")
        digits = re.sub(r"\D", "", contact)
        if len(digits) < 7 or len(digits) > 15:
            raise ValueError("Phone number must contain between 7 and 15 digits.")
        return contact

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    email: Optional[str] = None
    contact: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
