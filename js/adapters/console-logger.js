/**
 * Logs every storefront event to the browser console as "[nm] name {payload}".
 *
 * This is the template for real tracking adapters: an ad-platform Pixel or
 * Conversions API adapter would subscribe the same way, map event names,
 * and check getConsent() from consent.js before sending.
 */
import { on } from '../events.js';

export function installConsoleLogger() {
  on('*', (event) => console.log('[nm]', event.name, event));
}
