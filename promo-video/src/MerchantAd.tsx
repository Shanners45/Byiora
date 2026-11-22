import { Audio, Video } from "@remotion/media";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "./Background";
import { Bubble, Character } from "./Intro";
import { C, fontFamily } from "./theme";

// ---------- timing (30 fps). Speech ends measured with scripts/speech-bounds.mjs ----------
const VOICE_AT = 8; // voice line starts this many frames into its scene
export const M = {
  m1At: 10, // worried businessman, speech ends ~5.96s
  m2At: 200, // calm friend, speech ends ~3.51s
  dialogue: 325,
  f1: 175, // speech ~4.94s
  f2: 135, // ~3.60s
  f3: 148, // ~4.01s
  f4: 148, // ~3.99s
  f5: 128, // ~3.35s
  react: 118, // ~3.00s
  cta: 200, // ~4.99s
  transition: 10,
};
export const MERCHANT_TOTAL =
  M.dialogue +
  M.f1 +
  M.f2 +
  M.f3 +
  M.f4 +
  M.f5 +
  M.react +
  M.cta -
  7 * M.transition;

// Speech windows (global frames) for ducking the music.
const SPEECH: [number, number][] = (() => {
  const w: [number, number][] = [
    [M.m1At + 5, M.m1At + 179],
    [M.m2At + 5, M.m2At + 105],
  ];
  const ends = [148, 108, 120, 120, 100, 90, 150]; // f1..f5, react, cta speech ends (frames)
  const lens = [M.f1, M.f2, M.f3, M.f4, M.f5, M.react, M.cta];
  let start = M.dialogue - M.transition;
  lens.forEach((len, i) => {
    w.push([start + VOICE_AT + 5, start + VOICE_AT + ends[i]]);
    start += len - M.transition;
  });
  return w;
})();
const musicVolume = (f: number) => {
  const near = Math.min(
    ...SPEECH.map(([a, b]) => (f < a ? a - f : f > b ? f - b : 0)),
  );
  const duck = interpolate(near, [0, 8], [0.1, 0.3], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    f,
    [MERCHANT_TOTAL - 20, MERCHANT_TOTAL],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return duck * fadeOut;
};

const Voice: React.FC<{ id: string; at?: number }> = ({
  id,
  at = VOICE_AT,
}) => (
  <Sequence name={`Voice: ${id}`} from={at} layout="none">
    <Audio src={staticFile(`voice-merchant/${id}.wav`)} />
  </Sequence>
);

// ---------- shared pieces ----------
const Headline: React.FC<{ icon: string; ne: string; en: string }> = ({
  icon,
  ne,
  en,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 160 } });
  const sub = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 60,
        right: 60,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 150,
          height: 150,
          borderRadius: 40,
          background: C.yellow,
          fontSize: 86,
          boxShadow: "0 10px 0 #B45309",
          scale: String(pop),
          rotate: `${(1 - pop) * -60}deg`,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          marginTop: 30,
          color: C.white,
          fontSize: 92,
          fontWeight: 900,
          lineHeight: 1.2,
          textShadow: "0 7px 0 rgba(0,0,0,0.35)",
          opacity: pop,
          translate: `0 ${(1 - pop) * 60}px`,
        }}
      >
        {ne}
      </div>
      <div
        style={{
          marginTop: 14,
          color: C.yellow,
          fontSize: 46,
          fontWeight: 800,
          opacity: sub,
          translate: `0 ${(1 - sub) * 40}px`,
        }}
      >
        {en}
      </div>
    </div>
  );
};

const Phone: React.FC<{
  top: number;
  width: number;
  children: React.ReactNode;
  tilt?: number;
}> = ({ top, width, children, tilt = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - 4,
    fps,
    config: { damping: 15, stiffness: 90 },
  });
  const h = Math.round((width * 844) / 390);
  const bezel = 20;
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - width - 2 * bezel) / 2,
        top,
        width: width + 2 * bezel,
        height: h + 2 * bezel,
        borderRadius: 76,
        background: "linear-gradient(145deg, #2a2a35, #0b0b10)",
        boxShadow:
          "0 0 0 5px #4b4b5a, 0 40px 90px rgba(0,0,0,0.55), 0 0 120px rgba(255,215,0,0.2)",
        translate: `0 ${(1 - enter) * 1200 + Math.sin(frame / 25) * 6}px`,
        rotate: `${tilt + (1 - enter) * 8}deg`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: bezel,
          top: bezel,
          width,
          height: h,
          borderRadius: 58,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const Pop: React.FC<{
  delay: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - delay,
    fps,
    config: { damping: 10, stiffness: 150 },
  });
  return (
    <div style={{ ...style, scale: String(p), opacity: Math.min(1, p * 1.5) }}>
      {children}
    </div>
  );
};

