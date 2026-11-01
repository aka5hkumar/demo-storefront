/**
 * Product catalogue: colours, garment shapes, size runs, stock and products.
 * Artwork lives in assets/garments and assets/icons; see garment.js.
 */
import { pricesFromUsd } from './currency.js';

/* ----- Colours ----- */

export const COLORS = {
  espresso:   { hex: '#2A1A14', label: 'Espresso' },
  cocoa:      { hex: '#6B4130', label: 'Cocoa' },
  rust:       { hex: '#9E3F24', label: 'Rust' },
  terracotta: { hex: '#D2582F', label: 'Terracotta' },
  saffron:    { hex: '#F2A93B', label: 'Saffron' },
  sand:       { hex: '#D9B98C', label: 'Sand' },
  clay:       { hex: '#E7C9A9', label: 'Clay' },
  blush:      { hex: '#EDB59B', label: 'Blush' },
  cream:      { hex: '#F6EEE3', label: 'Cream' },
  olive:      { hex: '#6E6A3A', label: 'Olive' },
};

/** Light garment colours get a dark icon; dark ones get a cream icon. */
const LIGHT_COLORS = new Set(['saffron', 'sand', 'clay', 'blush', 'cream']);

export function inkColorFor(colorKey) {
  return LIGHT_COLORS.has(colorKey) ? COLORS.espresso.hex : COLORS.cream.hex;
}

/* ----- Garment shapes -----
   `icon` places the product icon on the silhouette, as percentages of the
   200 × 240 artwork box. `hasDetail` means a {name}-detail.svg seam layer exists. */

export const GARMENTS = {
  'tee':         { hasDetail: false, icon: { x: 41, y: 30.8, size: 18 } },
  'crop':        { hasDetail: true,  icon: { x: 41, y: 29.2, size: 18 } },
  'boxy':        { hasDetail: false, icon: { x: 40, y: 31.7, size: 20 } },
  'tank':        { hasDetail: false, icon: { x: 42, y: 43.3, size: 16 } },
  'long-sleeve': { hasDetail: false, icon: { x: 41, y: 30,   size: 18 } },
  'half-zip':    { hasDetail: true,  icon: { x: 55, y: 26.7, size: 12 } },
  'hoodie':      { hasDetail: true,  icon: { x: 41, y: 34.2, size: 18 } },
  'jacket':      { hasDetail: true,  icon: { x: 54, y: 25.8, size: 12 } },
  'vest':        { hasDetail: true,  icon: { x: 55, y: 30.8, size: 12 } },
  'shorts':      { hasDetail: true,  icon: { x: 32, y: 38.3, size: 13 } },
  'leggings':    { hasDetail: true,  icon: { x: 35, y: 24.2, size: 11 } },
  'joggers':     { hasDetail: true,  icon: { x: 33, y: 24.2, size: 11 } },
  'sports-bra':  { hasDetail: true,  icon: { x: 43, y: 32.5, size: 14 } },
  'cap':         { hasDetail: true,  icon: { x: 39, y: 38.3, size: 22 } },
  'socks':       { hasDetail: true,  icon: { x: 45, y: 33.3, size: 12 } },
  'bottle':      { hasDetail: true,  icon: { x: 41, y: 45.8, size: 18 } },
  'mat':         { hasDetail: true,  icon: { x: 28, y: 46.7, size: 18 } },
  'duffel':      { hasDetail: true,  icon: { x: 41, y: 54.2, size: 18 } },
};

/**
 * Copy for the quick-view panel, per garment shape.
 * `fit` is shown for clothing only.
 */
