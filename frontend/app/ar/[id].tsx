import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { DeviceMotion } from "expo-sensors";
import * as MediaLibrary from "expo-media-library";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, Project } from "@/src/api/client";
import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { WireframeModel, LayerState } from "@/src/components/WireframeModel";
import { GhostSlider } from "@/src/components/GhostSlider";
import { Button } from "@/src/components/ui";

const FALLBACK = "https://images.unsplash.com/photo-1437482078695-73f5ca6c96e2?auto=format&fit=crop&w=940&q=80";

export default function ARView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [project, setProject] = useState<Project | null>(null);
  const [layers, setLayers] = useState<LayerState>({ structural: true, mep: true, electrical: false, plumbing: false });
  const [ghost, setGhost] = useState(0.85);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tracking, setTracking] = useState<"calibrating" | "locked">("calibrating");
  const [toast, setToast] = useState<string | null>(null);

  const isWeb = Platform.OS === "web";
  const canShowCamera = !isWeb && permission?.granted;

  useEffect(() => {
    if (id) api.getProject(id).then((p) => {
      setProject(p);
      const ls: LayerState = { structural: false, mep: false, electrical: false, plumbing: false };
      p.layers.forEach((l) => { (ls as any)[l.key] = l.enabled; });
      setLayers(ls);
    });
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => setTracking("locked"), 1600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isWeb) return;
    DeviceMotion.setUpdateInterval(80);
    const sub = DeviceMotion.addListener((d) => {
      const r = d.rotation;
      if (!r) return;
      setOffset({
        x: Math.max(-60, Math.min(60, -(r.gamma ?? 0) * 80)),
        y: Math.max(-50, Math.min(50, (r.beta ?? 0) * 60 - 30)),
      });
    });
    return () => sub.remove();
  }, [isWeb]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const toggleLayer = (k: keyof LayerState) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLayers((p) => ({ ...p, [k]: !p[k] }));
  };

  const capture = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!canShowCamera || !cameraRef.current) { showToast("CAPTURE SAVED TO SESSION"); return; }
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.granted && pic?.uri) {
        await MediaLibrary.saveToLibraryAsync(pic.uri);
        showToast("AR SNAPSHOT SAVED TO GALLERY");
      } else {
        showToast("SNAPSHOT CAPTURED");
      }
    } catch {
      showToast("CAPTURE FAILED");
    }
  };

  const LAYER_DEFS: { key: keyof LayerState; label: string; color: string }[] = [
    { key: "structural", label: "GRD", color: colors.brand },
    { key: "mep", label: "DRN", color: colors.info },
    { key: "electrical", label: "ERO", color: colors.brandSecondary },
    { key: "plumbing", label: "HAB", color: colors.success },
  ];

  return (
    <View style={styles.root}>
      {/* Camera or fallback */}
      {canShowCamera ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <>
          <Image source={{ uri: FALLBACK }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,15,15,0.35)" }]} />
        </>
      )}

      {/* Wireframe model overlay (center) */}
      <View style={styles.modelLayer} pointerEvents="none">
        {tracking === "locked" && (
          <WireframeModel layers={layers} opacity={ghost} offsetX={offset.x} offsetY={offset.y} />
        )}
      </View>

      <SafeAreaView style={styles.hud} edges={["top", "bottom"]} pointerEvents="box-none">
        {/* Top breadcrumb */}
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable testID="ar-exit-button" onPress={() => router.back()} style={styles.exitBtn}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
          <View style={styles.breadcrumb}>
            <Text style={styles.bcCode}>{project?.code ?? "—"}</Text>
            <Text style={styles.bcLoc} numberOfLines={1}>{project?.location ?? ""}</Text>
          </View>
        </View>

        {/* Tracking status */}
        <View style={styles.statusWrap} pointerEvents="none">
          {tracking === "calibrating" ? (
            <View style={styles.reticle}>
              <Ionicons name="scan-outline" size={64} color={colors.brandSecondary} />
              <Text style={styles.reticleText}>CALIBRATING…</Text>
              <Text style={styles.reticleHint}>Point at a textured surface</Text>
            </View>
          ) : (
            <View style={styles.lockedBadge}>
              <View style={styles.lockDot} />
              <Text style={styles.lockText}>TRACKING LOCKED · DEV +14.2mm</Text>
            </View>
          )}
        </View>

        {/* Right layer toggle column */}
        <View style={styles.layerCol} pointerEvents="box-none">
          {LAYER_DEFS.map((l) => {
            const on = layers[l.key];
            return (
              <Pressable
                key={l.key}
                testID={`ar-layer-${l.key}`}
                onPress={() => toggleLayer(l.key)}
                style={[styles.layerBtn, on && { backgroundColor: l.color, borderColor: l.color }]}
              >
                <Text style={[styles.layerBtnText, on && { color: colors.onBrand }]}>{l.label}</Text>
                <View style={[styles.layerDot, { backgroundColor: on ? colors.onBrand : "rgba(255,255,255,0.35)" }]} />
              </Pressable>
            );
          })}
        </View>

        {/* Bottom controls */}
        <View style={styles.bottom} pointerEvents="box-none">
          <View style={styles.sliderWrap}>
            <GhostSlider testID="ar-ghost-slider" value={ghost} onChange={setGhost} />
          </View>
          <View style={styles.shutterRow} pointerEvents="box-none">
            <View style={styles.measureBox}>
              <Text style={styles.measureLabel}>PLANNED vs BUILT</Text>
              <Text style={styles.measureVal}>Δ 14.2 mm</Text>
            </View>
            <Pressable testID="ar-capture-button" onPress={capture} style={styles.shutter}>
              <View style={styles.shutterInner}><Ionicons name="camera" size={28} color={colors.onBrand} /></View>
            </Pressable>
            <Pressable testID="ar-log-issue-button" onPress={() => router.push(`/issue/new?projectId=${id}`)} style={styles.logBtn}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
              <Text style={styles.logText}>RFI</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Permission gate (native) */}
      {!isWeb && permission && !permission.granted && (
        <View style={styles.permGate}>
          <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
          <Text style={styles.permTitle}>CAMERA REQUIRED</Text>
          <Text style={styles.permHint}>Overlay restoration grading & habitat designs onto the live streambank.</Text>
          <Button testID="grant-camera-button" label="GRANT CAMERA" icon="camera" onPress={requestPermission} style={{ marginTop: spacing.md }} />
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View style={styles.toast} testID="ar-toast"><Text style={styles.toastText}>{toast}</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  modelLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  hud: { flex: 1, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  exitBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,15,15,0.8)", borderWidth: 2, borderColor: "#FFFFFF" },
  breadcrumb: { flex: 1, backgroundColor: "rgba(15,15,15,0.8)", borderWidth: 2, borderColor: "#FFFFFF", paddingHorizontal: spacing.md, paddingVertical: 6 },
  bcCode: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.brandSecondary, letterSpacing: 2 },
  bcLoc: { fontFamily: fonts.text, fontSize: 11, color: "#FFFFFF" },
  statusWrap: { position: "absolute", top: "42%", left: 0, right: 0, alignItems: "center" },
  reticle: { alignItems: "center", gap: 4 },
  reticleText: { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.brandSecondary, letterSpacing: 1 },
  reticleHint: { fontFamily: fonts.text, fontSize: 12, color: "#FFFFFF" },
  lockedBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(15,15,15,0.8)", borderWidth: 1, borderColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: 6 },
  lockDot: { width: 8, height: 8, backgroundColor: colors.success },
  lockText: { fontFamily: fonts.textMedium, fontSize: 11, color: "#FFFFFF", letterSpacing: 0.5 },
  layerCol: { position: "absolute", right: spacing.md, top: "30%", gap: spacing.sm },
  layerBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "rgba(15,15,15,0.8)", borderWidth: 2, borderColor: "#FFFFFF" },
  layerBtnText: { fontFamily: fonts.display, fontSize: 13, color: "#FFFFFF" },
  layerDot: { width: 8, height: 8 },
  bottom: { paddingHorizontal: spacing.md, gap: spacing.md },
  sliderWrap: { backgroundColor: "rgba(15,15,15,0.8)", borderWidth: 2, borderColor: "#FFFFFF", padding: spacing.sm },
  shutterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  measureBox: { backgroundColor: "rgba(15,15,15,0.8)", borderWidth: 2, borderColor: "#FFFFFF", paddingHorizontal: spacing.sm, paddingVertical: 6, width: 110 },
  measureLabel: { fontFamily: fonts.text, fontSize: 9, color: "#FFFFFF", letterSpacing: 0.5 },
  measureVal: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.brandSecondary },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand, borderWidth: 4, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  logBtn: { width: 64, height: 64, backgroundColor: "rgba(15,15,15,0.8)", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  logText: { fontFamily: fonts.textMedium, fontSize: 11, color: "#FFFFFF", letterSpacing: 1 },
  permGate: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,15,0.95)", alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.xs },
  permTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: "#FFFFFF", letterSpacing: 0.5, marginTop: spacing.sm },
  permHint: { fontFamily: fonts.text, fontSize: fontSize.sm, color: "#BBBBBB", textAlign: "center" },
  toast: { position: "absolute", bottom: 140, alignSelf: "center", backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toastText: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.onBrand, letterSpacing: 0.5 },
});
