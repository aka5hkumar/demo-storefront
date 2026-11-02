# Nano Motion conversions relay (Cloudflare Worker)

Receives conversion events from the Nano Motion storefront's browser relay
(`js/adapters/capi-relay.js`) and forwards each one straight to the
[OpenAI Conversions API](https://developers.openai.com/ads/conversions-api).

**Production custom domain:** `https://capi.akash.app/events` (set in
`wrangler.toml`). This checkout's buffering and queue changes become active after
the queues are provisioned and the Worker is deployed. The storefront points at the
domain via `CONVERSIONS_RELAY_URL` in `../js/config.js`.

```
browser relay ──POST /events──▶ this Worker ──▶ EventBuffer Durable Object
                                                  │ 60-second hold + cart matching
                                                  ▼
                                         CAPI outbound Queue ──▶ consumer ──▶ OpenAI CAPI
                                                  └─ exhausted retries ──▶ dead-letter queue
```

The browser Pixel continues sending every event immediately. CAPI holds each event
for 60 seconds, so a purchase arriving within that window can add its hashed matching
fields to earlier events from the same cart. Both paths retain the same per-event ID;
OpenAI deduplicates a Pixel/CAPI pair by Pixel ID, event name, and event ID.

The storefront creates a readable `NM-…` cart/order reference on the first product
content view, persists it with the cart, and shows it in product view, the bag, and the
order confirmation. It remains separate from each event ID. Pixel and CAPI send its
SHA-256 hash as their external-ID matching field; the raw reference is never sent as
user data.

## What it forwards

| Type | Sent when |
| --- | --- |
| `page_viewed` | page load (after consent) |
| `contents_viewed` | first quick view of a product |
| `items_added` | add to bag |
| `checkout_started` | contact step reached |
| `order_created` | order placed (`id` = order number; hashed email, phone, names + location) |
| `trial_started` | Motion Club free trial (`plan_enrollment`, `plan_id`; id = member ID; hashed email) |
| `subscription_created` | Motion Club paid start (`plan_enrollment`, `plan_id`, first month's amount) |

Click ID (`oppref`) goes on the event; the pixel's browser ID (`__obref` cookie)
goes in `user.obref`. Purchase PII and external IDs arrive SHA-256 hashed; malformed
hashes are rejected.

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
npx wrangler queues create nano-motion-capi-outbound
npx wrangler queues create nano-motion-capi-dead-letter
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
| `EVENT_BUFFER` | Durable Object | buffers events and joins matching purchase data |
| `CAPI_OUTBOUND` | Cloudflare Queue | retries CAPI delivery |

## Later

- Rate limiting; the endpoint is public and only origin-checked.

## Delivery and matching behavior

- Each CAPI event is scheduled 60 seconds after it reaches the Worker; its original
  event timestamp is preserved in the Conversions API payload.
- Events before the first product content view are buffered under a browser session
  key and associated with the cart reference when it arrives, if they are still pending.
- A purchase enriches earlier pending events for the same cart only when they are
  within the 60-second window. Already dispatched events cannot be updated later.
- A consent withdrawal clears the session's buffered conversions and purchase fields;
  a short revocation marker blocks in-flight browser requests from repopulating it.
- Queue delivery records success per Pixel ID and retries transient failures. Events
  that exhaust retries go to the dead-letter queue. Buffered data expires after seven
  days if delivery remains unresolved.
- The cart reference identifies one shopping journey. It is not a long-term customer
  identifier, so use an account-level pseudonymous ID if one becomes available.
