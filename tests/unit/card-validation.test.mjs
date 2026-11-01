import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCard, detectCardBrand, passesLuhn, formatCardNumber, isDeclinedTestCard } from '../../js/card-validation.js';

const valid = { number: '4242 4242 4242 4242', expiry: '12/40', cvc: '123' };

test('accepts the standard test card', () => {
  assert.equal(validateCard(valid), null);
});

test('Luhn check', () => {
  assert.equal(passesLuhn('4242424242424242'), true);
  assert.equal(passesLuhn('4242424242424241'), false);
});

test('detects brands by prefix', () => {
  assert.equal(detectCardBrand('4242')?.label, 'Visa');
  assert.equal(detectCardBrand('5555555555554444')?.label, 'Mastercard');
  assert.equal(detectCardBrand('378282246310005')?.label, 'American Express');
  assert.equal(detectCardBrand('9999'), null);
});

test('rejects bad numbers, expired dates and short CVCs', () => {
  assert.equal(validateCard({ ...valid, number: '4242 4242 4242 4241' }).reason, 'failed_checksum');
  assert.equal(validateCard({ ...valid, number: '4242 4242' }).reason, 'bad_length');
  assert.equal(validateCard({ ...valid, expiry: '01/20' }).field, 'expiry');
  assert.equal(validateCard({ ...valid, expiry: '13/40' }).field, 'expiry');
  assert.equal(validateCard({ ...valid, cvc: '12' }).reason, 'bad_cvc');
  assert.equal(validateCard({ ...valid, number: '3782 822463 10005', cvc: '123' }).reason, 'bad_cvc'); // Amex needs 4
});

test('formats in groups and knows the declined test card', () => {
  assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(isDeclinedTestCard('4000 0000 0000 0002'), true);
  assert.equal(isDeclinedTestCard('4242 4242 4242 4242'), false);
});
