import { View } from 'react-native';

import { partyBalances } from '../utils/winningParty';
import { AppText } from './ui/AppText';

export function PartySummary({
  players,
  winnerIds,
  loserIds,
  amount,
  textColor = '#111827',
}: {
  players: { id: string; name: string }[];
  winnerIds: string[];
  loserIds: string[];
  amount: number;
  textColor?: string;
}) {
  if (
    !winnerIds.length ||
    winnerIds.some((id) => !id) ||
    !loserIds.length ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return null;
  const shares = partyBalances(
    [],
    [{ winnerId: winnerIds[0], winnerIds, loserIds, amount }],
  );
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
      <AppText style={{ color: textColor }}>
        Transfer insgesamt: {amount.toFixed(2).replace('.', ',')} €
      </AppText>
      <AppText variant="caption" style={{ color: textColor }}>
        Gesamttransfer zwischen den Parteien, kein Tarif pro Spieler.
      </AppText>
      {shares.map((share) => (
        <AppText key={share.playerId} style={{ color: textColor }}>
          {players.find((player) => player.id === share.playerId)?.name ??
            'Name unbekannt'}{' '}
          {share.amount >= 0 ? 'erhält' : 'zahlt'}{' '}
          {Math.abs(share.amount).toFixed(2).replace('.', ',')} €
        </AppText>
      ))}
    </View>
  );
}
