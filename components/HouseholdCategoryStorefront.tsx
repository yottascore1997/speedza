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

const CANVAS = "#f5f3ff";
const DEEP_PURPLE = "#4c1d95";
const MID_PURPLE = "#7c3aed";
const HERO_IMG = require("../assets/homebg.png");
const CATEGORY_COLS = 3;
const PROMO_H = 96;

const lift =
  Platform.OS === "ios"
    ? {
        shadowColor: "#2e1065",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      }
    : { elevation: 6 };

const softLift =
  Platform.OS === "ios"
    ? {
        shadowColor: "#5b21b6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      }
    : { elevation: 3 };

export type HouseholdChip = {
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
  chips: HouseholdChip[];
  onOpenSub: (chip: HouseholdChip) => void;
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

export function HouseholdCategoryStorefront(props: Props) {
  const { bottomInset, categoryTitle, catalogKey, lat, lng, chips, onOpenSub } = props;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pad = 16;
  const cardPad = 16;
  const gap = 8;
  const heroW = width;
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
        new Set([catalogKey, "household", "house-hold", "cleaning", "home-care"].filter(Boolean)),
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
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 16,
              marginBottom: 18,
              borderWidth: 1,
              borderColor: "rgba(124,58,237,0.1)",
              ...softLift,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: MID_PURPLE, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }}>CATEGORIES</Text>
                <Text style={{ color: DEEP_PURPLE, fontSize: 20, fontWeight: "900", marginTop: 4, letterSpacing: -0.4 }}>
                  Shop by room
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
                  backgroundColor: "#ede9fe",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="home-variant-outline" size={24} color={MID_PURPLE} />
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
                      ? ["#ede9fe", "#ddd6fe"]
                      : index % 3 === 1
                        ? ["#fae8ff", "#f5d0fe"]
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
                            <MaterialCommunityIcons name="spray-bottle" size={28} color="#a78bfa" />
                          )}
                        </View>
                        <Text
                          numberOfLines={2}
                          style={{
                            marginTop: 8,
                            fontSize: 11,
                            fontWeight: "900",
                            color: DEEP_PURPLE,
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

          <View style={{ flexDirection: "row", gap, marginBottom: 18 }}>
            <LinearGradient
              colors={["#2e1065", "#7c3aed"]}
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
              <Text style={{ color: "#ddd6fe", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>HOME DEAL</Text>
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", marginTop: 4, lineHeight: 20 }}>Flat 20% Off</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", marginTop: 2 }}>Code HOME20</Text>
              <Image
                source={require("../assets/discount.png")}
                style={{ position: "absolute", right: -6, bottom: -8, width: 58, height: 58, opacity: 0.95 }}
                contentFit="contain"
              />
            </LinearGradient>

            <LinearGradient
              colors={["#ede9fe", "#c4b5fd", "#a78bfa"]}
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
              <Text style={{ color: "#5b21b6", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>BULK SAVE</Text>
              <Text style={{ color: DEEP_PURPLE, fontSize: 14, fontWeight: "900", marginTop: 4, lineHeight: 18 }}>
                Orders above ₹499
              </Text>
              <Image
                source={require("../assets/household.png")}
                style={{ position: "absolute", right: 4, bottom: 4, width: 52, height: 52, opacity: 0.92 }}
                contentFit="contain"
              />
            </LinearGradient>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            style={{ marginBottom: 20, marginHorizontal: -4 }}
          >
            {[
              { icon: "spray-bottle" as const, label: "Top brands" },
              { icon: "home-heart" as const, label: "Home essentials" },
              { icon: "truck-fast-outline" as const, label: "Fast delivery" },
              { icon: "shield-check-outline" as const, label: "100% genuine" },
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
                  borderColor: "#e9d5ff",
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "#ede9fe",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name={item.icon} size={16} color={MID_PURPLE} />
                </View>
                <Text style={{ color: DEEP_PURPLE, fontSize: 12, fontWeight: "800" }}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View>
              <Text style={{ color: MID_PURPLE, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>TOP PICKS</Text>
              <Text style={{ color: DEEP_PURPLE, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 }}>Best selling</Text>
              <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "600", marginTop: 3 }}>
                From {categoryTitle} near you
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/search" as Href)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "#ede9fe",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: MID_PURPLE, fontSize: 12, fontWeight: "900" }}>See all</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={MID_PURPLE} />
            </Pressable>
          </View>

          {loading && bestSelling.length === 0 ? (
            <ActivityIndicator size="large" color={MID_PURPLE} style={{ marginVertical: 32 }} />
          ) : bestSelling.length === 0 ? (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 20,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#e9d5ff",
              }}
            >
              <MaterialCommunityIcons name="store-outline" size={40} color="#c4b5fd" />
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
                      borderColor: "#ede9fe",
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
                            <MaterialCommunityIcons name="spray-bottle" size={36} color="#c4b5fd" />
                          </View>
                        )}
                        {ribbon ? (
                          <View
                            style={{
                              position: "absolute",
                              left: 8,
                              top: 8,
                              backgroundColor: DEEP_PURPLE,
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
                            borderColor: "#f3e8ff",
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
                        <Text style={{ fontSize: 17, fontWeight: "900", color: DEEP_PURPLE }}>₹{Math.round(price)}</Text>
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
                            addBgColor={DEEP_PURPLE}
                            addBorderColor={DEEP_PURPLE}
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
