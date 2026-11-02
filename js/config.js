/**
 * Deployment settings. The pixel is off while PIXEL_IDS is empty.
 */

/**
 * Browser pixel (js/adapters/pixel.js).
 *   PIXEL_IDS         one or more Pixel IDs from the conversions tab in Ads Manager.
 *                     Every event goes to every ID listed (OpenAI: "Configure
 *                     more than one Pixel ID").
 *   PIXEL_SCRIPT_URL  the SDK script from OpenAI's install snippet.
 *   PIXEL_DEBUG       logs the SDK's activity to the browser console.
 */
export const PIXEL_IDS = [
  // 'pixel-id-1',
  // 'pixel-id-2',
	'Atniqn5shCqiSTjXQNBGi8', //Akash Pixel
	'YaxrwfU3E1wM1fLC6Ws1ua' //OpenAI Pixel
];
export const PIXEL_SCRIPT_URL = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
export const PIXEL_DEBUG = false;

/**
 * Server relay (js/adapters/capi-relay.js): the Cloudflare Worker that forwards
 * events to the Conversions API. The Worker holds the Pixel IDs and API keys.
 * Leave empty until it's deployed.
 */
export const CONVERSIONS_RELAY_URL = 'https://capi.akash.app/events';
