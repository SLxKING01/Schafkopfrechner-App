import { Heart, Leaf } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme';
import { AppIcon } from './AppIcon';

/**
 * App logo (leaf with heart) used on onboarding, sign-in and quick entry.
 * Same motif as before, drawn with Lucide icons like the rest of the app.
 */
export function AppLogo({ size = 78 }: { size?: number }) {
  const large = size >= 70;
  return (
    <View style={[styles.shadow, { borderRadius: size / 2 }]}>
      <View
        aria-hidden
        style={[
          styles.logo,
          { borderRadius: size / 2, height: size, width: size },
        ]}
      >
        <AppIcon
          icon={Leaf}
          size={large ? 'xl' : 'lg'}
          color={authColors.gold}
        />
        <AppIcon
          icon={Heart}
          size={large ? 'md' : 'sm'}
          color={authColors.gold}
          style={styles.heart}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    elevation: 7,
    shadowColor: authColors.gold,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: authColors.surface,
    borderColor: 'rgba(212, 175, 55, 0.32)',
    borderWidth: 1,
    justifyContent: 'center',
  },
  heart: { marginTop: -9 },
});
