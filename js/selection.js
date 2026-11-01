/**
 * The colour and size currently chosen on each product card.
 * Shared by the shop grid, the hero and the bag.
 */
import { defaultSizeFor } from './catalog.js';

const selections = new Map();

/** @returns {{color: string, size: string}} */
export function getSelection(product) {
  if (!selections.has(product.sku)) {
    selections.set(product.sku, {
      color: product.colors[0],
      size: defaultSizeFor(product),
    });
  }
  return selections.get(product.sku);
}

export function updateSelection(product, changes) {
  Object.assign(getSelection(product), changes);
}
