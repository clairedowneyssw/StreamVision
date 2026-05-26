/**
 * Stream Restoration HUD — main entry point.
 *
 * Wires together:
 *   - Mentra AppServer        — talks to the glasses over WebSocket
 *   - GpsIngest               — receives RTK fixes from a phone/receiver companion
 *   - markers loader          — one-shot per session
 *   - SessionState            — persisted completed-markers + operator settings + as-built audit log
 *   - HeadingEstimator        — estimates operator heading from successive fixes
 *   - VoiceCueing             — TTS cues, rate-limited
 *   - depth evaluator + HUD   — tick-driven evaluation and rendering
 *   - Button handler          — short press = mark done, long press = undo
 *
 * Buttons (Mentra glasses):
 *   short press = mark current marker done (only when ON GRADE)
 *   long press  = undo last completion (or step back if currently focused on a done marker)
 */

import { AppServer, type AppSession } from "@mentra/sdk";
import express from "express";
import { GpsIngest } from "./gps-ingest.js";
import { evaluate, fixQualityWarning } from "./depth.js";
import { renderHud, HudThrottle } from "./hud.js";
import { loadMarkers } from "./markers.js";
import { HeadingEstimator } from "./heading.js";
import { SessionState, DEFAULT_SETTINGS, type OperatorSettings } from "./state.js";
import { VoiceCueing, DEFAULT_VOICE } from "./voice.js";
import type { DigMarker } from "./types.js";
import { resolve } from "node:path";

