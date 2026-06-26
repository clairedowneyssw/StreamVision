import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { storage } from "@/src/utils/storage";
import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { Button } from "@/src/components/ui";

const ROLES = [
  { key: "gc", label: "GENERAL CONTRACTOR", icon: "construct" },
  { key: "supervisor", label: "SITE SUPERVISOR", icon: "shield-half" },
  { key: "engineer", label: "CIVIL ENGINEER", icon: "git-network" },
  { key: "owner", label: "PROJECT OWNER (VIEW)", icon: "eye" },
] as const;

export default function Onboarding() {
  const router = useRouter();
  const [role, setRole] = useState<string>("supervisor");

  const enter = async () => {
    await storage.setItem("sv_role", role);
    router.replace("/dashboard");
  };

  return (
    <View style={styles.root}>
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=940&q=80" }}
        style={styles.hero}
        contentFit="cover"
      />
      <View style={styles.heroTint} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}><Ionicons name="cube" size={22} color={colors.onBrand} /></View>
          <Text style={styles.brandText}>STREAMVISION<Text style={{ color: colors.brand }}>AR</Text></Text>
        </View>

        <View style={{ flex: 1 }} />

        <Text style={styles.title}>RESTORATION{"\n"}DESIGNS, ON SITE.</Text>
        <Text style={styles.sub}>Overlay grading, drainage & habitat plans onto the streambank in real space. Built for sun, mud, and gloves.</Text>

        <Text style={styles.pickLabel}>SELECT YOUR ROLE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
          {ROLES.map((r) => {
            const active = r.key === role;
            return (
              <Pressable
                key={r.key}
                testID={`role-${r.key}`}
                onPress={() => { Haptics.selectionAsync(); setRole(r.key); }}
                style={[styles.roleChip, active && styles.roleChipActive]}
              >
                <Ionicons name={r.icon as any} size={18} color={active ? colors.onBrand : "#FFFFFF"} />
                <Text style={[styles.roleText, active && { color: colors.onBrand }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Button testID="enter-app-button" label="ENTER FIELD MODE" icon="arrow-forward" onPress={enter} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  hero: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  heroTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,15,0.5)" },
  safe: { flex: 1, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  logoMark: { width: 36, height: 36, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  brandText: { fontFamily: fonts.display, fontSize: fontSize.lg, color: "#FFFFFF", letterSpacing: 0.5 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: "#FFFFFF", letterSpacing: -1 },
  sub: { fontFamily: fonts.text, fontSize: fontSize.base, color: "#CFCFCF", marginTop: spacing.md, lineHeight: 22 },
  pickLabel: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.brandSecondary, letterSpacing: 1.5, marginTop: spacing.xl, marginBottom: spacing.sm },
  roleRow: { gap: spacing.sm, paddingRight: spacing.md },
  roleChip: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: spacing.md, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.06)" },
  roleChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  roleText: { fontFamily: fonts.textMedium, fontSize: 12, color: "#FFFFFF", letterSpacing: 0.5 },
});
