export const speechLanguages = {
  brazilianPortuguese: { label: 'Brazilian Portuguese', locale: 'pt-BR', enabled: true },
  englishUnitedStates: { label: 'English', locale: 'en-US', enabled: true },
  spanishSpain: { label: 'Spanish', locale: 'es-ES', enabled: true },
};

export const defaultSpeechLanguage = speechLanguages.brazilianPortuguese;

// Maps a rhyme-language filter ('all' | 'pt' | 'en' | 'es') to the speech
// recognition locale to transcribe in. 'all' keeps the default locale so the
// microphone language does not change while browsing rhymes across languages.
const recognitionLocaleByFilter = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

export function recognitionLocaleForRhymeFilter(rhymeLanguageFilter) {
  return recognitionLocaleByFilter[rhymeLanguageFilter] || null;
}
