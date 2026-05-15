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
import { cartTotalQty, getCart, subscribeCart } from "@/lib/cart";

const CANVAS = "#f4f6f8";
const NAVY = "#1b2847";

/** Local dairy banners (`speedza/assets/`) */
const DAIRY_BANNER_LOCAL = {
  hero: require("../assets/dairybg1.png"),
  promo: require("../assets/dairybg2.png"),
} as const;

export type DairyCatalogChip = {
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
  store?: { id: string; name: string; distanceKm?: number; etaMin?: number };
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

const cardShadow =
  Platform.OS === "ios"
    ? {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : { elevation: 3 };

type Props = {
  bottomInset: number;
  slug: string;
  catalogKey: string;
  lat: number;
  lng: number;
  chips: DairyCatalogChip[];
};

export function DairyCategoryStorefront(props: Props) {
  const { bottomInset, slug, catalogKey, lat, lng, chips } = props;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pad = 16;
  const gap = 10;
  const colW = (width - pad * 2 - gap) / 2;

  const [activeChipId, setActiveChipId] = useState<string>("all");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartQty, setCartQty] = useState(0);
  const [cartRupee, setCartRupee] = useState(0);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const syncMoney = useCallback(async () => {
    const cart = await getCart();
    setCartQty(cartTotalQty(cart));
    const sum = cart.reduce((s, l) => s + l.price * l.quantity, 0);
    setCartRupee(Math.round(sum));
  }, []);

  useEffect(() => {
    void syncMoney();
    return subscribeCart(() => void syncMoney());
  }, [syncMoney]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        vertical: catalogKey,
        lat: String(lat),
        lng: String(lng),
        limit: "48",
      });
      if (activeChipId !== "all") {
        qs.set("masterCategoryId", activeChipId);
      }
      const res = await api<{ products: ApiProduct[] }>(`/api/shop/category-quick?${qs.toString()}`);
      if (res.ok && res.data?.products) {
        const list = res.data.products.filter((p) =>
          typeof p.stock === "number" ? p.stock > 0 : true,
        );
        setProducts(list);
      } else setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeChipId, catalogKey, lat, lng]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const ribbonForIndex = useMemo(() => {
    const styles = ["Bestseller", "Popular", "Fresh", "Deal"] as const;
    return (i: number) => styles[i % styles.length];
  }, []);

  const chipRow = useMemo(() => [{ id: "all", name: "All", thumb: null }, ...chips], [chips]);

  const firstThumb = useCallback(async () => {
    const c = await getCart();
    const u = c[0]?.imageUrl;
    return u ? resolveMediaUrl(u ?? undefined) : undefined;
  }, []);

  const [barThumb, setBarThumb] = useState<string | undefined>();
  useEffect(() => {
    void (async () => setBarThumb(await firstThumb()))();
  }, [cartQty, firstThumb]);

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: bottomInset + (cartQty > 0 ? 104 : 24),
          paddingHorizontal: pad,
        }}
      >
        {/* Hero — full width + anchor left so `cover` does not crop the artwork on the left */}
        <View style={{ marginHorizontal: -pad, marginBottom: 16, width, alignSelf: "center" }}>
          <View
            style={{
              borderRadius: 22,
              overflow: "hidden",
              ...cardShadow,
              width: "100%",
              aspectRatio: 2,
            }}
          >
            <Image
              source={DAIRY_BANNER_LOCAL.hero}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              contentPosition="left center"
            />
          </View>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: pad, paddingBottom: 14 }}
          style={{ marginHorizontal: -pad, paddingHorizontal: pad }}
        >
          {chipRow.map((c) => {
            const active = activeChipId === c.id;
            const uri = (c.thumb && resolveMediaUrl(c.thumb)) || undefined;
            return (
              <Pressable key={c.id} onPress={() => setActiveChipId(c.id)} style={{ alignItems: "center", width: 84 }}>
                <View
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: 14,
                    backgroundColor: "#fff",
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? "#22c55e" : "#e2e8f0",
                    overflow: "hidden",
                    ...cardShadow,
                  }}
                >
                  {uri ? (
                    <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
                      <MaterialCommunityIcons name="cup-water" size={32} color="#94a3b8" />
                    </View>
                  )}
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 8,
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: active ? "900" : "700",
                    color: active ? "#15803d" : "#475569",
                  }}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Promo strip — full-bleed `dairybg2` + purple tint */}
        <View
          style={{
            borderRadius: 18,
            marginBottom: 14,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#d8b4fe",
            position: "relative",
            minHeight: 128,
          }}
        >
          <Image
            source={DAIRY_BANNER_LOCAL.promo}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, minHeight: 128 }}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(243,232,255,0.92)", "rgba(233,213,255,0.78)", "rgba(221,214,254,0.62)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, minHeight: 128 }}
          />
          <View
            style={{
              paddingVertical: 16,
              paddingHorizontal: 14,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              zIndex: 1,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#5b21b6", letterSpacing: -0.5 }}>Flat 5% OFF</Text>
              <Text style={{ color: "#6b21a8", fontWeight: "700", fontSize: 13, marginTop: 6 }}>on orders above ₹199</Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: "#7c3aed",
                  borderStyle: "dashed",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.6)",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#5b21b6", fontSize: 12 }}>Use code: DAIRY5</Text>
              </View>
            </View>
            <View style={{ flexShrink: 0, alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#7c3aed", textAlign: "right", maxWidth: 120 }}>
                Stock up on your daily essentials
              </Text>
              <Pressable
                style={{
                  marginTop: 10,
                  backgroundColor: "#7c3aed",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>Order Now</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Filter strip */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#fff",
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: "#eef2f6",
            ...cardShadow,
          }}
        >
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialCommunityIcons name="tune-variant" size={18} color="#475569" />
            <Text style={{ fontWeight: "800", color: "#334155", fontSize: 13 }}>Filters</Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialCommunityIcons name="lightning-bolt" size={18} color="#16a34a" />
            <Text style={{ fontWeight: "800", color: "#15803d", fontSize: 12 }}>10 Mins Delivery</Text>
          </View>
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MaterialCommunityIcons name="swap-vertical" size={18} color="#475569" />
            <Text style={{ fontWeight: "800", color: "#334155", fontSize: 13 }}>Sort By</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#64748b" />
          </Pressable>
        </View>

        {/* Grid */}
        {loading && products.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={{ marginTop: 12, color: "#64748b", fontWeight: "700" }}>Fresh stock loading...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {products.map((p, index) => {
              const uri = resolveMediaUrl(p.imageUrl ?? undefined);
              const price = numPrice(p.price);
              const mrp = numPrice(p.mrp);
              const pct = pctOff(price, mrp, p.discountPercent);
              const stock = typeof p.stock === "number" ? p.stock : 999;
              const inStock = stock > 0;
              const store = p.store;
              const line: CartQtyStepperLine | null =
                store && store.id
                  ? {
                      productId: p.id,
                      storeId: store.id,
                      name: p.name,
                      price,
                      storeName: store.name,
                      imageUrl: p.imageUrl ?? null,
                      unitLabel: p.unitLabel ?? null,
                      mrp: mrp > price ? mrp : undefined,
                      discountPercent: pct > 0 ? pct : undefined,
                    }
                  : null;
              const ribbon = ribbonForIndex(index);
              const heartOn = favorites[p.id];

              return (
                <View
                  key={p.id}
                  style={{
                    width: colW,
                    borderRadius: 16,
                    backgroundColor: "#fff",
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "#eef2f6",
                    ...cardShadow,
                  }}
                >
                  <Pressable onPress={() => router.push(`/product/${p.id}` as Href)} style={{ position: "relative" }}>
                    <View style={{ aspectRatio: 1, backgroundColor: "#fff", overflow: "hidden" }}>
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                          contentPosition="center"
                        />
                      ) : (
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <MaterialCommunityIcons name="bottle-tonic-outline" size={44} color="#cbd5e1" />
                        </View>
                      )}
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: ribbon === "Bestseller" ? "#22c55e" : ribbon === "Popular" ? "#3b82f6" : "#0ea5e9",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{ribbon.toUpperCase()}</Text>
                    </View>
                    <Pressable
                      onPress={() => setFavorites((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: 6,
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: "rgba(255,255,255,0.95)",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "#e2e8f0",
                      }}
                    >
                      <MaterialCommunityIcons name={heartOn ? "heart" : "heart-outline"} size={18} color={heartOn ? "#e11d48" : "#64748b"} />
                    </Pressable>
                  </Pressable>

                  <View style={{ padding: 12, paddingBottom: 10 }}>
                    <Text numberOfLines={2} style={{ fontWeight: "900", fontSize: 14, color: NAVY }}>
                      {p.name}
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 12, fontWeight: "600", color: "#64748b" }}>
                      {inferDetailLine(p.name, p.unitLabel)}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        marginTop: 12,
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          <Text style={{ fontSize: 17, fontWeight: "900", color: NAVY }}>₹{Math.round(price)}</Text>
                          {mrp > price ? (
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: "#94a3b8",
                                textDecorationLine: "line-through",
                              }}
                            >
                              ₹{Math.round(mrp)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={{ width: 44, flexShrink: 0 }}>
                        {line ? (
                          <CartQtyStepper
                            dense
                            line={line}
                            addLabel="+"
                            maxQty={stock}
                            canAdd={inStock}
                            addBgColor="#22c55e"
                            addBorderColor="#15803d"
                          />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 38,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: "#e2e8f0",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#f8fafc",
                            }}
                          >
                            <MaterialCommunityIcons name="store-off-outline" size={18} color="#94a3b8" />
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && products.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#64748b", fontWeight: "700", paddingVertical: 24 }}>
            No dairy items in range for this filter. Try “All”.
          </Text>
        ) : null}
      </ScrollView>

      {/* Blinkit-like bottom dock */}
      {cartQty > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            bottom: Math.max(bottomInset, 12),
          }}
        >
          <LinearGradient colors={["#1b2847", "#0f172a"]} style={{ borderRadius: 999, overflow: "hidden", ...dockShadow }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#16a34a",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              >
                {barThumb ? (
                  <Image source={{ uri: barThumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <MaterialCommunityIcons name="motorbike" size={26} color="#fff" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>Delivery in 10 mins</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 12 }}>
                    Home – {slug.slice(0, 8).toUpperCase() || "560001"}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
                </View>
              </View>
              <Pressable onPress={() => router.push("/cart" as Href)} style={{ flexShrink: 0 }}>
                <LinearGradient
                  colors={["#22c55e", "#16a34a"]}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                      View cart · {cartQty} items
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.95)", fontWeight: "900", fontSize: 12, marginTop: 2 }}>
                      ₹{cartRupee}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      ) : null}
    </View>
  );
}

const dockShadow =
  Platform.OS === "ios"
    ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      }
    : { elevation: 12 };

function inferDetailLine(name: string, unit?: string | null): string {
  const n = name.toLowerCase();
  let kind = "";
  if (n.includes("paneer")) kind = "Paneer";
  else if (n.includes("dahi") || n.includes("curd") || n.includes("yogurt")) kind = "Curd & Yogurt";
  else if (n.includes("cheese")) kind = "Cheese";
  else if (n.includes("butter") || n.includes("ghee")) kind = "Butter & Ghee";
  else if (n.includes("milk") || n.includes("taaza") || n.includes("toned")) kind = "Toned Milk";
  const tail = unit?.trim() || "";
  if (kind && tail) return `${kind} · ${tail}`;
  if (tail) return tail;
  return kind || "Premium dairy";
}
