/**
 * Entry point. Wires up each feature module and the currency picker.
 */
import { $ } from './dom.js';
import { state } from './state.js';
import { emit } from './events.js';
import { loadSavedCurrency, saveCurrency } from './currency.js';
import { installConsoleLogger } from './adapters/console-logger.js';
import { initConsent, getConsent } from './consent.js';
import { initInfoDialogs } from './info.js';
import { initBag } from './bag.js';
import { initShop } from './shop.js';
import { initHero } from './hero.js';

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

installConsoleLogger(); // first, so it sees every event below
initConsent();
initInfoDialogs();
initBag();
initShop();
initHero();
initCurrencyPicker();

emit('page_view', { url: location.href });

// Handy for debugging and for future tracking adapters.
window.nmConsent = getConsent;
