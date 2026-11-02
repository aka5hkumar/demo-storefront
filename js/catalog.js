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
  'block':       { hasDetail: true,  icon: { x: 33, y: 65,   size: 18 } },
  'duffel':      { hasDetail: true,  icon: { x: 41, y: 54.2, size: 18 } },
};

/**
 * Quick-view copy, one entry per product (keyed by SKU).
 * `fit` is shown for clothing only.
 */
const PRODUCT_DETAILS = {
  'CKE-TEE-W':  { description: 'A boxy cropped tee in soft organic cotton that ends just above a high-rise waistband, with the cookie front and center.', fabric: '100% organic cotton jersey', fit: 'Relaxed, cropped fit' },
  'CKE-TEE-M':  { description: 'A thick 240 gsm cotton tee with a dropped shoulder and a ribbed collar that keeps its shape wash after wash.', fabric: '100% organic cotton, 240 gsm', fit: 'Oversized fit' },
  'RUN-TEE-W':  { description: 'A close-fitting running tee with flat seams and a dropped back hem that stays put over leggings.', fabric: '88% recycled polyester, 12% elastane', fit: 'Fitted' },
  'RUN-TEE-M':  { description: 'A quick-drying mesh-knit running tee with laser-cut vents across the back for hot, humid runs.', fabric: '100% recycled polyester mesh knit', fit: 'Regular fit' },
  'RUN-TNK-W':  { description: 'A featherweight racerback tank for tempo days, with a scoop neck and a reflective logo on the back.', fabric: '92% recycled polyester, 8% elastane', fit: 'Regular fit' },
  'TRN-TNK-M':  { description: 'A muscle tank with deep, dropped armholes that stay out of the way through presses, pulls and carries.', fabric: '60% cotton, 40% recycled polyester', fit: 'Relaxed fit' },
  'RUN-LS-W':   { description: 'A slim long sleeve for cool early runs, with thumbholes that keep the cuffs over your hands.', fabric: '84% recycled polyester, 16% elastane', fit: 'Slim fit' },
  'RUN-LS-M':   { description: 'A grid-fleece crew that holds in heat on cold runs and dries fast once you warm up.', fabric: '94% recycled polyester grid fleece, 6% elastane', fit: 'Slim fit' },
  'TRN-HZ-W':   { description: 'A brushed-back half-zip with a tapered waist and zipped side pockets, for warm-ups and cold walks to the gym.', fabric: '90% recycled polyester, 10% elastane, brushed back', fit: 'Regular fit' },
  'TRN-HZ-M':   { description: 'A brushed-back half-zip with a chin guard and a zipped chest pocket, cut with room to layer over a tee.', fabric: '90% recycled polyester, 10% elastane, brushed back', fit: 'Regular fit' },
  'TRN-HD-W':   { description: 'A midweight fleece hoodie with a slightly cropped body and an oversized hood, made for the day after leg day.', fabric: '80% organic cotton, 20% recycled polyester fleece', fit: 'Relaxed, slightly cropped fit' },
  'TRN-HD-M':   { description: 'A midweight fleece hoodie with a kangaroo pocket and ribbed cuffs, for warm-ups, cool-downs and everything after.', fabric: '80% organic cotton, 20% recycled polyester fleece', fit: 'Relaxed fit' },
  'RUN-JK-W':   { description: 'A wind-resistant run jacket with a shaped back hem and reflective trim for dark mornings.', fabric: '100% recycled nylon ripstop, PFC-free water-repellent finish', fit: 'Regular fit' },
  'RUN-JK-M':   { description: 'A light, wind-resistant run jacket that packs into its own chest pocket, with reflective trim front and back.', fabric: '100% recycled nylon ripstop, PFC-free water-repellent finish', fit: 'Regular fit' },
  'OUT-SH-W':   { description: 'A fully waterproof 3-layer shell with taped seams, an adjustable hood and underarm zips for long, wet days outside.', fabric: '3-layer recycled nylon, 20,000 mm waterproof, taped seams', fit: 'Regular fit, room to layer' },
  'OUT-SH-M':   { description: 'A waterproof, breathable shell with taped seams, a stiffened hood brim and a longer back for wet commutes and trail days.', fabric: '3-layer recycled nylon, 20,000 mm waterproof, taped seams', fit: 'Regular fit, room to layer' },
  'OUT-VS-W':   { description: 'A lightly insulated vest with a high collar and a tapered waist that keeps your core warm and your arms free.', fabric: '100% recycled nylon, recycled synthetic fill', fit: 'Regular fit' },
  'OUT-VS-M':   { description: 'A lightweight puffer vest with zipped hand pockets that stuffs into its own pocket for cold starts on the trail.', fabric: '100% recycled nylon, recycled synthetic fill', fit: 'Regular fit' },
  'RUN-SH-W':   { description: 'A 3-inch race short with split hems, a built-in brief liner and a back zip pocket for a key or a gel.', fabric: '100% recycled polyester woven, mesh liner', fit: 'Regular fit, 3" inseam' },
  'RUN-SH-M':   { description: 'A 5-inch running short with a breathable mesh liner and side pockets that hold a phone without bouncing.', fabric: '100% recycled polyester woven, mesh liner', fit: 'Regular fit, 5" inseam' },
  'YOG-LG-W':   { description: 'A high-rise ribbed legging in a soft, opaque knit that stays put through flows and long holds.', fabric: '74% recycled nylon, 26% elastane', fit: 'High-rise, second-skin fit' },
  'RUN-TT-M':   { description: 'A full-length running tight for cold miles, with a drawcord waist, ankle zips and a back pocket for your phone.', fabric: '72% recycled nylon, 28% elastane, brushed inside', fit: 'Compression fit' },
  'YOG-JG-W':   { description: 'A soft, relaxed jogger with a wide fold-over waistband for slow mornings and the walk home from class.', fabric: '78% organic cotton, 22% recycled polyester', fit: 'Relaxed, tapered fit' },
  'TRN-JG-M':   { description: 'A stretch-woven jogger with zipped pockets, smart enough for the office and easy to move in after.', fabric: '88% recycled nylon, 12% elastane, water-repellent', fit: 'Tapered fit' },
  'YOG-BR-W':   { description: 'A light-support bra in a buttery-soft fabric with removable cups, made for yoga and Pilates.', fabric: '75% recycled nylon, 25% elastane', fit: 'Light support' },
  'TRN-BR-W':   { description: 'A medium-support longline bra with a deep underband that stays flat through lifts and HIIT.', fabric: '78% recycled nylon, 22% elastane', fit: 'Medium support, longline' },
  'YOG-TNK-W':  { description: 'A loose, flowy yoga tank with a twisted open back that keeps you cool in hot classes.', fabric: '70% lyocell, 30% organic cotton', fit: 'Relaxed fit' },
  'YOG-LS-M':   { description: 'A soft, stretchy long sleeve with a longer back hem so you stay covered in forward folds.', fabric: '70% lyocell, 25% organic cotton, 5% elastane', fit: 'Regular fit' },
  'ACC-CAP-U':  { description: 'A six-panel cotton twill cap with an embroidered cookie and a curved brim. An everyday cap, not a race-day one.', fabric: '100% organic cotton twill, adjustable strap' },
  'ACC-CAP2-U': { description: 'A featherlight run cap with a sweat-wicking band, laser-cut vents and a soft brim that folds flat in a pocket.', fabric: '100% recycled polyester, adjustable strap' },
  'ACC-SCK-U':  { description: 'Three pairs of cushioned merino crew socks with arch support and a seamless toe for long miles.', fabric: '62% merino wool, 35% nylon, 3% elastane' },
  'ACC-BTL-U':  { description: 'A double-walled steel bottle that keeps drinks cold for 24 hours or hot for 12, with a leak-proof lid.', fabric: '18/8 stainless steel, 750 ml (25 oz)' },
  'YOG-MAT-U':  { description: 'A 4 mm natural rubber mat with a grippy top surface that holds even when your hands get sweaty.', fabric: 'Natural rubber, 72 × 24 in (183 × 61 cm), 4 mm' },
  'ACC-BAG-U':  { description: 'A weekend-sized duffel with a separate ventilated shoe pocket and a padded shoulder strap.', fabric: 'Recycled polyester canvas, water-resistant base' },
  'YOG-BLK-U':  { description: 'Two firm cork blocks that bring the floor closer, steady your balances and support restorative poses.', fabric: '100% natural cork, 9 × 6 × 3 in (23 × 15 × 7.5 cm) each' },
  'ACC-SCK2-U': { description: 'A single pair of cotton crew socks with a knitted cookie at the ankle, for rest days and everything off the track.', fabric: '78% organic cotton, 20% nylon, 2% elastane' },
};

