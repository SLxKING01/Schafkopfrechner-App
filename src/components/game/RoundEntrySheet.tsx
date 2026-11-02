import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  createDefaultTableSettings,
  getGameRules,
} from '../../constants/tableSettings';
import { reliableStorage } from '../../storage/reliableStorage';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import {
  authColors,
  authControlSizes,
  authInteraction,
  authRadius,
  authSpacing,
  authTextStyles,
} from '../../theme';
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
import {
  type CustomRoundDraft,
  initialCustomRoundDraft,
  summarizeCustomRound,
} from '../../utils/customRound';
import { participationRevision, roundPlayers } from '../../utils/dealerOrder';
import { formatOverviewMoney } from '../../utils/gameOverview';
import {
  calculatePartyAmount,
  calculateRoundTariff,
  emptyTariffOptions,
} from '../../utils/roundTariff';
import { selectSauspielResult } from '../../utils/sauspielSelection';
import { AuthBackground } from '../auth/AuthBackground';
import { GoldButton } from '../auth/GoldButton';
import { AppText } from '../ui/AppText';
import { InteractionSheet } from '../ui/InteractionSheet';
import { CardSuitIcon } from './CardSuitIcon';
import { CustomAmountsEditor } from './CustomAmountsEditor';
import { EuroStyleCoin } from './EuroStyleCoin';
import { GameTypeSelector } from './GameTypeSelector';
const AmountInput = TextInput;
const EntryScrollView = ScrollView;
type Draft = {
  customEntries?: CustomRoundDraft;
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
// Failed round writes remain session-only; retained input drafts are also stored on disk.
const drafts = new Map<string, CachedDraft>();
function isStoredDraft(
  value: unknown,
): value is { draft: Draft; revision: string } {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.revision !== 'string' ||
    !entry.draft ||
    typeof entry.draft !== 'object'
  )
    return false;
  const d = entry.draft as Record<string, unknown>;
  const strings = ['gameType', 'declarer', 'partner', 'solo', 'manualAmount'];
  const booleans = [
    'choosing',
    'won',
    'manual',
    'payStock',
    'stockCompletesDeal',
  ];
  const arrays = ['winners', 'losers'];
  if (
    !strings.every((k) => typeof d[k] === 'string') ||
    !booleans.every((k) => typeof d[k] === 'boolean') ||
    !arrays.every(
      (k) =>
        Array.isArray(d[k]) &&
        d[k].every((id: unknown) => typeof id === 'string'),
    ) ||
    !d.options ||
    typeof d.options !== 'object'
  )
    return false;
  if (d.suit !== undefined && !cardSuits.some(({ id }) => id === d.suit))
    return false;
  if (
    d.correctedLegerPlayerIds !== undefined &&
    (!Array.isArray(d.correctedLegerPlayerIds) ||
      !d.correctedLegerPlayerIds.every((id: unknown) => typeof id === 'string'))
  )
    return false;
  if (
    d.gameType !== 'sauspiel' &&
    d.gameType !== 'custom' &&
    !Object.hasOwn(createDefaultTableSettings().games, String(d.gameType))
  )
    return false;
  if (
    d.customEntries !== undefined &&
    (!d.customEntries ||
      typeof d.customEntries !== 'object' ||
      Array.isArray(d.customEntries) ||
      !Object.values(d.customEntries).every(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          typeof entry.amount === 'string' &&
          typeof entry.negative === 'boolean',
      ))
  )
    return false;
  const options = d.options as Record<string, unknown>;
  if (
    options.durchmarsch !== undefined &&
    typeof options.durchmarsch !== 'boolean'
  )
    return false;
  if (
    options.jungfrauen !== undefined &&
    (!Number.isSafeInteger(options.jungfrauen) ||
      Number(options.jungfrauen) < 0)
  )
    return false;
  return Object.entries(emptyTariffOptions).every(
    ([k, sample]) =>
      typeof options[k] === typeof sample &&
      (typeof sample !== 'number' ||
        (Number.isSafeInteger(options[k]) && Number(options[k]) >= 0)),
  );
}

