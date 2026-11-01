/**
 * Currencies, price conversion and formatting.
 * All prices are integers in the currency's minor unit (cents, pence; yen has none).
 */
import { readStorage, writeStorage } from './dom.js';

const STORAGE_KEY = 'nm-currency';

const LOCALES = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

/** Fixed demo rates from USD; prices round to whole units (whole 100 yen for JPY). */
const RATES_FROM_USD = {
  USD: 1,
  EUR: 0.93,
  GBP: 0.8,
  JPY: 150,
};

const ZERO_DECIMAL = new Set(['JPY']);

/** Free US shipping at or above this subtotal (USD cents); other regions ship free. */
const FREE_SHIPPING_THRESHOLD_USD = 10000;
const US_SHIPPING_FEE = 800;

export const CURRENCIES = Object.keys(LOCALES);

/** Build a { USD, EUR, GBP, JPY } price table from a USD price in cents. */
export function pricesFromUsd(usdCents) {
  const table = {};

  for (const code of CURRENCIES) {
    const majorUnits = (usdCents / 100) * RATES_FROM_USD[code];

    if (ZERO_DECIMAL.has(code)) {
      table[code] = Math.round(majorUnits / 100) * 100;
    } else {
      table[code] = Math.round(majorUnits) * 100;
    }
  }

  return table;
}

export function formatPrice(minorUnits, currency) {
  const amount = ZERO_DECIMAL.has(currency) ? minorUnits : minorUnits / 100;

  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency,
  }).format(amount);
}

export function shippingCost(subtotal, currency) {
  if (currency !== 'USD') return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD_USD ? 0 : US_SHIPPING_FEE;
}

export function loadSavedCurrency() {
  const saved = readStorage(STORAGE_KEY);
  return CURRENCIES.includes(saved) ? saved : 'USD';
}

export function saveCurrency(currency) {
  writeStorage(STORAGE_KEY, currency);
}
