# Nano Motion storefront (demo)

Single-page static storefront for the fictional activewear brand Nano Motion.
Plain HTML, CSS and ES modules: no build step, no runtime libraries. The only
external request on load is Google Fonts (Archivo for display type, DM Sans for
body text). Everything for the tests (`package.json`, Playwright config) lives in `tests/`.

## Run

ES modules need a web server (opening the file directly won't load them):

```sh
python3 -m http.server 8080   # then open http://localhost:8080
# or
node tests/serve.mjs          # → http://localhost:4173
```

Deploys unchanged to Vercel (static) or GitHub Pages (`.nojekyll` included).

## Project layout

```
index.html                  page markup only (plus meta, icons and link-preview tags)
404.html                    branded not-found page (GitHub Pages serves it for missing URLs)
favicon.ico, robots.txt, CNAME   must stay at the root (browsers, crawlers, GitHub Pages look there)
css/
  base.css                  design tokens, reset, typography, buttons, shared animations
  layout.css                header, hero, scrolling banner, promo band, footer
  shop.css                  filters, search and sort, product cards, garment artwork, pager
  bag.css                   bag drawer and checkout steps
  dialogs.css               modal panels, quick view, help/shipping/returns content, toast
  consent.css               cookie prompt, floating cookie button, privacy switches
js/
  main.js                   entry point: wires the modules together
  config.js                 pixel and relay settings (all off by default)
  state.js                  shared in-memory state (currency, filters, bag, checkout)
  events.js                 emit()/on() event bus for tracking
  catalog.js                colours, garment shapes, sizes, stock, products
  currency.js               price conversion, formatting, shipping, saved currency
  garment.js                draws a product from its SVG masks in any colour
  selection.js              colour and size chosen on each product
  shop.js                   search, sort, filters, grid, pagination
  search.js                 product search (word prefixes + garment synonyms)
  variant-picker.js         colour swatches and size buttons (cards and quick view)
  quick-view.js             product quick view, linkable as #p-SKU
  focus.js                  keeps keyboard focus inside open dialogs
  structured-data.js        JSON-LD for search engines, built from the catalogue
  bag.js                    bag drawer and simulated checkout
  hero.js                   random hero product + price tag
  demo-shopper.js           fake shopper details for checkout, localised by IP
  card-validation.js        local card checks: issuer prefix/length, Luhn, expiry, CVC
  consent.js                region-aware cookie consent
  info.js                   footer Help / Shipping / Returns dialogs
  toast.js                  status messages
  dom.js                    $ / $$ helpers and safe localStorage access
  adapters/console-logger.js    logs every event to the console
  adapters/conversion-events.js shared event mapping + hashing for the two below
  adapters/pixel.js             browser pixel (off until configured)
  adapters/capi-relay.js        server relay to a Conversions API Worker (off until configured)
tests/
  package.json, playwright.config.js   test tooling (run npm from this folder)
  serve.mjs                 static server for local runs and the tests
  unit/                     node --test: card checks, currency, search
  e2e/                      Playwright: shop, quick view, checkout, consent, tracking, layout
.github/workflows/tests.yml runs both on every push and pull request
assets/
  brand/                      favicon.svg, PNG icons, apple-touch-icon, og-image (link previews), site.webmanifest
  garments/{name}.svg         garment silhouette
  garments/{name}-detail.svg  seams and zips (where the garment has them)
  icons/{name}.svg            chest icons
```

## How the artwork works

Each SVG in `assets/` is a black shape used as a CSS mask. `garment.js` stacks
three masked layers (silhouette, details, icon) and colours them with CSS custom
properties, so one file per garment can be shown in every swatch colour. To add
a garment, drop in `{name}.svg` (and optionally `{name}-detail.svg`), then add it
to `GARMENTS` in `catalog.js` with the icon position.

## Tracking events

Every event goes through `emit()` in `js/events.js` and is logged to the console
as `[nm] name {payload}`. Prices are integers in minor units with an ISO currency.

| Event | When |
| --- | --- |
| `page_view` | page load |
| `hero_impression` | hero product chosen |
| `filter_changed` | gender or category filter |
| `search` | search box, once the shopper pauses typing (query + result count) |
| `sort_changed` | sort menu |
| `product_viewed` | quick view opened (`source`: product_card or link) |
| `quick_view_closed` | quick view closed |
| `variant_selected` | colour or size picked |
| `size_unavailable` | sold-out size clicked |
| `add_to_cart` / `remove_from_cart` | card, quick view, hero tag or bag quantity buttons |
| `cart_opened` | bag drawer opened |
| `checkout_step` | contact, shipping, payment reached |
| `payment_failed` | card failed local checks or was the declined test card (reason + brand only) |
| `order_placed` | order confirmed (`id` = order number, for deduplication) |
| `currency_changed` | currency picker |
| `consent_changed` / `consent_reset` | cookie choice saved or reset |
| `info_viewed` | Help / Shipping / Returns opened |

Tracking adapters should check `getConsent()` (also `window.nmConsent()`)
before sending anything.

## Conversion tracking

Two adapters send the same conversion events with the same event ids, so the
ad platform counts each one once:

| Storefront event | Conversion type |
| --- | --- |
| `page_view` | `page_viewed` |
| first `product_viewed` per product (quick view) | `contents_viewed` |
| `add_to_cart` | `items_added` |
| `checkout_step` (contact) | `checkout_started` |
| `order_placed` | `order_created` (id = order number) |

- **Browser pixel** (`js/adapters/pixel.js`): set `PIXEL_ID` and `PIXEL_SCRIPT_URL`
  in `js/config.js`. Consent starts off unless advertising consent was given and
  follows `consent_changed`. On the purchase, the shopper's email, phone and
  names are SHA-256 hashed in the browser and added for matching.
- **Server relay** (`js/adapters/capi-relay.js`): set `CONVERSIONS_RELAY_URL` once
  the Cloudflare Worker is deployed. Sends nothing without advertising consent.

Both are off by default; with nothing configured the site makes no tracking calls.

## Saved bag

The bag is saved in localStorage (`nm-bag`) on every change and restored on the
next visit for up to 30 days. Restoring doesn't emit `add_to_cart` again (the
adds were tracked when they happened), and anything no longer in stock is
dropped. The saved bag is cleared when an order is placed.

