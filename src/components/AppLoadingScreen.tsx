import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { theme } from '../constants/theme';
import { AppText } from './ui/AppText';

export function AppLoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <AppText variant="caption">Schafkopfrechner wird geladen...</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
});
