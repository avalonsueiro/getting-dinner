/** The two ends of the corridor, and the walking-speed assumption shared by app and script. */
export const GRAND_CENTRAL = { lat: 40.7527, lng: -73.9772 }
export const STUYVESANT_TOWN = { lat: 40.7317, lng: -73.9778 }
export const MIDPOINT = { lat: 40.7422, lng: -73.9775 }

/** Corridor bounding box used by the fetch script. */
export const BOUNDS = {
  minLat: 40.73,
  maxLat: 40.7545,
  minLng: -73.99,
  maxLng: -73.97,
}

const WALK_METERS_PER_MINUTE = 80

/** Straight-line distance in meters. Good enough at Manhattan scale. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function walkMinutes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return Math.round(haversineMeters(a, b) / WALK_METERS_PER_MINUTE)
}

/** Attaches walk times + fairness to a place that already has lat/lng. */
export function withWalkTimes<T extends { lat: number; lng: number }>(place: T) {
  const gct = walkMinutes(place, GRAND_CENTRAL)
  const stuy = walkMinutes(place, STUYVESANT_TOWN)
  return {
    ...place,
    walk_minutes_from_grand_central: gct,
    walk_minutes_from_stuytown: stuy,
    fairness: Math.abs(gct - stuy),
  }
}

export function inBounds(place: { lat: number; lng: number }): boolean {
  return (
    place.lat >= BOUNDS.minLat &&
    place.lat <= BOUNDS.maxLat &&
    place.lng >= BOUNDS.minLng &&
    place.lng <= BOUNDS.maxLng
  )
}
