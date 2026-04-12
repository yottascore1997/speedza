import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import Constants from "expo-constants";

/** Expo injects `EXPO_PUBLIC_*`. Same keys as Next.js use `NEXT_PUBLIC_*` — we accept both. */
function publicEnv(expoKey: string, nextKey: string): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const v =
    (process.env[expoKey as keyof NodeJS.ProcessEnv] ??
      process.env[nextKey as keyof NodeJS.ProcessEnv]) ??
    extra[expoKey] ??
    extra[nextKey];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function required(label: string, value: string | undefined) {
  if (!value?.trim()) throw new Error(`Missing env ${label}`);
  return value.trim();
}

/** Safe at render time — returns null if any public Firebase key is missing (common on misconfigured EAS builds). */
export type PublicFirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

export function getPublicFirebaseWebConfig(): PublicFirebaseWebConfig | null {
  const apiKey = publicEnv("EXPO_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY");
  const authDomain = publicEnv(
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  );
  const projectId = publicEnv(
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  );
  const appId = publicEnv("EXPO_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_APP_ID");
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;

  const firebaseConfig = getPublicFirebaseWebConfig();
  if (!firebaseConfig) {
    throw new Error(
      "Missing env EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_PROJECT_ID, and/or EXPO_PUBLIC_FIREBASE_APP_ID (NEXT_PUBLIC_* equivalents also accepted).",
    );
  }

  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

