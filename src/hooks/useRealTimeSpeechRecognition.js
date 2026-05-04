import { defaultSpeechLanguage } from '../config/speechLanguages.js';
import { BrowserSpeechRecognitionService } from '../services/browserSpeechRecognitionService.js';

export function useRealTimeSpeechRecognition() {
  const recognitionState = {
    listeningStatus: 'idle',
    interimTranscript: '',
    finalTranscriptSegments: [],
    speechRecognitionError: '',
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
      if (speechRecognitionErrorCode === 'network') {
        recognitionState.shouldKeepListening = false;
        recognitionState.listeningStatus = 'stopped';
      }
      updateInterface();
    },
    onResult: (recognizedSpeechSegments) => {
      let activeInterimTranscript = '';
      recognizedSpeechSegments.forEach((recognizedSpeechSegment) => {
        if (!recognizedSpeechSegment.transcript) {
          return;
        }
        if (recognizedSpeechSegment.isFinal) {
          recognitionState.finalTranscriptSegments.push(recognizedSpeechSegment.transcript);
        } else {
          activeInterimTranscript = `${activeInterimTranscript} ${recognizedSpeechSegment.transcript}`.trim();
        }
      });
      recognitionState.interimTranscript = activeInterimTranscript;
      updateInterface();
    },
  });

  const listeners = new Set();

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
      const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStream.getTracks().forEach((microphoneTrack) => microphoneTrack.stop());
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
    updateInterface();
  }

  function subscribe(listenerCallback) {
    listeners.add(listenerCallback);
    listenerCallback({ ...recognitionState });
    return () => listeners.delete(listenerCallback);
  }

  function dispose() {
    recognitionState.shouldKeepListening = false;
    speechRecognitionService.destroy();
    listeners.clear();
  }

  return { subscribe, startListening, stopListening, dispose };
}
