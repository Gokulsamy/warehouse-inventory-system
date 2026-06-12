import datetime
import random
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.models import Rack, Product, StockMovement, AllocationHistory

def seed_database():
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed Racks if empty
        if db.query(Rack).count() == 0:
            print("Seeding racks...")
            racks_data = [
                # Heavy Zone (Bottom racks) - H x W x L (cm), Max Weight (kg)
                {"code": "RACK-A1", "height": 180.0, "width": 200.0, "length": 300.0, "max_weight": 2000.0, "zone": "Heavy"},
                {"code": "RACK-A2", "height": 180.0, "width": 200.0, "length": 300.0, "max_weight": 2000.0, "zone": "Heavy"},
                {"code": "RACK-A3", "height": 180.0, "width": 200.0, "length": 300.0, "max_weight": 2000.0, "zone": "Heavy"},
                
                # Fragile Zone (Middle racks, sensitive)
                {"code": "RACK-B1", "height": 100.0, "width": 120.0, "length": 150.0, "max_weight": 350.0, "zone": "Fragile"},
                {"code": "RACK-B2", "height": 100.0, "width": 120.0, "length": 150.0, "max_weight": 350.0, "zone": "Fragile"},
                {"code": "RACK-B3", "height": 100.0, "width": 120.0, "length": 150.0, "max_weight": 350.0, "zone": "Fragile"},
                
                # Cold Zone (Refrigerated)
                {"code": "RACK-C1", "height": 120.0, "width": 150.0, "length": 200.0, "max_weight": 800.0, "zone": "Cold"},
                {"code": "RACK-C2", "height": 120.0, "width": 150.0, "length": 200.0, "max_weight": 800.0, "zone": "Cold"},
                
                # Standard Zone (General cargo)
                {"code": "RACK-D1", "height": 150.0, "width": 160.0, "length": 220.0, "max_weight": 1000.0, "zone": "Standard"},
                {"code": "RACK-D2", "height": 150.0, "width": 160.0, "length": 220.0, "max_weight": 1000.0, "zone": "Standard"},
                {"code": "RACK-D3", "height": 150.0, "width": 160.0, "length": 220.0, "max_weight": 1000.0, "zone": "Standard"},
                
                # Upper Zone (Top racks, light items only)
                {"code": "RACK-E1", "height": 80.0, "width": 90.0, "length": 120.0, "max_weight": 150.0, "zone": "Upper"},
                {"code": "RACK-E2", "height": 80.0, "width": 90.0, "length": 120.0, "max_weight": 150.0, "zone": "Upper"},
                {"code": "RACK-E3", "height": 80.0, "width": 90.0, "length": 120.0, "max_weight": 150.0, "zone": "Upper"},
            ]
            for r_info in racks_data:
                # Calculate total volume (H * W * L)
                tot_vol = r_info["height"] * r_info["width"] * r_info["length"]
                rack = Rack(
                    code=r_info["code"],
                    height=r_info["height"],
                    width=r_info["width"],
                    length=r_info["length"],
                    max_weight=r_info["max_weight"],
                    current_weight=0.0,
                    total_volume=tot_vol,
                    occupied_volume=0.0,
                    zone=r_info["zone"]
                )
                db.add(rack)
            db.commit()
            print("Racks seeded.")

        # 2. Seed Products if empty
        if db.query(Product).count() == 0:
            print("Seeding products...")
            products_data = [
                {"product_code": "880101", "name": "Heavy Industrial Motor", "category": "Furniture", "height": 80.0, "width": 80.0, "length": 100.0, "weight": 250.0, "quantity": 5},
                {"product_code": "880202", "name": "65-Inch OLED Smart TV", "category": "Electronics", "height": 90.0, "width": 15.0, "length": 145.0, "weight": 22.0, "quantity": 12},
                {"product_code": "880303", "name": "Solid Oak Dining Table", "category": "Furniture", "height": 75.0, "width": 90.0, "length": 180.0, "weight": 65.0, "quantity": 8},
                {"product_code": "880404", "name": "Enzymatic Reagent Fluid", "category": "Chemicals", "height": 30.0, "width": 30.0, "length": 40.0, "weight": 12.0, "quantity": 25},
                {"product_code": "880505", "name": "Designer Leather Jackets", "category": "Apparel", "height": 10.0, "width": 40.0, "length": 60.0, "weight": 1.8, "quantity": 45},
                {"product_code": "880606", "name": "Organic Tomato Paste Box", "category": "Food", "height": 25.0, "width": 30.0, "length": 40.0, "weight": 8.5, "quantity": 60},
                {"product_code": "880707", "name": "High-End Gaming Router", "category": "Electronics", "height": 15.0, "width": 20.0, "length": 25.0, "weight": 1.2, "quantity": 30},
                {"product_code": "880808", "name": "Heavy Gym Kettlebell Pack", "category": "Other", "height": 30.0, "width": 30.0, "length": 35.0, "weight": 32.0, "quantity": 15},
            ]
            for p_info in products_data:
                vol = p_info["height"] * p_info["width"] * p_info["length"]
                prod = Product(
                    product_code=p_info["product_code"],
                    name=p_info["name"],
                    category=p_info["category"],
                    height=p_info["height"],
                    width=p_info["width"],
                    length=p_info["length"],
                    weight=p_info["weight"],
                    volume=vol,
                    quantity=p_info["quantity"]
                )
                db.add(prod)
            db.commit()
            print("Products seeded.")

        # 3. Seed Allocation History & Current Occupancies if empty
        if db.query(AllocationHistory).count() == 0:
            print("Simulating historical stock transactions...")
            racks = db.query(Rack).all()
            products = db.query(Product).all()
            
            # Map racks by zone for historical correctness
            racks_by_zone = {}
            for r in racks:
                racks_by_zone.setdefault(r.zone, []).append(r)
                
            # Create a 60-day historical timeline
            start_date = datetime.datetime.utcnow() - datetime.timedelta(days=60)
            
            for i in range(120): # 120 simulated movements
                days_ago = random.randint(1, 59)
                tx_date = start_date + datetime.timedelta(days=days_ago)
                
                product = random.choice(products)
                qty = random.randint(1, 4)
                
                # Determine appropriate zone matching our ML logic
                if product.weight > 20.0:
                    preferred_zone = "Heavy"
                elif product.category == "Chemicals":
                    preferred_zone = "Cold"
                elif product.category == "Electronics":
                    preferred_zone = "Fragile"
                elif product.weight < 5.0 and (product.height*product.width*product.length) < 15000:
                    preferred_zone = "Upper"
                else:
                    preferred_zone = "Standard"
                    
                target_racks = racks_by_zone.get(preferred_zone, racks_by_zone.get("Standard"))
                rack = random.choice(target_racks)
                
                # Double-check capacity and dimensions
                p_vol = product.height * product.width * product.length * qty
                p_wt = product.weight * qty
                
                if (rack.occupied_volume + p_vol <= rack.total_volume) and (rack.current_weight + p_wt <= rack.max_weight):
                    # Record history
                    hist = AllocationHistory(
                        product_id=product.id,
                        rack_id=rack.id,
                        quantity_allocated=qty,
                        recommended_by="ML" if random.random() > 0.4 else "HEURISTIC",
                        successful=True,
                        timestamp=tx_date
                    )
                    
                    # Record movement
                    movement = StockMovement(
                        product_id=product.id,
                        rack_id=rack.id,
                        quantity=qty,
                        type="IN",
                        timestamp=tx_date,
                        notes=f"Seeded historical stock arrival."
                    )
                    db.add(hist)
                    db.add(movement)
                    
                    # Update rack current states for simulated actual stock
                    # Only do this for about 40% of operations to leave space in racks
                    if random.random() > 0.6:
                        rack.occupied_volume += p_vol
                        rack.current_weight += p_wt
                        
            db.commit()
            print("Simulated transaction logs and occupancy states created.")
            
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
