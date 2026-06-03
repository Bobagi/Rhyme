# Rhyme

## Run locally

From the project root, start a static file server:

```bash
python3 -m http.server 5500
```

Open the app in Google Chrome:

```text
http://localhost:5500
```

Click **Start listening** and allow microphone access.

## Run in GitHub Codespaces

From the project root, start a static file server:

```bash
python3 -m http.server 5500
```

Then:

1. Open the **Ports** tab in Codespaces.
2. Find port **5500**.
3. Set visibility to **Public** if needed.
4. Click **Open in Browser**.
5. Open the forwarded **HTTPS** URL in Google Chrome.
6. Allow microphone access.
7. Click **Start listening**.

## Browser support

Use Google Chrome for this MVP.

Brave can capture microphone audio, but it may block or fail Chrome's Web Speech API transcription service and repeatedly return:

```text
Speech recognition error: network
```

To try Brave anyway:

1. Open `brave://settings/privacy`.
2. Disable Shields for the app URL.
3. Enable Brave settings that allow Google services or Google login-related services, if available in your Brave version.
4. Restart Brave and test again.

If Brave still returns `network`, use Google Chrome.

## Speech recognition implementation

The app uses the browser-native Web Speech API:

- `SpeechRecognition` / `webkitSpeechRecognition`
- continuous recognition + interim results
- selectable language: `pt-BR` (default), `en-US`, `es-ES` — choosing a flag in the
  rhyme panel switches both the transcription locale and the rhyme source
- auto-restarts on `end`/recoverable errors (`no-speech`, `network`) with backoff,
  so it keeps listening without spinning a tight loop
- live microphone level meter via `AudioContext`

## Rhyme engine

Rhymes are computed locally in `src/services/rhymeEngine.js`:

- **Tonic-rime matching** — a rhyme is keyed on the stressed (tonic) vowel onward,
  not the last N letters, so `coração` rhymes with `paixão`/`canção` (`-ão`) while
  `vida` (`-ida`) is correctly kept apart from `dia` (`-ia`). Stress is detected
  from graphic accents and pt/es default-stress rules; English falls back to a
  suffix key.
- **Words *and* phrases** — phrases rhyme by their last word (e.g. `com todo meu valor`).
- **Frequency-ranked** — candidates come from the `hermitdave/FrequencyWords`
  50k lists (pt/en/es), already ordered by usage, plus a curated pt catalog.
- **Offline-friendly** — fetched lists are cached in `localStorage`; a curated
  catalog gives instant results before the lists finish loading.
- **Real-time** — suggestions update from the live interim transcript (debounced),
  not only after a phrase is finalized.

Click any suggestion to copy it. See `docs/frequency-words.md` for data/licensing.