export const GARMENT_DETAILS = {
  'tee':         { description: 'A light, quick-drying tee with flat seams that stay put mile after mile.', fabric: '88% recycled polyester, 12% elastane', fit: 'Regular fit' },
  'crop':        { description: 'A cropped, boxy tee that sits just above high-rise leggings and shorts.', fabric: '100% organic cotton jersey', fit: 'Relaxed, cropped fit' },
  'boxy':        { description: 'A heavyweight cotton tee with a dropped shoulder and a structured drape.', fabric: '100% organic cotton, 240 gsm', fit: 'Oversized fit' },
  'tank':        { description: 'A breezy tank with a racer back for full range of motion.', fabric: '92% recycled polyester, 8% elastane', fit: 'Regular fit' },
  'long-sleeve': { description: 'A soft long sleeve for cool starts, with thumbholes to keep sleeves in place.', fabric: '84% recycled polyester, 16% elastane', fit: 'Slim fit' },
  'half-zip':    { description: 'A brushed-back half-zip layer that traps warmth without the bulk.', fabric: '90% recycled polyester, 10% elastane, brushed back', fit: 'Regular fit' },
  'hoodie':      { description: 'A midweight hoodie for warm-ups, cool-downs and everything after.', fabric: '80% organic cotton, 20% recycled polyester fleece', fit: 'Relaxed fit' },
  'jacket':      { description: 'A packable, water-resistant shell with reflective details for low light.', fabric: '100% recycled nylon ripstop, PFC-free DWR finish', fit: 'Regular fit' },
  'vest':        { description: 'A lightly insulated vest that keeps your core warm and your arms free.', fabric: '100% recycled nylon, recycled synthetic fill', fit: 'Regular fit' },
  'shorts':      { description: 'Lightweight shorts with a built-in liner and a zip pocket for keys.', fabric: '100% recycled polyester woven, mesh liner', fit: 'Regular fit' },
  'leggings':    { description: 'High-rise, squat-proof tights with a hidden waistband pocket.', fabric: '74% recycled nylon, 26% elastane', fit: 'Second-skin fit' },
  'joggers':     { description: 'Tapered joggers with a soft brushed inside and deep pockets.', fabric: '78% organic cotton, 22% recycled polyester', fit: 'Tapered fit' },
  'sports-bra':  { description: 'Medium support with removable cups and a wide, comfortable band.', fabric: '75% recycled nylon, 25% elastane', fit: 'Medium support' },
  'cap':         { description: 'A lightweight, packable cap with a sweat-wicking band.', fabric: '100% recycled polyester, adjustable strap' },
  'socks':       { description: 'Cushioned crew socks with arch support and a seamless toe.', fabric: '62% merino wool, 35% nylon, 3% elastane' },
  'bottle':      { description: 'Double-walled steel keeps drinks cold for 24 hours or hot for 12.', fabric: '18/8 stainless steel, 750 ml' },
  'mat':         { description: 'Grippy natural rubber with a cushioned core for steady footing.', fabric: 'Natural rubber and cork top layer' },
  'duffel':      { description: 'A weekend-sized gym bag with a separate shoe pocket.', fabric: 'Recycled polyester canvas, water-resistant base' },
};

/** Card background colours (CSS values). */
export const CARD_BACKGROUNDS = {
  saffron: 'var(--saffron)',
  clay: 'var(--clay)',
  rust: 'var(--rust)',
  blush: 'var(--blush)',
  terracotta: 'var(--terracotta)',
  sand: 'var(--sand)',
};

export const GENDER_LABELS = {
  W: "Women's",
  M: "Men's",
  U: 'Unisex',
};

/* ----- Sizes and stock ----- */

const SIZE_RUNS = {
  women: ['XS', 'S', 'M', 'L', 'XL'],
  men: ['S', 'M', 'L', 'XL', 'XXL'],
  socks: ['S/M', 'L/XL'],
  oneSize: ['One size'],
};

const ONE_SIZE_GARMENTS = new Set(['cap', 'bottle', 'mat', 'duffel']);

