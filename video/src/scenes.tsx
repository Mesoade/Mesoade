import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Panel } from "./Panel";
import { Sfx } from "./Sfx";
import { C, EASE_IN_OUT, EASE_OUT, SANS, SERIF, clamp } from "./theme";

// ---------- helpers ----------

/** 0→1 progress between two frames, eased. */
const useProgress = () => {
  const frame = useCurrentFrame();
  return (a: number, b: number, easing = EASE_OUT) =>
    interpolate(frame, [a, b], [0, 1], { ...clamp, easing });
};

const mix = (p: number, a: number, b: number) => a + (b - a) * p;

const Title: React.FC<{
  children: React.ReactNode;
  top: number;
  p: number;
  size?: number;
}> = ({ children, top, p, size = 92 }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: 80,
      right: 80,
      textAlign: "center",
      fontFamily: SERIF,
      fontWeight: 400,
      fontSize: size,
      lineHeight: 1.08,
      color: C.cream,
      opacity: p,
      translate: `0px ${mix(p, 40, 0)}px`,
    }}
  >
    {children}
  </div>
);

const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontStyle: "italic", color: C.orange }}>{children}</span>
);

const PHOTOS = ["girl", "hands", "pets", "tulips", "balloon", "kids"] as const;
const photo = (name: (typeof PHOTOS)[number]) => staticFile(`photos/${name}.jpg`);

// ---------- 1. Day 6 counter ----------

export const DayCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useProgress();
  const STEP = 4.5;
  const START = 8;
  const day = Math.max(1, Math.min(6, 1 + Math.floor((frame - START) / STEP)));
  const landed = p(START + 5 * STEP, START + 5 * STEP + 10);

  return (
    <Panel label="Building in public" noExit>
      {[0, 1, 2, 3, 4].map((i) => (
        <Sfx key={i} at={Math.round(START + (i + 1) * STEP)} name="tick" />
      ))}
      <Sfx at={Math.round(START + 5 * STEP)} name="pop" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 50,
            letterSpacing: "0.4em",
            color: C.dim,
            opacity: p(0, 10),
            marginTop: 50,
            marginBottom: -24,
          }}
        >
          DAY
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 330,
            lineHeight: 1,
            color: day === 6 ? C.orange : C.cream,
            scale: mix(landed, 1.08, 1),
            fontVariantNumeric: "tabular-nums",
            opacity: p(0, 8),
          }}
        >
          {day}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
          {[1, 2, 3, 4, 5, 6].map((d) => (
            <div
              key={d}
              style={{
                width: 46,
                height: 46,
                borderRadius: 7,
                backgroundColor: d <= day ? C.orange : "transparent",
                border: `3px solid ${d <= day ? C.orange : C.line}`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 50,
            color: C.cream,
            marginTop: 34,
            opacity: p(14, 26),
          }}
        >
          of The Million Squares
        </div>
      </AbsoluteFill>
    </Panel>
  );
};

// ---------- 2. Site screenshot: only 6 squares ----------

export const SiteScreenshot: React.FC = () => {
  const p = useProgress();
  const IMG_W = 1189;
  const IMG_H = 2000;
  const zoom = p(22, 46, EASE_IN_OUT);
  const s = mix(zoom, 0.33, 1.25);
  const fx = mix(zoom, IMG_W / 2, 330);
  const fy = mix(zoom, IMG_H / 2, 1440);
  const SX = 540;
  const SY = 390;
  const ring = p(44, 54);

  return (
    <Panel noEnter>
      <Sfx at={44} name="ding" />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: IMG_W,
          height: IMG_H,
          transformOrigin: "0 0",
          transform: `translate(${SX - s * fx}px, ${SY - s * fy}px) scale(${s})`,
          borderRadius: 40,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          outline: `3px solid ${C.line}`,
        }}
      >
        <Img src={staticFile("site.png")} style={{ width: IMG_W, height: IMG_H }} />
        <div
          style={{
            position: "absolute",
            left: 40,
            top: 1395,
            width: 590,
            height: 92,
            borderRadius: 46,
            border: `5px solid ${C.orange}`,
            boxShadow: `0 0 ${mix(ring, 0, 40)}px ${C.orange}`,
            opacity: ring,
            scale: mix(ring, 1.2, 1),
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 640,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SERIF,
          fontSize: 80,
          color: C.cream,
          opacity: p(50, 60),
          translate: `0px ${mix(p(50, 60), 30, 0)}px`,
          textShadow: "0 4px 30px rgba(0,0,0,0.9)",
        }}
      >
        Day 6: <Em>six</Em> squares.
      </div>
    </Panel>
  );
};

