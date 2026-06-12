import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Rack(Base):
    __tablename__ = "racks"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    height = Column(Float, nullable=False)  # in cm
    width = Column(Float, nullable=False)   # in cm
    length = Column(Float, nullable=False)  # in cm
    max_weight = Column(Float, nullable=False)  # in kg
    current_weight = Column(Float, default=0.0)  # in kg
    total_volume = Column(Float, nullable=False)  # in cm³
    occupied_volume = Column(Float, default=0.0)  # in cm³
    zone = Column(String(50), default="Standard")  # e.g., Heavy, Fragile, Cold, Standard

    # Relationships
    movements = relationship("StockMovement", back_populates="rack")
    allocations = relationship("AllocationHistory", back_populates="rack")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(100), unique=True, index=True, nullable=False)  # Barcode / QR Code
    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    height = Column(Float, nullable=False)  # in cm
    width = Column(Float, nullable=False)   # in cm
    length = Column(Float, nullable=False)  # in cm
    weight = Column(Float, nullable=False)  # in kg
    volume = Column(Float, nullable=False)  # in cm³
    quantity = Column(Integer, default=0)

    # Relationships
    movements = relationship("StockMovement", back_populates="product")
    allocations = relationship("AllocationHistory", back_populates="product")

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    rack_id = Column(Integer, ForeignKey("racks.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    type = Column(String(20), nullable=False)  # "IN" (Arrival), "OUT" (Retrieval), "TRANSFER"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    notes = Column(String(255), nullable=True)

    # Relationships
    product = relationship("Product", back_populates="movements")
    rack = relationship("Rack", back_populates="movements")

class AllocationHistory(Base):
    __tablename__ = "allocation_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    rack_id = Column(Integer, ForeignKey("racks.id"), nullable=False)
    quantity_allocated = Column(Integer, nullable=False)
    recommended_by = Column(String(50), default="HEURISTIC")  # "HEURISTIC" or "ML"
    successful = Column(Boolean, default=True)  # True if operator accepted recommendation
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="allocations")
    rack = relationship("Rack", back_populates="allocations")
