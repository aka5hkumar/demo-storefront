/**
 * Shared in-memory state for the storefront.
 *
 * Only the chosen currency is persisted (see currency.js). The bag always
 * starts empty, so every demo session produces fresh add_to_cart events.
 */
export const state = {
  /** Active currency code: USD, EUR, GBP or JPY. */
  currency: 'USD',

  /** Shop filters and pagination. */
  category: 'All',
  gender: 'All',
  page: 1,

  /**
   * Bag lines keyed by "sku|color|size".
   * @type {Map<string, {sku: string, color: string, size: string, quantity: number}>}
   */
  bag: new Map(),

  /** Index into CHECKOUT_STEPS in bag.js. */
  checkoutStep: 0,
  orderId: null,

  /**
   * Contact and shipping details entered at checkout (email, name, phone,
   * street, city, region, postcode, country). Reset after each order.
   * Kept out of event payloads; future adapters read it to hash for matching.
   */
  customer: {},
};
