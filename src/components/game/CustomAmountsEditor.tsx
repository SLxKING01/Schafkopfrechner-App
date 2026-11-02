import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  authColors,
  authRadius,
  authSpacing,
  authTextStyles,
} from '../../theme';
import type { Player } from '../../types/game';
import type { CustomRoundDraft } from '../../utils/customRound';
import { summarizeCustomRound } from '../../utils/customRound';
import { formatOverviewMoney } from '../../utils/gameOverview';
import { AppText } from '../ui/AppText';

type Props = {
  players: Player[];
  entries: CustomRoundDraft;
  onChange: (entries: CustomRoundDraft) => void;
  disabled: boolean;
};
export function CustomAmountsEditor({
  players,
  entries,
  onChange,
  disabled,
}: Props) {
  const summary = summarizeCustomRound(players, entries);
  return (
    <View style={s.stack}>
      <AppText style={s.note}>
        Verteile die Beträge frei. Plus und Minus müssen sich genau ausgleichen.
      </AppText>
      {players.map((player) => {
        const entry = entries[player.id] ?? { amount: '0,00', negative: false };
        return (
          <View key={player.id} style={s.row}>
            <AppText style={s.name}>{player.name}</AppText>
            <View style={s.controls}>
              <View style={s.signs}>
                {[false, true].map((negative) => (
                  <Pressable
                    key={String(negative)}
                    accessibilityRole="button"
                    accessibilityLabel={`${player.name} ${negative ? 'Minus' : 'Plus'}`}
                    accessibilityState={{
                      selected: entry.negative === negative,
                    }}
                    disabled={disabled}
                    onPress={() =>
                      onChange({
                        ...entries,
                        [player.id]: { ...entry, negative },
                      })
                    }
                    style={[s.sign, entry.negative === negative && s.selected]}
                  >
                    <AppText style={s.signText}>
                      {negative ? '− Minus' : '+ Plus'}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel={`Betrag für ${player.name}`}
                keyboardType="decimal-pad"
                value={entry.amount}
                editable={!disabled}
                onChangeText={(amount) =>
                  onChange({ ...entries, [player.id]: { ...entry, amount } })
                }
                style={s.input}
                selectTextOnFocus
              />
              <AppText style={s.note}>€</AppText>
            </View>
          </View>
        );
      })}
      <View style={s.summary} accessibilityLiveRegion="polite">
        <AppText style={s.name}>Summe</AppText>
        <AppText style={s.total}>
          {summary.totalCents === null
            ? '–'
            : `${summary.totalCents > 0n ? '+' : ''}${formatOverviewMoney(summary.totalCents)}`}
        </AppText>
      </View>
      {summary.totalCents !== null && summary.totalCents !== 0n ? (
        <AppText style={s.note}>
          Noch{' '}
          {formatOverviewMoney(
            summary.totalCents < 0n ? -summary.totalCents : summary.totalCents,
          )}{' '}
          {summary.totalCents > 0n ? 'auf der Minusseite' : 'auf der Plusseite'}{' '}
          ausgleichen.
        </AppText>
      ) : null}
      <AppText style={s.note}>
        Wirkt auf den Tischsaldo und Verlauf. Zählt nicht als gespielte Runde;
        Geber und Leger bleiben erhalten.
      </AppText>
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: authSpacing.md },
  row: {
    gap: authSpacing.sm,
    paddingVertical: authSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.borderSoft,
  },
  name: {
    color: authColors.textPrimary,
    ...authTextStyles.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  note: {
    color: authColors.textSecondary,
    ...authTextStyles.body,
    lineHeight: 22,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    flexWrap: 'wrap',
  },
  signs: {
    flexDirection: 'row',
    gap: authSpacing.xs,
    flexGrow: 1,
    minWidth: 150,
  },
  sign: {
    minHeight: 44,
    paddingHorizontal: authSpacing.sm,
    justifyContent: 'center',
    borderRadius: authRadius.sm,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    flex: 1,
  },
  signText: { ...authTextStyles.caption, color: authColors.textPrimary },
  selected: {
    backgroundColor: authColors.control,
    borderColor: authColors.borderGold,
  },
  input: {
    color: authColors.textPrimary,
    ...authTextStyles.body,
    backgroundColor: authColors.surface,
    borderRadius: authRadius.sm,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    minHeight: 44,
    width: 96,
    paddingHorizontal: authSpacing.sm,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: authSpacing.sm,
    paddingVertical: authSpacing.md,
  },
  total: {
    color: authColors.goldHighlight,
    ...authTextStyles.subtitle,
    fontVariant: ['tabular-nums'],
  },
});
