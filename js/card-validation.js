/**
 * Local card checks for the demo payment step. Nothing is sent anywhere.
 *
 * A number is accepted only if it:
 *   1. matches a known issuer prefix and length (Visa, Mastercard, Amex, Discover)
 *   2. passes the Luhn checksum (the last digit is a check digit)
 * Expiry must be a real MM/YY that hasn't passed; CVC is 3 digits (4 for Amex).
 *
 * Test cards:
 *   4242 4242 4242 4242  approved
 *   4000 0000 0000 0002  valid number, always declined
 */

const CARD_BRANDS = [
  { id: 'amex',       label: 'American Express', pattern: /^3[47]/,                                lengths: [15],         cvcLength: 4 },
  { id: 'visa',       label: 'Visa',             pattern: /^4/,                                    lengths: [13, 16, 19], cvcLength: 3 },
  { id: 'mastercard', label: 'Mastercard',       pattern: /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/, lengths: [16], cvcLength: 3 },
  { id: 'discover',   label: 'Discover',         pattern: /^(6011|64[4-9]|65)/,                     lengths: [16, 17, 18, 19], cvcLength: 3 },
];

const DECLINED_TEST_CARD = '4000000000000002';

export const digitsOnly = (value) => String(value).replace(/\D/g, '');

/** [13, 16, 19] → "13, 16 or 19" */
const listLengths = (lengths) =>
  lengths.length === 1 ? String(lengths[0]) : `${lengths.slice(0, -1).join(', ')} or ${lengths.at(-1)}`;

/** The card brand for a (partial) number, or null if no brand matches. */
export function detectCardBrand(number) {
  const digits = digitsOnly(number);
  return CARD_BRANDS.find((brand) => brand.pattern.test(digits)) ?? null;
}

/** Luhn checksum: double every second digit from the right; the total must end in 0. */
export function passesLuhn(number) {
  const digits = digitsOnly(number);
  let sum = 0;

  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return digits.length > 0 && sum % 10 === 0;
}

/** Group digits for display: 4-6-5 for Amex, otherwise groups of 4. */
export function formatCardNumber(number) {
  const digits = digitsOnly(number).slice(0, 19);
  const groups = detectCardBrand(digits)?.id === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3];

  const parts = [];
  let position = 0;
  for (const size of groups) {
    if (position >= digits.length) break;
    parts.push(digits.slice(position, position + size));
    position += size;
  }
  return parts.join(' ');
}

function validateExpiry(expiry, now = new Date()) {
  const match = String(expiry).trim().match(/^(\d{1,2})\s*\/\s*(\d{2})$/);
  if (!match) return 'Enter the expiry as MM/YY.';

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'That expiry month isn\'t valid.';

  // Cards are valid through the last day of their expiry month.
  const firstDayAfterExpiry = new Date(year, month, 1);
  if (firstDayAfterExpiry <= now) return 'This card has expired.';

  return null;
}

/**
 * Check the payment fields.
 * @returns {{ field: 'number'|'expiry'|'cvc', message: string, reason: string } | null}
 *   null when everything is valid.
 */
export function validateCard({ number, expiry, cvc }) {
  const digits = digitsOnly(number);
  const brand = detectCardBrand(digits);

  if (!brand) {
    return { field: 'number', reason: 'unknown_brand', message: 'That card number isn\'t valid.' };
  }
  if (!brand.lengths.includes(digits.length)) {
    return { field: 'number', reason: 'bad_length', message: `${brand.label} numbers have ${listLengths(brand.lengths)} digits.` };
  }
  if (!passesLuhn(digits)) {
    return { field: 'number', reason: 'failed_checksum', message: 'That card number isn\'t valid. Check for a typo.' };
  }

  const expiryError = validateExpiry(expiry);
  if (expiryError) return { field: 'expiry', reason: 'bad_expiry', message: expiryError };

  if (digitsOnly(cvc).length !== brand.cvcLength || /\D/.test(String(cvc).trim())) {
    return { field: 'cvc', reason: 'bad_cvc', message: `Enter the ${brand.cvcLength}-digit security code.` };
  }

  return null;
}

/** Simulated processor response for a locally valid card. */
export function isDeclinedTestCard(number) {
  return digitsOnly(number) === DECLINED_TEST_CARD;
}
