import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import type { AnimalAvatarId } from '../../types/profile';

type AnimalAvatarProps = {
  animalId: AnimalAvatarId;
  accentColor: string;
  highlighted?: boolean;
  size?: number;
};

const animalTheme: Record<
  AnimalAvatarId,
  {
    earColor: string;
    faceColor: string;
    markColor: string;
    monogram: string;
    snoutColor: string;
  }
> = {
  bear: {
    earColor: '#7A5638',
    faceColor: '#A77A4F',
    markColor: '#D8B27B',
    monogram: 'BR',
    snoutColor: '#E2C28F',
  },
  boar: {
    earColor: '#6E4F43',
    faceColor: '#9A6857',
    markColor: '#D8AA87',
    monogram: 'BO',
    snoutColor: '#D7A190',
  },
  deer: {
    earColor: '#A77845',
    faceColor: '#C28A4B',
    markColor: '#F0C985',
    monogram: 'DE',
    snoutColor: '#F1D3A0',
  },
  fox: {
    earColor: '#A95E33',
    faceColor: '#D8863D',
    markColor: '#F5C06B',
    monogram: 'FX',
    snoutColor: '#F1D2A4',
  },
  owl: {
    earColor: '#7C6548',
    faceColor: '#B18A58',
    markColor: '#E3C98B',
    monogram: 'OW',
    snoutColor: '#DDB75F',
  },
  rabbit: {
    earColor: '#B98C78',
    faceColor: '#D7B2A0',
    markColor: '#F2D7C8',
    monogram: 'RB',
    snoutColor: '#F4C8BD',
  },
  raccoon: {
    earColor: '#5B6263',
    faceColor: '#8A9290',
    markColor: '#323B3B',
    monogram: 'RC',
    snoutColor: '#CED2C9',
  },
  wolf: {
    earColor: '#65706F',
    faceColor: '#8A9693',
    markColor: '#C5CEC6',
    monogram: 'WF',
    snoutColor: '#D8DED7',
  },
};

export function AnimalAvatar({
  animalId,
  accentColor,
  highlighted = false,
  size = 44,
}: AnimalAvatarProps) {
  const theme = animalTheme[animalId];
  const earSize = size * 0.26;
  const eyeSize = Math.max(3, size * 0.085);
  const snoutWidth = size * 0.36;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: highlighted ? accentColor : 'rgba(245, 245, 245, 0.1)',
          height: size,
          shadowColor: highlighted ? accentColor : '#000000',
          width: size,
        },
      ]}
    >
      <LinearGradient
        colors={[accentColor, theme.faceColor]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.gradient}
      />
      <View
        style={[
          styles.ear,
          styles.leftEar,
          {
            backgroundColor: theme.earColor,
            height: earSize,
            width: earSize,
          },
        ]}
      />
      <View
        style={[
          styles.ear,
          styles.rightEar,
          {
            backgroundColor: theme.earColor,
            height: earSize,
            width: earSize,
          },
        ]}
      />
      <View
        style={[
          styles.faceMark,
          {
            backgroundColor: theme.markColor,
            height: size * 0.32,
            opacity: animalId === 'raccoon' ? 0.92 : 0.26,
            top: size * 0.27,
            width: size * 0.76,
          },
        ]}
      />
      <View style={styles.eyes}>
        <View
          style={[
            styles.eye,
            { height: eyeSize, width: eyeSize },
            animalId === 'raccoon' && styles.lightEye,
          ]}
        />
        <View
          style={[
            styles.eye,
            { height: eyeSize, width: eyeSize },
            animalId === 'raccoon' && styles.lightEye,
          ]}
        />
      </View>
      <View
        style={[
          styles.snout,
          {
            backgroundColor: theme.snoutColor,
            height: size * 0.22,
            top: size * 0.56,
            width: snoutWidth,
          },
        ]}
      >
        <View style={styles.nose} />
      </View>
      <Text style={[styles.monogram, { fontSize: size * 0.16 }]}>
        {theme.monogram}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 5,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  ear: {
    borderRadius: 999,
    position: 'absolute',
    top: 2,
  },
  leftEar: {
    left: 5,
  },
  rightEar: {
    right: 5,
  },
  faceMark: {
    borderRadius: 999,
    position: 'absolute',
  },
  eyes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  eye: {
    backgroundColor: '#17150B',
    borderRadius: 999,
  },
  lightEye: {
    backgroundColor: '#F5F5F5',
  },
  snout: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    position: 'absolute',
  },
  nose: {
    backgroundColor: '#17150B',
    borderRadius: 999,
    height: 4,
    width: 7,
  },
  monogram: {
    bottom: 5,
    color: 'rgba(23, 21, 11, 0.54)',
    fontWeight: '900',
    position: 'absolute',
  },
});
