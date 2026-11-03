/**
 * Motion Club: a monthly auto-ship membership, sold from its own dialog so the
 * shop's checkout stays unchanged.
 *
 *   Free 14-day trial   email only               → trial_started
 *   Start membership    email + (mock) card       → subscription_created
 *
 * The scrolling banner, the header "Club" link and a #club link open it.
 * Each sign-up gets a member ID (NMC-…), used as the event id so the browser
 * pixel and the server relay copies deduplicate, and as the funnel reference
 * (cart_id) for the hashed external ID.
 */
import { $, escapeHtml } from './dom.js';
import { state } from './state.js';
import { emit, on } from './events.js';
import { formatPrice } from './currency.js';
import { CLUB, findProduct } from './catalog.js';
import { garmentMarkup } from './garment.js';
import { openDialog, closeDialog, isDialogOpen } from './focus.js';
import { createDemoShopper } from './demo-shopper.js';
import { validateCard, isDeclinedTestCard, detectCardBrand, formatCardNumber } from './card-validation.js';

const HASH = '#club';

let option = 'trial';         // 'trial' | 'monthly'
let memberId = null;          // set once a sign-up succeeds
let demoEmail = '';
let viewedThisVisit = false;

const price = () => formatPrice(CLUB.monthlyPrices[state.currency], state.currency);

function createMemberId() {
  const random = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `NMC-${random.toUpperCase()}`;
}

/* ----- Banner ----- */

function renderBanner() {
  const text = `NEW: MOTION CLUB ✦ FRESH GEAR SHIPPED MONTHLY ✦ ${price().toUpperCase()}/MONTH ✦ TRY IT FREE FOR ${CLUB.trialDays} DAYS ✦ `;
  $('#club-banner-track').textContent = text + text; // twice, for a seamless loop
  $('#club-banner').setAttribute('aria-label', `Motion Club: new gear shipped monthly, ${price()} a month. Start a free ${CLUB.trialDays}-day trial`);
}

/* ----- Promo card ----- */

/** Three pieces peeking out of the monthly box (the art is decorative). */
const CARD_PICKS = [
  ['YOG-LG-W', 'olive'],
  ['CKE-TEE-W', 'terracotta'],
  ['RUN-JK-M', 'espresso'],
];

