import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts } from "@/src/theme";

// Thick-track brutalist slider (0..1). No external deps.
export function GhostSlider({
  value, onChange, onCommit, testID,
}: {
  value: number; onChange: (v: number) => void; onCommit?: (v: number) => void; testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const setFromX = (x: number) => {
    const w = widthRef.current || 1;
    const v = Math.max(0, Math.min(1, x / w));
    onChange(v);
    return v;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderRelease: (e) => {
        const v = setFromX(e.nativeEvent.locationX);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCommit?.(v);
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const pct = Math.round(value * 100);

  return (
    <View testID={testID}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>GHOST MODE</Text>
        <Text style={styles.value}>{pct}%</Text>
      </View>
      <View style={styles.track} onLayout={onLayout} {...pan.panHandlers}>
        <View style={[styles.fill, { width: width * value }]} />
        <View style={[styles.thumb, { left: Math.max(0, Math.min(width - 24, width * value - 12)) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontFamily: fonts.textMedium, fontSize: 11, color: "#FFFFFF", letterSpacing: 1 },
  value: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.brandSecondary },
  track: { height: 28, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 2, borderColor: "#FFFFFF", justifyContent: "center" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.brand },
  thumb: { position: "absolute", width: 24, height: 36, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: colors.border },
});
