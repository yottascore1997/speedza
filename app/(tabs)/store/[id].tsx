import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Platform,
  useWindowDimensions,
  Animated,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";
import { theme } from "@/lib/theme";
import { cartTotalQty, getCart, subscribeCart, type CartLine } from "@/lib/cart";
import { CartQtyStepper } from "@/components/CartQtyStepper";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  mrp?: number | null;
  discountPercent?: number | null;
  imageUrl?: string | null;
  stock: number;
  categoryId: string;
  unitLabel?: string | null;
  variantOptionsCount?: number;
  priceMax?: number | null;
};

type Category = { id: string; name: string; products: Product[] };

/** Soft lift — premium, not heavy */
const cardLift = Platform.select({
  ios: { shadowColor: "#1c1917", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12 },
  android: { elevation: 2 },
  default: {},
});

const PAGE_BG = "#faf9f7";
const INK = "#1c1917";
const INK_MUTED = "#57534e";
const LINE = "#e7e5e4";
const SURFACE = "#ffffff";

const FILTER_CHIPS: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { label: "Veg", icon: "leaf-circle" },
  { label: "Top rated", icon: "star-circle" },
  { label: "Under ₹99", icon: "tag-heart" },
  { label: "Quick bite", icon: "lightning-bolt" },
];

  function priceNum(p: Product) {
    return typeof p.price === "number" ? p.price : parseFloat(String(p.price)) || 0;
  }

  function mrpNum(p: Product) {
    const v = p.mrp;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

function productMatchesQuery(p: Product, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
    return (
    p.name.toLowerCase().includes(s) ||
    (p.description ?? "").toLowerCase().includes(s) ||
    (p.unitLabel ?? "").toLowerCase().includes(s)
  );
}

function fmtRupee(n: number) {
  return `₹${Math.round(n * 100) / 100}`;
}

function StoreMenuSkeleton() {
  const row = (key: string) => (
    <View
      key={key}
      style={{
        backgroundColor: SURFACE,
        borderRadius: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: LINE,
        padding: 14,
        flexDirection: "row",
        gap: 14,
      }}
    >
      <View style={{ width: 124, height: 124, borderRadius: 16, backgroundColor: "#e7e5e4" }} />
      <View style={{ flex: 1, gap: 10 }}>
        <View style={{ width: "88%", height: 16, borderRadius: 8, backgroundColor: "#e7e5e4" }} />
        <View style={{ width: "55%", height: 14, borderRadius: 8, backgroundColor: "#eceae9" }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, alignItems: "flex-end" }}>
          <View style={{ width: 64, height: 18, borderRadius: 8, backgroundColor: "#e7e5e4" }} />
          <View style={{ width: 72, height: 36, borderRadius: 12, backgroundColor: "#d6d3d1" }} />
        </View>
      </View>
    </View>
  );
  return (
    <View style={{ paddingHorizontal: 10 }}>
      {[1, 2].map((section) => (
        <View key={section} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 }}>
            <View style={{ width: 3, height: 20, borderRadius: 2, marginRight: 10, backgroundColor: "#d6d3d1" }} />
            <View style={{ flex: 1, height: 18, borderRadius: 8, backgroundColor: "#e7e5e4", maxWidth: 180 }} />
            <View style={{ width: 56, height: 12, borderRadius: 6, backgroundColor: "#eceae9" }} />
          </View>
          {row(`sk-${section}-a`)}
          {row(`sk-${section}-b`)}
        </View>
      ))}
      </View>
    );
  }

