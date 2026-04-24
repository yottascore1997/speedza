import { useCallback, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { StoreOwnerCatalog } from "@/components/StoreOwnerCatalog";
import { api, clearSession, getToken, getUser } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";
import { appFonts } from "@/lib/typography";

type StoreMine = {
  id: string;
  name: string;
  status: string;
  address?: string;
  shopVertical?: string;
  imageUrl?: string | null;
  openingHoursEnabled?: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
};

type EarningsBlock = {
  deliveredOrders: number;
  gross: number;
  estimatedNet: number;
};

type StoreEarnings = {
  today: EarningsBlock;
  thisWeek: EarningsBlock;
  thisMonth: EarningsBlock;
  allTime: EarningsBlock;
};

type StoreOrder = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  user?: { name?: string; phone?: string };
  items?: { quantity: number; price: number; product: { name: string } }[];
};

type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  mrp: number;
  stock: number;
  isActive: boolean;
  imageUrl?: string | null;
  imageUrl2?: string | null;
  discountPercent?: number | null;
  unitLabelEffective?: string | null;
};

type CatalogCategory = {
  id: string;
  name: string;
  products: CatalogProduct[];
};

type StoreCatalog = {
  store: {
    id: string;
    name: string;
    status: string;
    categories: CatalogCategory[];
  };
};

type OwnerTab = "dashboard" | "orders" | "stock" | "menu";

const FONT_DISPLAY = appFonts.bold;
const FONT_BODY = appFonts.regular;

const nextStatusMap: Record<string, string> = {
  PLACED: "PREPARING",
  PREPARING: "READY",
};
const TOP_HEADER_PAD = Platform.OS === "android"
  ? (StatusBar.currentHeight ?? 0) + 8
  : 14;

