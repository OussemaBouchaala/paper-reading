"""Generate narrated voice-over for every chapter video in a paper file.

Usage: python scripts/make_voiceover.py papers/react.json --model kokoro.onnx --voices voices.bin
Writes assets/audio/<paper-id>/<chapter>.mp3 and assets/audio/<paper-id>/manifest.json
with scene start/end times and one caption cue per sentence.
Needs: pip install kokoro-onnx soundfile numpy, and ffmpeg on PATH.
"""
import argparse, json, os, subprocess, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ap = argparse.ArgumentParser()
ap.add_argument("paper"); ap.add_argument("--model", required=True); ap.add_argument("--voices", required=True)
ap.add_argument("--voice", default="af_heart"); ap.add_argument("--speed", type=float, default=1.0)
ap.add_argument("--out", default="assets/audio"); ap.add_argument("--only", default="")
a = ap.parse_args()

paper = json.load(open(a.paper))
k = Kokoro(a.model, a.voices)
outdir = os.path.join(a.out, paper["id"]); os.makedirs(outdir, exist_ok=True)
man_path = os.path.join(outdir, "manifest.json")
manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
GAP, SCENE_GAP, LEAD = 0.32, 0.75, 0.35

for ch in paper["chapters"]:
    v = ch.get("video")
    if not v or (a.only and ch["id"] != a.only): continue
    sr = 24000; chunks = [np.zeros(int(LEAD * sr), dtype=np.float32)]; t = LEAD
    scenes, cues = [], []
    for si, sc in enumerate(v["scenes"]):
        s0 = t; beats = []
        for line in sc["say"]:
            audio, sr = k.create(line, voice=a.voice, speed=a.speed, lang="en-us")
            audio = audio.astype(np.float32); d = len(audio) / sr
            beats.append(round(t - s0, 3)); cues.append({"t0": round(t, 3), "t1": round(t + d, 3), "text": line})
            chunks += [audio, np.zeros(int(GAP * sr), dtype=np.float32)]; t += d + GAP
        chunks.append(np.zeros(int(SCENE_GAP * sr), dtype=np.float32)); t += SCENE_GAP
        scenes.append({"start": round(s0, 3), "end": round(t, 3), "beats": beats})
        print(ch["id"], si, round(t - s0, 1), "s", file=sys.stderr)
    wav = os.path.join(outdir, ch["id"] + ".wav"); mp3 = os.path.join(outdir, ch["id"] + ".mp3")
    sf.write(wav, np.concatenate(chunks), sr)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", "24000", "-b:a", "64k", mp3], check=True)
    os.remove(wav)
    manifest[ch["id"]] = {"src": f"{a.out}/{paper['id']}/{ch['id']}.mp3", "dur": round(t, 3), "scenes": scenes, "cues": cues}
json.dump(manifest, open(man_path, "w"), indent=1)
print("wrote", man_path, file=sys.stderr)
