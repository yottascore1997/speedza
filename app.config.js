/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Loads `.env` at config time so values land in `expo.extra` (reliable on device).
 * Metro sometimes does not inline `process.env.EXPO_PUBLIC_*` the way devs expect.
 */
require("dotenv").config({ path: ".env" });

const appJson = require("./app.json");

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

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      ...extraFromEnv,
      ...(apiUrl ? { apiUrl } : {}),
    },
  },
};
