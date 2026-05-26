// Quick behavioral smoke test. Not a proper test suite — just enough to prove the math.
import { evaluate, fixQualityWarning } from "../src/depth.js";
import { renderHud } from "../src/hud.js";
import { HeadingEstimator } from "../src/heading.js";
import type { DigMarker, RtkFix } from "../src/types.js";

const markers: DigMarker[] = [
  { id: "M01", lat: 38.8977, lon: -77.0346, targetElevationM: 12.450 },
  { id: "M02", lat: 38.8978, lon: -77.0347, targetElevationM: 12.380, toleranceM: 0.075 },
];

const opts = { horizontalToleranceM: 0.30, depthToleranceM: 0.05, fixStaleMs: 4000 };
const ctxBase = { headingDeg: null as number | null, useClockDirections: false, qualityWarning: null as string | null, progressLabel: "0/2" };
const now = Date.now();

function mkFix(lat: number, lon: number, alt: number, ageMs = 0, fixQuality = 4, vAccuracyM?: number): RtkFix {
  return { lat, lon, altitudeM: alt, timestampMs: now - ageMs, fixQuality, vAccuracyM };
}

function row(label: string, fix: RtkFix | null, opt = opts, ctx = ctxBase, isDone?: (id: string) => boolean) {
  const ev = evaluate(markers, fix, { ...opt, isDone }, now);
  const warn = fixQualityWarning(fix, opt.depthToleranceM);
  const hud = renderHud(ev, { ...ctx, qualityWarning: warn });
  console.log(`\n[${label}]`);
  console.log(`  state=${ev.state}  marker=${ev.marker?.id ?? "—"}  cutFill=${ev.cutFillM?.toFixed(3) ?? "—"}  hDist=${ev.horizontalDistanceM?.toFixed(2) ?? "—"}  warn=${warn ?? "—"}`);
  console.log(`  HUD top:    ${hud.topText}`);
  console.log(`  HUD bottom: ${hud.bottomText.replace(/\n/g, " | ")}`);
}

console.log("=== Core depth states ===");
row("no fix", null);
row("stale fix", mkFix(38.8977, -77.0346, 12.450, 10_000));
row("on grade", mkFix(38.8977, -77.0346, 12.452));
row("too high (dig 15cm)", mkFix(38.8977, -77.0346, 12.600));
row("too deep (fill 10cm)", mkFix(38.8977, -77.0346, 12.350));
row("M02 looser tolerance — within ±7.5cm => on grade", mkFix(38.8978, -77.0347, 12.440));
row("approach mode", mkFix(38.89745, -77.03495, 12.5));

console.log("\n=== New: fix quality warnings ===");
row("RTK FLOAT (Q=5)", mkFix(38.8977, -77.0346, 12.452, 0, 5));
row("low vAccuracy (8cm vs 5cm tol)", mkFix(38.8977, -77.0346, 12.452, 0, 4, 0.08));

console.log("\n=== New: completed-marker filtering / auto-advance ===");
row("M01 done → focus M02 in approach", mkFix(38.8977, -77.0346, 12.5), opts, { ...ctxBase, progressLabel: "1/2" }, (id) => id === "M01");
row("All done", mkFix(38.8977, -77.0346, 12.5), opts, { ...ctxBase, progressLabel: "2/2" }, () => true);

console.log("\n=== New: clock-face direction (heading aware) ===");
const h = new HeadingEstimator();
// Walk the operator northeast a couple meters to establish a heading
h.observe(38.89745, -77.03495, now - 2000);
h.observe(38.89748, -77.03492, now);
row("approach with clock directions", mkFix(38.89745, -77.03495, 12.5), opts, { ...ctxBase, headingDeg: h.current(), useClockDirections: true });
console.log(`  (estimated heading: ${h.current()?.toFixed(1)}°)`);
