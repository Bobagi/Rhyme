// trainingScorer.js
// Pure freestyle scoring. Grades each finalized bar against the previous one and
// against an optional challenge word, accumulating points / streak / best. No DOM,
// no timers, no mutation of inputs — state in, new state out — so it is trivially
// unit-testable and decoupled from how the app captures speech or renders.

import { classifyRhyme } from './rhymeEngine.js';

export const RHYME_POINTS = { perfect: 3, slant: 2, toante: 1 };
export const CHALLENGE_BONUS = 2;

export function createInitialTrainingState() {
  return { score: 0, streak: 0, bestStreak: 0, totalLines: 0, rhymedLines: 0, lastResult: null };
}

// Returns { training, previousLineWord, challengeHit }. `training` is a new object
// (the input is never mutated). `previousLineWord` is what the next call should pass.
export function scoreLine({ lineWord, previousLineWord, challengeWord, training, language = 'pt' }) {
  const nextTraining = { ...training };
  let lastResult;

  if (previousLineWord) {
    const tier = classifyRhyme(lineWord, previousLineWord, language);
    const points = RHYME_POINTS[tier] || 0;
    if (points > 0) {
      nextTraining.score += points;
      nextTraining.streak += 1;
      nextTraining.rhymedLines += 1;
      nextTraining.bestStreak = Math.max(nextTraining.bestStreak, nextTraining.streak);
    } else if (tier !== 'same') {
      // A clear non-rhyme breaks the streak; repeating the same word is neutral.
      nextTraining.streak = 0;
    }
    nextTraining.totalLines += 1;
    lastResult = { tier: tier || 'none', points, word: lineWord, rhymedWith: previousLineWord, challengeHit: false };
  } else {
    lastResult = { tier: 'start', points: 0, word: lineWord, rhymedWith: '', challengeHit: false };
  }

  let challengeHit = false;
  if (challengeWord) {
    const challengeTier = classifyRhyme(lineWord, challengeWord, language);
    if (challengeTier && challengeTier !== 'same') {
      challengeHit = true;
      nextTraining.score += CHALLENGE_BONUS;
      lastResult.challengeHit = true;
    }
  }

  nextTraining.lastResult = lastResult;
  return { training: nextTraining, previousLineWord: lineWord, challengeHit };
}
