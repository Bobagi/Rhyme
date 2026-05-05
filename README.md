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

If that happens in Brave, test the same forwarded HTTPS URL in Google Chrome.

## Current speech recognition implementation

The app currently uses the browser-native Web Speech API:

- `SpeechRecognition`
- `webkitSpeechRecognition`
- language: `pt-BR`
- continuous recognition enabled
- interim results enabled

## Known limitation

If the app shows this error repeatedly:

```text
Speech recognition error: network
```

it means the browser started the Web Speech API, but Chrome could not reach or use its speech recognition service for the current environment. The microphone can still work while speech-to-text fails.

This is not fixed by installing npm packages because the current MVP has no build step and no backend. To avoid this browser service dependency, the app will need a different transcription engine, such as a free local/browser model or a backend transcription service.