// ---------- 3. The math: 6 of 1,000,000 ----------

export const MillionMath: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useProgress();
  const COLS = 30;
  const ROWS = 11;
  const CELL = 26;
  const GAP = 6;
  const gridW = COLS * CELL + (COLS - 1) * GAP;
  const lit = [47, 98, 161, 214, 263, 301];
  const POP0 = 34;
  const statIn = p(64, 80);

  return (
    <Panel label="The math so far">
      {lit.map((_, i) => (
        <Sfx key={i} at={POP0 + i * 3} name="pop" volume={0.18} />
      ))}
      <Sfx at={64} name="ding" />
      <Title top={100} p={p(0, 14)} size={80}>
        1,000,000 squares
      </Title>
      <div
        style={{
          position: "absolute",
          top: 240,
          left: (1080 - gridW) / 2,
          width: gridW,
          display: "flex",
          flexWrap: "wrap",
          gap: GAP,
          opacity: mix(statIn, 1, 0.22),
        }}
      >
        {new Array(COLS * ROWS).fill(0).map((_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const appear = interpolate(frame, [4 + (col + row) * 0.5, 12 + (col + row) * 0.5], [0, 1], clamp);
          const litIdx = lit.indexOf(i);
          const on = litIdx >= 0 ? p(POP0 + litIdx * 3, POP0 + litIdx * 3 + 6) : 0;
          return (
            <div
              key={i}
              style={{
                width: CELL,
                height: CELL,
                borderRadius: 4,
                backgroundColor: on > 0 ? C.orange : "#2b2520",
                opacity: appear,
                scale: on > 0 ? mix(on, 2.2, 1) : 1,
                boxShadow: on > 0 ? `0 0 18px ${C.orange}` : undefined,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 610,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 28,
          color: C.dim,
          opacity: p(20, 30) * (1 - statIn),
        }}
      >
        not to scale (at real scale, 6 squares wouldn't even be visible)
      </div>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: statIn,
          scale: mix(statIn, 0.9, 1),
          paddingTop: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 240,
              color: C.orange,
              lineHeight: 1,
            }}
          >
            6
          </span>
          <span style={{ fontFamily: SERIF, fontSize: 76, color: C.cream }}>
            / 1,000,000
          </span>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: "14px 40px",
            borderRadius: 999,
            backgroundColor: C.orangeSoft,
            border: `3px solid ${C.orange}`,
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 50,
            color: C.cream,
            opacity: p(88, 98),
            scale: mix(p(88, 98), 0.85, 1),
          }}
        >
          = 0.0006% filled
        </div>
        <div
          style={{
            marginTop: 28,
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 48,
            color: C.dim,
            opacity: p(106, 118),
          }}
        >
          999,994 still waiting for a story.
        </div>
      </AbsoluteFill>
    </Panel>
  );
};

// ---------- 4. Next 30 days ----------

