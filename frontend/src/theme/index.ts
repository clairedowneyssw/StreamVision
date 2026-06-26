// StreamVisionAR — Brutalist industrial theme tokens.
export const colors = {
  surface: "#FFFFFF",
  onSurface: "#0F0F0F",
  surfaceSecondary: "#F2F2F2",
  surfaceTertiary: "#E6E6E6",
  surfaceInverse: "#0F0F0F",
  onSurfaceInverse: "#FFFFFF",
  brand: "#FF5A00",
  onBrand: "#0F0F0F",
  brandSecondary: "#FFC800",
  brandTertiary: "#FFE4CC",
  success: "#008A00",
  onSuccess: "#FFFFFF",
  warning: "#FFC800",
  onWarning: "#0F0F0F",
  error: "#D90000",
  onError: "#FFFFFF",
  info: "#0055FF",
  onInfo: "#FFFFFF",
  border: "#0F0F0F",
  divider: "#CCCCCC",
  muted: "#6B6B6B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = { sm: 0, md: 0, lg: 0, pill: 999 };

export const fonts = {
  display: "SpaceGrotesk-Medium",
  displayRegular: "SpaceGrotesk-Regular",
  text: "IBMPlexMono-Regular",
  textMedium: "IBMPlexMono-Medium",
};

export const fontSize = { sm: 12, base: 16, lg: 20, xl: 24, xxl: 32 };

export const tagMeta: Record<string, { label: string; color: string }> = {
  wrong_install: { label: "WRONG INSTALL", color: colors.error },
  needs_review: { label: "NEEDS REVIEW", color: colors.warning },
  rfi: { label: "RFI", color: colors.info },
  clash: { label: "CLASH", color: colors.brand },
};

export const statusMeta: Record<string, { label: string; color: string; on: string }> = {
  open: { label: "OPEN", color: colors.error, on: "#FFFFFF" },
  in_review: { label: "IN REVIEW", color: colors.warning, on: "#0F0F0F" },
  resolved: { label: "RESOLVED", color: colors.success, on: "#FFFFFF" },
};

export const syncMeta: Record<string, { label: string; color: string; on: string }> = {
  synced: { label: "SYNCED", color: colors.success, on: "#FFFFFF" },
  requires_sync: { label: "REQUIRES SYNC", color: colors.warning, on: "#0F0F0F" },
  offline_cached: { label: "OFFLINE CACHED", color: colors.info, on: "#FFFFFF" },
};
