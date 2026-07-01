import os
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import get_db, Base, engine, SessionLocal
from .models import Product, Rack, StockMovement, AllocationHistory, User
from .schemas import (
    ProductCreate, ProductResponse,
    RackCreate, RackResponse,
    AllocationRequest, AllocationResult, ConfirmAllocationRequest, RackRecommendation,
    DashboardStats, StockMovementResponse,
    UserLoginRequest, UserCreateRequest, UserResponse
)
from .allocation import get_heuristic_recommendations
from .ml_module import ml_manager

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI-Powered Warehouse Stock Inventory Management and Rack Allocation API",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development ease, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to train ML models & seed default users
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        print("Training ML Models on startup...")
        ml_manager.train_models(db)
        
        # Seed default users
        default_users = [
            {"username": "admin", "password": "admin123", "role": "admin", "email": "admin@invento.ai", "contact": "+1-555-0100"},
            {"username": "supervisor", "password": "super123", "role": "supervisor", "email": "supervisor@invento.ai", "contact": "+1-555-0122"},
            {"username": "user", "password": "user123", "role": "user", "email": "operator@invento.ai", "contact": "+1-555-0144"}
        ]
        for u_data in default_users:
            existing = db.query(User).filter(User.username == u_data["username"]).first()
            if not existing:
                new_u = User(
                    username=u_data["username"],
                    password=u_data["password"],
                    role=u_data["role"],
                    email=u_data["email"],
                    contact=u_data["contact"]
                )
                db.add(new_u)
            else:
                existing.email = u_data["email"]
                existing.contact = u_data["contact"]
        db.commit()
        print("Default users seeded successfully with emails/contacts.")
    finally:
        db.close()

# ----------------- Products API -----------------

@app.get("/api/v1/products", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@app.get("/api/v1/products/scan/{barcode}", response_model=ProductResponse)
def scan_product(barcode: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_code == barcode).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode/QR code '{barcode}' not found."
        )
    return product

