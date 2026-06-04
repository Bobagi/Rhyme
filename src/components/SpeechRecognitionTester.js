import { useRealTimeSpeechRecognition } from '../hooks/useRealTimeSpeechRecognition.js';
import { Metronome, MIN_BPM, MAX_BPM, DEFAULT_BPM } from '../audio/metronome.js';
import {
  translate,
  resolveInitialUiLanguage,
  storeUiLanguage,
  documentLanguageTag,
  SUPPORTED_UI_LANGUAGES,
} from '../i18n/i18n.js';

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

// Rhyme suggestions are { text, tier }: render the word plus a translated badge
// for the approximate tiers so the user knows it is a slant/assonant rhyme.
function renderRhymeSuggestionsIfChanged(listElement, nextItems, translateKey) {
  const serializedNextItems = JSON.stringify(nextItems);
  if (listElement.dataset.items === serializedNextItems) {
    return;
  }
  listElement.dataset.items = serializedNextItems;
  listElement.innerHTML = '';
  nextItems.forEach((suggestion) => {
    const listItem = document.createElement('li');
    listItem.dataset.word = suggestion.text;
    listItem.dataset.tier = suggestion.tier || 'perfect';

    const wordElement = document.createElement('span');
    wordElement.className = 'rhyme-word';
    wordElement.textContent = suggestion.text;
    listItem.appendChild(wordElement);

    if (suggestion.tier === 'slant' || suggestion.tier === 'toante') {
      const badgeElement = document.createElement('span');
      badgeElement.className = 'rhyme-badge';
      badgeElement.textContent = translateKey(suggestion.tier === 'slant' ? 'badge.slant' : 'badge.toante');
      listItem.appendChild(badgeElement);
    }
    listElement.appendChild(listItem);
  });
}

function buildTrainingFeedback(lastResult, translateKey) {
  if (!lastResult) {
    return translateKey('feedback.default');
  }
  let message = translateKey(`feedback.${lastResult.tier}`);
  if (lastResult.points) {
    message += ` +${lastResult.points}`;
  }
  if (lastResult.challengeHit) {
    message += ` · ${translateKey('feedback.challenge')}`;
  }
  if (lastResult.rhymedWith && lastResult.tier !== 'same' && lastResult.tier !== 'start') {
    message += ` (${lastResult.word} / ${lastResult.rhymedWith})`;
  }
  return message;
}

