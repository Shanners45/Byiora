import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { EndCard } from "./EndCard";
import { Intro } from "./Intro";
import { Walkthrough } from "./Walkthrough";
import {
  END_FRAMES,
  INTRO_FRAMES,
  TOTAL_FRAMES,
  TRANSITION,
  WALK_FRAMES,
  voiceWindows,
} from "./theme";

const WINDOWS = voiceWindows();
// Music: 0.30 normally, ducked to 0.10 under the voice, faded out at the very end.
const musicVolume = (f: number) => {
  const near = Math.min(
    ...WINDOWS.map(([a, b]) => (f < a ? a - f : f > b ? f - b : 0)),
  );
  const duck = interpolate(near, [0, 8], [0.1, 0.3], {
    extrapolateRight: "clamp",
  });
  const fade = interpolate(f, [TOTAL_FRAMES - 20, TOTAL_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return duck * fade;
};

export const Promo: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("music.wav")} volume={musicVolume} />
    <TransitionSeries>
      <TransitionSeries.Sequence
        name="Intro dialogue"
        durationInFrames={INTRO_FRAMES}
      >
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={springTiming({
          config: { damping: 200 },
          durationInFrames: TRANSITION,
        })}
      />
      <TransitionSeries.Sequence
        name="Website walkthrough"
        durationInFrames={WALK_FRAMES}
      >
        <Walkthrough />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-top-left" })}
        timing={springTiming({
          config: { damping: 200 },
          durationInFrames: TRANSITION,
        })}
      />
      <TransitionSeries.Sequence name="End card" durationInFrames={END_FRAMES}>
        <EndCard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
