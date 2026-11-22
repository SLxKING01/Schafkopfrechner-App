import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../components/auth/AuthBackground';
import { AppText } from '../components/ui/AppText';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { getGameTypeById } from '../constants/gameTypes';
import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import {
  authColors as c,
  authRadius,
  authSpacing as space,
  authTextStyles,
} from '../theme';
import { authTypography } from '../theme/typography';
import { calculateMatchDaySummary } from '../utils/calculateMatchDaySummary';
import { historicalNames } from '../utils/historicalNames';
import { winningIds } from '../utils/winningParty';

type MatchDayDetailsScreenProps = { route: { params: { matchDayId: string } } };

function formatAmount(amount: number, signed = false) {
  const text = `${Math.abs(amount).toFixed(2).replace('.', ',')} €`;
  if (!signed || amount === 0) return amount < 0 ? `−${text}` : text;
  return `${amount > 0 ? '+' : '−'}${text}`;
}

function amountColor(amount: number) {
  if (amount > 0) return styles.positive;
  if (amount < 0) return styles.negative;
  return styles.neutral;
}

/** Read-only view of a game day recorded by an earlier app version. */
export function MatchDayDetailsScreen({ route }: MatchDayDetailsScreenProps) {
  const navigation = useNavigation();
  const { matchDayId } = route.params;
  const games = useGameStore((state) => state.games);
  const players = usePlayerStore((state) => state.players);
  const matchDays = useMatchDayStore((state) => state.matchDays);
  const activeMatchDayId = useMatchDayStore((state) => state.activeMatchDayId);
  const matchDay = matchDays.find((item) => item.id === matchDayId);
  const summary = useMemo(
    () =>
      calculateMatchDaySummary(
        players,
        games.map((game) => ({
          ...game,
          matchDayId: game.matchDayId ?? activeMatchDayId ?? undefined,
        })),
        matchDayId,
      ),
    [games, matchDayId, players, activeMatchDayId],
  );
  const playerNameById = useMemo(
    () => historicalNames(players, games),
    [players, games],
  );
  const getPlayerName = useCallback(
    (id?: string) =>
      id
        ? (playerNameById.get(id) ?? `Name unbekannt (${id.slice(0, 8)})`)
        : 'Unbekannt',
    [playerNameById],
  );
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
  const date = matchDay?.createdAt
    ? new Date(matchDay.createdAt).toLocaleDateString('de-DE')
    : undefined;

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          onBack={goBack}
          kicker="Spieltag"
          title={matchDay?.name ?? 'Spieltag'}
          subtitle={date}
        />
        {!matchDay ? (
          <Notice tone="info">Dieser Spieltag ist nicht mehr vorhanden.</Notice>
        ) : (
          <>
            <AppText style={styles.hint}>
              Aus einer früheren App-Version, ohne Zahlungsstatus.
            </AppText>

            <View style={styles.card}>
              <AppText accessibilityRole="header" style={styles.cardTitle}>
                Endstand
              </AppText>
              {summary.balances.map((balance) => (
                <View key={balance.playerId} style={styles.row}>
                  <AppText style={styles.name}>
                    {getPlayerName(balance.playerId)}
                  </AppText>
                  <AppText style={[styles.amount, amountColor(balance.amount)]}>
                    {formatAmount(balance.amount, true)}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <AppText accessibilityRole="header" style={styles.sectionTitle}>
                Zahlungen
              </AppText>
              {summary.settlements.length === 0 ? (
                <AppText style={styles.hint}>
                  Keine Zahlungen nötig, alle sind ausgeglichen.
                </AppText>
              ) : (
                summary.settlements.map((payment, index) => (
                  <View key={index} style={styles.payment}>
                    <AppText style={styles.paymentTitle}>
                      {getPlayerName(payment.fromPlayerId)} →{' '}
                      {getPlayerName(payment.toPlayerId)}
                    </AppText>
                    <AppText style={styles.paymentAmount}>
                      {formatAmount(payment.amount)}
                    </AppText>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <AppText accessibilityRole="header" style={styles.sectionTitle}>
                Spiele · {summary.games.length}
              </AppText>
              {summary.games.length === 0 ? (
                <AppText style={styles.hint}>
                  Dieser Spieltag enthält keine Spiele.
                </AppText>
              ) : (
                <View style={styles.list}>
                  {summary.games.map((game, index) => {
                    const winners = winningIds(game).map(getPlayerName);
                    return (
                      <View
                        key={game.id ?? index}
                        style={[styles.gameRow, index > 0 && styles.separator]}
                      >
                        <View style={styles.gameCopy}>
                          <AppText style={styles.gameTitle}>
                            {winners.join(' & ')}{' '}
                            {winners.length === 1 ? 'gewinnt' : 'gewinnen'} ·{' '}
                            {getGameTypeById(game.gameTypeId).name}
                          </AppText>
                          <AppText style={styles.hint}>
                            gegen {game.loserIds.map(getPlayerName).join(', ')}
                          </AppText>
                        </View>
                        <AppText style={[styles.amount, styles.positive]}>
                          +{formatAmount(game.amount)}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {summary.playerStats.length ? (
              <View style={styles.card}>
                <AppText accessibilityRole="header" style={styles.cardTitle}>
                  Gewinnquote
                </AppText>
                {summary.playerStats.map((stats) => (
                  <View key={stats.playerId} style={styles.row}>
                    <AppText style={styles.name}>
                      {getPlayerName(stats.playerId)}
                    </AppText>
                    <AppText style={styles.hint}>
                      {stats.wins} gewonnen · {stats.losses} verloren
                    </AppText>
                    <AppText style={styles.rate}>
                      {Math.round(stats.winRate)} %
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.lg,
    paddingBottom: 100,
    paddingHorizontal: space.xl,
  },
  hint: { ...authTextStyles.caption, color: c.textSecondary },
  card: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    gap: space.sm,
    padding: space.lg,
  },
  cardTitle: {
    ...authTextStyles.body,
    color: c.textPrimary,
    fontWeight: '700',
  },
  section: { gap: space.sm },
  sectionTitle: {
    ...authTextStyles.subhead,
    color: c.textPrimary,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'space-between',
  },
  name: { color: c.textPrimary, flex: 1, fontSize: authTypography.label },
  amount: {
    fontSize: authTypography.label,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  positive: { color: '#8FD19A' },
  negative: { color: c.errorText },
  neutral: { color: c.textSecondary },
  payment: {
    alignItems: 'center',
    backgroundColor: c.surfaceElevated,
    borderColor: c.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  paymentTitle: {
    color: c.textPrimary,
    fontSize: authTypography.body,
    fontWeight: '700',
  },
  paymentAmount: {
    color: c.goldHighlight,
    fontSize: authTypography.button,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  list: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
  },
  gameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
  },
  separator: {
    borderTopColor: c.borderSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gameCopy: { flex: 1, gap: 2, minWidth: 0 },
  gameTitle: {
    color: c.textPrimary,
    fontSize: authTypography.label,
    fontWeight: '700',
  },
  rate: {
    color: c.textPrimary,
    fontSize: authTypography.label,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'right',
  },
});
