import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { premiumAlert } from "@/lib/premiumAlert";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, getApiBase, getToken } from "@/lib/api";

const GRADIENT = ["#3b82f6", "#6366f1", "#8b5cf6"] as const;
const UPLOAD_HEADER_IMG = require("../assets/uploadimg.png");
const cardLift =
  Platform.OS === "ios"
    ? {
        shadowColor: "#1e3a8a",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 22,
      }
    : { elevation: 6 };

export type QuickGroceryListRequest = {
  id: string;
  imageUrl: string;
  note: string;
  address: string;
  status: string;
  adminNote?: string;
  createdAt: string;
};

type Props = {
  variant?: "home" | "profile" | "compact";
  style?: StyleProp<ViewStyle>;
  listRequests?: QuickGroceryListRequest[];
  onRequestsUpdated?: (requests: QuickGroceryListRequest[]) => void;
};

export function QuickGroceryOrderSection({
  variant = "home",
  style,
  listRequests = [],
  onRequestsUpdated,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = variant === "compact";
  const profile = variant === "profile";
  const boxInnerW = width - 42;
  const uploadIllustrationH = Math.round(boxInnerW * 0.58);

  const [listImageUri, setListImageUri] = useState<string | null>(null);
  const [listNote, setListNote] = useState("");
  const [sending, setSending] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  function clearImage() {
    setListImageUri(null);
  }

  async function pickImage() {
    const token = await getToken();
    if (!token) {
      premiumAlert("Sign in required", "Please login first to upload your grocery list.");
      router.push("/login");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      premiumAlert("Permission needed", "Allow gallery access to upload list photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setListImageUri(result.assets[0].uri);
    }
  }

  async function submitRequest() {
    if (!listImageUri) {
      premiumAlert("Photo required", "Upload a grocery list or item photo first.");
      return;
    }
    const token = await getToken();
    if (!token) {
      premiumAlert("Sign in required", "Please login first.");
      router.push("/login");
      return;
    }

    setSending(true);
    try {
      const ext = listImageUri.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const fd = new FormData();
      fd.append("file", { uri: listImageUri, name: `list.${ext}`, type: mime } as never);

      const up = await fetch(`${getApiBase()}/api/list-requests/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd as never,
      });
      const upJson = (await up.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
      if (!up.ok || !upJson?.imageUrl) {
        premiumAlert("Upload failed", upJson?.error || "Could not upload list image");
        return;
      }

      const addr = await api<{ address: { address: string } | null }>("/api/user/address");
      const createRes = await api("/api/list-requests", {
        method: "POST",
        body: JSON.stringify({
          imageUrl: upJson.imageUrl,
          note: listNote.trim(),
          address: addr.ok && addr.data?.address?.address ? addr.data.address.address : "",
        }),
      });
      if (!createRes.ok) {
        premiumAlert("Request failed", createRes.error || "Could not create request");
        return;
      }

      setListImageUri(null);
      setListNote("");
      const mine = await api<{ requests: QuickGroceryListRequest[] }>("/api/list-requests?limit=15");
      if (mine.ok && mine.data?.requests) onRequestsUpdated?.(mine.data.requests);
      setSuccessVisible(true);
    } finally {
      setSending(false);
    }
  }

  async function quickPickAndSubmit() {
    const token = await getToken();
    if (!token) {
      premiumAlert("Sign in required", "Please login first, then upload your grocery list photo.");
      router.push("/login");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      premiumAlert("Permission needed", "Allow gallery access to upload list photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSending(true);
    try {
      const imageUri = result.assets[0].uri;
      const ext = imageUri.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const fd = new FormData();
      fd.append("file", { uri: imageUri, name: `list.${ext}`, type: mime } as never);
      const up = await fetch(`${getApiBase()}/api/list-requests/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd as never,
      });
      const upJson = (await up.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
      if (!up.ok || !upJson?.imageUrl) {
        premiumAlert("Upload failed", upJson?.error || "Could not upload list image");
        return;
      }
      const addr = await api<{ address: { address: string } | null }>("/api/user/address");
      const createRes = await api("/api/list-requests", {
        method: "POST",
        body: JSON.stringify({
          imageUrl: upJson.imageUrl,
          note: "",
          address: addr.ok && addr.data?.address?.address ? addr.data.address.address : "",
        }),
      });
      if (!createRes.ok) {
        premiumAlert("Request failed", createRes.error || "Could not create request");
        return;
      }
      setSuccessVisible(true);
    } finally {
      setSending(false);
    }
  }

  const successModal = (
    <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ borderRadius: 24, backgroundColor: "#fff", overflow: "hidden", padding: 22 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: "#dcfce7",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <MaterialCommunityIcons name="check-bold" size={28} color="#16a34a" />
          </View>
          <Text style={{ color: "#0f172a", fontSize: 20, fontWeight: "900" }}>Sent to store!</Text>
          <Text style={{ marginTop: 6, color: "#64748b", fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
            Our team will review your list, match items, and get back to you soon.
          </Text>
          <Pressable onPress={() => setSuccessVisible(false)} style={{ marginTop: 18, borderRadius: 14, overflow: "hidden" }}>
            <LinearGradient colors={[...GRADIENT]} style={{ paddingVertical: 13, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>Done</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (compact) {
    return (
      <>
        <Pressable
          onPress={() => void quickPickAndSubmit()}
          disabled={sending}
          style={[{ borderRadius: 18, overflow: "hidden", opacity: sending ? 0.85 : 1 }, style]}
        >
          <LinearGradient colors={["#eff6ff", "#ffffff"]} style={{ padding: 14, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#3b82f6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialCommunityIcons name="camera" size={24} color="#fff" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#0f172a", fontSize: 14, fontWeight: "900" }}>Quick grocery order</Text>
                <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                  Upload list photo — we handle the rest
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#6366f1" />
            </View>
          </LinearGradient>
        </Pressable>
        {successModal}
      </>
    );
  }

  return (
    <>
      <View style={[{ marginBottom: profile ? 0 : 12 }, style]}>
        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#e8ecf4",
            padding: 10,
            ...cardLift,
          }}
        >
          <View
            style={{
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: "#d1d5db",
              borderRadius: 14,
              backgroundColor: "#fafbfc",
              paddingVertical: 10,
              paddingHorizontal: 10,
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <Text style={{ color: "#0f172a", fontSize: 19, fontWeight: "900", textAlign: "center", letterSpacing: -0.3 }}>
              Upload Grocery Photo
            </Text>

            <View
              style={{
                width: "100%",
                height: uploadIllustrationH,
                marginTop: 12,
                overflow: "hidden",
                borderRadius: 10,
                backgroundColor: "#f1f5f9",
                position: "relative",
              }}
            >
              <Image
                source={UPLOAD_HEADER_IMG}
                style={{
                  position: "absolute",
                  left: "-12%",
                  top: "-8%",
                  width: "124%",
                  height: "124%",
                }}
                contentFit="cover"
                contentPosition="center"
              />
            </View>

            <Text
              style={{
                marginTop: 10,
                color: "#64748b",
                fontSize: 12,
                fontWeight: "500",
                textAlign: "center",
                lineHeight: 16,
                paddingHorizontal: 8,
              }}
            >
              Upload list, handwritten note or photo of items
            </Text>

            <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {["JPG · PNG · PDF", "Max size 10MB"].map((tag) => (
                <View
                  key={tag}
                  style={{
                    backgroundColor: "#fff",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                  }}
                >
                  <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: "600" }}>{tag}</Text>
                </View>
              ))}
            </View>

            {listImageUri ? (
              <View
                style={{
                  marginTop: 10,
                  width: "100%",
                  borderRadius: 12,
                  overflow: "hidden",
                  height: 108,
                  borderWidth: 1,
                  borderColor: "#c7d2fe",
                  backgroundColor: "#fff",
                }}
              >
                <Image source={{ uri: listImageUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                <Pressable
                  onPress={clearImage}
                  hitSlop={10}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(15,23,42,0.72)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={clearImage}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(15,23,42,0.55)",
                    paddingVertical: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Remove photo</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              onPress={() => void pickImage()}
              disabled={sending}
              style={{ marginTop: 10, width: "100%", maxWidth: 280, alignSelf: "center", borderRadius: 999, overflow: "hidden" }}
            >
              <LinearGradient
                colors={sending ? ["#94a3b8", "#64748b"] : [...GRADIENT]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 11,
                }}
              >
                <MaterialCommunityIcons name="camera" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{listImageUri ? "Change Image" : "Upload Image"}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setNotesExpanded((v) => !v)}
            style={{
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              padding: 10,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#3b82f6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="note-edit-outline" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#0f172a", fontSize: 13, fontWeight: "800" }}>Add Extra Notes (Optional)</Text>
              <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "500", marginTop: 2 }} numberOfLines={notesExpanded ? undefined : 1}>
                E.g. 'Only Aashirvaad Atta', 'No sugar', '5kg basmati rice'
              </Text>
            </View>
            <MaterialCommunityIcons name={notesExpanded ? "chevron-up" : "chevron-right"} size={22} color="#9ca3af" />
          </Pressable>

          {notesExpanded ? (
            <TextInput
              value={listNote}
              onChangeText={setListNote}
              placeholder="E.g. Only Aashirvaad Atta, No sugar, 5kg basmati rice"
              placeholderTextColor="#9ca3af"
              multiline
              style={{
                marginTop: 6,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                backgroundColor: "#fafafa",
                paddingHorizontal: 12,
                paddingVertical: 8,
                color: "#0f172a",
                fontSize: 12,
                fontWeight: "500",
                minHeight: 56,
                textAlignVertical: "top",
              }}
            />
          ) : null}

          <Pressable
            onPress={() => void submitRequest()}
            disabled={sending || !listImageUri}
            style={{ marginTop: 8, borderRadius: 999, overflow: "hidden", opacity: !listImageUri ? 0.5 : 1 }}
          >
            <LinearGradient
              colors={sending || !listImageUri ? ["#94a3b8", "#64748b"] : [...GRADIENT]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ paddingVertical: 12, alignItems: "center" }}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MaterialCommunityIcons name="send" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Send to Store</Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "500", marginTop: 2 }}>
                    We'll review and get back to you!
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {profile && listRequests.length > 0 ? (
          <View style={{ marginTop: 14, gap: 6 }}>
            <Text style={{ fontSize: 11, color: "#94a3b8", fontWeight: "800", letterSpacing: 0.5 }}>LIST REQUEST STATUS</Text>
            {listRequests.slice(0, 4).map((r) => (
              <View
                key={r.id}
                style={{
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 12 }}>#{r.id.slice(0, 8)}</Text>
                  <Text style={{ color: "#6366f1", fontWeight: "800", fontSize: 11 }}>{r.status.replace(/_/g, " ")}</Text>
                </View>
                <Text style={{ marginTop: 4, color: "#64748b", fontSize: 11 }}>{new Date(r.createdAt).toLocaleString()}</Text>
                {r.adminNote ? (
                  <Text style={{ marginTop: 3, color: "#334155", fontSize: 11, fontWeight: "600" }}>Admin: {r.adminNote}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {successModal}
    </>
  );
}
