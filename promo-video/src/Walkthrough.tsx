import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Sequence,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "./Background";
import {
  C,
  SEGMENTS,
  STEP_VOICE_DELAY,
  fontFamily,
  segFrames,
  type Segment,
} from "./theme";

const SCREEN_W = 650;
const SCREEN_H = Math.round((SCREEN_W * 844) / 390);
const BEZEL = 22;

const Caption: React.FC<{ step: number; seg: Segment }> = ({ step, seg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 170 } });
  const sub = spring({ frame: frame - 5, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 50,
        right: 50,
        display: "flex",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: C.yellow,
          color: C.ink,
          fontWeight: 900,
          fontSize: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 9px 0 #B45309",
          scale: String(pop),
          rotate: `${(1 - pop) * -90}deg`,
        }}
      >
        {step}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            color: C.white,
            fontWeight: 900,
            fontSize: 64,
            lineHeight: 1.25,
            textShadow: "0 5px 0 rgba(0,0,0,0.35)",
            translate: `${(1 - pop) * 80}px 0`,
            opacity: pop,
          }}
        >
          {seg.ne}
        </div>
        <div
          style={{
            color: C.yellow,
            fontWeight: 800,
            fontSize: 42,
            opacity: sub,
            translate: `${(1 - sub) * 60}px 0`,
          }}
        >
          {seg.en}
        </div>
      </div>
    </div>
  );
};

const Progress: React.FC<{ active: number }> = ({ active }) => (
  <div
    style={{
      position: "absolute",
      top: 262,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      gap: 16,
    }}
  >
    {SEGMENTS.map((_, i) => (
      <div
        key={i}
        style={{
          width: i === active ? 90 : 26,
          height: 18,
          borderRadius: 9,
          background: i <= active ? C.amber : "rgba(255,255,255,0.3)",
        }}
      />
    ))}
  </div>
);

export const Walkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const float = Math.sin(frame / 25) * 6;

  let acc = 0;
  const starts = SEGMENTS.map((s) => {
    const st = acc;
    acc += segFrames(s);
    return st;
  });
  const active = Math.max(0, starts.filter((st) => frame >= st).length - 1);

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      {SEGMENTS.map((s, i) => (
        <Sequence
          key={i}
          name={`Caption ${i + 1}`}
          from={starts[i]}
          durationInFrames={segFrames(s)}
          layout="none"
        >
          <Caption step={i + 1} seg={s} />
          <Sequence
            name={`Voice: step ${i + 1}`}
            from={STEP_VOICE_DELAY}
            layout="none"
          >
            <Audio src={staticFile(`voice/s${i + 1}.wav`)} />
          </Sequence>
        </Sequence>
      ))}
      <Progress active={active} />

      {/* Phone */}
      <div
        style={{
          position: "absolute",
          left: (1080 - SCREEN_W - 2 * BEZEL) / 2,
          top: 320,
          width: SCREEN_W + 2 * BEZEL,
          height: SCREEN_H + 2 * BEZEL,
          borderRadius: 86,
          background: "linear-gradient(145deg, #2a2a35, #0b0b10)",
          boxShadow:
            "0 0 0 5px #4b4b5a, 0 40px 90px rgba(0,0,0,0.55), 0 0 120px rgba(255,215,0,0.25)",
          translate: `0 ${(1 - enter) * 1400 + float}px`,
          rotate: `${(1 - enter) * 8}deg`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: BEZEL,
            top: BEZEL,
            width: SCREEN_W,
            height: SCREEN_H,
            borderRadius: 66,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <Series>
            {SEGMENTS.map((s, i) => (
              <Series.Sequence
                key={i}
                name={`Clip ${i + 1}`}
                durationInFrames={segFrames(s)}
              >
                <Video
                  src={staticFile("demo.webm")}
                  trimBefore={Math.round(s.from * fps)}
                  trimAfter={Math.round(s.to * fps)}
                  playbackRate={s.rate}
                  muted
                  objectFit="cover"
                  style={{ width: SCREEN_W, height: SCREEN_H }}
                />
              </Series.Sequence>
            ))}
          </Series>
        </div>
      </div>
    </AbsoluteFill>
  );
};
