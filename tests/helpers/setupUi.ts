// Jest setup for component tests. Native modules that have no JS fallback are mocked here.

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({ execSync: jest.fn(), getAllSync: jest.fn(() => []) })),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
  activateKeepAwakeAsync: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-${Math.random().toString(36).slice(2)}`,
  getRandomBytes: (n: number) => new Uint8Array(n),
}));
