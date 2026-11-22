import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "./theme";

// Animated brand gradient with drifting sparkles and gift shapes.
const SHAPES = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 337) % 1080,
  y: (i * 613) % 1920,
  size: 18 + ((i * 7) % 5) * 10,
  speed: 0.6 + ((i * 3) % 4) * 0.35,
  kind: i % 3,
}));

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const angle = 160 + Math.sin(frame / 60) * 12;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${C.purple} 0%, ${C.purpleDeep} 55%, ${C.purpleDark} 100%)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          left: -500 + Math.sin(frame / 50) * 60,
          top: -700,
          background:
            "radial-gradient(circle, rgba(255,215,0,0.22) 0%, rgba(255,215,0,0) 60%)",
        }}
      />
      {SHAPES.map((s, i) => {
        const y = ((s.y - frame * s.speed * 2 + 2400) % 2100) - 100;
        const rot = frame * s.speed * 1.5;
        const op = interpolate(Math.sin(frame / 20 + i), [-1, 1], [0.15, 0.5]);
        const color = i % 2 ? C.yellow : C.amber;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: y,
              opacity: op,
              rotate: `${rot}deg`,
            }}
          >
            {s.kind === 0 ? (
              <svg width={s.size} height={s.size} viewBox="0 0 24 24">
                <path
                  d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"
                  fill={color}
                />
              </svg>
            ) : s.kind === 1 ? (
              <div
                style={{
                  width: s.size * 0.6,
                  height: s.size * 0.6,
                  borderRadius: "50%",
                  background: color,
                }}
              />
            ) : (
              <svg
                width={s.size * 1.3}
                height={s.size * 1.3}
                viewBox="0 0 24 24"
              >
                <rect x="3" y="9" width="18" height="13" rx="2" fill={color} />
                <rect x="2" y="6" width="20" height="4" rx="1" fill={color} />
                <rect x="11" y="6" width="2" height="16" fill={C.purpleDeep} />
              </svg>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
