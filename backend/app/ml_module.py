import datetime
import math
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from .models import Product, Rack, StockMovement, AllocationHistory

class PurePythonKNNClassifier:
    """
    Pure Python K-Nearest Neighbors Classifier.
    Requires no external C/C++ compilation.
    """
    def __init__(self, k: int = 5):
        self.k = k
        self.X_train: List[Dict[str, Any]] = []
        self.y_train: List[str] = []

    def fit(self, features: List[Dict[str, Any]], targets: List[str]):
        self.X_train = features
        self.y_train = targets

    def _calculate_distance(self, p1: Dict[str, Any], p2: Dict[str, Any]) -> float:
        # Features: weight, volume, height, width, length, category_match
        # Normalize features roughly to ensure balanced distance weights
        d_weight = (p1["weight"] - p2["weight"]) / 50.0
        d_volume = (p1["volume"] - p2["volume"]) / 1000000.0
        d_height = (p1["height"] - p2["height"]) / 200.0
        d_width = (p1["width"] - p2["width"]) / 200.0
        d_length = (p1["length"] - p2["length"]) / 300.0
        
        # Category distance: 0 if same, 1 if different
        d_cat = 0.0 if p1["category"] == p2["category"] else 1.0
        
        return math.sqrt(
            d_weight**2 + 
            d_volume**2 + 
            d_height**2 + 
            d_width**2 + 
            d_length**2 + 
            d_cat**2
        )

    def predict(self, x: Dict[str, Any]) -> str:
        if not self.X_train:
            return "Standard"
            
        # Compute distances to all training points
        distances = []
        for train_x, train_y in zip(self.X_train, self.y_train):
            dist = self._calculate_distance(x, train_x)
            distances.append((dist, train_y))
            
        # Sort by distance
        distances.sort(key=lambda item: item[0])
        
        # Get labels of top K
        top_k_labels = [label for _, label in distances[:self.k]]
        
        # Find majority vote
        votes = {}
        for label in top_k_labels:
            votes[label] = votes.get(label, 0) + 1
            
        sorted_votes = sorted(votes.items(), key=lambda item: item[1], reverse=True)
        return sorted_votes[0][0]


class PurePythonLinearRegression:
    """
    Pure Python Simple Linear Regression (y = m * x + c).
    Uses Ordinary Least Squares (OLS).
    """
    def __init__(self):
        self.slope: float = 0.0
        self.intercept: float = 0.0

    def fit(self, x: List[float], y: List[float]):
        n = len(x)
        if n < 2:
            # Fallback if too few data points
            self.slope = 0.0
            self.intercept = sum(y) / max(1, n)
            return

        mean_x = sum(x) / n
        mean_y = sum(y) / n

        numerator = 0.0
        denominator = 0.0
        for xi, yi in zip(x, y):
            numerator += (xi - mean_x) * (yi - mean_y)
            denominator += (xi - mean_x) ** 2

        if denominator == 0:
            self.slope = 0.0
            self.intercept = mean_y
        else:
            self.slope = numerator / denominator
            self.intercept = mean_y - (self.slope * mean_x)

    def predict(self, x_val: float) -> float:
        return (self.slope * x_val) + self.intercept


