import { Dimensions, PixelRatio } from "react-native";

const guidelineBaseWidth = 390; // modern phone design baseline
const guidelineBaseHeight = 844;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function widthRatio() {
  const { width } = Dimensions.get("window");
  return clamp(width / guidelineBaseWidth, 0.88, 1.18);
}

function heightRatio() {
  const { height } = Dimensions.get("window");
  return clamp(height / guidelineBaseHeight, 0.9, 1.15);
}

export function rs(size: number) {
  return PixelRatio.roundToNearestPixel(size * widthRatio());
}

export function rvs(size: number) {
  return PixelRatio.roundToNearestPixel(size * heightRatio());
}

export function rms(size: number, factor = 0.5) {
  const scaled = rs(size);
  return PixelRatio.roundToNearestPixel(size + (scaled - size) * factor);
}
