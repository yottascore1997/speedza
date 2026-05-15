import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { CartQtyStepper, type CartQtyStepperLine } from "@/components/CartQtyStepper";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";

const CANVAS = "#f4f7f4";
const DEEP_GREEN = "#0f3d2e";
const MID_GREEN = "#166534";
const HERO_IMG = require("../assets/dailybg1.png");
const CATEGORY_COLS = 3;
const PROMO_H = 96;

const lift =
  Platform.OS === "ios"
    ? {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      }
    : { elevation: 6 };

const softLift =
  Platform.OS === "ios"
    ? {
        shadowColor: "#14532d",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      }
    : { elevation: 3 };

export type DailyChip = {
  id: string;
  name: string;
  thumb?: string | null;
};

type ApiProduct = {
  id: string;
  name: string;
  price: unknown;
  mrp?: unknown;
  discountPercent?: number | null;
  stock?: number;
  imageUrl?: string | null;
  unitLabel?: string | null;
  store?: { id: string; name: string };
};

type Props = {
  bottomInset: number;
  categoryTitle: string;
  catalogKey: string;
  lat: number;
  lng: number;
  chips: DailyChip[];
  onOpenSub: (chip: DailyChip) => void;
};

function numPrice(p: unknown): number {
  if (typeof p === "string") {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof p === "number" && Number.isFinite(p)) return p;
  return Number(p) || 0;
}

function pctOff(price: number, mrp: number, disc?: number | null): number {
  if (typeof disc === "number" && disc > 0) return Math.round(disc);
  if (mrp > 0 && price > 0 && price < mrp) return Math.round(((mrp - price) / mrp) * 100);
  return 0;
}

