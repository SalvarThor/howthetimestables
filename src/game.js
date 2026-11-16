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
    mode: "mixed", // "mixed" = random across selected tables, "ordered" = one table at a time
    tableRun: null, // ordered mode: { table, step, missed, firstTry }
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

// ---------- Ordered mode: one table at a time, 1 to 12, then fix mistakes ----------

export function startTable(state, table) {
  state.tableRun = { table, step: 1, missed: [], firstTry: 0 };
}

// The selected table after (or before, with dir = -1) the given one, wrapping round.
export function adjacentTable(state, table, dir = 1) {
  const tables = [...state.tables].sort((x, y) => x - y);
  if (tables.length === 0) return null;
  const i = tables.indexOf(table);
  if (i === -1) return dir > 0 ? (tables.find((t) => t > table) ?? tables[0]) : tables[tables.length - 1];
  return tables[(i + dir + tables.length) % tables.length];
}

function ensureTableRun(state) {
  if (!state.tableRun || !state.tables.includes(state.tableRun.table)) {
    startTable(state, Math.min(...state.tables));
  }
  return state.tableRun;
}

// Updates the run after an answer. Returns { table, firstTry } when the table is finished.
function advanceTableRun(state, question, correct) {
  const run = state.tableRun;
  if (!run || question.a !== run.table) return null; // question came from before a mode or table change
  if (run.step <= 12) {
    if (correct) run.firstTry += 1;
    else run.missed.push(question.b);
    run.step += 1;
  } else {
    run.missed.shift();
    if (!correct) run.missed.push(question.b); // keep going until it's right
  }
  if (run.step > 12 && run.missed.length === 0) {
    const done = { table: run.table, firstTry: run.firstTry };
    startTable(state, adjacentTable(state, run.table, 1));
    return done;
  }
  return null;
}

// Returns { a, b, key }. Mutates state.retry countdown.
export function pickQuestion(state, rng = Math.random) {
  if (state.mode === "ordered") {
    const run = ensureTableRun(state);
    const n = run.step <= 12 ? run.step : run.missed[0];
    return { a: run.table, b: n, key: factKey(run.table, n) };
  }

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

// Records an answer and returns { correct, expected, milestone, newBest, tableDone }.
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
    // Counting up a table in order is easier than a random question, so only mixed mode builds mastery.
    if (ms < FAST_MS && state.mode !== "ordered") fact.level = Math.min(MAX_LEVEL, fact.level + 1);
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
    if (state.mode !== "ordered") state.retry = { a: question.a, b: question.b, wait: RETRY_AFTER };
  }

  const tableDone = state.mode === "ordered" ? advanceTableRun(state, question, correct) : null;

  state.facts[question.key] = fact;
  return { correct, expected, milestone, newBest, tableDone };
}

// "new" | "learning" | "nearly" | "mastered"
export function masteryOf(fact) {
  if (!fact) return "new";
  if (fact.level >= 4) return "mastered";
  if (fact.level >= 1) return "nearly";
  return "learning";
}
