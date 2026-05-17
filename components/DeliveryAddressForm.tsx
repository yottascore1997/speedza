import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { premiumAlert } from "@/lib/premiumAlert";
import * as Location from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { LAUNCH_PINCODES, normalizePincode, validateDeliveryPincode } from "@/lib/serviceArea";
import { formatAreaLabel } from "@/lib/deliveryAddress";
import { rms, rs } from "@/lib/responsive";

const WINE = "#3f1418";
const WINE_SOFT = "#6b2a30";

const softShadow = Platform.select({
  ios: {
    shadowColor: "#3f1418",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
});

type Props = {
  title?: string;
  subtitle?: string;
  onSaved: () => void;
  onUnserviceable: (areaLabel: string) => void;
  showBack?: boolean;
  onBack?: () => void;
};

function FieldLabel({ text }: { text: string }) {
  return (
    <Text style={{ marginTop: rs(12), marginBottom: rs(6), fontWeight: "800", color: WINE, fontSize: rms(12) }}>
      {text}
    </Text>
  );
}

export function DeliveryAddressForm({
  title = "Select delivery location",
  subtitle = `Delivery abhi sirf pincode ${LAUNCH_PINCODES.join(", ")} par.`,
  onSaved,
  onUnserviceable,
  showBack,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const [addressMode, setAddressMode] = useState<"current" | "manual">("current");
  const [addressText, setAddressText] = useState("");
  const [pincodeInput, setPincodeInput] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const inputStyle = {
    borderWidth: 1,
    borderColor: "rgba(201, 169, 98, 0.35)",
    borderRadius: rs(14),
    paddingHorizontal: rs(14),
    backgroundColor: "#ffffff",
    fontSize: rms(15),
    fontWeight: "600" as const,
    color: theme.text,
    ...softShadow,
  };

  async function useCurrentLocation() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      premiumAlert("Permission needed", "Location allow karein taaki delivery address set ho sake.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const la = pos.coords.latitude;
    const ln = pos.coords.longitude;
    setLat(la);
    setLng(ln);
    const rev = await Location.reverseGeocodeAsync({ latitude: la, longitude: ln }).catch(() => []);
    if (rev.length) {
      const r = rev[0]!;
      const line = [r.name, r.street, r.city, r.region, r.postalCode].filter(Boolean).join(", ");
      if (line.trim()) setAddressText(line);
      if (r.postalCode) setPincodeInput(r.postalCode.replace(/\D/g, "").slice(0, 6));
    }
    premiumAlert("Location captured", "Confirm tap karein.");
  }

  async function save() {
    let finalAddress = addressText.trim();
    let la = lat;
    let ln = lng;

    if (addressMode === "current") {
      if (la == null || ln == null) {
        premiumAlert("Location", "Pehle current location use karein.");
        return;
      }
      if (!finalAddress) finalAddress = "Current location";
    } else {
      if (!finalAddress) {
        premiumAlert("Address", "Poora address likhein.");
        return;
      }
      if (la == null || ln == null) {
        const geo = await Location.geocodeAsync(finalAddress).catch(() => []);
        if (!geo.length) {
          premiumAlert("Address", "Address map nahi ho paya.");
          return;
        }
        la = geo[0]!.latitude;
        ln = geo[0]!.longitude;
        setLat(la);
        setLng(ln);
      }
    }

    if (!normalizePincode(pincodeInput)) {
      premiumAlert("Pincode", "6-digit pincode likhein.");
      return;
    }

    const pinCheck = await validateDeliveryPincode({
      addressText: finalAddress,
      latitude: la ?? undefined,
      longitude: ln ?? undefined,
      pincodeInput,
    });
    if (!pinCheck.ok) {
      if (pinCheck.reason === "not_serviceable") {
        const label = finalAddress.trim()
          ? formatAreaLabel(finalAddress)
          : pinCheck.pincode
            ? `Pincode ${pinCheck.pincode}`
            : "Your area";
        onUnserviceable(label);
        return;
      }
      premiumAlert("Delivery area", pinCheck.message);
      return;
    }

    setSaving(true);
    const res = await api("/api/user/address", {
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
      premiumAlert("Error", res.error || "Address save nahi hua.");
      return;
    }
    onSaved();
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fffbf9" }}>
      <LinearGradient
        colors={["#fff9f7", "#fff3f0", "#f9ebe8"]}
        locations={[0, 0.45, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + rs(10),
            paddingBottom: insets.bottom + rs(20),
            paddingHorizontal: rs(20),
          }}
          showsVerticalScrollIndicator={false}
        >
          {showBack && onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: rs(4),
                marginBottom: rs(10),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={WINE} />
              <Text style={{ fontWeight: "800", color: WINE, fontSize: rms(14) }}>Back</Text>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8), marginBottom: rs(8) }}>
            <View
              style={{
                width: rs(34),
                height: rs(34),
                borderRadius: rs(10),
                backgroundColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(4, 120, 87, 0.2)",
              }}
            >
              <MaterialCommunityIcons name="truck-delivery-outline" size={18} color="#047857" />
            </View>
            <Text style={{ fontSize: rms(11), fontWeight: "800", color: "#047857", letterSpacing: 0.8, textTransform: "uppercase" }}>
              Delivery address
            </Text>
          </View>

          <Text style={{ color: WINE, fontSize: rms(26), fontWeight: "900", letterSpacing: -0.6, lineHeight: rms(30) }}>
            {title}
          </Text>
          <Text style={{ color: WINE_SOFT, fontSize: rms(13), fontWeight: "600", marginTop: rs(6), lineHeight: rms(18) }}>
            {subtitle}
          </Text>

          <View
            style={{
              flexDirection: "row",
              marginTop: rs(16),
              padding: rs(4),
              borderRadius: rs(14),
              backgroundColor: "rgba(255,255,255,0.7)",
              borderWidth: 1,
              borderColor: "rgba(63, 20, 24, 0.06)",
            }}
          >
            {(["current", "manual"] as const).map((mode) => {
              const active = addressMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setAddressMode(mode)}
                  style={{ flex: 1, borderRadius: rs(11), overflow: "hidden" }}
                >
                  {active ? (
                    <LinearGradient
                      colors={["#0f4a3c", "#059669"]}
                      style={{ paddingVertical: rs(10), alignItems: "center" }}
                    >
                      <Text style={{ fontWeight: "900", fontSize: rms(12), color: "#fff" }}>
                        {mode === "current" ? "Use GPS" : "Type address"}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={{ paddingVertical: rs(10), alignItems: "center" }}>
                      <Text style={{ fontWeight: "800", fontSize: rms(12), color: WINE_SOFT }}>
                        {mode === "current" ? "Use GPS" : "Type address"}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {addressMode === "current" ? (
            <Pressable
              onPress={() => void useCurrentLocation()}
              style={({ pressed }) => ({
                marginTop: rs(12),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: rs(8),
                backgroundColor: "#fff",
                borderRadius: rs(14),
                borderWidth: 1,
                borderColor: "rgba(4, 120, 87, 0.25)",
                paddingVertical: rs(12),
                opacity: pressed ? 0.9 : 1,
                ...softShadow,
              })}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#047857" />
              <Text style={{ fontWeight: "800", color: "#047857", fontSize: rms(13) }}>Use current location</Text>
            </Pressable>
          ) : null}

          <View
            style={{
              marginTop: rs(12),
              padding: rs(14),
              borderRadius: rs(16),
              backgroundColor: "rgba(255,255,255,0.65)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.9)",
            }}
          >
            <FieldLabel text="Pincode *" />
            <TextInput
              value={pincodeInput}
              onChangeText={(t) => setPincodeInput(t.replace(/\D/g, "").slice(0, 6))}
              placeholder={`e.g. ${LAUNCH_PINCODES[0]}`}
              placeholderTextColor="#a8a29e"
              keyboardType="number-pad"
              maxLength={6}
              style={{ ...inputStyle, paddingVertical: rs(11), fontWeight: "800", fontSize: rms(17), letterSpacing: 1 }}
            />

            <FieldLabel text="Full address *" />
            <TextInput
              value={addressText}
              onChangeText={setAddressText}
              placeholder="House, street, area, city"
              placeholderTextColor="#a8a29e"
              multiline
              style={{
                ...inputStyle,
                minHeight: rs(72),
                paddingVertical: rs(11),
                textAlignVertical: "top",
              }}
            />
          </View>

          <Pressable
            onPress={() => void save()}
            disabled={saving}
            style={({ pressed }) => ({
              marginTop: rs(16),
              borderRadius: rs(14),
              overflow: "hidden",
              opacity: saving || pressed ? 0.88 : 1,
              ...softShadow,
            })}
          >
            <LinearGradient
              colors={["#0f4a3c", "#047857", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingVertical: rs(14),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: rs(8),
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle-outline" size={22} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: rms(15) }}>Confirm location</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
