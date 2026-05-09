import { useRealTimeSpeechRecognition } from '../hooks/useRealTimeSpeechRecognition.js';

function setTextContentIfChanged(element, nextTextContent) {
  if (element.textContent !== nextTextContent) {
    element.textContent = nextTextContent;
  }
}

function renderListItemsIfChanged(listElement, nextItems) {
  if (listElement.dataset.items === JSON.stringify(nextItems)) {
    return;
  }

  listElement.dataset.items = JSON.stringify(nextItems);
  listElement.innerHTML = '';
  nextItems.forEach((nextItem) => {
    const listItem = document.createElement('li');
    listItem.textContent = nextItem;
    listElement.appendChild(listItem);
  });
}

export function renderSpeechRecognitionTester(rootElement) {
  const speechRecognitionController = useRealTimeSpeechRecognition();

  rootElement.innerHTML = `
    <main class="container">
      <header class="hero">
        <div>
          <p class="eyebrow">Live rhyme studio</p>
          <h1>Rhyme <span>Trainer</span></h1>
          <p class="intro">Capture seu freestyle em tempo real, acompanhe a última frase reconhecida e encontre rimas rápidas sem pausar o microfone.</p>
          <div class="controls">
            <button id="startListeningButton" type="button">Start listening</button>
            <button class="secondary" id="stopListeningButton" type="button">Stop listening</button>
          </div>
        </div>
        <aside class="status-card">
          <div class="status" id="listeningStatusValue">Status: idle</div>
          <div class="warning" id="unsupportedBrowserMessage"></div>
          <div class="warning" id="braveBrowserMessage"></div>
          <div class="error" id="speechRecognitionErrorMessage"></div>
        </aside>
      </header>
      <section class="grid">
        <section class="panel">
          <strong>Microphone level</strong>
          <div class="meter">
            <div id="microphoneLevelBar"></div>
          </div>
        </section>
        <section class="panel">
          <strong>Interim transcript</strong>
          <p class="transcript" id="interimTranscriptValue">-</p>
        </section>
        <section class="panel featured">
          <strong>Rhymes for the last phrase</strong>
          <p class="transcript" id="lastRecognizedPhraseValue">-</p>
          <ul id="rhymeSuggestionsList"></ul>
        </section>
        <section class="panel featured">
          <strong>Final transcript history</strong>
          <ul id="finalTranscriptHistory"></ul>
        </section>
      </section>
    </main>
  `;

  const startListeningButton = rootElement.querySelector('#startListeningButton');
  const stopListeningButton = rootElement.querySelector('#stopListeningButton');
  const listeningStatusValue = rootElement.querySelector('#listeningStatusValue');
  const unsupportedBrowserMessage = rootElement.querySelector('#unsupportedBrowserMessage');
  const braveBrowserMessage = rootElement.querySelector('#braveBrowserMessage');
  const speechRecognitionErrorMessage = rootElement.querySelector('#speechRecognitionErrorMessage');
  const interimTranscriptValue = rootElement.querySelector('#interimTranscriptValue');
  const finalTranscriptHistory = rootElement.querySelector('#finalTranscriptHistory');
  const lastRecognizedPhraseValue = rootElement.querySelector('#lastRecognizedPhraseValue');
  const rhymeSuggestionsList = rootElement.querySelector('#rhymeSuggestionsList');
  const microphoneLevelBar = rootElement.querySelector('#microphoneLevelBar');

  startListeningButton.addEventListener('click', () => speechRecognitionController.startListening());
  stopListeningButton.addEventListener('click', () => speechRecognitionController.stopListening());

  const unsubscribe = speechRecognitionController.subscribe((speechRecognitionSnapshot) => {
    const speechRecognitionErrorMessages = {
      network: 'Speech recognition error: network. Reconnecting automatically. If it persists, open the forwarded Codespaces HTTPS URL in Google Chrome and allow microphone access.',
    };
    setTextContentIfChanged(listeningStatusValue, `Status: ${speechRecognitionSnapshot.listeningStatus}`);
    setTextContentIfChanged(unsupportedBrowserMessage, speechRecognitionSnapshot.isSupported ? '' : 'This browser does not support the Web Speech API.');
    setTextContentIfChanged(braveBrowserMessage, navigator.brave ? 'Brave may block or break Web Speech API transcription. Use Google Chrome for this MVP.' : '');
    setTextContentIfChanged(speechRecognitionErrorMessage, speechRecognitionSnapshot.speechRecognitionError
      ? speechRecognitionErrorMessages[speechRecognitionSnapshot.speechRecognitionError] || `Speech recognition error: ${speechRecognitionSnapshot.speechRecognitionError}`
      : '');
    setTextContentIfChanged(interimTranscriptValue, speechRecognitionSnapshot.interimTranscript || '-');
    microphoneLevelBar.style.width = `${speechRecognitionSnapshot.microphoneLevel}%`;
    setTextContentIfChanged(lastRecognizedPhraseValue, speechRecognitionSnapshot.lastRecognizedPhrase || '-');
    renderListItemsIfChanged(rhymeSuggestionsList, speechRecognitionSnapshot.rhymeSuggestions);
    renderListItemsIfChanged(finalTranscriptHistory, speechRecognitionSnapshot.finalTranscriptSegments);
  });

  return () => {
    unsubscribe();
    speechRecognitionController.dispose();
  };
}
