import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { getToken } from "@/lib/api";
import { cartTotalQty, getCart, subscribeCart } from "@/lib/cart";

export default function TabsLayout() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [cartQty, setCartQty] = useState(0);

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      setAuthed(Boolean(token));
      setChecking(false);
    })();
  }, []);

  const syncCart = () => {
    void getCart().then((lines) => setCartQty(cartTotalQty(lines)));
  };

  useEffect(() => {
    syncCart();
    return subscribeCart(syncCart);
  }, []);

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

  const badge =
    cartQty > 0 ? (cartQty > 99 ? "99+" : String(cartQty)) : undefined;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.brandNavOrange,
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "800", fontSize: 17, color: "#ffffff" },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.brandNavOrange,
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: theme.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: theme.tabBarBorder,
          elevation: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 10, marginTop: -2 },
        tabBarIconStyle: { marginBottom: -2 },
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
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          headerShown: false,
          tabBarBadge: badge,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" size={size} color={color} />
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
          headerShown: true,
          title: "Store",
        }}
      />
      <Tabs.Screen
        name="product/[id]"
        options={{
          href: null,
          headerShown: true,
          title: "Product",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          headerShown: true,
          title: "Profile & address",
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
