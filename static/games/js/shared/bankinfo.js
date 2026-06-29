// Populate the runtime fields of the bank-info footer (rendered by layouts/games/single.html).
// Build-time stats (bank size, coverage, last-updated) are already in the markup; these two
// vary per round, so each game reports them as it boots / finishes.

export function setDrawn(n) {
  const el = document.querySelector('[data-gb-drawn]');
  if (!el) return;
  el.querySelector('[data-gb-drawn-n]').textContent = n;
  el.hidden = false;
}

export function setBest(score) {
  const el = document.querySelector('[data-gb-best]');
  if (!el) return;
  el.querySelector('[data-gb-best-n]').textContent = score;
  el.hidden = false;
}
