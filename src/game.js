// Pure game logic: no DOM, no storage. Tested in test/game.test.js.

export const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const MAX_LEVEL = 5;
export const FAST_MS = 6000; // a correct answer faster than this moves a fact up a level
export const RETRY_AFTER = 3; // a missed fact comes back after this many other questions
export const MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

// 3x7 and 7x3 are the same fact.
export function factKey(a, b) {
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

export function newState() {
  return {
    tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    streak: 0,
    bestStreak: 0,
    bestAtRunStart: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    dayStreak: 0,
    lastPlayedDay: null,
    facts: {}, // key -> { level, seen, correct, wrong }
    retry: null, // { a, b, wait }
    lastKey: null,
  };
}

// Weight by level: unseen and weak facts come up much more often.
function weightFor(fact) {
  if (!fact) return 6;
  return [16, 8, 4, 2, 1, 1][fact.level];
}

export function candidates(tables) {
  const seen = new Set();
  const list = [];
  for (const t of tables) {
    for (let n = 1; n <= 12; n++) {
      const key = factKey(t, n);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ table: t, other: n, key });
    }
  }
  return list;
}

// Returns { a, b, key }. Mutates state.retry countdown.
export function pickQuestion(state, rng = Math.random) {
  if (state.retry) {
    if (state.retry.wait <= 0) {
      const { a, b } = state.retry;
      state.retry = null;
      return { a, b, key: factKey(a, b) };
    }
    state.retry.wait -= 1;
  }

  let list = candidates(state.tables);
  if (list.length > 1) {
    const retryKey = state.retry ? factKey(state.retry.a, state.retry.b) : null;
    const filtered = list.filter((c) => c.key !== state.lastKey && c.key !== retryKey);
    if (filtered.length > 0) list = filtered;
  }

  const weights = list.map((c) => weightFor(state.facts[c.key]));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  let chosen = list[list.length - 1];
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r < 0) {
      chosen = list[i];
      break;
    }
  }

  // Show the selected table first or second at random.
  const [a, b] = rng() < 0.5 ? [chosen.table, chosen.other] : [chosen.other, chosen.table];
  return { a, b, key: chosen.key };
}

function dayNumber(isoDay) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Records an answer and returns { correct, expected, milestone, newBest }.
export function recordAnswer(state, question, answer, ms, today = localDay()) {
  const expected = question.a * question.b;
  const correct = Number(answer) === expected;

  if (state.lastPlayedDay !== today) {
    const gap = state.lastPlayedDay ? dayNumber(today) - dayNumber(state.lastPlayedDay) : null;
    state.dayStreak = gap === 1 ? state.dayStreak + 1 : 1;
    state.lastPlayedDay = today;
  }

  const fact = state.facts[question.key] ?? { level: 0, seen: 0, correct: 0, wrong: 0 };
  fact.seen += 1;
  state.totalAnswered += 1;
  state.lastKey = question.key;

  let milestone = null;
  let newBest = false;

  if (correct) {
    fact.correct += 1;
    if (ms < FAST_MS) fact.level = Math.min(MAX_LEVEL, fact.level + 1);
    state.totalCorrect += 1;
    if (state.streak === 0) state.bestAtRunStart = state.bestStreak;
    state.streak += 1;
    // Celebrate once, when this run passes the best from before it started (not on the very first run).
    newBest = state.bestAtRunStart > 0 && state.streak === state.bestAtRunStart + 1;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    if (MILESTONES.includes(state.streak) || (state.streak > 100 && state.streak % 25 === 0)) {
      milestone = state.streak;
    }
  } else {
    fact.wrong += 1;
    fact.level = 0;
    state.streak = 0;
    state.retry = { a: question.a, b: question.b, wait: RETRY_AFTER };
  }

  state.facts[question.key] = fact;
  return { correct, expected, milestone, newBest };
}

// "new" | "learning" | "nearly" | "mastered"
export function masteryOf(fact) {
  if (!fact) return "new";
  if (fact.level >= 4) return "mastered";
  if (fact.level >= 1) return "nearly";
  return "learning";
}
