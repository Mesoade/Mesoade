import { Composition } from "remotion";
import { DURATION, Day6, FPS } from "./Day6";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Day6"
      component={Day6}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
