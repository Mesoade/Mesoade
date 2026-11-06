import React, { useEffect, useState } from "react";
import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Sequence,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";
import {
  ClickStory,
  ComfortZone,
  DayCounter,
  EndCard,
  FavoritePhoto,
  MillionMath,
  OneGoesViral,
  SiteScreenshot,
  ThirtyDays,
  Virality,
  World,
} from "./scenes";
import { loadFonts } from "./theme";

export const FPS = 30;
export const DURATION = 2108; // 70.27s source

export const Day6: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    loadFonts().then(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* A-roll: original talking-head clip with its burned-in captions and voice */}
      <Video name="A-roll" src={staticFile("day6.mp4")} />

      {/* B-roll cutaways (panel sits above the speaker's head) */}
      <Sequence name="B: Day 6 counter" from={9} durationInFrames={63}>
        <DayCounter />
      </Sequence>
      <Sequence name="B: Site — only 6 squares" from={72} durationInFrames={69}>
        <SiteScreenshot />
      </Sequence>
      <Sequence name="B: 6 of 1,000,000" from={210} durationInFrames={147}>
        <MillionMath />
      </Sequence>
      <Sequence name="B: Next 30 days" from={567} durationInFrames={75}>
        <ThirtyDays />
      </Sequence>
      <Sequence name="B: Virality, $0 ads" from={738} durationInFrames={180}>
        <Virality />
      </Sequence>
      <Sequence name="B: One goes viral" from={930} durationInFrames={106}>
        <OneGoesViral />
      </Sequence>
      <Sequence name="B: Comfort zone" from={1036} durationInFrames={81}>
        <ComfortZone />
      </Sequence>
      <Sequence name="B: Favorite photo" from={1209} durationInFrames={123}>
        <FavoritePhoto />
      </Sequence>
      <Sequence name="B: Anywhere in the world" from={1518} durationInFrames={99}>
        <World />
      </Sequence>
      <Sequence name="B: Click → story" from={1638} durationInFrames={102}>
        <ClickStory />
      </Sequence>
      <Sequence name="B: End card" from={1980} durationInFrames={128}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
