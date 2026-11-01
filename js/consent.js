/**
 * Cookie consent.
 *
 * Region rules (guessed from the browser time zone; unknown → GDPR):
 *   gdpr  EU / UK     opt-in: nothing optional until the visitor chooses
 *   ccpa  California  opt-out of "sale or sharing"; Global Privacy Control honoured
 *   us    other US    notice with an opt-out link; Global Privacy Control honoured
 *
 * The choice is stored in a first-party cookie (nm_consent, 180 days) with a
 * localStorage copy as fallback. Tracking adapters should call getConsent()
 * before sending anything.
 */
import { $, readStorage, writeStorage, removeStorage } from './dom.js';
import { emit } from './events.js';
import { showToast } from './toast.js';

const COOKIE_NAME = 'nm_consent';
const SCHEMA_VERSION = 2; // bump when the stored shape changes; older choices re-prompt
const MAX_AGE_DAYS = 180;
const SHOW_PROMPT_DELAY_MS = 900;

const globalPrivacyControl = navigator.globalPrivacyControl === true;

const REGION_COPY = {
  gdpr: {
    message: 'May we use analytics and ad cookies to improve the store? Nothing optional runs until you choose.',
    actions: [
      { label: 'Reject all', action: 'reject', style: 'secondary' },
      { label: 'Accept all', action: 'accept', style: 'primary' },
    ],
    advertisingTitle: 'Advertising',
    advertisingDescription: 'Measures which ads lead to purchases, using ad-platform pixels.',
  },
  ccpa: {
    message: 'Ad partners may get data that counts as sharing under California law. Opt out anytime.',
    actions: [
      { label: 'Opt out', action: 'opt-out', style: 'secondary' },
      { label: 'Got it', action: 'accept', style: 'primary' },
    ],
    advertisingTitle: 'Sale or sharing for advertising',
    advertisingDescription: 'Lets ad partners measure which ads lead to purchases. Turn off to opt out under the CCPA.',
  },
  us: {
    message: 'We use cookies to run the store and measure our ads. Change this anytime.',
    actions: [
      { label: 'Manage', action: 'manage', style: 'secondary' },
      { label: 'Got it', action: 'accept', style: 'primary' },
    ],
    advertisingTitle: 'Advertising',
    advertisingDescription: 'Measures which ads lead to purchases, using ad-platform pixels.',
  },
};

let region = guessRegion();
let savedConsent = readConsent();
if (savedConsent) region = savedConsent.region;

/** The visitor's saved choice, or null if they haven't chosen yet. */
export function getConsent() {
  return savedConsent;
}

/* ----- Region ----- */

function guessRegion() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    if (timeZone.startsWith('Europe/')) return 'gdpr';
    if (timeZone === 'America/Los_Angeles') return 'ccpa';
    if (timeZone.startsWith('America/')) return 'us';
  } catch {
    /* fall through */
  }
  return 'gdpr'; // unknown → strictest rules
}

const honoursGpc = () => globalPrivacyControl && region !== 'gdpr';

/* ----- Storage ----- */

