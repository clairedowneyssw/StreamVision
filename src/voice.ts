/**
 * Voice / TTS controller.
 *
 * `session.audio.speak()` is asynchronous and Mentra will queue/cut audio if you spam it.
 * We rate-limit by:
 *   - One utterance per state change (we don't re-speak "on grade" every tick)
 *   - Minimum 1500ms between utterances
 *   - Distance/depth utterances coalesced — we say "dig 18 centimeters" once when the
 *     reading is stable, not every time it ticks 17 → 18 → 17.
 */

import type { AppSession } from "@mentra/sdk";
import type { DepthEvaluation } from "./types.js";

export interface VoiceConfig {
  enabled: boolean;
  /** Minimum ms between any two utterances. */
  minIntervalMs: number;
  /** Suppress depth re-announcement unless the cm value changed by at least this much. */
  cmChangeThreshold: number;
}

export const DEFAULT_VOICE: VoiceConfig = {
  enabled: true,
  minIntervalMs: 1500,
  cmChangeThreshold: 5,
};

export class VoiceCueing {
  private lastUtterAt = 0;
  private lastState: DepthEvaluation["state"] | null = null;
  private lastSpokenCm: number | null = null;

  constructor(
    private readonly session: AppSession,
    private readonly config: VoiceConfig,
  ) {}

  /** Decide whether to speak something for this evaluation, and do it. Fire-and-forget. */
  observe(ev: DepthEvaluation): void {
    if (!this.config.enabled) return;
    const now = Date.now();
    if (now - this.lastUtterAt < this.config.minIntervalMs) return;

    const phrase = this.phraseFor(ev);
    if (!phrase) return;

    this.lastUtterAt = now;
    this.lastState = ev.state;
    this.session.audio
      ?.speak?.(phrase, { volume: 0.9 })
      ?.catch((err) => this.session.logger.debug(err, "TTS speak failed"));
  }

  private phraseFor(ev: DepthEvaluation): string | null {
    // State change always speaks (e.g. arriving on grade).
    const stateChanged = ev.state !== this.lastState;

    switch (ev.state) {
      case "no_fix":
        return stateChanged ? "Lost RTK fix" : null;

      case "out_of_range":
        // Only announce on first entry — a continuous "still 4 meters away" stream
        // would be annoying. The HUD handles approach.
        return stateChanged && ev.marker
          ? `Approach ${spokenId(ev.marker.id)}`
          : null;

      case "on_grade":
        if (stateChanged) {
          this.lastSpokenCm = 0;
          return `On grade. ${spokenId(ev.marker?.id ?? "")} — hold.`;
        }
        return null;

      case "too_high":
      case "too_deep": {
        const cm = Math.round(Math.abs(ev.cutFillM ?? 0) * 100);
        const verb = ev.state === "too_high" ? "dig" : "fill";
        // Speak on state change, OR when the cm reading changed enough since last spoken.
        if (
          stateChanged ||
          this.lastSpokenCm == null ||
          Math.abs(cm - this.lastSpokenCm) >= this.config.cmChangeThreshold
        ) {
          this.lastSpokenCm = cm;
          return `${verb} ${cm} centimeters`;
        }
        return null;
      }
    }
  }

  reset() {
    this.lastUtterAt = 0;
    this.lastState = null;
    this.lastSpokenCm = null;
  }
}

/** Read a marker id naturally — "M01" → "marker zero one". */
function spokenId(id: string): string {
  if (!id) return "";
  // Replace "M" prefix and split digits to make TTS read each digit clearly.
  const m = id.match(/^M0*(\d+)$/i);
  if (m) return `marker ${m[1]}`;
  return id.replace(/(\d)/g, " $1");
}
