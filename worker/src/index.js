/**
 * Nano Motion conversions relay (Cloudflare Worker).
 *
 * POST /events  ← one storefront event from the browser relay
 *   1. CORS: only the storefront's origins may call it
 *   2. consent: events without advertising consent are dropped
 *   3. validate + map to an OpenAI Conversions API event (map-event.js)
 *   4. forward straight to https://bzr.openai.com/v1/events, once per Pixel ID
 *      (the API takes one pixel per request: ?pid=…)
 *
 * No buffering or queue yet: each event is forwarded as it arrives, with one
 * retry on a network error or 5xx. The browser doesn't wait on this.
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

  // One retry on a network error or server error. Same event id, so it can't double count.
  let response;
  try {
    response = await send();
    if (response.status >= 500) response = await send();
  } catch {
    response = await send();
  }

  return { pid, status: response.status, body: await response.text() };
}

/* ----- Handler ----- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';
    const originAllowed = allowedOrigins(env).includes(origin);
    const cors = originAllowed ? corsHeaders(origin) : {};

    if (url.pathname !== '/events') return json(404, { error: 'not found' });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: originAllowed ? 204 : 403, headers: cors });
    }
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' }, cors);
    if (!originAllowed) return json(403, { error: 'origin not allowed' });

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

    // Same event (same id) to every pixel, in parallel. Dedup is per pixel,
    // so each pixel matches it with its own browser copy.
    const results = await Promise.all(pixels.map(async (pixel) => {
      try {
        const upstream = await postToConversionsApi(conversion, pixel, env);
        const ok = upstream.status >= 200 && upstream.status < 300;
        if (!ok) console.error('conversions api', pixel.pid, upstream.status, upstream.body);
        return { pid: pixel.pid, ok, status: upstream.status };
      } catch (error) {
        console.error('conversions api unreachable', pixel.pid, error);
        return { pid: pixel.pid, ok: false, status: null };
      }
    }));

    const allOk = results.every((result) => result.ok);
    return json(allOk ? 202 : 502, {
      forwarded: results.some((result) => result.ok),
      type: conversion.type,
      id: conversion.id,
      validate_only: env.VALIDATE_ONLY === 'true',
      pixels: results,
    }, cors);
  },
};
