import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { api, setSession } from "@/lib/api";
import { theme } from "@/lib/theme";

async function registerPush() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    await api("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  } catch {
    /* optional */
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  async function sendOtp() {
    const path = mode === "in" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "in"
        ? { phone }
        : { phone, name, role: "CUSTOMER" };
    const res = await api(path, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      Alert.alert("Error", res.error || "Failed");
      return;
    }
    Alert.alert("OTP sent", "Enter the code you received by SMS.");
    setStep(2);
  }

  async function verify() {
    const res = await api<{ token: string; user: { id: string; name: string; phone: string; role: string } }>(
      "/api/auth/verify-otp",
      { method: "POST", body: JSON.stringify({ phone, code: otp }) },
    );
    if (!res.ok || !res.data) {
      Alert.alert("Error", res.error || "Invalid OTP");
      return;
    }
    await setSession(res.data.token, res.data.user);
    void registerPush();
    if (res.data.user.role === "DELIVERY") router.replace("/delivery");
    else router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, padding: 16, backgroundColor: theme.bg }}
    >
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <Pressable
          onPress={() => {
            setMode("in");
            setStep(1);
          }}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            backgroundColor: mode === "in" ? theme.bgElevated : "transparent",
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ textAlign: "center", fontWeight: "700", color: theme.text }}>Login</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode("up");
            setStep(1);
          }}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            backgroundColor: mode === "up" ? theme.bgElevated : "transparent",
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ textAlign: "center", fontWeight: "700", color: theme.text }}>Register</Text>
        </Pressable>
      </View>

      {step === 1 && (
        <>
          {mode === "up" && (
            <TextInput
              placeholder="Name"
              value={name}
              onChangeText={setName}
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                backgroundColor: theme.bgElevated,
              }}
            />
          )}
          <TextInput
            placeholder="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              backgroundColor: theme.bgElevated,
            }}
          />
          <Pressable
            onPress={() => void sendOtp()}
            style={{
              backgroundColor: theme.primary,
              padding: 16,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>
              Send OTP
            </Text>
          </Pressable>
        </>
      )}

      {step === 2 && (
        <>
          <TextInput
            placeholder="OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              backgroundColor: theme.bgElevated,
            }}
          />
          <Pressable
            onPress={() => void verify()}
            style={{
              backgroundColor: theme.text,
              padding: 16,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>
              Verify
            </Text>
          </Pressable>
          <Pressable onPress={() => setStep(1)} style={{ marginTop: 12 }}>
            <Text style={{ color: theme.textMuted, textAlign: "center", fontWeight: "600" }}>Change phone</Text>
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