export const ThirtyDays: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useProgress();
  const CELL = 84;
  const GAP = 12;
  const W = 10 * CELL + 9 * GAP;

  return (
    <Panel label="The promise">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Sfx key={i} at={20 + i * 3} name="tick" />
      ))}
      <Title top={100} p={p(0, 14)} size={80}>
        <Em>30</Em> days. <Em>30</Em> videos.
      </Title>
      <div
        style={{
          position: "absolute",
          top: 290,
          left: (1080 - W) / 2,
          width: W,
          display: "flex",
          flexWrap: "wrap",
          gap: GAP,
        }}
      >
        {new Array(30).fill(0).map((_, i) => {
          const day = i + 1;
          const appear = interpolate(frame, [3 + i * 0.6, 11 + i * 0.6], [0, 1], {
            ...clamp,
            easing: EASE_OUT,
          });
          const done = day <= 6 ? p(20 + i * 3, 26 + i * 3) : 0;
          return (
            <div
              key={i}
              style={{
                width: CELL,
                height: CELL,
                borderRadius: 12,
                border: `3px solid ${done > 0 ? C.orange : C.line}`,
                backgroundColor: done > 0 ? C.orange : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 32,
                color: done > 0 ? C.bg : C.dim,
                opacity: appear,
                scale: mix(appear, 0.7, 1) * (done > 0 ? mix(done, 1.15, 1) : 1),
                outline: day === 6 ? `4px solid ${C.cream}` : undefined,
                outlineOffset: 5,
              }}
            >
              {done > 0.5 ? "✓" : day}
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

// ---------- 5. Virality, $0 paid ads ----------

export const Virality: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useProgress();
  const CX = 540;
  const CY = 490;
  const ring1 = new Array(6).fill(0).map((_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: CX + Math.cos(a) * 150, y: CY + Math.sin(a) * 150, a };
  });
  const ring2 = new Array(14).fill(0).map((_, i) => {
    const a = (i / 14) * Math.PI * 2 - Math.PI / 2 + 0.2;
    return { x: CX + Math.cos(a) * 340, y: CY + Math.sin(a) * 235, a };
  });
  const stamp = p(117, 127);
  const spin = interpolate(frame, [0, 180], [0, 8]);

  const node = (x: number, y: number, size: number, prog: number, key: string, filled: boolean) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size * 0.18,
        backgroundColor: filled ? C.orange : C.cream,
        opacity: prog,
        scale: mix(prog, 0, 1),
      }}
    />
  );

  return (
    <Panel label="The plan">
      {[0, 1, 2].map((i) => (
        <Sfx key={`a${i}`} at={28 + i * 6} name="pop" volume={0.16} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Sfx key={`b${i}`} at={58 + i * 6} name="pop" volume={0.13} />
      ))}
      <Sfx at={117} name="thud" />
      <Title top={100} p={p(0, 14)} size={80}>
        Relies on <Em>virality</Em>
      </Title>
      <AbsoluteFill style={{ rotate: `${spin}deg`, opacity: mix(stamp, 1, 0.35) }}>
        <svg width={1080} height={830} style={{ position: "absolute" }}>
          {ring1.map((n, i) => {
            const pr = p(24 + i * 3, 36 + i * 3);
            return (
              <line
                key={`l1${i}`}
                x1={CX}
                y1={CY}
                x2={mix(pr, CX, n.x)}
                y2={mix(pr, CY, n.y)}
                stroke={C.line}
                strokeWidth={4}
              />
            );
          })}
          {ring2.map((n, i) => {
            const parent = ring1[Math.round((i / 14) * 6) % 6];
            const pr = p(54 + i * 2, 66 + i * 2);
            return (
              <line
                key={`l2${i}`}
                x1={parent.x}
                y1={parent.y}
                x2={mix(pr, parent.x, n.x)}
                y2={mix(pr, parent.y, n.y)}
                stroke={C.line}
                strokeWidth={3}
              />
            );
          })}
        </svg>
        {node(CX, CY, 76, p(4, 16), "c", true)}
        {ring1.map((n, i) => node(n.x, n.y, 46, p(32 + i * 3, 42 + i * 3), `r1${i}`, false))}
        {ring2.map((n, i) => node(n.x, n.y, 30, p(62 + i * 2, 72 + i * 2), `r2${i}`, i % 3 === 0))}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 110 }}>
        <div
          style={{
            border: `10px solid ${C.orange}`,
            borderRadius: 24,
            padding: "18px 44px",
            backgroundColor: "rgba(19,17,15,0.85)",
            rotate: "-8deg",
            opacity: stamp,
            scale: mix(stamp, 1.8, 1),
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 150,
              lineHeight: 1,
              color: C.orange,
            }}
          >
            $0
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 48,
              letterSpacing: "0.2em",
              color: C.cream,
              marginTop: 8,
            }}
          >
            PAID ADS
          </div>
        </div>
      </AbsoluteFill>
    </Panel>
  );
};

