import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  StyleSheet,
  useWindowDimensions,
  Share,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { premiumAlert } from "@/lib/premiumAlert";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { cartTotalQty, getCart, subscribeCart } from "@/lib/cart";
import { CartQtyStepper } from "@/components/CartQtyStepper";

type Product = {
  id: string;
  name: string;
  description: string;
  price: unknown;
  mrp?: unknown;
  discountPercent?: number | null;
  stock: number;
  imageUrl?: string | null;
  imageUrl2?: string | null;
  unitLabel?: string | null;
  categoryName: string;
  store: { id: string; name: string; address: string; latitude: number; longitude: number };
};

type StoreProduct = {
  id: string;
  name: string;
  price: number | string;
  mrp?: number | string | null;
  imageUrl?: string | null;
  stock: number;
  unitLabel?: string | null;
};

type StoreCategory = { id: string; name: string; products: StoreProduct[] };

const G = 16;
const PAGE_BG = "#f3f4f6";
const INK = "#0f172a";
const INK_MUTED = "#64748b";
const LINE = "#e2e8f0";
const SURFACE = "#ffffff";
const GREEN = "#1b5e20";
const GREEN_BORDER = "#2e7d32";
const FAB_BG = "rgba(255, 249, 230, 0.92)";
const hairline = StyleSheet.hairlineWidth;

const barLift = Platform.select({
  ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 14 },
  android: { elevation: 12 },
  default: {},
});

function numPrice(p: unknown): number {
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string") {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  return Number(p) || 0;
}

function fmtRupee(n: number) {
  return `₹${Math.round(n * 100) / 100}`;
}

