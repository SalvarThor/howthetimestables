import {
  ALL_TABLES, MAX, pickQuestion, recordAnswer, masteryOf, factKey, startTable, adjacentTable,
} from "./game.js";
import { load, save, clear } from "./storage.js";

let state = load();
let question = null;
let typed = "";
let startedAt = 0;
let waitingForNext = false; // after a wrong answer, Go moves on
let busy = false; // short pause after a correct answer

const $ = (id) => document.getElementById(id);
const els = {
  streak: $("streak"),
  best: $("best"),
  days: $("days"),
  card: $("card"),
  question: $("question"),
  answer: $("answer"),
  feedback: $("feedback"),
  celebrate: $("celebrate"),
};

const PRAISE = ["Correct!", "Nice!", "Yes!", "Great!", "Spot on!", "Brilliant!"];

// ---------- Play ----------

function renderScores() {
  els.streak.textContent = state.streak;
  els.best.textContent = state.bestStreak;
  els.days.textContent = state.dayStreak;
}

function renderMode() {
  document.querySelectorAll(".mode-btn").forEach((b) => {
    const on = b.dataset.mode === state.mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on);
  });
  $("table-bar").classList.toggle("hidden", state.mode !== "ordered" || state.tables.length === 0);
}

function renderTableBar() {
  const run = state.tableRun;
  if (state.mode !== "ordered" || !run) return;
  $("table-name").textContent = `${run.table} times table`;
  if (run.step <= MAX) {
    $("table-progress").textContent = `Question ${run.step} of ${MAX}`;
    $("progress-fill").style.width = `${((run.step - 1) / MAX) * 100}%`;
  } else {
    const left = run.missed.length;
    $("table-progress").textContent = `Fixing mistakes: ${left} left`;
    $("progress-fill").style.width = "100%";
  }
}

function nextQuestion() {
  waitingForNext = false;
  busy = false;
  typed = "";
  els.card.className = "card";
  els.feedback.textContent = "";

  if (state.tables.length === 0) {
    question = null;
    renderMode();
    els.question.textContent = "Pick some tables in Settings";
    els.answer.textContent = "";
    return;
  }

  question = pickQuestion(state);
  renderMode();
  renderTableBar();
  els.question.textContent = `${question.a} × ${question.b}`;
  renderAnswer();
  startedAt = performance.now();
}

function renderAnswer() {
  els.answer.textContent = typed === "" ? "?" : typed;
  els.answer.classList.toggle("empty", typed === "");
}

function submit() {
  if (!question || busy) return;
  if (waitingForNext) {
    nextQuestion();
    return;
  }
  if (typed === "") return;

  const ms = performance.now() - startedAt;
  const result = recordAnswer(state, question, typed, ms);
  save(state);
  renderScores();

  if (result.correct) {
    busy = true;
    els.card.className = "card right";
    els.feedback.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    let pause = 700;
    if (result.tableDone) {
      const { table, firstTry } = result.tableDone;
      celebrate(`${table} times table done!`, `${firstTry} of ${MAX} right first time`);
      els.feedback.textContent = `${firstTry} of ${MAX} right first time`;
      $("table-name").textContent = `${table} times table`;
      $("table-progress").textContent = "All done!";
      $("progress-fill").style.width = "100%";
      pause = 2200;
    } else if (result.milestone) {
      celebrate(`${result.milestone} in a row!`);
      pause = 1400;
    } else if (result.newBest) {
      celebrate("New best!");
      pause = 1400;
    }
    setTimeout(nextQuestion, pause);
  } else {
    waitingForNext = true;
    els.card.className = "card wrong";
    els.answer.textContent = result.expected;
    els.answer.classList.remove("empty");
    const later = state.mode === "ordered" ? " We'll come back to it at the end." : "";
    els.feedback.textContent = `${question.a} × ${question.b} = ${result.expected}.${later} Press Go to carry on.`;
    renderTableBar();
  }
}

function press(key) {
  if (key === "enter") return submit();
  if (waitingForNext || busy || !question) return;
  if (key === "back") typed = typed.slice(0, -1);
  else if (typed.length < 3) typed = (typed + key).replace(/^0+(?=\d)/, "");
  renderAnswer();
}

function celebrate(text, subtext = "") {
  const icons = ["⭐", "🎉", "🔥", "✨", "🏆"];
  els.celebrate.innerHTML = "";
  const msg = document.createElement("div");
  msg.className = "celebrate-text";
  msg.textContent = text;
  if (subtext) {
    const sub = document.createElement("div");
    sub.className = "celebrate-sub";
    sub.textContent = subtext;
    msg.appendChild(sub);
  }
  els.celebrate.appendChild(msg);
  for (let i = 0; i < 24; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    p.textContent = icons[i % icons.length];
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    els.celebrate.appendChild(p);
  }
  els.celebrate.classList.remove("hidden");
  setTimeout(() => els.celebrate.classList.add("hidden"), 1600);
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (state.mode === btn.dataset.mode) return;
    state.mode = btn.dataset.mode;
    state.retry = null;
    save(state);
    nextQuestion();
  });
});

