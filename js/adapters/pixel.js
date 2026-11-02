/**
 * Browser pixel: loads the ad platform's measurement SDK and sends every
 * conversion event from the browser.
 *
 * Off until PIXEL_IDS (and PIXEL_SCRIPT_URL) are set in config.js.
 *
 * - Several Pixel IDs: the SDK loads once, each ID is initialised, and every
 *   `measure` call goes to all of them. Deduplication is per Pixel ID, so the
 *   same event id on each pixel is correct.
 *
 * - Same event ids as the server relay (conversion-events.js), so an event
 *   sent through both is counted once.
 * - Consent: the SDK starts with consent off unless advertising consent was
 *   already given, and follows consent_changed after that. While consent is
 *   off the SDK sends nothing and keeps no cookies.
 * - Matching: on the purchase, the SDK is re-initialised with the shopper's
 *   hashed details before the order event is measured.
 */
import { on } from '../events.js';
import { state } from '../state.js';
import { getConsent } from '../consent.js';
import { PIXEL_IDS, PIXEL_SCRIPT_URL, PIXEL_DEBUG } from '../config.js';
import { createEventDescriber, hashCustomer } from './conversion-events.js';

/**
 * Load the SDK and return a function that sends it a command.
 *
 * Until the script loads, window.oaiq is a stub that queues commands; the SDK
 * then replaces it and replays the queue. So every call must go through the
 * current window.oaiq, never a saved reference to the stub.
 */
function loadSdk() {
  if (!window.oaiq) {
    const queue = (...args) => queue.q.push(args);
    queue.q = [];
    window.oaiq = queue;

    const script = document.createElement('script');
    script.async = true;
    script.src = PIXEL_SCRIPT_URL;
    document.head.append(script);
  }
  return (...args) => window.oaiq(...args);
}

/** Event data in the SDK's "contents" shape (amounts in minor units). */
function pixelData(description) {
  const data = { type: 'contents' };

  if (description.items) {
    data.contents = description.items.map((item) => ({
      id: item.sku,
      name: item.name,
      content_type: 'product',
      quantity: item.quantity,
      amount: item.unit_price,
      currency: description.currency,
    }));
  }
  if (description.value !== undefined) {
    data.amount = description.value;
    data.currency = description.currency;
  }
  return data;
}

/** Hashed details in the SDK's init format (single values, not lists). */
function pixelUser(hashed) {
  const user = {
    email_sha256: hashed.email,
    phone_number_sha256: hashed.phone,
    first_name_sha256: hashed.firstName,
    last_name_sha256: hashed.lastName,
    city: hashed.city,
    region: hashed.region,
    postal_code: hashed.postcode,
    country: hashed.country,
  };
  return Object.fromEntries(Object.entries(user).filter(([, value]) => value));
}

export function installPixel() {
  const pixelIds = PIXEL_IDS.filter(Boolean);
  if (!pixelIds.length || !PIXEL_SCRIPT_URL) return;

  const sdk = loadSdk();
  const describe = createEventDescriber();

  // Consent first, so nothing is measured before the visitor has agreed.
  sdk('consent', getConsent()?.advertising === true);
  // Initialise every pixel up front: a pixel initialised later misses earlier events.
  pixelIds.forEach((pixelId) => sdk('init', { pixelId, debug: PIXEL_DEBUG }));

  on('consent_changed', (event) => sdk('consent', event.advertising === true));

  on('*', (event) => {
    const description = describe(event);
    if (!description) return;

    const measure = () => sdk('measure', description.type, pixelData(description), { event_id: description.id });

    // Matching details only go to the SDK with advertising consent.
    if (description.type !== 'order_created' || getConsent()?.advertising !== true) {
      measure();
      return;
    }

    // Copy checkout details now (bag.js clears them right after order_placed),
    // add them to each pixel for matching, then measure the order. With more
    // than one pixel, OpenAI requires the pixelId on every user update.
    const customerSnapshot = { ...state.customer };
    hashCustomer(customerSnapshot)
      .then((hashed) => {
        const user = pixelUser(hashed);
        pixelIds.forEach((pixelId) => sdk('init', { pixelId, user }));
      })
      .catch(() => { /* measure without matching details */ })
      .finally(measure);
  });
}
