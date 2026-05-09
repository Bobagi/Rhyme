import { defaultSpeechLanguage } from '../config/speechLanguages.js';
import { BrowserSpeechRecognitionService } from '../services/browserSpeechRecognitionService.js';

const remoteRhymeWordListUrls = [
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/pt_br/pt_br_50k.txt',
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/es/es_50k.txt',
];
let remoteRhymeWordCatalogPromise = null;

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
  'rir',
  'sorrir',
  'partir',
  'dormir',
  'abrir',
  'sentir',
  'fugir',
  'olhar',
  'cantar',
  'sonhar',
  'voar',
  'ficar',
  'andar',
  'sem parar',
  'pronto para sonhar',
  'canja',
  'ranja',
  'banja',
  'briolanja',
  'calanja',
  'marmanja',
  'constranja',
  'laranja',
  'granja',
  'franja',
  'anja',
  'arranja',
  'baixo',
  'cacho',
  'facho',
  'acho',
  'despacho',
  'vida',
  'dia',
  'guia',
  'alegria',
  'poesia',
  'melodia',
  'harmonia',
  'fantasia',
  'energia',
  'ferida',
  'partida',
  'saída',
  'avenida',
  'querida',
  'minha querida',
  'estrada da vida',
  'casa',
  'asa',
  'brasa',
  'arrasa',
  'praça',
  'graça',
  'massa',
  'passa',
  'tempo',
  'contratempo',
  'vento',
  'momento',
  'sentimento',
  'pensamento',
  'talento',
  'luz',
  'conduz',
  'produz',
  'traduz',
  'feliz',
  'raiz',
  'juiz',
  'matriz',
  'país',
  'teste',
  'agreste',
  'veste',
  'oeste',
  'hoje',
  'foge',
  'longe',
  'liberdade',
  'saudade',
  'verdade',
  'cidade',
  'vontade',
  'beleza',
  'certeza',
  'natureza',
  'tristeza',
  'pureza',
  'gente',
  'frente',
  'mente',
  'presente',
  'semente',
  'diferente',
  'antes',
  'instantes',
  'gigantes',
  'distantes',
  'mundo',
  'profundo',
  'segundo',
  'vagabundo',
  'tudo',
  'escudo',
  'conteúdo',
  'mudo',
  'medo',
  'segredo',
  'brinquedo',
  'cedo',
  'céu',
  'véu',
  'papel',
  'anel',
  'mel',
  'final',
  'sinal',
  'jornal',
  'normal',
  'também',
  'além',
  'ninguém',
  'refém',
  'enfim',
  'jardim',
  'assim',
  'mim',
  'atum',
  'jejum',
  'comum',
  'nenhum',
];

function normalizeRhymeText(textToNormalize) {
  return textToNormalize
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function getRhymeEndings(wordToMatch, shouldIncludeLooseEnding = false) {
  const normalizedWord = normalizeRhymeText(wordToMatch);
  const rhymeEndings = [normalizedWord.slice(-4), normalizedWord.slice(-3)];

  if (shouldIncludeLooseEnding) {
    rhymeEndings.push(normalizedWord.slice(-2));
  }

  return rhymeEndings
    .filter((rhymeEnding, rhymeEndingIndex) => rhymeEnding && rhymeEndings.indexOf(rhymeEnding) === rhymeEndingIndex);
}

function isValidRhymeWord(rhymeWord) {
  const normalizedRhymeWord = normalizeRhymeText(rhymeWord);

  return rhymeWord === rhymeWord.toLowerCase() && normalizedRhymeWord.length > 2 && /^[a-z]+$/.test(normalizedRhymeWord) && !/[\s-]/.test(rhymeWord);
}

function getRhymeSuggestionsFromCatalog(transcript, rhymeWordCatalog, shouldIncludeLooseEnding = false) {
  const spokenWords = normalizeRhymeText(transcript).split(/\s+/).filter(Boolean);
  const lastSpokenWord = spokenWords.at(-1) || '';
  const rhymeEndings = getRhymeEndings(lastSpokenWord, shouldIncludeLooseEnding);
  const rhymeSuggestions = [];

  rhymeEndings.forEach((rhymeEnding) => {
    rhymeWordCatalog.forEach((rhymeSuggestion) => {
      if (!isValidRhymeWord(rhymeSuggestion)) {
        return;
      }
      const normalizedSuggestion = normalizeRhymeText(rhymeSuggestion);
      const suggestionLastWord = normalizedSuggestion.split(/\s+/).at(-1) || '';
      if (suggestionLastWord !== lastSpokenWord && suggestionLastWord.endsWith(rhymeEnding) && !rhymeSuggestions.includes(rhymeSuggestion)) {
        rhymeSuggestions.push(rhymeSuggestion);
      }
    });
  });

  return rhymeSuggestions;
}

function isValidRemoteRhymeWord(remoteRhymeWord) {
  return isValidRhymeWord(remoteRhymeWord);
}

function parseRemoteRhymeWordList(remoteRhymeWordListText) {
  return remoteRhymeWordListText
    .split(/\r?\n/)
    .map((remoteRhymeWordListLine) => remoteRhymeWordListLine.trim().split(/\s+/)[0])
    .filter(isValidRemoteRhymeWord);
}

function getRemoteRhymeWordCatalog() {
  if (!remoteRhymeWordCatalogPromise) {
    remoteRhymeWordCatalogPromise = Promise.all(remoteRhymeWordListUrls.map((remoteRhymeWordListUrl) => fetch(remoteRhymeWordListUrl)
      .then((remoteRhymeWordListResponse) => remoteRhymeWordListResponse.text())
      .then(parseRemoteRhymeWordList)))
      .then((remoteRhymeWordCatalogs) => remoteRhymeWordCatalogs.flat());
  }

  return remoteRhymeWordCatalogPromise;
}

async function getRhymeSuggestionsForTranscript(transcript) {
  const remoteRhymeWordCatalog = await getRemoteRhymeWordCatalog();
  return getRhymeSuggestionsFromCatalog(transcript, [...remoteRhymeWordCatalog, ...rhymeSuggestionCatalog]);
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
        recognitionState.rhymeSuggestions = getRhymeSuggestionsFromCatalog(latestFinalTranscriptSegment, rhymeSuggestionCatalog, true);
        getRhymeSuggestionsForTranscript(latestFinalTranscriptSegment)
          .then((rhymeSuggestions) => {
            if (recognitionState.lastRecognizedPhrase === latestFinalTranscriptSegment) {
              recognitionState.rhymeSuggestions = rhymeSuggestions;
              updateInterface();
            }
          })
          .catch(() => {});
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
