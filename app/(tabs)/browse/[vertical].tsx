import { useMemo } from "react";
import { Redirect, useLocalSearchParams, type Href } from "expo-router";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

/** Legacy `/browse/:vertical` → same flow as web: `/category/:slug` (subcategories first). */
export default function BrowseRedirectScreen() {
  const { vertical, lat, lng } = useLocalSearchParams<{
    vertical: string | string[];
    lat?: string;
    lng?: string;
  }>();
  const v = decodeURIComponent(Array.isArray(vertical) ? vertical[0] : vertical || "grocery");
  const la = Number(lat) || DEFAULT_LAT;
  const ln = Number(lng) || DEFAULT_LNG;

  const href = useMemo(
    () =>
      `/category/${encodeURIComponent(v)}?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}` as Href,
    [v, la, ln],
  );

  return <Redirect href={href} />;
}
