import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { theme } from "@/lib/theme";
import { getWebBase } from "@/lib/web-base";

function Row(props: { icon: any; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        backgroundColor: theme.bgElevated,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: theme.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={props.icon} size={22} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: "900" }}>{props.title}</Text>
        <Text style={{ color: theme.textMuted, fontWeight: "600", marginTop: 2 }} numberOfLines={2}>
          {props.subtitle}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textDim} />
    </Pressable>
  );
}

export default function HelpScreen() {
  const web = getWebBase();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
      <Text style={{ color: theme.text, fontWeight: "900", fontSize: 22, letterSpacing: -0.4 }}>
        Help & support
      </Text>
      <Text style={{ marginTop: 6, color: theme.textMuted, fontWeight: "600", lineHeight: 20 }}>
        Quick shortcuts to common issues. (These open your web portal where needed.)
      </Text>

      <View style={{ marginTop: 16 }}>
        <Row
          icon="help-circle-outline"
          title="FAQ"
          subtitle="Common questions about ordering, COD and delivery"
          onPress={() => Linking.openURL(`${web}/shop/help`)}
        />
        <Row
          icon="clipboard-text-outline"
          title="Track orders"
          subtitle="View your order history on web"
          onPress={() => Linking.openURL(`${web}/shop/orders`)}
        />
        <Row
          icon="account-outline"
          title="Profile"
          subtitle="Update name, avatar and address"
          onPress={() => Linking.openURL(`${web}/shop/profile`)}
        />
      </View>
    </View>
  );
}

