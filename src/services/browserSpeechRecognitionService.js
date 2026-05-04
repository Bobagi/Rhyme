const browserSpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;

export class BrowserSpeechRecognitionService {
  constructor(selectedSpeechLanguage, browserSpeechRecognitionCallbacks) {
    this.selectedSpeechLanguage = selectedSpeechLanguage;
    this.browserSpeechRecognitionCallbacks = browserSpeechRecognitionCallbacks;
    this.speechRecognitionInstance = null;
    this.hasFallbackLanguageApplied = false;
  }

  isSupported() {
    return Boolean(browserSpeechRecognitionConstructor);
  }

  applyFallbackLanguage() {
    if (this.speechRecognitionInstance && !this.hasFallbackLanguageApplied) {
      this.speechRecognitionInstance.lang = 'en-US';
      this.hasFallbackLanguageApplied = true;
      return true;
    }
    return false;
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
      this.speechRecognitionInstance.lang = this.selectedSpeechLanguage.locale;
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
