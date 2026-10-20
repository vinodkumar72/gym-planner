import React from 'react';
import { Tabs } from 'expo-router';
import { CalendarDays, Dumbbell, ListChecks, Settings, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
