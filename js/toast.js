/** Brief status message at the bottom of the screen. */
import { $ } from './dom.js';

const VISIBLE_MS = 2400;
let hideTimer;

export function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.remove('is-visible'), VISIBLE_MS);
}
