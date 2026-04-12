import { useState, useRef, createElement, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, getApiBase, getToken, setSession } from "@/lib/api";
import { theme } from "@/lib/theme";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth, getPublicFirebaseWebConfig } from "@/lib/firebase-client";
import {
  FirebasePhoneAuthWebView,
  type FirebasePhoneAuthWebHandle,
} from "@/components/FirebasePhoneAuthWebView";

const LOGIN_BG = require("../public/images/loginbg.jpeg");

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
  const insets = useSafeAreaInsets();
  const nativeFirebaseCfg = useMemo(() => getPublicFirebaseWebConfig(), []);
  const [bgFailed, setBgFailed] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [onboardName, setOnboardName] = useState("");
  const [onboardAddr, setOnboardAddr] = useState("");
  const [onboardLat, setOnboardLat] = useState<number | null>(null);
  const [onboardLng, setOnboardLng] = useState<number | null>(null);
  const [onboardImageUri, setOnboardImageUri] = useState<string | null>(null);
  const [savingOnboard, setSavingOnboard] = useState(false);
  const authBridgeRef = useRef<FirebasePhoneAuthWebHandle>(null);

  function normalizePhone10(raw: string) {
    const digits = raw.replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }

  async function routeAfterLogin(user: { role: string }) {
    if (user.role === "ADMIN") {
      router.replace("/");
      return;
    }
    if (user.role === "STORE_OWNER") {
      const mine = await api<{ stores: { status: string }[] }>("/api/stores/mine");
      const hasApproved =
        mine.ok && mine.data?.stores?.some((s) => s.status === "APPROVED");
      router.replace(hasApproved ? "/" : "/");
      return;
    }
    if (user.role === "DELIVERY") {
      router.replace("/delivery");
      return;
    }
    router.replace("/");
  }

  async function sendOtp() {
    setLoading(true);
    try {
      const phone10 = normalizePhone10(phone);
      if (phone10.length < 10) {
        Alert.alert("Invalid phone", "Please enter a valid 10-digit mobile number.");
        return;
      }
      const digits = phone.replace(/\D/g, "");
      const e164 = digits.startsWith("91") ? `+${digits}` : `+91${digits}`;
      if (Platform.OS !== "web" && !nativeFirebaseCfg) {
        Alert.alert(
          "Unable to sign in",
          "This app version could not load sign-in settings. Please contact support or try updating the app.",
        );
        return;
      }
      if (Platform.OS === "web") {
        const auth = getFirebaseAuth();
        const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
        const result = await signInWithPhoneNumber(auth, e164, verifier);
        setConfirm(result);
      } else {
        setConfirm(null);
        if (!authBridgeRef.current) {
          Alert.alert("Login", "Phone login is still starting. Wait a second and try again.");
          return;
        }
        await authBridgeRef.current.sendOtp(e164);
      }
      setStep(2);
      Alert.alert("OTP sent", "Enter the code you received by SMS.");
    } catch (e: any) {
      if (Platform.OS !== "web") {
        authBridgeRef.current?.reset();
      }
      const code = e?.code ?? "";
      const msg = e?.message || "Could not send OTP";
      Alert.alert(
        "OTP failed",
        code ? `${code}\n\n${msg}` : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (Platform.OS === "web" && !confirm) {
      Alert.alert("Session expired", "Please request OTP again.");
      setStep(1);
      return;
    }
    if (Platform.OS !== "web" && !authBridgeRef.current) {
      Alert.alert("Session expired", "Please request OTP again.");
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      let idToken: string;
      if (Platform.OS === "web") {
        const cred = await confirm!.confirm(otp.replace(/\s/g, ""));
        idToken = await cred.user.getIdToken();
      } else {
        const code = otp.replace(/\s/g, "");
        if (!code) {
          Alert.alert("OTP required", "Enter the code from SMS.");
          return;
        }
        idToken = await authBridgeRef.current!.verifyOtp(code);
      }
      const res = await api<{
        token: string;
        needsProfile?: boolean;
        user: { id: string; name: string; phone: string; role: string };
      }>("/api/auth/firebase", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok || !res.data) {
        Alert.alert(
          res.status === 0 ? "Cannot reach server" : "Login failed",
          res.error || "Unknown error",
        );
        return;
      }
      await setSession(res.data.token, res.data.user);
      if (res.data.needsProfile && res.data.user.role === "CUSTOMER") {
        setOnboardName(res.data.user.name && res.data.user.name !== "Customer" ? res.data.user.name : "");
        setStep(3);
        return;
      }
      void registerPush();
      await routeAfterLogin(res.data.user);
    } catch (e: any) {
      const code = e?.code ?? "";
      const msg = e?.message || "Please try again.";
      Alert.alert("Invalid OTP", code ? `${code}\n\n${msg}` : msg);
    } finally {
      setLoading(false);
    }
  }

  async function captureLocation() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Allow location access to save delivery address.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setOnboardLat(pos.coords.latitude);
    setOnboardLng(pos.coords.longitude);
    Alert.alert("Location captured");
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow gallery access to upload profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setOnboardImageUri(result.assets[0].uri);
    }
  }

  async function saveOnboarding() {
    if (!onboardName.trim()) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }
    setSavingOnboard(true);
    try {
      const nameRes = await api("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: onboardName.trim() }),
      });
      if (!nameRes.ok) {
        Alert.alert("Error", nameRes.error || "Could not save name");
        return;
      }

      if (onboardAddr.trim()) {
        if (typeof onboardLat !== "number" || typeof onboardLng !== "number") {
          Alert.alert("Location needed", "Capture location to save address.");
          return;
        }
        const addrRes = await api("/api/user/address", {
          method: "POST",
          body: JSON.stringify({
            label: "Home",
            address: onboardAddr.trim(),
            latitude: onboardLat,
            longitude: onboardLng,
          }),
        });
        if (!addrRes.ok) {
          Alert.alert("Error", addrRes.error || "Could not save address");
          return;
        }
      }

      if (onboardImageUri) {
        const token = await getToken();
        if (token) {
          const fd = new FormData();
          const ext = onboardImageUri.split(".").pop()?.toLowerCase() || "jpg";
          const mime = ext === "png" ? "image/png" : "image/jpeg";
          fd.append("file", {
            uri: onboardImageUri,
            name: `avatar.${ext}`,
            type: mime,
          } as any);
          const up = await fetch(`${getApiBase()}/api/user/avatar`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd as any,
          });
          if (!up.ok) {
            const j = (await up.json().catch(() => null)) as any;
            Alert.alert("Error", j?.error || "Could not upload photo");
            return;
          }
        }
      }

      void registerPush();
      await routeAfterLogin({ role: "CUSTOMER" });
    } finally {
      setSavingOnboard(false);
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: "rgba(196, 210, 203, 0.9)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#fafcfb",
    fontSize: 16,
    color: theme.text,
  } as const;

  const cardInner = (
    <View style={styles.card}>
        {step !== 3 ? (
          <>
            <Text style={styles.cardTitle}>{step === 1 ? "Welcome back" : "Enter OTP"}</Text>
            <Text style={styles.cardSub}>
              {step === 1
                ? "Sign in with your mobile number — we’ll text you a code."
                : "We sent a verification code to your phone."}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Complete profile</Text>
            <Text style={styles.cardSub}>
              Name required. Address and photo are optional.
            </Text>
          </>
        )}

        {Platform.OS !== "web" && !nativeFirebaseCfg && step === 1 ? (
          <Text style={styles.configWarn}>
            Sign-in is not available on this build. Install an updated release or contact support.
          </Text>
        ) : null}

        {step === 1 && (
          <>
            <TextInput
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.textDim}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={inputStyle}
            />
            <Pressable
              disabled={loading || (Platform.OS !== "web" && !nativeFirebaseCfg)}
              onPress={() => void sendOtp()}
              style={({ pressed }) => [
                styles.btnPrimary,
                { opacity: loading ? 0.65 : pressed ? 0.92 : 1 },
              ]}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? "Sending…" : "Send OTP"}
              </Text>
            </Pressable>
          </>
        )}

        {step === 2 && (
          <>
            <TextInput
              placeholder="6-digit OTP"
              placeholderTextColor={theme.textDim}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              style={inputStyle}
            />
            <Pressable
              disabled={loading}
              onPress={() => void verify()}
              style={({ pressed }) => [
                styles.btnDark,
                { opacity: loading ? 0.65 : pressed ? 0.92 : 1 },
              ]}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? "Verifying…" : "Verify & continue"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setStep(1)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Change phone number</Text>
            </Pressable>
          </>
        )}

        {step === 3 && (
          <>
            <TextInput
              placeholder="Full name"
              placeholderTextColor={theme.textDim}
              value={onboardName}
              onChangeText={setOnboardName}
              style={inputStyle}
            />

            <TextInput
              placeholder="Delivery address (optional)"
              placeholderTextColor={theme.textDim}
              value={onboardAddr}
              onChangeText={setOnboardAddr}
              multiline
              style={[
                inputStyle,
                { minHeight: 96, textAlignVertical: "top" },
              ]}
            />

            <Pressable
              onPress={() => void captureLocation()}
              style={styles.btnOutline}
            >
              <Text style={styles.btnOutlineText}>Capture location</Text>
            </Pressable>

            {typeof onboardLat === "number" && typeof onboardLng === "number" ? (
              <Text style={styles.coords}>
                Lat {Math.round(onboardLat * 10000) / 10000}, Lng{" "}
                {Math.round(onboardLng * 10000) / 10000}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void pickAvatar()}
              style={styles.btnOutline}
            >
              <Text style={styles.btnOutlineText}>
                {onboardImageUri ? "Change profile photo" : "Upload photo (optional)"}
              </Text>
            </Pressable>

            <Pressable
              disabled={savingOnboard}
              onPress={() => void saveOnboarding()}
              style={({ pressed }) => [
                styles.btnPrimary,
                { opacity: savingOnboard ? 0.65 : pressed ? 0.92 : 1, marginTop: 4 },
              ]}
            >
              <Text style={styles.btnPrimaryText}>
                {savingOnboard ? "Saving…" : "Continue"}
              </Text>
            </Pressable>
          </>
        )}
    </View>
  );

  const bottomPad = Math.max(insets.bottom, 16) + 8;
  const { height: winH } = Dimensions.get("window");
  const maxCardScrollH = winH * 0.56;

  /** Fills all space above the login card so the photo runs down to “Welcome back”. */
  const heroSection = bgFailed ? (
    <LinearGradient
      colors={[theme.brandGreenDark, theme.brandGreen, theme.homeCanvasBg]}
      locations={[0, 0.55, 1]}
      style={styles.heroFill}
    >
      <View style={{ flex: 1 }} />
    </LinearGradient>
  ) : (
    <ImageBackground
      source={LOGIN_BG}
      style={styles.heroFill}
      imageStyle={styles.heroImage}
      onError={() => setBgFailed(true)}
    >
      <View style={{ flex: 1 }} />
    </ImageBackground>
  );

  const bottomSection =
    step === 3 ? (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[styles.cardScroll, { maxHeight: maxCardScrollH }]}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {cardInner}
      </ScrollView>
    ) : (
      <View style={{ paddingBottom: bottomPad }}>
        {cardInner}
        <Text style={styles.footerNote}>Secured with Firebase phone verification</Text>
      </View>
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.screenBg }}
    >
      <StatusBar style="dark" />
      {Platform.OS === "web"
        ? createElement("div", {
            id: "recaptcha-container",
            style: { position: "fixed", left: -9999, width: 1, height: 1, overflow: "hidden" },
          })
        : null}
      {Platform.OS !== "web" && nativeFirebaseCfg ? (
        <FirebasePhoneAuthWebView ref={authBridgeRef} firebaseConfig={nativeFirebaseCfg} />
      ) : null}

      <View style={{ flex: 1 }}>
        {heroSection}
        <View style={styles.bottomPanel}>{bottomSection}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heroFill: {
    flex: 1,
    width: "100%",
    minHeight: 0,
  },
  heroImage: {
    resizeMode: "cover",
  },
  bottomPanel: {
    flexShrink: 0,
    backgroundColor: theme.screenBg,
    paddingHorizontal: 20,
  },
  cardScroll: {
    flexGrow: 0,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    shadowColor: "#022c22",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.text,
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textMuted,
    lineHeight: 20,
    marginBottom: 18,
  },
  configWarn: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    lineHeight: 18,
  },
  btnPrimary: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: theme.brandGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDark: {
    backgroundColor: theme.text,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16,
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.bgElevated,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  btnOutlineText: {
    color: theme.text,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 15,
  },
  linkBtn: { marginTop: 14, paddingVertical: 8 },
  linkText: {
    color: theme.primary,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
  },
  coords: {
    color: theme.textMuted,
    fontWeight: "700",
    marginBottom: 10,
    fontSize: 13,
  },
  footerNote: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: theme.textMuted,
  },
});