export default function StoreOwnerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<OwnerTab>("dashboard");
  const [stockSearch, setStockSearch] = useState("");

  const [stores, setStores] = useState<StoreMine[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [earnings, setEarnings] = useState<StoreEarnings | null>(null);
  const [catalog, setCatalog] = useState<StoreCatalog["store"] | null>(null);
  const [ownerName, setOwnerName] = useState("");

  const [newProduct, setNewProduct] = useState({
    categoryId: "",
    name: "",
    mrp: "",
    price: "",
    stock: "",
    unit: "",
  });

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const allProducts = useMemo(
    () => (catalog?.categories ?? []).flatMap((c) => c.products),
    [catalog],
  );

  const todayOrderCount = useMemo(() => {
    const now = new Date();
    return orders.filter((o) => {
      const d = new Date(o.createdAt);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }).length;
  }, [orders]);

  const todayRevenue = useMemo(() => {
    const now = new Date();
    return orders
      .filter((o) => {
        const d = new Date(o.createdAt);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      })
      .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  }, [orders]);

  const lowStockProducts = useMemo(
    () => allProducts.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock),
    [allProducts],
  );
  const productCategoryName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of catalog?.categories ?? []) {
      for (const p of c.products) map[p.id] = c.name;
    }
    return map;
  }, [catalog]);

  const orderPipeline = useMemo(() => {
    const count = (status: string) => orders.filter((o) => o.status === status).length;
    return {
      placed: count("PLACED"),
      preparing: count("PREPARING"),
      ready: count("READY"),
    };
  }, [orders]);

  const statusSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const filteredStockProducts = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter((p) => {
      const cat = (productCategoryName[p.id] || "").toLowerCase();
      return p.name.toLowerCase().includes(q) || cat.includes(q);
    });
  }, [allProducts, stockSearch, productCategoryName]);

  const loadStores = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const user = await getUser();
    if (!token || user?.role !== "STORE_OWNER") {
      setLoading(false);
      Alert.alert("Store owner only", "Please login with store owner account.", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
      return;
    }
    const mine = await api<{ stores: StoreMine[] }>("/api/stores/mine");
    const list = mine.ok && mine.data?.stores ? mine.data.stores : [];
    setStores(list);
    setSelectedStoreId((prev) => prev ?? list[0]?.id ?? null);
    setOwnerName(user?.name?.trim() || "");
    setLoading(false);
  }, [router]);

  const loadStoreData = useCallback(async () => {
    if (!selectedStoreId) {
      setOrders([]);
      setEarnings(null);
      setCatalog(null);
      return;
    }
    setLoading(true);
    const [ordersRes, earnRes, catalogRes] = await Promise.all([
      api<{ orders: StoreOrder[] }>(
        `/api/orders/store?storeId=${encodeURIComponent(selectedStoreId)}&limit=40`,
      ),
      api<StoreEarnings>(
        `/api/store/earnings?storeId=${encodeURIComponent(selectedStoreId)}`,
      ),
      api<StoreCatalog>(
        `/api/store/catalog?storeId=${encodeURIComponent(selectedStoreId)}`,
      ),
    ]);
    setOrders(ordersRes.ok && ordersRes.data?.orders ? ordersRes.data.orders : []);
    setEarnings(earnRes.ok && earnRes.data ? earnRes.data : null);
    setCatalog(catalogRes.ok && catalogRes.data?.store ? catalogRes.data.store : null);
    setLoading(false);
  }, [selectedStoreId]);

  useFocusEffect(
    useCallback(() => {
      void loadStores();
    }, [loadStores]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadStoreData();
    }, [loadStoreData]),
  );

  async function signOut() {
    await clearSession();
    router.replace("/login");
  }

  async function updateOrder(orderId: string, status: string) {
    setSaving(true);
    const res = await api("/api/orders/update-status", {
      method: "POST",
      body: JSON.stringify({ orderId, status }),
    });
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Could not update order", res.error || "Please try again");
      return;
    }
    await loadStoreData();
  }

  async function updateProduct(productId: string, payload: Record<string, unknown>) {
    setSaving(true);
    const res = await api("/api/products/update", {
      method: "PATCH",
      body: JSON.stringify({ productId, ...payload }),
    });
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Could not update product", res.error || "Please try again");
      return;
    }
    await loadStoreData();
  }

  async function createProduct() {
    if (!selectedStoreId || !newProduct.categoryId || !newProduct.name.trim()) {
      Alert.alert("Missing fields", "Select category and enter product name.");
      return;
    }
    const mrp = Number(newProduct.mrp);
    const price = Number(newProduct.price);
    const stock = Number(newProduct.stock);
    if (!(mrp > 0 && price > 0 && stock >= 0 && Number.isFinite(stock))) {
      Alert.alert("Invalid values", "Check MRP, price and stock.");
      return;
    }
    setSaving(true);
    const unitTrim = newProduct.unit.trim();
    const res = await api("/api/products/create", {
      method: "POST",
      body: JSON.stringify({
        storeId: selectedStoreId,
        categoryId: newProduct.categoryId,
        name: newProduct.name.trim(),
        description: "",
        mrp,
        price,
        stock: Math.round(stock),
        ...(unitTrim ? { unitLabel: unitTrim } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Could not create product", res.error || "Please try again");
      return;
    }
    setNewProduct({ categoryId: "", name: "", mrp: "", price: "", stock: "", unit: "" });
    await loadStoreData();
  }

  async function deleteProduct(productId: string) {
    setSaving(true);
    const res = await api("/api/products/delete", {
      method: "POST",
      body: JSON.stringify({ productId }),
    });
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Could not delete", res.error || "Please try again");
      return;
    }
    await loadStoreData();
  }

  return (
    <View style={{ flex: 1, backgroundColor: tab === "menu" ? "#f5f5f4" : "#f5f7ff" }}>
      {tab === "menu" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, paddingTop: TOP_HEADER_PAD, paddingBottom: 12, backgroundColor: "#111111", borderBottomWidth: 1, borderBottomColor: "#2a2a2a", shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="store-settings-outline" size={22} color="#e5e7eb" />
            <Text style={{ color: "#d1d5db", fontWeight: "800", fontSize: 13, fontFamily: FONT_DISPLAY, letterSpacing: 0.8 }}>CATALOG</Text>
          </View>
          <Text style={{ color: "#f8fafc", fontWeight: "900", fontSize: 19, letterSpacing: 0.2, fontFamily: FONT_DISPLAY }}>Speedza</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => void loadStoreData()} accessibilityLabel="Refresh" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#1f2937" }}>
              <MaterialCommunityIcons name="refresh" size={22} color="#e5e7eb" />
            </Pressable>
            <Pressable onPress={() => void signOut()} accessibilityLabel="Logout" style={{ borderRadius: 999, borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#3f0d0d", paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialCommunityIcons name="logout" size={16} color="#fecaca" />
              <Text style={{ color: "#fecaca", fontWeight: "900", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.35 }}>LOGOUT</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, paddingTop: TOP_HEADER_PAD, paddingBottom: 10, backgroundColor: "#111111", borderBottomWidth: 1, borderBottomColor: "#2a2a2a", shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 7 }}>
          <MaterialCommunityIcons name="menu" size={26} color="#e5e7eb" />
          <Text style={{ color: "#f8fafc", fontWeight: "900", fontSize: 22, letterSpacing: 0.35, fontFamily: FONT_DISPLAY }}>Speedza</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <MaterialCommunityIcons name="bell-outline" size={24} color="#e5e7eb" />
            <Pressable onPress={() => void signOut()} accessibilityLabel="Logout" style={{ borderRadius: 999, borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#3f0d0d", paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialCommunityIcons name="logout" size={16} color="#fecaca" />
              <Text style={{ color: "#fecaca", fontWeight: "900", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.35 }}>LOGOUT</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 13, paddingBottom: 108, backgroundColor: tab === "menu" ? "#f5f5f4" : undefined }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadStoreData()} />}
      >
        {selectedStore && tab !== "orders" && tab !== "menu" ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: "#94a3b8", fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT_DISPLAY }}>Active Outlet</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
              <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 30, fontFamily: FONT_DISPLAY }}>{selectedStore.name}</Text>
              <View style={{ borderRadius: 999, backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac", paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: "#166534", fontWeight: "900", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.4 }}>{selectedStore.status}</Text>
              </View>
            </View>
            <Text style={{ color: "#64748b", fontWeight: "700", marginTop: 4, fontSize: 15, fontFamily: FONT_BODY }}>
              Sales, stock, and orders in one place.
            </Text>
          </View>
        ) : (
          <Card>
            <Text style={{ color: "#64748b", fontWeight: "700", fontFamily: FONT_BODY }}>No stores found.</Text>
          </Card>
        )}

        {tab === "dashboard" ? (
          <>
            <Card style={{ marginBottom: 8, backgroundColor: "#eef2ff", borderColor: "#c7d2fe" }}>
              <Text style={{ color: "#3730a3", fontWeight: "900", fontSize: 13, fontFamily: FONT_DISPLAY, letterSpacing: 0.2 }}>
                Quick Summary
              </Text>
              <Text style={{ marginTop: 4, color: "#475569", fontWeight: "700", fontSize: 12.5, fontFamily: FONT_BODY }}>
                Check alerts first, then move orders from Placed to Ready.
              </Text>
            </Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <MiniTile label="Store Status" value={allProducts.length > 0 ? "Menu Live" : "Add Products"} />
              <MiniTile label="Orders Today" value={String(todayOrderCount)} />
              <MiniTile label="Today's Sales" value={`₹${Math.round(todayRevenue)}`} />
              <MiniTile label="Active Items" value={`${allProducts.filter((p) => p.isActive).length} / ${allProducts.length}`} />
            </View>

            <Card style={{ marginTop: 8, borderColor: "#fecaca", borderLeftWidth: 2, borderLeftColor: "#dc2626", backgroundColor: "#fffafa" }}>
              <RowBetween>
                <Text style={{ color: "#991b1b", fontWeight: "900", fontSize: 14 }}>🔺 Stock Alerts: {lowStockProducts.length}</Text>
                <Text style={{ color: "#9f1239", fontWeight: "800", fontSize: 11 }}>
                  {lowStockProducts.length} UNITS WARNING
                </Text>
              </RowBetween>
              {lowStockProducts.length === 0 ? (
                <Text style={{ marginTop: 6, color: "#64748b", fontWeight: "700" }}>No low stock items</Text>
              ) : (
                <View style={{ marginTop: 6, gap: 6 }}>
                  {lowStockProducts.slice(0, 4).map((p) => (
                    <RowBetween key={p.id}>
                      <Text style={{ color: "#334155", fontWeight: "700" }}>{p.name}</Text>
                      <Text style={{ color: "#9f1239", fontWeight: "900", fontSize: 11 }}>{p.stock} left</Text>
                    </RowBetween>
                  ))}
                </View>
              )}
            </Card>

            <SectionTitle title="Order Pipeline" subtitle="Move each order step by step" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PipelineBox label="Placed" value={orderPipeline.placed} />
              <PipelineBox label="Preparing" value={orderPipeline.preparing} active />
              <PipelineBox label="Ready" value={orderPipeline.ready} />
            </View>

            <SectionTitle title="Orders & Activity (Daily)" subtitle="Chart view appears when enough data is available" />
            <Card style={{ alignItems: "center", justifyContent: "center", minHeight: 118, backgroundColor: "#f8fafc" }}>
              <Text style={{ color: "#cbd5e1", fontWeight: "900", fontSize: 28, fontFamily: FONT_DISPLAY }}>📊</Text>
              <Text style={{ marginTop: 4, color: "#94a3b8", fontWeight: "700", fontSize: 12, fontFamily: FONT_BODY }}>No order data yet for charts</Text>
            </Card>

            <SectionTitle title="Orders by Status" subtitle="Live split of your current order states" />
            <Card style={{ minHeight: 106, backgroundColor: "#f8fafc" }}>
              {statusSummary.length === 0 ? (
                <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
                  <Text style={{ color: "#cbd5e1", fontSize: 24, fontWeight: "900", fontFamily: FONT_DISPLAY }}>◎</Text>
                  <Text style={{ color: "#94a3b8", fontWeight: "700", fontSize: 12, fontFamily: FONT_BODY }}>No order data yet</Text>
                </View>
              ) : (
                <View style={{ gap: 5 }}>
                  {statusSummary.slice(0, 5).map(([status, count]) => (
                    <RowBetween key={status}>
                      <Text style={{ color: "#334155", fontWeight: "700", fontFamily: FONT_BODY }}>{status.replace(/_/g, " ")}</Text>
                      <Text style={{ color: "#0f766e", fontWeight: "900", fontFamily: FONT_DISPLAY }}>{count}</Text>
                    </RowBetween>
                  ))}
                </View>
              )}
            </Card>

            <SectionTitle title="Recent Orders" subtitle="Latest incoming customer orders" />
            <Card>
              <RowBetween>
                <Text style={tableHead}>ORDER</Text>
                <Text style={tableHead}>CUSTOMER</Text>
                <Text style={tableHead}>STATUS</Text>
                <Text style={tableHead}>AMOUNT</Text>
              </RowBetween>
              {orders.length === 0 ? (
                <Text style={{ marginTop: 9, color: "#94a3b8", textAlign: "center", fontWeight: "700", fontSize: 12, fontFamily: FONT_BODY }}>
                  No orders yet - customers order from the mobile app
                </Text>
              ) : (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {orders.slice(0, 5).map((o) => (
                    <RowBetween key={o.id}>
                      <Text style={rowCell}>#{o.id.slice(0, 5)}</Text>
                      <Text style={rowCell}>{o.user?.phone || "-"}</Text>
                      <Text style={rowCell}>{o.status.replace(/_/g, " ")}</Text>
                      <Text style={{ ...rowCell, fontWeight: "900" }}>₹{Math.round(o.totalAmount)}</Text>
                    </RowBetween>
                  ))}
                </View>
              )}
            </Card>

            <SectionTitle title="Earnings Overview" subtitle="Estimated net earnings timeline" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <EarningCard label="Today" value={earnings?.today?.estimatedNet ?? 0} />
              <EarningCard label="This Week" value={earnings?.thisWeek?.estimatedNet ?? 0} />
              <EarningCard label="This Month" value={earnings?.thisMonth?.estimatedNet ?? 0} />
              <EarningCard label="All Time" value={earnings?.allTime?.estimatedNet ?? 0} highlight />
            </View>
          </>
        ) : null}

        {selectedStore && tab === "orders" ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={chipFilter}>
                <Text style={chipFilterText}>Oct 01 - Oct 31</Text>
              </View>
              <View style={chipFilter}>
                <Text style={chipFilterText}>Month</Text>
              </View>
            </View>

            <Card style={{ minHeight: 92, justifyContent: "center" }}>
              <Text style={{ color: "#94a3b8", fontWeight: "900", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT_DISPLAY }}>Total Orders</Text>
              <Text style={{ marginTop: 4, color: "#0f172a", fontWeight: "900", fontSize: 46, lineHeight: 50, fontFamily: FONT_DISPLAY }}>
                {orders.length}
              </Text>
              <Text style={{ color: "#16a34a", fontWeight: "800", fontSize: 12, fontFamily: FONT_BODY }}>
                +{Math.max(0, todayOrderCount)} from yesterday
              </Text>
            </Card>

            <Card style={{ minHeight: 92, justifyContent: "center", backgroundColor: "#f97316", borderColor: "#ea580c" }}>
              <Text style={{ color: "#ffedd5", fontWeight: "900", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT_DISPLAY }}>Daily Revenue</Text>
              <Text style={{ marginTop: 4, color: "#fff7ed", fontWeight: "900", fontSize: 45, lineHeight: 48, fontFamily: FONT_DISPLAY }}>
                ₹{Math.round(todayRevenue)}
              </Text>
            </Card>

            <RowBetween>
              <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 24, fontFamily: FONT_DISPLAY }}>Live Fulfillment Queue</Text>
              <Text style={{ color: "#64748b", fontWeight: "800", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.4 }}>
                {orders.filter((o) => o.status === "PLACED" || o.status === "PREPARING").length} NEW ORDERS
              </Text>
            </RowBetween>

            {orders.length === 0 ? (
              <Card>
                <Text style={{ color: "#64748b", fontWeight: "700" }}>No orders yet.</Text>
              </Card>
            ) : (
              orders.slice(0, 2).map((o) => {
                const next = nextStatusMap[o.status];
                const isPlaced = o.status === "PLACED";
                const isPreparing = o.status === "PREPARING";
                const pillBg = isPlaced ? "#ffe4e6" : isPreparing ? "#dcfce7" : "#e2e8f0";
                const pillText = isPlaced ? "#be123c" : isPreparing ? "#166534" : "#334155";
                const initials = (o.user?.name || o.user?.phone || "CU").slice(0, 2).toUpperCase();
                return (
                  <Card key={o.id} style={{ padding: 14 }}>
                    <RowBetween>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 32 }}>#{o.id.slice(0, 4)}</Text>
                        <View style={{ borderRadius: 999, backgroundColor: pillBg, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: pillText, fontWeight: "900", fontSize: 10 }}>
                            {o.status.replace(/_/g, " ")}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: "#64748b", fontWeight: "700", fontSize: 13 }}>{timeAgo(o.createdAt)}</Text>
                    </RowBetween>

                    <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#475569", fontWeight: "900", fontSize: 13 }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 17 }}>
                          {o.user?.name || "Customer"}
                        </Text>
                        <Text style={{ color: "#94a3b8", fontWeight: "700", fontSize: 11 }}>
                          Pickup/Customer
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 8, gap: 3 }}>
                      {(o.items ?? []).slice(0, 2).map((it, idx) => (
                        <Text key={idx} style={{ color: "#334155", fontWeight: "700", fontSize: 13 }}>
                          {it.quantity}x {it.product.name}
                        </Text>
                      ))}
                    </View>

                    <Text style={{ marginTop: 10, color: "#0f172a", fontWeight: "900", fontSize: 34, lineHeight: 38 }}>
                      ₹{Math.round(o.totalAmount)}
                    </Text>

                    {isPlaced ? (
                      <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => void updateOrder(o.id, "PREPARING")} disabled={saving} style={acceptBtn}>
                          <Text style={acceptBtnText}>Accept</Text>
                        </Pressable>
                        <Pressable onPress={() => void updateOrder(o.id, "CANCELLED")} disabled={saving} style={rejectBtn}>
                          <Text style={rejectBtnText}>Reject</Text>
                        </Pressable>
                      </View>
                    ) : next ? (
                      <Pressable onPress={() => void updateOrder(o.id, next)} disabled={saving} style={readyBtn}>
                        <Text style={readyBtnText}>Mark as Ready</Text>
                      </Pressable>
                    ) : null}
                  </Card>
                );
              })
            )}

            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 2 }}>
              <PagerPill label="‹" />
              <PagerPill label="1" active />
              <PagerPill label="2" />
              <PagerPill label="3" />
              <PagerPill label="›" />
            </View>
          </View>
        ) : null}

        {selectedStore && tab === "stock" ? (
          <View style={{ gap: 10 }}>
            <Card style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: "#166534", fontWeight: "900", fontSize: 15, fontFamily: FONT_DISPLAY }}>Stock Operations</Text>
                  <Text style={{ marginTop: 4, color: "#15803d", fontWeight: "700", fontSize: 12, fontFamily: FONT_BODY }}>
                    Fast updates for quantity and visibility.
                  </Text>
                </View>
                <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#86efac", backgroundColor: "#dcfce7", paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: "#14532d", fontWeight: "900", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.35 }}>
                    {allProducts.length} ITEMS
                  </Text>
                </View>
              </View>
            </Card>

            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#dbe2f3", paddingHorizontal: 10 }}>
              <MaterialCommunityIcons name="magnify" size={18} color="#94a3b8" />
              <TextInput
                value={stockSearch}
                onChangeText={setStockSearch}
                placeholder="Search product or category"
                placeholderTextColor="#94a3b8"
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: "#0f172a", fontWeight: "700", fontFamily: FONT_BODY }}
              />
            </View>

            {filteredStockProducts.length === 0 ? (
              <Card>
                <Text style={{ color: "#64748b", fontWeight: "700", fontFamily: FONT_BODY }}>
                  {allProducts.length === 0 ? "No products added yet." : "No products match your search."}
                </Text>
              </Card>
            ) : (
              filteredStockProducts.map((p) => (
                <Card key={p.id} style={{ borderColor: "#e2e8f0" }}>
                  <View style={{ flexDirection: "row", gap: 11 }}>
                    <View style={{ width: 70, height: 70, borderRadius: 12, overflow: "hidden", backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" }}>
                      {resolveMediaUrl(p.imageUrl?.trim() || p.imageUrl2?.trim() || undefined) ? (
                        <Image
                          source={{ uri: resolveMediaUrl(p.imageUrl?.trim() || p.imageUrl2?.trim() || undefined) }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <MaterialCommunityIcons name="image-outline" size={22} color="#94a3b8" />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <RowBetween>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 15, fontFamily: FONT_DISPLAY }} numberOfLines={2}>
                            {p.name}
                          </Text>
                          <Text style={{ marginTop: 2, color: "#94a3b8", fontWeight: "700", fontSize: 11.5, fontFamily: FONT_BODY }} numberOfLines={1}>
                            {productCategoryName[p.id] || "General"}
                          </Text>
                        </View>
                        <View style={{ borderRadius: 999, borderWidth: 1, borderColor: p.stock <= 5 ? "#fca5a5" : "#86efac", backgroundColor: p.stock <= 5 ? "#fff1f2" : "#f0fdf4", paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: p.stock <= 5 ? "#b91c1c" : "#166534", fontWeight: "900", fontSize: 11, fontFamily: FONT_DISPLAY }}>
                            {p.stock} IN STOCK
                          </Text>
                        </View>
                      </RowBetween>
                      <View style={{ marginTop: 5, flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <Text style={{ color: "#166534", fontWeight: "900", fontSize: 17, fontFamily: FONT_DISPLAY }}>₹{p.price}</Text>
                        <Text style={{ color: "#94a3b8", fontWeight: "700", fontSize: 12, textDecorationLine: p.mrp > p.price ? "line-through" : "none", fontFamily: FONT_BODY }}>
                          MRP ₹{p.mrp}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => void updateProduct(p.id, { stock: Math.max(0, p.stock - 1) })}
                      style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#dbe2f3", backgroundColor: "#f8fafc", paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <MaterialCommunityIcons name="minus" size={17} color="#475569" />
                      <Text style={{ color: "#475569", fontWeight: "900", fontFamily: FONT_DISPLAY }}>Reduce</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void updateProduct(p.id, { stock: p.stock + 1 })}
                      style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#86efac", backgroundColor: "#f0fdf4", paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <MaterialCommunityIcons name="plus" size={17} color="#166534" />
                      <Text style={{ color: "#166534", fontWeight: "900", fontFamily: FONT_DISPLAY }}>Add</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void updateProduct(p.id, { isActive: !p.isActive })}
                      style={{
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: p.isActive ? "#86efac" : "#fecdd3",
                        backgroundColor: p.isActive ? "#ecfdf5" : "#fff1f2",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <MaterialCommunityIcons name={p.isActive ? "eye-outline" : "eye-off-outline"} size={17} color={p.isActive ? "#166534" : "#9f1239"} />
                      <Text style={{ color: p.isActive ? "#166534" : "#9f1239", fontWeight: "900", fontFamily: FONT_DISPLAY }}>
                        {p.isActive ? "Live" : "Hidden"}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : null}

        {selectedStore && tab === "menu" ? (
          <StoreOwnerCatalog
            ownerName={ownerName}
            selectedStore={selectedStore}
            categories={catalog?.categories ?? []}
            saving={saving}
            newProduct={newProduct}
            setNewProduct={setNewProduct}
            onCreateProduct={() => void createProduct()}
            onUpdateProduct={(productId, payload) => void updateProduct(productId, payload)}
            onDeleteProduct={(productId) => void deleteProduct(productId)}
            onReloadCatalog={() => void loadStoreData()}
            onReloadStores={() => void loadStores()}
          />
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 8,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tab === "menu" ? "#e5e2dd" : "#dbe2f3",
          backgroundColor: "#ffffff",
          flexDirection: "row",
          paddingVertical: 6,
          paddingHorizontal: 4,
          shadowColor: "#0c0a09",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: tab === "menu" ? 0.08 : 0.05,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <BottomItem label="Dashboard" icon="view-dashboard-outline" active={tab === "dashboard"} onPress={() => setTab("dashboard")} />
        <BottomItem label="Orders" icon="clipboard-text-outline" active={tab === "orders"} onPress={() => setTab("orders")} />
        <BottomItem label="Stock" icon="package-variant-closed" active={tab === "stock"} onPress={() => setTab("stock")} />
        <BottomItem label="Catalog" icon="store-settings-outline" active={tab === "menu"} onPress={() => setTab("menu")} />
      </View>
    </View>
  );
}

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: "#dbe2f3",
          borderRadius: 14,
          backgroundColor: "#fff",
          padding: 13,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function RowBetween({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>{children}</View>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginTop: 13, marginBottom: 8 }}>
      <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 16, fontFamily: FONT_DISPLAY, letterSpacing: 0.2 }}>{title}</Text>
      {subtitle ? (
        <Text style={{ marginTop: 2, color: "#64748b", fontWeight: "700", fontSize: 11.5, fontFamily: FONT_BODY }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: "48%", flexGrow: 1, borderWidth: 1, borderColor: "#dbe2f3", borderRadius: 12, backgroundColor: "#fff", padding: 13 }}>
      <Text style={{ color: "#94a3b8", fontWeight: "900", fontSize: 10.5, textTransform: "uppercase", fontFamily: FONT_DISPLAY, letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ marginTop: 7, color: "#0f172a", fontWeight: "900", fontSize: 19, fontFamily: FONT_DISPLAY }}>{value}</Text>
    </View>
  );
}

function PipelineBox({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: active ? "#fca5a5" : "#dbe2f3", borderRadius: 12, backgroundColor: active ? "#fee2e2" : "#fff", padding: 13, alignItems: "center" }}>
      <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 24, fontFamily: FONT_DISPLAY }}>{value}</Text>
      <Text style={{ marginTop: 3, color: "#64748b", fontWeight: "800", fontSize: 10.5, textTransform: "uppercase", fontFamily: FONT_DISPLAY, letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

function EarningCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={{ flexBasis: "48%", flexGrow: 1, borderWidth: 1, borderColor: highlight ? "#ea580c" : "#dbe2f3", borderRadius: 12, backgroundColor: highlight ? "#c2410c" : "#fff", padding: 13 }}>
      <Text style={{ color: highlight ? "#fed7aa" : "#94a3b8", fontWeight: "900", fontSize: 10.5, textTransform: "uppercase", fontFamily: FONT_DISPLAY, letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ marginTop: 6, color: highlight ? "#fff7ed" : "#0f172a", fontWeight: "900", fontSize: 25, fontFamily: FONT_DISPLAY }}>₹{Math.round(value)}</Text>
    </View>
  );
}

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

function BottomItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: MciName;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? "#c2410c" : "#94a3b8";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        paddingVertical: 8,
        backgroundColor: active ? "#fff7ed" : "transparent",
      }}
    >
      <MaterialCommunityIcons name={icon} size={23} color={color} />
      <Text style={{ color: active ? "#c2410c" : "#64748b", fontWeight: "800", fontSize: 10.5, marginTop: 3, fontFamily: FONT_BODY }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Input({
  style,
  ...props
}: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#94a3b8"
      style={[
        {
          borderWidth: 1,
          borderColor: "#dbe2f3",
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 9,
          color: "#0f172a",
          backgroundColor: "#f8fafc",
          fontWeight: "700",
          fontFamily: FONT_BODY,
        },
        style,
      ]}
    />
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.floor(ms / 60000));
  if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

function PagerPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <View
      style={{
        minWidth: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: active ? "#fdba74" : "#e2e8f0",
        backgroundColor: active ? "#fff7ed" : "#fff",
        paddingHorizontal: 9,
        paddingVertical: 5,
        alignItems: "center",
      }}
    >
      <Text style={{ color: active ? "#c2410c" : "#64748b", fontWeight: "900", fontSize: 12, fontFamily: FONT_DISPLAY }}>{label}</Text>
    </View>
  );
}

