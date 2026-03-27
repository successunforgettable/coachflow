/**
 * ZapAdVideo — Remotion composition for ZAP Campaigns video ads.
 * Takes the same scenes array format the script generator produces.
 * Renders scenes with fade transitions, text overlays, and stock footage backgrounds.
 */
import React from "react";
import { z } from "zod";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

// ─── Schema ────────────────────────────────────────────────────────────────────

const SceneSchema = z.object({
  voiceoverText: z.string(),
  visualDirection: z.string().optional(),
  onScreenText: z.string().optional(),
  pexelsQuery: z.string().optional(),
  footageUrl: z.string().optional(), // Pre-fetched Pexels video URL
  durationInSeconds: z.number().optional(),
});

export const ZapAdVideoSchema = z.object({
  scenes: z.array(SceneSchema),
  primaryColor: z.string().default("#FF5B1D"),
  coachName: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  voiceoverUrl: z.string().nullable().optional(),
  totalDurationInSeconds: z.number().default(30),
});

export type ZapAdVideoProps = z.infer<typeof ZapAdVideoSchema>;

// ─── Scene Components ──────────────────────────────────────────────────────────

function SceneCard({
  scene,
  index,
  primaryColor,
  totalScenes,
}: {
  scene: z.infer<typeof SceneSchema>;
  index: number;
  primaryColor: string;
  totalScenes: number;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Text fade-in animation
  const textOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Text slide-up animation
  const textY = interpolate(frame, [0, 0.5 * fps], [30, 0], {
    extrapolateRight: "clamp",
  });

  // On-screen text typewriter effect
  const onScreenText = scene.onScreenText || "";
  const charsToShow = Math.floor(
    interpolate(frame, [0.3 * fps, 1.5 * fps], [0, onScreenText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const visibleOnScreenText = onScreenText.slice(0, charsToShow);

  // Determine if this is the intro scene, outro scene, or middle
  const isIntro = index === 0;
  const isOutro = index === totalScenes - 1;

  return (
    <AbsoluteFill>
      {/* Background: stock footage or gradient */}
      {scene.footageUrl ? (
        <Video
          src={scene.footageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          volume={0}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: isIntro
              ? `linear-gradient(135deg, ${primaryColor} 0%, #1a1a2e 100%)`
              : isOutro
              ? `linear-gradient(135deg, #1a1a2e 0%, ${primaryColor} 100%)`
              : `linear-gradient(180deg, #0f0f23 0%, #1a1a2e 100%)`,
          }}
        />
      )}

      {/* Dark overlay for text readability on footage */}
      {scene.footageUrl && (
        <AbsoluteFill
          style={{
            background: "rgba(0,0,0,0.45)",
          }}
        />
      )}

      {/* Content container — lower third positioning */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "0 60px 160px",
        }}
      >
        {/* On-screen text (big headline) */}
        {onScreenText && (
          <div
            style={{
              opacity: textOpacity,
              transform: `translateY(${textY}px)`,
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: isIntro ? "64px" : "52px",
              fontWeight: 900,
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 1.15,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              maxWidth: "90%",
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            {visibleOnScreenText}
          </div>
        )}

        {/* Accent bar */}
        <div
          style={{
            width: interpolate(frame, [0.4 * fps, 0.8 * fps], [0, 120], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: 4,
            background: primaryColor,
            borderRadius: 2,
            marginTop: 24,
            marginBottom: 24,
          }}
        />

        {/* Voiceover caption text (smaller, below) */}
        {scene.voiceoverText && !isIntro && (
          <div
            style={{
              opacity: interpolate(frame, [0.6 * fps, 1.0 * fps], [0, 0.9], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: scene.voiceoverText.length > 150 ? "22px" : scene.voiceoverText.length > 100 ? "24px" : "28px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: "90%",
            }}
          >
            {scene.voiceoverText}
          </div>
        )}
      </AbsoluteFill>

      {/* Scene number indicator (top left) */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {isOutro ? "CTA" : `Scene ${index + 1}`}
      </div>
    </AbsoluteFill>
  );
}

// ─── CTA Scene (final scene with call to action) ──────────────────────────────

function CtaScene({
  scene,
  primaryColor,
  coachName,
  logoUrl,
}: {
  scene: z.infer<typeof SceneSchema>;
  primaryColor: string;
  coachName?: string;
  logoUrl?: string | null;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const buttonScale = interpolate(
    frame,
    [0.5 * fps, 0.8 * fps, 1.0 * fps, 1.2 * fps],
    [0, 1.1, 0.95, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #0f0f23 0%, ${primaryColor}33 100%)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "80px 60px",
      }}
    >
      {/* Logo */}
      {logoUrl && (
        <Img
          src={logoUrl}
          style={{
            height: 60,
            marginBottom: 40,
            opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        />
      )}

      {/* CTA text */}
      <div
        style={{
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(frame, [0, 0.5 * fps], [20, 0], {
            extrapolateRight: "clamp",
          })}px)`,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "48px",
          fontWeight: 900,
          color: "#FFFFFF",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: "85%",
          textTransform: "uppercase",
        }}
      >
        {scene.onScreenText || "LEARN MORE"}
      </div>

      {/* CTA Button */}
      <div
        style={{
          transform: `scale(${buttonScale})`,
          marginTop: 40,
          background: primaryColor,
          borderRadius: 9999,
          padding: "20px 60px",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "24px",
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {scene.voiceoverText?.includes("Learn More")
          ? "LEARN MORE"
          : scene.voiceoverText?.includes("Book")
          ? "BOOK NOW"
          : "GET STARTED"}
      </div>

      {/* Coach name */}
      {coachName && (
        <div
          style={{
            marginTop: 30,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "18px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
            opacity: interpolate(frame, [0.8 * fps, 1.2 * fps], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          {coachName}
        </div>
      )}

      {/* Fade to black at the end */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: interpolate(frame, [3.0 * fps, 4.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
}

// ─── Main Composition ──────────────────────────────────────────────────────────

export const ZapAdVideo: React.FC<ZapAdVideoProps> = ({
  scenes,
  primaryColor,
  coachName,
  logoUrl,
  voiceoverUrl,
  totalDurationInSeconds,
}) => {
  const { fps } = useVideoConfig();

  if (!scenes || scenes.length === 0) {
    return (
      <AbsoluteFill style={{ background: "#0f0f23", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontFamily: "Arial", fontSize: 32 }}>No scenes provided</div>
      </AbsoluteFill>
    );
  }

  // Calculate per-scene duration
  const transitionDuration = Math.round(0.5 * fps); // 0.5s fade between scenes
  const totalFrames = Math.round(totalDurationInSeconds * fps);
  const sceneCount = scenes.length;
  const totalTransitionFrames = (sceneCount - 1) * transitionDuration;
  const availableFrames = totalFrames + totalTransitionFrames; // TransitionSeries shortens by transition duration
  const perSceneFrames = Math.max(
    Math.round(availableFrames / sceneCount),
    fps // Minimum 1 second per scene
  );

  // Determine transition types — alternate between fade and slide
  const getTransition = (index: number) => {
    if (index % 3 === 0) return fade();
    if (index % 3 === 1) return slide({ direction: "from-right" });
    return fade(); // Default to fade
  };

  return (
    <AbsoluteFill style={{ background: "#0f0f23" }}>
      {/* Voiceover audio */}
      {voiceoverUrl && (
        <Audio src={voiceoverUrl} volume={1} />
      )}

      {/* Scenes with transitions */}
      <TransitionSeries>
        {scenes.map((scene, i) => {
          const isLast = i === scenes.length - 1;

          return (
            <React.Fragment key={i}>
              <TransitionSeries.Sequence durationInFrames={perSceneFrames}>
                {isLast ? (
                  <CtaScene
                    scene={scene}
                    primaryColor={primaryColor}
                    coachName={coachName}
                    logoUrl={logoUrl}
                  />
                ) : (
                  <SceneCard
                    scene={scene}
                    index={i}
                    primaryColor={primaryColor}
                    totalScenes={scenes.length}
                  />
                )}
              </TransitionSeries.Sequence>

              {/* Add transition between scenes (not after last scene) */}
              {!isLast && (
                <TransitionSeries.Transition
                  presentation={getTransition(i)}
                  timing={linearTiming({ durationInFrames: transitionDuration })}
                />
              )}
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
