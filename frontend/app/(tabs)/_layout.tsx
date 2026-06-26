import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingVertical: 6 },
      }}
      screenListeners={{ tabPress: () => Haptics.selectionAsync() }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "SITES", tabBarIcon: ({ color, focused }) => <TabIcon name="grid" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="issues"
        options={{ title: "PUNCH", tabBarIcon: ({ color, focused }) => <TabIcon name="warning" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: "FEED", tabBarIcon: ({ color, focused }) => <TabIcon name="chatbubbles" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "FIELD", tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    height: Platform.OS === "ios" ? 88 : 68,
    paddingTop: 4,
  },
  label: { fontFamily: fonts.textMedium, fontSize: 9, letterSpacing: 1 },
  iconWrap: { paddingHorizontal: 10, paddingVertical: 2 },
  iconWrapActive: { borderBottomWidth: 3, borderBottomColor: colors.brand },
});