const tableHead = {
  color: "#94a3b8",
  fontWeight: "900" as const,
  fontSize: 11.5,
  fontFamily: FONT_DISPLAY as string,
  letterSpacing: 0.35,
};

const rowCell = {
  color: "#475569",
  fontWeight: "700" as const,
  fontSize: 12.5,
  fontFamily: FONT_BODY as string,
};

const primaryBtn = {
  borderRadius: 10,
  backgroundColor: "#ea580c",
  paddingHorizontal: 12,
  paddingVertical: 10,
} as const;

const primaryBtnText = {
  color: "#fff",
  fontWeight: "900" as const,
  textAlign: "center" as const,
  fontFamily: FONT_DISPLAY as string,
};

const dangerBtn = {
  borderRadius: 10,
  backgroundColor: "#fff1f2",
  borderWidth: 1,
  borderColor: "#fecdd3",
  paddingHorizontal: 12,
  paddingVertical: 10,
} as const;

const dangerBtnText = {
  color: "#9f1239",
  fontWeight: "900" as const,
  fontFamily: FONT_DISPLAY as string,
};

const neutralBtn = {
  borderRadius: 10,
  backgroundColor: "#f8fafc",
  borderWidth: 1,
  borderColor: "#dbe2f3",
  paddingHorizontal: 12,
  paddingVertical: 10,
} as const;

