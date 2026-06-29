export function getItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — ignore */
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
