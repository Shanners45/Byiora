import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "./Background";
import { A_START, C, Q_START, fontFamily } from "./theme";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seg = new (Intl as any).Segmenter("ne", { granularity: "grapheme" });
const graphemes = (s: string): string[] =>
  Array.from(seg.segment(s) as Iterable<{ segment: string }>, (g) => g.segment);

type CharProps = {
  shirt: string;
  hair: string;
  skin: string;
  talking: boolean;
  flip?: boolean;
  pointing?: boolean;
  cap?: boolean;
  longHair?: boolean;
  suit?: { tie: string };
  mood?: "worried" | "happy";
};

// Simple original cartoon character drawn in SVG. Mouth flaps while talking, blinks periodically.
export const Character: React.FC<CharProps> = ({
  shirt,
  hair,
  skin,
  talking,
  flip,
  pointing,
  cap,
  longHair,
  suit,
  mood,
}) => {
  const frame = useCurrentFrame();
  const mouthOpen = talking ? Math.abs(Math.sin(frame / 2.6)) : 0;
  const blink = frame % 70 > 66 ? 0.1 : 1;
  const bob = Math.sin(frame / (talking ? 5 : 12)) * (talking ? 6 : 3);
  const armRot = pointing
    ? -35 + Math.sin(frame / 6) * 6
    : 10 + Math.sin(frame / 14) * 4;
  return (
    <svg
      width={420}
      height={620}
      viewBox="0 0 420 620"
      style={{ scale: flip ? "-1 1" : undefined, translate: `0 ${bob}px` }}
    >
      {/* shadow */}
      <ellipse cx="210" cy="605" rx="140" ry="16" fill="rgba(0,0,0,0.25)" />
      {/* legs */}
      <rect x="150" y="470" width="46" height="130" rx="20" fill="#1E293B" />
      <rect x="224" y="470" width="46" height="130" rx="20" fill="#1E293B" />
      {/* body */}
      <path d="M95 500 Q95 330 210 320 Q325 330 325 500 Z" fill={shirt} />
      {suit ? (
        <g>
          <path d="M168 322 L210 420 L252 322 Z" fill="#fff" />
          <path d="M203 340 L217 340 L224 410 L210 430 L196 410 Z" fill={suit.tie} />
          <path d="M200 326 L220 326 L216 342 L204 342 Z" fill={suit.tie} />
          <path d="M150 330 L210 440 L178 340 Z" fill="rgba(0,0,0,0.25)" />
          <path d="M270 330 L210 440 L242 340 Z" fill="rgba(0,0,0,0.25)" />
          <circle cx="210" cy="465" r="6" fill="rgba(255,255,255,0.6)" />
        </g>
      ) : (
        <path d="M180 325 L210 370 L240 325 Z" fill="rgba(255,255,255,0.85)" />
      )}
      {/* back arm */}
      <rect
        x="85"
        y="350"
        width="40"
        height="140"
        rx="20"
        fill={shirt}
        transform="rotate(12 105 360)"
      />
      {/* front arm (points when answering) */}
      <g transform={`rotate(${armRot} 312 360)`}>
        <rect x="295" y="350" width="40" height="140" rx="20" fill={shirt} />
        <circle cx="315" cy="495" r="24" fill={skin} />
      </g>
      {longHair && (
        <path d="M92 190 Q88 360 140 372 L280 372 Q332 360 328 190 Z" fill={hair} />
      )}
      {/* neck + head */}
      <rect x="188" y="285" width="44" height="45" fill={skin} />
      <circle cx="210" cy="200" r="112" fill={skin} />
      {/* ears */}
      <circle cx="100" cy="210" r="22" fill={skin} />
      <circle cx="320" cy="210" r="22" fill={skin} />
      {/* hair */}
      <path
        d="M98 190 Q100 80 210 78 Q322 80 322 190 Q300 130 210 128 Q130 130 98 190 Z"
        fill={hair}
      />
      {cap && (
        <g>
          <path d="M100 150 Q110 60 210 58 Q310 60 320 150 Z" fill={C.amber} />
          <rect
            x="200"
            y="135"
            width="170"
            height="26"
            rx="13"
            fill={C.amber}
          />
          <circle cx="210" cy="62" r="10" fill={C.yellow} />
        </g>
      )}
      {/* eyes */}
      <g transform={`translate(0 ${(1 - blink) * 2})`}>
        <ellipse cx="170" cy="200" rx="15" ry={18 * blink} fill="#111" />
        <ellipse cx="250" cy="200" rx="15" ry={18 * blink} fill="#111" />
        <circle cx="175" cy="193" r="5" fill="#fff" opacity={blink} />
        <circle cx="255" cy="193" r="5" fill="#fff" opacity={blink} />
      </g>
      {/* brows */}
      <rect
        x="148"
        y="160"
        width="44"
        height="9"
        rx="4"
        fill={hair}
        transform={`rotate(${mood === "worried" ? 14 : talking ? -8 : -3} 170 165)`}
      />
      <rect
        x="228"
        y="160"
        width="44"
        height="9"
        rx="4"
        fill={hair}
        transform={`rotate(${mood === "worried" ? -14 : talking ? 8 : 3} 250 165)`}
      />
      {/* cheeks */}
      <circle cx="140" cy="240" r="16" fill="#F87171" opacity="0.35" />
      <circle cx="280" cy="240" r="16" fill="#F87171" opacity="0.35" />
      {/* mouth */}
      <ellipse
        cx="210"
        cy="258"
        rx={26}
        ry={4 + mouthOpen * 20}
        fill="#7F1D1D"
      />
      {mood === "worried" && (
        <path
          d="M300 120 Q314 146 300 156 Q286 146 300 120 Z"
          fill="#7DD3FC"
          opacity={0.6 + 0.4 * Math.sin(frame / 8)}
        />
      )}
      {mouthOpen < 0.2 && (
        <path
          d={
            mood === "worried"
              ? "M186 266 Q210 246 234 266"
              : mood === "happy"
                ? "M178 248 Q210 292 242 248"
                : "M184 252 Q210 278 236 252"
          }
          stroke="#7F1D1D"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
};

export const Bubble: React.FC<{
  start: number;
  text: React.ReactNode;
  plain: string;
  tail: "left" | "right";
  top: number;
  color: string;
  textColor: string;
  typeFrames: number;
}> = ({ start, text, plain, tail, top, color, textColor, typeFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: frame - start,
    fps,
    config: { damping: 12, stiffness: 140 },
  });
  const g = graphemes(plain);
  const shown = Math.floor(
    interpolate(frame - start - 4, [0, typeFrames], [0, g.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const done = shown >= g.length;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: tail === "left" ? 60 : undefined,
        right: tail === "right" ? 60 : undefined,
        width: 820,
        scale: String(pop),
        opacity: pop,
        transformOrigin: tail === "left" ? "15% 100%" : "85% 100%",
      }}
    >
      <div
        style={{
          background: color,
          color: textColor,
          borderRadius: 48,
          padding: "40px 48px",
          fontFamily,
          fontWeight: 800,
          fontSize: 58,
          lineHeight: 1.45,
          boxShadow: "0 18px 0 rgba(0,0,0,0.18), 0 30px 60px rgba(0,0,0,0.3)",
          border: "6px solid #fff",
          minHeight: 260,
        }}
      >
        {done ? text : g.slice(0, shown).join("")}
        {!done && <span style={{ opacity: frame % 10 < 5 ? 1 : 0 }}>|</span>}
      </div>
      <svg
        width="90"
        height="70"
        viewBox="0 0 90 70"
        style={{
          position: "absolute",
          bottom: -58,
          left: tail === "left" ? 90 : undefined,
          right: tail === "right" ? 90 : undefined,
          scale: tail === "right" ? "-1 1" : undefined,
        }}
      >
        <path
          d="M0 0 L90 0 L10 70 Z"
          fill={color}
          stroke="#fff"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <rect x="4" y="-8" width="82" height="12" fill={color} />
      </svg>
    </div>
  );
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterA = spring({ frame, fps, config: { damping: 14 } });
  const enterB = spring({ frame: frame - 8, fps, config: { damping: 14 } });
  const titleY = interpolate(frame, [0, 18], [-200, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.6)),
  });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      {/* top tag */}
      <div
        style={{
          position: "absolute",
          top: 90,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          translate: `0 ${titleY}px`,
        }}
      >
        <div
          style={{
            background: C.yellow,
            color: C.ink,
            fontWeight: 900,
            fontSize: 50,
            padding: "16px 44px",
            borderRadius: 999,
            rotate: "-2deg",
            boxShadow: "0 10px 0 #B45309",
          }}
        >
          Gift Card कहाँ किन्ने?
        </div>
      </div>

      <Bubble
        start={Q_START}
        tail="left"
        top={260}
        color="#ffffff"
        textColor={C.ink}
        typeFrames={100}
        plain="साथी, गिफ्ट कार्ड सस्तोमा कहाँ किन्ने? भरपर्दो साइट थाहा छ?"
        text={
          <>
            साथी, गिफ्ट कार्ड <span style={{ color: C.purple }}>सस्तोमा</span>{" "}
            कहाँ किन्ने? <span style={{ color: C.purple }}>भरपर्दो</span> साइट
            थाहा छ?
          </>
        }
      />
      <Bubble
        start={A_START}
        tail="right"
        top={700}
        color={C.amber}
        textColor={C.ink}
        typeFrames={90}
        plain="byiora.com.np! सस्तो पनि, भरपर्दो पनि!"
        text={
          <>
            <span
              style={{
                background: C.purple,
                color: C.yellow,
                padding: "0 16px",
                borderRadius: 16,
              }}
            >
              byiora.com.np
            </span>
            ! सस्तो पनि, भरपर्दो पनि!
          </>
        }
      />

      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 20,
          translate: `${(1 - enterA) * -600}px 0`,
        }}
      >
        <Character
          shirt="#38BDF8"
          hair="#1F2937"
          skin="#E0A878"
          talking={frame > Q_START + 5 && frame < Q_START + 114}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 20,
          translate: `${(1 - enterB) * 600}px 0`,
        }}
      >
        <Character
          shirt={C.purple}
          hair="#3B2416"
          skin="#C68A5E"
          talking={frame > A_START + 5 && frame < A_START + 110}
          flip
          pointing={frame > A_START}
          cap
          longHair
        />
      </div>
      <Sequence name="Voice: question" from={Q_START} layout="none">
        <Audio src={staticFile("voice/q.wav")} />
      </Sequence>
      <Sequence name="Voice: answer" from={A_START} layout="none">
        <Audio src={staticFile("voice/a.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};
