import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, Project, Activity } from "@/src/api/client";
import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { Loading, EmptyState } from "@/src/components/ui";

const KIND_ICON: Record<string, any> = { pin: "location", comment: "chatbubble-ellipses", issue: "warning", sync: "cloud-done" };
const KIND_COLOR: Record<string, string> = { pin: colors.brand, comment: colors.info, issue: colors.error, sync: colors.success };

export default function Feed() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<Activity[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const loadProjects = useCallback(async () => {
    const ps = await api.listProjects();
    setProjects(ps);
    setActiveId((cur) => cur ?? ps[0]?.id ?? null);
  }, []);
  const loadFeed = useCallback(async (pid: string) => {
    setItems(null);
    setItems(await api.projectActivity(pid));
  }, []);

  useFocusEffect(useCallback(() => { loadProjects(); }, [loadProjects]));
  useFocusEffect(useCallback(() => { if (activeId) loadFeed(activeId); }, [activeId, loadFeed]));

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await api.createActivity({ project_id: activeId, kind: "comment", author: "You", message: draft.trim() });
    setDraft("");
    await loadFeed(activeId);
    setSending(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>COLLAB FEED</Text></View>
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {projects.map((p) => {
            const active = p.id === activeId;
            return (
              <Pressable key={p.id} testID={`feed-project-chip-${p.code}`} onPress={() => { Haptics.selectionAsync(); setActiveId(p.id); }} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && { color: colors.onBrand }]}>{p.code}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {items === null ? (
        <Loading label="LOADING FEED" />
      ) : items.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="NO ACTIVITY YET" hint="Comments and pins appear here." testID="empty-feed" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <View testID={`feed-item-${item.id}`} style={styles.item}>
              <View style={[styles.kindIcon, { backgroundColor: KIND_COLOR[item.kind] ?? colors.muted }]}>
                <Ionicons name={KIND_ICON[item.kind] ?? "ellipse"} size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.itemTop}>
                  <Text style={styles.author}>{item.author}</Text>
                  {item.anchor ? <Text style={styles.anchor}>@ {item.anchor}</Text> : null}
                </View>
                <Text style={styles.msg}>{item.message}</Text>
              </View>
            </View>
          )}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.composer}>
          <TextInput
            testID="feed-input"
            value={draft}
            onChangeText={setDraft}
            placeholder="Drop a comment…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable testID="feed-send-button" disabled={sending || !draft.trim()} onPress={send} style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}>
            <Ionicons name="send" size={20} color={colors.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  chipBar: { height: 56, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: colors.border },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.md, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.onSurface, letterSpacing: 1 },
  item: { flexDirection: "row", gap: spacing.sm, borderWidth: 2, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surface },
  kindIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border },
  itemTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  author: { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.onSurface },
  anchor: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.brand },
  msg: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.onSurface, lineHeight: 20 },
  composer: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm, borderTopWidth: 2, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  input: { flex: 1, height: 48, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.onSurface },
  sendBtn: { width: 48, height: 48, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
});
