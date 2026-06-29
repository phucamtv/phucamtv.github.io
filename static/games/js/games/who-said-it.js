import { getHighScore, saveScore } from '../../shared/scoring.js';
import { playSound } from '../../shared/sound.js';
const quotesData = window.GAME_DATA;

export function buildQuiz(quotes, difficulty) {
  const target = difficulty === 'easy' ? 5 : 8;
  const n = Math.min(target, quotes.length);
  const shuffled = quotes.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

export function init(container, difficulty) {
  const quiz = buildQuiz(quotesData, difficulty);
  const hard = difficulty === 'hard';
  let index = 0;
  let score = 0;
  let timerHandle = null;
  let advanceTimer = null;
  const TIME_LIMIT_MS = 10000;

  render();

  function render() {
    if (index >= quiz.length) return finish();

    const item = quiz[index];
    container.innerHTML = `
      <h2>Who Said It?</h2>
      <p id="wsi-progress">Question ${index + 1} of ${quiz.length}</p>
      <blockquote id="wsi-quote">${item.quote}</blockquote>
      <div id="wsi-options"></div>
      <p id="wsi-feedback"></p>
      ${hard ? `<p id="wsi-timer">Time left: <span>${TIME_LIMIT_MS / 1000}</span>s</p>` : ''}
    `;

    const optionsEl = container.querySelector('#wsi-options');
    item.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt;
      btn.addEventListener('click', () => answer(opt, btn, item));
      optionsEl.appendChild(btn);
    });

    if (hard) startTimer(item);
  }

  function startTimer(item) {
    let remaining = TIME_LIMIT_MS;
    const span = container.querySelector('#wsi-timer span');
    timerHandle = setInterval(() => {
      remaining -= 1000;
      if (span) span.textContent = String(Math.max(0, remaining / 1000));
      if (remaining <= 0) {
        clearInterval(timerHandle);
        // time up counts as wrong: reveal answer, advance
        reveal(item, null);
      }
    }, 1000);
  }

  function answer(opt, btn, item) {
    if (timerHandle) clearInterval(timerHandle);
    if (opt === item.answer) {
      score++;
      btn.classList.add('correct');
      playSound('correct');
    } else {
      btn.classList.add('wrong');
      playSound('wrong');
    }
    reveal(item, opt);
  }

  function reveal(item, chosen) {
    container.querySelectorAll('#wsi-options button').forEach((b) => (b.disabled = true));
    const fb = container.querySelector('#wsi-feedback');
    if (chosen === item.answer) {
      fb.textContent = 'Correct!';
    } else {
      fb.textContent = `The answer was: ${item.answer}`;
    }
    advanceTimer = setTimeout(() => { index++; render(); }, 1100);
  }

  function finish() {
    saveScore('who-said-it', score);
    const best = getHighScore('who-said-it');
    container.innerHTML = `
      <h2>Who Said It?</h2>
      <p>You scored ${score} of ${quiz.length}. Best: ${best}.</p>
      <p>(Higher past scores are kept automatically.)</p>
    `;
  }

  return function cleanup() {
    if (timerHandle) clearInterval(timerHandle);
    if (advanceTimer) clearTimeout(advanceTimer);
    container.innerHTML = '';
  };
}
