/**
 * RTK simulator.
 *
 * Drives the GPS ingest endpoint with a synthetic operator who walks toward each marker,
 * pauses on it, and oscillates around the target depth. Useful for testing the HUD without
 * actual survey hardware.
 *
 * Usage:
 *   bun run scripts/simulate-rtk.ts \
 *     --session=<sessionId-from-mentra-logs> \
 *     [--markers=./examples/markers.geojson] \
 *     [--url=http://localhost:3100/gps/ingest] \
 *     [--token=...]
 */

import { loadMarkers } from "../src/markers.js";

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? "http://localhost:3100/gps/ingest";
const token = args.token ?? process.env.GPS_INGEST_TOKEN ?? "";
const sessionId = args.session ?? "demo-session";
const markersFile = args.markers ?? "./examples/markers.geojson";

if (!token) {
  console.error("Missing --token (or set GPS_INGEST_TOKEN in env)");
  process.exit(1);
}

const markers = await loadMarkers(markersFile);
if (markers.length === 0) {
  console.error("No markers loaded");
  process.exit(1);
}

console.log(`Simulating operator across ${markers.length} markers → ${url} (session=${sessionId})`);

// Start ~30 m southwest of the first marker.
const start = { lat: markers[0].lat - 0.0002, lon: markers[0].lon - 0.0002 };
let cur = { ...start, alt: markers[0].targetElevationM + 1.0 };

const STEPS_PER_MARKER = 60;
const ON_MARKER_STEPS = 40;
const TICK_MS = 250;

for (const m of markers) {
  // Approach phase
  for (let i = 0; i < STEPS_PER_MARKER; i++) {
    const t = (i + 1) / STEPS_PER_MARKER;
    cur.lat = lerp(cur.lat, m.lat, t * 0.15);
    cur.lon = lerp(cur.lon, m.lon, t * 0.15);
    cur.alt = lerp(cur.alt, m.targetElevationM + 0.4, t * 0.1);
    await post(cur, m);
    await sleep(TICK_MS);
  }
  // On-marker phase: oscillate altitude through the target so we hit ✓ ON GRADE
  for (let i = 0; i < ON_MARKER_STEPS; i++) {
    cur.lat = m.lat + (Math.random() - 0.5) * 1e-6;
    cur.lon = m.lon + (Math.random() - 0.5) * 1e-6;
    const phase = Math.sin((i / ON_MARKER_STEPS) * Math.PI * 2);
    cur.alt = m.targetElevationM + phase * 0.20; // ±20 cm sweep
    await post(cur, m);
    await sleep(TICK_MS);
  }
  console.log(`  ✓ ${m.id} done`);
}

console.log("Simulation complete.");

async function post(p: { lat: number; lon: number; alt: number }, m: { id: string }) {
  const body = {
    sessionId,
    lat: p.lat,
    lon: p.lon,
    altitudeM: p.alt,
    antennaHeightM: 0,
    fixQuality: 4,
    hAccuracyM: 0.012,
    vAccuracyM: 0.018,
    timestampMs: Date.now(),
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`  ${m.id}: ingest returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`  ${m.id}: ingest error ${(err as Error).message}`);
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
