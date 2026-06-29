import { getHighScore, saveScore } from '../shared/scoring.js';
import { playSound } from '../shared/sound.js';
const parablesData = window.GAME_DATA;

export function pickParables(parables, difficulty) {
  const target = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 5 : 7;
  const n = Math.min(target, parables.length);
  const shuffled = parables.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

export function pairsMatch(parable, meaning) {
  return parable.meaning === meaning;
}

export function countCorrect(parables, attempts) {
  const byId = new Map(parables.map((p) => [p.id, p]));
  const counted = new Set();
  let correct = 0;
  for (const a of attempts) {
    if (counted.has(a.parableId)) continue;
    const p = byId.get(a.parableId);
    if (p && p.meaning === a.meaning) {
      correct++;
      counted.add(a.parableId);
    }
  }
  return correct;
}

export function init(container, difficulty) {
  const parables = pickParables(parablesData, difficulty);
  let selectedParable = null;       // the parable card element currently selected
  let matchedCount = 0;
  let wrongAttempts = 0;
  let finished = false;

  render();

  function render() {
    const shuffledMeanings = parables.slice();
    for (let i = shuffledMeanings.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledMeanings[i], shuffledMeanings[j]] = [shuffledMeanings[j], shuffledMeanings[i]];
    }

    container.innerHTML = `
      <h2>Parable Pairs</h2>
      <p class="pp-status">Tap a parable, then tap its meaning.</p>
      <div class="pp-board">
        <div class="pp-parables"></div>
        <div class="pp-meanings"></div>
      </div>
    `;

    const parablesEl = container.querySelector('.pp-parables');
    parables.forEach((p) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pp-parable';
      card.dataset.id = p.id;
      card.dataset.meaning = p.meaning; // used by the test to locate the match
      card.textContent = p.title;
      card.addEventListener('click', () => selectParable(card, p));
      parablesEl.appendChild(card);
    });

    const meaningsEl = container.querySelector('.pp-meanings');
    shuffledMeanings.forEach((p) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pp-meaning';
      card.dataset.meaning = p.meaning;
      card.textContent = p.meaning;
      card.addEventListener('click', () => selectMeaning(card, p));
      meaningsEl.appendChild(card);
    });
  }

  function selectParable(card, parable) {
    if (card.classList.contains('matched')) return;
    if (selectedParable === card) {
      card.classList.remove('selected');
      selectedParable = null;
      return;
    }
    if (selectedParable) selectedParable.classList.remove('selected');
    selectedParable = card;
    card.classList.add('selected');
  }

  function selectMeaning(card, parable) {
    if (card.classList.contains('matched')) return;
    if (!selectedParable) return; // must pick a parable first
    if (pairsMatch(parableOf(selectedParable), parable.meaning)) {
      selectedParable.classList.remove('selected');
      selectedParable.classList.add('matched');
      card.classList.add('matched');
      selectedParable = null;
      matchedCount++;
      playSound('correct');
      if (matchedCount === parables.length) finish();
    } else {
      wrongAttempts++;
      card.classList.add('shake');
      playSound('wrong');
      selectedParable.classList.remove('selected');
      selectedParable = null;
      const status = container.querySelector('.pp-status');
      status.textContent = 'Not a match — try again.';
      setTimeout(() => card.classList.remove('shake'), 300);
    }
  }

  function parableOf(card) {
    return parables.find((p) => p.id === card.dataset.id);
  }

  function finish() {
    if (finished) return;
    finished = true;
    const score = Math.max(0, parables.length - wrongAttempts);
    saveScore('parable-pairs', score);
    const best = getHighScore('parable-pairs');
    const status = container.querySelector('.pp-status');
    const perfect = wrongAttempts === 0;
    status.textContent = perfect
      ? `Perfect! All ${parables.length} matched with no misses. Best: ${best}.`
      : `All matched with ${wrongAttempts} miss(es). Score: ${score}. Best: ${best}.`;
    container.querySelectorAll('button').forEach((b) => (b.disabled = true));
  }

  return function cleanup() { container.innerHTML = ''; };
}
