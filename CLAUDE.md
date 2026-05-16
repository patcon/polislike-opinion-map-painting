# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Serve the app locally
pnpm start          # Vite dev server on http://localhost:5173
pnpm build          # Production build to dist/
pnpm preview        # Preview production build

# JavaScript tests (Vitest)
pnpm test
pnpm run test:coverage
pnpm run test:watch

# Python: install dependencies
uv sync

# Generate a dataset from a Polis report or conversation URL
uv run python generate.py --url https://pol.is/report/r7cwmiaxczyj8te9rzdmx --slug my-dataset
uv run python generate.py --help   # full CLI options
```

## Architecture

This is a **static, no-bundler frontend app** served directly from `index.html`. There is no build step — all JS files are loaded as plain `<script>` tags and share a single global scope.

### Frontend (`js/`)

Four files, loaded in order by `index.html`:

- **`config.js`** — `Config` object (colors, thresholds, feature flags) and `AppState` object (all mutable runtime state: preferences, data, UI state, selection). All other files read/write `AppState` and `Config` as globals.
- **`data.js`** — Loads per-dataset JSON files from `data/datasets/<slug>/` via D3, stores results in `AppState`, drives re-renders.
- **`main.js`** — Statistical logic: two-proportion z-tests, group vote matrices, representative/consensus statement computation (via SQLite in-browser via `sql.js`).
- **`ui.js`** — DOM manipulation, event listeners, D3 scatter plot rendering, lasso selection, label editing, share URL encoding/decoding.

The app uses **D3** for SVG rendering and **sql.js** (WebAssembly SQLite) for in-browser vote queries against `votes.db` per dataset.

### Dataset format (`data/datasets/<slug>/`)

Each dataset directory contains:
- `pca.json`, `pacmap.json`, `localmap.json` — participant projection coordinates `[[tid, [x, y]], ...]`
- `statements.json` — statement metadata (`tid`, `txt`, `mod`, etc.)
- `meta.json` — optional metadata (polis URL, n_neighbors, etc.)
- `votes.db` — SQLite vote matrix (participant × statement)

`data/datasets.json` — ordered list of `{ slug, label }` entries shown in the dataset picker.

### Python data pipeline (`generate.py`)

Uses the [`red-dwarf`](https://github.com/polis-community/red-dwarf) library to fetch Polis conversation data and run dimensionality reduction (PCA, PaCMAP, LocalMAP) to produce the JSON files above. Automatically appends an entry to `datasets.json` when a new dataset is generated.

### Tests (`js/__tests__/`)

Jest tests run against jsdom. Because the JS files use globals rather than modules, `data-wrapper.js` and `data-test-module.js` wrap `data.js` and `main.js` for import in tests. Coverage thresholds are intentionally very low — they exist as a baseline, not a target.