const Chip: React.FC<{
  children: React.ReactNode;
  bg?: string;
  color?: string;
  size?: number;
}> = ({ children, bg = C.white, color = C.ink, size = 46 }) => (
  <div
    style={{
      background: bg,
      color,
      fontSize: size,
      fontWeight: 900,
      padding: "14px 34px 20px",
      borderRadius: 999,
      boxShadow: "0 9px 0 rgba(0,0,0,0.25)",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

// ---------- scenes ----------
const TrendChart: React.FC<{ up: boolean }> = ({ up }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const color = up ? "#22C55E" : "#EF4444";
  const d = up
    ? "M20 230 L110 190 L190 205 L270 120 L360 60"
    : "M20 50 L110 90 L190 70 L270 160 L360 220";
  return (
    <svg width={400} height={270} viewBox="0 0 400 270">
      <rect
        x="0"
        y="0"
        width="400"
        height="270"
        rx="30"
        fill="rgba(255,255,255,0.95)"
      />
      <path
        d={d}
        stroke={color}
        strokeWidth="16"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
      <circle cx={360} cy={up ? 60 : 220} r={18 * draw} fill={color} />
    </svg>
  );
};

const Dialogue: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterA = spring({ frame, fps, config: { damping: 14 } });
  const enterB = spring({ frame: frame - 8, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      <Pop delay={30} style={{ position: "absolute", top: 120, left: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <TrendChart up={false} />
          <div
            style={{
              color: "#FCA5A5",
              fontSize: 84,
              fontWeight: 900,
              rotate: "-6deg",
              textShadow: "0 6px 0 rgba(0,0,0,0.35)",
            }}
          >
            घाटा!
          </div>
        </div>
      </Pop>
      <Bubble
        start={M.m1At}
        tail="left"
        top={440}
        color="#ffffff"
        textColor={C.ink}
        typeFrames={160}
        plain="यार, अनलाइन गिफ्ट कार्ड बिजनेसमा घाटा मात्र भइरह्यो। सप्लायरको डेलिभरी ढिलो, भाउ पनि महँगो!"
        text={
          <>
            यार, अनलाइन गिफ्ट कार्ड बिजनेसमा{" "}
            <span style={{ color: "#DC2626" }}>घाटा</span> मात्र भइरह्यो।
            सप्लायरको <span style={{ color: "#DC2626" }}>डेलिभरी ढिलो</span>,
            भाउ पनि <span style={{ color: "#DC2626" }}>महँगो</span>!
          </>
        }
      />
      <Bubble
        start={M.m2At}
        tail="right"
        top={890}
        color={C.amber}
        textColor={C.ink}
        typeFrames={90}
        plain="चिन्ता नगर साथी! Byiora Merchant Portal चलाऊ।"
        text={
          <>
            चिन्ता नगर साथी!{" "}
            <span
              style={{
                background: C.purple,
                color: C.yellow,
                padding: "0 14px",
                borderRadius: 14,
              }}
            >
              Byiora Merchant Portal
            </span>{" "}
            चलाऊ।
          </>
        }
      />
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: 10,
          translate: `${(1 - enterA) * -600}px 0`,
        }}
      >
        <Character
          shirt="#334155"
          hair="#111827"
          skin="#E0A878"
          suit={{ tie: "#DC2626" }}
          mood="worried"
          talking={frame > M.m1At + 5 && frame < M.m1At + 179}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 30,
          right: 10,
          translate: `${(1 - enterB) * 600}px 0`,
        }}
      >
        <Character
          shirt="#1E3A8A"
          hair="#3B2416"
          skin="#C68A5E"
          suit={{ tie: C.amber }}
          flip
          pointing={frame > M.m2At}
          talking={frame > M.m2At + 5 && frame < M.m2At + 105}
        />
      </div>
      <Voice id="m1" at={M.m1At} />
      <Voice id="m2" at={M.m2At} />
    </AbsoluteFill>
  );
};

const InstantDelivery: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, M.f1], [1, 1.08], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      <Headline
        icon="⚡"
        ne="इन्स्ट्यान्ट डेलिभरी"
        en="Codes instantly via API or dashboard"
      />
      <Phone top={620} width={560}>
        <Img
          src={staticFile("merchant/docs-overview.png")}
          style={{
            width: 560,
            scale: String(zoom),
            transformOrigin: "50% 70%",
          }}
        />
      </Phone>
      <Pop
        delay={45}
        style={{ position: "absolute", top: 1480, left: 70, rotate: "-4deg" }}
      >
        <div
          style={{
            background: C.purpleDark,
            border: `5px solid ${C.yellow}`,
            borderRadius: 32,
            padding: "22px 34px",
            color: C.white,
            fontFamily: "Consolas, monospace",
            fontSize: 38,
            boxShadow: "0 12px 0 rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ color: "#86EFAC", fontWeight: 700 }}>
            POST /orders → 200 OK
          </div>
          <div>
            &quot;status&quot;:{" "}
            <span style={{ color: C.yellow }}>&quot;COMPLETED&quot;</span>
          </div>
          <div>
            &quot;codes&quot;: [
            <span style={{ color: C.yellow }}>&quot;XXXX-XXXX&quot;</span>]
          </div>
        </div>
      </Pop>
      <Voice id="f1" />
    </AbsoluteFill>
  );
};

