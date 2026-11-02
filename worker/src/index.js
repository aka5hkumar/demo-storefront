/**
 * Nano Motion conversions relay (Cloudflare Worker).
 *
 * POST /events  ← one storefront event from the browser relay
 *   1. CORS: only the storefront's origins may call it
 *   2. consent: events without advertising consent are dropped
 *   3. validate + map to an OpenAI Conversions API event (map-event.js)
 *   4. buffer in a Durable Object for 60 seconds and attach matching purchase PII
 *   5. enqueue the ready event and dispatch it to each configured Pixel ID
 *
 * The Durable Object is the short-lived correlation store and alarm scheduler;
 * Cloudflare Queues retries delivery and routes exhausted messages to a DLQ.
 *
 * Secrets (wrangler secret put):
 *   OPENAI_PIXEL_ID, OPENAI_CONVERSIONS_API_KEY        first pixel
 *   OPENAI_PIXEL_ID_2, OPENAI_CONVERSIONS_API_KEY_2    optional second pixel; without
 *                                                      its own key it uses the first key
 * Vars (wrangler.toml):           ALLOWED_ORIGINS, INTEGRATION_SOURCE, VALIDATE_ONLY
 */
import { toConversionEvent, InvalidEventError } from './map-event.js';

const CONVERSIONS_ENDPOINT = 'https://bzr.openai.com/v1/events';
const MAX_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 8000;
const HOLD_MS = 60 * 1000;
const PURCHASE_MATCH_RETENTION_MS = 2 * HOLD_MS;
const EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DISPATCH_LEASE_MS = 60 * 1000;
const ALARM_RETRY_MS = 5000;

/* ----- Helpers ----- */

/** Every configured pixel with the API key to use for it. */
export function configuredPixels(env) {
  const pixels = [];
  if (env.OPENAI_PIXEL_ID && env.OPENAI_CONVERSIONS_API_KEY) {
    pixels.push({ pid: env.OPENAI_PIXEL_ID, key: env.OPENAI_CONVERSIONS_API_KEY });
  }
  if (env.OPENAI_PIXEL_ID_2) {
    const key = env.OPENAI_CONVERSIONS_API_KEY_2 || env.OPENAI_CONVERSIONS_API_KEY;
    if (key) pixels.push({ pid: env.OPENAI_PIXEL_ID_2, key });
  }
  return pixels;
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function postToConversionsApi(conversion, { pid, key }, env) {
  const url = `${CONVERSIONS_ENDPOINT}?pid=${encodeURIComponent(pid)}`;
  const body = JSON.stringify({
    validate_only: env.VALIDATE_ONLY === 'true',
    integration_source: env.INTEGRATION_SOURCE || undefined,
    events: [conversion],
  });

  const send = () => fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  const response = await send();
  // Consume but never log the upstream body; validation messages may contain event data.
  await response.text();
  return { pid, status: response.status };
}

const eventStorageKey = (eventKey) => `event:${eventKey}`;
const purchaseStorageKey = (cartId) => `purchase:${cartId}`;
const eventKeyFor = (conversion) => `${conversion.type}:${conversion.id}`;

function safeMatchData(user = {}) {
  return Object.fromEntries([
    'emails_sha256', 'phone_numbers_sha256', 'first_names_sha256', 'last_names_sha256', 'external_ids_sha256',
    'countries', 'cities', 'regions', 'postal_codes',
  ].filter((field) => user[field] !== undefined).map((field) => [field, user[field]]));
}

async function addCartExternalId(conversion, cartId) {
  if (!cartId) return;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cartId.trim()));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const existing = conversion.user?.external_ids_sha256 ?? [];
  conversion.user = { ...conversion.user, external_ids_sha256: [...new Set([...existing, hash])].slice(0, 3) };
}

