import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, Issue } from "@/src/api/client";
import { colors, fonts, fontSize, spacing, statusMeta, tagMeta } from "@/src/theme";
import { Button, Loading, Pill } from "@/src/components/ui";

const FLOW = ["open", "in_review", "resolved"];

export default function IssueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<Issue | null>(null);

  const load = useCallback(async () => { if (id) setIssue(await api.getIssue(id)); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setStatus = async (status: string) => {
    if (!id) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIssue(await api.updateIssue(id, { status }));
  };

  if (!issue) return <View style={styles.root}><Loading label="LOADING ITEM" /></View>;
  const s = statusMeta[issue.status];
  const t = tagMeta[issue.tag];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="issue-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.ref}>{issue.ref}</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        <View style={[styles.statusBanner, { backgroundColor: s.color }]}>
          <Text style={[styles.statusBannerText, { color: s.on }]}>{s.label}</Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Pill label={t.label} color={t.color} />
          <Text style={styles.title}>{issue.title}</Text>
        </View>

        <View style={styles.card}>
          <Meta icon="location" label="LOCATION" value={issue.location_label || "Unlocated"} />
          <Meta icon="person" label="LOGGED BY" value={issue.author} />
          <Meta icon="time" label="CREATED" value={new Date(issue.created_at).toLocaleString()} />
        </View>

        {issue.description ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>DESCRIPTION</Text>
            <Text style={styles.desc}>{issue.description}</Text>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.cardTitle}>UPDATE STATUS</Text>
          <View style={styles.segment}>
            {FLOW.map((st) => {
              const active = issue.status === st;
              const meta = statusMeta[st];
              return (
                <Pressable key={st} testID={`set-status-${st}`} onPress={() => setStatus(st)} style={[styles.segBtn, active && { backgroundColor: meta.color }]}>
                  <Text style={[styles.segText, active && { color: meta.on }]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        {issue.status === "resolved" ? (
          <Button testID="reopen-button" label="REOPEN ITEM" variant="secondary" icon="refresh" onPress={() => setStatus("open")} />
        ) : (
          <Button testID="resolve-button" label="MARK RESOLVED" icon="checkmark-done" onPress={() => setStatus("resolved")} />
        )}
      </SafeAreaView>
    </View>
  );
}

function Meta({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={18} color={colors.onSurface} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  ref: { fontFamily: fonts.textMedium, fontSize: fontSize.base, color: colors.onSurface, letterSpacing: 1 },
  statusBanner: { paddingVertical: spacing.sm, alignItems: "center", borderWidth: 2, borderColor: colors.border },
  statusBannerText: { fontFamily: fonts.display, fontSize: fontSize.base, letterSpacing: 1 },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface },
  card: { borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.muted, letterSpacing: 1.5 },
  desc: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.onSurface, lineHeight: 22 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaLabel: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, width: 90, letterSpacing: 0.5 },
  metaValue: { flex: 1, fontFamily: fonts.textMedium, fontSize: fontSize.sm, color: colors.onSurface, textAlign: "right" },
  segment: { flexDirection: "row", borderWidth: 2, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRightWidth: 1, borderRightColor: colors.border },
  segText: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.onSurface, letterSpacing: 0.5 },
  footer: { padding: spacing.md, borderTopWidth: 2, borderTopColor: colors.border },
});
