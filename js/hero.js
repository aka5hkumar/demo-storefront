/**
 * Hero artwork: shows one random product per page load on the orange sun,
 * with a price tag that adds it to the bag.
 */
import { $ } from './dom.js';
import { state } from './state.js';
import { emit, on } from './events.js';
import { formatPrice } from './currency.js';
import { PRODUCTS, GENDER_LABELS } from './catalog.js';
import { garmentMarkup } from './garment.js';
import { updateSelection } from './selection.js';
import { addToBag } from './bag.js';

let heroProduct;

/** Espresso or cream read best on the orange background. */
function heroColorFor(product) {
  if (product.colors.includes('espresso')) return 'espresso';
  if (product.colors.includes('cream')) return 'cream';
  return product.colors[0];
}

function renderHeroPrice() {
  $('#hero-tag-price').textContent = formatPrice(heroProduct.prices[state.currency], state.currency);
}

export function initHero() {
  heroProduct = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const color = heroColorFor(heroProduct);

  // Tapping the tag adds the product in the colour shown.
  updateSelection(heroProduct, { color });

  $('#hero-product').innerHTML = garmentMarkup(heroProduct, color);

  const genderSuffix = heroProduct.gender === 'U' ? '' : ` · ${GENDER_LABELS[heroProduct.gender]}`;
  $('#hero-tag-name').textContent = heroProduct.name + genderSuffix;
  $('#hero-tag').setAttribute('aria-label', `Add ${heroProduct.name} to bag`);
  $('#hero-tag').addEventListener('click', () => addToBag(heroProduct, 'hero'));

  renderHeroPrice();
  on('currency_changed', renderHeroPrice);

  emit('hero_impression', { sku: heroProduct.sku });
}
