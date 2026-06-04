import { useRealTimeSpeechRecognition } from '../hooks/useRealTimeSpeechRecognition.js';

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

// Rhyme suggestions are { text, tier } — render the word plus a small badge for
// the approximate tiers so the user knows a suggestion is a slant/toante rhyme.
function renderRhymeSuggestionsIfChanged(listElement, nextItems) {
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
      badgeElement.textContent = suggestion.tier === 'slant' ? 'aprox.' : 'toante';
      listItem.appendChild(badgeElement);
    }

    listElement.appendChild(listItem);
  });
}

const TRAINING_FEEDBACK_BY_TIER = {
  perfect: 'Rima perfeita!',
  slant: 'Rima aproximada!',
  toante: 'Rima toante!',
  same: 'Repetiu a palavra — vale zero.',
  none: 'Sem rima dessa vez.',
  start: 'Primeira linha — manda a próxima pra rimar.',
};

function trainingFeedbackMessage(lastResult) {
  if (!lastResult) {
    return 'Fale duas frases que rimem pra pontuar.';
  }
  let message = TRAINING_FEEDBACK_BY_TIER[lastResult.tier] || '';
  if (lastResult.points) {
    message += ` +${lastResult.points}`;
  }
  if (lastResult.challengeHit) {
    message += ' · 🎯 desafio! +2';
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

async function getBrowserSelectedMicrophoneLabel() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return 'Microfone: microfone padrão';
  }

  const mediaDevices = await navigator.mediaDevices.enumerateDevices();
  const selectedMicrophone = mediaDevices.find((mediaDevice) => mediaDevice.kind === 'audioinput' && mediaDevice.deviceId === 'default')
    || mediaDevices.find((mediaDevice) => mediaDevice.kind === 'audioinput');

  return `Microfone: ${selectedMicrophone?.label || 'microfone padrão'}`;
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

  rootElement.innerHTML = `
    <main class="container">
      <header class="hero">
        <div>
          <p class="eyebrow">Estúdio de freestyle ao vivo</p>
          <h1>Rhyme <span>Trainer</span></h1>
          <p class="intro">Capture seu freestyle em tempo real, veja a última frase e clique em qualquer rima para copiá-la — sem parar o microfone. Escolha a bandeira para treinar em outro idioma (muda a transcrição e as rimas).</p>
          <ul class="badges"><li>🎙️ Tempo real</li><li>🆓 Grátis</li><li>🌐 No navegador</li><li>PT · EN · ES</li></ul>
          <div class="listen-controls"><button class="listen-button" id="toggleListeningButton" type="button"><span class="listen-icon">🎙</span><span id="toggleListeningButtonLabel">Começar</span></button><span class="microphone-label" id="microphoneLabelValue">Microfone: nenhum ativo</span></div>
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
            <strong>Treino</strong>
            <button class="ghost-button" id="resetTrainingButton" type="button">Zerar</button>
          </div>
          <div class="training-grid">
            <div class="stat"><span class="stat-label">Pontos</span><span class="stat-value" id="trainingScore">0</span></div>
            <div class="stat"><span class="stat-label">Sequência</span><span class="stat-value" id="trainingStreak">0</span></div>
            <div class="stat"><span class="stat-label">Recorde</span><span class="stat-value" id="trainingBest">0</span></div>
          </div>
          <p class="training-feedback" id="trainingFeedback">Fale duas frases que rimem pra pontuar.</p>
          <div class="training-tools">
            <div class="tool">
              <span class="tool-label">Palavra-desafio</span>
              <div class="tool-row"><strong class="challenge-word" id="challengeWordValue">—</strong><button class="ghost-button" id="newChallengeButton" type="button">Nova</button></div>
            </div>
            <div class="tool">
              <span class="tool-label">Beat</span>
              <div class="tool-row"><button class="ghost-button beat-toggle" id="beatToggleButton" type="button">▶ Play</button><input class="bpm-input" id="bpmInput" type="number" min="40" max="240" step="1" value="90" aria-label="BPM" /><span class="bpm-unit">BPM</span><span class="beat-dot" id="beatDot"></span></div>
            </div>
          </div>
        </section>
        <section class="panel compact">
          <strong class="panel-title">Nível do microfone</strong>
          <div class="meter">
            <div id="microphoneLevelBar"></div>
          </div>
        </section>
        <section class="panel compact">
          <strong class="panel-title">Transcrição ao vivo</strong>
          <p class="transcript" id="interimTranscriptValue">-</p>
        </section>
        <section class="panel large selectable-panel" id="rhymePanel">
          <div class="panel-title">
            <strong>Rimas da última frase</strong>
            <div class="language-filter" aria-label="Idioma das rimas">
              <span>Idioma</span>
              <button class="language-filter-option is-active" type="button" data-rhyme-language-filter="all">Todos</button>
              <button class="language-filter-option" type="button" data-rhyme-language-filter="pt" aria-label="Português"><span class="flag flag-br"></span></button>
              <button class="language-filter-option" type="button" data-rhyme-language-filter="en" aria-label="English"><span class="flag flag-us"></span></button>
              <button class="language-filter-option" type="button" data-rhyme-language-filter="es" aria-label="Español"><span class="flag flag-es"></span></button>
            </div>
          </div>
          <p class="transcript" id="lastRecognizedPhraseValue">-</p>
          <ul id="rhymeSuggestionsList"></ul>
          <div class="copy-toast" id="rhymeCopyToast" role="status" aria-live="polite" hidden>Copiado!</div>
        </section>
        <section class="panel large selectable-panel">
          <strong class="panel-title">Histórico</strong>
          <ul id="finalTranscriptHistory"></ul>
        </section>
      </section>
      <footer class="site-footer">
        <span>Rhyme — treinador de rima &amp; freestyle · feito por <a href="https://github.com/Bobagi" target="_blank" rel="noopener">Bobagi</a></span>
        <a href="https://github.com/Bobagi/Rhyme" target="_blank" rel="noopener">Código no GitHub ↗</a>
      </footer>
    </main>
  `;

  const toggleListeningButton = rootElement.querySelector('#toggleListeningButton');
  const toggleListeningButtonLabel = rootElement.querySelector('#toggleListeningButtonLabel');
  const statusRow = rootElement.querySelector('.status-row');
  const listenIcon = rootElement.querySelector('.listen-icon');
  const unsupportedBrowserMessage = rootElement.querySelector('#unsupportedBrowserMessage');
  const braveBrowserMessage = rootElement.querySelector('#braveBrowserMessage');
  const speechRecognitionErrorMessage = rootElement.querySelector('#speechRecognitionErrorMessage');
  const interimTranscriptValue = rootElement.querySelector('#interimTranscriptValue');
  const finalTranscriptHistory = rootElement.querySelector('#finalTranscriptHistory');
  const lastRecognizedPhraseValue = rootElement.querySelector('#lastRecognizedPhraseValue');
  const rhymeSuggestionsList = rootElement.querySelector('#rhymeSuggestionsList');
  const rhymeLanguageFilterOptions = [...rootElement.querySelectorAll('[data-rhyme-language-filter]')];
  const microphoneLevelBar = rootElement.querySelector('#microphoneLevelBar');
  const microphoneLabelValue = rootElement.querySelector('#microphoneLabelValue');
  const rhymePanel = rootElement.querySelector('#rhymePanel');
  const rhymeCopyToast = rootElement.querySelector('#rhymeCopyToast');
  const trainingScoreValue = rootElement.querySelector('#trainingScore');
  const trainingStreakValue = rootElement.querySelector('#trainingStreak');
  const trainingBestValue = rootElement.querySelector('#trainingBest');
  const trainingFeedbackValue = rootElement.querySelector('#trainingFeedback');
  const challengeWordValue = rootElement.querySelector('#challengeWordValue');
  const newChallengeButton = rootElement.querySelector('#newChallengeButton');
  const resetTrainingButton = rootElement.querySelector('#resetTrainingButton');
  const beatToggleButton = rootElement.querySelector('#beatToggleButton');
  const bpmInput = rootElement.querySelector('#bpmInput');
  const beatDot = rootElement.querySelector('#beatDot');
  let isPointerSelectingRhymeText = false;
  let isSelectingRhymeText = false;
  let latestListeningStatus = 'idle';

  getBrowserSelectedMicrophoneLabel()
    .then((browserSelectedMicrophoneLabel) => setTextContentIfChanged(microphoneLabelValue, browserSelectedMicrophoneLabel))
    .catch(() => setTextContentIfChanged(microphoneLabelValue, 'Microfone: microfone padrão'));

  // ── metronome (local, audio-only) ──────────────────────────────────────────
  let metronomeAudioContext = null;
  let metronomeTimer = 0;
  let isBeatPlaying = false;

  const beatIntervalMs = () => {
    const beatsPerMinute = Math.min(240, Math.max(40, Number(bpmInput.value) || 90));
    return 60000 / beatsPerMinute;
  };

  const playMetronomeClick = () => {
    if (!metronomeAudioContext) {
      return;
    }
    const clickOscillator = metronomeAudioContext.createOscillator();
    const clickGain = metronomeAudioContext.createGain();
    const startTime = metronomeAudioContext.currentTime;
    clickOscillator.frequency.value = 1100;
    clickGain.gain.setValueAtTime(0.0001, startTime);
    clickGain.gain.exponentialRampToValueAtTime(0.45, startTime + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
    clickOscillator.connect(clickGain);
    clickGain.connect(metronomeAudioContext.destination);
    clickOscillator.start(startTime);
    clickOscillator.stop(startTime + 0.06);
    beatDot.classList.add('is-pulsing');
    window.setTimeout(() => beatDot.classList.remove('is-pulsing'), 90);
  };

  const startBeat = () => {
    if (isBeatPlaying) {
      return;
    }
    if (!metronomeAudioContext) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      metronomeAudioContext = new AudioContextConstructor();
    }
    if (metronomeAudioContext.state === 'suspended') {
      metronomeAudioContext.resume().catch(() => {});
    }
    isBeatPlaying = true;
    beatToggleButton.textContent = '⏸ Stop';
    beatToggleButton.classList.add('is-active');
    playMetronomeClick();
    metronomeTimer = window.setInterval(playMetronomeClick, beatIntervalMs());
  };

  const stopBeat = () => {
    isBeatPlaying = false;
    beatToggleButton.textContent = '▶ Play';
    beatToggleButton.classList.remove('is-active');
    if (metronomeTimer) {
      window.clearInterval(metronomeTimer);
      metronomeTimer = 0;
    }
  };

  beatToggleButton.addEventListener('click', () => (isBeatPlaying ? stopBeat() : startBeat()));
  bpmInput.addEventListener('change', () => {
    if (isBeatPlaying) {
      stopBeat();
      startBeat();
    }
  });

  newChallengeButton.addEventListener('click', () => speechRecognitionController.newChallenge());
  resetTrainingButton.addEventListener('click', () => speechRecognitionController.resetTraining());

  const updateRhymeSelectionState = () => {
    isSelectingRhymeText = isPointerSelectingRhymeText || selectionIntersectsElement(rhymePanel);
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

  rhymePanel.addEventListener('pointerdown', startRhymeSelection);
  document.addEventListener('selectionchange', updateRhymeSelectionState);
  document.addEventListener('pointerup', finishRhymeSelection);

  rhymeLanguageFilterOptions.forEach((rhymeLanguageFilterOption) => {
    rhymeLanguageFilterOption.addEventListener('click', () => {
      speechRecognitionController.setRhymeLanguageFilter(rhymeLanguageFilterOption.dataset.rhymeLanguageFilter);
    });
  });

  let rhymeCopyToastTimer = 0;
  const showRhymeCopyToast = () => {
    rhymeCopyToast.hidden = false;
    rhymeCopyToast.classList.add('is-visible');
    if (rhymeCopyToastTimer) {
      window.clearTimeout(rhymeCopyToastTimer);
    }
    rhymeCopyToastTimer = window.setTimeout(() => {
      rhymeCopyToast.classList.remove('is-visible');
      rhymeCopyToast.hidden = true;
    }, 1100);
  };

  const copyRhymeSuggestion = async (rhymeText, listItemElement) => {
    try {
      await navigator.clipboard.writeText(rhymeText);
    } catch (clipboardError) {
      // Clipboard API may be unavailable (insecure context) — fall back to execCommand.
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

  rhymeSuggestionsList.addEventListener('click', (clickEvent) => {
    const listItemElement = clickEvent.target.closest('li');
    if (!listItemElement || !rhymeSuggestionsList.contains(listItemElement)) {
      return;
    }
    // Don't hijack an intentional text selection.
    const activeSelection = window.getSelection();
    if (activeSelection && !activeSelection.isCollapsed && selectionIntersectsElement(listItemElement)) {
      return;
    }
    copyRhymeSuggestion(listItemElement.dataset.word || listItemElement.textContent, listItemElement);
  });

  toggleListeningButton.addEventListener('click', () => {
    if (latestListeningStatus === 'listening' || latestListeningStatus === 'starting') {
      speechRecognitionController.stopListening();
      return;
    }

    speechRecognitionController.startListening();
  });

  const unsubscribe = speechRecognitionController.subscribe((speechRecognitionSnapshot) => {
    const speechRecognitionErrorMessages = {
      network: 'Erro de rede no reconhecimento de voz. Reconectando automaticamente. Se persistir, recarregue a página no Google Chrome e permita o microfone.',
      'not-allowed': 'Acesso ao microfone negado. Permita o microfone para este site nas configurações do navegador.',
      'service-not-allowed': 'O serviço de reconhecimento de voz foi bloqueado. Use o Google Chrome e permita o microfone.',
    };
    const isListening = speechRecognitionSnapshot.listeningStatus === 'listening' || speechRecognitionSnapshot.listeningStatus === 'starting';
    latestListeningStatus = speechRecognitionSnapshot.listeningStatus;
    setTextContentIfChanged(toggleListeningButtonLabel, isListening ? 'Parar' : 'Começar');
    setTextContentIfChanged(listenIcon, isListening ? '■' : '🎙');
    toggleListeningButton.classList.toggle('is-listening', isListening);
    setTextContentIfChanged(unsupportedBrowserMessage, speechRecognitionSnapshot.isSupported ? '' : 'Este navegador não suporta a Web Speech API. Use o Google Chrome.');
    setTextContentIfChanged(braveBrowserMessage, isGoogleChromeBrowser() ? '' : 'O reconhecimento de voz pode ficar instável neste navegador. Use o Google Chrome para a melhor experiência.');
    setTextContentIfChanged(speechRecognitionErrorMessage, speechRecognitionSnapshot.speechRecognitionError
      ? speechRecognitionErrorMessages[speechRecognitionSnapshot.speechRecognitionError] || `Erro no reconhecimento de voz: ${speechRecognitionSnapshot.speechRecognitionError}`
      : '');
    statusRow.hidden = !unsupportedBrowserMessage.textContent && !braveBrowserMessage.textContent && !speechRecognitionErrorMessage.textContent;
    microphoneLevelBar.style.width = `${speechRecognitionSnapshot.microphoneLevel}%`;
    setTextContentIfChanged(microphoneLabelValue, `Microfone: ${speechRecognitionSnapshot.microphoneLabel || 'nenhum ativo'}`);

    // Training stats + challenge update even while the user is selecting rhyme text.
    const training = speechRecognitionSnapshot.training || { score: 0, streak: 0, bestStreak: 0, lastResult: null };
    setTextContentIfChanged(trainingScoreValue, String(training.score));
    setTextContentIfChanged(trainingStreakValue, training.streak >= 2 ? `🔥 ${training.streak}` : String(training.streak));
    setTextContentIfChanged(trainingBestValue, String(training.bestStreak));
    setTextContentIfChanged(trainingFeedbackValue, trainingFeedbackMessage(training.lastResult));
    trainingFeedbackValue.dataset.tier = training.lastResult ? training.lastResult.tier : '';
    setTextContentIfChanged(challengeWordValue, speechRecognitionSnapshot.challengeWord || '—');

    if (isSelectingRhymeText) {
      return;
    }

    setTextContentIfChanged(interimTranscriptValue, speechRecognitionSnapshot.interimTranscript || '-');
    setTextContentIfChanged(lastRecognizedPhraseValue, speechRecognitionSnapshot.lastRecognizedPhrase || '-');
    renderRhymeSuggestionsIfChanged(rhymeSuggestionsList, speechRecognitionSnapshot.rhymeSuggestions);
    rhymeLanguageFilterOptions.forEach((rhymeLanguageFilterOption) => {
      rhymeLanguageFilterOption.classList.toggle('is-active', rhymeLanguageFilterOption.dataset.rhymeLanguageFilter === speechRecognitionSnapshot.rhymeLanguageFilter);
    });
    renderListItemsIfChanged(finalTranscriptHistory, speechRecognitionSnapshot.finalTranscriptSegments);
  });

  return () => {
    stopBeat();
    if (metronomeAudioContext) {
      metronomeAudioContext.close().catch(() => {});
      metronomeAudioContext = null;
    }
    rhymePanel.removeEventListener('pointerdown', startRhymeSelection);
    document.removeEventListener('selectionchange', updateRhymeSelectionState);
    document.removeEventListener('pointerup', finishRhymeSelection);
    unsubscribe();
    speechRecognitionController.dispose();
  };
}
