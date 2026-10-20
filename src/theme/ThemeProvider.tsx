import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemePreference } from '@/domain/models/types';
import { darkColors, fontSize, lightColors, radius, spacing, type ColorScheme } from './tokens';

export interface Theme {
  dark: boolean;
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
}

const ThemeContext = createContext<Theme | null>(null);

export function buildTheme(dark: boolean): Theme {
  return { dark, colors: dark ? darkColors : lightColors, spacing, radius, fontSize };
}

export function ThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const dark = preference === 'system' ? system === 'dark' : preference === 'dark';
  const theme = useMemo(() => buildTheme(dark), [dark]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  return t ?? buildTheme(false);
}
