import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newState, pickQuestion, recordAnswer, factKey, candidates, masteryOf, RETRY_AFTER,
} from "../src/game.js";

test("factKey treats 3x7 and 7x3 as the same fact", () => {
  assert.equal(factKey(3, 7), factKey(7, 3));
});

test("candidates are deduplicated across tables", () => {
  assert.equal(candidates([3, 7]).length, 23); // 12 + 12 - shared 3x7
});

test("questions only come from selected tables", () => {
  const s = newState();
  s.tables = [7];
  for (let i = 0; i < 200; i++) {
    const q = pickQuestion(s);
    assert.ok(q.a === 7 || q.b === 7);
    assert.ok(q.a >= 1 && q.a <= 12 && q.b >= 1 && q.b <= 12);
    s.lastKey = q.key;
  }
});

test("the same fact is not asked twice in a row", () => {
  const s = newState();
  for (let i = 0; i < 300; i++) {
    const q = pickQuestion(s);
    assert.notEqual(q.key, s.lastKey);
    s.lastKey = q.key;
  }
});

test("streak counts up and resets on a wrong answer", () => {
  const s = newState();
  const q = { a: 6, b: 7, key: factKey(6, 7) };
  recordAnswer(s, q, "42", 1000, "2026-11-16");
  recordAnswer(s, q, "42", 1000, "2026-11-16");
  assert.equal(s.streak, 2);
  assert.equal(s.bestStreak, 2);
  const r = recordAnswer(s, q, "41", 1000, "2026-11-16");
  assert.equal(r.correct, false);
  assert.equal(r.expected, 42);
  assert.equal(s.streak, 0);
  assert.equal(s.bestStreak, 2);
});

test("milestone fires at 5 in a row", () => {
  const s = newState();
  const q = { a: 2, b: 2, key: factKey(2, 2) };
  let r;
  for (let i = 0; i < 5; i++) r = recordAnswer(s, q, "4", 1000, "2026-11-16");
  assert.equal(r.milestone, 5);
});

test("a missed fact comes back after a few questions", () => {
  const s = newState();
  const missed = { a: 8, b: 7, key: factKey(8, 7) };
  recordAnswer(s, missed, "54", 1000, "2026-11-16");
  for (let i = 0; i < RETRY_AFTER; i++) {
    const q = pickQuestion(s);
    assert.notEqual(q.key, missed.key);
    s.lastKey = q.key;
  }
  const back = pickQuestion(s);
  assert.deepEqual([back.a, back.b], [8, 7]);
});

test("fast correct answers raise mastery, slow ones do not, wrong resets", () => {
  const s = newState();
  const q = { a: 9, b: 6, key: factKey(9, 6) };
  recordAnswer(s, q, "54", 20000, "2026-11-16");
  assert.equal(masteryOf(s.facts[q.key]), "learning");
  for (let i = 0; i < 4; i++) recordAnswer(s, q, "54", 1000, "2026-11-16");
  assert.equal(masteryOf(s.facts[q.key]), "mastered");
  recordAnswer(s, q, "1", 1000, "2026-11-16");
  assert.equal(masteryOf(s.facts[q.key]), "learning");
});

test("day streak counts consecutive days and resets after a gap", () => {
  const s = newState();
  const q = { a: 2, b: 3, key: factKey(2, 3) };
  recordAnswer(s, q, "6", 1000, "2026-11-30");
  recordAnswer(s, q, "6", 1000, "2026-11-30");
  assert.equal(s.dayStreak, 1);
  recordAnswer(s, q, "6", 1000, "2026-12-01");
  assert.equal(s.dayStreak, 2);
  recordAnswer(s, q, "6", 1000, "2026-12-03");
  assert.equal(s.dayStreak, 1);
});

test("new best is celebrated once, only when passing an earlier best", () => {
  const s = newState();
  const q = { a: 3, b: 3, key: factKey(3, 3) };
  const run = (n) => Array.from({ length: n }, () => recordAnswer(s, q, "9", 1000, "2026-11-16").newBest);
  assert.deepEqual(run(3), [false, false, false]); // first run sets a best silently
  recordAnswer(s, q, "0", 1000, "2026-11-16");
  assert.deepEqual(run(5), [false, false, false, true, false]);
  assert.equal(s.bestStreak, 5);
});