function readCookie(name) {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function readConsent() {
  const raw = readCookie(COOKIE_NAME) ?? readStorage(COOKIE_NAME);
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeConsent(consent) {
  const value = JSON.stringify(consent);
  const secure = location.protocol === 'https:' ? '; Secure' : '';

  try {
    document.cookie =
      `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked: localStorage copy below still works */
  }
  writeStorage(COOKIE_NAME, value);
}

function clearConsent() {
  try {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/`;
  } catch {
    /* ignore */
  }
  removeStorage(COOKIE_NAME);
}

/* ----- Saving a choice ----- */

function saveChoice({ analytics, advertising, method }) {
  if (honoursGpc()) advertising = false; // GPC = opt out of sale/sharing

  savedConsent = {
    version: SCHEMA_VERSION,
    region,
    necessary: true,
    analytics,
    advertising,
    gpc: globalPrivacyControl,
    method,
    savedAt: new Date().toISOString(),
  };

  writeConsent(savedConsent);
  emit('consent_changed', { analytics, advertising, region, method });

  hidePrompt();
  closePreferences();
  showToast(advertising ? 'Preferences saved' : 'Saved. Advertising cookies are off');
}

function resetConsent() {
  clearConsent();
  emit('consent_reset');
  location.reload();
}

/* ----- Prompt (circle) and floating cookie button ----- */

function renderRegionCopy() {
  const copy = REGION_COPY[region];

  $('#consent-message').textContent = copy.message;
  $('#consent-message').hidden = honoursGpc();
  $('#consent-gpc-note').hidden = !honoursGpc();

  $('#consent-actions').innerHTML = copy.actions.map(({ label, action, style }) => `
    <button type="button" class="consent-choice--${style}" data-consent-action="${action}">${label}</button>
  `).join('');

  $('#advertising-title').textContent = copy.advertisingTitle;
  $('#advertising-description').textContent = copy.advertisingDescription;
  $('#region-picker').value = region;
  $('#open-privacy-choices').hidden = region === 'gdpr';
}

function showPrompt() {
  renderRegionCopy();
  $('#consent-fab').classList.remove('is-visible');

  const prompt = $('#consent-bubble');
  prompt.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => prompt.classList.add('is-visible'));
}

function hidePrompt() {
  const prompt = $('#consent-bubble');
  prompt.classList.remove('is-visible');
  prompt.setAttribute('aria-hidden', 'true');
  setTimeout(() => $('#consent-fab').classList.add('is-visible'), 400);
}

function handlePromptAction(event) {
  const action = event.target.closest('[data-consent-action]')?.dataset.consentAction;

  if (action === 'accept')  saveChoice({ analytics: true,  advertising: true,  method: 'prompt_accept' });
  if (action === 'reject')  saveChoice({ analytics: false, advertising: false, method: 'prompt_reject' });
  if (action === 'opt-out') saveChoice({ analytics: true,  advertising: false, method: 'prompt_opt_out' });
  if (action === 'manage')  openPreferences();
}

/** Tuck the cookie button away while the footer (with its own links) is on screen. */
function tuckButtonAtFooter() {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    $('#consent-fab').classList.toggle('is-tucked', entry.isIntersecting);
  });
  observer.observe($('.site-footer'));
}

/* ----- Preferences dialog ----- */

function openPreferences() {
  // GDPR starts with everything off; US regions start on unless opted out.
  const defaultOn = region !== 'gdpr';

  $('#consent-analytics').checked = savedConsent ? savedConsent.analytics : defaultOn;
  $('#consent-advertising').checked = savedConsent ? savedConsent.advertising : defaultOn && !globalPrivacyControl;

  renderRegionCopy();
  $('#privacy-modal').hidden = false;
  $('#privacy-save').focus();
}

function closePreferences() {
  $('#privacy-modal').hidden = true;
}

/* ----- Setup ----- */

export function initConsent() {
  renderRegionCopy();

  $('#consent-actions').addEventListener('click', handlePromptAction);
  $('#consent-manage').addEventListener('click', openPreferences);
  $('#consent-fab').addEventListener('click', openPreferences);
  $('#open-cookie-settings').addEventListener('click', openPreferences);
  $('#open-privacy-choices').addEventListener('click', openPreferences);

  $('#region-picker').addEventListener('change', (event) => {
    region = event.target.value;
    renderRegionCopy();
  });

  $('#privacy-reject').addEventListener('click', () =>
    saveChoice({ analytics: false, advertising: false, method: 'preferences_reject' }));
  $('#privacy-save').addEventListener('click', () =>
    saveChoice({
      analytics: $('#consent-analytics').checked,
      advertising: $('#consent-advertising').checked,
      method: 'preferences_save',
    }));

  $('#privacy-reset').addEventListener('click', resetConsent);
  $('#reset-consent').addEventListener('click', resetConsent);

  $('#privacy-modal').addEventListener('click', (event) => {
    if (event.target.id === 'privacy-modal') closePreferences();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePreferences();
  });

  tuckButtonAtFooter();

  if (savedConsent) {
    $('#consent-fab').classList.add('is-visible');
  } else {
    setTimeout(showPrompt, SHOW_PROMPT_DELAY_MS);
  }
}
