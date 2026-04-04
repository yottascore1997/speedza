/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Loads `.env` at config time so values land in `expo.extra` (reliable on device).
 * Single config file (no app.json) — satisfies expo-doctor when using dynamic config.
 */
require("dotenv").config({ path: ".env" });

const extraFromEnv = {};
for (const [k, v] of Object.entries(process.env)) {
  if (
    (k.startsWith("EXPO_PUBLIC_") || k.startsWith("NEXT_PUBLIC_")) &&
    typeof v === "string" &&
    v.trim()
  ) {
    extraFromEnv[k] = v.trim();
  }
}

const apiUrlRaw =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "";
const apiUrl = apiUrlRaw.replace(/\/$/, "");

/** Set by `eas init` — required for EAS Build / Submit. */
const EAS_PROJECT_ID = "6ef242a0-a55d-4205-bc66-2bc935463675";

module.exports = {
  expo: {
    name: "Speedza",
    slug: "speedza",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "speedza",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    icon: "./assets/icon.png",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "in.speedza.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "We use your location to show nearby stores.",
      },
    },
    android: {
      package: "in.speedza.app",
      versionCode: 1,
      usesCleartextTraffic: true,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#16a34a",
      },
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
    },
    plugins: [
      "expo-router",
      [
        "expo-notifications",
        {
          sounds: [],
        },
      ],
      "expo-asset",
      "expo-font",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ...extraFromEnv,
      ...(apiUrl ? { apiUrl } : {}),
      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },
  },
};
