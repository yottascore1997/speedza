import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const TOKEN_KEY = "dlf_token";
const USER_KEY = "dlf_user";

export function getApiBase(): string {
  const extra = Constants.expoConfig?.extra as
    | { apiUrl?: string; EXPO_PUBLIC_API_URL?: string; NEXT_PUBLIC_API_URL?: string }
    | undefined;
  const fromExtra =
    extra?.apiUrl || extra?.EXPO_PUBLIC_API_URL || extra?.NEXT_PUBLIC_API_URL;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL;
  const raw = fromExtra || fromEnv;
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}

export type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
};

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setSession(token: string, user: User) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function getUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    const isNetwork =
      /network request failed|failed to fetch|load failed|aborted/i.test(raw);
    return {
      ok: false,
      status: 0,
      error: isNetwork
        ? `Network error — could not reach ${url}\n\n` +
          `Set EXPO_PUBLIC_API_URL in speedza/.env to your Next.js URL.\n` +
          `On a real phone, do NOT use localhost — use your PC LAN IP (e.g. http://192.168.1.10:3000).\n` +
          `Current base: ${base}`
        : raw,
    };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text };
  }
  const obj = json as { error?: string };
  if (!res.ok) {
    return { ok: false, error: obj?.error || res.statusText, status: res.status };
  }
  return { ok: true, data: json as T, status: res.status };
}
