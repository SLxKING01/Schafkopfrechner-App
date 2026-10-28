import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import {
  createDefaultTableSettings,
  getGameRules,
} from '../../constants/tableSettings';
import { reliableStorage } from '../../storage/reliableStorage';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import type {
  CardSuit,
  CreateRoundPayload,
  GameRound,
  GameTable,
  GameType,
  Player,
  RoundTariffOptions,
} from '../../types/game';
import {
  getStockBalanceCents,
  isValidRound,
  roundWinnerIds,
  toSafeCents,
} from '../../utils/accounting';
import {
  cardSuits,
  formatRoundGameType,
  supportsCardSuit,
} from '../../utils/cardSuits';
import { formatOverviewMoney } from '../../utils/gameOverview';
import {
  calculatePartyAmount,
  calculateRoundTariff,
  emptyTariffOptions,
} from '../../utils/roundTariff';
import { AuthBackground } from '../auth/AuthBackground';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';
import { InteractionSheet } from '../ui/InteractionSheet';
import { CardSuitIcon } from './CardSuitIcon';
import { EuroStyleCoin } from './EuroStyleCoin';
import { GameTypeSelector } from './GameTypeSelector';

const AmountInput = Platform.OS === 'web' ? TextInput : BottomSheetTextInput;
const EntryScrollView =
  Platform.OS === 'web' ? ScrollView : BottomSheetScrollView;
