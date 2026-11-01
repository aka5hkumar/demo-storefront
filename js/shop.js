/**
 * Shop section: gender/category filters, product grid, colour and size
 * pickers on each card, and pagination.
 */
import { $, $$ } from './dom.js';
import { state } from './state.js';
import { emit, on } from './events.js';
import { formatPrice } from './currency.js';
import {
  PRODUCTS, COLORS, CARD_BACKGROUNDS, GENDER_LABELS, findProduct, isInStock,
} from './catalog.js';
import { garmentMarkup, paintGarment } from './garment.js';
import { getSelection, updateSelection } from './selection.js';
import { addToBag } from './bag.js';
import { showToast } from './toast.js';

const PAGE_SIZE = 8;
const CATEGORIES = ['All', 'Run', 'Train', 'Outerwear', 'Yoga', 'Accessories'];
const GENDERS = ['All', 'Women', 'Men'];

/**
 * Products shown first for each gender view, so switching the toggle visibly
 * changes the top row. Everything else follows in catalogue order.
 */
const FEATURED_SKUS = {
  All:   ['CKE-TEE-W', 'RUN-JK-M', 'YOG-LG-W', 'ACC-CAP-U', 'RUN-SH-M', 'YOG-BR-W', 'OUT-SH-W', 'YOG-MAT-U'],
  Women: ['CKE-TEE-W', 'YOG-BR-W', 'YOG-LG-W', 'RUN-SH-W'],
  Men:   ['CKE-TEE-M', 'TRN-TNK-M', 'RUN-SH-M', 'OUT-VS-M'],
};

export function initShop() {
  renderFilters();
  renderProductGrid();

  $('#filters').addEventListener('click', handleFilterClick);
  $('#pager').addEventListener('click', handlePagerClick);

  const grid = $('#product-grid');
  grid.addEventListener('click', handleCardClick);
  grid.addEventListener('mouseover', previewSwatchColor);
  grid.addEventListener('mouseout', endSwatchPreview);

  // Nav links and hero buttons that jump to a category.
  document.addEventListener('click', handleCategoryLink);

  on('currency_changed', renderProductGrid);
}

/* ----- Filtering and ordering ----- */

function matchesFilters(product) {
  const categoryMatches = state.category === 'All' || product.category === state.category;
  const genderMatches =
    state.gender === 'All' ||
    product.gender === 'U' ||
    product.gender === state.gender.charAt(0);

  return categoryMatches && genderMatches;
}

function sortRank(product) {
  const featured = FEATURED_SKUS[state.gender];
  const position = featured.indexOf(product.sku);
  if (position !== -1) return position;

  // In a gender view, push unisex accessories after gendered items.
  const unisexPenalty = state.gender !== 'All' && product.gender === 'U' ? 1 : 0;
  return featured.length + unisexPenalty;
}

function visibleProducts() {
  return PRODUCTS
    .map((product, catalogIndex) => ({ product, catalogIndex }))
    .filter(({ product }) => matchesFilters(product))
    .sort((a, b) => sortRank(a.product) - sortRank(b.product) || a.catalogIndex - b.catalogIndex)
    .map(({ product }) => product);
}

function setFilter(changes) {
  Object.assign(state, changes, { page: 1 });
  renderFilters();
  renderProductGrid();
  emit('filter_changed', { gender: state.gender, category: state.category });
}

/* ----- Rendering ----- */

function renderFilters() {
  const genderButtons = GENDERS.map((gender) => `
    <button type="button" data-gender="${gender}" aria-pressed="${gender === state.gender}">${gender}</button>
  `).join('');

  const categoryButtons = CATEGORIES.map((category) => `
    <button type="button" class="category-pill" data-filter-category="${category}" aria-pressed="${category === state.category}">${category}</button>
  `).join('');

  $('#filters').innerHTML = `
    <div class="gender-toggle" role="group" aria-label="Shop for">${genderButtons}</div>
    ${categoryButtons}`;
}

export function renderProductGrid() {
  const products = visibleProducts();
  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount);

  const pageStart = (state.page - 1) * PAGE_SIZE;
  const pageProducts = products.slice(pageStart, pageStart + PAGE_SIZE);

  $('#product-grid').innerHTML = pageProducts.map(productCardMarkup).join('');
  $('#result-count').textContent = `${products.length} item${products.length === 1 ? '' : 's'}`;
  renderPager(pageCount);
}

