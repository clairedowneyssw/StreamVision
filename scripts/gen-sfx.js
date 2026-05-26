#!/usr/bin/env node
/**
 * Generates the on-grade ding WAV.
 *
 * Two-tone chime (880Hz → 1320Hz, perfect fifth-ish), each with exponential decay.
 * Mono 16-bit PCM at 44.1 kHz — small file, plays on anything.
 *
 * Run when you want to retune the sound:
 *   node scripts/gen-sfx.js
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const sampleRate = 44100;
const tones = [
  { freq: 880,  durMs: 120, gain: 0.6, attack: 0.005, decay: 0.20 },
  { freq: 1320, durMs: 280, gain: 0.7, attack: 0.005, decay: 0.30 },
];

let totalSamples = 0;
for (const t of tones) totalSamples += Math.floor((t.durMs / 1000) * sampleRate);
const samples = new Int16Array(totalSamples);

let off = 0;
for (const t of tones) {
  const n = Math.floor((t.durMs / 1000) * sampleRate);
  for (let i = 0; i < n; i++) {
    const time = i / sampleRate;
    const env = Math.exp(-time / t.decay) * Math.min(1, time / t.attack);
    const v = Math.sin(2 * Math.PI * t.freq * time) * t.gain * env;
    samples[off + i] = Math.max(-1, Math.min(1, v)) * 32767;
  }
  off += n;
}

const dataBytes = samples.length * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataBytes, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);                  // PCM
buf.writeUInt16LE(1, 22);                  // mono
buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * 2, 28);     // byte rate
buf.writeUInt16LE(2, 32);                  // block align
buf.writeUInt16LE(16, 34);                 // bits/sample
buf.write("data", 36);
buf.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);

const out = "public/sfx/on-grade.wav";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`Wrote ${buf.length} bytes → ${out}  (~${(totalSamples / sampleRate).toFixed(2)}s)`);
