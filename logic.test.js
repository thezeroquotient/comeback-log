const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const ex = (id, group, sets) => ({ id, name: id, group, sets: sets.map(([w, r]) => ({ w, r })) });
const day = (name, ...exs) => ({ gym: { t: 1, name, ex: exs } });

test('dates: week 1 starts Nov 1, in 7-day blocks', () => {
  assert.equal(L.weekNo('2026-11-01'), 1);
  assert.equal(L.weekNo('2026-11-07'), 1);
  assert.equal(L.weekNo('2026-11-08'), 2);
  assert.equal(L.weekStart(2), '2026-11-08');
  assert.equal(L.addDays('2026-12-31', 1), '2027-01-01');
});

test('cycle repeats from Nov 1', () => {
  const c = ['push', 'pull', 'legs', ''];
  assert.deepEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map(k => L.cycleDay(k, c)),
    ['push', 'pull', 'legs', '', 'push']);
  assert.equal(L.cycleDay('2026-12-01', c), 'legs'); // 30 days on
  assert.equal(L.cycleDay('2026-10-31', c), ''); // before the start, no crash
  assert.equal(L.cycleDay('2026-11-01', []), '');
});

test('e1RM: Epley', () => {
  near(L.e1rm(60, 10), 80);
  assert.equal(L.e1rm(100, 1), 100);
  assert.equal(L.e1rm(0, 10), 0);
});

test('session stats add up', () => {
  const s = L.sessionStats(ex('bench', 'Chest', [[60, 12], [60, 10], [60, 8], ['', '']]));
  assert.equal(s.sets, 3);
  assert.equal(s.reps, 30);
  assert.equal(s.vol, 1800);
  near(s.e1, 84);
  assert.deepEqual([s.topW, s.topR], [60, 12]);
});

test('bodyweight sets count reps, not volume', () => {
  const s = L.sessionStats(ex('dips', 'Triceps', [['', 15], ['', 12]]));
  assert.deepEqual([s.sets, s.reps, s.vol, s.e1, s.topR], [2, 27, 0, 0, 15]);
});

test('week by week change', () => {
  const days = {
    '2026-11-02': day('Push', ex('bench', 'Chest', [[60, 10], [60, 10], [60, 10]])),
    '2026-11-09': day('Push', ex('bench', 'Chest', [[62.5, 10], [62.5, 10], [62.5, 10]])),
    '2026-11-23': day('Push', ex('bench', 'Chest', [[60, 12], [60, 12]])),
  };
  const w = L.exerciseWeeks(days, 'bench');
  assert.deepEqual(w.map(x => x.week), [1, 2, 4]); // a missed week leaves a gap, not a zero
  assert.equal(w[0].dE1, null);
  near(w[1].dE1, (62.5 - 60) / 60 * 100);
  near(w[1].dVol, 4.1667);
  near(w[2].dVol, (1440 - 1875) / 1875 * 100);
});

test('two sessions in a week sum volume and keep the best e1RM', () => {
  const days = {
    '2026-11-02': day('Push', ex('bench', 'Chest', [[60, 10]])),
    '2026-11-05': day('Push', ex('bench', 'Chest', [[70, 5]])),
  };
  const [w] = L.exerciseWeeks(days, 'bench');
  assert.equal(w.vol, 950);
  near(w.e1, 70 * (1 + 5 / 30));
  assert.deepEqual([w.topW, w.topR], [70, 5]);
});

test('daily checks: Gym ticks on Submit, not while typing', () => {
  const d = day('Push', ex('b', 'Chest', [[60, 10]]));
  assert.equal(L.checks(d).gym, false);
  assert.equal(L.checks({ ...d, gymck: { t: 2, on: true } }).gym, true);
  assert.equal(L.checks({ gymck: { t: 2, on: true } }).gym, true); // cardio day, no sets
  assert.equal(L.checks({}).gym, false);
  assert.equal(L.checks({ food: { t: 1, on: false } }).food, false);
});

test('skipped days: past, on or after Nov 1, with nothing entered', () => {
  const today = '2026-11-05';
  assert.equal(L.isSkipped(undefined, '2026-11-03', today), true);
  assert.equal(L.isSkipped({ food: { t: 1, on: false } }, '2026-11-03', today), true); // unticked
  assert.equal(L.isSkipped({ walk: { t: 1, on: true } }, '2026-11-03', today), false);
  assert.equal(L.isSkipped(day('Push', ex('b', 'Chest', [[60, 10]])), '2026-11-03', today), false); // sets, not submitted
  assert.equal(L.isSkipped(undefined, today, today), false); // today isn't over
  assert.equal(L.isSkipped(undefined, '2026-11-09', today), false); // future
  assert.equal(L.isSkipped(undefined, '2026-10-31', today), false); // before the start
  assert.equal(L.weekSummary({ '2026-11-02': { walk: { t: 1, on: true } } }, 1, today).skipped, 3); // Nov 1, 3, 4
});