const StartZero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zero = spring({
    frame: frame - 12,
    fps,
    config: { damping: 8, stiffness: 120 },
  });
  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center" }}>
      <Background />
      <Headline
        icon="🚀"
        ne="Rs. 0 बाट सुरु"
        en="No setup fee to get started"
      />
      <div
        style={{
          position: "absolute",
          top: 720,
          width: 640,
          height: 640,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.yellow} 0%, ${C.amber} 70%)`,
          border: "14px solid #fff",
          boxShadow: "0 24px 0 #B45309, 0 40px 100px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          scale: String(zero),
          rotate: `${(1 - zero) * 180}deg`,
          color: C.ink,
        }}
      >
        <div style={{ fontSize: 90, fontWeight: 900, lineHeight: 1 }}>Rs.</div>
        <div style={{ fontSize: 330, fontWeight: 900, lineHeight: 1 }}>0</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1450,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        <Pop delay={40}>
          <Chip>✔ सेटअप शुल्क छैन</Chip>
        </Pop>
        <Pop delay={55}>
          <Chip bg={C.purpleDark} color={C.yellow}>
            ✔ बेच्ने बेला मात्र वालेट टप-अप
          </Chip>
        </Pop>
      </div>
      <Voice id="f2" />
    </AbsoluteFill>
  );
};

const Wallet: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: frame - 6, fps, config: { damping: 13 } });
  const bal = Math.round(
    interpolate(frame, [30, 90], [0, 10000], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center" }}>
      <Background />
      <Headline
        icon="👛"
        ne="प्रिपेड वालेट"
        en="Top up by Fonepay QR or bank transfer"
      />
      <div
        style={{
          position: "absolute",
          top: 720,
          width: 900,
          height: 540,
          borderRadius: 56,
          background: `linear-gradient(135deg, ${C.purple} 0%, #4C1D95 60%, #1F1235 100%)`,
          border: "6px solid rgba(255,255,255,0.6)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          padding: 60,
          color: C.white,
          translate: `0 ${(1 - card) * 900}px`,
          rotate: `${(1 - card) * -12 - 3}deg`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -120,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "rgba(255,215,0,0.18)",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 999,
              padding: "8px 24px",
            }}
          >
            <Img
              src={staticFile("logo-final.png")}
              style={{ height: 52, display: "block" }}
            />
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: C.yellow }}>
            Merchant Wallet
          </div>
        </div>
        <div
          style={{
            marginTop: 70,
            fontSize: 40,
            fontWeight: 700,
            opacity: 0.85,
          }}
        >
          Balance
        </div>
        <div style={{ fontSize: 130, fontWeight: 900, lineHeight: 1.1 }}>
          Rs. {bal.toLocaleString("en-IN")}
        </div>
        <div style={{ marginTop: 20, fontSize: 32, opacity: 0.7 }}>
          Prepaid • NPR
        </div>
      </div>
      <div
        style={{ position: "absolute", top: 1380, display: "flex", gap: 30 }}
      >
        <Pop delay={40}>
          <Chip>＋ Fonepay QR</Chip>
        </Pop>
        <Pop delay={55}>
          <Chip>＋ Bank transfer</Chip>
        </Pop>
      </div>
      <Pop delay={75} style={{ position: "absolute", top: 1560 }}>
        <div
          style={{
            color: C.white,
            fontSize: 48,
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          हरेक अर्डरको पैसा वालेटबाटै
        </div>
      </Pop>
      <Voice id="f3" />
    </AbsoluteFill>
  );
};

