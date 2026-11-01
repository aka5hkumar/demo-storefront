/**
 * Bag drawer and the simulated checkout.
 * Steps: bag → contact → shipping → payment → confirmation.
 *
 * Contact and shipping forms are prefilled with a fresh fake shopper per order
 * (see demo-shopper.js). What the shopper submits is kept in state.customer for
 * future tracking adapters; it is never put into event payloads here.
 */
import { $, $$, escapeHtml } from './dom.js';
import { state } from './state.js';
import { emit, on } from './events.js';
import { formatPrice, shippingCost } from './currency.js';
import { COLORS, CARD_BACKGROUNDS, GENDER_LABELS, findProduct } from './catalog.js';
import { garmentMarkup } from './garment.js';
import { getSelection } from './selection.js';
import { createDemoShopper } from './demo-shopper.js';
import {
  validateCard, isDeclinedTestCard, detectCardBrand, formatCardNumber,
} from './card-validation.js';

const CHECKOUT_STEPS = [
  { id: 'bag',      title: 'Your Bag',  nextLabel: 'Checkout →' },
  { id: 'contact',  title: 'Contact',   nextLabel: 'Continue to shipping →' },
  { id: 'shipping', title: 'Shipping',  nextLabel: 'Continue to payment →' },
  { id: 'payment',  title: 'Payment',   nextLabel: 'Place order' },
  { id: 'done',     title: 'Thank you' },
];

export function initBag() {
  $('#bag-button').addEventListener('click', openBag);
  $('#bag-close').addEventListener('click', closeBag);
  $('#bag-scrim').addEventListener('click', closeBag);
  $('#bag-body').addEventListener('click', handleBagClick);
  $('#bag-body').addEventListener('input', handlePaymentInput);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeBag();
  });

  on('currency_changed', renderBag);
  renderBag();
}

/* ----- Demo shopper ----- */

let demoShopper = null;
let demoShopperRequest = null;

/** Start fetching a fake shopper in the background (once per order). */
function prepareDemoShopper() {
  if (demoShopper || demoShopperRequest) return;

  demoShopperRequest = createDemoShopper().then((shopper) => {
    demoShopper = shopper;
    demoShopperRequest = null;

    // If a form is already showing empty fields, fill it in now.
    const stepId = CHECKOUT_STEPS[state.checkoutStep].id;
    if (stepId === 'contact' || stepId === 'shipping') renderBag();
  });
}

function shuffleDemoShopper() {
  demoShopper = null;
  demoShopperRequest = null;
  prepareDemoShopper();
  renderBag();
}

/** Save what's in the current form (the shopper may have edited it). */
function saveFormValues() {
  $$('#bag-body form [name]').forEach((field) => {
    state.customer[field.name] = field.value.trim();
  });
}

/* ----- Bag contents ----- */

const lineKey = (sku, color, size) => `${sku}|${color}|${size}`;

/** Bag lines joined with their product data. */
function bagLines() {
  return [...state.bag.entries()].map(([key, line]) => ({
    key,
    ...line,
    product: findProduct(line.sku),
  }));
}

function subtotal() {
  return bagLines().reduce(
    (sum, line) => sum + line.product.prices[state.currency] * line.quantity,
    0,
  );
}

function itemCount() {
  return bagLines().reduce((sum, line) => sum + line.quantity, 0);
}

/** Tracking payload for one unit of a bag line. */
function lineTrackingDetails(product, color, size) {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    gender: product.gender,
    color,
    size,
    quantity: 1,
    unit_price: product.prices[state.currency],
  };
}

/** Add one unit of a product, in its currently selected colour and size, then open the bag. */
export function addToBag(product, source) {
  const { color, size } = getSelection(product);
  const key = lineKey(product.sku, color, size);
  const line = state.bag.get(key) ?? { sku: product.sku, color, size, quantity: 0 };

  line.quantity += 1;
  state.bag.set(key, line);

  emit('add_to_cart', { ...lineTrackingDetails(product, color, size), source });
  bumpBagButton();

  state.checkoutStep = 0;
  openBag();
}

