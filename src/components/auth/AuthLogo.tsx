import { Heart, Leaf } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { authColors } from '../../theme/colors';

export function AuthLogo() {
  return (
    <View style={styles.shadow}>
      <View style={styles.logo}>
        <Leaf color={authColors.background} size={34} strokeWidth={2.2} />
        <Heart
          color={authColors.background}
          size={18}
          strokeWidth={2.4}
          style={styles.heart}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 35,
    elevation: 8,
    shadowColor: authColors.gold,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: authColors.gold,
    borderColor: 'rgba(242, 201, 76, 0.58)',
    borderRadius: 35,
    borderWidth: 1,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  heart: {
    marginTop: -9,
  },
});