@app.post("/api/v1/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(Product.product_code == product_in.product_code).first()
    if existing:
        # Update quantity if it already exists
        existing.quantity += product_in.quantity
        db.commit()
        db.refresh(existing)
        return existing
        
    vol = product_in.height * product_in.width * product_in.length
    new_product = Product(
        product_code=product_in.product_code,
        name=product_in.name,
        category=product_in.category,
        height=product_in.height,
        width=product_in.width,
        length=product_in.length,
        weight=product_in.weight,
        volume=vol,
        quantity=product_in.quantity
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@app.delete("/api/v1/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Get all movements to see which racks contain this product
    movements = db.query(StockMovement).filter(StockMovement.product_id == product_id).all()
    rack_qtys = {}
    for m in movements:
        if m.type == "IN":
            rack_qtys[m.rack_id] = rack_qtys.get(m.rack_id, 0) + m.quantity
        elif m.type == "OUT":
            rack_qtys[m.rack_id] = max(0, rack_qtys.get(m.rack_id, 0) - m.quantity)
            
    # Subtract volume and weight from each rack
    prod_vol = product.height * product.width * product.length
    for rack_id, qty in rack_qtys.items():
        if qty > 0:
            rack = db.query(Rack).filter(Rack.id == rack_id).first()
            if rack:
                rack.occupied_volume = max(0.0, rack.occupied_volume - (prod_vol * qty))
                rack.current_weight = max(0.0, rack.current_weight - (product.weight * qty))
                
    # Delete movements, history, and product
    db.query(StockMovement).filter(StockMovement.product_id == product_id).delete()
    db.query(AllocationHistory).filter(AllocationHistory.product_id == product_id).delete()
    db.delete(product)
    db.commit()
    return {"message": f"Successfully removed product '{product.name}' from catalog and racks."}

# ----------------- Racks API -----------------

@app.get("/api/v1/racks", response_model=List[RackResponse])
def get_racks(db: Session = Depends(get_db)):
    return db.query(Rack).all()

@app.get("/api/v1/racks/{rack_id}/products")
def get_rack_products(rack_id: int, db: Session = Depends(get_db)):
    # Reconstruct net quantities of products currently in the rack
    movements = db.query(StockMovement).filter(StockMovement.rack_id == rack_id).all()
    product_qtys = {}
    for m in movements:
        prod_id = m.product_id
        qty = m.quantity
        if m.type == "IN":
            product_qtys[prod_id] = product_qtys.get(prod_id, 0) + qty
        elif m.type == "OUT":
            product_qtys[prod_id] = max(0, product_qtys.get(prod_id, 0) - qty)
            
    results = []
    for prod_id, qty in product_qtys.items():
        if qty > 0:
            product = db.query(Product).filter(Product.id == prod_id).first()
            if product:
                results.append({
                    "product_id": product.id,
                    "product_code": product.product_code,
                    "name": product.name,
                    "category": product.category,
                    "quantity": qty,
                    "weight": round(product.weight * qty, 2),
                    "volume": round(product.volume * qty, 2)
                })
    return results


@app.post("/api/v1/racks", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
def create_rack(rack_in: RackCreate, db: Session = Depends(get_db)):
    existing = db.query(Rack).filter(Rack.code == rack_in.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rack with code '{rack_in.code}' already exists."
        )
    vol = rack_in.height * rack_in.width * rack_in.length
    new_rack = Rack(
        code=rack_in.code,
        height=rack_in.height,
        width=rack_in.width,
        length=rack_in.length,
        max_weight=rack_in.max_weight,
        current_weight=0.0,
        total_volume=vol,
        occupied_volume=0.0,
        zone=rack_in.zone
    )
    db.add(new_rack)
    db.commit()
    db.refresh(new_rack)
    return new_rack

@app.delete("/api/v1/racks/{rack_id}")
def delete_rack(rack_id: int, db: Session = Depends(get_db)):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found.")
    if rack.occupied_volume > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete rack '{rack.code}' — it still has stock allocated. Please remove all stock first."
        )
    # Delete related allocation history and movements before deleting rack
    db.query(AllocationHistory).filter(AllocationHistory.rack_id == rack_id).delete()
    db.query(StockMovement).filter(StockMovement.rack_id == rack_id).delete()
    db.delete(rack)
    db.commit()
    return {"message": f"Rack '{rack.code}' deleted successfully."}



@app.post("/api/v1/allocate", response_model=AllocationResult)
def get_allocation_recommendations(req: AllocationRequest, db: Session = Depends(get_db)):
    # 1. Fetch product
    product = db.query(Product).filter(Product.product_code == req.product_code).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode '{req.product_code}' not found."
        )
        
    # 2. Fetch all racks
    racks = db.query(Rack).all()
    
    # 3. Get heuristic recommendations
    heuristics = get_heuristic_recommendations(product, req.quantity, racks)
    
    # 4. Integrate AI Classifier: Predict the optimal zone for this product
    predicted_zone = ml_manager.predict_best_zone(product, req.quantity)
    
    # Adjust scores based on ML predicted zone
    updated_recommendations = []
    for rec in heuristics:
        rack_obj = db.query(Rack).filter(Rack.id == rec["rack_id"]).first()
        if rec["fits"] and rack_obj:
            source = "HEURISTIC"
            score = rec["score"]
            
            # If the rack zone matches the AI model's recommendation, boost the score and change source to ML
            if rack_obj.zone == predicted_zone:
                score += 15.0  # Apply ML recommendation bonus
                score = min(100.0, round(score, 2))
                source = "ML"
                
            rec["score"] = score
            rec["recommendation_source"] = source
            
        updated_recommendations.append(RackRecommendation(**rec))
        
    # Re-sort list based on fits and score
    updated_recommendations.sort(key=lambda x: (1 if x.fits else 0, x.score), reverse=True)
    
    return AllocationResult(
        product=ProductResponse.from_orm(product),
        recommendations=updated_recommendations
    )

@app.post("/api/v1/allocate/confirm")
def confirm_allocation(req: ConfirmAllocationRequest, db: Session = Depends(get_db)):
    # 1. Fetch product
    product = db.query(Product).filter(Product.product_code == req.product_code).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # 2. Fetch rack
    rack = db.query(Rack).filter(Rack.code == req.rack_code).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
        
    # 3. Calculate additions
    prod_vol = product.height * product.width * product.length
    added_volume = prod_vol * req.quantity
    added_weight = product.weight * req.quantity
    
    # Check fits physically
    if rack.occupied_volume + added_volume > rack.total_volume:
        raise HTTPException(status_code=400, detail="Insufficient rack volume capacity")
        
    if rack.current_weight + added_weight > rack.max_weight:
        raise HTTPException(status_code=400, detail="Insufficient rack weight capacity")
        
    # 4. Perform updates
    rack.occupied_volume += added_volume
    rack.current_weight += added_weight
    
    # Increments product total quantity in database
    product.quantity += req.quantity
    
    # 5. Log Stock movement (IN)
    movement = StockMovement(
        product_id=product.id,
        rack_id=rack.id,
        quantity=req.quantity,
        type="IN",
        notes=f"Stock allocated to rack. Recommended by {req.recommended_by}"
    )
    db.add(movement)
    
    # 6. Log allocation history (for ML model re-training)
    history = AllocationHistory(
        product_id=product.id,
        rack_id=rack.id,
        quantity_allocated=req.quantity,
        recommended_by=req.recommended_by,
        successful=True
    )
    db.add(history)
    
    db.commit()
    
    # Trigger an async or quick model retrain to simulate learning
    try:
        ml_manager.train_models(db)
    except Exception as e:
        print(f"Model retrain failed: {e}")
        
    return {"message": f"Successfully allocated {req.quantity} units to {req.rack_code}"}

# ----------------- Stock Retrieval / Extraction API -----------------

@app.post("/api/v1/inventory/retrieve")
def retrieve_stock(product_code: str, rack_code: str, quantity: int, db: Session = Depends(get_db)):
    # 1. Fetch product & rack
    product = db.query(Product).filter(Product.product_code == product_code).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    rack = db.query(Rack).filter(Rack.code == rack_code).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
        
    # Check if we have enough items in warehouse
    if product.quantity < quantity:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds total product stock")
        
    # Subtract volume and weight from rack occupancy
    prod_vol = product.height * product.width * product.length
    subtracted_volume = prod_vol * quantity
    subtracted_weight = product.weight * quantity
    
    # Avoid negative occupancies
    rack.occupied_volume = max(0.0, rack.occupied_volume - subtracted_volume)
    rack.current_weight = max(0.0, rack.current_weight - subtracted_weight)
    
    # Reduce product stock
    product.quantity = max(0, product.quantity - quantity)
    
    # Log stock movement (OUT)
    movement = StockMovement(
        product_id=product.id,
        rack_id=rack.id,
        quantity=quantity,
        type="OUT",
        notes="Stock retrieved from rack by operator."
    )
    db.add(movement)
    db.commit()
    
    return {"message": f"Successfully retrieved {quantity} units of {product.name} from {rack.code}"}

# ----------------- Dashboard & ML Analytics API -----------------

@app.get("/api/v1/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Count products
    total_products = db.query(Product).count()
    
    # Sum total stock quantity
    total_stock_res = db.query(Product).all()
    total_stock = sum(p.quantity for p in total_stock_res)
    
    # Racks occupied vs total
    racks = db.query(Rack).all()
    total_racks_count = len(racks)
    occupied_racks_count = sum(1 for r in racks if r.occupied_volume > 0.0)
    
    # Capacity utilizations
    total_vol_cap = sum(r.total_volume for r in racks)
    total_vol_occ = sum(r.occupied_volume for r in racks)
    overall_vol_util = (total_vol_occ / total_vol_cap * 100) if total_vol_cap > 0 else 0.0
    
    total_wt_cap = sum(r.max_weight for r in racks)
    total_wt_occ = sum(r.current_weight for r in racks)
    overall_wt_util = (total_wt_occ / total_wt_cap * 100) if total_wt_cap > 0 else 0.0
    
    # Recent movements
    recent_movements = db.query(StockMovement).order_by(StockMovement.timestamp.desc()).limit(8).all()
    
    return DashboardStats(
        total_products=total_products,
        total_stock=total_stock,
        occupied_racks_count=occupied_racks_count,
        total_racks_count=total_racks_count,
        overall_volume_utilization=round(overall_vol_util, 2),
        overall_weight_utilization=round(overall_wt_util, 2),
        recent_movements=recent_movements
    )

@app.get("/api/v1/analytics/future-utilization")
def get_future_utilization(days: int = 7, db: Session = Depends(get_db)):
    racks = db.query(Rack).all()
    total_capacity = sum(r.total_volume for r in racks)
    
    if total_capacity == 0:
        total_capacity = 10000000.0  # Safe fallback
        
    predictions = ml_manager.predict_future_utilization(db, total_capacity, days_ahead=days)
    return {
        "total_volume_capacity": total_capacity,
        "predictions": predictions
    }

# ----------------- Authentication and User Management API -----------------

@app.post("/api/v1/auth/login", response_model=UserResponse)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username.lower()).first()
    if not user or user.password != req.password:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return user

@app.post("/api/v1/auth/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreateRequest, requester_role: str, db: Session = Depends(get_db)):
    if requester_role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can create users.")
    
    existing = db.query(User).filter(User.username == user_in.username.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists.")
        
    new_u = User(
        username=user_in.username.lower(),
        password=user_in.password,
        role=user_in.role,
        email=user_in.email,
        contact=user_in.contact
    )
    db.add(new_u)
    db.commit()
    db.refresh(new_u)
    return new_u

@app.get("/api/v1/auth/users", response_model=List[UserResponse])
def get_users(requester_role: str, db: Session = Depends(get_db)):
    if requester_role == "admin":
        return db.query(User).all()
    elif requester_role == "supervisor":
        return db.query(User).filter(User.role == "user").all()
    else:
        raise HTTPException(status_code=403, detail="Only administrators and supervisors can view user directory.")

@app.delete("/api/v1/auth/users/{user_id}")
def delete_user(user_id: int, requester_role: str, db: Session = Depends(get_db)):
    if requester_role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can delete users.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the default administrator account.")
    db.delete(user)
    db.commit()
    return {"message": f"Successfully deleted user '{user.username}'."}


@app.post("/api/v1/products/upload-csv")
def upload_products_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    import csv
    from io import StringIO
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a CSV file.")
        
    try:
        contents = file.file.read().decode("utf-8")
        csv_reader = csv.DictReader(StringIO(contents))
        
        # Validate headers
        required_headers = {"product_code", "name", "category", "height", "width", "length", "weight", "quantity"}
        if not csv_reader.fieldnames or not required_headers.issubset(set(csv_reader.fieldnames)):
            missing = required_headers - set(csv_reader.fieldnames or [])
            raise ValueError(f"Missing required columns in CSV: {', '.join(missing)}")
            
        products_processed = 0
        for index, row in enumerate(csv_reader, start=1):
            # 1. Missing values check
            for header in required_headers:
                val = row.get(header)
                if val is None or str(val).strip() == "":
                    raise ValueError(f"Row {index}: Column '{header}' cannot be empty.")
            
            product_code = row["product_code"].strip()
            name = row["name"].strip()
            category = row["category"].strip()
            
            # 2. Number type casts and ranges validation
            try:
                height = float(row["height"])
                width = float(row["width"])
                length = float(row["length"])
                weight = float(row["weight"])
                quantity = int(row["quantity"])
            except ValueError:
                raise ValueError(f"Row {index}: Dimensions (height, width, length), weight, and quantity must be valid numbers.")
                
            if height <= 0 or width <= 0 or length <= 0 or weight <= 0 or quantity <= 0:
                raise ValueError(f"Row {index}: Dimensions, weight, and quantity must be positive numbers greater than zero.")
                
            # 3. DB upsert logic
            existing = db.query(Product).filter(Product.product_code == product_code).first()
            if existing:
                existing.quantity += quantity
            else:
                vol = height * width * length
                new_product = Product(
                    product_code=product_code,
                    name=name,
                    category=category,
                    height=height,
                    width=width,
                    length=length,
                    weight=weight,
                    volume=vol,
                    quantity=quantity
                )
                db.add(new_product)
            products_processed += 1
            
        # Commit database transaction only if all rows parsed successfully
        db.commit()
        return {"message": f"Successfully imported {products_processed} products from CSV."}
        
    except ValueError as val_err:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error parsing CSV: {str(e)}")



@app.post("/api/v1/products/upload-allocate")
def upload_products_allocate(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts CSV (.csv) or Excel (.xlsx/.xls) files.
    Required columns: product_code, name, category, height, width, length, weight, quantity
    - Validates ALL required columns are present (reports exactly which are missing).
    - Validates every row field (empty check + numeric check + positive check).
    - Uses all-or-nothing DB transaction: nothing is saved if any row fails.
    - Allocates each product to the best available rack using heuristic + ML scoring.
    """
    import csv
    import io
    from io import StringIO

    # â”€â”€ Step 1: File extension check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    filename = (file.filename or "").strip().lower()
    is_csv   = filename.endswith(".csv")
    is_excel = filename.endswith(".xlsx") or filename.endswith(".xls")

    if not (is_csv or is_excel):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a .csv, .xlsx, or .xls file."
        )

    REQUIRED_COLUMNS = ["product_code", "name", "category", "height", "width", "length", "weight", "quantity"]

    try:
        # â”€â”€ Step 2: Read and parse file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        file_bytes = file.file.read()

        if is_csv:
            try:
                contents = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                contents = file_bytes.decode("latin-1")
            csv_reader  = csv.DictReader(StringIO(contents))
            raw_headers = [h.strip().lower() for h in (csv_reader.fieldnames or [])]
            rows        = [{k.strip().lower(): v for k, v in row.items()} for row in csv_reader]

        else:  # Excel
            try:
                import pandas as pd
            except ImportError:
                raise HTTPException(
                    status_code=500,
                    detail="pandas is not installed on the server. Cannot process Excel files."
                )
            df          = pd.read_excel(io.BytesIO(file_bytes))
            df.columns  = [str(c).strip().lower() for c in df.columns]
            df          = df.fillna("")
            raw_headers = list(df.columns)
            rows        = df.to_dict(orient="records")

        # â”€â”€ Step 3: Column validation â€” report ALL missing columns â”€â”€â”€â”€â”€â”€â”€â”€
        missing_cols = [col for col in REQUIRED_COLUMNS if col not in raw_headers]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Your file is missing {len(missing_cols)} required column(s): "
                    f"{', '.join(missing_cols)}. "
                    f"All required columns are: {', '.join(REQUIRED_COLUMNS)}."
                )
            )

        if not rows:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file has no data rows. Please add at least one product row."
            )

        # ── Step 4: Load racks — auto-create defaults if none exist ──────
        racks = db.query(Rack).all()
        if not racks:
            default_racks = [
                Rack(code="R-A01", zone="Standard",  height=200, width=100, length=80,  max_weight=500,  total_volume=200*100*80),
                Rack(code="R-A02", zone="Standard",  height=200, width=100, length=80,  max_weight=500,  total_volume=200*100*80),
                Rack(code="R-B01", zone="Heavy",     height=150, width=120, length=100, max_weight=2000, total_volume=150*120*100),
                Rack(code="R-B02", zone="Heavy",     height=150, width=120, length=100, max_weight=2000, total_volume=150*120*100),
                Rack(code="R-C01", zone="Fragile",   height=180, width=90,  length=70,  max_weight=200,  total_volume=180*90*70),
                Rack(code="R-C02", zone="Fragile",   height=180, width=90,  length=70,  max_weight=200,  total_volume=180*90*70),
                Rack(code="R-D01", zone="Cold",      height=160, width=80,  length=60,  max_weight=300,  total_volume=160*80*60),
                Rack(code="R-E01", zone="Upper",     height=100, width=100, length=80,  max_weight=150,  total_volume=100*100*80),
            ]
            for rack in default_racks:
                db.add(rack)
            db.flush()
            racks = db.query(Rack).all()

        allocations_report = []
        products_allocated  = 0

        # ── Step 5: Process every row ──────────────────────────────────
        for index, row in enumerate(rows, start=1):
            # 5a. Empty value check for every required column
            for col in REQUIRED_COLUMNS:
                val = row.get(col)
                if val is None or str(val).strip() == "":
                    raise ValueError(f"Row {index}: Column '{col}' is empty. Please provide a value.")

            # 5b. Normalise product_code (pandas reads ints as floats e.g. 880101.0 â†’ "880101")
            raw_pc = row["product_code"]
            if isinstance(raw_pc, float) and raw_pc == int(raw_pc):
                product_code = str(int(raw_pc))
            else:
                product_code = str(raw_pc).strip()
                if product_code.endswith(".0"):
                    try:
                        product_code = str(int(float(product_code)))
                    except ValueError:
                        pass

            if not product_code:
                raise ValueError(f"Row {index}: 'product_code' cannot be empty.")

            name     = str(row["name"]).strip()
            category = str(row["category"]).strip()

            if not name:
                raise ValueError(f"Row {index}: 'name' cannot be empty.")
            if not category:
                raise ValueError(f"Row {index}: 'category' cannot be empty.")

            # 5c. Numeric validation
            try:
                height   = float(row["height"])
                width    = float(row["width"])
                length   = float(row["length"])
                weight   = float(row["weight"])
                qty_raw  = row["quantity"]
                quantity = int(float(qty_raw)) if isinstance(qty_raw, str) else int(qty_raw)
            except (ValueError, TypeError):
                raise ValueError(
                    f"Row {index}: 'height', 'width', 'length', 'weight', and 'quantity' must be valid numbers. "
                    f"Got height={row.get('height')}, width={row.get('width')}, "
                    f"length={row.get('length')}, weight={row.get('weight')}, quantity={row.get('quantity')}."
                )

            if height <= 0 or width <= 0 or length <= 0:
                raise ValueError(f"Row {index}: 'height', 'width', and 'length' must all be greater than 0.")
            if weight <= 0:
                raise ValueError(f"Row {index}: 'weight' must be greater than 0.")
            if quantity <= 0:
                raise ValueError(f"Row {index}: 'quantity' must be a positive integer greater than 0.")

            # 5d. Upsert product
            product = db.query(Product).filter(Product.product_code == product_code).first()
            if not product:
                product = Product(
                    product_code=product_code,
                    name=name,
                    category=category,
                    height=height,
                    width=width,
                    length=length,
                    weight=weight,
                    volume=height * width * length,
                    quantity=0
                )
                db.add(product)
                db.flush()  # Assign product.id before creating movements

            # 5e. Find best rack (heuristic + ML)
            heuristics     = get_heuristic_recommendations(product, quantity, racks)
            predicted_zone = ml_manager.predict_best_zone(product, quantity)

            compatible = []
            for rec in heuristics:
                if rec["fits"]:
                    rack_obj = next((r for r in racks if r.id == rec["rack_id"]), None)
                    if rack_obj:
                        score  = rec["score"]
                        source = "HEURISTIC"
                        if rack_obj.zone == predicted_zone:
                            score  = min(100.0, round(score + 15.0, 2))
                            source = "ML"
                        compatible.append({"rack_obj": rack_obj, "score": score, "source": source})

            if not compatible:
                raise ValueError(
                    f"Row {index}: Product '{name}' (qty={quantity}) does not fit in any rack. "
                    f"All racks are full or too small. Add more racks or reduce quantity."
                )

            best        = max(compatible, key=lambda x: x["score"])
            best_rack   = best["rack_obj"]
            best_source = best["source"]
            best_score  = best["score"]

            # 5f. Apply allocation to rack and product
            prod_vol = product.height * product.width * product.length
            best_rack.occupied_volume += prod_vol * quantity
            best_rack.current_weight  += product.weight * quantity
            product.quantity          += quantity

            db.add(StockMovement(
                product_id=product.id,
                rack_id=best_rack.id,
                quantity=quantity,
                type="IN",
                notes=f"Bulk file allocation. Source: {best_source} (score {best_score}%)"
            ))
            db.add(AllocationHistory(
                product_id=product.id,
                rack_id=best_rack.id,
                quantity_allocated=quantity,
                recommended_by=best_source,
                successful=True
            ))

            allocations_report.append(
                f"Row {index}: {quantity} x '{name}' â†’ Rack '{best_rack.code}' [{best_source}]"
            )
            products_allocated += 1

        # â”€â”€ Step 6: All-or-nothing commit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        db.commit()

        return {
            "message": (
                f"Successfully allocated {products_allocated} product(s) from uploaded file.\n"
                + "\n".join(allocations_report)
            )
        }

    except HTTPException:
        db.rollback()
        raise  # Re-raise FastAPI HTTP errors as-is
    except ValueError as val_err:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {str(e)}")
