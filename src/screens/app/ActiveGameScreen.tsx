import { ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { EmptyGameState } from '../../components/game/EmptyGameState';
import { GameTypeSelector } from '../../components/game/GameTypeSelector';
import { MatchHistoryCard } from '../../components/game/MatchHistoryCard';
import { PlayerBalanceCard } from '../../components/game/PlayerBalanceCard';
import { PlayerChip } from '../../components/game/PlayerChip';
import { ScoreCard } from '../../components/game/ScoreCard';
import { AppText } from '../../components/ui/AppText';
import type { AppStackScreenProps } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';
import type { GameType } from '../../types/game';

type ActiveGameScreenProps = AppStackScreenProps<'ActiveGame'>;

function formatAmount(amount: number) {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

function formatGameType(gameType: GameType) {
  const labels: Record<GameType, string> = {
    sauspiel: 'Sauspiel',
    solo: 'Solo',
    wenz: 'Wenz',
    ramsch: 'Ramsch',
    custom: 'Custom',
  };

  return labels[gameType];
}

export function ActiveGameScreen({ navigation }: ActiveGameScreenProps) {
  const currentTable = useGameStore((state) => state.currentTable);
  const players = useGameStore((state) => state.players);
  const rounds = useGameStore((state) => state.rounds);
  const balances = useGameStore((state) => state.balances);
  const addRound = useGameStore((state) => state.addRound);
  const finishGameDay = useGameStore((state) => state.finishGameDay);
  const [winnerId, setWinnerId] = useState('');
  const [loserIds, setLoserIds] = useState<string[]>([]);
  const [amount, setAmount] = useState('10');
  const [gameType, setGameType] = useState<GameType>('sauspiel');

  const openAmount = useMemo(
    () =>
      balances.reduce((sum, balance) => sum + Math.max(0, balance.amount), 0),
    [balances],
  );

  function getPlayerName(id: string) {
    return players.find((player) => player.id === id)?.name ?? 'Unbekannt';
  }

  function toggleLoser(id: string) {
    if (id === winnerId) {
      return;
    }

    setLoserIds((currentLosers) =>
      currentLosers.includes(id)
        ? currentLosers.filter((loserId) => loserId !== id)
        : [...currentLosers, id],
    );
  }

  function saveRound() {
    const numericAmount = Number(amount.replace(',', '.'));
    const didAdd = addRound({
      winnerId,
      loserIds,
      amount: numericAmount,
      gameType,
    });

    if (!didAdd) {
      Alert.alert(
        'Runde unvollstaendig',
        'Bitte Gewinner, mindestens einen Verlierer und Betrag > 0 waehlen.',
      );
      return;
    }

    setWinnerId('');
    setLoserIds([]);
    setAmount('10');
  }

  function finishDay() {
    const didFinish = finishGameDay();

    if (!didFinish) {
      Alert.alert('Kein aktiver Spieltag', 'Starte zuerst einen Spieltisch.');
      return;
    }

    navigation.navigate('Settlement');
  }

  if (!currentTable) {
    return (
      <AuthBackground>
        <View style={styles.center}>
          <EmptyGameState
            icon={ReceiptText}
            title="Kein Spieltisch aktiv"
            message="Erstelle zuerst einen Tisch, um Runden zu erfassen."
          />
          <GoldButton
            title="Tisch erstellen"
            onPress={() => navigation.replace('CreateTable')}
          />
        </View>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Aktiver Tisch</AppText>
        <AppText style={styles.title}>{currentTable.name}</AppText>

        <View style={styles.scoreRow}>
          <ScoreCard label="Runden" value={`${rounds.length}`} />
          <ScoreCard
            label="Offen"
            tone="gold"
            value={formatAmount(openAmount)}
          />
        </View>

        <SectionHeader title="Kontostaende" />
        <View style={styles.balanceStack}>
          {balances.map((balance) => (
            <PlayerBalanceCard
              key={balance.playerId}
              name={getPlayerName(balance.playerId)}
              amount={formatAmount(balance.amount)}
              positive={balance.amount >= 0}
            />
          ))}
        </View>

        <SectionHeader title="Runde erfassen" />
        <View style={styles.formCard}>
          <AppText style={styles.label}>Gewinner</AppText>
          <View style={styles.chipWrap}>
            {players.map((player) => (
              <PlayerChip
                key={player.id}
                name={player.name}
                selected={winnerId === player.id}
                onPress={() => {
                  setWinnerId(player.id);
                  setLoserIds((currentLosers) =>
                    currentLosers.filter((loserId) => loserId !== player.id),
                  );
                }}
              />
            ))}
          </View>

          <AppText style={styles.label}>Verlierer</AppText>
          <View style={styles.chipWrap}>
            {players.map((player) => (
              <PlayerChip
                key={player.id}
                name={player.name}
                selected={loserIds.includes(player.id)}
                onPress={() => toggleLoser(player.id)}
              />
            ))}
          </View>

          <AppText style={styles.label}>Spieltyp</AppText>
          <GameTypeSelector selectedType={gameType} onSelect={setGameType} />

          <AppText style={styles.label}>Betrag</AppText>
          <TextInput
            keyboardType="decimal-pad"
            placeholder="10"
            placeholderTextColor={authColors.textSecondary}
            selectionColor={authColors.gold}
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
          />

          <GoldButton title="Runde speichern" onPress={saveRound} />
        </View>

        <SectionHeader title="Spielverlauf" />
        <View style={styles.historyStack}>
          {rounds.length === 0 ? (
            <EmptyGameState
              icon={ReceiptText}
              title="Noch keine Runden"
              message="Gespeicherte Runden erscheinen hier als Timeline."
            />
          ) : (
            [...rounds].reverse().map((round) => (
              <MatchHistoryCard
                key={round.id}
                amount={formatAmount(round.amount)}
                gameType={formatGameType(round.gameType)}
                losers={round.loserIds.map(getPlayerName).join(', ')}
                time={new Date(round.createdAt).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                winner={getPlayerName(round.winnerId)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.floatingCta}>
        <GoldButton title="Spieltag abschliessen" onPress={finishDay} />
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 150,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.xl,
  },
  center: {
    flex: 1,
    gap: authSpacing.xl,
    justifyContent: 'center',
    padding: authSpacing.xl,
  },
  kicker: {
    color: authColors.goldHighlight,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.hero,
    fontWeight: '900',
    marginTop: authSpacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: authSpacing.md,
    marginTop: authSpacing.xl,
  },
  balanceStack: {
    gap: authSpacing.sm,
  },
  formCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.78)',
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    gap: authSpacing.md,
    padding: authSpacing.lg,
  },
  label: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  amountInput: {
    backgroundColor: authColors.inputFill,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    color: authColors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    minHeight: 58,
    paddingHorizontal: authSpacing.lg,
  },
  historyStack: {
    gap: authSpacing.md,
  },
  floatingCta: {
    bottom: 24,
    left: authSpacing.xl,
    position: 'absolute',
    right: authSpacing.xl,
  },
});
