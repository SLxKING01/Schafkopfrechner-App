import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  authColors as c,
  authControlSizes,
  authInteraction,
  authRadius,
  authSpacing as space,
  authTextStyles,
} from '../../theme';
import { AppText } from '../ui/AppText';

export function DashboardSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable
          accessibilityLabel="Dialog schließen"
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View accessibilityViewIsModal style={s.dialog}>
          <View style={s.header}>
            <AppText accessibilityRole="header" style={s.title}>
              {title}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              onPress={onClose}
              style={({ pressed }) => [
                s.close,
                pressed && authInteraction.pressed,
              ]}
            >
              <X size={22} color={c.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
    backgroundColor: c.overlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: authRadius.lg,
    backgroundColor: c.backgroundSoft,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  title: { ...authTextStyles.subtitle, flex: 1, color: c.textPrimary },
  close: {
    minWidth: authControlSizes.touch,
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: space.lg, gap: space.md },
});
