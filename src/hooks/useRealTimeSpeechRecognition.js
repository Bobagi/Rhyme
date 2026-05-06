import { defaultSpeechLanguage } from '../config/speechLanguages.js';
import { BrowserSpeechRecognitionService } from '../services/browserSpeechRecognitionService.js';

const rhymeSuggestionCatalog = [
  'coração',
  'canção',
  'emoção',
  'paixão',
  'razão',
  'direção',
  'solidão',
  'multidão',
  'perdão',
  'na mesma direção',
  'ouvindo uma canção',
  'cheio de emoção',
  'noite',
  'açoite',
  'foi-se',
  'sorte',
  'norte',
  'forte',
  'morte',
  'porto',
  'conforto',
  'amor',
  'dor',
  'flor',
  'calor',
  'valor',
  'sabor',
  'favor',
  'onde nasce o amor',
  'com todo meu valor',
  'mar',
  'olhar',
  'cantar',
  'sonhar',
  'voar',
  'ficar',
  'andar',
  'sem parar',
  'pronto para sonhar',
  'vida',
  'ferida',
  'partida',
  'saída',
  'avenida',
  'querida',
  'minha querida',
  'estrada da vida',
];

function normalizeRhymeText(textToNormalize) {
  return textToNormalize
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function getRhymeEnding(wordToMatch) {
  const normalizedWord = normalizeRhymeText(wordToMatch);
  if (normalizedWord.length <= 3) {
    return normalizedWord;
  }
  return normalizedWord.slice(-3);
}

function getRhymeSuggestionsForTranscript(transcript) {
  const spokenWords = normalizeRhymeText(transcript).split(/\s+/).filter(Boolean);
  const lastSpokenWord = spokenWords.at(-1) || '';
  const rhymeEnding = getRhymeEnding(lastSpokenWord);

  if (!rhymeEnding) {
    return [];
  }

  return rhymeSuggestionCatalog
    .filter((rhymeSuggestion) => {
      const normalizedSuggestion = normalizeRhymeText(rhymeSuggestion);
      const suggestionLastWord = normalizedSuggestion.split(/\s+/).at(-1) || '';
      return suggestionLastWord !== lastSpokenWord && suggestionLastWord.endsWith(rhymeEnding);
    })
    .slice(0, 8);
}

export function useRealTimeSpeechRecognition() {
  const recognitionState = {
    listeningStatus: 'idle',
    interimTranscript: '',
    finalTranscriptSegments: [],
    rhymeSuggestions: [],
    lastRecognizedPhrase: '',
    speechRecognitionError: '',
    microphoneLevel: 0,
    isSupported: true,
    shouldKeepListening: false,
  };

  const speechRecognitionService = new BrowserSpeechRecognitionService(defaultSpeechLanguage, {
    onUnsupported: () => {
      recognitionState.isSupported = false;
      recognitionState.listeningStatus = 'unsupported';
      updateInterface();
    },
    onStart: () => {
      recognitionState.listeningStatus = 'listening';
      recognitionState.speechRecognitionError = '';
      updateInterface();
    },
    onEnd: () => {
      if (recognitionState.shouldKeepListening) {
        try {
          speechRecognitionService.start();
          return;
        } catch (caughtError) {
          recognitionState.speechRecognitionError = (caughtError && caughtError.message) || 'Failed to restart recognition.';
        }
      }
      recognitionState.listeningStatus = 'stopped';
      recognitionState.interimTranscript = '';
      updateInterface();
    },
    onError: (speechRecognitionErrorCode) => {
      recognitionState.speechRecognitionError = speechRecognitionErrorCode;
      if (speechRecognitionErrorCode === 'not-allowed') {
        recognitionState.shouldKeepListening = false;
        recognitionState.listeningStatus = 'stopped';
      }
      updateInterface();
    },
    onResult: (recognizedSpeechSegments) => {
      let activeInterimTranscript = '';
      let latestFinalTranscriptSegment = '';
      recognizedSpeechSegments.forEach((recognizedSpeechSegment) => {
        if (!recognizedSpeechSegment.transcript) {
          return;
        }
        if (recognizedSpeechSegment.isFinal) {
          recognitionState.finalTranscriptSegments.push(recognizedSpeechSegment.transcript);
          latestFinalTranscriptSegment = recognizedSpeechSegment.transcript;
        } else {
          activeInterimTranscript = `${activeInterimTranscript} ${recognizedSpeechSegment.transcript}`.trim();
        }
      });
      recognitionState.interimTranscript = activeInterimTranscript;
      if (latestFinalTranscriptSegment) {
        recognitionState.lastRecognizedPhrase = latestFinalTranscriptSegment;
        recognitionState.rhymeSuggestions = getRhymeSuggestionsForTranscript(latestFinalTranscriptSegment);
      }
      updateInterface();
    },
  });

  const listeners = new Set();
  let microphoneAudioContext = null;
  let microphoneAnalyser = null;
  let microphoneStream = null;
  let microphoneLevelAnimationFrame = 0;

  function updateInterface() {
    listeners.forEach((listenerCallback) => listenerCallback({ ...recognitionState }));
  }

  async function startListening() {
    if (!speechRecognitionService.isSupported()) {
      recognitionState.isSupported = false;
      recognitionState.listeningStatus = 'unsupported';
      updateInterface();
      return;
    }
    if (recognitionState.shouldKeepListening) {
      return;
    }
    recognitionState.speechRecognitionError = '';
    recognitionState.shouldKeepListening = true;
    recognitionState.listeningStatus = 'starting';
    updateInterface();
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneAudioContext = new window.AudioContext();
      const microphoneSource = microphoneAudioContext.createMediaStreamSource(microphoneStream);
      microphoneAnalyser = microphoneAudioContext.createAnalyser();
      microphoneAnalyser.fftSize = 512;
      microphoneSource.connect(microphoneAnalyser);
      const microphoneDataArray = new Uint8Array(microphoneAnalyser.frequencyBinCount);
      const updateMicrophoneLevel = () => {
        if (!microphoneAnalyser) {
          return;
        }
        microphoneAnalyser.getByteTimeDomainData(microphoneDataArray);
        let totalAmplitude = 0;
        for (let microphoneDataIndex = 0; microphoneDataIndex < microphoneDataArray.length; microphoneDataIndex += 1) {
          totalAmplitude += Math.abs(microphoneDataArray[microphoneDataIndex] - 128);
        }
        recognitionState.microphoneLevel = Math.min(100, Math.round((totalAmplitude / microphoneDataArray.length) * 2));
        updateInterface();
        microphoneLevelAnimationFrame = window.requestAnimationFrame(updateMicrophoneLevel);
      };
      updateMicrophoneLevel();
      speechRecognitionService.start();
    } catch (caughtError) {
      recognitionState.speechRecognitionError = (caughtError && caughtError.name) || 'microphone-access-failed';
      recognitionState.shouldKeepListening = false;
      recognitionState.listeningStatus = 'stopped';
      updateInterface();
    }
  }

  function stopListening() {
    if (!recognitionState.shouldKeepListening) {
      return;
    }
    recognitionState.shouldKeepListening = false;
    speechRecognitionService.stop();
    recognitionState.listeningStatus = 'stopped';
    recognitionState.interimTranscript = '';
    recognitionState.microphoneLevel = 0;
    if (microphoneLevelAnimationFrame) {
      window.cancelAnimationFrame(microphoneLevelAnimationFrame);
      microphoneLevelAnimationFrame = 0;
    }
    if (microphoneAnalyser) {
      microphoneAnalyser.disconnect();
      microphoneAnalyser = null;
    }
    if (microphoneAudioContext) {
      microphoneAudioContext.close();
      microphoneAudioContext = null;
    }
    if (microphoneStream) {
      microphoneStream.getTracks().forEach((microphoneTrack) => microphoneTrack.stop());
      microphoneStream = null;
    }
    updateInterface();
  }

  function subscribe(listenerCallback) {
    listeners.add(listenerCallback);
    listenerCallback({ ...recognitionState });
    return () => listeners.delete(listenerCallback);
  }

  function dispose() {
    stopListening();
    speechRecognitionService.destroy();
    listeners.clear();
  }

  return { subscribe, startListening, stopListening, dispose };
}
