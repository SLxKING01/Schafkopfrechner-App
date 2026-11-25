import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';

import { authColors } from '../../theme';

const GOLD = authColors.gold;
const CARD = authColors.surface;

/**
 * App logo "Kartenfächer" used on onboarding, sign-in and quick entry:
 * three Schafkopf cards with Gras and Herz behind and the Eichel in front.
 * Same drawing as assets/brand/logo-mark.svg, which the app icons are rendered from.
 * The viewBox is the round disc; card fills hide the back cards behind the front card.
 */
export function AppLogo({ size = 78 }: { size?: number }) {
  return (
    <View style={[styles.shadow, { borderRadius: size / 2 }]}>
      <View
        aria-hidden
        style={[
          styles.logo,
          { borderRadius: size / 2, height: size, width: size },
        ]}
      >
        <Svg
          width={size}
          height={size}
          viewBox="150 150 724 724"
          fill="none"
          stroke={GOLD}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <G transform="rotate(-18 512 760)">
            <Rect
              x={392}
              y={330}
              width={240}
              height={350}
              rx={30}
              fill={CARD}
              strokeWidth={16}
              strokeOpacity={0.7}
            />
            <G
              transform="translate(434 384) scale(0.45)"
              strokeWidth={22.2}
              strokeOpacity={0.85}
            >
              <Path d="M-40 46 C-52 -10 -10 -52 48 -50 C52 8 10 52 -40 46 Z" />
              <Path d="M-40 46 L14 -8" />
            </G>
          </G>
          <G transform="rotate(18 512 760)">
            <Rect
              x={392}
              y={330}
              width={240}
              height={350}
              rx={30}
              fill={CARD}
              strokeWidth={16}
              strokeOpacity={0.7}
            />
            <G
              transform="translate(590 384) scale(0.42)"
              strokeWidth={23.8}
              strokeOpacity={0.85}
            >
              <Path d="M0 50 C-30 26 -50 6 -50 -14 C-50 -34 -34 -46 -18 -46 C-8 -46 -2 -40 0 -32 C2 -40 8 -46 18 -46 C34 -46 50 -34 50 -14 C50 6 30 26 0 50 Z" />
            </G>
          </G>
          <Rect
            x={392}
            y={330}
            width={240}
            height={350}
            rx={30}
            fill={CARD}
            strokeWidth={18}
          />
          <G transform="translate(512 505) scale(1.75)" strokeWidth={10.3}>
            <Path d="M0 -40 C0 -52 5 -58 14 -62" />
            <Path d="M-38 -6 C-38 -30 -22 -40 0 -40 C22 -40 38 -30 38 -6 Z" />
            <Path d="M-30 -2 C-32 26 -18 48 0 58 C18 48 32 26 30 -2" />
          </G>
        </Svg>
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
    overflow: 'hidden',
  },
});
