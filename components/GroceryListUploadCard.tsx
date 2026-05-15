import { type StyleProp, type ViewStyle } from "react-native";
import { QuickGroceryOrderSection } from "@/components/QuickGroceryOrderSection";

type Props = {
  variant?: "home" | "compact";
  style?: StyleProp<ViewStyle>;
};

/** @deprecated Use QuickGroceryOrderSection — kept for category compact embed */
export function GroceryListUploadCard({ variant = "home", style }: Props) {
  return <QuickGroceryOrderSection variant={variant === "compact" ? "compact" : "home"} style={style} />;
}
