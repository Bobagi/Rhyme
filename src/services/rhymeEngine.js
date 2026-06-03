// rhymeEngine.js
// Phonetic-oriented rhyme suggestion engine.
//
// Unlike the previous "last 3-4 characters" comparison, this anchors a rhyme on
// the TONIC (stressed) vowel of the final word and everything after it — which
// is what actually defines a rhyme in Portuguese/Spanish ("coração" rhymes with
// "paixão" on the "ão" sound, regardless of the consonant before it).
//
// It supports WORDS and PHRASES (a phrase rhymes by its last word), ranks
// suggestions by usage frequency, works across pt/en/es, and caches the remote
// frequency lists in localStorage so it keeps working offline after first load.
//
// Frequency lists: hermitdave/FrequencyWords (OpenSubtitles). Code MIT, lists
// CC BY-SA 4.0 — see docs/frequency-words.md.

export const remoteRhymeWordListSources = {
  pt: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/pt_br/pt_br_50k.txt',
  en: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
  es: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/es/es_50k.txt',
};

// Curated Brazilian-Portuguese rhymes, including multi-word phrases. Phrases are
// matched by their last word, so they now appear as suggestions (previously the
// single-word filter silently dropped every phrase).
const curatedPortugueseRhymeCatalog = [
  'coração', 'canção', 'emoção', 'paixão', 'razão', 'direção', 'solidão', 'multidão', 'perdão',
  'na mesma direção', 'ouvindo uma canção', 'cheio de emoção',
  'noite', 'açoite', 'sorte', 'norte', 'forte', 'morte', 'porto', 'conforto',
  'amor', 'dor', 'flor', 'calor', 'valor', 'sabor', 'favor',
  'onde nasce o amor', 'com todo meu valor',
  'mar', 'rir', 'sorrir', 'partir', 'dormir', 'abrir', 'sentir', 'fugir',
  'olhar', 'cantar', 'sonhar', 'voar', 'ficar', 'andar', 'sem parar', 'pronto para sonhar',
  'canja', 'laranja', 'granja', 'franja', 'arranja', 'constranja', 'marmanja',
  'baixo', 'cacho', 'facho', 'acho', 'despacho',
  'vida', 'ferida', 'partida', 'saída', 'avenida', 'querida', 'minha querida', 'estrada da vida',
  'dia', 'guia', 'alegria', 'poesia', 'melodia', 'harmonia', 'fantasia', 'energia',
  'casa', 'asa', 'brasa', 'arrasa', 'praça', 'graça', 'massa', 'passa',
  'tempo', 'contratempo', 'vento', 'momento', 'sentimento', 'pensamento', 'talento',
  'luz', 'conduz', 'produz', 'traduz', 'feliz', 'raiz', 'juiz', 'matriz', 'país',
  'teste', 'agreste', 'veste', 'oeste', 'hoje', 'foge', 'longe',
  'liberdade', 'saudade', 'verdade', 'cidade', 'vontade',
  'beleza', 'certeza', 'natureza', 'tristeza', 'pureza',
  'gente', 'frente', 'mente', 'presente', 'semente', 'diferente',
  'antes', 'instantes', 'gigantes', 'distantes',
  'mundo', 'profundo', 'segundo', 'vagabundo', 'tudo', 'escudo', 'conteúdo', 'mudo',
  'medo', 'segredo', 'brinquedo', 'cedo', 'céu', 'véu', 'papel', 'anel', 'mel',
  'final', 'sinal', 'jornal', 'normal', 'também', 'além', 'ninguém', 'refém',
  'enfim', 'jardim', 'assim', 'mim', 'atum', 'jejum', 'comum', 'nenhum',
];

const ACCENTED_STRESS_VOWELS = 'áéíóúâêôà'; // acute/circumflex/grave mark the stressed syllable
const NASAL_STRESS_VOWELS = 'ãõ'; // tilde marks stress unless an acute/circumflex is present
const ANY_VOWEL = 'aeiouáéíóúâêôàãõü';

function toLowerCleanWord(rawWord) {
  return String(rawWord || '')
    .toLowerCase()
    .replace(/[^a-zàáâãéêíóôõúüçñ]/g, '');
}

