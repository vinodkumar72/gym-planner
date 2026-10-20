import React from 'react';
import { Redirect } from 'expo-router';
import { useAppStore } from '@/stores/appStore';

export default function Index() {
  const prefs = useAppStore((s) => s.preferences);
  if (!prefs?.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/today" />;
}
