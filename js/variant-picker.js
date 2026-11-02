/**
 * Colour swatches and size buttons, shared by product cards and quick view.
 *
 * Markup helpers render the pickers; handleVariantClick() and the hover
 * helpers wire them up inside any root element that contains a `.garment`
 * and a `.swatches__label`.
 */
import { $, $$ } from './dom.js';
import { emit } from './events.js';
import { COLORS, isInStock } from './catalog.js';
import { paintGarment } from './garment.js';
import { getSelection, updateSelection } from './selection.js';
import { showToast } from './toast.js';

export function swatchesMarkup(product) {
  const { color: selected } = getSelection(product);

  const swatches = product.colors.map((colorKey) => `
    <button type="button" class="swatch" style="--swatch-color: ${COLORS[colorKey].hex}"
      data-color="${colorKey}" aria-label="${COLORS[colorKey].label}"
      aria-pressed="${colorKey === selected}"></button>
  `).join('');

  return `
    <div class="swatches" role="group" aria-label="Color">
      ${swatches}
      <span class="swatches__label">${COLORS[selected].label}</span>
    </div>`;
}

export function sizesMarkup(product) {
  const { size: selected } = getSelection(product);

  const sizes = product.sizes.map((size) => {
    if (!isInStock(product, size)) {
      return `<button type="button" class="is-sold-out" data-sold-out-size="${size}"
        aria-disabled="true" aria-label="${size}, out of stock" title="Out of stock">${size}</button>`;
    }
    return `<button type="button" data-size="${size}" aria-pressed="${size === selected}">${size}</button>`;
  }).join('');

  return `<div class="sizes" role="group" aria-label="Size">${sizes}</div>`;
}

/** Show a colour on the artwork and label inside `root`, without re-rendering. */
export function showColor(root, colorKey) {
  paintGarment($('.garment', root), colorKey);
  $('.swatches__label', root).textContent = COLORS[colorKey].label;
}

/**
 * Handle a click on a swatch or size button inside `root`.
 * @returns {boolean} true if the click was a variant click
 */
export function handleVariantClick(button, product, root) {
  const { color, size, soldOutSize } = button.dataset;

  if (color) {
    updateSelection(product, { color });
    $$('.swatch', root).forEach((swatch) => swatch.setAttribute('aria-pressed', swatch === button));
    showColor(root, color);
    emit('variant_selected', { sku: product.sku, color });
    return true;
  }

  if (size) {
    updateSelection(product, { size });
    $$('[data-size]', root).forEach((sizeButton) => sizeButton.setAttribute('aria-pressed', sizeButton === button));
    emit('variant_selected', { sku: product.sku, size });
    return true;
  }

  if (soldOutSize) {
    emit('size_unavailable', { sku: product.sku, size: soldOutSize });
    showToast(`Size ${soldOutSize} is out of stock`);
    return true;
  }

  return false;
}

/** Hovering a swatch previews its colour; leaving restores the chosen one. */
export function bindSwatchPreview(container, rootSelector, productFor) {
  container.addEventListener('mouseover', (event) => {
    const swatch = event.target.closest('.swatch');
    if (swatch) showColor(swatch.closest(rootSelector), swatch.dataset.color);
  });

  container.addEventListener('mouseout', (event) => {
    const swatch = event.target.closest('.swatch');
    if (!swatch || swatch.contains(event.relatedTarget)) return;

    const root = swatch.closest(rootSelector);
    showColor(root, getSelection(productFor(root)).color);
  });
}
