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
} from "react-native";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
    if (!addrText.trim()) {
      Alert.alert("Address", "Enter address");
      return;
    }
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      Alert.alert("Address", "Enter valid latitude and longitude");
      return;
    }
    setSaving(true);
    const res = await api<{ address: Address }>("/api/user/address", {
      method: "POST",
      body: JSON.stringify({
        label: "Home",
        address: addrText.trim(),
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
    Alert.alert("Saved", "Address updated");
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
        <TextInput
          value={addrText}
          onChangeText={setAddrText}
          placeholder="Address (house, street, landmark)"
          placeholderTextColor={theme.textDim}
          multiline
          style={{
            backgroundColor: theme.bgElevated,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: theme.text,
            fontWeight: "600",
            minHeight: 92,
          }}
        />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textMuted, fontWeight: "800", marginBottom: 6, fontSize: 12 }}>
              Latitude
            </Text>
            <TextInput
              value={lat}
              onChangeText={setLat}
              placeholder="e.g. 28.4595"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
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
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textMuted, fontWeight: "800", marginBottom: 6, fontSize: 12 }}>
              Longitude
            </Text>
            <TextInput
              value={lng}
              onChangeText={setLng}
              placeholder="e.g. 77.0266"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
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
          </View>
        </View>
        <Pressable
          onPress={() => void saveAddress()}
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
            {saving ? "Saving…" : addr ? "Update address" : "Save address"}
          </Text>
        </Pressable>
        {addr ? (
          <Text style={{ marginTop: 8, color: theme.textDim, fontWeight: "700", fontSize: 12 }}>
            Saved as {addr.label}: {Math.round(addr.latitude * 10000) / 10000},{" "}
            {Math.round(addr.longitude * 10000) / 10000}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

