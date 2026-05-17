import * as Location from "expo-location";

/** Launch: allowed pincode (6-digit) */
export const LAUNCH_PINCODES = ["441501"] as const;

export type LaunchPincode = (typeof LAUNCH_PINCODES)[number];

const ALLOWED = new Set<string>(LAUNCH_PINCODES);

export const SERVICE_AREA_LABEL = `pincode ${LAUNCH_PINCODES.join(" & ")}`;
export const UNSERVICEABLE_PINCODE_MESSAGE =
  `Abhi hum sirf ${SERVICE_AREA_LABEL} par deliver karte hain.`;

/** "441 501" → "441501" */
export function normalizePincode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return digits;
}

/** Address line se 6-digit pincode nikaalo */
export function extractPincodeFromAddress(address: string): string | null {
  const m = address.match(/\b([1-9][0-9]{5})\b/);
  return m ? normalizePincode(m[1]) : null;
}

export function isServiceablePincode(pincode: string): boolean {
  const pin = normalizePincode(pincode);
  if (!pin) return false;
  return ALLOWED.has(pin);
}

/** API `city` field — ab pincode hi zone id hai */
export function serviceCityForPincode(pincode: string): LaunchPincode | null {
  const pin = normalizePincode(pincode);
  if (!pin || !ALLOWED.has(pin)) return null;
  return pin as LaunchPincode;
}

export function getAllowedPincodes(): readonly string[] {
  return LAUNCH_PINCODES;
}

export async function resolvePincodeFromCoords(latitude: number, longitude: number): Promise<string | null> {
  const rev = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  const postal = rev[0]?.postalCode;
  return normalizePincode(postal ?? undefined);
}

export async function resolveDeliveryPincode(input: {
  addressText?: string;
  latitude?: number;
  longitude?: number;
}): Promise<string | null> {
  const fromText = input.addressText ? extractPincodeFromAddress(input.addressText) : null;
  if (fromText) return fromText;
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return resolvePincodeFromCoords(input.latitude, input.longitude);
  }
  return null;
}

export type PincodeValidationResult =
  | { ok: true; pincode: string; city: LaunchPincode }
  | {
      ok: false;
      reason: "missing_pin" | "invalid_pin" | "not_serviceable";
      message: string;
      pincode?: string;
    };

export async function validateDeliveryPincode(input: {
  addressText?: string;
  latitude?: number;
  longitude?: number;
  pincodeInput?: string;
}): Promise<PincodeValidationResult> {
  const typedPin = input.pincodeInput?.trim() ?? "";

  if (typedPin) {
    const manual = normalizePincode(typedPin);
    if (!manual) {
      return {
        ok: false,
        reason: "invalid_pin",
        message: "Sahi 6-digit pincode likhein.",
      };
    }
    if (!isServiceablePincode(manual)) {
      return {
        ok: false,
        reason: "not_serviceable",
        message: UNSERVICEABLE_PINCODE_MESSAGE,
        pincode: manual,
      };
    }
    const city = serviceCityForPincode(manual);
    if (!city) {
      return {
        ok: false,
        reason: "not_serviceable",
        message: UNSERVICEABLE_PINCODE_MESSAGE,
        pincode: manual,
      };
    }
    return { ok: true, pincode: manual, city };
  }

  const pin = await resolveDeliveryPincode({
    addressText: input.addressText,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  if (!pin) {
    return {
      ok: false,
      reason: "missing_pin",
      message: `Pincode zaroori hai. Allowed: ${LAUNCH_PINCODES.join(" ya ")}`,
    };
  }
  if (!isServiceablePincode(pin)) {
    return {
      ok: false,
      reason: "not_serviceable",
      message: UNSERVICEABLE_PINCODE_MESSAGE,
      pincode: pin,
    };
  }
  const city = serviceCityForPincode(pin);
  if (!city) {
    return {
      ok: false,
      reason: "not_serviceable",
      message: UNSERVICEABLE_PINCODE_MESSAGE,
      pincode: pin,
    };
  }
  return { ok: true, pincode: pin, city };
}
