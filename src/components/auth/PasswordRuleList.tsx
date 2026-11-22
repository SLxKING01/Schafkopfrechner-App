import { Check, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { authColors, authSpacing } from '../../theme';
import { passwordRules } from '../../utils/passwordRules';
import { AppText } from '../ui/AppText';

/** Live checklist of the password rules below a password field. */
export function PasswordRuleList({ password }: { password: string }) {
  return (
    <View style={styles.row} accessibilityLabel="Passwort-Regeln">
      {passwordRules(password).map((rule) => {
        const color = rule.met
          ? authColors.accentGreen
          : password
            ? authColors.errorText
            : authColors.textSecondary;
        const Icon = rule.met ? Check : X;
        return (
          <View key={rule.id} style={styles.rule}>
            <Icon color={color} size={14} strokeWidth={2.6} />
            <AppText
              style={[styles.text, { color }]}
              accessibilityLabel={`${rule.label}: ${rule.met ? 'erfüllt' : 'nicht erfüllt'}`}
            >
              {rule.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.md,
    marginTop: -authSpacing.xs,
    paddingHorizontal: authSpacing.xs,
  },
  rule: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  text: { fontSize: 12.5, fontWeight: '600' },
});