type Draft = {
  correctedLegerPlayerIds?: string[];
  suit?: CardSuit;
  gameType: GameType;
  choosing: boolean;
  winners: string[];
  losers: string[];
  declarer: string;
  partner: string;
  solo: string;
  won: boolean;
  options: RoundTariffOptions;
  manual: boolean;
  manualAmount: string;
  payStock: boolean;
  stockCompletesDeal: boolean;
};
type CachedDraft = {
  draft: Draft;
  revision: string;
  committedId: string | null;
};
// Session-only drafts: identical behavior for new rounds and corrections, including remounts.
const drafts = new Map<string, CachedDraft>();
type Props = {
  table: GameTable | null;
  players: Player[];
  editingRound: GameRound | null;
  visible: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onSaved: () => void;
};
function initialDraft(table: GameTable | null, round: GameRound | null): Draft {
  const winners = round ? [...roundWinnerIds(round)] : [];
  const losers = round ? [...round.loserIds] : [];
  return {
    suit: round?.suit,
    gameType:
      round?.gameType === 'sauspiel'
        ? 'rufspiel'
        : (round?.gameType ?? 'rufspiel'),
    choosing: !round,
    winners,
    losers,
    declarer: round?.declarerId ?? '',
    partner: round?.partnerId ?? '',
    solo:
      winners.length === 1 ? winners[0] : losers.length === 1 ? losers[0] : '',
    won: round?.declarerId
      ? winners.includes(round.declarerId)
      : winners.length !== 3,
    options: round?.tariffOptions
      ? { ...round.tariffOptions }
      : {
          ...emptyTariffOptions,
          legerCount: round ? 0 : (table?.placedLegerPlayerIds?.length ?? 0),
          turboRamsch: round ? false : (table?.turboRamschEnabled ?? false),
        },
    manual: !!round && !round.tariffOptions,
    manualAmount: round ? String(round.amount).replace('.', ',') : '',
    payStock: round?.stockAction === 'payout',
    stockCompletesDeal: round ? (round.stockCompletesDeal ?? true) : false,
  };
}
export function RoundEntrySheet({
  table,
  players,
  editingRound,
  visible,
  onClose,
  onDismiss,
  onSaved,
}: Props) {
  const rounds = useGameStore((state) => state.rounds);
  const currentTable = useGameStore((state) => state.currentTable);
  const key = `${table?.id ?? 'none'}:${editingRound?.id ?? 'new'}`;
  const revision = `${editingRound?.updatedAt ?? editingRound?.createdAt ?? ''}:${players
    .map(({ id }) => id)
    .sort()
    .join(',')}`;
  const cached = drafts.get(key);
  const [draft, setDraft] = useState<Draft>(() =>
    cached?.revision === revision
      ? cached.draft
      : initialDraft(table, editingRound),
  );
  const committed = useRef<string | null>(
    cached?.revision === revision ? cached.committedId : null,
  );
  const savingLock = useRef(false);
  const [committedId, setCommittedId] = useState<string | null>(
    cached?.revision === revision ? cached.committedId : null,
  );
  const baseline = useRef(JSON.stringify(initialDraft(table, editingRound)));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [closeChoice, setCloseChoice] = useState(false);
  const [details, setDetails] = useState(false);
  const patch = (change: Partial<Draft>) => {
    if (saving || committedId) return;
    // Older tables may have Stoß disabled. Selecting Kontra/Re explicitly
    // enables it for future rounds while historic snapshots stay untouched.
    if (!editingRound && (change.options?.stoss ?? 0) > 0) {
      const state = useGameStore.getState();
      const active = state.currentTable;
      if (!active || active.id !== table?.id) return;
      if (
        !active.settings.bonusRules.stoss.enabled &&
        !state.updateCurrentTableSettings({
          ...active.settings,
          bonusRules: {
            ...active.settings.bonusRules,
            stoss: { ...active.settings.bonusRules.stoss, enabled: true },
          },
        })
      )
        return;
    }
    setDraft((current) => ({ ...current, ...change }));
  };
  const settings =
    editingRound?.settingsSnapshot ??
    (currentTable?.id === table?.id ? currentTable?.settings : undefined) ??
    table?.settings ??
    createDefaultTableSettings();
  const rules = getGameRules(settings, draft.gameType);
  const enabledTypes = Object.entries(settings.games)
    .filter(([, entry]) => entry.enabled)
    .map(([id]) => id as GameType);
  const sauspiel = ['rufspiel', 'sauspiel'].includes(draft.gameType);
  const partnerGame =
    sauspiel || ['hochzeit', 'kreuzbock'].includes(draft.gameType);
  const stockDeposit =
    draft.gameType === 'stock' &&
    (!editingRound ||
      editingRound.gameType !== 'stock' ||
      editingRound.stockAction === 'deposit');
  const guided = !draft.manual;
  const stockBefore = getStockBalanceCents(
    editingRound
      ? rounds.slice(
          0,
          rounds.findIndex(({ id }) => id === editingRound.id),
        )
      : rounds,
  );
  const stockUnit = toSafeCents(settings.games.stock.value);
  const originalLeger = editingRound?.tariffOptions?.legerCount ?? 0;
  const placedLegerIds = editingRound
    ? (draft.correctedLegerPlayerIds ??
      editingRound.roundContext?.legerPlayerIds ??
      [])
    : ((currentTable?.id === table?.id
        ? currentTable?.placedLegerPlayerIds
        : table?.placedLegerPlayerIds) ?? []);
  const canKnock =
    !draft.manual &&
    rules.bonuses.leger &&
    settings.bonusRules.leger.enabled &&
    (!editingRound || !!editingRound.roundContext);
  function toggleKnock(playerId: string) {
    if (saving || committedId || !canKnock) return;
    if (editingRound) {
      if (!placedLegerIds.includes(playerId) && placedLegerIds.length >= 4)
        return;
      patch({
        correctedLegerPlayerIds: placedLegerIds.includes(playerId)
          ? placedLegerIds.filter((id) => id !== playerId)
          : [...placedLegerIds, playerId],
      });
    } else {
      const state = useGameStore.getState();
      if (state.currentTable?.id === table?.id)
        state.togglePlayerLeger(playerId);
    }
  }
  const effectiveOptions: RoundTariffOptions = {
    ...draft.options,
    legerCount:
      rules.bonuses.leger && settings.bonusRules.leger.enabled
        ? editingRound
          ? (draft.correctedLegerPlayerIds?.length ?? originalLeger)
          : Math.min(4, placedLegerIds.length)
        : 0,
    turboRamsch: editingRound
      ? (editingRound.tariffOptions?.turboRamsch ?? false)
      : (table?.turboRamschEnabled ?? false),
  };
  const stockPayout =
    !stockDeposit &&
    sauspiel &&
    draft.payStock &&
    (!draft.declarer || draft.won);
  let tariff: ReturnType<typeof calculateRoundTariff> | null = null;
  let party: ReturnType<typeof calculatePartyAmount> | null = null;
  let calculationError = '';
  try {
    if (!draft.manual && !stockDeposit) {
      tariff = calculateRoundTariff(settings, draft.gameType, effectiveOptions);
      party = calculatePartyAmount(
        tariff.totalCents,
        draft.gameType,
        draft.winners.length,
        draft.losers.length,
        settings.gameRules ||
          effectiveOptions.durchmarsch !== undefined ||
          effectiveOptions.jungfrauen !== undefined
          ? effectiveOptions
          : undefined,
      );
    }
  } catch (error) {
    calculationError =
      error instanceof Error ? error.message : 'Bitte Eingabe prüfen.';
  }
  const manualCents = toSafeCents(Number(draft.manualAmount.replace(',', '.')));
  const amountCents = stockDeposit
    ? (stockUnit ?? 0) * 4
    : draft.manual
      ? (manualCents ?? 0)
      : (party?.totalCents ?? 0);
  const payload: CreateRoundPayload = {
    ...(editingRound && draft.correctedLegerPlayerIds
      ? { legerPlayerIds: draft.correctedLegerPlayerIds }
      : {}),
    ...(draft.suit && supportsCardSuit(draft.gameType)
      ? { suit: draft.suit }
      : {}),
    gameType: draft.gameType,
    winnerId: stockDeposit ? '' : (draft.winners[0] ?? ''),
    winnerIds: stockDeposit ? [] : draft.winners,
    loserIds: stockDeposit ? players.map(({ id }) => id) : draft.losers,
    amount: amountCents / 100,
    stockAction: stockDeposit ? 'deposit' : stockPayout ? 'payout' : undefined,
    ...(stockDeposit ? { stockCompletesDeal: draft.stockCompletesDeal } : {}),
    ...(sauspiel && (draft.declarer || draft.partner)
      ? { declarerId: draft.declarer, partnerId: draft.partner }
      : {}),
    ...(!draft.manual && !stockDeposit
      ? { tariffOptions: effectiveOptions }
      : {}),
  };
  let hint = '';
  if (!stockDeposit && guided && sauspiel && !draft.declarer)
    hint = 'Bitte Sauspieler wählen.';
  else if (!stockDeposit && guided && sauspiel && !draft.partner)
    hint = 'Bitte Partner wählen.';
  else if (!stockDeposit && guided && !partnerGame && !draft.solo)
    hint =
      draft.gameType === 'ramsch'
        ? `Bitte ${draft.options.durchmarsch ? 'Durchmarsch-Gewinner' : 'Ramsch-Verlierer'} wählen.`
        : 'Bitte Alleinspieler wählen.';
  else if (stockDeposit && players.length !== 4)
    hint = 'Für Stock müssen vier Spieler am Tisch sein.';
  else if (stockPayout && stockBefore <= 0)
    hint = 'Kein auszahlbarer Stock vorhanden.';
  else if (draft.manual && (manualCents === null || manualCents <= 0))
    hint = 'Bitte einen gültigen Betrag in ganzen Cent eingeben.';
  else if (calculationError) hint = calculationError;
  const valid =
    !hint &&
    isValidRound(payload, players) &&
    (stockDeposit
      ? settings.games.stock.enabled
      : draft.manual
        ? manualCents !== null && manualCents > 0
        : !!party);
  if (!valid && !hint)
    hint = 'Bitte das Ergebnis für alle beteiligten Spieler prüfen.';
  const immutable = saving || !!committedId;
  const gameLabel = formatRoundGameType(draft.gameType, draft.suit);

  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility('Rundeneingabe geöffnet');
  }, [visible]);

  function requestClose() {
    if (savingLock.current) return;
    if (JSON.stringify(draft) === baseline.current && !committed.current) {
      onClose();
      return;
    }
    setCloseChoice(true);
  }
  function leave(keep: boolean) {
    if (keep)
      drafts.set(key, {
        draft: { ...draft },
        revision,
        committedId: committed.current,
      });
    else {
      drafts.delete(key);
      setDraft(initialDraft(table, editingRound));
      setSaveError('');
    }
    setCloseChoice(false);
    onClose();
  }
  function changeGame(type: GameType) {
    if (type === draft.gameType) {
      patch({ choosing: false });
      return;
    }
    const targetRules = getGameRules(settings, type);
    patch({
      gameType: type,
      suit: undefined,
      choosing: false,
      winners: [],
      losers: [],
      declarer: '',
      partner: '',
      solo: '',
      won: true,
      payStock: false,
      manual: false,
      manualAmount: '',
      options: {
        ...emptyTariffOptions,
        legerCount: targetRules.bonuses.leger ? originalLeger : 0,
        turboRamsch: effectiveOptions.turboRamsch,
        ...(type === 'ramsch' ? { durchmarsch: false, jungfrauen: 0 } : {}),
      },
    });
    setSaveError('');
  }
  function selectParty(declarer: string, partner: string, won = draft.won) {
    const actualPartner = partner === declarer ? '' : partner;
    const ids = [declarer, actualPartner].filter(Boolean);
    const others = players
      .map(({ id }) => id)
      .filter((id) => !ids.includes(id));
    patch({
      declarer,
      partner: actualPartner,
      won,
      payStock: false,
      winners: ids.length === 2 ? (won ? ids : others) : [],
      losers: ids.length === 2 ? (won ? others : ids) : [],
    });
  }
  function selectSolo(id: string, won = draft.won) {
    const actualWon =
      draft.gameType === 'ramsch' ? !!draft.options.durchmarsch : won;
    const others = players
      .map((player) => player.id)
      .filter((playerId) => playerId !== id);
    patch({
      solo: id,
      won: actualWon,
      payStock: false,
      winners: actualWon ? [id] : others,
      losers: actualWon ? others : [id],
    });
  }
  function toggle(id: string, side: 'winner' | 'loser') {
    const current = side === 'winner' ? draft.winners : draft.losers;
    const ids = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id];
    patch(
      side === 'winner'
        ? {
            winners: ids,
            losers: draft.losers.filter((value) => value !== id),
            payStock: false,
          }
        : {
            losers: ids,
            winners: draft.winners.filter((value) => value !== id),
            payStock: false,
          },
    );
  }
  async function save() {
    if (savingLock.current || (!committed.current && !valid)) return;
    savingLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (!committed.current) {
        const state = useGameStore.getState();
        if (state.currentTable?.id !== table?.id)
          throw new Error(
            'Der aktive Tisch hat sich geändert. Bitte die Eingabe erneut öffnen.',
          );
        const result = editingRound
          ? state.updateRound(editingRound.id, payload)
          : state.addRound(payload);
        if (!result)
          throw new Error(
            'Runde nicht eingetragen. Bitte Parteien, Tarife und den Stock vor späteren Auszahlungen prüfen.',
          );
        committed.current =
          editingRound?.id ?? useGameStore.getState().rounds.at(-1)!.id;
        setCommittedId(committed.current);
      } else await reliableStorage.retryWrites();
      if (!(await reliableStorage.confirmWrite('schafkopfrechner-games')))
        throw new Error(
          'Eingetragen, aber noch nicht auf dem Gerät gesichert. Bitte erneut speichern; die Runde wird nicht doppelt eingetragen.',
        );
      const current = useGameStore.getState();
      if (
        current.currentTable?.id !== table?.id ||
        !current.rounds.some(({ id }) => id === committed.current)
      )
        throw new Error(
          'Der Tisch wurde inzwischen geändert. Bitte den aktuellen Spielstand prüfen.',
        );
      drafts.delete(key);

      AccessibilityInfo.announceForAccessibility(
        'Runde auf dem Gerät gespeichert.',
      );
      onSaved();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Die Gerätespeicherung konnte nicht bestätigt werden.',
      );
      if (committed.current)
        drafts.set(key, { draft, revision, committedId: committed.current });
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  function choice(
    label: string,
    selected: boolean,
    onPress: () => void,
    text = label,
  ) {
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[styles.choice, selected && styles.selected]}
      >
        <AppText style={selected ? styles.gold : styles.text}>{text}</AppText>
      </Pressable>
    );
  }
  function count(
    keyName: 'laufende' | 'stoss' | 'jungfrauen',
    label: string,
    maximum: number,
    minimum = 1,
    offset = 0,
  ) {
    const value = Math.max(0, (draft.options[keyName] ?? 0) - offset);
    return (
      <View style={[styles.row, styles.optionRow]}>
        <AppText style={[styles.text, styles.optionLabel]}>{label}</AppText>
        <AppText style={styles.countValue}>{value}</AppText>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} verringern`}
            disabled={value === 0}
            style={[styles.control, styles.stepButton, styles.stepDivider]}
            onPress={() =>
              patch({
                options: {
                  ...draft.options,
                  [keyName]: (value === minimum ? 0 : value - 1) + offset,
                },
              })
            }
          >
            <AppText style={styles.gold}>−</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} erhöhen`}
            disabled={value >= maximum}
            style={[styles.control, styles.stepButton]}
            onPress={() =>
              patch({
                options: {
                  ...draft.options,
                  [keyName]: (value === 0 ? minimum : value + 1) + offset,
                },
              })
            }
          >
            <AppText style={styles.gold}>+</AppText>
          </Pressable>
        </View>
      </View>
    );
  }
  const title = editingRound ? 'Korrektur speichern' : 'Runde speichern';
  return (
    <>
      <InteractionSheet
        fullScreen
        visible={visible && !closeChoice}
        onClose={requestClose}
        onDismiss={() => {
          if (!visible) onDismiss();
        }}
        dismissible={!saving}
      >
        <AuthBackground withSafeArea={false}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rundeneingabe schließen"
                disabled={saving}
                onPress={requestClose}
                style={styles.backButton}
              >
                <AppText style={styles.backIcon}>‹</AppText>
              </Pressable>
              <AppText style={styles.title}>
                {draft.choosing
                  ? 'Spielauswahl'
                  : editingRound
                    ? `Korrektur · ${gameLabel}`
                    : gameLabel}
              </AppText>
            </View>
            <EntryScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                pointerEvents={immutable ? 'none' : 'auto'}
                accessibilityElementsHidden={immutable}
                importantForAccessibility={
                  immutable ? 'no-hide-descendants' : 'auto'
                }
                style={styles.content}
              >
                {draft.choosing ? (
                  <>
                    <AppText style={styles.hint}>
                      {editingRound
                        ? 'Spielart mit den ursprünglichen Tisch-Tarifen korrigieren. Parteien und Boni werden beim Wechsel neu gewählt.'
                        : 'Welche Spielart wurde gespielt? Nur aktivierte Spiele sind verfügbar.'}
                    </AppText>
                    <GameTypeSelector
                      enabledTypes={enabledTypes}
                      variant="list"
                      onSelect={changeGame}
                    />
                    {!enabledTypes.length ? (
                      <AppText style={styles.hint}>
                        Keine Spielart aktiviert. Bitte die Tischregeln prüfen.
                      </AppText>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Spielart ändern"
                      onPress={() => patch({ choosing: true })}
                      style={styles.row}
                    >
                      <AppText style={styles.gold}>‹ Spielart ändern</AppText>
                    </Pressable>
                    <View style={styles.tariffHeader}>
                      <AppText style={styles.hint}>
                        {stockDeposit
                          ? 'Einzahlung je Spieler'
                          : draft.manual
                            ? 'Gewinnerpartei gesamt'
                            : 'Tarif pro Spieler'}
                      </AppText>
                      <AppText style={styles.amount}>
                        {stockDeposit
                          ? formatOverviewMoney(stockUnit ?? 0)
                          : draft.manual
                            ? formatOverviewMoney(amountCents)
                            : formatOverviewMoney(tariff?.totalCents ?? 0)}
                      </AppText>
                    </View>
                    {stockDeposit ? (
                      <View style={styles.card}>
                        <AppText style={styles.label}>Stock einzahlen</AppText>
                        <AppText style={styles.hint}>
                          Alle vier zahlen den konfigurierten Einsatz. Spielboni
                          und Multiplikatoren verändern diese Einzahlung nicht.
                        </AppText>
                        {players.map((player) => (
                          <View key={player.id} style={styles.row}>
                            <AppText style={styles.text}>{player.name}</AppText>
                            <AppText style={styles.text}>
                              −{formatOverviewMoney(stockUnit ?? 0)}
                            </AppText>
                          </View>
                        ))}
                        <AppText style={styles.gold}>
                          Stock danach:{' '}
                          {formatOverviewMoney(stockBefore + amountCents)}
                        </AppText>
                        <View style={styles.row}>
                          <AppText style={styles.text}>
                            Nicht gespielte Gabe abschließen
                          </AppText>
                          <Switch
                            accessibilityLabel="Stock schließt Gabe ab"
                            value={draft.stockCompletesDeal}
                            disabled={!!editingRound}
                            onValueChange={(stockCompletesDeal) =>
                              patch({ stockCompletesDeal })
                            }
                          />
                        </View>
                        <AppText style={styles.hint}>
                          {draft.stockCompletesDeal
                            ? 'Geber weiterschalten und gesetzte Leger zurücksetzen.'
                            : 'Reine Einzahlung: Geber und gesetzte Leger bleiben erhalten.'}
                        </AppText>
                      </View>
                    ) : (
                      <>
                        {guided && sauspiel ? (
                          <View style={styles.card}>
                            <AppText style={styles.label}>Sauspieler</AppText>
                            <View style={styles.chips}>
                              {players.map((player) =>
                                choice(
                                  `Spieler ${player.name}`,
                                  draft.declarer === player.id,
                                  () => selectParty(player.id, draft.partner),
                                  player.name,
                                ),
                              )}
                            </View>
                            <AppText style={styles.label}>Partner</AppText>
                            <View style={styles.chips}>
                              {players
                                .filter(({ id }) => id !== draft.declarer)
                                .map((player) =>
                                  choice(
                                    `Partner ${player.name}`,
                                    draft.partner === player.id,
                                    () =>
                                      selectParty(draft.declarer, player.id),
                                    player.name,
                                  ),
                                )}
                            </View>
                            {draft.declarer && draft.partner ? (
                              <View style={styles.chips}>
                                {[true, false].map((won) =>
                                  choice(
                                    `Spielerpartei ${won ? 'gewonnen' : 'verloren'}`,
                                    draft.won === won,
                                    () =>
                                      selectParty(
                                        draft.declarer,
                                        draft.partner,
                                        won,
                                      ),
                                    won ? 'Gewonnen' : 'Verloren',
                                  ),
                                )}
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                        <View style={styles.playerList}>
                          {players.map((player, index) => {
                            const winner = draft.winners.includes(player.id);
                            const loser = draft.losers.includes(player.id);
                            const cents = winner
                              ? (party?.winnerCents ??
                                  (draft.winners.length
                                    ? amountCents / draft.winners.length
                                    : 0)) + (stockPayout ? stockBefore / 2 : 0)
                              : loser
                                ? -(
                                    party?.loserCents ??
                                    (draft.losers.length
                                      ? amountCents / draft.losers.length
                                      : 0)
                                  )
                                : 0;
                            return (
                              <View
                                key={player.id}
                                style={[
                                  styles.playerRow,
                                  index < players.length - 1 &&
                                    styles.optionRow,
                                ]}
                              >
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Klopfen ${player.name}`}
                                  accessibilityHint={
                                    canKnock
                                      ? placedLegerIds.includes(player.id)
                                        ? 'Klopfen zurücknehmen'
                                        : 'Nachträglich klopfen und den Spielwert verdoppeln'
                                      : 'Klopfen ist für diese Runde nicht verfügbar'
                                  }
                                  accessibilityState={{
                                    selected: placedLegerIds.includes(
                                      player.id,
                                    ),
                                    disabled:
                                      immutable ||
                                      !canKnock ||
                                      (!placedLegerIds.includes(player.id) &&
                                        placedLegerIds.length >= 4),
                                  }}
                                  disabled={
                                    immutable ||
                                    !canKnock ||
                                    (!placedLegerIds.includes(player.id) &&
                                      placedLegerIds.length >= 4)
                                  }
                                  onPress={() => toggleKnock(player.id)}
                                  style={styles.coinButton}
                                >
                                  <EuroStyleCoin
                                    label={
                                      placedLegerIds.includes(player.id)
                                        ? '2×'
                                        : '1×'
                                    }
                                    muted={!placedLegerIds.includes(player.id)}
                                  />
                                </Pressable>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={
                                    guided && !partnerGame
                                      ? `${draft.gameType === 'ramsch' ? (draft.options.durchmarsch ? 'Durchmarsch-Gewinner' : 'Ramsch-Verlierer') : 'Alleinspieler'} ${player.name}`
                                      : `Ergebnis für ${player.name}`
                                  }
                                  accessibilityState={{
                                    selected: draft.solo === player.id,
                                  }}
                                  onPress={() => {
                                    if (guided && !partnerGame)
                                      selectSolo(player.id);
                                  }}
                                  style={styles.playerIdentity}
                                >
                                  <View style={styles.playerNameBlock}>
                                    <AppText
                                      numberOfLines={1}
                                      style={styles.playerName}
                                    >
                                      {player.name}
                                    </AppText>
                                    <AppText
                                      style={winner ? styles.gold : styles.hint}
                                    >
                                      {winner || loser
                                        ? `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${formatOverviewMoney(Math.round(Math.abs(cents)))}`
                                        : '—'}
                                    </AppText>
                                  </View>
                                </Pressable>
                                <View style={styles.segments}>
                                  {([true, false] as const).map((won) => (
                                    <Pressable
                                      key={String(won)}
                                      accessibilityRole="button"
                                      accessibilityLabel={
                                        guided &&
                                        !partnerGame &&
                                        draft.solo === player.id
                                          ? `Alleinspieler ${won ? 'gewonnen' : 'verloren'}`
                                          : `${player.name} ${won ? 'gewonnen' : 'verloren'}`
                                      }
                                      accessibilityState={{
                                        selected: won ? winner : loser,
                                      }}
                                      style={[
                                        styles.segment,
                                        (won ? winner : loser) &&
                                          (won
                                            ? styles.segmentWon
                                            : styles.selected),
                                      ]}
                                      onPress={() => {
                                        if (guided && !partnerGame) {
                                          if (
                                            draft.solo &&
                                            draft.solo !== player.id &&
                                            (winner || loser)
                                          )
                                            selectSolo(draft.solo, !won);
                                          else selectSolo(player.id, won);
                                        } else if (
                                          guided &&
                                          sauspiel &&
                                          draft.declarer &&
                                          draft.partner
                                        ) {
                                          const inParty = [
                                            draft.declarer,
                                            draft.partner,
                                          ].includes(player.id);
                                          selectParty(
                                            draft.declarer,
                                            draft.partner,
                                            inParty ? won : !won,
                                          );
                                        } else
                                          toggle(
                                            player.id,
                                            won ? 'winner' : 'loser',
                                          );
                                      }}
                                    >
                                      <AppText
                                        style={[
                                          styles.segmentText,
                                          (won ? winner : loser) &&
                                            (won
                                              ? styles.segmentWonText
                                              : styles.gold),
                                        ]}
                                      >
                                        {won ? 'Gewonnen' : 'Verloren'}
                                      </AppText>
                                    </Pressable>
                                  ))}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                        {supportsCardSuit(draft.gameType) ? (
                          <View style={styles.suitRow}>
                            {cardSuits.map((suit) => (
                              <Pressable
                                key={suit.id}
                                accessibilityRole="button"
                                accessibilityLabel={`Kartenfarbe ${suit.label}`}
                                accessibilityState={{
                                  selected: draft.suit === suit.id,
                                }}
                                onPress={() =>
                                  patch({
                                    suit:
                                      draft.suit === suit.id
                                        ? undefined
                                        : suit.id,
                                  })
                                }
                                style={[
                                  styles.suitChoice,
                                  draft.suit === suit.id && styles.selected,
                                ]}
                              >
                                <CardSuitIcon
                                  suit={suit.id}
                                  color={suit.color}
                                />
                                <AppText
                                  style={[
                                    styles.suitLabel,
                                    draft.suit === suit.id && styles.gold,
                                  ]}
                                >
                                  {suit.label}
                                </AppText>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                        <View style={styles.optionsPanel}>
                          {!draft.manual ? (
                            <View style={[styles.row, styles.optionRow]}>
                              <AppText
                                style={[styles.text, styles.optionLabel]}
                              >
                                Gelegt
                              </AppText>
                              <AppText style={styles.countValue}>
                                {effectiveOptions.legerCount}
                              </AppText>
                              <AppText
                                style={[styles.hint, styles.tableContext]}
                              >
                                Über Münzen
                              </AppText>
                            </View>
                          ) : null}
                          {draft.gameType === 'ramsch' ? (
                            <View style={styles.card}>
                              <AppText style={styles.hint}>
                                {draft.options.durchmarsch
                                  ? 'Ein Spieler gewinnt gegen drei.'
                                  : 'Höchste Augenzahl verliert gegen die anderen drei.'}
                              </AppText>
                              {rules.ramschDurchmarsch ? (
                                <View style={styles.row}>
                                  <AppText style={styles.text}>
                                    Durchmarsch
                                  </AppText>
                                  <Switch
                                    accessibilityLabel="Durchmarsch"
                                    value={draft.options.durchmarsch ?? false}
                                    onValueChange={(durchmarsch) =>
                                      patch({
                                        options: {
                                          ...draft.options,
                                          durchmarsch,
                                          jungfrauen: 0,
                                        },
                                        solo: '',
                                        winners: [],
                                        losers: [],
                                      })
                                    }
                                  />
                                </View>
                              ) : null}
                              {rules.ramschJungfrau &&
                              !draft.options.durchmarsch
                                ? count('jungfrauen', 'Jungfrauen', 2)
                                : null}
                            </View>
                          ) : null}
                          {sauspiel &&
                          (settings.games.stock.enabled ||
                            stockBefore > 0 ||
                            editingRound?.stockAction === 'payout') ? (
                            <View style={styles.card}>
                              <View style={styles.row}>
                                <AppText style={styles.text}>
                                  Stock auszahlen ·{' '}
                                  {formatOverviewMoney(stockBefore)}
                                </AppText>
                                <Switch
                                  accessibilityLabel="Stock auszahlen"
                                  disabled={
                                    stockBefore <= 0 ||
                                    (!!draft.declarer && !draft.won) ||
                                    (!editingRound &&
                                      (!draft.declarer || !draft.partner))
                                  }
                                  value={stockPayout}
                                  onValueChange={(payStock) =>
                                    patch({ payStock })
                                  }
                                />
                              </View>
                              <AppText style={styles.hint}>
                                {stockPayout
                                  ? `${formatOverviewMoney(stockBefore / 2)} zusätzlich je Sauspiel-Gewinner.`
                                  : 'Nur bei gewonnener Spielerpartei, je zur Hälfte.'}
                              </AppText>
                            </View>
                          ) : null}
                          {draft.manual ? (
                            <View style={styles.card}>
                              <AppText style={styles.hint}>
                                Historischer manueller Gesamtgewinn, ohne
                                zusätzliche Faktoren.
                              </AppText>
                              <AmountInput
                                accessibilityLabel="Betrag"
                                keyboardType="decimal-pad"
                                value={draft.manualAmount}
                                onChangeText={(manualAmount) =>
                                  patch({ manualAmount })
                                }
                                style={styles.input}
                              />
                            </View>
                          ) : (
                            <>
                              {rules.bonuses.laufende &&
                              settings.bonusRules.laufende.enabled
                                ? count(
                                    'laufende',
                                    'Laufende',
                                    rules.laufendeMax,
                                    rules.laufendeMin,
                                  )
                                : null}
                              {(['schneider', 'schwarz'] as const)
                                .filter(
                                  (id) =>
                                    rules.bonuses[id] &&
                                    settings.bonusRules[id].enabled,
                                )
                                .map((id) => (
                                  <View
                                    key={id}
                                    style={[styles.row, styles.optionRow]}
                                  >
                                    <AppText style={styles.text}>
                                      {id === 'schneider'
                                        ? 'Schneider'
                                        : 'Schwarz'}
                                    </AppText>
                                    <Switch
                                      accessibilityLabel={
                                        id === 'schneider'
                                          ? 'Schneider'
                                          : 'Schwarz'
                                      }
                                      disabled={
                                        id === 'schneider' &&
                                        draft.options.schwarz
                                      }
                                      value={
                                        id === 'schneider'
                                          ? draft.options.schneider ||
                                            draft.options.schwarz
                                          : draft.options.schwarz
                                      }
                                      onValueChange={(value) =>
                                        patch({
                                          options: {
                                            ...draft.options,
                                            [id]: value,
                                          },
                                        })
                                      }
                                    />
                                  </View>
                                ))}
                              {rules.bonuses.stoss &&
                              (!editingRound ||
                                settings.bonusRules.stoss.enabled) ? (
                                <>
                                  <View style={[styles.row, styles.optionRow]}>
                                    <AppText style={styles.text}>
                                      Kontra
                                    </AppText>
                                    <Switch
                                      accessibilityLabel="Kontra"
                                      value={draft.options.stoss > 0}
                                      onValueChange={(value) =>
                                        patch({
                                          options: {
                                            ...draft.options,
                                            stoss: value ? 1 : 0,
                                          },
                                        })
                                      }
                                    />
                                  </View>
                                  {count('stoss', 'Re', 3, 1, 1)}
                                  <AppText style={styles.hint}>
                                    Kontra ×2 · jede Re-Stufe nochmals ×2
                                  </AppText>
                                </>
                              ) : null}
                              <AppText style={styles.hint}>
                                Gesamtfaktor: {tariff?.multiplier ?? 1}x ·{' '}
                                {effectiveOptions.legerCount} Leger
                              </AppText>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Preisaufschlüsselung"
                                accessibilityState={{ expanded: details }}
                                style={styles.row}
                                onPress={() => setDetails(!details)}
                              >
                                <AppText style={styles.gold}>
                                  Preisaufschlüsselung {details ? '−' : '+'}
                                </AppText>
                              </Pressable>
                              {details ? (
                                <View style={styles.card}>
                                  {editingRound ? (
                                    <AppText style={styles.hint}>
                                      Ursprüngliche Tisch-Tarife
                                    </AppText>
                                  ) : null}
                                  {tariff?.lines.map((line) => (
                                    <View key={line.label} style={styles.row}>
                                      <AppText style={styles.text}>
                                        {line.label}
                                      </AppText>
                                      <AppText style={styles.text}>
                                        {formatOverviewMoney(line.cents)}
                                      </AppText>
                                    </View>
                                  ))}
                                  <AppText style={styles.text}>
                                    Tarif je Spieler:{' '}
                                    {formatOverviewMoney(
                                      tariff?.totalCents ?? 0,
                                    )}
                                  </AppText>
                                  {party ? (
                                    <>
                                      <AppText style={styles.text}>
                                        Je Gewinner: +
                                        {formatOverviewMoney(party.winnerCents)}
                                      </AppText>
                                      <AppText style={styles.text}>
                                        Je Verlierer: −
                                        {formatOverviewMoney(party.loserCents)}
                                      </AppText>
                                    </>
                                  ) : null}
                                </View>
                              ) : null}
                            </>
                          )}
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>
            </EntryScrollView>
            {!draft.choosing ? (
              <View style={styles.footer}>
                <View accessibilityLiveRegion="polite">
                  <AppText style={styles.hint}>
                    {saving
                      ? 'Wird auf dem Gerät gespeichert …'
                      : saveError ||
                        (committedId
                          ? 'Noch nicht auf dem Gerät gesichert.'
                          : hint || '')}
                  </AppText>
                </View>
                <GoldButton
                  title={
                    committedId && saveError
                      ? 'Erneut auf Gerät speichern'
                      : title
                  }
                  accessibilityLabel={
                    committedId && saveError
                      ? 'Erneut auf Gerät speichern'
                      : title
                  }
                  disabled={saving || (!committedId && !valid)}
                  loading={saving}
                  onPress={save}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Verwerfen"
                  disabled={immutable}
                  onPress={requestClose}
                  style={styles.discard}
                >
                  <AppText style={styles.hint}>Verwerfen</AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </AuthBackground>
      </InteractionSheet>
      <Modal
        visible={visible && closeChoice}
        transparent
        animationType="fade"
        onRequestClose={() => setCloseChoice(false)}
      >
        <View style={styles.modalRoot}>
          <ScrollView
            style={styles.dialog}
            contentContainerStyle={styles.dialogContent}
          >
            <AppText style={styles.title}>
              {committedId
                ? 'Eintrag noch ungesichert'
                : 'Ungespeicherte Eingabe'}
            </AppText>
            <AppText style={styles.hint}>
              {committedId
                ? 'Die Runde ist bereits eingetragen. Beim nächsten Öffnen kann die Gerätespeicherung ohne Doppeleintrag wiederholt werden.'
                : 'Entwürfe bleiben für neue Runden und Korrekturen bis zum Ende dieser App-Sitzung erhalten. Nach einem Neustart werden sie nicht wiederhergestellt.'}
            </AppText>
            <GoldButton
              title="Weiter bearbeiten"
              onPress={() => setCloseChoice(false)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entwurf behalten"
              style={styles.control}
              onPress={() => leave(true)}
            >
              <AppText style={styles.gold}>
                {committedId ? 'Ungesichert schließen' : 'Entwurf behalten'}
              </AppText>
            </Pressable>
            {!committedId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Entwurf verwerfen"
                style={styles.control}
                onPress={() => leave(false)}
              >
                <AppText style={styles.text}>Entwurf verwerfen</AppText>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  header: { gap: 12, paddingBottom: 6 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(22, 51, 40, 0.8)',
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: '#F5F5F5', fontSize: 36, lineHeight: 40 },
  tariffHeader: { gap: 4, paddingBottom: 8 },
  countValue: {
    color: '#F5F5F5',
    fontSize: 18,
    textAlign: 'center',
    minWidth: 28,
  },
  playerList: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: 22,
    backgroundColor: authColors.surfaceElevated,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 64,
  },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    minHeight: 48,
  },
  coinButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNameBlock: { flex: 1, minWidth: 0, gap: 2 },
  playerName: { color: authColors.textPrimary, fontSize: 15 },
  segments: {
    flexDirection: 'row',
    backgroundColor: 'rgba(22, 51, 40, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(107, 163, 110, 0.2)',
    borderRadius: 20,
    width: '50%',
    maxWidth: 260,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  segmentText: { color: '#F5F5F5', fontSize: 12 },
  segmentWon: {
    backgroundColor: authColors.goldHighlight,
    borderColor: authColors.gold,
  },
  segmentWonText: { color: '#142319', fontWeight: '700' },
  suitRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: 22,
    backgroundColor: authColors.surfaceElevated,
  },
  suitChoice: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 43, 32, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(107, 163, 110, 0.15)',
  },
  suitLabel: { color: '#A8B9AD', fontSize: 12 },
  discard: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, minHeight: 0 },
  optionsPanel: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: 22,
    backgroundColor: authColors.surfaceElevated,
  },
  optionRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(107, 163, 110, 0.25)',
  },
  optionLabel: { flex: 1 },
  tableContext: { width: 96, textAlign: 'right' },
  stepper: {
    width: 96,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(107, 163, 110, 0.2)',
    backgroundColor: 'rgba(22, 51, 40, 0.8)',
  },
  stepButton: {
    flex: 1,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  stepDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(245, 245, 245, 0.15)',
  },
  content: { gap: 12, paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  title: { color: '#F5F5F5', fontSize: 34, fontWeight: '800', flexShrink: 1 },
  label: { color: authColors.goldHighlight, fontWeight: '700' },
  text: { color: '#F5F5F5', flexShrink: 1 },
  hint: {
    color: authColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  gold: { color: authColors.goldHighlight, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(22, 51, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selected: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    borderColor: authColors.gold,
  },
  control: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(22, 51, 40, 0.8)',
    paddingHorizontal: 12,
  },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: authColors.surfaceElevated,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    gap: 10,
  },
  input: {
    color: '#fff',
    borderWidth: 1,
    borderColor: '#536D57',
    borderRadius: 14,
    padding: 14,
    minHeight: 48,
  },
  footer: {
    gap: 6,
    paddingTop: 10,
    paddingBottom: 12,
  },
  amount: { color: '#fff', fontSize: 36, fontWeight: '800' },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dialog: {
    backgroundColor: '#10241C',
    maxHeight: '100%',
    borderRadius: 20,
  },
  dialogContent: { padding: 20, gap: 16 },
});
