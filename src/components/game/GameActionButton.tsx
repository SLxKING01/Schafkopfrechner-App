import { ChevronRight } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { AppText } from '../ui/AppText';

type Props = Pick<
  PressableProps,
  | 'accessibilityHint'
  | 'accessibilityLabel'
  | 'disabled'
  | 'hitSlop'
  | 'onPress'
> & {
  title: string;
  loading?: boolean;
  style?: ViewStyle;
};

const gold = '#E7C65C';

export function GameActionButton({
  title,
  loading = false,
  disabled,
  style,
  ...props
}: Props) {
  const blocked = disabled || loading;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && styles.pressed,
        blocked && styles.disabled,
      ]}
    >
      <AppText style={styles.text}>{title}</AppText>
      {loading ? (
        <ActivityIndicator color={gold} size="small" />
      ) : (
        <ChevronRight color={gold} size={18} strokeWidth={2.4} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(231, 198, 92, 0.22)',
    backgroundColor: 'rgba(231, 198, 92, 0.14)',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.988 }],
  },
  disabled: { opacity: 0.68 },
  text: { color: gold, fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
