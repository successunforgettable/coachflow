import { Composition } from "remotion";
import { ZapAdVideo, ZapAdVideoSchema } from "./ZapAdVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ZapAdVideo"
      component={ZapAdVideo}
      schema={ZapAdVideoSchema}
      durationInFrames={900} // Placeholder — overridden by calculateMetadata
      fps={30}
      width={1080}
      height={1920} // 9:16 portrait for social ads
      defaultProps={{
        scenes: [],
        primaryColor: "#FF5B1D",
        coachName: "",
        logoUrl: null,
        voiceoverUrl: null,
        totalDurationInSeconds: 30,
        visualStyle: "kinetic_typography",
      }}
    />
  );
};