function changeQuantity(key, delta) {
  const line = state.bag.get(key);
  if (!line) return;

  const product = findProduct(line.sku);
  line.quantity += delta;
  if (line.quantity <= 0) state.bag.delete(key);

  const eventName = delta > 0 ? 'add_to_cart' : 'remove_from_cart';
  emit(eventName, { ...lineTrackingDetails(product, line.color, line.size), source: 'bag_quantity' });
  renderBag();
}

/* ----- Drawer ----- */

export function openBag() {
  prepareDemoShopper();
  document.body.classList.add('bag-is-open');
  $('#bag-drawer').setAttribute('aria-hidden', 'false');
  renderBag();
  emit('cart_opened', { subtotal: subtotal() });
}

export function closeBag() {
  document.body.classList.remove('bag-is-open');
  $('#bag-drawer').setAttribute('aria-hidden', 'true');
}

function bumpBagButton() {
  const button = $('#bag-button');
  button.classList.remove('is-bumping');
  void button.offsetWidth; // restart the CSS animation
  button.classList.add('is-bumping');
}

/* ----- Rendering ----- */

function renderBag() {
  const step = CHECKOUT_STEPS[state.checkoutStep];

  $('#bag-count').textContent = itemCount();
  $('#bag-title').textContent = step.title;
  $$('#checkout-progress li').forEach((item, index) => {
    item.classList.toggle('is-reached', index <= state.checkoutStep);
  });

  const stepMarkup = {
    bag: bagStepMarkup,
    contact: contactStepMarkup,
    shipping: shippingStepMarkup,
    payment: paymentStepMarkup,
    done: confirmationMarkup,
  }[step.id];

  $('#bag-body').innerHTML = stepMarkup();
}

function totalsMarkup({ nextLabel, nextDisabled = false }) {
  const itemsTotal = subtotal();
  const shipping = shippingCost(itemsTotal, state.currency);
  const backButton = state.checkoutStep > 0
    ? '<button type="button" class="checkout-back" data-checkout-back>← Back</button>'
    : '';

  return `
    <div class="bag-totals">
      <div class="bag-totals__row"><span>Subtotal</span><span>${formatPrice(itemsTotal, state.currency)}</span></div>
      <div class="bag-totals__row"><span>Shipping</span><span>${shipping ? formatPrice(shipping, state.currency) : 'Free'}</span></div>
      <div class="bag-totals__row bag-totals__row--total"><span>Total</span><span>${formatPrice(itemsTotal + shipping, state.currency)}</span></div>
      <button type="button" class="checkout-next" data-checkout-next ${nextDisabled ? 'disabled' : ''}>${nextLabel}</button>
      ${backButton}
      <button type="button" class="checkout-continue" data-continue-shopping>Continue shopping</button>
      <p class="checkout-note">Demo store · no real payment taken</p>
    </div>`;
}

function bagStepMarkup() {
  const lines = bagLines();

  const linesMarkup = lines.length
    ? lines.map(bagLineMarkup).join('')
    : '<p class="bag-empty">Your bag is empty. Tap + Add on any product.</p>';

  return linesMarkup + totalsMarkup({ nextLabel: CHECKOUT_STEPS[0].nextLabel, nextDisabled: !lines.length });
}

function bagLineMarkup({ key, product, color, size, quantity }) {
  return `
    <div class="bag-line">
      <span class="bag-line__thumb" style="background: ${CARD_BACKGROUNDS[product.background]}">
        ${garmentMarkup(product, color)}
      </span>
      <div class="bag-line__info">
        <b>${product.name}</b>
        <small>${GENDER_LABELS[product.gender]} · ${COLORS[color].label} · ${size}</small>
        <span class="quantity">
          <button type="button" data-decrease="${key}" aria-label="Remove one">−</button>
          ${quantity}
          <button type="button" data-increase="${key}" aria-label="Add one">+</button>
        </span>
      </div>
      <span class="bag-line__price">${formatPrice(product.prices[state.currency] * quantity, state.currency)}</span>
    </div>`;
}

/** Value for a prefilled field: what the shopper typed, else the demo shopper, else blank. */
function fieldValue(name, demoValue) {
  return escapeHtml(state.customer[name] ?? demoValue ?? '');
}

