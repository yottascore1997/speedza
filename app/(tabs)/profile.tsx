import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { premiumAlert } from "@/lib/premiumAlert";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { api, getApiBase, getToken, getUser, setSession, type User } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { LAUNCH_PINCODES, normalizePincode, validateDeliveryPincode } from "@/lib/serviceArea";
import { rms, rs } from "@/lib/responsive";
import { getHomeShopHeaderColors } from "@/lib/shopHeaderTheme";

const homeHeader = getHomeShopHeaderColors();
const headerGradient = [...homeHeader.headerGradient] as [string, string, string];
const headerInk = homeHeader.logoText;
const headerInkSoft = homeHeader.chipInactive;
const ctaGreen = "#059669";

type Address = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

const canvas = "#f4f7fb";

const cardLift = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
  default: {},
});

function FieldLabel({ text }: { text: string }) {
  return (
    <Text style={{ marginBottom: rs(8), fontSize: rms(12), fontWeight: "800", color: "#64748b", letterSpacing: 0.4 }}>
      {text.toUpperCase()}
    </Text>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [addr, setAddr] = useState<Address | null>(null);
  const [addrText, setAddrText] = useState("");
  const [pincodeInput, setPincodeInput] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [addressMode, setAddressMode] = useState<"current" | "manual">("current");
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  const inputStyle = {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: rs(14),
    paddingHorizontal: rs(14),
    paddingVertical: rs(12),
    color: theme.text,
    fontSize: rms(15),
    fontWeight: "600" as const,
    ...cardLift,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const local = await getUser();
      if (!token || !local) {
        setUser(null);
        return;
      }
      const [me, address] = await Promise.all([
        api<{ user: { id: string; name: string; phone: string; role: string; imageUrl?: string | null } }>(
          "/api/user/me",
        ),
        api<{ address: Address | null }>("/api/user/address"),
      ]);
      if (me.ok && me.data?.user) {
        const nextUser: User = {
          id: me.data.user.id,
          name: me.data.user.name,
          phone: me.data.user.phone,
          role: me.data.user.role,
        };
        await setSession(token, nextUser);
        setUser(nextUser);
        setName(me.data.user.name || "");
        setImageUrl(me.data.user.imageUrl ? resolveMediaUrl(me.data.user.imageUrl) ?? null : null);
      } else {
        setUser(local);
        setName(local.name);
      }
      if (address.ok) {
        setAddr(address.data?.address ?? null);
        const a = address.data?.address ?? null;
        setAddrText(a?.address ?? "");
        setLat(a ? String(a.latitude) : "");
        setLng(a ? String(a.longitude) : "");
        const extracted = a?.address ? normalizePincode(a.address.match(/\b([1-9][0-9]{5})\b/)?.[1] ?? "") : null;
        if (extracted) setPincodeInput(extracted);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveName() {
    if (!name.trim()) {
      premiumAlert("Name", "Enter your name");
      return;
    }
    setSaving(true);
    const res = await api<{ user: { id: string; name: string; phone: string; role: string } }>(
      "/api/user/profile",
      { method: "PATCH", body: JSON.stringify({ name: name.trim() }) },
    );
    setSaving(false);
    if (!res.ok) {
      premiumAlert("Error", res.error || "Could not save");
      return;
    }
    const token = await getToken();
    if (token && res.data?.user) {
      await setSession(token, res.data.user);
      setUser(res.data.user);
    }
    premiumAlert("Saved", "Profile updated");
  }

  async function saveAddress() {
    let finalAddress = addrText.trim();
    let la = parseFloat(lat);
    let ln = parseFloat(lng);

    if (addressMode === "current") {
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        premiumAlert("Location", "Tap 'Use current location' first.");
        return;
      }
      if (!finalAddress) finalAddress = "Current location";
    } else {
      if (!finalAddress) {
        premiumAlert("Address", "Please type your address.");
        return;
      }
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        const geocoded = await Location.geocodeAsync(finalAddress).catch(() => []);
        if (!geocoded.length) {
          premiumAlert("Address", "Could not map this address. Please type a clearer address.");
          return;
        }
        la = geocoded[0]!.latitude;
        ln = geocoded[0]!.longitude;
        setLat(String(la));
        setLng(String(ln));
      }
    }

    if (!normalizePincode(pincodeInput)) {
      premiumAlert("Pincode", "Enter 6-digit delivery pincode.");
      return;
    }

    const pinCheck = await validateDeliveryPincode({
      addressText: finalAddress,
      latitude: la,
      longitude: ln,
      pincodeInput,
    });
    if (!pinCheck.ok) {
      premiumAlert("Delivery area", pinCheck.message);
      return;
    }

    setSaving(true);
    const res = await api<{ address: Address }>("/api/user/address", {
      method: "POST",
      body: JSON.stringify({
        label: "Home",
        address: finalAddress,
        latitude: la,
        longitude: ln,
        pincode: pinCheck.pincode,
        city: pinCheck.city,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      premiumAlert("Error", res.error || "Could not save address");
      return;
    }
    setAddr(res.data?.address ?? null);
    setAddressModalOpen(false);
    premiumAlert("Saved", "Address updated");
  }

  async function useCurrentLocationAddress() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      premiumAlert("Permission needed", "Allow location permission first.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const la = pos.coords.latitude;
    const ln = pos.coords.longitude;
    setLat(String(la));
    setLng(String(ln));
    const rev = await Location.reverseGeocodeAsync({ latitude: la, longitude: ln }).catch(() => []);
    if (rev.length) {
      const r = rev[0]!;
      const text = [r.name, r.street, r.city, r.region, r.postalCode].filter(Boolean).join(", ");
      if (text.trim()) setAddrText(text);
      if (r.postalCode) setPincodeInput(r.postalCode.replace(/\D/g, "").slice(0, 6));
    }
    premiumAlert("Location captured", "Confirm and save when ready.");
  }

  async function pickAndUploadAvatar() {
    const token = await getToken();
    if (!token) {
      premiumAlert("Login required");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      premiumAlert("Permission", "Allow photo access to upload avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;

    const fd = new FormData();
    const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    fd.append("file", {
      uri,
      name: `avatar.${ext}`,
      type: mime,
    } as any);

    setSaving(true);
    try {
      const res = await fetch(`${getApiBase()}/api/user/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd as any,
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        premiumAlert("Upload failed", j?.error || "Could not upload");
        return;
      }
      const nextUrl = j?.user?.imageUrl ? resolveMediaUrl(j.user.imageUrl) ?? null : null;
      setImageUrl(nextUrl);
      premiumAlert("Uploaded", "Profile photo updated");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: canvas, paddingTop: insets.top }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.brandNavOrange} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: canvas, padding: rs(20), paddingTop: insets.top + rs(16) }}>
        <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: rms(18) }}>Sign in to edit profile</Text>
        <Text style={{ marginTop: rs(8), color: "#64748b", fontWeight: "600", lineHeight: rms(20) }}>
          Your name, photo and delivery address are saved to your account.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: canvas }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: rs(28) + insets.bottom }}>
        <LinearGradient
          colors={headerGradient}
          locations={[0, 0.42, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            paddingTop: insets.top + rs(10),
            paddingHorizontal: rs(18),
            paddingBottom: rs(48),
            borderBottomLeftRadius: rs(28),
            borderBottomRightRadius: rs(28),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rs(20) }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({
                width: rs(40),
                height: rs(40),
                borderRadius: rs(12),
                backgroundColor: pressed ? "rgba(255,255,255,0.85)" : homeHeader.logoCircle,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(138,59,29,0.2)",
              })}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={headerInk} />
            </Pressable>
            <Text
              style={{
                flex: 1,
                textAlign: "center",
                color: headerInk,
                fontSize: rms(18),
                fontWeight: "900",
                marginRight: rs(40),
              }}
            >
              Edit profile
            </Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <Pressable onPress={() => void pickAndUploadAvatar()} disabled={saving}>
              <View
                style={{
                  width: rs(96),
                  height: rs(96),
                  borderRadius: rs(48),
                  borderWidth: 4,
                  borderColor: "#ffffff",
                  overflow: "hidden",
                  backgroundColor: homeHeader.deliverGold,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <MaterialCommunityIcons name="account" size={44} color={headerInk} />
                )}
              </View>
              <View
                style={{
                  position: "absolute",
                  right: rs(4),
                  bottom: rs(4),
                  width: rs(32),
                  height: rs(32),
                  borderRadius: rs(16),
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: homeHeader.goBtn,
                }}
              >
                <MaterialCommunityIcons name="camera-outline" size={18} color={headerInk} />
              </View>
            </Pressable>
            <Text style={{ marginTop: rs(12), color: headerInkSoft, fontSize: rms(13), fontWeight: "700" }}>
              Tap photo to change
            </Text>
            <Text style={{ marginTop: rs(4), color: headerInk, fontSize: rms(15), fontWeight: "800" }}>{user.phone}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: rs(18), marginTop: rs(-28) }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: rs(18),
              borderWidth: 1,
              borderColor: "#e2e8f0",
              padding: rs(16),
              ...cardLift,
            }}
          >
            <FieldLabel text="Display name" />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#94a3b8"
              style={inputStyle}
            />
            <Pressable
              onPress={() => void saveName()}
              disabled={saving}
              style={({ pressed }) => ({
                marginTop: rs(14),
                borderRadius: rs(14),
                overflow: "hidden",
                opacity: saving || pressed ? 0.88 : 1,
              })}
            >
              <View
                style={{
                  paddingVertical: rs(13),
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: rs(8),
                  backgroundColor: ctaGreen,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: rms(14) }}>Save name</Text>
                    </>
                  )}
              </View>
            </Pressable>
          </View>

          <View
            style={{
              marginTop: rs(14),
              backgroundColor: "#fff",
              borderRadius: rs(18),
              borderWidth: 1,
              borderColor: "#e2e8f0",
              padding: rs(16),
              ...cardLift,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rs(12) }}>
              <View
                style={{
                  width: rs(40),
                  height: rs(40),
                  borderRadius: rs(12),
                  backgroundColor: homeHeader.deliverGold,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(138,59,29,0.12)",
                }}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={22} color={headerInk} />
              </View>
              <View style={{ flex: 1, marginLeft: rs(12) }}>
                <Text style={{ fontSize: rms(15), fontWeight: "900", color: "#0f172a" }}>Delivery address</Text>
                <Text style={{ marginTop: rs(2), fontSize: rms(12), fontWeight: "600", color: "#64748b" }}>
                  Pin {LAUNCH_PINCODES.join(", ")} only
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: rs(12),
                padding: rs(12),
                borderWidth: 1,
                borderColor: "#f1f5f9",
              }}
            >
              <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: rms(13), lineHeight: rms(19) }}>
                {addr?.address?.trim() || "No address saved yet."}
              </Text>
            </View>

            <Pressable
              onPress={() => setAddressModalOpen(true)}
              disabled={saving}
              style={({ pressed }) => ({
                marginTop: rs(14),
                borderRadius: rs(14),
                overflow: "hidden",
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  paddingVertical: rs(13),
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: rs(8),
                  backgroundColor: ctaGreen,
                }}
              >
                <MaterialCommunityIcons name="pencil-outline" size={20} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: rms(14) }}>
                  {addr ? "Update address" : "Add address"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal visible={addressModalOpen} transparent animationType="slide" onRequestClose={() => setAddressModalOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.5)" }} onPress={() => setAddressModalOpen(false)} />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: rs(24),
              borderTopRightRadius: rs(24),
              paddingTop: rs(12),
              paddingHorizontal: rs(20),
              paddingBottom: rs(24) + insets.bottom,
              maxHeight: "88%",
            }}
          >
            <View style={{ alignSelf: "center", width: rs(40), height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", marginBottom: rs(16) }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rs(6) }}>
              <Text style={{ fontSize: rms(20), fontWeight: "900", color: "#0f172a", letterSpacing: -0.3 }}>Delivery address</Text>
              <Pressable
                onPress={() => setAddressModalOpen(false)}
                style={{
                  width: rs(36),
                  height: rs(36),
                  borderRadius: rs(11),
                  backgroundColor: "#f1f5f9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748b" />
              </Pressable>
            </View>
            <Text style={{ color: "#64748b", fontWeight: "600", fontSize: rms(13), marginBottom: rs(14) }}>
              Serviceable pincode: {LAUNCH_PINCODES.join(", ")}
            </Text>

            <View
              style={{
                flexDirection: "row",
                padding: rs(4),
                borderRadius: rs(14),
                backgroundColor: "#f1f5f9",
                marginBottom: rs(14),
              }}
            >
              {(["current", "manual"] as const).map((mode) => {
                const active = addressMode === mode;
                return (
                  <Pressable key={mode} onPress={() => setAddressMode(mode)} style={{ flex: 1, borderRadius: rs(11), overflow: "hidden" }}>
                    {active ? (
                      <View style={{ paddingVertical: rs(10), alignItems: "center", backgroundColor: ctaGreen }}>
                        <Text style={{ fontWeight: "900", fontSize: rms(12), color: "#fff" }}>
                          {mode === "current" ? "GPS" : "Manual"}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ paddingVertical: rs(10), alignItems: "center" }}>
                        <Text style={{ fontWeight: "800", fontSize: rms(12), color: "#64748b" }}>
                          {mode === "current" ? "GPS" : "Manual"}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {addressMode === "current" ? (
                <Pressable
                  onPress={() => void useCurrentLocationAddress()}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: rs(8),
                    paddingVertical: rs(12),
                    borderRadius: rs(14),
                    backgroundColor: pressed ? "#047857" : ctaGreen,
                    marginBottom: rs(12),
                  })}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#fff" />
                  <Text style={{ fontWeight: "800", color: "#fff" }}>Use current location</Text>
                </Pressable>
              ) : null}

              <FieldLabel text="Pincode" />
              <TextInput
                value={pincodeInput}
                onChangeText={(t) => setPincodeInput(t.replace(/\D/g, "").slice(0, 6))}
                placeholder={`e.g. ${LAUNCH_PINCODES[0]}`}
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={6}
                style={{ ...inputStyle, fontWeight: "800", letterSpacing: 1, marginBottom: rs(12) }}
              />

              <FieldLabel text="Full address" />
              <TextInput
                value={addrText}
                onChangeText={setAddrText}
                placeholder="House, street, area, city"
                placeholderTextColor="#94a3b8"
                multiline
                style={{ ...inputStyle, minHeight: rs(80), textAlignVertical: "top", marginBottom: rs(16) }}
              />
            </ScrollView>

            <Pressable
              onPress={() => void saveAddress()}
              disabled={saving}
              style={({ pressed }) => ({ borderRadius: rs(14), overflow: "hidden", opacity: saving || pressed ? 0.88 : 1 })}
            >
              <View
                style={{
                  paddingVertical: rs(15),
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: rs(8),
                  backgroundColor: ctaGreen,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle-outline" size={22} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: rms(15) }}>Save address</Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
