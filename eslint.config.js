const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', 'drizzle/*', 'android/*', 'ios/*', '.expo/*', 'coverage/*'],
  },
  {
    rules: {
      'import/no-unresolved': 'off',
    },
  },
]);