function demoShopperNote() {
  if (!demoShopper) return '<p class="demo-shopper-note">Generating demo shopper details…</p>';
  return `<p class="demo-shopper-note">Demo details near ${escapeHtml(demoShopper.city)}.
    <button type="button" class="link-button" data-shuffle-shopper>Shuffle</button></p>`;
}

function contactStepMarkup() {
  const shopper = demoShopper ?? {};
  const fullName = shopper.firstName ? `${shopper.firstName} ${shopper.lastName}` : '';

  return `
    ${demoShopperNote()}
    <form class="checkout-form">
      <label for="checkout-email">Email
        <input id="checkout-email" name="email" type="email" required autocomplete="email" value="${fieldValue('email', shopper.email)}">
      </label>
      <label for="checkout-name">Full name
        <input id="checkout-name" name="name" required autocomplete="name" value="${fieldValue('name', fullName)}">
      </label>
      <label for="checkout-phone">Phone
        <input id="checkout-phone" name="phone" type="tel" autocomplete="tel" value="${fieldValue('phone', shopper.phone)}">
      </label>
    </form>
    ${totalsMarkup({ nextLabel: CHECKOUT_STEPS[1].nextLabel })}`;
}

const SHIPPING_COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'Japan'];

function countryOptions(selected) {
  const countries = SHIPPING_COUNTRIES.includes(selected) || !selected
    ? SHIPPING_COUNTRIES
    : [selected, ...SHIPPING_COUNTRIES];

  return countries.map((country) => `
    <option ${country === selected ? 'selected' : ''}>${escapeHtml(country)}</option>
  `).join('');
}

function shippingStepMarkup() {
  const shopper = demoShopper ?? {};
  const country = state.customer.country ?? shopper.country;

  return `
    ${demoShopperNote()}
    <form class="checkout-form">
      <label for="checkout-address">Address
        <input id="checkout-address" name="street" required autocomplete="street-address" value="${fieldValue('street', shopper.street)}">
      </label>
      <div class="checkout-form__row">
        <label for="checkout-city">City
          <input id="checkout-city" name="city" required autocomplete="address-level2" value="${fieldValue('city', shopper.city)}">
        </label>
        <label for="checkout-region">State / region
          <input id="checkout-region" name="region" autocomplete="address-level1" value="${fieldValue('region', shopper.region)}">
        </label>
      </div>
      <div class="checkout-form__row">
        <label for="checkout-postcode">Postal code
          <input id="checkout-postcode" name="postcode" required autocomplete="postal-code" value="${fieldValue('postcode', shopper.postcode)}">
        </label>
        <label for="checkout-country">Country
          <select id="checkout-country" name="country" autocomplete="country-name">${countryOptions(country)}</select>
        </label>
      </div>
    </form>
    ${totalsMarkup({ nextLabel: CHECKOUT_STEPS[2].nextLabel })}`;
}

/*
 * Payment fields deliberately have no `name`, so saveFormValues() never stores
 * card details. They're only checked locally (card-validation.js).
 */
function paymentStepMarkup() {
  return `
    <p class="demo-shopper-note">Test cards: 4242 4242 4242 4242 is approved, 4000 0000 0000 0002 is declined.</p>
    <form class="checkout-form" novalidate>
      <label for="checkout-card">Card number <span class="card-brand" id="card-brand">Visa</span>
        <input id="checkout-card" inputmode="numeric" autocomplete="cc-number" value="4242 4242 4242 4242" aria-describedby="payment-error">
      </label>
      <div class="checkout-form__row">
        <label for="checkout-expiry">Expiry (MM/YY)
          <input id="checkout-expiry" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" value="12/28" aria-describedby="payment-error">
        </label>
        <label for="checkout-cvc">CVC
          <input id="checkout-cvc" inputmode="numeric" autocomplete="cc-csc" value="123" aria-describedby="payment-error">
        </label>
      </div>
      <p class="payment-error" id="payment-error" role="alert" hidden></p>
    </form>
    ${totalsMarkup({ nextLabel: CHECKOUT_STEPS[3].nextLabel })}`;
}

const PAYMENT_FIELDS = {
  number: '#checkout-card',
  expiry: '#checkout-expiry',
  cvc: '#checkout-cvc',
};