export default function StoreDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const viewCartBarWidth = Math.min(268, width - 44);
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const latestStoreIdRef = useRef(id);
  latestStoreIdRef.current = id;
  const [name, setName] = useState("");
  const [storeImage, setStoreImage] = useState<string | null>(null);
  const [storeAddress, setStoreAddress] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  /** First paint / new store id — show skeleton instead of blocking full-screen spinner */
  const [booting, setBooting] = useState(true);
  const [dishQuery, setDishQuery] = useState("");
  const skeletonPulse = useRef(new Animated.Value(0.38)).current;
  const [cartQty, setCartQty] = useState(0);
  const [cartFirstLine, setCartFirstLine] = useState<CartLine | null>(null);

  const syncCart = useCallback(() => {
    void getCart().then((lines) => {
      setCartQty(cartTotalQty(lines));
      setCartFirstLine(lines[0] ?? null);
    });
  }, []);

  useEffect(() => {
    setBooting(true);
    setName("");
    setStoreImage(null);
    setStoreAddress("");
    setCategories([]);
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    const storeId = id;
    const res = await api<{
      store: { name: string; categories: Category[]; imageUrl?: string | null; address?: string | null };
    }>(`/api/stores/${storeId}`);
    if (latestStoreIdRef.current !== storeId) return;
    if (res.ok && res.data) {
      setName(res.data.store.name);
      setStoreImage(res.data.store.imageUrl ?? null);
      setStoreAddress(res.data.store.address?.trim() ?? "");
      setCategories(res.data.store.categories);
    } else Alert.alert("Error", res.error || "Failed");
    setBooting(false);
  }, [id]);

  useEffect(() => {
    if (!booting) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, { toValue: 0.72, duration: 700, useNativeDriver: true }),
        Animated.timing(skeletonPulse, { toValue: 0.32, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [booting, skeletonPulse]);

  useFocusEffect(
    useCallback(() => {
      void load();
      syncCart();
    }, [load, syncCart]),
  );

  useEffect(() => {
    syncCart();
    return subscribeCart(syncCart);
  }, [syncCart]);

  const filteredCategories = useMemo(() => {
    return categories
      .map((c) => ({
        ...c,
        products: c.products.filter((p) => productMatchesQuery(p, dishQuery)),
      }))
      .filter((c) => c.products.length > 0);
  }, [categories, dishQuery]);

  const totalItems = useMemo(
    () => categories.reduce((acc, c) => acc + c.products.length, 0),
    [categories],
  );

  const heroUri = storeImage ? resolveMediaUrl(storeImage) ?? undefined : undefined;

  const firstThumbUri = cartFirstLine?.imageUrl ? resolveMediaUrl(cartFirstLine.imageUrl ?? undefined) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: (cartQty > 0 ? 100 : 24) + insets.bottom,
          backgroundColor: PAGE_BG,
        }}
      >
        {/* Immersive hero */}
        <View style={{ height: 256 + insets.top }}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <LinearGradient colors={["#292524", "#44403c", "#57534e"]} style={{ flex: 1 }} />
          )}
          <LinearGradient
            colors={["rgba(28,25,22,0.55)", "rgba(28,25,22,0.08)", "rgba(28,25,22,0.88)"]}
            locations={[0, 0.42, 1]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />

          <View style={{ position: "absolute", left: 0, right: 0, top: insets.top + 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.22)",
              }}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#fafaf9" />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.22)",
                }}
              >
                <MaterialCommunityIcons name="heart-outline" size={21} color="#fafaf9" />
              </Pressable>
                <Pressable
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.22)",
                }}
              >
                <MaterialCommunityIcons name="dots-horizontal" size={21} color="#fafaf9" />
              </Pressable>
            </View>
          </View>

          <View style={{ position: "absolute", left: 18, right: 18, bottom: 20 }}>
            {booting ? (
              <Animated.View style={{ opacity: skeletonPulse }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <View
                    style={{
                      width: 76,
                      height: 22,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.22)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.2)",
                    }}
                  />
                  <View
                    style={{
                      width: 92,
                      height: 22,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.14)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.16)",
                    }}
                  />
                </View>
                <View style={{ width: "78%", height: 28, borderRadius: 10, backgroundColor: "rgba(250,250,249,0.2)", marginBottom: 10 }} />
                <View style={{ width: "52%", height: 28, borderRadius: 10, backgroundColor: "rgba(250,250,249,0.14)" }} />
                <View style={{ flexDirection: "row", marginTop: 12, marginBottom: 14, gap: 10 }}>
                  <View style={{ width: 110, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.16)" }} />
                  <View style={{ width: 96, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.12)" }} />
                </View>
              </Animated.View>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" }}>
                    <Text style={{ color: "#fafaf9", fontWeight: "800", fontSize: 10, letterSpacing: 0.45 }}>CURATED</Text>
                  </View>
                  <View style={{ borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
                    <Text style={{ color: "rgba(250,250,249,0.92)", fontWeight: "800", fontSize: 10 }}>{totalItems} dishes</Text>
                  </View>
                </View>
                <Text style={{ color: "#fafaf9", fontSize: 26, fontWeight: "900", letterSpacing: -0.6, lineHeight: 30 }} numberOfLines={2}>
                  {name}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 10,
                    marginBottom: 14,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MaterialCommunityIcons name="star" size={15} color="#fbbf24" />
                    <Text style={{ color: "#fafaf9", fontWeight: "900", fontSize: 14 }}>4.6</Text>
                    <Text style={{ color: "rgba(250,250,249,0.72)", fontWeight: "700", fontSize: 12 }}>(2.1k+)</Text>
                  </View>
                  <Text style={{ color: "rgba(250,250,249,0.35)", fontWeight: "700" }}>•</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MaterialCommunityIcons name="bike-fast" size={15} color="#a7f3d0" />
                    <Text style={{ color: "rgba(250,250,249,0.95)", fontWeight: "800", fontSize: 13 }}>25–35 min</Text>
                  </View>
                  {storeAddress ? (
                    <>
                      <Text style={{ color: "rgba(250,250,249,0.35)", fontWeight: "700" }}>•</Text>
                      <Text style={{ color: "rgba(250,250,249,0.85)", fontWeight: "700", fontSize: 12, flex: 1 }} numberOfLines={1}>
                        {storeAddress}
                      </Text>
                    </>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Overlap sheet + light body */}
        <View style={{ marginTop: -24, paddingHorizontal: 16 }}>
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 20,
              padding: 14,
              borderWidth: 1,
              borderColor: LINE,
              ...cardLift,
            }}
          >
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#fde68a", backgroundColor: "#fffbeb" }}>
                <Text style={{ color: "#92400e", fontWeight: "800", fontSize: 11, letterSpacing: 0.35 }}>{"Today's hit"}</Text>
                <Text style={{ color: INK, fontWeight: "900", fontSize: 16, marginTop: 4 }}>Flat ₹200 off</Text>
                <Text style={{ color: INK_MUTED, fontWeight: "700", fontSize: 12, marginTop: 3 }}>On orders above ₹499</Text>
              </View>
              <View style={{ width: 100, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", justifyContent: "center", alignItems: "center" }}>
                <MaterialCommunityIcons name="truck-fast-outline" size={26} color="#15803d" />
                <Text style={{ color: "#166534", fontWeight: "900", fontSize: 10, marginTop: 6, textAlign: "center" }}>FREE DELIVERY</Text>
              </View>
            </View>
          </View>

          {/* Search */}
          <View style={{ marginTop: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: SURFACE,
                borderRadius: 14,
                paddingHorizontal: 14,
                minHeight: 50,
                borderWidth: 1,
                borderColor: LINE,
                ...cardLift,
              }}
            >
              <MaterialCommunityIcons name="magnify" size={22} color="#78716c" />
              <TextInput
                value={dishQuery}
                onChangeText={setDishQuery}
                editable={!booting}
                placeholder="Search dishes, cravings…"
                placeholderTextColor="#a8a29e"
                style={{ flex: 1, marginLeft: 10, color: INK, fontSize: 15, fontWeight: "600", paddingVertical: 12 }}
              />
              <Pressable
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#f5f5f4",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: LINE,
                }}
              >
                <MaterialCommunityIcons name="microphone-outline" size={20} color="#57534e" />
              </Pressable>
            </View>
          </View>

          {/* Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pointerEvents={booting ? "none" : "auto"}
            style={{ opacity: booting ? 0.45 : 1 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 12, paddingRight: 4 }}
          >
            {FILTER_CHIPS.map((chip) => (
              <Pressable
                key={chip.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 13,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: SURFACE,
                  borderWidth: 1,
                  borderColor: LINE,
                }}
              >
                <MaterialCommunityIcons name={chip.icon} size={17} color="#57534e" />
                <Text style={{ color: INK, fontWeight: "800", fontSize: 12 }}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Menu canvas */}
          <View style={{ backgroundColor: "#f5f5f4", borderRadius: 20, paddingTop: 2, paddingBottom: 10, marginBottom: 8, borderWidth: 1, borderColor: LINE }}>
            <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: "#78716c", fontWeight: "800", fontSize: 10, letterSpacing: 1.1 }}>MENU</Text>
                  <Text style={{ color: INK, fontWeight: "900", fontSize: 20, marginTop: 3, letterSpacing: -0.35 }}>Signature picks</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: SURFACE, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: LINE }}>
                  <MaterialCommunityIcons name="fire" size={16} color="#ea580c" />
                  <Text style={{ color: INK, fontWeight: "900", fontSize: 11 }}>Hot</Text>
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: 10 }}>
              {booting ? (
                <Animated.View style={{ opacity: skeletonPulse }}>
                  <StoreMenuSkeleton />
                </Animated.View>
              ) : filteredCategories.length === 0 ? (
                <View style={{ padding: 28, alignItems: "center" }}>
                  <MaterialCommunityIcons name="food-off" size={40} color="#a8a29e" />
                  <Text style={{ marginTop: 12, color: INK_MUTED, fontWeight: "800", textAlign: "center" }}>
                    {dishQuery.trim() ? "No dishes match your search." : "No dishes in this store yet."}
                  </Text>
                </View>
              ) : (
                filteredCategories.map((c) => (
                  <View key={c.id} style={{ marginBottom: 18 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 }}>
                      <View style={{ width: 3, height: 20, borderRadius: 2, marginRight: 10, backgroundColor: "#15803d" }} />
                      <Text style={{ flex: 1, fontSize: 17, fontWeight: "900", color: INK, letterSpacing: -0.25 }}>{c.name}</Text>
                      <Text style={{ color: "#78716c", fontWeight: "800", fontSize: 11 }}>{c.products.length} items</Text>
                    </View>
                    {c.products.map((p) => {
                      const img = resolveMediaUrl(p.imageUrl ?? undefined);
                      const price = priceNum(p);
                      const mrp = mrpNum(p);
                      const disc =
                        typeof p.discountPercent === "number" && p.discountPercent > 0
                          ? Math.round(p.discountPercent)
                          : mrp > price && mrp > 0
                            ? Math.round(((mrp - price) / mrp) * 100)
                            : 0;
                      const inStock = p.stock > 0;
                      const desc = (p.description ?? "").trim();
                      return (
                        <View
                          key={p.id}
                          style={{
                            backgroundColor: SURFACE,
                            borderRadius: 18,
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: LINE,
                            overflow: "hidden",
                            ...cardLift,
                          }}
                        >
                          <View style={{ flexDirection: "row", padding: 14, gap: 14 }}>
                            <Pressable onPress={() => router.push(`/product/${p.id}`)} style={{ width: 124 }}>
                              <View
                                style={{
                                  width: 124,
                                  height: 124,
                                  borderRadius: 16,
                                  overflow: "hidden",
                                  backgroundColor: "#f5f5f4",
                                  borderWidth: 1,
                                  borderColor: "#e7e5e4",
                                  opacity: inStock ? 1 : 0.88,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                                ) : (
                                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                    <MaterialCommunityIcons name="silverware-fork-knife" size={30} color="#d6d3d1" />
                                  </View>
                                )}
                                {disc > 0 ? (
                                  <View
                                    style={{
                                      position: "absolute",
                                      top: 6,
                                      right: 6,
                                      backgroundColor: "rgba(28,25,22,0.88)",
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                      borderRadius: 8,
                                    }}
                                  >
                                    <Text style={{ color: "#fef3c7", fontWeight: "900", fontSize: 10, letterSpacing: 0.2 }}>{disc}% OFF</Text>
                                  </View>
                    ) : null}
                  </View>
                            </Pressable>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Pressable onPress={() => router.push(`/product/${p.id}`)}>
                                <Text style={{ fontWeight: "900", color: INK, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 }} numberOfLines={2}>
                                  {p.name}
                                </Text>
                                {desc.length > 0 ? (
                                  <Text style={{ marginTop: 4, color: "#78716c", fontSize: 12, fontWeight: "600", lineHeight: 16 }} numberOfLines={2}>
                                    {desc}
                    </Text>
                                ) : null}
                    {p.unitLabel ? (
                                  <View
                                    style={{
                                      alignSelf: "flex-start",
                                      marginTop: 8,
                                      backgroundColor: "#fafaf9",
                                      paddingHorizontal: 9,
                                      paddingVertical: 4,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: LINE,
                                    }}
                                  >
                                    <Text style={{ color: INK_MUTED, fontWeight: "800", fontSize: 11 }}>{p.unitLabel}</Text>
                                  </View>
                                ) : null}
                              </Pressable>
                              <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <Pressable onPress={() => router.push(`/product/${p.id}`)} style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
                                    <Text style={{ fontSize: 17, fontWeight: "900", color: "#15803d", letterSpacing: -0.3 }}>{fmtRupee(price)}</Text>
                                    {mrp > price ? (
                                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#a8a29e", textDecorationLine: "line-through" }}>
                                        {fmtRupee(mrp)}
                      </Text>
                    ) : null}
                  </View>
                                  {typeof p.priceMax === "number" && p.priceMax > price && (p.variantOptionsCount ?? 0) > 1 ? (
                                    <Text style={{ marginTop: 3, fontSize: 10, fontWeight: "700", color: "#78716c" }}>
                                      From {fmtRupee(price)} – {fmtRupee(p.priceMax!)}
                                    </Text>
                                  ) : null}
                </Pressable>
                                <View style={{ flexShrink: 0, width: 96, alignItems: "flex-end" }}>
                                  {inStock ? (
                                    <View
                                      style={{
                                        borderRadius: 10,
                                        borderWidth: 1.5,
                                        borderColor: "#16a34a",
                                        backgroundColor: "#fafaf9",
                                        overflow: "hidden",
                                        alignSelf: "stretch",
                                      }}
                                    >
                  <CartQtyStepper
                    compact
                                        dense
                    addLabel="ADD"
                    line={{
                      productId: p.id,
                      storeId: id!,
                      name: p.name,
                                          price,
                      storeName: name,
                      imageUrl: p.imageUrl ?? null,
                                          mrp: mrp > price ? mrp : undefined,
                      discountPercent:
                        typeof p.discountPercent === "number" && p.discountPercent > 0
                          ? p.discountPercent
                          : undefined,
                    }}
                    maxQty={p.stock}
                                        canAdd={inStock}
                                      />
                                    </View>
                                  ) : (
                                    <Text style={{ fontSize: 10, color: "#b91c1c", fontWeight: "800", textAlign: "right" }} numberOfLines={2}>
                                      Out of stock
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                </View>
              </View>
            );
          })}
        </View>
                ))
              )}
            </View>
          </View>
        </View>
    </ScrollView>

      {cartQty > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 12 + Math.max(insets.bottom, 8),
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => router.push("/cart")}
            style={{
              width: viewCartBarWidth,
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "#166534",
              gap: 10,
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.2,
                  shadowRadius: 12,
                },
                android: { elevation: 10 },
              }),
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.4)",
              }}
            >
              {firstThumbUri ? (
                <Image source={{ uri: firstThumbUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="cart" size={22} color="#166534" />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>View cart</Text>
              <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: "700", fontSize: 12, marginTop: 2 }}>
                {cartQty} {cartQty === 1 ? "item" : "items"}
              </Text>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.brandNavOrange,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="chevron-right" size={28} color="#fff" />
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
