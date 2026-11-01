/** Small DOM helpers shared by every module. */

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Read from localStorage without throwing (private windows, blocked storage). */
export function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the page still works, it just won't remember */
  }
}

export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
