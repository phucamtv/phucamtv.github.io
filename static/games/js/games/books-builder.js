import { getHighScore, saveScore, signalFinished } from '../shared/scoring.js';
import { playSound } from '../shared/sound.js';
import { setBest, setDrawn } from '../shared/bankinfo.js';
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
  const N = correct.length;

  // Fisher–Yates shuffle of the books for the pool.
  const shuffled = correct.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // book.order -> book, so a chip's data-order attribute can be resolved back.
  const byOrder = new Map(correct.map((b) => [b.order, b]));

  let best = getHighScore('books-builder');
  let dragged = null;

  container.innerHTML = `
    <div class="bb-head">
      <p>Drag each book from the pool into the numbered slot you think is right, then press <b>Check order</b>.</p>
    </div>
    <div class="bb-board">
      <div>
        <div class="bb-col-label">Pool — drag from here</div>
        <div class="bb-pool" id="bb-pool"></div>
      </div>
      <div>
        <div class="bb-col-label">Correct order</div>
        <div class="bb-slots" id="bb-slots"></div>
      </div>
    </div>
    <div class="bb-controls">
      <button type="button" class="bb-check" id="bb-check">Check order</button>
      <button type="button" id="bb-reset">Reset</button>
      <span class="bb-result" id="bb-result"></span>
    </div>
    <div class="bb-finish" id="bb-finish">
      <div class="bb-seal">✓</div>
      <div>
        <h3>Perfect order!</h3>
        <p>All books placed correctly. Best score saved.</p>
      </div>
    </div>
  `;

  const pool = container.querySelector('#bb-pool');
  const slotsEl = container.querySelector('#bb-slots');
  const checkBtn = container.querySelector('#bb-check');
  const resetBtn = container.querySelector('#bb-reset');
  const resultEl = container.querySelector('#bb-result');
  const finishEl = container.querySelector('#bb-finish');

  function makeChip(book) {
    const chip = document.createElement('div');
    chip.className = 'bb-chip';
    chip.draggable = true;
    chip.dataset.order = book.order;
    chip.innerHTML =
      `<span class="bb-grip" aria-hidden="true">⠿</span><span class="bb-name"></span>`;
    chip.querySelector('.bb-name').textContent = book.name;
    chip.addEventListener('dragstart', (e) => {
      dragged = chip;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      dragged = null;
    });
    return chip;
  }

  function clearMarks() {
    slotsEl.querySelectorAll('.bb-slot').forEach((s) => {
      s.classList.remove('correct', 'wrong', 'shake');
      const m = s.querySelector('.bb-mark');
      if (m) m.textContent = '';
      const h = s.querySelector('.bb-hint');
      if (h) h.remove();
    });
    resultEl.textContent = '';
    finishEl.classList.remove('show');
  }

  function refreshDropStates() {
    slotsEl.querySelectorAll('.bb-drop').forEach((d) => {
      const has = !!d.querySelector('.bb-chip');
      d.classList.toggle('filled', has);
      d.classList.toggle('empty', !has);
      const ph = d.querySelector('.bb-ph');
      if (ph) ph.style.display = has ? 'none' : '';
    });
  }

  function makeDropTarget(el, isPool) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('dragover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      if (!dragged) return;
      clearMarks();
      if (isPool) {
        pool.appendChild(dragged);
      } else {
        // dropping onto an occupied slot returns the resident chip to the pool
        const existing = el.querySelector('.bb-chip');
        if (existing && existing !== dragged) pool.appendChild(existing);
        el.appendChild(dragged);
      }
      refreshDropStates();
    });
  }

  // Build the pool.
  shuffled.forEach((b) => pool.appendChild(makeChip(b)));
  makeDropTarget(pool, true);

  // Build N numbered slots.
  for (let i = 0; i < N; i++) {
    const slot = document.createElement('div');
    slot.className = 'bb-slot';
    slot.innerHTML = `
      <div class="bb-slot-num">${i + 1}</div>
      <div class="bb-drop empty">
        <span class="bb-ph">drop a book here</span>
        <span class="bb-mark"></span>
      </div>`;
    const drop = slot.querySelector('.bb-drop');
    makeDropTarget(drop, false);
    slotsEl.appendChild(slot);
  }

  // Read the current placement as an array aligned to slot index.
  function readPlaced() {
    const drops = [...slotsEl.querySelectorAll('.bb-drop')];
    return drops.map((d) => {
      const chip = d.querySelector('.bb-chip');
      return chip ? byOrder.get(Number(chip.dataset.order)) : null;
    });
  }

  function check() {
    const placed = readPlaced();
    const slots = [...slotsEl.querySelectorAll('.bb-slot')];
    slots.forEach((slot, i) => {
      const drop = slot.querySelector('.bb-drop');
      const mark = slot.querySelector('.bb-mark');
      const oldHint = slot.querySelector('.bb-hint');
      if (oldHint) oldHint.remove();
      slot.classList.remove('correct', 'wrong', 'shake');
      if (placed[i] && placed[i].order === correct[i].order) {
        slot.classList.add('correct');
        mark.textContent = '✓';
      } else {
        slot.classList.add('wrong', 'shake');
        mark.textContent = '✕';
        setTimeout(() => slot.classList.remove('shake'), 300);
        const hint = document.createElement('span');
        hint.className = 'bb-hint';
        hint.textContent = `should be ${correct[i].name}`;
        drop.appendChild(hint);
      }
    });

    const score = scorePlacement(correct, placed);
    resultEl.innerHTML =
      `Score: <b>${score}/${N}</b> in correct position. ` +
      (score === N ? 'Perfect!' : 'Fix the red slots and check again.');

    if (score > best) {
      best = score;
      saveScore('books-builder', score);
      setBest(best);
    }

    if (score === N) {
      playSound('correct');
      finishEl.classList.add('show');
      signalFinished(container);
    } else {
      playSound('wrong');
    }
  }

  function reset() {
    clearMarks();
    // collect every chip (in pool or slots) and re-shuffle back into the pool
    const chips = [...container.querySelectorAll('.bb-chip')];
    for (let i = chips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chips[i], chips[j]] = [chips[j], chips[i]];
    }
    chips.forEach((c) => pool.appendChild(c));
    refreshDropStates();
  }

  checkBtn.addEventListener('click', check);
  resetBtn.addEventListener('click', reset);

  setDrawn(N);
  setBest(best);
  refreshDropStates();

  return function cleanup() {
    container.innerHTML = '';
  };
}
