import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
    useSegments: () => ['onboarding'],
    useFocusEffect: (cb: () => void) => {
      ReactLib.useEffect(cb, [cb]);
    },
  };
});

const mockActivateRoutine = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('@/db/repositories/routineRepo', () => ({
  activateRoutine: (db: unknown, id: string, now: string) => mockActivateRoutine(db, id, now),
}));
jest.mock('@/db/client', () => ({ getDb: () => ({}) }));

const mockSetPreferences = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('@/stores/appStore', () => ({
  // resolved lazily: imports are hoisted above the mock consts, so the spies must be looked up at call time
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setPreferences: (p: unknown) => mockSetPreferences(p), bump: () => undefined, preferences: null, dataVersion: 0 }),
}));

// eslint-disable-next-line import/first
import Onboarding from '../../app/onboarding/index';

describe('Onboarding', () => {
  it('walks through the steps and saves preferences + active routine', async () => {
    const r = await render(<Onboarding />);
    await fireEvent.press(r.getByTestId('goal-general'));
    await fireEvent.press(r.getByTestId('onboarding-next'));
    await fireEvent.press(r.getByTestId('level-beginner'));
    await fireEvent.press(r.getByTestId('onboarding-next'));
    await fireEvent.press(r.getByTestId('days-3'));
    await fireEvent.press(r.getByTestId('onboarding-next'));
    await fireEvent.press(r.getByTestId('onboarding-next'));
    await fireEvent.press(r.getByTestId('unit-kg'));
    await fireEvent.press(r.getByTestId('onboarding-next'));
    // general fitness goal → General Fitness routine recommended first
    expect(r.getByText('Recommended')).toBeTruthy();
    await fireEvent.press(r.getByTestId('onboarding-finish'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today'), { timeout: 10_000 });
    expect(mockActivateRoutine).toHaveBeenCalledWith({}, 'rt_general_fitness', expect.any(String));
    expect(mockSetPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 'general', experienceLevel: 'beginner', trainingDaysPerWeek: 3, weightUnit: 'kg', onboardingCompleted: 1 }),
    );
  }, 30_000);
});
