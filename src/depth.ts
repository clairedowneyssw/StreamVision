/**
 * Depth / on-grade evaluation.
 *
 * Given a list of dig markers and the latest RTK fix, decide:
 *   - Which marker is the operator working on? (nearest *undone* within horizontal tolerance,
 *     or nearest *undone* overall for approach-mode guidance)
 *   - Are they at grade, too high (need to dig), or too deep (need to fill)?
 *   - Is the fix high enough quality to trust at this tolerance?
 *
 * The "skip-completed" rule is what enables auto-advance: once a marker is marked done, the
 * next nearest undone one becomes the focus.
 */

import { bearingDeg, horizontalDistanceM } from "./geo.js";
import type {
  DepthEvaluation,
  DigMarker,
  RtkFix,
} from "./types.js";

export interface EvaluateOptions {
  /** Default horizontal tolerance for "are we at the marker?" (meters). */
  horizontalToleranceM: number;
  /** Default depth tolerance for "are we on grade?" (meters). */
  depthToleranceM: number;
  /** Max age of a fix before we report no_fix (ms). */
  fixStaleMs: number;
  /** Set of marker ids the operator has already completed. */
  isDone?: (markerId: string) => boolean;
}

export function evaluate(
  markers: DigMarker[],
  fix: RtkFix | null,
  opts: EvaluateOptions,
  nowMs: number = Date.now(),
): DepthEvaluation {
  if (!fix || nowMs - fix.timestampMs > opts.fixStaleMs) {
    return {
      state: "no_fix",
      marker: null,
      horizontalDistanceM: null,
      bearingDeg: null,
      cutFillM: null,
      fix,
      reason: fix
        ? `Fix is stale (${nowMs - fix.timestampMs} ms old)`
        : "No RTK fix received yet",
    };
  }

  // Filter out completed markers if we have a callback.
  const candidates = opts.isDone
    ? markers.filter((m) => !opts.isDone!(m.id))
    : markers;

  if (candidates.length === 0) {
    return {
      state: "out_of_range",
      marker: null,
      horizontalDistanceM: null,
      bearingDeg: null,
      cutFillM: null,
      fix,
      reason:
        markers.length === 0 ? "No markers loaded" : "All markers completed",
    };
  }

  // Find the nearest undone marker by 2D distance.
  let nearest: DigMarker = candidates[0];
  let nearestDist = horizontalDistanceM(fix.lat, fix.lon, nearest.lat, nearest.lon);
  for (let i = 1; i < candidates.length; i++) {
    const m = candidates[i];
    const d = horizontalDistanceM(fix.lat, fix.lon, m.lat, m.lon);
    if (d < nearestDist) {
      nearest = m;
      nearestDist = d;
    }
  }

  const bearing = bearingDeg(fix.lat, fix.lon, nearest.lat, nearest.lon);

  if (nearestDist > opts.horizontalToleranceM) {
    return {
      state: "out_of_range",
      marker: nearest,
      horizontalDistanceM: nearestDist,
      bearingDeg: bearing,
      cutFillM: null,
      fix,
      reason: `Nearest marker ${nearest.id} is ${nearestDist.toFixed(2)} m away`,
    };
  }

  // We're on the marker — evaluate depth.
  const groundElev = fix.altitudeM - (fix.antennaHeightM ?? 0);
  const cutFill = groundElev - nearest.targetElevationM;
  const tol = nearest.toleranceM ?? opts.depthToleranceM;

  let state: DepthEvaluation["state"];
  let reason: string;
  if (Math.abs(cutFill) <= tol) {
    state = "on_grade";
    reason = `On grade (Δ ${cutFill.toFixed(3)} m, tol ±${tol.toFixed(3)} m)`;
  } else if (cutFill > 0) {
    state = "too_high";
    reason = `Above target — dig ${cutFill.toFixed(3)} m`;
  } else {
    state = "too_deep";
    reason = `Below target — fill ${(-cutFill).toFixed(3)} m`;
  }

  return {
    state,
    marker: nearest,
    horizontalDistanceM: nearestDist,
    bearingDeg: bearing,
    cutFillM: cutFill,
    fix,
    reason,
  };
}

/**
 * RTK fix-quality assessment. Stream restoration depth tolerances are tight (~5 cm), so a
 * float fix (vAccuracy 10–50 cm) is dangerous to trust. Returns null if the fix is fine,
 * else a short warning string suitable for the HUD.
 */
export function fixQualityWarning(
  fix: RtkFix | null,
  depthToleranceM: number,
): string | null {
  if (!fix) return null;
  if (fix.fixQuality != null && fix.fixQuality !== 4) {
    return fix.fixQuality === 5
      ? "RTK FLOAT — depth unreliable"
      : `Fix Q=${fix.fixQuality}`;
  }
  if (fix.vAccuracyM != null && fix.vAccuracyM > depthToleranceM / 2) {
    return `vAcc ±${(fix.vAccuracyM * 100).toFixed(0)} cm`;
  }
  return null;
}
