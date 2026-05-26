/**
 * Shared types for the stream-restoration HUD app.
 */

export interface DigMarker {
  /** Stable id used in HUD and logs. Keep it short — it appears on a tiny display. */
  id: string;
  /** Optional human label, e.g. "Riffle 3 - top of step pool". */
  label?: string;
  /** WGS84 latitude in decimal degrees. */
  lat: number;
  /** WGS84 longitude in decimal degrees. */
  lon: number;
  /** Target ground elevation in meters (ellipsoid or geoid — be consistent across markers + RTK). */
  targetElevationM: number;
  /** Optional per-marker depth tolerance in meters; falls back to global default when absent. */
  toleranceM?: number;
  /** Optional notes shown on the reference card. */
  notes?: string;
}

/**
 * A single position fix coming from an RTK receiver.
 *
 * We accept either ground elevation directly (`elevationM`) or an antenna height we subtract
 * (`antennaHeightM`) — most field setups know exactly how far the antenna sits above the
 * cutting edge of the bucket / bottom of the survey pole.
 */
export interface RtkFix {
  /** WGS84 lat in decimal degrees. */
  lat: number;
  /** WGS84 lon in decimal degrees. */
  lon: number;
  /** Antenna elevation in meters (whatever vertical datum the markers use). */
  altitudeM: number;
  /** Optional offset from antenna phase center to the cut/fill point (meters, positive = above ground). */
  antennaHeightM?: number;
  /** RTK fix quality. 4 = fixed, 5 = float, 1 = autonomous. Anything < 4 is a warning. */
  fixQuality?: number;
  /** Horizontal accuracy estimate (meters). */
  hAccuracyM?: number;
  /** Vertical accuracy estimate (meters). */
  vAccuracyM?: number;
  /** When the fix was produced — ms since epoch. We compare to wall clock for staleness. */
  timestampMs: number;
}

export type DepthState = "on_grade" | "too_high" | "too_deep" | "no_fix" | "out_of_range";

export interface DepthEvaluation {
  state: DepthState;
  /** The marker we evaluated against (nearest within horizontal tolerance), if any. */
  marker: DigMarker | null;
  /** Horizontal distance from the operator to that marker, meters. */
  horizontalDistanceM: number | null;
  /** Bearing from operator to the marker (0 = north, 90 = east), degrees. */
  bearingDeg: number | null;
  /** Signed delta: current elevation minus target. Positive => operator is above target (need to dig). */
  cutFillM: number | null;
  /** The fix we used. */
  fix: RtkFix | null;
  /** A short explanation suitable for logs. */
  reason: string;
}