function showPaymentError(fieldKey, message) {
  const error = $('#payment-error');
  error.textContent = message;
  error.hidden = false;

  const field = fieldKey && $(PAYMENT_FIELDS[fieldKey]);
  field?.setAttribute('aria-invalid', 'true');
  field?.focus();
}

function clearPaymentError() {
  const error = $('#payment-error');
  if (error) error.hidden = true;
  Object.values(PAYMENT_FIELDS).forEach((selector) => $(selector)?.removeAttribute('aria-invalid'));
}

/** Validate the card locally. Returns true when the order can be placed. */
function checkPayment() {
  clearPaymentError();

  const number = $('#checkout-card').value;
  const problem = validateCard({
    number,
    expiry: $('#checkout-expiry').value,
    cvc: $('#checkout-cvc').value,
  });

  // Never include card details in events: only the reason and the brand.
  const brand = detectCardBrand(number)?.id ?? 'unknown';

  if (problem) {
    showPaymentError(problem.field, problem.message);
    emit('payment_failed', { reason: problem.reason, card_brand: brand });
    return false;
  }

  if (isDeclinedTestCard(number)) {
    showPaymentError('number', 'Your card was declined. Try another card.');
    emit('payment_failed', { reason: 'declined', card_brand: brand });
    return false;
  }

  return true;
}

/** Live formatting while typing: card number groups, MM/YY slash, brand label. */
function handlePaymentInput(event) {
  const field = event.target;
  if (!Object.values(PAYMENT_FIELDS).some((selector) => field.matches(selector))) return;

  clearPaymentError();

  if (field.id === 'checkout-card') {
    field.value = formatCardNumber(field.value);
    $('#card-brand').textContent = detectCardBrand(field.value)?.label ?? '';
  }

  if (field.id === 'checkout-expiry' && event.inputType !== 'deleteContentBackward') {
    const digits = field.value.replace(/\D/g, '').slice(0, 4);
    field.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  if (field.id === 'checkout-cvc') {
    field.value = field.value.replace(/\D/g, '').slice(0, 4);
  }
}

function confirmationMarkup() {
  return `
    <div class="order-confirmation">
      <div class="display">Order placed</div>
      <p>Order ${state.orderId}<br>A confirmation would go to your email.</p>
    </div>
    <button type="button" class="checkout-next" data-keep-shopping>Keep shopping</button>`;
}

/* ----- Checkout navigation ----- */

function placeOrder() {
  state.orderId = `NM-${Date.now().toString(36).toUpperCase()}`;

  emit('order_placed', {
    id: state.orderId, // stable id so a server-side copy can be deduplicated
    items: bagLines().map(({ product, color, size, quantity }) => ({
      sku: product.sku,
      color,
      size,
      quantity,
      unit_price: product.prices[state.currency],
    })),
    total: subtotal(),
  });
}

function goToNextStep() {
  const form = $('#bag-body form');
  if (form && !form.reportValidity()) return;
  if (CHECKOUT_STEPS[state.checkoutStep].id === 'payment' && !checkPayment()) return;
  saveFormValues();

  if (CHECKOUT_STEPS[state.checkoutStep].id === 'payment') {
    placeOrder();
    // The next order gets a brand-new demo shopper.
    state.customer = {};
    demoShopper = null;
    prepareDemoShopper();
  }

  state.checkoutStep += 1;
  const nextStep = CHECKOUT_STEPS[state.checkoutStep];
  if (nextStep.id !== 'done') emit('checkout_step', { step: nextStep.id });

  renderBag();
}

function handleBagClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;

  if (data.increase) changeQuantity(data.increase, +1);
  if (data.decrease) changeQuantity(data.decrease, -1);

  if ('checkoutNext' in data) goToNextStep();

  if ('checkoutBack' in data) {
    saveFormValues();
    state.checkoutStep -= 1;
    renderBag();
  }

  if ('continueShopping' in data) {
    saveFormValues();
    closeBag();
  }

  if ('shuffleShopper' in data) {
    state.customer = {};
    shuffleDemoShopper();
  }

  if ('keepShopping' in data) {
    state.bag.clear();
    state.checkoutStep = 0;
    renderBag();
    closeBag();
  }
}
