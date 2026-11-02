import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENCIES, pricesFromUsd, formatPrice, shippingCost } from '../../js/currency.js';

test('every currency gets an integer price in minor units', () => {
  const prices = pricesFromUsd(5800);
  for (const currency of CURRENCIES) assert.ok(Number.isInteger(prices[currency]), currency);
  assert.equal(prices.USD, 5800);
});

test('yen has no minor unit', () => {
  assert.equal(pricesFromUsd(5800).JPY % 100, 0);
  assert.match(formatPrice(9000, 'JPY'), /9,000/);
});

test('formats in the currency locale', () => {
  assert.equal(formatPrice(5800, 'USD'), '$58.00');
  assert.match(formatPrice(5400, 'EUR'), /54,00\s?€/);
});

test('an empty bag has no shipping charge', () => {
  assert.equal(shippingCost(0, 'USD'), 0);
});

test('free shipping over the threshold', () => {
  assert.ok(shippingCost(500, 'USD') > 0);
  assert.equal(shippingCost(20000, 'USD'), 0);
});
