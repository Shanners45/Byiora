// Nepali voice-over for the Merchant Portal ad (Microsoft Edge neural TTS) -> public/voice-merchant/<id>.wav
// Two businessmen = Sagar at two pitches; narrator = Hemkala.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const A = { voice: "ne-NP-SagarNeural", rate: "+15%", pitch: "+8Hz" }; // worried shop owner
const B = { voice: "ne-NP-SagarNeural", rate: "+12%", pitch: "-14Hz" }; // calm friend, deeper
const N = { voice: "ne-NP-HemkalaNeural", rate: "+15%", pitch: "+0Hz" }; // narrator

export const LINES = [
  { id: "m1", ...A, text: "यार, अनलाइन गिफ्ट कार्ड बिजनेसमा घाटा मात्र भइरह्यो। सप्लायरको डेलिभरी ढिलो, भाउ पनि महँगो!" },
  { id: "m2", ...B, text: "चिन्ता नगर साथी! बायोरा मर्चेन्ट पोर्टल चलाऊ।" },
  { id: "f1", ...N, text: "इन्स्ट्यान्ट डेलिभरी। अर्डर गर्नासाथ कोड तुरुन्तै, API वा ड्यासबोर्डबाट।" },
  { id: "f2", ...N, text: "शून्य रुपैयाँबाट सुरु। कुनै सेटअप शुल्क छैन।" },
  { id: "f3", ...N, text: "प्रिपेड वालेट। फोनपे क्यूआर वा बैंक ट्रान्सफरबाट टप-अप।" },
  { id: "f4", ...N, text: "निःशुल्क API इन्टिग्रेसन। पूरा डक्स, टेस्ट की र वेबहुक।" },
  { id: "f5", ...N, text: "होलसेल मर्चेन्ट भाउमा किन्नुहोस्, आफ्नै भाउमा बेच्नुहोस्।" },
  { id: "m3", ...A, text: "वाह! अब त मेरो बिजनेस फेरि दौडिन्छ!" },
  { id: "cta", ...N, text: "बायोरा मर्चेन्ट बन्नुहोस्। इनभाइटका लागि आजै बायोरालाई सम्पर्क गर्नुहोस्।" },
];

const out = path.resolve("public/voice-merchant");
fs.mkdirSync(out, { recursive: true });
for (const l of LINES) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(l.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const tmp = path.join(out, "_tmp_" + l.id);
  fs.mkdirSync(tmp, { recursive: true });
  const { audioFilePath } = await tts.toFile(tmp, l.text, { rate: l.rate, pitch: l.pitch });
  const mp3 = path.join(out, l.id + ".mp3");
  fs.renameSync(audioFilePath, mp3);
  fs.rmSync(tmp, { recursive: true, force: true });
  tts.close();
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-v", "error", "-i", mp3, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "pcm_s16le", path.join(out, l.id + ".wav")], { shell: true });
  console.log("ok", l.id);
}
