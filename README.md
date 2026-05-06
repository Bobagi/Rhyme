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

## Current speech recognition implementation

The app currently uses the browser-native Web Speech API:

- `SpeechRecognition`
- `webkitSpeechRecognition`
- language: `pt-BR`
- continuous recognition enabled
- interim results enabled
