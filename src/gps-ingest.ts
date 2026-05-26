/**
 * GPS ingest server + as-built download API.
 *
 * Mentra cloud apps can't talk to a Bluetooth-paired RTK receiver directly. The pattern we use:
 * a small companion process — running on the operator's phone, on the receiver itself if it has
 * Wi-Fi/cell, or on a base station — POSTs each fix to this endpoint. We hold the most recent fix
 * per session and the main app reads it on a tick.
 *
 *   POST /gps/ingest
 *   Authorization: Bearer <GPS_INGEST_TOKEN>
 *   Body: { sessionId, lat, lon, altitudeM, antennaHeightM?, fixQuality?, hAccuracyM?, vAccuracyM?, timestampMs? }
 *
 *   GET /asbuilt/:userId.csv     — download as-built audit log for a user (for permitting docs)
 *   Authorization: Bearer <GPS_INGEST_TOKEN>
 *
 * Multiple sessions are keyed by sessionId so different crews on different sites don't collide.
 */

import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RtkFix } from "./types.js";

const FixBody = z.object({
  sessionId: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  altitudeM: z.number(),
  antennaHeightM: z.number().optional(),
  fixQuality: z.number().int().optional(),
  hAccuracyM: z.number().nonnegative().optional(),
  vAccuracyM: z.number().nonnegative().optional(),
  timestampMs: z.number().int().optional(),
});

export class GpsIngest {
  private fixes = new Map<string, RtkFix>();
  private app = express();

  constructor(
    private readonly token: string,
    private readonly auditDir: string,
  ) {
    this.app.use(express.json({ limit: "32kb" }));
    this.app.post("/gps/ingest", (req, res) => this.handlePost(req, res));
    this.app.get("/gps/latest/:sessionId", (req, res) => this.handleGet(req, res));
    this.app.get("/asbuilt/:userId.csv", (req, res) => this.handleAsBuilt(req, res));
    this.app.get("/health", (_req, res) => res.json({ ok: true }));
  }

  /** Get the latest fix for a session, or null if none. */
  latest(sessionId: string): RtkFix | null {
    return this.fixes.get(sessionId) ?? null;
  }

  /** Drop a session's cached fix (call on disconnect). */
  forget(sessionId: string): void {
    this.fixes.delete(sessionId);
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => resolve());
    });
  }

  private handlePost(req: Request, res: Response) {
    if (!this.checkAuth(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const parsed = FixBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "bad_request", issues: parsed.error.issues });
    }
    const b = parsed.data;
    const fix: RtkFix = {
      lat: b.lat,
      lon: b.lon,
      altitudeM: b.altitudeM,
      antennaHeightM: b.antennaHeightM,
      fixQuality: b.fixQuality,
      hAccuracyM: b.hAccuracyM,
      vAccuracyM: b.vAccuracyM,
      timestampMs: b.timestampMs ?? Date.now(),
    };
    this.fixes.set(b.sessionId, fix);
    res.json({ ok: true });
  }

  private handleGet(req: Request, res: Response) {
    if (!this.checkAuth(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const fix = this.fixes.get(req.params.sessionId);
    if (!fix) return res.status(404).json({ error: "no_fix" });
    res.json(fix);
  }

  private async handleAsBuilt(req: Request, res: Response) {
    if (!this.checkAuth(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const userId = req.params.userId;
    if (!/^[a-zA-Z0-9._-]+$/.test(userId)) {
      return res.status(400).json({ error: "bad_userId" });
    }
    const path = join(this.auditDir, `${userId}.csv`);
    if (!existsSync(path)) {
      return res.status(404).json({ error: "no_audit_log_for_user" });
    }
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader(
      "content-disposition",
      `attachment; filename="asbuilt-${userId}.csv"`,
    );
    res.send(await readFile(path, "utf8"));
  }

  private checkAuth(req: Request): boolean {
    const header = req.header("authorization") ?? "";
    return header === `Bearer ${this.token}`;
  }
}
