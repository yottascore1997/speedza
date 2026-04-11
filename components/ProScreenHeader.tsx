import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";

type Props = {
  title: string;
  subtitle?: string;
  /** Quick jump to shop home (replaces unreliable native tab header on some devices). */
  onHomePress?: () => void;
};

export function ProScreenHeader({ title, subtitle, onHomePress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: theme.brandGreen,
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 22,
              fontWeight: "900",
              letterSpacing: -0.4,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: "rgba(255,255,255,0.88)",
                marginTop: 4,
                fontSize: 13,
                fontWeight: "600",
              }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onHomePress ? (
          <Pressable
            onPress={onHomePress}
            accessibilityRole="button"
            accessibilityLabel="Go to home"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="storefront-outline" size={24} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
