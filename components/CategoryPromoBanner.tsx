import { View, Text, Pressable, useWindowDimensions, Image } from "react-native";
import { getShopHeaderColors } from "@/lib/shopHeaderTheme";

type Props = {
  categorySlug: string;
  categoryName: string;
  onOrderNow: () => void;
};

function bannerTone(slug: string, name: string, isFood: boolean): { top: string; bottom: string } {
  const colors = getShopHeaderColors(slug || name);
  const [c0, c1, c2] = colors.headerGradient;
  return {
    top: isFood ? c2 : c1,
    bottom: c0,
  };
}

function promoCopy(slug: string, name: string): { headline: string; sub: string; adImage: string } {
  const k = slug.toLowerCase().replace(/\s+/g, "-");
  const n = name.toLowerCase();
  if (k.includes("food") || n.includes("food")) {
    return {
      headline: "Flavor mode: ON!",
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
  const cardW = Math.max(1, width - pad * 2);
  const slug = String(categorySlug ?? "");
  const name = String(categoryName ?? "");
  const { headline, sub, adImage } = promoCopy(slug, name);
  const k = slug.toLowerCase().replace(/\s+/g, "-");
  const n = name.toLowerCase();
  const isFood = k.includes("food") || n.includes("food");
  const tone = bannerTone(slug, name, isFood);
  const bannerBg = isFood ? "#7f1d1d" : tone.bottom;
  const padV = isFood ? 20 : 18;
  const minH = isFood ? 144 : 128;
  const compactFood = isFood && width < 370;
  const foodThumb = compactFood ? 72 : 88;

  return (
    <View style={{ marginBottom: 16, width: cardW, alignSelf: "center" }}>
      <View
        style={{
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: isFood ? 1 : 0,
          borderColor: "rgba(234, 88, 12, 0.25)",
        }}
      >
        <View style={{ height: 36, backgroundColor: bannerBg }} />
        <View
          style={{
            position: "relative",
            backgroundColor: bannerBg,
            minHeight: Math.max(minH - 36, 72),
            paddingVertical: padV,
            paddingHorizontal: 16,
          }}
        >
          {isFood ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: "rgba(255,255,255,0.28)",
                top: -20,
                right: -28,
              }}
            />
          ) : null}
          <View style={{ flexDirection: compactFood ? "column" : "row", alignItems: compactFood ? "flex-start" : "center" }}>
            <View style={{ flex: 1, paddingRight: compactFood ? 0 : 8, zIndex: 1, width: "100%" }}>
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
              <Text style={{ fontSize: isFood ? 21 : 19, fontWeight: "900", color: isFood ? "#ffffff" : "#0f172a", letterSpacing: -0.35 }}>
                {headline}
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: isFood ? 14 : 13,
                  fontWeight: "700",
                  color: isFood ? "rgba(255,255,255,0.92)" : "#1e293b",
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
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: isFood ? 13 : 12, letterSpacing: 0.3 }}>
                  {isFood ? "Chalo order karein" : "ORDER NOW"}
                </Text>
                {isFood ? <Text style={{ color: "#fde047", fontSize: 14, marginLeft: 6 }}>→</Text> : null}
              </Pressable>
            </View>
            <View
              style={{
                width: foodThumb,
                height: foodThumb,
                position: "relative",
                zIndex: 1,
                marginTop: compactFood ? 12 : 0,
                alignSelf: compactFood ? "flex-end" : "auto",
              }}
            >
              <View
                style={[
                  {
                    width: foodThumb,
                    height: foodThumb,
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: "rgba(255,255,255,0.35)",
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.65)",
                  },
                  isFood ? { transform: [{ rotate: "3deg" }] } : {},
                ]}
              >
                <Image source={{ uri: adImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </View>
              <View
                style={{
                  position: "absolute",
                  top: 1,
                  right: 1,
                  backgroundColor: "rgba(15,23,42,0.88)",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>AD</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
