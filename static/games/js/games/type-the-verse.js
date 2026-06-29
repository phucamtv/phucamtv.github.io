import { getHighScore, saveScore } from '../../shared/scoring.js';
import { playSound } from '../../shared/sound.js';
const versesData = window.GAME_DATA;

export function normalize(text) {
  return String(text).toLowerCase().trim().replace(/\s+/g, ' ');
}

export function blankOut(words) {
  const display = words.map((w, i) => (i > 0 && i % 2 === 1 ? null : w));
  const blanks = display.map((w, i) => (w === null ? i : -1)).filter((i) => i >= 0);
  return { display, blanks };
}

export function isCorrect(input, target) {
  return normalize(input) === normalize(target);
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
  const words = verse.words;

  if (difficulty === 'easy') return runWordByWord(container, verse, words);
  if (difficulty === 'normal') return runFillBlank(container, verse, words);
  return runFromMemory(container, verse, words);
}

function makeFinish() {
  let finished = false;
  return function finish(container, label, solved) {
    if (finished) return;
    finished = true;
    if (solved) saveScore('type-the-verse', 1);
    const best = getHighScore('type-the-verse');
    container.insertAdjacentHTML('beforeend', `
      <p class="ttv-result">${label} Best ever: ${best} verse(s) completed.</p>
    `);
    container.querySelectorAll('button, input, textarea').forEach((el) => (el.disabled = true));
  };
}

// ---- easy: word by word ----
function runWordByWord(container, verse, words) {
  const finish = makeFinish();
  let index = 0;

  function render() {
    container.innerHTML = `
      <h2>Type the Verse</h2>
      <p class="ttv-reference">${verse.reference}</p>
      <p class="ttv-prompt">Type this word: <strong>${words[index]}</strong></p>
      <p class="ttv-so-far"></p>
      <input type="text" class="ttv-input" autocomplete="off" autocapitalize="off" spellcheck="false" />
      <p class="ttv-status"></p>
    `;
    const input = container.querySelector('.ttv-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    container.querySelector('.ttv-status').textContent = `Word ${index + 1} of ${words.length}`;
  }

  function submit() {
    const input = container.querySelector('.ttv-input');
    const status = container.querySelector('.ttv-status');
    if (isCorrect(input.value, words[index])) {
      playSound('correct');
      index++;
      if (index >= words.length) {
        container.innerHTML = `
          <h2>Type the Verse</h2>
          <p class="ttv-reference">${verse.reference}</p>
          <p class="ttv-verse">${words.join(' ')}</p>
        `;
        finish(container, 'You typed the whole verse! ', true);
        return;
      }
      render();
      container.querySelector('.ttv-so-far').textContent = words.slice(0, index).join(' ');
    } else {
      playSound('wrong');
      const statusEl = container.querySelector('.ttv-status');
      statusEl.textContent = `Not quite — the word was "${words[index]}". Try again.`;
      input.value = '';
      input.focus();
    }
  }

  render();
  return function cleanup() { container.innerHTML = ''; };
}

// ---- normal: fill in the blank ----
function runFillBlank(container, verse, words) {
  const finish = makeFinish();
  const { display, blanks } = blankOut(words);
  const answers = blanks.map((i) => words[i]);

  container.innerHTML = `
    <h2>Type the Verse</h2>
    <p class="ttv-reference">${verse.reference}</p>
    <p class="ttv-verse">${
      display.map((w) => (w === null ? '_____' : w)).join(' ')
    }</p>
    <div class="ttv-blanks"></div>
    <button type="button" class="ttv-check">Check</button>
    <p class="ttv-status"></p>
  `;

  const blanksEl = container.querySelector('.ttv-blanks');
  blanks.forEach((i, n) => {
    const label = document.createElement('label');
    label.className = 'ttv-blank';
    label.textContent = `Blank ${n + 1}: `;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ttv-blank-input';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    label.appendChild(input);
    // correction hint shown next to the input (never mutates input.value)
    const hint = document.createElement('span');
    hint.className = 'ttv-hint';
    label.appendChild(hint);
    blanksEl.appendChild(label);
  });

  container.querySelector('.ttv-check').addEventListener('click', () => {
    const inputs = [...container.querySelectorAll('.ttv-blank-input')];
    const hints = [...container.querySelectorAll('.ttv-hint')];
    let correctCount = 0;
    inputs.forEach((input, n) => {
      const ok = isCorrect(input.value, answers[n]);
      input.classList.remove('correct', 'wrong');
      input.classList.add(ok ? 'correct' : 'wrong');
      if (ok) {
        correctCount++;
        hints[n].textContent = '';
      } else {
        hints[n].textContent = `→ ${answers[n]}`;
      }
    });
    playSound(correctCount === inputs.length ? 'correct' : 'wrong');
    const status = container.querySelector('.ttv-status');
    const allCorrect = correctCount === inputs.length;
    if (allCorrect) {
      status.textContent = `All ${inputs.length} blanks correct!`;
      finish(container, '', true);
    } else {
      status.textContent = `${correctCount} of ${inputs.length} correct — hints shown. Fix and press Check again.`;
    }
  });

  return function cleanup() { container.innerHTML = ''; };
}

// ---- hard: from memory ----
function runFromMemory(container, verse, words) {
  const finish = makeFinish();
  container.innerHTML = `
    <h2>Type the Verse</h2>
    <p class="ttv-reference">Type from memory: ${verse.reference}</p>
    <textarea class="ttv-memory" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <button type="button" class="ttv-check">Check</button>
    <button type="button" class="ttv-reveal">Reveal answer</button>
    <p class="ttv-status"></p>
  `;

  const check = () => {
    const text = container.querySelector('.ttv-memory').value;
    const target = words.join(' ');
    const status = container.querySelector('.ttv-status');
    if (isCorrect(text, target)) {
      playSound('correct');
      status.textContent = 'Correct — word for word!';
      finish(container, '', true);
    } else {
      playSound('wrong');
      status.textContent = 'Not a match. Edit and Check again, or Reveal.';
    }
  };

  container.querySelector('.ttv-check').addEventListener('click', check);
  container.querySelector('.ttv-reveal').addEventListener('click', () => {
    container.querySelector('.ttv-memory').value = words.join(' ');
    container.querySelector('.ttv-status').textContent = 'Answer revealed — no score this time.';
    playSound('wrong');
    finish(container, '', false);
  });

  return function cleanup() { container.innerHTML = ''; };
}
