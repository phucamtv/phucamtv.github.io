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

const SVG_NS = 'http://www.w3.org/2000/svg';

export function init(container, difficulty) {
  const parables = pickParables(parablesData, difficulty);
  const total = parables.length;
  let selectedParable = null; // the parable card element currently selected
  let matchedCount = 0;
  let wrongAttempts = 0;
  let finished = false;

  const shuffledMeanings = parables.slice();
  for (let i = shuffledMeanings.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledMeanings[i], shuffledMeanings[j]] = [shuffledMeanings[j], shuffledMeanings[i]];
  }

  container.innerHTML = `
    <div class="pp-head">
      <h2>Parable Pairs</h2>
      <div class="pp-progress">
        <span class="pp-pips">${parables.map(() => '<span class="pp-pip"></span>').join('')}</span>
        <span class="pp-count">0 / ${total}</span>
      </div>
    </div>
    <p class="pp-status">Tap a parable, then tap its meaning.</p>
    <div class="pp-stage">
      <svg class="pp-links" aria-hidden="true"></svg>
      <div class="pp-board">
        <div>
          <p class="pp-col-label">Parables</p>
          <div class="pp-parables pp-list"></div>
        </div>
        <div>
          <p class="pp-col-label">Meanings</p>
          <div class="pp-meanings pp-list"></div>
        </div>
      </div>
    </div>
    <div class="pp-finish">
      <span class="pp-seal" aria-hidden="true">✦</span>
      <div class="pp-finish-text">
        <h3 class="pp-finish-title"></h3>
        <p class="pp-finish-sub"></p>
      </div>
    </div>
  `;

  const board = container.querySelector('.pp-board');
  const linksSvg = container.querySelector('.pp-links');
  const statusEl = container.querySelector('.pp-status');
  const countEl = container.querySelector('.pp-count');
  const pips = [...container.querySelectorAll('.pp-pip')];

  const parablesEl = container.querySelector('.pp-parables');
  parables.forEach((p) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pp-card pp-parable';
    card.dataset.id = p.id;
    card.dataset.meaning = p.meaning; // used by the test/verifier to locate the match
    card.innerHTML = `<span class="pp-text"></span><span class="pp-badge" aria-hidden="true"></span>`;
    card.querySelector('.pp-text').textContent = p.title;
    card.addEventListener('click', () => selectParable(card));
    parablesEl.appendChild(card);
  });

  const meaningsEl = container.querySelector('.pp-meanings');
  shuffledMeanings.forEach((p) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pp-card pp-meaning';
    card.dataset.meaning = p.meaning;
    card.innerHTML = `<span class="pp-badge" aria-hidden="true"></span><span class="pp-text"></span>`;
    card.querySelector('.pp-text').textContent = p.meaning;
    card.addEventListener('click', () => selectMeaning(card));
    meaningsEl.appendChild(card);
  });

  function selectParable(card) {
    if (card.classList.contains('matched')) return;
    if (selectedParable === card) {
      card.classList.remove('selected');
      selectedParable = null;
      board.classList.remove('armed');
      return;
    }
    if (selectedParable) selectedParable.classList.remove('selected');
    selectedParable = card;
    card.classList.add('selected');
    board.classList.add('armed');
    statusEl.innerHTML = 'Now tap the <b>meaning</b> that matches.';
  }

  function selectMeaning(card) {
    if (card.classList.contains('matched')) return;
    if (!selectedParable) {
      statusEl.innerHTML = 'Tap a <b>parable</b> first.';
      return;
    }
    if (pairsMatch(parableOf(selectedParable), card.dataset.meaning)) {
      matchedCount++;
      const num = matchedCount;
      [selectedParable, card].forEach((el) => {
        el.classList.remove('selected');
        el.classList.add('matched', 'just-matched');
        el.querySelector('.pp-badge').textContent = num;
        setTimeout(() => el.classList.remove('just-matched'), 400);
      });
      drawLink(selectedParable, card);
      playSound('correct');
      pips[matchedCount - 1].classList.add('filled');
      countEl.textContent = `${matchedCount} / ${total}`;
      selectedParable = null;
      board.classList.remove('armed');
      statusEl.textContent = matchedCount === total ? '' : 'Matched! Keep going.';
      if (matchedCount === total) finish();
    } else {
      wrongAttempts++;
      card.classList.add('shake', 'wrong');
      playSound('wrong');
      selectedParable.classList.remove('selected');
      selectedParable = null;
      board.classList.remove('armed');
      statusEl.textContent = 'Not a match — try again.';
      setTimeout(() => card.classList.remove('shake', 'wrong'), 350);
    }
  }

  function parableOf(card) {
    return parables.find((p) => p.id === card.dataset.id);
  }

  // Curved ribbon from the parable card's right edge to the meaning card's left edge.
  function drawLink(a, b) {
    const s = linksSvg.getBoundingClientRect();
    if (s.width === 0) return; // single-column / hidden: connectors don't apply
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const x1 = ra.right - s.left, y1 = ra.top - s.top + ra.height / 2;
    const x2 = rb.left - s.left, y2 = rb.top - s.top + rb.height / 2;
    const mx = (x1 + x2) / 2;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
    const len = Math.hypot(x2 - x1, y2 - y1) + Math.abs(y2 - y1);
    path.style.setProperty('--len', len);
    linksSvg.appendChild(path);
  }

  // Redraw all connectors on resize (matched badges carry the pair number).
  function redrawLinks() {
    linksSvg.innerHTML = '';
    [...parablesEl.querySelectorAll('.pp-parable.matched')].forEach((pa) => {
      const n = pa.querySelector('.pp-badge').textContent;
      const me = [...meaningsEl.querySelectorAll('.pp-meaning.matched')]
        .find((m) => m.querySelector('.pp-badge').textContent === n);
      if (me) drawLink(pa, me);
    });
  }
  window.addEventListener('resize', redrawLinks);

  function finish() {
    if (finished) return;
    finished = true;
    const score = Math.max(0, total - wrongAttempts);
    saveScore('parable-pairs', score);
    const best = getHighScore('parable-pairs');
    const perfect = wrongAttempts === 0;
    container.querySelector('.pp-finish-title').textContent = perfect
      ? 'Perfect — every pair matched!'
      : 'All matched!';
    container.querySelector('.pp-finish-sub').textContent = perfect
      ? `All ${total} pairs, no misses. Best: ${best}.`
      : `Finished with ${wrongAttempts} miss${wrongAttempts > 1 ? 'es' : ''}. Score: ${score}. Best: ${best}.`;
    container.querySelector('.pp-finish').classList.add('show');
  }

  return function cleanup() {
    window.removeEventListener('resize', redrawLinks);
    container.innerHTML = '';
  };
}
