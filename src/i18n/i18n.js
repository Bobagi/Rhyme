// i18n.js
// Tiny dependency-free internationalization layer for the UI text. Keeps every
// user-facing string in one place (translation catalogs), detects the visitor's
// language from the browser, persists their manual choice, and exposes a single
// translate(key, language) lookup. The rhyme/transcription language is a separate
// concern handled by the speech-recognition controller.

export const SUPPORTED_UI_LANGUAGES = ['pt', 'en', 'es'];
export const DEFAULT_UI_LANGUAGE = 'pt';

const UI_LANGUAGE_STORAGE_KEY = 'rhyme.uiLanguage';

// BCP-47 tags for <html lang="…"> per UI language.
export const documentLanguageTag = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

export const uiTranslations = {
  pt: {
    'hero.eyebrow': 'Estúdio de freestyle ao vivo',
    'hero.intro': 'Capture seu freestyle em tempo real, veja a última frase e clique em qualquer rima para copiá-la — sem parar o microfone.',
    'badge.realtime': '🎙️ Tempo real',
    'badge.free': '🆓 Grátis',
    'badge.browser': '🌐 No navegador',
    'controls.start': 'Começar',
    'controls.stop': 'Parar',
    'mic.none': 'nenhum ativo',
    'mic.requesting': 'Pedindo acesso ao microfone...',
    'mic.default': 'microfone padrão',
    'mic.prefix': 'Microfone',
    'siteLanguage.label': 'Idioma do site',
    'training.title': 'Treino',
    'training.reset': 'Zerar',
    'training.points': 'Pontos',
    'training.streak': 'Sequência',
    'training.best': 'Recorde',
    'training.challengeLabel': 'Palavra-desafio',
    'training.newChallenge': 'Nova',
    'training.beatLabel': 'Beat — treine no tempo',
    'beat.play': '▶ Play',
    'beat.stop': '⏸ Parar',
    'panel.micLevel': 'Nível do microfone',
    'panel.interim': 'Transcrição ao vivo',
    'panel.rhymes': 'Rimas da última frase',
    'panel.rhymeLanguage': 'Rimas em',
    'filter.all': 'Todas',
    'panel.history': 'Histórico',
    'badge.slant': 'aprox.',
    'badge.toante': 'toante',
    'feedback.default': 'Fale duas frases que rimem pra pontuar.',
    'feedback.perfect': 'Rima perfeita!',
    'feedback.slant': 'Rima aproximada!',
    'feedback.toante': 'Rima toante!',
    'feedback.same': 'Repetiu a palavra — vale zero.',
    'feedback.none': 'Sem rima dessa vez.',
    'feedback.start': 'Primeira linha — manda a próxima pra rimar.',
    'feedback.challenge': '🎯 desafio! +2',
    'warning.unsupported': 'Este navegador não suporta a Web Speech API. Use o Google Chrome.',
    'warning.brave': 'O reconhecimento de voz pode ficar instável neste navegador. Use o Google Chrome para a melhor experiência.',
    'error.network': 'Erro de rede no reconhecimento de voz. Reconectando automaticamente. Se persistir, recarregue a página no Google Chrome e permita o microfone.',
    'error.notAllowed': 'Acesso ao microfone negado. Permita o microfone para este site nas configurações do navegador.',
    'error.serviceNotAllowed': 'O serviço de reconhecimento de voz foi bloqueado. Use o Google Chrome e permita o microfone.',
    'error.prefix': 'Erro no reconhecimento de voz',
    'copy.done': 'Copiado!',
    'footer.made': 'Rhyme — treinador de rima & freestyle · feito por',
    'footer.github': 'Código no GitHub ↗',
  },
  en: {
    'hero.eyebrow': 'Live freestyle studio',
    'hero.intro': 'Capture your freestyle in real time, see the last line and click any rhyme to copy it — without stopping the mic.',
    'badge.realtime': '🎙️ Real time',
    'badge.free': '🆓 Free',
    'badge.browser': '🌐 In the browser',
    'controls.start': 'Start',
    'controls.stop': 'Stop',
    'mic.none': 'none active',
    'mic.requesting': 'Requesting microphone access...',
    'mic.default': 'default microphone',
    'mic.prefix': 'Mic',
    'siteLanguage.label': 'Site language',
    'training.title': 'Training',
    'training.reset': 'Reset',
    'training.points': 'Points',
    'training.streak': 'Streak',
    'training.best': 'Best',
    'training.challengeLabel': 'Challenge word',
    'training.newChallenge': 'New',
    'training.beatLabel': 'Beat — train on tempo',
    'beat.play': '▶ Play',
    'beat.stop': '⏸ Stop',
    'panel.micLevel': 'Microphone level',
    'panel.interim': 'Live transcript',
    'panel.rhymes': 'Rhymes for the last line',
    'panel.rhymeLanguage': 'Rhymes in',
    'filter.all': 'All',
    'panel.history': 'History',
    'badge.slant': 'near',
    'badge.toante': 'assonant',
    'feedback.default': 'Say two rhyming lines to score.',
    'feedback.perfect': 'Perfect rhyme!',
    'feedback.slant': 'Slant rhyme!',
    'feedback.toante': 'Assonant rhyme!',
    'feedback.same': 'You repeated the word — no points.',
    'feedback.none': 'No rhyme this time.',
    'feedback.start': 'First line — drop the next one to rhyme.',
    'feedback.challenge': '🎯 challenge! +2',
    'warning.unsupported': 'This browser does not support the Web Speech API. Use Google Chrome.',
    'warning.brave': 'Speech recognition may be unstable in this browser. Use Google Chrome for the best experience.',
    'error.network': 'Speech recognition network error. Reconnecting automatically. If it persists, reload the page in Google Chrome and allow the microphone.',
    'error.notAllowed': 'Microphone access denied. Allow the microphone for this site in your browser settings.',
    'error.serviceNotAllowed': 'The speech recognition service was blocked. Use Google Chrome and allow the microphone.',
    'error.prefix': 'Speech recognition error',
    'copy.done': 'Copied!',
    'footer.made': 'Rhyme — rhyme & freestyle trainer · by',
    'footer.github': 'Code on GitHub ↗',
  },
  es: {
    'hero.eyebrow': 'Estudio de freestyle en vivo',
    'hero.intro': 'Captura tu freestyle en tiempo real, mira la última frase y haz clic en cualquier rima para copiarla — sin parar el micrófono.',
    'badge.realtime': '🎙️ Tiempo real',
    'badge.free': '🆓 Gratis',
    'badge.browser': '🌐 En el navegador',
    'controls.start': 'Empezar',
    'controls.stop': 'Parar',
    'mic.none': 'ninguno activo',
    'mic.requesting': 'Solicitando acceso al micrófono...',
    'mic.default': 'micrófono predeterminado',
    'mic.prefix': 'Micrófono',
    'siteLanguage.label': 'Idioma del sitio',
    'training.title': 'Entrenamiento',
    'training.reset': 'Reiniciar',
    'training.points': 'Puntos',
    'training.streak': 'Racha',
    'training.best': 'Récord',
    'training.challengeLabel': 'Palabra reto',
    'training.newChallenge': 'Nueva',
    'training.beatLabel': 'Beat — entrena a tempo',
    'beat.play': '▶ Play',
    'beat.stop': '⏸ Parar',
    'panel.micLevel': 'Nivel del micrófono',
    'panel.interim': 'Transcripción en vivo',
    'panel.rhymes': 'Rimas de la última frase',
    'panel.rhymeLanguage': 'Rimas en',
    'filter.all': 'Todas',
    'panel.history': 'Historial',
    'badge.slant': 'aprox.',
    'badge.toante': 'asonante',
    'feedback.default': 'Di dos frases que rimen para puntuar.',
    'feedback.perfect': '¡Rima perfecta!',
    'feedback.slant': '¡Rima aproximada!',
    'feedback.toante': '¡Rima asonante!',
    'feedback.same': 'Repetiste la palabra — no puntúa.',
    'feedback.none': 'Sin rima esta vez.',
    'feedback.start': 'Primera línea — suelta la siguiente para rimar.',
    'feedback.challenge': '🎯 ¡reto! +2',
    'warning.unsupported': 'Este navegador no soporta la Web Speech API. Usa Google Chrome.',
    'warning.brave': 'El reconocimiento de voz puede ser inestable en este navegador. Usa Google Chrome para la mejor experiencia.',
    'error.network': 'Error de red en el reconocimiento de voz. Reconectando automáticamente. Si persiste, recarga la página en Google Chrome y permite el micrófono.',
    'error.notAllowed': 'Acceso al micrófono denegado. Permite el micrófono para este sitio en la configuración del navegador.',
    'error.serviceNotAllowed': 'El servicio de reconocimiento de voz fue bloqueado. Usa Google Chrome y permite el micrófono.',
    'error.prefix': 'Error de reconocimiento de voz',
    'copy.done': '¡Copiado!',
    'footer.made': 'Rhyme — entrenador de rima y freestyle · por',
    'footer.github': 'Código en GitHub ↗',
  },
};

