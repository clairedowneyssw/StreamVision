import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { api, Project } from "@/src/api/client";
import { colors, fonts, fontSize, spacing, syncMeta } from "@/src/theme";
import { Button, Loading, Pill } from "@/src/components/ui";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  const load = useCallback(async () => {
    if (id) setProject(await api.getProject(id));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!project) return <View style={styles.root}><Loading label="LOADING SITE" /></View>;
  const s = syncMeta[project.sync_state];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={styles.hero}>
          <Image source={{ uri: project.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.heroTint} />
          <SafeAreaView edges={["top"]} style={styles.heroBar}>
            <Pressable testID="back-button" onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={[styles.syncPill, { backgroundColor: s.color }]}>
              <Text style={[styles.syncPillText, { color: s.on }]}>{s.label}</Text>
            </View>
          </SafeAreaView>
          <View style={styles.heroFoot}>
            <Text style={styles.heroCode}>{project.code}</Text>
            <Text style={styles.heroName}>{project.name}</Text>
            <Text style={styles.heroLoc}>{project.location}</Text>
          </View>
        </View>

        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {/* Calibration */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SITE CALIBRATION</Text>
            <CalRow icon="navigate" label="GPS ANCHOR" value="LOCKED · ±0.8m" ok />
            <CalRow icon="qr-code" label="VISUAL MARKERS" value="3 / 3 DETECTED" ok />
            <CalRow icon="cube" label="MODEL VERSION" value="v4.2 (412 MB)" ok />
            <CalRow icon="resize" label="MANUAL OFFSET" value="+12mm E · -4mm N" />
            <Button testID="recalibrate-button" label="RECALIBRATE SITE" variant="secondary" icon="refresh" onPress={() => {}} style={{ marginTop: spacing.sm }} />
          </View>

          {/* Layers */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>MODEL LAYERS</Text>
            {project.layers.map((l) => (
              <View key={l.key} style={styles.layerRow}>
                <View style={[styles.swatch, { backgroundColor: l.color }]} />
                <Text style={styles.layerLabel}>{l.label}</Text>
                <Pill label={l.enabled ? "ON" : "OFF"} color={l.enabled ? colors.success : colors.surfaceTertiary} on={l.enabled ? "#FFFFFF" : colors.onSurface} />
              </View>
            ))}
          </View>

          <View style={styles.quickRow}>
            <Pressable testID="open-punch-button" style={styles.quick} onPress={() => router.push("/issues")}>
              <Ionicons name="warning" size={22} color={colors.error} />
              <Text style={styles.quickNum}>{project.open_issues}</Text>
              <Text style={styles.quickLabel}>OPEN ITEMS</Text>
            </Pressable>
            <Pressable testID="open-feed-button" style={styles.quick} onPress={() => router.push("/feed")}>
              <Ionicons name="chatbubbles" size={22} color={colors.info} />
              <Text style={styles.quickNum}>{project.progress}%</Text>
              <Text style={styles.quickLabel}>BUILT</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.launchBar}>
        <Button testID="launch-ar-button" label="LAUNCH AR LIVE VIEW" icon="scan" onPress={() => router.push(`/ar/${project.id}`)} />
      </SafeAreaView>
    </View>
  );
}

function CalRow({ icon, label, value, ok }: { icon: any; label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.calRow}>
      <Ionicons name={icon} size={18} color={colors.onSurface} />
      <Text style={styles.calLabel}>{label}</Text>
      <Text style={[styles.calValue, ok && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 260, backgroundColor: colors.surfaceInverse },
  heroTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,15,0.45)" },
  heroBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,15,15,0.6)", borderWidth: 2, borderColor: "#FFFFFF" },
  syncPill: { height: 36, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  syncPillText: { fontFamily: fonts.textMedium, fontSize: 11, letterSpacing: 0.5 },
  heroFoot: { position: "absolute", left: spacing.md, bottom: spacing.md, right: spacing.md },
  heroCode: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.brandSecondary, letterSpacing: 2 },
  heroName: { fontFamily: fonts.display, fontSize: 28, color: "#FFFFFF", letterSpacing: -0.5 },
  heroLoc: { fontFamily: fonts.text, fontSize: fontSize.sm, color: "#DDDDDD", marginTop: 2 },
  card: { borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  cardTitle: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.muted, letterSpacing: 1.5, marginBottom: 4 },
  calRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
  calLabel: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.onSurface },
  calValue: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.onSurface },
  layerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
  swatch: { width: 18, height: 18, borderWidth: 2, borderColor: colors.border },
  layerLabel: { flex: 1, fontFamily: fonts.display, fontSize: fontSize.base, color: colors.onSurface },
  quickRow: { flexDirection: "row", gap: spacing.md },
  quick: { flex: 1, borderWidth: 2, borderColor: colors.border, padding: spacing.md, alignItems: "flex-start", gap: 4 },
  quickNum: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface },
  quickLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, letterSpacing: 1 },
  launchBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 2, borderTopColor: colors.border, backgroundColor: colors.surface },
});