function descSnippet(text: string, max = 72) {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function sameStoreCategoryName(catalogName: string, productCategory: string): boolean {
  const a = catalogName.trim().toLowerCase().replace(/\s+/g, " ");
  const b = productCategory.trim().toLowerCase().replace(/\s+/g, " ");
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

function CategoryGridTile({
  item,
  storeId,
  storeName,
  colW,
  onOpen,
  wishlisted,
  onToggleWishlist,
}: {
  item: StoreProduct;
  storeId: string;
  storeName: string;
  colW: number;
  onOpen: (id: string) => void;
  wishlisted: boolean;
  onToggleWishlist: (id: string) => void;
}) {
  const itemPrice = numPrice(item.price);
  const itemMrp = numPrice(item.mrp);
  const itemImg = resolveMediaUrl(item.imageUrl ?? undefined);
  const low = item.stock > 0 && item.stock <= 3;

  return (
    <View style={{ width: colW }}>
      <View style={{ position: "relative" }}>
        <Pressable onPress={() => onOpen(item.id)}>
          <View
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#f8fafc",
            }}
          >
            {itemImg ? (
              <Image source={{ uri: itemImg }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: colW }}>
                <MaterialCommunityIcons name="image-outline" size={28} color="#cbd5e1" />
              </View>
            )}
          </View>
        </Pressable>
        <Pressable
          onPress={() => onToggleWishlist(item.id)}
          hitSlop={10}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: "rgba(255,255,255,0.95)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.06)",
          }}
        >
          <MaterialCommunityIcons name={wishlisted ? "heart" : "heart-outline"} size={18} color={wishlisted ? "#e11d48" : "#64748b"} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 8 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: "#f1f5f9",
            borderWidth: 1,
            borderColor: "#e2e8f0",
            flex: 1,
            minWidth: 0,
            maxWidth: colW * 0.52,
          }}
        >
          <Text numberOfLines={1} style={{ color: INK_MUTED, fontWeight: "800", fontSize: 10 }}>
            {item.unitLabel?.trim() || "1 pc"}
          </Text>
        </View>
        <View
          style={{
            width: Math.max(56, Math.min(82, Math.round(colW * 0.44))),
            flexShrink: 0,
          }}
        >
          <CartQtyStepper
            dense
            compact
            addOutline
            addLabel="ADD"
            addBgColor={GREEN}
            addBorderColor={GREEN_BORDER}
            line={{
              productId: item.id,
              storeId,
              name: item.name,
              price: itemPrice,
              storeName,
              imageUrl: item.imageUrl ?? null,
              unitLabel: item.unitLabel ?? null,
              mrp: itemMrp > itemPrice ? itemMrp : undefined,
            }}
            maxQty={item.stock}
            canAdd={item.stock > 0}
          />
        </View>
      </View>

      <Pressable onPress={() => onOpen(item.id)} style={{ marginTop: 8 }}>
        <Text style={{ color: INK, fontWeight: "900", fontSize: 14 }}>
          {fmtRupee(itemPrice)}
          {itemMrp > itemPrice ? (
            <Text style={{ color: "#94a3b8", fontWeight: "700", fontSize: 12, textDecorationLine: "line-through" }}>
              {" "}
              {fmtRupee(itemMrp)}
            </Text>
          ) : null}
        </Text>
        <Text numberOfLines={2} style={{ color: INK, fontWeight: "700", fontSize: 12, lineHeight: 16, marginTop: 4 }}>
          {item.name}
        </Text>
      </Pressable>

      {low ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
          <MaterialCommunityIcons name="battery-charging-10" size={14} color="#dc2626" />
          <Text style={{ color: "#b91c1c", fontWeight: "800", fontSize: 10 }}>{item.stock} left</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [p, setP] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [sameCategoryProducts, setSameCategoryProducts] = useState<StoreProduct[]>([]);
  const [cartQty, setCartQty] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() => new Set());
  const heroScrollRef = useRef<ScrollView>(null);

  const gridGap = 10;
  const colW = (width - G * 2 - gridGap) / 2;
  const heroH = Math.min(Math.round(width * 0.92), Math.round(height * 0.42));
  const footerReserve = 58;

  const syncCartQty = useCallback(async () => {
    const lines = await getCart();
    setCartQty(cartTotalQty(lines));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api<{ product: Product }>(`/api/shop/product/${encodeURIComponent(id)}`);
      if (!res.ok || !res.data?.product) {
        premiumAlert("Error", res.error || "Could not load product");
        setP(null);
        return;
      }
      const next = res.data.product;
      setP(next);
      setHeroIndex(0);
      heroScrollRef.current?.scrollTo({ x: 0, animated: false });

      const relatedRes = await api<{ store: { categories: StoreCategory[] } }>(`/api/stores/${next.store.id}`);
      if (relatedRes.ok && relatedRes.data?.store) {
        const cat = (next.categoryName ?? "").trim();
        const fromSame = relatedRes.data.store.categories
          .filter((c) => sameStoreCategoryName(c.name, cat))
          .flatMap((c) => c.products)
          .filter((item) => item.id !== next.id && item.stock > 0);
        setSameCategoryProducts(fromSame.slice(0, 24));
      } else {
        setSameCategoryProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void syncCartQty();
      return subscribeCart(() => {
        void syncCartQty();
      });
    }, [load, syncCartQty]),
  );

  const openProduct = useCallback(
    (pid: string) => {
      router.push(`/product/${pid}` as Href);
    },
    [router],
  );

  const heroUris = useMemo(() => {
    if (!p) return [];
    const a = resolveMediaUrl(p.imageUrl ?? undefined);
    const b = resolveMediaUrl(p.imageUrl2 ?? undefined);
    const list: string[] = [];
    if (a) list.push(a);
    if (b && b !== a) list.push(b);
    return list;
  }, [p]);

  const gridProducts = useMemo(() => {
    const seen = new Set<string>();
    const out: StoreProduct[] = [];
    for (const x of sameCategoryProducts) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
      if (out.length >= 12) break;
    }
    return out;
  }, [sameCategoryProducts]);

  const onHeroScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / Math.max(1, width));
    setHeroIndex(Math.max(0, Math.min(idx, Math.max(0, heroUris.length - 1))));
  }, [width, heroUris.length]);

  const toggleWishlist = useCallback((pid: string) => {
    setWishlistIds((prev) => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
  }, []);

  const shareProduct = useCallback(async () => {
    if (!p) return;
    try {
      await Share.share({ message: `${p.name} — ${fmtRupee(numPrice(p.price))}\n`, title: p.name });
    } catch {
      /* ignore */
    }
  }, [p]);

  if (loading && !p) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: PAGE_BG }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 12, color: INK_MUTED, fontWeight: "600", fontSize: 14 }}>Loading…</Text>
      </View>
    );
  }

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: PAGE_BG, paddingTop: insets.top + G, paddingHorizontal: G }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as Href))}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            alignSelf: "flex-start",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: SURFACE,
            borderWidth: hairline,
            borderColor: LINE,
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={INK} />
          <Text style={{ color: INK, fontWeight: "700", fontSize: 15 }}>Back</Text>
        </Pressable>
        <Text style={{ marginTop: 24, color: INK_MUTED, fontWeight: "600", fontSize: 15 }}>Product not available.</Text>
      </View>
    );
  }

  const price = numPrice(p.price);
  const mrp = numPrice(p.mrp);
  const offPct =
    typeof p.discountPercent === "number" && p.discountPercent > 0
      ? Math.round(p.discountPercent)
      : mrp > price && mrp > 0
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;
  const unitLine = p.unitLabel?.trim() || "1 pc";
  const descTrim = p.description?.trim() ?? "";
  const cartLine = {
    productId: p.id,
    storeId: p.store.id,
    name: p.name,
    price,
    storeName: p.store.name,
    imageUrl: p.imageUrl ?? p.imageUrl2 ?? null,
    unitLabel: p.unitLabel ?? null,
    mrp: mrp > price ? mrp : undefined,
    discountPercent: typeof p.discountPercent === "number" && p.discountPercent > 0 ? p.discountPercent : undefined,
  };

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: footerReserve + 24,
        }}
      >
        <View style={{ width, height: heroH, backgroundColor: "#e8ecf0" }}>
          {heroUris.length > 0 ? (
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onHeroScroll}
              scrollEventThrottle={16}
              decelerationRate="fast"
              bounces={false}
            >
              {heroUris.map((uri) => (
                <View key={uri} style={{ width, height: heroH }}>
                  <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="image-outline" size={56} color="#94a3b8" />
            </View>
          )}

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              paddingTop: insets.top + 6,
              paddingHorizontal: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as Href))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: FAB_BG,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color={INK} />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => toggleWishlist(p.id)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: FAB_BG,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              >
                <MaterialCommunityIcons name={wishlistIds.has(p.id) ? "heart" : "heart-outline"} size={20} color={wishlistIds.has(p.id) ? "#e11d48" : INK} />
              </Pressable>
              <Pressable
                onPress={() => {
                  const raw = p.name.trim();
                  const q = raw.length >= 2 ? raw.slice(0, 40) : "care";
                  router.push({ pathname: "/search", params: { q } } as Href);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: FAB_BG,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              >
                <MaterialCommunityIcons name="magnify" size={22} color={INK} />
              </Pressable>
              <Pressable
                onPress={() => void shareProduct()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: FAB_BG,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              >
                <MaterialCommunityIcons name="share-variant-outline" size={20} color={INK} />
              </Pressable>
            </View>
          </View>

          {heroUris.length > 1 ? (
            <View
              style={{
                position: "absolute",
                bottom: 14,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {heroUris.map((_, i) => (
                <View
                  key={String(i)}
                  style={{
                    width: i === heroIndex ? 8 : 6,
                    height: i === heroIndex ? 8 : 6,
                    borderRadius: 99,
                    backgroundColor: i === heroIndex ? "#2563eb" : "rgba(255,255,255,0.75)",
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: G, paddingTop: 14, gap: 12 }}>
          {descTrim ? (
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 16,
                borderWidth: hairline,
                borderColor: LINE,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: INK_MUTED, fontWeight: "800", fontSize: 12 }}>Description</Text>
                  <Text
                    numberOfLines={descExpanded ? undefined : 3}
                    style={{ color: INK, fontWeight: "600", fontSize: 13, lineHeight: 19, marginTop: 6 }}
                  >
                    {descExpanded ? descTrim : descSnippet(descTrim, 140)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDescExpanded((v) => !v)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: "#ecfdf5",
                    borderWidth: 1,
                    borderColor: "#bbf7d0",
                  }}
                >
                  <Text style={{ color: GREEN, fontWeight: "900", fontSize: 11 }}>{descExpanded ? "Hide" : "View details"}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 18,
              borderWidth: hairline,
              borderColor: LINE,
              padding: 16,
            }}
          >
            <Text style={{ color: INK, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, lineHeight: 28 }}>{p.name}</Text>
            <Text style={{ color: INK_MUTED, fontWeight: "700", fontSize: 14, marginTop: 8 }}>{unitLine}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <Text style={{ color: INK, fontSize: 26, fontWeight: "900" }}>{fmtRupee(price)}</Text>
              {mrp > price ? (
                <Text style={{ color: "#94a3b8", fontSize: 16, fontWeight: "700", textDecorationLine: "line-through" }}>
                  {fmtRupee(mrp)}
                </Text>
              ) : null}
              {offPct > 0 ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#ecfdf5" }}>
                  <Text style={{ color: GREEN, fontWeight: "900", fontSize: 11 }}>{offPct}% OFF</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: INK_MUTED, fontSize: 11, fontWeight: "600", marginTop: 10 }}>
              {p.stock > 0 ? (
                <Text>
                  <Text style={{ color: "#166534", fontWeight: "800" }}>In stock</Text>
                  {p.stock <= 5 ? ` · Only ${p.stock} left` : null}
                </Text>
              ) : (
                <Text style={{ color: "#be123c", fontWeight: "800" }}>Out of stock</Text>
              )}
            </Text>
          </View>

          {gridProducts.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: gridGap }}>
                {gridProducts.map((item) => (
                  <CategoryGridTile
                    key={item.id}
                    item={item}
                    storeId={p.store.id}
                    storeName={p.store.name}
                    colW={colW}
                    onOpen={openProduct}
                    wishlisted={wishlistIds.has(item.id)}
                    onToggleWishlist={toggleWishlist}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: SURFACE,
          borderTopWidth: hairline,
          borderTopColor: LINE,
          paddingHorizontal: G,
          paddingTop: 10,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          ...barLift,
        }}
      >
        <Pressable
          onPress={() => router.push("/cart" as Href)}
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            borderWidth: hairline,
            borderColor: LINE,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <MaterialCommunityIcons name="cart-outline" size={22} color={INK} />
          {cartQty > 0 ? (
            <View
              style={{
                position: "absolute",
                right: 2,
                top: 2,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: GREEN,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 3,
                borderWidth: 2,
                borderColor: SURFACE,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 9 }}>{cartQty}</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: INK_MUTED, fontWeight: "800", fontSize: 12 }}>{unitLine}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
            <Text style={{ color: INK, fontWeight: "900", fontSize: 17 }}>{fmtRupee(price)}</Text>
            {mrp > price ? (
              <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "700", textDecorationLine: "line-through" }}>
                MRP {fmtRupee(mrp)}
              </Text>
            ) : null}
          </View>
          <Text style={{ color: INK_MUTED, fontSize: 10, fontWeight: "600", marginTop: 2 }}>Inclusive of all taxes</Text>
        </View>

        <View style={{ width: width * 0.36, minWidth: 128, maxWidth: 200 }}>
          <CartQtyStepper
            compact
            line={cartLine}
            maxQty={p.stock}
            canAdd={p.stock > 0}
            addLabel="Add to cart"
            addBgColor={GREEN}
            addBorderColor="#14532d"
          />
        </View>
      </View>
    </View>
  );
}
