/**
 * Vendor-neutral event bus.
 *
 * UI code calls emit() for every meaningful shopper action. Tracking
 * integrations (console logger now; an ad-platform Pixel / Conversions API later)
 * subscribe with on() — no UI code ever calls a vendor SDK directly.
 *
 * Every event carries: name, id (dedup key), timestamp and currency.
 * Prices in payloads are integers in the currency's minor unit.
 */
import { state } from './state.js';

const bus = new EventTarget();

function createEventId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Publish an event. Pass `id` in detail to set a stable dedup key (e.g. an order number). */
export function emit(name, detail = {}) {
  const event = {
    name,
    id: detail.id ?? createEventId(),
    timestamp: Date.now(),
    currency: state.currency,
    ...detail,
  };

  bus.dispatchEvent(new CustomEvent(name, { detail: event }));
  bus.dispatchEvent(new CustomEvent('*', { detail: event }));
  return event;
}

/** Subscribe to one event name, or '*' for all. Returns an unsubscribe function. */
export function on(name, handler) {
  const listener = (domEvent) => handler(domEvent.detail);
  bus.addEventListener(name, listener);
  return () => bus.removeEventListener(name, listener);
}
