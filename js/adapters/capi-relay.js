/**
 * Server relay: forwards conversion events to our relay (a Cloudflare Worker),
 * which maps them to the ad platform's Conversions API, adds the visitor's IP
 * address and user agent, and holds the API key.
 *
 * Off until CONVERSIONS_RELAY_URL is set in config.js. Uses the same event ids
 * as the browser pixel, so each event is counted once.
 *
 * Sent only with advertising consent. Checkout details are hashed in the
 * browser and attached to the purchase; the cart reference is separately
 * hashed for OpenAI's external-ID matching field.
 */
import { on } from '../events.js';
import { state } from '../state.js';
import { getConsent } from '../consent.js';
import { CONVERSIONS_RELAY_URL } from '../config.js';
import { createEventDescriber, hashCustomer, hashExternalId, clickId } from './conversion-events.js';

const BROWSER_ID_COOKIE = '__obref'; // set by the browser pixel, when it's installed
const SESSION_ID_KEY = 'nm-capi-session-id';
const SESSION_ID_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let fallbackSessionId;

function createSessionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function trackingSessionId() {
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_ID_KEY) || 'null');
    if (saved?.id && saved.expiresAt > now) {
      localStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id: saved.id, expiresAt: now + SESSION_ID_TTL_MS }));
      return saved.id;
    }
    const id = createSessionId();
    localStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id, expiresAt: now + SESSION_ID_TTL_MS }));
    return id;
  } catch {
    fallbackSessionId ??= createSessionId();
    return fallbackSessionId;
  }
}

function revokeTrackingSession() {
  let sessionId = fallbackSessionId;
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_ID_KEY) || 'null');
    sessionId = saved?.id ?? sessionId;
    localStorage.removeItem(SESSION_ID_KEY);
  } catch { /* storage may be disabled */ }
  fallbackSessionId = undefined;
  if (!sessionId) return;

  try {
    fetch(CONVERSIONS_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, consent: { advertising: false } }),
      keepalive: true,
    }).catch(() => { /* tracking must never interrupt the shop */ });
  } catch { /* tracking must never interrupt the shop */ }
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Hashed fields in the relay's request format (lists, as the Conversions API expects). */
function relayUser(hashed) {
  const list = (value) => (value ? [value] : undefined);
  return {
    emails_sha256: list(hashed.email),
    phone_numbers_sha256: list(hashed.phone),
    first_names_sha256: list(hashed.firstName),
    last_names_sha256: list(hashed.lastName),
    city: hashed.city,
    region: hashed.region,
    postal_code: hashed.postcode,
    country: hashed.country,
  };
}

async function relay(description, customerSnapshot) {
  const consent = getConsent();
  if (!consent?.advertising) return; // no advertising consent: nothing leaves the browser

  try {
    const body = {
      event: description,
      page_url: location.href,
      click_id: clickId(),
      browser_id: readCookie(BROWSER_ID_COOKIE),
      session_id: trackingSessionId(),
      cart_id: description.cart_id || state.orderId || null,
      consent: { advertising: true, region: consent.region },
    };
    const externalId = await hashExternalId(body.cart_id);
    body.user = {
      ...(externalId ? { external_ids_sha256: [externalId] } : {}),
      ...(customerSnapshot ? relayUser(await hashCustomer(customerSnapshot)) : {}),
    };

    await fetch(CONVERSIONS_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true, // still delivered if the tab closes straight after
    });
  } catch {
    /* tracking must never break the shop */
  }
}

export function installConversionsRelay() {
  if (!CONVERSIONS_RELAY_URL) return;

  const describe = createEventDescriber();
  clickId(); // capture the click ID on the landing page

  on('consent_changed', (event) => {
    if (event.advertising !== true) revokeTrackingSession();
  });

  on('*', (event) => {
    const description = describe(event);
    if (!description) return;

    // Copy checkout details now: bag.js clears state.customer right after order_placed.
    const customerSnapshot = description.type === 'order_created' ? { ...state.customer } : null;
    relay(description, customerSnapshot);
  });
}
