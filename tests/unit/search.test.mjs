import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWords, matchesSearch } from '../../js/search.js';
import { PRODUCTS } from '../../js/catalog.js';

const search = (query) => PRODUCTS.filter((product) => matchesSearch(product, query));

test('splits, lowercases and folds plurals', () => {
  assert.deepEqual(toWords("Women's T-Shirts"), ['women', 'tshirt']);
  assert.deepEqual(toWords('dress'), ['dress']); // "ss" is not a plural
});

test('an empty query matches everything', () => {
  assert.equal(search('').length, PRODUCTS.length);
  assert.equal(search('   ').length, PRODUCTS.length);
});

test('synonyms: pants finds joggers and leggings, hat finds caps', () => {
  const pants = search('pants').map((product) => product.garment);
  assert.ok(pants.includes('joggers') || pants.includes('leggings'));
  assert.ok(pants.every((garment) => ['joggers', 'leggings'].includes(garment)));
  assert.ok(search('hat').every((product) => product.garment === 'cap'));
});

test('every word must match, and prefixes count', () => {
  const womenYoga = search('women yoga');
  assert.ok(womenYoga.length > 0);
  assert.ok(womenYoga.every((product) => product.gender !== 'M'));
  assert.ok(search('jack').every((product) => product.garment === 'jacket'));
});

test('"men" does not match women\'s products', () => {
  assert.ok(search('men').every((product) => product.gender !== 'W'));
});

test('nonsense matches nothing', () => {
  assert.equal(search('snorkel').length, 0);
});
