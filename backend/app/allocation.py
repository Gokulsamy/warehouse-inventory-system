from typing import List, Dict, Any, Tuple
from .models import Rack, Product

def check_3d_fit(prod_h: float, prod_w: float, prod_l: float, rack_h: float, rack_w: float, rack_l: float) -> bool:
    """
    Checks if a single product can physically fit within the rack dimensions.
    Considers all 6 possible 3D rotations of the product.
    """
    p_dims = [prod_h, prod_w, prod_l]
    r_dims = [rack_h, rack_w, rack_l]
    
    # Try all permutations of product dimensions
    import itertools
    for p_perm in itertools.permutations(p_dims):
        if p_perm[0] <= r_dims[0] and p_perm[1] <= r_dims[1] and p_perm[2] <= r_dims[2]:
            return True
    return False

def calculate_max_units(prod_h: float, prod_w: float, prod_l: float, rack_h: float, rack_w: float, rack_l: float) -> int:
    """
    Calculates the absolute maximum number of units that can fit in an empty rack,
    considering physical stacking orientations.
    """
    p_dims = [prod_h, prod_w, prod_l]
    r_dims = [rack_h, rack_w, rack_l]
    
    import itertools
    max_fit = 0
    
    # Check all orientations to find the one that yields the max count
    for p_perm in itertools.permutations(p_dims):
        if p_perm[0] <= r_dims[0] and p_perm[1] <= r_dims[1] and p_perm[2] <= r_dims[2]:
            fit_h = int(rack_h // p_perm[0])
            fit_w = int(rack_w // p_perm[1])
            fit_l = int(rack_l // p_perm[2])
            count = fit_h * fit_w * fit_l
            if count > max_fit:
                max_fit = count
                
    return max_fit

def get_heuristic_recommendations(product: Product, quantity: int, racks: List[Rack]) -> List[Dict[str, Any]]:
    """
    Evaluates all racks and returns sorted recommendations based on fit constraints and scoring.
    """
    recommendations = []
    prod_vol = product.height * product.width * product.length
    
    for rack in racks:
        # 1. Physical single-item fit check
        single_fits = check_3d_fit(
            product.height, product.width, product.length,
            rack.height, rack.width, rack.length
        )
        
        if not single_fits:
            recommendations.append({
                "rack_id": rack.id,
                "rack_code": rack.code,
                "fits": False,
                "reason": f"Product dimensions ({product.height}x{product.width}x{product.length} cm) exceed rack openings.",
                "max_quantity_fit": 0,
                "utilization_percentage": round((rack.occupied_volume / rack.total_volume) * 100, 2),
                "weight_after_allocation": rack.current_weight,
                "volume_after_allocation": rack.occupied_volume,
                "score": 0.0,
                "recommendation_source": "HEURISTIC"
            })
            continue

        # Calculate max units fit in empty rack based on 3D grid
        max_empty_grid_qty = calculate_max_units(
            product.height, product.width, product.length,
            rack.height, rack.width, rack.length
        )
        
        # 2. Volumetric constraints check
        avail_vol = rack.total_volume - rack.occupied_volume
        max_qty_by_vol = int(avail_vol // prod_vol)
        
        # Max quantity fit in remaining space (accounting for existing volumetric occupancy fraction)
        current_occupancy_fraction = rack.occupied_volume / rack.total_volume
        equivalent_occupied_units = current_occupancy_fraction * max_empty_grid_qty
        remaining_grid_units = max(0, int(max_empty_grid_qty - equivalent_occupied_units))
        
        max_qty_fit = min(max_qty_by_vol, remaining_grid_units)
        
        # 3. Weight constraints check
        avail_weight = rack.max_weight - rack.current_weight
        max_qty_by_weight = int(avail_weight // product.weight)
        
        final_max_qty = min(max_qty_fit, max_qty_by_weight)
        
        if final_max_qty < quantity:
            reason = ""
            if max_qty_by_weight < quantity:
                reason += f"Weight capacity exceeded (Can only fit {max_qty_by_weight} more units by weight). "
            if max_qty_fit < quantity:
                reason += f"Volume capacity exceeded (Can only fit {max_qty_fit} more units by volume)."
            
            recommendations.append({
                "rack_id": rack.id,
                "rack_code": rack.code,
                "fits": False,
                "reason": reason.strip(),
                "max_quantity_fit": final_max_qty,
                "utilization_percentage": round((rack.occupied_volume / rack.total_volume) * 100, 2),
                "weight_after_allocation": rack.current_weight,
                "volume_after_allocation": rack.occupied_volume,
                "score": 0.0,
                "recommendation_source": "HEURISTIC"
            })
            continue
            
        # If it fits the full quantity, calculate scores
        added_vol = prod_vol * quantity
        added_weight = product.weight * quantity
        
        new_vol_occ = rack.occupied_volume + added_vol
        new_weight_occ = rack.current_weight + added_weight
        
        new_vol_util_pct = (new_vol_occ / rack.total_volume) * 100
        new_weight_util_pct = (new_weight_occ / rack.max_weight) * 100
        
        # Scoring logic
        # We start with a base score and reward:
        # - Good volumetric utilization (higher is better, consolidating inventory)
        # - Matching heavy products to heavy zones
        # - Matching categories to specific zones (ML training data will follow these patterns!)
        
        score = 50.0  # Base score
        
        # Fill preference: favor racks that will be highly utilized (consolidation)
        score += (new_vol_util_pct * 0.3)
        
        # Weight safety check: favor racks that aren't overloaded in weight (avoiding near-maximum weight limit)
        weight_safety_factor = 100.0 - new_weight_util_pct
        score += (weight_safety_factor * 0.1)
        
        # Zone compatibility heuristics
        if product.weight > 15.0:  # Heavy item
            if rack.zone == "Heavy":
                score += 30.0  # Big bonus for heavy items on heavy racks
            elif rack.zone == "Upper":
                score -= 40.0  # Penalty for heavy items on top/upper shelves
        else: # Light item
            if rack.zone == "Upper" or rack.zone == "Standard":
                score += 15.0
                
        # Category matching
        if product.category == "Electronics" and rack.zone == "Fragile":
            score += 20.0
        elif product.category == "Chemicals" and rack.zone == "Cold":
            score += 25.0
            
        # Ensure score is rounded and within a logical range (e.g. 0 to 100)
        score = min(100.0, max(0.0, round(score, 2)))
        
        recommendations.append({
            "rack_id": rack.id,
            "rack_code": rack.code,
            "fits": True,
            "reason": "Product fits perfectly.",
            "max_quantity_fit": final_max_qty,
            "utilization_percentage": round(new_vol_util_pct, 2),
            "weight_after_allocation": round(new_weight_occ, 2),
            "volume_after_allocation": round(new_vol_occ, 2),
            "score": score,
            "recommendation_source": "HEURISTIC"
        })
        
    # Sort recommendations: fits first, then sorted by score descending
    recommendations.sort(key=lambda x: (1 if x["fits"] else 0, x["score"]), reverse=True)
    return recommendations
