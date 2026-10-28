import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useGameStore } from '../store/gameStore';
import { useMatchDayStore } from '../store/matchDayStore';
import { usePlayerStore } from '../store/playerStore';
import { buildGameOverview } from '../utils/gameOverview';

export function useGameOverview() {
  const currentTable = useGameStore((s) => s.currentTable);
  const players = useGameStore((s) => s.players);
  const rounds = useGameStore((s) => s.rounds);
  const balances = useGameStore((s) => s.balances);
  const settlements = useGameStore((s) => s.settlements);
  const activeGame = useGameStore((s) => s.activeGame);
  const archivedGameDays = useGameStore((s) => s.archivedGameDays);
  const games = useGameStore((s) => s.games);
  const savedPlayers = usePlayerStore((s) => s.players);
  const matchDays = useMatchDayStore((s) => s.matchDays);
  const activeMatchDayId = useMatchDayStore((s) => s.activeMatchDayId);
  const [today, setToday] = useState(() => new Date().setHours(0, 0, 0, 0));
  useEffect(() => {
    const refresh = () => setToday(new Date().setHours(0, 0, 0, 0));
    const timer = setInterval(refresh, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return useMemo(
    () =>
      buildGameOverview(
        {
          currentTable,
          players,
          rounds,
          balances,
          settlements,
          activeGame,
          archivedGameDays,
          games,
          savedPlayers,
          matchDays,
          activeMatchDayId,
        },
        new Date(today),
      ),
    [
      currentTable,
      players,
      rounds,
      balances,
      settlements,
      activeGame,
      archivedGameDays,
      games,
      savedPlayers,
      matchDays,
      activeMatchDayId,
      today,
    ],
  );
}
