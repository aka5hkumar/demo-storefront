/**
 * Shared in-memory state for the storefront.
 *
 * Currency is persisted separately (see currency.js); bag.js restores saved
 * cart lines and their cart/order reference when available.
 */
export const state = {
  /** Active currency code: USD, EUR, GBP or JPY. */
  currency: 'USD',

  /** Shop filters and pagination. */
  category: 'All',
  gender: 'All',
  page: 1,
  query: '',
  sort: 'featured', // featured | price-asc | price-desc

  /**
   * Bag lines keyed by "sku|color|size".
   * @type {Map<string, {sku: string, color: string, size: string, quantity: number}>}
   */
  bag: new Map(),

  /** Index into CHECKOUT_STEPS in bag.js. */
  checkoutStep: 0,
  /** Stable cart/order reference, created on the first product content view. */
  orderId: null,

  /**
   * Contact and shipping details entered at checkout (email, name, phone,
   * street, city, region, postcode, country). Reset after each order.
   * Kept out of event payloads; future adapters read it to hash for matching.
   */
  customer: {},

  /**
   * Email entered when joining Motion Club. Like `customer`, kept out of event
   * payloads; the tracking adapters hash it for the trial/subscription events.
   */
  member: {},
};

/** Create a readable, high-entropy cart/order reference. */
export function createOrderId() {
  const randomId = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  return `NM-${randomId.toUpperCase()}`;
}

/** Return the current cart/order reference, creating one when needed. */
export function ensureOrderId() {
  state.orderId ??= createOrderId();
  return state.orderId;
}
