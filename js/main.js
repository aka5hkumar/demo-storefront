/**
 * Entry point. Wires up each feature module and the currency picker.
 */
import { $ } from './dom.js';
import { state } from './state.js';
import { emit } from './events.js';
import { loadSavedCurrency, saveCurrency } from './currency.js';
import { installConsoleLogger } from './adapters/console-logger.js';
import { installPixel } from './adapters/pixel.js';
import { installConversionsRelay } from './adapters/capi-relay.js';
import { initConsent, getConsent } from './consent.js';
import { initInfoDialogs } from './info.js';
import { initBag } from './bag.js';
import { initShop } from './shop.js';
import { initHero } from './hero.js';
import { initQuickView } from './quick-view.js';
import { addStructuredData } from './structured-data.js';

function initCurrencyPicker() {
  const picker = $('#currency-picker');
  picker.value = state.currency;

  picker.addEventListener('change', () => {
    const previous = state.currency;
    state.currency = picker.value;
    saveCurrency(state.currency);

    // Shop, bag and hero re-render on this event.
    emit('currency_changed', { from: previous, to: state.currency });
  });
}

state.currency = loadSavedCurrency();

// Tracking adapters first, so they see every event below.
installConsoleLogger();
installPixel();             // off until PIXEL_ID / PIXEL_SCRIPT_URL are set in config.js
installConversionsRelay();  // off until CONVERSIONS_RELAY_URL is set in config.js
initConsent();
initInfoDialogs();
initBag();
initShop();
initHero();
initCurrencyPicker();
initQuickView();      // after the shop, so a #p-SKU link can open straight away
addStructuredData();

emit('page_view', { url: location.href });

// Handy for debugging and for future tracking adapters.
window.nmConsent = getConsent;
