import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { storage } from "@/src/utils/storage";
import { api, Project } from "@/src/api/client";
import { colors, fonts, fontSize, spacing, syncMeta } from "@/src/theme";
import { Button } from "@/src/components/ui";

const ROLE_LABEL: Record<string, string> = {
  gc: "General Contractor", supervisor: "Site Supervisor",
  engineer: "Civil Engineer", owner: "Project Owner",
};

export default function Profile() {
  const router = useRouter();
  const [role, setRole] = useState("supervisor");
  const [projects, setProjects] = useState<Project[]>([]);

  const load = useCallback(async () => {
    const r = await storage.getItem("sv_role", "supervisor");
    setRole(r ?? "supervisor");
    setProjects(await api.listProjects());
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cached = projects.filter((p) => p.sync_state === "offline_cached" || p.sync_state === "synced");

  const switchRole = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await storage.removeItem("sv_role");
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}>
        <Text style={styles.title}>FIELD PROFILE</Text>

        <View style={styles.idCard}>
          <View style={styles.avatar}><Ionicons name="person" size={34} color={colors.onBrand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{ROLE_LABEL[role] ?? "Field User"}</Text>
            <Text style={styles.idText}>BADGE · SVA-{role.toUpperCase()}-0042</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat value={`${projects.length}`} label="SITES" />
          <Stat value={`${projects.reduce((a, p) => a + p.open_issues, 0)}`} label="OPEN ITEMS" />
          <Stat value={`${cached.length}`} label="CACHED" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>OFFLINE CACHED MODELS</Text>
          {cached.length === 0 ? (
            <Text style={styles.empty}>No models cached for offline use.</Text>
          ) : cached.map((p) => {
            const s = syncMeta[p.sync_state];
            return (
              <View key={p.id} style={styles.cacheRow}>
                <Ionicons name="cube" size={18} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cacheName}>{p.code} · {p.name}</Text>
                  <Text style={styles.cacheMeta}>Model v4.2 · ready for low-connectivity</Text>
                </View>
                <View style={[styles.cacheDot, { backgroundColor: s.color }]} />
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>FIELD SETTINGS</Text>
          <Row icon="contrast" label="High-contrast HUD" value="ON" />
          <Row icon="hand-left" label="Glove mode (large targets)" value="ON" />
          <Row icon="cloud-offline" label="Auto-cache on Wi-Fi" value="ON" />
        </View>

        <Button testID="switch-role-button" label="SWITCH ROLE" variant="secondary" icon="swap-horizontal" onPress={switchRole} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon} size={18} color={colors.onSurface} />
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  idCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 2, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surfaceInverse },
  avatar: { width: 60, height: 60, backgroundColor: colors.brand, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.display, fontSize: fontSize.lg, color: "#FFFFFF" },
  idText: { fontFamily: fonts.text, fontSize: 12, color: colors.brandSecondary, letterSpacing: 1, marginTop: 2 },
  statsRow: { flexDirection: "row", borderWidth: 2, borderColor: colors.border },
  stat: { flex: 1, padding: spacing.md, borderRightWidth: 1, borderRightColor: colors.divider, alignItems: "center" },
  statValue: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface },
  statLabel: { fontFamily: fonts.text, fontSize: 10, color: colors.muted, letterSpacing: 1, marginTop: 2 },
  card: { borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.muted, letterSpacing: 1.5 },
  empty: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted },
  cacheRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
  cacheName: { fontFamily: fonts.textMedium, fontSize: fontSize.sm, color: colors.onSurface },
  cacheMeta: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  cacheDot: { width: 10, height: 10 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
  settingLabel: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.onSurface },
  settingValue: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.success },
});
