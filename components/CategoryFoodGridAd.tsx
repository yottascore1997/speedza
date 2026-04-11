import { View, Text, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/** Warm appetite → fresh green — matches Speedza orange + food energy */
const FOOD_AD_GRADIENT = ["#ffedd5", "#fdba74", "#f97316", "#16a34a"] as const;

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  android: { elevation: 5 },
  default: {},
});

const LINES: { title: string; sub: string; emoji: string; chip: string }[] = [
  {
    title: "Bhook max? Fix it now",
    sub: "Search karke dekho — treats wait kar rahe hain",
    emoji: "😋",
    chip: "YUM",
  },
  {
    title: "Swad + speed = magic",
    sub: "Crispy · cheesy · spicy — jo mann kare",
    emoji: "🔥",
    chip: "HOT",
  },
  {
    title: "Chef’s pick for you",
    sub: "Tap karo, offers aur naye joints explore karo",
    emoji: "🍜",
    chip: "NEW",
  },
];

type Props = {
  /** 1-based block index after each group of 9 subcategories */
  slot: number;
  onPress: () => void;
};

export function CategoryFoodGridAd({ slot, onPress }: Props) {
  const line = LINES[(Math.max(1, slot) - 1) % LINES.length];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Sponsored food offer. ${line.title}`}
      style={{
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(234, 88, 12, 0.35)",
        ...cardShadow,
      }}
    >
      <LinearGradient
        colors={[...FOOD_AD_GRADIENT]}
        locations={[0, 0.28, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingVertical: 22,
          paddingHorizontal: 16,
          minHeight: 128,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: "rgba(255,255,255,0.2)",
            top: -36,
            right: -24,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "rgba(255,255,255,0.12)",
            bottom: -12,
            left: 20,
          }}
        />

        <View style={{ flex: 1, paddingRight: 10, minWidth: 0, zIndex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <View
              style={{
                backgroundColor: "rgba(15,23,42,0.88)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                transform: [{ rotate: "-2deg" }],
              }}
            >
              <Text style={{ color: "#fef08a", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }}>
                {line.chip}
              </Text>
            </View>
            <Text style={{ fontSize: 9, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 1 }}>
              AD · SPONSORED
            </Text>
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: "#0f172a",
              marginTop: 10,
              letterSpacing: -0.4,
              lineHeight: 24,
            }}
            numberOfLines={2}
          >
            {line.title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: "#1e293b",
              marginTop: 5,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {line.sub}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "900", color: "#c2410c" }}>Chalo dekhein</Text>
            <MaterialCommunityIcons name="arrow-right-bold" size={16} color="#c2410c" />
          </View>
        </View>

        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.92)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.95)",
            zIndex: 1,
            transform: [{ rotate: "4deg" }],
          }}
        >
          <Text style={{ fontSize: 34 }}>{line.emoji}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function isFoodMainCategory(slug: string, displayName: string): boolean {
  const k = slug.toLowerCase().replace(/\s+/g, "-");
  const n = displayName.toLowerCase();
  return k.includes("food") || n.includes("food");
}
