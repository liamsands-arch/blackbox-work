// Original soundtrack for the VG Brain brag: 120 BPM, A minor, 21s. Everything on one 16th grid.
const fs = require("fs");
const SR = 44100, DUR = 21.0, N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const BEAT = 0.5, S16 = BEAT / 4;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 12345; const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
function add(t0, fn, len, gain = 1, pan = 0) {
  const i0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && i0 + i < N; i++) { if (i0 + i < 0) continue; const v = fn(i / SR); L[i0 + i] += v * gl; R[i0 + i] += v * gr; }
}
// chords per bar (2s): Am F C G Am F C G | F (16-18) | Am (18-21)
const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62], [57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62], [53, 57, 60], [57, 60, 64], [57, 60, 64]];
const ROOT = [45, 41, 48, 43, 45, 41, 48, 43, 41, 45, 45];
const chordAt = (t) => CH[Math.min(CH.length - 1, Math.floor(t / 2))];

// ---- pad: soft detuned partials, one-pole smoothed, slow swell ----
for (let bar = 0; bar < 11; bar++) {
  const t0 = bar * 2, len = bar === 9 ? 3.2 : 2.25;
  const notes = CH[bar];
  const g = bar === 0 ? 0.085 : bar >= 8 ? 0.1 : 0.06;
  for (const m of notes) for (const det of [-0.08, 0.08]) {
    const f = mtof(m + 12 + det);
    add(t0, (t) => {
      const a = Math.min(1, t / 0.35) * Math.min(1, (len - t) / 0.4);
      return a * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t));
    }, len, g / notes.length, det < 0 ? -0.35 : 0.35);
  }
}
// ---- drums: 3.0-17.0 ----
const drumOn = (t) => t >= 3.0 - 1e-6 && t < 17.0 - 1e-6;
for (let k = 0; k < DUR / BEAT; k++) {
  const t = k * BEAT;
  if (drumOn(t) || Math.abs(t - 17.0) < 1e-6) {
    const big = Math.abs(t - 17.0) < 1e-6 || Math.abs(t - 3.0) < 1e-6;
    add(t, (x) => { const f = 45 + 75 * Math.exp(-x * 30); return Math.sin(2 * Math.PI * f * x - 0) * Math.exp(-x * 9); }, 0.4, big ? 0.55 : 0.42);
  }
  if (drumOn(t) && (k % 4 === 1 || k % 4 === 3)) { // backbeat clap: filtered noise bursts
    let lp = 0;
    add(t, (x) => { const n = noise(); lp += 0.35 * (n - lp); const env = (x < 0.012 ? 1 : 0.6) * Math.exp(-x * 22); return (n - lp) * env; }, 0.25, 0.16, 0.1);
  }
}
for (let k = 0; k < DUR / (BEAT / 2); k++) { // offbeat hats
  const t = k * BEAT / 2; if (!drumOn(t) || k % 2 === 0) continue;
  let lp = 0; add(t, (x) => { const n = noise(); lp += 0.6 * (n - lp); return (n - lp) * Math.exp(-x * 60); }, 0.08, 0.07, -0.25);
}
// ---- bass: 8ths on the root, 3.0-17.0 ----
for (let k = 6 * 2; k < 34; k++) { // 8th notes from 3.0 (k*0.25)
  const t = k * 0.25; if (!drumOn(t)) continue;
  const bar = Math.floor(t / 2), f = mtof(ROOT[bar] - 12 + (k % 4 === 3 ? 12 : 0));
  add(t, (x) => { const e = Math.min(1, x / 0.005) * Math.exp(-x * 5); return e * (Math.sin(2 * Math.PI * f * x) + 0.25 * Math.sin(4 * Math.PI * f * x)); }, 0.24, 0.17);
}
// ---- arp pluck: 16ths, chord tones, 5.0-16.0, quiet ----
for (let k = 0; k < DUR / S16; k++) {
  const t = k * S16; if (t < 5.0 || t >= 16.0) continue;
  const ch = chordAt(t), m = ch[k % ch.length] + 24 + (k % 8 >= 4 ? 0 : 0);
  const f = mtof(m), acc = k % 4 === 0 ? 1 : 0.6;
  add(t, (x) => Math.exp(-x * 18) * (Math.sin(2 * Math.PI * f * x) + 0.15 * Math.sin(6 * Math.PI * f * x)), 0.2, 0.035 * acc, (k % 2 ? 0.4 : -0.4));
}
// ---- risers into 3.0 and 17.0 ----
for (const [a, b] of [[2.0, 3.0], [16.0, 17.0]]) {
  let lp = 0; add(a, (x) => { const p = x / (b - a); const n = noise(); lp += (0.02 + 0.5 * p) * (n - lp); return lp * p * p; }, b - a, 0.35);
}
// ---- SFX in key, on the grid ----
const tick = (t, m, g) => add(t, (x) => Math.exp(-x * 90) * Math.sin(2 * Math.PI * mtof(m) * x), 0.05, g, 0.2);
for (let t = 0.625; t < 2.375; t += S16) tick(t, 88, 0.035);          // typing, scene 1 (E6)
for (let t = 8.25; t < 9.375; t += S16) tick(t, 88, 0.03);            // typing, scene 3
const pop = (t, m, g = 0.13) => add(t, (x) => { const f = mtof(m) * (1 + 0.6 * Math.exp(-x * 40)); return Math.exp(-x * 14) * Math.sin(2 * Math.PI * f * x); }, 0.3, g);
pop(2.5, 76); pop(3.5, 81); pop(10.0, 81); pop(13.0, 76, 0.1); pop(13.5, 79, 0.1); pop(15.0, 76, 0.11);
for (const [i, m] of [[0, 81], [1, 84], [2, 88]]) pop(15.25 + i * S16, m, 0.09);   // saved chime A-C-E
for (const [i, m] of [[0, 81], [1, 84], [2, 88]]) pop(10.0 + i * S16, m, 0.07);
// ---- outro bell motif: E5 C5 A4 on beats, then hold ----
[[17.5, 76], [18.0, 72], [18.5, 69], [19.5, 76], [20.0, 81]].forEach(([t, m]) =>
  add(t, (x) => Math.exp(-x * 3.2) * (Math.sin(2 * Math.PI * mtof(m) * x) + 0.4 * Math.sin(2 * Math.PI * mtof(m) * 2.76 * x) * Math.exp(-x * 6)), 1.4, 0.11, 0));

// ---- master: fade tail, soft clip, normalize, light stereo room ----
const out = Buffer.alloc(44 + N * 4);
let peak = 0;
const dl = Math.round(0.021 * SR), dr = Math.round(0.027 * SR);
const L2 = new Float32Array(N), R2 = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.08) * Math.min(1, (DUR - t) / 0.9);
  L2[i] = Math.tanh((L[i] + 0.18 * (i > dr ? R[i - dr] : 0)) * 1.1) * fade;
  R2[i] = Math.tanh((R[i] + 0.18 * (i > dl ? L[i - dl] : 0)) * 1.1) * fade;
  peak = Math.max(peak, Math.abs(L2[i]), Math.abs(R2[i]));
}
const norm = 0.89 / peak;
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8); out.write("fmt ", 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L2[i] * norm * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R2[i] * norm * 32767), 46 + i * 4); }
fs.writeFileSync(__dirname + "/music.wav", out);
console.log("wrote music.wav, peak", peak.toFixed(3));
