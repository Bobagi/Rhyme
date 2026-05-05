import { defaultSpeechLanguage } from '../config/speechLanguages.js';
import { BrowserSpeechRecognitionService } from '../services/browserSpeechRecognitionService.js';

export function useRealTimeSpeechRecognition() {
  const recognitionState = {
    listeningStatus: 'idle',
    interimTranscript: '',
    finalTranscriptSegments: [],
    speechRecognitionError: '',
    microphoneLevel: 0,
    diagnosticLogs: [],
    isSupported: true,
    shouldKeepListening: false,
  };

  const speechRecognitionService = new BrowserSpeechRecognitionService(defaultSpeechLanguage, {
    onUnsupported: () => {
      recognitionState.isSupported = false;
      recognitionState.listeningStatus = 'unsupported';
      appendDiagnosticLog('Speech recognition is unsupported in this browser.', getEnvironmentDiagnostics());
      updateInterface();
    },
    onStart: () => {
      recognitionState.listeningStatus = 'listening';
      recognitionState.speechRecognitionError = '';
      appendDiagnosticLog('Speech recognition started.', speechRecognitionService.getDiagnostics());
      updateInterface();
    },
    onEnd: () => {
      appendDiagnosticLog('Speech recognition ended.', { shouldKeepListening: recognitionState.shouldKeepListening });
      if (recognitionState.shouldKeepListening) {
        try {
          speechRecognitionService.start();
          return;
        } catch (caughtError) {
          recognitionState.speechRecognitionError = (caughtError && caughtError.message) || 'Failed to restart recognition.';
          appendDiagnosticLog('Speech recognition restart failed.', getCaughtErrorDetails(caughtError));
        }
      }
      recognitionState.listeningStatus = 'stopped';
      recognitionState.interimTranscript = '';
      updateInterface();
    },
    onError: (speechRecognitionError) => {
      const speechRecognitionErrorCode = speechRecognitionError.code || 'unknown';
      recognitionState.speechRecognitionError = speechRecognitionErrorCode;
      appendDiagnosticLog('Speech recognition error received.', { ...speechRecognitionError, ...speechRecognitionService.getDiagnostics(), ...getEnvironmentDiagnostics() });
      if (speechRecognitionErrorCode === 'not-allowed') {
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
  let microphoneAudioContext = null;
  let microphoneAnalyser = null;
  let microphoneStream = null;
  let microphoneLevelAnimationFrame = 0;


  function appendDiagnosticLog(diagnosticMessage, diagnosticDetails) {
    recognitionState.diagnosticLogs = [
      {
        time: new Date().toISOString(),
        message: diagnosticMessage,
        details: diagnosticDetails,
      },
      ...recognitionState.diagnosticLogs,
    ].slice(0, 20);
  }

  function getEnvironmentDiagnostics() {
    return {
      language: navigator.language,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      protocol: window.location.protocol,
      secureContext: window.isSecureContext,
      hasMediaDevices: Boolean(navigator.mediaDevices),
      hasGetUserMedia: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    };
  }

  function getCaughtErrorDetails(caughtError) {
    return {
      name: caughtError && caughtError.name ? caughtError.name : 'Error',
      message: caughtError && caughtError.message ? caughtError.message : String(caughtError),
    };
  }

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
      appendDiagnosticLog('Requesting microphone permission.', getEnvironmentDiagnostics());
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      appendDiagnosticLog('Microphone permission granted.', { audioTracks: microphoneStream.getAudioTracks().length });
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
      appendDiagnosticLog('Microphone or speech recognition start failed.', getCaughtErrorDetails(caughtError));
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