function enrichWithPurchase(conversion, purchaseUser) {
  if (!purchaseUser || !Object.keys(purchaseUser).length) return;
  conversion.user = { ...conversion.user, ...purchaseUser };
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * One Durable Object per pseudonymous browser tracking session. It stores
 * pending conversions, attaches a cart's purchase matching fields, and uses a
 * single alarm to enqueue events when their individual 60-second hold expires.
 */
export class EventBuffer {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
    if (url.pathname === '/revoke') return this.revoke();

    let body;
    try { body = await request.json(); } catch { return json(400, { error: 'body must be JSON' }); }

    if (url.pathname === '/ingest') return this.ingest(body);
    if (url.pathname === '/dispatch') return this.dispatch(body.eventKey);
    return json(404, { error: 'not found' });
  }

  async revoke() {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.put('revoked', { expiresAt: Date.now() + EVENT_RETENTION_MS });
    await this.ctx.storage.setAlarm(Date.now() + EVENT_RETENTION_MS);
    return json(202, { revoked: true });
  }

  async ingest({ conversion, cartId }) {
    if (!conversion || typeof conversion.id !== 'string') return json(400, { error: 'missing conversion' });
    const now = Date.now();
    const revocation = await this.ctx.storage.get('revoked');
    if (revocation?.expiresAt > now) return json(202, { accepted: false, reason: 'consent revoked' });
    if (revocation) await this.ctx.storage.delete('revoked');
    const eventKey = eventKeyFor(conversion);
    const key = eventStorageKey(eventKey);
    let record = await this.ctx.storage.get(key);

    if (!record) {
      record = {
        eventKey,
        conversion,
        cartId: typeof cartId === 'string' ? cartId : null,
        status: 'pending',
        dueAt: now + HOLD_MS,
        retryAt: null,
        expiresAt: now + EVENT_RETENTION_MS,
        sentPids: [],
        failedPids: [],
        leaseUntil: null,
      };

      // If a cart was just created, attach only still-buffered pre-cart events
      // from this session. Events already queued/sent are immutable.
      if (record.cartId) {
        const existing = await this.ctx.storage.list({ prefix: 'event:' });
        for (const [existingKey, pending] of existing) {
          if (!pending.cartId && pending.status === 'pending'
              && pending.conversion.timestamp_ms <= conversion.timestamp_ms) {
            pending.cartId = record.cartId;
            await addCartExternalId(pending.conversion, record.cartId);
            await this.ctx.storage.put(existingKey, pending);
          }
        }
      }

      await addCartExternalId(conversion, record.cartId);

      // A late-arriving pre-purchase request can still use the matching fields
      // while its event timestamp remains inside the 60-second purchase window.
      if (record.cartId && conversion.type !== 'order_created') {
        const purchase = await this.ctx.storage.get(purchaseStorageKey(record.cartId));
        if (purchase && conversion.timestamp_ms <= purchase.timestampMs
            && purchase.timestampMs - conversion.timestamp_ms <= HOLD_MS) {
          enrichWithPurchase(conversion, purchase.user);
        }
      }

      await this.ctx.storage.put(key, record);
    }

    if (conversion.type === 'order_created' && record.cartId) {
      const purchase = { timestampMs: conversion.timestamp_ms, user: safeMatchData(conversion.user) };
      await this.ctx.storage.put(purchaseStorageKey(record.cartId), {
        ...purchase,
        expiresAt: now + PURCHASE_MATCH_RETENTION_MS,
      });

      const existing = await this.ctx.storage.list({ prefix: 'event:' });
      for (const [existingKey, pending] of existing) {
        if (pending.cartId === record.cartId && ['pending', 'queued'].includes(pending.status)
            && pending.conversion.timestamp_ms <= purchase.timestampMs
            && purchase.timestampMs - pending.conversion.timestamp_ms <= HOLD_MS) {
          enrichWithPurchase(pending.conversion, purchase.user);
          await this.ctx.storage.put(existingKey, pending);
        }
      }
    }

    await this.scheduleNextAlarm();
    return json(202, { accepted: true, eventKey, dueAt: record.dueAt });
  }

  async dispatch(eventKey) {
    if (typeof eventKey !== 'string') return json(400, { error: 'missing event key' });
    const key = eventStorageKey(eventKey);
    const record = await this.ctx.storage.get(key);
    if (!record) return new Response(null, { status: 204 }); // duplicate queue delivery after a completed send

    const now = Date.now();
    if (record.status === 'dispatching' && record.leaseUntil > now) {
      return json(503, { retry: true, reason: 'dispatch already in progress' });
    }

    record.status = 'dispatching';
    record.leaseUntil = now + DISPATCH_LEASE_MS;
    await this.ctx.storage.put(key, record);

    const pixels = configuredPixels(this.env);
    if (!pixels.length) {
      record.status = 'queued';
      record.leaseUntil = null;
      await this.ctx.storage.put(key, record);
      return json(503, { retry: true, reason: 'no configured pixels' });
    }

    let retry = false;
    for (const pixel of pixels) {
      if (record.sentPids.includes(pixel.pid) || record.failedPids.includes(pixel.pid)) continue;

      try {
        const result = await postToConversionsApi(record.conversion, pixel, this.env);
        if (result.status >= 200 && result.status < 300) {
          record.sentPids.push(pixel.pid);
        } else if (retryableStatus(result.status)) {
          retry = true;
          console.error('conversions api retryable response', pixel.pid, result.status);
        } else {
          record.failedPids.push(pixel.pid);
          console.error('conversions api rejected event', pixel.pid, result.status);
        }
      } catch (error) {
        retry = true;
        console.error('conversions api unreachable', pixel.pid, String(error));
      }

      // Persist per-pixel outcomes so a retry skips pixels that already succeeded.
      await this.ctx.storage.put(key, record);
    }

    if (retry) {
      record.status = 'queued';
      record.leaseUntil = null;
      await this.ctx.storage.put(key, record);
      await this.scheduleNextAlarm();
      return json(503, { retry: true });
    }

    await this.ctx.storage.delete(key);
    await this.scheduleNextAlarm();
    return json(200, { delivered: true, failedPids: record.failedPids });
  }

  async scheduleNextAlarm() {
    const now = Date.now();
    const records = await this.ctx.storage.list();
    let next = Infinity;

    for (const [key, record] of records) {
      if (key === 'revoked') {
        if (record.expiresAt <= now) await this.ctx.storage.delete(key);
        else next = Math.min(next, record.expiresAt);
      } else if (key.startsWith('event:')) {
        if (record.expiresAt <= now) {
          await this.ctx.storage.delete(key);
        } else if (record.status === 'pending') {
          next = Math.min(next, record.retryAt && record.retryAt > now ? record.retryAt : record.dueAt);
        } else {
          next = Math.min(next, record.expiresAt);
        }
      } else if (key.startsWith('purchase:')) {
        if (record.expiresAt <= now) await this.ctx.storage.delete(key);
        else next = Math.min(next, record.expiresAt);
      }
    }

    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const now = Date.now();
    const records = await this.ctx.storage.list({ prefix: 'event:' });
    for (const [key, record] of records) {
      if (record.expiresAt <= now) {
        await this.ctx.storage.delete(key);
        continue;
      }
      if (record.status !== 'pending' || Math.max(record.dueAt, record.retryAt ?? 0) > now) continue;

      try {
        await this.env.CAPI_OUTBOUND.send({
          sessionId: this.ctx.id.toString(),
          eventKey: record.eventKey,
        });
        // Reload after the queue call so a concurrent purchase enrichment is
        // not overwritten by this alarm's stale copy of the pending event.
        const latest = await this.ctx.storage.get(key);
        if (!latest) continue;
        if (latest.status === 'pending') {
          latest.status = 'queued';
          latest.retryAt = null;
          await this.ctx.storage.put(key, latest);
        }
      } catch (error) {
        const latest = await this.ctx.storage.get(key);
        if (latest?.status === 'pending') {
          latest.retryAt = now + ALARM_RETRY_MS;
          await this.ctx.storage.put(key, latest);
        }
        console.error('conversions queue send failed', String(error));
      }
    }

    await this.scheduleNextAlarm();
  }
}

