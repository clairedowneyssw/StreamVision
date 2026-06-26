import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/src/theme";

export type LayerState = { structural: boolean; mep: boolean; electrical: boolean; plumbing: boolean };

// Brutalist wireframe building overlay. Reacts to device-motion parallax + ghost opacity.
export function WireframeModel({
  layers, opacity, offsetX = 0, offsetY = 0,
}: {
  layers: LayerState; opacity: number; offsetX?: number; offsetY?: number;
}) {
  const floors = [0, 1, 2, 3, 4];
  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { opacity, transform: [{ translateX: offsetX }, { translateY: offsetY }] },
      ]}
    >
      {/* depth shadow plane */}
      <View style={styles.depth} />

      <View style={styles.building}>
        {floors.map((f) => (
          <View key={f} style={styles.floor}>
            {/* structural slab outline */}
            {layers.structural && <View style={styles.slab} />}
            {/* MEP horizontal duct */}
            {layers.mep && f % 2 === 0 && <View style={styles.mepDuct} />}
            {/* plumbing vertical stack */}
            {layers.plumbing && <View style={styles.plumbStack} />}
            {/* electrical conduit */}
            {layers.electrical && f % 2 === 1 && <View style={styles.elecConduit} />}
          </View>
        ))}
        {/* structural corner columns */}
        {layers.structural && (
          <>
            <View style={[styles.column, { left: -1 }]} />
            <View style={[styles.column, { right: -1 }]} />
          </>
        )}
      </View>

      {/* measurement readouts (planned dims) */}
      <View style={styles.dimTop}><Text style={styles.dimText}>12.40 m</Text></View>
      <View style={styles.dimSide}><Text style={styles.dimText}>18.6 m</Text></View>
    </View>
  );
}

const W = 220;
const FLOOR_H = 52;

const styles = StyleSheet.create({
  wrap: { width: W + 40, height: FLOOR_H * 5 + 60, alignItems: "center", justifyContent: "center" },
  depth: { position: "absolute", width: W, height: FLOOR_H * 5, left: 38, top: 18, borderWidth: 1.5, borderColor: "rgba(255,90,0,0.45)" },
  building: { width: W, height: FLOOR_H * 5, marginRight: 10 },
  floor: { height: FLOOR_H, width: "100%" },
  slab: { position: "absolute", left: 0, right: 0, top: 0, height: FLOOR_H, borderWidth: 2, borderColor: colors.brand },
  mepDuct: { position: "absolute", left: 8, right: 8, top: FLOOR_H / 2 - 3, height: 6, backgroundColor: "rgba(0,85,255,0.85)", borderWidth: 1, borderColor: "#FFFFFF" },
  plumbStack: { position: "absolute", left: W / 2 - 3, top: 0, bottom: 0, width: 6, backgroundColor: "rgba(0,138,0,0.85)" },
  elecConduit: { position: "absolute", right: 24, top: 0, bottom: 0, width: 4, backgroundColor: colors.brandSecondary },
  column: { position: "absolute", top: -2, bottom: -2, width: 3, backgroundColor: colors.brand },
  dimTop: { position: "absolute", top: -2, right: 30, backgroundColor: colors.surfaceInverse, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.brand },
  dimSide: { position: "absolute", bottom: 20, left: 0, backgroundColor: colors.surfaceInverse, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.brand },
  dimText: { fontFamily: fonts.textMedium, fontSize: 10, color: colors.brandSecondary },
});
