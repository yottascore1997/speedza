import { getApiBase } from "@/lib/api";

/** Turn API-relative paths into full URLs for <Image /> / expo-image. */
export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path?.trim()) return undefined;
  const p = path.trim();
  if (/^https?:\/\//i.test(p)) return p;
  const base = getApiBase();
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}
