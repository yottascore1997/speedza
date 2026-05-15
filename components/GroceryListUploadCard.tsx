import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, getApiBase, getToken } from "@/lib/api";

type Props = {
  variant?: "home" | "compact";
  style?: StyleProp<ViewStyle>;
};

export function GroceryListUploadCard({ variant = "home", style }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const compact = variant === "compact";

  async function uploadList() {
    const token = await getToken();
    if (!token) {
      Alert.alert("Sign in required", "Please login first, then upload your grocery list photo.");
      router.push("/login");
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow gallery access to upload list photo.");
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
      fd.append("file", { uri: imageUri, name: `list.${ext}`, type: mime } as any);

      const up = await fetch(`${getApiBase()}/api/list-requests/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd as any,
      });
      const upJson = (await up.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
      if (!up.ok || !upJson?.imageUrl) {
        Alert.alert("Upload failed", upJson?.error || "Could not upload list image");
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
        Alert.alert("Request failed", createRes.error || "Could not create request");
        return;
      }

      setSuccessVisible(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
    <Pressable
      onPress={() => void uploadList()}
      disabled={sending}
      style={[
        {
          borderRadius: compact ? 16 : 20,
          overflow: "hidden",
          opacity: sending ? 0.8 : 1,
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: compact ? "#bfdbfe" : "#dbeafe",
          shadowColor: "#1e3a8a",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: compact ? 0.05 : 0.08,
          shadowRadius: compact ? 8 : 14,
          elevation: compact ? 2 : 4,
        },
        style,
      ]}
    >
      <View
        style={{
          paddingHorizontal: compact ? 12 : 14,
          paddingVertical: compact ? 11 : 14,
          borderRadius: compact ? 16 : 20,
          backgroundColor: compact ? "#eff6ff" : "#f8fbff",
          overflow: "hidden",
        }}
      >
        {!compact ? (
          <>
            <MaterialCommunityIcons
              name="cart-outline"
              size={58}
              color="#dbeafe"
              style={{ position: "absolute", right: 14, top: 8, opacity: 0.75, transform: [{ rotate: "-10deg" }] }}
            />
            <MaterialCommunityIcons
              name="apple-outline"
              size={34}
              color="#fed7aa"
              style={{ position: "absolute", right: 78, bottom: 20, opacity: 0.8, transform: [{ rotate: "12deg" }] }}
            />
            <MaterialCommunityIcons
              name="basket-outline"
              size={42}
              color="#bfdbfe"
              style={{ position: "absolute", left: 126, bottom: 56, opacity: 0.55, transform: [{ rotate: "8deg" }] }}
            />
          </>
        ) : null}

        {!compact ? (
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderRadius: 999,
              backgroundColor: "#dbeafe",
              paddingHorizontal: 9,
              paddingVertical: 4,
              marginBottom: 10,
            }}
          >
            <MaterialCommunityIcons name="sparkles" size={12} color="#2563eb" />
            <Text style={{ color: "#1d4ed8", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 }}>
              SMART GROCERY ASSIST
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: compact ? "center" : "flex-start", gap: compact ? 10 : 12 }}>
          <View
            style={{
              width: compact ? 40 : 56,
              height: compact ? 40 : 56,
              borderRadius: compact ? 13 : 16,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: compact ? "#bfdbfe" : "#dbeafe",
            }}
          >
            <MaterialCommunityIcons
              name="clipboard-list-outline"
              size={compact ? 22 : 30}
              color="#2563eb"
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={compact ? 1 : 2}
              style={{
                color: "#0f172a",
                fontSize: compact ? 13 : 17,
                fontWeight: "900",
                letterSpacing: compact ? -0.1 : -0.35,
                lineHeight: compact ? 17 : 21,
              }}
            >
              {compact ? "Order from your grocery list" : "Upload your grocery list"}
            </Text>
            <Text
              numberOfLines={compact ? 2 : 2}
              style={{
                marginTop: compact ? 3 : 5,
                color: "#475569",
                fontSize: compact ? 10.5 : 12,
                fontWeight: "700",
                lineHeight: compact ? 14 : 16,
              }}
            >
              {compact
                ? "Upload a photo and our team will prepare your order."
                : "Upload a paper or WhatsApp list. Our team will match items and prepare your order."}
            </Text>
          </View>

          {compact ? (
            <LinearGradient
              colors={["#38bdf8", "#2563eb"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 8,
                minWidth: 76,
                alignItems: "center",
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>Upload</Text>
              )}
            </LinearGradient>
          ) : null}
        </View>

        {!compact ? (
          <>
            <View style={{ flexDirection: "row", gap: 7, marginTop: 13 }}>
              {[
                { icon: "camera-outline" as const, label: "Photo upload" },
                { icon: "format-list-checks" as const, label: "Items matched" },
                { icon: "truck-fast-outline" as const, label: "Order ready" },
              ].map((step) => (
                <View
                  key={step.label}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: "#dbeafe",
                    paddingVertical: 8,
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <MaterialCommunityIcons name={step.icon} size={16} color="#2563eb" />
                  <Text numberOfLines={1} style={{ color: "#1e293b", fontSize: 9.5, fontWeight: "900" }}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>

            <LinearGradient
              colors={sending ? ["#9ca3af", "#6b7280"] : ["#fb923c", "#ea580c"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                marginTop: 12,
                borderRadius: 14,
                paddingVertical: 11,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#fff" />
              )}
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                {sending ? "Uploading..." : "Upload Photo"}
              </Text>
            </LinearGradient>
          </>
        ) : null}
      </View>
    </Pressable>
      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSuccessVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.54)",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              borderRadius: 28,
              backgroundColor: "#ffffff",
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(219,234,254,0.9)",
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.22,
              shadowRadius: 30,
              elevation: 18,
            }}
          >
            <LinearGradient
              colors={["#eff6ff", "#ffffff", "#fff7ed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 }}
            >
              <MaterialCommunityIcons
                name="cart-check"
                size={86}
                color="#dbeafe"
                style={{ position: "absolute", right: 10, top: 8, opacity: 0.72, transform: [{ rotate: "-8deg" }] }}
              />

              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 22,
                  backgroundColor: "#dcfce7",
                  borderWidth: 1,
                  borderColor: "#bbf7d0",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <MaterialCommunityIcons name="check-bold" size={32} color="#16a34a" />
              </View>

              <Text style={{ color: "#0f172a", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.45 }}>
                List received
              </Text>
              <Text style={{ marginTop: 7, color: "#475569", fontSize: 13.5, lineHeight: 20, fontWeight: "700" }}>
                Our team will review your grocery list, match available items, and prepare your order.
              </Text>

              <View style={{ marginTop: 16, gap: 8 }}>
                {[
                  { icon: "clipboard-search-outline" as const, label: "List is under review" },
                  { icon: "package-variant-closed" as const, label: "Items will be matched" },
                  { icon: "account-outline" as const, label: "Track status in Account" },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                      borderRadius: 14,
                      backgroundColor: "rgba(255,255,255,0.82)",
                      borderWidth: 1,
                      borderColor: "#e2e8f0",
                      paddingHorizontal: 11,
                      paddingVertical: 9,
                    }}
                  >
                    <MaterialCommunityIcons name={item.icon} size={18} color="#2563eb" />
                    <Text style={{ flex: 1, color: "#1e293b", fontSize: 12.5, fontWeight: "800" }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <Pressable
                  onPress={() => setSuccessVisible(false)}
                  style={{
                    flex: 1,
                    borderRadius: 15,
                    backgroundColor: "#f1f5f9",
                    paddingVertical: 13,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#334155", fontSize: 13, fontWeight: "900" }}>Close</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSuccessVisible(false);
                    router.push("/account");
                  }}
                  style={{ flex: 1.25, borderRadius: 15, overflow: "hidden" }}
                >
                  <LinearGradient
                    colors={["#fb923c", "#ea580c"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{
                      paddingVertical: 13,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>Track in Account</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />
                  </LinearGradient>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
}