// ---------- 6. Several videos, one goes viral ----------

export const OneGoesViral: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useProgress();
  const N = 5;
  const CW = 130;
  const CH = 230;
  const GAP = 24;
  const rowW = N * CW + (N - 1) * GAP;
  const lift = p(46, 66);

  return (
    <Panel label="Several videos" noExit>
      {[0, 1, 2, 3, 4].map((i) => (
        <Sfx key={i} at={4 + i * 4} name="tick" volume={0.15} />
      ))}
      <Sfx at={44} name="riser" />
      <Sfx at={64} name="pop" />
      <Title top={100} p={p(46, 60)} size={80}>
        <Em>One</Em> goes viral.
      </Title>
      <svg width={1080} height={830} style={{ position: "absolute" }}>
        <polyline
          points={(() => {
            const pts: string[] = [];
            const x0 = 140;
            const x1 = 940;
            for (let i = 0; i <= 40; i++) {
              const t = i / 40;
              const x = mix(t, x0, x1);
              const y = 770 - (t < 0.6 ? t * 30 : 18 + Math.pow((t - 0.6) / 0.4, 2.6) * 520);
              pts.push(`${x},${y}`);
            }
            return pts.slice(0, Math.max(1, Math.round(41 * p(50, 80, EASE_IN_OUT)))).join(" ");
          })()}
          fill="none"
          stroke={C.orange}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={p(48, 54)}
        />
      </svg>
      {new Array(N).fill(0).map((_, i) => {
        const isViral = i === 2;
        const appear = p(2 + i * 4, 12 + i * 4);
        const x = (1080 - rowW) / 2 + i * (CW + GAP);
        const y = 450;
        const l = isViral ? lift : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: CW,
              height: CH,
              borderRadius: 20,
              backgroundColor: isViral && l > 0 ? C.orange : C.bgRaised,
              border: `3px solid ${isViral && l > 0 ? C.orange : C.line}`,
              opacity: appear * (isViral ? 1 : mix(lift, 1, 0.45)),
              translate: `0px ${mix(appear, 60, 0) - l * 150}px`,
              scale: mix(l, 1, 1.35),
              zIndex: isViral ? 2 : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              boxShadow: isViral ? `0 0 ${l * 60}px rgba(232,105,47,0.7)` : undefined,
            }}
          >
            <svg width={46} height={46} viewBox="0 0 56 56">
              <polygon points="18,12 46,28 18,44" fill={isViral && l > 0 ? C.bg : C.cream} />
            </svg>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 20,
                color: isViral && l > 0 ? C.bg : C.dim,
              }}
            >
              {isViral && l > 0.5
                ? `${Math.round(interpolate(frame, [60, 90], [12, 999], clamp))}K views`
                : `Day ${i + 2}`}
            </div>
          </div>
        );
      })}
    </Panel>
  );
};

// ---------- 7. Beyond my comfort zone ----------

