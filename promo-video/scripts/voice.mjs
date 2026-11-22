// Generates Nepali voice-over lines with Microsoft Edge neural TTS (ne-NP voices) into public/voice/.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";

const LINES = [
  { id: "q", voice: "ne-NP-SagarNeural", rate: "+22%", pitch: "+4Hz", text: "साथी, गिफ्ट कार्ड सस्तोमा कहाँ किन्ने? भरपर्दो साइट थाहा छ?" },
  { id: "a", voice: "ne-NP-HemkalaNeural", rate: "+22%", pitch: "+0Hz", text: "बायोरा डट कम डट एनपी! सस्तो पनि, भरपर्दो पनि!" },
  { id: "s1", voice: "ne-NP-SagarNeural", rate: "+18%", pitch: "+0Hz", text: "पहिले, बायोरा डट कम डट एनपी खोल्नुहोस्।" },
  { id: "s2", voice: "ne-NP-SagarNeural", rate: "+18%", pitch: "+0Hz", text: "स्टिम गिफ्ट कार्ड छान्नुहोस्।" },
  { id: "s3", voice: "ne-NP-SagarNeural", rate: "+18%", pitch: "+0Hz", text: "चार सय पचास रुपैयाँको भाउचर रोज्नुहोस्।" },
  { id: "s4", voice: "ne-NP-SagarNeural", rate: "+18%", pitch: "+0Hz", text: "आफ्नो इमेल हाल्नुहोस्।" },
  { id: "s5", voice: "ne-NP-SagarNeural", rate: "+18%", pitch: "+0Hz", text: "अनि फोनपे क्यूआरबाट सजिलै तिर्नुहोस्।" },
  { id: "end", voice: "ne-NP-HemkalaNeural", rate: "+15%", pitch: "+0Hz", text: "बायोरा डट कम डट एनपी। अहिले नै किन्नुहोस्!" },
];

const out = path.resolve("public/voice");
fs.mkdirSync(out, { recursive: true });
for (const l of LINES) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(l.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const tmp = path.join(out, "_tmp_" + l.id);
  fs.mkdirSync(tmp, { recursive: true });
  const { audioFilePath } = await tts.toFile(tmp, l.text, { rate: l.rate, pitch: l.pitch });
  fs.renameSync(audioFilePath, path.join(out, l.id + ".mp3"));
  fs.rmSync(tmp, { recursive: true, force: true });
  tts.close();
  console.log("ok", l.id);
}

// Loudness-normalise each line to ~-14 LUFS (social-media level) -> public/voice/<id>.wav
const { execFileSync } = await import("node:child_process");
for (const l of LINES) {
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-v", "error", "-i", path.join(out, l.id + ".mp3"),
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "pcm_s16le", path.join(out, l.id + ".wav")], { shell: true });
  console.log("normalised", l.id);
}
