import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api/client";
import { colors, fonts, fontSize, spacing, tagMeta } from "@/src/theme";
import { Button } from "@/src/components/ui";

const TAGS = ["wrong_install", "needs_review", "rfi", "clash"];

export default function NewIssue() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tag, setTag] = useState("needs_review");
  const [loc, setLoc] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const captureGps = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = await Location.getCurrentPositionAsync({});
        setLoc(`GPS ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        setLoc("Location permission denied");
      }
    } catch {
      setLoc("GPS unavailable");
    }
    setLocating(false);
  };

  const submit = async () => {
    if (!title.trim() || !projectId) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await api.createIssue({ project_id: projectId, title: title.trim(), description: desc.trim(), tag, location_label: loc, author: "You" });
    router.back();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="new-issue-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>NEW PUNCH ITEM</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Field label="TITLE *">
            <TextInput testID="issue-title-input" value={title} onChangeText={setTitle} placeholder="e.g. Column offset from grid" placeholderTextColor={colors.muted} style={styles.input} />
          </Field>

          <Field label="ISSUE TYPE">
            <View style={styles.tagWrap}>
              {TAGS.map((t) => {
                const active = t === tag;
                const meta = tagMeta[t];
                return (
                  <Pressable key={t} testID={`tag-${t}`} onPress={() => { Haptics.selectionAsync(); setTag(t); }} style={[styles.tagChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}>
                    <Text style={[styles.tagText, active && { color: "#FFFFFF" }]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="DESCRIPTION">
            <TextInput testID="issue-desc-input" value={desc} onChangeText={setDesc} placeholder="Describe the anomaly…" placeholderTextColor={colors.muted} multiline style={[styles.input, { height: 110, textAlignVertical: "top", paddingTop: spacing.sm }]} />
          </Field>

          <Field label="LOCATION">
            <TextInput testID="issue-loc-input" value={loc} onChangeText={setLoc} placeholder="Level / Grid reference" placeholderTextColor={colors.muted} style={styles.input} />
            <Button testID="capture-gps-button" label={locating ? "LOCATING…" : "CAPTURE GPS"} variant="secondary" icon="navigate" onPress={captureGps} style={{ marginTop: spacing.sm }} />
          </Field>
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <Button testID="submit-issue-button" label="LOG PUNCH ITEM" icon="checkmark" disabled={!title.trim() || saving} onPress={submit} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface, letterSpacing: 0.5 },
  label: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.muted, letterSpacing: 1.5 },
  input: { borderWidth: 2, borderColor: colors.border, minHeight: 52, paddingHorizontal: spacing.md, fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tagChip: { height: 44, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  tagText: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.onSurface },
  footer: { padding: spacing.md, borderTopWidth: 2, borderTopColor: colors.border, backgroundColor: colors.surface },
});
