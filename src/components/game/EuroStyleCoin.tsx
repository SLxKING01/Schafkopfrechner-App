import { memo } from 'react';
import Svg, { Ellipse, Text as SvgText } from 'react-native-svg';

import { authColors } from '../../theme/colors';

type EuroStyleCoinProps = {
  label: string;
  muted?: boolean;
  tint?: string;
};

export const EuroStyleCoin = memo(function EuroStyleCoin({
  label,
  muted = false,
  tint = authColors.goldHighlight,
}: EuroStyleCoinProps) {
  // Opaque faces hide the lower edge: translucent fills exposed the old
  // vertical hatching through the coin and made it look rectangular.
  const faceColor = muted ? '#304539' : tint;
  const sideColor = muted ? '#42574A' : '#9B7E37';
  const edgeColor = muted ? '#84978A' : '#C8AC61';
  const imprintColor = muted ? '#CAD4CB' : '#3B2B0A';

  return (
    <Svg height={34} viewBox="0 0 52 38" width={46}>
      <Ellipse
        cx="26"
        cy="22"
        rx="22"
        ry="13"
        fill={sideColor}
        stroke={edgeColor}
        strokeWidth="1"
      />
      <Ellipse
        cx="26"
        cy="17"
        rx="22"
        ry="13"
        fill={faceColor}
        stroke={edgeColor}
        strokeWidth="1.2"
      />
      <Ellipse
        cx="26"
        cy="17"
        rx="18"
        ry="9.5"
        fill="none"
        stroke={edgeColor}
        strokeWidth="0.7"
      />
      <SvgText
        fill={imprintColor}
        fontSize="13"
        fontWeight="700"
        textAnchor="middle"
        x="26"
        y="21.5"
      >
        {label}
      </SvgText>
    </Svg>
  );
});
