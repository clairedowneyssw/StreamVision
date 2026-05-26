/**
 * Heading estimator.
 *
 * RTK receivers don't always provide a heading (some do via dual-antenna; most don't).
 * We estimate operator heading from the bearing between successive fixes, but only when
 * they've moved enough that the bearing is meaningful (otherwise GPS jitter dominates).
 *
 * Useful for converting the absolute bearing to a marker into operator-relative cues like
 * "12 o'clock, 4 meters" — way more useful in the field than "NE 4m".
 */

import { bearingDeg, horizontalDistanceM } from "./geo.js";

const MIN_MOVE_M = 1.0; // we need at least 1m of movement to trust the heading
const MAX_AGE_MS = 8000; // anchor goes stale after 8s of standing still

export class HeadingEstimator {
  private anchorLat: number | null = null;
  private anchorLon: number | null = null;
  private anchorAt = 0;
  private lastHeading: number | null = null;

  observe(lat: number, lon: number, nowMs: number = Date.now()): number | null {
    if (this.anchorLat == null || this.anchorLon == null) {
      this.anchorLat = lat;
      this.anchorLon = lon;
      this.anchorAt = nowMs;
      return this.lastHeading;
    }
    const dist = horizontalDistanceM(this.anchorLat, this.anchorLon, lat, lon);
    if (dist >= MIN_MOVE_M) {
      this.lastHeading = bearingDeg(this.anchorLat, this.anchorLon, lat, lon);
      this.anchorLat = lat;
      this.anchorLon = lon;
      this.anchorAt = nowMs;
    } else if (nowMs - this.anchorAt > MAX_AGE_MS) {
      // Standing still for too long — drop the heading; we don't trust it.
      this.lastHeading = null;
      this.anchorLat = lat;
      this.anchorLon = lon;
      this.anchorAt = nowMs;
    }
    return this.lastHeading;
  }

  current(): number | null {
    return this.lastHeading;
  }

  reset() {
    this.anchorLat = null;
    this.anchorLon = null;
    this.anchorAt = 0;
    this.lastHeading = null;
  }
}
