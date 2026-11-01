import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { CARD_SUIT_PATHS } from '../game/CardSuitIcon';

/** Quiet German-card suits around the edges, leaving the dashboard content in front. */
export function SchafkopfBackdrop() {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.54, 230);
  const motifs = [
    {
      suit: 'eichel',
      color: '#B38B59',
      x: width - size * 0.72,
      y: height * 0.06,
      angle: 18,
      opacity: 0.1,
    },
    {
      suit: 'gras',
      color: '#7DA67D',
      x: -size * 0.38,
      y: height * 0.32,
      angle: -22,
      opacity: 0.095,
    },
    {
      suit: 'herz',
      color: '#C36B62',
      x: width - size * 0.6,
      y: height * 0.61,
      angle: 14,
      opacity: 0.075,
    },
    {
      suit: 'schellen',
      color: '#D3B461',
      x: -size * 0.12,
      y: height * 0.86,
      angle: -16,
      opacity: 0.09,
    },
  ] as const;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        accessible={false}
      >
        <Defs>
          <RadialGradient id="dashboard-leaf-glow">
            <Stop offset="0" stopColor="#3F6B48" stopOpacity={0.12} />
            <Stop offset="1" stopColor="#3F6B48" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="dashboard-gold-glow">
            <Stop offset="0" stopColor="#B8923C" stopOpacity={0.07} />
            <Stop offset="1" stopColor="#B8923C" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={0}
          cy={height * 0.38}
          rx={width * 0.8}
          ry={height * 0.36}
          fill="url(#dashboard-leaf-glow)"
        />
        <Ellipse
          cx={width}
          cy={height * 0.74}
          rx={width * 0.8}
          ry={height * 0.36}
          fill="url(#dashboard-gold-glow)"
        />
        {motifs.map((motif) => (
          <G
            key={motif.suit}
            transform={`translate(${motif.x} ${motif.y}) rotate(${motif.angle} ${size / 2} ${size / 2})`}
            opacity={motif.opacity}
          >
            <Path
              transform={`scale(${size / 24})`}
              d={CARD_SUIT_PATHS[motif.suit]}
              fill={motif.color}
            />
          </G>
        ))}
      </Svg>
    </View>
  );
}
const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
});
