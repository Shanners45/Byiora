// Synthesizes an original, royalty-free upbeat background track -> public/music.wav
// 120 BPM, I–V–vi–IV progression in C major: kick, clap, hats, bass, chord stabs, pluck arpeggio.
import fs from "node:fs";

const SR = 44100;
const DUR = Number(process.argv[2] || 31); // seconds
const OUT_FILE = process.argv[3] || "public/music.wav";
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const N = Math.floor(SR * DUR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

function add(t0, len, fn, gain = 1, pan = 0) {
  const s0 = Math.floor(t0 * SR);
  const n = Math.floor(len * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const v = fn(i / SR);
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

const kick = (t) => {
  const f = 45 + 110 * Math.exp(-t * 28);
  return Math.sin(2 * Math.PI * f * t - 0) * Math.exp(-t * 7) * 0.95;
};
const clap = () => {
  let lp = 0;
  return (t) => {
    const n = rnd();
    lp += 0.45 * (n - lp);
    const env = Math.exp(-t * 22) + 0.4 * Math.exp(-Math.max(0, t - 0.012) * 30) * (t > 0.012 ? 1 : 0);
    return (n - lp) * env * 0.5;
  };
};
const hat = () => {
  let prev = 0;
  return (t) => {
    const n = rnd();
    const hp = n - prev;
    prev = n;
    return hp * Math.exp(-t * 60) * 0.18;
  };
};
const bassNote = (m) => {
  const f = midi(m);
  let lp = 0;
  return (t) => {
    const saw = 2 * ((f * t) % 1) - 1;
    lp += 0.08 * (saw - lp);
    return (lp * 0.8 + Math.sin(2 * Math.PI * f * t) * 0.6) * Math.min(1, t * 200) * Math.exp(-t * 3.5);
  };
};
const pluck = (m, bright = 0.25, decay = 5) => {
  const f = midi(m);
  let lp = 0;
  return (t) => {
    const saw = 2 * ((f * t) % 1) - 1 + 0.5 * (2 * ((f * 1.005 * t) % 1) - 1);
    const a = bright * Math.exp(-t * 6) + 0.04;
    lp += a * (saw - lp);
    return lp * Math.min(1, t * 400) * Math.exp(-t * decay);
  };
};
const bell = (m) => {
  const f = midi(m);
  return (t) => (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t) + 0.15 * Math.sin(2 * Math.PI * f * 3.98 * t)) * Math.exp(-t * 4) * Math.min(1, t * 300);
};

// C, G, Am, F
const CHORDS = [
  { root: 36, tones: [60, 64, 67] },
  { root: 43, tones: [59, 62, 67] },
  { root: 45, tones: [60, 64, 69] },
  { root: 41, tones: [60, 65, 69] },
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
const bars = Math.ceil(DUR / BAR);
const END_T = DUR - 2; // final hit

for (let b = 0; b < bars; b++) {
  const t0 = b * BAR;
  if (t0 >= END_T) break;
  const ch = CHORDS[b % 4];
  const intro = b < 1; // first bar: no drums, just chords + arp (under dialogue start)
  for (let beat = 0; beat < 4; beat++) {
    const tb = t0 + beat * BEAT;
    if (tb >= END_T) break;
    if (!intro) {
      add(tb, 0.5, kick, 0.9);
      if (beat % 2 === 1) add(tb, 0.25, clap(), 0.8, 0.05);
      add(tb + BEAT / 2, 0.08, hat(), 0.9, 0.3);
      add(tb + BEAT / 4 * 3, 0.05, hat(), 0.5, -0.3);
    }
    // bass on 8ths with octave bounce
    add(tb, BEAT / 2, bassNote(ch.root), intro ? 0.25 : 0.42);
    add(tb + BEAT / 2, BEAT / 2, bassNote(ch.root + 12), intro ? 0.18 : 0.3);
  }
  // chord stabs on offbeats of beat 1 and 3 (push)
  for (const off of [0, BEAT * 1.5, BEAT * 2.5]) {
    if (t0 + off >= END_T) continue;
    ch.tones.forEach((m, i) => add(t0 + off, 0.6, pluck(m, 0.18, 6), 0.11, (i - 1) * 0.35));
  }
  // arpeggio in 8ths, one octave up
  for (let k = 0; k < 8; k++) {
    const tk = t0 + k * BEAT / 2;
    if (tk >= END_T) break;
    add(tk, 0.5, bell(ch.tones[ARP[k]] + 12), 0.07, k % 2 ? 0.4 : -0.4);
  }
}
// final hit
add(END_T, 2.0, kick, 1);
[48, 60, 64, 67, 72].forEach((m, i) => add(END_T, 2.0, pluck(m, 0.2, 1.6), 0.13, (i - 2) * 0.2));
add(END_T, 2.0, bell(84), 0.1);

// master: fade in/out, soft clip, normalize
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.6) * Math.min(1, Math.max(0, (DUR - t) / 1.0));
  L[i] = Math.tanh(L[i] * 1.2) * fade;
  R[i] = Math.tanh(R[i] * 1.2) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = 0.89 / peak;
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(L[i] * g * 32767), i * 4);
  data.writeInt16LE(Math.round(R[i] * g * 32767), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
h.write("data", 36); h.writeUInt32LE(data.length, 40);
fs.writeFileSync(OUT_FILE, Buffer.concat([h, data]));
console.log("wrote", OUT_FILE, DUR, "s");
