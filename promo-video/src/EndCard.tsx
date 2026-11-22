import { Audio } from "@remotion/media";
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
import { C, END_VOICE_START, fontFamily } from "./theme";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const url = spring({ frame: frame - 12, fps, config: { damping: 12 } });
  const tag = spring({ frame: frame - 22, fps, config: { damping: 14 } });
  const cta = spring({ frame: frame - 32, fps, config: { damping: 10 } });
  const pulse =
    1 +
    Math.sin(frame / 5) * 0.04 * Math.min(1, Math.max(0, (frame - 40) / 10));
  const shine = interpolate(frame % 60, [0, 60], [-120, 220]);

  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center" }}>
      <Background />
      <div
        style={{
          marginTop: 290,
          width: 620,
          height: 620,
          borderRadius: 120,
          overflow: "hidden",
          position: "relative",
          background: "#efedea",
          border: `10px solid ${C.yellow}`,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.45), 0 0 140px rgba(255,215,0,0.45)",
          scale: String(logo),
          rotate: `${(1 - logo) * -25}deg`,
        }}
      >
        <Img
          src={staticFile("logo-square.png")}
          style={{ width: "100%", height: "100%" }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${shine}%`,
            width: "30%",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
            rotate: "15deg",
          }}
        />
      </div>

      <div
        style={{
          marginTop: 80,
          fontSize: 112,
          fontWeight: 900,
          color: C.yellow,
          letterSpacing: -2,
          textShadow: "0 8px 0 #B45309, 0 20px 40px rgba(0,0,0,0.4)",
          opacity: url,
          translate: `0 ${(1 - url) * 120}px`,
        }}
      >
        byiora.com.np
      </div>
      <div
        style={{
          marginTop: 30,
          fontSize: 60,
          fontWeight: 800,
          color: C.white,
          opacity: tag,
          translate: `0 ${(1 - tag) * 80}px`,
        }}
      >
        सस्तो • छिटो • भरपर्दो
      </div>
      <div
        style={{
          marginTop: 90,
          background: C.amber,
          color: C.ink,
          fontSize: 62,
          fontWeight: 900,
          padding: "30px 70px",
          borderRadius: 999,
          boxShadow: "0 12px 0 #B45309, 0 30px 60px rgba(0,0,0,0.35)",
          scale: String(cta * pulse),
        }}
      >
        अहिले नै किन्नुहोस्! →
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: 40,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          opacity: cta,
        }}
      >
        Steam • Amazon • PUBG • ChatGPT र अरू धेरै
      </div>
      <Sequence name="Voice: end" from={END_VOICE_START} layout="none">
        <Audio src={staticFile("voice/end.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};