const FreeApi: React.FC = () => (
  <AbsoluteFill style={{ fontFamily, alignItems: "center" }}>
    <Background />
    <Headline
      icon="🔌"
      ne="निःशुल्क API इन्टिग्रेसन"
      en="Full docs • Test keys • Webhooks"
    />
    <Phone top={640} width={540} tilt={-3}>
      <Video
        src={staticFile("merchant/docs-scroll.webm")}
        muted
        playbackRate={1.4}
        objectFit="cover"
        style={{ width: 540, height: Math.round((540 * 844) / 390) }}
      />
    </Phone>
    <div
      style={{
        position: "absolute",
        top: 760,
        left: 30,
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <Pop delay={30} style={{ rotate: "-5deg" }}>
        <Chip bg={C.yellow}>📘 Docs</Chip>
      </Pop>
      <Pop delay={44} style={{ rotate: "4deg" }}>
        <Chip bg={C.white}>🧪 Test keys</Chip>
      </Pop>
    </div>
    <div style={{ position: "absolute", top: 1420, right: 30 }}>
      <Pop delay={58} style={{ rotate: "-4deg" }}>
        <Chip bg={C.amber}>🔔 Webhooks</Chip>
      </Pop>
    </div>
    <Voice id="f4" />
  </AbsoluteFill>
);

const Wholesale: React.FC = () => {
  const Tag: React.FC<{
    label: string;
    sub: string;
    bg: string;
    color: string;
  }> = ({ label, sub, bg, color }) => (
    <div
      style={{
        width: 420,
        height: 300,
        borderRadius: 40,
        background: bg,
        color,
        border: "8px solid #fff",
        boxShadow: "0 16px 0 rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.2 }}>
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.85 }}>{sub}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center" }}>
      <Background />
      <Headline
        icon="🏷️"
        ne="होलसेल मर्चेन्ट भाउ"
        en="Buy wholesale, sell at your own price"
      />
      <Pop
        delay={10}
        style={{ position: "absolute", top: 700, rotate: "-4deg" }}
      >
        <Tag
          label="होलसेल भाउ"
          sub="Byiora बाट किन्नुहोस्"
          bg={C.purpleDark}
          color={C.yellow}
        />
      </Pop>
      <Pop delay={30} style={{ position: "absolute", top: 990 }}>
        <div
          style={{
            fontSize: 130,
            color: C.yellow,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ↓
        </div>
      </Pop>
      <Pop
        delay={45}
        style={{ position: "absolute", top: 1150, rotate: "4deg" }}
      >
        <Tag
          label="तपाईंको भाउ"
          sub="आफ्नो ग्राहकलाई बेच्नुहोस्"
          bg={C.amber}
          color={C.ink}
        />
      </Pop>
      <Pop delay={65} style={{ position: "absolute", top: 1540 }}>
        <Chip bg="#22C55E" color="#fff" size={54}>
          बीचको फरक = तपाईंको मार्जिन
        </Chip>
      </Pop>
      <Voice id="f5" />
    </AbsoluteFill>
  );
};

const Reaction: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      <Pop delay={4} style={{ position: "absolute", top: 140, right: 60 }}>
        <TrendChart up />
      </Pop>
      <Bubble
        start={4}
        tail="left"
        top={520}
        color="#ffffff"
        textColor={C.ink}
        typeFrames={80}
        plain="वाह! अब त मेरो बिजनेस फेरि दौडिन्छ!"
        text={
          <>
            वाह! अब त मेरो बिजनेस{" "}
            <span style={{ color: "#16A34A" }}>फेरि दौडिन्छ!</span>
          </>
        }
      />
      <div style={{ position: "absolute", bottom: 30, left: 10 }}>
        <Character
          shirt="#334155"
          hair="#111827"
          skin="#E0A878"
          suit={{ tie: "#DC2626" }}
          mood="happy"
          talking={frame > 13 && frame < 98}
          pointing
        />
      </div>
      <div style={{ position: "absolute", bottom: 30, right: 10 }}>
        <Character
          shirt="#1E3A8A"
          hair="#3B2416"
          skin="#C68A5E"
          suit={{ tie: C.amber }}
          mood="happy"
          flip
          talking={false}
        />
      </div>
      <Voice id="m3" />
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const t1 = spring({ frame: frame - 10, fps, config: { damping: 12 } });
  const pulse = 1 + Math.sin(frame / 5) * 0.03;
  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center" }}>
      <Background />
      <div
        style={{
          marginTop: 110,
          background: "#fff",
          borderRadius: 999,
          padding: "16px 46px",
          boxShadow: "0 12px 0 rgba(0,0,0,0.2)",
          scale: String(logo),
        }}
      >
        <Img
          src={staticFile("logo-final.png")}
          style={{ height: 100, display: "block" }}
        />
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: 100,
          fontWeight: 900,
          color: C.yellow,
          textAlign: "center",
          lineHeight: 1.2,
          textShadow: "0 8px 0 #B45309, 0 20px 40px rgba(0,0,0,0.4)",
          opacity: t1,
          translate: `0 ${(1 - t1) * 80}px`,
        }}
      >
        Byiora मर्चेन्ट बन्नुहोस्!
      </div>
      <Phone top={560} width={400} tilt={4}>
        <Img src={staticFile("merchant/login.png")} style={{ width: 400 }} />
        {/* hide the half-rendered captcha widget in the screenshot */}
        <div
          style={{
            position: "absolute",
            left: 40,
            top: 520,
            width: 320,
            height: 60,
            background: "#fff",
          }}
        />
      </Phone>
      <Pop delay={30} style={{ position: "absolute", top: 1490 }}>
        <div
          style={{
            fontSize: 66,
            fontWeight: 900,
            color: C.ink,
            background: C.yellow,
            padding: "10px 46px 18px",
            borderRadius: 999,
            boxShadow: "0 10px 0 #B45309",
            scale: String(pulse),
          }}
        >
          merchant.byiora.com.np
        </div>
      </Pop>
      <Pop delay={45} style={{ position: "absolute", top: 1650 }}>
        <div
          style={{
            color: C.white,
            fontSize: 50,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          इनभाइटका लागि सम्पर्क गर्नुहोस्
          <div style={{ color: C.yellow, fontSize: 44 }}>
            support@byiora.com.np
          </div>
        </div>
      </Pop>
      <Voice id="cta" />
    </AbsoluteFill>
  );
};

const T = () =>
  springTiming({ config: { damping: 200 }, durationInFrames: M.transition });

export const MerchantAd: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("music-merchant.wav")} volume={musicVolume} />
    <TransitionSeries>
      <TransitionSeries.Sequence name="Dialogue" durationInFrames={M.dialogue}>
        <Dialogue />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-top-left" })}
        timing={T()}
      />
      <TransitionSeries.Sequence
        name="Instant delivery"
        durationInFrames={M.f1}
      >
        <InstantDelivery />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={T()}
      />
      <TransitionSeries.Sequence name="Start Rs. 0" durationInFrames={M.f2}>
        <StartZero />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={T()}
      />
      <TransitionSeries.Sequence name="Wallet" durationInFrames={M.f3}>
        <Wallet />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={T()}
      />
      <TransitionSeries.Sequence name="Free API" durationInFrames={M.f4}>
        <FreeApi />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={T()}
      />
      <TransitionSeries.Sequence name="Wholesale" durationInFrames={M.f5}>
        <Wholesale />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={T()} />
      <TransitionSeries.Sequence name="Reaction" durationInFrames={M.react}>
        <Reaction />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-bottom" })}
        timing={T()}
      />
      <TransitionSeries.Sequence name="CTA" durationInFrames={M.cta}>
        <Cta />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
