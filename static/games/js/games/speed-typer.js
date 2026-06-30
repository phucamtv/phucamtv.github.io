import { getHighScore, saveScore, signalFinished } from '../shared/scoring.js';
import { playSound } from '../shared/sound.js';
import { setBest, setDrawn } from '../shared/bankinfo.js';

const versesData = window.GAME_DATA;

// Difficulty sets the test duration (Monkeytype-style timed run).
const DURATION = { easy: 30, normal: 60, hard: 120 };

// Build one lowercase character stream from shuffled verses, plus a parallel
// refs[] array marking which verse each character belongs to (for the prompt).
export function buildStream(verses) {
  const order = verses.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let text = '';
  const refs = [];
  const used = [];
  for (const v of order) {
    const words = v.words.join(' ');
    if (text && text.length < 1500) text += ' ';
    if (text.length >= 1500) break;
    const start = text.length;
    text += words;
    used.push(v);
    for (let i = start; i < text.length; i++) refs[i] = v.reference;
    if (text.length >= 1500) break;
  }
  return { chars: [...text], refs, verses: used };
}

export function wpm(correctChars, elapsedSec) {
  if (elapsedSec <= 0) return 0;
  // Standard: a "word" is 5 characters.
  return Math.round((correctChars / 5) / (elapsedSec / 60));
}

