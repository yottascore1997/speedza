import Constants from "expo-constants";

/**
 * Base URL of the Next.js app (`delivery-web`). No trailing slash.
 * Set EXPO_PUBLIC_WEB_URL in .env (e.g. https://your-domain.com) or `extra.webUrl` in app.config.js.
 * Falls back to EXPO_PUBLIC_API_URL when both point at the same Next server.
 */
export function getWebBase(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_WEB_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const extra = Constants.expoConfig?.extra as { webUrl?: string; apiUrl?: string } | undefined;
  if (extra?.webUrl) return extra.webUrl.trim().replace(/\/$/, "");

  const api =
    process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ||
    extra?.apiUrl?.trim().replace(/\/$/, "");
  if (api) return api;

  return "http://localhost:3000";
}
