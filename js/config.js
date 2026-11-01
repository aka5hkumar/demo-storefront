/**
 * Deployment settings. Everything here is empty (switched off) by default.
 */

/**
 * Browser pixel (js/adapters/pixel.js). Set both to turn it on:
 *   PIXEL_ID          the pixel ID from the ad platform's events manager
 *   PIXEL_SCRIPT_URL  the SDK script URL from the platform's install snippet
 * PIXEL_DEBUG logs the SDK's activity to the browser console.
 */
export const PIXEL_ID = '';
export const PIXEL_SCRIPT_URL = '';
export const PIXEL_DEBUG = false;

/**
 * Server relay (js/adapters/capi-relay.js): the Cloudflare Worker that forwards
 * events to the ad platform's Conversions API. Leave empty until it's deployed.
 */
export const CONVERSIONS_RELAY_URL = '';
