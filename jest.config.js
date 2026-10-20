/** @type {import('jest').Config} */
const shared = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      transformIgnorePatterns: ['node_modules/(?!(drizzle-orm|@noble)/)'],
    },
    {
      ...shared,
      displayName: 'ui',
      preset: 'jest-expo',
      moduleNameMapper: {
        ...shared.moduleNameMapper,
        // jest-expo's transform does not cover .mjs; use lucide's CommonJS build in tests
        '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
      },
      testMatch: ['<rootDir>/tests/**/*.test.tsx'],
      setupFiles: ['<rootDir>/tests/helpers/setupUi.ts'],
      // jest-expo's own list plus the ESM packages this project adds
      transformIgnorePatterns: [
        '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native|drizzle-orm|@noble))',
        '/node_modules/react-native-reanimated/plugin/',
        '/node_modules/@react-native/babel-preset/',
      ],
    },
  ],
};
