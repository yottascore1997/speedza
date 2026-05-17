import { Alert } from "react-native";

export type PremiumAlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type PremiumAlertConfig = {
  title: string;
  message?: string;
  buttons?: PremiumAlertButton[];
};

export type PremiumAlertVariant = "success" | "error" | "warning" | "info";

type PresentFn = (config: PremiumAlertConfig) => void;

let presentFn: PresentFn | null = null;

export function registerPremiumAlertPresenter(fn: PresentFn) {
  presentFn = fn;
}

export function unregisterPremiumAlertPresenter() {
  presentFn = null;
}

export function inferPremiumAlertVariant(title: string, message?: string): PremiumAlertVariant {
  const blob = `${title} ${message ?? ""}`.toLowerCase();
  if (/\b(error|failed|invalid|denied|restricted|expired|could not|cannot|nahi hua|upload failed|request failed)\b/.test(blob)) {
    return "error";
  }
  if (/\b(saved|success|done|uploaded|updated|sent|captured|cancelled|otp sent|please wait)\b/.test(blob)) {
    return "success";
  }
  if (/\b(sign out|delete|remove|replace|different store|confirm)\b/.test(blob)) {
    return "warning";
  }
  return "info";
}

/** Drop-in replacement for `Alert.alert` with premium in-app UI. */
export function premiumAlert(title: string, message?: string, buttons?: PremiumAlertButton[]) {
  if (presentFn) {
    presentFn({ title, message, buttons });
    return;
  }
  Alert.alert(title, message, buttons);
}
