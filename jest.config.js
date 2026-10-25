const path = require('node:path');

const expoModulesCore = require.resolve('expo-modules-core', {
  paths: [require.resolve('expo/package.json')],
});

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // SDK 55+ nests its runtime under expo; resolve the same copy for the Jest preset.
  moduleNameMapper: {
    '^expo-modules-core$': expoModulesCore,
    '^expo-modules-core/(.*)$': path.join(
      path.dirname(expoModulesCore),
      '..',
      '$1',
    ),
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
