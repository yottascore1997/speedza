import { useCallback, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { clearSession, getUser, type User } from "@/lib/api";
import { theme } from "@/lib/theme";

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setUser(await getUser());
      })();
    }, []),
  );

  async function logout() {
    await clearSession();
    setUser(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16, paddingBottom: 24 + insets.bottom }}>
      <View
        style={{
          backgroundColor: theme.bgElevated,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="account" size={32} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            {user ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }}>{user.name}</Text>
                <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 4, fontWeight: "600" }}>
                  {user.phone}
                </Text>
                <Text style={{ fontSize: 12, color: theme.primary, marginTop: 6, fontWeight: "800" }}>
                  {user.role}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text }}>Guest</Text>
                <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 4 }}>Sign in for orders and saved address</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {!user ? (
        <Pressable
          onPress={() => router.push("/login")}
          style={{
            backgroundColor: theme.primary,
            paddingVertical: 16,
            borderRadius: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800", fontSize: 16 }}>Sign in</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() =>
            Alert.alert("Sign out?", "You will need to sign in again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void logout() },
            ])
          }
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.bgElevated,
            paddingVertical: 16,
            borderRadius: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: theme.roseText, textAlign: "center", fontWeight: "800", fontSize: 16 }}>
            Sign out
          </Text>
        </Pressable>
      )}

      {user?.role === "DELIVERY" ? (
        <Pressable
          onPress={() => router.push("/delivery")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: theme.bgElevated,
            padding: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <MaterialCommunityIcons name="bike-fast" size={24} color={theme.primary} />
          <Text style={{ fontWeight: "800", color: theme.text, fontSize: 16 }}>Delivery dashboard</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
