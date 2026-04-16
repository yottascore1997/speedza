/** Speedza — bottom-nav chrome warm orange; in-screen CTAs stay brand green. */
export const theme = {
  /** Tab bar active icon + native headers (Search, Profile, …) */
  brandNavOrange: "#ea580c",
  /** Cart Place order + home “Shop” CTA — forest → emerald */
  placeOrderGradient: ["#022c22", "#004d3d", "#059669"] as const,
  /** Full-bleed surfaces (home, etc.) — warm off-white, not stark #fff */
  bg: "#f4f8f6",
  /** Shop home scroll background — soft warm orange (matches home header) */
  homeCanvasBg: "#fff4e6",
  /** Sponsored ad strip above stores (forest → emerald) */
  adBannerGradient: ["#022c22", "#004d3d", "#059669"] as const,
  /** Page canvas — soft peach */
  screenBg: "#fff7ed",
  /** Cards, sheets, modals */
  bgElevated: "#ffffff",
  border: "#c4d2cb",
  text: "#111827",
  textMuted: "#5c6b65",
  textDim: "#8a9691",
  /** Header strip, GO button, primary actions */
  brandGreen: "#004d3d",
  brandGreenDark: "#003d30",
  /** Bottom tab active state (reference screenshot) */
  brandRust: "#a52a2a",
  /** Legacy alias — maps to brand green for buttons/links in content */
  primary: "#004d3d",
  primaryDark: "#003d30",
  primarySoft: "#d4ebe4",
  /** Add to cart, checkout CTAs (same green as GO) */
  accent: "#004d3d",
  accentSoft: "#d4ebe4",
  /** Muted fills inside cards (image placeholders, strips) */
  slateLine: "#e8f0ec",
  /** Bottom tab bar — light peach strip */
  tabBarBg: "#fff7ed",
  tabBarBorder: "#fed7aa",
  roseBg: "#fff1f2",
  roseBorder: "#fecdd3",
  roseText: "#9f1239",
  /** Cart / notification badge */
  badgeRed: "#dc2626",
} as const;

export type Theme = typeof theme;
