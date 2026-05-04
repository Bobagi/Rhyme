import { useRealTimeSpeechRecognition } from '../hooks/useRealTimeSpeechRecognition.js';

export function renderSpeechRecognitionTester(rootElement) {
  const speechRecognitionController = useRealTimeSpeechRecognition();

  rootElement.innerHTML = `
    <main class="container">
      <h1>Rhyme Trainer - Real-Time Speech Detection</h1>
      <p>This app uses your microphone to transcribe your speech in real time.</p>
      <div class="controls">
        <button id="startListeningButton" type="button">Start listening</button>
        <button id="stopListeningButton" type="button">Stop listening</button>
      </div>
      <div class="status" id="listeningStatusValue">Status: idle</div>
      <div class="warning" id="unsupportedBrowserMessage"></div>
      <div class="error" id="speechRecognitionErrorMessage"></div>
      <section class="panel">
        <strong>Interim transcript</strong>
        <p id="interimTranscriptValue"></p>
      </section>
      <section class="panel">
        <strong>Final transcript history</strong>
        <ul id="finalTranscriptHistory"></ul>
      </section>
    </main>
  `;

  const startListeningButton = rootElement.querySelector('#startListeningButton');
  const stopListeningButton = rootElement.querySelector('#stopListeningButton');
  const listeningStatusValue = rootElement.querySelector('#listeningStatusValue');
  const unsupportedBrowserMessage = rootElement.querySelector('#unsupportedBrowserMessage');
  const speechRecognitionErrorMessage = rootElement.querySelector('#speechRecognitionErrorMessage');
  const interimTranscriptValue = rootElement.querySelector('#interimTranscriptValue');
  const finalTranscriptHistory = rootElement.querySelector('#finalTranscriptHistory');

  startListeningButton.addEventListener('click', () => speechRecognitionController.startListening());
  stopListeningButton.addEventListener('click', () => speechRecognitionController.stopListening());

  const unsubscribe = speechRecognitionController.subscribe((speechRecognitionSnapshot) => {
    const speechRecognitionErrorMessages = {
      network: 'Speech recognition error: network. Open this app in Google Chrome using the forwarded Codespaces HTTPS URL and allow microphone access.',
    };
    listeningStatusValue.textContent = `Status: ${speechRecognitionSnapshot.listeningStatus}`;
    unsupportedBrowserMessage.textContent = speechRecognitionSnapshot.isSupported ? '' : 'This browser does not support the Web Speech API.';
    speechRecognitionErrorMessage.textContent = speechRecognitionSnapshot.speechRecognitionError
      ? speechRecognitionErrorMessages[speechRecognitionSnapshot.speechRecognitionError] || `Speech recognition error: ${speechRecognitionSnapshot.speechRecognitionError}`
      : '';
    interimTranscriptValue.textContent = speechRecognitionSnapshot.interimTranscript || '-';

    finalTranscriptHistory.innerHTML = '';
    speechRecognitionSnapshot.finalTranscriptSegments.forEach((finalTranscriptSegment) => {
      const historyListItem = document.createElement('li');
      historyListItem.textContent = finalTranscriptSegment;
      finalTranscriptHistory.appendChild(historyListItem);
    });
  });

  return () => {
    unsubscribe();
    speechRecognitionController.dispose();
  };
}