function normalizeLanguageTag(languageTag) {
  return String(languageTag || '').toLowerCase().split('-')[0];
}

// First supported language among the browser's preferences, else the default.
export function detectBrowserLanguage() {
  const preferredTags = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language];
  for (const languageTag of preferredTags) {
    const baseLanguage = normalizeLanguageTag(languageTag);
    if (SUPPORTED_UI_LANGUAGES.includes(baseLanguage)) {
      return baseLanguage;
    }
  }
  return DEFAULT_UI_LANGUAGE;
}

export function readStoredUiLanguage() {
  try {
    const storedLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    return SUPPORTED_UI_LANGUAGES.includes(storedLanguage) ? storedLanguage : null;
  } catch (storageReadError) {
    return null;
  }
}

export function storeUiLanguage(language) {
  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  } catch (storageWriteError) {
    // Private mode / quota — persistence is best-effort.
  }
}

// A stored manual choice wins; otherwise auto-detect from the browser.
export function resolveInitialUiLanguage() {
  return readStoredUiLanguage() || detectBrowserLanguage();
}

export function translate(key, language) {
  const catalog = uiTranslations[language] || uiTranslations[DEFAULT_UI_LANGUAGE];
  return catalog[key] || uiTranslations[DEFAULT_UI_LANGUAGE][key] || key;
}
