/**
 * Shop section: search, sort, gender/category filters, the product grid,
 * colour and size pickers on each card, and pagination.
 */
import { $, escapeHtml } from './dom.js';
import { state } from './state.js';
import { emit, on } from './events.js';
import { formatPrice } from './currency.js';
import { PRODUCTS, CARD_BACKGROUNDS, GENDER_LABELS, findProduct } from './catalog.js';
import { garmentMarkup } from './garment.js';
import { getSelection } from './selection.js';
import { matchesSearch } from './search.js';
import { swatchesMarkup, sizesMarkup, handleVariantClick, bindSwatchPreview } from './variant-picker.js';
import { addToBag } from './bag.js';
import { openQuickView } from './quick-view.js';

const PAGE_SIZE = 8;
const CATEGORIES = ['All', 'Run', 'Train', 'Outerwear', 'Yoga', 'Accessories'];
const GENDERS = ['All', 'Women', 'Men'];
const SEARCH_RENDER_DELAY_MS = 150;   // re-render while typing, lightly debounced
const SEARCH_EVENT_DELAY_MS = 800;    // record a search once the shopper pauses

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
  $('#product-search').addEventListener('input', handleSearchInput);
  $('#product-sort').addEventListener('change', handleSortChange);
  $('#product-grid').addEventListener('click', handleGridClick);

  bindSwatchPreview($('#product-grid'), '.product-card', (card) => findProduct(card.dataset.sku));

  // Nav links and hero buttons that jump to a category.
  document.addEventListener('click', handleCategoryLink);

  on('currency_changed', renderProductGrid);
  on('quick_view_closed', (event) => refreshCard(event.sku));
}

/* ----- Filtering, search and ordering ----- */

function matchesFilters(product) {
  const categoryMatches = state.category === 'All' || product.category === state.category;
  const genderMatches =
    state.gender === 'All' ||
    product.gender === 'U' ||
    product.gender === state.gender.charAt(0);

  return categoryMatches && genderMatches && matchesSearch(product, state.query);
}

function featuredRank(product) {
  const featured = FEATURED_SKUS[state.gender];
  const position = featured.indexOf(product.sku);
  if (position !== -1) return position;

  // In a gender view, push unisex accessories after gendered items.
  const unisexPenalty = state.gender !== 'All' && product.gender === 'U' ? 1 : 0;
  return featured.length + unisexPenalty;
}

const SORTS = {
  featured: (a, b) => featuredRank(a.product) - featuredRank(b.product),
  'price-asc': (a, b) => a.product.prices[state.currency] - b.product.prices[state.currency],
  'price-desc': (a, b) => b.product.prices[state.currency] - a.product.prices[state.currency],
};

function visibleProducts() {
  const compare = SORTS[state.sort] ?? SORTS.featured;

  return PRODUCTS
    .map((product, catalogIndex) => ({ product, catalogIndex }))
    .filter(({ product }) => matchesFilters(product))
    .sort((a, b) => compare(a, b) || a.catalogIndex - b.catalogIndex)
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
  const query = state.query.trim();

  $('#product-grid').innerHTML = products.length
    ? pageProducts.map(productCardMarkup).join('')
    : `<div class="no-results">
         <p>No matches for <b>“${escapeHtml(query)}”</b>${state.category !== 'All' || state.gender !== 'All' ? ' with these filters' : ''}.</p>
         <p>Try “jacket”, “yoga” or “women's tee”.</p>
         <button type="button" class="button button--outline-dark" data-clear-search>Clear search and filters</button>
       </div>`;

  const itemWord = `${products.length} item${products.length === 1 ? '' : 's'}`;
  $('#result-count').textContent = query ? `${itemWord} for “${query}”` : itemWord;
  renderPager(pageCount);
}

function productCardMarkup(product, index) {
  const selection = getSelection(product);
  const badge = product.badge ? `<span class="product-card__badge">${product.badge}</span>` : '';

  return `
    <article class="product-card" data-sku="${product.sku}" style="animation-delay: ${index * 40}ms">
      <div class="product-card__image" style="background: ${CARD_BACKGROUNDS[product.background]}">
        <button type="button" class="product-card__view" data-quick-view aria-label="Quick view: ${escapeHtml(product.name)}, ${GENDER_LABELS[product.gender]}"></button>
        ${badge}
        ${garmentMarkup(product, selection.color)}
        <button type="button" class="product-card__add" data-add-to-bag data-track="add_to_cart">+ Add</button>
      </div>
      <div class="product-card__title">
        <h3><button type="button" class="product-card__name" data-quick-view>${escapeHtml(product.name)}</button></h3>
        <span class="product-card__gender">${GENDER_LABELS[product.gender]}</span>
      </div>
      <div class="product-card__price">${formatPrice(product.prices[state.currency], state.currency)}</div>
      ${swatchesMarkup(product)}
      ${sizesMarkup(product)}
    </article>`;
}

/** Re-render one card in place (after its colour or size changed in quick view). */
export function refreshCard(sku) {
  const card = document.querySelector(`.product-card[data-sku="${sku}"]`);
  if (!card) return;

  // If focus was on this card (it returns there when the quick view closes),
  // put it back on the same button in the new card.
  const buttons = (root) => [...root.querySelectorAll('button')];
  const focusedIndex = buttons(card).indexOf(document.activeElement);

  const template = document.createElement('template');
  template.innerHTML = productCardMarkup(findProduct(sku), 0).trim();
  const fresh = template.content.firstElementChild;
  fresh.style.animation = 'none';
  card.replaceWith(fresh);

  if (focusedIndex !== -1) buttons(fresh)[focusedIndex]?.focus();
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

let searchRenderTimer;
let searchEventTimer;

function handleSearchInput(event) {
  state.query = event.target.value;
  state.page = 1;

  clearTimeout(searchRenderTimer);
  searchRenderTimer = setTimeout(renderProductGrid, SEARCH_RENDER_DELAY_MS);

  // One search event per pause in typing, not one per keystroke.
  clearTimeout(searchEventTimer);
  searchEventTimer = setTimeout(() => {
    const query = state.query.trim();
    if (query) emit('search', { query, results: visibleProducts().length });
  }, SEARCH_EVENT_DELAY_MS);
}

function handleSortChange(event) {
  state.sort = event.target.value;
  state.page = 1;
  renderProductGrid();
  emit('sort_changed', { sort: state.sort });
}

function clearSearchAndFilters() {
  state.query = '';
  $('#product-search').value = '';
  setFilter({ gender: 'All', category: 'All' });
  $('#product-search').focus();
}

function handlePagerClick(event) {
  const button = event.target.closest('button[data-page]');
  if (!button || button.disabled) return;

  state.page = Number(button.dataset.page);
  renderProductGrid();
  $('#shop').scrollIntoView({ behavior: 'smooth' });
}

function handleGridClick(event) {
  const button = event.target.closest('button');
  if (!button) return;

  if ('clearSearch' in button.dataset) {
    clearSearchAndFilters();
    return;
  }

  const card = button.closest('.product-card');
  if (!card) return;
  const product = findProduct(card.dataset.sku);

  if ('quickView' in button.dataset) {
    openQuickView(product);
  } else if ('addToBag' in button.dataset) {
    addToBag(product, 'product_card');
  } else {
    handleVariantClick(button, product, card);
  }
}
