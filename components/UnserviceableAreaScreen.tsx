import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { LAUNCH_PINCODES, SERVICE_AREA_LABEL } from "@/lib/serviceArea";
import { getWebBase } from "@/lib/web-base";
import { rms, rs } from "@/lib/responsive";

type Props = {
  areaLabel: string;
  onChangeLocation: () => void;
};

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

function MenuRow(props: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: pressed ? "#faf8f6" : "#ffffff",
        borderRadius: rs(14),
        paddingVertical: rs(12),
        paddingHorizontal: rs(14),
        marginBottom: rs(8),
        borderWidth: 1,
        borderColor: "rgba(63, 20, 24, 0.06)",
        ...softShadow,
      })}
    >
      <View
        style={{
          width: rs(38),
          height: rs(38),
          borderRadius: rs(11),
          backgroundColor: "#f8f0ee",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={props.icon} size={20} color={WINE_SOFT} />
      </View>
      <Text style={{ flex: 1, marginLeft: rs(12), fontSize: rms(13.5), fontWeight: "800", color: "#1c1917" }}>
        {props.title}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#a8a29e" />
    </Pressable>
  );
}

function StoreIllustration() {
  return (
    <View style={{ width: rs(200), height: rs(130), alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: rs(160),
          height: rs(160),
          borderRadius: rs(80),
          backgroundColor: "rgba(232, 180, 184, 0.3)",
        }}
      />
      <LinearGradient
        colors={["#ffffff", "#fdf6f4"]}
        style={{
          width: rs(168),
          paddingTop: rs(28),
          paddingBottom: rs(14),
          borderRadius: rs(18),
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.9)",
          ...softShadow,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: rs(-10),
            paddingHorizontal: rs(10),
            paddingVertical: rs(5),
            borderRadius: rs(8),
            backgroundColor: WINE,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: rms(9), letterSpacing: 0.5 }}>STORE CLOSED</Text>
        </View>
        <MaterialCommunityIcons name="storefront-outline" size={rs(40)} color={WINE_SOFT} />
      </LinearGradient>
    </View>
  );
}

export function UnserviceableAreaScreen({ areaLabel, onChangeLocation }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#fffbf9" }}>
      <LinearGradient
        colors={["#fff9f7", "#fff3f0", "#f9ebe8"]}
        locations={[0, 0.5, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + rs(10),
          paddingBottom: insets.bottom + rs(16),
          paddingHorizontal: rs(20),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6), marginBottom: rs(10) }}>
          <MaterialCommunityIcons name="map-marker-radius" size={18} color={WINE} />
          <Text style={{ fontSize: rms(11), fontWeight: "800", color: WINE_SOFT, letterSpacing: 1, textTransform: "uppercase" }}>
            Delivery paused
          </Text>
        </View>

        <Text style={{ color: WINE, fontSize: rms(28), fontWeight: "900", letterSpacing: -0.8, lineHeight: rms(32) }}>
          Unserviceable area
        </Text>

        <Pressable
          onPress={onChangeLocation}
          style={({ pressed }) => ({
            marginTop: rs(10),
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            maxWidth: "100%",
            paddingVertical: rs(9),
            paddingHorizontal: rs(12),
            borderRadius: rs(12),
            backgroundColor: pressed ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.92)",
            borderWidth: 1,
            borderColor: "rgba(201, 169, 98, 0.35)",
            gap: rs(8),
            ...softShadow,
          })}
        >
          <MaterialCommunityIcons name="map-marker" size={18} color={WINE} />
          <Text numberOfLines={1} style={{ flex: 1, color: WINE, fontSize: rms(14), fontWeight: "800" }}>
            {areaLabel}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={WINE_SOFT} />
        </Pressable>

        <View
          style={{
            marginTop: rs(14),
            paddingVertical: rs(12),
            paddingHorizontal: rs(14),
            borderRadius: rs(14),
            backgroundColor: "rgba(255,255,255,0.6)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.85)",
          }}
        >
          <Text style={{ textAlign: "center", color: WINE_SOFT, fontSize: rms(13.5), fontWeight: "700", lineHeight: rms(20) }}>
            <Text style={{ fontWeight: "900", color: WINE }}>Hello! </Text>
            It&apos;s not you, it&apos;s us. We&apos;re not serving this area right now. Sorry for the inconvenience 🙁
          </Text>
        </View>

        <View style={{ alignItems: "center", marginTop: rs(12), marginBottom: rs(6) }}>
          <StoreIllustration />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: rs(6), marginBottom: rs(4) }}>
          {LAUNCH_PINCODES.map((pin) => (
            <View
              key={pin}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: rs(4),
                paddingHorizontal: rs(10),
                paddingVertical: rs(5),
                borderRadius: rs(999),
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "rgba(4, 120, 87, 0.2)",
              }}
            >
              <MaterialCommunityIcons name="check-decagram" size={14} color="#047857" />
              <Text style={{ fontSize: rms(11), fontWeight: "900", color: "#065f46" }}>{pin}</Text>
            </View>
          ))}
        </View>
        <Text style={{ textAlign: "center", color: "#78716c", fontSize: rms(11), fontWeight: "600", marginBottom: rs(14) }}>
          {SERVICE_AREA_LABEL}
        </Text>

        <Pressable
          onPress={onChangeLocation}
          style={({ pressed }) => ({
            marginBottom: rs(16),
            borderRadius: rs(14),
            overflow: "hidden",
            opacity: pressed ? 0.92 : 1,
            ...softShadow,
          })}
        >
          <LinearGradient
            colors={["#0f4a3c", "#059669"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: rs(13),
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: rs(8),
            }}
          >
            <MaterialCommunityIcons name="map-search" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: rms(14) }}>Change delivery location</Text>
          </LinearGradient>
        </Pressable>

        <MenuRow icon="lifebuoy" title="Need help with orders?" onPress={() => router.push("/help")} />
        <MenuRow icon="information-outline" title="About Speedza" onPress={() => void Linking.openURL(getWebBase()).catch(() => {})} />
        <MenuRow
          icon="instagram"
          title="Follow us on Instagram"
          onPress={() => void Linking.openURL("https://instagram.com").catch(() => {})}
        />
      </ScrollView>
    </View>
  );
}