export const ComfortZone: React.FC = () => {
  const p = useProgress();
  const out = p(18, 46, EASE_IN_OUT);
  const CX = 540;
  const CY = 500;
  const R = 240;

  return (
    <Panel label="Also" noEnter>
      <Sfx at={18} name="whoosh" volume={0.22} />
      <Title top={100} p={p(0, 14)} size={80}>
        Beyond my <Em>comfort zone</Em>
      </Title>
      <div
        style={{
          position: "absolute",
          left: CX - R,
          top: CY - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          border: `5px dashed ${C.dim}`,
          opacity: p(2, 12),
          scale: mix(p(2, 16), 0.8, 1),
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 60,
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: 42,
          color: C.dim,
        }}
      >
        comfort zone
      </div>
      <div
        style={{
          position: "absolute",
          left: mix(out, CX, 880) - 38,
          top: mix(out, CY - 30, 300) - 38,
          width: 76,
          height: 76,
          borderRadius: 12,
          backgroundColor: C.orange,
          boxShadow: `0 0 ${mix(out, 0, 50)}px ${C.orange}`,
          rotate: `${mix(out, 0, 20)}deg`,
          opacity: p(6, 14),
        }}
      />
    </Panel>
  );
};

// ---------- 8. Put your favorite photo on the wall ----------

