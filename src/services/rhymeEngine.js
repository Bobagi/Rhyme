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

import { ensureWordListLoaded, getLoadedWordList } from './wordListRepository.js';

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

// The tonic vowel skeleton: the vowels from the stressed vowel onward,
// accent-folded ("fácil" -> "ai", "rápido" -> "aio"). Two words sharing it are
// assonant ("toante") rhymes — the backbone of freestyle rhyming and the
// graceful fallback for words with no/few perfect rhymes (most proparoxytones).
// pt/es only; English spelling doesn't map to sound reliably.
function computeTonicSkeleton(rawWord, language) {
  const cleanWord = toLowerCleanWord(rawWord);
  if (cleanWord.length < 2) {
    return null;
  }
  const vowelIndices = getVowelIndices(cleanWord);
  if (vowelIndices.length === 0) {
    return null;
  }
  let stressedVowelIndex = findStressedVowelIndex(cleanWord, language);
  if (stressedVowelIndex < 0) {
    stressedVowelIndex = vowelIndices[vowelIndices.length - 1];
  }
  const accentFoldedWord = stripAccents(cleanWord);
  let tonicSkeleton = '';
  for (let characterIndex = stressedVowelIndex; characterIndex < accentFoldedWord.length; characterIndex += 1) {
    if ('aeiou'.includes(accentFoldedWord[characterIndex])) {
      tonicSkeleton += accentFoldedWord[characterIndex];
    }
  }
  return tonicSkeleton || null;
}