/** Description, fabric and (for clothing) fit for one product. */
export function productDetails(product) {
  return PRODUCT_DETAILS[product.sku];
}

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

const ONE_SIZE_GARMENTS = new Set(['cap', 'bottle', 'mat', 'block', 'duffel']);

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
  'TRN-BR-W':  ['XS'],
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
  { sku: 'CKE-TEE-W',  name: 'Cookie Club Crop Tee',        garment: 'crop',        gender: 'W', category: 'Train',       background: 'blush',      icon: 'cookie', usd: 4800,  colors: ['espresso', 'cream', 'terracotta'], badge: 'Fan favorite' },
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
  { sku: 'OUT-SH-W',   name: 'Stormline Shell',             garment: 'jacket',      gender: 'W', category: 'Outerwear',   background: 'rust',       icon: 'peak',   usd: 22800, colors: ['cream', 'saffron', 'espresso'] },
  { sku: 'OUT-SH-M',   name: 'Stormline Shell',             garment: 'jacket',      gender: 'M', category: 'Outerwear',   background: 'clay',       icon: 'peak',   usd: 22800, colors: ['olive', 'espresso', 'rust'] },
  { sku: 'OUT-VS-W',   name: 'Trailhead Puffer Vest',       garment: 'vest',        gender: 'W', category: 'Outerwear',   background: 'terracotta', icon: 'peak',   usd: 13800, colors: ['cream', 'espresso', 'saffron'] },
  { sku: 'OUT-VS-M',   name: 'Trailhead Puffer Vest',       garment: 'vest',        gender: 'M', category: 'Outerwear',   background: 'saffron',    icon: 'peak',   usd: 13800, colors: ['espresso', 'olive', 'rust'] },
  { sku: 'RUN-SH-W',   name: 'Stride 3" Short',             garment: 'shorts',      gender: 'W', category: 'Run',         background: 'blush',      icon: 'bolt',   usd: 5800,  colors: ['espresso', 'terracotta', 'olive'] },
  { sku: 'RUN-SH-M',   name: 'Stride 5" Short',             garment: 'shorts',      gender: 'M', category: 'Run',         background: 'terracotta', icon: 'bolt',   usd: 6800,  colors: ['espresso', 'sand', 'cream'] },
  { sku: 'YOG-LG-W',   name: 'Flow Rib Legging',            garment: 'leggings',    gender: 'W', category: 'Yoga',        background: 'clay',       icon: 'leaf',   usd: 9800,  colors: ['espresso', 'rust', 'olive'], badge: 'Bestseller' },
  { sku: 'RUN-TT-M',   name: 'Cadence Run Tight',           garment: 'leggings',    gender: 'M', category: 'Run',         background: 'rust',       icon: 'wind',   usd: 8800,  colors: ['espresso', 'cream', 'saffron'] },
  { sku: 'YOG-JG-W',   name: 'Unwind Jogger',               garment: 'joggers',     gender: 'W', category: 'Yoga',        background: 'sand',       icon: 'wave',   usd: 8800,  colors: ['cocoa', 'terracotta', 'espresso'] },
  { sku: 'TRN-JG-M',   name: 'Commute Jogger',              garment: 'joggers',     gender: 'M', category: 'Train',       background: 'blush',      icon: 'wave',   usd: 9200,  colors: ['espresso', 'olive', 'cocoa'] },
  { sku: 'YOG-BR-W',   name: 'Balance Sports Bra',          garment: 'sports-bra',  gender: 'W', category: 'Yoga',        background: 'saffron',    icon: 'heart',  usd: 5400,  colors: ['espresso', 'terracotta', 'cream'] },
  { sku: 'TRN-BR-W',   name: 'Lift Longline Bra',           garment: 'sports-bra',  gender: 'W', category: 'Train',       background: 'rust',       icon: 'flame',  usd: 6200,  colors: ['cream', 'saffron', 'espresso'] },
  { sku: 'YOG-TNK-W',  name: 'Breathe Yoga Tank',           garment: 'tank',        gender: 'W', category: 'Yoga',        background: 'sand',       icon: 'leaf',   usd: 4800,  colors: ['olive', 'rust', 'espresso'] },
  { sku: 'YOG-LS-M',   name: 'Stillwater Yoga Long Sleeve', garment: 'long-sleeve', gender: 'M', category: 'Yoga',        background: 'blush',      icon: 'wave',   usd: 7200,  colors: ['olive', 'espresso', 'cream'] },
  { sku: 'ACC-CAP-U',  name: 'Cookie Club Cap',             garment: 'cap',         gender: 'U', category: 'Accessories', background: 'sand',       icon: 'cookie', usd: 3400,  colors: ['espresso', 'terracotta', 'cream'] },
  { sku: 'ACC-CAP2-U', name: 'Pace Run Cap',                garment: 'cap',         gender: 'U', category: 'Accessories', background: 'terracotta', icon: 'bolt',   usd: 3800,  colors: ['cream', 'espresso', 'saffron'] },
  { sku: 'ACC-SCK-U',  name: 'Crew Run Sock 3-Pack',        garment: 'socks',       gender: 'U', category: 'Accessories', background: 'clay',       icon: 'star',   usd: 2400,  colors: ['espresso', 'terracotta', 'cream'] },
  { sku: 'ACC-BTL-U',  name: 'Carry Steel Bottle',          garment: 'bottle',      gender: 'U', category: 'Accessories', background: 'rust',       icon: 'sun',    usd: 3800,  colors: ['cream', 'saffron', 'espresso'] },
  { sku: 'YOG-MAT-U',  name: 'Grounded Yoga Mat',           garment: 'mat',         gender: 'U', category: 'Yoga',        background: 'saffron',    icon: 'leaf',   usd: 8800,  colors: ['rust', 'espresso', 'olive'], badge: 'Bestseller' },
  { sku: 'ACC-BAG-U',  name: 'Weekender Gym Duffel',        garment: 'duffel',      gender: 'U', category: 'Accessories', background: 'blush',      icon: 'star',   usd: 11800, colors: ['espresso', 'olive', 'rust'] },
  { sku: 'YOG-BLK-U',  name: 'Cork Block Pair',             garment: 'block',       gender: 'U', category: 'Yoga',        background: 'clay',       icon: 'heart',  usd: 3200,  colors: ['cocoa', 'terracotta', 'espresso'] },
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

/* ----- Motion Club (membership) -----
   A monthly auto-ship: one new piece from the latest drop, in the member's
   size. `plan_id` values are sent with the trial and subscription events. */

export const CLUB = {
  name: 'Motion Club',
  monthlyPrices: pricesFromUsd(2900),
  trialDays: 14,
  plans: {
    trial:   { planId: 'motion-club-trial-14d', label: 'Free 14-day trial' },
    monthly: { planId: 'motion-club-monthly',   label: 'Monthly membership' },
  },
  focuses: ['Run', 'Train', 'Yoga'],
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
};
