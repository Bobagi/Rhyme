// wordListRepository.js
// Loads and caches the frequency word lists that feed the rhyme indexes. Owns the
// remote sources, the network fetch, the localStorage cache and the in-memory
// memo — so the rhyme engine can stay a pure algorithm over an already-loaded
// list (separation of concerns / repository pattern).
//
// Source: hermitdave/FrequencyWords (OpenSubtitles). Code MIT, lists CC BY-SA 4.0
// — see docs/frequency-words.md.

export const remoteWordListSources = {
  pt: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/pt_br/pt_br_50k.txt',
  en: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
  es: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/es/es_50k.txt',
};

const CACHE_VERSION = 'v1';
const loadedWordListByLanguage = {};
const remoteLoadPromiseByLanguage = {};

export function isAcceptableFrequencyWord(candidateWord) {
  const cleanWord = String(candidateWord || '').toLowerCase().replace(/[^a-zàáâãéêíóôõúüçñ]/g, '');
  return cleanWord.length > 2 && candidateWord === candidateWord.toLowerCase() && !/[\s-]/.test(candidateWord);
}

export function parseFrequencyWordList(frequencyListText) {
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

// The in-memory list, or undefined if not loaded yet — lets the engine build its
// index synchronously once the list is available.
export function getLoadedWordList(language) {
  return loadedWordListByLanguage[language];
}

// Resolve the word list (memo → localStorage cache → network), de-duplicating
// concurrent requests for the same language. Never rejects (offline-friendly).
export function ensureWordListLoaded(language) {
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

  remoteLoadPromiseByLanguage[language] = fetch(remoteWordListSources[language])
    .then((frequencyListResponse) => frequencyListResponse.text())
    .then((frequencyListText) => {
      const words = parseFrequencyWordList(frequencyListText);
      loadedWordListByLanguage[language] = words;
      writeCachedWordList(language, words);
      return words;
    })
    .catch(() => {
      loadedWordListByLanguage[language] = loadedWordListByLanguage[language] || [];
      return loadedWordListByLanguage[language];
    });

  return remoteLoadPromiseByLanguage[language];
}
