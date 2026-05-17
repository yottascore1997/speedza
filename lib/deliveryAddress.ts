import * as Location from "expo-location";
import { api } from "@/lib/api";
import {
  extractPincodeFromAddress,
  isServiceablePincode,
  resolveDeliveryPincode,
} from "@/lib/serviceArea";

export type UserDeliveryAddress = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type ServiceAreaGateResult =
  | { status: "ok"; address: UserDeliveryAddress; pincode: string }
  | { status: "no_address" }
  | { status: "unserviceable"; address: UserDeliveryAddress; areaLabel: string; pincode: string | null };

export function formatAreaLabel(addressLine: string): string {
  const parts = addressLine
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return parts[0] || addressLine.trim() || "Your area";
}

export async function fetchUserDeliveryAddress(): Promise<UserDeliveryAddress | null> {
  const res = await api<{ address: UserDeliveryAddress | null }>("/api/user/address");
  if (!res.ok || !res.data?.address) return null;
  const a = res.data.address;
  if (!a.address?.trim() || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) return null;
  return a;
}

export async function checkServiceAreaGate(): Promise<ServiceAreaGateResult> {
  const address = await fetchUserDeliveryAddress();
  if (!address) return { status: "no_address" };

  const pin =
    extractPincodeFromAddress(address.address) ??
    (await resolveDeliveryPincode({
      addressText: address.address,
      latitude: address.latitude,
      longitude: address.longitude,
    }));

  if (!pin || !isServiceablePincode(pin)) {
    return {
      status: "unserviceable",
      address,
      areaLabel: formatAreaLabel(address.address),
      pincode: pin,
    };
  }

  return { status: "ok", address, pincode: pin };
}

export async function resolveAreaLabelFromCoords(latitude: number, longitude: number): Promise<string> {
  const rev = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  if (!rev.length) return "Selected location";
  const r = rev[0]!;
  const parts = [r.district || r.subregion, r.city || r.region].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return formatAreaLabel([r.name, r.street, r.city].filter(Boolean).join(", "));
}
