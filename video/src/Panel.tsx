import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Sfx } from "./Sfx";
import { C, EASE_IN_OUT, PANEL_H, clamp } from "./theme";

/**
 * B-roll panel. Covers the top of the frame (above the burned-in captions)
 * and wipes in from the top / wipes back out at the end of its Sequence.
 */
export const Panel: React.FC<{
  children: React.ReactNode;
  label?: string;
  /** Keep the panel on screen until the very last frame (end card). */
  noExit?: boolean;
  /** Hard cut in (used when this panel directly follows another one). */
  noEnter?: boolean;
}> = ({ children, label, noExit, noEnter }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const IN = 9;
  const OUT = 8;

  const reveal = noEnter && frame < IN ? 100 : interpolate(
    frame,
    noExit ? [0, IN] : [0, IN, durationInFrames - OUT, durationInFrames],
    noExit ? [0, 100] : [0, 100, 100, 0],
    { ...clamp, easing: EASE_IN_OUT },
  );

  return (
    <AbsoluteFill>
      <Sfx at={0} name="whoosh" />
      <AbsoluteFill
        style={{
          height: PANEL_H,
          clipPath: `inset(0 0 ${100 - reveal}% 0)`,
        }}
      >
      <AbsoluteFill
        style={{
          backgroundColor: C.bg,
          backgroundImage: `radial-gradient(ellipse 90% 70% at 50% 40%, #241d18 0%, ${C.bg} 70%)`,
        }}
      />
      {children}
      {label ? (
        <div
          style={{
            position: "absolute",
            top: 110,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "Inter",
            fontWeight: 500,
            fontSize: 30,
            letterSpacing: "0.32em",
            color: C.dim,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      ) : null}
      </AbsoluteFill>
      {/* Orange edge where the panel meets the speaker; rides the wipe */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (PANEL_H * reveal) / 100 - 3,
          height: 6,
          backgroundColor: C.orange,
          opacity: reveal > 0.5 ? 1 : 0,
          boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
        }}
      />
    </AbsoluteFill>
  );
};
