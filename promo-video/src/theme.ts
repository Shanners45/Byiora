import { loadFont } from "@remotion/google-fonts/NotoSansDevanagari";

export const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800", "900"],
  subsets: ["devanagari", "latin"],
});

export const C = {
  purple: "#7E3AF2",
  purpleDeep: "#4C1D95",
  purpleDark: "#2E1065",
  amber: "#F59E0B",
  yellow: "#FFD700",
  white: "#FFFFFF",
  ink: "#1F1235",
};

export const FPS = 30;

// Website walkthrough segments: [start sec in demo.webm, end sec, playbackRate, Nepali caption, English caption]
export type Segment = {
  from: number;
  to: number;
  rate: number;
  ne: string;
  en: string;
};
export const SEGMENTS: Segment[] = [
  {
    from: 1.0,
    to: 15.5,
    rate: 3.6,
    ne: "byiora.com.np खोल्नुहोस्",
    en: "Open byiora.com.np",
  },
  {
    from: 15.5,
    to: 22.5,
    rate: 2,
    ne: "Steam Gift Card छान्नुहोस्",
    en: "Tap Steam Gift Card",
  },
  {
    from: 22.5,
    to: 31,
    rate: 2.2,
    ne: "Rs. 450 भाउचर रोज्नुहोस्",
    en: "Select the Rs. 450 voucher",
  },
  {
    from: 31,
    to: 38,
    rate: 2,
    ne: "आफ्नो इमेल हाल्नुहोस्",
    en: "Enter your email",
  },
  {
    from: 38,
    to: 45.3,
    rate: 2,
    ne: "Fonepay QR बाट तिर्नुहोस्",
    en: "Pay with Fonepay QR",
  },
];
export const segFrames = (s: Segment) =>
  Math.round(((s.to - s.from) * FPS) / s.rate);
export const WALK_FRAMES = SEGMENTS.reduce((a, s) => a + segFrames(s), 0);
export const INTRO_FRAMES = 255;
export const END_FRAMES = 130;
export const TRANSITION = 15;
export const TOTAL_FRAMES =
  INTRO_FRAMES + WALK_FRAMES + END_FRAMES - 2 * TRANSITION;

// Voice-over timing (frames, relative to their scene). Speech bounds measured with scripts/speech-bounds.mjs.
export const Q_START = 10; // q.mp3 speech ~0.18s-3.78s
export const A_START = 128; // a.mp3 speech ~0.15s-3.64s
export const STEP_VOICE_DELAY = 4;
export const END_VOICE_START = 8;
const STEP_SPEECH_END = [2.41, 1.55, 2.28, 1.27, 2.25];

// Global speech windows [start, end] in frames, used to duck the music.
export const voiceWindows = (): [number, number][] => {
  const w: [number, number][] = [
    [Q_START + 5, Q_START + 114],
    [A_START + 5, A_START + 110],
  ];
  const walkStart = INTRO_FRAMES - TRANSITION;
  let acc = walkStart;
  SEGMENTS.forEach((sg, i) => {
    w.push([
      acc + STEP_VOICE_DELAY + 5,
      acc + STEP_VOICE_DELAY + Math.round(STEP_SPEECH_END[i] * FPS),
    ]);
    acc += segFrames(sg);
  });
  const endStart = walkStart + WALK_FRAMES - TRANSITION;
  w.push([
    endStart + END_VOICE_START + 5,
    endStart + END_VOICE_START + Math.round(3.41 * FPS),
  ]);
  return w;
};
