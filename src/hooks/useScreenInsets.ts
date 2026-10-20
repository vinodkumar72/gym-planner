import { useContext } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

/**
 * Safe-area insets with an Android fallback. Inside native-stack modals on Android the provider can report a
 * zero top inset even though the app draws edge-to-edge under the status bar, so we never go below the
 * status bar height there. Works without a provider (insets fall back to 0 / status bar height).
 */
export function useScreenInsets(): { top: number; bottom: number; left: number; right: number } {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const androidStatus = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
  return {
    top: Math.max(insets.top, androidStatus),
    bottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0),
    left: insets.left,
    right: insets.right,
  };
}
