import { AbsoluteFill, Img, staticFile } from "remotion";
import { Character } from "./Intro";
import { C, fontFamily } from "./theme";

// 1080x1920 cover for Reels/TikTok/Shorts. Key content stays inside the
// centre 1080x1440 band (y 240-1680) so 3:4 grid crops don't cut it.
export const ThumbnailVertical: React.FC = () => {
  const screenW = 470;
  const screenH = Math.round((screenW * 844) / 390);
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        overflow: "hidden",
        background: `linear-gradient(160deg, ${C.purple} 0%, ${C.purpleDeep} 55%, ${C.purpleDark} 100%)`,
      }}
    >
      {/* sunburst behind phone */}
      <div
        style={{
          position: "absolute",
          left: -260,
          top: 420,
          width: 1600,
          height: 1600,
          borderRadius: "50%",
          background: "repeating-conic-gradient(rgba(255,215,0,0.15) 0deg 9deg, rgba(255,215,0,0) 9deg 18deg)",
          maskImage: "radial-gradient(circle, black 25%, transparent 65%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 760,
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,215,0,0.4) 0%, rgba(255,215,0,0) 65%)",
        }}
      />

      {/* Logo */}
      <div style={{ position: "absolute", top: 120, width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 999, padding: "14px 40px", boxShadow: "0 10px 0 rgba(0,0,0,0.2)" }}>
          <Img src={staticFile("logo-final.png")} style={{ height: 86, display: "block" }} />
        </div>
      </div>

      {/* Headline */}
      <div style={{ position: "absolute", top: 270, width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: 168,
            fontWeight: 900,
            lineHeight: 0.98,
            color: C.yellow,
            letterSpacing: -4,
            textShadow: "0 10px 0 #B45309, 0 22px 50px rgba(0,0,0,0.45)",
            WebkitTextStroke: `4px ${C.purpleDark}`,
          }}
        >
          Steam
          <br />
          Gift Card
        </div>
        <div
          style={{
            marginTop: 34,
            display: "inline-block",
            fontSize: 96,
            fontWeight: 900,
            color: C.white,
            background: C.purpleDark,
            padding: "6px 40px 20px",
            borderRadius: 30,
            rotate: "-2deg",
            boxShadow: `0 10px 0 ${C.amber}`,
          }}
        >
          सजिलै किन्नुहोस्!
        </div>
      </div>

      {/* Phone */}
      <div
        style={{
          position: "absolute",
          left: (1080 - screenW - 32) / 2 + 40,
          top: 850,
          width: screenW + 32,
          height: screenH + 32,
          borderRadius: 70,
          background: "linear-gradient(145deg, #2a2a35, #0b0b10)",
          boxShadow: "0 0 0 5px #4b4b5a, 0 40px 90px rgba(0,0,0,0.6)",
          rotate: "6deg",
        }}
      >
        <div style={{ position: "absolute", left: 16, top: 16, width: screenW, height: screenH, borderRadius: 56, overflow: "hidden" }}>
          <Img src={staticFile("thumb-screen2.png")} style={{ width: screenW, height: screenH }} />
        </div>
      </div>

      {/* Price badge */}
      <div
        style={{
          position: "absolute",
          left: 50,
          top: 1180,
          width: 310,
          height: 310,
          borderRadius: "50%",
          background: C.amber,
          border: `10px solid ${C.white}`,
          boxShadow: "0 14px 0 #B45309, 0 24px 60px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          rotate: "-10deg",
          color: C.ink,
        }}
      >
        <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap" }}>Rs. 450</div>
        <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.3 }}>देखि</div>
      </div>

      {/* Character */}
      <div style={{ position: "absolute", right: -60, bottom: 80, scale: "0.8", transformOrigin: "bottom right" }}>
        <Character shirt={C.purple} hair="#3B2416" skin="#C68A5E" talking={false} flip pointing cap longHair />
      </div>

      {/* URL strip */}
      <div style={{ position: "absolute", bottom: 250, left: 0, width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: C.ink,
            background: C.yellow,
            padding: "8px 50px 16px",
            borderRadius: 999,
            boxShadow: "0 10px 0 #B45309, 0 20px 50px rgba(0,0,0,0.4)",
          }}
        >
          byiora.com.np
        </div>
      </div>
    </AbsoluteFill>
  );
};
