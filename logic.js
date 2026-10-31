// All formulas live here, with no UI, so they can be tested: node --test
const Logic = (() => {
  const DAY = 86400000;
  const START = '2026-11-01'; // Week 1 starts here; weeks are 7-day blocks from this date

  // Dates are 'YYYY-MM-DD' strings. UTC arithmetic keeps them free of timezone drift.
  const toMs = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const toKey = ms => new Date(ms).toISOString().slice(0, 10);
  const addDays = (k, n) => toKey(toMs(k) + n * DAY);
  const weekday = k => (new Date(toMs(k)).getUTCDay() + 6) % 7; // Monday = 0
  const localKey = (d = new Date()) => toKey(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const weekNo = k => Math.floor((toMs(k) - toMs(START)) / (7 * DAY)) + 1;
  const weekStart = n => addDays(START, (n - 1) * 7);

  const num = v => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const round = (n, dp = 1) => { const f = 10 ** dp; return Math.round(n * f) / f; };

  // A set counts once it has reps. Blank weight means bodyweight.
  const isLogged = s => (num(s.r) || 0) > 0;
  const setVolume = s => (num(s.w) || 0) * (num(s.r) || 0);

  // Epley: weight × (1 + reps/30)
  const e1rm = (w, r) => {
    w = num(w) || 0; r = num(r) || 0;
    if (w <= 0 || r <= 0) return 0;
    return r === 1 ? w : w * (1 + r / 30);
  };

  function sessionStats(ex) {
    const sets = (ex.sets || []).filter(isLogged);
    const out = { sets: sets.length, reps: 0, vol: 0, topW: 0, topR: 0, e1: 0 };
    let best = -1;
    for (const s of sets) {
      const w = num(s.w) || 0, r = num(s.r);
      out.reps += r;
      out.vol += w * r;
      const score = e1rm(w, r) || r / 1000; // bodyweight sets rank by reps
      if (score > best) { best = score; out.topW = w; out.topR = r; }
      out.e1 = Math.max(out.e1, e1rm(w, r));
    }
    return out;
  }

  const hasSets = day => !!day?.gym?.ex?.some(e => (e.sets || []).some(isLogged));

  // Submit ticks Gym; a tap on the box does the same by hand.
  const checks = day => ({
    gym: !!day?.gymck?.on,
    food: !!day?.food?.on,
    walk: !!day?.walk?.on,
    supp: !!day?.supp?.on,
  });

  // A past day with nothing ticked and no sets entered.
  const isSkipped = (day, k, today) =>
    k >= START && k < today && !hasSets(day) && !Object.values(checks(day)).some(Boolean);

  const logged = days => Object.keys(days).filter(k => Object.values(checks(days[k])).some(Boolean) || hasSets(days[k])).sort();

  // Every logged session of one exercise, oldest first.
  function sessions(days, id) {
    const out = [];
    for (const k of Object.keys(days).sort()) {
      for (const ex of days[k]?.gym?.ex || []) {
        if (ex.id !== id) continue;
        const stats = sessionStats(ex);
        if (stats.sets) out.push({ date: k, ex, stats });
      }
    }
    return out;
  }
  const lastSession = (days, id, before) => sessions(days, id).filter(s => s.date < before).pop() || null;

  const pct = (now, prev) => (prev > 0 ? ((now - prev) / prev) * 100 : null);

  // One row per week an exercise was trained, each compared with the previous trained week.
  function exerciseWeeks(days, id) {
    const map = new Map();
    for (const s of sessions(days, id)) {
      if (s.date < START) continue;
      const week = weekNo(s.date);
      const w = map.get(week) || { week, start: weekStart(week), sets: 0, reps: 0, vol: 0, topW: 0, topR: 0, e1: 0, topE: -1 };
      w.sets += s.stats.sets; w.reps += s.stats.reps; w.vol += s.stats.vol;
      const score = s.stats.e1 || s.stats.topR / 1000;
      if (score > w.topE) { w.topE = score; w.topW = s.stats.topW; w.topR = s.stats.topR; }
      w.e1 = Math.max(w.e1, s.stats.e1);
      map.set(week, w);
    }
    const rows = [...map.values()].sort((a, b) => a.week - b.week);
    rows.forEach((w, i) => {
      const prev = rows[i - 1];
      w.dE1 = prev ? pct(w.e1, prev.e1) : null;
      w.dVol = prev ? pct(w.vol, prev.vol) : null;
      w.dReps = prev ? pct(w.reps, prev.reps) : null;
    });
    return rows;
  }

  function weekSummary(days, week, today = localKey()) {
    const start = weekStart(week);
    const out = { week, start, gymDays: 0, foodDays: 0, walkDays: 0, suppDays: 0, skipped: 0, sets: 0, reps: 0, vol: 0, byGroup: {}, lifts: [] };
    const lifts = new Map();
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i), day = days[k];
      if (isSkipped(day, k, today)) out.skipped++;
      if (!day) continue;
      const c = checks(day);
      if (c.gym) out.gymDays++;
      if (c.food) out.foodDays++;
      if (c.walk) out.walkDays++;
      if (c.supp) out.suppDays++;
      for (const ex of day.gym?.ex || []) {
        const st = sessionStats(ex);
        if (!st.sets) continue;
        out.sets += st.sets; out.reps += st.reps; out.vol += st.vol;
        const g = ex.group || 'Other';
        out.byGroup[g] = (out.byGroup[g] || 0) + st.sets;
        lifts.set(ex.id, ex.name);
      }
    }
    out.lifts = [...lifts].map(([id, name]) => ({ ...exerciseWeeks(days, id).find(w => w.week === week), id, name }));
    return out;
  }

  // Each item of each day keeps its own timestamp, so two phones editing the same date
  // don't overwrite each other: a workout from one phone and a tick from the other both survive.
  const SECTIONS = ['gym', 'gymck', 'food', 'walk', 'supp'];
  function mergeStore(a, b) {
    const out = { plan: (b.plan?.t || 0) > (a.plan?.t || 0) ? b.plan : a.plan, days: {} };
    for (const k of new Set([...Object.keys(a.days || {}), ...Object.keys(b.days || {})])) {
      const da = a.days?.[k] || {}, db = b.days?.[k] || {}, d = { date: k };
      for (const s of SECTIONS) {
        const x = da[s], y = db[s];
        const pick = (y?.t || 0) > (x?.t || 0) ? y : x;
        if (pick) d[s] = pick;
      }
      out.days[k] = d;
    }
    return out;
  }

  const csvCell = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const toCsv = rows => rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';

  function setsCsv(days) {
    const rows = [['Date', 'Week', 'Workout', 'Exercise', 'Muscle', 'Set', 'Weight kg', 'Reps', 'Volume kg', 'e1RM kg']];
    for (const k of Object.keys(days).sort()) {
      for (const ex of days[k]?.gym?.ex || []) {
        (ex.sets || []).filter(isLogged).forEach((s, i) => rows.push([
          k, weekNo(k), days[k].gym.name, ex.name, ex.group, i + 1,
          num(s.w) ?? '', num(s.r), setVolume(s), round(e1rm(s.w, s.r)) || '',
        ]));
      }
    }
    return toCsv(rows);
  }

  function dailyCsv(days) {
    const rows = [['Date', 'Week', 'Gym', 'Food', 'Walk 5K', 'Supplements']];
    for (const k of logged(days)) {
      const c = checks(days[k]);
      rows.push([k, weekNo(k), +c.gym, +c.food, +c.walk, +c.supp]);
    }
    return toCsv(rows);
  }

  return {
    START, addDays, weekday, localKey, weekNo, weekStart, num, round, isLogged, setVolume, e1rm,
    sessionStats, hasSets, checks, isSkipped, logged, sessions, lastSession,
    pct, exerciseWeeks, weekSummary, mergeStore, setsCsv, dailyCsv,
  };
})();
if (typeof module !== 'undefined') module.exports = Logic;
