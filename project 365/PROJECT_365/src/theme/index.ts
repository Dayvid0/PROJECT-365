// ============================================================
// PROJECT_365 — Design tokens & theme
// ============================================================

export const COLORS = {
  // Primary brand
  primary: '#7C5CFC',
  primaryLight: '#9B7EFF',
  primaryDark: '#5A3DD9',

  // Status colours
  complete: '#22C55E',    // green
  partial: '#F59E0B',     // amber
  missed: '#EF4444',      // red
  noLog: '#6B7280',       // gray

  // Category palette
  health: '#22C55E',
  learning: '#3B82F6',
  mindset: '#8B5CF6',
  work: '#F59E0B',
  routine: '#EC4899',
  other: '#6B7280',
};

export const DARK_THEME = {
  background: '#0F0F17',
  surface: '#1A1A2E',
  surfaceElevated: '#232338',
  border: '#2D2D4A',
  text: '#F1F0FF',
  textSecondary: '#A0A0C0',
  textMuted: '#606080',

  primary: COLORS.primary,
  primaryLight: COLORS.primaryLight,

  complete: COLORS.complete,
  partial: COLORS.partial,
  missed: COLORS.missed,
  noLog: COLORS.noLog,

  tabBar: '#12121F',
  tabBarBorder: '#2D2D4A',
  tabBarActive: COLORS.primary,
  tabBarInactive: '#606080',
};

export const LIGHT_THEME = {
  background: '#F5F5FF',
  surface: '#FFFFFF',
  surfaceElevated: '#EEEEFF',
  border: '#E0E0F0',
  text: '#1A1A2E',
  textSecondary: '#4A4A6A',
  textMuted: '#8A8AAA',

  primary: COLORS.primary,
  primaryLight: COLORS.primaryLight,

  complete: COLORS.complete,
  partial: COLORS.partial,
  missed: COLORS.missed,
  noLog: COLORS.noLog,

  tabBar: '#FFFFFF',
  tabBarBorder: '#E0E0F0',
  tabBarActive: COLORS.primary,
  tabBarInactive: '#8A8AAA',
};

export type AppTheme = typeof DARK_THEME;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const FONT_WEIGHT: Record<string, '400' | '500' | '600' | '700' | '800'> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const CATEGORY_COLORS: Record<string, string> = {
  health: COLORS.health,
  learning: COLORS.learning,
  mindset: COLORS.mindset,
  work: COLORS.work,
  routine: COLORS.routine,
  other: COLORS.other,
};

export const CELL_SIZE = 38; // minimum tap target
