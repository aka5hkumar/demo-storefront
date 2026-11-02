# Nano Motion conversions relay (Cloudflare Worker)

Receives conversion events from the Nano Motion storefront's browser relay
(`js/adapters/capi-relay.js`) and forwards each one straight to the
[OpenAI Conversions API](https://developers.openai.com/ads/conversions-api).

**Status: deployed at `https://capi.akash.app/events`** (custom domain, set in
`wrangler.toml`). The storefront points at it via `CONVERSIONS_RELAY_URL` in
`../js/config.js`. Run every command below from this `worker/` folder.

```
browser relay ──POST /events──▶ this Worker ──▶ https://bzr.openai.com/v1/events?pid=…  (once per pixel)
                                 │
                                 ├─ CORS: only ALLOWED_ORIGINS
                                 ├─ drops events without advertising consent
                                 ├─ validates + maps (src/map-event.js)
                                 ├─ adds IP (CF-Connecting-IP) and user agent
                                 └─ one retry on network error / 5xx (same event id)
```

No buffering or queue yet: one event in, one request out per pixel. The browser pixel
sends the same events with the same ids, so OpenAI counts each one once.

## What it forwards

| Type | Sent when |
| --- | --- |
| `page_viewed` | page load (after consent) |
| `contents_viewed` | first quick view of a product |
| `items_added` | add to bag |
| `checkout_started` | contact step reached |
| `order_created` | order placed (`id` = order number; hashed email, phone, names + location) |

Click ID (`oppref`) goes on the event; the pixel's browser ID (`__obref`
cookie) goes in `user.obref`. PII arrives already SHA-256 hashed; anything that
isn't a 64-character hex hash is rejected.

## Setup

```sh
npm install
cp .dev.vars.example .dev.vars        # fill in pixel ID + Conversions API key
npm test                              # unit tests, upstream mocked
npm run dev                           # http://localhost:8787/events
```

Deploy (Workers Free plan is enough):

```sh
npx wrangler login
npx wrangler secret put OPENAI_PIXEL_ID
npx wrangler secret put OPENAI_CONVERSIONS_API_KEY
npx wrangler secret put OPENAI_PIXEL_ID_2               # optional second pixel
npx wrangler secret put OPENAI_CONVERSIONS_API_KEY_2    # optional; reuses the first key if unset
npm run deploy                        # prints https://nano-motion-capi.<account>.workers.dev
```

Then set `CONVERSIONS_RELAY_URL` in the storefront's `js/config.js` to
`https://nano-motion-capi.<account>.workers.dev/events`.

`VALIDATE_ONLY = "true"` in `wrangler.toml` makes OpenAI check events without
recording them. Flip it to `"false"` once test events look right, and use
OpenAI's recent-events endpoint to confirm server events arrive
(`server_to_server`) alongside pixel events (`pixel_sdk`).

## Config

| Name | Where | Purpose |
| --- | --- | --- |
| `OPENAI_PIXEL_ID` | secret | `pid` query parameter |
| `OPENAI_CONVERSIONS_API_KEY` | secret | Bearer token |
| `OPENAI_PIXEL_ID_2` | secret (optional) | second pixel: every event is also sent with this `pid` |
| `OPENAI_CONVERSIONS_API_KEY_2` | secret (optional) | key for the second pixel; falls back to the first key |
| `ALLOWED_ORIGINS` | `wrangler.toml` | storefront origins allowed to call the relay |
| `INTEGRATION_SOURCE` | `wrangler.toml` | identifies this integration in requests |
| `VALIDATE_ONLY` | `wrangler.toml` | `"true"` while testing |

## Later

- Queue + dead-letter queue for retries beyond one attempt.
- Optional session buffer (Durable Object) to backfill PII into earlier events.
- Rate limiting; the endpoint is public and only origin-checked.
