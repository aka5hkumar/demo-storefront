/**
 * Garment artwork.
 *
 * Each product is drawn from three SVG files used as CSS masks:
 *   assets/garments/{garment}.svg         silhouette (garment colour)
 *   assets/garments/{garment}-detail.svg  seams and zips (ink colour, optional)
 *   assets/icons/{icon}.svg               chest icon (ink colour)
 * Because the SVGs are masks, one file can be shown in any swatch colour.
 */
import { COLORS, GARMENTS, inkColorFor } from './catalog.js';

function maskStyle(path) {
  return `-webkit-mask-image: url(${path}); mask-image: url(${path});`;
}

function colorStyle(colorKey) {
  return `--garment-color: ${COLORS[colorKey].hex}; --garment-ink: ${inkColorFor(colorKey)};`;
}

/** HTML for a product drawn in the given colour. */
export function garmentMarkup(product, colorKey) {
  const { hasDetail, icon } = GARMENTS[product.garment];
  const iconPosition = `--icon-x: ${icon.x}%; --icon-y: ${icon.y}%; --icon-size: ${icon.size}%;`;

  const detailLayer = hasDetail
    ? `<span class="garment__layer garment__detail" style="${maskStyle(`assets/garments/${product.garment}-detail.svg`)}"></span>`
    : '';

  return `
    <div class="garment" style="${colorStyle(colorKey)} ${iconPosition}" aria-hidden="true">
      <span class="garment__layer garment__body" style="${maskStyle(`assets/garments/${product.garment}.svg`)}"></span>
      ${detailLayer}
      <span class="garment__icon" style="${maskStyle(`assets/icons/${product.icon}.svg`)}"></span>
    </div>`;
}

/** Recolour an existing .garment element (used for swatch hover previews). */
export function paintGarment(garmentElement, colorKey) {
  garmentElement.style.setProperty('--garment-color', COLORS[colorKey].hex);
  garmentElement.style.setProperty('--garment-ink', inkColorFor(colorKey));
}