function isGoogleChromeBrowser() {
  const userAgent = navigator.userAgent || '';
  return /Chrome|CriOS/.test(userAgent) && !/Edg|OPR|Opera|SamsungBrowser/.test(userAgent) && !navigator.brave;
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

  let uiLanguage = resolveInitialUiLanguage();
  document.documentElement.lang = documentLanguageTag[uiLanguage] || 'pt-BR';
  const t = (key) => translate(key, uiLanguage);

  rootElement.innerHTML = `
    <main class="container">
      <header class="hero">
        <div class="hero-text">
          <p class="eyebrow" data-i18n="hero.eyebrow">${t('hero.eyebrow')}</p>
          <h1>Rhyme <span>Trainer</span></h1>
          <p class="intro" data-i18n="hero.intro">${t('hero.intro')}</p>
          <ul class="badges">
            <li data-i18n="badge.realtime">${t('badge.realtime')}</li>
            <li data-i18n="badge.free">${t('badge.free')}</li>
            <li data-i18n="badge.browser">${t('badge.browser')}</li>
            <li>PT · EN · ES</li>
          </ul>
          <div class="listen-controls"><button class="listen-button" id="toggleListeningButton" type="button"><span class="listen-icon">🎙</span><span id="toggleListeningButtonLabel">${t('controls.start')}</span></button><span class="microphone-label" id="microphoneLabelValue">${t('mic.prefix')}: ${t('mic.none')}</span></div>
        </div>
        <div class="lang-switcher" role="group" aria-label="${t('siteLanguage.label')}" data-i18n-aria="siteLanguage.label">
          <span class="lang-globe" aria-hidden="true">🌐</span>
          <button class="lang-option" type="button" data-ui-lang="pt">PT</button>
          <button class="lang-option" type="button" data-ui-lang="en">EN</button>
          <button class="lang-option" type="button" data-ui-lang="es">ES</button>
        </div>
      </header>
      <section class="status-row" hidden>
        <div class="warning" id="unsupportedBrowserMessage"></div>
        <div class="warning" id="braveBrowserMessage"></div>
        <div class="error" id="speechRecognitionErrorMessage"></div>
      </section>
      <section class="grid">
        <section class="panel large training-panel">
          <div class="panel-title">
            <strong data-i18n="training.title">${t('training.title')}</strong>
            <button class="ghost-button" id="resetTrainingButton" type="button" data-i18n="training.reset">${t('training.reset')}</button>
          </div>
          <div class="training-grid">
            <div class="stat"><span class="stat-label" data-i18n="training.points">${t('training.points')}</span><span class="stat-value" id="trainingScore">0</span></div>
            <div class="stat"><span class="stat-label" data-i18n="training.streak">${t('training.streak')}</span><span class="stat-value" id="trainingStreak">0</span></div>
            <div class="stat"><span class="stat-label" data-i18n="training.best">${t('training.best')}</span><span class="stat-value" id="trainingBest">0</span></div>
          </div>
          <p class="training-feedback" id="trainingFeedback">${t('feedback.default')}</p>
          <div class="training-tools">
            <div class="tool">
              <span class="tool-label" data-i18n="training.challengeLabel">${t('training.challengeLabel')}</span>
              <div class="tool-row"><strong class="challenge-word" id="challengeWordValue">—</strong><button class="ghost-button" id="newChallengeButton" type="button" data-i18n="training.newChallenge">${t('training.newChallenge')}</button></div>
            </div>
            <div class="tool">
              <span class="tool-label" data-i18n="training.beatLabel">${t('training.beatLabel')}</span>
              <div class="tool-row"><button class="ghost-button beat-toggle" id="beatToggleButton" type="button">${t('beat.play')}</button><input class="bpm-slider" id="bpmSlider" type="range" min="${MIN_BPM}" max="${MAX_BPM}" step="1" value="${DEFAULT_BPM}" aria-label="BPM" /><span class="bpm-readout"><strong id="bpmValue">${DEFAULT_BPM}</strong> BPM</span><span class="beat-dot" id="beatDot"></span></div>
              <span class="bpm-hint">${MIN_BPM}–${MAX_BPM} BPM</span>
            </div>
          </div>
        </section>
        <section class="panel compact">
          <strong class="panel-title" data-i18n="panel.micLevel">${t('panel.micLevel')}</strong>
          <div class="meter"><div id="microphoneLevelBar"></div></div>
        </section>
        <section class="panel compact">
          <strong class="panel-title" data-i18n="panel.interim">${t('panel.interim')}</strong>
          <p class="transcript" id="interimTranscriptValue">-</p>
        </section>
        <section class="panel large selectable-panel" id="rhymePanel">
          <div class="panel-title">
            <strong data-i18n="panel.rhymes">${t('panel.rhymes')}</strong>
            <div class="language-filter" aria-label="${t('panel.rhymeLanguage')}" data-i18n-aria="panel.rhymeLanguage">
              <span data-i18n="panel.rhymeLanguage">${t('panel.rhymeLanguage')}</span>
              <button class="language-filter-option is-active" type="button" data-rhyme-language-filter="all" data-i18n="filter.all">${t('filter.all')}</button>
              <button class="language-filter-option" type="button" data-rhyme-language-filter="pt" aria-label="Português"><span class="flag flag-br"></span></button>
              <button class="language-filter-option" type="button" data-rhyme-language-filter="en" aria-label="English"><span class="flag flag-us"></span></button>
              <button class="language-filter-option" type="button" data-rhyme-language-filter="es" aria-label="Español"><span class="flag flag-es"></span></button>
            </div>
          </div>
          <p class="transcript" id="lastRecognizedPhraseValue">-</p>
          <ul id="rhymeSuggestionsList"></ul>
          <div class="copy-toast" id="rhymeCopyToast" role="status" aria-live="polite" hidden data-i18n="copy.done">${t('copy.done')}</div>
        </section>
        <section class="panel large selectable-panel">
          <strong class="panel-title" data-i18n="panel.history">${t('panel.history')}</strong>
          <ul id="finalTranscriptHistory"></ul>
        </section>
      </section>
      <footer class="site-footer">
        <span><span data-i18n="footer.made">${t('footer.made')}</span> <a href="https://github.com/Bobagi" target="_blank" rel="noopener">Bobagi</a></span>
        <a href="https://github.com/Bobagi/Rhyme" target="_blank" rel="noopener" data-i18n="footer.github">${t('footer.github')}</a>
      </footer>
    </main>
  `;

  const elements = {
    toggleListeningButton: rootElement.querySelector('#toggleListeningButton'),
    toggleListeningButtonLabel: rootElement.querySelector('#toggleListeningButtonLabel'),
    listenIcon: rootElement.querySelector('.listen-icon'),
    statusRow: rootElement.querySelector('.status-row'),
    unsupportedBrowserMessage: rootElement.querySelector('#unsupportedBrowserMessage'),
    braveBrowserMessage: rootElement.querySelector('#braveBrowserMessage'),
    speechRecognitionErrorMessage: rootElement.querySelector('#speechRecognitionErrorMessage'),
    interimTranscriptValue: rootElement.querySelector('#interimTranscriptValue'),
    finalTranscriptHistory: rootElement.querySelector('#finalTranscriptHistory'),
    lastRecognizedPhraseValue: rootElement.querySelector('#lastRecognizedPhraseValue'),
    rhymeSuggestionsList: rootElement.querySelector('#rhymeSuggestionsList'),
    microphoneLevelBar: rootElement.querySelector('#microphoneLevelBar'),
    microphoneLabelValue: rootElement.querySelector('#microphoneLabelValue'),
    rhymePanel: rootElement.querySelector('#rhymePanel'),
    rhymeCopyToast: rootElement.querySelector('#rhymeCopyToast'),
    trainingScore: rootElement.querySelector('#trainingScore'),
    trainingStreak: rootElement.querySelector('#trainingStreak'),
    trainingBest: rootElement.querySelector('#trainingBest'),
    trainingFeedback: rootElement.querySelector('#trainingFeedback'),
    challengeWordValue: rootElement.querySelector('#challengeWordValue'),
    newChallengeButton: rootElement.querySelector('#newChallengeButton'),
    resetTrainingButton: rootElement.querySelector('#resetTrainingButton'),
    beatToggleButton: rootElement.querySelector('#beatToggleButton'),
    bpmSlider: rootElement.querySelector('#bpmSlider'),
    bpmValue: rootElement.querySelector('#bpmValue'),
    beatDot: rootElement.querySelector('#beatDot'),
  };
  const rhymeLanguageFilterOptions = [...rootElement.querySelectorAll('[data-rhyme-language-filter]')];
  const uiLanguageOptions = [...rootElement.querySelectorAll('[data-ui-lang]')];

  let latestSnapshot = null;
  let latestListeningStatus = 'idle';
  let isPointerSelectingRhymeText = false;
  let isSelectingRhymeText = false;

  // ── metronome ───────────────────────────────────────────────────────────────
  const metronome = new Metronome({
    onBeat: () => {
      elements.beatDot.classList.add('is-pulsing');
      window.setTimeout(() => elements.beatDot.classList.remove('is-pulsing'), 90);
    },
  });
  const updateBeatButton = () => {
    setTextContentIfChanged(elements.beatToggleButton, t(metronome.isPlaying ? 'beat.stop' : 'beat.play'));
    elements.beatToggleButton.classList.toggle('is-active', metronome.isPlaying);
  };
  elements.beatToggleButton.addEventListener('click', () => {
    metronome.toggle();
    updateBeatButton();
  });
  elements.bpmSlider.addEventListener('input', () => {
    const clampedBeatsPerMinute = metronome.setBeatsPerMinute(elements.bpmSlider.value);
    elements.bpmSlider.value = String(clampedBeatsPerMinute);
    setTextContentIfChanged(elements.bpmValue, String(clampedBeatsPerMinute));
  });

  // ── i18n: re-translate static labels + reflect active language ───────────────
  const applyStaticTranslations = () => {
    rootElement.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    rootElement.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', t(element.dataset.i18nAria));
    });
    uiLanguageOptions.forEach((option) => option.classList.toggle('is-active', option.dataset.uiLang === uiLanguage));
    updateBeatButton();
  };

  const setUiLanguage = (nextLanguage) => {
    if (!SUPPORTED_UI_LANGUAGES.includes(nextLanguage) || nextLanguage === uiLanguage) {
      return;
    }
    uiLanguage = nextLanguage;
    storeUiLanguage(nextLanguage);
    document.documentElement.lang = documentLanguageTag[nextLanguage] || 'pt-BR';
    applyStaticTranslations();
    elements.rhymeSuggestionsList.dataset.items = ''; // force badge re-translation
    if (latestSnapshot) {
      applyDynamicText(latestSnapshot);
    }
    // Switching the site language also switches what the mic transcribes / rhymes.
    speechRecognitionController.setRhymeLanguageFilter(nextLanguage);
  };
  uiLanguageOptions.forEach((option) => {
    option.addEventListener('click', () => setUiLanguage(option.dataset.uiLang));
  });

  // ── error code → localized message ───────────────────────────────────────────
  const recognitionErrorKeyByCode = {
    network: 'error.network',
    'not-allowed': 'error.notAllowed',
    'service-not-allowed': 'error.serviceNotAllowed',
  };
  const translateRecognitionError = (errorCode) => (
    recognitionErrorKeyByCode[errorCode] ? t(recognitionErrorKeyByCode[errorCode]) : `${t('error.prefix')}: ${errorCode}`
  );
  const formatMicrophoneLabel = (deviceName) => `${t('mic.prefix')}: ${deviceName || t('mic.none')}`;

  // ── per-snapshot view update ─────────────────────────────────────────────────
  function applyDynamicText(snapshot) {
    const isListening = snapshot.listeningStatus === 'listening' || snapshot.listeningStatus === 'starting';
    latestListeningStatus = snapshot.listeningStatus;
    setTextContentIfChanged(elements.toggleListeningButtonLabel, isListening ? t('controls.stop') : t('controls.start'));
    setTextContentIfChanged(elements.listenIcon, isListening ? '■' : '🎙');
    elements.toggleListeningButton.classList.toggle('is-listening', isListening);
    setTextContentIfChanged(elements.unsupportedBrowserMessage, snapshot.isSupported ? '' : t('warning.unsupported'));
    setTextContentIfChanged(elements.braveBrowserMessage, isGoogleChromeBrowser() ? '' : t('warning.brave'));
    setTextContentIfChanged(elements.speechRecognitionErrorMessage, snapshot.speechRecognitionError ? translateRecognitionError(snapshot.speechRecognitionError) : '');
    elements.statusRow.hidden = !elements.unsupportedBrowserMessage.textContent && !elements.braveBrowserMessage.textContent && !elements.speechRecognitionErrorMessage.textContent;
    elements.microphoneLevelBar.style.width = `${snapshot.microphoneLevel}%`;
    setTextContentIfChanged(elements.microphoneLabelValue, formatMicrophoneLabel(snapshot.microphoneLabel));

    const training = snapshot.training || { score: 0, streak: 0, bestStreak: 0, lastResult: null };
    setTextContentIfChanged(elements.trainingScore, String(training.score));
    setTextContentIfChanged(elements.trainingStreak, training.streak >= 2 ? `🔥 ${training.streak}` : String(training.streak));
    setTextContentIfChanged(elements.trainingBest, String(training.bestStreak));
    setTextContentIfChanged(elements.trainingFeedback, buildTrainingFeedback(training.lastResult, t));
    elements.trainingFeedback.dataset.tier = training.lastResult ? training.lastResult.tier : '';
    setTextContentIfChanged(elements.challengeWordValue, snapshot.challengeWord || '—');

    if (isSelectingRhymeText) {
      return;
    }

    setTextContentIfChanged(elements.interimTranscriptValue, snapshot.interimTranscript || '-');
    setTextContentIfChanged(elements.lastRecognizedPhraseValue, snapshot.lastRecognizedPhrase || '-');
    renderRhymeSuggestionsIfChanged(elements.rhymeSuggestionsList, snapshot.rhymeSuggestions, t);
    rhymeLanguageFilterOptions.forEach((option) => option.classList.toggle('is-active', option.dataset.rhymeLanguageFilter === snapshot.rhymeLanguageFilter));
    renderListItemsIfChanged(elements.finalTranscriptHistory, snapshot.finalTranscriptSegments);
  }

  // ── rhyme panel text selection (don't re-render while the user is selecting) ──
  const updateRhymeSelectionState = () => {
    isSelectingRhymeText = isPointerSelectingRhymeText || selectionIntersectsElement(elements.rhymePanel);
  };
  const startRhymeSelection = (pointerEvent) => {
    if (pointerEvent.target.closest('.language-filter')) {
      return;
    }
    isPointerSelectingRhymeText = true;
    updateRhymeSelectionState();
  };
  const finishRhymeSelection = () => {
    window.setTimeout(() => {
      isPointerSelectingRhymeText = false;
      updateRhymeSelectionState();
    }, 0);
  };
  elements.rhymePanel.addEventListener('pointerdown', startRhymeSelection);
  document.addEventListener('selectionchange', updateRhymeSelectionState);
  document.addEventListener('pointerup', finishRhymeSelection);

  rhymeLanguageFilterOptions.forEach((option) => {
    option.addEventListener('click', () => speechRecognitionController.setRhymeLanguageFilter(option.dataset.rhymeLanguageFilter));
  });
  elements.newChallengeButton.addEventListener('click', () => speechRecognitionController.newChallenge());
  elements.resetTrainingButton.addEventListener('click', () => speechRecognitionController.resetTraining());

  // ── copy-to-clipboard ────────────────────────────────────────────────────────
  let rhymeCopyToastTimer = 0;
  const showRhymeCopyToast = () => {
    elements.rhymeCopyToast.hidden = false;
    elements.rhymeCopyToast.classList.add('is-visible');
    if (rhymeCopyToastTimer) {
      window.clearTimeout(rhymeCopyToastTimer);
    }
    rhymeCopyToastTimer = window.setTimeout(() => {
      elements.rhymeCopyToast.classList.remove('is-visible');
      elements.rhymeCopyToast.hidden = true;
    }, 1100);
  };
  const copyRhymeSuggestion = async (rhymeText, listItemElement) => {
    try {
      await navigator.clipboard.writeText(rhymeText);
    } catch (clipboardError) {
      const selectionRange = document.createRange();
      selectionRange.selectNodeContents(listItemElement);
      const activeSelection = window.getSelection();
      activeSelection.removeAllRanges();
      activeSelection.addRange(selectionRange);
      try {
        document.execCommand('copy');
      } catch (legacyCopyError) {
        // Nothing else to try; the user can still select manually.
      }
      activeSelection.removeAllRanges();
    }
    listItemElement.classList.add('is-copied');
    window.setTimeout(() => listItemElement.classList.remove('is-copied'), 600);
    showRhymeCopyToast();
  };
  elements.rhymeSuggestionsList.addEventListener('click', (clickEvent) => {
    const listItemElement = clickEvent.target.closest('li');
    if (!listItemElement || !elements.rhymeSuggestionsList.contains(listItemElement)) {
      return;
    }
    const activeSelection = window.getSelection();
    if (activeSelection && !activeSelection.isCollapsed && selectionIntersectsElement(listItemElement)) {
      return;
    }
    copyRhymeSuggestion(listItemElement.dataset.word || listItemElement.textContent, listItemElement);
  });

  elements.toggleListeningButton.addEventListener('click', () => {
    if (latestListeningStatus === 'listening' || latestListeningStatus === 'starting') {
      speechRecognitionController.stopListening();
      return;
    }
    speechRecognitionController.startListening();
  });

  const unsubscribe = speechRecognitionController.subscribe((snapshot) => {
    latestSnapshot = snapshot;
    applyDynamicText(snapshot);
  });

  applyStaticTranslations();
  // Match the mic transcription / rhyme source to the detected site language.
  speechRecognitionController.setRhymeLanguageFilter(uiLanguage);

  return () => {
    metronome.dispose();
    elements.rhymePanel.removeEventListener('pointerdown', startRhymeSelection);
    document.removeEventListener('selectionchange', updateRhymeSelectionState);
    document.removeEventListener('pointerup', finishRhymeSelection);
    unsubscribe();
    speechRecognitionController.dispose();
  };
}
