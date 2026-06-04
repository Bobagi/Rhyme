import { defaultSpeechLanguage, recognitionLocaleForRhymeFilter } from '../config/speechLanguages.js';
import { BrowserSpeechRecognitionService } from '../services/browserSpeechRecognitionService.js';
import {
  suggestRhymes,
  suggestRhymesFromCuratedCatalog,
  ensureCatalogsLoaded,
  getLastWord,
  classifyRhyme,
  pickChallengeWord,
} from '../services/rhymeEngine.js';

const INTERIM_RHYME_DEBOUNCE_MS = 220;
const MAX_RESTART_BACKOFF_MS = 4000;

export function useRealTimeSpeechRecognition() {
  const recognitionState = {
    listeningStatus: 'idle',
    interimTranscript: '',
    finalTranscriptSegments: [],
    rhymeSuggestions: [],
    lastRecognizedPhrase: '',
    speechRecognitionError: '',
    microphoneLevel: 0,
    microphoneLabel: 'nenhum ativo',
    isSupported: true,
    shouldKeepListening: false,
    rhymeLanguageFilter: 'all',
    challengeWord: pickChallengeWord(),
    training: { score: 0, streak: 0, bestStreak: 0, totalLines: 0, rhymedLines: 0, lastResult: null },
  };

  const listeners = new Set();
  let microphoneAudioContext = null;
  let microphoneAnalyser = null;
  let microphoneStream = null;
  let microphoneLevelAnimationFrame = 0;

  let lastRhymedWord = '';
  let interimRhymeDebounceTimer = 0;
  let restartBackoffTimer = 0;
  let consecutiveRestartCount = 0;
  let pendingRhymeRequestToken = 0;
  let previousLineWord = '';

  function updateInterface() {
    listeners.forEach((listenerCallback) => listenerCallback({ ...recognitionState }));
  }

  // Resolves the requested rhymes asynchronously and only applies them if the
  // source phrase and language filter are still the latest the user cares about.
  function refreshRhymeSuggestions(sourcePhrase, { forceRecompute = false } = {}) {
    const spokenWord = getLastWord(sourcePhrase);
    if (!spokenWord) {
      return;
    }
    if (!forceRecompute && spokenWord === lastRhymedWord) {
      return;
    }
    lastRhymedWord = spokenWord;

    const requestedLanguageFilter = recognitionState.rhymeLanguageFilter;
    const requestToken = (pendingRhymeRequestToken += 1);

    // Instant curated results so the panel never feels frozen while lists load.
    recognitionState.rhymeSuggestions = suggestRhymesFromCuratedCatalog(sourcePhrase, requestedLanguageFilter);
    updateInterface();

    suggestRhymes(sourcePhrase, requestedLanguageFilter)
      .then((rhymeSuggestions) => {
        if (requestToken !== pendingRhymeRequestToken || requestedLanguageFilter !== recognitionState.rhymeLanguageFilter) {
          return;
        }
        recognitionState.rhymeSuggestions = rhymeSuggestions;
        updateInterface();
      })
      .catch(() => {});
  }

  function scheduleInterimRhymeRefresh(interimPhrase) {
    if (interimRhymeDebounceTimer) {
      window.clearTimeout(interimRhymeDebounceTimer);
    }
    interimRhymeDebounceTimer = window.setTimeout(() => {
      interimRhymeDebounceTimer = 0;
      refreshRhymeSuggestions(interimPhrase);
    }, INTERIM_RHYME_DEBOUNCE_MS);
  }

  const RHYME_POINTS = { perfect: 3, slant: 2, toante: 1 };

  function trainingLanguage() {
    return recognitionState.rhymeLanguageFilter === 'all' ? 'pt' : recognitionState.rhymeLanguageFilter;
  }

  // Grade a finalized bar against the previous one (streak/score) and against the
  // current challenge word (bonus + rotate). Runs only on finalized phrases.
  function scoreFinalizedLine(lineText) {
    const lineWord = getLastWord(lineText);
    if (!lineWord) {
      return;
    }
    const language = trainingLanguage();
    const training = recognitionState.training;

    let lastResult;
    if (previousLineWord) {
      const tier = classifyRhyme(lineWord, previousLineWord, language);
      const points = RHYME_POINTS[tier] || 0;
      if (points > 0) {
        training.score += points;
        training.streak += 1;
        training.rhymedLines += 1;
        training.bestStreak = Math.max(training.bestStreak, training.streak);
      } else if (tier !== 'same') {
        // A clear non-rhyme breaks the streak; repeating the same word is neutral.
        training.streak = 0;
      }
      training.totalLines += 1;
      lastResult = { tier: tier || 'none', points, word: lineWord, rhymedWith: previousLineWord, challengeHit: false };
    } else {
      lastResult = { tier: 'start', points: 0, word: lineWord, rhymedWith: '', challengeHit: false };
    }

    if (recognitionState.challengeWord) {
      const challengeTier = classifyRhyme(lineWord, recognitionState.challengeWord, language);
      if (challengeTier && challengeTier !== 'same') {
        training.score += 2;
        lastResult.challengeHit = true;
        recognitionState.challengeWord = pickChallengeWord(recognitionState.challengeWord);
      }
    }

    training.lastResult = lastResult;
    previousLineWord = lineWord;
  }

  function newChallenge() {
    recognitionState.challengeWord = pickChallengeWord(recognitionState.challengeWord);
    updateInterface();
  }

  function resetTraining() {
    previousLineWord = '';
    recognitionState.training = { score: 0, streak: 0, bestStreak: 0, totalLines: 0, rhymedLines: 0, lastResult: null };
    updateInterface();
  }

  const speechRecognitionService = new BrowserSpeechRecognitionService(defaultSpeechLanguage, {
    onUnsupported: () => {
      recognitionState.isSupported = false;
      recognitionState.listeningStatus = 'unsupported';
      updateInterface();
    },
    onStart: () => {
      consecutiveRestartCount = 0;
      recognitionState.listeningStatus = 'listening';
      recognitionState.speechRecognitionError = '';
      updateInterface();
    },
    onEnd: () => {
      if (recognitionState.shouldKeepListening) {
        // Chrome ends recognition on silence/timeouts; restart with a small
        // backoff so transient (e.g. network) errors don't spin a tight loop.
        const restartDelayMs = Math.min(consecutiveRestartCount * 300, MAX_RESTART_BACKOFF_MS);
        consecutiveRestartCount += 1;
        if (restartBackoffTimer) {
          window.clearTimeout(restartBackoffTimer);
        }
        restartBackoffTimer = window.setTimeout(() => {
          restartBackoffTimer = 0;
          if (!recognitionState.shouldKeepListening) {
            return;
          }
          try {
            speechRecognitionService.start();
          } catch (caughtError) {
            recognitionState.speechRecognitionError = (caughtError && caughtError.message) || 'Failed to restart recognition.';
            recognitionState.listeningStatus = 'stopped';
            updateInterface();
          }
        }, restartDelayMs);
        return;
      }
      recognitionState.listeningStatus = 'stopped';
      recognitionState.interimTranscript = '';
      updateInterface();
    },
    onError: (speechRecognitionErrorCode) => {
      recognitionState.speechRecognitionError = speechRecognitionErrorCode;
      // 'no-speech' / 'network' are recoverable — keep listening and let onEnd
      // restart. Permission errors are terminal.
      if (speechRecognitionErrorCode === 'not-allowed' || speechRecognitionErrorCode === 'service-not-allowed') {
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
        // A finalized phrase wins: rhyme on it immediately and cancel any pending interim refresh.
        if (interimRhymeDebounceTimer) {
          window.clearTimeout(interimRhymeDebounceTimer);
          interimRhymeDebounceTimer = 0;
        }
        recognitionState.lastRecognizedPhrase = latestFinalTranscriptSegment;
        refreshRhymeSuggestions(latestFinalTranscriptSegment, { forceRecompute: true });
        scoreFinalizedLine(latestFinalTranscriptSegment);
      } else if (activeInterimTranscript) {
        // Live rhymes as you speak — update only when the trailing word changes.
        recognitionState.lastRecognizedPhrase = activeInterimTranscript;
        scheduleInterimRhymeRefresh(activeInterimTranscript);
      }
      updateInterface();
    },
  });

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
    recognitionState.microphoneLabel = 'Pedindo acesso ao microfone...';
    consecutiveRestartCount = 0;
    ensureCatalogsLoaded(recognitionState.rhymeLanguageFilter);
    updateInterface();
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recognitionState.microphoneLabel = microphoneStream.getAudioTracks()[0]?.label || 'microfone padrão';
      updateInterface();
      microphoneAudioContext = new window.AudioContext();
      if (microphoneAudioContext.state === 'suspended') {
        microphoneAudioContext.resume().catch(() => {});
      }
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
        const nextMicrophoneLevel = Math.min(100, Math.round((totalAmplitude / microphoneDataArray.length) * 2));
        // Only re-render when the level visibly changes to avoid a 60fps render storm.
        if (nextMicrophoneLevel !== recognitionState.microphoneLevel) {
          recognitionState.microphoneLevel = nextMicrophoneLevel;
          updateInterface();
        }
        microphoneLevelAnimationFrame = window.requestAnimationFrame(updateMicrophoneLevel);
      };
      updateMicrophoneLevel();
      speechRecognitionService.start();
    } catch (caughtError) {
      recognitionState.speechRecognitionError = (caughtError && caughtError.name) || 'microphone-access-failed';
      recognitionState.shouldKeepListening = false;
      recognitionState.listeningStatus = 'stopped';
      recognitionState.microphoneLabel = 'nenhum ativo';
      updateInterface();
    }
  }

  function setRhymeLanguageFilter(nextRhymeLanguageFilter) {
    if (!['all', 'pt', 'en', 'es'].includes(nextRhymeLanguageFilter) || recognitionState.rhymeLanguageFilter === nextRhymeLanguageFilter) {
      return;
    }

    recognitionState.rhymeLanguageFilter = nextRhymeLanguageFilter;
    ensureCatalogsLoaded(nextRhymeLanguageFilter);

    // Switching to a specific language also switches what the microphone transcribes.
    const nextRecognitionLocale = recognitionLocaleForRhymeFilter(nextRhymeLanguageFilter);
    if (nextRecognitionLocale && speechRecognitionService.setLanguage(nextRecognitionLocale) && recognitionState.shouldKeepListening) {
      // stop() triggers onEnd, which restarts recognition in the new locale.
      speechRecognitionService.stop();
    }

    if (recognitionState.lastRecognizedPhrase) {
      refreshRhymeSuggestions(recognitionState.lastRecognizedPhrase, { forceRecompute: true });
    }
    updateInterface();
  }

  function stopListening() {
    if (!recognitionState.shouldKeepListening) {
      return;
    }
    recognitionState.shouldKeepListening = false;
    if (restartBackoffTimer) {
      window.clearTimeout(restartBackoffTimer);
      restartBackoffTimer = 0;
    }
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
    if (interimRhymeDebounceTimer) {
      window.clearTimeout(interimRhymeDebounceTimer);
      interimRhymeDebounceTimer = 0;
    }
    speechRecognitionService.destroy();
    listeners.clear();
  }

  return { subscribe, startListening, stopListening, setRhymeLanguageFilter, newChallenge, resetTraining, dispose };
}
