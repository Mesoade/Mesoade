import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";

export type SfxName =
  | "whoosh"
  | "pop"
  | "tick"
  | "ding"
  | "click"
  | "thud"
  | "riser";

const DEFAULT_VOL: Record<SfxName, number> = {
  whoosh: 0.18,
  pop: 0.28,
  tick: 0.22,
  ding: 0.2,
  click: 0.45,
  thud: 0.5,
  riser: 0.28,
};

/** A sound effect that fires at `at` frames into the parent Sequence. */
export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number }> = ({
  at,
  name,
  volume,
}) => (
  <Sequence from={at} layout="none" name={`sfx: ${name}`}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume ?? DEFAULT_VOL[name]} />
  </Sequence>
);
