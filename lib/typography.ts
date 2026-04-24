import { Text, TextInput } from "react-native";

export const appFonts = {
  regular: "Lato_400Regular",
  medium: "Lato_700Bold",
  bold: "Lato_900Black",
} as const;

let applied = false;

export function applyGlobalTypography() {
  if (applied) return;
  applied = true;

  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  const InputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };

  const textDefaults = TextAny.defaultProps ?? {};
  TextAny.defaultProps = {
    ...textDefaults,
    style: [{ fontFamily: appFonts.regular }, (textDefaults as { style?: unknown }).style],
  };

  const inputDefaults = InputAny.defaultProps ?? {};
  InputAny.defaultProps = {
    ...inputDefaults,
    style: [{ fontFamily: appFonts.regular }, (inputDefaults as { style?: unknown }).style],
  };
}
