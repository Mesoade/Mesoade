import { loadFont } from "@remotion/fonts";
import { Easing, staticFile } from "remotion";

// Palette sampled from the live site (hero screenshot).
export const C = {
  bg: "#13110f",
  bgRaised: "#1d1a17",
  line: "#3a332d",
  cream: "#f2ece2",
  dim: "#a59c90",
  orange: "#e8692f",
  orangeSoft: "rgba(232,105,47,0.18)",
};

export const SERIF = "Playfair Display";
export const SANS = "Inter";

// Burned-in captions start at ~y=1300. B-roll stays above this line.
export const PANEL_H = 1250;

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

let fontsPromise: Promise<unknown> | null = null;
export const loadFonts = () => {
  if (fontsPromise) return fontsPromise;
  const f = (family: string, file: string, weight: string, style = "normal") =>
    loadFont({ family, url: staticFile(`fonts/${file}`), weight, style });
  fontsPromise = Promise.all([
    f(SERIF, "playfair-display-latin-400-normal.woff2", "400"),
    f(SERIF, "playfair-display-latin-700-normal.woff2", "700"),
    f(SERIF, "playfair-display-latin-400-italic.woff2", "400", "italic"),
    f(SERIF, "playfair-display-latin-700-italic.woff2", "700", "italic"),
    f(SANS, "inter-latin-400-normal.woff2", "400"),
    f(SANS, "inter-latin-500-normal.woff2", "500"),
    f(SANS, "inter-latin-600-normal.woff2", "600"),
    f(SANS, "inter-latin-700-normal.woff2", "700"),
  ]);
  return fontsPromise;
};