const neutralBtnText = {
  color: "#475569",
  fontWeight: "900" as const,
  fontFamily: FONT_DISPLAY as string,
};

const activeBtn = {
  borderRadius: 10,
  backgroundColor: "#ecfdf5",
  borderWidth: 1,
  borderColor: "#86efac",
  paddingHorizontal: 12,
  paddingVertical: 10,
} as const;

const activeBtnText = {
  color: "#166534",
  fontWeight: "900" as const,
  fontFamily: FONT_DISPLAY as string,
};

const chipFilter = {
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#e2e8f0",
  backgroundColor: "#fff",
  paddingHorizontal: 10,
  paddingVertical: 8,
} as const;

const chipFilterText = {
  color: "#334155",
  fontWeight: "800" as const,
  fontSize: 12,
  fontFamily: FONT_BODY as string,
} as const;

const acceptBtn = {
  flex: 1,
  borderRadius: 999,
  backgroundColor: "#15803d",
  paddingVertical: 12,
  alignItems: "center" as const,
} as const;

const acceptBtnText = {
  color: "#f0fdf4",
  fontWeight: "900" as const,
  fontSize: 14,
  fontFamily: FONT_DISPLAY as string,
} as const;

const rejectBtn = {
  flex: 1,
  borderRadius: 999,
  borderWidth: 1.2,
  borderColor: "#be123c",
  backgroundColor: "#fff",
  paddingVertical: 12,
  alignItems: "center" as const,
} as const;

const rejectBtnText = {
  color: "#9f1239",
  fontWeight: "900" as const,
  fontSize: 14,
  fontFamily: FONT_DISPLAY as string,
} as const;

const readyBtn = {
  marginTop: 10,
  borderRadius: 999,
  backgroundColor: "#b45309",
  paddingVertical: 12,
  alignItems: "center" as const,
} as const;

const readyBtnText = {
  color: "#fff7ed",
  fontWeight: "900" as const,
  fontSize: 14,
  fontFamily: FONT_DISPLAY as string,
} as const;

