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

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;

  const firebaseConfig = {
    apiKey: required(
      "EXPO_PUBLIC_FIREBASE_API_KEY (or NEXT_PUBLIC_FIREBASE_API_KEY)",
      publicEnv("EXPO_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY"),
    ),
    authDomain: required(
      "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN (or NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)",
      publicEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    ),
    projectId: required(
      "EXPO_PUBLIC_FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)",
      publicEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    ),
    appId: required(
      "EXPO_PUBLIC_FIREBASE_APP_ID (or NEXT_PUBLIC_FIREBASE_APP_ID)",
      publicEnv("EXPO_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"),
    ),
  };

  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

