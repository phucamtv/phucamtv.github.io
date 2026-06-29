import { getHighScore, saveScore } from '../../shared/scoring.js';
import { playSound } from '../../shared/sound.js';
const versesData = window.GAME_DATA;

export function shuffle(words) {
  const out = words.slice();
  if (out.length <= 1) return out;
  // Fisher-Yates, re-rolling until the order actually changes.
  do {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  } while (JSON.stringify(out) === JSON.stringify(words));
  return out;
}

export function isSolved(placed, correct) {
  if (placed.length !== correct.length) return false;
  return placed.every((w, i) => w !== null && w === correct[i]);
}

export function pickVerse(verses, difficulty) {
  const matching = verses.filter((v) => v.difficulty === difficulty);
  if (matching.length === 0) {
    throw new Error(`No verse for difficulty: ${difficulty}`);
  }
  return matching[Math.floor(Math.random() * matching.length)];
}

export function init(container, difficulty) {
  const verse = pickVerse(versesData, difficulty);
  const correct = verse.words;
  const hard = difficulty === 'hard';
  const TIME_LIMIT_MS = 90000;
  let timerHandle = null;
  let finished = false;

  // placed[i] is the word in slot i, or null when empty.
  const placed = correct.map(() => null);
  // pool is the set of words not yet placed (with their pool-button index).
  let pool = shuffle(correct);

  render();

  function render() {
    container.innerHTML = `
      <h2>Scripture Scramble</h2>
      <p class="ss-reference">${verse.reference}</p>
      <div class="ss-timer" style="${hard ? '' : 'display:none'}">Time left: <span>${TIME_LIMIT_MS / 1000}</span>s</div>
      <div class="ss-slots"></div>
      <p class="ss-status"></p>
      <div class="ss-pool"></div>
      <button type="button" class="ss-reveal">Reveal answer</button>
    `;

    const slotsEl = container.querySelector('.ss-slots');
    placed.forEach((word, i) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'ss-slot' + (word ? ' filled' : '');
      slot.dataset.index = String(i);
      slot.textContent = word !== null ? word : ' '; // nbsp keeps empty slots sized
      slot.addEventListener('click', () => removeFromSlot(i));
      slotsEl.appendChild(slot);
    });

    const poolEl = container.querySelector('.ss-pool');
    pool.forEach((word, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ss-word';
      btn.dataset.poolIndex = String(idx);
      btn.textContent = word;
      btn.addEventListener('click', () => placeWord(idx));
      poolEl.appendChild(btn);
    });

    container.querySelector('.ss-reveal').addEventListener('click', reveal);

    if (hard) startTimer();
  }

  function startTimer() {
    if (finished) return;
    let remaining = TIME_LIMIT_MS;
    const span = container.querySelector('.ss-timer span');
    timerHandle = setInterval(() => {
      remaining -= 1000;
      if (span) span.textContent = String(Math.max(0, remaining / 1000));
      if (remaining <= 0) {
        clearInterval(timerHandle);
        timeUp();
      }
    }, 1000);
  }

  function placeWord(poolIndex) {
    const word = pool[poolIndex];
    const emptyIndex = placed.indexOf(null);
    if (emptyIndex === -1) return; // no empty slot
    placed[emptyIndex] = word;
    pool = pool.filter((_, i) => i !== poolIndex);
    playSound('correct');
    render();
    if (pool.length === 0) checkSolution(false);
  }

  function removeFromSlot(slotIndex) {
    const word = placed[slotIndex];
    if (word === null) return;
    placed[slotIndex] = null;
    pool = [...pool, word];
    render();
  }

  function checkSolution(wasReveal) {
    if (isSolved(placed, correct)) {
      if (timerHandle) clearInterval(timerHandle);
      const status = container.querySelector('.ss-status');
      status.textContent = wasReveal ? 'Revealed — no score this time.' : 'Solved! Well done.';
      playSound('correct');
      if (!wasReveal) saveScore('scripture-scramble', 1);
      finish();
    } else if (pool.length === 0) {
      // all slots filled but wrong: mark wrong slots, let player fix
      markWrongSlots();
      playSound('wrong');
      const status = container.querySelector('.ss-status');
      status.textContent = 'Not quite — tap a red word to put it back and try again.';
    }
  }

  function markWrongSlots() {
    const slots = container.querySelectorAll('.ss-slot');
    correct.forEach((w, i) => {
      if (placed[i] !== w) slots[i].classList.add('wrong');
    });
  }

  function timeUp() {
    const status = container.querySelector('.ss-status');
    status.textContent = "Time's up!";
    reveal();
  }

  function reveal() {
    finished = true;
    if (timerHandle) clearInterval(timerHandle);
    // fill correct answers into all slots
    for (let i = 0; i < correct.length; i++) placed[i] = correct[i];
    pool = [];
    render();
    checkSolution(true);
  }

  function finish() {
    const best = getHighScore('scripture-scramble');
    const status = container.querySelector('.ss-status');
    status.textContent += ` Best ever: ${best} verse(s) solved.`;
    // lock interaction
    container.querySelectorAll('button').forEach((b) => (b.disabled = true));
  }

  return function cleanup() {
    if (timerHandle) clearInterval(timerHandle);
    container.innerHTML = '';
  };
}
