import { getItem, setItem } from './storage.js';

const MUTE_KEY = 'bq:muted';

let _muted = getItem(MUTE_KEY, false);

export function isMuted() {
  return _muted;
}

export function setMuted(value) {
  _muted = !!value;
  setItem(MUTE_KEY, _muted);
}

export function playSound(name) {
  if (_muted) return false;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = name === 'correct' ? 660 : name === 'wrong' ? 220 : 440;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    return true;
  } catch {
    return false;
  }
}
