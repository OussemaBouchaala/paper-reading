# Paperwalk: guided paper reading (PoC)

Turns a research paper into a guided, interactive walk: short stops with plain-language explanations,
"guess first" predictions, replayable examples, charts of the key results, quick checks, a glossary,
progress and points, and a final cheat sheet.

The first paper is **ReAct: Synergizing Reasoning and Acting in Language Models** (Yao et al., ICLR 2023, arXiv 2210.03629).

## Run locally

It is a static site with no build step:

```bash
npx serve .        # or: python3 -m http.server
```

Opening `index.html` directly from disk won't work, because the app fetches the paper file.

## Deploy

Vercel: import the repo (framework preset "Other", no build command, output directory `.`), or run `vercel --prod` in this folder.

## How papers plug in

- `papers/index.json` lists available papers. The first one loads by default; `?paper=<id>` picks another.
- Each paper is one JSON file (see `papers/react.json`) with `chapters` → `steps` and a `glossary`.
- Step types: `text`, `predict`, `quiz`, `trace` (replay a Thought/Action/Observation log), `bars` (results chart),
  `match`, `order`. Every step can carry `src` (where in the paper + a direct quote).
- In step text, `{{term}}` or `{{label|key}}` links to a glossary entry.

The next step is to generate these JSON files automatically from an uploaded PDF.
