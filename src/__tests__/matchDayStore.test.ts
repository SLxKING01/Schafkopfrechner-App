import { useMatchDayStore } from '../store/matchDayStore';

function resetMatchDayStore() {
  useMatchDayStore.setState({
    activeMatchDayId: null,
    matchDays: [],
  });
}

describe('matchDayStore', () => {
  beforeEach(() => {
    resetMatchDayStore();
  });

  it('creates and activates a match day', () => {
    useMatchDayStore.getState().createMatchDay('Freitag');

    const state = useMatchDayStore.getState();

    expect(state.matchDays).toHaveLength(1);
    expect(state.matchDays[0]).toMatchObject({
      name: 'Freitag',
      isActive: true,
      isClosed: false,
    });
    expect(state.activeMatchDayId).toBe(state.matchDays[0].id);
  });

  it('closes a match day', () => {
    useMatchDayStore.getState().createMatchDay('Freitag');
    const matchDayId = useMatchDayStore.getState().activeMatchDayId;

    useMatchDayStore.getState().closeMatchDay(matchDayId!);

    const matchDay = useMatchDayStore.getState().matchDays[0];

    expect(matchDay.isClosed).toBe(true);
    expect(matchDay.closedAt).toBeDefined();
  });

  it('creates and activates the next match day', () => {
    useMatchDayStore.getState().createMatchDay('Freitag');
    const firstMatchDayId = useMatchDayStore.getState().activeMatchDayId;

    useMatchDayStore.getState().createAndActivateNextMatchDay();

    const state = useMatchDayStore.getState();
    const activeMatchDay = state.matchDays.find(
      (matchDay) => matchDay.id === state.activeMatchDayId,
    );

    expect(state.matchDays).toHaveLength(2);
    expect(state.activeMatchDayId).not.toBe(firstMatchDayId);
    expect(activeMatchDay?.isActive).toBe(true);
    expect(activeMatchDay?.isClosed).toBe(false);
  });
});
