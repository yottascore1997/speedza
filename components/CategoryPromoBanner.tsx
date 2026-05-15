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
  const padV = isFood ? 12 : 10;
  const minH = isFood ? 108 : 96;
  const thumb = Math.round(Math.min(76, Math.max(52, width * 0.18)));

  return (
    <View style={{ marginBottom: 12, width: cardW, alignSelf: "center" }}>
      <View
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: isFood ? 1 : 0,
          borderColor: "rgba(234, 88, 12, 0.25)",
        }}
      >
        <View style={{ height: 26, backgroundColor: bannerBg }} />
        <View
          style={{
            position: "relative",
            backgroundColor: bannerBg,
            minHeight: Math.max(minH - 26, 56),
            paddingVertical: padV,
            paddingHorizontal: 12,
          }}
        >
          {isFood ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: "rgba(255,255,255,0.22)",
                top: -14,
                right: -18,
              }}
            />
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              gap: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
              {isFood ? (
                <View
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 5,
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ color: "#fde047", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }}>SPEEDZA BITES</Text>
                </View>
              ) : null}
              <Text
                style={{
                  fontSize: isFood ? 18 : 16,
                  fontWeight: "900",
                  color: isFood ? "#ffffff" : "#0f172a",
                  letterSpacing: -0.3,
                }}
                numberOfLines={2}
              >
                {headline}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: isFood ? 12.5 : 12,
                  fontWeight: "700",
                  color: isFood ? "rgba(255,255,255,0.9)" : "#334155",
                  lineHeight: isFood ? 17 : 16,
                }}
                numberOfLines={2}
              >
                {sub}
              </Text>
              <Pressable
                onPress={onOrderNow}
                style={{
                  alignSelf: "flex-start",
                  marginTop: isFood ? 10 : 9,
                  backgroundColor: "#0f172a",
                  paddingHorizontal: isFood ? 16 : 14,
                  paddingVertical: isFood ? 8 : 7,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: isFood ? 11.5 : 11, letterSpacing: 0.25 }}>
                  {isFood ? "Chalo order karein" : "ORDER NOW"}
                </Text>
                {isFood ? <Text style={{ color: "#fde047", fontSize: 13, marginLeft: 5 }}>→</Text> : null}
              </Pressable>
            </View>

            <View style={{ flexShrink: 0, justifyContent: "center", zIndex: 1 }}>
              <View
                style={{
                  width: thumb,
                  height: thumb,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: isFood ? "rgba(255,255,255,0.3)" : "#f1f5f9",
                  borderWidth: 2,
                  borderColor: isFood ? "rgba(255,255,255,0.6)" : "#e2e8f0",
                  ...(isFood ? { transform: [{ rotate: "3deg" }] } : {}),
                }}
              >
                <Image source={{ uri: adImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                <View
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    backgroundColor: "rgba(15,23,42,0.88)",
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}>AD</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
