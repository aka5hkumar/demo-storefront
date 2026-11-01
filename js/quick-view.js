/**
 * Product quick view: a larger look at one product, with description,
 * fabric and fit, the same colour and size pickers as the card, and Add to bag.
 *
 * Opening it emits product_viewed (the "viewed content" signal for tracking)
 * and sets the URL to #p-{SKU}, so a product can be linked to directly.
 */
import { $ } from './dom.js';
import { state } from './state.js';
import { emit, on } from './events.js';
import { formatPrice } from './currency.js';
import { CARD_BACKGROUNDS, GENDER_LABELS, GARMENT_DETAILS, findProduct } from './catalog.js';
import { garmentMarkup } from './garment.js';
import { getSelection } from './selection.js';
import { swatchesMarkup, sizesMarkup, handleVariantClick, bindSwatchPreview } from './variant-picker.js';
import { openDialog, closeDialog, isDialogOpen } from './focus.js';
import { addToBag } from './bag.js';

const HASH_PREFIX = '#p-';
let currentProduct = null;

function quickViewMarkup(product) {
  const details = GARMENT_DETAILS[product.garment];
  const fitRow = details.fit ? `<dt>Fit</dt><dd>${details.fit}</dd>` : '';

  return `
    <div class="quick-view__image" style="background: ${CARD_BACKGROUNDS[product.background]}">
      ${product.badge ? `<span class="product-card__badge">${product.badge}</span>` : ''}
      ${garmentMarkup(product, getSelection(product).color)}
    </div>
    <div class="quick-view__info">
      <span class="product-card__gender">${GENDER_LABELS[product.gender]} · ${product.category}</span>
      <h2 class="display" id="quick-view-title">${product.name}</h2>
      <div class="quick-view__price">${formatPrice(product.prices[state.currency], state.currency)}</div>
      <p class="quick-view__description">${details.description}</p>
      ${swatchesMarkup(product)}
      ${sizesMarkup(product)}
      <button type="button" class="button button--primary quick-view__add" data-add-to-bag data-track="add_to_cart">Add to bag</button>
      <dl class="quick-view__details">
        <dt>Fabric</dt><dd>${details.fabric}</dd>
        ${fitRow}
        <dt>Item</dt><dd>${product.sku}</dd>
      </dl>
    </div>`;
}

function render() {
  $('#quick-view-body').innerHTML = quickViewMarkup(currentProduct);
}

export function openQuickView(product, source = 'product_card') {
  currentProduct = product;
  render();

  const modal = $('#quick-view');
  modal.hidden = false;
  openDialog(modal, $('#quick-view-close'));

  history.replaceState(null, '', `${HASH_PREFIX}${product.sku}`);
  emit('product_viewed', { sku: product.sku, source });
}

function closeQuickView() {
  const modal = $('#quick-view');
  if (modal.hidden) return;

  modal.hidden = true;
  closeDialog(modal);
  history.replaceState(null, '', location.pathname + location.search);

  // The grid card shows the colour/size picked here.
  emit('quick_view_closed', { sku: currentProduct.sku });
}

function handleClick(event) {
  if (event.target.id === 'quick-view') {
    closeQuickView(); // click on the backdrop
    return;
  }

  const button = event.target.closest('button');
  if (!button) return;

  if (button.id === 'quick-view-close') {
    closeQuickView();
  } else if ('addToBag' in button.dataset) {
    const product = currentProduct;
    closeQuickView();
    addToBag(product, 'quick_view');
  } else {
    handleVariantClick(button, currentProduct, $('#quick-view-body'));
  }
}

/** Open the product named in the URL (#p-SKU), if any.
 *  (replaceState in open/close doesn't fire hashchange, so this can't loop.) */
function openFromHash() {
  if (!location.hash.startsWith(HASH_PREFIX)) return;
  const product = findProduct(location.hash.slice(HASH_PREFIX.length));
  if (product) openQuickView(product, 'link');
}

export function initQuickView() {
  const modal = $('#quick-view');
  modal.addEventListener('click', handleClick);
  bindSwatchPreview(modal, '#quick-view-body', () => currentProduct);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isDialogOpen(modal)) closeQuickView();
  });

  on('currency_changed', () => {
    if (!modal.hidden) render();
  });

  // On load, and when a #p-SKU link is followed within the page.
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
}
