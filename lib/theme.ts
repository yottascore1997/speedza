/** Aligns with delivery-web shop (emerald / stone / orange). */
export const theme = {
  bg: "#fafaf9",
  bgElevated: "#ffffff",
  border: "#e7e5e4",
  text: "#0c0a09",
  textMuted: "#57534e",
  textDim: "#a8a29e",
  primary: "#059669",
  primaryDark: "#047857",
  primarySoft: "#ecfdf5",
  accent: "#ea580c",
  accentSoft: "#fff7ed",
  slateLine: "#e2e8f0",
  roseBg: "#fff1f2",
  roseBorder: "#fecdd3",
  roseText: "#9f1239",
} as const;

export type Theme = typeof theme;
