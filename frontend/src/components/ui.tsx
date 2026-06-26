import React from "react";
import {
  Text, View, StyleSheet, Pressable, ActivityIndicator, TextStyle, ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

// ---- Text ----
export function AppText({ style, children, mono, weight, ...rest }: any) {
  const family = mono
    ? weight === "medium" ? fonts.textMedium : fonts.text
    : weight === "medium" ? fonts.display : fonts.displayRegular;
  return <Text {...rest} style={[{ fontFamily: family, color: colors.onSurface }, style]}>{children}</Text>;
}

// ---- Pill / badge ----
export function Pill({ label, color, on, testID }: { label: string; color: string; on?: string; testID?: string }) {
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[styles.pillText, { color: on ?? "#FFFFFF" }]}>{label}</Text>
    </View>
  );
}

// ---- Primary button ----
export function Button({
  label, onPress, variant = "primary", icon, testID, disabled, style,
}: {
  label: string; onPress: () => void; variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: keyof typeof Ionicons.glyphMap; testID?: string; disabled?: boolean; style?: ViewStyle;
}) {
  const bg = variant === "primary" ? colors.brand
    : variant === "danger" ? colors.error
    : variant === "ghost" ? "transparent" : colors.surface;
  const fg = variant === "primary" ? colors.onBrand
    : variant === "danger" ? colors.onError : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} style={{ marginRight: spacing.sm }} /> : null}
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// ---- Section header inside screens ----
export function ScreenHeader({ title, subtitle, right, testID }: { title: string; subtitle?: string; right?: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ---- Loading ----
export function Loading({ label = "LOADING" }: { label?: string }) {
  return (
    <View style={styles.center} testID="loading-state">
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

// ---- Empty state ----
export function EmptyState({ icon, title, hint, testID }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint?: string; testID?: string }) {
  return (
    <View style={styles.center} testID={testID}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={48} color={colors.onSurface} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start" },
  pillText: { fontFamily: fonts.textMedium, fontSize: 10, letterSpacing: 0.5 },
  btn: {
    minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.border, paddingHorizontal: spacing.lg,
  },
  btnText: { fontFamily: fonts.display, fontSize: fontSize.base, letterSpacing: 0.5 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  headerSub: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  loadingText: { fontFamily: fonts.textMedium, fontSize: fontSize.sm, color: colors.muted, letterSpacing: 1 },
  emptyIcon: { width: 96, height: 96, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface, textAlign: "center" },
  emptyHint: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted, textAlign: "center" },
});
