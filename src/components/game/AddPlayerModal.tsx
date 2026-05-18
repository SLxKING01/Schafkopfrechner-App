import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';

type AddPlayerModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddPlayer: (name: string) => boolean;
};

export function AddPlayerModal({
  visible,
  onClose,
  onAddPlayer,
}: AddPlayerModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleAdd() {
    const didAdd = onAddPlayer(name);

    if (!didAdd) {
      setError('Name ist leer oder bereits vorhanden.');
      return;
    }

    setName('');
    setError('');
    onClose();
  }

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <AppText style={styles.title}>Spieler hinzufuegen</AppText>
          <TextInput
            autoFocus
            placeholder="Name"
            placeholderTextColor={authColors.textSecondary}
            selectionColor={authColors.gold}
            style={styles.input}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError('');
            }}
          />
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          <GoldButton title="Hinzufuegen" onPress={handleAdd} />
          <Pressable onPress={onClose} style={styles.cancel}>
            <AppText style={styles.cancelText}>Abbrechen</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    flex: 1,
    justifyContent: 'center',
    padding: authSpacing.xl,
  },
  card: {
    backgroundColor: authColors.surface,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    gap: authSpacing.md,
    padding: authSpacing.xl,
    width: '100%',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.subtitle,
    fontWeight: '900',
  },
  input: {
    backgroundColor: authColors.inputFill,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    color: authColors.textPrimary,
    fontSize: authTypography.body,
    minHeight: 54,
    paddingHorizontal: authSpacing.lg,
  },
  error: {
    color: '#D65A5A',
    fontSize: authTypography.caption,
    fontWeight: '700',
  },
  cancel: {
    alignItems: 'center',
    padding: authSpacing.sm,
  },
  cancelText: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '800',
  },
});
