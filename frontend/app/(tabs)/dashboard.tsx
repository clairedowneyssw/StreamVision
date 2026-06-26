import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { api, Project } from "@/src/api/client";
import { colors, fonts, fontSize, spacing, syncMeta } from "@/src/theme";
import { Loading, EmptyState } from "@/src/components/ui";

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const data = await api.listProjects();
      setProjects(data);
    } catch {
      setError(true);
      setProjects([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalOpen = projects?.reduce((a, p) => a + p.open_issues, 0) ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.kicker}>STREAMVISION<Text style={{ color: colors.brand }}>AR</Text></Text>
          <Text style={styles.title}>JOB SITES</Text>
        </View>
        <View style={styles.syncBadge}>
          <View style={styles.dot} />
          <Text style={styles.syncText}>{totalOpen} OPEN</Text>
        </View>
      </View>

      {projects === null && !error ? (
        <Loading label="SYNCING PROJECTS" />
      ) : error ? (
        <View style={styles.errorBox}><Text style={styles.errorText}>SYNC FAILED. CHECK CONNECTION.</Text></View>
      ) : projects.length === 0 ? (
        <EmptyState icon="alert-circle-outline" title="NO ACTIVE PROJECTS" hint="Projects pushed from the office will appear here." testID="empty-projects" />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          renderItem={({ item }) => {
            const s = syncMeta[item.sync_state];
            return (
              <Pressable
                testID={`project-card-${item.code}`}
                style={styles.card}
                onPress={() => router.push(`/project/${item.id}`)}
              >
                <View style={styles.imgWrap}>
                  <Image source={{ uri: item.image_url }} style={styles.img} contentFit="cover" transition={200} />
                  <View style={styles.codeTag}><Text style={styles.codeText}>{item.code}</Text></View>
                  <View style={[styles.syncPin, { backgroundColor: s.color }]}>
                    <Text style={[styles.syncPinText, { color: s.on }]}>{s.label}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.projName}>{item.name}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="location" size={14} color={colors.muted} />
                    <Text style={styles.metaText}>{item.location}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <Stat label="BUILT" value={`${item.progress}%`} />
                    <Stat label="DEVIATION" value={`${item.deviation_mm}mm`} accent={item.deviation_mm > 20} />
                    <Stat label="OPEN" value={`${item.open_issues}`} accent={item.open_issues > 0} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.error }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  kicker: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.onSurface, letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  syncBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  dot: { width: 8, height: 8, backgroundColor: colors.success },
  syncText: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.onSurface },
  card: { borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  imgWrap: { height: 150, borderBottomWidth: 2, borderBottomColor: colors.border },
  img: { width: "100%", height: "100%" },
  codeTag: { position: "absolute", top: 0, left: 0, backgroundColor: colors.surfaceInverse, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  codeText: { fontFamily: fonts.textMedium, fontSize: 11, color: "#FFFFFF", letterSpacing: 1 },
  syncPin: { position: "absolute", top: 0, right: 0, paddingHorizontal: spacing.sm, paddingVertical: 4, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.border },
  syncPinText: { fontFamily: fonts.textMedium, fontSize: 10, letterSpacing: 0.5 },
  cardBody: { padding: spacing.md, gap: 6 },
  projName: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted },
  statsRow: { flexDirection: "row", marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
  stat: { flex: 1, borderRightWidth: 1, borderRightColor: colors.divider },
  statLabel: { fontFamily: fonts.text, fontSize: 10, color: colors.muted, letterSpacing: 1 },
  statValue: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface, marginTop: 2 },
  errorBox: { margin: spacing.md, backgroundColor: colors.warning, borderWidth: 2, borderColor: colors.border, padding: spacing.md },
  errorText: { fontFamily: fonts.textMedium, fontSize: fontSize.sm, color: colors.onWarning },
});
