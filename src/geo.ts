/**
 * Geospatial helpers — distance, bearing, etc.
 *
 * Stream restoration sites are small (tens to a few hundred meters), so we use a flat-earth
 * approximation around the operator's current latitude. That's accurate to <1 cm at this
 * scale and avoids the rounding error of a full haversine for tiny distances.
 *
 * For sites larger than a few km, swap `horizontalDistanceM` for a haversine.
 */

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

/** Meters between two WGS84 lat/lon points using equirectangular projection. */
export function horizontalDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const meanLatRad = ((lat1 + lat2) / 2) * DEG;
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const x = dLon * Math.cos(meanLatRad);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * EARTH_RADIUS_M;
}

/** Compass bearing from p1 to p2, in degrees [0, 360). 0 = north, 90 = east. */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δλ = (lon2 - lon1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ / DEG) + 360) % 360;
}

/** Cardinal/intercardinal abbreviation for a bearing — easier to read at a glance than degrees. */
export function compassAbbrev(bearing: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((bearing % 360) / 45)) % 8;
  return dirs[idx];
}

/** "Clock face" direction relative to the operator's heading (12 = forward). Useful for excavator ops. */
export function clockFromBearing(bearingFromMe: number, myHeadingDeg: number): number {
  const rel = ((bearingFromMe - myHeadingDeg + 360) % 360);
  // 0° relative -> 12 o'clock; 30° -> 1 o'clock; etc.
  const hour = Math.round(rel / 30) || 12;
  return hour > 12 ? hour - 12 : hour;
}