export function init(container, difficulty) {
  const seconds = DURATION[difficulty] ?? 60;
  const { chars, refs, verses } = buildStream(versesData);

  setDrawn(verses.length);
  setBest(getHighScore('speed-typer'));

  // typed[i]: undefined = untyped, 1 = correct, 2 = wrong
  const typed = [];
  let pos = 0;
  let started = false;
  let finished = false;
  let timeLeft = seconds;
  let tickHandle = null;
  let startMs = 0;

  container.innerHTML = `
    <div class="sp-top">
      <p class="sp-ref" aria-live="polite"></p>
      <div class="sp-timer" aria-live="off">${seconds}</div>
    </div>
    <div class="sp-type">
      <div class="sp-text" id="sp-text"></div>
    </div>
    <div class="sp-live">
      <span>WPM <b class="sp-wpm">0</b></span>
      <span>Chính xác <b class="sp-acc">100%</b></span>
    </div>
    <p class="sp-hint">Bắt đầu gõ để tính giờ. Có thể dùng phím xoá lùi.</p>
    <input class="sp-input" autocomplete="off" autocapitalize="off"
           autocorrect="off" spellcheck="false" aria-hidden="true" tabindex="-1" />
  `;

  const $text = container.querySelector('#sp-text');
  const $ref = container.querySelector('.sp-ref');
  const $timer = container.querySelector('.sp-timer');
  const $wpm = container.querySelector('.sp-wpm');
  const $acc = container.querySelector('.sp-acc');
  const $hint = container.querySelector('.sp-hint');
  const $input = container.querySelector('.sp-input');

  function charSpan(i) {
    let cls = 'sp-char';
    if (typed[i] === 1) cls += ' correct';
    else if (typed[i] === 2) cls += ' wrong';
    if (i === pos) cls += ' active';
    return `<span class="${cls}">${chars[i]}</span>`;
  }

  // Group letters into words; the space BETWEEN words is its own char at normal
  // white-space so it's a real break opportunity. Wrapping then happens at word
  // boundaries in every engine (a per-char white-space:pre run never wraps in
  // Safari, which clips the line off the right edge).
  function render() {
    let html = '';
    let word = '';
    const flush = () => { if (word) { html += `<span class="sp-word">${word}</span>`; word = ''; } };
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === ' ') { flush(); html += charSpan(i); }
      else word += charSpan(i);
    }
    flush();
    $text.innerHTML = html;
    $ref.innerHTML = refs[pos] ? `đang gõ: <b>${refs[pos]}</b>` : '';
    scrollActiveIntoView();
  }

  // Keep the active line in the visible window. Measures from rect deltas, not
  // offsetTop (whose offsetParent is the positioned .sp-type, not .sp-text —
  // that miscounts the line by the wrapper's padding, engine-dependently).
  function scrollActiveIntoView() {
    const el = $text.querySelector('.sp-char.active');
    if (!el) return;
    const lineH = parseFloat(getComputedStyle($text).lineHeight) || 27;
    const charTop = el.getBoundingClientRect().top
                  - $text.getBoundingClientRect().top
                  + $text.scrollTop;
    const activeLine = Math.round(charTop / lineH);
    const targetLine = activeLine > 1 ? activeLine - 1 : 0;
    $text.scrollTop = targetLine * lineH;
  }

  function stats() {
    let correct = 0;
    let total = 0;
    for (let i = 0; i < pos; i++) {
      if (typed[i] === 1) correct++;
      if (typed[i] != null) total++;
    }
    const elapsed = started ? (Date.now() - startMs) / 1000 : 0;
    return {
      correct,
      wpm: wpm(correct, elapsed),
      acc: total ? Math.round((correct / total) * 100) : 100,
    };
  }

  function updateLive() {
    const s = stats();
    $wpm.textContent = s.wpm;
    $acc.textContent = `${s.acc}%`;
  }

  function start() {
    if (started || finished) return;
    started = true;
    startMs = Date.now();
    $hint.textContent = '';
    tickHandle = setInterval(() => {
      timeLeft--;
      $timer.textContent = Math.max(0, timeLeft);
      $timer.classList.toggle('warn', timeLeft <= 10);
      updateLive();
      if (timeLeft <= 0) finish();
    }, 1000);
  }

  function handleKey(e) {
    if (finished) return;
    // Let browser/OS shortcuts through (⌘R, ⌘F, ⇧⌘E, …).
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (pos > 0) {
        pos--;
        typed[pos] = undefined;
        render();
      }
      return;
    }
    if (e.key.length !== 1) return; // ignore Shift, arrows, etc.
    e.preventDefault();

    start();
    typed[pos] = e.key === chars[pos] ? 1 : 2;
    if (typed[pos] === 2) playSound('wrong');
    pos++;
    if (pos >= chars.length) { render(); finish(); return; }
    render();
    updateLive();
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (tickHandle) clearInterval(tickHandle);
    document.removeEventListener('keydown', handleKey);

    const s = stats();
    saveScore('speed-typer', s.wpm);
    const best = getHighScore('speed-typer');
    setBest(best);

    let correctCount = 0;
    let errorCount = 0;
    for (let i = 0; i < pos; i++) {
      if (typed[i] === 1) correctCount++;
      else if (typed[i] === 2) errorCount++;
    }

    playSound(s.wpm > 0 ? 'correct' : 'wrong');
    container.innerHTML = `
      <div class="sp-result">
        <p class="big">${s.wpm}<small> WPM</small></p>
        <p class="label">Tốc độ gõ</p>
        <div class="sp-stats">
          <div class="sp-stat"><div class="n">${s.acc}%</div><div class="k">Chính xác</div></div>
          <div class="sp-stat"><div class="n">${correctCount}</div><div class="k">Đúng</div></div>
          <div class="sp-stat"><div class="n">${errorCount}</div><div class="k">Sai</div></div>
        </div>
        <p class="sp-best">Kỷ lục: <b>${best} WPM</b></p>
        <button type="button" class="sp-again">Chơi lại</button>
      </div>
    `;
    container.querySelector('.sp-again').addEventListener('click', () => init(container, difficulty));
    signalFinished(container);
  }

  document.addEventListener('keydown', handleKey);
  render();
  // Focus a hidden input so mobile keyboards open on tap.
  container.querySelector('.sp-type').addEventListener('pointerdown', () => {
    if (!finished) $input.focus();
  });

  return function cleanup() {
    if (tickHandle) clearInterval(tickHandle);
    document.removeEventListener('keydown', handleKey);
    container.innerHTML = '';
  };
}
