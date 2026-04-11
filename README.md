# Speedza — Expo (native)

React Native app that talks to the same **`delivery-web`** APIs (`EXPO_PUBLIC_API_URL`).

## Env

Create `.env` in this folder (or set `extra.apiUrl` in `app.config.js`):

```env
EXPO_PUBLIC_API_URL=https://your-deployed-next-app.com
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

On a **physical phone**, use your PC’s LAN IP or deployed HTTPS URL — not `localhost`.

## Run

```bash
cd delivery-app
npx expo start
```

## Production build (Android)

`npx eas` fails — use **`eas-cli`** (installed as a devDependency):

```bash
cd delivery-app
npm install
npx eas login
npx eas build:configure   # links project on expo.dev (first time)
npm run build:android       # AAB for Play Store (profile: production)
# or APK for testing:
npm run build:android:apk   # profile: preview
```

Or one-off without installing: `npx eas-cli@latest build --platform android --profile production`

## App structure

- **Shop** tab — hero, today’s match banner, categories (`/api/master/shop-tree`), nearby stores, opens **Browse** per category (`/api/shop/category-quick`).
- **Cart / Orders / You** — native UI, same checkout and order APIs as before.
- **Sign in** — Firebase phone OTP (`signInWithPhoneNumber`) then `/api/auth/firebase` exchange for app JWT, same role-based routing pattern as delivery web.

`expo-image` is used for store/product images; relative URLs are resolved against `EXPO_PUBLIC_API_URL`.