/* ----- Handler ----- */

/** `{ session_id, consent: { advertising: false } }` from the browser relay. */
function isWithdrawal(body) {
  return body?.consent?.advertising === false
    && typeof body.session_id === 'string' && body.session_id.length > 0 && body.session_id.length <= 128;
}

/** Clear a session's buffered events and block in-flight ones (EventBuffer /revoke). */
async function revokeSession(env, sessionId, cors) {
  const stub = env.EVENT_BUFFER.get(env.EVENT_BUFFER.idFromName(sessionId));
  const revoked = await stub.fetch('https://event-buffer/revoke', { method: 'POST' });
  if (!revoked.ok) return json(502, { error: 'could not clear pending events' }, cors);
  return json(202, { revoked: true }, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';
    const originAllowed = allowedOrigins(env).includes(origin);
    const cors = originAllowed ? corsHeaders(origin) : {};

    if (!['/events', '/consent'].includes(url.pathname)) return json(404, { error: 'not found' });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: originAllowed ? 204 : 403, headers: cors });
    }
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' }, cors);
    if (!originAllowed) return json(403, { error: 'origin not allowed' });

    if (url.pathname === '/consent') {
      let body;
      try { body = await request.json(); } catch { return json(400, { error: 'body must be JSON' }, cors); }
      if (!isWithdrawal(body)) {
        return json(400, { error: 'a session id and advertising consent withdrawal are required' }, cors);
      }
      return revokeSession(env, body.session_id, cors);
    }

    const pixels = configuredPixels(env);
    if (!pixels.length) {
      return json(500, { error: 'relay is missing its pixel id or api key' }, cors);
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) return json(413, { error: 'body too large' }, cors);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json(400, { error: 'body must be JSON' }, cors);
    }

    // A withdrawal posted to /events (older pages did this) clears the buffer
    // too, rather than being quietly accepted as "no consent".
    if (isWithdrawal(body) && !body.event) return revokeSession(env, body.session_id, cors);

    // Consent is enforced here as well as in the browser.
    if (body?.consent?.advertising !== true) {
      return json(202, { forwarded: false, reason: 'no advertising consent' }, cors);
    }

    let conversion;
    try {
      conversion = toConversionEvent(body, request);
    } catch (error) {
      if (error instanceof InvalidEventError) return json(400, { error: error.message }, cors);
      throw error;
    }
    if (!conversion) return json(202, { forwarded: false, reason: 'event not forwarded' }, cors);

    const sessionId = typeof body.session_id === 'string' && body.session_id.length <= 128
      ? body.session_id
      : (typeof body.cart_id === 'string' ? body.cart_id : `event-${conversion.id}`);
    const cartId = typeof body.cart_id === 'string' && body.cart_id.length <= 128 ? body.cart_id : null;
    const id = env.EVENT_BUFFER.idFromName(sessionId);
    const stub = env.EVENT_BUFFER.get(id);
    const buffered = await stub.fetch('https://event-buffer/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversion, cartId }),
    });
    if (!buffered.ok) return json(502, { error: 'could not buffer event' }, cors);
    const bufferResult = await buffered.json();
    if (bufferResult.accepted === false) {
      return json(202, { forwarded: false, reason: bufferResult.reason }, cors);
    }

    return json(202, {
      queued: true,
      type: conversion.type,
      id: conversion.id,
      cart_id: cartId,
      delay_ms: HOLD_MS,
      validate_only: env.VALIDATE_ONLY === 'true',
    }, cors);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      const { sessionId, eventKey } = message.body ?? {};
      if (!sessionId || !eventKey) {
        message.ack();
        continue;
      }

      try {
        const id = env.EVENT_BUFFER.idFromString(sessionId);
        const stub = env.EVENT_BUFFER.get(id);
        const response = await stub.fetch('https://event-buffer/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventKey }),
        });
        if (response.status >= 500) message.retry({ delaySeconds: 20 });
        else message.ack();
      } catch (error) {
        console.error('conversions queue dispatch failed', String(error));
        message.retry({ delaySeconds: 20 });
      }
    }
  },
};
