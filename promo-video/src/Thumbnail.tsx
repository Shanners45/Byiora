import { AbsoluteFill, Img, staticFile } from "remotion";
import { Character } from "./Intro";
import { C, fontFamily } from "./theme";

// 1280x720 YouTube thumbnail.
export const Thumbnail: React.FC = () => {
  const screenW = 300;
  const screenH = Math.round((screenW * 844) / 390);
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDeep} 60%, ${C.purpleDark} 100%)`,
      }}
    >
      {/* sunburst behind phone */}
      <div
        style={{
          position: "absolute",
          left: 620,
          top: -340,
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          background: `repeating-conic-gradient(rgba(255,215,0,0.16) 0deg 10deg, rgba(255,215,0,0) 10deg 20deg)`,
          maskImage: "radial-gradient(circle, black 30%, transparent 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 820,
          top: 80,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,215,0,0.45) 0%, rgba(255,215,0,0) 65%)",
        }}
      />

      {/* Logo pill */}
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 40,
          background: "#fff",
          borderRadius: 999,
          padding: "10px 26px",
          boxShadow: "0 8px 0 rgba(0,0,0,0.2)",
        }}
      >
        <Img src={staticFile("logo-final.png")} style={{ height: 58, display: "block" }} />
      </div>

      {/* Headline */}
      <div style={{ position: "absolute", left: 48, top: 140, width: 760 }}>
        <div
          style={{
            fontSize: 132,
            fontWeight: 900,
            lineHeight: 0.98,
            color: C.yellow,
            letterSpacing: -3,
            textShadow: `0 8px 0 #B45309, 0 18px 40px rgba(0,0,0,0.45)`,
            WebkitTextStroke: `3px ${C.purpleDark}`,
          }}
        >
          Steam
          <br />
          Gift Card
        </div>
        <div
          style={{
            marginTop: 28,
            display: "inline-block",
            fontSize: 74,
            fontWeight: 900,
            color: C.white,
            background: C.purpleDark,
            padding: "4px 28px 14px",
            borderRadius: 22,
            rotate: "-2deg",
            boxShadow: `0 8px 0 ${C.amber}`,
          }}
        >
          सजिलै किन्नुहोस्!
        </div>
      </div>

      {/* URL strip */}
      <div
        style={{
          position: "absolute",
          left: 48,
          bottom: 38,
          fontSize: 46,
          fontWeight: 900,
          color: C.ink,
          background: C.yellow,
          padding: "6px 30px 10px",
          borderRadius: 999,
          boxShadow: "0 7px 0 #B45309",
        }}
      >
        byiora.com.np
      </div>

      {/* Phone */}
      <div
        style={{
          position: "absolute",
          left: 870,
          top: 70,
          width: screenW + 24,
          height: screenH + 24,
          borderRadius: 48,
          background: "linear-gradient(145deg, #2a2a35, #0b0b10)",
          boxShadow: "0 0 0 4px #4b4b5a, 0 30px 70px rgba(0,0,0,0.6)",
          rotate: "8deg",
        }}
      >
        <div style={{ position: "absolute", left: 12, top: 12, width: screenW, height: screenH, borderRadius: 38, overflow: "hidden" }}>
          <Img src={staticFile("thumb-screen2.png")} style={{ width: screenW, height: screenH }} />
        </div>
      </div>

      {/* Price badge */}
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 420,
          width: 230,
          height: 230,
          borderRadius: "50%",
          background: C.amber,
          border: `8px solid ${C.white}`,
          boxShadow: "0 12px 0 #B45309, 0 20px 50px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          rotate: "-10deg",
          color: C.ink,
        }}
      >
        <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap" }}>Rs. 450</div>
        <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1.3 }}>देखि</div>
      </div>

      {/* Character pointing at the phone */}
      <div style={{ position: "absolute", right: -80, bottom: -90, scale: "0.56", transformOrigin: "bottom right" }}>
        <Character shirt={C.purple} hair="#3B2416" skin="#C68A5E" talking={false} flip pointing cap longHair />
      </div>
    </AbsoluteFill>
  );
};