function stripAccents(accentedText) {
  return accentedText.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function getVowelIndices(cleanWord) {
  const vowelIndices = [];
  for (let characterIndex = 0; characterIndex < cleanWord.length; characterIndex += 1) {
    if (ANY_VOWEL.includes(cleanWord[characterIndex])) {
      vowelIndices.push(characterIndex);
    }
  }
  return vowelIndices;
}

// Index of the stressed vowel, using graphic accents first and language-specific
// default-stress rules otherwise.
function findStressedVowelIndex(cleanWord, language) {
  for (let characterIndex = 0; characterIndex < cleanWord.length; characterIndex += 1) {
    if (ACCENTED_STRESS_VOWELS.includes(cleanWord[characterIndex])) {
      return characterIndex;
    }
  }
  for (let characterIndex = 0; characterIndex < cleanWord.length; characterIndex += 1) {
    if (NASAL_STRESS_VOWELS.includes(cleanWord[characterIndex])) {
      return characterIndex;
    }
  }

  const vowelIndices = getVowelIndices(cleanWord);
  if (vowelIndices.length === 0) {
    return -1;
  }
  if (vowelIndices.length === 1) {
    return vowelIndices[0];
  }

  const withoutTrailingS = cleanWord.replace(/s$/, '');
  const lastCharacter = withoutTrailingS[withoutTrailingS.length - 1] || '';

  let isOxytone;
  if (language === 'es') {
    // Spanish: words ending in a vowel, "n" or "s" are paroxytone (llanas).
    isOxytone = !/[aeiouns]/.test(lastCharacter);
  } else {
    // Portuguese: a/e/o (± plural s) and em/ens endings are paroxytone; the rest oxytone.
    if (/(em|ens)$/.test(cleanWord)) {
      isOxytone = false;
    } else if (/[aeo]/.test(lastCharacter)) {
      isOxytone = false;
    } else {
      isOxytone = true;
    }
  }

  return isOxytone ? vowelIndices[vowelIndices.length - 1] : vowelIndices[vowelIndices.length - 2];
}

// The rhyme key for a single word: the tonic rime — from the stressed vowel
// onward, accent-folded. This is what actually defines a rhyme ("coração" and
// "paixão" share "ao"). We intentionally do NOT add a final-vowel "slant" tier:
// matching on just the last vowel pulls in non-rhymes (every "-o" word), which
// is worse than returning fewer, correct rhymes.
export function computeRhymeKey(rawWord, language = 'pt') {
  const cleanWord = toLowerCleanWord(rawWord);
  if (cleanWord.length < 2) {
    return null;
  }

  if (language === 'en') {
    // English spelling does not map to sound reliably; fall back to a suffix key.
    return stripAccents(cleanWord).slice(-3);
  }

  const vowelIndices = getVowelIndices(cleanWord);
  if (vowelIndices.length === 0) {
    return null;
  }
  const lastVowelIndex = vowelIndices[vowelIndices.length - 1];
  let stressedVowelIndex = findStressedVowelIndex(cleanWord, language);
  if (stressedVowelIndex < 0) {
    stressedVowelIndex = lastVowelIndex;
  }

  let perfectKey = stripAccents(cleanWord.slice(stressedVowelIndex));
  if (perfectKey.length < 2 && stressedVowelIndex > 0) {
    perfectKey = stripAccents(cleanWord.slice(stressedVowelIndex - 1));
  }
  return perfectKey;
}

export function getLastWord(rawText) {
  const words = String(rawText || '').toLowerCase().split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || '';
  return toLowerCleanWord(lastWord);
}

function getCatalogEntryLastWord(catalogEntry) {
  const tokens = String(catalogEntry).toLowerCase().split(/\s+/).filter(Boolean);
  return toLowerCleanWord(tokens[tokens.length - 1] || '');
}

// ── frequency-list loading + caching ─────────────────────────────────────────

const CACHE_VERSION = 'v1';
const loadedWordListByLanguage = {};
const loadedIndexByLanguage = {};
let remoteLoadPromiseByLanguage = {};

function isAcceptableFrequencyWord(candidateWord) {
  const cleanWord = toLowerCleanWord(candidateWord);
  return cleanWord.length > 2 && candidateWord === candidateWord.toLowerCase() && !/[\s-]/.test(candidateWord);
}

function parseFrequencyWordList(frequencyListText) {
  return frequencyListText
    .split(/\r?\n/)
    .map((frequencyListLine) => frequencyListLine.trim().split(/\s+/)[0])
    .filter(Boolean)
    .filter(isAcceptableFrequencyWord);
}

function readCachedWordList(language) {
  try {
    const cachedValue = window.localStorage.getItem(`rhyme.freq.${CACHE_VERSION}.${language}`);
    return cachedValue ? cachedValue.split('\n') : null;
  } catch (storageReadError) {
    return null;
  }
}

function writeCachedWordList(language, words) {
  try {
    window.localStorage.setItem(`rhyme.freq.${CACHE_VERSION}.${language}`, words.join('\n'));
  } catch (storageWriteError) {
    // Quota or privacy mode — caching is best-effort.
  }
}

// Build { rhymeKey -> [words] } once per language, keeping the frequency order
// (most common words first) the source file already provides.
function buildLanguageIndex(language, words) {
  const rhymeKeyToWords = new Map();
  words.forEach((word) => {
    const rhymeKey = computeRhymeKey(word, language);
    if (!rhymeKey) {
      return;
    }
    if (!rhymeKeyToWords.has(rhymeKey)) {
      rhymeKeyToWords.set(rhymeKey, []);
    }
    rhymeKeyToWords.get(rhymeKey).push(word);
  });
  return { rhymeKeyToWords };
}

function ensureLanguageIndex(language) {
  if (!loadedIndexByLanguage[language] && loadedWordListByLanguage[language]) {
    loadedIndexByLanguage[language] = buildLanguageIndex(language, loadedWordListByLanguage[language]);
  }
  return loadedIndexByLanguage[language];
}

function ensureLanguageLoaded(language) {
  if (loadedWordListByLanguage[language]) {
    return Promise.resolve(loadedWordListByLanguage[language]);
  }
  if (remoteLoadPromiseByLanguage[language]) {
    return remoteLoadPromiseByLanguage[language];
  }

  const cachedWordList = readCachedWordList(language);
  if (cachedWordList && cachedWordList.length > 0) {
    loadedWordListByLanguage[language] = cachedWordList;
    return Promise.resolve(cachedWordList);
  }

  remoteLoadPromiseByLanguage[language] = fetch(remoteRhymeWordListSources[language])
    .then((frequencyListResponse) => frequencyListResponse.text())
    .then((frequencyListText) => {
      const words = parseFrequencyWordList(frequencyListText);
      loadedWordListByLanguage[language] = words;
      loadedIndexByLanguage[language] = null;
      writeCachedWordList(language, words);
      return words;
    })
    .catch(() => {
      loadedWordListByLanguage[language] = loadedWordListByLanguage[language] || [];
      return loadedWordListByLanguage[language];
    });

  return remoteLoadPromiseByLanguage[language];
}

function getLanguagesForFilter(languageFilter) {
  return languageFilter === 'all' ? ['pt', 'en', 'es'] : [languageFilter];
}

export function ensureCatalogsLoaded(languageFilter) {
  return Promise.all(getLanguagesForFilter(languageFilter).map(ensureLanguageLoaded));
}

// ── matching ─────────────────────────────────────────────────────────────────

const RHYME_SUGGESTION_LIMIT = 48;

function collectMatchesFromIndex(languageIndex, rhymeKey, spokenWord, matches, seenSuggestions) {
  if (!languageIndex || !rhymeKey) {
    return;
  }
  (languageIndex.rhymeKeyToWords.get(rhymeKey) || []).forEach((candidateWord) => {
    if (candidateWord !== spokenWord && !seenSuggestions.has(candidateWord)) {
      seenSuggestions.add(candidateWord);
      matches.push(candidateWord);
    }
  });
}

function collectCuratedMatches(spokenWord, matches, seenSuggestions) {
  const spokenKey = computeRhymeKey(spokenWord, 'pt');
  if (!spokenKey) {
    return;
  }
  curatedPortugueseRhymeCatalog.forEach((catalogEntry) => {
    const entryLastWord = getCatalogEntryLastWord(catalogEntry);
    const entryKey = computeRhymeKey(entryLastWord, 'pt');
    if (!entryKey || entryLastWord === spokenWord || seenSuggestions.has(catalogEntry)) {
      return;
    }
    if (entryKey === spokenKey) {
      seenSuggestions.add(catalogEntry);
      matches.push(catalogEntry);
    }
  });
}

// Instant, synchronous suggestions from the curated catalog only — shown while
// the remote frequency lists are still loading.
export function suggestRhymesFromCuratedCatalog(rawText, languageFilter) {
  if (languageFilter !== 'all' && languageFilter !== 'pt') {
    return [];
  }
  const spokenWord = getLastWord(rawText);
  if (!spokenWord) {
    return [];
  }
  const matches = [];
  collectCuratedMatches(spokenWord, matches, new Set());
  return matches.slice(0, RHYME_SUGGESTION_LIMIT);
}

// Full suggestions: curated catalog + frequency lists for the selected
// language(s), ranked by usage frequency (most common rhymes first).
export async function suggestRhymes(rawText, languageFilter) {
  const spokenWord = getLastWord(rawText);
  if (!spokenWord) {
    return [];
  }

  await ensureCatalogsLoaded(languageFilter);

  const matches = [];
  const seenSuggestions = new Set();

  collectCuratedMatches(spokenWord, matches, seenSuggestions);

  getLanguagesForFilter(languageFilter).forEach((language) => {
    const rhymeKey = computeRhymeKey(spokenWord, language);
    collectMatchesFromIndex(ensureLanguageIndex(language), rhymeKey, spokenWord, matches, seenSuggestions);
  });

  return matches.slice(0, RHYME_SUGGESTION_LIMIT);
}
