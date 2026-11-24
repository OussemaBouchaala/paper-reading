# Paperwalk: guided paper reading (PoC)

Turns a research paper into a guided, interactive walk. Each stop starts with a **narrated motion-graphics
explainer video**, then plain-language cards, "guess first" predictions, replayable examples, animated
charts, quick checks, a glossary, points, and a final cheat sheet.

The first paper is **ReAct: Synergizing Reasoning and Acting in Language Models** (Yao et al., ICLR 2023, arXiv 2210.03629).

## Run locally

Static site, no build step:

```bash
npx serve .        # needs a server that supports range requests, so the audio can seek
```

Opening `index.html` directly from disk won't work, because the app fetches the paper and audio files.

## Deploy

Vercel: `npx vercel --prod` in this folder (framework "Other", no build command, output directory `.`).

## How it works

- `papers/index.json` lists papers; the first loads by default, `?paper=<id>` picks another.
- `papers/<paper>.json` holds everything for one paper: `chapters` → `steps`, a `video` per chapter, and a `glossary`.
- Step types: `text`, `predict`, `quiz`, `trace` (replay a Thought/Action/Observation log), `bars`, `match`, `order`.
  Every step can carry `src` (where in the paper + a direct quote). In text, `{{term}}` or `{{label|key}}` links to the glossary.
- **Videos** (`assets/explainer.js`): each chapter's `video.scenes` is a list of scene templates
  (`title`, `items`, `split`, `loop`, `trace`, `equation`, `bars`, `stats`, `flow`, `takeaway`), each with the
  sentences it narrates (`say`). Scenes are drawn as SVG and animated with GSAP, timed to the narration.
- **Voice-over** (`scripts/make_voiceover.py`): renders the `say` lines with the open-source Kokoro TTS model into one
  MP3 per chapter, plus `assets/audio/<paper>/manifest.json` with scene timings and one caption per sentence.

```bash
pip install kokoro-onnx soundfile numpy        # and ffmpeg on PATH
# model files: https://github.com/thewh1teagle/kokoro-onnx/releases (kokoro-v1.0.int8.onnx, voices-v1.0.bin)
python scripts/make_voiceover.py papers/react.json --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin
```

Edit a scene's `say` lines, re-run the script, and the video re-times itself.

## Credits

Animation: [GSAP](https://gsap.com) (standard no-charge license), vendored in `assets/vendor/`.
Voice: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache 2.0), voice `af_heart`.

## Next

Generate the paper file (steps, videos, glossary) automatically from an uploaded PDF.
