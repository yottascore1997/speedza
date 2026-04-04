import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

type Props = {
  categorySlug: string;
  categoryName: string;
  onOrderNow: () => void;
};

function promoCopy(slug: string, name: string): { headline: string; sub: string; adImage: string } {
  const k = slug.toLowerCase().replace(/\s+/g, "-");
  const n = name.toLowerCase();
  if (k.includes("food") || n.includes("food")) {
    return {
      headline: "Flavor mode: ON 🔥",
      sub: "Bhook mitao — spicy, sweet, sab kuch ek tap door. Aaj kya try karoge?",
      adImage:
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop&q=85",
    };
  }
  if (k.includes("grocery") || n.includes("grocery") || n.includes("daily")) {
    return {
      headline: "Grab India's loved taste",
      sub: "Pantry favourites delivered fast",
      adImage:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=320&h=320&fit=crop&q=80",
    };
  }
  if (k.includes("beverage") || n.includes("beverage")) {
    return {
      headline: "Sip & refresh",
      sub: "Drinks and more, chilled to your door",
      adImage:
        "https://images.unsplash.com/photo-1437418747212-8d9707afab22?w=320&h=320&fit=crop&q=80",
    };
  }
  return {
    headline: "Deals you'll love",
    sub: `Browse ${name} — quality picks nearby`,
    adImage:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=320&h=320&fit=crop&q=80",
  };
}

export function CategoryPromoBanner({ categorySlug, categoryName, onOrderNow }: Props) {
  const { width } = useWindowDimensions();
  const pad = 16;
  const cardW = width - pad * 2;
  const { headline, sub, adImage } = promoCopy(categorySlug, categoryName);
  const k = categorySlug.toLowerCase().replace(/\s+/g, "-");
  const n = categoryName.toLowerCase();
  const isFood = k.includes("food") || n.includes("food");

  return (
    <View style={{ marginBottom: 16, width: cardW, alignSelf: "center" }}>
      <LinearGradient
        colors={
          isFood
            ? (["#fffbeb", "#fde68a", "#fb923c", "#ea580c"] as const)
            : (["#ffedd5", "#fdba74", "#7c2d12"] as const)
        }
        locations={isFood ? ([0, 0.35, 0.7, 1] as const) : ([0, 0.45, 1] as const)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 20,
          paddingVertical: isFood ? 20 : 18,
          paddingHorizontal: 16,
          minHeight: isFood ? 144 : 128,
          flexDirection: "row",
          alignItems: "center",
          overflow: "hidden",
          borderWidth: isFood ? 1 : 0,
          borderColor: "rgba(234, 88, 12, 0.25)",
        }}
      >
        {isFood ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: "rgba(255,255,255,0.35)",
              top: -50,
              right: -40,
            }}
          />
        ) : null}
        <View style={{ flex: 1, paddingRight: 8, zIndex: 1 }}>
          {isFood ? (
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "rgba(15,23,42,0.9)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#fde047", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>
                SPEEDZA BITES
              </Text>
            </View>
          ) : null}
          <Text style={{ fontSize: isFood ? 21 : 19, fontWeight: "900", color: "#0f172a", letterSpacing: -0.35 }}>
            {headline}
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: isFood ? 14 : 13,
              fontWeight: "700",
              color: "#1e293b",
              lineHeight: isFood ? 20 : 18,
            }}
          >
            {sub}
          </Text>
          <Pressable
            onPress={onOrderNow}
            style={{
              alignSelf: "flex-start",
              marginTop: isFood ? 16 : 14,
              backgroundColor: "#0f172a",
              paddingHorizontal: isFood ? 22 : 20,
              paddingVertical: isFood ? 11 : 10,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: isFood ? 13 : 12, letterSpacing: 0.3 }}>
              {isFood ? "Chalo order karein" : "ORDER NOW"}
            </Text>
            {isFood ? <Text style={{ color: "#fde047", fontSize: 14 }}>→</Text> : null}
          </Pressable>
        </View>
        <View style={{ width: 88, height: 88, position: "relative", zIndex: 1 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.35)",
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.65)",
              transform: isFood ? [{ rotate: "3deg" }] : undefined,
            }}
          >
            <Image source={{ uri: adImage }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          </View>
          <View
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              backgroundColor: "rgba(15,23,42,0.88)",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>AD</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
