module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  resolver: 'react-native-reanimated/jest/resolver',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
