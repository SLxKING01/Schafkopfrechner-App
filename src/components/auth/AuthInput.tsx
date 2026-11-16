import { Eye, EyeOff, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { authControlSizes, authInteraction } from '../../theme';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { AppIcon } from '../ui/AppIcon';

type AuthInputProps = TextInputProps & {
  icon: ComponentType<LucideProps>;
  hasError?: boolean;
  isPassword?: boolean;
};

export function AuthInput({
  hasError = false,
  icon: Icon,
  isPassword = false,
  onBlur,
  onFocus,
  secureTextEntry,
  style,
  ...props
}: AuthInputProps) {
  const [isHidden, setIsHidden] = useState(isPassword);
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: hasError
            ? authColors.errorBorder
            : focused
              ? authColors.inputFocused
              : authColors.borderGold,
        },
      ]}
    >
      <AppIcon icon={Icon} size="md" color={authColors.gold} />
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
        placeholderTextColor="rgba(161, 161, 161, 0.76)"
        secureTextEntry={isPassword ? isHidden : secureTextEntry}
        selectionColor={authColors.goldHighlight}
        style={[styles.input, style]}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
      />
      {isPassword ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isHidden ? 'Passwort anzeigen' : 'Passwort verbergen'
          }
          accessibilityState={{ selected: !isHidden }}
          onPress={() => setIsHidden((value) => !value)}
          style={({ pressed }) => [
            styles.visibilityButton,
            pressed && authInteraction.pressed,
          ]}
        >
          {isHidden ? (
            <AppIcon icon={Eye} size="md" color={authColors.textSecondary} />
          ) : (
            <AppIcon icon={EyeOff} size="md" color={authColors.textSecondary} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: authColors.inputFill,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: authSpacing.lg,
  },
  input: {
    color: authColors.textPrimary,
    flex: 1,
    fontSize: authTypography.body,
    marginLeft: authSpacing.md,
    paddingVertical: authSpacing.md,
  },
  visibilityButton: {
    minWidth: authControlSizes.touch,
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: authSpacing.sm,
    padding: authSpacing.xs,
  },
});
