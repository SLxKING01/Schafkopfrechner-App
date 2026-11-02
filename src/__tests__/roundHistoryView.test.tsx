import { act } from 'react';
import { Pressable, Text } from 'react-native';

import { RoundHistoryActions } from '../components/game/RoundHistoryActions';
import { RoundHistoryContent } from '../components/game/RoundHistoryView';
import { createDefaultTableSettings } from '../constants/tableSettings';
import type { GameRound, GameTable } from '../types/game';
import { appendRoundHistory } from '../utils/roundHistory';
import { emptyTariffOptions } from '../utils/roundTariff';

const renderer = jest.requireActual('react-test-renderer');
const readText = (view: {
  root: {
    findAllByType: (type: unknown) => { props: { children?: unknown } }[];
  };
}) =>
  view.root
    .findAllByType(Text)
    .map((node) => {
      const children = node.props.children;
      return (Array.isArray(children) ? children : [children])
        .filter(
          (value) => typeof value === 'string' || typeof value === 'number',
        )
        .join('');
    })
    .join('\n');

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, {
    get: (target, key) =>
      key === 'Modal'
        ? ({
            visible,
            children,
          }: {
            visible: boolean;
            children: React.ReactNode;
          }) => (visible ? children : null)
        : target[key],
  });
});
const players = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id.toUpperCase(),
  isLocal: true,
}));
const round: GameRound = {
  id: 'round',
  tableId: 'table',
  createdAt: '2026-11-02T19:35:00Z',
  gameType: 'wenz',
  winnerId: 'a',
  winnerIds: ['a'],
  loserIds: ['b', 'c', 'd'],
  declarerId: 'a',
  amount: 1.5,
  settingsSnapshot: createDefaultTableSettings(),
  tariffOptions: { ...emptyTariffOptions },
};
const changed = {
  ...round,
  amount: 2.4,
  tariffOptions: { ...emptyTariffOptions, laufende: 3 },
};
let table: GameTable = {
  id: 'table',
  name: 'Freitagsrunde',
  hashCode: 'secret',
  createdAt: '2026-11-02T19:00:00Z',
  isActive: true,
  settings: createDefaultTableSettings(),
};
table = appendRoundHistory(table, [], [round], players, {
  kind: 'local',
  name: 'Lokale Erfassung',
});
table = appendRoundHistory(
  table,
  [round],
  [changed],
  players,
  { kind: 'account', id: 'account', name: 'Simon' },
  round.id,
);

it('opens a separate history view from the row menu while retaining the original edit action', async () => {
  const edit = jest.fn();
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <RoundHistoryActions
        table={table}
        rounds={[changed]}
        players={players}
        round={changed}
        onEdit={edit}
      >
        <Pressable onPress={edit}>
          <Text>Bestehende Spielzeile</Text>
        </Pressable>
      </RoundHistoryActions>,
    );
  });
  const press = async (label: string) => {
    await act(async () =>
      view.root
        .findAllByProps({ accessibilityLabel: label })
        .find(
          (n: { props: { onPress?: unknown } }) =>
            typeof n.props.onPress === 'function',
        )!
        .props.onPress(),
    );
  };
  expect(readText(view)).not.toContain('Spiel geändert');
  await press('Aktionen für Eintrag 1 öffnen');
  await press('Änderungsverlauf');
  expect(edit).not.toHaveBeenCalled();
  const text = readText(view);
  expect(text).toContain('Laufende');
  expect(text).toContain('0,50 €');
  expect(text).toContain('0,80 €');
  expect(text).toContain('Simon');
  expect(text).not.toContain('account');
  await press('Änderungsverlauf schließen');
  expect(readText(view)).not.toContain('Spiel geändert');
  await press('Aktionen für Eintrag 1 öffnen');
  await press('Spiel bearbeiten');
  expect(edit).toHaveBeenCalledTimes(1);
  await act(async () => view.unmount());
});

it('shows removed games in the table history without offering version restoration or editing', async () => {
  const deleted = appendRoundHistory(
    table,
    [changed],
    [],
    players,
    { kind: 'local', name: 'Lokale Erfassung' },
    round.id,
  );
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <RoundHistoryContent
        table={deleted}
        rounds={[]}
        players={players}
        roundId={round.id}
        onClose={jest.fn()}
      />,
    );
  });
  const text = readText(view);
  expect(text).toContain('Gelöschtes Spiel');
  expect(text).toContain('Spiel gelöscht');
  expect(text).toContain('Nicht mehr in der Abrechnung');
  expect(text).not.toContain('Wiederherstellen');
  expect(text).not.toContain('Spiel bearbeiten');
  await act(async () => view.unmount());
});

it('explains unavailable history for older entries without inventing an author or events', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <RoundHistoryContent
        table={{ ...table, roundHistory: undefined }}
        rounds={[round]}
        players={players}
        roundId={round.id}
        onClose={jest.fn()}
      />,
    );
  });
  const text = readText(view);
  expect(text).toContain('Aktionen vor Einführung');
  expect(text).not.toContain('Spiel erfasst');
  expect(text).not.toContain('Simon');
  await act(async () => view.unmount());
});

it('offers restoration only on the latest deletion and explains a failed attempt without dismissing history', async () => {
  const deleted = appendRoundHistory(table, [changed], [], players, {
    kind: 'local',
    name: 'Lokale Erfassung',
  });
  const restore = jest.fn(
    () => 'Der Stock passt nicht zum späteren Regelwechsel.',
  );
  let view: ReturnType<typeof renderer.create>;
  const props = {
    table: deleted,
    rounds: [],
    players,
    onRestore: restore,
    onClose: jest.fn(),
  };
  await act(async () => {
    view = renderer.create(<RoundHistoryContent {...props} />);
  });
  await act(async () =>
    view.root
      .findAllByProps({ accessibilityLabel: 'Spiel wiederherstellen' })
      .find(
        (n: { props: { onPress?: unknown } }) =>
          typeof n.props.onPress === 'function',
      )!
      .props.onPress(),
  );
  expect(restore).toHaveBeenCalledWith(round.id);
  expect(readText(view)).toContain('Der Stock passt nicht');
  const restored = appendRoundHistory(deleted, [], [changed], players, {
    kind: 'local',
    name: 'Lokale Erfassung',
  });
  await act(async () =>
    view.update(
      <RoundHistoryContent {...props} table={restored} rounds={[changed]} />,
    ),
  );
  expect(readText(view)).toContain('Spiel wiederhergestellt');
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Spiel wiederherstellen' }),
  ).toHaveLength(0);
  await act(async () =>
    view.update(
      <RoundHistoryContent
        {...props}
        table={{ ...deleted, isActive: false }}
      />,
    ),
  );
  expect(
    view.root.findAllByProps({ accessibilityLabel: 'Spiel wiederherstellen' }),
  ).toHaveLength(0);
  await act(async () => view.unmount());
});
