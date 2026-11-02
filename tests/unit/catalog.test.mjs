import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PRODUCTS, GARMENTS, productDetails } from '../../js/catalog.js';

test('SKUs are unique', () => {
  assert.equal(new Set(PRODUCTS.map((product) => product.sku)).size, PRODUCTS.length);
});

test('every product has its own description and a fabric line', () => {
  const descriptions = PRODUCTS.map((product) => productDetails(product)?.description);
  for (const [index, description] of descriptions.entries()) {
    assert.ok(description, `${PRODUCTS[index].sku} has no description`);
    assert.ok(productDetails(PRODUCTS[index]).fabric, `${PRODUCTS[index].sku} has no fabric`);
  }
  assert.equal(new Set(descriptions).size, descriptions.length, 'two products share a description');
});

test('every garment shape has artwork', () => {
  for (const product of PRODUCTS) {
    assert.ok(GARMENTS[product.garment], `${product.sku}: unknown garment ${product.garment}`);
    assert.ok(existsSync(new URL(`../../assets/garments/${product.garment}.svg`, import.meta.url)), `${product.garment}.svg missing`);
  }
});

test('no sale badges (sale pricing is not modelled, and the pixel would report the wrong price)', () => {
  assert.ok(PRODUCTS.every((product) => !/%|sale/i.test(product.badge ?? '')));
});
