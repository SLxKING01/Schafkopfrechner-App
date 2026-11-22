const { enter } = require('./round.cjs');
exports.rounds = [
  {
    declarer: 'Simon',
    game: 'Rufspiel',
    partner: 'Vroni',
    suit: 'Eichel',
    laufende: 3,
  },
  { declarer: 'Sepp', game: 'Solo', suit: 'Herz' },
  {
    declarer: 'Korbinian',
    game: 'Rufspiel',
    partner: 'Sepp',
    suit: 'Gras',
    won: false,
  },
  {
    declarer: 'Vroni',
    game: 'Rufspiel',
    partner: 'Simon',
    suit: 'Schellen',
    schneider: true,
  },
  { declarer: 'Simon', game: 'Solo', suit: 'Eichel', won: false },
  {
    declarer: 'Sepp',
    game: 'Rufspiel',
    partner: 'Korbinian',
    suit: 'Eichel',
    won: false,
  },
  { declarer: 'Vroni', game: 'Solo', suit: 'Gras' },
  {
    declarer: 'Korbinian',
    game: 'Rufspiel',
    partner: 'Simon',
    suit: 'Schellen',
  },
];
exports.play = async (p, upto = exports.rounds.length) => {
  for (const r of exports.rounds.slice(0, upto))
    await enter(p, { tick: '07:00', ...r });
};
