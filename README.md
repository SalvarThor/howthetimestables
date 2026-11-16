# Times Tables

A small browser game for practising multiplication tables. It asks random questions and tracks streaks and progress.

## How it works

There are two ways to play, switched at the top of the Play screen:

- **Mixed up:** random questions from all selected tables, weighted towards weak facts (details below).
- **One table at a time:** works through a table in order, 1 to 12, then re-asks any missed questions until they're right. When the table is done, it shows how many were right first time and moves on to the next selected table (lowest to highest, wrapping round). The arrows either side of the table name skip forwards or back. Progress through the current table is saved. Answers count towards streaks and mastery the same way as in mixed mode.

Mixed-up mode in detail:

- **Questions** come from the tables picked in Settings (2 to 12 by default), multiplied by 1 to 12. The same fact is never asked twice in a row.
- **Weak facts come up more.** Each fact has a level from 0 to 5. A correct answer in under 6 seconds moves it up one level; a wrong answer drops it to 0. Lower levels and untried facts are picked much more often. 3x7 and 7x3 count as the same fact.
- **Missed facts come back.** After a wrong answer, the correct answer is shown, and the same question returns after 3 others.
- **Streaks:** current streak, best streak, and days played in a row. Celebrations at 5, 10, 15, 20, 25, 30, 40, 50, 75 and 100 in a row, and when a run beats the previous best.
- **Progress tab:** a 12x12 grid coloured by mastery (Not tried, Learning, Nearly, Got it), plus totals and accuracy. Tap a square for that fact's record.
- **Saved in the browser** (localStorage) on that device only. No account or server. Settings has a reset button.

Works with the on-screen keypad (phones and tablets) or a keyboard: number keys or number pad, Enter to answer, Backspace or Delete to fix a digit, Escape to clear.

## Tests

Game logic in `src/game.js` has no DOM dependencies and is tested with Node's built-in test runner (Node 22+, no install needed):

```bash
npm test
```

## Running locally

No build step or dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deployment

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`.
Enable it once under Settings > Pages > Source: GitHub Actions.
