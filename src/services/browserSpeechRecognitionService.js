const browserSpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;

export class BrowserSpeechRecognitionService {
  constructor(selectedSpeechLanguage, browserSpeechRecognitionCallbacks) {
    this.recognitionLocale = selectedSpeechLanguage.locale;
    this.browserSpeechRecognitionCallbacks = browserSpeechRecognitionCallbacks;
    this.speechRecognitionInstance = null;
  }

  isSupported() {
    return Boolean(browserSpeechRecognitionConstructor);
  }

  getLocale() {
    return this.recognitionLocale;
  }

  // Updating the locale takes effect on the next start(); callers that want it
  // applied immediately stop() and rely on the auto-restart in onEnd.
  setLanguage(nextRecognitionLocale) {
    if (!nextRecognitionLocale || nextRecognitionLocale === this.recognitionLocale) {
      return false;
    }
    this.recognitionLocale = nextRecognitionLocale;
    if (this.speechRecognitionInstance) {
      this.speechRecognitionInstance.lang = nextRecognitionLocale;
    }
    return true;
  }

  start() {
    if (!this.isSupported()) {
      this.browserSpeechRecognitionCallbacks.onUnsupported();
      return;
    }
    if (!this.speechRecognitionInstance) {
      this.speechRecognitionInstance = new browserSpeechRecognitionConstructor();
      this.speechRecognitionInstance.continuous = true;
      this.speechRecognitionInstance.interimResults = true;
      this.speechRecognitionInstance.onstart = () => this.browserSpeechRecognitionCallbacks.onStart();
      this.speechRecognitionInstance.onend = () => this.browserSpeechRecognitionCallbacks.onEnd();
      this.speechRecognitionInstance.onerror = (speechRecognitionError) => this.browserSpeechRecognitionCallbacks.onError(speechRecognitionError.error || 'unknown');
      this.speechRecognitionInstance.onresult = (speechRecognitionEvent) => {
        const recognizedSpeechSegments = [];
        for (let segmentIndex = speechRecognitionEvent.resultIndex; segmentIndex < speechRecognitionEvent.results.length; segmentIndex += 1) {
          const recognitionResult = speechRecognitionEvent.results[segmentIndex];
          const recognizedTranscript = recognitionResult[0]?.transcript?.trim() || '';
          recognizedSpeechSegments.push({ transcript: recognizedTranscript, isFinal: recognitionResult.isFinal });
        }
        this.browserSpeechRecognitionCallbacks.onResult(recognizedSpeechSegments);
      };
    }
    // Always re-apply the locale so a mid-session language switch is honored on restart.
    this.speechRecognitionInstance.lang = this.recognitionLocale;
    try {
      this.speechRecognitionInstance.start();
    } catch (caughtError) {
      if (!caughtError || caughtError.name !== 'InvalidStateError') {
        throw caughtError;
      }
    }
  }

  stop() {
    if (this.speechRecognitionInstance) {
      this.speechRecognitionInstance.stop();
    }
  }

  destroy() {
    if (this.speechRecognitionInstance) {
      this.speechRecognitionInstance.onstart = null;
      this.speechRecognitionInstance.onend = null;
      this.speechRecognitionInstance.onerror = null;
      this.speechRecognitionInstance.onresult = null;
      this.speechRecognitionInstance.stop();
      this.speechRecognitionInstance = null;
    }
  }
}
