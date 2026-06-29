const LEVELS = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];

export function createDifficultySelector(container, onChange) {
  const buttons = LEVELS.map(({ id, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.level = id;
    btn.textContent = label;
    btn.className = 'difficulty-btn';
    return btn;
  });

  const handleClick = (e) => {
    const level = e.currentTarget.dataset.level;
    setActive(level);
    onChange(level);
  };

  buttons.forEach((b) => b.addEventListener('click', handleClick));
  buttons.forEach((b) => container.appendChild(b));

  function setActive(level) {
    buttons.forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.level === level));
    });
  }

  setActive('normal');
  onChange('normal');

  return function cleanup() {
    buttons.forEach((b) => {
      b.removeEventListener('click', handleClick);
      b.remove();
    });
  };
}