type Props = {
  initialDeclarerId?: string;
  table: GameTable | null;
  players: Player[];
  editingRound: GameRound | null;
  visible: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onSaved: () => void;
};
function initialDraft(
  table: GameTable | null,
  round: GameRound | null,
  initialDeclarerId?: string,
  roster: Player[] = [],
): Draft {
  const winners = round
    ? [...roundWinnerIds(round)]
    : initialDeclarerId
      ? [initialDeclarerId]
      : [];
  const losers = round ? [...round.loserIds] : [];
  return {
    customEntries: initialCustomRoundDraft(round, roster),
    suit: round?.suit,
    gameType:
      round?.gameType === 'sauspiel'
        ? 'rufspiel'
        : (round?.gameType ?? 'rufspiel'),
    choosing: !round,
    winners,
    losers,
    declarer: round?.declarerId ?? initialDeclarerId ?? '',
    partner: round?.partnerId ?? '',
    solo:
      winners.length === 1 ? winners[0] : losers.length === 1 ? losers[0] : '',
    won: round?.declarerId
      ? winners.includes(round.declarerId)
      : winners.length !== 3,
    options: round?.tariffOptions
      ? {
          ...round.tariffOptions,
        }
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
  initialDeclarerId,
  table,
  players: roster,
  editingRound,
  visible,
  onClose,
  onDismiss,
  onSaved,
}: Props) {
  const [players] = useState(() =>
    editingRound
      ? roster.filter((p) =>
          (
            editingRound.participantIds ?? [
              ...roundWinnerIds(editingRound),
              ...editingRound.loserIds,
            ]
          ).includes(p.id),
        )
      : roundPlayers(table, roster, useGameStore.getState().rounds.length),
  );
  const [openingParticipation] = useState(() =>
    participationRevision(table, roster, useGameStore.getState().rounds.length),
  );
  const { width, fontScale } = useWindowDimensions();
  const expandedPlayerLayout = fontScale >= 1.3 || width < 360;
  const rounds = useGameStore((state) => state.rounds);
  const currentTable = useGameStore((state) => state.currentTable);
  const ownerId = useAuthStore((state) => state.user?.id ?? 'guest');
  const key = `${ownerId}:${table?.id ?? 'none'}:${editingRound?.id ?? 'new'}${!editingRound && initialDeclarerId ? `:player:${initialDeclarerId}` : ''}`;
  const storageKey = `schafkopfrechner-round-draft-v1:${key}`;
  const revision = JSON.stringify({
    round: editingRound,
    players: roster.map(({ id, isPaused }) => [id, !!isPaused]),
    // A new round changes dealer, multipliers and the context of a new draft.
    context: editingRound
      ? null
      : {
          rounds: rounds.map(({ id, updatedAt, createdAt }) => [
            id,
            updatedAt ?? createdAt,
          ]),
          settings: table?.settings,
          dealer: table?.dealerId,
          leger: table?.placedLegerPlayerIds,
          turbo: table?.turboRamschEnabled,
        },
  });
  const cached = drafts.get(key);
  const [draft, setDraft] = useState<Draft>(() =>
    cached?.revision === revision
      ? cached.draft
      : initialDraft(table, editingRound, initialDeclarerId, roster),
  );
  const committed = useRef<string | null>(
    cached?.revision === revision ? cached.committedId : null,
  );
  const savingLock = useRef(false);
  const editingRevision = useRef(
    editingRound?.updatedAt ?? editingRound?.createdAt,
  );
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [committedId, setCommittedId] = useState<string | null>(
    cached?.revision === revision ? cached.committedId : null,
  );
  const baseline = useRef(
    JSON.stringify(
      initialDraft(table, editingRound, initialDeclarerId, roster),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [closeChoice, setCloseChoice] = useState(false);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled || !raw) return;
        const value: unknown = JSON.parse(raw);
        if (!isStoredDraft(value) || value.revision !== revision) return;
        if (!cached?.committedId) setDraft(value.draft);
      })
      .catch(() => {
        if (!cancelled)
          setSaveError('Der gespeicherte Entwurf konnte nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setLoadingDraft(false);
      });
    return () => {
      cancelled = true;
    };
    // The parent remounts this editor for each table, round and opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const patch = (change: Partial<Draft>) => {
    if (loadingDraft || saving || committedId) return;
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
            stoss: {
              ...active.settings.bonusRules.stoss,
              enabled: true,
            },
          },
        })
      )
        return;
    }
    setDraft((current) => ({
      ...current,
      ...change,
    }));
  };
  const originalSettings =
    editingRound?.settingsSnapshot ??
    (currentTable?.id === table?.id ? currentTable?.settings : undefined) ??
    table?.settings ??
    createDefaultTableSettings();
  const settings =
    editingRound && draft.options.stoss > 0
      ? {
          ...originalSettings,
          bonusRules: {
            ...originalSettings.bonusRules,
            stoss: { ...originalSettings.bonusRules.stoss, enabled: true },
          },
        }
      : originalSettings;
  const customMode = draft.gameType === 'custom';
  const customSummary = summarizeCustomRound(roster, draft.customEntries);
  const rules = getGameRules(settings, draft.gameType);
  const enabledTypes: GameType[] = [
    ...Object.entries(settings.games)
      .filter(([, entry]) => entry.enabled)
      .map(([id]) => id as GameType),
    'custom',
  ];
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
    !customMode &&
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
  const automaticStock = !editingRound || editingRound.stockRulesVersion === 1;
  const stockPayout =
    !stockDeposit &&
    sauspiel &&
    (automaticStock
      ? settings.games.stock.enabled &&
        stockBefore > 0 &&
        !!draft.declarer &&
        !!draft.partner &&
        draft.won &&
        draft.winners.length === 2
      : draft.payStock && (!draft.declarer || draft.won));
  const stockDouble =
    automaticStock &&
    !stockDeposit &&
    sauspiel &&
    settings.games.stock.enabled &&
    stockBefore > 0 &&
    !!draft.declarer &&
    !!draft.partner &&
    !draft.won &&
    draft.losers.length === 2;
  const stockShare = (id: string) => {
    const own = [draft.declarer, draft.partner].sort();
    return (
      Math.floor(stockBefore / 2) + (own.indexOf(id) < stockBefore % 2 ? 1 : 0)
    );
  };
  let tariff: ReturnType<typeof calculateRoundTariff> | null = null;
  let party: ReturnType<typeof calculatePartyAmount> | null = null;
  let calculationError = '';
  try {
    if (!customMode && !draft.manual && !stockDeposit) {
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
  const amountCents = customMode
    ? customSummary.amountCents
    : stockDeposit
      ? (stockUnit ?? 0) * 4
      : draft.manual
        ? (manualCents ?? 0)
        : (party?.totalCents ?? 0);
  const payload: CreateRoundPayload = customMode
    ? {
        gameType: 'custom',
        winnerId: '',
        winnerIds: [],
        loserIds: [],
        amount: customSummary.amountCents / 100,
        customAmounts: customSummary.amounts,
      }
    : {
        ...(partnerGame && editingRound?.declarerId && !draft.declarer
          ? { clearPartyMetadata: true }
          : {}),
        ...(editingRound && draft.correctedLegerPlayerIds
          ? {
              legerPlayerIds: draft.correctedLegerPlayerIds,
            }
          : {}),
        ...(draft.suit && supportsCardSuit(draft.gameType)
          ? {
              suit: draft.suit,
            }
          : {}),
        gameType: draft.gameType,
        winnerId: stockDeposit ? '' : (draft.winners[0] ?? ''),
        winnerIds: stockDeposit ? [] : draft.winners,
        loserIds: stockDeposit ? players.map(({ id }) => id) : draft.losers,
        amount: amountCents / 100,
        stockAction: stockDeposit
          ? 'deposit'
          : stockPayout
            ? 'payout'
            : stockDouble
              ? 'double'
              : undefined,
        ...(stockDeposit
          ? {
              stockCompletesDeal: editingRound
                ? draft.stockCompletesDeal
                : false,
            }
          : {}),
        ...(!stockDeposit && draft.gameType !== 'ramsch' && draft.declarer
          ? {
              declarerId: draft.declarer,
              ...(partnerGame ? { partnerId: draft.partner } : {}),
            }
          : {}),
        ...(!draft.manual && !stockDeposit
          ? {
              tariffOptions: effectiveOptions,
            }
          : {}),
      };
  let hint = '';
  if (!customMode && !editingRound && players.length !== 4)
    hint = 'Mindestens vier aktive Spieler erforderlich';
  else if (customMode) hint = customSummary.error;
  else if (
    !stockDeposit &&
    draft.gameType !== 'ramsch' &&
    !editingRound &&
    !draft.declarer
  )
    hint = 'Bitte Ansager wählen.';
  else if (partnerGame && draft.declarer && !draft.partner)
    hint = 'Bitte den Partner des Ansagers wählen.';
  else if (
    !stockDeposit &&
    draft.declarer &&
    !draft.winners.length &&
    !draft.losers.length
  )
    hint = 'Bitte gewonnen oder verloren wählen.';
  else if (
    !stockDeposit &&
    guided &&
    partnerGame &&
    (draft.winners.length !== 2 || draft.losers.length !== 2)
  )
    hint =
      players.length === 4
        ? 'Zwei Gewinner oder zwei Verlierer wählen. Die andere Partei wird automatisch ergänzt.'
        : 'Zwei Gewinner und zwei Verlierer wählen.';
  else if (
    !stockDeposit &&
    guided &&
    !partnerGame &&
    draft.gameType !== 'ramsch' &&
    !draft.solo
  )
    hint = 'Bitte Alleinspieler w?hlen.';
  else if (!editingRound && players.length !== 4)
    hint = 'Für Stock müssen vier Spieler am Tisch sein.';
  else if (stockPayout && stockBefore <= 0)
    hint = 'Kein auszahlbarer Stock vorhanden.';
  else if (draft.manual && (manualCents === null || manualCents <= 0))
    hint = 'Bitte einen gültigen Betrag in ganzen Cent eingeben.';
  else if (calculationError) hint = calculationError;
  const valid =
    !hint &&
    isValidRound(payload, customMode ? roster : players) &&
    (customMode
      ? !customSummary.error
      : stockDeposit
        ? settings.games.stock.enabled
        : draft.manual
          ? manualCents !== null && manualCents > 0
          : !!party);
  if (!valid && !hint)
    hint = 'Bitte das Ergebnis für alle beteiligten Spieler prüfen.';
  const immutable = loadingDraft || saving || !!committedId;
  const gameLabel = formatRoundGameType(draft.gameType, draft.suit);
  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility('Rundeneingabe geöffnet');
  }, [visible]);
  function requestClose() {
    if (loadingDraft || savingLock.current) return;
    if (JSON.stringify(draft) === baseline.current && !committed.current) {
      onClose();
      return;
    }
    setCloseChoice(true);
  }
  async function leave(keep: boolean) {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (keep && !committed.current) {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({ draft, revision }),
        );
      } else {
        await AsyncStorage.removeItem(storageKey);
      }
      if (keep && committed.current)
        drafts.set(key, { draft, revision, committedId: committed.current });
      else if (keep) drafts.delete(key);
      else {
        drafts.delete(key);
        setDraft(initialDraft(table, editingRound, initialDeclarerId, roster));
      }
      setCloseChoice(false);
      onClose();
    } catch {
      setSaveError(
        'Der Entwurf konnte nicht auf dem Gerät gespeichert oder entfernt werden. Bitte erneut versuchen.',
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  function changeGame(type: GameType) {
    if (type === draft.gameType) {
      patch({
        choosing: false,
      });
      return;
    }
    const targetRules = getGameRules(settings, type);
    const selected =
      !editingRound && type !== 'stock' && type !== 'custom'
        ? initialDeclarerId
        : undefined;
    const others = players.map((p) => p.id).filter((id) => id !== selected);
    const partnerType = [
      'rufspiel',
      'sauspiel',
      'hochzeit',
      'kreuzbock',
    ].includes(type);
    const selectedWon = type !== 'ramsch';
    patch({
      gameType: type,
      customEntries: {},
      suit: undefined,
      choosing: false,
      winners: selected ? (selectedWon ? [selected] : others) : [],
      losers:
        selected && !partnerType ? (selectedWon ? others : [selected]) : [],
      declarer: ['stock', 'ramsch', 'custom'].includes(type)
        ? ''
        : (selected ?? draft.declarer),
      partner: '',
      solo: [
        'rufspiel',
        'sauspiel',
        'hochzeit',
        'kreuzbock',
        'stock',
        'ramsch',
      ].includes(type)
        ? ''
        : (selected ?? draft.declarer),
      won: selected ? selectedWon : draft.won,
      payStock: false,
      manual: false,
      manualAmount: '',
      options: {
        ...emptyTariffOptions,
        legerCount: targetRules.bonuses.leger ? originalLeger : 0,
        turboRamsch: effectiveOptions.turboRamsch,
        ...(type === 'ramsch'
          ? {
              durchmarsch: false,
              jungfrauen: 0,
            }
          : {}),
      },
    });
    setSaveError('');
  }
  function selectSauspiel(id: string, won: boolean) {
    const result = selectSauspielResult(
      players.map((p) => p.id),
      draft.winners,
      draft.losers,
      id,
      won,
    );
    if (result.winners === draft.winners && result.losers === draft.losers)
      return;
    const complete = result.winners.length === 2 && result.losers.length === 2;
    const own = result.winners.includes(draft.declarer)
      ? result.winners
      : result.losers;
    patch({
      ...result,
      payStock: false,
      ...(complete && draft.declarer
        ? {
            won: result.winners.includes(draft.declarer),
            partner: own.find((id) => id !== draft.declarer) ?? '',
          }
        : {}),
    });
  }
  function selectRamsch(id: string, won: boolean) {
    const selected = won ? draft.winners : draft.losers;
    if (selected.includes(id)) return;
    const next = [...selected, id];
    const own = next.length < players.length ? next : [id];
    const others = players.map((p) => p.id).filter((p) => !own.includes(p));
    patch({
      winners: won ? own : others,
      losers: won ? others : own,
      solo: '',
      declarer: '',
      partner: '',
      payStock: false,
    });
  }
  function selectSolo(id: string, won?: boolean) {
    const hasResult =
      won !== undefined || draft.winners.length > 0 || draft.losers.length > 0;
    const actualWon =
      draft.gameType === 'ramsch'
        ? !!draft.options.durchmarsch
        : (won ?? draft.won);
    const others = players
      .map((player) => player.id)
      .filter((playerId) => playerId !== id);
    patch({
      solo: id,
      declarer: draft.gameType === 'ramsch' ? '' : id,
      partner: '',
      won: actualWon,
      payStock: false,
      winners:
        hasResult || draft.gameType === 'ramsch'
          ? actualWon
            ? [id]
            : others
          : [],
      losers:
        hasResult || draft.gameType === 'ramsch'
          ? actualWon
            ? others
            : [id]
          : [],
    });
  }
  function chooseDeclarer(id: string) {
    if (guided && !partnerGame) {
      selectSolo(id);
      return;
    }
    const own = draft.winners.includes(id) ? draft.winners : draft.losers;
    patch({
      declarer: id,
      partner:
        partnerGame && own.length === 2
          ? (own.find((p) => p !== id) ?? '')
          : '',
      ...(own.includes(id) ? { won: draft.winners.includes(id) } : {}),
      payStock: false,
    });
  }
  function choosePartner(id: string) {
    const hasResult = draft.winners.length > 0 || draft.losers.length > 0;
    const own = [draft.declarer, id];
    const others = players.map((p) => p.id).filter((p) => !own.includes(p));
    patch({
      partner: id,
      payStock: false,
      ...(hasResult
        ? {
            winners: draft.won ? own : others,
            losers: draft.won ? others : own,
          }
        : {}),
    });
  }
  function chooseResult(won: boolean) {
    if (!partnerGame) {
      selectSolo(draft.declarer, won);
      return;
    }
    const own = [draft.declarer, draft.partner].filter(Boolean);
    const others = draft.partner
      ? players.map((p) => p.id).filter((p) => !own.includes(p))
      : [];
    patch({
      won,
      winners: won ? own : others,
      losers: won ? others : own,
      payStock: false,
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
    if (loadingDraft || savingLock.current || (!committed.current && !valid))
      return;
    savingLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (!committed.current) {
        const state = useGameStore.getState();
        if (editingRound) {
          const latest = state.rounds.find(
            (round) => round.id === editingRound.id,
          );
          if (
            !latest ||
            (latest.updatedAt ?? latest.createdAt) !== editingRevision.current
          )
            throw new Error(
              'Dieses Spiel wurde inzwischen geändert. Bitte die Eingabe schließen und den aktuellen Stand erneut öffnen.',
            );
        }
        if (state.currentTable?.id !== table?.id)
          throw new Error(
            'Der aktive Tisch hat sich geändert. Bitte die Eingabe erneut öffnen.',
          );
        if (
          !editingRound &&
          participationRevision(
            state.currentTable,
            state.players,
            state.rounds.length,
          ) !== openingParticipation
        )
          throw new Error(
            'Die Besetzung oder Sitzordnung hat sich ge�ndert. Bitte die Eingabe schlie�en und erneut �ffnen.',
          );
        const result = editingRound
          ? state.updateRound(editingRound.id, payload)
          : state.addRound({
              ...payload,
              participationRevision: openingParticipation,
            });
        if (!result)
          throw new Error(
            useGameStore.getState().roundError ??
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
      await AsyncStorage.removeItem(storageKey);
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
        drafts.set(key, {
          draft,
          revision,
          committedId: committed.current,
        });
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
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
            style={({ pressed }) => [
              [styles.control, styles.stepButton, styles.stepDivider],
              pressed && authInteraction.pressed,
              value === 0 && authInteraction.disabled,
            ]}
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
            style={({ pressed }) => [
              [styles.control, styles.stepButton],
              pressed && authInteraction.pressed,
              value >= maximum && authInteraction.disabled,
            ]}
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
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && authInteraction.pressed,
                  saving && authInteraction.disabled,
                ]}
              >
                <ChevronLeft
                  size={authControlSizes.icon}
                  color={authColors.textPrimary}
                />
              </Pressable>
              <AppText accessibilityRole="header" style={styles.title}>
                {draft.choosing ? 'Spielauswahl' : gameLabel}
              </AppText>
            </View>
            <EntryScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentInsetAdjustmentBehavior="automatic"
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
                {!customMode ? (
                  <AppText style={styles.hint}>
                    {editingRound ? 'Mitgespielt' : 'Spielen'}:{' '}
                    {players.map((p) => p.name).join(', ')}
                    {editingRound?.roundContext
                      ? ` � Geber: ${roster.find((p) => p.id === editingRound.roundContext!.dealerIdBefore)?.name ?? 'unbekannt'}`
                      : ''}
                  </AppText>
                ) : null}
                {draft.choosing ? (
                  <>
                    <AppText style={styles.hint}>
                      {editingRound
                        ? 'Spielart mit den ursprünglichen Tisch-Tarifen korrigieren. Parteien und Boni werden beim Wechsel neu gewählt.'
                        : 'Welche Spielart wurde gespielt? Nur aktivierte Spiele sind verfügbar.'}
                    </AppText>
                    {draft.declarer ? (
                      <AppText style={styles.gold}>
                        Ansager:{' '}
                        {players.find((p) => p.id === draft.declarer)?.name ??
                          'Unbekannt'}
                      </AppText>
                    ) : null}
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
                      onPress={() =>
                        patch({
                          choosing: true,
                        })
                      }
                      style={({ pressed }) => [
                        styles.row,
                        pressed && authInteraction.pressed,
                      ]}
                    >
                      <AppText style={styles.gold}>‹ Spielart ändern</AppText>
                    </Pressable>
                    {customMode ? (
                      <CustomAmountsEditor
                        players={roster}
                        entries={draft.customEntries ?? {}}
                        onChange={(customEntries) => patch({ customEntries })}
                        disabled={immutable}
                      />
                    ) : (
                      <>
                        <View style={styles.tariffHeader}>
                          <AppText style={styles.hint}>
                            {stockDeposit
                              ? 'Einzahlung je Spieler'
                              : draft.manual
                                ? 'Gewinnerpartei gesamt'
                                : 'Tarif pro Spieler'}
                          </AppText>
                          <AppText selectable style={styles.amount}>
                            {stockDeposit
                              ? formatOverviewMoney(stockUnit ?? 0)
                              : draft.manual
                                ? formatOverviewMoney(amountCents)
                                : formatOverviewMoney(tariff?.totalCents ?? 0)}
                          </AppText>
                        </View>
                        {stockDeposit ? (
                          <View style={styles.card}>
                            <AppText style={styles.label}>
                              Stock einzahlen
                            </AppText>
                            <AppText style={styles.hint}>
                              Alle vier zahlen den konfigurierten Einsatz.
                              Spielboni und Multiplikatoren verändern diese
                              Einzahlung nicht.
                            </AppText>
                            {players.map((player) => (
                              <View key={player.id} style={styles.row}>
                                <AppText style={styles.text}>
                                  {player.name}
                                </AppText>
                                <AppText style={styles.text}>
                                  −{formatOverviewMoney(stockUnit ?? 0)}
                                </AppText>
                              </View>
                            ))}
                            <AppText style={styles.gold}>
                              Stock danach:{' '}
                              {formatOverviewMoney(stockBefore + amountCents)}
                            </AppText>
                            <AppText style={styles.hint}>
                              Alle weiter: Derselbe Geber teilt erneut aus.
                              Geber und Leger bleiben erhalten.
                            </AppText>
                          </View>
                        ) : (
                          <>
                            {draft.gameType !== 'ramsch' &&
                            (!partnerGame || !draft.declarer) ? (
                              <View style={styles.card}>
                                <AppText style={styles.text}>Ansager</AppText>
                                <View style={styles.roleRow}>
                                  {players.map((p) => (
                                    <Pressable
                                      key={p.id}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Ansager ${p.name}`}
                                      disabled={
                                        !!initialDeclarerId &&
                                        !editingRound &&
                                        p.id !== initialDeclarerId
                                      }
                                      accessibilityState={{
                                        selected: draft.declarer === p.id,
                                      }}
                                      onPress={() => chooseDeclarer(p.id)}
                                      style={[
                                        styles.roleChoice,
                                        draft.declarer === p.id &&
                                          styles.selected,
                                      ]}
                                    >
                                      <AppText style={styles.text}>
                                        {p.name}
                                      </AppText>
                                    </Pressable>
                                  ))}
                                </View>
                                {!draft.declarer && editingRound ? (
                                  <AppText style={styles.hint}>
                                    Bisheriger Ansager unbekannt. Nur eine
                                    bekannte Zuordnung ergänzen.
                                  </AppText>
                                ) : null}
                                {partnerGame && draft.declarer ? (
                                  <>
                                    <AppText style={styles.text}>
                                      Partner
                                    </AppText>
                                    <View style={styles.roleRow}>
                                      {players
                                        .filter((p) => p.id !== draft.declarer)
                                        .map((p) => (
                                          <Pressable
                                            key={p.id}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Partner ${p.name}`}
                                            accessibilityState={{
                                              selected: draft.partner === p.id,
                                            }}
                                            onPress={() => choosePartner(p.id)}
                                            style={[
                                              styles.roleChoice,
                                              draft.partner === p.id &&
                                                styles.selected,
                                            ]}
                                          >
                                            <AppText style={styles.text}>
                                              {p.name}
                                            </AppText>
                                          </Pressable>
                                        ))}
                                    </View>
                                  </>
                                ) : null}
                                {draft.declarer ? (
                                  <View
                                    style={[
                                      styles.segments,
                                      styles.declarerResult,
                                    ]}
                                  >
                                    {([true, false] as const).map((won) => (
                                      <Pressable
                                        key={String(won)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Ansager ${won ? 'gewonnen' : 'verloren'}`}
                                        accessibilityState={{
                                          selected: (won
                                            ? draft.winners
                                            : draft.losers
                                          ).includes(draft.declarer),
                                        }}
                                        onPress={() => chooseResult(won)}
                                        style={[
                                          styles.segment,
                                          (won
                                            ? draft.winners
                                            : draft.losers
                                          ).includes(draft.declarer) &&
                                            styles.selected,
                                        ]}
                                      >
                                        <AppText style={styles.segmentText}>
                                          {won ? 'Gewonnen' : 'Verloren'}
                                        </AppText>
                                      </Pressable>
                                    ))}
                                  </View>
                                ) : null}
                              </View>
                            ) : null}
                            <View style={styles.playerList}>
                              {players.map((player, index) => {
                                const winner = draft.winners.includes(
                                  player.id,
                                );
                                const loser = draft.losers.includes(player.id);
                                const cents = winner
                                  ? (party?.winnerCents ??
                                      (draft.winners.length
                                        ? amountCents / draft.winners.length
                                        : 0)) +
                                    (stockPayout ? stockShare(player.id) : 0)
                                  : loser
                                    ? -(
                                        party?.loserCents ??
                                        (draft.losers.length
                                          ? amountCents / draft.losers.length
                                          : 0)
                                      ) -
                                      (stockDouble ? stockShare(player.id) : 0)
                                    : 0;
                                return (
                                  <View
                                    key={player.id}
                                    style={[
                                      styles.playerRow,
                                      expandedPlayerLayout &&
                                        styles.expandedPlayerRow,
                                      index < players.length - 1 &&
                                        styles.playerSeparator,
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
                                          (!placedLegerIds.includes(
                                            player.id,
                                          ) &&
                                            placedLegerIds.length >= 4),
                                      }}
                                      disabled={
                                        immutable ||
                                        !canKnock ||
                                        (!placedLegerIds.includes(player.id) &&
                                          placedLegerIds.length >= 4)
                                      }
                                      onPress={() => toggleKnock(player.id)}
                                      style={({ pressed }) => [
                                        styles.coinButton,
                                        pressed && authInteraction.pressed,
                                        (immutable ||
                                          !canKnock ||
                                          (!placedLegerIds.includes(
                                            player.id,
                                          ) &&
                                            placedLegerIds.length >= 4)) &&
                                          authInteraction.disabled,
                                      ]}
                                    >
                                      <EuroStyleCoin
                                        label={
                                          placedLegerIds.includes(player.id)
                                            ? '2×'
                                            : '1×'
                                        }
                                        muted={
                                          !placedLegerIds.includes(player.id)
                                        }
                                      />
                                    </Pressable>
                                    <Pressable
                                      accessible={
                                        guided &&
                                        !partnerGame &&
                                        draft.gameType !== 'ramsch'
                                      }
                                      focusable={
                                        guided &&
                                        !partnerGame &&
                                        draft.gameType !== 'ramsch'
                                      }
                                      accessibilityRole={
                                        guided &&
                                        !partnerGame &&
                                        draft.gameType !== 'ramsch'
                                          ? 'button'
                                          : undefined
                                      }
                                      accessibilityLabel={
                                        guided &&
                                        !partnerGame &&
                                        draft.gameType !== 'ramsch'
                                          ? `Alleinspieler ${player.name}`
                                          : `Ergebnis für ${player.name}`
                                      }
                                      disabled={
                                        !!initialDeclarerId &&
                                        !editingRound &&
                                        player.id !== initialDeclarerId
                                      }
                                      accessibilityState={{
                                        selected: draft.solo === player.id,
                                      }}
                                      onPress={() => {
                                        if (
                                          guided &&
                                          !partnerGame &&
                                          draft.gameType !== 'ramsch'
                                        )
                                          selectSolo(player.id);
                                      }}
                                      style={({ pressed }) => [
                                        styles.playerIdentity,
                                        pressed && authInteraction.pressed,
                                      ]}
                                    >
                                      <View style={styles.playerNameBlock}>
                                        <AppText
                                          numberOfLines={
                                            expandedPlayerLayout ? undefined : 1
                                          }
                                          style={styles.playerName}
                                        >
                                          {player.name}
                                        </AppText>
                                        {draft.declarer === player.id ? (
                                          <AppText style={styles.gold}>
                                            {partnerGame
                                              ? 'Spielmacher'
                                              : 'Alleinspieler'}
                                          </AppText>
                                        ) : partnerGame &&
                                          draft.partner === player.id ? (
                                          <AppText style={styles.gold}>
                                            Gesuchter
                                          </AppText>
                                        ) : null}
                                        <AppText
                                          style={
                                            winner ? styles.gold : styles.hint
                                          }
                                        >
                                          {winner || loser
                                            ? `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${formatOverviewMoney(Math.round(Math.abs(cents)))}`
                                            : '—'}
                                        </AppText>
                                      </View>
                                    </Pressable>
                                    <View
                                      style={[
                                        styles.segments,
                                        expandedPlayerLayout &&
                                          styles.expandedSegments,
                                      ]}
                                    >
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
                                          style={({ pressed }) => [
                                            [
                                              styles.segment,
                                              (won ? winner : loser) &&
                                                (won
                                                  ? styles.segmentWon
                                                  : styles.selected),
                                            ],
                                            pressed && authInteraction.pressed,
                                          ]}
                                          onPress={() => {
                                            if (draft.gameType === 'ramsch') {
                                              selectRamsch(player.id, won);
                                            } else if (guided && !partnerGame) {
                                              if (
                                                draft.solo &&
                                                draft.solo !== player.id &&
                                                (winner || loser)
                                              )
                                                selectSolo(draft.solo, !won);
                                              else selectSolo(player.id, won);
                                            } else if (partnerGame) {
                                              selectSauspiel(player.id, won);
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
                                    style={({ pressed }) => [
                                      [
                                        styles.suitChoice,
                                        draft.suit === suit.id &&
                                          styles.selected,
                                      ],
                                      pressed && authInteraction.pressed,
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
                                <>
                                  <AppText
                                    style={[styles.hint, styles.optionHint]}
                                  >
                                    {draft.options.durchmarsch
                                      ? 'Ein Spieler gewinnt gegen drei.'
                                      : 'Höchste Augenzahl verliert gegen die anderen drei.'}
                                  </AppText>
                                  {rules.ramschDurchmarsch ? (
                                    <View
                                      style={[styles.row, styles.optionRow]}
                                    >
                                      <AppText
                                        style={[
                                          styles.text,
                                          styles.optionLabel,
                                        ]}
                                      >
                                        Durchmarsch
                                      </AppText>
                                      <View style={styles.switchColumn}>
                                        <Switch
                                          thumbColor={authColors.textPrimary}
                                          trackColor={{
                                            true: authColors.gold,
                                            false: authColors.control,
                                          }}
                                          ios_backgroundColor={
                                            authColors.control
                                          }
                                          accessibilityLabel="Durchmarsch"
                                          value={
                                            draft.options.durchmarsch ?? false
                                          }
                                          onValueChange={(durchmarsch) =>
                                            patch({
                                              options: {
                                                ...draft.options,
                                                durchmarsch,
                                                jungfrauen: 0,
                                              },
                                              ...(durchmarsch
                                                ? { winners: [], losers: [] }
                                                : {}),
                                            })
                                          }
                                        />
                                      </View>
                                    </View>
                                  ) : null}
                                  {rules.ramschJungfrau &&
                                  !draft.options.durchmarsch
                                    ? count('jungfrauen', 'Jungfrauen', 2)
                                    : null}
                                </>
                              ) : null}
                              {sauspiel &&
                              !automaticStock &&
                              (settings.games.stock.enabled ||
                                stockBefore > 0 ||
                                editingRound?.stockAction === 'payout') ? (
                                <View style={styles.optionSection}>
                                  <View style={[styles.row, styles.optionRow]}>
                                    <AppText
                                      style={[styles.text, styles.optionLabel]}
                                    >
                                      Stock auszahlen ·{' '}
                                      {formatOverviewMoney(stockBefore)}
                                    </AppText>
                                    <View style={styles.switchColumn}>
                                      <Switch
                                        thumbColor={authColors.textPrimary}
                                        trackColor={{
                                          true: authColors.gold,
                                          false: authColors.control,
                                        }}
                                        ios_backgroundColor={authColors.control}
                                        accessibilityLabel="Stock auszahlen"
                                        disabled={
                                          stockBefore <= 0 ||
                                          (!!draft.declarer && !draft.won) ||
                                          draft.winners.length !== 2 ||
                                          draft.losers.length !== 2
                                        }
                                        value={stockPayout}
                                        onValueChange={(payStock) =>
                                          patch({
                                            payStock,
                                          })
                                        }
                                      />
                                    </View>
                                  </View>
                                  <AppText
                                    style={[styles.hint, styles.optionHint]}
                                  >
                                    {stockPayout
                                      ? `${formatOverviewMoney(stockBefore / 2)} zusätzlich je Sauspiel-Gewinner.`
                                      : 'Nur bei gewonnener Spielerpartei, je zur Hälfte.'}
                                  </AppText>
                                </View>
                              ) : null}
                              {sauspiel &&
                              automaticStock &&
                              settings.games.stock.enabled ? (
                                <View style={styles.optionSection}>
                                  <AppText
                                    style={[styles.text, styles.optionLabel]}
                                  >
                                    Stock · {formatOverviewMoney(stockBefore)}
                                  </AppText>
                                  <AppText
                                    style={[styles.hint, styles.optionHint]}
                                  >
                                    {stockPayout
                                      ? `Wird automatisch an Ansager und Partner ausgezahlt. Stock danach: 0,00 €.`
                                      : stockDouble
                                        ? `Ansager und Partner zahlen zusätzlich ein. Stock danach: ${formatOverviewMoney(stockBefore * 2)}.`
                                        : stockBefore === 0
                                          ? 'Der Stock ist leer. Keine zusätzliche Stockbuchung.'
                                          : 'Nach Auswahl des Ergebnisses wird der Stock automatisch ausgezahlt oder verdoppelt.'}
                                  </AppText>
                                </View>
                              ) : null}
                              {draft.manual ? (
                                <View style={styles.optionSection}>
                                  <AppText
                                    style={[styles.hint, styles.optionHint]}
                                  >
                                    Historischer manueller Gesamtgewinn, ohne
                                    zusätzliche Faktoren.
                                  </AppText>
                                  <AmountInput
                                    accessibilityLabel="Betrag"
                                    keyboardType="decimal-pad"
                                    returnKeyType="done"
                                    onSubmitEditing={Keyboard.dismiss}
                                    value={draft.manualAmount}
                                    onChangeText={(manualAmount) =>
                                      patch({
                                        manualAmount,
                                      })
                                    }
                                    style={styles.input}
                                  />
                                </View>
                              ) : (
                                <>
                                  {draft.gameType !== 'ramsch' &&
                                  rules.bonuses.laufende &&
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
                                        draft.gameType !== 'ramsch' &&
                                        rules.bonuses[id] &&
                                        settings.bonusRules[id].enabled,
                                    )
                                    .map((id) => (
                                      <View
                                        key={id}
                                        style={[styles.row, styles.optionRow]}
                                      >
                                        <AppText
                                          style={[
                                            styles.text,
                                            styles.optionLabel,
                                          ]}
                                        >
                                          {id === 'schneider'
                                            ? 'Schneider'
                                            : 'Schwarz'}
                                        </AppText>
                                        <View style={styles.switchColumn}>
                                          <Switch
                                            thumbColor={authColors.textPrimary}
                                            trackColor={{
                                              true: authColors.gold,
                                              false: authColors.control,
                                            }}
                                            ios_backgroundColor={
                                              authColors.control
                                            }
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
                                      </View>
                                    ))}
                                  {rules.bonuses.stoss ? (
                                    <>
                                      <View
                                        style={[styles.row, styles.optionRow]}
                                      >
                                        <AppText
                                          style={[
                                            styles.text,
                                            styles.optionLabel,
                                          ]}
                                        >
                                          Kontra
                                        </AppText>
                                        <View style={styles.switchColumn}>
                                          <Switch
                                            thumbColor={authColors.textPrimary}
                                            trackColor={{
                                              true: authColors.gold,
                                              false: authColors.control,
                                            }}
                                            ios_backgroundColor={
                                              authColors.control
                                            }
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
                                      </View>
                                      {count('stoss', 'Re', 3, 1, 1)}
                                      <AppText
                                        style={[styles.hint, styles.optionHint]}
                                      >
                                        Kontra ×2 · jede Re-Stufe nochmals ×2
                                      </AppText>
                                    </>
                                  ) : null}
                                  <AppText
                                    style={[styles.hint, styles.optionHint]}
                                  >
                                    Gesamtfaktor: {tariff?.multiplier ?? 1}x ·{' '}
                                    {effectiveOptions.legerCount} Leger
                                  </AppText>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="Preisaufschlüsselung"
                                    accessibilityState={{
                                      expanded: details,
                                    }}
                                    style={({ pressed }) => [
                                      styles.row,
                                      pressed && authInteraction.pressed,
                                    ]}
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
                                        <View
                                          key={line.label}
                                          style={styles.row}
                                        >
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
                                            {formatOverviewMoney(
                                              party.winnerCents,
                                            )}
                                          </AppText>
                                          <AppText style={styles.text}>
                                            Je Verlierer: −
                                            {formatOverviewMoney(
                                              party.loserCents,
                                            )}
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
                  </>
                )}
              </View>
            </EntryScrollView>
            {!draft.choosing ? (
              <View style={styles.footer}>
                <View accessibilityLiveRegion="polite">
                  <AppText
                    selectable
                    accessibilityRole={saveError ? 'alert' : undefined}
                    style={styles.hint}
                  >
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
                  disabled={loadingDraft || saving || (!committedId && !valid)}
                  loading={saving}
                  onPress={save}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Schließen"
                  disabled={immutable}
                  onPress={requestClose}
                  style={({ pressed }) => [
                    styles.discard,
                    pressed && authInteraction.pressed,
                    immutable && authInteraction.disabled,
                  ]}
                >
                  <AppText style={styles.hint}>Schließen</AppText>
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
            <AppText accessibilityRole="header" style={styles.dialogTitle}>
              {'Eingabe schließen?'}
            </AppText>
            <AppText style={styles.hint}>
              {committedId
                ? 'Die Runde ist noch nicht auf dem Gerät gesichert.'
                : 'Nicht gespeicherte Eingaben gehen verloren.'}
            </AppText>
            {saveError ? (
              <AppText accessibilityRole="alert" style={styles.hint}>
                {saveError}
              </AppText>
            ) : null}
            <GoldButton
              title="Weiter bearbeiten"
              onPress={() => setCloseChoice(false)}
            />
            {!committedId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Entwurf verwerfen"
                style={({ pressed }) => [
                  styles.dialogDiscard,
                  pressed && authInteraction.pressed,
                ]}
                onPress={() => leave(false)}
              >
                <AppText style={styles.dialogDiscardText}>
                  Entwurf verwerfen
                </AppText>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: authSpacing.lgPlus,
    paddingTop: authSpacing.md,
  },
  header: {
    gap: authSpacing.md,
    paddingBottom: authSpacing.sm,
  },
  backButton: {
    width: authControlSizes.touch,
    height: authControlSizes.touch,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    backgroundColor: authColors.control,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tariffHeader: {
    gap: authSpacing.xs,
    paddingBottom: authSpacing.sm,
  },
  countValue: {
    color: authColors.textPrimary,
    ...authTextStyles.counter,
    textAlign: 'center',
    minWidth: authControlSizes.counter,
  },
  playerList: {
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.xs,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    backgroundColor: authColors.surfaceElevated,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    minHeight: authControlSizes.playerRow,
  },
  expandedPlayerRow: { flexWrap: 'wrap', paddingVertical: authSpacing.sm },
  expandedSegments: { width: '100%', maxWidth: '100%', flexBasis: '100%' },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    minHeight: authControlSizes.field,
  },
  coinButton: {
    minWidth: authControlSizes.touch,
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNameBlock: {
    flex: 1,
    minWidth: 0,
    gap: authSpacing.xs,
  },
  playerName: {
    color: authColors.textPrimary,
    ...authTextStyles.label,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: authColors.controlMuted,
    borderWidth: 1,
    borderColor: authColors.controlBorder,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    width: '50%',
    maxWidth: 260,
  },
  segment: {
    flex: 1,
    minHeight: authControlSizes.touch,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: authColors.transparent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: authSpacing.xs,
  },
  segmentText: {
    color: authColors.textPrimary,
    ...authTextStyles.control,
  },
  segmentWon: {
    backgroundColor: authColors.goldHighlight,
    borderColor: authColors.gold,
  },
  segmentWonText: {
    color: authColors.onGold,
    fontWeight: '700',
  },
  declarerResult: { width: '100%', maxWidth: '100%' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: authSpacing.sm },
  roleChoice: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '44%',
    minHeight: authControlSizes.touch,
    padding: authSpacing.sm,
    borderWidth: 1,
    borderColor: authColors.suitBorder,
    borderRadius: authRadius.sm,
    backgroundColor: authColors.suitSurface,
  },
  suitRow: {
    flexDirection: 'row',
    gap: authSpacing.sm,
    padding: authSpacing.sm,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    backgroundColor: authColors.surfaceElevated,
  },
  suitChoice: {
    flex: 1,
    minHeight: authControlSizes.suit,
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpacing.sm,
    borderRadius: authRadius.sm,
    borderCurve: 'continuous',
    backgroundColor: authColors.suitSurface,
    borderWidth: 1,
    borderColor: authColors.suitBorder,
  },
  suitLabel: {
    color: authColors.textMutedGreen,
    ...authTextStyles.control,
  },
  discard: {
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  optionsPanel: {
    paddingHorizontal: authSpacing.lg,
    paddingVertical: authSpacing.sm,
    gap: 0,
    borderWidth: 1,
    borderColor: authColors.borderGold,
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    backgroundColor: authColors.surfaceElevated,
  },
  optionSection: {
    paddingVertical: authSpacing.sm,
  },
  playerSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.listSeparator,
  },
  optionRow: {
    flexWrap: 'nowrap',
    minHeight: authControlSizes.touch + 2 + authSpacing.sm * 2,
    paddingVertical: authSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.listSeparator,
  },
  optionHint: {
    paddingVertical: authSpacing.sm,
  },
  switchColumn: {
    width: authControlSizes.stepper,
    minHeight: authControlSizes.touch + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
  },
  tableContext: {
    width: authControlSizes.stepper,
    textAlign: 'right',
  },
  stepper: {
    width: authControlSizes.stepper,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: authColors.controlBorder,
    backgroundColor: authColors.control,
  },
  stepButton: {
    flex: 1,
    borderRadius: 0,
    backgroundColor: authColors.transparent,
    paddingHorizontal: 0,
  },
  stepDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: authColors.controlSeparator,
  },
  content: {
    gap: authSpacing.md,
    paddingBottom: authSpacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: authSpacing.md,
    minHeight: authControlSizes.touch,
  },
  title: {
    color: authColors.textPrimary,
    ...authTextStyles.hero,
    fontWeight: '800',
    flexShrink: 1,
  },
  label: {
    color: authColors.goldHighlight,
    fontWeight: '700',
  },
  text: {
    color: authColors.textPrimary,
    flexShrink: 1,
  },
  hint: {
    ...authTextStyles.caption,
    flexShrink: 1,
  },
  gold: {
    color: authColors.goldHighlight,
    fontWeight: '700',
  },
  selected: {
    backgroundColor: authColors.selectedSurface,
    borderColor: authColors.gold,
  },
  control: {
    minWidth: authControlSizes.touch,
    minHeight: authControlSizes.touch,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: authRadius.sm,
    borderCurve: 'continuous',
    backgroundColor: authColors.control,
    paddingHorizontal: authSpacing.md,
  },
  card: {
    padding: authSpacing.lg,
    borderRadius: authRadius.md,
    borderCurve: 'continuous',
    backgroundColor: authColors.surfaceElevated,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    gap: authSpacing.md,
  },
  input: {
    color: authColors.textPrimary,
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    borderRadius: authRadius.sm,
    borderCurve: 'continuous',
    padding: authSpacing.lg,
    minHeight: authControlSizes.field,
  },
  footer: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.borderSoft,
    gap: authSpacing.sm,
    paddingTop: authSpacing.md,
    paddingBottom: authSpacing.md,
  },
  amount: {
    color: authColors.textPrimary,
    ...authTextStyles.amount,
    fontWeight: '800',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: authSpacing.lgPlus,
    backgroundColor: authColors.overlay,
  },
  dialog: {
    flexGrow: 0,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    backgroundColor: authColors.surface,
    maxHeight: '85%',
    borderRadius: authRadius.lg,
    borderCurve: 'continuous',
  },
  dialogTitle: {
    color: authColors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  dialogDiscard: {
    minHeight: authControlSizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    padding: authSpacing.sm,
  },
  dialogDiscardText: {
    color: authColors.errorText,
    fontWeight: '600',
  },
  dialogContent: {
    padding: authSpacing.lgPlus,
    gap: authSpacing.lg,
  },
});
