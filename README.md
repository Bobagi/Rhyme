<p align="center">
  <img src="./og-image.png" alt="Rhyme — real-time rhyme & freestyle trainer" width="640">
</p>

<h1 align="center">Rhyme</h1>

<p align="center">
  <strong>Real-time rhyme &amp; freestyle trainer.</strong><br>
  Speak into the mic and watch rhymes — perfect and slant — appear instantly.
</p>

<p align="center">
  🔗 <a href="https://rhyme.bobagi.space"><strong>rhyme.bobagi.space</strong></a>
  &nbsp;·&nbsp; Google Chrome (needs a microphone + HTTPS)
</p>

<p align="center"><strong>English</strong> · <a href="./README.pt-BR.md">Português</a></p>

---

## What it is

Rhyme is a **100% in-browser** app (no build, no backend) that uses the native Web
Speech API to transcribe what you say and **suggest rhymes in real time** — built for
freestyle / improv practice. It works in **Portuguese, English and Spanish**.

## Highlights

- 🎙️ **Live transcription** — suggestions update as you speak (interim results).
- 🎯 **Real rhymes** — matched on the tonic (stressed) vowel (perfect rhyme), with a
  fallback to **slant and assonant rhymes** for hard words (e.g. `fácil` → `ágil`,
  `hábil`, `frágil`, `portátil`), so the panel is **never empty**.
- 🏆 **Training mode** — scores whether your consecutive bars rhymed (perfect / slant /
  assonant) with points, a **streak** and a best streak, plus a **challenge word** that
  follows the selected language.
- 🥁 **Built-in metronome (BPM)** to practice on tempo.
- 🌎 **PT · EN · ES** — auto-detected UI language (with a manual switcher) and a separate
  rhyme-language selector.
- ⚡ **Offline-friendly** — frequency lists cached in `localStorage`.
- 📋 **Click to copy** any suggestion without stopping the mic.
- 🪶 **No dependencies / no build** — just `index.html` + ES modules.

## Stack

Vanilla JS (ES modules), the Web Speech API and AudioContext. Served as static files
(nginx). No framework and no build step.

## Architecture

Layered (clean-ish) architecture with a **pure, testable** domain, following the
**SOLID** principles and the **Adapter / Repository / Observer** patterns. Overview,
directory map and data flow in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Run locally

From the project root, start a static file server:

```bash
python3 -m http.server 5500
```

Open the app in Google Chrome:

```text
http://localhost:5500
```

Click **Start** and allow microphone access.

> Microphone transcription needs a **secure context**. `localhost` counts as secure, so
> local dev works over plain HTTP; any other host must be served over **HTTPS**.

## Browser support

Use Google Chrome. Brave can capture microphone audio, but it often blocks Chrome's Web
Speech transcription service and repeatedly returns a `network` error. If so, use Google
Chrome.

## Speech recognition

Uses the browser-native Web Speech API: `SpeechRecognition` / `webkitSpeechRecognition`,
continuous recognition + interim results, a selectable locale (`pt-BR` default, `en-US`,
`es-ES`) that also switches the rhyme source, auto-restart on recoverable errors
(`no-speech`, `network`) with backoff, and a live microphone-level meter via `AudioContext`.

## Rhyme engine

Rhymes are computed locally in `src/services/rhymeEngine.js`, with no API calls:

- **Tonic-rime matching** — a rhyme is keyed on the stressed (tonic) vowel onward, not
  the last N letters, so `coração` rhymes with `paixão`/`canção` (`-ão`) while `vida`
  (`-ida`) stays apart from `dia` (`-ia`).
- **Tiered fallback** — perfect rhymes are scarce for a whole class of words
  (proparoxytones and consonant-ending words like `fácil`/`rápido`). When the perfect
  tier is thin, the engine relaxes to the same tonic skeleton **plus** the same ending
  (slant) and then the tonic vowel skeleton alone (assonant / *toante*) — common words
  keep a clean perfect-only list, hard words still get usable suggestions.
- **Words and phrases** — phrases rhyme by their last word (e.g. `com todo meu valor`).
- **Frequency-ranked** — candidates come from the `hermitdave/FrequencyWords` 50k lists
  (pt/en/es), already ordered by usage, plus a curated pt catalog.

Click any suggestion to copy it. See `docs/frequency-words.md` for data / licensing.
