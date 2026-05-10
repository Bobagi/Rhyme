import { useRealTimeSpeechRecognition } from '../hooks/useRealTimeSpeechRecognition.js';

function setTextContentIfChanged(element, nextTextContent) {
  if (element.textContent !== nextTextContent) {
    element.textContent = nextTextContent;
  }
}

function renderListItemsIfChanged(listElement, nextItems) {
  const serializedNextItems = JSON.stringify(nextItems);
  if (listElement.dataset.items === serializedNextItems) {
    return;
  }

  listElement.dataset.items = serializedNextItems;
  listElement.innerHTML = '';
  nextItems.forEach((nextItem) => {
    const listItem = document.createElement('li');
    listItem.textContent = nextItem;
    listElement.appendChild(listItem);
  });
}

function selectionIntersectsElement(element) {
  const currentSelection = window.getSelection();
  if (!currentSelection || currentSelection.rangeCount === 0 || currentSelection.isCollapsed) {
    return false;
  }

  const selectedRange = currentSelection.getRangeAt(0);
  return element.contains(selectedRange.commonAncestorContainer) || selectedRange.intersectsNode(element);
}

export function renderSpeechRecognitionTester(rootElement) {
  const speechRecognitionController = useRealTimeSpeechRecognition();

  rootElement.innerHTML = `
    <main class="container">
      <header class="hero">
        <div>
          <p class="eyebrow">Live rhyme studio</p>
          <h1>Rhyme <span>Trainer</span></h1>
          <p class="intro">Capture seu freestyle em tempo real, veja a última frase e selecione qualquer rima sem precisar parar o microfone.</p>
          <div class="listen-controls"><button class="listen-button" id="toggleListeningButton" type="button"><span class="listen-icon">🎙</span><span id="toggleListeningButtonLabel">Start listening</span></button><span class="microphone-label" id="microphoneLabelValue">Mic: No microphone active</span></div>
        </div>
      </header>
      <section class="status-row" hidden>
        <div class="warning" id="unsupportedBrowserMessage"></div>
        <div class="warning" id="braveBrowserMessage"></div>
        <div class="error" id="speechRecognitionErrorMessage"></div>
      </section>
      <section class="grid">
        <section class="panel compact">
          <strong class="panel-title">Microphone level</strong>
          <div class="meter">
            <div id="microphoneLevelBar"></div>
          </div>
        </section>
        <section class="panel compact">
          <strong class="panel-title">Interim transcript</strong>
          <p class="transcript" id="interimTranscriptValue">-</p>
        </section>
        <section class="panel large selectable-panel" id="rhymePanel">
          <strong class="panel-title">Rhymes for the last phrase</strong>
          <p class="transcript" id="lastRecognizedPhraseValue">-</p>
          <ul id="rhymeSuggestionsList"></ul>
        </section>
        <section class="panel large selectable-panel">
          <strong class="panel-title">Final transcript history</strong>
          <ul id="finalTranscriptHistory"></ul>
        </section>
      </section>
    </main>
  `;

  const toggleListeningButton = rootElement.querySelector('#toggleListeningButton');
  const toggleListeningButtonLabel = rootElement.querySelector('#toggleListeningButtonLabel');
  const statusRow = rootElement.querySelector('.status-row');
  const listenIcon = rootElement.querySelector('.listen-icon');
  const unsupportedBrowserMessage = rootElement.querySelector('#unsupportedBrowserMessage');
  const braveBrowserMessage = rootElement.querySelector('#braveBrowserMessage');
  const speechRecognitionErrorMessage = rootElement.querySelector('#speechRecognitionErrorMessage');
  const interimTranscriptValue = rootElement.querySelector('#interimTranscriptValue');
  const finalTranscriptHistory = rootElement.querySelector('#finalTranscriptHistory');
  const lastRecognizedPhraseValue = rootElement.querySelector('#lastRecognizedPhraseValue');
  const rhymeSuggestionsList = rootElement.querySelector('#rhymeSuggestionsList');
  const microphoneLevelBar = rootElement.querySelector('#microphoneLevelBar');
  const microphoneLabelValue = rootElement.querySelector('#microphoneLabelValue');
  const rhymePanel = rootElement.querySelector('#rhymePanel');
  let isPointerSelectingRhymeText = false;
  let isSelectingRhymeText = false;
  let latestListeningStatus = 'idle';

  const updateRhymeSelectionState = () => {
    isSelectingRhymeText = isPointerSelectingRhymeText || selectionIntersectsElement(rhymePanel);
  };
  const startRhymeSelection = () => {
    isPointerSelectingRhymeText = true;
    updateRhymeSelectionState();
  };
  const finishRhymeSelection = () => {
    window.setTimeout(() => {
      isPointerSelectingRhymeText = false;
      updateRhymeSelectionState();
    }, 0);
  };

  rhymePanel.addEventListener('pointerdown', startRhymeSelection);
  document.addEventListener('selectionchange', updateRhymeSelectionState);
  document.addEventListener('pointerup', finishRhymeSelection);

  toggleListeningButton.addEventListener('click', () => {
    if (latestListeningStatus === 'listening' || latestListeningStatus === 'starting') {
      speechRecognitionController.stopListening();
      return;
    }

    speechRecognitionController.startListening();
  });

  const unsubscribe = speechRecognitionController.subscribe((speechRecognitionSnapshot) => {
    const speechRecognitionErrorMessages = {
      network: 'Speech recognition error: network. Reconnecting automatically. If it persists, open the forwarded Codespaces HTTPS URL in Google Chrome and allow microphone access.',
    };
    const isListening = speechRecognitionSnapshot.listeningStatus === 'listening' || speechRecognitionSnapshot.listeningStatus === 'starting';
    latestListeningStatus = speechRecognitionSnapshot.listeningStatus;
    setTextContentIfChanged(toggleListeningButtonLabel, isListening ? 'Stop listening' : 'Start listening');
    setTextContentIfChanged(listenIcon, isListening ? '■' : '🎙');
    toggleListeningButton.classList.toggle('is-listening', isListening);
    setTextContentIfChanged(unsupportedBrowserMessage, speechRecognitionSnapshot.isSupported ? '' : 'This browser does not support the Web Speech API.');
    setTextContentIfChanged(braveBrowserMessage, navigator.brave ? 'Brave may block or break Web Speech API transcription. Use Google Chrome for this MVP.' : '');
    setTextContentIfChanged(speechRecognitionErrorMessage, speechRecognitionSnapshot.speechRecognitionError
      ? speechRecognitionErrorMessages[speechRecognitionSnapshot.speechRecognitionError] || `Speech recognition error: ${speechRecognitionSnapshot.speechRecognitionError}`
      : '');
    statusRow.hidden = !unsupportedBrowserMessage.textContent && !braveBrowserMessage.textContent && !speechRecognitionErrorMessage.textContent;
    microphoneLevelBar.style.width = `${speechRecognitionSnapshot.microphoneLevel}%`;
    setTextContentIfChanged(microphoneLabelValue, `Mic: ${speechRecognitionSnapshot.microphoneLabel || 'No microphone active'}`);

    if (isSelectingRhymeText) {
      return;
    }

    setTextContentIfChanged(interimTranscriptValue, speechRecognitionSnapshot.interimTranscript || '-');
    setTextContentIfChanged(lastRecognizedPhraseValue, speechRecognitionSnapshot.lastRecognizedPhrase || '-');
    renderListItemsIfChanged(rhymeSuggestionsList, speechRecognitionSnapshot.rhymeSuggestions);
    renderListItemsIfChanged(finalTranscriptHistory, speechRecognitionSnapshot.finalTranscriptSegments);
  });

  return () => {
    rhymePanel.removeEventListener('pointerdown', startRhymeSelection);
    document.removeEventListener('selectionchange', updateRhymeSelectionState);
    document.removeEventListener('pointerup', finishRhymeSelection);
    unsubscribe();
    speechRecognitionController.dispose();
  };
}
