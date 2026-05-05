const browserSpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
const browserSpeechRecognitionApiName = window.SpeechRecognition ? 'SpeechRecognition' : 'webkitSpeechRecognition';

export class BrowserSpeechRecognitionService {
  constructor(selectedSpeechLanguage, browserSpeechRecognitionCallbacks) {
    this.selectedSpeechLanguage = selectedSpeechLanguage;
    this.browserSpeechRecognitionCallbacks = browserSpeechRecognitionCallbacks;
    this.speechRecognitionInstance = null;
  }

  isSupported() {
    return Boolean(browserSpeechRecognitionConstructor);
  }

  getDiagnostics() {
    return {
      apiName: this.isSupported() ? browserSpeechRecognitionApiName : 'unavailable',
      selectedLanguage: this.selectedSpeechLanguage.locale,
      recognitionLanguage: this.speechRecognitionInstance ? this.speechRecognitionInstance.lang : this.selectedSpeechLanguage.locale,
      continuous: this.speechRecognitionInstance ? this.speechRecognitionInstance.continuous : true,
      interimResults: this.speechRecognitionInstance ? this.speechRecognitionInstance.interimResults : true,
    };
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
      this.speechRecognitionInstance.onerror = (speechRecognitionError) => this.browserSpeechRecognitionCallbacks.onError({
        code: speechRecognitionError.error || 'unknown',
        message: speechRecognitionError.message || '',
        eventType: speechRecognitionError.type || 'error',
      });
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
