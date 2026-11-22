import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

const logoColors = {
  accent: '#D9A441',
  surface: '#203A20',
  border: 'rgba(217, 164, 65, 0.32)',
};

/** App logo (leaf with heart) used on onboarding, sign-in and quick entry. */
export function AppLogo({ size = 78 }: { size?: number }) {
  const scale = size / 78;
  return (
    <View
      style={[
        styles.shadow,
        { borderRadius: size / 2, shadowRadius: 18 * scale },
      ]}
    >
      <View
        aria-hidden
        style={[
          styles.logo,
          { borderRadius: size / 2, height: size, width: size },
        ]}
      >
        <Ionicons
          name="leaf-outline"
          size={Math.round(34 * scale)}
          color={logoColors.accent}
        />
        <Ionicons
          name="heart-outline"
          size={Math.round(21 * scale)}
          color={logoColors.accent}
          style={{ marginTop: -9 * scale }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    elevation: 7,
    shadowColor: logoColors.accent,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: logoColors.surface,
    borderColor: logoColors.border,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
