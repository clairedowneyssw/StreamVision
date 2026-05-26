# Stream Restoration HUD (Mentra Glasses)

Heads-up display app for stream-restoration field crews. Runs on
[MentraOS](https://docs.mentraglass.com) display glasses (Mentra Mach1, Even Realities G1,
Vuzix Z100). Drives a glanceable depth/grade indicator from a high-precision (RTK) GPS feed,
auto-advances through marker lists, speaks corrections via TTS, and produces an as-built
CSV for permitting paperwork.

```
  ✓ ON GRADE   M03  ·  4/12         ✗ ↓ TOO HIGH  M02  ·  3/12       ✗ ↑ TOO DEEP  M02  ·  3/12
  Δ +0.012 m   HOLD                 ↓ DIG 18 cm  (+0.18 m)            ↑ FILL 12 cm  (-0.12 m)
  short-press = mark done
```

Approach mode (you're not on a marker yet):

```
  → M04  12 o'clock 4.2 m  ·  3/12
  Pool entrance · brg 47°
```

## How it works

```
  RTK receiver ──BT/serial─► nmea-bridge ─►  POST /gps/ingest  ─► this app ─► glasses HUD
                  (NMEA GGA + GST)         (bearer auth, ≤4 Hz)        │           │
                                                                       │           ├─► TTS cues
                                                  markers.geojson ─────┤           ├─► dashboard
                                                                       │           └─► button events
                                                                       ▼
                                                          per-user audit.csv  (mark-done writes)
```

- **Markers** (target dig points + grade elevations) load from GeoJSON or CSV.
- **RTK fixes** are pushed to `/gps/ingest` by a small companion script (`nmea-bridge.js`).
  Mentra apps run in the cloud and can't read a Bluetooth GPS directly, so the bridge runs on
  the phone, on the receiver itself, or on a small SBC in the truck cab.
- The app picks the **nearest *undone* marker within horizontal tolerance**, compares your
  antenna altitude (minus rod/antenna height) to the marker's target elevation, and renders:
  - `→ M0X  NE 4.2 m` — approach mode
  - `✓ ON GRADE` — within depth tolerance, ready to mark done
  - `✗ ↓ TOO HIGH  DIG 18 cm` — above target, lower the bucket
  - `✗ ↑ TOO DEEP  FILL 12 cm` — below target, raise the bucket
- **Arrow convention:** the arrow points the way the bucket needs to move. `↓` = lower the
  bucket (dig more); `↑` = raise the bucket (add fill).
- **Quality warnings** (RTK FLOAT, low vAccuracy) overlay so you don't accept a bad depth.
- **Button:** short press while ON GRADE marks the marker complete; long press undoes the
  nearest completed one. Completion writes an as-built record to `audit/<userId>.csv`.
- **Voice cues** speak state changes and changing dig/fill amounts (rate-limited).

### Why text symbols, not red/green

The Mentra display glasses use a **monochrome green** waveguide — there's no red. The HUD
uses bold ✓ / ✗ symbols, directional arrows (↑/↓), action verbs (`HOLD` / `DIG` / `FILL`),
and signed numerics so status is unambiguous at a glance.

## Quick start

```bash
bun install                # or: npm install
cp .env.example .env
# edit .env: PACKAGE_NAME, MENTRAOS_API_KEY, GPS_INGEST_TOKEN
bun run dev
```

In another terminal:

```bash
ngrok http --url=<your-static-domain> 3000
```

Register the app in [console.mentraglass.com](https://console.mentraglass.com) with your
ngrok URL as the public URL, then start it from the Mentra phone app.

### Test without RTK hardware

```bash
# Get the sessionId from the app logs once a session opens, then:
bun run simulate -- --session=<sessionId> --token=$GPS_INGEST_TOKEN
```

The simulator walks an operator through `examples/markers.geojson`, oscillating depth around
each target so you can watch the HUD cycle through approach → too high → ✓ → too deep.

### Bridge real NMEA from an RTK receiver

```bash
# After pairing the receiver over Bluetooth-SPP (Android: bind to /dev/rfcomm0)
node scripts/nmea-bridge.js \
  --port=/dev/rfcomm0 --baud=115200 \
  --url=https://your-app/gps/ingest \
  --token=$GPS_INGEST_TOKEN \
  --session=<sessionId> \
  --antenna=1.80         # rod height in meters, subtracted from altitude
```

Or pipe NMEA from anywhere:

```bash
cat recorded-fixes.nmea | node scripts/nmea-bridge.js --stdin \
  --url=... --token=... --session=...
```

The bridge parses **GGA** (position + fix quality) and **GST** (per-axis accuracy stats) and
forwards combined fixes at up to 4 Hz.

## Buttons

| Action | Effect |
|---|---|
| Short press, **ON GRADE** | Mark current marker done, append as-built record, auto-advance to next |
| Short press, not on grade | TTS: "Not on grade" |
| Long press | Undo nearest completed marker (re-opens it for re-work) |

## Sound effects

When the operator transitions **into** the `on_grade` state, the glasses play a short
two-tone chime (`public/sfx/on-grade.wav`). The chime fires once per transition — not on
every tick we're on grade — so it confirms arrival without nagging.

The glasses fetch the file over HTTP, so the audio URL has to be publicly reachable. Set
`PUBLIC_BASE_URL` in `.env` to your ngrok URL (dev) or your domain (prod). The app builds
`{PUBLIC_BASE_URL}/sfx/on-grade.wav` automatically. If you want to host the sound
elsewhere, set `SFX_ON_GRADE_URL` explicitly.

To retune the chime (different pitch, longer/shorter, etc.):

```bash
# edit tone freq / duration in scripts/gen-sfx.js, then:
node scripts/gen-sfx.js
```

## As-built audit log

Every mark-done writes one row to `audit/<userId>.csv`:

```
timestamp,userId,sessionId,markerId,label,targetElevationM,achievedElevationM,cutFillM,
hAccuracyM,vAccuracyM,fixQuality,fixLat,fixLon,markerLat,markerLon,horizontalOffsetM
2026-05-15T13:30:00.000Z,clare,sess-abc,M01,Riffle 1,12.4500,12.4520,0.0020,0.0120,0.0180,4,...
```

Download for permitting:

```bash
curl -H "Authorization: Bearer $GPS_INGEST_TOKEN" \
  https://your-app:3100/asbuilt/clare.csv > asbuilt-clare.csv
```

The CSV is ready to drop into a permitting binder, an NRCS Practice Standard 580 closeout,
or a GIS as-built layer.

## Operator settings (Mentra phone app)

Settings flow through the Mentra console → phone app → app session. Recommended fields to
configure in [console.mentraglass.com](https://console.mentraglass.com):

| Key | Type | Default | Notes |
|---|---|---|---|
| `antennaHeightM` | number | 0 | Vertical offset rod → ground. Subtracted client-side. |
| `horizontalToleranceM` | number | 0.30 | Override `HORIZONTAL_TOLERANCE_M` per operator. |
| `depthToleranceM` | number | 0.05 | Override `DEPTH_TOLERANCE_M` per operator. |
| `voiceEnabled` | bool | true | Toggle TTS cues. |
| `useClockDirections` | bool | false | "12 o'clock 4m" vs "NE 4m" in approach mode. |

Settings persist via `simpleStorage` so they survive disconnects.

## Marker file format

### GeoJSON (recommended for QGIS / ArcGIS exports)

```jsonc
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-77.0346, 38.8977, 12.450] },
      "properties": {
        "id": "M01",
        "label": "Riffle 1",
        "targetElevationM": 12.450,
        "toleranceM": 0.05,
        "notes": "Top of riffle"
      }
    }
  ]
}
```

`targetElevationM` may come from the third coordinate (Z) if not in properties.

### CSV

```
id,lat,lon,targetElevationM,label,toleranceM,notes
M01,38.8977,-77.0346,12.450,Riffle 1,,Top of riffle
```

## Ingest API

```http
POST /gps/ingest
Authorization: Bearer <GPS_INGEST_TOKEN>
Content-Type: application/json

{
  "sessionId": "abc-123",
  "lat": 38.8977,
  "lon": -77.0346,
  "altitudeM": 12.462,
  "antennaHeightM": 1.80,
  "fixQuality": 4,
  "hAccuracyM": 0.012,
  "vAccuracyM": 0.018,
  "timestampMs": 1720000000000
}
```

Fix-quality and accuracy fields drive the HUD's `⚠ RTK FLOAT` and `⚠ vAcc ±N cm` warnings.

## Project layout

```
src/
  index.ts        ← AppServer + per-session ticker + button + settings
  gps-ingest.ts   ← /gps/ingest + /asbuilt/<userId>.csv endpoints
  markers.ts      ← GeoJSON / CSV loader
  geo.ts          ← distance / bearing / compass / clock-face helpers
  depth.ts        ← nearest-undone-marker evaluator + fix-quality warning
  hud.ts          ← formats DepthEvaluation → glasses layout frames
  state.ts        ← persisted completed markers + settings + as-built CSV log
  heading.ts      ← operator heading estimator from successive fixes
  voice.ts        ← rate-limited TTS cueing
  types.ts
scripts/
  simulate-rtk.ts ← drives ingest without real hardware
  nmea-bridge.js  ← serial/stdin NMEA → ingest (real receivers)
  smoke.ts        ← behavior smoke test
examples/
  markers.geojson, markers.csv
audit/
  <userId>.csv    ← per-operator as-built logs (created on first mark-done)
```

## Open questions / decided defaults

- **Leica receiver model** — confirmed Leica Geosystems RTK (e.g. GS18 / GS16). The NMEA
  bridge handles standard NMEA-0183 GGA + GST, which all Leica GS-series receivers emit over
  Bluetooth-SPP or USB-serial. If you enable Leica's proprietary frames (e.g. `$PTNL`,
  `$GLLLQ`), we can add a parser for the extra quality fields — not required for v1.
- **Vertical datum** — markers and RTK fixes must use the same vertical reference (NAVD88 via
  a geoid model like GEOID18 is the usual choice for stream restoration in the US). Verify
  with the receiver config before going live or depths will be wrong by 30+ meters silently.
- **Cell coverage** — Mentra apps run in the cloud; the glasses + bridge both need network.
  Worth scouting the site or planning for an LTE hotspot in the truck.
- A foreman webview tile (multiple crews at once) is sketched but not yet built — say the
  word and I'll add it.
