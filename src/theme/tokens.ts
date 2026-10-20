export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primaryMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  accent: string;
  chart: string[];
}

export const lightColors: ColorScheme = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E3E6EE',
  text: '#0F172A',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  primary: '#2563EB',
  primaryMuted: '#DBEAFE',
  success: '#16A34A',
  successMuted: '#DCFCE7',
  warning: '#D97706',
  warningMuted: '#FEF3C7',
  danger: '#DC2626',
  dangerMuted: '#FEE2E2',
  accent: '#7C3AED',
  chart: ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DC2626'],
};

export const darkColors: ColorScheme = {
  background: '#0B1220',
  surface: '#111A2E',
  surfaceElevated: '#18233B',
  border: '#243049',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  primary: '#3B82F6',
  primaryMuted: '#1E3A8A',
  success: '#22C55E',
  successMuted: '#14532D',
  warning: '#F59E0B',
  warningMuted: '#78350F',
  danger: '#EF4444',
  dangerMuted: '#7F1D1D',
  accent: '#A78BFA',
  chart: ['#60A5FA', '#4ADE80', '#FBBF24', '#C4B5FD', '#F87171'],
};

export const touchTarget = 48;
