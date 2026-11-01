/**
 * Server relay: forwards conversion events to our relay (a Cloudflare Worker),
 * which maps them to the ad platform's Conversions API, adds the visitor's IP
 * address and user agent, and holds the API key.
 *
 * Off until CONVERSIONS_RELAY_URL is set in config.js. Uses the same event ids
 * as the browser pixel, so each event is counted once.
 *
 * Sent only with advertising consent. Personal details are hashed in the
 * browser and only attached to the purchase; raw PII never leaves the page.
 */
import { on } from '../events.js';
import { state } from '../state.js';
import { getConsent } from '../consent.js';
import { CONVERSIONS_RELAY_URL } from '../config.js';
import { createEventDescriber, hashCustomer, clickId } from './conversion-events.js';

const BROWSER_ID_COOKIE = '__obref'; // set by the browser pixel, when it's installed

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

  const body = {
    event: description,
    page_url: location.href,
    click_id: clickId(),
    browser_id: readCookie(BROWSER_ID_COOKIE),
    consent: { advertising: true, region: consent.region },
  };
  if (customerSnapshot) body.user = relayUser(await hashCustomer(customerSnapshot));

  try {
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

  on('*', (event) => {
    const description = describe(event);
    if (!description) return;

    // Copy checkout details now: bag.js clears state.customer right after order_placed.
    const customerSnapshot = description.type === 'order_created' ? { ...state.customer } : null;
    relay(description, customerSnapshot);
  });
}