/** Sizes currently out of stock, by SKU (demo inventory). */
const OUT_OF_STOCK = {
  'CKE-TEE-W': ['XS', 'XL'],
  'CKE-TEE-M': ['XXL'],
  'RUN-TEE-W': ['S'],
  'RUN-TEE-M': ['S', 'XXL'],
  'RUN-TNK-W': ['XL'],
  'RUN-LS-M':  ['XL', 'XXL'],
  'TRN-HZ-W':  ['XS', 'S'],
  'TRN-HD-M':  ['M'],
  'RUN-JK-W':  ['L', 'XL'],
  'RUN-JK-M':  ['S'],
  'OUT-SH-W':  ['XS'],
  'OUT-SH-M':  ['XL', 'XXL'],
  'OUT-VS-M':  ['M', 'L'],
  'RUN-SH-W':  ['M'],
  'YOG-LG-W':  ['XS', 'S', 'XL'],
  'YOG-JG-W':  ['L'],
  'YOG-BR-W':  ['M'],
  'YOG-BR2-W': ['XS'],
  'TRN-JG-M':  ['XXL'],
  'ACC-SCK-U': ['L/XL'],
};

function sizeRunFor(garment, gender) {
  if (garment === 'socks') return SIZE_RUNS.socks;
  if (ONE_SIZE_GARMENTS.has(garment)) return SIZE_RUNS.oneSize;
  if (gender === 'W') return SIZE_RUNS.women;
  if (gender === 'M') return SIZE_RUNS.men;
  return SIZE_RUNS.oneSize;
}

export function isInStock(product, size) {
  return !(OUT_OF_STOCK[product.sku] ?? []).includes(size);
}

/** M when it's in stock, otherwise the middle in-stock size. */
export function defaultSizeFor(product) {
  const available = product.sizes.filter((size) => isInStock(product, size));
  if (available.includes('M')) return 'M';
  return available[Math.floor((available.length - 1) / 2)];
}

/* ----- Products ----- */

