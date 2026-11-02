/**
 * Structured data (JSON-LD) for search engines, built from the catalogue so it
 * never drifts from what's on the page. Google reads JSON-LD added by
 * JavaScript, so this doesn't need to be hand-written into index.html.
 *
 * Describes the organisation, the website and every product with its price
 * (USD) and stock. Each product links to its quick view (#p-SKU).
 */
import { PRODUCTS, COLORS, GENDER_LABELS, productDetails, isInStock } from './catalog.js';

const SITE_URL = 'https://store.akash.app/';

function productData(product) {
  const inStock = product.sizes.some((size) => isInStock(product, size));

  return {
    '@type': 'Product',
    '@id': `${SITE_URL}#p-${product.sku}`,
    sku: product.sku,
    name: `${product.name} (${GENDER_LABELS[product.gender]})`,
    description: productDetails(product).description,
    image: `${SITE_URL}assets/garments/${product.garment}.svg`,
    brand: { '@type': 'Brand', name: 'Nano Motion' },
    category: product.category,
    color: product.colors.map((key) => COLORS[key].label).join(', '),
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}#p-${product.sku}`,
      price: (product.prices.USD / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}

export function addStructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}#organization`,
        name: 'Nano Motion',
        url: SITE_URL,
        logo: `${SITE_URL}assets/brand/icon-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}#website`,
        name: 'Nano Motion',
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}#organization` },
      },
      {
        '@type': 'ItemList',
        name: 'The Fall Drop',
        itemListElement: PRODUCTS.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: productData(product),
        })),
      },
    ],
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(graph);
  document.head.append(script);
}
