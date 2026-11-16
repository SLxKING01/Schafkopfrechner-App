import type { LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { authColors } from '../../theme/colors';
import {
  type IconSize,
  iconSizes,
  iconStrokes,
  type IconWeight,
} from '../../theme/icons';

export type AppIconComponent = ComponentType<LucideProps>;

type AppIconProps = Omit<LucideProps, 'size' | 'strokeWidth'> & {
  icon: AppIconComponent;
  size?: IconSize;
  weight?: IconWeight;
};

/** Draws a Lucide icon with the shared icon sizes and stroke weights. */
export function AppIcon({
  icon: Icon,
  size = 'md',
  weight = 'regular',
  color = authColors.textPrimary,
  ...props
}: AppIconProps) {
  return (
    <Icon
      {...props}
      color={color}
      size={iconSizes[size]}
      strokeWidth={iconStrokes[weight]}
    />
  );
}