// gender: W = women's, M = men's, U = unisex. usd: price in cents.
const PRODUCT_DATA = [
  { sku: 'CKE-TEE-W',  name: 'Cookie Club Crop Tee',        garment: 'crop',        gender: 'W', category: 'Train',       background: 'blush',      icon: 'cookie', usd: 4800,  colors: ['espresso', 'cream', 'terracotta'], badge: 'Fan favourite' },
  { sku: 'CKE-TEE-M',  name: 'Cookie Club Heavyweight Tee', garment: 'boxy',        gender: 'M', category: 'Train',       background: 'sand',       icon: 'cookie', usd: 4800,  colors: ['espresso', 'rust', 'cream'] },
  { sku: 'RUN-TEE-W',  name: 'Pace Fitted Tee',             garment: 'tee',         gender: 'W', category: 'Run',         background: 'terracotta', icon: 'bolt',   usd: 5800,  colors: ['cream', 'espresso', 'saffron'], badge: 'New' },
  { sku: 'RUN-TEE-M',  name: 'Pace Tech Tee',               garment: 'tee',         gender: 'M', category: 'Run',         background: 'saffron',    icon: 'bolt',   usd: 5800,  colors: ['espresso', 'rust', 'cream'], badge: 'New' },
  { sku: 'RUN-TNK-W',  name: 'Tempo Tank',                  garment: 'tank',        gender: 'W', category: 'Run',         background: 'clay',       icon: 'sun',    usd: 4400,  colors: ['terracotta', 'espresso', 'olive'] },
  { sku: 'TRN-TNK-M',  name: 'Lift Muscle Tank',            garment: 'tank',        gender: 'M', category: 'Train',       background: 'rust',       icon: 'flame',  usd: 4200,  colors: ['cream', 'saffron', 'espresso'] },
  { sku: 'RUN-LS-W',   name: 'Dawn Long Sleeve',            garment: 'long-sleeve', gender: 'W', category: 'Run',         background: 'saffron',    icon: 'sun',    usd: 6800,  colors: ['espresso', 'cream', 'rust'] },
  { sku: 'RUN-LS-M',   name: 'Dawn Thermal Crew',           garment: 'long-sleeve', gender: 'M', category: 'Run',         background: 'clay',       icon: 'sun',    usd: 6800,  colors: ['cocoa', 'terracotta', 'olive'] },
  { sku: 'TRN-HZ-W',   name: 'Ember Half-Zip',              garment: 'half-zip',    gender: 'W', category: 'Train',       background: 'sand',       icon: 'flame',  usd: 11800, colors: ['rust', 'espresso', 'cream'] },
  { sku: 'TRN-HZ-M',   name: 'Ember Half-Zip',              garment: 'half-zip',    gender: 'M', category: 'Train',       background: 'terracotta', icon: 'flame',  usd: 11800, colors: ['espresso', 'saffron', 'sand'] },
  { sku: 'TRN-HD-W',   name: 'Rest Day Hoodie',             garment: 'hoodie',      gender: 'W', category: 'Train',       background: 'clay',       icon: 'moon',   usd: 9800,  colors: ['cocoa', 'olive', 'terracotta'] },
  { sku: 'TRN-HD-M',   name: 'Rest Day Hoodie',             garment: 'hoodie',      gender: 'M', category: 'Train',       background: 'blush',      icon: 'moon',   usd: 9800,  colors: ['espresso', 'rust', 'cocoa'] },
  { sku: 'RUN-JK-W',   name: 'Pulse Run Jacket',            garment: 'jacket',      gender: 'W', category: 'Run',         background: 'saffron',    icon: 'wind',   usd: 14800, colors: ['espresso', 'rust', 'cream'], badge: 'New' },
  { sku: 'RUN-JK-M',   name: 'Pulse Run Jacket',            garment: 'jacket',      gender: 'M', category: 'Run',         background: 'sand',       icon: 'wind',   usd: 14800, colors: ['espresso', 'terracotta', 'olive'], badge: 'New' },
  { sku: 'OUT-SH-W',   name: 'Stormline Shell',             garment: 'jacket',      gender: 'W', category: 'Outerwear',   background: 'rust',       icon: 'peak',   usd: 22800, colors: ['cream', 'saffron', 'espresso'], badge: '-20%' },
  { sku: 'OUT-SH-M',   name: 'Stormline Shell',             garment: 'jacket',      gender: 'M', category: 'Outerwear',   background: 'clay',       icon: 'peak',   usd: 22800, colors: ['olive', 'espresso', 'rust'], badge: '-20%' },
  { sku: 'OUT-VS-W',   name: 'Trailhead Puffer Vest',       garment: 'vest',        gender: 'W', category: 'Outerwear',   background: 'terracotta', icon: 'peak',   usd: 13800, colors: ['cream', 'espresso', 'saffron'] },
  { sku: 'OUT-VS-M',   name: 'Trailhead Puffer Vest',       garment: 'vest',        gender: 'M', category: 'Outerwear',   background: 'saffron',    icon: 'peak',   usd: 13800, colors: ['espresso', 'olive', 'rust'] },
  { sku: 'RUN-SH-W',   name: 'Stride 3" Short',             garment: 'shorts',      gender: 'W', category: 'Run',         background: 'blush',      icon: 'bolt',   usd: 5800,  colors: ['espresso', 'terracotta', 'olive'] },
  { sku: 'RUN-SH-M',   name: 'Stride 5" Short',             garment: 'shorts',      gender: 'M', category: 'Run',         background: 'terracotta', icon: 'bolt',   usd: 6800,  colors: ['espresso', 'sand', 'cream'] },
  { sku: 'YOG-LG-W',   name: 'Flow Rib Legging',            garment: 'leggings',    gender: 'W', category: 'Yoga',        background: 'clay',       icon: 'leaf',   usd: 9800,  colors: ['espresso', 'rust', 'olive'], badge: 'Bestseller' },
  { sku: 'RUN-TT-M',   name: 'Cadence Run Tight',           garment: 'leggings',    gender: 'M', category: 'Run',         background: 'rust',       icon: 'wind',   usd: 8800,  colors: ['espresso', 'cream', 'saffron'] },
  { sku: 'YOG-JG-W',   name: 'Unwind Jogger',               garment: 'joggers',     gender: 'W', category: 'Yoga',        background: 'sand',       icon: 'wave',   usd: 8800,  colors: ['cocoa', 'terracotta', 'espresso'] },
  { sku: 'TRN-JG-M',   name: 'Commute Jogger',              garment: 'joggers',     gender: 'M', category: 'Train',       background: 'blush',      icon: 'wave',   usd: 9200,  colors: ['espresso', 'olive', 'cocoa'] },
  { sku: 'YOG-BR-W',   name: 'Balance Sports Bra',          garment: 'sports-bra',  gender: 'W', category: 'Yoga',        background: 'saffron',    icon: 'heart',  usd: 5400,  colors: ['espresso', 'terracotta', 'cream'] },
  { sku: 'YOG-BR2-W',  name: 'Lift Longline Bra',           garment: 'sports-bra',  gender: 'W', category: 'Train',       background: 'rust',       icon: 'flame',  usd: 6200,  colors: ['cream', 'saffron', 'espresso'] },
  { sku: 'YOG-TNK-W',  name: 'Breathe Yoga Tank',           garment: 'tank',        gender: 'W', category: 'Yoga',        background: 'sand',       icon: 'leaf',   usd: 4800,  colors: ['olive', 'rust', 'espresso'] },
  { sku: 'YOG-LS-M',   name: 'Stillwater Yoga Long Sleeve', garment: 'long-sleeve', gender: 'M', category: 'Yoga',        background: 'blush',      icon: 'wave',   usd: 7200,  colors: ['olive', 'espresso', 'cream'] },
  { sku: 'ACC-CAP-U',  name: 'Cookie Club Cap',             garment: 'cap',         gender: 'U', category: 'Accessories', background: 'sand',       icon: 'cookie', usd: 3400,  colors: ['espresso', 'terracotta', 'cream'] },
  { sku: 'ACC-CAP2-U', name: 'Pace Run Cap',                garment: 'cap',         gender: 'U', category: 'Run',         background: 'terracotta', icon: 'bolt',   usd: 3800,  colors: ['cream', 'espresso', 'saffron'] },
  { sku: 'ACC-SCK-U',  name: 'Crew Run Sock 3-Pack',        garment: 'socks',       gender: 'U', category: 'Accessories', background: 'clay',       icon: 'star',   usd: 2400,  colors: ['espresso', 'terracotta', 'cream'] },
  { sku: 'ACC-BTL-U',  name: 'Carry Steel Bottle',          garment: 'bottle',      gender: 'U', category: 'Accessories', background: 'rust',       icon: 'sun',    usd: 3800,  colors: ['cream', 'saffron', 'espresso'] },
  { sku: 'YOG-MAT-U',  name: 'Grounded Yoga Mat',           garment: 'mat',         gender: 'U', category: 'Yoga',        background: 'saffron',    icon: 'leaf',   usd: 8800,  colors: ['rust', 'espresso', 'olive'], badge: 'Bestseller' },
  { sku: 'ACC-BAG-U',  name: 'Weekender Gym Duffel',        garment: 'duffel',      gender: 'U', category: 'Accessories', background: 'blush',      icon: 'star',   usd: 11800, colors: ['espresso', 'olive', 'rust'] },
  { sku: 'YOG-BLK-U',  name: 'Cork Block Pair',             garment: 'mat',         gender: 'U', category: 'Yoga',        background: 'clay',       icon: 'heart',  usd: 3200,  colors: ['cocoa', 'terracotta', 'espresso'] },
  { sku: 'ACC-SCK2-U', name: 'Cookie Crew Sock',            garment: 'socks',       gender: 'U', category: 'Accessories', background: 'saffron',    icon: 'cookie', usd: 1800,  colors: ['espresso', 'cream', 'rust'] },
];

export const PRODUCTS = PRODUCT_DATA.map((item) => ({
  ...item,
  prices: pricesFromUsd(item.usd),
  sizes: sizeRunFor(item.garment, item.gender),
}));

const PRODUCTS_BY_SKU = new Map(PRODUCTS.map((product) => [product.sku, product]));

export function findProduct(sku) {
  return PRODUCTS_BY_SKU.get(sku);
}
