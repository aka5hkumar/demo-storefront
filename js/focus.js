/**
 * Modal focus handling, shared by the bag drawer, quick view and dialogs.
 *
 * While a dialog is open:
 *   - everything behind it is made `inert`: it can't be clicked, focused or
 *     read by a screen reader, so Tab can't wander into the page underneath
 *   - Tab and Shift+Tab wrap around inside the dialog
 * When it closes, focus goes back to whatever was focused before it opened
 * (usually the button that opened it).
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Page regions that go inert while any dialog is open. */
const BACKGROUND = ['.skip-link', '.site-header', 'main', '.site-footer', '#consent-bubble', '#consent-fab'];

const openDialogs = []; // stack, so a dialog can open on top of another

function focusableIn(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null);
}

function setBackgroundInert(inert) {
  BACKGROUND.forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) element.inert = inert;
  });
}

/** Keep Tab inside the top-most dialog. */
function trapTab(event) {
  const top = openDialogs.at(-1);
  if (event.key !== 'Tab' || !top) return;

  const focusable = focusableIn(top.container);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!top.container.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', trapTab);

/**
 * @param {HTMLElement} container      the dialog element
 * @param {HTMLElement} [initialFocus] what to focus first (defaults to the first focusable)
 */
export function openDialog(container, initialFocus) {
  if (openDialogs.some((dialog) => dialog.container === container)) {
    (initialFocus ?? focusableIn(container)[0])?.focus();
    return;
  }

  // A dialog underneath goes inert too, so only the top one is usable.
  openDialogs.at(-1)?.container && (openDialogs.at(-1).container.inert = true);
  openDialogs.push({ container, returnFocusTo: document.activeElement });
  setBackgroundInert(true);

  (initialFocus ?? focusableIn(container)[0])?.focus();
}

export function closeDialog(container) {
  const index = openDialogs.findIndex((dialog) => dialog.container === container);
  if (index === -1) return;

  const [{ returnFocusTo }] = openDialogs.splice(index, 1);
  const below = openDialogs.at(-1);

  if (below) {
    below.container.inert = false;
  } else {
    setBackgroundInert(false);
  }
  returnFocusTo?.focus?.({ preventScroll: true });
}

export const isDialogOpen = (container) => openDialogs.some((dialog) => dialog.container === container);