const env = {
  packageName: required("PACKAGE_NAME"),
  apiKey: required("MENTRAOS_API_KEY"),
  port: Number(process.env.PORT ?? 3000),
  ingestPort: Number(process.env.GPS_INGEST_PORT ?? 3100),
  ingestToken: required("GPS_INGEST_TOKEN"),
  markersFile: process.env.MARKERS_FILE ?? "./examples/markers.geojson",
  hTol: Number(process.env.HORIZONTAL_TOLERANCE_M ?? 0.30),
  dTol: Number(process.env.DEPTH_TOLERANCE_M ?? 0.05),
  staleMs: Number(process.env.FIX_STALE_MS ?? 4000),
  auditDir: resolve(process.env.AUDIT_DIR ?? "./audit"),
  /** Public base URL for the Mentra app (e.g. ngrok https URL). Used to build absolute SFX URLs. */
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "",
  sfxOnGradeUrl: process.env.SFX_ON_GRADE_URL ?? "",
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

class StreamRestorationApp extends AppServer {
  private ingest = new GpsIngest(env.ingestToken, env.auditDir);
  private tickers = new Map<string, NodeJS.Timeout>();

  constructor(config: ConstructorParameters<typeof AppServer>[0]) {
    super(config);
    // Serve the sfx folder over the AppServer's Express app so the glasses can fetch the
    // ding audio. Mentra's audio.playAudio takes a URL, so the file needs to be
    // publicly reachable (ngrok URL in dev, your domain in prod).
    this.getExpressApp().use("/sfx", express.static("public/sfx", { maxAge: "1h" }));
  }

  protected override async onSession(
    session: AppSession,
    sessionId: string,
    userId: string,
  ): Promise<void> {
    session.logger.info({ userId }, "Session opened");

    session.layouts.showDoubleTextWall("STREAM RESTORE", "Loading markers…");

    let markers: DigMarker[] = [];
    try {
      markers = await loadMarkers(env.markersFile);
      session.logger.info({ count: markers.length, file: env.markersFile }, "Markers loaded");
    } catch (err) {
      session.logger.error(err, "Failed to load markers");
      session.layouts.showDoubleTextWall(
        "⚠ MARKER ERROR",
        String((err as Error).message ?? err),
      );
      return;
    }

    // Per-session state (persistence + audit log).
    const state = new SessionState(session, userId, sessionId, env.auditDir);
    const { settings: stored } = await state.load();
    let settings: OperatorSettings = stored;
    const heading = new HeadingEstimator();
    const voice = new VoiceCueing(session, {
      ...DEFAULT_VOICE,
      enabled: settings.voiceEnabled,
    });
    const throttle = new HudThrottle();

    // SFX URL — explicit override or fall back to PUBLIC_BASE_URL/sfx/on-grade.wav.
    const sfxOnGradeUrl =
      env.sfxOnGradeUrl ||
      (env.publicBaseUrl ? `${env.publicBaseUrl.replace(/\/$/, "")}/sfx/on-grade.wav` : "");
    if (!sfxOnGradeUrl) {
      session.logger.warn(
        "No PUBLIC_BASE_URL or SFX_ON_GRADE_URL set; on-grade ding will be skipped.",
      );
    }
    let lastDingState: "on_grade" | "other" = "other";

    // Splash with progress.
    session.layouts.showDoubleTextWall(
      `READY · ${state.doneCount()}/${markers.length} markers`,
      `Waiting for RTK fix…\nIngest: :${env.ingestPort}/gps/ingest`,
    );

    // ── Button handlers ─────────────────────────────────────────────
    // short press = mark done (only when ON GRADE)
    // long press  = undo last completion of currently focused marker
    session.events.onButtonPress(async (data) => {
      const fix = this.ingest.latest(sessionId);
      const ev = evaluate(markers, fix, {
        horizontalToleranceM: settings.horizontalToleranceM ?? env.hTol,
        depthToleranceM: settings.depthToleranceM ?? env.dTol,
        fixStaleMs: env.staleMs,
        isDone: (id) => state.isDone(id),
      });
      if (data.pressType === "short") {
        if (ev.state === "on_grade" && ev.marker && fix) {
          const ground = fix.altitudeM - (fix.antennaHeightM ?? settings.antennaHeightM ?? 0);
          await state.markDone(
            ev.marker,
            fix,
            ground,
            ev.horizontalDistanceM ?? 0,
          );
          session.logger.info({ markerId: ev.marker.id }, "marker marked done");
          if (settings.voiceEnabled) {
            session.audio?.speak?.(`${ev.marker.id} marked done`).catch(() => {});
          }
          throttle.reset();
        } else {
          // Not on grade — speak why
          if (settings.voiceEnabled) {
            session.audio?.speak?.("Not on grade").catch(() => {});
          }
        }
      } else if (data.pressType === "long") {
        // Long press: undo the most-recently-completed marker (best UX is "undo the last
        // one I just did", which is usually the one I'm standing near).
        // We approximate "last one" as: the nearest completed marker.
        if (fix) {
          const nearestDone = pickNearestDone(markers, fix.lat, fix.lon, state);
          if (nearestDone) {
            await state.unmarkDone(nearestDone.id);
            session.logger.info({ markerId: nearestDone.id }, "marker undone");
            if (settings.voiceEnabled) {
              session.audio?.speak?.(`Undid ${nearestDone.id}`).catch(() => {});
            }
            throttle.reset();
          }
        }
      }
    });

    // ── Settings updates ───────────────────────────────────────────
    // Pull live settings from the Mentra settings panel (configured in console.mentraglass.com).
    session.settings?.onChange?.(async () => {
      const next: OperatorSettings = {
        antennaHeightM: numSetting(session, "antennaHeightM", DEFAULT_SETTINGS.antennaHeightM),
        horizontalToleranceM: numSetting(session, "horizontalToleranceM", env.hTol),
        depthToleranceM: numSetting(session, "depthToleranceM", env.dTol),
        voiceEnabled: boolSetting(session, "voiceEnabled", settings.voiceEnabled),
        useClockDirections: boolSetting(session, "useClockDirections", settings.useClockDirections),
      };
      settings = next;
      await state.saveSettings(next);
      session.logger.info({ next }, "operator settings updated");
    });

    // ── Tick: evaluate + render ─────────────────────────────────────
    const tick = setInterval(() => {
      const fix = this.ingest.latest(sessionId);
      if (fix) heading.observe(fix.lat, fix.lon);

      const ev = evaluate(markers, fix, {
        horizontalToleranceM: settings.horizontalToleranceM ?? env.hTol,
        depthToleranceM: settings.depthToleranceM ?? env.dTol,
        fixStaleMs: env.staleMs,
        isDone: (id) => state.isDone(id),
      });

      const warning = fixQualityWarning(fix, settings.depthToleranceM ?? env.dTol);

      const frame = renderHud(ev, {
        headingDeg: heading.current(),
        useClockDirections: settings.useClockDirections,
        qualityWarning: warning,
        progressLabel: `${state.doneCount()}/${markers.length}`,
      });

      if (throttle.shouldSend(frame)) {
        session.layouts.showDoubleTextWall(frame.topText, frame.bottomText);
        try {
          (session.dashboard as { content?: { writeToMain?: (s: string) => void } })
            ?.content?.writeToMain?.(`${frame.topText}\n${frame.bottomText}`);
        } catch {
          // Dashboard isn't available on every device.
        }
      }
      voice.observe(ev);

      // 🔔 Ding once on the transition INTO on_grade (not every tick we're on grade).
      if (ev.state === "on_grade" && lastDingState !== "on_grade") {
        if (sfxOnGradeUrl) {
          session.audio
            ?.playAudio?.({ audioUrl: sfxOnGradeUrl, volume: 0.85, stopOtherAudio: false })
            ?.catch?.((err: unknown) => session.logger.debug(err, "on-grade ding failed"));
        }
        lastDingState = "on_grade";
      } else if (ev.state !== "on_grade") {
        lastDingState = "other";
      }
    }, 250);
    this.tickers.set(sessionId, tick);

    session.events.onDisconnected(() => {
      clearInterval(tick);
      this.tickers.delete(sessionId);
      this.ingest.forget(sessionId);
      session.logger.info("Session closed, ticker cleaned up");
    });
  }

  async startIngest() {
    await this.ingest.listen(env.ingestPort);
    // eslint-disable-next-line no-console
    console.log(`📡 GPS ingest + as-built API listening on :${env.ingestPort}`);
  }
}

function pickNearestDone(
  markers: DigMarker[],
  lat: number,
  lon: number,
  state: SessionState,
): DigMarker | null {
  let best: DigMarker | null = null;
  let bestD = Infinity;
  for (const m of markers) {
    if (!state.isDone(m.id)) continue;
    const dLat = (m.lat - lat) * 111_111;
    const dLon = (m.lon - lon) * 111_111 * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

function numSetting(session: AppSession, key: string, fallback: number): number {
  const v = session.settings?.get?.(key);
  const n = typeof v === "number" ? v : v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function boolSetting(session: AppSession, key: string, fallback: boolean): boolean {
  const v = session.settings?.get?.(key);
  return typeof v === "boolean" ? v : fallback;
}

const server = new StreamRestorationApp({
  packageName: env.packageName,
  apiKey: env.apiKey,
  port: env.port,
});

await server.startIngest();
await server.start();
// eslint-disable-next-line no-console
console.log(`👓 Mentra app listening on :${env.port}  (package=${env.packageName})`);
