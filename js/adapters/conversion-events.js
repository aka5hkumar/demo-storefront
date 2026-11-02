/**
 * Shared by the browser pixel and the server relay, so both send the same
 * events with the same ids (the ad platform deduplicates on event id).
 *
 *   storefront event                    conversion type
 *   page_view                       →   page_viewed
 *   product_viewed (first per SKU)  →   contents_viewed   (quick view opened)
 *   add_to_cart                     →   items_added
 *   checkout_step (contact)         →   checkout_started
 *   order_placed                    →   order_created   (id = cart/order reference)
 *   membership_viewed (once)        →   contents_viewed   (the plan, content_type 'plan')
 *   membership_trial_started        →   trial_started         (plan_enrollment, id = member ID)
 *   membership_started              →   subscription_created  (plan_enrollment + first charge)
 */
import { state } from '../state.js';
import { findProduct, CLUB } from '../catalog.js';

/** Calling codes for the countries the demo shopper can come from. */
const CALLING_CODES = {
  US: '1', CA: '1', GB: '44', IE: '353', DE: '49', FR: '33', ES: '34', NL: '31',
  DK: '45', NO: '47', FI: '358', CH: '41', AU: '61', NZ: '64', BR: '55', MX: '52',
  IN: '91', TR: '90', UA: '380', RS: '381', JP: '81',
};

/* ----- Event description ----- */

function bagItems() {
  return [...state.bag.values()].map((line) => {
    const product = findProduct(line.sku);
    return { sku: line.sku, name: product.name, quantity: line.quantity, unit_price: product.prices[state.currency] };
  });
}

const itemsTotal = (items) => items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

/**
 * Creates a describer with its own "already viewed" memory. Each adapter gets
 * its own, so both see the first view of every product.
 *
 * The describer returns { type, id, timestamp, currency, items?, value? },
 * or null if the event isn't a conversion event.
 */
export function createEventDescriber() {
  const viewedSkus = new Set();

  return function describe(event) {
    const base = {
      id: event.id,
      timestamp: event.timestamp,
      currency: event.currency,
      cart_id: event.cart_id,
    };

    switch (event.name) {
      case 'page_view':
        return { ...base, type: 'page_viewed' };

      case 'product_viewed': {
        if (viewedSkus.has(event.sku)) return null;
        viewedSkus.add(event.sku);
        const product = findProduct(event.sku);
        return {
          ...base,
          type: 'contents_viewed',
          items: [{ sku: product.sku, name: product.name, quantity: 1, unit_price: product.prices[event.currency] }],
        };
      }

      case 'add_to_cart':
        return {
          ...base,
          type: 'items_added',
          items: [{ sku: event.sku, name: event.product_name, quantity: event.quantity, unit_price: event.unit_price }],
          value: event.unit_price * event.quantity,
        };

      case 'checkout_step': {
        if (event.step !== 'contact') return null; // reaching the first checkout form = checkout started
        const items = bagItems();
        return { ...base, type: 'checkout_started', items, value: itemsTotal(items) };
      }

      case 'order_placed': {
        const items = event.items.map((item) => ({ ...item, name: findProduct(item.sku).name }));
        return { ...base, type: 'order_created', items, value: event.total };
      }

      case 'membership_viewed':
        return {
          ...base,
          type: 'contents_viewed',
          items: [{
            sku: CLUB.plans.monthly.planId,
            name: CLUB.name,
            content_type: 'plan',
            quantity: 1,
            unit_price: CLUB.monthlyPrices[event.currency],
          }],
        };

      case 'membership_trial_started':
        return { ...base, type: 'trial_started', plan_id: event.plan_id };

      case 'membership_started':
        return { ...base, type: 'subscription_created', plan_id: event.plan_id, value: event.amount };

      default:
        return null;
    }
  };
}

/* ----- Matching details (hashed in the browser) ----- */

/** Enrollment events carry plan data (`plan_enrollment`) instead of `contents`. */
export const PLAN_EVENT_TYPES = new Set(['trial_started', 'subscription_created']);

/**
 * The contact details to hash for an event, copied at the moment it fires:
 * checkout details for the order, the Club email for trial/subscription.
 * Everything else gets none.
 */
export function contactDetailsFor(description) {
  if (description.type === 'order_created') return { ...state.customer };
  if (PLAN_EVENT_TYPES.has(description.type)) return { ...state.member };
  return null;
}

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hash a stable, pseudonymous system identifier for OpenAI's external-ID field. */
export async function hashExternalId(value) {
  return value ? sha256(String(value).trim()) : undefined;
}

const normaliseEmail = (email) => email.trim().toLowerCase();

/** Lowercase; drop whitespace and ASCII punctuation; keep accented letters. */
const normaliseName = (name) => name.toLowerCase().replace(/[\s!-/:-@[-`{-~]/g, '');

/** Digits only, with the country calling code and no leading + or zeros. */
function normalisePhone(phone, countryCode) {
  let digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  const callingCode = CALLING_CODES[countryCode];

  if (callingCode && !digits.startsWith(callingCode)) digits = callingCode + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

let countryCodesByName;

/** Two-letter country code for an English country name, e.g. "United Kingdom" → "GB". */
export function countryCodeFor(countryName) {
  if (!countryName) return null;

  if (!countryCodesByName) {
    countryCodesByName = new Map();
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const first of letters) {
      for (const second of letters) {
        const code = first + second;
        try {
          const name = names.of(code);
          if (name && name !== code) countryCodesByName.set(name.toLowerCase(), code);
        } catch { /* not a region code */ }
      }
    }
  }
  return countryCodesByName.get(countryName.toLowerCase()) ?? null;
}

/**
 * Hash what the shopper entered at checkout. Pass a copy of state.customer:
 * bag.js clears it right after order_placed.
 *
 * @returns {Promise<{email?, phone?, firstName?, lastName?, city?, region?, postcode?, country?}>}
 *   hashes as lowercase hex; location fields raw
 */
export async function hashCustomer(customer) {
  const country = countryCodeFor(customer.country);
  const [firstName = '', ...lastNames] = (customer.name ?? '').trim().split(/\s+/);
  const phone = customer.phone && normalisePhone(customer.phone, country);
  const hashIf = async (value) => (value ? sha256(value) : undefined);

  return {
    email: await hashIf(customer.email && normaliseEmail(customer.email)),
    phone: await hashIf(phone),
    firstName: await hashIf(firstName && normaliseName(firstName)),
    lastName: await hashIf(lastNames.length ? normaliseName(lastNames.join('')) : ''),
    city: customer.city || undefined,
    region: customer.region || undefined,
    postcode: customer.postcode || undefined,
    country: country ?? undefined,
  };
}

/* ----- Identifiers ----- */

const CLICK_ID_PARAM = 'oppref';
const CLICK_ID_STORAGE_KEY = 'nm-click-id';

/** The ad click ID from the landing URL, kept for the rest of the visit. */
export function clickId() {
  try {
    const fromUrl = new URLSearchParams(location.search).get(CLICK_ID_PARAM);
    if (fromUrl) sessionStorage.setItem(CLICK_ID_STORAGE_KEY, fromUrl);
    return sessionStorage.getItem(CLICK_ID_STORAGE_KEY);
  } catch {
    return new URLSearchParams(location.search).get(CLICK_ID_PARAM);
  }
}