class WarehouseMLManager:
    def __init__(self):
        self.zone_classifier = PurePythonKNNClassifier(k=5)
        self.utilization_regressor = PurePythonLinearRegression()
        self.is_classifier_trained = False
        self.is_regressor_trained = False
        
    def generate_mock_training_data(self) -> Tuple[List[Dict[str, Any]], List[str], List[float], List[float]]:
        """
        Generates structured historical training records for seed training.
        """
        import random
        random.seed(42)
        
        categories = ["Electronics", "Furniture", "Apparel", "Food", "Chemicals", "Other"]
        
        features = []
        targets = []
        
        # Generate 150 mock product allocation records
        for _ in range(150):
            weight = random.uniform(0.5, 45.0)
            height = random.uniform(5.0, 100.0)
            width = random.uniform(5.0, 100.0)
            length = random.uniform(5.0, 100.0)
            volume = height * width * length
            cat = random.choice(categories)
            
            # Label assignments representing training patterns
            if weight > 20.0:
                zone = "Heavy"
            elif cat == "Chemicals":
                zone = "Cold"
            elif cat == "Electronics":
                zone = "Fragile"
            elif weight < 5.0 and volume < 15000:
                zone = "Upper"
            else:
                zone = "Standard"
                
            features.append({
                "weight": weight,
                "volume": volume,
                "height": height,
                "width": width,
                "length": length,
                "category": cat
            })
            targets.append(zone)

        # Regressor data: past 60 days
        days = list(range(60))
        volume_trend = []
        for d in days:
            # Base growth + weekly fluctuations + noise
            growth = d * 12500
            weekly_noise = math.sin(d * (2 * math.pi / 7)) * 80000
            random_noise = random.uniform(-30000, 30000)
            volume = 1500000 + growth + weekly_noise + random_noise
            volume_trend.append(volume)

        return features, targets, days, volume_trend

    def train_models(self, db: Session = None):
        """
        Train ML models using database records if available, else use mock data.
        """
        has_history = False
        if db:
            hist_count = db.query(AllocationHistory).count()
            mov_count = db.query(StockMovement).count()
            if hist_count > 30 and mov_count > 20:
                has_history = True
                
        if not has_history:
            # Train with generated mock values
            features, targets, days, volume_trend = self.generate_mock_training_data()
        else:
            # Retrieve real allocation histories
            histories = db.query(AllocationHistory).all()
            features = []
            targets = []
            for h in histories:
                if h.successful and h.product and h.rack:
                    features.append({
                        "weight": h.product.weight,
                        "volume": h.product.volume,
                        "height": h.product.height,
                        "width": h.product.width,
                        "length": h.product.length,
                        "category": h.product.category
                    })
                    targets.append(h.rack.zone)
                    
            # Fallback if parsing issues
            if not features:
                features, targets, _, _ = self.generate_mock_training_data()

            # Retrieve movements for regression
            movements = db.query(StockMovement).order_by(StockMovement.timestamp).all()
            
            # Map occupied volume backwards in time
            racks = db.query(Rack).all()
            total_current_occupied = sum(r.occupied_volume for r in racks)
            
            running_volume = total_current_occupied
            date_map = {}
            
            # Process in reverse
            for m in reversed(movements):
                date_str = m.timestamp.date()
                date_map[date_str] = date_map.get(date_str, []) + [running_volume]
                
                prod_vol = m.product.volume if m.product else 0
                change = prod_vol * m.quantity
                if m.type == "IN":
                    running_volume -= change
                elif m.type == "OUT":
                    running_volume += change
            
            if len(date_map) >= 5:
                sorted_dates = sorted(date_map.keys())
                min_date = sorted_dates[0]
                
                days = []
                volume_trend = []
                for dt in sorted_dates:
                    day_idx = (dt - min_date).days
                    avg_vol = sum(date_map[dt]) / len(date_map[dt])
                    days.append(float(day_idx))
                    volume_trend.append(avg_vol)
            else:
                _, _, days, volume_trend = self.generate_mock_training_data()

        # 1. Fit KNN zone classifier
        self.zone_classifier.fit(features, targets)
        self.is_classifier_trained = True
        
        # 2. Fit OLS linear regression
        self.utilization_regressor.fit([float(d) for d in days], volume_trend)
        self.is_regressor_trained = True
        
        print(f"ML models successfully trained. Data points used: {len(features)} classifier, {len(days)} regressor.")

    def predict_best_zone(self, product: Product, quantity: int) -> str:
        """
        Predicts optimal Rack Zone for the product using custom KNN classifier.
        """
        if not self.is_classifier_trained:
            self.train_models()
            
        prod_vol = product.height * product.width * product.length
        
        x = {
            "weight": product.weight,
            "volume": prod_vol,
            "height": product.height,
            "width": product.width,
            "length": product.length,
            "category": product.category
        }
        
        return self.zone_classifier.predict(x)

    def predict_future_utilization(self, db: Session, total_capacity: float, days_ahead: int = 7) -> List[Dict[str, Any]]:
        """
        Forecasts daily warehouse occupied volume and utilization % for the next N days.
        """
        if not self.is_regressor_trained:
            self.train_models(db)
            
        # Find latest day index from database
        latest_day_index = 60.0 # Standard training offset
        
        # Let's count days dynamically if movements exist
        movements = db.query(StockMovement).order_by(StockMovement.timestamp).all()
        if len(movements) >= 10:
            first_mov = movements[0].timestamp.date()
            last_mov = movements[-1].timestamp.date()
            latest_day_index = float((last_mov - first_mov).days)
            
        predictions = []
        current_time = datetime.datetime.utcnow()
        
        for i in range(1, days_ahead + 1):
            target_day = latest_day_index + float(i)
            pred_vol = self.utilization_regressor.predict(target_day)
            
            # Cap predictions between empty and full warehouse
            pred_vol = max(0.0, min(total_capacity, pred_vol))
            util_pct = (pred_vol / total_capacity) * 100 if total_capacity > 0 else 0.0
            
            pred_date = current_time + datetime.timedelta(days=i)
            predictions.append({
                "date": pred_date.strftime("%Y-%m-%d"),
                "predicted_occupied_volume": round(pred_vol, 2),
                "predicted_utilization_percentage": round(util_pct, 2)
            })
            
        return predictions

# Singleton instance of ML Manager
ml_manager = WarehouseMLManager()