test('weekly summary', () => {
  const days = {
    '2026-11-02': {
      ...day('Push', ex('bench', 'Chest', [[60, 10], [60, 10]]), ex('pushdown', 'Triceps', [[30, 12]])),
      gymck: { t: 1, on: true }, food: { t: 1, on: true }, walk: { t: 1, on: true }, supp: { t: 1, on: true },
    },
    '2026-11-03': { food: { t: 1, on: true }, walk: { t: 1, on: false } },
    '2026-11-09': { ...day('Pull', ex('row', 'Back', [[50, 10]])), gymck: { t: 1, on: true } },
  };
  const s = L.weekSummary(days, 1);
  assert.deepEqual([s.gymDays, s.foodDays, s.walkDays, s.suppDays], [1, 2, 1, 1]);
  assert.equal(s.sets, 3);
  assert.equal(s.vol, 1560);
  assert.deepEqual(s.byGroup, { Chest: 2, Triceps: 1 });
  assert.equal(s.lifts.length, 2);
  assert.equal(s.lifts[0].name, 'bench');
  assert.equal(L.weekSummary(days, 2).gymDays, 1);
});

test('max: heaviest weight, then most reps, from earlier dates only', () => {
  const days = {
    '2026-10-31': day('Push', ex('b', 'Chest', [[232, 6]])), // before the start, ignored
    '2026-11-02': day('Push', ex('b', 'Chest', [[60, 10], [60, 12], [50, 15]])),
    '2026-11-09': day('Push', ex('b', 'Chest', [[70, 8]])),
    '2026-11-10': day('Push', ex('dips', 'Triceps', [['', 15], ['', 12]])),
  };
  assert.deepEqual(L.maxSet(days, 'b', '2026-11-09'), { w: 60, r: 12 });
  assert.deepEqual(L.maxSet(days, 'b', '2026-11-30'), { w: 70, r: 8 });
  assert.equal(L.maxSet(days, 'b', '2026-11-02'), null);
  assert.deepEqual(L.maxSet(days, 'dips', '2026-11-30'), { w: 0, r: 15 });
});

test('renaming or moving an exercise keeps its history (keyed by id)', () => {
  const days = {
    '2026-11-02': day('Push', { ...ex('b', 'Chest', [[60, 10]]), name: 'Bench' }),
    '2026-11-09': day('Upper', { ...ex('b', 'Chest', [[60, 10]]), name: 'Flat bench' }),
  };
  assert.equal(L.sessions(days, 'b').length, 2);
});

test('sync merge: two phones, same date, nothing lost', () => {
  const gymPhone = { plan: { t: 5, n: 'new' }, days: { '2026-11-02': { gym: { t: 10, name: 'Push' }, walk: { t: 3, on: false } } } };
  const mainPhone = { plan: { t: 2, n: 'old' }, days: {
    '2026-11-02': { food: { t: 20, on: true }, walk: { t: 30, on: true } },
    '2026-11-03': { supp: { t: 21, on: true } },
  } };
  const m = L.mergeStore(gymPhone, mainPhone);
  assert.equal(m.plan.n, 'new');
  assert.equal(m.days['2026-11-02'].gym.name, 'Push');
  assert.equal(m.days['2026-11-02'].food.on, true);
  assert.equal(m.days['2026-11-02'].walk.on, true); // newest tick wins
  assert.ok(m.days['2026-11-03']);
  assert.deepEqual(L.mergeStore(m, mainPhone), L.mergeStore(mainPhone, m));
  assert.deepEqual(L.mergeStore(m, m), m);
});

test('CSV export', () => {
  const days = { '2026-11-02': {
    ...day('Push', { ...ex('b', 'Chest', [[60, 10], ['', '']]), name: 'Bench, flat' }),
    gymck: { t: 1, on: true }, food: { t: 1, on: true },
  } };
  const rows = L.setsCsv(days).trim().split('\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1], '2026-11-02,1,Push,"Bench, flat",Chest,1,60,10,600,80');
  assert.equal(L.dailyCsv(days).trim().split('\n')[1], '2026-11-02,1,1,1,0,0');
});
