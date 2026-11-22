import { AbsoluteFill, Img, staticFile } from "remotion";
import { Character } from "./Intro";
import { C, fontFamily } from "./theme";

// 1080x1920 cover for the Merchant Portal ad. Key content sits in the centre 3:4 band.
const Chip: React.FC<{
  children: React.ReactNode;
  bg: string;
  color: string;
  rotate: string;
}> = ({ children, bg, color, rotate }) => (
  <div
    style={{
      background: bg,
      color,
      fontSize: 56,
      fontWeight: 900,
      padding: "14px 40px 22px",
      borderRadius: 999,
      boxShadow: "0 10px 0 rgba(0,0,0,0.28)",
      rotate,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

export const MerchantCover: React.FC = () => (
  <AbsoluteFill
    style={{
      fontFamily,
      overflow: "hidden",
      alignItems: "center",
      background: `linear-gradient(160deg, ${C.purple} 0%, ${C.purpleDeep} 55%, ${C.purpleDark} 100%)`,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: -260,
        top: 300,
        width: 1600,
        height: 1600,
        borderRadius: "50%",
        background:
          "repeating-conic-gradient(rgba(255,215,0,0.14) 0deg 9deg, rgba(255,215,0,0) 9deg 18deg)",
        maskImage: "radial-gradient(circle, black 25%, transparent 65%)",
      }}
    />
    <div
      style={{
        marginTop: 130,
        background: "#fff",
        borderRadius: 999,
        padding: "14px 40px",
        boxShadow: "0 10px 0 rgba(0,0,0,0.2)",
      }}
    >
      <Img
        src={staticFile("logo-final.png")}
        style={{ height: 86, display: "block" }}
      />
    </div>
    <div
      style={{
        marginTop: 50,
        fontSize: 96,
        fontWeight: 900,
        color: "#FCA5A5",
        textShadow: "0 7px 0 rgba(0,0,0,0.35)",
        rotate: "-2deg",
      }}
    >
      बिजनेसमा घाटा?
    </div>
    <div
      style={{
        marginTop: 10,
        textAlign: "center",
        fontSize: 150,
        fontWeight: 900,
        lineHeight: 1,
        color: C.yellow,
        letterSpacing: -3,
        textShadow: "0 10px 0 #B45309, 0 22px 50px rgba(0,0,0,0.45)",
        WebkitTextStroke: `4px ${C.purpleDark}`,
      }}
    >
      Byiora
      <br />
      Merchant
      <br />
      Portal
    </div>
    <div
      style={{
        marginTop: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}
    >
      <Chip bg={C.white} color={C.ink} rotate="-2deg">
        ⚡ इन्स्ट्यान्ट डेलिभरी
      </Chip>
      <Chip bg={C.amber} color={C.ink} rotate="2deg">
        Rs. 0 बाट सुरु
      </Chip>
      <Chip bg={C.purpleDark} color={C.yellow} rotate="-1deg">
        🔌 निःशुल्क API
      </Chip>
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: -30,
        scale: "0.62",
        transformOrigin: "bottom left",
      }}
    >
      <Character
        shirt="#334155"
        hair="#111827"
        skin="#E0A878"
        suit={{ tie: "#DC2626" }}
        mood="happy"
        talking={false}
        pointing
      />
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 40,
        right: -30,
        scale: "0.62",
        transformOrigin: "bottom right",
      }}
    >
      <Character
        shirt="#1E3A8A"
        hair="#3B2416"
        skin="#C68A5E"
        suit={{ tie: C.amber }}
        mood="happy"
        flip
        pointing
        talking={false}
      />
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 450,
        fontSize: 54,
        fontWeight: 900,
        color: C.ink,
        background: C.yellow,
        padding: "8px 40px 14px",
        borderRadius: 999,
        boxShadow: "0 9px 0 #B45309",
      }}
    >
      merchant.byiora.com.np
    </div>
  </AbsoluteFill>
);
