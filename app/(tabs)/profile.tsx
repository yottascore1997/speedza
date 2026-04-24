import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { api, getApiBase, getToken, getUser, setSession, type User } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";

type Address = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [addr, setAddr] = useState<Address | null>(null);
  const [addrText, setAddrText] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [addressMode, setAddressMode] = useState<"current" | "manual">("current");
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const local = await getUser();
    if (!token || !local) {
      setUser(null);
      setLoading(false);
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
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveName() {
    if (!name.trim()) {
      Alert.alert("Name", "Enter your name");
      return;
    }
    setSaving(true);
    const res = await api<{ user: { id: string; name: string; phone: string; role: string } }>(
      "/api/user/profile",
      { method: "PATCH", body: JSON.stringify({ name: name.trim() }) },
    );
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Error", res.error || "Could not save");
      return;
    }
    const token = await getToken();
    if (token && res.data?.user) {
      await setSession(token, res.data.user);
      setUser(res.data.user);
    }
    Alert.alert("Saved", "Profile updated");
  }

  async function saveAddress() {
    let finalAddress = addrText.trim();
    let la = parseFloat(lat);
    let ln = parseFloat(lng);

    if (addressMode === "current") {
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        Alert.alert("Location", "Tap 'Use current location' first.");
        return;
      }
      if (!finalAddress) finalAddress = "Current location";
    } else {
      if (!finalAddress) {
        Alert.alert("Address", "Please type your address.");
        return;
      }
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        const geocoded = await Location.geocodeAsync(finalAddress).catch(() => []);
        if (!geocoded.length) {
          Alert.alert("Address", "Could not map this address. Please type a clearer address.");
          return;
        }
        la = geocoded[0]!.latitude;
        ln = geocoded[0]!.longitude;
        setLat(String(la));
        setLng(String(ln));
      }
    }
    setSaving(true);
    const res = await api<{ address: Address }>("/api/user/address", {
      method: "POST",
      body: JSON.stringify({
        label: "Home",
        address: finalAddress,
        latitude: la,
        longitude: ln,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Error", res.error || "Could not save address");
      return;
    }
    setAddr(res.data?.address ?? null);
    setAddressModalOpen(false);
    Alert.alert("Saved", "Address updated");
  }

  async function useCurrentLocationAddress() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Allow location permission first.");
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
    }
    Alert.alert("Location captured", "Current location selected.");
  }

  async function pickAndUploadAvatar() {
    const token = await getToken();
    if (!token) {
      Alert.alert("Login required");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission", "Allow photo access to upload avatar.");
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
        headers: {
          Authorization: `Bearer ${token}`,
          ...(Platform.OS === "web" ? {} : {}),
        },
        body: fd as any,
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        Alert.alert("Upload failed", j?.error || "Could not upload");
        return;
      }
      const nextUrl = j?.user?.imageUrl ? resolveMediaUrl(j.user.imageUrl) ?? null : null;
      setImageUrl(nextUrl);
      Alert.alert("Uploaded", "Avatar updated");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: "900", fontSize: 18 }}>Sign in to edit profile</Text>
        <Text style={{ marginTop: 6, color: theme.textMuted, fontWeight: "600" }}>
          Your name, avatar and delivery address are saved to your account.
        </Text>
      </View>
    );
  }

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View
        style={{
          backgroundColor: theme.bgElevated,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: theme.primarySoft,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <MaterialCommunityIcons name="account" size={34} color={theme.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "900", fontSize: 18 }}>{user.phone}</Text>
            <Text style={{ marginTop: 4, color: theme.textMuted, fontWeight: "700" }}>{user.role}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => void pickAndUploadAvatar()}
          disabled={saving}
          style={{
            marginTop: 14,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.bg,
            paddingVertical: 12,
            borderRadius: 14,
          }}
        >
          <Text style={{ textAlign: "center", fontWeight: "900", color: theme.text }}>
            {saving ? "Please wait…" : "Change avatar"}
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16, marginBottom: 8 }}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.textDim}
          style={{
            backgroundColor: theme.bgElevated,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: theme.text,
            fontWeight: "700",
          }}
        />
        <Pressable
          onPress={() => void saveName()}
          disabled={saving}
          style={{
            marginTop: 10,
            backgroundColor: theme.primary,
            paddingVertical: 14,
            borderRadius: 14,
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
            {saving ? "Saving…" : "Save name"}
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 18 }}>
        <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16, marginBottom: 8 }}>
          Delivery address
        </Text>
        <View
          style={{
            backgroundColor: theme.bgElevated,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 16,
            padding: 12,
          }}
        >
          <Text style={{ color: theme.textMuted, fontWeight: "700", fontSize: 12 }}>
            {addr?.address?.trim() || "No address saved yet."}
          </Text>
          <Pressable
            onPress={() => setAddressModalOpen(true)}
            disabled={saving}
            style={{
              marginTop: 10,
              backgroundColor: theme.accent,
              paddingVertical: 14,
              borderRadius: 14,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
              {addr ? "Save Addresses" : "Save Addresses"}
            </Text>
          </Pressable>
        </View>
        {addr ? (
          <Text style={{ marginTop: 8, color: theme.textDim, fontWeight: "700", fontSize: 12 }}>
            Saved as {addr.label}: {Math.round(addr.latitude * 10000) / 10000},{" "}
            {Math.round(addr.longitude * 10000) / 10000}
          </Text>
        ) : null}
      </View>
    </ScrollView>
    <Modal visible={addressModalOpen} transparent animationType="fade" onRequestClose={() => setAddressModalOpen(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 18 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#e7e5e4" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#0f172a" }}>Delivery Address</Text>
            <Pressable onPress={() => setAddressModalOpen(false)}>
              <MaterialCommunityIcons name="close" size={22} color="#475569" />
            </Pressable>
          </View>
          <Text style={{ marginTop: 4, color: "#64748b", fontWeight: "600", fontSize: 12 }}>
            Choose one option and save.
          </Text>

          <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setAddressMode("current")}
              style={{
                flex: 1,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: addressMode === "current" ? "#16a34a" : "#e2e8f0",
                backgroundColor: addressMode === "current" ? "#ecfdf5" : "#fff",
                paddingVertical: 10,
              }}
            >
              <Text style={{ textAlign: "center", fontWeight: "900", color: "#0f172a", fontSize: 12 }}>
                Current location
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddressMode("manual")}
              style={{
                flex: 1,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: addressMode === "manual" ? "#16a34a" : "#e2e8f0",
                backgroundColor: addressMode === "manual" ? "#ecfdf5" : "#fff",
                paddingVertical: 10,
              }}
            >
              <Text style={{ textAlign: "center", fontWeight: "900", color: "#0f172a", fontSize: 12 }}>
                Type manually
              </Text>
            </Pressable>
          </View>

          {addressMode === "current" ? (
            <Pressable
              onPress={() => void useCurrentLocationAddress()}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: "#cbd5e1",
                backgroundColor: "#f8fafc",
                borderRadius: 10,
                paddingVertical: 11,
              }}
            >
              <Text style={{ textAlign: "center", fontWeight: "900", color: "#0f172a" }}>Use current location</Text>
            </Pressable>
          ) : (
            <TextInput
              value={addrText}
              onChangeText={setAddrText}
              placeholder="Type full address"
              placeholderTextColor="#94a3b8"
              multiline
              style={{
                marginTop: 10,
                minHeight: 88,
                borderWidth: 1,
                borderColor: "#cbd5e1",
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 10,
                color: "#0f172a",
                fontWeight: "600",
              }}
            />
          )}

          <Pressable
            onPress={() => void saveAddress()}
            disabled={saving}
            style={{
              marginTop: 12,
              backgroundColor: "#16a34a",
              borderRadius: 10,
              paddingVertical: 12,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ textAlign: "center", color: "#fff", fontWeight: "900" }}>
              {saving ? "Saving..." : "Save address"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

