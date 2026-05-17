import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

let mockRandomIdCounter = 0;

jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    mockRandomIdCounter += 1;
    return `test-id-${mockRandomIdCounter}`;
  },
}));
