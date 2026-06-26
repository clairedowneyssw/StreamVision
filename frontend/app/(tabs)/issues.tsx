import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, Project, Issue } from "@/src/api/client";
import { colors, fonts, fontSize, spacing, statusMeta, tagMeta } from "@/src/theme";
import { Loading, EmptyState, Pill } from "@/src/components/ui";

export default function Issues() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProjects = useCallback(async () => {
    const ps = await api.listProjects();
    setProjects(ps);
    setActiveId((cur) => cur ?? ps[0]?.id ?? null);
  }, []);

  const loadIssues = useCallback(async (pid: string) => {
    setIssues(null);
    const data = await api.projectIssues(pid);
    setIssues(data);
  }, []);

  useFocusEffect(useCallback(() => { loadProjects(); }, [loadProjects]));
  useFocusEffect(useCallback(() => { if (activeId) loadIssues(activeId); }, [activeId, loadIssues]));

  const onRefresh = async () => { setRefreshing(true); if (activeId) await loadIssues(activeId); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>PUNCH LIST</Text>
        <Pressable testID="new-issue-button" style={styles.addBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/issue/new?projectId=${activeId}`); }}>
          <Ionicons name="add" size={26} color={colors.onBrand} />
        </Pressable>
      </View>

      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {projects.map((p) => {
            const active = p.id === activeId;
            return (
              <Pressable
                key={p.id}
                testID={`issue-project-chip-${p.code}`}
                onPress={() => { Haptics.selectionAsync(); setActiveId(p.id); }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && { color: colors.onBrand }]}>{p.code}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {issues === null ? (
        <Loading label="LOADING PUNCH ITEMS" />
      ) : issues.length === 0 ? (
        <EmptyState icon="checkmark-done-circle" title="ALL CLEAR" hint="No punch items on this site." testID="empty-issues" />
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          renderItem={({ item }) => {
            const s = statusMeta[item.status];
            const t = tagMeta[item.tag];
            return (
              <Pressable testID={`issue-row-${item.ref}`} style={styles.row} onPress={() => router.push(`/issue/${item.id}`)}>
                <View style={[styles.statusBlock, { backgroundColor: s.color }]} />
                <View style={{ flex: 1, padding: spacing.md, gap: 6 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.ref}>{item.ref}</Text>
                    <Pill label={t.label} color={t.color} />
                  </View>
                  <Text style={styles.issueTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.rowMeta}>
                    <Ionicons name="location" size={13} color={colors.muted} />
                    <Text style={styles.metaText}>{item.location_label || "Unlocated"}</Text>
                    <Text style={[styles.statusText, { color: s.color }]}>· {s.label}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.onSurface} style={{ alignSelf: "center", marginRight: 8 }} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  addBtn: { width: 48, height: 48, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipBar: { height: 56, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: colors.border },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.md, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.onSurface, letterSpacing: 1 },
  row: { flexDirection: "row", borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  statusBlock: { width: 10 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ref: { fontFamily: fonts.textMedium, fontSize: fontSize.sm, color: colors.onSurface, letterSpacing: 1 },
  issueTitle: { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.onSurface },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  statusText: { fontFamily: fonts.textMedium, fontSize: 12, marginLeft: 4 },
});
