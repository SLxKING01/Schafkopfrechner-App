describe('Expo Go navigation compatibility', () => {
  it.each([
    ['ios', 'storeClient', true],
    ['ios', 'standalone', false],
    ['ios', 'bare', false],
    ['android', 'storeClient', false],
  ])(
    'selects the correct stack for %s / %s',
    (platform, environment, fallback) => {
      const nativeStack = jest.fn(() => 'native');
      const jsStack = jest.fn(() => 'javascript');
      const enableScreens = jest.fn();
      jest.doMock('@react-navigation/native-stack', () => ({
        createNativeStackNavigator: nativeStack,
      }));
      jest.doMock('@react-navigation/stack', () => ({
        createStackNavigator: jsStack,
      }));
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: { executionEnvironment: environment },
        ExecutionEnvironment: { StoreClient: 'storeClient' },
      }));
      jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
      jest.doMock('react-native-screens', () => ({ enableScreens }));

      jest.isolateModules(() => {
        const runtime = jest.requireActual(
          '../navigation/createAppStackNavigator',
        );
        expect(runtime.createAppStackNavigator()).toBe(
          fallback ? 'javascript' : 'native',
        );
        expect(runtime.usesExpoGoIOSStack).toBe(fallback);
      });
      if (fallback) {
        expect(enableScreens).toHaveBeenCalledWith(false);
        expect(nativeStack).not.toHaveBeenCalled();
      } else {
        expect(enableScreens).not.toHaveBeenCalled();
        expect(jsStack).not.toHaveBeenCalled();
      }
    },
  );
});
