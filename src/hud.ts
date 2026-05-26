/**
 * HUD formatting.
 *
 * The Mentra display glasses are MONOCHROME GREEN — no color coding possible. So we lean on
 * bold ASCII symbols, action verbs, and clear numerics. Every line earns its space; the
 * display is small and the operator is glancing, not reading.
 *
 * Conventions:
 *   ✓ ON GRADE   — within tolerance, hold
 *   ✗ ↓ TOO HIGH — bucket needs to move down (dig)
 *   ✗ ↑ TOO DEEP — bucket needs to move up (fill)
 *   →            — approach mode (move toward marker)
 *   ⚠            — warning (no fix, float fix, low accuracy)
 */

import { clockFromBearing, compassAbbrev } from "./geo.js";
import type { DepthEvaluation } from "./types.js";

export interface HudFrame {
  kind: "approach" | "dig" | "warning";
  topText: string;
  bottomText: string;
}

export interface HudContext {
  /** Operator's heading in degrees (0=N), or null if unknown. Enables clock-face directions. */
  headingDeg: number | null;
  /** If true, render approach direction as clock face ("12 o'clock"). Else compass ("NE"). */
  useClockDirections: boolean;
  /** Optional warning to overlay (e.g. "RTK FLOAT"). */
  qualityWarning: string | null;
  /** Progress, e.g. "12/18". */
  progressLabel: string | null;
}

export function renderHud(ev: DepthEvaluation, ctx: HudContext): HudFrame {
  const baseFrame = renderBase(ev, ctx);
  // Overlay quality warning into the bottom line where there's room.
  if (ctx.qualityWarning) {
    return {
      ...baseFrame,
      bottomText: `${baseFrame.bottomText}\n⚠ ${ctx.qualityWarning}`,
    };
  }
  return baseFrame;
}

function renderBase(ev: DepthEvaluation, ctx: HudContext): HudFrame {
  const progress = ctx.progressLabel ? `  ·  ${ctx.progressLabel}` : "";

  switch (ev.state) {
    case "no_fix":
      return {
        kind: "warning",
        topText: "⚠ NO RTK FIX",
        bottomText: ev.reason,
      };

    case "out_of_range": {
      if (!ev.marker || ev.horizontalDistanceM == null || ev.bearingDeg == null) {
        return {
          kind: "warning",
          topText: ev.reason === "All markers completed"
            ? "✓ ALL MARKERS DONE"
            : "⚠ NO MARKERS",
          bottomText: ev.reason === "All markers completed"
            ? `Site complete${progress ? ` ·${progress.replace("  ·  ", " ")}` : ""}`
            : "Load a marker file to begin",
        };
      }
      const dist = formatDistance(ev.horizontalDistanceM);
      const dir = ctx.useClockDirections && ctx.headingDeg != null
        ? `${clockFromBearing(ev.bearingDeg, ctx.headingDeg)} o'clock`
        : `${compassAbbrev(ev.bearingDeg)}`;
      return {
        kind: "approach",
        topText: `→ ${ev.marker.id}  ${dir} ${dist}${progress}`,
        bottomText: ev.marker.label
          ? `${ev.marker.label}\nbrg ${Math.round(ev.bearingDeg)}°`
          : `bearing ${Math.round(ev.bearingDeg)}°`,
      };
    }

    case "on_grade":
      return {
        kind: "dig",
        topText: `✓ ON GRADE  ${ev.marker?.id ?? ""}${progress}`.trim(),
        bottomText: `Δ ${signed(ev.cutFillM ?? 0)} m   HOLD\nshort-press = mark done`,
      };

    case "too_high": {
      // Arrow points the direction the bucket should move to correct.
      // TOO HIGH → move DOWN to dig deeper → ↓
      const cm = Math.round((ev.cutFillM ?? 0) * 100);
      return {
        kind: "dig",
        topText: `✗ ↓ TOO HIGH  ${ev.marker?.id ?? ""}${progress}`.trim(),
        bottomText: `↓ DIG ${cm} cm  (+${(ev.cutFillM ?? 0).toFixed(2)} m)`,
      };
    }

    case "too_deep": {
      // TOO DEEP → move UP / add fill → ↑
      const cm = Math.round((-(ev.cutFillM ?? 0)) * 100);
      return {
        kind: "dig",
        topText: `✗ ↑ TOO DEEP  ${ev.marker?.id ?? ""}${progress}`.trim(),
        bottomText: `↑ FILL ${cm} cm  (${(ev.cutFillM ?? 0).toFixed(2)} m)`,
      };
    }
  }
}

/** Human-friendly distance string. Switches from cm to m around 1 m. */
function formatDistance(m: number): string {
  if (m < 1) return `${Math.round(m * 100)} cm`;
  if (m < 10) return `${m.toFixed(2)} m`;
  return `${m.toFixed(1)} m`;
}

function signed(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(3);
}

/**
 * Skip pushing a frame to the glasses if it's identical to the previous one — Mentra throttles
 * displays to one update per 300ms anyway, no point fighting it.
 */
export class HudThrottle {
  private last: HudFrame | null = null;
  shouldSend(frame: HudFrame): boolean {
    if (
      this.last &&
      this.last.kind === frame.kind &&
      this.last.topText === frame.topText &&
      this.last.bottomText === frame.bottomText
    ) {
      return false;
    }
    this.last = frame;
    return true;
  }
  reset() {
    this.last = null;
  }
}
