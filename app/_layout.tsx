import "react-native-gesture-handler";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Lato_400Regular, Lato_700Bold, Lato_900Black } from "@expo-google-fonts/lato";
import { theme } from "@/lib/theme";
import { applyGlobalTypography, appFonts } from "@/lib/typography";
import { PremiumAlertProvider } from "@/components/PremiumAlertProvider";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [appFonts.regular]: Lato_400Regular,
    [appFonts.medium]: Lato_700Bold,
    [appFonts.bold]: Lato_900Black,
  });

  const fontsReady = fontsLoaded || fontError != null;

  useEffect(() => {
    if (fontsLoaded) applyGlobalTypography();
  }, [fontsLoaded]);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={theme.brandNavOrange} />
      </View>
    );
  }

  return (
    <PremiumAlertProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bgElevated },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700", fontFamily: appFonts.medium },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="location" options={{ headerShown: false }} />
        <Stack.Screen name="store-owner" options={{ headerShown: false }} />
      </Stack>
    </PremiumAlertProvider>
  );
}
