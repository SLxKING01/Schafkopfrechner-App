import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLoadingScreen } from './src/components/AppLoadingScreen';
import { AppViewport } from './src/components/preview/AppViewport';
import { StorageNotice } from './src/components/StorageNotice';
import { RootNavigator } from './src/navigation/RootNavigator';

const fonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fonts);
  return (
    <AppViewport>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          {fontsLoaded || fontError ? <RootNavigator /> : <AppLoadingScreen />}
          <StorageNotice />
          <StatusBar style="light" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppViewport>
  );
}

const styles = {
  root: {
    flex: 1,
  },
};