// The word's final two letters (accent-folded) — keeps the first fallback tier
// tight: same tonic skeleton AND same ending ("fácil"/"ágil" share "ai" + "il").
function computeWordEnding(rawWord) {
  return stripAccents(toLowerCleanWord(rawWord)).slice(-2);
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

// ── rhyme indexes (built from the repository's loaded word lists) ─────────────

const loadedIndexByLanguage = {};

function pushIntoKeyedWordList(keyedWordList, key, word) {
  if (!key) {
    return;
  }
  if (!keyedWordList.has(key)) {
    keyedWordList.set(key, []);
  }
  keyedWordList.get(key).push(word);
}

// Build the per-language rhyme indexes once, keeping the frequency order (most
// common words first) the source file already provides. Three tiers:
//   rhymeKeyToWords      — perfect rhyme (tonic rime from the stressed vowel)
//   assonantKeyToWords   — tonic skeleton + same ending (tight slant rhyme)
//   tonicSkeletonToWords — tonic skeleton only (assonant / "toante")
function buildLanguageIndex(language, words) {
  const rhymeKeyToWords = new Map();
  const assonantKeyToWords = new Map();
  const tonicSkeletonToWords = new Map();
  // Assonant tiers are phonetics-based and only reliable for Romance spelling.
  const buildsAssonantTiers = language === 'pt' || language === 'es';

  words.forEach((word) => {
    pushIntoKeyedWordList(rhymeKeyToWords, computeRhymeKey(word, language), word);
    if (!buildsAssonantTiers) {
      return;
    }
    const tonicSkeleton = computeTonicSkeleton(word, language);
    if (!tonicSkeleton || tonicSkeleton.length < 2) {
      return;
    }
    pushIntoKeyedWordList(assonantKeyToWords, `${tonicSkeleton}|${computeWordEnding(word)}`, word);
    pushIntoKeyedWordList(tonicSkeletonToWords, tonicSkeleton, word);
  });

  return { rhymeKeyToWords, assonantKeyToWords, tonicSkeletonToWords };
}

function ensureLanguageIndex(language) {
  const loadedWordList = getLoadedWordList(language);
  if (!loadedIndexByLanguage[language] && loadedWordList) {
    loadedIndexByLanguage[language] = buildLanguageIndex(language, loadedWordList);
  }
  return loadedIndexByLanguage[language];
}

function getLanguagesForFilter(languageFilter) {
  return languageFilter === 'all' ? ['pt', 'en', 'es'] : [languageFilter];
}

export function ensureCatalogsLoaded(languageFilter) {
  return Promise.all(getLanguagesForFilter(languageFilter).map(ensureWordListLoaded));
}

// ── matching ─────────────────────────────────────────────────────────────────

const RHYME_SUGGESTION_LIMIT = 48;
// When the perfect-rhyme tier yields fewer than this, progressively fall back to
// slant and then "toante" rhymes so the panel is never empty mid-freestyle.
// Words with many perfect rhymes never reach the fallback (stay perfect-only).
const RHYME_FALLBACK_TARGET = 14;

function collectMatchesFromMap(wordsByKey, key, spokenWord, matches, seenSuggestions, tier) {
  if (!wordsByKey || !key) {
    return;
  }
  (wordsByKey.get(key) || []).forEach((candidateWord) => {
    if (candidateWord !== spokenWord && !seenSuggestions.has(candidateWord)) {
      seenSuggestions.add(candidateWord);
      matches.push({ text: candidateWord, tier });
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
      matches.push({ text: catalogEntry, tier: 'perfect' });
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
  const languages = getLanguagesForFilter(languageFilter);

  // Tier 1 — perfect rhymes: curated phrases first, then the frequency lists.
  collectCuratedMatches(spokenWord, matches, seenSuggestions);
  languages.forEach((language) => {
    const languageIndex = ensureLanguageIndex(language);
    collectMatchesFromMap(
      languageIndex && languageIndex.rhymeKeyToWords,
      computeRhymeKey(spokenWord, language),
      spokenWord, matches, seenSuggestions, 'perfect',
    );
  });

  // Fallbacks — only when perfect rhymes are scarce, so common words keep their
  // clean perfect-only list while hard words ("fácil", "rápido", proparoxytones)
  // still get usable suggestions. Tier 2: same tonic skeleton + same ending
  // (tight slant). Tier 3: same tonic skeleton only (assonant / "toante").
  const collectFallbackTier = (pickKeyedWordList, buildKey, tier) => {
    languages.forEach((language) => {
      const languageIndex = ensureLanguageIndex(language);
      const tonicSkeleton = computeTonicSkeleton(spokenWord, language);
      if (!languageIndex || !tonicSkeleton || tonicSkeleton.length < 2) {
        return;
      }
      collectMatchesFromMap(pickKeyedWordList(languageIndex), buildKey(tonicSkeleton), spokenWord, matches, seenSuggestions, tier);
    });
  };

  if (matches.length < RHYME_FALLBACK_TARGET) {
    collectFallbackTier(
      (languageIndex) => languageIndex.assonantKeyToWords,
      (tonicSkeleton) => `${tonicSkeleton}|${computeWordEnding(spokenWord)}`,
      'slant',
    );
  }
  if (matches.length < RHYME_FALLBACK_TARGET) {
    collectFallbackTier(
      (languageIndex) => languageIndex.tonicSkeletonToWords,
      (tonicSkeleton) => tonicSkeleton,
      'toante',
    );
  }

  return matches.slice(0, RHYME_SUGGESTION_LIMIT);
}

// ── training: rhyme classification + challenge words ──────────────────────────

// Grade how two lines rhyme, by their last word: 'perfect' | 'slant' | 'toante'
// | 'same' (identical word, not a real rhyme) | null (no rhyme). Powers the
// freestyle scorer (consecutive bars) and the challenge-word check.
export function classifyRhyme(rawA, rawB, language = 'pt') {
  const wordA = getLastWord(rawA);
  const wordB = getLastWord(rawB);
  if (wordA.length < 2 || wordB.length < 2) {
    return null;
  }
  if (wordA === wordB) {
    return 'same';
  }
  const keyA = computeRhymeKey(wordA, language);
  const keyB = computeRhymeKey(wordB, language);
  if (keyA && keyB && keyA === keyB) {
    return 'perfect';
  }
  const skeletonA = computeTonicSkeleton(wordA, language);
  const skeletonB = computeTonicSkeleton(wordB, language);
  if (skeletonA && skeletonB && skeletonA.length >= 2 && skeletonA === skeletonB) {
    return computeWordEnding(wordA) === computeWordEnding(wordB) ? 'slant' : 'toante';
  }
  return null;
}

// Single, reliably-rhymable pt words to use as practice prompts.
const challengeWordPool = curatedPortugueseRhymeCatalog.filter((entry) => !/\s/.test(entry));

export function pickChallengeWord(previousWord) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = challengeWordPool[Math.floor(Math.random() * challengeWordPool.length)];
    if (candidate && candidate !== previousWord) {
      return candidate;
    }
  }
  return challengeWordPool[0] || 'amor';
}