## Content Security Policy

`index.html` and `404.html` set a CSP in a meta tag: scripts only from this
site, connections only to the demo-shopper lookups. When turning on the pixel or
the relay, add the SDK host to `script-src` (and any hosts the SDK calls to
`connect-src`), and the relay URL to `connect-src`. The tracking tests make the
same edit, so they show exactly what's needed.

## Tests

```sh
cd tests
npm install
npx playwright install chromium   # first time only
npm test                           # unit tests, then the browser tests
```

The browser tests run offline: the demo-shopper lookups are blocked (checkout
uses its local fallback) and the tracking tests use a fake SDK and relay. Any
page error or CSP violation fails the test.

## Demo checkout details

Each order prefills the contact and shipping forms with a fresh fake shopper so
test conversion events are unique. When the bag opens, `js/demo-shopper.js` calls:

- `ipwho.is` (fallback `get.geojs.io`) for the visitor's approximate location from their IP
- OpenStreetMap Nominatim reverse geocoding for a real street ~1 km away
- `randomuser.me` for a name, phone and an `@example.com` email in the visitor's country

Every call has a 4-second timeout and a local fallback. Submitted values are kept
in `state.customer` and never put into event payloads.

## Cookie consent

Stored in a first-party cookie `nm_consent` (180 days) with a localStorage copy.
The region is guessed from the browser time zone (Europe → GDPR,
America/Los_Angeles → California, other America → other US, unknown → GDPR).
"Reset cookie consent (testing)" in the footer clears it and reloads.

Visitors who haven't answered the cookie prompt get one more, optional ask in
the bag (before "Checkout"), so the checkout and order can be measured if they
allow it. Anyone who already declined, opted out, or sends Global Privacy
Control is never asked again there.

Demo only: no real payments, orders or data collection.
