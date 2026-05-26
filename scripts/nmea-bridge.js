#!/usr/bin/env node
/**
 * NMEA → /gps/ingest bridge.
 *
 * Reads NMEA-0183 sentences (GGA + GST) from a serial port (or stdin for testing),
 * parses each fix, and POSTs to the app's GPS ingest endpoint.
 *
 * Most RTK gear — Leica (GS18 / GS16 / GS07), Trimble, Topcon, u-blox ZED-F9P, Emlid —
 * outputs NMEA-0183 over Bluetooth-SPP or USB-serial. On Android, a Bluetooth-paired
 * receiver shows up as `/dev/rfcomm0` after binding; on Linux/macOS it's typically
 * `/dev/ttyUSB0` or `/dev/tty.usbserial-*`.
 *
 * Usage:
 *   node scripts/nmea-bridge.js \
 *     --port=/dev/rfcomm0 --baud=115200 \
 *     --url=https://your-app/gps/ingest \
 *     --token=$GPS_INGEST_TOKEN \
 *     --session=<sessionId> \
 *     [--antenna=1.80]   # rod / antenna height in meters, subtracted client-side or sent to server
 *
 *   # Or read NMEA from stdin (e.g. piped from `cat /dev/ttyUSB0`):
 *   cat fixes.nmea | node scripts/nmea-bridge.js --stdin --url=... --token=... --session=...
 *
 * The Mentra app server can't directly read Bluetooth, so this script runs anywhere with line-
 * of-sight to the receiver. Easiest deployments:
 *   - Termux on Android (paired with the BT receiver)
 *   - The receiver itself if it has Wi-Fi (e.g. Emlid Reach, Trimble R12i with cell)
 *   - A small SBC in the truck cab
 */

import { createInterface } from "node:readline";
import { Readable } from "node:stream";

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? process.env.GPS_INGEST_URL;
const token = args.token ?? process.env.GPS_INGEST_TOKEN;
const sessionId = args.session ?? process.env.SESSION_ID;
const antennaHeightM = args.antenna != null ? Number(args.antenna) : undefined;
const minIntervalMs = args.minIntervalMs ? Number(args.minIntervalMs) : 250;

if (!url || !token || !sessionId) {
  console.error(`Missing required args.
  --url=<https://your-app/gps/ingest>
  --token=<bearer token>
  --session=<sessionId>
  Plus either --port=<serial path> --baud=<rate> or --stdin
`);
  process.exit(1);
}

let stream;
if (args.stdin) {
  stream = process.stdin;
} else if (args.port) {
  // Lazy-load serialport so users without a serial device don't need to install it.
  let SerialPort;
  try {
    ({ SerialPort } = await import("serialport"));
  } catch {
    console.error(
      "The 'serialport' package isn't installed. Run:  npm install serialport\n" +
        "Or pipe NMEA via --stdin for testing.",
    );
    process.exit(2);
  }
  const port = new SerialPort({
    path: args.port,
    baudRate: Number(args.baud ?? 115200),
  });
  stream = port;
} else {
  console.error("Specify --stdin or --port=<serial path>");
  process.exit(1);
}

const lines = createInterface({ input: stream });
let lastGGA = null; // most recent GGA
let lastGST = null; // most recent error stats (covariances)
let lastSentAt = 0;

lines.on("line", (line) => {
  if (!line.startsWith("$")) return;
  if (!verifyChecksum(line)) return;

  if (/^\$..GGA,/.test(line)) {
    const gga = parseGGA(line);
    if (gga) {
      lastGGA = gga;
      maybeSend();
    }
  } else if (/^\$..GST,/.test(line)) {
    const gst = parseGST(line);
    if (gst) lastGST = gst;
  }
});

stream.on?.("error", (err) => {
  console.error("Stream error:", err.message);
  process.exit(3);
});

async function maybeSend() {
  if (!lastGGA) return;
  const now = Date.now();
  if (now - lastSentAt < minIntervalMs) return;
  lastSentAt = now;

  const body = {
    sessionId,
    lat: lastGGA.lat,
    lon: lastGGA.lon,
    altitudeM: lastGGA.altitudeM,
    antennaHeightM,
    fixQuality: lastGGA.fixQuality,
    hAccuracyM: lastGST?.hAccuracyM,
    vAccuracyM: lastGST?.vAccuracyM,
    timestampMs: lastGGA.timestampMs,
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
      console.warn(`ingest ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.warn("ingest error:", err.message);
  }
}

// -- NMEA parsing --------------------------------------------------------------------------

function verifyChecksum(line) {
  const star = line.lastIndexOf("*");
  if (star < 0) return true; // some receivers omit it
  const expected = line.slice(star + 1, star + 3).toLowerCase();
  let xor = 0;
  for (let i = 1; i < star; i++) xor ^= line.charCodeAt(i);
  return xor.toString(16).padStart(2, "0").toLowerCase() === expected;
}

function parseGGA(line) {
  // $..GGA,hhmmss.ss,lat,N/S,lon,E/W,quality,numSV,hdop,alt,M,geoidSep,M,age,refStation*cs
  const cleaned = line.split("*")[0];
  const f = cleaned.split(",");
  if (f.length < 10) return null;
  const lat = nmeaToDecimal(f[2], f[3]);
  const lon = nmeaToDecimal(f[4], f[5]);
  const fixQuality = parseInt(f[6] || "0", 10);
  const altitudeM = parseFloat(f[9]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altitudeM)) return null;
  return {
    lat,
    lon,
    altitudeM,
    fixQuality,
    timestampMs: Date.now(),
  };
}

function parseGST(line) {
  // $..GST,hhmmss.ss,rangeRMS,smaj,smin,oriDeg,sigLat,sigLon,sigAlt*cs
  const cleaned = line.split("*")[0];
  const f = cleaned.split(",");
  if (f.length < 9) return null;
  const sigLat = parseFloat(f[6]);
  const sigLon = parseFloat(f[7]);
  const sigAlt = parseFloat(f[8]);
  if (!Number.isFinite(sigLat) || !Number.isFinite(sigLon) || !Number.isFinite(sigAlt)) {
    return null;
  }
  // Combine lat/lon stddev into a horizontal estimate.
  return {
    hAccuracyM: Math.sqrt(sigLat * sigLat + sigLon * sigLon),
    vAccuracyM: sigAlt,
  };
}

function nmeaToDecimal(s, hemi) {
  if (!s) return NaN;
  // ddmm.mmmm or dddmm.mmmm
  const dot = s.indexOf(".");
  const degLen = dot > 4 ? dot - 2 : 2;
  const deg = parseFloat(s.slice(0, degLen));
  const min = parseFloat(s.slice(degLen));
  let dec = deg + min / 60;
  if (hemi === "S" || hemi === "W") dec = -dec;
  return dec;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (a === "--stdin") {
      out.stdin = true;
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

console.error(
  `nmea-bridge ready (${args.stdin ? "stdin" : args.port}) → ${url}  session=${sessionId}`,
);
