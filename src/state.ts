/**
 * Per-session persistent state.
 *
 * Uses Mentra's SimpleStorage (debounced cloud-synced KV per userId+packageName) for things
 * that need to survive session reconnects: completed markers, settings overrides, current
 * marker focus.
 *
 * Also writes an as-built audit log to local disk on the server side — stream restoration
 * projects almost always have to deliver as-built drawings + spreadsheets to permitting
 * agencies (NRCS, Army Corps, state DEQ), so we capture target vs achieved on every
 * completion. This file is the source of truth, not the cloud KV.
 */

import { mkdir, appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AppSession } from "@mentra/sdk";
import type { DigMarker, RtkFix } from "./types.js";

const KEY_DONE = "completed_markers_v1";
const KEY_SETTINGS = "operator_settings_v1";

export interface OperatorSettings {
  /** Vertical offset from antenna phase center to the cut/fill point (meters, positive = above ground). */
  antennaHeightM: number;
  /** Horizontal tolerance override (meters). */
  horizontalToleranceM?: number;
  /** Depth tolerance override (meters). */
  depthToleranceM?: number;
  /** Whether to speak HUD state changes via TTS. */
  voiceEnabled: boolean;
  /** Whether to use clock-face directions (12=ahead) instead of compass abbreviations. */
  useClockDirections: boolean;
}

export const DEFAULT_SETTINGS: OperatorSettings = {
  antennaHeightM: 0,
  voiceEnabled: true,
  useClockDirections: false,
};

export interface AsBuiltRecord {
  markerId: string;
  label?: string;
  targetElevationM: number;
  achievedElevationM: number;
  cutFillM: number;
  hAccuracyM?: number;
  vAccuracyM?: number;
  fixQuality?: number;
  fixLat: number;
  fixLon: number;
  markerLat: number;
  markerLon: number;
  horizontalOffsetM: number;
  userId: string;
  sessionId: string;
  timestamp: string; // ISO
}

export class SessionState {
  private completed = new Set<string>();

  constructor(
    private readonly session: AppSession,
    private readonly userId: string,
    private readonly sessionId: string,
    private readonly auditDir: string,
  ) {}

  async load(): Promise<{ settings: OperatorSettings }> {
    let settings = { ...DEFAULT_SETTINGS };
    try {
      const stored = await this.session.simpleStorage?.get?.(KEY_DONE);
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        for (const id of arr) this.completed.add(id);
      }
      const raw = await this.session.simpleStorage?.get?.(KEY_SETTINGS);
      if (raw) settings = { ...settings, ...(JSON.parse(raw) as Partial<OperatorSettings>) };
    } catch (err) {
      this.session.logger.warn(err, "SessionState: failed to load from simpleStorage");
    }
    return { settings };
  }

  isDone(markerId: string): boolean {
    return this.completed.has(markerId);
  }

  doneCount(): number {
    return this.completed.size;
  }

  async markDone(marker: DigMarker, fix: RtkFix, achievedElevationM: number, horizontalOffsetM: number): Promise<void> {
    if (this.completed.has(marker.id)) return;
    this.completed.add(marker.id);
    await this.persistCompleted();
    await this.appendAuditLog({
      markerId: marker.id,
      label: marker.label,
      targetElevationM: marker.targetElevationM,
      achievedElevationM,
      cutFillM: achievedElevationM - marker.targetElevationM,
      hAccuracyM: fix.hAccuracyM,
      vAccuracyM: fix.vAccuracyM,
      fixQuality: fix.fixQuality,
      fixLat: fix.lat,
      fixLon: fix.lon,
      markerLat: marker.lat,
      markerLon: marker.lon,
      horizontalOffsetM,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date(fix.timestampMs).toISOString(),
    });
  }

  async unmarkDone(markerId: string): Promise<boolean> {
    if (!this.completed.delete(markerId)) return false;
    await this.persistCompleted();
    return true;
  }

  async saveSettings(settings: OperatorSettings): Promise<void> {
    try {
      await this.session.simpleStorage?.set?.(KEY_SETTINGS, JSON.stringify(settings));
    } catch (err) {
      this.session.logger.warn(err, "SessionState: failed to persist settings");
    }
  }

  private async persistCompleted(): Promise<void> {
    try {
      await this.session.simpleStorage?.set?.(
        KEY_DONE,
        JSON.stringify([...this.completed]),
      );
    } catch (err) {
      this.session.logger.warn(err, "SessionState: failed to persist completed list");
    }
  }

  private async appendAuditLog(rec: AsBuiltRecord): Promise<void> {
    const path = join(this.auditDir, `${this.userId}.csv`);
    const isNew = !existsSync(path);
    if (!existsSync(dirname(path))) {
      await mkdir(dirname(path), { recursive: true });
    }
    const header =
      "timestamp,userId,sessionId,markerId,label,targetElevationM,achievedElevationM,cutFillM," +
      "hAccuracyM,vAccuracyM,fixQuality,fixLat,fixLon,markerLat,markerLon,horizontalOffsetM\n";
    const row =
      [
        rec.timestamp,
        rec.userId,
        rec.sessionId,
        rec.markerId,
        csvEscape(rec.label ?? ""),
        rec.targetElevationM.toFixed(4),
        rec.achievedElevationM.toFixed(4),
        rec.cutFillM.toFixed(4),
        rec.hAccuracyM?.toFixed(4) ?? "",
        rec.vAccuracyM?.toFixed(4) ?? "",
        rec.fixQuality ?? "",
        rec.fixLat.toFixed(8),
        rec.fixLon.toFixed(8),
        rec.markerLat.toFixed(8),
        rec.markerLon.toFixed(8),
        rec.horizontalOffsetM.toFixed(3),
      ].join(",") + "\n";
    if (isNew) await appendFile(path, header, "utf8");
    await appendFile(path, row, "utf8");
    this.session.logger.info({ rec }, "as-built record appended");
  }

  static async readAuditLog(auditDir: string, userId: string): Promise<string> {
    const path = join(auditDir, `${userId}.csv`);
    if (!existsSync(path)) return "";
    return await readFile(path, "utf8");
  }
}

function csvEscape(s: string): string {
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
