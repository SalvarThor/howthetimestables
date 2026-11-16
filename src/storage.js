import { newState, sanitizeState } from "./game.js";

const KEY = "howthetimestables.v1";

export function load() {
  const fresh = newState();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || typeof saved !== "object") return fresh;
    return sanitizeState({ ...fresh, ...saved });
  } catch {
    return fresh;
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled (e.g. private browsing). The game still works, it just won't remember.
  }
}

export function clear() {
  localStorage.removeItem(KEY);
}
