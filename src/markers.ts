/**
 * Marker file loader.
 *
 * Accepts either:
 *   1. GeoJSON FeatureCollection of Points with properties { id, targetElevationM, ... }
 *      Coordinates are [lon, lat, elevation?]. If `properties.targetElevationM` is missing we
 *      fall back to the third coordinate.
 *   2. CSV with header row: id,lat,lon,targetElevationM[,label,toleranceM,notes]
 *
 * Files can be local paths or http(s) URLs.
 */

import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { DigMarker } from "./types.js";

const GeoJsonPoint = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]).rest(z.number()),
  }),
  properties: z.record(z.unknown()).nullable().optional(),
});

const GeoJsonCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(GeoJsonPoint),
});

export async function loadMarkers(source: string): Promise<DigMarker[]> {
  const raw = await fetchOrRead(source);
  const trimmed = raw.trimStart();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseGeoJson(trimmed);
  }
  return parseCsv(raw);
}

async function fetchOrRead(source: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch markers from ${source}: ${res.status}`);
    }
    return await res.text();
  }
  return await readFile(source, "utf8");
}

function parseGeoJson(text: string): DigMarker[] {
  const parsed = GeoJsonCollection.parse(JSON.parse(text));
  return parsed.features.map((f, idx) => {
    const [lon, lat, z] = f.geometry.coordinates;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const targetFromProps = numProp(props, "targetElevationM", "elevation", "targetElev", "elev");
    const target = targetFromProps ?? z;
    if (target == null || Number.isNaN(target)) {
      throw new Error(
        `Marker at index ${idx} has no targetElevationM (in properties or as 3rd coordinate)`,
      );
    }
    return {
      id: String(props.id ?? `M${idx + 1}`),
      label: stringProp(props, "label", "name") ?? undefined,
      lat,
      lon,
      targetElevationM: target,
      toleranceM: numProp(props, "toleranceM", "tolerance"),
      notes: stringProp(props, "notes") ?? undefined,
    };
  });
}

function parseCsv(text: string): DigMarker[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV markers file is empty");
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const need = ["id", "lat", "lon", "targetelevationm"];
  for (const col of need) {
    if (idx(col) < 0) throw new Error(`CSV missing required column: ${col}`);
  }
  const rows: DigMarker[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    rows.push({
      id: cols[idx("id")],
      lat: Number(cols[idx("lat")]),
      lon: Number(cols[idx("lon")]),
      targetElevationM: Number(cols[idx("targetelevationm")]),
      label: idx("label") >= 0 ? cols[idx("label")] || undefined : undefined,
      toleranceM:
        idx("tolerancem") >= 0 && cols[idx("tolerancem")]
          ? Number(cols[idx("tolerancem")])
          : undefined,
      notes: idx("notes") >= 0 ? cols[idx("notes")] || undefined : undefined,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  // Minimal CSV split — handles quoted fields with commas. Good enough for marker exports
  // out of QGIS / ArcGIS / a spreadsheet.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function numProp(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") {
      const n = Number(obj[k]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function stringProp(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
