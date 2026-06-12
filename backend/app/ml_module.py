import datetime
import math
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from .models import Product, Rack, StockMovement, AllocationHistory

class PurePythonKNNClassifier:
    """
    Pure Python K-Nearest Neighbors Classifier with Z-Score normalization.
    """
    def __init__(self, k: int = 5):
        self.k = k
        self.X_train: List[Dict[str, Any]] = []
        self.y_train: List[str] = []
        self.means: Dict[str, float] = {}
        self.stds: Dict[str, float] = {}

    def fit(self, features: List[Dict[str, Any]], targets: List[str]):
        self.X_train = features
        self.y_train = targets

        if not features:
            return

        # Calculate mean and std for each numerical key
        keys = ["weight", "volume", "height", "width", "length"]
        n = len(features)
        
        for key in keys:
            vals = [item[key] for item in features]
            mean = sum(vals) / n
            var = sum((x - mean) ** 2 for x in vals) / n
            std = math.sqrt(var)
            
            self.means[key] = mean
            self.stds[key] = std if std > 1e-5 else 1.0 # Avoid division by zero

    def _calculate_distance(self, p1: Dict[str, Any], p2: Dict[str, Any]) -> float:
        dist_sq = 0.0
        for key in ["weight", "volume", "height", "width", "length"]:
            mean = self.means.get(key, 0.0)
            std = self.stds.get(key, 1.0)
            v1 = (p1[key] - mean) / std
            v2 = (p2[key] - mean) / std
            dist_sq += (v1 - v2) ** 2
            
        # Category distance (weight category mismatch heavily)
        d_cat = 0.0 if p1["category"] == p2["category"] else 1.5
        dist_sq += d_cat ** 2
        
        return math.sqrt(dist_sq)

    def predict(self, x: Dict[str, Any]) -> str:
        if not self.X_train:
            return "Standard"
            
        # Compute distances
        distances = []
        for train_x, train_y in zip(self.X_train, self.y_train):
            dist = self._calculate_distance(x, train_x)
            distances.append((dist, train_y))
            
        distances.sort(key=lambda item: item[0])
        top_k_labels = [label for _, label in distances[:self.k]]
        
        votes = {}
        for label in top_k_labels:
            votes[label] = votes.get(label, 0) + 1
            
        sorted_votes = sorted(votes.items(), key=lambda item: item[1], reverse=True)
        return sorted_votes[0][0]


def solve_linear_system(A: List[List[float]], B: List[float]) -> List[float]:
    """
    Solves a system of linear equations A * x = B using Gaussian elimination.
    """
    n = len(B)
    M = [A[i] + [B[i]] for i in range(n)]
    
    for i in range(n):
        pivot_row = i
        for r in range(i + 1, n):
            if abs(M[r][i]) > abs(M[pivot_row][i]):
                pivot_row = r
        M[i], M[pivot_row] = M[pivot_row], M[i]
        
        pivot = M[i][i]
        if abs(pivot) < 1e-9:
            continue
        for c in range(i, n + 1):
            M[i][c] /= pivot
            
        for r in range(n):
            if r != i:
                factor = M[r][i]
                for c in range(i, n + 1):
                    M[r][c] -= factor * M[i][c]
                    
    return [M[i][n] for i in range(n)]


class PurePythonHarmonicRegression:
    """
    Pure Python Multiple Linear Regression with weekly seasonality harmonic wave modeling:
    y = beta_0 + beta_1 * t + beta_2 * sin(2*pi*t/7) + beta_3 * cos(2*pi*t/7)
    Uses OLS solved via Gaussian Elimination.
    """
    def __init__(self):
        self.coefficients: List[float] = [0.0, 0.0, 0.0, 0.0]
        self.trained: bool = False

    def fit(self, t: List[float], y: List[float]):
        n = len(t)
        if n < 4:
            mean_y = sum(y) / max(1, n)
            self.coefficients = [mean_y, 0.0, 0.0, 0.0]
            self.trained = True
            return

        A = [[0.0] * 4 for _ in range(4)]
        B = [0.0] * 4

        for ti, yi in zip(t, y):
            x = [
                1.0,
                ti,
                math.sin(2 * math.pi * ti / 7.0),
                math.cos(2 * math.pi * ti / 7.0)
            ]
            for r in range(4):
                for c in range(4):
                    A[r][c] += x[r] * x[c]
                B[r] += x[r] * yi

        try:
            self.coefficients = solve_linear_system(A, B)
            self.trained = True
        except Exception:
            mean_y = sum(y) / n
            self.coefficients = [mean_y, 0.0, 0.0, 0.0]
            self.trained = True

    def predict(self, t_val: float) -> float:
        intercept, trend, sin_coeff, cos_coeff = self.coefficients
        return (
            intercept +
            (trend * t_val) +
            (sin_coeff * math.sin(2 * math.pi * t_val / 7.0)) +
            (cos_coeff * math.cos(2 * math.pi * t_val / 7.0))
        )


class WarehouseMLManager:
    def __init__(self):
        self.zone_classifier = PurePythonKNNClassifier(k=5)
        self.utilization_regressor = PurePythonHarmonicRegression()
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
