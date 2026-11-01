# Nano Motion storefront (demo)

Single-page static storefront for the fictional activewear brand Nano Motion.
Plain HTML, CSS and ES modules: no build step, no libraries. The only external
request is Google Fonts (Archivo for display type, DM Sans for body text).

## Run

ES modules need a web server (opening the file directly won't load them):

```sh
python3 -m http.server 8080   # then open http://localhost:8080
```

Deploys unchanged to Vercel (static) or GitHub Pages (`.nojekyll` included).

## Project layout

```
index.html                  page markup only
css/
  base.css                  design tokens, reset, typography, buttons, shared animations
  layout.css                header, hero, scrolling banner, promo band, footer
  shop.css                  filters, product cards, garment artwork, pager
  bag.css                   bag drawer and checkout steps
  dialogs.css               modal panels, help/shipping/returns content, toast
  consent.css               cookie prompt, floating cookie button, privacy switches
js/
  main.js                   entry point: wires the modules together
  state.js                  shared in-memory state (currency, filters, bag, checkout)
  events.js                 emit()/on() event bus for tracking
  catalog.js                colours, garment shapes, sizes, stock, products
  currency.js               price conversion, formatting, shipping, saved currency
  garment.js                draws a product from its SVG masks in any colour
  selection.js              colour and size chosen on each product
  shop.js                   filters, grid, swatches, sizes, pagination
  bag.js                    bag drawer and simulated checkout
  hero.js                   random hero product + price tag
  consent.js                region-aware cookie consent
  info.js                   footer Help / Shipping / Returns dialogs
  toast.js                  status messages
  dom.js                    $ / $$ helpers and safe localStorage access
  adapters/console-logger.js  logs every event; template for Pixel/CAPI adapters
assets/
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
| `variant_selected` | colour or size picked |
| `size_unavailable` | sold-out size clicked |
| `add_to_cart` / `remove_from_cart` | card, hero tag or bag quantity buttons |
| `cart_opened` | bag drawer opened |
| `checkout_step` | contact, shipping, payment reached |
| `order_placed` | order confirmed (`id` = order number, for deduplication) |
| `currency_changed` | currency picker |
| `consent_changed` / `consent_reset` | cookie choice saved or reset |
| `info_viewed` | Help / Shipping / Returns opened |

Tracking adapters should check `getConsent()` (also `window.nmConsent()`)
before sending anything.

## Cookie consent

Stored in a first-party cookie `nm_consent` (180 days) with a localStorage copy.
The region is guessed from the browser time zone (Europe → GDPR,
America/Los_Angeles → California, other America → other US, unknown → GDPR).
"Reset cookie consent (testing)" in the footer clears it and reloads.

Demo only: no real payments, orders or data collection.
