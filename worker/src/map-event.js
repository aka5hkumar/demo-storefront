/**
 * Maps a conversion event, as sent by the storefront's browser relay, to an
 * OpenAI Conversions API event.
 *
 * The browser already decided the type (js/adapters/conversion-events.js in
 * the storefront) and uses the same event id as the browser pixel, so OpenAI
 * counts an event sent through both channels once.
 *
 * Schema: https://developers.openai.com/ads/conversions-api
 */

/** Standard event types this relay forwards. */
export const FORWARDED_TYPES = new Set([
  'page_viewed',
  'contents_viewed',
  'items_added',
  'checkout_started',
  'order_created',
]);

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // OpenAI rejects events older than 7 days
const MAX_FUTURE_MS = 10 * 60 * 1000;          // or more than 10 minutes in the future
const SHA256_HEX = /^[0-9a-f]{64}$/;

export class InvalidEventError extends Error {}

const isPositiveInteger = (value) => Number.isInteger(value) && value >= 0;

/** Wrap a single value in a list, dropping blanks (OpenAI user fields are lists of ≤3). */
const listOf = (value) => (value ? [String(value)] : undefined);

function mapContents(items = [], currency) {
  return items.map((item) => {
    if (typeof item.sku !== 'string' || !isPositiveInteger(item.quantity) || !isPositiveInteger(item.unit_price)) {
      throw new InvalidEventError('each item needs sku, integer quantity and integer unit_price');
    }
    return {
      id: item.sku,
      name: typeof item.name === 'string' ? item.name.slice(0, 200) : undefined,
      content_type: 'product',
      quantity: item.quantity,
      amount: item.unit_price,
      currency,
    };
  });
}

function mapUser(user = {}, request, browserId) {
  for (const field of ['emails_sha256', 'phone_numbers_sha256', 'first_names_sha256', 'last_names_sha256', 'external_ids_sha256']) {
    const values = user[field];
    if (values !== undefined && (!Array.isArray(values) || values.length > 3 || !values.every((v) => SHA256_HEX.test(v)))) {
      throw new InvalidEventError(`${field} must be up to 3 lowercase SHA-256 hex strings`);
    }
  }

  const mapped = {
    obref: browserId || undefined,
    ip_address: request.headers.get('CF-Connecting-IP') || undefined,
    user_agent: request.headers.get('User-Agent') || undefined,
    emails_sha256: user.emails_sha256,
    phone_numbers_sha256: user.phone_numbers_sha256,
    first_names_sha256: user.first_names_sha256,
    last_names_sha256: user.last_names_sha256,
    external_ids_sha256: user.external_ids_sha256,
    countries: listOf(user.country && String(user.country).toUpperCase().slice(0, 2)),
    cities: listOf(user.city && String(user.city).slice(0, 128)),
    regions: listOf(user.region && String(user.region).slice(0, 128)),
    postal_codes: listOf(user.postal_code && String(user.postal_code).slice(0, 32)),
  };

  // Drop empty fields so the request only carries what we actually have.
  return Object.fromEntries(Object.entries(mapped).filter(([, value]) => value !== undefined));
}

/**
 * @param {object} body     JSON body posted by the browser relay
 * @param {Request} request the incoming request (for IP and user agent)
 * @returns {object|null}   an OpenAI event, or null if this event isn't forwarded
 */
export function toConversionEvent(body, request, now = Date.now()) {
  const event = body?.event;
  if (!event || typeof event !== 'object') throw new InvalidEventError('missing event');

  const { type } = event;
  if (!FORWARDED_TYPES.has(type)) return null;

  if (typeof event.id !== 'string' || !event.id || event.id.length > 128) {
    throw new InvalidEventError('event.id must be a non-empty string');
  }
  if (!Number.isInteger(event.timestamp) || event.timestamp < now - MAX_AGE_MS || event.timestamp > now + MAX_FUTURE_MS) {
    throw new InvalidEventError('event.timestamp must be within the last 7 days');
  }
  if (!/^[A-Z]{3}$/.test(event.currency ?? '')) throw new InvalidEventError('event.currency must be an ISO code');

  let sourceUrl;
  try {
    sourceUrl = new URL(body.page_url);
  } catch {
    throw new InvalidEventError('page_url must be an absolute URL');
  }

  const data = { type: 'contents' };
  if (event.items) data.contents = mapContents(event.items, event.currency);
  if (event.value !== undefined) {
    if (!isPositiveInteger(event.value)) throw new InvalidEventError('event.value must be an integer');
    data.amount = event.value;
    data.currency = event.currency;
  }

  const conversion = {
    id: event.id,
    type,
    timestamp_ms: event.timestamp,
    action_source: 'web',
    source_url: `${sourceUrl.origin}${sourceUrl.pathname}`, // no query string or fragment
    user: mapUser(body.user, request, body.browser_id),
    data,
  };

  if (typeof body.click_id === 'string' && body.click_id) {
    conversion.oppref = body.click_id; // passed through unmodified, as the docs require
  }

  return conversion;
}
