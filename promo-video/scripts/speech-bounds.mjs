// Prints speech start/end (seconds) of each voice clip by decoding to WAV and thresholding.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const tmp = path.join(os.tmpdir(), "byiora-voice-probe.wav");
const DIR = process.argv[2] || "public/voice";
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".mp3"))) {
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-v", "error", "-i", `${DIR}/${f}`, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", tmp], { shell: true });
  const buf = fs.readFileSync(tmp);
  const d = buf.indexOf("data") + 8;
  const n = (buf.length - d) / 2, win = 160; let first = -1, last = -1;
  for (let i = 0; i + win <= n; i += win) {
    let e = 0; for (let j = 0; j < win; j++) e = Math.max(e, Math.abs(buf.readInt16LE(d + (i + j) * 2)));
    if (e > 1200) { if (first < 0) first = i; last = i + win; }
  }
  console.log(f, (first / 16000).toFixed(2), (last / 16000).toFixed(2), (n / 16000).toFixed(2));
}