export function DailyEssentialsStorefront(props: Props) {
  const { bottomInset, categoryTitle, catalogKey, lat, lng, chips, onOpenSub } = props;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pad = 16;
  const cardPad = 16;
  const gap = 8;
  const heroW = width;
  /** Grid sits inside screen pad + white card pad — must match layout below */
  const categoryGridW = width - pad * 2 - cardPad * 2;
  const subCol = Math.floor((categoryGridW - gap * (CATEGORY_COLS - 1)) / CATEGORY_COLS);
  const promoCardW = (width - pad * 2 - gap) / 2;
  const productCardW = Math.min(172, Math.round(width * 0.46));

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const seen = new Set<string>();
      const merged: ApiProduct[] = [];
      const addList = (list: ApiProduct[] | undefined) => {
        if (!list) return;
        for (const p of list) {
          if (seen.has(p.id)) continue;
          if (typeof p.stock === "number" && p.stock <= 0) continue;
          seen.add(p.id);
          merged.push(p);
        }
      };

      const verticals = Array.from(
        new Set([catalogKey, "daily-essentials", "grocery"].filter(Boolean)),
      );

      if (chips.length > 0) {
        const slice = chips.slice(0, 10);
        const batch = await Promise.all(
          slice.map((chip) => {
            const q = new URLSearchParams({
              vertical: catalogKey,
              lat: String(lat),
              lng: String(lng),
              limit: "10",
              masterCategoryId: chip.id,
            });
            return api<{ products: ApiProduct[] }>(`/api/shop/category-quick?${q.toString()}`);
          }),
        );
        for (const res of batch) {
          if (res.ok && res.data?.products) addList(res.data.products);
        }
      }

      if (merged.length < 8) {
        for (const vertical of verticals) {
          const res = await api<{ products: ApiProduct[] }>(
            `/api/shop/category-quick?vertical=${encodeURIComponent(vertical)}&lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&limit=32`,
          );
          if (res.ok && res.data?.products) addList(res.data.products);
          if (merged.length >= 20) break;
        }
      }

      setProducts(merged.slice(0, 28));
    } finally {
      setLoading(false);
    }
  }, [catalogKey, chips, lat, lng]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const bestSelling = useMemo(() => products.slice(0, 14), [products]);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 28 }}
      >
        {/* Hero — image only, no overlay */}
        <View style={{ marginBottom: 20, width: heroW, alignSelf: "center" }}>
          <View
            style={{
              borderBottomLeftRadius: 28,
              borderBottomRightRadius: 28,
              overflow: "hidden",
              width: heroW,
              aspectRatio: 2,
              ...lift,
            }}
          >
            <Image
              source={HERO_IMG}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              contentPosition="left center"
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: pad }}>
          {/* Subcategories — main focus */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 16,
              marginBottom: 18,
              borderWidth: 1,
              borderColor: "rgba(22,101,52,0.08)",
              ...softLift,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: MID_GREEN, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }}>CATEGORIES</Text>
                <Text style={{ color: DEEP_GREEN, fontSize: 20, fontWeight: "900", marginTop: 4, letterSpacing: -0.4 }}>
                  Shop by aisle
                </Text>
                <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "600", marginTop: 4 }}>
                  {chips.length > 0
                    ? `${chips.length} subcategories in ${categoryTitle}`
                    : "Subcategories loading from catalog…"}
                </Text>
              </View>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: "#ecfdf5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="view-grid-outline" size={24} color={MID_GREEN} />
              </View>
            </View>

            {chips.length === 0 ? (
              <Text style={{ color: "#94a3b8", fontWeight: "700", fontSize: 13, paddingVertical: 12 }}>
                No subcategories yet. Browse best sellers below.
              </Text>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap,
                  width: categoryGridW,
                  alignSelf: "center",
                }}
              >
                {chips.map((c, index) => {
                  const uri = c.thumb ? resolveMediaUrl(c.thumb) : undefined;
                  const accent =
                    index % 3 === 0
                      ? ["#ecfdf5", "#d1fae5"]
                      : index % 3 === 1
                        ? ["#fffbeb", "#fef3c7"]
                        : ["#eff6ff", "#dbeafe"];
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => onOpenSub(c)}
                      style={({ pressed }) => ({
                        width: subCol,
                        opacity: pressed ? 0.92 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <LinearGradient
                        colors={accent as [string, string]}
                        style={{
                          width: subCol,
                          borderRadius: 16,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.9)",
                          ...softLift,
                        }}
                      >
                        <View
                          style={{
                            width: "100%",
                            aspectRatio: 1,
                            borderRadius: 12,
                            backgroundColor: "#fff",
                            overflow: "hidden",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {uri ? (
                            <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                          ) : (
                            <MaterialCommunityIcons name="shopping-outline" size={28} color="#94a3b8" />
                          )}
                        </View>
                        <Text
                          numberOfLines={2}
                          style={{
                            marginTop: 8,
                            fontSize: 11,
                            fontWeight: "900",
                            color: DEEP_GREEN,
                            lineHeight: 14,
                            minHeight: 28,
                            textAlign: "center",
                          }}
                        >
                          {c.name}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Promo duo */}
          <View style={{ flexDirection: "row", gap, marginBottom: 18 }}>
            <LinearGradient
              colors={["#052e16", "#166534"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: promoCardW,
                borderRadius: 16,
                padding: 11,
                minHeight: PROMO_H,
                overflow: "hidden",
              }}
            >
              <Text style={{ color: "#86efac", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>FIRST ORDER</Text>
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", marginTop: 4, lineHeight: 20 }}>Flat 20% Off</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", marginTop: 2 }}>Code NEW20</Text>
              <Image
                source={require("../assets/discount.png")}
                style={{ position: "absolute", right: -6, bottom: -8, width: 58, height: 58, opacity: 0.95 }}
                contentFit="contain"
              />
            </LinearGradient>

            <LinearGradient
              colors={["#fef9c3", "#fde047", "#facc15"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: promoCardW,
                borderRadius: 16,
                padding: 11,
                minHeight: PROMO_H,
                overflow: "hidden",
              }}
            >
              <Text style={{ color: "#854d0e", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>FREE DELIVERY</Text>
              <Text style={{ color: DEEP_GREEN, fontSize: 14, fontWeight: "900", marginTop: 4, lineHeight: 18 }}>Orders above ₹499</Text>
              <Image
                source={require("../assets/trolley.png")}
                style={{ position: "absolute", right: 0, bottom: 0, width: 52, height: 52, opacity: 0.9 }}
                contentFit="contain"
              />
            </LinearGradient>
          </View>

          {/* Trust pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            style={{ marginBottom: 20, marginHorizontal: -4 }}
          >
            {[
              { icon: "truck-fast-outline" as const, label: "30 min delivery" },
              { icon: "shield-check-outline" as const, label: "100% genuine" },
              { icon: "tag-heart-outline" as const, label: "Best prices" },
              { icon: "headset" as const, label: "24/7 help" },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#fff",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "#ecfdf5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name={item.icon} size={16} color={MID_GREEN} />
                </View>
                <Text style={{ color: DEEP_GREEN, fontSize: 12, fontWeight: "800" }}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Best selling */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View>
              <Text style={{ color: MID_GREEN, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>TOP PICKS</Text>
              <Text style={{ color: DEEP_GREEN, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 }}>Best selling</Text>
              <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "600", marginTop: 3 }}>
                From {categoryTitle} aisles near you
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/search" as Href)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "#ecfdf5",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: MID_GREEN, fontSize: 12, fontWeight: "900" }}>See all</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={MID_GREEN} />
            </Pressable>
          </View>

          {loading && bestSelling.length === 0 ? (
            <ActivityIndicator size="large" color={MID_GREEN} style={{ marginVertical: 32 }} />
          ) : bestSelling.length === 0 ? (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 20,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#e2e8f0",
              }}
            >
              <MaterialCommunityIcons name="store-outline" size={40} color="#cbd5e1" />
              <Text style={{ marginTop: 12, color: "#64748b", fontWeight: "700", textAlign: "center" }}>
                Products appear when partner stores are live near you.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 8, paddingBottom: 4 }}
              style={{ marginHorizontal: -4 }}
            >
              {bestSelling.map((p, index) => {
                const uri = resolveMediaUrl(p.imageUrl ?? undefined);
                const price = numPrice(p.price);
                const mrp = numPrice(p.mrp);
                const off = pctOff(price, mrp, p.discountPercent);
                const stock = typeof p.stock === "number" ? p.stock : 999;
                const store = p.store;
                const line: CartQtyStepperLine | null =
                  store?.id
                    ? {
                        productId: p.id,
                        storeId: store.id,
                        name: p.name,
                        price,
                        storeName: store.name,
                        imageUrl: p.imageUrl ?? null,
                        unitLabel: p.unitLabel ?? null,
                        mrp: mrp > price ? mrp : undefined,
                        discountPercent: off > 0 ? off : undefined,
                      }
                    : null;
                const heartOn = favorites[p.id];
                const ribbon = index % 4 === 0 ? "Bestseller" : index % 4 === 1 ? "Popular" : off > 0 ? `${off}% off` : null;

                return (
                  <View
                    key={p.id}
                    style={{
                      width: productCardW,
                      backgroundColor: "#fff",
                      borderRadius: 20,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#eef2f6",
                      ...softLift,
                    }}
                  >
                    <Pressable onPress={() => router.push(`/product/${p.id}` as Href)}>
                      <View style={{ height: 128, backgroundColor: "#fff", position: "relative", overflow: "hidden" }}>
                        {uri ? (
                          <Image
                            source={{ uri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                            contentPosition="center"
                          />
                        ) : (
                          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                            <MaterialCommunityIcons name="package-variant" size={36} color="#cbd5e1" />
                          </View>
                        )}
                        {ribbon ? (
                          <View
                            style={{
                              position: "absolute",
                              left: 8,
                              top: 8,
                              backgroundColor: DEEP_GREEN,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{ribbon}</Text>
                          </View>
                        ) : null}
                        <Pressable
                          onPress={() => setFavorites((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                          style={{
                            position: "absolute",
                            right: 8,
                            top: 8,
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: "#fff",
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: "#f1f5f9",
                          }}
                        >
                          <MaterialCommunityIcons
                            name={heartOn ? "heart" : "heart-outline"}
                            size={17}
                            color={heartOn ? "#e11d48" : "#94a3b8"}
                          />
                        </Pressable>
                      </View>
                    </Pressable>
                    <View style={{ padding: 12 }}>
                      <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: "800", color: "#0f172a", lineHeight: 17, minHeight: 34 }}>
                        {p.name}
                      </Text>
                      {p.unitLabel ? (
                        <Text numberOfLines={1} style={{ fontSize: 10, color: "#64748b", fontWeight: "600", marginTop: 3 }}>
                          {p.unitLabel}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                        <Text style={{ fontSize: 17, fontWeight: "900", color: DEEP_GREEN }}>₹{Math.round(price)}</Text>
                        {mrp > price ? (
                          <Text style={{ fontSize: 11, color: "#94a3b8", textDecorationLine: "line-through", fontWeight: "700" }}>
                            ₹{Math.round(mrp)}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ marginTop: 10 }}>
                        {line ? (
                          <CartQtyStepper
                            line={line}
                            maxQty={stock}
                            canAdd={stock > 0}
                            addLabel="Add"
                            addBgColor={DEEP_GREEN}
                            addBorderColor={DEEP_GREEN}
                            compact
                          />
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