function productCardMarkup(product, index) {
  const selection = getSelection(product);

  const badge = product.badge
    ? `<span class="product-card__badge">${product.badge}</span>`
    : '';

  const swatches = product.colors.map((colorKey) => `
    <button type="button" class="swatch" style="--swatch-color: ${COLORS[colorKey].hex}"
      data-color="${colorKey}" aria-label="${COLORS[colorKey].label}"
      aria-pressed="${colorKey === selection.color}"></button>
  `).join('');

  const sizes = product.sizes.map((size) => {
    if (!isInStock(product, size)) {
      return `<button type="button" class="is-sold-out" data-sold-out-size="${size}"
        aria-disabled="true" aria-label="${size}, out of stock" title="Out of stock">${size}</button>`;
    }
    return `<button type="button" data-size="${size}" aria-pressed="${size === selection.size}">${size}</button>`;
  }).join('');

  return `
    <article class="product-card" data-sku="${product.sku}" style="animation-delay: ${index * 40}ms">
      <div class="product-card__image" style="background: ${CARD_BACKGROUNDS[product.background]}">
        ${badge}
        ${garmentMarkup(product, selection.color)}
        <button type="button" class="product-card__add" data-add-to-bag data-track="add_to_cart">+ Add</button>
      </div>
      <div class="product-card__title">
        <h3>${product.name}</h3>
        <span class="product-card__gender">${GENDER_LABELS[product.gender]}</span>
      </div>
      <div class="product-card__price">${formatPrice(product.prices[state.currency], state.currency)}</div>
      <div class="swatches" role="group" aria-label="Colour">
        ${swatches}
        <span class="swatches__label">${COLORS[selection.color].label}</span>
      </div>
      <div class="sizes" role="group" aria-label="Size">${sizes}</div>
    </article>`;
}

function renderPager(pageCount) {
  if (pageCount < 2) {
    $('#pager').innerHTML = '';
    return;
  }

  const pageButtons = Array.from({ length: pageCount }, (_, i) => {
    const page = i + 1;
    const current = page === state.page ? 'page' : 'false';
    return `<button type="button" data-page="${page}" aria-current="${current}">${page}</button>`;
  }).join('');

  $('#pager').innerHTML = `
    <button type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? 'disabled' : ''}>←</button>
    ${pageButtons}
    <button type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === pageCount ? 'disabled' : ''}>→</button>`;
}

/** Update one card's swatch label and artwork colour without re-rendering it. */
function showCardColor(card, colorKey) {
  paintGarment($('.garment', card), colorKey);
  $('.swatches__label', card).textContent = COLORS[colorKey].label;
}

/* ----- Event handlers ----- */

function handleFilterClick(event) {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.gender) setFilter({ gender: button.dataset.gender });
  if (button.dataset.filterCategory) setFilter({ category: button.dataset.filterCategory });
}

function handleCategoryLink(event) {
  const link = event.target.closest('a[data-category]');
  if (link) setFilter({ category: link.dataset.category });
}

function handlePagerClick(event) {
  const button = event.target.closest('button[data-page]');
  if (!button || button.disabled) return;

  state.page = Number(button.dataset.page);
  renderProductGrid();
  $('#shop').scrollIntoView({ behavior: 'smooth' });
}

function handleCardClick(event) {
  const button = event.target.closest('button');
  const card = event.target.closest('.product-card');
  if (!button || !card) return;

  const product = findProduct(card.dataset.sku);
  const { color, size, soldOutSize } = button.dataset;

  if (color) {
    updateSelection(product, { color });
    $$('.swatch', card).forEach((swatch) => swatch.setAttribute('aria-pressed', swatch === button));
    showCardColor(card, color);
    emit('variant_selected', { sku: product.sku, color });
  } else if (size) {
    updateSelection(product, { size });
    $$('[data-size]', card).forEach((sizeButton) => sizeButton.setAttribute('aria-pressed', sizeButton === button));
    emit('variant_selected', { sku: product.sku, size });
  } else if (soldOutSize) {
    emit('size_unavailable', { sku: product.sku, size: soldOutSize });
    showToast(`Size ${soldOutSize} is out of stock`);
  } else if ('addToBag' in button.dataset) {
    addToBag(product, 'product_card');
  }
}

/** Hovering a swatch previews that colour; leaving restores the chosen one. */
function previewSwatchColor(event) {
  const swatch = event.target.closest('.swatch');
  if (swatch) showCardColor(swatch.closest('.product-card'), swatch.dataset.color);
}

function endSwatchPreview(event) {
  const swatch = event.target.closest('.swatch');
  if (!swatch || swatch.contains(event.relatedTarget)) return;

  const card = swatch.closest('.product-card');
  showCardColor(card, getSelection(findProduct(card.dataset.sku)).color);
}
