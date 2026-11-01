/**
 * Product search: plain matching over a small hand-made index, no library.
 *
 * Every word the shopper types must match the start of at least one word in
 * the product's index (so "jack" finds jackets and "women yoga" needs both).
 * The index holds the product name, category, gender words, colours, icon,
 * and everyday synonyms for each garment ("pants" finds joggers and leggings,
 * "hat" finds caps).
 */
import { COLORS } from './catalog.js';

const GARMENT_WORDS = {
  'tee':         ['tee', 'tshirt', 'shirt', 'top'],
  'crop':        ['crop', 'cropped', 'tee', 'tshirt', 'shirt', 'top'],
  'boxy':        ['tee', 'tshirt', 'shirt', 'top', 'heavyweight', 'oversized'],
  'tank':        ['tank', 'top', 'singlet', 'sleeveless'],
  'long-sleeve': ['long', 'sleeve', 'longsleeve', 'top', 'shirt', 'crew'],
  'half-zip':    ['halfzip', 'zip', 'pullover', 'top', 'layer', 'midlayer'],
  'hoodie':      ['hoodie', 'hoody', 'sweatshirt', 'top', 'layer'],
  'jacket':      ['jacket', 'shell', 'coat', 'rain', 'outerwear', 'layer'],
  'vest':        ['vest', 'gilet', 'puffer', 'outerwear', 'layer'],
  'shorts':      ['shorts', 'bottoms'],
  'leggings':    ['leggings', 'tights', 'pants', 'bottoms'],
  'joggers':     ['joggers', 'pants', 'sweatpants', 'trousers', 'bottoms'],
  'sports-bra':  ['bra', 'sportsbra', 'top'],
  'cap':         ['cap', 'hat'],
  'socks':       ['socks'],
  'bottle':      ['bottle', 'water'],
  'mat':         ['mat', 'yoga'],
  'duffel':      ['bag', 'duffel', 'gym'],
};

const GENDER_WORDS = {
  W: ['women', 'woman', 'ladies', 'female'],
  M: ['men', 'man', 'male'],
  U: ['unisex', 'women', 'woman', 'ladies', 'men', 'man'], // like the gender filter: unisex shows for both
};

/** Lowercase, drop apostrophes, split into words, and fold simple plurals. */
export function toWords(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/-/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));
}

const indexCache = new Map();

function searchIndex(product) {
  if (!indexCache.has(product.sku)) {
    const words = new Set(toWords([
      product.name,
      product.category,
      product.icon,
      product.badge ?? '',
      ...(GARMENT_WORDS[product.garment] ?? []),
      ...GENDER_WORDS[product.gender],
      ...product.colors.map((key) => COLORS[key].label),
    ].join(' ')));
    indexCache.set(product.sku, [...words]);
  }
  return indexCache.get(product.sku);
}

/** True when every word of the query starts some word in the product's index. */
export function matchesSearch(product, query) {
  const queryWords = toWords(query);
  if (!queryWords.length) return true;

  const index = searchIndex(product);
  return queryWords.every((queryWord) => index.some((word) => word.startsWith(queryWord)));
}
