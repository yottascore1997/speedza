import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, View } from "react-native";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { PlatformPressable } from "@react-navigation/elements";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";
import { clearSession, getToken, getUser } from "@/lib/api";
import { cartTotalQty, getCart, subscribeCart } from "@/lib/cart";
import { checkServiceAreaGate } from "@/lib/deliveryAddress";

const TAB_ICON_SIZE = 28;
const TAB_CENTER_SIZE = 60;

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBottomPad = Math.max(insets.bottom, Platform.OS === "ios" ? 12 : 10);
  const tabBarHeight = 58 + tabBottomPad;

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [cartQty, setCartQty] = useState(0);
  const [areaOk, setAreaOk] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getToken();
        const user = await getUser();
        const ok = Boolean(token && user);
        setAuthed(ok);
        setRole(user?.role ?? null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const syncCart = () => {
    void getCart().then((lines) => setCartQty(cartTotalQty(lines)));
  };

  useEffect(() => {
    syncCart();
    return subscribeCart(syncCart);
  }, []);

  useFocusEffect(() => {
    if (!authed || role !== "CUSTOMER") return;
    let cancelled = false;
    void (async () => {
      const gate = await checkServiceAreaGate();
      if (cancelled) return;
      if (gate.status !== "ok") {
        router.replace("/location");
        return;
      }
      setAreaOk(true);
    })();
    return () => {
      cancelled = true;
    };
  });

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.brandNavOrange} />
      </View>
    );
  }

  if (!authed) {
    return <Redirect href="/login" />;
  }

  if (role === "STORE_OWNER") {
    return <Redirect href="/store-owner" />;
  }

  if (role && role !== "CUSTOMER" && role !== "STORE_OWNER") {
    void clearSession();
    return <Redirect href="/login" />;
  }

  if (!areaOk) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.brandNavOrange} />
      </View>
    );
  }

  const badge =
    cartQty > 0 ? (cartQty > 99 ? "99+" : String(cartQty)) : undefined;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.brandNavOrange,
          height: 52,
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "800", fontSize: 15, color: "#ffffff" },
        headerTitleContainerStyle: { paddingVertical: 0 },
        headerShadowVisible: false,
        tabBarActiveTintColor: "#2f9e44",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#eef2f6",
          elevation: 18,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          paddingTop: 10,
          paddingBottom: tabBottomPad,
          height: tabBarHeight,
          minHeight: tabBarHeight,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
          minHeight: 52,
        },
        tabBarLabelStyle: { fontWeight: "800", fontSize: 11, marginTop: 2, marginBottom: 2 },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            android_ripple={{ color: "rgba(47,158,68,0.14)", borderless: false }}
            hitSlop={{ top: 18, bottom: 14, left: 10, right: 10 }}
            style={[props.style, { flex: 1, justifyContent: "center", alignItems: "center" }]}
          />
        ),
        tabBarBadgeStyle: {
          backgroundColor: theme.badgeRed,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: "800",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Home",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-grid-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Quick\nReorder",
          headerShown: false,
          tabBarBadge: badge,
          tabBarIcon: () => (
            <View
              style={{
                width: TAB_CENTER_SIZE,
                height: TAB_CENTER_SIZE,
                borderRadius: TAB_CENTER_SIZE / 2,
                backgroundColor: "#2f9e44",
                alignItems: "center",
                justifyContent: "center",
                marginTop: -18,
                borderWidth: 4,
                borderColor: "#ffffff",
                elevation: 8,
                shadowColor: "#14532d",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 10,
              }}
            >
              <Image
                source={require("../../assets/trolley.png")}
                style={{ width: 34, height: 34 }}
                resizeMode="contain"
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="clipboard-text-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="browse/[vertical]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="category/[slug]/index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="category/[slug]/[subId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
          headerShown: true,
          title: "Search",
          headerTitle: "Search",
        }}
      />
      <Tabs.Screen
        name="store/[id]"
        options={{
          href: null,
          headerShown: false,
          title: "Store",
        }}
      />
      <Tabs.Screen
        name="product/[id]"
        options={{
          href: null,
          headerShown: false,
          title: "Product",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
          headerShown: true,
          title: "Help",
        }}
      />
      <Tabs.Screen
        name="delivery"
        options={{
          href: null,
          headerShown: true,
          title: "Deliveries",
        }}
      />
    </Tabs>
  );
}