/** Boxes ship on the 1st: the next one is the 1st of next month. */
function nextShipDate(today = new Date()) {
  const date = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderCard() {
  const items = $('#club-card-items');
  if (!items) return;
  if (!items.childElementCount) {
    items.innerHTML = CARD_PICKS
      .map(([sku, color], index) => `<span class="club-card__item club-card__item--${index + 1}">${garmentMarkup(findProduct(sku), color)}</span>`)
      .join('');
  }
  $('#club-card-ship').textContent = `next box ships ${nextShipDate()}`;
  $('#club-card-price').textContent = price();
}

/* ----- Dialog markup ----- */

function optionMarkup(value, title, detail) {
  return `
    <label class="club-option">
      <input type="radio" name="club-option" value="${value}" ${option === value ? 'checked' : ''}>
      <span><b>${title}</b><small>${detail}</small></span>
    </label>`;
}

function formMarkup() {
  const paid = option === 'monthly';
  const sizes = CLUB.sizes.map((size) => `<option${size === 'M' ? ' selected' : ''}>${size}</option>`).join('');
  const focuses = CLUB.focuses.map((focus) => `<option>${focus}</option>`).join('');

  return `
    <p class="club__lead">New gear on repeat. Every month we ship one new piece from the latest drop,
      in your size, picked for how you train. Swap anything for free; skip or cancel any month.</p>
    <ul class="club__perks">
      <li>One new piece every month, ${price()}</li>
      <li>Free shipping and free swaps on every box</li>
      <li>First pick of each drop, before it sells out</li>
    </ul>
    <form class="checkout-form club-form" id="club-form" novalidate>
      <fieldset class="club-options">
        <legend class="visually-hidden">Choose how to join</legend>
        ${optionMarkup('trial', `Free ${CLUB.trialDays}-day trial`, 'Just your email. Preview your first pick; nothing ships or charges until you start.')}
        ${optionMarkup('monthly', `Start membership: ${price()}/month`, 'Your first box ships this week. Cancel anytime.')}
      </fieldset>
      <div class="checkout-form__row">
        <label for="club-size">Your size <select id="club-size">${sizes}</select></label>
        <label for="club-focus">You mostly <select id="club-focus">${focuses}</select></label>
      </div>
      <label for="club-email">Email
        <input id="club-email" type="email" required autocomplete="email" value="${escapeHtml(demoEmail)}">
      </label>
      ${paid ? `
        <p class="demo-shopper-note">Test cards: 4242 4242 4242 4242 is approved, 4000 0000 0000 0002 is declined.</p>
        <label for="club-card">Card number
          <input id="club-card" inputmode="numeric" autocomplete="cc-number" value="4242 4242 4242 4242" aria-describedby="club-error">
        </label>
        <div class="checkout-form__row">
          <label for="club-expiry">Expiry (MM/YY)
            <input id="club-expiry" inputmode="numeric" autocomplete="cc-exp" value="12/28" aria-describedby="club-error">
          </label>
          <label for="club-cvc">CVC
            <input id="club-cvc" inputmode="numeric" autocomplete="cc-csc" value="123" aria-describedby="club-error">
          </label>
        </div>` : ''}
      <p class="payment-error" id="club-error" role="alert" hidden></p>
      <button type="submit" class="checkout-next">${paid ? `Start membership · ${price()}/mo` : 'Start free trial'}</button>
      <p class="checkout-note">Demo store · no real payment taken</p>
    </form>`;
}

function confirmationMarkup() {
  const paid = option === 'monthly';
  return `
    <div class="order-confirmation">
      <div class="display">${paid ? 'Welcome to the Club' : 'Your trial is on'}</div>
      <p>${paid
        ? `Your first box ships this week. ${price()} a month, cancel anytime.`
        : `${CLUB.trialDays} days free. We'll email your first pick; start your membership any time.`}</p>
      <p class="bag-order-reference">Member reference: <code>${escapeHtml(memberId)}</code></p>
    </div>
    <button type="button" class="checkout-next" data-club-close>Back to the shop</button>`;
}

function render() {
  $('#club-body').innerHTML = memberId ? confirmationMarkup() : formMarkup();
}

/* ----- Open / close ----- */

export function openClub(source = 'banner', preferredOption) {
  const modal = $('#club-modal');
  if (!isDialogOpen(modal)) {
    memberId = null;
    if (CLUB.plans[preferredOption]) option = preferredOption;
    render();
    modal.hidden = false;
    openDialog(modal, $('#club-close'));
    history.replaceState(null, '', HASH);
  }

  // The plan is the "content" being viewed: one contents_viewed per visit.
  if (!viewedThisVisit) {
    viewedThisVisit = true;
    emit('membership_viewed', { source });
  }

  if (!demoEmail) prepareDemoEmail();
}

/** Fetch a fresh fake shopper's email and fill the field if it's still empty. */
function prepareDemoEmail() {
  createDemoShopper().then((shopper) => {
    demoEmail = shopper.email;
    const field = $('#club-email');
    if (field && !field.value) field.value = demoEmail;
  }).catch(() => { /* the shopper can type an email */ });
}

function closeClub() {
  const modal = $('#club-modal');
  if (modal.hidden) return;
  modal.hidden = true;
  closeDialog(modal);
  if (location.hash === HASH) history.replaceState(null, '', location.pathname + location.search);
}

/* ----- Sign-up ----- */

function showError(message, fieldSelector) {
  const error = $('#club-error');
  error.textContent = message;
  error.hidden = false;
  const field = fieldSelector && $(fieldSelector);
  field?.setAttribute('aria-invalid', 'true');
  field?.focus();
}

function checkCard() {
  const number = $('#club-card').value;
  const problem = validateCard({ number, expiry: $('#club-expiry').value, cvc: $('#club-cvc').value });
  const brand = detectCardBrand(number)?.id ?? 'unknown'; // never the card itself

  if (problem) {
    showError(problem.message, { number: '#club-card', expiry: '#club-expiry', cvc: '#club-cvc' }[problem.field]);
    emit('payment_failed', { reason: problem.reason, card_brand: brand, source: 'membership' });
    return false;
  }
  if (isDeclinedTestCard(number)) {
    showError('Your card was declined. Try another card.', '#club-card');
    emit('payment_failed', { reason: 'declined', card_brand: brand, source: 'membership' });
    return false;
  }
  return true;
}

function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  $('#club-error').hidden = true;
  form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));

  if (!form.reportValidity()) return;
  if (option === 'monthly' && !checkCard()) return;

  memberId = createMemberId();
  state.member = { email: $('#club-email').value.trim() };

  const plan = CLUB.plans[option];
  const details = {
    id: memberId,        // event id: pixel and relay copies deduplicate on it
    cart_id: memberId,   // funnel reference for the hashed external ID
    plan_id: plan.planId,
    size: $('#club-size').value,
    focus: $('#club-focus').value,
  };

  if (option === 'monthly') {
    emit('membership_started', { ...details, amount: CLUB.monthlyPrices[state.currency] });
  } else {
    emit('membership_trial_started', details);
  }

  state.member = {}; // the adapters copied what they need when the event fired

  // Each sign-up is a new demo person, like each checkout order.
  demoEmail = '';
  prepareDemoEmail();

  render();
  $('#club-close').focus();
}

function handleInput(event) {
  if (event.target.id === 'club-card') {
    event.target.value = formatCardNumber(event.target.value);
  }
  if (event.target.id === 'club-expiry') {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
    event.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }
}

function handleChange(event) {
  if (event.target.name !== 'club-option') return;
  const email = $('#club-email').value;
  option = event.target.value;
  render();
  $('#club-email').value = email;
  $(`input[name="club-option"][value="${option}"]`).focus();
  emit('membership_option_selected', { option });
}

/* ----- Setup ----- */

export function initMembership() {
  const modal = $('#club-modal');
  renderBanner();
  renderCard();

  $('#club-banner').addEventListener('click', () => openClub('banner'));
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-club]');
    if (opener) {
      event.preventDefault();
      openClub(opener.dataset.clubSource ?? 'nav', opener.dataset.clubOption);
    }
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('#club-close, [data-club-close]')) closeClub();
  });
  modal.addEventListener('submit', handleSubmit);
  modal.addEventListener('input', handleInput);
  modal.addEventListener('change', handleChange);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isDialogOpen(modal)) closeClub();
  });

  on('currency_changed', () => {
    renderBanner();
    renderCard();
    if (!modal.hidden && !memberId) render();
  });

  const openFromHash = () => { if (location.hash === HASH) openClub('link'); };
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}
