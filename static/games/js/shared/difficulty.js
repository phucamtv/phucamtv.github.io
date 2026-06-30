const LEVELS = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];

export function createDifficultySelector(container, onChange) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gh-cycle';
  btn.setAttribute('aria-label', 'Đổi độ khó');

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.setAttribute('aria-hidden', 'true');
  const lvl = document.createElement('span');
  lvl.className = 'lvl';
  btn.append(dot, lvl);

  let index = LEVELS.findIndex((l) => l.id === 'normal');

  function render() {
    const { id, label } = LEVELS[index];
    btn.dataset.level = id;
    lvl.textContent = label;
  }

  const handleClick = () => {
    index = (index + 1) % LEVELS.length;
    render();
    onChange(LEVELS[index].id);
  };

  btn.addEventListener('click', handleClick);
  container.appendChild(btn);

  render();
  onChange(LEVELS[index].id);

  return function cleanup() {
    btn.removeEventListener('click', handleClick);
    btn.remove();
  };
}
