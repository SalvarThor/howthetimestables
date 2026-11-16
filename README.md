# Times Tables

A small browser game for practising multiplication tables. It asks random questions and tracks streaks and progress.

## Planned features

- Random questions from selected tables (e.g. 2-12)
- Current streak and best streak
- Per-fact tracking, so tricky facts come up more often
- Progress saved in the browser (localStorage), no account or server

## Running locally

No build step or dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deployment

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`.
Enable it once under Settings > Pages > Source: GitHub Actions.
