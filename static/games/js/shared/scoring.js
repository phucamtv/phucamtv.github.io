import { getItem, setItem } from './storage.js';

function key(gameId) {
  return `bq:${gameId}:highscore`;
}

export function getHighScore(gameId) {
  return getItem(key(gameId), 0);
}

export function saveScore(gameId, score) {
  const current = getHighScore(gameId);
  if (score > current) {
    setItem(key(gameId), score);
  }
}

// Signal the page shell that the round is over (used to drop the leave-confirm).
export function signalFinished(container) {
  container.dispatchEvent(new CustomEvent('game:finished', { bubbles: true }));
}
