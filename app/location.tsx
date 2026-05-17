import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DeliveryAddressForm } from "@/components/DeliveryAddressForm";
import { UnserviceableAreaScreen } from "@/components/UnserviceableAreaScreen";
import { checkServiceAreaGate, type ServiceAreaGateResult } from "@/lib/deliveryAddress";
import { theme } from "@/lib/theme";

type ViewMode = "loading" | "pick" | "unserviceable";

export default function LocationGateScreen() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("loading");
  const [areaLabel, setAreaLabel] = useState("Your area");
  const [cameFromUnserviceable, setCameFromUnserviceable] = useState(false);

  const refreshGate = useCallback(async () => {
    setView("loading");
    const gate: ServiceAreaGateResult = await checkServiceAreaGate();
    if (gate.status === "ok") {
      router.replace("/");
      return;
    }
    if (gate.status === "no_address") {
      setView("pick");
      return;
    }
    setAreaLabel(gate.areaLabel);
    setView("unserviceable");
  }, [router]);

  useEffect(() => {
    void refreshGate();
  }, [refreshGate]);

  if (view === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff1f2" }}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={theme.brandNavOrange} />
      </View>
    );
  }

  if (view === "unserviceable") {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff1f2" }}>
        <StatusBar style="dark" />
        <UnserviceableAreaScreen
          areaLabel={areaLabel}
          onChangeLocation={() => {
            setCameFromUnserviceable(true);
            setView("pick");
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <DeliveryAddressForm
        title={cameFromUnserviceable ? "Change location" : "Select delivery location"}
        showBack={cameFromUnserviceable}
        onBack={() => setView("unserviceable")}
        onSaved={() => {
          setCameFromUnserviceable(false);
          void refreshGate();
        }}
        onUnserviceable={(label) => {
          setAreaLabel(label);
          setCameFromUnserviceable(false);
          setView("unserviceable");
        }}
      />
    </View>
  );
}
