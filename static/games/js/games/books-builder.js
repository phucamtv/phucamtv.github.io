import { getHighScore, saveScore, signalFinished } from '../shared/scoring.js';
import { playSound } from '../shared/sound.js';
const booksData = window.GAME_DATA;

export function pickBooks(books, difficulty) {
  const t = difficulty === 'easy' ? 'OT' : difficulty === 'normal' ? 'NT' : null;
  const filtered = t ? books.filter((b) => b.testament === t) : books.slice();
  return filtered.sort((a, b) => a.order - b.order);
}

export function scorePlacement(correctOrder, placed) {
  let score = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    if (placed[i] && placed[i].order === correctOrder[i].order) score++;
  }
  return score;
}

export function init(container, difficulty) {
  const correct = pickBooks(booksData, difficulty);
  const shuffled = correct.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let nextIndex = 0;
  const chosen = [];

  container.innerHTML = `
    <p id="bb-status">Click the books in order.</p>
    <div id="bb-pool" class="book-pool"></div>
    <div id="bb-done" class="book-done"></div>
  `;

  const pool = container.querySelector('#bb-pool');
  const done = container.querySelector('#bb-done');
  const status = container.querySelector('#bb-status');

  const buttons = shuffled.map((book) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'book-btn';
    btn.textContent = book.name;
    btn.addEventListener('click', () => onPick(book, btn));
    pool.appendChild(btn);
    return btn;
  });

  function onPick(book, btn) {
    if (book.order === correct[nextIndex].order) {
      chosen.push(book);
      btn.disabled = true;
      btn.classList.add('locked');
      const tag = document.createElement('span');
      tag.className = 'book-tag';
      tag.textContent = book.name;
      done.appendChild(tag);
      playSound('correct');
      nextIndex++;
      if (nextIndex === correct.length) finish();
    } else {
      if (!btn.classList.contains('shake')) {
        btn.classList.add('shake');
        playSound('wrong');
        setTimeout(() => btn.classList.remove('shake'), 300);
      }
      // reveal the correct next book to keep it educational, no shame
      status.textContent = `Next up: ${correct[nextIndex].name}`;
    }
  }

  function finish() {
    saveScore('books-builder', correct.length);
    const best = getHighScore('books-builder');
    status.textContent = `Done! All ${correct.length} books placed in order. Best: ${best}.`;
    signalFinished(container);
  }

  return function cleanup() {
    buttons.forEach((b) => b.replaceWith(b.cloneNode(true)));
    container.innerHTML = '';
  };
}
