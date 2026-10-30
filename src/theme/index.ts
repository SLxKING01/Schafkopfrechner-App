import { authColors } from './colors';
import { authRadius, authSpacing } from './spacing';
import { authTypography } from './typography';

export { authColors } from './colors';
export { authShadows } from './shadows';
export {
  authControlSizes,
  authInteraction,
  authRadius,
  authSpacing,
} from './spacing';
export { authTextStyles, authTypography } from './typography';

/** Compatibility names for older screens, backed by the same green/gold theme. */
export const theme = {
  colors: {
    background: authColors.background,
    surface: authColors.surface,
    surfaceMuted: authColors.backgroundSoft,
    border: authColors.borderSoft,
    text: authColors.textPrimary,
    textMuted: authColors.textSecondary,
    primary: authColors.goldHighlight,
    primaryText: authColors.onGold,
    secondary: authColors.control,
    secondaryText: authColors.textPrimary,
    danger: authColors.error,
    dangerText: authColors.onDanger,
    positive: authColors.accentGreen,
    negative: authColors.error,
    disabled: authColors.disabled,
    disabledText: authColors.textSecondary,
  },
  spacing: authSpacing,
  radius: { sm: authRadius.sm, md: authRadius.md, lg: authRadius.lg },
  typography: {
    title: authTypography.title,
    subtitle: authTypography.subtitle,
    body: authTypography.body,
    caption: authTypography.caption,
  },
};
