/**
 * Haversine formula — Calculates the distance in kilometers between two GPS coordinates.
 * 100% free, no API needed. Pure math.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // returns km with 2 decimal precision
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Given a distance and a list of delivery rules (zones),
 * find the matching zone and return the fee.
 * Returns null if outside all zones.
 */
export function calculateDeliveryFee(
  distanceKm: number,
  deliveryRules: Array<{ max_distance: number; fee: number; min_order?: number; zone_name?: string }>
): { fee: number; zone_name: string; max_distance: number } | null {
  // Sort rules by max_distance ascending so we match the closest zone first
  const sorted = [...deliveryRules].sort((a, b) => a.max_distance - b.max_distance);
  
  for (const rule of sorted) {
    if (distanceKm <= rule.max_distance) {
      return {
        fee: rule.fee,
        zone_name: rule.zone_name || "Zona de entrega",
        max_distance: rule.max_distance,
      };
    }
  }
  
  return null; // Outside all delivery zones
}