export const FavoritePhoto: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useProgress();
  const COLS = 7;
  const ROWS = 3;
  const T = 124;
  const G = 10;
  const W = COLS * T + (COLS - 1) * G;
  const X0 = (1080 - W) / 2;
  const Y0 = 270;
  const filled: Record<number, (typeof PHOTOS)[number]> = {
    2: "pets",
    6: "tulips",
    11: "balloon",
    15: "kids",
    19: "hands",
  };
  const TARGET = 9;
  const tx = X0 + (TARGET % COLS) * (T + G);
  const ty = Y0 + Math.floor(TARGET / COLS) * (T + G);
  const fly = p(36, 64, EASE_OUT);
  const settle = p(72, 92, EASE_IN_OUT);
  const BIG = 320;
  const size = mix(settle, BIG, T);
  const cx = mix(settle, mix(fly, 1300, 540), tx + T / 2);
  const cy = mix(settle, 470, ty + T / 2);
  const flash = interpolate(frame, [92, 100, 116], [0, 1, 0], clamp);

  return (
    <Panel label="The ask">
      <Sfx at={36} name="whoosh" volume={0.2} />
      <Sfx at={92} name="pop" volume={0.32} />
      <Title top={100} p={p(0, 14)} size={80}>
        Your <Em>favorite</Em> photo.
      </Title>
      {new Array(COLS * ROWS).fill(0).map((_, i) => {
        const x = X0 + (i % COLS) * (T + G);
        const y = Y0 + Math.floor(i / COLS) * (T + G);
        const appear = p(2 + i * 0.8, 12 + i * 0.8);
        const ph = filled[i];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: T,
              height: T,
              borderRadius: 10,
              overflow: "hidden",
              backgroundColor: "#2b2520",
              opacity: appear * (ph ? 1 : 0.9),
              outline: i === TARGET ? `4px dashed ${C.orange}` : undefined,
              outlineOffset: -4,
            }}
          >
            {ph ? (
              <Img src={photo(ph)} style={{ width: T, height: T, objectFit: "cover", opacity: p(14 + i, 26 + i) }} />
            ) : null}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          borderRadius: mix(settle, 24, 10),
          overflow: "hidden",
          rotate: `${mix(settle, mix(fly, 18, -5), 0)}deg`,
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${flash * 50}px ${C.orange}`,
          outline: `${mix(settle, 10, 4)}px solid ${flash > 0 ? C.orange : C.cream}`,
          opacity: fly > 0 ? 1 : 0,
        }}
      >
        <Img src={photo("girl")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </Panel>
  );
};

// ---------- 9. Anyone, anywhere in the world ----------

export const World: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useProgress();
  const CX = 540;
  const CY = 505;
  const R = 275;
  const rot = frame * 0.02;
  const pins = [
    { lat: 0.5, lon: 0.3 },
    { lat: -0.3, lon: 1.2 },
    { lat: 0.9, lon: 2.1 },
    { lat: 0.1, lon: 3.0 },
    { lat: -0.7, lon: 4.0 },
    { lat: 0.6, lon: 4.9 },
    { lat: -0.1, lon: 5.6 },
    { lat: 0.3, lon: -0.6 },
  ];

  return (
    <Panel label="The dream">
      {[0, 1, 2, 3, 4].map((i) => (
        <Sfx key={i} at={18 + i * 8} name="pop" volume={0.14} />
      ))}
      <Title top={100} p={p(0, 14)} size={80}>
        Anyone. <Em>Anywhere.</Em>
      </Title>
      <svg width={1080} height={830} style={{ position: "absolute", opacity: p(0, 14) }}>
        <defs>
          <radialGradient id="globe" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#2c241e" />
            <stop offset="100%" stopColor="#15120f" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="url(#globe)" stroke={C.dim} strokeWidth={3} />
        {[-60, -30, 0, 30, 60].map((lat) => {
          const y = CY - Math.sin((lat * Math.PI) / 180) * R;
          const rx = Math.cos((lat * Math.PI) / 180) * R;
          return (
            <ellipse key={`p${lat}`} cx={CX} cy={y} rx={rx} ry={rx * 0.08} fill="none" stroke={C.line} strokeWidth={2} />
          );
        })}
        {new Array(6).fill(0).map((_, i) => {
          const lon = (i / 6) * Math.PI + rot;
          const rx = Math.abs(Math.cos(lon)) * R;
          return <ellipse key={`m${i}`} cx={CX} cy={CY} rx={rx} ry={R} fill="none" stroke={C.line} strokeWidth={2} />;
        })}
        {pins.map((pin, i) => {
          const lon = pin.lon + rot;
          const z = Math.cos(pin.lat) * Math.cos(lon);
          if (z < 0.05) return null;
          const x = CX + Math.cos(pin.lat) * Math.sin(lon) * R;
          const y = CY - Math.sin(pin.lat) * R;
          const pr = p(14 + i * 6, 22 + i * 6);
          const pulse = ((frame - (14 + i * 6)) % 30) / 30;
          return (
            <g key={`pin${i}`} opacity={pr * Math.min(1, z * 3)}>
              <circle cx={x} cy={y} r={14 + pulse * 40} fill="none" stroke={C.orange} strokeWidth={3} opacity={1 - pulse} />
              <rect x={x - 13} y={y - 13} width={26} height={26} rx={5} fill={C.orange} />
            </g>
          );
        })}
      </svg>
    </Panel>
  );
};

// ---------- 10. Click a picture, read the story ----------

export const ClickStory: React.FC = () => {
  const p = useProgress();
  const T = 200;
  const G = 14;
  const W = 4 * T + 3 * G;
  const X0 = (1080 - W) / 2;
  const Y0 = 250;
  const tiles: ((typeof PHOTOS)[number] | null)[] = ["pets", "tulips", "girl", null, "kids", "hands", null, "balloon"];
  const TARGET = 5;
  const tCx = X0 + (TARGET % 4) * (T + G) + T / 2;
  const tCy = Y0 + Math.floor(TARGET / 4) * (T + G) + T / 2;
  const move = p(14, 50, EASE_IN_OUT);
  const curX = mix(move, 960, tCx + 20);
  const curY = mix(move, 780, tCy + 30);
  const press = interpolate(useCurrentFrame(), [54, 58, 64], [1, 0.92, 1], clamp);
  const open = p(62, 82, EASE_IN_OUT);

  // story card geometry: from tile → big card
  const cardW = mix(open, T, 860);
  const cardH = mix(open, T, 600);
  const cardX = mix(open, tCx - T / 2, 110);
  const cardY = mix(open, tCy - T / 2, 190);

  return (
    <Panel label="Every square has a story">
      <Sfx at={56} name="click" />
      <Sfx at={62} name="whoosh" volume={0.2} />
      {tiles.map((t, i) => {
        const x = X0 + (i % 4) * (T + G);
        const y = Y0 + Math.floor(i / 4) * (T + G);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: T,
              height: T,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#2b2520",
              opacity: p(2 + i * 1.5, 12 + i * 1.5) * mix(open, 1, 0.25),
              scale: i === TARGET ? press : 1,
              outline: i === TARGET && move > 0.9 ? `5px solid ${C.orange}` : undefined,
            }}
          >
            {t ? <Img src={photo(t)} style={{ width: T, height: T, objectFit: "cover" }} /> : null}
          </div>
        );
      })}
      {open > 0 ? (
        <div
          style={{
            position: "absolute",
            left: cardX,
            top: cardY,
            width: cardW,
            height: cardH,
            borderRadius: mix(open, 12, 28),
            backgroundColor: C.bgRaised,
            border: `3px solid ${C.line}`,
            overflow: "hidden",
            boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
          }}
        >
          <Img
            src={photo("hands")}
            style={{ width: "100%", height: mix(open, T, 330), objectFit: "cover" }}
          />
          <div style={{ padding: "28px 44px", opacity: p(78, 90) }}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 26,
                letterSpacing: "0.25em",
                color: C.orange,
              }}
            >
              THE STORY
            </div>
            {[0.92, 0.85, 0.6].map((w, i) => (
              <div
                key={i}
                style={{
                  marginTop: i === 0 ? 22 : 16,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: C.line,
                  width: `${w * 100 * p(82 + i * 4, 94 + i * 4)}%`,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
      {/* Cursor */}
      <svg
        width={70}
        height={90}
        viewBox="0 0 24 30"
        style={{
          position: "absolute",
          left: curX,
          top: curY,
          opacity: p(10, 16) * (1 - p(62, 70)),
          scale: press,
          filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
        }}
      >
        <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 16 L20 16 Z" fill={C.cream} stroke={C.bg} strokeWidth={1.5} />
      </svg>
    </Panel>
  );
};

// ---------- 11. End card / CTA ----------

export const EndCard: React.FC = () => {
  const p = useProgress();
  const pulse = interpolate(useCurrentFrame(), [72, 80, 92], [1, 1.08, 1], clamp);

  return (
    <Panel noExit>
      <Sfx at={74} name="ding" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, opacity: p(4, 16) }}>
          <svg width={52} height={52} viewBox="0 0 52 52">
            <rect x={0} y={0} width={22} height={22} fill={C.orange} />
            <rect x={30} y={0} width={22} height={22} fill={C.cream} />
            <rect x={0} y={30} width={22} height={22} fill={C.cream} />
            <rect x={30} y={30} width={22} height={22} fill={C.cream} />
          </svg>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 40,
              letterSpacing: "0.3em",
              color: C.cream,
            }}
          >
            THE MILLION SQUARES
          </div>
        </div>
        <div
          style={{
            marginTop: 44,
            fontFamily: SERIF,
            fontSize: 104,
            lineHeight: 1.05,
            color: C.cream,
            textAlign: "center",
            opacity: p(10, 24),
            translate: `0px ${mix(p(10, 24), 40, 0)}px`,
          }}
        >
          Tell your <Em>story.</Em>
        </div>
        <div
          style={{
            marginTop: 50,
            padding: "28px 64px",
            borderRadius: 999,
            backgroundColor: C.orange,
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 48,
            color: C.cream,
            opacity: p(24, 36),
            scale: mix(p(24, 36), 0.85, 1) * pulse,
            boxShadow: "0 20px 60px rgba(232,105,47,0.35)",
          }}
        >
          Claim your square — $10
        </div>
        <div
          style={{
            marginTop: 38,
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontFamily: SANS,
            fontSize: 34,
            letterSpacing: "0.08em",
            color: C.dim,
            opacity: p(36, 48),
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.orange }} />
          <span>
            <span style={{ color: C.cream }}>6</span> of 1,000,000 claimed
          </span>
        </div>
      </AbsoluteFill>
    </Panel>
  );
};
