import { ALL_TABLES, pickQuestion, recordAnswer, masteryOf, factKey } from "./game.js";
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

function nextQuestion() {
  waitingForNext = false;
  busy = false;
  typed = "";
  els.card.className = "card";
  els.feedback.textContent = "";

  if (state.tables.length === 0) {
    question = null;
    els.question.textContent = "Pick some tables in Settings";
    els.answer.textContent = "";
    return;
  }

  question = pickQuestion(state);
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
    if (result.milestone) celebrate(`${result.milestone} in a row!`);
    else if (result.newBest) celebrate("New best!");
    setTimeout(nextQuestion, result.milestone || result.newBest ? 1400 : 700);
  } else {
    waitingForNext = true;
    els.card.className = "card wrong";
    els.answer.textContent = result.expected;
    els.answer.classList.remove("empty");
    els.feedback.textContent = `${question.a} × ${question.b} = ${result.expected}. Press Go to carry on.`;
  }
}

function press(key) {
  if (key === "enter") return submit();
  if (waitingForNext || busy || !question) return;
  if (key === "back") typed = typed.slice(0, -1);
  else if (typed.length < 3) typed = (typed + key).replace(/^0+(?=\d)/, "");
  renderAnswer();
}

function celebrate(text) {
  const icons = ["⭐", "🎉", "🔥", "✨", "🏆"];
  els.celebrate.innerHTML = "";
  const msg = document.createElement("div");
  msg.className = "celebrate-text";
  msg.textContent = text;
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

document.querySelectorAll("#keypad button").forEach((btn) => {
  btn.addEventListener("click", () => press(btn.dataset.key));
});

document.addEventListener("keydown", (e) => {
  if ($("view-play").classList.contains("hidden")) return;
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === "Backspace") press("back");
  else if (e.key === "Enter") press("enter");
  else return;
  e.preventDefault();
});

// ---------- Progress ----------

function renderProgress() {
  const accuracy = state.totalAnswered
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
    : 0;
  const keys = new Set();
  for (let a = 1; a <= 12; a++) for (let b = a; b <= 12; b++) keys.add(factKey(a, b));
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
  grid.appendChild(cell("×", "head"));
  for (let b = 1; b <= 12; b++) grid.appendChild(cell(b, "head"));
  for (let a = 1; a <= 12; a++) {
    grid.appendChild(cell(a, "head"));
    for (let b = 1; b <= 12; b++) {
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
  const tables = state.tables;
  clear();
  state = load();
  state.tables = tables;
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