function switchTable(dir) {
  if (!state.tableRun) return;
  startTable(state, adjacentTable(state, state.tableRun.table, dir));
  save(state);
  nextQuestion();
}
$("prev-table").addEventListener("click", () => switchTable(-1));
$("next-table").addEventListener("click", () => switchTable(1));

document.querySelectorAll("#keypad button").forEach((btn) => {
  btn.addEventListener("click", () => press(btn.dataset.key));
});

// Physical keyboard. Uses e.code for the number pad so it works whether Num Lock is on or off.
function keyFor(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null; // leave browser shortcuts alone
  const pad = /^Numpad([0-9])$/.exec(e.code);
  if (pad) return pad[1];
  if (/^[0-9]$/.test(e.key)) return e.key;
  if (e.key === "Enter" || e.code === "NumpadEnter") return "enter";
  if (e.key === "Backspace" || e.key === "Delete") return "back";
  if (e.key === "Escape") return "clear";
  return null;
}

document.addEventListener("keydown", (e) => {
  if ($("view-play").classList.contains("hidden")) return;
  const key = keyFor(e);
  if (!key) return;
  e.preventDefault();
  if (key === "clear") {
    while (typed) press("back");
    return;
  }
  if (e.repeat && key === "enter") return; // holding Enter shouldn't skip through questions
  press(key);
  flashKey(key);
});

// Show the on-screen key being pressed, so typing feels connected to the keypad.
function flashKey(key) {
  const btn = document.querySelector(`#keypad [data-key="${key}"]`);
  if (!btn) return;
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 120);
}

// ---------- Progress ----------

function renderProgress() {
  const accuracy = state.totalAnswered
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
    : 0;
  const keys = new Set();
  for (let a = 1; a <= MAX; a++) for (let b = a; b <= MAX; b++) keys.add(factKey(a, b));
  const mastered = [...keys].filter((k) => masteryOf(state.facts[k]) === "mastered").length;

  $("totals").innerHTML = "";
  for (const [label, value] of [
    ["Answered", state.totalAnswered],
    ["Correct", `${accuracy}%`],
    ["Best streak", state.bestStreak],
    ["Facts mastered", `${mastered} / ${keys.size}`],
  ]) {
    const div = document.createElement("div");
    div.className = "score";
    div.innerHTML = `<span class="label"></span><span class="value"></span>`;
    div.children[0].textContent = label;
    div.children[1].textContent = value;
    $("totals").appendChild(div);
  }

  const grid = $("grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${MAX + 1}, 1fr)`;
  grid.appendChild(cell("×", "head"));
  for (let b = 1; b <= MAX; b++) grid.appendChild(cell(b, "head"));
  for (let a = 1; a <= MAX; a++) {
    grid.appendChild(cell(a, "head"));
    for (let b = 1; b <= MAX; b++) {
      const fact = state.facts[factKey(a, b)];
      const c = cell(a * b, `m-${masteryOf(fact)}`);
      c.addEventListener("click", () => showFact(a, b, fact));
      grid.appendChild(c);
    }
  }
  $("fact-detail").textContent = "";
}

function cell(text, cls) {
  const el = document.createElement(cls === "head" ? "div" : "button");
  el.className = `cell ${cls}`;
  el.textContent = text;
  return el;
}

function showFact(a, b, fact) {
  const sum = `${a} × ${b} = ${a * b}`;
  $("fact-detail").textContent = fact
    ? `${sum}: right ${fact.correct} of ${fact.seen} times.`
    : `${sum}: not tried yet.`;
}

// ---------- Settings ----------

function renderSettings() {
  const picker = $("table-picker");
  picker.innerHTML = "";
  for (const t of ALL_TABLES) {
    const btn = document.createElement("button");
    btn.className = `table-btn${state.tables.includes(t) ? " on" : ""}`;
    btn.textContent = t;
    btn.setAttribute("aria-pressed", state.tables.includes(t));
    btn.addEventListener("click", () => {
      state.tables = state.tables.includes(t)
        ? state.tables.filter((x) => x !== t)
        : [...state.tables, t].sort((x, y) => x - y);
      tablesChanged();
    });
    picker.appendChild(btn);
  }
  $("settings-msg").textContent =
    state.tables.length === 0 ? "Pick at least one table to play." : "";
}

function tablesChanged() {
  state.retry = null;
  save(state);
  renderSettings();
  nextQuestion();
}

$("select-all").addEventListener("click", () => {
  state.tables = [...ALL_TABLES];
  tablesChanged();
});
$("select-none").addEventListener("click", () => {
  state.tables = [];
  tablesChanged();
});
$("reset").addEventListener("click", () => {
  if (!confirm("Reset all streaks and progress on this device?")) return;
  const { tables, mode } = state;
  clear();
  state = load();
  Object.assign(state, { tables, mode });
  save(state);
  renderScores();
  renderSettings();
  nextQuestion();
});

// ---------- Tabs ----------

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("hidden", v.id !== `view-${tab.dataset.view}`);
    });
    if (tab.dataset.view === "progress") renderProgress();
    if (tab.dataset.view === "settings") renderSettings();
  });
});

renderScores();
renderSettings();
nextQuestion();
